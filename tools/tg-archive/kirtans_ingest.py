#!/usr/bin/env python3
"""
kirtans_ingest.py — ЗАЛИВКА киртанов: Telegram → archive.org → D1 → плеер.

═══ ПОЧЕМУ ПЕРЕПИСАНО ВТОРОЙ РАЗ ═══

Первая качалка была ОДНОПОТОЧНОЙ: один файл скачался — один залился — следующий.
На 42 ГБ это вечность, и основатель час смотрел на ноль.

В проекте УЖЕ ЕСТЬ быстрая качалка — `sb_audio.py`, которой доехали 13 256 файлов
Шримад-Бхагаватам (33 ГБ). Её устройство и берём:

    12 асинхронных воркеров тянут из ОЧЕРЕДИ (без барьера: освободился — взял
       следующий; иначе один залипший файл держит всю пачку);
     6 параллельных заливок на archive.org через семафор;
    блокирующий upload уходит в ThreadPoolExecutor — не держит цикл событий;
    timeout=300 на заливку — БЕЗ НЕГО ОНА ВИСЛА ЧАСАМИ (проверено на ШБ);
    FloodWait от Telegram — ждём и повторяем, а не падаем.

═══ ЧТО КЛАДЁТСЯ КУДА ═══

Один исполнитель — один элемент archive.org — один альбом в приложении:

    iskcon-kirtans-<слаг>  →  kirtan_albums.archive  →  воркер разворачивает
                              элемент в дорожки  →  плеер

Плюс КАЖДАЯ залитая запись пишется в `kirtan_tracks` — из неё витрина строит
СПИСОК ЗАГРУЖЕННЫХ КИРТАНОВ. Список растёт на глазах, пока идёт заливка.

Из канала заливается ВСЁ: что не набрало на именного исполнителя (обрывки,
одиночки, неопознанные) — едет в сборник «Киртания ИСККОН», а не в мусор.

Команды:  plan · run · verify
"""
import asyncio
import json
import os
import re
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).parent
ACCOUNT = "d5cbe19470dc38599873eabfe148e6d1"
DB = "6226aded-dd03-4e74-977f-9cd0b509e73d"
TOKEN = os.getenv("CLOUDFLARE_API_TOKEN") or ""

BUDGET = float(os.getenv("BUDGET_MIN") or 280) * 60
DL_PARALLEL = int(os.getenv("DL_PARALLEL") or 12)   # скачиваний из Telegram разом
IA_PARALLEL = int(os.getenv("IA_PARALLEL") or 6)    # заливок на archive.org разом
MIN_FILES = int(os.getenv("MIN_FILES") or 3)
CHANNEL = os.getenv("TG_CHANNEL") or "@iskconecom"
WORK = Path("/tmp/k")
START = time.time()


def d1(sql: str, params=None):
    req = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/d1/database/{DB}/query",
        data=json.dumps({"sql": sql, "params": params or []}).encode(),
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            body = json.loads(r.read())
    except urllib.error.HTTPError as e:              # ЗКН-Ф014: не падать молча
        print("::error::D1 %s: %s" % (e.code, e.read().decode()[:300]))
        raise
    if not body.get("success"):
        print("::error::D1: %s" % json.dumps(body.get("errors"))[:300])
        raise SystemExit(1)
    return body["result"][0]["results"]


def ensure_schema():
    d1("""CREATE TABLE IF NOT EXISTS kirtans_ingest (
            slug TEXT PRIMARY KEY, identifier TEXT NOT NULL, n_files INTEGER NOT NULL,
            msg_ids TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending',
            uploaded INTEGER NOT NULL DEFAULT 0, note TEXT,
            updated_at TEXT DEFAULT (datetime('now')))""")
    # ДОРОЖКИ. Из них витрина строит список загруженных киртанов.
    d1("""CREATE TABLE IF NOT EXISTS kirtan_tracks (
            id          TEXT PRIMARY KEY,          -- <identifier>/<file>
            artist_slug TEXT NOT NULL,
            identifier  TEXT NOT NULL,
            file        TEXT NOT NULL,
            title       TEXT NOT NULL,
            duration    INTEGER,
            msg_id      INTEGER,
            created_at  TEXT DEFAULT (datetime('now')))""")
    d1("CREATE INDEX IF NOT EXISTS kt_artist ON kirtan_tracks(artist_slug)")


