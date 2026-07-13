#!/usr/bin/env python3
"""
СЕМЬ КАНАЛОВ ЖАТВЫ (ЗКН-П001).

  k1  книги приложения     D1: verses + verse_texts (28 книг, 68 816 стихов:
                           перевод И комментарий) + quotes → ссылка КЛИКАБЕЛЬНА
  k2  архив библиотеки     docs/sources (69 МБ, RU + EN)
  k3  книги онлайн         vanisource / vedabase / granthamandira
  k4  бхаджаны приложения  D1: prayers (авторство) + prayer_verses (упоминания)
  k5  бхаджаны онлайн      kksongs и другие песенники
  k6  Википедия            ru + en
  k7  сайты ИСККОН         vaniquotes · vanipedia · iskcon.org · desire tree …

Находка (единый формат — на нём стоит и сборка, и гейт):

  {ch, src, ref, kind, id, to, text, by, byId, book, div, div_title,
   ordinal, tier, url, at}

`to` заполняется ТОЛЬКО когда источник ЕСТЬ в приложении (ЗКН-П004). Внешний
источник даёт `url` — и идёт в прозу, а не в дословную цитату.
"""
import json
import re
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

from . import d1, role, web

ROOT = Path(__file__).resolve().parents[2]
SOURCES_DIR = ROOT / "docs" / "sources"
WORKS = json.loads((Path(__file__).resolve().parent / "works.json").read_text(encoding="utf-8"))

CHANNELS = {
    "k1-books-app": "книги приложения (D1: стихи + комментарии + цитаты)",
    "k2-archive": "архив библиотеки (docs/sources)",
    "k3-books-web": "книги онлайн (vanisource, vedabase …)",
    "k4-bhajans-app": "бхаджаны приложения (D1: prayers + prayer_verses)",
    "k5-bhajans-web": "бхаджаны онлайн (kksongs …)",
    "k6-wikipedia": "Википедия (ru + en)",
    "k7-iskcon-web": "сайты ИСККОН и связанные",
}
REQUIRED = {"k1-books-app", "k2-archive", "k4-bhajans-app"}

WINDOW = 1200
NEAR = 60
PER_WORK_FETCH = 420   # больше из одной книги в карточку всё равно не войдёт

# ЗКН-П015 · СТРОКА, КОТОРАЯ НЕ СТИХ, — НЕ ЦИТАТА.
# `cb.adi.17.164` держит в поле «перевод» 26 312 знаков: туда при импорте
# склеили ВСЁ приложение книги — жизнеописание автора и современную биографию
# с Шридхаром Махараджем. Конвейер вырезал оттуда кусок про Шрилу Прабхупаду и
# подписал его Вриндаваном дасом Тхакуром (ум. 1589). Строка такой длины — не
# перевод стиха, а мусор импорта. Таких строк в стиховых книгах 102.
VERSE_WORKS = {"cc", "cb", "cm", "br", "ndm", "sb", "bg", "bs", "iso", "noi",
               "gl", "ks", "vp", "rkgd", "siksastaka", "manah-siksa",
               "mukunda-mala-stotra"}
MAX_VERSE_LEN = 2500

# ЗКН-П013 · ПРЕДИСЛОВИЕ — НЕ ШАСТРА.
# «От издателей», «Введение», «Предисловие», «Приложение» лежат в таблице стихов
# как стихи (198 строк). Их автор — НЕ автор книги: издатель кланяется Шриле
# Прабхупаде, а конвейер подписал этот поклон самим Шрилой Прабхупадой.
FRONT_MATTER = re.compile(
    r"preface|introduc|foreword|append|dedicat|epilog|afterword|colophon|"
    r"вступ|предислов|введение|от\s*издател|приложени|послеслов", re.I)
MAX_SUFFIX = 4


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def fold(s):
    s = (s or "").lower().replace("ё", "е")
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return unicodedata.normalize("NFC", s)


def pattern(forms):
    body = "|".join(re.escape(f) for f in sorted(forms, key=len, reverse=True))
    return re.compile(r"(?<![a-zа-я])(%s)[a-zа-я]{0,%d}(?![a-zа-я])" % (body, MAX_SUFFIX))


