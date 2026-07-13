#!/usr/bin/env python3
"""
КАНОН ИМЁН И ТЕКСТА — законы, вшитые в кузницу (не в память).

Порт `apps/web/src/cardText.ts::cleanCardText` на питон + гейты, которых в
рантайме нет: полное имя героя, прямой апостроф, «Гаура-лила».

Законы: ЗКН-Т001 (нет «;») · ЗКН-И001 (нет голой «Шри Чайтанья Махапрабху») ·
ЗКН-И002 (нет голой «Радхарани») · ЗКН-И003 («Гауранга Лила» без дефиса) ·
ЗКН-И004 (нет «А.Ч.») · ЗКН-П003 крит.9/11 (канон + полное имя героя).

ГРАНИЦА ЗАКОНА (ЗКН-БТ004 — чужой голос не редактируется):
  • ПРАВИМ авторские поля: p · h · label · kicker · see.t · by
  • НЕ ТРОГАЕМ: q.t (дословная цитата), q.translit, названия книг, slug/id

Именно поэтому cleanCardText в кузнице вызывается ТОЛЬКО из compose для
авторских полей, а гейт проверяет цитаты на дословность, а не на канон.
"""
import re

# ── Господь: голые формы → канон ──────────────────────────────────────────
# Полная санньяса-форма «Шри Кришна Чайтанья Махапрабху» НЕ трогается: между
# «Шри» и «Чайтанья» стоит «Кришна», regex её не задевает (как в cardText.ts).
LORD = [
    (re.compile(r"Шри\s+Чайтанья\s+Махапрабху"), "Гауранга Махапрабху"),
    (re.compile(r"Шри\s+Чайтаньи\s+Махапрабху"), "Гауранги Махапрабху"),
    (re.compile(r"Шри\s+Чайтанье\s+Махапрабху"), "Гауранге Махапрабху"),
    (re.compile(r"Шри\s+Чайтанью\s+Махапрабху"), "Гаурангу Махапрабху"),
    (re.compile(r"Шри\s+Чайтаньей\s+Махапрабху"), "Гаурангой Махапрабху"),
    (re.compile(r"Шри\s+Чайтаньею\s+Махапрабху"), "Гаурангою Махапрабху"),
]
# Лила — с заглавной, без дефиса (ЗКН-И003)
LILA = [
    (re.compile(r"Гаура-лил([аыеуой])"), lambda m: "Гауранга Лил" + m.group(1)),
    (re.compile(r"Гауранга-лил([аыеуой])"), lambda m: "Гауранга Лил" + m.group(1)),
    (re.compile(r"Кришна-лил([аыеуой])"), lambda m: "Кришна Лил" + m.group(1)),
]
# Прабхупада: полусокращённый титул запрещён (ЗКН-И004)
ABHAY = (re.compile(r"А\.\s?Ч\.\s+(?=Бхактиведанта)"), "Абхай Чаранаравинда ")

# ── Гейты (что ловим в авторской прозе) ───────────────────────────────────
LORD_ANY = re.compile(r"(?:([А-Яа-я]+)\s+)?Чайтань[а-я]*\s+Махапрабху")


def bare_lord(s):
    """Голая форма Господа. Полная («Шри Кришн-Ы- Чайтаньи Махапрабху») — законна.

    Lookbehind фиксированной ширины тут не работает: перед «Чайтаньи» стоит
    склонённое «Кришны/Кришной/Кришну». Поэтому смотрим предыдущее СЛОВО.
    """
    for m in LORD_ANY.finditer(s or ""):
        if not (m.group(1) or "").lower().startswith("кришн"):
            return True
    return False
BARE_RADHA = re.compile(r"(?<!Шримати )(?<!Шримати\s)Радхаран[иию]")
SEMICOLON = re.compile(r";")
APOSTROPHE = re.compile(r"'")          # ЗКН-П003: прямой апостроф — только в стихе
HYPHEN_LILA = re.compile(r"[Гг]аура-лил|[Гг]ауранга-лил|[Кк]ришна-лил")
HALF_TITLE = re.compile(r"А\.\s?Ч\.\s+Бхактиведанта")