def beat(msg: str):
    """Пульс в базу: логи раннера мне недоступны, а знать, жив ли конвейер, надо СЕЙЧАС."""
    try:
        d1("""INSERT INTO kirtans_ingest (slug, identifier, n_files, msg_ids, state, note, updated_at)
              VALUES ('_heartbeat','-',0,'[]','beat',?1,datetime('now'))
              ON CONFLICT(slug) DO UPDATE SET note=excluded.note, updated_at=datetime('now')""",
           [msg[:180]])
    except Exception:
        pass


def ia_files(identifier: str) -> set:
    """Что РЕАЛЬНО лежит в элементе. Источник истины — архив, а не наш лог."""
    try:
        with urllib.request.urlopen(f"https://archive.org/metadata/{identifier}", timeout=45) as r:
            data = json.loads(r.read())
    except Exception:
        return set()
    return {f["name"] for f in (data.get("files") or [])
            if f.get("source") == "original" and f["name"].lower().endswith(".mp3")}


def clean_title(fname: str, artist: str) -> str:
    """«Aindra Das - Jaya Radha-Madhava.mp3» → «Jaya Radha-Madhava»."""
    s = re.sub(r"\.(mp3|m4a|ogg)$", "", fname, flags=re.I).replace("_", " ")
    for sep in (" - ", " — ", " – "):
        if sep in s:
            s = s.split(sep, 1)[1]
            break
    else:
        a = re.escape(artist.split()[0]) if artist else ""
        if a:
            s = re.sub(r"^%s[\w\s.]*?(?=[A-ZА-Я0-9])" % a, "", s, count=1)
    s = re.sub(r"\s+", " ", s).strip(" .-_")
    return s or fname


# ─────────────────────────── plan ───────────────────────────
def cmd_plan() -> int:
    ensure_schema()
    m = json.loads((HERE / "kirtans_map.json").read_text(encoding="utf-8"))
    probe = json.loads((HERE / "kirtans_probe.json").read_text(encoding="utf-8"))
    all_ids = {f["msg_id"] for ch in probe["channels"] for f in ch["files"]}

    named, n = set(), 0
    for a in sorted(m["artists"], key=lambda x: -x["n_files"]):
        if a["n_files"] < MIN_FILES:
            continue
        named.update(a["msg_ids"])
        d1("""INSERT INTO kirtans_ingest (slug, identifier, n_files, msg_ids, state)
              VALUES (?1,?2,?3,?4,'pending')
              ON CONFLICT(slug) DO UPDATE SET n_files=excluded.n_files, msg_ids=excluded.msg_ids""",
           [a["slug"], "iskcon-kirtans-" + a["slug"], a["n_files"], json.dumps(a["msg_ids"])])
        n += 1

    rest = sorted(all_ids - named)          # СБОРНИК: ничего не выбрасываем
    if rest:
        d1("""INSERT INTO kirtans_ingest (slug, identifier, n_files, msg_ids, state)
              VALUES ('various','iskcon-kirtans-sbornik',?1,?2,'pending')
              ON CONFLICT(slug) DO UPDATE SET n_files=excluded.n_files, msg_ids=excluded.msg_ids""",
           [len(rest), json.dumps(rest)])
        n += 1
    print("::notice::очередь: %d элементов · именных %d · в сборнике %d записей" % (n, n - 1, len(rest)))
    return 0


