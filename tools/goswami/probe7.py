#!/usr/bin/env python3
"""
probe7.py — БОЕВОЙ ЗАПРОС.

probe6 назвал поля. Теперь надо снять с них показания: что отдают, какие
аргументы берут, и есть ли у записи дата — без даты не собрать ни годовые
циклы, ни порядок внутри цикла.

Интроспекция закрыта, поэтому схема снимается по подсказкам в ошибках:
  «Unknown argument "zz"»                     → аргумента нет
  «argument "limit" of type "Int!" is required» → аргумент есть, и вот его тип
  «Cannot query field "date"… Did you mean "created_at"?» → поле есть, вот имя

Порядок:
  A. выполнить каждый корневой запрос как есть — вдруг отдаст данные сразу
  B. перебрать словарь имён аргументов
  C. перебрать словарь имён полей у MediaResponse/AlbumResponse/CollectionsResponse
  D. если выдача поехала — вытащить первую страницу целиком и показать её
"""
import gzip
import io
import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

GQL = "https://api.goswami.ru/graphql"
OUT = Path(os.getenv("OUT") or "docs/diagnostics/goswami-probe7.json")
PAUSE = float(os.getenv("PAUSE") or 0.04)
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
N = 0


def gql(q, variables=None, timeout=25):
    global N
    N += 1
    body = json.dumps({"query": q, "variables": variables or {}}).encode()
    req = urllib.request.Request(GQL, data=body, method="POST", headers={
        "User-Agent": UA, "Content-Type": "application/json", "Accept": "*/*",
        "Origin": "https://goswami.ru", "Referer": "https://goswami.ru/",
        "Accept-Encoding": "gzip",
    })
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
            return {"_http": e.code, "_raw": raw[:400].decode("utf-8", "replace")}
    except Exception as e:
        return {"_err": str(e)[:200]}
    finally:
        time.sleep(PAUSE)


def errs(r):
    return [e.get("message", "") for e in (r or {}).get("errors", [])]


MEDIA_FIELDS = ["id", "title", "description", "teaser", "file_url", "video_url", "video_id",
                "duration", "size", "category_id", "scripture_id", "location_id",
                "location_name", "collection_id", "in_collections", "played"]

# имена, которыми обычно зовут дату, обложку, порядок и связи
FIELD_GUESS = [
    "date", "created_at", "createdAt", "updated_at", "updatedAt", "published_at", "publishedAt",
    "lecture_date", "lectureDate", "record_date", "recordDate", "datetime", "timestamp", "year",
    "slug", "url", "name", "image", "image_url", "cover", "poster", "thumbnail", "preview",
    "author", "author_id", "speaker", "speaker_id", "lecturer", "tags", "tag_ids", "tag",
    "category", "category_name", "scripture", "scripture_name", "collection", "collections",
    "collection_name", "album", "album_id", "albums", "sort", "order", "position", "number",
    "verse", "chapter", "canto", "text", "body", "content", "transcript", "lang", "language",
    "audio_url", "audio", "mp3", "mp3_url", "src", "source", "file", "file_name", "filename",
    "views", "likes", "downloads", "is_published", "published", "status", "type", "kind",
    "total", "count", "data", "items", "list", "nodes", "edges", "media", "rows", "result",
]

ARG_GUESS = [
    "limit", "offset", "page", "per_page", "perPage", "take", "skip", "first", "last", "after",
    "before", "cursor", "size", "count", "sort", "order", "orderBy", "sortBy", "direction",
    "search", "query", "q", "text", "filter", "filters", "where", "input", "params", "id", "ids",
    "category_id", "scripture_id", "location_id", "collection_id", "album_id", "tag_id", "tags",
    "categoryId", "scriptureId", "locationId", "collectionId", "albumId", "tagIds",
    "date_from", "date_to", "from", "to", "year", "lang", "type", "slug", "user_id", "isAdmin",
]

ROOTS = ["getMediaByFilter", "getMedia", "getAlbums", "getCollections", "getZeroCollections",
         "getPresetCategory", "getPresetScripture", "getPresetLocation", "searchTags"]

res = {"gql": GQL, "ts": int(time.time()), "exec": {}, "args": {}, "fields": {}, "sample": {}}

