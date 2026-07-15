#!/usr/bin/env python3
"""
Новости ИСККОН → RU. Единый парсер для НЕСКОЛЬКИХ официальных источников.

Реестр источников (`SOURCES`) — добавить сайт = одна запись в списке, не новый скрипт
(ЗКН-Пл019 «источник — это конфиг, а не код»). Сейчас три источника:
  • iskconnews.org — официальное новостное агентство ИСККОН (WordPress REST);
  • dandavats.com  — новостная сеть преданных (WordPress REST; видео-репосты отсеиваем);
  • iskcon.org     — сайт всемирного общества и GBC (WordPress REST; институциональный,
                     новостей мало — берём что есть).

Метод забора на источник: сперва WordPress REST API (/wp-json/wp/v2/posts?_embed —
самый богатый: заголовок, тело, автор, hero, категория, дата). Если у сайта REST
закрыт — откат на RSS/Atom (title, ссылка, дата, тело из content:encoded).

Конвейер (идемпотентный, общий для всех источников):
  1. Тянем последние статьи источника.
  2. guid = "<short>:<id>" — уже загруженное ПРОПУСКАЕМ (дедуп по D1, ЗКН-Пл006).
  3. Переводим заголовок + тело на русский через Claude с BBT-точностью
     (глоссарий канонических имён; НОЛЬ фабрикации). Отдельно — короткий лид.
  4. Пишем в D1 (news_posts) параметризованно (ЗКН-П002). Слаг — с префиксом источника
     (`<short>-<slug>`), чтобы слаги двух сайтов не сталкивались.

Запуск (CI и локально одинаково):
  python3 tools/news/iskcon_news.py --limit 12 --pages 1
  python3 tools/news/iskcon_news.py --source iskconnews --limit 20
  python3 tools/news/iskcon_news.py --selftest        # юнит чистых функций, без сети/ключей
Переменные: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, ANTHROPIC_API_KEY.

ЗКН-Ф014: скрипт говорит, ЧТО именно сломалось, а не «exit 1».
ЗКН-Пл006: источник важнее метода — переводим РЕАЛЬНЫЙ материал сайтов, ничего не досочиняя.
"""
import argparse
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET

# d1-клиент лежит в goldforge — переиспользуем (CF HTTP API, bearer-токен).
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "goldforge"))
import d1  # noqa: E402

ANTHROPIC = "https://api.anthropic.com/v1/messages"
MODEL = os.environ.get("NEWS_MODEL", "claude-sonnet-5")
UA = "ISKCON-ONE-LOVE-News/1.0 (+https://gaurangers.com)"

# Категории iskconnews.org → русские ярлыки (берём самый конкретный термин статьи).
CAT_RU = {
    "north-america": "Северная Америка", "latin-america": "Латинская Америка",
    "europe": "Европа", "asia": "Азия", "australasia": "Австралазия",
    "middle-east": "Ближний Восток", "africa": "Африка", "news": "Новости",
    "outreach-activism": "Проповедь и служение", "food-relief": "Раздача прасада",
    "book-distribution": "Распространение книг", "environment": "Экология",
    "interfaith": "Межконфессиональный диалог", "communications-ministry": "Служение общения",
    "college": "Проповедь в вузах", "congregational-development": "Развитие общин",
    "people": "Личности", "profiles": "Портреты", "obituaries": "Уход",
    "youth": "Молодёжь", "lifestyle": "Образ жизни", "health-wellness": "Здоровье",
    "family-relationships": "Семья и отношения", "fashion": "Стиль", "work": "Труд и служение",
    "arts": "Искусство", "music": "Музыка", "performing-arts": "Сценическое искусство",
    "fine-arts": "Изобразительное искусство", "film": "Кино", "opinion": "Мнение",
    "video": "Видео", "announcements": "Объявления", "announcement": "Объявления",
    "festivals": "Праздники", "festival": "Праздники", "events": "События",
}

