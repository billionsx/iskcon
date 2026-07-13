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

TR = [
    ("shh", "щ"), ("sch", "щ"), ("kh", "кх"), ("gh", "гх"), ("ch", "ч"), ("sh", "ш"),
    ("th", "тх"), ("ph", "пх"), ("bh", "бх"), ("dh", "дх"), ("jh", "джх"), ("zh", "ж"),
    ("ya", "я"), ("yu", "ю"), ("yo", "ё"), ("ye", "е"), ("ai", "ай"), ("au", "ау"),
    ("ee", "и"), ("oo", "у"), ("a", "а"), ("b", "б"), ("c", "ч"), ("d", "д"),
    ("e", "е"), ("f", "ф"), ("g", "г"), ("h", "х"), ("i", "и"), ("j", "дж"),
    ("k", "к"), ("l", "л"), ("m", "м"), ("n", "н"), ("o", "о"), ("p", "п"),
    ("q", "к"), ("r", "р"), ("s", "с"), ("t", "т"), ("u", "у"), ("v", "в"),
    ("w", "в"), ("x", "кс"), ("y", "й"), ("z", "з"),
]
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
    "prayers to the six gosvamis": "Молитвы шести Госвами",
    "prayers to the six goswamis": "Молитвы шести Госвами",
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
    "beyond cry vrajavasi": "Плач враджаваси",
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
    out = []
    for w in s.split():
        if not LAT.search(w):
            out.append(w)
            continue
        x = w.lower()
        for a, b in TR:
            x = x.replace(a, b)
        out.append(x.capitalize())
    return " ".join(out)


def key(s: str) -> str:
    s = (s or "").lower()
    for a, b in (("ā","a"),("ī","i"),("ū","u"),("ṛ","r"),("ṣ","s"),("ś","s"),("ṅ","n"),
                 ("ñ","n"),("ṭ","t"),("ḍ","d"),("ṇ","n"),("ṁ","m"),("ḥ","h"),("ḷ","l")):
        s = s.replace(a, b)
    s = re.sub(r"[^a-zа-яё0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def make_title(fname: str, artist_ru: str, artist_lat: str = "") -> str:
    s = EXT.sub("", fname or "").replace("_", " ")
    s = re.sub(r"\s+", " ", s).strip()

    # 1. ДАТА — вынимаем ДО всякой резки, иначе её съест фильтр номеров.
    date = ""
    m = DATE.search(s)
    if m:
        dd, mm, yy = m.groups()
        date = "%02d.%02d.%s" % (int(dd), int(mm), yy[-2:])
        s = s[: m.start()] + " " + s[m.end():]

    # 2. ИМЯ ИСПОЛНИТЕЛЯ — вон: оно уже стоит второй строкой.
    #    ⚠️ Резать надо ЛАТИНСКИМ вариантом ИЗ ФАЙЛА. Русское имя из базы
    #    («Ачюта Гопи Деви Даси») не совпадает с латиницей в файле («Acyuta Gopi
    #    Devi Dasi») — и имя оставалось в названии, дублируя вторую строку.
    for nm in (artist_lat, artist_ru):
        if not nm:
            continue
        s = re.sub(r"^\s*" + re.escape(nm) + r"\s*[.\-–—:,]*\s*", "", s, flags=re.I)
        for w in sorted(set(nm.split()), key=len, reverse=True):
            if len(w) >= 4:
                s = re.sub(r"\b" + re.escape(w) + r"\w*", " ", s, flags=re.I)

    # 3. НОМЕР
    num = ""
    mn = NUM.search(s)
    if mn:
        num = mn.group(1).lstrip("0") or mn.group(1)
        s = s[: mn.start()] + " " + s[mn.end():]

    s = NOISE.sub(" ", s)
    s = re.sub(r"[\s.,\-–—_|()+&:]+", " ", s).strip()

    # 4. РУССКОЕ ИМЯ — ИЗ МОЛИТВЕННИКА, а не из головы.
    core = ""
    if s:
        k = key(s)
        if k in PRAYERS:
            core = PRAYERS[k]                 # канон приложения
        elif k in EN_TITLES:
            core = EN_TITLES[k]               # английское — переведено поимённо
        elif EN_WORDS.search(s):
            core = s                          # незнакомый английский оборот — ОСТАВЛЯЕМ
                                              # латиницей: мусорная транслитерация хуже
        elif LAT.search(s):
            core = translit_ru(s)             # санскрит — передаём звучание
        else:
            core = s[0].upper() + s[1:]
    if not core or len(core) < 2:
        core = "Киртан"                       # названия не было вовсе — так и говорим

    tail = []
    if date:
        tail.append(date)
    if num:
        tail.append("№" + num)
    return core + (" · " + " · ".join(tail) if tail else "")


def main() -> int:
    global PRAYERS
    for r in d1("SELECT name, translit_name FROM prayers WHERE name IS NOT NULL"):
        for k in (r.get("translit_name"), r.get("name")):
            if k:
                PRAYERS.setdefault(key(k), r["name"])
    print("::notice::молитвенник для сверки: %d имён" % len(PRAYERS))

    artists = {a["slug"]: a["name"] for a in d1("SELECT slug, name FROM kirtan_artists")}
    lat = {}
    mp = Path(__file__).parent / "kirtans_map.json"
    if mp.exists():
        for a in json.loads(mp.read_text(encoding="utf-8"))["artists"]:
            lat[a["slug"]] = a.get("name_channel") or ""

    tracks = d1("SELECT id, file, artist_slug, title FROM kirtan_tracks")
    print("::notice::дорожек: %d" % len(tracks))

    changed = 0
    for t in tracks:
        new = make_title(t["file"], artists.get(t["artist_slug"], ""), lat.get(t["artist_slug"], ""))
        if new and new != t["title"]:
            d1("UPDATE kirtan_tracks SET title=?2 WHERE id=?1", [t["id"], new])
            changed += 1
    print("::notice::переименовано: %d" % changed)
    for t in d1("SELECT title FROM kirtan_tracks ORDER BY id LIMIT 20"):
        print("::notice::  %s" % t["title"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
