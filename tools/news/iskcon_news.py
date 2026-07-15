#!/usr/bin/env python3
"""
Новости ИСККОН → RU. Официальный источник — iskconnews.org (WordPress REST API).

Конвейер (идемпотентный):
  1. Тянем последние статьи: /wp-json/wp/v2/posts?_embed  (заголовок, тело, автор,
     hero-картинка, категория, дата).
  2. guid = "iskconnews:<wp_id>" — уже загруженное ПРОПУСКАЕМ (дедуп по D1).
  3. Переводим заголовок + тело на русский через Claude с BBT-точностью
     (глоссарий канонических имён; НОЛЬ фабрикации). Отдельно — короткий лид.
  4. Пишем в D1 (news_posts) параметризованно (ЗКН-П002).

Запуск (CI и локально одинаково):
  python3 tools/news/iskcon_news.py --limit 12 --pages 1
Переменные: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, ANTHROPIC_API_KEY.

ЗКН-Ф014: скрипт говорит, ЧТО именно сломалось, а не «exit 1».
ЗКН-Пл006: источник важнее метода — переводим РЕАЛЬНЫЙ материал iskconnews.org,
ничего не досочиняя.
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

# d1-клиент лежит в goldforge — переиспользуем (CF HTTP API, bearer-токен).
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "goldforge"))
import d1  # noqa: E402

WP = "https://iskconnews.org/wp-json/wp/v2/posts"
SOURCE = "iskconnews.org"
SOURCE_LABEL = "ISKCON News"
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
    "video": "Видео",
}

SYSTEM = """Ты — переводчик новостной ленты ISKCON ONE LOVE. Переводишь официальные новости ISKCON News (iskconnews.org) с английского на русский для преданных, читающих на русском.

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


def _get(url, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 400 and "rest_post_invalid_page_number" in e.read().decode("utf-8", "replace"):
                return []  # страниц больше нет — норма
            last = "HTTP %s" % e.code
        except Exception as e:  # noqa: BLE001
            last = str(e)[:160]
        time.sleep(1.5 * (i + 1))
    raise SystemExit("::error title=iskconnews.org::%s — %s" % (last, url))


def wp_page(page, per_page):
    return _get("%s?per_page=%d&page=%d&_embed=1&orderby=date&order=desc" % (WP, per_page, page))


def _strip_tags(s):
    return re.sub(r"<[^>]+>", "", s)


def clean_body(rendered):
    """content.rendered (HTML) → список чистых абзацев по порядку."""
    paras = []
    for tag, inner in re.findall(r"<(p|h2|h3|h4|blockquote|li)\b[^>]*>(.*?)</\1>", rendered, re.S | re.I):
        txt = html.unescape(_strip_tags(inner)).replace("\xa0", " ").strip()
        txt = re.sub(r"\s+", " ", txt)
        if len(txt) < 2:
            continue
        low = txt.lower()
        if low.startswith(("tags:", "share this", "read more", "the post ", "source:", "photo:", "photos:", "image:")):
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
                if slug in CAT_RU:
                    # предпочитаем не-корневой раздел
                    if slug != "news" or best is None:
                        best = CAT_RU[slug]
    except Exception:  # noqa: BLE001
        pass
    return best or "Новости"


def anthropic_translate(title_en, body_paras):
    prompt = json.dumps({"title": title_en, "body": body_paras}, ensure_ascii=False)
    body = json.dumps({
        "model": MODEL,
        "max_tokens": 4000,
        "system": SYSTEM,
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


def already(guid):
    rows = d1.query("SELECT 1 FROM news_posts WHERE guid=?1 LIMIT 1", [guid])
    return bool(rows)


def insert(rec):
    d1.query(
        "INSERT OR IGNORE INTO news_posts "
        "(guid, slug, source, source_label, url, published_at, author, hero, category, "
        " title_ru, title_en, lead_ru, body_ru, body_en, status) "
        "VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,'published')",
        [rec["guid"], rec["slug"], SOURCE, SOURCE_LABEL, rec["url"], rec["published_at"],
         rec["author"], rec["hero"], rec["category"], rec["title_ru"], rec["title_en"],
         rec["lead_ru"], json.dumps(rec["body_ru"], ensure_ascii=False),
         json.dumps(rec["body_en"], ensure_ascii=False)],
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=12, help="макс. НОВЫХ статей за прогон")
    ap.add_argument("--pages", type=int, default=1, help="страниц WP REST API (по 20)")
    ap.add_argument("--dry", action="store_true", help="без записи в D1")
    a = ap.parse_args()

    if not a.dry and not d1.available():
        raise SystemExit("::error::нет доступа к D1 (CLOUDFLARE_API_TOKEN/ACCOUNT_ID)")
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise SystemExit("::error::нет ANTHROPIC_API_KEY")

    added = 0
    skipped = 0
    for page in range(1, a.pages + 1):
        posts = wp_page(page, 20)
        if not posts:
            break
        for post in posts:
            if added >= a.limit:
                break
            wid = post.get("id")
            guid = "iskconnews:%s" % wid
            slug = (post.get("slug") or str(wid)).strip("-")[:120]
            if not a.dry and already(guid):
                skipped += 1
                continue
            title_en = html.unescape(_strip_tags(post.get("title", {}).get("rendered", ""))).strip()
            body_en = clean_body(post.get("content", {}).get("rendered", ""))
            if not title_en or not body_en:
                continue
            date_gmt = post.get("date_gmt") or post.get("date") or ""
            published_at = (date_gmt.replace(" ", "T") + "Z") if date_gmt and "T" not in date_gmt and "Z" not in date_gmt else (date_gmt if date_gmt.endswith("Z") else date_gmt + "Z")
            print("→ [%s] %s" % (wid, title_en[:70]))
            t_ru, a_ru, lead_ru, b_ru = anthropic_translate(title_en, body_en[:35])
            rec = {
                "guid": guid, "slug": slug, "url": post.get("link", ""),
                "published_at": published_at, "author": a_ru or author_of(post) or "",
                "hero": hero_of(post), "category": category_of(post),
                "title_ru": t_ru, "title_en": title_en, "lead_ru": lead_ru,
                "body_ru": b_ru, "body_en": body_en,
            }
            if a.dry:
                print(json.dumps(rec, ensure_ascii=False, indent=2)[:1200])
            else:
                insert(rec)
            added += 1
            time.sleep(1.0)
        if added >= a.limit:
            break

    print("::notice title=Новости ИСККОН::добавлено %d, пропущено (уже есть) %d" % (added, skipped))


if __name__ == "__main__":
    main()