SYSTEM = """Ты — переводчик новостной ленты ISKCON ONE LOVE. Переводишь официальные новости ИСККОН с английского на русский для преданных, читающих на русском.

ЖЕЛЕЗНЫЕ ПРАВИЛА (нарушение = брак):
1. НОЛЬ ФАБРИКАЦИИ. Переводишь только то, что есть в исходном тексте. Ни одного имени, числа, даты, места, которых нет в оригинале. Не понял фразу — переведи буквально по смыслу, не выдумывай.
2. Естественный, живой русский — как в качественном издании. Не калька, не подстрочник. Сохраняй абзацную структуру: сколько дал абзацев на входе, столько верни на выходе, в том же порядке и смысле.
3. КАНОНИЧЕСКИЕ ИМЕНА (обязательны):
   • Господь: «Гауранга Махапрабху» (Навадвипа/общее) или «Шри Кришна Чайтанья Махапрабху» (санньяса/Пури). Голого «Чайтанья» не пиши.
   • «Шримати Радхарани», «Шрила Прабхупада», «Шри Кришна», «Господь Джаганнатха», «Господь Нрисимхадев», «Радха-Мадхава».
   • Основатель-ачарья — «Его Божественная Милость А. Ч. Бхактиведанта Свами Прабхупада».
4. Санскритские и вайшнавские имена и термины передавай русской транслитерацией по принятому в гаудия-вайшнавизме написанию: Das → дас, Devi Dasi → деви даси, Swami → Свами, Prabhu → Прабху, Ratha-yatra → Ратха-ятра, prasadam → прасад, harinama → харинама, Bhagavad-gita → «Бхагавад-гита», Srimad Bhagavatam → «Шримад-Бхагаватам», sankirtana → санкиртана, brahmachari → брахмачари, japa → джапа. Названия храмов и городов — по устоявшемуся русскому написанию (Маяпур, Вриндаван, Бхактиведанта Мэнор).
5. Никаких точек с запятой «;» и никаких прямых апострофов. Кавычки — «ёлочки».
6. Тон нейтральный, уважительный. Без отсебятины, лозунгов и оценок сверх оригинала.

ФОРМАТ ОТВЕТА — ЧИСТЫЙ JSON, без markdown и пояснений:
{"title": "переведённый заголовок", "author": "переведённая/транслитерированная подпись автора", "lead": "короткая версия 2–3 предложения, суть новости своими словами по фактам из текста", "body": ["абзац 1", "абзац 2", ...]}"""


# ─────────────────────────── HTTP ───────────────────────────

