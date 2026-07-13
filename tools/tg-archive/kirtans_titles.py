#!/usr/bin/env python3
"""
kirtans_titles.py — ЕДИНЫЙ СТАНДАРТ НАЗВАНИЙ дорожек.

═══ ЧТО БЫЛО ═══

Названием служило СЫРОЕ ИМЯ ФАЙЛА, и в списке стоял разнобой:

    «Achuta Priya Prabhu. Beyond Cry Vrajavasi»   ← имя исполнителя ВНУТРИ названия
    «Ananda Vardhana Swami»                       ← названия НЕТ ВООБЩЕ, только имя
    «2. Мукунда прабху»                           ← номер + имя, названия нет
    «14 09 24 Gauradesh Mellows Екатеринбург»     ← дата + событие
    «Mukunda Das. Raga of Separation»             ← латиница в русском приложении

Исполнитель и так стоит ВТОРОЙ строкой — дублировать его в названии незачем.

═══ ЧТО СКАЗАЛИ ДАННЫЕ (1110 файлов) ═══

    569  после вычленения не остаётся НИЧЕГО — это «Исполнитель Kirtan 01».
         Честное имя такому — «Киртан · №1», а не выдуманное.
    ~520 остаток — САНСКРИТСКИЕ имена бхаджанов (Джая Радха-Мадхава, Парама
         Каруна, Бхаджаху ре мана…). Их русские имена УЖЕ ВЫВЕРЕНЫ в молитвеннике
         приложения (339 имён) — берём ОТТУДА, а не сочиняем.
     22  английские обороты. Их побуквенная транслитерация даёт МУСОР:
         «Beyond Cry» → «Беёнд Чрй», «Raga of Separation» → «Рага Оф Сепаратион».
         Транслитерация передаёт ЗВУЧАНИЕ САНСКРИТА, а не заменяет перевод.
         Английские названия переведены поимённо.

═══ СТАНДАРТ ═══

    <Русское название>  [· дата]  [· №N]

Запуск:  CLOUDFLARE_API_TOKEN=… python kirtans_titles.py
"""
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

ACCOUNT = "d5cbe19470dc38599873eabfe148e6d1"
DB = "6226aded-dd03-4e74-977f-9cd0b509e73d"
TOKEN = os.getenv("CLOUDFLARE_API_TOKEN") or ""

# ═══ ТРАНСЛИТЕРАЦИЯ ПО ОБРАЗЦАМ ОСНОВАТЕЛЯ ═══
#
#   Acyuta → Ачьюта      Priya → Прийа      Jaya → Джайа
#
# Правило видно из этих трёх: «y» между СОГЛАСНОЙ и гласной даёт мягкий знак и
# йотированную гласную (c-y-u → чь-ю), а после ГЛАСНОЙ — «й» и обычную гласную
# (a-y-a → а-й-а). Машинная побуквенная замена этого не даёт и выдаёт «Ачюта»,
# «Прия», «Джая» — не тот стандарт.
VOWELS = set("aeiouāīūṛ")

DIG = [
    ("kṣ", "кш"), ("jñ", "гь"), ("ṭh", "тх"), ("ḍh", "дх"), ("ṇ", "н"), ("ṭ", "т"), ("ḍ", "д"),
    ("chh", "чх"), ("kh", "кх"), ("gh", "гх"), ("jh", "джх"), ("ph", "пх"), ("bh", "бх"),
    ("dh", "дх"), ("th", "тх"), ("ch", "ч"), ("sh", "ш"), ("ś", "ш"), ("ṣ", "ш"), ("ṅ", "н"),
    ("ñ", "н"), ("ṁ", "м"), ("ḥ", "х"), ("ṛ", "ри"), ("ā", "а"), ("ī", "и"), ("ū", "у"),
]
SOFT = {"a": "я", "u": "ю", "e": "е", "o": "ё", "i": "и"}
HARD = {"a": "а", "u": "у", "e": "е", "o": "о", "i": "и"}
SIMPLE = {
    "a": "а", "b": "б", "c": "ч", "d": "д", "e": "е", "f": "ф", "g": "г", "h": "х",
    "i": "и", "j": "дж", "k": "к", "l": "л", "m": "м", "n": "н", "o": "о", "p": "п",
    "q": "к", "r": "р", "s": "с", "t": "т", "u": "у", "v": "в", "w": "в", "x": "кс",
    "z": "з",
}