def tier(text, forms, quals, homs, strict=()):
    """ЗКН-П009 — НИЧЕГО НЕ ВЫБРАСЫВАЕТСЯ, всё маркируется уверенностью.

    strong    — точное полное имя («Джива Госвами») ИЛИ имя + уточнитель рядом
    homonym   — рядом маркер нарицательного («джива» = душа, «нароттама» = лучший)
    candidate — голое имя: решает куратор (в книгу не идёт, идёт в бриф)

    Точное имя проверяется ПЕРВЫМ и это главное: без него «Джива» ловила бы
    каждое «джива» (душа) в 8 440 комментариях Шримад-Бхагаватам.
    """
    f = fold(text)
    for s in strict:
        if fold(s) in f:
            return "strong"
    # Имя собственное в русском тексте — с ЗАГЛАВНОЙ. Если все вхождения основы
    # строчные, это нарицательное: «джива» = душа, «нароттама» = лучший из людей.
    # Правило общее и снимает главную ловушку жатвы без ручных списков омонимов.
    hits = list(pattern(forms).finditer(fold(text)))
    if hits and all(not text[m.start():m.start() + 1].isupper() for m in hits
                    if m.start() < len(text)):
        return "homonym"
    pat = pattern(forms)
    best = "candidate"
    for m in pat.finditer(f):
        lo, hi = max(0, m.start() - NEAR), min(len(f), m.end() + NEAR)
        near = f[lo:hi]
        if any(fold(q) in near for q in quals):
            return "strong"
        if any(fold(h) in near for h in homs):
            best = "homonym" if best == "candidate" else best
    return best


# ═══ k1 · книги приложения ════════════════════════════════════════════════
def k1_books_app(strict, forms, quals, homs, works=()):
    """Стихи и комментарии по ВСЕМ книгам. Текст берётся ИЗ БД (ЗКН-П002):
    это и есть гарантия дословности — руками текст не набирается никогда."""
    if not d1.available():
        return []
    # ПРОХОД А — точное имя: эти стихи станут ДОСЛОВНЫМИ цитатами.
    exact = list(strict) or list(forms)
    where = "(%s) OR (%s)" % (d1.ors("vt.translation", exact), d1.ors("vt.purport", exact))
    ids = [r["id"] for r in (d1.query(
        "SELECT v.id FROM verses v JOIN verse_texts vt ON vt.verse_id=v.id "
        "WHERE %s ORDER BY v.work_id, v.division_id, v.ordinal" % where) or [])]
    ids = list(dict.fromkeys(ids))
    per_book, keep = {}, []
    for i in ids:
        w = i.split(".")[0]
        per_book[w] = per_book.get(w, 0) + 1
        if per_book[w] <= PER_WORK_FETCH:
            keep.append(i)
    ids = keep
    out = []
    slugs = {r["id"]: (r["slug"], r["title"])
             for r in (d1.query("SELECT id, slug, title FROM book_catalog WHERE readable=1") or [])}
    for chunk in d1.chunks(ids, 40):
        inlist = ",".join("'" + i.replace("'", "''") + "'" for i in chunk)
        rows = d1.query(
            "SELECT v.id, v.work_id, v.division_id, v.ref, v.ordinal, "
            "vt.translation, vt.purport, d.title AS div_title "
            "FROM verses v JOIN verse_texts vt ON vt.verse_id=v.id "
            "LEFT JOIN divisions d ON d.id=v.division_id "
            "WHERE v.id IN (%s)" % inlist) or []
        for r in rows:
            w = r["work_id"]
            if FRONT_MATTER.search(r.get("division_id") or "") or \
               FRONT_MATTER.search(r.get("ref") or ""):
                continue                       # ЗКН-П013: предисловие не цитируется
            slug, book = slugs.get(w, (w, w))
            wk = WORKS.get(w, {})
            dt = r.get("div_title") or ""
            if dt.startswith("{"):
                try:
                    dt = json.loads(dt).get("ru") or json.loads(dt).get("en") or ""
                except Exception:                                # noqa: BLE001
                    dt = ""
            to = "/" + slug + "/" + r["id"][len(w) + 1:].replace(".", "/")
            for kind, col, who in (("translation", "translation", wk.get("narrator")),
                                   ("purport", "purport", wk.get("commentator"))):
                txt = (r.get(col) or "").strip()
                if not txt or not pattern(forms).search(fold(txt)):
                    continue
                if kind == "translation" and w in VERSE_WORKS and len(txt) > MAX_VERSE_LEN:
                    continue                   # ЗКН-П015: это не стих, это мусор импорта
                out.append({
                    "ch": "k1-books-app", "src": w, "id": r["id"], "ref": r["ref"],
                    "kind": kind, "to": to, "text": txt,
                    "role": role.classify(txt, pattern(forms), works),
                    "by": (who or [None, None])[0], "byId": (who or [None, None])[1],
                    "book": book, "div": r["division_id"], "div_title": dt,
                    "ordinal": r.get("ordinal") or 0,
                    "tier": tier(txt, forms, quals, homs, strict), "at": now(),
                })
    # ПРОХОД Б — широкий (основа имени): в книгу НЕ идёт, идёт в бриф куратору.
    # Ничего не выбрасываем (ЗКН-П009), но и не топим карточку чужим текстом:
    # берём только ссылку и окно вокруг имени, а не весь комментарий.
    wide = "(%s) OR (%s)" % (d1.ors("vt.translation", forms), d1.ors("vt.purport", forms))
    seen = set(ids)
    for r in (d1.query(
            "SELECT v.id, v.ref, v.work_id, substr(coalesce(vt.translation,'')||' | '||"
            "coalesce(vt.purport,''),1,400) AS snip FROM verses v "
            "JOIN verse_texts vt ON vt.verse_id=v.id WHERE %s LIMIT 4000" % wide) or []):
        if r["id"] in seen:
            continue
        seen.add(r["id"])
        out.append({"ch": "k1-books-app", "src": r["work_id"], "id": r["id"], "ref": r["ref"],
                    "kind": "wide", "to": None, "text": r["snip"] or "", "by": None,
                    "byId": None, "book": r["work_id"], "div": "", "div_title": "",
                    "ordinal": 0, "tier": tier(r["snip"] or "", forms, quals, homs, strict),
                    "role": "упоминание", "at": now()})

    for r in (d1.query("SELECT slug, personality_slug, text, source, speaker FROM quotes "
                       "WHERE %s" % d1.ors("text", forms)) or []):
        out.append({"ch": "k1-books-app", "src": "quotes", "id": r.get("slug") or "",
                    "ref": r.get("source") or "", "kind": "quote", "to": None,
                    "text": r.get("text") or "", "by": r.get("speaker"), "byId": None,
                    "book": r.get("source") or "", "div": "", "div_title": "", "ordinal": 0,
                    "tier": tier(r.get("text") or "", forms, quals, homs, strict), "at": now()})
    return out