# ─────────────────────────── run ────────────────────────────
async def main_run() -> int:
    ensure_schema()
    import internetarchive as ia
    from telethon import TelegramClient
    from telethon.sessions import StringSession
    from telethon.errors import FloodWaitError

    rows = d1("""SELECT i.slug, i.identifier, i.n_files, i.msg_ids, a.name
                 FROM kirtans_ingest i JOIN kirtan_artists a ON a.slug=i.slug
                 WHERE i.state<>'done' AND i.slug<>'_heartbeat' ORDER BY i.n_files DESC""")
    if not rows:
        print("::notice::очередь пуста — залито всё")
        Path(os.getenv("GITHUB_OUTPUT") or "/dev/null").open("a").write("left=0\n")
        return 0

    by_msg, have, meta = {}, {}, {}
    for r in rows:
        meta[r["slug"]] = r
        have[r["identifier"]] = ia_files(r["identifier"])
        for mid in json.loads(r["msg_ids"]):
            by_msg[mid] = r
    already = sum(len(v) for v in have.values())
    print("::notice::в работе: %d элементов · %d записей · в архиве уже %d" % (len(rows), len(by_msg), already))
    beat("старт: %d записей, в архиве уже %d" % (len(by_msg), already))

    WORK.mkdir(parents=True, exist_ok=True)
    ak, sk = os.environ["IA_ACCESS_KEY"], os.environ["IA_SECRET_KEY"]
    loop = asyncio.get_running_loop()
    pool = ThreadPoolExecutor(max_workers=IA_PARALLEL + 1)
    sem_up = asyncio.Semaphore(IA_PARALLEL)

    client = TelegramClient(StringSession(os.environ["TG_SESSION_STRING"]),
                            int(os.environ["TG_API_ID"]), os.environ["TG_API_HASH"])

    def do_upload(ident: str, remote: str, path: str, name: str):
        resp = ia.upload(
            ident, files={remote: path},
            metadata={"title": "ISKCON Kirtans — %s" % name, "collection": "opensource_audio",
                      "mediatype": "audio", "creator": name,
                      "subject": ["kirtan", "iskcon", "bhakti", "hare krishna"],
                      "language": ["san", "ben", "eng", "rus"]},
            access_key=ak, secret_key=sk, queue_derive=False, verbose=False,
            retries=2, retries_sleep=20,
            request_kwargs={"timeout": 300},   # БЕЗ ЭТОГО ЗАЛИВКА ВИСЛА ЧАСАМИ (урок ШБ)
        )
        bad = [x for x in resp if getattr(x, "status_code", 200) not in (200, None)]
        if bad:
            raise RuntimeError("HTTP %s" % [getattr(x, "status_code", None) for x in bad])

    done = fail = 0
    seen_album: set = set()
    bytes_done = 0.0
    t0 = time.time()
    stop = False

    async with client:
        await client.start()
        entity = await client.get_entity(CHANNEL)

        # ОДИН проход по каналу — собираем сообщения, а не дёргаем их по одному.
        q: asyncio.Queue = asyncio.Queue()
        async for msg in client.iter_messages(entity):
            r = by_msg.get(msg.id)
            if not r:
                continue
            doc = msg.audio or msg.document
            if not doc:
                continue
            fname, dur = None, 0
            for attr in doc.attributes:
                if hasattr(attr, "file_name"):
                    fname = attr.file_name
                if hasattr(attr, "duration") and getattr(attr, "duration", None):
                    dur = int(attr.duration)          # плеер без длительности слеп
            fname = re.sub(r"[^\w\s.\-()+]", "_", fname or "%s-%d.mp3" % (r["slug"], msg.id))
            if not fname.lower().endswith(".mp3"):
                fname += ".mp3"
            if fname in have[r["identifier"]]:
                continue
            q.put_nowait((msg, fname, r, getattr(doc, "size", 0) or 0, dur))
        total = q.qsize()
        print("::notice::к заливке в этом прогоне: %d записей" % total)
        beat("к заливке: %d записей" % total)

        async def one(msg, fname, r, size, dur):
            nonlocal done, fail, bytes_done
            dest = WORK / ("%d-%s" % (msg.id, fname))
            try:
                while True:                       # FloodWait — ждём, а не падаем
                    try:
                        await client.download_media(msg, file=str(dest))
                        break
                    except FloodWaitError as e:
                        print("FloodWait %ss" % e.seconds)
                        await asyncio.sleep(e.seconds + 1)
                async with sem_up:
                    await loop.run_in_executor(
                        pool, do_upload, r["identifier"], fname, str(dest), r["name"])
            finally:
                dest.unlink(missing_ok=True)

            d1("""INSERT INTO kirtan_tracks (id, artist_slug, identifier, file, title, duration, msg_id)
                  VALUES (?1,?2,?3,?4,?5,?6,?7) ON CONFLICT(id) DO NOTHING""",
               ["%s/%s" % (r["identifier"], fname), r["slug"], r["identifier"], fname,
                clean_title(fname, r["name"]), dur, msg.id])
            if r["slug"] not in seen_album:       # альбом — СРАЗУ, с первой записи
                d1("""INSERT INTO kirtan_albums (id, artist_slug, title, archive, type, sort)
                      VALUES (?1,?2,?3,?4,'kirtan',0)
                      ON CONFLICT(id) DO UPDATE SET archive=excluded.archive""",
                   ["k-" + r["slug"], r["slug"], "Киртаны · " + r["name"], r["identifier"]])
                seen_album.add(r["slug"])
            done += 1
            bytes_done += size

        async def worker():
            nonlocal fail, stop
            while not stop:
                try:
                    msg, fname, r, size, dur = q.get_nowait()
                except asyncio.QueueEmpty:
                    return
                if time.time() - START > BUDGET:
                    stop = True
                    return
                try:
                    await one(msg, fname, r, size, dur)
                except Exception as e:
                    fail += 1
                    print("::warning::%s: %s" % (fname[:40], str(e)[:90]))
                if done and done % 10 == 0:
                    el = max(1.0, time.time() - t0)
                    msg_ = ("залито %d из %d · %.2f ГБ · %.1f МБ/с · ошибок %d"
                            % (done, total, bytes_done / 1e9, bytes_done / 1e6 / el, fail))
                    print("::notice::" + msg_)
                    beat(msg_)

        await asyncio.gather(*[worker() for _ in range(DL_PARALLEL)])

    pool.shutdown(wait=True)

    # ЗКН-Ф021: «готов» = файлы ВИДНЫ В АРХИВЕ, а не «команда отправлена».
    for r in rows:
        n = len(ia_files(r["identifier"]))
        d1("UPDATE kirtans_ingest SET uploaded=?2, state=CASE WHEN ?2>=n_files THEN 'done' ELSE state END,"
           " updated_at=datetime('now') WHERE slug=?1", [r["slug"], n])

    left = d1("SELECT COUNT(*) c FROM kirtans_ingest WHERE state<>'done' AND slug<>'_heartbeat'")[0]["c"]
    tot = d1("SELECT COUNT(*) c FROM kirtan_tracks")[0]["c"]
    print("::notice::ЗА ПРОГОН: %d · ВСЕГО ДОРОЖЕК В БАЗЕ: %d · элементов осталось: %d" % (done, tot, left))
    beat("прогон завершён: всего дорожек %d, осталось элементов %d" % (tot, left))
    Path(os.getenv("GITHUB_OUTPUT") or "/dev/null").open("a").write("left=%d\n" % left)
    return 0


def cmd_verify() -> int:
    rows = d1("SELECT slug, identifier, n_files, state FROM kirtans_ingest WHERE slug<>'_heartbeat'")
    bad = 0
    for r in rows:
        n = len(ia_files(r["identifier"]))
        if r["state"] == "done" and n < r["n_files"]:
            print("::error::%s: помечен готовым, в архиве %d из %d" % (r["slug"], n, r["n_files"]))
            bad += 1
    print("::notice::сверено %d · расхождений %d" % (len(rows), bad))
    return 1 if bad else 0


if __name__ == "__main__":
    import sys
    cmd = sys.argv[1] if len(sys.argv) > 1 else "run"
    if cmd == "plan":
        sys.exit(cmd_plan())
    elif cmd == "verify":
        sys.exit(cmd_verify())
    else:
        sys.exit(asyncio.run(main_run()))
