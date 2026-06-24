#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fill_recordings — добивает аудио-записи бхаджанам, у которых их нет.

Источник — bhajanamrita (канон). Слаги bhajanamrita выверены вручную по имени+
автору в _bm_catalog (те же, по которым уже залит пословный перевод). Перед
привязкой записей ПОВТОРНО подтверждаем тождество песни: содержимое 1-го куплета
нашей версии должно совпасть с каким-либо куплетом bhajanamrita (транслит-префикс
>=14 ИЛИ перевод-префикс >=24). Если не сошлось — пропуск (ничего не пишем).

Берём ТОЛЬКО recordings (audioUrl) — ноты/комментарии/видео не трогаем. URL пишем
как есть (на *.bhajanamrita.com); следом ia_rehost.py перельёт их в archive.org и
перепишет на archive.org/download, после чего они играют через прокси /audio/.
Идемпотентно: если у бхаджана уже есть записи — пропуск. Отчёт -> _rec_fill_log.
Запуск — GitHub Actions (нужна сеть к admin.bhajanamrita.com + CF к D1).
"""
from __future__ import annotations
import json, os, re, sys, time, unicodedata, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
from bhajanamrita_import import decode_pua, fetch_full

ACCT = "d5cbe19470dc38599873eabfe148e6d1"; DB = "6226aded-dd03-4e74-977f-9cd0b509e73d"
D1_URL = f"https://api.cloudflare.com/client/v4/accounts/{ACCT}/d1/database/{DB}/query"

# Полный слаг нашего бхаджана -> слаг bhajanamrita (выверено по имени+автору).
# damodarashtaka (безавторский) НЕ здесь — это дубль satyavrata-muni/damodarashtaka,
# его записи копируются из близнеца отдельным шагом (archive.org уже залит).
TARGETS = {
    "/ru/bhajans/radharani-ki-jay": "radharani-ki-jaya",
    "/ru/bhajans/tulasi": "tulasi-kirtan",
    "/ru/bhajans/govindam": "govindam-adi-purusam",
    "/ru/bhajans/bhaktivinod-thakur/ohe-vaishnava-thakur": "ohe-vaishnava-thakura",
    "/ru/bhajans/bhaktivinod-thakur/gurudev": "gurudev",
    "/ru/bhajans/lochan-das-thakur/parama-koruna": "parama-karuna",
    "/ru/bhajans/vasudeva-ghosh/gauranga-tumi-more-doya-na-chariho": "gauranga-tumi-more",
    "/ru/bhajans/visvanatha-chakravarti-thakur/shree-shree-gurv-ashtaka": "shri-gurvastaka",
    "/ru/bhajans/narottam-das-thakur/gauranga-bolite-habe": "gauranga-bolite-ha-be",
    "/ru/bhajans/narottam-das-thakur/hari-hari": "khari-khari-vipkhale",
    "/ru/bhajans/narottam-das-thakur/nama-sankirtana": "shri-nama-sankirtana",
    "/ru/bhajans/narottam-das-thakur/shree-guru-vandana": "shri-guru-vandana",
    "/ru/bhajans/narottam-das-thakur/shree-krishna-chaytaniya-prabhu": "shri-krishna-chaitania-prabkhu",
    "/ru/bhajans/narottam-das-thakur/shree-rupa-manjari-pada": "shri-rupa-mandzhari-pada",
    "/ru/bhajans/narottam-das-thakur/vrindavana-ramia-sthana": "vrindavana-ramia-sthana",
    "/ru/bhajans/narottam-das-thakur/je-anilo-prema-dhana": "je-anilo-prema-dhana",
}


def d1(sql, params=None):
    token = os.environ.get("CF") or os.environ.get("CLOUDFLARE_API_TOKEN")
    body = json.dumps({"sql": sql, "params": params or []}).encode()
    rq = urllib.request.Request(D1_URL, data=body,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    for a in range(4):
        try:
            with urllib.request.urlopen(rq, timeout=60) as r:
                return json.loads(r.read())["result"][0]["results"]
        except Exception:
            if a < 3: time.sleep(1.3 * (a + 1)); continue
            raise
    return []


def norm(s: str) -> str:
    s = decode_pua(s or "")
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^а-яёa-z0-9]", "", s.lower())


def media_type_of(url: str, default: str) -> str:
    u = (url or "").lower()
    if re.search(r"\.pdf(\?|$)", u): return "pdf"
    if re.search(r"\.(jpg|jpeg|png|webp|gif)(\?|$)", u): return "image"
    if re.search(r"\.(mp3|m4a|aac|ogg|wav)(\?|$)", u): return "audio"
    if re.search(r"\.(mp4|webm|mov)(\?|$)", u): return "video"
    return default


def _cpl(a, b):
    n = 0
    for x, y in zip(a, b):
        if x != y: break
        n += 1
    return n


def same_song(slug: str, api_verses) -> bool:
    """Тождество подтверждаем содержимым 1-го куплета нашей версии: ищем среди
    куплетов bhajanamrita сильное совпадение (транслит >=14 ИЛИ перевод >=24)."""
    rows = d1("SELECT verse_translit tr, verse_text tx FROM prayer_verses WHERE slug=? ORDER BY ord LIMIT 1", [slug])
    if not rows or not api_verses:
        return False
    d_tr, d_tx = norm(rows[0].get("tr") or ""), norm(rows[0].get("tx") or "")
    best_tr = best_tx = 0
    for v in api_verses:
        best_tr = max(best_tr, _cpl(d_tr, norm(v.get("transliteration") or "")))
        best_tx = max(best_tx, _cpl(d_tx, norm(v.get("translation") or "")))
    return best_tr >= 14 or best_tx >= 24


def main():
    d1("""CREATE TABLE IF NOT EXISTS _rec_fill_log
          (slug TEXT PRIMARY KEY, bm TEXT, status TEXT, recs INTEGER, note TEXT, ts TEXT)""")
    d1("DELETE FROM _rec_fill_log")
    stamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    def log(slug, bm, status, recs=0, note=""):
        d1("INSERT OR REPLACE INTO _rec_fill_log (slug,bm,status,recs,note,ts) VALUES (?,?,?,?,?,?)",
           [slug, bm, status, recs, note[:300], stamp])
        print(f"[{status}] {slug} <- {bm}  recs={recs}  {note}", flush=True)

    total = 0
    for slug, bm in TARGETS.items():
        # идемпотентность: не трогаем, если записи уже есть
        ex = d1("SELECT COUNT(*) n FROM prayer_media WHERE slug=? AND kind='recording' AND COALESCE(url,'')<>''", [slug])
        if ex and int(ex[0]["n"]) > 0:
            log(slug, bm, "skip-exists", int(ex[0]["n"]))
            continue
        try:
            full = fetch_full(bm, "ru")
        except Exception as e:
            log(slug, bm, "fetch-error", 0, str(e)[:160]); continue
        verses = full.get("verses") or []
        recs = [r for r in (full.get("recordings") or []) if (r.get("audioUrl") or "").strip()]
        if not recs:
            log(slug, bm, "no-recordings", 0, f"v={len(verses)}"); continue
        if not same_song(slug, verses):
            log(slug, bm, "identity-fail", 0, f"v={len(verses)} recs_avail={len(recs)}"); continue
        # пишем записи
        n = 0
        for k, r in enumerate(recs, 1):
            url = (r.get("audioUrl") or "").strip()
            d1("""INSERT OR REPLACE INTO prayer_media
                  (slug,kind,ord,title,subtitle,duration,url,media_type,platform,ext_id,description,date,lang)
                  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
               [slug, "recording", k, (r.get("title") or "").strip(), (r.get("performer") or "").strip(),
                (r.get("duration") or "").strip(), url, media_type_of(url, "audio"),
                "", "", "", (r.get("date") or "").strip(), "ru"])
            n += 1
        total += n
        log(slug, bm, "filled", n, f"v={len(verses)}")

    print(f"\nИТОГО записей вставлено: {total}", flush=True)


if __name__ == "__main__":
    main()