# ═══ k2 · архив библиотеки ════════════════════════════════════════════════
def _snap(text, lo, hi):
    p = text.rfind("\n\n", max(0, lo - 400), lo)
    lo = p + 2 if p != -1 else lo
    p = text.find("\n\n", hi, hi + 400)
    hi = p if p != -1 else hi
    return max(0, lo), min(len(text), hi)


def k2_archive(strict, forms, quals, homs, excludes=()):
    pat = pattern(forms)
    ex = [re.compile(fold(e)) for e in excludes]
    out = []
    for fp in sorted(SOURCES_DIR.rglob("*.txt")):
        try:
            text = fp.read_text(encoding="utf-8", errors="ignore")
        except Exception:                                        # noqa: BLE001
            continue
        spans = [(m.start(), m.end()) for m in pat.finditer(fold(text))]
        if not spans:
            continue
        merged = []
        for st, en in spans:
            lo, hi = _snap(text, st - WINDOW, en + WINDOW)
            if merged and lo <= merged[-1][1]:
                merged[-1][1] = max(merged[-1][1], hi)
                merged[-1][2] += 1
            else:
                merged.append([lo, hi, 1])
        rel = str(fp.relative_to(ROOT))
        for lo, hi, hits in merged:
            passage = text[lo:hi].strip()
            if any(x.search(fold(passage)) for x in ex):
                continue
            out.append({"ch": "k2-archive", "src": rel, "id": "offset:%d" % lo,
                        "ref": "%s, offset %d" % (fp.name, lo), "kind": "passage",
                        "to": None, "text": passage, "by": None, "byId": None,
                        "book": fp.stem, "div": "", "div_title": "", "ordinal": hits,
                        "tier": tier(passage, forms, quals, homs, strict), "at": now()})
    return out