def _get_json(url, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            body = ""
            try:
                body = e.read().decode("utf-8", "replace")
            except Exception:  # noqa: BLE001
                pass
            if e.code == 400 and "rest_post_invalid_page_number" in body:
                return []  # страниц больше нет — норма
            if e.code in (401, 403, 404):
                return None  # REST закрыт/нет — сигнал на откат к RSS
            last = "HTTP %s" % e.code
        except Exception as e:  # noqa: BLE001
            last = str(e)[:160]
        time.sleep(1.5 * (i + 1))
    raise SystemExit("::error title=REST::%s — %s" % (last, url))


def _get_text(url, tries=4):
    last = ""
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/rss+xml, application/xml, text/xml"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            last = "HTTP %s — %s" % (e.code, e.read().decode("utf-8", "replace")[:160])
        except Exception as e:  # noqa: BLE001
            last = str(e)[:160]
        time.sleep(1.5 * (i + 1))
    raise SystemExit("::error title=RSS::%s — %s" % (last, url))


# ─────────────────────── разбор HTML/тела ───────────────────────

def _strip_tags(s):
    return re.sub(r"<[^>]+>", "", s or "")


def clean_body(rendered):
    """content.rendered (HTML) → список чистых абзацев по порядку."""
    paras = []
    for tag, inner in re.findall(r"<(p|h2|h3|h4|blockquote|li)\b[^>]*>(.*?)</\1>", rendered or "", re.S | re.I):
        txt = html.unescape(_strip_tags(inner)).replace("\xa0", " ").strip()
        txt = re.sub(r"\s+", " ", txt)
        if len(txt) < 2:
            continue
        low = txt.lower()
        if low.startswith(("tags:", "share this", "read more", "the post ", "source:", "photo:", "photos:", "image:", "channel:")):
            continue
        if tag.lower() == "li":
            txt = "— " + txt
        paras.append(txt)
    return paras


def hero_of(post):
    try:
        media = post.get("_embedded", {}).get("wp:featuredmedia", [])
        if media and isinstance(media, list):
            u = media[0].get("source_url")
            if u:
                return u
    except Exception:  # noqa: BLE001
        pass
    m = re.search(r'<img[^>]+src="([^"]+)"', post.get("content", {}).get("rendered", ""))
    return m.group(1) if m else None


def author_of(post):
    try:
        a = post.get("_embedded", {}).get("author", [])
        if a and a[0].get("name"):
            return a[0]["name"]
    except Exception:  # noqa: BLE001
        pass
    return None


def category_of(post):
    """Самый конкретный (глубокий) термин из wp:term → русский ярлык."""
    best = None
    try:
        groups = post.get("_embedded", {}).get("wp:term", [])
        for grp in groups:
            for t in grp:
                if t.get("taxonomy") != "category":
                    continue
                slug = t.get("slug", "")
                if slug in CAT_RU and (slug != "news" or best is None):
                    best = CAT_RU[slug]
    except Exception:  # noqa: BLE001
        pass
    return best or "Новости"


def _iso(date_gmt):
    s = (date_gmt or "").strip()
    if not s:
        return ""
    s = s.replace(" ", "T")
    return s if s.endswith("Z") else s + "Z"


# ─────────────────────── фильтры источников ───────────────────────

# dandavats.com репостит массу лекций с YouTube (SB/BG-классы): заголовки вида
# «HH … || SB-11.03.26|| …», «Channel: …», еженедельные архивы. В НОВОСТНУЮ ленту
# это не берём — только оригинальные статьи. Видео придут отдельным конвейером.
_VIDEO_TITLE_RE = re.compile(
    r"\|\|"                                   # «… || SB-… ||»
    r"|weekly\s+feed\s+archive"
    r"|\bch(?:annel)?\s*:"
    r"|\bSB[\s.-]?\d|\bBG[\s.-]?\d|\bCC[\s.-]?\d"  # SB3.16.26 / BG 2.13 …
    r"|\bclass\b.*\d{1,2}[.\-]\d{1,2}[.\-]\d{2,4}",
    re.I,
)


def skip_dandavats(title_en, body_paras):
    if _VIDEO_TITLE_RE.search(title_en or ""):
        return True
    body = " ".join(body_paras)
    # Пустышка вокруг ютуб-превью: почти нет текста и есть метка канала/ссылка на ютуб.
    if len(body) < 220 and ("youtube" in body.lower() or "youtu.be" in body.lower() or "channel:" in body.lower()):
        return True
    if len(body_paras) <= 1 and len(body) < 160:
        return True
    return False


# ─────────────────────── реестр источников ───────────────────────

SOURCES = {
    "iskconnews": {
        "short": "in",
        "label": "ISKCON News",
        "source": "iskconnews.org",
        "rest": "https://iskconnews.org/wp-json/wp/v2/posts",
        "rss": "https://iskconnews.org/feed/",
        "skip": None,
    },
    "dandavats": {
        "short": "dv",
        "label": "Dandavats",
        "source": "dandavats.com",
        "rest": "https://www.dandavats.com/wp-json/wp/v2/posts",
        "rss": "https://www.dandavats.com/?feed=rss2",
        "skip": skip_dandavats,
    },
    "iskcon": {
        "short": "io",
        "label": "ISKCON.org",
        "source": "iskcon.org",
        "rest": "https://iskcon.org/wp-json/wp/v2/posts",
        "rss": "https://iskcon.org/feed/",
        "skip": None,
    },
}


# ─────────────────────── заборщики (REST / RSS) ───────────────────────

def rest_page(base, page, per_page):
    return _get_json("%s?per_page=%d&page=%d&_embed=1&orderby=date&order=desc" % (base, per_page, page))


def rest_records(src, page):
    """Одна страница REST → нормализованные записи (или None, если REST закрыт)."""
    posts = rest_page(src["rest"], page, 20)
    if posts is None:
        return None
    out = []
    for post in posts:
        wid = post.get("id")
        raw_slug = (post.get("slug") or str(wid)).strip("-")[:100]
        title_en = html.unescape(_strip_tags(post.get("title", {}).get("rendered", ""))).strip()
        body_en = clean_body(post.get("content", {}).get("rendered", ""))
        if not title_en or not body_en:
            continue
        out.append({
            "wid": str(wid), "raw_slug": raw_slug, "url": post.get("link", ""),
            "published_at": _iso(post.get("date_gmt") or post.get("date")),
            "author": author_of(post), "hero": hero_of(post), "category": category_of(post),
            "title_en": title_en, "body_en": body_en,
        })
    return out


_NS = {"content": "http://purl.org/rss/1.0/modules/content/"}


def rss_records(src):
    """RSS/Atom как откат (одна страница). Тело — из content:encoded, иначе description."""
    xml = _get_text(src["rss"])
    try:
        root = ET.fromstring(xml)
    except ET.ParseError as e:
        raise SystemExit("::error title=RSS parse::%s — %s" % (str(e)[:120], src["rss"]))
    items = root.findall(".//item") or root.findall(".//{http://www.w3.org/2005/Atom}entry")
    out = []
    for it in items:
        def gx(tag):
            el = it.find(tag)
            return el.text if el is not None and el.text else ""
        title_en = html.unescape(_strip_tags(gx("title"))).strip()
        link = gx("link") or ""
        guid = gx("guid") or link
        wid = re.sub(r"\D", "", (re.search(r"[?&]p=(\d+)", link) or re.search(r"(\d+)/?$", guid) or re.search(r"(\d+)", guid or "0")).group(1)) if (guid or link) else "0"
        enc = it.find("content:encoded", _NS)
        raw = enc.text if enc is not None and enc.text else gx("description")
        body_en = clean_body(raw) or [t for t in [html.unescape(_strip_tags(raw)).strip()] if t]
        if not title_en or not body_en:
            continue
        m = re.search(r'<img[^>]+src="([^"]+)"', raw or "")
        pub = gx("pubDate") or gx("{http://www.w3.org/2005/Atom}updated")
        out.append({
            "wid": wid or "0", "raw_slug": re.sub(r"[^a-z0-9]+", "-", title_en.lower()).strip("-")[:80] or (wid or "0"),
            "url": link, "published_at": _rss_date(pub), "author": None,
            "hero": m.group(1) if m else None, "category": "Новости",
            "title_en": title_en, "body_en": body_en,
        })
    return out


def _rss_date(s):
    s = (s or "").strip()
    if not s:
        return ""
    for fmt in ("%a, %d %b %Y %H:%M:%S %z", "%a, %d %b %Y %H:%M:%S %Z"):
        try:
            import datetime
            return datetime.datetime.strptime(s, fmt).astimezone(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        except Exception:  # noqa: BLE001
            continue
    return s  # уже ISO или отдадим как есть


# ─────────────────────── перевод ───────────────────────

def anthropic_translate(title_en, body_paras):
    prompt = json.dumps({"title": title_en, "body": body_paras}, ensure_ascii=False)
    body = json.dumps({
        "model": MODEL, "max_tokens": 4000, "system": SYSTEM,
        "messages": [{"role": "user", "content": prompt}],
    }).encode()
    req = urllib.request.Request(ANTHROPIC, data=body, headers={
        "x-api-key": os.environ["ANTHROPIC_API_KEY"],
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    })
    for i in range(3):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                d = json.load(r)
            txt = "".join(b.get("text", "") for b in d.get("content", []) if b.get("type") == "text")
            txt = txt.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            obj = json.loads(txt)
            out_body = [p.strip() for p in obj.get("body", []) if p and p.strip()]
            if obj.get("title") and obj.get("lead") and out_body:
                return obj.get("title").strip(), obj.get("author", "").strip(), obj.get("lead").strip(), out_body
            raise ValueError("пустой перевод")
        except urllib.error.HTTPError as e:
            last = "HTTP %s — %s" % (e.code, e.read().decode("utf-8", "replace")[:200])
        except Exception as e:  # noqa: BLE001
            last = str(e)[:200]
        time.sleep(2.0 * (i + 1))
    raise SystemExit("::error title=Anthropic::%s" % last)


# ─────────────────────── D1 ───────────────────────

def already(guid):
    return bool(d1.query("SELECT 1 FROM news_posts WHERE guid=?1 LIMIT 1", [guid]))


def insert(rec, src):
    d1.query(
        "INSERT OR IGNORE INTO news_posts "
        "(guid, slug, source, source_label, url, published_at, author, hero, category, "
        " title_ru, title_en, lead_ru, body_ru, body_en, status) "
        "VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,'published')",
        [rec["guid"], rec["slug"], src["source"], src["label"], rec["url"], rec["published_at"],
         rec["author"], rec["hero"], rec["category"], rec["title_ru"], rec["title_en"],
         rec["lead_ru"], json.dumps(rec["body_ru"], ensure_ascii=False),
         json.dumps(rec["body_en"], ensure_ascii=False)],
    )


# ─────────────────────── прогон источника ───────────────────────

def run_source(key, limit, pages, dry):
    src = SOURCES[key]
    added = skipped = filtered = 0
    used_rss = False
    for page in range(1, pages + 1):
        recs = rest_records(src, page)
        if recs is None:  # REST закрыт → RSS (одна страница, без пагинации)
            recs = rss_records(src)
            used_rss = True
        if not recs:
            break
        for r in recs:
            if added >= limit:
                break
            guid = "%s:%s" % (src["short"], r["wid"])
            if not dry and already(guid):
                skipped += 1
                continue
            if src["skip"] and src["skip"](r["title_en"], r["body_en"]):
                filtered += 1
                continue
            print("→ [%s %s] %s" % (src["short"], r["wid"], r["title_en"][:66]))
            t_ru, a_ru, lead_ru, b_ru = anthropic_translate(r["title_en"], r["body_en"][:35])
            rec = {
                "guid": guid, "slug": "%s-%s" % (src["short"], r["raw_slug"]),
                "url": r["url"], "published_at": r["published_at"] or _iso(""),
                "author": a_ru or r["author"] or "", "hero": r["hero"], "category": r["category"],
                "title_ru": t_ru, "title_en": r["title_en"], "lead_ru": lead_ru,
                "body_ru": b_ru, "body_en": r["body_en"],
            }
            if dry:
                print(json.dumps({k: rec[k] for k in ("guid", "slug", "title_ru", "lead_ru", "category")}, ensure_ascii=False))
            else:
                insert(rec, src)
            added += 1
            time.sleep(1.0)
        if added >= limit or used_rss:
            break
    print("::notice title=%s::добавлено %d · пропущено (уже есть) %d · отсеяно видео %d%s"
          % (src["label"], added, skipped, filtered, " · RSS-откат" if used_rss else ""))
    return added


# ─────────────────────── самотест чистых функций ───────────────────────

def selftest():
    assert clean_body("<p>Hello&nbsp;world</p><p>Tags: a,b</p><li>one</li>") == ["Hello world", "— one"], "clean_body"
    assert skip_dandavats("HH Swami || SB-11.03.26|| 15-06-2026", ["x"]), "dandavats video title"
    assert skip_dandavats("Weekly Feed Archive – July 15", ["x"]), "dandavats weekly"
    assert not skip_dandavats("Celebrating 60 Years of ISKCON at Bhaktivedanta Manor",
                              ["By Radha Mohan Das. Monday marked a highly auspicious occasion — the 60th anniversary of the incorporation of ISKCON in New York, a milestone for the whole movement worldwide."]), "real article kept"
    assert _iso("2026-07-15 09:30:00") == "2026-07-15T09:30:00Z", "iso"
    assert _rss_date("Tue, 15 Jul 2026 09:30:00 +0000") == "2026-07-15T09:30:00Z", "rss date"
    print("selftest OK")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=12, help="макс. НОВЫХ статей на источник за прогон")
    ap.add_argument("--pages", type=int, default=1, help="страниц REST на источник (по 20)")
    ap.add_argument("--source", choices=list(SOURCES), help="только один источник (по умолчанию — все)")
    ap.add_argument("--dry", action="store_true", help="без записи в D1")
    ap.add_argument("--selftest", action="store_true", help="юнит чистых функций, без сети/ключей")
    a = ap.parse_args()

    if a.selftest:
        selftest()
        return

    if not a.dry and not d1.available():
        raise SystemExit("::error::нет доступа к D1 (CLOUDFLARE_API_TOKEN/ACCOUNT_ID)")
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise SystemExit("::error::нет ANTHROPIC_API_KEY")

    keys = [a.source] if a.source else list(SOURCES)
    total = 0
    for key in keys:
        total += run_source(key, a.limit, a.pages, a.dry)
    print("::notice title=Новости ИСККОН::всего добавлено %d по %d источникам" % (total, len(keys)))


if __name__ == "__main__":
    main()
