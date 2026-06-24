#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fill_wbw — добивает пословный перевод (word_by_word) бхаджанам, у которых его нет.

Источник — bhajanamrita (канон), bhaj_slug = последний сегмент нашего слага.
ДВЕ защиты от чужого пословника:
  • число куплетов в БД == число куплетов в bhajanamrita;
  • нормализованная транслитерация 1-го куплета совпадает (обе кириллица после decode_pua).
Если хоть одна не сошлась — пропуск (ничего не пишем). Медиа НЕ трогаем.
Идемпотентно. Отчёт пишется в _wbw_fill_log (читаю через D1 MCP).
Запуск — GitHub Actions (нужна сеть к bhajanamrita + CF к D1).
"""
from __future__ import annotations
import json, os, re, sys, time, unicodedata, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
from bhajanamrita_import import decode_pua, fetch_full

ACCT = "d5cbe19470dc38599873eabfe148e6d1"; DB = "6226aded-dd03-4e74-977f-9cd0b509e73d"
D1_URL = f"https://api.cloudflare.com/client/v4/accounts/{ACCT}/d1/database/{DB}/query"

TAILS = [
    "radharani-ki-jay", "shree-radha-stotram", "tulasi",
    "bhaktivinod-thakur/gurudev", "bhaktivinod-thakur/ohe-vaishnava-thakur",
    "vasudeva-ghosh/gauranga-tumi-more-doya-na-chariho",
    "visvanatha-chakravarti-thakur/shree-shree-gurv-ashtaka",
    "govindam", "lochan-das-thakur/parama-koruna",
    "narottam-das-thakur/gauranga-bolite-habe", "narottam-das-thakur/hari-hari",
    "narottam-das-thakur/je-anilo-prema-dhana", "narottam-das-thakur/nama-sankirtana",
    "narottam-das-thakur/shree-guru-vandana", "narottam-das-thakur/shree-krishna-chaytaniya-prabhu",
    "narottam-das-thakur/shree-radha-nishtha", "narottam-das-thakur/shree-rupa-manjari-pada",
    "narottam-das-thakur/vaishnava-vigyapti", "narottam-das-thakur/vrindavana-ramia-sthana",
    "rupa-goswami/shree-radhika-stava", "damodarashtaka",
    "unknown/nanda-nandana-ashtaka", "unknown/radkha-krishna-giti", "unknown/shri-govardkhana-makharadzha",
]


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
    return re.sub(r"[^а-яёa-z]", "", s.lower())


def main():
    d1("""CREATE TABLE IF NOT EXISTS _wbw_fill_log (
        slug TEXT, status TEXT, pairs INTEGER, db_n INTEGER, api_n INTEGER, note TEXT, ts TEXT)""")
    d1("DELETE FROM _wbw_fill_log")
    filled = miss = mism = err = 0
    for tail in TAILS:
        slug = "/ru/bhajans/" + tail
        bhaj = tail.rstrip("/").split("/")[-1]
        status = "?"; pairs = 0; note = ""; db_n = api_n = 0
        try:
            full = fetch_full(bhaj, "ru")
            api_verses = full.get("verses") or []
            api_n = len(api_verses)
            dn = d1("SELECT COUNT(*) n FROM prayer_verses WHERE slug=?", [slug])
            db_n = int(dn[0]["n"]) if dn else 0
            dv1 = d1("SELECT verse_translit t FROM prayer_verses WHERE slug=? AND ord=1", [slug])
            db_v1 = (dv1[0]["t"] if dv1 and dv1[0].get("t") else "")
            api_v1 = api_verses[0].get("transliteration") if api_verses else ""
            n_db, n_api = norm(db_v1), norm(api_v1)
            content_ok = bool(n_db) and bool(n_api) and (n_db[:18] == n_api[:18] or n_db.startswith(n_api[:24]) or n_api.startswith(n_db[:24]))
            total_wbw = sum(len(v.get("wordByWord") or []) for v in api_verses)
            if api_n == 0:
                status, note = "not_found", "no verses from source"; miss += 1
            elif db_n != api_n:
                status, note = "count_mismatch", f"db={db_n} api={api_n}"; mism += 1
            elif not content_ok:
                status, note = "content_mismatch", f"{n_db[:24]} | {n_api[:24]}"; mism += 1
            elif total_wbw == 0:
                status, note = "source_no_wbw", ""; miss += 1
            else:
                for i, v in enumerate(api_verses, start=1):
                    p = []
                    for w in (v.get("wordByWord") or []):
                        t = decode_pua((w.get("wordTransliteration") or "").strip())
                        m = re.sub(r"\s+", " ", (w.get("translation") or "")).strip()
                        if t or m: p.append({"t": t, "m": m})
                    if p:
                        d1("UPDATE prayer_verses SET word_by_word=? WHERE slug=? AND ord=?",
                           [json.dumps(p, ensure_ascii=False), slug, i])
                        pairs += len(p)
                status = "filled"; filled += 1
        except Exception as e:
            status, note = "error", str(e)[:110]; err += 1
        d1("INSERT INTO _wbw_fill_log (slug,status,pairs,db_n,api_n,note,ts) VALUES (?,?,?,?,?,?,datetime('now'))",
           [slug, status, pairs, db_n, api_n, note])
        print(f"{status:16} pairs={pairs:3} {tail}", flush=True)
        time.sleep(0.4)
    print(f"\n[fill_wbw] filled={filled} mismatch={mism} miss={miss} err={err}", flush=True)


if __name__ == "__main__":
    main()