# ── A. выполнить корневые запросы как есть ─────────────────────────────
print("═══ A. выполняем корневые запросы ═══")
for f in ROOTS:
    for q in ("{%s}" % f,
              "{%s{%s}}" % (f, " ".join(MEDIA_FIELDS)),
              "{%s{id name}}" % f,
              "{%s{total}}" % f,
              "{%s{data{id title}}}" % f):
        r = gql(q)
        if r.get("data") and r["data"].get(f) is not None:
            d = r["data"][f]
            n = len(d) if isinstance(d, list) else 1
            res["exec"][f] = {"query": q, "ok": True, "n": n,
                              "sample": (d[:2] if isinstance(d, list) else d)}
            print("  ✓ %-22s %s → %s строк" % (f, q[:52], n))
            break
    else:
        r = gql("{%s{id}}" % f)
        res["exec"][f] = {"ok": False, "errors": errs(r)[:3]}
        print("  · %-22s %s" % (f, (errs(r)[:1] or [""])[0][:100]))

# ── B. аргументы ───────────────────────────────────────────────────────
print("\n═══ B. аргументы ═══")
for f in ["getMediaByFilter", "getMedia", "getAlbums", "getCollections"]:
    found = {}
    for a in ARG_GUESS:
        r = gql('{%s(%s:1){id}}' % (f, a))
        ms = " ".join(errs(r))
        if "Unknown argument" in ms and a in ms:
            continue
        if not ms:
            found[a] = "принят (Int)"
            continue
        keep = [m for m in errs(r) if "Unknown argument" not in m and "Cannot query field" not in m]
        if keep:
            found[a] = keep[0][:200]
    res["args"][f] = found
    print("  %s:" % f)
    for k, v in found.items():
        print("    %-16s %s" % (k, v[:110]))

# ── C. поля ────────────────────────────────────────────────────────────
print("\n═══ C. поля ═══")
TARGETS = [("getMediaByFilter", "{getMediaByFilter{%s}}"),
           ("getMedia", "{getMedia{%s}}"),
           ("getAlbums", "{getAlbums{%s}}"),
           ("getCollections", "{getCollections{data{%s}}}"),
           ("getZeroCollections", "{getZeroCollections{data{%s}}}")]
for name, tpl in TARGETS:
    ok, hints = [], set()
    for g in FIELD_GUESS:
        r = gql(tpl % g)
        ms = errs(r)
        if not ms:
            ok.append(g)
            continue
        for m in ms:
            if "Did you mean" in m:
                for cand in m.split("Did you mean", 1)[1].replace("or", ",").split(","):
                    c = cand.strip().strip('"?. '"'")
                    if c and c.isidentifier():
                        hints.add(c)
    # подсказки тоже проверяем
    for g in sorted(hints - set(ok) - set(FIELD_GUESS)):
        r = gql(tpl % g)
        if not errs(r):
            ok.append(g)
    res["fields"][name] = sorted(set(ok))
    print("  %-20s %s" % (name, sorted(set(ok))))

# ── D. первая страница выдачи ──────────────────────────────────────────
print("\n═══ D. проба выдачи ═══")
media_fields = sorted(set(MEDIA_FIELDS + res["fields"].get("getMediaByFilter", [])))
for attempt in [
    "{getMediaByFilter{%s}}" % " ".join(media_fields),
    "{getMediaByFilter(limit:5){%s}}" % " ".join(media_fields),
    "{getMediaByFilter(limit:5,offset:0){%s}}" % " ".join(media_fields),
    "{getMediaByFilter(page:1){%s}}" % " ".join(media_fields),
]:
    r = gql(attempt)
    if r.get("data", {}).get("getMediaByFilter"):
        d = r["data"]["getMediaByFilter"]
        res["sample"]["query"] = attempt
        res["sample"]["n"] = len(d) if isinstance(d, list) else 1
        res["sample"]["rows"] = d[:3] if isinstance(d, list) else d
        print("  ✓ %s" % attempt[:90])
        print("    строк: %s" % res["sample"]["n"])
        print(json.dumps(res["sample"]["rows"], ensure_ascii=False, indent=1)[:2200])
        break
    else:
        print("  · %s → %s" % (attempt[:70], (errs(r)[:1] or [""])[0][:120]))

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
print("\nзапросов: %d → %s" % (N, OUT))
