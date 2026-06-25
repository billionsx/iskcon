#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Разведчик структуры vrajapedia.com (WordPress, REST API ОТКРЫТ). v2.

Диагностика показала: сырой urllib с раннера дропается (таймаут), а curl --compressed
проходит стабильно (REST отдаёт JSON, сервер Apache, без Cloudflare). Поэтому фетчим
через curl. Используется С РАЗРЕШЕНИЯ команды Sri Rupa Seva Kunj.

Цель — понять КАК отдаётся база мест Враджа: какой custom post type у «мест», какие
таксономии (районы: Говардхан, Вриндаван, Радха-кунда…), сколько всего записей, где
в записи координаты (для карты) и изображения. Результат: tools/vraja/recon.json
(полный дамп) + сводка в D1 deploy_checks (читаю через MCP без доступа к логам Actions).
"""
from __future__ import annotations
import json, os, subprocess, urllib.request

CF   = os.environ.get("CF", "")
ACCT = "d5cbe19470dc38599873eabfe148e6d1"
DB   = "6226aded-dd03-4e74-977f-9cd0b509e73d"
D1   = f"https://api.cloudflare.com/client/v4/accounts/{ACCT}/d1/database/{DB}/query"
BASE = "https://vrajapedia.com/wp-json"
UA   = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"


def d1(sql, params=None):
    body = json.dumps({"sql": sql, "params": params or []}).encode()
    rq = urllib.request.Request(D1, data=body,
                                headers={"Authorization": f"Bearer {CF}", "Content-Type": "application/json"})
    return urllib.request.urlopen(rq, timeout=60).read()


def curl(url):
    """Фетч через curl: %{http_code} (3 цифры) приклеивается в конец stdout; заголовки -> /tmp/h."""
    out = subprocess.run(
        ["curl", "-sS", "-L", "--compressed", "-m", "60", "-A", UA,
         "-H", "Accept: application/json, text/html;q=0.9, */*;q=0.8",
         "-H", "Accept-Language: ru,en;q=0.9",
         "-D", "/tmp/h", "-w", "%{http_code}", url],
        capture_output=True, text=True, timeout=90)
    s = out.stdout or ""
    try:
        status = int(s[-3:])
    except Exception:
        status = 0
    text = s[:-3]
    headers = {}
    try:
        for line in open("/tmp/h", encoding="utf-8", errors="replace").read().splitlines():
            if ":" in line and not line.upper().startswith("HTTP/"):
                k, v = line.split(":", 1)
                headers[k.strip().lower()] = v.strip()
    except Exception:
        pass
    return {"status": status, "headers": headers, "text": text}


def getj(url):
    c = curl(url)
    return json.loads(c["text"]), c["headers"]


rec = {"base": BASE}

# 1) корень REST
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

# 3) таксономии — районы/категории
try:
    j, _ = getj(BASE + "/wp/v2/taxonomies")
    rec["taxonomies"] = {k: {"rest_base": v.get("rest_base"), "name": v.get("name"), "types": v.get("types")}
                         for k, v in j.items()}
except Exception as e:
    rec["taxonomies_err"] = str(e)[:300]
    rec["taxonomies"] = {}

# 4) счётчики по типам + образец записи (поля, acf, координаты, фото, сниппет контента)
rec["type_counts"] = {}
rec["samples"] = {}
for k, v in (rec.get("types") or {}).items():
    rb = v.get("rest_base") or k
    try:
        c = curl(f"{BASE}/wp/v2/{rb}?per_page=3&_embed=1")
        rec["type_counts"][rb] = c["headers"].get("x-wp-total")
        arr = json.loads(c["text"])
        if isinstance(arr, list) and arr:
            it = arr[0]
            s = {"keys": sorted(list(it.keys()))}
            s["id"] = it.get("id"); s["slug"] = it.get("slug"); s["link"] = it.get("link")
            t = it.get("title");   s["title"] = t.get("rendered") if isinstance(t, dict) else t
            cc = it.get("content")
            s["content_len"] = len(cc.get("rendered", "")) if isinstance(cc, dict) else 0
            s["content_snippet"] = cc.get("rendered", "")[:1400] if isinstance(cc, dict) else ""
            s["acf"] = it.get("acf")
            s["meta"] = it.get("meta")
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
        rec["type_counts"][rb] = f"ERR {str(e)[:140]}"

# 5) термины таксономий — районы Враджа
rec["terms"] = {}
for k, v in (rec.get("taxonomies") or {}).items():
    rb = v.get("rest_base") or k
    try:
        terms = []
        for page in range(1, 6):
            c = curl(f"{BASE}/wp/v2/{rb}?per_page=100&page={page}&orderby=count&order=desc")
            arr = json.loads(c["text"])
            if not isinstance(arr, list) or not arr:
                break
            for t in arr:
                terms.append({"id": t.get("id"), "name": t.get("name"), "slug": t.get("slug"),
                              "count": t.get("count"), "parent": t.get("parent")})
            if len(arr) < 100:
                break
        rec["terms"][rb] = terms
    except Exception as e:
        rec["terms"][rb] = f"ERR {str(e)[:140]}"

# дамп
os.makedirs("tools/vraja", exist_ok=True)
open("tools/vraja/recon.json", "w", encoding="utf-8").write(json.dumps(rec, ensure_ascii=False, indent=2))

# сводка в D1
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
        lines.append("  acf=" + json.dumps(s.get("acf"), ensure_ascii=False)[:600])
        lines.append("  geoish=" + json.dumps(s.get("geoish"), ensure_ascii=False)[:220] + " media=" + str(s.get("featured_media_url")))
body = "\n".join(lines)[:5500]
try:
    d1("INSERT INTO deploy_checks (checked_at,target,http_code,body) VALUES (datetime('now'),'vraja-recon DONE',0,?)", [body])
except Exception as e:
    print("D1 write err:", str(e)[:200])
print(body)