def translit_word(w: str) -> str:
    s = w.lower()
    for a, b in DIG:
        s = s.replace(a, b)
    out, i = [], 0
    while i < len(s):
        c = s[i]
        if c == "y":
            nxt = s[i + 1] if i + 1 < len(s) else ""
            # ⚠️ `prev` берём из ЛАТИНСКОЙ строки. Первая версия проверяла его на
            #    вхождение в кириллицу — и любая латинская согласная считалась
            #    «началом слова». Отсюда «Ачюта» вместо «Ачьюта».
            if i == 0:
                out.append(SOFT.get(nxt, "й"))          # Yamuna → Ямуна
                i += 2 if nxt in SOFT else 1
            elif s[i - 1] in VOWELS:
                out.append("й")                          # Jaya → Джайа
                i += 1
            else:
                out.append("ь" + SOFT.get(nxt, ""))      # Acyuta → Ачьюта
                i += 2 if nxt in SOFT else 1
            continue
        out.append(SIMPLE.get(c, c))
        i += 1
    r = "".join(out)
    r = re.sub(r"йй+", "й", r)
    r = re.sub(r"ьь+", "ь", r)
    return r[:1].upper() + r[1:] if r else r


LAT = re.compile(r"[A-Za-z]")

DATE = re.compile(r"\b(\d{1,2})[\s._-](\d{1,2})[\s._-](\d{2,4})\b")
NUM = re.compile(r"(?:^|\s)(?:no\.?\s*)?(\d{1,3})(?:\s|$|\.)")
EXT = re.compile(r"\.(mp3|m4a|ogg|flac|wav)$", re.I)

NOISE = re.compile(
    r"\b(kirtan|kirtana|kirtans|bhajan|bhajans|lecture|live|full|part|pt|vol|cd|track|"
    r"maha|киртан|киртаны|бхаджан|маха|лекция|запись|записи|official)\b", re.I)

# ⚠️ АНГЛИЙСКИЕ ОБОРОТЫ ТРАНСЛИТЕРИРОВАТЬ НЕЛЬЗЯ. Транслитерация передаёт
# ЗВУЧАНИЕ САНСКРИТА, а не заменяет перевод. Их два десятка — переведены поимённо.
EN_WORDS = re.compile(r"\b(of|the|and|in|at|to|for|with|from|by|an|his|all|like)\b", re.I)
EN_TITLES = {
    "prayers to the six gosvamis": "Молитвы Шести Госвами",
    "prayers to the six goswamis": "Молитвы Шести Госвами",
    "prayers to the dust of vraja": "Молитвы праху Враджа",
    "prayer to tulasi devi": "Молитва Туласи-деви",
    "the golden avatar and the hare krsna mantra": "Золотая аватара и маха-мантра",
    "ode to madhava for all his service": "Ода Мадхаве за всё Его служение",
    "a tune i like to sing": "Напев, который я люблю петь",
    "the soul": "Душа",
    "back in spiritual world": "Назад, в духовный мир",
    "address of swami a c bhaktivedanta": "Обращение Свами А.Ч. Бхактиведанты",
    "hare krsna verses from cb": "Стихи «Харе Кришна» из Чайтанья-бхагаваты",
    "slowtunes nightkirtans": "Ночные киртаны",
    "vrindavan mellows": "Вриндаванские расы",
    "gauradesh mellows": "Расы Гаурадеша",
    "raga of separation": "Рага разлуки",
    "beyond cry vrajavasi": "Бесконечные слёзы Враджаваси",
    "late evening": "Поздний вечер",
    "solar eclipse": "Солнечное затмение",
    "unalloyed happiness": "Беспримесное счастье",
    "freedom from anxiety": "Свобода от тревог",
}

PRAYERS: dict = {}


def d1(sql, params=None):
    req = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/d1/database/{DB}/query",
        data=json.dumps({"sql": sql, "params": params or []}).encode(),
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            body = json.loads(r.read())
    except urllib.error.HTTPError as e:                 # ЗКН-Ф014: не падать молча
        print("::error::D1 %s: %s" % (e.code, e.read().decode()[:300]))
        raise
    if not body.get("success"):
        print("::error::D1: %s" % json.dumps(body.get("errors"))[:300])
        raise SystemExit(1)
    return body["result"][0]["results"]


def translit_ru(s: str) -> str:
    return " ".join(w if not LAT.search(w) else translit_word(w) for w in s.split())


