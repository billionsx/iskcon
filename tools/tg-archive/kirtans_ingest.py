#!/usr/bin/env python3
"""
kirtans_ingest.py — ЗАЛИВКА киртанов: Telegram → archive.org → D1 → плеер.

═══ УСТРОЙСТВО ═══

Один исполнитель — один элемент archive.org — один альбом в приложении:

    Ниранджана Свами  →  archive.org/details/iskcon-kirtans-niranjana-swami
                      →  kirtan_albums(archive='iskcon-kirtans-niranjana-swami')
                      →  воркер читает список файлов элемента → плеер

Воркер уже умеет разворачивать элемент archive.org в дорожки (`kirtanTracks`).
Значит от заливки требуется РОВНО одно: положить файлы исполнителя в его элемент
и записать имя элемента в `kirtan_albums.archive`. Больше приложение ни о чём
не спрашивает.

═══ ПОЧЕМУ ПО ОДНОМУ ИСПОЛНИТЕЛЮ, А НЕ ВСЁ РАЗОМ ═══

42 ГБ. В один прогон GitHub Actions это не влезает (лимит 6 ч), а обрыв на
середине оставил бы половину каталога битой. Поэтому:

  • работаем ПОРЦИЯМИ: за прогон — сколько успеваем до бюджета времени;
  • состояние — В БАЗЕ (`kirtans_ingest`), а не в файле: прогон умер, следующий
    подхватил;
  • исполнитель считается сделанным ТОЛЬКО когда его файлы РЕАЛЬНО лежат в
    archive.org (проверяем через metadata-API), а не когда «команда отправлена»
    (ЗКН-Ф021: доложить ≠ доехало);
  • самоцепочка: доделали порцию — сами перезапускаем воркфлоу.

Команды:
    plan      — построить очередь заливки в D1 (из kirtans_map.json)
    run       — залить очередную порцию (по бюджету времени)
    verify    — сверить: что в archive.org против того, что обещано в D1
"""
import json
import os
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).parent
ACCOUNT = "d5cbe19470dc38599873eabfe148e6d1"
DB = "6226aded-dd03-4e74-977f-9cd0b509e73d"
TOKEN = os.getenv("CLOUDFLARE_API_TOKEN") or ""
BUDGET = int(os.getenv("BUDGET_MIN") or "280") * 60      # бюджет прогона, сек
MIN_FILES = int(os.getenv("MIN_FILES") or "3")           # порог: кого вообще льём
STARTED = time.time()


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
    except urllib.error.HTTPError as e:               # ЗКН-Ф014: не падать молча
        print("::error::D1 %s: %s" % (e.code, e.read().decode()[:400]))
        raise
    if not body.get("success"):
        print("::error::D1: %s" % json.dumps(body.get("errors"))[:400])
        raise SystemExit(1)
    return body["result"][0]["results"]


def ensure_state_table():
    d1("""CREATE TABLE IF NOT EXISTS kirtans_ingest (
            slug       TEXT PRIMARY KEY,
            identifier TEXT NOT NULL,
            n_files    INTEGER NOT NULL,
            msg_ids    TEXT NOT NULL,
            state      TEXT NOT NULL DEFAULT 'pending',  -- pending|done|failed
            uploaded   INTEGER NOT NULL DEFAULT 0,
            note       TEXT,
            updated_at TEXT DEFAULT (datetime('now'))
          )""")


def ia_files(identifier: str) -> set:
    """Что РЕАЛЬНО лежит в элементе archive.org. Источник истины — он, не наш лог."""
    try:
        with urllib.request.urlopen(
            f"https://archive.org/metadata/{identifier}", timeout=60
        ) as r:
            data = json.loads(r.read())
    except Exception as e:
        print("  metadata %s: %s" % (identifier, e))
        return set()
    return {f["name"] for f in (data.get("files") or [])
            if f.get("source") == "original" and f["name"].lower().endswith(".mp3")}


