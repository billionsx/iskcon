#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fill_wbw — добивает пословный перевод (word_by_word) бхаджанам, у которых его нет.

Источник — bhajanamrita (канон). Для каждого бхаджана пробуем два слага-кандидата:
  1) последний сегмент нашего слага;
  2) поиск по каталогу bhajanamrita (fetch_list) — нормализованное имя -> слаг.
ДВЕ защиты от чужого пословника (нужна ЛЮБАЯ):
  • транслитерация 1-го куплета совпадает (обе кириллица после decode_pua);
  • ИЛИ русский перевод 1-го куплета совпадает (сильный префикс).
Плюс жёсткое условие: число куплетов в БД == в bhajanamrita.
Если не сошлось — пропуск (ничего не пишем). Медиа НЕ трогаем. Идемпотентно.
Отчёт -> _wbw_fill_log (читаю через D1 MCP). Запуск — GitHub Actions.
"""
from __future__ import annotations
import json, os, re, sys, time, unicodedata, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
from bhajanamrita_import import decode_pua, fetch_full, fetch_list

ACCT = "d5cbe19470dc38599873eabfe148e6d1"; DB = "6226aded-dd03-4e74-977f-9cd0b509e73d"
D1_URL = f"https://api.cloudflare.com/client/v4/accounts/{ACCT}/d1/database/{DB}/query"

TAILS = [
    "radharani-ki-jay", "shree-radha-stotram", "tulasi",
    "bhaktivinod-thakur/ohe-vaishnava-thakur",
    "vasudeva-ghosh/gauranga-tumi-more-doya-na-chariho",
    "visvanatha-chakravarti-thakur/shree-shree-gurv-ashtaka",
    "govindam", "lochan-das-thakur/parama-koruna",
    "narottam-das-thakur/gauranga-bolite-habe", "narottam-das-thakur/hari-hari",
    "narottam-das-thakur/nama-sankirtana",
    "narottam-das-thakur/shree-guru-vandana", "narottam-das-thakur/shree-krishna-chaytaniya-prabhu",
    "narottam-das-thakur/shree-radha-nishtha", "narottam-das-thakur/shree-rupa-manjari-pada",
    "narottam-das-thakur/vaishnava-vigyapti", "narottam-das-thakur/vrindavana-ramia-sthana",
    "rupa-goswami/shree-radhika-stava",
    "unknown/nanda-nandana-ashtaka", "unknown/shri-govardkhana-makharadzha",
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
    return re.sub(r"[^а-яёa-z0-9]", "", s.lower())


def build_catalog():
    """norm(имя)->слаг по всему каталогу bhajanamrita (кириллические имена)."""
    cat = {}
    try:
        for it in fetch_list("ru"):
            slug = (it.get("slug") or "").strip()
            if not slug:
                continue
            for key in ("name", "title", "transliteration", "transliteratedName"):
                v = it.get(key)
                if v:
                    k = norm(v)
                    if k and k not in cat:
                        cat[k] = slug
    except Exception as e:
        print(f"[catalog] error: {str(e)[:120]}", flush=True)
    print(f"[catalog] {len(cat)} ключей", flush=True)
    return cat


def try_fill(slug, bhaj, db_n, db_v1_translit, db_v1_text):
    """Возврат: (status, pairs, api_n, note). Пишет wbw только при совпадении."""
    try:
        full = fetch_full(bhaj, "ru")
    except Exception as e:
        return ("not_found", 0, 0, f"{bhaj}: {str(e)[:60]}")
    api_verses = full.get("verses") or []
    api_n = len(api_verses)
    if api_n == 0:
        return ("not_found", 0, 0, f"{bhaj}: no verses")
    if db_n != api_n:
        return ("count_mismatch", 0, api_n, f"{bhaj} db={db_n} api={api_n}")
    api_v1_tr = api_verses[0].get("transliteration") or ""
    api_v1_tx = api_verses[0].get("translation") or ""
    nt_db, nt_api = norm(db_v1_translit), norm(api_v1_tr)
    tr_ok = bool(nt_db) and bool(nt_api) and (nt_db[:18] == nt_api[:18] or nt_db.startswith(nt_api[:24]) or nt_api.startswith(nt_db[:24]))
    tx_db, tx_api = norm(db_v1_text), norm(api_v1_tx)
    tx_ok = bool(tx_db) and bool(tx_api) and len(tx_db) >= 20 and (tx_db[:28] == tx_api[:28] or tx_db.startswith(tx_api[:30]) or tx_api.startswith(tx_db[:30]))
    if not (tr_ok or tx_ok):
        return ("content_mismatch", 0, api_n, f"{bhaj}: {nt_db[:20]}|{nt_api[:20]}")
    total_wbw = sum(len(v.get("wordByWord") or []) for v in api_verses)
    if total_wbw == 0:
        return ("source_no_wbw", 0, api_n, bhaj)
    pairs = 0
    for i, v in enumerate(api_verses, start=1):
        p = []
        for w in (v.get("wordByWord") or []):
            t = decode_pua((w.get("wordTransliteration") or "").strip())
            m = re.sub(r"\s+", " ", (w.get("translation") or "")).strip()
            if t or m:
                p.append({"t": t, "m": m})
        if p:
            d1("UPDATE prayer_verses SET word_by_word=? WHERE slug=? AND ord=?",
               [json.dumps(p, ensure_ascii=False), slug, i])
            pairs += len(p)
    return ("filled", pairs, api_n, f"via {bhaj} ({'translit' if tr_ok else 'translation'})")


def main():
    d1("""CREATE TABLE IF NOT EXISTS _wbw_fill_log (
        slug TEXT, status TEXT, pairs INTEGER, db_n INTEGER, api_n INTEGER, note TEXT, ts TEXT)""")
    d1("DELETE FROM _wbw_fill_log")
    cat = build_catalog()
    counts = {}
    for tail in TAILS:
        slug = "/ru/bhajans/" + tail
        last = tail.rstrip("/").split("/")[-1]
        nm = d1("SELECT name FROM prayers WHERE slug=?", [slug])
        db_name = (nm[0]["name"] if nm and nm[0].get("name") else "")
        dn = d1("SELECT COUNT(*) n FROM prayer_verses WHERE slug=?", [slug])
        db_n = int(dn[0]["n"]) if dn else 0
        dv = d1("SELECT verse_translit tr, verse_text tx FROM prayer_verses WHERE slug=? AND ord=1", [slug])
        db_tr = (dv[0]["tr"] if dv and dv[0].get("tr") else "")
        db_tx = (dv[0]["tx"] if dv and dv[0].get("tx") else "")

        candidates = [last]
        ck = cat.get(norm(db_name))
        if ck and ck not in candidates:
            candidates.append(ck)

        best = ("not_found", 0, 0, "no candidate matched")
        order = {"filled": 5, "source_no_wbw": 4, "content_mismatch": 3, "count_mismatch": 2, "not_found": 1}
        for bhaj in candidates:
            res = try_fill(slug, bhaj, db_n, db_tr, db_tx)
            if order.get(res[0], 0) > order.get(best[0], 0):
                best = res
            if res[0] == "filled":
                break
            time.sleep(0.3)
        status, pairs, api_n, note = best
        counts[status] = counts.get(status, 0) + 1
        d1("INSERT INTO _wbw_fill_log (slug,status,pairs,db_n,api_n,note,ts) VALUES (?,?,?,?,?,?,datetime('now'))",
           [slug, status, pairs, db_n, api_n, note])
        print(f"{status:16} pairs={pairs:3} {tail}  [{note[:50]}]", flush=True)
        time.sleep(0.3)
    print(f"\n[fill_wbw] {counts}", flush=True)


if __name__ == "__main__":
    main()
