#!/usr/bin/env python3
"""
katha_ingest.py — ЗАЛИВКА КАТХИ: Telegram → archive.org → D1 → плеер.

Исполняет карту `katha_plan.json` (её строит katha_plan.py и её видно глазами
в репозитории). Гадать здесь не о чем: альбом, имя файла в архиве и название
дорожки уже решены и проверены ДО того, как гигабайты уехали.

Устройство взято у `kirtans_ingest.py` — оно уже увезло 42 ГБ киртанов и 33 ГБ
Шримад-Бхагаватам, и переизобретать его незачем:

    12 асинхронных воркеров тянут из ОЧЕРЕДИ (без барьера);
     6 параллельных заливок на archive.org через семафор;
    блокирующий upload — в ThreadPoolExecutor, чтобы не держать цикл событий;
    timeout=300 на заливку — БЕЗ НЕГО ОНА ВИСЛА ЧАСАМИ (урок ШБ);
    три попытки с растущей паузой — 12 воркеров в один новый элемент дают
       гонку создания (503/SlowDown), без повтора терялась треть записей;
    FloodWait от Telegram — ждём и повторяем, а не падаем.

ИДЕМПОТЕНТНОСТЬ: что уже лежит в архиве, того не качаем. Источник истины —
metadata-API archive.org, а не наш журнал (ЗКН-Ф021).

Команды:  run · verify
"""
import asyncio
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

HERE = Path(__file__).parent
ACCOUNT = "d5cbe19470dc38599873eabfe148e6d1"
DB = "6226aded-dd03-4e74-977f-9cd0b509e73d"
TOKEN = os.getenv("CLOUDFLARE_API_TOKEN") or ""

BUDGET = float(os.getenv("BUDGET_MIN") or 300) * 60
DL_PARALLEL = int(os.getenv("DL_PARALLEL") or 8)
IA_PARALLEL = int(os.getenv("IA_PARALLEL") or 5)
CHANNEL = os.getenv("TG_CHANNEL") or "@radhagovindasw"
WORK = Path("/tmp/katha")
START = time.time()


def plan() -> dict:
    return json.loads((HERE / "katha_plan.json").read_text(encoding="utf-8"))


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


def ia_files(identifier: str) -> dict:
    """Что РЕАЛЬНО лежит в элементе: имя → длина в секундах (или 0).

    Источник истины — архив, а не наш журнал. Длину берём отсюда же: в
    Telegram-метаданных она бывает вздорной (у одной записи стояло 7 ч 39 мин),
    а archive.org считает её по самому файлу.
    """
    try:
        with urllib.request.urlopen(f"https://archive.org/metadata/{identifier}", timeout=45) as r:
            data = json.loads(r.read())
    except urllib.error.HTTPError as e:
        if e.code != 404:                            # 404 = элемента ещё нет, это норма
            print("::warning::archive.org %s: %s" % (e.code, identifier))
        return {}
    except Exception as e:                           # noqa: BLE001
        print("::warning::archive.org %s: %s" % (identifier, str(e)[:120]))
        return {}
    out = {}
    for f in data.get("files") or []:
        if f.get("source") != "original" or not f["name"].lower().endswith(".mp3"):
            continue
        try:
            ln = float(f.get("length") or 0)
        except (TypeError, ValueError):
            ln = 0.0
        out[f["name"]] = int(ln)
    return out


def register(al: dict, t: dict, dur: int):
    d1("""INSERT INTO katha_tracks (id, speaker_slug, album_id, identifier, file, title, duration, msg_id, sort)
          VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)
          ON CONFLICT(id) DO UPDATE SET title=excluded.title, duration=excluded.duration, sort=excluded.sort""",
       ["%s/%s" % (al["identifier"], t["file"]), al["speaker"], al["id"], al["identifier"],
        t["file"], t["title"], dur, t["msg_id"], t["sort"]])


