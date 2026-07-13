#!/usr/bin/env python3
"""
СЕТЬ — адаптеры внешних источников (каналы k3, k5, k6, k7).

Каждый пассаж возвращается С ПРОВЕНАНСОМ: url + время + заголовок страницы.
Без провенанса пассаж в досье не попадает (ЗКН-БТ001 — ноль фабрикации).

Адаптеры:
  mediawiki   — /w/api.php: search → extracts (Википедия, Vaniquotes, Vanisource…)
  html        — обычная страница/поиск: теги снимаются, текст остаётся

Источник, который лежит или сменил разметку, НЕ роняет жатву: канал честно
печатается как «не собран» (это и есть механизм ЗКН-П001 — гейт видит дыру).
"""
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

UA = "ISKCON-ONE-LOVE/goldforge (+https://gaurangers.com; BBT-grade research)"
PAUSE = 0.6           # вежливость к чужим серверам
TIMEOUT = 45
MAX_PAGES = 5         # страниц с одного источника на одного героя
MIN_PASSAGE = 400     # короче — не пассаж, а обрывок меню
MIN_HITS = 2          # имя героя должно стоять в тексте, а не в шапке сайта

# Страница результатов поиска, рубрикатор, тег, архив — это НАВИГАЦИЯ сайта,
# а не источник. Первый прогон занёс в карточку «Search results for…» и
# «Audio | Gaudiya History» как свидетельства. Свидетельство — это текст о герое.
JUNK_URL = re.compile(r"[?&]s=|/search|/category/|/tag/|/author/|/page/\d|/feed|/wp-|"
                      r"/comment|/login|/register|/cart|\.xml$", re.I)
JUNK_TITLE = re.compile(r"search results|you searched|результаты поиска|"
                        r"^(audio|bhajans|biographies|videos|books|home)\s*[|·-]", re.I)

SOURCES = Path(__file__).resolve().parent / "sources.json"


def registry():
    return json.loads(SOURCES.read_text(encoding="utf-8"))


def _get(url, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA,
                                                       "Accept-Language": "ru,en;q=0.8"})
            with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
                raw = r.read()
            time.sleep(PAUSE)
            return raw.decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            if e.code in (404, 403):
                return None
        except Exception:                                        # noqa: BLE001
            pass
        time.sleep(1.2 * (i + 1))
    return None


# ── HTML → текст ───────────────────────────────────────────────────────────
DROP = re.compile(r"<(script|style|nav|header|footer|form|noscript)[^>]*>.*?</\1>",
                  re.S | re.I)
TAG = re.compile(r"<[^>]+>")
WS = re.compile(r"[ \t\u00a0]+")


def untag(html):
    s = DROP.sub(" ", html or "")
    s = re.sub(r"<br\s*/?>|</p>|</div>|</li>|</h[1-6]>", "\n", s, flags=re.I)
    s = TAG.sub(" ", s)
    s = (s.replace("&nbsp;", " ").replace("&amp;", "&").replace("&quot;", '"')
          .replace("&#39;", "'").replace("&lt;", "<").replace("&gt;", ">"))
    s = WS.sub(" ", s)
    s = re.sub(r"\n\s*\n\s*\n+", "\n\n", s)
    return s.strip()


# ── MediaWiki ──────────────────────────────────────────────────────────────
def mw_search(base, q, limit=MAX_PAGES):
    api = base.rstrip("/") + "/w/api.php?" + urllib.parse.urlencode({
        "action": "query", "list": "search", "srsearch": q,
        "srlimit": limit, "format": "json", "formatversion": "2"})
    raw = _get(api)
    if not raw:
        return []
    try:
        d = json.loads(raw)
    except Exception:                                            # noqa: BLE001
        return []
    if "error" in d:                       # у части вики поисковый индекс битый
        api = base.rstrip("/") + "/w/api.php?" + urllib.parse.urlencode({
            "action": "opensearch", "search": q, "limit": limit, "format": "json"})
        raw = _get(api)
        try:
            d = json.loads(raw or "[]")
            return list(d[1]) if isinstance(d, list) and len(d) > 1 else []
        except Exception:                                        # noqa: BLE001
            return []
    return [r.get("title") for r in d.get("query", {}).get("search", []) if r.get("title")]


