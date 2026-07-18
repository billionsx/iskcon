#!/usr/bin/env python3
"""
probe8.py — ФОРМА ЗАПРОСА И ПЕРВЫЕ СТРОКИ.

probe7 показал: выдача берётся не аргументами, а объектом —
`getMediaByFilter(input: MediaFilterInput)`. Состав объекта закрыт вместе с
интроспекцией, но валидатор проговаривается ровно так же:

    input:{zzz:1}   → «Field "zzz" is not defined by type "MediaFilterInput".
                       Did you mean "scripture_id"?»
    input:{limit:"x"} → «Expected type Int, found "x"»  ← а вот и тип

Итого за один прогон снимается: состав объекта, тип каждого поля, полные
справочники осей (писание/раздел/место) и дерево циклов сайта
(`getZeroCollections`) — то самое, по которому лектор сам разложил свои записи.
Своя разбивка по названиям нужна только там, где сайт не разложил.

Порядок: состав объектов → типы полей → справочники → дерево циклов → выдача.
"""
import gzip
import io
import json
import os
import re
import ssl
import time
import urllib.error
import urllib.request
from pathlib import Path

GQL = "https://api.goswami.ru/graphql"
OUT = Path(os.getenv("OUT") or "docs/diagnostics/goswami-probe8.json")
PAUSE = float(os.getenv("PAUSE") or 0.04)
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
N = 0


def gql(q, timeout=30):
    global N
    N += 1
    body = json.dumps({"query": q}).encode()
    req = urllib.request.Request(GQL, data=body, method="POST", headers={
        "User-Agent": UA, "Content-Type": "application/json", "Accept": "*/*",
        "Origin": "https://goswami.ru", "Referer": "https://goswami.ru/",
        "Accept-Encoding": "gzip"})
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=CTX) as r:
            raw = r.read()
            if r.headers.get("Content-Encoding") == "gzip":
                raw = gzip.GzipFile(fileobj=io.BytesIO(raw)).read()
            return json.loads(raw.decode("utf-8", "replace"))
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            if e.headers.get("Content-Encoding") == "gzip":
                raw = gzip.GzipFile(fileobj=io.BytesIO(raw)).read()
            return json.loads(raw.decode("utf-8", "replace"))
        except Exception:
            return {"_http": e.code}
    except Exception as e:
        return {"_err": str(e)[:200]}
    finally:
        time.sleep(PAUSE)


def errs(r):
    return [e.get("message", "") for e in (r or {}).get("errors", [])]


MEDIA_F = ["id", "title", "description", "teaser", "text", "file_url", "video_url", "alias_url",
           "img_url", "duration", "size", "language", "type", "canto", "chapter", "verse",
           "scripture_id", "collection_id", "location_name", "in_collections",
           "issue_date", "occurrence_date"]
ZC_F = ["id", "full_name", "sub_name", "annotation", "child_collections_id", "date_to",
        "direction", "img_url", "language", "scripture_id", "source"]

INPUT_GUESS = [
    "limit", "offset", "page", "per_page", "perPage", "take", "skip", "first", "count", "size",
    "search", "query", "q", "text", "title", "sort", "order", "orderBy", "sortBy", "direction",
    "id", "ids", "type", "language", "lang", "category_id", "scripture_id", "location_id",
    "collection_id", "album_id", "tag_id", "tags", "canto", "chapter", "verse",
    "date_from", "date_to", "issue_date", "occurrence_date", "year", "from", "to",
    "isAdmin", "is_admin", "published", "status", "user_id", "parent_id", "slug",
    "collections", "categories", "scriptures", "locations", "filter", "filters",
]

res = {"gql": GQL, "ts": int(time.time()), "inputs": {}, "presets": {}, "collections": {},
       "rows": {}, "notes": []}