# ═══ k4 · бхаджаны приложения ═════════════════════════════════════════════
def k4_bhajans_app(strict, forms, quals, homs, hero_id=None):
    if not d1.available():
        return []
    out = []
    own = d1.query(
        "SELECT slug, name, author_name, author_slug FROM prayers WHERE %s OR %s OR %s OR "
        "coalesce(author_slug,'')=?1" % (d1.ors("author_name", forms), d1.ors("name", forms),
                                         d1.ors("text", forms)),
        [hero_id or ""]) or []
    mentions = d1.query(
        "SELECT pv.slug, pv.ord, pv.verse_text, pv.verse_translit, pv.signature, "
        "p.name, p.author_name, p.author_slug FROM prayer_verses pv "
        "LEFT JOIN prayers p ON p.slug=pv.slug WHERE %s OR %s"
        % (d1.ors("pv.verse_text", forms), d1.ors("pv.signature", forms))) or []
    known = {r["slug"]: r for r in own}
    for r in mentions:
        txt = (r.get("verse_text") or "").strip()
        if not txt:
            continue
        name = r.get("name") or known.get(r["slug"], {}).get("name") or r["slug"]
        out.append({
            "ch": "k4-bhajans-app", "src": r["slug"], "id": "%s#%s" % (r["slug"], r["ord"]),
            "ref": "«%s», куплет %s" % (name, r["ord"]), "kind": "bhajan",
            "to": "/bhajans/" + r["slug"], "text": txt,
            "translit": (r.get("verse_translit") or "").strip() or None,
            "by": r.get("author_name"), "byId": r.get("author_slug"),
            "book": name, "div": "", "div_title": "", "ordinal": r["ord"],
            "tier": tier(txt, forms, quals, homs, strict), "at": now()})
    for r in own:
        if not any(f["src"] == r["slug"] for f in out):
            out.append({"ch": "k4-bhajans-app", "src": r["slug"], "id": r["slug"],
                        "ref": "«%s»" % (r.get("name") or r["slug"]), "kind": "bhajan-meta",
                        "to": "/bhajans/" + r["slug"], "text": r.get("name") or r["slug"],
                        "by": r.get("author_name"), "byId": r.get("author_slug"),
                        "book": r.get("name") or r["slug"], "div": "", "div_title": "",
                        "ordinal": 0, "tier": "strong", "at": now()})
    return out


# ═══ k3 · k5 · k6 · k7 — сеть ═════════════════════════════════════════════
def web_channel(ch, names, strict, forms, quals, homs):
    reg = web.registry().get(ch, [])
    out = []
    for src in reg:
        try:
            pages = web.fetch(src, names)
        except Exception as e:                                   # noqa: BLE001
            print("  ! %s/%s: %s" % (ch, src["id"], str(e)[:90]))
            continue
        for p in pages:
            body = p["text"].strip()
            if not pattern(forms).search(fold(body)):
                continue
            out.append({"ch": ch, "src": src["id"], "id": p["url"],
                        "ref": p["title"], "kind": "web", "to": None, "text": body[:24000],
                        "by": None, "byId": None, "book": p["title"], "div": "",
                        "div_title": "", "ordinal": 0, "url": p["url"],
                        "source_tier": src.get("tier", "reference"),
                        "tier": tier(body, forms, quals, homs, strict), "at": now()})
        time.sleep(0.3)
    return out


def hero_works(hero):
    """Названия его трудов — по ним узнаётся роль «труд»."""
    if not d1.available():
        return []
    out = [r["title"] for r in (d1.query(
        "SELECT title FROM book_catalog WHERE author_entity_id=?1", [hero]) or [])]
    out += [r["name"] for r in (d1.query(
        "SELECT name FROM prayers WHERE author_slug=?1", [hero]) or []) if r.get("name")]
    return [t for t in out if t and len(t) > 4]


def harvest(passport, only=None, net=True):
    forms = passport["forms"]
    strict = passport.get("strict", [])
    names = passport["names"]
    quals = passport.get("qualifiers", [])
    homs = passport.get("homonyms", [])
    ex = passport.get("excludes", [])
    hero = passport["entity_id"]
    want = set(only or CHANNELS)
    out = []
    works = hero_works(hero)
    if "k1" in want or "k1-books-app" in want:
        out += k1_books_app(strict, forms, quals, homs, works)
    if "k2" in want or "k2-archive" in want:
        out += k2_archive(strict, forms, quals, homs, ex)
    if "k4" in want or "k4-bhajans-app" in want:
        out += k4_bhajans_app(strict, forms, quals, homs, hero)
    if net:
        for ch in ("k3-books-web", "k5-bhajans-web", "k6-wikipedia", "k7-iskcon-web"):
            if ch in want or ch[:2] in want:
                out += web_channel(ch, names, strict, forms, quals, homs)
    return out