# Составные, которые НЕЛЬЗЯ трогать при подстановке полного имени героя
# (ловушки-коллизии из плейбука: «Рупа-манджари», «Гопала-чампу», «Санатана-шикша»).
COMPOUND = re.compile(r"[А-Яа-я]+-[а-я]+")


CASE_END = {"а": "а", "и": "и", "е": "е", "у": "у", "ю": "ой", "ы": "ы", "ей": "ой"}


def fix_lord(s):
    """Голая форма Господа → канон, в ЛЮБОМ падеже и БЕЗ «Шри».

    Названия глав приходят из D1 как «Чайтанья Махапрабху наставляет…» — без
    «Шри». Прежний санитайзер требовал «Шри» и такую форму пропускал, а гейт
    её ловил: карточка падала на данных, которые сама же и взяла из базы.
    """
    def sub(m):
        pre, word = m.group(1), m.group(2)
        if pre and pre.lower().startswith("кришн"):
            return m.group(0)                      # полная санньяса-форма — законна
        tail = word[len("Чайтань"):]               # а / и / е / ю / ей
        end = {"а": "а", "и": "и", "е": "е", "ю": "у", "ей": "ой", "ею": "ою"}.get(tail, "а")
        head = (pre + " ") if pre and pre != "Шри" else ""
        return "%sГауранг%s Махапрабху" % (head, end)
    return re.sub(r"(?:([А-Яа-я]+)\s+)?(Чайтань[а-я]{1,2})\s+Махапрабху", sub, s or "")


def clean_card_text(s):
    """ЗКН-Т002 · У4: единственная точка прогона авторской прозы."""
    s = re.sub(r"[ \t]+", " ", (s or "")).strip()
    if not s:
        return ""
    if ";" in s:                                    # ЗКН-Т001
        parts = [p.strip() for p in s.split(";") if p.strip()]
        s = ". ".join(p if i == 0 else p[0].upper() + p[1:] for i, p in enumerate(parts))
        s = re.sub(r"\.\s*\.", ".", s)
        s = re.sub(r"\s{2,}", " ", s).strip()
    s = fix_lord(s)                                 # ЗКН-И001 (любой падеж, с «Шри» и без)
    for rx, rep in LILA:                            # ЗКН-И003
        s = rx.sub(rep, s)
    s = ABHAY[0].sub(ABHAY[1], s)                   # ЗКН-И004
    s = s.replace("'", "\u2019")                    # прямой апостроф — вон из прозы
    return s.strip()


CASES = ("ой", "ою", "ы", "и", "е", "у", "а")


def _title_of(short, full):
    """Титул и его место. «Джива Госвами» — сзади. «Шрила Прабхупада» — СПЕРЕДИ.

    Прежний код резал строку по длине краткого имени и на Прабхупаде получал
    «дупада»: он молча считал, что титул всегда идёт после имени.
    """
    if full.startswith(short):
        return full[len(short):].strip(), "after"
    if full.endswith(short):
        return full[:-len(short)].strip(), "before"
    return "", ""


def _decline(title, word):
    """«Шрила» + «Прабхупады» → «Шрилы Прабхупады». Титул склоняется вместе с именем."""
    if not title.endswith("а"):
        return title
    for end in CASES:
        if word.endswith(end):
            return title[:-1] + end
    return title