# ── A. состав входных объектов ─────────────────────────────────────────
print("═══ A. состав входных объектов ═══")
TARGETS = [
    ("MediaFilterInput", "{getMediaByFilter(input:{%s}){id}}"),
    ("MediaInput", "{getMedia(input:{%s}){id}}"),
    ("GetAlbumsInput", "{getAlbums(input:{%s}){id}}"),
    ("getCollectionsInput", "{getCollections(input:{%s}){id}}"),
]
for tname, tpl in TARGETS:
    ok, hints, types = set(), set(), {}
    todo = list(INPUT_GUESS)
    seen = set()
    while todo:
        g = todo.pop(0)
        if g in seen:
            continue
        seen.add(g)
        r = gql(tpl % ("%s:1" % g))
        ms = errs(r)
        blob = " ".join(ms)
        if ("not defined by type" in blob or "is not defined" in blob) and ('"%s"' % g) in blob:
            for m in ms:
                if "Did you mean" in m:
                    for c in re.findall(r'"([A-Za-z_][A-Za-z0-9_]*)"', m.split("Did you mean", 1)[1]):
                        if c not in seen:
                            todo.append(c)
                        hints.add(c)
            continue
        ok.add(g)
        # тип: подсовываем заведомо чужой скаляр и читаем ожидание
        r2 = gql(tpl % ('%s:"zz"' % g))
        for m in errs(r2):
            mm = re.search(r'Expected type ([A-Za-z_!\[\]]+)', m)
            if mm and ('"%s"' % g) not in m.split("Expected")[0][:0]:
                types[g] = mm.group(1)
                break
        else:
            types[g] = "String?"
    res["inputs"][tname] = {"fields": sorted(ok), "types": types, "hints": sorted(hints - ok)}
    print("  %-22s поля: %s" % (tname, sorted(ok)))
    print("  %-22s типы: %s" % ("", types))
    if hints - ok:
        print("  %-22s подсказки: %s" % ("", sorted(hints - ok)))

# ── B. справочники осей ────────────────────────────────────────────────
print("\n═══ B. справочники ═══")
for f in ["getPresetScripture", "getPresetCategory", "getPresetLocation"]:
    r = gql("{%s{id name}}" % f)
    d = (r.get("data") or {}).get(f) or []
    res["presets"][f] = d
    print("  %-20s %d: %s" % (f, len(d), ", ".join("%s=%s" % (x["id"], x["name"]) for x in d)))

# ── C. дерево циклов сайта ─────────────────────────────────────────────
print("\n═══ C. циклы сайта (getZeroCollections) ═══")
for q in ["{getZeroCollections{data{%s}}}" % " ".join(ZC_F),
          "{getZeroCollections{%s}}" % " ".join(ZC_F)]:
    r = gql(q)
    d = (r.get("data") or {}).get("getZeroCollections")
    if d:
        rows = d.get("data") if isinstance(d, dict) else d
        res["collections"]["zero"] = rows
        res["collections"]["query"] = q
        print("  ✓ %s → %d циклов" % (q[:60], len(rows or [])))
        for x in (rows or [])[:25]:
            print("     %-5s %-46s дети:%s" % (x.get("id"), str(x.get("full_name"))[:46],
                                               str(x.get("child_collections_id"))[:40]))
        break
    print("  · %s" % (errs(r)[:1] or [""])[0][:140])

# ── D. выдача ──────────────────────────────────────────────────────────
print("\n═══ D. выдача ═══")
mf = res["inputs"].get("MediaFilterInput", {}).get("fields", [])
tries = ["{getMediaByFilter(input:{}){%s}}" % " ".join(MEDIA_F)]
if "limit" in mf:
    tries.append("{getMediaByFilter(input:{limit:5}){%s}}" % " ".join(MEDIA_F))
if "limit" in mf and "offset" in mf:
    tries.append("{getMediaByFilter(input:{limit:5,offset:0}){%s}}" % " ".join(MEDIA_F))
if "page" in mf:
    tries.append("{getMediaByFilter(input:{page:1}){%s}}" % " ".join(MEDIA_F))
for q in tries:
    r = gql(q)
    d = (r.get("data") or {}).get("getMediaByFilter")
    if d:
        rows = d if isinstance(d, list) else [d]
        res["rows"]["query"] = q
        res["rows"]["n"] = len(rows)
        res["rows"]["sample"] = rows[:3]
        print("  ✓ %s" % q[:80])
        print("  строк: %d" % len(rows))
        print(json.dumps(rows[:2], ensure_ascii=False, indent=1)[:2600])
        break
    print("  · %s → %s" % (q[:70], (errs(r)[:1] or [""])[0][:130]))

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
print("\nзапросов: %d → %s" % (N, OUT))