# ─────────────────────────── plan ───────────────────────────
def cmd_plan() -> int:
    ensure_state_table()
    m = json.loads((HERE / "kirtans_map.json").read_text(encoding="utf-8"))
    probe = json.loads((HERE / "kirtans_probe.json").read_text(encoding="utf-8"))
    all_ids = {f["msg_id"] for ch in probe["channels"] for f in ch["files"]}

    named, n = set(), 0
    for a in sorted(m["artists"], key=lambda x: -x["n_files"]):
        if a["n_files"] < MIN_FILES:
            continue
        named.update(a["msg_ids"])
        d1("""INSERT INTO kirtans_ingest (slug, identifier, n_files, msg_ids, state)
              VALUES (?1, ?2, ?3, ?4, 'pending')
              ON CONFLICT(slug) DO UPDATE SET
                n_files = excluded.n_files, msg_ids = excluded.msg_ids""",
           [a["slug"], "iskcon-kirtans-" + a["slug"], a["n_files"], json.dumps(a["msg_ids"])])
        n += 1

    # ── СБОРНИК. Всё, что не набрало на именного исполнителя (обрывки, одиночки,
    #    неопознанные), НЕ выбрасывается: оно едет в один общий элемент архива и
    #    в «Киртания ИСККОН · Сборник». Из канала заливается ВСЁ до последнего файла.
    rest = sorted(all_ids - named)
    if rest:
        d1("""INSERT INTO kirtans_ingest (slug, identifier, n_files, msg_ids, state)
              VALUES ('various', 'iskcon-kirtans-sbornik', ?1, ?2, 'pending')
              ON CONFLICT(slug) DO UPDATE SET
                n_files = excluded.n_files, msg_ids = excluded.msg_ids""",
           [len(rest), json.dumps(rest)])
        n += 1

    rows = d1("SELECT state, COUNT(*) c, SUM(n_files) f FROM kirtans_ingest GROUP BY state")
    print("::notice::очередь: %d элементов · именных исполнителей %d · в сборнике %d записей"
          % (n, n - 1, len(rest)))
    for r in rows:
        print("::notice::  %-8s %3d элементов · %4d записей" % (r["state"], r["c"], r["f"] or 0))
    return 0


# ─────────────────────────── run ────────────────────────────
#
# ⚠️ ПОЧЕМУ ПЕРЕПИСАНО.
#
# Первая версия качала ВСЕГО исполнителя, потом заливала, потом помечала готовым.
# У Гоур Говинды 140 записей — значит первые полчаса счётчик показывал НОЛЬ, хотя
# работа шла. Основатель смотрел на ноль и был прав, что злился: конвейер, который
# час не показывает ничего, неотличим от сломанного.
#
# Теперь: ОДИН проход по каналу (а не 981 отдельный запрос сообщения), выгрузка
# ПАЧКАМИ по 12 файлов, и альбом подключается к приложению СРАЗУ после первой
# пачки. Музыка появляется в приложении через минуты, а не через часы, и растёт
# на глазах.
BATCH = int(os.getenv("BATCH") or "12")


def flush(row: dict, paths: list, name: str) -> int:
    """Пачку — в архив, альбом — в приложение. Немедленно."""
    import internetarchive as ia
    if not paths:
        return 0
    ident = row["identifier"]
    files = {p.name: str(p) for p in paths}
    ia.upload(
        ident, files=files,
        metadata={
            "title": "ISKCON Kirtans — %s" % name,
            "collection": "opensource_audio", "mediatype": "audio", "creator": name,
            "subject": ["kirtan", "iskcon", "bhakti", "hare krishna"],
            "language": ["san", "ben", "eng", "rus"],
        },
        access_key=os.environ["IA_ACCESS_KEY"], secret_key=os.environ["IA_SECRET_KEY"],
        queue_derive=False, verbose=False, retries=3,
    )
    for p in paths:
        try:
            p.unlink()
        except OSError:
            pass

    have = len(ia_files(ident))
    d1("UPDATE kirtans_ingest SET uploaded=?2, updated_at=datetime('now') WHERE slug=?1",
       [row["slug"], have])
    # АЛЬБОМ — СРАЗУ. Воркер сам развернёт элемент архива в дорожки, и исполнитель
    # появится в витрине. Ждать конца заливки, чтобы что-то показать, — незачем.
    d1("""INSERT INTO kirtan_albums (id, artist_slug, title, archive, type, sort)
          VALUES (?1, ?2, ?3, ?4, 'kirtan', 0)
          ON CONFLICT(id) DO UPDATE SET archive=excluded.archive""",
       ["k-" + row["slug"], row["slug"], "Киртаны · " + name, ident])
    if have >= row["n_files"]:
        d1("UPDATE kirtans_ingest SET state='done' WHERE slug=?1", [row["slug"]])
    print("::notice::%s: в архиве %d из %d" % (row["slug"], have, row["n_files"]))
    return len(paths)