def mw_extract(base, title):
    """Полный текст статьи. Сначала TextExtracts, иначе — сырой wikitext."""
    api = base.rstrip("/") + "/w/api.php?" + urllib.parse.urlencode({
        "action": "query", "prop": "extracts", "explaintext": "1",
        "titles": title, "format": "json", "formatversion": "2"})
    raw = _get(api)
    if raw:
        try:
            pages = json.loads(raw).get("query", {}).get("pages", [])
            for p in pages:
                if p.get("extract"):
                    return p["extract"]
        except Exception:                                        # noqa: BLE001
            pass
    api = base.rstrip("/") + "/index.php?" + urllib.parse.urlencode(
        {"title": title, "action": "raw"})
    raw = _get(api)
    if not raw:
        return None
    txt = re.sub(r"\{\{[^{}]*\}\}", " ", raw)
    txt = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]", r"\1", txt)
    txt = re.sub(r"'{2,}|<ref[^>]*>.*?</ref>|<[^>]+>", "", txt, flags=re.S)
    return WS.sub(" ", txt).strip()


def from_mediawiki(src, names):
    """Вернёт [{title, url, text}] по всем формам имени."""
    base, out, seen = src["base"], [], set()
    for q in names:
        for title in mw_search(base, q):
            if title in seen or len(out) >= MAX_PAGES:
                continue
            seen.add(title)
            body = mw_extract(base, title)
            if body and len(body) >= MIN_PASSAGE and _relevant(title, body, names):
                out.append({
                    "title": title,
                    "url": base.rstrip("/") + "/wiki/" + urllib.parse.quote(title.replace(" ", "_")),
                    "text": body,
                })
    return out


def _relevant(title, body, names):
    """Страница о герое — или просто содержит его имя в подвале?"""
    t, b = (title or "").lower(), (body or "").lower()
    for n in names:
        n = n.lower()
        if n in t:
            return True
        if b.count(n) >= MIN_HITS:
            return True
        first = n.split()[0]
        if len(first) > 4 and b.count(first) >= MIN_HITS + 1:
            return True
    return False


def from_html(src, names):
    """Поиск по сайту (шаблон url с {q}) → страницы результатов + сами страницы."""
    out, seen = [], set()
    for q in names:
        url = src["url"].replace("{q}", urllib.parse.quote(q))
        html = _get(url)
        if not html:
            continue
        host = urllib.parse.urlsplit(url)
        base = "%s://%s" % (host.scheme, host.netloc)
        links = []
        for m in re.finditer(r'href="([^"#?]+)"', html):
            href = m.group(1)
            if href.startswith("/"):
                href = base + href
            if not href.startswith(base) or href in seen:
                continue
            if re.search(r"\.(png|jpg|jpeg|gif|svg|css|js|pdf|zip)$", href, re.I):
                continue
            if JUNK_URL.search(href):
                continue
            links.append(href)
        for href in links[:MAX_PAGES]:
            if href in seen or len(out) >= MAX_PAGES:
                continue
            seen.add(href)
            page = _get(href)
            if not page:
                continue
            body = untag(page)
            if len(body) < MIN_PASSAGE:
                continue
            t = re.search(r"<title[^>]*>(.*?)</title>", page, re.S | re.I)
            title = untag(t.group(1)) if t else href
            if JUNK_TITLE.search(title) or not _relevant(title, body, names):
                continue
            out.append({"title": title, "url": href, "text": body})
    return out


def fetch(src, names):
    kind = src.get("kind")
    if kind == "mediawiki":
        return from_mediawiki(src, names)
    if kind == "html":
        return from_html(src, names)
    return []
