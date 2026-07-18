#!/usr/bin/env python3
"""
probe.py — РАЗВЕДКА goswami.ru БЕЗ скачивания звука.

Сайт — SPA: в HTML лекции нет ни ссылки на mp3, ни длительности, ни рубрики.
Всё это отдаёт JSON-API, адрес которого зашит в собранный JS-бандл. Поэтому
разведка идёт в три захода и НЕ УГАДЫВАЕТ (ЗКН-Пл010: карта строится по факту,
а не по догадке):

  1. HTML → адреса бандлов → в бандлах ищем базовый адрес API и пути;
  2. перебор кандидатов (найденные + типовые) — какой отвечает JSON;
  3. найденный список лекций выкачивается ЦЕЛИКОМ постранично и ложится
     в docs/diagnostics/goswami-probe.json.

Только чтение. Идемпотентна. Без зависимостей — стандартная библиотека.

Env:
  PROBE_OUT   — куда положить JSON (по умолчанию docs/diagnostics/goswami-probe.json)
  PROBE_LIMIT — ограничить число лекций (пусто = весь каталог)
"""
import gzip
import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).parent
OUT = Path(os.getenv("PROBE_OUT") or (HERE.parent.parent / "docs" / "diagnostics" / "goswami-probe.json"))
LIMIT = int(os.getenv("PROBE_LIMIT") or 0)

SITE = "https://goswami.ru"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE


def get(url: str, timeout=30, want_json=False):
    """Возвращает (код, тело|None). Ошибка — не исключение, а код: перебор не должен падать."""
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "application/json, text/html, */*",
        "Accept-Encoding": "gzip",
        "Accept-Language": "ru,en;q=0.8",
        "Referer": SITE + "/",
        "X-Requested-With": "XMLHttpRequest",
    })
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=CTX) as r:
            raw = r.read()
            if r.headers.get("Content-Encoding") == "gzip":
                try:
                    raw = gzip.decompress(raw)
                except Exception:
                    pass
            body = raw.decode("utf-8", "replace")
            if want_json:
                try:
                    return r.status, json.loads(body)
                except Exception:
                    return r.status, None
            return r.status, body
    except urllib.error.HTTPError as e:
        return e.code, None
    except Exception as e:
        return 0, f"ERR {type(e).__name__}: {e}" if not want_json else None


# ═══ 1. БАНДЛЫ ═══════════════════════════════════════════════════════════════

def find_bundles(html: str):
    urls = set()
    for m in re.finditer(r'(?:src|href)=["\']([^"\']+\.(?:js|mjs))["\']', html):
        u = m.group(1)
        urls.add(u if u.startswith("http") else SITE + ("" if u.startswith("/") else "/") + u)
    return sorted(urls)


API_RX = [
    re.compile(r'["\'](/api/[a-zA-Z0-9_\-/{}$.]*)["\']'),
    re.compile(r'baseURL\s*[:=]\s*["\']([^"\']+)["\']'),
    re.compile(r'["\'](https?://[a-z0-9.\-]*goswami\.ru/[a-zA-Z0-9_\-/]*)["\']'),
    re.compile(r'["\'](/v\d/[a-zA-Z0-9_\-/]*)["\']'),
]


def mine_bundle(js: str):
    found = set()
    for rx in API_RX:
        for m in rx.finditer(js):
            s = m.group(1)
            if 2 < len(s) < 160:
                found.add(s)
    return found


# ═══ 2. КАНДИДАТЫ ════════════════════════════════════════════════════════════

LIST_GUESSES = [
    "/api/lectures", "/api/lecture", "/api/lectures/", "/api/lecture/list",
    "/api/v1/lectures", "/api/v1/lecture", "/api/lectures/list",
    "/api/lectures?page=1", "/api/lectures/?page=1", "/api/lectures?limit=20",
    "/api/search/lectures", "/api/lectures/search", "/api/main", "/api/index",
    "/lectures.json", "/api/lectures.json",
]
ITEM_GUESSES = [
    "/api/lecture/6016", "/api/lectures/6016", "/api/v1/lecture/6016",
    "/api/lecture/6016/", "/api/lecture?id=6016", "/lecture/6016.json",
]
MISC = ["/sitemap.xml", "/robots.txt", "/api", "/api/", "/api/config", "/api/settings"]


def try_paths(paths, note):
    out = []
    for p in paths:
        url = p if p.startswith("http") else SITE + p
        code, body = get(url)
        row = {"url": url, "code": code, "note": note}
        if isinstance(body, str):
            row["len"] = len(body)
            row["head"] = body[:700]
            row["json"] = body.lstrip()[:1] in "[{"
        out.append(row)
        time.sleep(0.12)
    return out


# ═══ 3. ВЫКАЧКА КАТАЛОГА ═════════════════════════════════════════════════════

def deep_keys(obj, prefix="", acc=None, depth=0):
    """Карта полей ответа — чтобы не гадать, где лежит mp3 и рубрика."""
    if acc is None:
        acc = {}
    if depth > 4:
        return acc
    if isinstance(obj, dict):
        for k, v in obj.items():
            key = f"{prefix}.{k}" if prefix else k
            if isinstance(v, (dict, list)):
                deep_keys(v, key, acc, depth + 1)
            else:
                acc.setdefault(key, repr(v)[:120])
    elif isinstance(obj, list) and obj:
        deep_keys(obj[0], prefix + "[]", acc, depth + 1)
    return acc


