#!/usr/bin/env python3
"""
probe9.py — ОБОЛОЧКА ОТВЕТА И РАЗМЕР БАЗЫ.

Выдача лекций лежит за `getMedia(input: MediaInput)`, и input обязателен —
поэтому probe7 не увидел у `MediaResponse` ни одного поля: запрос падал на
отсутствии аргумента раньше, чем валидатор доходил до состава ответа. Здесь
input подставляется сразу, и оболочка снимается нормально.

Что нужно снять:
  1. состав `MediaResponse` — где список и где счётчик (`total`)
  2. размер страницы и полное число записей → отсюда известен объём переброски
  3. состав `CollectionsResponse` — циклы, которыми лектор сам разложил записи
  4. живые строки: убедиться, что `file_url` реально отдаётся, а не пустует

Фильтры `MediaInput` (из probe8): page, orderBy, title, id, ids, type, language,
category_id, scripture_id, location_id, collection_id, tags, canto, chapter, verse.
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
OUT = Path(os.getenv("OUT") or "docs/diagnostics/goswami-probe9.json")
PAUSE = float(os.getenv("PAUSE") or 0.05)
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
N = 0


def gql(q, timeout=40):
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


MEDIA_F = ["id", "title", "description", "teaser", "file_url", "video_url", "alias_url",
           "img_url", "duration", "size", "language", "type", "canto", "chapter", "verse",
           "scripture_id", "collection_id", "location_name", "in_collections",
           "issue_date", "occurrence_date"]
COL_F = ["id", "full_name", "sub_name", "annotation", "child_collections_id", "date_to",
         "direction", "img_url", "language", "scripture_id", "source"]
WRAP_GUESS = ["data", "total", "count", "items", "list", "rows", "nodes", "media", "result",
              "page", "pages", "per_page", "totalPages", "hasMore", "collections", "albums"]

res = {"gql": GQL, "ts": int(time.time()), "wrap": {}, "size": {}, "rows": {},
       "collections": {}, "axes": {}}

# ── A. оболочка ответа ─────────────────────────────────────────────────
print("═══ A. оболочка ответа ═══")
for name, tpl in [("MediaResponse", "{getMedia(input:{page:1}){%s}}"),
                  ("CollectionsResponse", "{getCollections(input:{page:1}){%s}}")]:
    ok, hints = [], set()
    for g in WRAP_GUESS:
        r = gql(tpl % g)
        ms = errs(r)
        if not ms:
            ok.append(g)
            continue
        for m in ms:
            if "Did you mean" in m:
                for c in re.findall(r'"([A-Za-z_][A-Za-z0-9_]*)"', m.split("Did you mean", 1)[1]):
                    hints.add(c)
    for g in sorted(hints - set(ok)):
        if not errs(gql(tpl % g)):
            ok.append(g)
    res["wrap"][name] = sorted(set(ok))
    print("  %-22s %s" % (name, sorted(set(ok))))

# ── B. размер базы ─────────────────────────────────────────────────────
print("\n═══ B. размер базы ═══")
listf = next((x for x in ("data", "items", "list", "rows", "nodes", "media")
              if x in res["wrap"].get("MediaResponse", [])), "data")
cntf = next((x for x in ("total", "count") if x in res["wrap"].get("MediaResponse", [])), None)
sel = ("%s " % cntf if cntf else "") + "%s{%s}" % (listf, " ".join(MEDIA_F))
r = gql("{getMedia(input:{page:1}){%s}}" % sel)
d = (r.get("data") or {}).get("getMedia") or {}
rows = d.get(listf) or []
total = d.get(cntf) if cntf else None
res["size"] = {"total": total, "per_page": len(rows), "list_field": listf, "count_field": cntf}
res["rows"]["sample"] = rows[:3]
res["rows"]["query"] = "{getMedia(input:{page:1}){%s}}" % sel
print("  всего: %s · на странице: %d" % (total, len(rows)))
if rows:
    print(json.dumps(rows[:2], ensure_ascii=False, indent=1)[:2400])
else:
    print("  ошибки:", errs(r)[:3])

# со звуком ли записи и есть ли вторая страница
if rows:
    r2 = gql("{getMedia(input:{page:2}){%s}}" % sel)
    d2 = (r2.get("data") or {}).get("getMedia") or {}
    rows2 = d2.get(listf) or []
    same = bool(rows2) and rows2[0].get("id") == rows[0].get("id")
    res["size"]["page2_ok"] = bool(rows2) and not same
    print("  стр.2: %d записей, %s" % (len(rows2), "ТА ЖЕ (пагинация не работает)" if same else "другая ✓"))
    nof = [x for x in rows if not x.get("file_url")]
    print("  без file_url на стр.1: %d из %d" % (len(nof), len(rows)))

# ── C. циклы ───────────────────────────────────────────────────────────
print("\n═══ C. циклы ═══")
clist = next((x for x in ("data", "items", "list", "rows") if x in res["wrap"].get("CollectionsResponse", [])), "data")
ccnt = next((x for x in ("total", "count") if x in res["wrap"].get("CollectionsResponse", [])), None)
csel = ("%s " % ccnt if ccnt else "") + "%s{%s}" % (clist, " ".join(COL_F))
r = gql("{getCollections(input:{page:1}){%s}}" % csel)
d = (r.get("data") or {}).get("getCollections") or {}
crows = d.get(clist) or []
res["collections"] = {"total": d.get(ccnt) if ccnt else None, "n": len(crows),
                      "query": "{getCollections(input:{page:1}){%s}}" % csel, "sample": crows[:40]}
print("  всего циклов: %s · на странице: %d" % (d.get(ccnt) if ccnt else "?", len(crows)))
for x in crows[:30]:
    print("   %-6s %-52s писание:%s" % (x.get("id"), str(x.get("full_name"))[:52], x.get("scripture_id")))
if not crows:
    print("  ошибки:", errs(r)[:3])

# ── D. счётчики по осям ────────────────────────────────────────────────
print("\n═══ D. счётчики по осям ═══")
if cntf:
    for label, key, vals in [("писание", "scripture_id", range(1, 9)),
                             ("раздел", "category_id", range(1, 9))]:
        got = {}
        for v in vals:
            rr = gql("{getMedia(input:{page:1,%s:%d}){%s}}" % (key, v, cntf))
            t = ((rr.get("data") or {}).get("getMedia") or {}).get(cntf)
            if t:
                got[v] = t
        res["axes"][key] = got
        print("  %-10s %s" % (label, got))

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
print("\nзапросов: %d → %s" % (N, OUT))
