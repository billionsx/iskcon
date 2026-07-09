#!/usr/bin/env python3
"""feed_register.py — связывает аудио загрузчика с лентой (таблица feed_audio в D1).

  skip-ids   печатает post_id уже зарегистрированных аудио (для TG_SKIP_IDS — не качать повторно).
  register   по manifest.json регистрирует НОВЫЕ аудио в feed_audio
             (src = /audio/<identifier>/<file> — same-origin прокси воркера → archive.org).

D1 — через HTTP API (секрет CLOUDFLARE_API_TOKEN). Никаких секретов в коде.
"""
import json
import os
import sys
import urllib.parse
import urllib.request

ACCOUNT = os.getenv("CF_ACCOUNT_ID", "d5cbe19470dc38599873eabfe148e6d1")
DB = os.getenv("D1_DATABASE_ID", "6226aded-dd03-4e74-977f-9cd0b509e73d")
TOKEN = os.getenv("CLOUDFLARE_API_TOKEN", "")
IDENT = os.getenv("IA_IDENTIFIER", "iskcone-lectures")
KIND = os.getenv("FEED_KIND_LABEL", "Лекция")
MANIFEST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "manifest.json")

# Медиа-режим: audio → feed_audio; video → feed_video (тот же приём, прокси /video/).
MEDIA = (os.getenv("FEED_MEDIA", "audio") or "audio").strip().lower()
IS_VIDEO = (MEDIA == "video")
TABLE = "feed_video" if IS_VIDEO else "feed_audio"
SRC_KIND = "video" if IS_VIDEO else "audio"


def fmt_dur(sec):
    try:
        s = int(sec)
    except Exception:
        return None
    if s <= 0:
        return None
    m, ss = divmod(s, 60)
    if m >= 60:
        h, m = divmod(m, 60)
        return f"{h}:{m:02d}:{ss:02d}"
    return f"{m}:{ss:02d}"

# Киртаны/бхаджаны помечаем «Киртан», прочее спокенворд — KIND («Лекция»).
KIRTAN_KW = ("kirtan", "киртан", "bhajan", "бхаджан", "vandana", "вандана",
             "mantra", "мантра", "japa", "джапа", "arati", "арати")


def infer_kind(title, perf):
    hay = (title + " " + perf).lower()
    return "Киртан" if any(k in hay for k in KIRTAN_KW) else KIND


def clean_presenter(perf):
    p = (perf or "").strip()
    low = p.lower()
    if low in ("iskcon one love", "iskcone", "iskcon"):
        return ""
    if "prabhupāda" in low or "prabhupada" in low or "прабхупада" in low:
        return "Шрила Прабхупада"
    return p


def d1(sql, params=None):
    if not TOKEN:
        raise SystemExit("Нет CLOUDFLARE_API_TOKEN")
    url = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/d1/database/{DB}/query"
    body = json.dumps({"sql": sql, "params": params or []}).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST", headers={
        "Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        j = json.loads(r.read())
    if not j.get("success"):
        raise SystemExit(f"D1 error: {j.get('errors')}")
    return j["result"][0]["results"]


def cmd_skip_ids():
    rows = d1(f"SELECT post_id FROM {TABLE}")
    print(",".join(str(r["post_id"]) for r in rows))


def cmd_register():
    if not os.path.exists(MANIFEST):
        print("manifest.json нет — нечего регистрировать")
        return
    m = json.load(open(MANIFEST, encoding="utf-8"))
    files = [f for f in m.get("files", []) if f.get("downloaded")]
    n = 0
    for f in files:
        pid = f.get("msg_id")
        fn = f.get("filename")
        if not pid or not fn:
            continue
        src = f"/{SRC_KIND}/{IDENT}/{fn}"
        if IS_VIDEO:
            dur = fmt_dur(f.get("duration"))
            thumb = f.get("thumb")
            thumb_url = None
            if thumb:
                direct = f"https://archive.org/download/{IDENT}/{thumb}"
                thumb_url = "/api/img?u=" + urllib.parse.quote(direct, safe="") + "&w=800"
            d1("INSERT OR IGNORE INTO feed_video (post_id, src, thumb, duration) VALUES (?1,?2,?3,?4)",
               [pid, src, thumb_url, dur])
        else:
            title = (f.get("title") or fn).strip()
            perf_raw = (f.get("performer") or "").strip()
            kind = infer_kind(title, perf_raw)
            perf = clean_presenter(perf_raw)
            d1("INSERT OR IGNORE INTO feed_audio (post_id, src, title, presenter, kind_label) VALUES (?1,?2,?3,?4,?5)",
               [pid, src, title, perf, kind])
        n += 1
        print(f"  + {pid} → {fn}")
    print(f"Зарегистрировано новых ({SRC_KIND}): {n}")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "skip-ids":
        cmd_skip_ids()
    elif cmd == "register":
        cmd_register()
    else:
        raise SystemExit("usage: feed_register.py {skip-ids|register}")