def key(s: str) -> str:
    s = (s or "").lower()
    for a, b in (("ā","a"),("ī","i"),("ū","u"),("ṛ","r"),("ṣ","s"),("ś","s"),("ṅ","n"),
                 ("ñ","n"),("ṭ","t"),("ḍ","d"),("ṇ","n"),("ṁ","m"),("ḥ","h"),("ḷ","l")):
        s = s.replace(a, b)
    s = re.sub(r"[^a-zа-яё0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def make_title(fname: str, artist_ru: str, artist_lat: str = "") -> str:
    """СТАНДАРТ (утв. основателем 13.07.2026):

        <Исполнитель>. <Название>

        Acyuta Gopi Devi Dasi Kirtan 01   →  Ачьюта Гопи Деви Даси. Киртан 01
        Aindra Das - Jaya Radha-Madhava   →  Аиндра Дас. Джайа Радха Мадхава
        Gour Govinda Swami - Parama Karuna → Гоур Говинда Свами Махарадж. Парама Каруна

    Имя исполнителя НЕ вырезается, а СТАВИТСЯ ВПЕРЕДИ — и берётся из реестра
    (там, где есть карточка героя, — её каноническое имя). Из имени файла оно
    убирается, чтобы не задвоиться.

    Названия нет вовсе (569 файлов из 1110 — это «Исполнитель Kirtan 01») —
    так и пишем: «Киртан 01». Номер как в файле, без «№».
    """
    s = EXT.sub("", fname or "").replace("_", " ")
    s = re.sub(r"\s+", " ", s).strip()

    # ДАТА — вынимаем до всякой резки, иначе её съест фильтр номеров.
    date = ""
    m = DATE.search(s)
    if m:
        dd, mm, yy = m.groups()
        date = "%02d.%02d.%s" % (int(dd), int(mm), yy[-2:])
        s = s[: m.start()] + " " + s[m.end():]

    # ИМЯ ИСПОЛНИТЕЛЯ ИЗ ФАЙЛА — вон (оно встанет впереди из реестра).
    # Резать надо ЛАТИНСКИМ вариантом: русское имя из базы («Ачьюта Гопи Деви
    # Даси») с латиницей в файле («Acyuta Gopi Devi Dasi») не совпадает.
    for nm in (artist_lat, artist_ru):
        if not nm:
            continue
        s = re.sub(r"^\s*" + re.escape(nm) + r"\s*[.\-–—:,]*\s*", "", s, flags=re.I)
        for w in sorted(set(nm.split()), key=len, reverse=True):
            if len(w) >= 4:
                s = re.sub(r"\b" + re.escape(w) + r"\w*", " ", s, flags=re.I)

    # НОМЕР — как в файле («01»), без «№».
    num = ""
    mn = NUM.search(s)
    if mn:
        num = mn.group(1)
        s = s[: mn.start()] + " " + s[mn.end():]

    had_kirtan = bool(re.search(r"\b(kirtan|kirtana|киртан)\b", s, re.I))
    s = NOISE.sub(" ", s)
    s = re.sub(r"[\s.,\-–—_|()+&:]+", " ", s).strip()

    core = ""
    if s:
        k = key(s)
        if k in PRAYERS:
            core = PRAYERS[k]                 # канон молитвенника приложения
        elif k in EN_TITLES:
            core = EN_TITLES[k]               # английское — переведено поимённо
        elif EN_WORDS.search(s):
            core = s                          # незнакомый английский оборот — как есть:
                                              # мусорная транслитерация хуже латиницы
        elif LAT.search(s):
            core = translit_ru(s)             # санскрит — передаём звучание
        else:
            core = s[0].upper() + s[1:]
    if not core or len(core) < 2:
        core = "Киртан"                       # названия не было — так и говорим

    tail = core
    if num:
        tail += " " + num
    if date:
        tail += " " + date
    return ((artist_ru + ". ") if artist_ru else "") + tail


# ═══ ПРАВИЛА ИМЁН (утв. основателем 13.07.2026) ═══
#
#   • «Прабху» → «Дас».
#   • «Свами» и «Госвами» пишутся ВСЕГДА с «Махарадж».
#   • «Киртания ИСККОН» в названиях НЕ ПИШЕТСЯ (сборник — не исполнитель).
#
# Список ниже — имена, названные основателем ПОИМЁННО. Он старше правил:
# «Пурначандра Дас Госвами» стоит без «Махарадж», и так и остаётся.
ARTIST_CANON = {
    "sarvatma": "Сарватма Дас",
    "achuta-priya-prabhu": "Ачьюта Прийа Дас",
    "gour-govinda-swami": "Гоур Говинда Свами Махарадж",
    "niranjana-swami": "Ниранджана Свами Махарадж",
    "bhakti-vijiana-goswami": "Бхакти Вигьяна Госвами Махарадж",
    "shivarama-swami": "Шиварама Свами Махарадж",
    "acyuta-gopi-devi-dasi": "Ачьюта Гопи Деви Даси",
    "yamuna-devi-dasi": "Ямуна Деви Даси",
    "sundarangi-devi-dasi": "Сундаранги Деви Даси",
    "mukunda-prabhu": "Мукунда Дас",
    "ananda-vardhana-swami": "Ананда Вардхана Свами Махарадж",
    "purnachandra-das-goswami": "Пурначандра Дас Госвами",   # без «Махарадж» — слово основателя
    "saci-suta-prabhu": "Шачи Сута Дас",
    "sulochana-prabhu": "Сулочана Дас",
    "bhakti-bringa-govinda-swami": "Бхакти Бринга Говинда Свами Махарадж",
    "thakur-haridas-prabhu": "Тхакур Харидас Дас",
    "radha-govinda-prabhu": "Радха Говинда Дас",
    "aindra": "Аиндра Дас",
    "srila-prabhupada": "Шрила Прабхупада",
}

# Сборник — не исполнитель. Его имя в названии дорожки не появляется.
NO_PREFIX = {"various"}

TITLES_SW = re.compile(r"\b(Свами|Госвами)\b")


def canon_name(slug: str, name: str) -> str:
    """Правила основателя. Поимённый список старше правил."""
    if slug in ARTIST_CANON:
        return ARTIST_CANON[slug]
    n = (name or "").strip()
    if not n:
        return n
    n = re.sub(r"\bПрабху\b", "Дас", n)                    # Прабху → Дас
    if TITLES_SW.search(n) and "Махарадж" not in n:          # Свами/Госвами → с Махарадж
        n = n.rstrip(" .") + " Махарадж"
    return re.sub(r"\s+", " ", n).strip()


def main() -> int:
    global PRAYERS
    for r in d1("SELECT name, translit_name FROM prayers WHERE name IS NOT NULL"):
        for k in (r.get("translit_name"), r.get("name")):
            if k:
                PRAYERS.setdefault(key(k), r["name"])
    print("::notice::молитвенник для сверки: %d имён" % len(PRAYERS))

    # имена исполнителей — по правилам основателя
    fixed = 0
    for a in d1("SELECT slug, name FROM kirtan_artists"):
        c = canon_name(a["slug"], a["name"])
        if c and c != a["name"]:
            d1("UPDATE kirtan_artists SET name=?2 WHERE slug=?1", [a["slug"], c])
            fixed += 1
    print("::notice::имён исправлено: %d" % fixed)
    artists = {a["slug"]: a["name"] for a in d1("SELECT slug, name FROM kirtan_artists")}
    lat = {}
    mp = Path(__file__).parent / "kirtans_map.json"
    if mp.exists():
        for a in json.loads(mp.read_text(encoding="utf-8"))["artists"]:
            lat[a["slug"]] = a.get("name_channel") or ""

    # ── ПЕРЕСТАНОВКА ДОРОЖЕК К ПРАВИЛЬНЫМ ИСПОЛНИТЕЛЯМ ──
    #
    # Порог «от 3 записей» сбросил в сборник тех, кого основатель назвал поимённо
    # (Хави Дас, Киртан Преми Дас, Мадхурика Деви Даси…). Переливать 42 ГБ ради
    # этого НЕ НАДО: элемент archive.org может остаться общим, а исполнитель у
    # дорожки — это поле в базе. Ставим правильного по msg_id из карты.
    by_msg = {}
    if mp.exists():
        for a in json.loads(mp.read_text(encoding="utf-8"))["artists"]:
            for mid in a.get("msg_ids", []):
                by_msg[mid] = a["slug"]
    moved = 0
    for t in d1("SELECT id, msg_id, artist_slug FROM kirtan_tracks WHERE msg_id IS NOT NULL"):
        want = by_msg.get(t["msg_id"])
        if want and want != t["artist_slug"] and want in artists:
            d1("UPDATE kirtan_tracks SET artist_slug=?2 WHERE id=?1", [t["id"], want])
            moved += 1
    print("::notice::дорожек переставлено к своему исполнителю: %d" % moved)

    tracks = d1("SELECT id, file, artist_slug, title FROM kirtan_tracks")
    print("::notice::дорожек: %d" % len(tracks))

    changed = 0
    for t in tracks:
        pref = "" if t["artist_slug"] in NO_PREFIX else artists.get(t["artist_slug"], "")
        new = make_title(t["file"], pref, lat.get(t["artist_slug"], "") or artists.get(t["artist_slug"], ""))
        if new and new != t["title"]:
            d1("UPDATE kirtan_tracks SET title=?2 WHERE id=?1", [t["id"], new])
            changed += 1
    print("::notice::переименовано: %d" % changed)
    for t in d1("SELECT title FROM kirtan_tracks ORDER BY id LIMIT 20"):
        print("::notice::  %s" % t["title"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