def find_items(payload):
    """Где в ответе массив лекций — под каким ключом."""
    if isinstance(payload, list):
        return payload, "$"
    if isinstance(payload, dict):
        for k in ("results", "items", "data", "lectures", "list", "objects", "rows", "content"):
            v = payload.get(k)
            if isinstance(v, list) and v:
                return v, k
            if isinstance(v, dict):
                sub, sk = find_items(v)
                if sub:
                    return sub, f"{k}.{sk}"
        for k, v in payload.items():
            if isinstance(v, list) and v and isinstance(v[0], dict):
                return v, k
    return None, None


def harvest(base_url: str, report: dict):
    """Постраничная выкачка. Пробует ?page=, ?offset=, ?limit= — что сработает."""
    schemes = [
        ("page", lambda n, sz: f"{base_url}{'&' if '?' in base_url else '?'}page={n}&limit={sz}"),
        ("page_size", lambda n, sz: f"{base_url}{'&' if '?' in base_url else '?'}page={n}&page_size={sz}"),
        ("offset", lambda n, sz: f"{base_url}{'&' if '?' in base_url else '?'}offset={(n-1)*sz}&limit={sz}"),
        ("plain", lambda n, sz: base_url),
    ]
    for name, mk in schemes:
        code, p1 = get(mk(1, 100), want_json=True)
        if code != 200 or p1 is None:
            continue
        items1, key = find_items(p1)
        if not items1:
            continue
        code, p2 = get(mk(2, 100), want_json=True)
        items2, _ = find_items(p2) if p2 is not None else (None, None)
        paged = bool(items2) and json.dumps(items2[:1], sort_keys=True) != json.dumps(items1[:1], sort_keys=True)
        report["harvest_scheme"] = {"name": name, "key": key, "paged": paged,
                                    "first_page": len(items1), "sample": items1[0]}
        seen, out = set(), []
        if not paged:
            for it in items1:
                out.append(it)
            report["harvest_note"] = "пагинации нет — отдан один список"
            return out
        n = 1
        empty = 0
        while True:
            url = mk(n, 100)
            code, payload = get(url, want_json=True)
            items, _ = (find_items(payload) if payload is not None else (None, None))
            if not items:
                empty += 1
                if empty >= 2:
                    break
                n += 1
                continue
            empty = 0
            fresh = 0
            for it in items:
                ident = json.dumps(it.get("id") if isinstance(it, dict) else it, sort_keys=True)
                if ident in seen:
                    continue
                seen.add(ident)
                out.append(it)
                fresh += 1
            if fresh == 0:
                break
            if LIMIT and len(out) >= LIMIT:
                break
            n += 1
            if n > 800:
                break
            time.sleep(0.08)
        return out
    return None


def main():
    report = {"site": SITE, "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}

    code, html = get(SITE + "/")
    report["home"] = {"code": code, "len": len(html) if isinstance(html, str) else 0}
    bundles = find_bundles(html) if isinstance(html, str) else []
    report["bundles"] = bundles[:40]

    mined = set()
    for b in bundles[:18]:
        code, js = get(b, timeout=45)
        if isinstance(js, str) and code == 200:
            mined |= mine_bundle(js)
    report["mined_paths"] = sorted(mined)[:220]

    api_like = sorted({p for p in mined if "/api" in p or re.match(r"^/v\d/", p)})
    cands = [p for p in api_like if "{" not in p and "$" not in p][:60]
    report["probe_mined"] = try_paths(cands, "из бандла")
    report["probe_list"] = try_paths(LIST_GUESSES, "типовой список")
    report["probe_item"] = try_paths(ITEM_GUESSES, "типовая карточка")
    report["probe_misc"] = try_paths(MISC, "служебное")

    winners = [r for r in (report["probe_mined"] + report["probe_list"])
               if r["code"] == 200 and r.get("json") and r.get("len", 0) > 200]
    report["winners"] = [w["url"] for w in winners]

    lectures = None
    for w in winners:
        code, payload = get(w["url"], want_json=True)
        if payload is None:
            continue
        items, key = find_items(payload)
        if not items:
            continue
        report["chosen"] = w["url"]
        report["keys_list"] = deep_keys(payload)
        lectures = harvest(w["url"], report)
        if lectures:
            break

    if lectures:
        report["n_lectures"] = len(lectures)
        report["lectures"] = lectures
        report["keys_item"] = deep_keys(lectures[0])
        ids = [x.get("id") for x in lectures if isinstance(x, dict) and x.get("id") is not None]
        if ids:
            report["id_min"], report["id_max"] = min(ids), max(ids)
        for it in lectures[:400]:
            if not isinstance(it, dict):
                continue
            lid = it.get("id")
            if lid:
                code, one = get(f"{SITE}/api/lecture/{lid}", want_json=True)
                if one:
                    report["keys_detail"] = deep_keys(one)
                    report["sample_detail"] = one
                break
    else:
        report["n_lectures"] = 0
        report["FAIL"] = "API списка не найден — смотри mined_paths и probe_*"

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")

    print(f"бандлов: {len(bundles)}  найденных путей: {len(mined)}  победителей: {len(report['winners'])}")
    print(f"выбран: {report.get('chosen')}")
    print(f"лекций: {report.get('n_lectures')}  id: {report.get('id_min')}..{report.get('id_max')}")
    print(f"поля карточки: {sorted(report.get('keys_item', {}))[:40]}")
    print(f"→ {OUT}  ({OUT.stat().st_size} байт)")
    if not lectures:
        print("--- кандидаты (код 200) ---")
        for r in report["probe_mined"] + report["probe_list"] + report["probe_misc"]:
            if r["code"] == 200:
                print(f"  {r['code']} {r['url']}  json={r.get('json')} len={r.get('len')}")
                print(f"      {(r.get('head') or '')[:200]}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
