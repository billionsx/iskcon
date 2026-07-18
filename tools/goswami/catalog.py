#!/usr/bin/env python3
"""
catalog.py — ВЫКАЧКА КАТАЛОГА goswami.ru.

Схема снята щупами probe6–probe10, здесь она просто применяется:

    getMedia(input:{page:N, type:"audio"}){ media{…} }   по 100 записей
    getCollections(input:{page:N}){ data{…} }            1142 цикла

`total` в ответе нет — идём постранично, пока страница не повторится или не
опустеет.

═══ ЧТО ЗАБИРАЕТСЯ И ЧТО НЕТ ═══

Забирается только то, без чего не собрать плеер: ссылка на звук, длительность,
дата, место, принадлежность к циклам. Описания лекций (`teaser`, `description`,
`text`) НЕ забираются: в витрине они не нужны, а в репозитории это чужой текст
и лишние мегабайты (ЗКН-Ф025).

═══ ЧТО ПРИВОДИТСЯ К ВИДУ ═══

  duration «2:23:24» → 8604 секунды   в D1 длительность числом
  size     «131»     → мегабайты      нужен для оценки объёма переброски
  file_url            percent-encoded кириллицей — оставляем как есть,
                      скачиванию всё равно, а вот имя файла в архиве строит
                      карта, и оно будет латинским
  occurrence_date     дата лекции; issue_date — дата публикации, не она

Выход: docs/diagnostics/goswami-catalog.json
"""
import gzip
import io
import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.request
from collections import Counter
from pathlib import Path

GQL = "https://api.goswami.ru/graphql"
OUT = Path(os.getenv("OUT") or "docs/diagnostics/goswami-catalog.json")
PAUSE = float(os.getenv("PAUSE") or 0.06)
MAX_PAGES = int(os.getenv("MAX_PAGES") or 400)
TYPES = (os.getenv("TYPES") or "audio").split(",")
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"

MEDIA_F = ["id", "title", "file_url", "video_url", "alias_url", "img_url", "duration", "size",
           "language", "type", "canto", "chapter", "verse", "scripture_id", "collection_id",
           "location_name", "in_collections", "issue_date", "occurrence_date"]
COL_F = ["id", "full_name", "sub_name", "annotation", "child_collections_id", "date_to",
         "direction", "img_url", "language", "scripture_id", "source"]
N = 0


def gql(q, timeout=60, retries=3):
    global N
    last = None
    for a in range(retries):
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
                time.sleep(PAUSE)
                return json.loads(raw.decode("utf-8", "replace"))
        except Exception as e:
            last = e
            time.sleep(1.5 * (a + 1))
    print("::warning::запрос не прошёл: %s" % str(last)[:160])
    return {}


def secs(v):
    """«2:23:24» / «53:07» / «1234» → секунды."""
    if v is None:
        return 0
    s = str(v).strip()
    if not s:
        return 0
    if s.isdigit():
        return int(s)
    parts = [p for p in re.split(r"[:.]", s) if p.strip().isdigit()]
    if not parts:
        return 0
    parts = [int(p) for p in parts][-3:]
    while len(parts) < 3:
        parts.insert(0, 0)
    h, m, sec = parts
    return h * 3600 + m * 60 + sec


def first(v):
    """canto/chapter/verse приходят массивами, часто [null]."""
    if isinstance(v, list):
        v = next((x for x in v if x not in (None, "")), None)
    return v


def dnorm(v):
    if not v:
        return None
    m = re.search(r"(\d{4})-(\d{2})-(\d{2})", str(v))
    return m.group(0) if m else None


def pull_media(mtype):
    sel = "media{%s}" % " ".join(MEDIA_F)
    out, seen, page = [], set(), 1
    while page <= MAX_PAGES:
        r = gql('{getMedia(input:{page:%d,type:"%s"}){%s}}' % (page, mtype, sel))
        rows = ((r.get("data") or {}).get("getMedia") or {}).get("media") or []
        fresh = [x for x in rows if x.get("id") not in seen]
        if not fresh:
            break
        for x in fresh:
            seen.add(x["id"])
        out += fresh
        if page % 5 == 0 or len(fresh) < len(rows):
            print("    …%s стр %d → %d записей" % (mtype, page, len(out)))
        page += 1
    print("  %s: %d записей за %d страниц" % (mtype, len(out), page - 1))
    return out