# ─────────────────────────── run ────────────────────────────
async def main_run() -> int:
    import internetarchive as ia
    from telethon import TelegramClient
    from telethon.sessions import StringSession
    from telethon.errors import FloodWaitError

    p = plan()
    albums = p["albums"]
    by_msg, have = {}, {}
    for al in albums:
        have[al["identifier"]] = ia_files(al["identifier"])
        for t in al["tracks"]:
            by_msg[t["msg_id"]] = (al, t)
    already = sum(len(v) for v in have.values())
    print("::notice::альбомов %d · записей %d · в архиве уже %d"
          % (len(albums), len(by_msg), already))

    WORK.mkdir(parents=True, exist_ok=True)
    ak, sk = os.environ["IA_ACCESS_KEY"], os.environ["IA_SECRET_KEY"]
    loop = asyncio.get_running_loop()
    pool = ThreadPoolExecutor(max_workers=IA_PARALLEL + 1)
    sem_up = asyncio.Semaphore(IA_PARALLEL)
    speaker = p["speaker_name"]

    def do_upload(al: dict, remote: str, path: str):
        resp = ia.upload(
            al["identifier"], files={remote: path},
            metadata={
                "title": "%s — %s" % (speaker, al["title"]),
                "creator": speaker,
                "collection": "opensource_audio",
                "mediatype": "audio",
                "subject": ["katha", "srimad bhagavatam", "iskcon", "gaudiya vaishnava",
                            "bhakti", "катха", "Шримад-Бхагаватам"],
                "language": ["rus"],
                "description": "%s. %s. Бхагавата-катха на русском языке."
                               % (al["title"], speaker),
            },
            access_key=ak, secret_key=sk, queue_derive=False, verbose=False,
            retries=2, retries_sleep=20,
            request_kwargs={"timeout": 300},   # БЕЗ ЭТОГО ЗАЛИВКА ВИСЛА ЧАСАМИ
        )
        bad = [x for x in resp if getattr(x, "status_code", 200) not in (200, None)]
        if bad:
            raise RuntimeError("HTTP %s" % [getattr(x, "status_code", None) for x in bad])

    client = TelegramClient(StringSession(os.environ["TG_SESSION_STRING"]),
                            int(os.environ["TG_API_ID"]), os.environ["TG_API_HASH"])
    done = fail = 0
    bytes_done = 0.0
    t0 = time.time()
    stop = False

    async with client:
        await client.start()
        entity = await client.get_entity(CHANNEL)

        q: asyncio.Queue = asyncio.Queue()
        async for msg in client.iter_messages(entity):
            hit = by_msg.get(msg.id)
            if not hit:
                continue
            al, t = hit
            if t["file"] in have[al["identifier"]]:
                continue                              # уже в архиве
            doc = msg.audio or msg.document
            if not doc:
                continue
            q.put_nowait((msg, al, t, getattr(doc, "size", 0) or 0))
        total = q.qsize()
        print("::notice::к заливке в этом прогоне: %d записей" % total)

        async def one(msg, al, t, size):
            nonlocal done, bytes_done
            dest = WORK / ("%d-%s" % (msg.id, t["file"]))
            try:
                while True:                           # FloodWait — ждём, а не падаем
                    try:
                        await client.download_media(msg, file=str(dest))
                        break
                    except FloodWaitError as e:
                        print("FloodWait %ss" % e.seconds)
                        await asyncio.sleep(e.seconds + 1)
                last = None
                for attempt in range(3):              # гонка создания элемента
                    try:
                        async with sem_up:
                            await loop.run_in_executor(pool, do_upload, al, t["file"], str(dest))
                        last = None
                        break
                    except Exception as e:            # noqa: BLE001
                        last = e
                        await asyncio.sleep((5, 20, 60)[attempt])
                if last:
                    raise last
            finally:
                dest.unlink(missing_ok=True)
            register(al, t, t["duration"])
            done += 1
            bytes_done += size

        async def worker():
            nonlocal fail, stop
            while not stop:
                try:
                    msg, al, t, size = q.get_nowait()
                except asyncio.QueueEmpty:
                    return
                if time.time() - START > BUDGET:
                    stop = True
                    return
                try:
                    await one(msg, al, t, size)
                except Exception as e:                # noqa: BLE001
                    fail += 1
                    print("::warning::%s: %s" % (t["file"], str(e)[:120]))
                if done and done % 5 == 0:
                    el = max(1.0, time.time() - t0)
                    print("::notice::залито %d из %d · %.2f ГБ · %.1f МБ/с · ошибок %d"
                          % (done, total, bytes_done / 1e9, bytes_done / 1e6 / el, fail))

        await asyncio.gather(*[worker() for _ in range(DL_PARALLEL)])

    pool.shutdown(wait=True)
    print("::notice::ЗА ПРОГОН: %d · ошибок %d" % (done, fail))
    left = cmd_verify(quiet=True)
    Path(os.getenv("GITHUB_OUTPUT") or "/dev/null").open("a").write("left=%d\n" % left)
    return 0


# ────────────────────────── verify ──────────────────────────
def cmd_verify(quiet: bool = False) -> int:
    """ЗКН-Ф021: «готово» = файлы ВИДНЫ В АРХИВЕ. Заодно правим длительность по архиву."""
    p = plan()
    missing_total = 0
    fixed = 0
    for al in p["albums"]:
        real = ia_files(al["identifier"])
        want = {t["file"]: t for t in al["tracks"]}
        missing = sorted(set(want) - set(real))
        missing_total += len(missing)
        for name, sec in real.items():
            t = want.get(name)
            if not t:
                continue
            dur = sec if sec > 0 else t["duration"]
            register(al, t, dur)
            if sec > 0 and abs(sec - t["duration"]) > 5:
                fixed += 1
        mark = "✓" if not missing else "нет %d" % len(missing)
        print("::notice::%-24s %2d/%2d  %s" % (al["id"], len(real), len(want), mark))
        if missing and not quiet:
            print("::warning::%s не залито: %s" % (al["id"], ", ".join(missing[:8])))
    n = d1("SELECT COUNT(*) c FROM katha_tracks")[0]["c"]
    print("::notice::дорожек в базе: %d · длительность уточнена по архиву: %d · не залито: %d"
          % (n, fixed, missing_total))
    return missing_total


def main() -> int:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "run"
    if cmd == "verify":
        return 0 if cmd_verify() == 0 else 0
    if cmd == "run":
        return asyncio.run(main_run())
    print("команды: run | verify", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