def enforce_hero(s, short, full):
    """ЗКН-П003 крит.11 — имя героя в авторских полях ВСЕГДА полное.

    «Джива» → «Джива Госвами», «Прабхупада» → «Шрила Прабхупада» — во всех
    падежах. Не трогаем составные через дефис («Виласа-манджари») и уже полную
    форму.
    """
    if not s or not short:
        return s
    stem = short.rstrip("аяыиеуой")
    if len(stem) < 4:
        return s
    title, where = _title_of(short, full)
    if not title:
        return s
    rx = re.compile(r"(?<![А-Яа-я-])(%s[а-я]{0,3})(?![А-Яа-я-])" % re.escape(stem))

    def sub(m):
        word = m.group(1)
        if where == "after":
            if s[m.end():].lstrip().startswith(title):
                return word
            return "%s %s" % (word, title)
        t = _decline(title, word)
        if s[:m.start()].rstrip().endswith(t):
            return word
        return "%s %s" % (t, word)
    return rx.sub(sub, s)


def prose_violations(s, hero_short=None, hero_full=None):
    """Что запрещено в авторском поле. Пусто = чисто."""
    bad = []
    if not s:
        return bad
    if SEMICOLON.search(s):
        bad.append("ЗКН-Т001 «;»")
    if bare_lord(s):
        bad.append("ЗКН-И001 голая «Чайтанья Махапрабху»")
    if BARE_RADHA.search(s):
        bad.append("ЗКН-И002 голая «Радхарани»")
    if HYPHEN_LILA.search(s):
        bad.append("ЗКН-И003 «Гаура-лила» через дефис")
    if HALF_TITLE.search(s):
        bad.append("ЗКН-И004 «А.Ч.» — полусокращённый титул")
    if APOSTROPHE.search(s):
        bad.append("ЗКН-П003 прямой апостроф в прозе")
    if hero_short and hero_full:
        stem = hero_short.rstrip("аяыиеуой")
        title, where = _title_of(hero_short, hero_full)
        if len(stem) >= 4 and title:
            for m in re.finditer(r"(?<![А-Яа-я-])%s[а-я]{0,3}(?![А-Яа-я-])" % re.escape(stem), s):
                word = m.group(0)
                ok = (s[m.end():].lstrip().startswith(title) if where == "after"
                      else s[:m.start()].rstrip().endswith(_decline(title, word)))
                if not ok:
                    bad.append("ЗКН-П003/11 голое имя героя «%s»" % word)
                    break
    return bad


# ═══════════════════════════════════════════════════════════════════════════
# ЗКН-П014 · ГЕЙТ АНАХРОНИЗМА
#
# Подпись «— Вриндаван дас Тхакур» под текстом о Шриле Прабхупаде — это не
# опечатка и не мелочь. Это ЛОЖНОЕ СВИДЕТЕЛЬСТВО: слова вложены в уста того,
# кто умер за триста лет до описанных событий. Для библиотеки, которая обещает
# BBT-точность, это худший вид брака — хуже пустоты.
#
# Прежний гейт проверял ИМЕНА и ЧИСЛА, но ни разу не спросил главного:
# МОГ ЛИ ПОДПИСАННЫЙ ЭТО СКАЗАТЬ. Теперь спрашивает.
# ═══════════════════════════════════════════════════════════════════════════
import json as _json
from pathlib import Path as _Path

_PEOPLE = _json.loads((_Path(__file__).resolve().parent / "people.json")
                      .read_text(encoding="utf-8"))
DIED = _PEOPLE["died"]
MARKERS = _PEOPLE["markers"]
YEAR = re.compile(r"\b(1[5-9]\d\d|20\d\d)\b")


def anachronism(text, by_id):
    """Мог ли подписанный это сказать? Вернёт причину, если НЕ мог."""
    if not by_id or by_id not in DIED or not text:
        return None
    died = DIED[by_id]
    low = text.lower().replace("ё", "е")
    for marker, since in MARKERS.items():
        if died < since and marker in low:
            return "подписан %s (ум. %s), а в тексте — «%s» (не ранее %s)" % (
                by_id, died, marker, since)
    for y in YEAR.findall(text):
        if int(y) > died + 5:
            return "подписан %s (ум. %s), а в тексте год %s" % (by_id, died, y)
    return None
