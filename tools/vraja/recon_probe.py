#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Разведчик структуры vrajapedia.com (WordPress 6.5, REST API).

Цель: до постройки настоящего краулера понять, КАК отдаётся база мест Враджа —
какой custom post type у «мест», какие таксономии (районы: Говардхан, Вриндаван,
Радха-кунда…), сколько всего записей, и где в записи лежат координаты (для карты)
и изображения. Используется С РАЗРЕШЕНИЯ команды Sri Rupa Seva Kunj.

Сеть нужна только на раннере GitHub Actions (песочница до vrajapedia не достаёт).
Результат: tools/vraja/recon.json (полный дамп) + компактная сводка в D1
deploy_checks (читается через MCP без доступа к логам Actions).
"""
from __future__ import annotations
import json, os, urllib.request, urllib.parse

CF   = os.environ.get("CF", "")
ACCT = "d5cbe19470dc38599873eabfe148e6d1"
DB   = "6226aded-dd03-4e74-977f-9cd0b509e73d"
D1   = f"https://api.cloudflare.com/client/v4/accounts/{ACCT}/d1/database/{DB}/query"
BASE = "https://vrajapedia.com/wp-json"
UA   = "gaurangers-vraja-sync/1.0 (ISKCON ONE LOVE; by permission of Sri Rupa Seva Kunj; ceo@billionsx.com)"


def d1(sql, params=None):
    body = json.dumps({"sql": sql, "params": params or []}).encode()
    rq = urllib.request.Request(D1, data=body,
                                headers={"Authorization": f"Bearer {CF}", "Content-Type": "application/json"})
    return urllib.request.urlopen(rq, timeout=60).read()


def http(url):
    rq = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    r = urllib.request.urlopen(rq, timeout=60)
    return r, r.read()


def getj(url):
    r, b = http(url)
    return json.loads(b.decode("utf-8", "replace")), {k.lower(): v for k, v in dict(r.headers).items()}


rec = {"base": BASE}

# 1) корень REST — есть ли API, какие namespace/routes
try:
    j, _ = getj(BASE + "/")
    rec["namespaces"] = j.get("namespaces")
    rec["routes"] = sorted(list((j.get("routes") or {}).keys()))
except Exception as e:
    rec["root_err"] = str(e)[:300]

# 2) типы постов — ищем CPT «мест»
try:
    j, _ = getj(BASE + "/wp/v2/types")
    rec["types"] = {k: {"rest_base": v.get("rest_base"), "name": v.get("name"), "slug": v.get("slug")}
                    for k, v in j.items()}
except Exception as e:
    rec["types_err"] = str(e)[:300]
    rec["types"] = {}

# 3) таксономии — районы/категории мест
try:
    j, _ = getj(BASE + "/wp/v2/taxonomies")
    rec["taxonomies"] = {k: {"rest_base": v.get("rest_base"), "name": v.get("name"), "types": v.get("types")}
                         for k, v in j.items()}
except Exception as e:
    rec["taxonomies_err"] = str(e)[:300]
    rec["taxonomies"] = {}

# 4) счётчики по каждому типу + образец записи (поля, acf, координаты, фото)
rec["type_counts"] = {}
rec["samples"] = {}
for k, v in (rec.get("types") or {}).items():
    rb = v.get("rest_base") or k
    try:
        r, b = http(f"{BASE}/wp/v2/{rb}?per_page=3&_embed=1")
        hdr = {kk.lower(): vv for kk, vv in dict(r.headers).items()}
        rec["type_counts"][rb] = hdr.get("x-wp-total")
        arr = json.loads(b.decode("utf-8", "replace"))
        if isinstance(arr, list) and arr:
            it = arr[0]
            s = {"keys": sorted(list(it.keys()))}
            s["id"] = it.get("id"); s["slug"] = it.get("slug"); s["link"] = it.get("link")
            t = it.get("title");   s["title"] = t.get("rendered") if isinstance(t, dict) else t
            c = it.get("content"); s["content_len"] = len(c.get("rendered", "")) if isinstance(c, dict) else 0
            s["acf"] = it.get("acf")
            s["meta"] = it.get("meta")
            # любые «гео»-ключи на верхнем уровне записи
            s["geoish"] = {kk: it.get(kk) for kk in it.keys()
                           if any(x in str(kk).lower() for x in ("lat", "lng", "lon", "geo", "coord", "map", "loc"))}
            emb = it.get("_embedded") or {}
            fm = emb.get("wp:featuredmedia")
            if fm:
                s["featured_media_url"] = (fm[0] or {}).get("source_url")
            tm = emb.get("wp:term")
            if tm:
                s["terms"] = [[{"tax": t2.get("taxonomy"), "name": t2.get("name"), "slug": t2.get("slug")}
                               for t2 in g] for g in tm]
            rec["samples"][rb] = s
    except Exception as e:
        rec["type_counts"][rb] = f"ERR {str(e)[:120]}"

# 5) термины таксономий — это районы Враджа (мапим в наши кластеры)
rec["terms"] = {}
for k, v in (rec.get("taxonomies") or {}).items():
    rb = v.get("rest_base") or k
    try:
        terms = []
        for page in range(1, 6):
            r, b = http(f"{BASE}/wp/v2/{rb}?per_page=100&page={page}&orderby=count&order=desc")
            arr = json.loads(b.decode("utf-8", "replace"))
            if not isinstance(arr, list) or not arr:
                break
            for t in arr:
                terms.append({"id": t.get("id"), "name": t.get("name"), "slug": t.get("slug"),
                              "count": t.get("count"), "parent": t.get("parent")})
            if len(arr) < 100:
                break
        rec["terms"][rb] = terms
    except Exception as e:
        rec["terms"][rb] = f"ERR {str(e)[:120]}"

# дамп
os.makedirs("tools/vraja", exist_ok=True)
open("tools/vraja/recon.json", "w", encoding="utf-8").write(json.dumps(rec, ensure_ascii=False, indent=2))

# компактная сводка → D1 (читаю через MCP)
lines = []
lines.append("ns=" + str(rec.get("namespaces")))
lines.append("type_counts: " + ", ".join(f"{rb}={rec['type_counts'].get(rb)}" for rb in (rec.get("type_counts") or {})))
lines.append("taxonomies: " + ", ".join((rec.get("taxonomies") or {}).keys()))
for rb, terms in (rec.get("terms") or {}).items():
    if isinstance(terms, list) and terms:
        lines.append(f"tax[{rb}] {len(terms)}: " + ", ".join(f"{t['name']}#{t['count']}" for t in terms[:30]))
for rb, s in (rec.get("samples") or {}).items():
    if isinstance(s, dict):
        lines.append(f"sample[{rb}] id={s.get('id')} slug={s.get('slug')} clen={s.get('content_len')} keys={s.get('keys')}")
        lines.append("  acf=" + json.dumps(s.get("acf"), ensure_ascii=False)[:450])
        lines.append("  geoish=" + json.dumps(s.get("geoish"), ensure_ascii=False)[:220] + " media=" + str(s.get("featured_media_url")))
body = "\n".join(lines)[:4500]
try:
    d1("INSERT INTO deploy_checks (checked_at,target,http_code,body) VALUES (datetime('now'),'vraja-recon DONE',0,?)", [body])
except Exception as e:
    print("D1 write err:", str(e)[:200])
print(body)
