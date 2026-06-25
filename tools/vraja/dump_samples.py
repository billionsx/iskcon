#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Снимаем точную грамматику content.rendered у мест, чтобы написать надёжный парсер.
Берём ~8 разных русских мест (разные районы, разный объём), для каждого:
полный HTML контента + структурный outline (порядок дочерних тегов с классами),
список авторов (<h3 class="book-name">), книг-источников (<p>Из книги …»), чистые фото.
"""
import os, json, re, subprocess, urllib.request

CF   = os.environ.get("CF", "")
ACCT = "d5cbe19470dc38599873eabfe148e6d1"
DB   = "6226aded-dd03-4e74-977f-9cd0b509e73d"
D1   = f"https://api.cloudflare.com/client/v4/accounts/{ACCT}/d1/database/{DB}/query"
BASE = "https://vrajapedia.com/wp-json"
UA   = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

from bs4 import BeautifulSoup

CHROME = re.compile(r'(favicon|frame-\d|frame-1|logo|user-\d|search|close|cross|pavlin|addition-sign|minus-sign|loader|ellipse|/-/empty/|placeholder|sprite|icon)', re.I)


def d1(sql, params=None):
    body = json.dumps({"sql": sql, "params": params or []}).encode()
    rq = urllib.request.Request(D1, data=body, headers={"Authorization": f"Bearer {CF}", "Content-Type": "application/json"})
    return urllib.request.urlopen(rq, timeout=60).read()


def curl(url):
    out = subprocess.run(["curl", "-sS", "-L", "--compressed", "-m", "60", "-A", UA,
                          "-H", "Accept: application/json", "-H", "Accept-Language: ru,en;q=0.9",
                          "-w", "%{http_code}", url], capture_output=True, text=True, timeout=90)
    s = out.stdout or ""
    return s[:-3]


def getposts(cat, n):
    try:
        return json.loads(curl(f"{BASE}/wp/v2/posts?categories={cat}&per_page={n}&_embed=1"))
    except Exception:
        return []


# собрать кандидатов: широкая выборка из 57 + по одному из разных районов
pool = {}
for it in getposts(57, 40):
    pool[it.get("id")] = it
for cat in (86, 59, 1914, 328, 332):  # Вриндаван, Говардхан, Храмы, Радха-кунда, Матхура
    for it in getposts(cat, 3):
        pool.setdefault(it.get("id"), it)

cand = [it for it in pool.values() if len((it.get("content") or {}).get("rendered", "")) > 200]
cand.sort(key=lambda it: len((it.get("content") or {}).get("rendered", "")), reverse=True)
chosen = cand[:8]

samples = []
for it in chosen:
    html = (it.get("content") or {}).get("rendered", "")
    soup = BeautifulSoup(html, "lxml")
    root = soup.body or soup
    outline = []
    for el in root.find_all(True, recursive=True):
        # только «значимые» теги верхнего уровня содержания
        if el.name in ("h1", "h2", "h3", "h4", "p", "img", "ul", "ol", "li", "blockquote", "figure", "figcaption", "table", "iframe", "a"):
            cls = ".".join(el.get("class", []) or [])
            txt = el.get_text(" ", strip=True)[:70] if el.name != "img" else (el.get("src", "")[:80])
            outline.append(f"{el.name}{('.'+cls) if cls else ''}: {txt}")
    authors = [h.get_text(" ", strip=True) for h in root.select("h3.book-name")]
    books = [p.get_text(" ", strip=True) for p in root.find_all("p") if p.get_text(strip=True).startswith(("Из книги", "Из ", "Источник"))]
    imgs = []
    for im in root.find_all("img"):
        src = im.get("src") or ""
        if "/uploads/" in src and not CHROME.search(src):
            imgs.append(src)
    emb = it.get("_embedded") or {}
    fm = emb.get("wp:featuredmedia")
    samples.append({
        "id": it.get("id"), "slug": it.get("slug"), "link": it.get("link"),
        "title": (it.get("title") or {}).get("rendered"),
        "excerpt": re.sub(r"<[^>]+>", "", (it.get("excerpt") or {}).get("rendered", "")).strip()[:300],
        "cats": it.get("categories"), "tags": it.get("tags"),
        "featured": (fm[0].get("source_url") if fm else None),
        "content_imgs": imgs,
        "authors": authors,
        "books": books[:8],
        "outline": outline[:60],
        "content_full": html,
    })

os.makedirs("tools/vraja", exist_ok=True)
open("tools/vraja/samples.json", "w", encoding="utf-8").write(json.dumps(samples, ensure_ascii=False, indent=2))

# сводка в D1: outline + авторы/книги по первым 3
lines = []
lines.append(f"chosen={len(samples)} of pool={len(pool)}")
for s in samples[:4]:
    lines.append(f"--- {s['slug']} (id {s['id']}, cats {s['cats']}) imgs={len(s['content_imgs'])} ---")
    lines.append("  authors=" + json.dumps(s["authors"], ensure_ascii=False)[:300])
    lines.append("  books=" + json.dumps(s["books"], ensure_ascii=False)[:300])
    lines.append("  outline[:18]=" + " | ".join(s["outline"][:18])[:1000])
    lines.append("  featured=" + str(s["featured"]) + " content_imgs=" + json.dumps(s["content_imgs"][:4], ensure_ascii=False)[:300])
body = "\n".join(lines)[:5500]
try:
    d1("INSERT INTO deploy_checks (checked_at,target,http_code,body) VALUES (datetime('now'),'vraja-samples DONE',0,?)", [body])
except Exception as e:
    print("D1 err:", str(e)[:200])
print(body)