def cmd_run() -> int:
    ensure_state_table()
    from telethon.sync import TelegramClient
    from telethon.sessions import StringSession

    rows = d1("""SELECT i.slug, i.identifier, i.n_files, i.msg_ids, a.name
                 FROM kirtans_ingest i JOIN kirtan_artists a ON a.slug = i.slug
                 WHERE i.state <> 'done' ORDER BY i.n_files DESC""")
    if not rows:
        print("::notice::очередь пуста — залито всё")
        Path(os.getenv("GITHUB_OUTPUT") or "/dev/null").open("a").write("left=0\n")
        return 0

    # msg_id → строка очереди. Один проход по каналу вместо 981 запроса.
    idx, have, buf = {}, {}, {}
    for r in rows:
        for mid in json.loads(r["msg_ids"]):
            idx[mid] = r
        have[r["identifier"]] = ia_files(r["identifier"])
        buf[r["slug"]] = []
    print("::notice::в работе: %d элементов · %d записей · уже в архиве: %d"
          % (len(rows), len(idx), sum(len(v) for v in have.values())))

    work = Path("/tmp/k")
    work.mkdir(parents=True, exist_ok=True)
    got = 0

    client = TelegramClient(
        StringSession(os.environ["TG_SESSION_STRING"]),
        int(os.environ["TG_API_ID"]), os.environ["TG_API_HASH"],
    )
    with client:
        entity = client.get_entity(os.getenv("TG_CHANNEL") or "@iskconecom")
        for msg in client.iter_messages(entity):
            if time.time() - STARTED > BUDGET:
                print("::notice::бюджет времени вышел — остальное доберёт следующий прогон")
                break
            r = idx.get(msg.id)
            if not r:
                continue
            doc = msg.audio or msg.document
            if not doc:
                continue
            fname = None
            for attr in doc.attributes:
                if hasattr(attr, "file_name"):
                    fname = attr.file_name
            fname = re.sub(r"[^\w\s.\-()+]", "_", fname or "%s-%d.mp3" % (r["slug"], msg.id))
            if not fname.lower().endswith(".mp3"):
                fname += ".mp3"
            if fname in have[r["identifier"]]:
                continue                       # уже в архиве — не качаем повторно

            dst = work / fname
            try:
                client.download_media(msg, file=str(dst))
            except Exception as e:
                print("::warning::%d: %s" % (msg.id, str(e)[:90]))
                continue
            buf[r["slug"]].append(dst)
            got += 1

            if len(buf[r["slug"]]) >= BATCH:
                try:
                    flush(r, buf[r["slug"]], r["name"])
                except Exception as e:
                    print("::warning::заливка %s: %s" % (r["slug"], str(e)[:120]))
                buf[r["slug"]] = []

    for r in rows:                             # остатки пачек
        if buf[r["slug"]]:
            try:
                flush(r, buf[r["slug"]], r["name"])
            except Exception as e:
                print("::warning::заливка %s: %s" % (r["slug"], str(e)[:120]))

    left = d1("SELECT COUNT(*) c FROM kirtans_ingest WHERE state <> 'done'")[0]["c"]
    tot = d1("SELECT SUM(uploaded) u FROM kirtans_ingest")[0]["u"] or 0
    print("::notice::за прогон скачано %d · ВСЕГО В АРХИВЕ: %d записей · элементов осталось: %d"
          % (got, tot, left))
    Path(os.getenv("GITHUB_OUTPUT") or "/dev/null").open("a").write("left=%d\n" % left)
    return 0


# ────────────────────────── verify ──────────────────────────
def cmd_verify() -> int:
    rows = d1("""SELECT i.slug, i.identifier, i.n_files, i.state, b.archive
                 FROM kirtans_ingest i LEFT JOIN kirtan_albums b ON b.id = 'k-' || i.slug
                 ORDER BY i.n_files DESC""")
    bad = 0
    for r in rows:
        have = len(ia_files(r["identifier"]))
        ok = have >= r["n_files"] and r["archive"] == r["identifier"]
        if not ok and r["state"] == "done":
            print("::error::%s помечен готовым, а в архиве %d из %d (альбом: %s)"
                  % (r["slug"], have, r["n_files"], r["archive"]))
            bad += 1
    print("::notice::сверено %d исполнителей · расхождений: %d" % (len(rows), bad))
    return 1 if bad else 0


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "run"
    sys.exit({"plan": cmd_plan, "run": cmd_run, "verify": cmd_verify}[cmd]())
