#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Глубокий зонд vrajapedia: где у мест ТЕКСТ, КООРДИНАТЫ, ГАЛЕРЕЯ.
Установлено: content.rendered пуст, acf=[], meta={footnotes}. Сайт на Pods+Elementor.
Проверяем три источника: (1) Pods REST поля, (2) полный сырой JSON поста (скрытые поля),
(3) HTML страницы (Elementor рендерит текст/фото/карту только там) — детектируем координаты.
"""
import os, json, re, subprocess, urllib.request

CF   = os.environ.get("CF", "")
ACCT = "d5cbe19470dc38599873eabfe148e6d1"
DB   = "6226aded-dd03-4e74-977f-9cd0b509e73d"
D1   = f"https://api.cloudflare.com/client/v4/accounts/{ACCT}/d1/database/{DB}/query"
BASE = "https://vrajapedia.com/wp-json"
UA   = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

try:
    from bs4 import BeautifulSoup
    HAVE_BS4 = True
except Exception:
    HAVE_BS4 = False


def d1(sql, params=None):
    body = json.dumps({"sql": sql, "params": params or []}).encode()
    rq = urllib.request.Request(D1, data=body,
                                headers={"Authorization": f"Bearer {CF}", "Content-Type": "application/json"})
    return urllib.request.urlopen(rq, timeout=60).read()


def curl(url):
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
    return {"status": status, "text": s[:-3]}


def truncval(v, n=200):
    s = v if isinstance(v, str) else json.dumps(v, ensure_ascii=False)
    return s[:n] + ("…" if len(s) > n else "")


deep = {}

# ---------- 1) Pods ----------
deep["pods"] = {}
c = curl(BASE + "/pods/v1/pods")
deep["pods"]["list_status"] = c["status"]
deep["pods"]["list_snip"] = c["text"][:1200]
pod_slugs = []
try:
    pj = json.loads(c["text"])
    container = pj.get("pods") if isinstance(pj, dict) else pj
    if isinstance(container, list):
        for p in container:
            pod_slugs.append(p.get("name") or p.get("slug"))
    elif isinstance(container, dict):
        pod_slugs = list(container.keys())
except Exception as e:
    deep["pods"]["list_err"] = str(e)[:160]
deep["pods"]["slugs"] = pod_slugs
# попробуем поля для post и любых подоподобных «мест»
for slug in (["post"] + [s for s in pod_slugs if s] )[:6]:
    cc = curl(f"{BASE}/pods/v1/pods/{slug}")
    entry = {"status": cc["status"]}
    try:
        pjj = json.loads(cc["text"])
        fields = pjj.get("fields") or (pjj.get("pod") or {}).get("fields")
        if isinstance(fields, dict):
            entry["fields"] = {fn: (fv.get("type") if isinstance(fv, dict) else str(fv)) for fn, fv in fields.items()}
        elif isinstance(fields, list):
            entry["fields"] = {f.get("name"): f.get("type") for f in fields}
        else:
            entry["snip"] = cc["text"][:400]
    except Exception as e:
        entry["err"] = str(e)[:120]; entry["snip"] = cc["text"][:200]
    deep["pods"][f"pod:{slug}"] = entry

# ---------- 2) богатое русское место (cat 57) ----------
c = curl(f"{BASE}/wp/v2/posts?categories=57&per_page=12&_embed=1")
arr = []
try:
    arr = json.loads(c["text"])
except Exception as e:
    deep["ru_list_err"] = str(e)[:160]
deep["ru_list"] = []
for it in (arr if isinstance(arr, list) else []):
    emb = it.get("_embedded") or {}
    fm = emb.get("wp:featuredmedia")
    deep["ru_list"].append({
        "id": it.get("id"), "slug": it.get("slug"), "link": it.get("link"),
        "title": (it.get("title") or {}).get("rendered"),
        "clen": len((it.get("content") or {}).get("rendered", "")),
        "elen": len((it.get("excerpt") or {}).get("rendered", "")),
        "featured": (fm[0].get("source_url") if fm else None),
        "cats": it.get("categories"),
    })

# выбрать запись с непустым content, иначе первую с featured, иначе первую
target = None
if isinstance(arr, list) and arr:
    by_clen = sorted(arr, key=lambda it: len((it.get("content") or {}).get("rendered", "")), reverse=True)
    target = by_clen[0]
deep["target_full"] = {}
if target:
    full = {}
    for k, v in target.items():
        if k in ("_embedded", "_links", "yoast_head", "yoast_head_json", "class_list"):
            continue
        full[k] = truncval(v, 240)
    deep["target_full"] = full
    deep["target_id"] = target.get("id")
    deep["target_link"] = target.get("link")

    # ---------- 3) HTML страницы ----------
    link = target.get("link")
    if link:
        h = curl(link)
        html = h["text"] or ""
        deep["html_status"] = h["status"]
        deep["html_len"] = len(html)

        # координаты — широкая детекция
        coords = {}
        coords["data_lat"]   = re.findall(r'data-lat(?:itude)?=["\']?(-?\d{1,2}\.\d{3,})', html, re.I)[:6]
        coords["data_lng"]   = re.findall(r'data-(?:lng|lon|longitude)=["\']?(-?\d{1,3}\.\d{3,})', html, re.I)[:6]
        coords["json_latlng"] = re.findall(r'"lat(?:itude)?"\s*:\s*"?(-?\d{1,2}\.\d+)"?\s*,\s*"(?:lng|lon|longitude)"\s*:\s*"?(-?\d{1,3}\.\d+)', html, re.I)[:6]
        coords["latlng_func"] = re.findall(r'LatLng\(\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)', html)[:6]
        coords["pair"]       = re.findall(r'\b(2[0-9]\.\d{3,})\s*,\s*(7[0-9]\.\d{3,})\b', html)[:6]  # Враджа ~27N,77E
        coords["gmaps_iframe"] = re.findall(r'<iframe[^>]+src=["\']([^"\']*(?:google\.[a-z.]+/maps|maps\.google|openstreetmap|api-maps\.yandex)[^"\']*)', html, re.I)[:4]
        coords["gmaps_link"]   = re.findall(r'(https?://(?:www\.)?(?:google\.[a-z.]+/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl)/[^"\'\s<>]+)', html, re.I)[:4]
        deep["coords"] = coords

        # галерея
        imgs = sorted(set(re.findall(r'https://vrajapedia\.com/wp-content/uploads/[^\s"\'<>)]+\.(?:jpe?g|png|webp|gif)', html, re.I)))
        deep["img_count"] = len(imgs)
        deep["img_sample"] = imgs[:8]

        # текст
        if HAVE_BS4:
            soup = BeautifulSoup(html, "lxml")
            for tag in soup(["script", "style", "noscript"]):
                tag.decompose()
            txt = re.sub(r"\s+", " ", soup.get_text(" ")).strip()
        else:
            ns = re.sub(r'<(script|style|noscript)[^>]*>.*?</\1>', ' ', html, flags=re.I | re.S)
            txt = re.sub(r"\s+", " ", re.sub(r'<[^>]+>', ' ', ns)).strip()
        deep["text_total_len"] = len(txt)
        deep["text_cyr_len"] = len(re.findall(r'[А-Яа-яЁё]', txt))
        m = re.search(r'[А-Яа-яЁё][А-Яа-яЁё ,.\-]{120,}', txt)
        deep["text_snippet"] = (m.group(0)[:400] if m else txt[:300])

# ---------- 4) sitemap ----------
deep["sitemaps"] = {}
c = curl("https://vrajapedia.com/sitemap_index.xml")
deep["sitemaps"]["index_status"] = c["status"]
subs = re.findall(r'<loc>([^<]+)</loc>', c["text"] or "")
deep["sitemaps"]["subs"] = subs[:30]

# ---------- write ----------
os.makedirs("tools/vraja", exist_ok=True)
open("tools/vraja/deep.json", "w", encoding="utf-8").write(json.dumps(deep, ensure_ascii=False, indent=2))

lines = []
lines.append(f"pods list_status={deep['pods'].get('list_status')} slugs={deep['pods'].get('slugs')}")
for k, v in deep["pods"].items():
    if k.startswith("pod:"):
        lines.append(f"  {k} status={v.get('status')} fields={truncval(v.get('fields'),400)}")
lines.append(f"ru_list ({len(deep.get('ru_list',[]))}): " + ", ".join(f"{p['slug']}(c{p['clen']})" for p in deep.get("ru_list", [])[:12]))
lines.append(f"target id={deep.get('target_id')} link={deep.get('target_link')}")
lines.append(f"target_full keys+vals: " + truncval(deep.get("target_full"), 900))
lines.append(f"HTML status={deep.get('html_status')} len={deep.get('html_len')} imgs={deep.get('img_count')} text_cyr={deep.get('text_cyr_len')}")
lines.append(f"coords={json.dumps(deep.get('coords'), ensure_ascii=False)[:700]}")
lines.append(f"img_sample={deep.get('img_sample')}")
lines.append(f"text_snippet={deep.get('text_snippet')}")
lines.append(f"sitemaps={deep['sitemaps'].get('subs')}")
body = "\n".join(lines)[:5500]
try:
    d1("INSERT INTO deploy_checks (checked_at,target,http_code,body) VALUES (datetime('now'),'vraja-deep DONE',0,?)", [body])
except Exception as e:
    print("D1 write err:", str(e)[:200])
print(body)