def pull_collections():
    sel = "data{%s}" % " ".join(COL_F)
    out, seen, page = [], set(), 1
    while page <= MAX_PAGES:
        r = gql("{getCollections(input:{page:%d}){%s}}" % (page, sel))
        rows = ((r.get("data") or {}).get("getCollections") or {}).get("data") or []
        fresh = [x for x in rows if x.get("id") not in seen]
        if not fresh:
            break
        for x in fresh:
            seen.add(x["id"])
        out += fresh
        page += 1
    print("  циклов: %d за %d страниц" % (len(out), page - 1))
    return out


def main():
    t0 = time.time()
    print("═══ справочники ═══")
    presets = {}
    for f in ["getPresetScripture", "getPresetCategory", "getPresetLocation"]:
        presets[f] = ((gql("{%s{id name}}" % f).get("data") or {}).get(f)) or []
        print("  %-20s %d" % (f, len(presets[f])))

    print("\n═══ циклы ═══")
    cols = pull_collections()

    print("\n═══ записи ═══")
    raw = []
    for t in TYPES:
        raw += pull_media(t.strip())

    print("\n═══ приведение ═══")
    lectures, no_url = [], 0
    for x in raw:
        url = (x.get("file_url") or "").strip()
        if not url:
            no_url += 1
        lectures.append({
            "id": x.get("id"),
            "title": (x.get("title") or "").strip(),
            "file_url": url or None,
            "img_url": x.get("img_url") or None,
            "duration": secs(x.get("duration")),
            "size_mb": int(re.sub(r"\D", "", str(x.get("size") or "0")) or 0),
            "date": dnorm(x.get("occurrence_date")) or dnorm(x.get("issue_date")),
            "place": (x.get("location_name") or "").strip() or None,
            "language": x.get("language") or None,
            "scripture_id": x.get("scripture_id"),
            "canto": first(x.get("canto")),
            "chapter": first(x.get("chapter")),
            "verse": first(x.get("verse")),
            "collections": [c for c in (x.get("in_collections") or []) if c],
            "page": "https://goswami.ru/lecture/%s" % x.get("id"),
        })

    withu = [x for x in lectures if x["file_url"]]
    hours = sum(x["duration"] for x in withu) / 3600
    gb = sum(x["size_mb"] for x in withu) / 1024
    years = Counter(x["date"][:4] for x in withu if x["date"])
    hosts = Counter(re.sub(r"^https?://([^/]+).*", r"\1", x["file_url"]) for x in withu)
    nocol = sum(1 for x in withu if not x["collections"])

    doc = {
        "source": "goswami.ru",
        "api": GQL,
        "ts": int(time.time()),
        "presets": presets,
        "collections": cols,
        "lectures": lectures,
        "stats": {
            "lectures": len(lectures), "with_audio": len(withu), "no_url": no_url,
            "hours": round(hours, 1), "size_gb": round(gb, 1),
            "without_collection": nocol,
            "years": dict(sorted(years.items())),
            "hosts": dict(hosts),
        },
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")

    # Сводка отдельным файлом: сам каталог тяжёлый и в репозитории не нужен, а
    # цифры нужны — по ним видно, что выкачалось и сколько предстоит везти.
    stats_path = OUT.parent / (OUT.stem + "-stats.json")
    stats_path.write_text(json.dumps({
        "ts": doc["ts"], "source": doc["source"],
        "stats": doc["stats"],
        "collections": len(cols),
        "presets": {k: len(v) for k, v in presets.items()},
        "top_collections": [
            {"id": c["id"], "name": c.get("full_name"), "scripture_id": c.get("scripture_id")}
            for c in cols[:60]],
    }, ensure_ascii=False, indent=1), encoding="utf-8")

    print("\n═══ КАТАЛОГ ═══")
    print("  записей: %d · со звуком: %d · без ссылки: %d" % (len(lectures), len(withu), no_url))
    print("  звучание: %.0f ч · объём: %.1f ГБ" % (hours, gb))
    print("  вне циклов: %d" % nocol)
    print("  хосты: %s" % dict(hosts))
    print("  по годам: %s" % json.dumps(dict(sorted(years.items())), ensure_ascii=False))
    print("  запросов: %d · %.1f мин · %s (%d КБ)"
          % (N, (time.time() - t0) / 60, OUT, OUT.stat().st_size // 1024))
    return 0


if __name__ == "__main__":
    sys.exit(main())
