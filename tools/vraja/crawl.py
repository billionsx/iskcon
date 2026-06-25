#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Краулер святых мест Враджа с vrajapedia.com (энциклопедия «Шри Рупа Сева Кундж»,
с разрешения правообладателя) → staging-таблица D1 vraja_raw.

Места = русские WP-посты в категории «Места» (id 57). Текст в content.rendered:
<h3 class="book-name">{Автор}</h3> → <p>Из книги «{Книга}»:</p> → абзацы прозы
(со сносками <span class="footnote" data-footnote-content=…>). Парсим в sources_json.
Фетч через curl. Идемпотентно (upsert по vp_id). Сырой HTML сохраняем.
"""
import os, json, re, subprocess, urllib.request, urllib.error, time, traceback

CF   = os.environ.get("CF", "")
ACCT = "d5cbe19470dc38599873eabfe148e6d1"
DB   = "6226aded-dd03-4e74-977f-9cd0b509e73d"
D1   = f"https://api.cloudflare.com/client/v4/accounts/{ACCT}/d1/database/{DB}/query"
BASE = "https://vrajapedia.com/wp-json"
UA   = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
PLACES_CAT = 57

from bs4 import BeautifulSoup

CHROME = re.compile(r'(favicon|frame-\d|/frame-1|logo\b|user-\d|/search|/close|/cross|pavlin|addition-sign|minus-sign|loader|ellipse|/-/empty/|placeholder|sprite|/icon)', re.I)


def d1(sql, params=None):
    body = json.dumps({"sql": sql, "params": params or []}).encode()
    rq = urllib.request.Request(D1, data=body, headers={"Authorization": f"Bearer {CF}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(rq, timeout=120) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        det = ""
        try:
            det = e.read().decode("utf-8", "replace")[:400]
        except Exception:
            pass
        raise RuntimeError(f"D1 HTTP {e.code}: {det}")


def curl(url, tries=3):
    last = ""
    for _ in range(tries):
        out = subprocess.run(["curl", "-sS", "-L", "--compressed", "-m", "70", "-A", UA,
                              "-H", "Accept: application/json", "-H", "Accept-Language: ru,en;q=0.9",
                              "-w", "%{http_code}", url], capture_output=True, text=True, timeout=120)
        s = out.stdout or ""
        try:
            code = int(s[-3:])
        except Exception:
            code = 0
        if code == 200:
            return s[:-3]
        last = (s[-3:] if s else "000") + " " + (out.stderr or "")[:80]
        time.sleep(2)
    print("curl fail", url, last)
    return ""


def clean_text(node):
    """Текст узла: видимое слово сноски сохраняем, контент сноски собираем отдельно."""
    foots = []
    work = BeautifulSoup(str(node), "lxml")
    for sp in work.select("span.footnote"):
        num = sp.get("data-footnote-number") or ""
        txt = sp.get("data-footnote-content") or ""
        if txt:
            foots.append({"n": num, "text": txt.strip()})
        sp.replace_with(sp.get_text(" "))
    t = re.sub(r"\s+", " ", work.get_text(" ")).strip()
    return t, foots


BOOK_RE = re.compile(r"«([^»]+)»")
SRC_PREFIX = ("Из книги", "Из ", "Источник", "Из лекции", "Из писем", "Из комментар")


def parse_sources(html):
    soup = BeautifulSoup(html or "", "lxml")
    root = soup.body or soup
    blocks = []
    cur = {"_ptr": None}

    def newblock(author=None):
        b = {"author": author, "book": None, "paragraphs": [], "footnotes": []}
        blocks.append(b)
        cur["_ptr"] = b

    for el in root.find_all(["h2", "h3", "h4", "p", "ul", "ol", "blockquote"], recursive=True):
        cls = " ".join(el.get("class", []) or [])
        if el.name == "h3" and "book-name" in cls:
            newblock(el.get_text(" ", strip=True))
            continue
        if cur["_ptr"] is None:
            newblock(None)
        b = cur["_ptr"]
        if el.name == "p":
            raw = el.get_text(" ", strip=True)
            if not raw:
                continue
            if b["book"] is None and raw.startswith(SRC_PREFIX):
                m = BOOK_RE.search(raw)
                b["book"] = (m.group(1).strip() if m else raw.replace("Из книги", "").strip(" :«»"))
                continue
            t, foots = clean_text(el)
            if t:
                b["paragraphs"].append(t)
                b["footnotes"].extend(foots)
        elif el.name in ("ul", "ol"):
            for li in el.find_all("li", recursive=False):
                t, foots = clean_text(li)
                if t:
                    b["paragraphs"].append("• " + t)
                    b["footnotes"].extend(foots)
        elif el.name == "blockquote":
            t, foots = clean_text(el)
            if t:
                b["paragraphs"].append(t)
                b["footnotes"].extend(foots)
        elif el.name in ("h2", "h4"):
            t = el.get_text(" ", strip=True)
            if t:
                b["paragraphs"].append("## " + t)
    return [b for b in blocks if b["paragraphs"]]


def make_about(blocks, limit=600):
    if not blocks:
        return ""
    paras = [p for p in blocks[0]["paragraphs"] if not p.startswith(("##", "•"))] or blocks[0]["paragraphs"]
    txt = " ".join(paras)
    if len(txt) <= limit:
        return txt
    cut = txt[:limit]
    dot = max(cut.rfind(". "), cut.rfind("! "), cut.rfind("? "))
    return (cut[:dot + 1] if dot > 200 else cut).strip()


def guess_kind(title):
    t = (title or "").lower()
    if any(w in t for w in ("кунда", "кунд", "саровар", "пушкар")): return "kunda"
    if "гхат" in t: return "ghat"
    if any(w in t for w in ("мандир", "храм", "девалай")): return "temple"
    if any(w in t for w in ("тила", "адитья-тила")): return "hill"
    if any(w in t for w in ("самадхи", "бхаджан-кутир", "пушпа-самадхи")): return "samadhi"
    if any(w in t for w in ("шила", "паттхар")): return "place"
    if any(w in t for w in ("сангам", "ямуна", "манаси-ганга")): return "river"
    if any(w in t for w in ("гаон", "грама", "деревня", "нагар")): return "village"
    if any(w in t for w in ("ван", "роща", "вана")): return "forest"
    return "place"


def strip_tags(html):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html or "")).strip()


COLS = ["vp_id", "slug", "title", "region_cats", "primary_cat", "link", "modified", "excerpt",
        "featured_url", "gallery", "content_html", "sources_json", "about", "text_plain", "kind_guess", "crawled_at"]
UPD = [c for c in COLS if c != "vp_id"]
ERRORS = []


def insert_rows(rows):
    if not rows:
        return
    ph = ",".join("(" + ",".join(["?"] * len(COLS)) + ")" for _ in rows)
    sql = f"INSERT INTO vraja_raw ({','.join(COLS)}) VALUES {ph} ON CONFLICT(vp_id) DO UPDATE SET " + ",".join(f"{c}=excluded.{c}" for c in UPD)
    params = []
    for row in rows:
        params.extend(row[c] for c in COLS)
    d1(sql, params)


def flush(batch):
    if not batch:
        return
    try:
        insert_rows(batch)
    except Exception as e:
        # построчный фолбэк — не теряем батч из-за одной плохой строки/лимита
        for row in batch:
            try:
                insert_rows([row])
            except Exception as e2:
                ERRORS.append(f"vp{row.get('vp_id')}: {str(e2)[:160]}")


def main():
    total = 0
    authors, books, regions = {}, {}, {}
    batch = []
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    for page in range(1, 12):
        txt = curl(f"{BASE}/wp/v2/posts?categories={PLACES_CAT}&per_page=100&page={page}&_embed=1&orderby=id&order=asc")
        if not txt:
            break
        try:
            arr = json.loads(txt)
        except Exception as e:
            ERRORS.append(f"page{page} json: {str(e)[:120]}")
            break
        if not isinstance(arr, list) or not arr:
            break
        for it in arr:
            try:
                vid = it.get("id")
                cats = it.get("categories") or []
                regs = [c for c in cats if c != PLACES_CAT]
                geo = [c for c in regs if c not in (1914, 8)]
                primary = (geo[0] if geo else (regs[0] if regs else None))
                for c in regs:
                    regions[c] = regions.get(c, 0) + 1
                title = strip_tags((it.get("title") or {}).get("rendered", ""))
                html = (it.get("content") or {}).get("rendered", "") or ""
                blocks = parse_sources(html)
                for b in blocks:
                    if b["author"]:
                        authors[b["author"]] = authors.get(b["author"], 0) + 1
                    if b["book"]:
                        books[b["book"]] = books.get(b["book"], 0) + 1
                emb = it.get("_embedded") or {}
                fm = emb.get("wp:featuredmedia")
                featured = None
                if fm and isinstance(fm, list) and fm and isinstance(fm[0], dict):
                    su = fm[0].get("source_url")
                    if su and not CHROME.search(su):
                        featured = su
                gal = sorted(set(u for u in re.findall(r'https://vrajapedia\.com/wp-content/uploads/[^\s"\'<>)]+\.(?:jpe?g|png|webp|gif)', html, re.I) if not CHROME.search(u)))
                text_plain = " ".join(p for b in blocks for p in b["paragraphs"])
                row = {
                    "vp_id": vid, "slug": it.get("slug"), "title": title,
                    "region_cats": json.dumps(regs), "primary_cat": primary,
                    "link": it.get("link"), "modified": it.get("modified"),
                    "excerpt": strip_tags((it.get("excerpt") or {}).get("rendered", ""))[:600],
                    "featured_url": featured, "gallery": (json.dumps(gal) if gal else None),
                    "content_html": html[:60000], "sources_json": json.dumps(blocks, ensure_ascii=False),
                    "about": make_about(blocks), "text_plain": text_plain[:6000],
                    "kind_guess": guess_kind(title), "crawled_at": now,
                }
                batch.append(row)
                total += 1
                if len(batch) >= 8:
                    flush(batch); batch = []
            except Exception as ep:
                ERRORS.append(f"post{it.get('id')}: {str(ep)[:160]}")
        time.sleep(0.5)
    flush(batch)

    cnt = d1("SELECT COUNT(*) c, SUM(featured_url IS NOT NULL) f, SUM(LENGTH(about)>0) a FROM vraja_raw")["result"][0]["results"][0]
    top_books = sorted(books.items(), key=lambda x: -x[1])[:14]
    top_auth = sorted(authors.items(), key=lambda x: -x[1])[:14]
    top_reg = sorted(regions.items(), key=lambda x: -x[1])
    lines = [
        f"crawled={total} | vraja_raw count={cnt.get('c')} with_featured={cnt.get('f')} with_about={cnt.get('a')} | errors={len(ERRORS)}",
        "authors: " + ", ".join(f"{a}#{n}" for a, n in top_auth),
        "books: " + ", ".join(f"«{b}»#{n}" for b, n in top_books),
        "region_cat_counts: " + ", ".join(f"{c}:{n}" for c, n in top_reg),
    ]
    if ERRORS:
        lines.append("ERR sample: " + " || ".join(ERRORS[:6]))
    body = "\n".join(lines)[:5500]
    d1("INSERT INTO deploy_checks (checked_at,target,http_code,body) VALUES (datetime('now'),'vraja-crawl DONE',0,?)", [body])
    print(body)


try:
    main()
except Exception:
    tb = traceback.format_exc()[-1500:]
    try:
        d1("INSERT INTO deploy_checks (checked_at,target,http_code,body) VALUES (datetime('now'),'vraja-crawl ERROR',0,?)", [tb])
    except Exception as e:
        print("could not log err:", str(e)[:160])
    print("FATAL:\n", tb)
    raise
