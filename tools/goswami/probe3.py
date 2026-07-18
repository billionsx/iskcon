#!/usr/bin/env python3
"""
probe3.py — РАЗВЕДКА goswami.ru, заход третий и решающий.

Что уже выяснено двумя заходами (ЗКН-Пл010 — перебирать формы, а не сдаваться):
  · /api/* на самом сайте — 404: своего API у фронта нет;
  · SSR отдаёт `__PRELOADED_STATE__`, но БЕЗ данных — это пустой каркас;
  · в бандле зашит настоящий хост: **https://api.goswami.ru**;
  · у лекции есть `file_url` (mp3) и `video_url`;
  · оси каталога названы самим сайтом: `category`, `scripture`, `location`
    (+ `zeroCollections`, `timeMachine.collections`) — это и есть будущие альбомы.

Осталось одно: узнать маршруты api.goswami.ru. Берём их не из головы, а из
бандла — вытаскиваем ВСЕ строковые литералы и шаблоны рядом с вызовами, потом
проверяем живьём и выкачиваем каталог целиком.

Только чтение. Без зависимостей.
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
OUT = Path(os.getenv("PROBE_OUT") or (HERE.parent.parent / "docs" / "diagnostics" / "goswami-probe3.json"))
LIMIT = int(os.getenv("PROBE_LIMIT") or 0)

SITE = "https://goswami.ru"
API = "https://api.goswami.ru"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE


def get(url, timeout=40, want_json=False):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "application/json, text/plain, */*",
        "Accept-Encoding": "gzip",
        "Accept-Language": "ru,en;q=0.8",
        "Origin": SITE,
        "Referer": SITE + "/",
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
    except Exception:
        return 0, None


# ═══ 1. ДОБЫЧА МАРШРУТОВ ИЗ БАНДЛА ═══════════════════════════════════════════

def mine(js: str):
    """Все пути и шаблоны, встречающиеся в бандле. Не фильтруем по смыслу —
    фильтр по смыслу и был ошибкой первого захода."""
    paths = set()
    for m in re.finditer(r'["\'`](/[a-zA-Z0-9_\-/${}.]{2,70})["\'`]', js):
        paths.add(m.group(1))
    # окрестности упоминаний хоста — там обычно и склеивается маршрут
    ctx = []
    for m in re.finditer(r"api\.goswami\.ru", js):
        ctx.append(js[max(0, m.start() - 260):m.start() + 260])
    return sorted(paths), ctx[:25]


# ═══ 2. КАНДИДАТЫ ════════════════════════════════════════════════════════════

BASE_GUESS = [
    "/lectures", "/lecture", "/lectures/", "/api/lectures", "/api/lecture",
    "/lectures/list", "/lectures/search", "/search", "/main", "/index",
    "/preset_values", "/presetvalues", "/preset-values", "/presets",
    "/categories", "/category", "/scriptures", "/scripture",
    "/locations", "/location", "/collections", "/collection",
    "/lectures/filter", "/filter", "/lectures/all", "/all",
]
ITEM_GUESS = ["/lectures/6016", "/lecture/6016", "/api/lectures/6016", "/lectures/6016/"]


def probe_many(paths, note):
    rows = []
    for p in paths:
        url = p if p.startswith("http") else API + p
        code, body = get(url)
        row = {"url": url, "code": code, "note": note}
        if isinstance(body, str):
            row["len"] = len(body)
            row["json"] = body.lstrip()[:1] in "[{"
            row["head"] = body[:500]
        rows.append(row)
        time.sleep(0.1)
    return rows


def find_items(payload):
    if isinstance(payload, list):
        return payload, "$"
    if isinstance(payload, dict):
        for k in ("results", "items", "data", "lectures", "list", "rows", "objects", "content", "docs"):
            v = payload.get(k)
            if isinstance(v, list) and v:
                return v, k
            if isinstance(v, dict):
                s, sk = find_items(v)
                if s:
                    return s, f"{k}.{sk}"
        for k, v in payload.items():
            if isinstance(v, list) and v and isinstance(v[0], dict):
                return v, k
    return None, None


def deep_keys(obj, prefix="", acc=None, depth=0):
    if acc is None:
        acc = {}
    if depth > 5:
        return acc
    if isinstance(obj, dict):
        for k, v in obj.items():
            key = f"{prefix}.{k}" if prefix else k
            if isinstance(v, (dict, list)):
                deep_keys(v, key, acc, depth + 1)
            else:
                acc.setdefault(key, repr(v)[:140])
    elif isinstance(obj, list) and obj:
        acc.setdefault(prefix + "[len]", len(obj))
        deep_keys(obj[0], prefix + "[]", acc, depth + 1)
    return acc


def harvest(base, rep):
    """Выкачка каталога. Пробует известные схемы пагинации, берёт первую живую."""
    schemes = [
        ("page+limit", lambda n, sz: f"{base}{'&' if '?' in base else '?'}page={n}&limit={sz}"),
        ("page+per_page", lambda n, sz: f"{base}{'&' if '?' in base else '?'}page={n}&per_page={sz}"),
        ("page+size", lambda n, sz: f"{base}{'&' if '?' in base else '?'}page={n}&size={sz}"),
        ("offset", lambda n, sz: f"{base}{'&' if '?' in base else '?'}offset={(n - 1) * sz}&limit={sz}"),
        ("skip", lambda n, sz: f"{base}{'&' if '?' in base else '?'}skip={(n - 1) * sz}&limit={sz}"),
        ("page", lambda n, sz: f"{base}{'&' if '?' in base else '?'}page={n}"),
    ]
    for name, mk in schemes:
        c1, p1 = get(mk(1, 100), want_json=True)
        if c1 != 200 or p1 is None:
            continue
        i1, key = find_items(p1)
        if not i1:
            continue
        c2, p2 = get(mk(2, 100), want_json=True)
        i2, _ = find_items(p2) if p2 else (None, None)
        paged = bool(i2) and json.dumps(i2[:1], sort_keys=True) != json.dumps(i1[:1], sort_keys=True)
        rep["scheme"] = {"name": name, "key": key, "paged": paged, "page1": len(i1),
                         "envelope": deep_keys({k: v for k, v in p1.items() if k != key}) if isinstance(p1, dict) else None}
        if not paged:
            rep["scheme_note"] = "пагинации нет — источник отдал один список"
            return i1
        seen, out, n, empty = set(), [], 1, 0
        while True:
            c, payload = get(mk(n, 100), want_json=True)
            items, _ = (find_items(payload) if payload else (None, None))
            if not items:
                empty += 1
                if empty >= 2:
                    break
                n += 1
                continue
            empty, fresh = 0, 0
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
            if n > 900:
                break
            if n % 20 == 0:
                print(f"  … страница {n}, собрано {len(out)}", flush=True)
        return out
    return None


def main():
    rep = {"api": API, "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}

    # 1. бандл
    code, js = get("https://goswami.ru/static/bundle.72d094cf.js", timeout=90)
    rep["bundle"] = {"code": code, "len": len(js) if js else 0}
    paths, ctx = mine(js) if js else ([], [])
    rep["bundle_paths"] = paths[:400]
    rep["bundle_ctx"] = ctx

    # 2. корень API + кандидаты
    rep["probe_root"] = probe_many(["/", ""], "корень")
    mined = [p for p in paths if "{" not in p and "$" not in p and len(p) > 2][:120]
    rep["probe_mined"] = probe_many(mined, "из бандла")
    rep["probe_guess"] = probe_many(BASE_GUESS, "типовое")
    rep["probe_item"] = probe_many(ITEM_GUESS, "карточка")

    allrows = rep["probe_mined"] + rep["probe_guess"] + rep["probe_root"]
    winners = [r for r in allrows if r["code"] == 200 and r.get("json") and r.get("len", 0) > 40]
    rep["winners"] = [w["url"] for w in winners]
    print("живых JSON-точек:", len(winners))
    for w in winners[:25]:
        print("   ", w["url"], w.get("len"))

    # 3. справочники (оси будущих альбомов)
    rep["dicts"] = {}
    for p in ["/preset_values", "/presetvalues", "/preset-values", "/categories",
              "/scriptures", "/locations", "/collections"]:
        c, payload = get(API + p, want_json=True)
        if c == 200 and payload is not None:
            rep["dicts"][p] = payload

    # 4. каталог
    lectures = None
    for w in winners:
        c, payload = get(w["url"], want_json=True)
        if payload is None:
            continue
        items, key = find_items(payload)
        if not items or not isinstance(items[0], dict):
            continue
        probe_keys = set(items[0])
        if not ({"title", "name"} & probe_keys):
            continue
        rep["chosen"] = w["url"]
        rep["keys_envelope"] = deep_keys(payload)
        print("выбран:", w["url"], flush=True)
        lectures = harvest(w["url"], rep)
        if lectures:
            break

    if lectures:
        rep["n"] = len(lectures)
        rep["lectures"] = lectures
        rep["keys_item"] = deep_keys(lectures[0])
        rep["sample"] = lectures[:3]
        ids = [x.get("id") for x in lectures if x.get("id") is not None]
        if ids:
            rep["id_min"], rep["id_max"] = min(ids), max(ids)
        # деталь одной лекции — там живёт file_url
        for p in [f"/lectures/{ids[0]}", f"/lecture/{ids[0]}"]:
            c, one = get(API + p, want_json=True)
            if c == 200 and one:
                rep["detail_url"] = API + p
                rep["keys_detail"] = deep_keys(one)
                rep["sample_detail"] = one
                break
    else:
        rep["n"] = 0
        rep["FAIL"] = "каталог не найден"

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(rep, ensure_ascii=False, indent=1), encoding="utf-8")
    print("лекций:", rep.get("n"), "id:", rep.get("id_min"), "..", rep.get("id_max"))
    print("деталь:", rep.get("detail_url"))
    print("поля карточки:", sorted(rep.get("keys_item", {}))[:40])
    print("поля детали  :", sorted(rep.get("keys_detail", {}))[:40])
    print("справочники  :", {k: (len(v) if isinstance(v, (list, dict)) else "?") for k, v in rep["dicts"].items()})
    print("→", OUT, OUT.stat().st_size, "байт")
    return 0 if lectures else 1


if __name__ == "__main__":
    sys.exit(main())
