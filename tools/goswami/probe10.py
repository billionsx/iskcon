#!/usr/bin/env python3
"""
probe10.py — ЗАПИСИ И ПОЛНОЕ ДЕРЕВО ЦИКЛОВ.

Ошибка probe9: поле-объект и отсутствующее поле различаются по тексту ошибки,
а щуп валил их в одну кучу.

    «Cannot query field "zz" on type "MediaResponse"»          → поля НЕТ
    «Field "data" of type "[Media]" must have a selection…»    → поле ЕСТЬ, оно объект
    «Field "total" must not have a selection since type Int…»  → поле ЕСТЬ, оно скаляр

Второе и третье — это ПОДТВЕРЖДЕНИЕ поля, а не отказ. Здесь они читаются верно,
и заодно из текста ошибки вынимается ТИП поля («of type "[Media]"»).

Дальше: почему `getMedia` отдал пустоту (какие ещё поля input обязательны), и
полная выкачка дерева циклов постранично — это готовая раскладка по альбомам,
сделанная самим лектором.
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
OUT = Path(os.getenv("OUT") or "docs/diagnostics/goswami-probe10.json")
PAUSE = float(os.getenv("PAUSE") or 0.05)
MAX_PAGES = int(os.getenv("MAX_PAGES") or 400)
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
              "page", "pages", "per_page", "totalPages", "hasMore", "collections", "albums",
              "medias", "lectures", "records", "content", "meta", "pagination"]

res = {"gql": GQL, "ts": int(time.time()), "wrap": {}, "media": {}, "collections": {}}


def probe_wrapper(label, tpl):
    """Поле есть, если ошибка говорит о ВЫБОРЕ подполей, а не об отсутствии поля."""
    found = {}
    hints = set()
    for g in WRAP_GUESS:
        r = gql(tpl % g)
        ms = errs(r)
        if not ms:
            found[g] = "скаляр (принято как есть)"
            continue
        blob = " ".join(ms)
        if "must have a selection of subfields" in blob or "must have a selection" in blob:
            m = re.search(r'of type "([^"]+)" must have a selection', blob)
            found[g] = "объект %s" % (m.group(1) if m else "?")
            continue
        if "must not have a selection" in blob:
            m = re.search(r'type "([^"]+)"', blob)
            found[g] = "скаляр %s" % (m.group(1) if m else "?")
            continue
        if "Cannot query field" in blob and ('"%s"' % g) in blob:
            for m in ms:
                if "Did you mean" in m:
                    for c in re.findall(r'"([A-Za-z_][A-Za-z0-9_]*)"', m.split("Did you mean", 1)[1]):
                        hints.add(c)
            continue
        found[g] = "?? " + blob[:90]
    for g in sorted(hints - set(found)):
        r = gql(tpl % g)
        blob = " ".join(errs(r))
        if not blob:
            found[g] = "скаляр"
        elif "must have a selection" in blob:
            m = re.search(r'of type "([^"]+)" must have a selection', blob)
            found[g] = "объект %s" % (m.group(1) if m else "?")
        elif "must not have a selection" in blob:
            found[g] = "скаляр"
    res["wrap"][label] = found
    print("  %s:" % label)
    for k, v in found.items():
        print("    %-16s %s" % (k, v))
    return found


# ── A. оболочки ────────────────────────────────────────────────────────
print("═══ A. оболочки ответов ═══")
mw = probe_wrapper("MediaResponse", "{getMedia(input:{page:1}){%s}}")
cw = probe_wrapper("CollectionsResponse", "{getCollections(input:{page:1}){%s}}")

# ── B. почему getMedia пуст ────────────────────────────────────────────
print("\n═══ B. записи ═══")
listf = next((k for k, v in mw.items() if v.startswith("объект")), "data")
cntf = next((k for k in ("total", "count") if k in mw and "скаляр" in mw[k]), None)
sel = ("%s " % cntf if cntf else "") + "%s{%s}" % (listf, " ".join(MEDIA_F))
attempts = [
    ("пустой input", "{getMedia(input:{}){%s}}" % sel),
    ("page:1", "{getMedia(input:{page:1}){%s}}" % sel),
    ("page:0", "{getMedia(input:{page:0}){%s}}" % sel),
    ('type:"audio"', '{getMedia(input:{page:1,type:"audio"}){%s}}' % sel),
    ('language:"ru"', '{getMedia(input:{page:1,language:"ru"}){%s}}' % sel),
    ("collection_id:19", "{getMedia(input:{page:1,collection_id:19}){%s}}" % sel),
    ("scripture_id:1", "{getMedia(input:{page:1,scripture_id:1}){%s}}" % sel),
    ('orderBy:"date"', '{getMedia(input:{page:1,orderBy:"date"}){%s}}' % sel),
]
for label, q in attempts:
    r = gql(q)
    d = (r.get("data") or {}).get("getMedia") or {}
    rows = d.get(listf) if isinstance(d, dict) else d
    rows = rows or []
    tot = d.get(cntf) if (cntf and isinstance(d, dict)) else None
    if rows:
        res["media"] = {"query": q, "via": label, "total": tot, "n": len(rows),
                        "sample": rows[:3], "list_field": listf, "count_field": cntf}
        print("  ✓ %-18s всего=%s строк=%d" % (label, tot, len(rows)))
        print(json.dumps(rows[:2], ensure_ascii=False, indent=1)[:2400])
        break
    print("  · %-18s %s" % (label, (errs(r)[:1] or ["пусто"])[0][:130]))

# ── C. полное дерево циклов ────────────────────────────────────────────
print("\n═══ C. дерево циклов ═══")
clist = next((k for k, v in cw.items() if v.startswith("объект")), "data")
ccnt = next((k for k in ("total", "count") if k in cw and "скаляр" in cw[k]), None)
csel = ("%s " % ccnt if ccnt else "") + "%s{%s}" % (clist, " ".join(COL_F))
allc, page, ctotal = [], 1, None
seen = set()
while page <= MAX_PAGES:
    r = gql("{getCollections(input:{page:%d}){%s}}" % (page, csel))
    d = (r.get("data") or {}).get("getCollections") or {}
    rows = d.get(clist) or []
    if ctotal is None and ccnt:
        ctotal = d.get(ccnt)
    fresh = [x for x in rows if x.get("id") not in seen]
    if not fresh:
        break
    for x in fresh:
        seen.add(x.get("id"))
    allc += fresh
    if page % 10 == 0:
        print("    …стр %d, циклов %d" % (page, len(allc)))
    page += 1
res["collections"] = {"total": ctotal, "n": len(allc), "rows": allc,
                      "list_field": clist, "count_field": ccnt}
print("  циклов собрано: %d (сайт заявляет: %s), страниц: %d" % (len(allc), ctotal, page - 1))
for x in allc[:40]:
    print("   %-6s %-54s писание:%s" % (x.get("id"), str(x.get("full_name"))[:54], x.get("scripture_id")))

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
print("\nзапросов: %d → %s" % (N, OUT))
