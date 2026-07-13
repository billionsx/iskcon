#!/usr/bin/env python3
"""
kirtans_sync.py — СВЕДЕНИЕ исполнителей канала с реестром личностей и с D1.

ЗАЧЕМ.

В канале имена латиницей и вразнобой: «Niranjana Swami», «HH Niranjana Swami»,
«Ниранджана Свами». В приложении всё по-русски. Русское имя ВЫДУМЫВАТЬ НЕЛЬЗЯ
(BBT-точность) — но его и не надо: у 706 личностей в реестре уже есть выверенные
русские имена. Значит имя берётся ОТТУДА, а не сочиняется здесь.

    Niranjana Swami        → герой `niranjana-swami`      → «Ниранджана Свами Махарадж»
    Bhakti Vijiana Goswami → герой `bhakti-vijnana-goswami` → «Бхакти Вигьяна Госвами Махарадж»

Заодно это и есть «синхронизация с героями», о которой просил основатель:
`kirtan_artists.entity_id` → карточка личности. Одно имя — один человек — одна
карточка, а не два разных «Ниранджаны» в разных углах приложения.

ЧЕГО НЕ ДЕЛАЕМ. Не придумываем русское имя тому, кого нет в реестре личностей.
Такой исполнитель получает транслитерацию по стандартным правилам и помечается
`needs_review: true` — чтобы его было видно, а не чтобы он тихо жил с кривым именем.

Команды:
    match     — сверить реестр канала с личностями, записать kirtans_map.json
    register  — записать исполнителей в D1 (kirtan_artists), связав с героями
"""
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from kirtans_plan import key_of, fix_mojibake  # noqa: E402

HERE = Path(__file__).parent
ACCOUNT = "d5cbe19470dc38599873eabfe148e6d1"
DB = "6226aded-dd03-4e74-977f-9cd0b509e73d"
TOKEN = os.getenv("CLOUDFLARE_API_TOKEN") or ""

# Транслитерация для тех, кого НЕТ в реестре личностей. Не «перевод» — механическая
# передача звучания по правилам, принятым в русском вайшнавском обиходе.
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


def translit_ru(name: str) -> str:
    out = []
    name = re.sub(r"^\s*(HH|HG|His Holiness|His Grace)\s+", "", fix_mojibake(name), flags=re.I)
    for word in name.split():
        if re.search(r"[А-Яа-яЁё]", word):     # уже по-русски
            out.append(word)
            continue
        w = word.lower()
        for a, b in TR:
            w = w.replace(a, b)
        out.append(w.capitalize())
    return " ".join(out)


def d1(sql: str, params=None):
    req = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/d1/database/{DB}/query",
        data=json.dumps({"sql": sql, "params": params or []}).encode(),
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            body = json.loads(r.read())
    except urllib.error.HTTPError as e:              # ЗКН-Ф014: не падать молча
        print("::error::D1 %s: %s" % (e.code, e.read().decode()[:400]))
        raise
    if not body.get("success"):
        print("::error::D1: %s" % json.dumps(body.get("errors"))[:400])
        raise SystemExit(1)
    return body["result"][0]["results"]


def slugify(name: str) -> str:
    # ⚠️ «HH Bhaktivaibhava Swami» давал слаг `hh-bhaktivaibhava-swami`, а слаг —
    #    это ВЕЧНЫЙ адрес элемента на archive.org. Обращение в адрес не пускаем.
    s = re.sub(r"^\s*(hh|hg|his holiness|his grace|е\s*с|е\s*м|шрила|шри)\b[\s.\-]*",
               "", fix_mojibake(name).strip(), flags=re.I)
    s = s.lower()
    s = "".join(
        {"а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ё":"e","ж":"zh","з":"z","и":"i",
         "й":"y","к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r","с":"s","т":"t",
         "у":"u","ф":"f","х":"h","ц":"ts","ч":"ch","ш":"sh","щ":"sch","ъ":"","ы":"y",
         "ь":"","э":"e","ю":"yu","я":"ya"}.get(c, c) for c in s)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return re.sub(r"-{2,}", "-", s)[:48] or "artist"


# ── ЯВНЫЕ СИНОНИМЫ. Транслитерация их не сводит: «Vijiana»/«Vijnana»,
#    «Indradumna»/«Indradyumna», «Bringa»/«Bhrnga». Пишем руками — это канон,
#    а не догадка. Ключ слева (как выходит из key_of) → ключ справа.
ALIAS = {
    # ⚠️ Ключи ВЫЧИСЛЕНЫ (key_of), а не написаны на глаз. Первая попытка была на
    #    глаз — и ни один синоним не сошёлся: Индрадьюмна остался тремя строками.
    "indradumn": "indradiumn",              # Indradumna → Indradyumna
    # Б.Б. Говинда Свами = Бхакти Бхринга Говинда Свами. ОДИН человек, три написания.
    "bhakti bring govind": "bhakti bhrng govind",
    "b govind": "bhakti bhrng govind",
    "b b govind": "bhakti bhrng govind",
    # Бхакти Вигьяна Госвами: Vijiana → Vijnana
    "bhakti vian": "bhakti vinan",
}

# ── НЕ ИСПОЛНИТЕЛИ. Это названия песен и рубрик, просочившиеся в имя файла.
NOT_ARTIST_KEYS = {
    # «Дже Анило Према Дхана» — это БХАДЖАН Нароттамы даса Тхакура, а не киртания.
    # Имя песни просочилось в поле имени файла и стало «исполнителем».
    "ie anilo prem dhan",
    "gaurang", "x iagi", "sounds",
}

# ── «ЭТО ВООБЩЕ ЧЕЛОВЕК?»
#
# Я записал в базу 140 «исполнителей» — и десятки из них людьми не были:
#
#     «01 Мелодй Оф Гоур Говинда Свами Махарадж»          ← название дорожки
#     «2023.12.01 Бб Говинда Свами»                        ← дата
#     «Е С Индрадьюмна Свами Киртан Бхакти Сангама»        ← название события
#     «Радхе Говинда Спечиал | Ачюта Гопи Дай 1 Финал…»    ← афиша
#
# Все они прошли, потому что проверки НЕ БЫЛО. Слаг такого «исполнителя» ушёл бы
# в АДРЕС НА archive.org — а он вечный. Признаки не-человека простые и жёсткие:
EVENT_WORDS = re.compile(
    r"\b(бхакти\s*сангама|bhakti\s*sangama|киртан\s*мела|kirtan\s*mela|фестивал|festival|"
    r"финал|final|day\s*\d|дай\s*\d|нон[\s-]*стоп|non[\s-]*stop|special|спечиал|мелод|melody|"
    r"вечерний|утренний|live|запис)\b", re.I)


def is_person(name: str) -> bool:
    s = fix_mojibake(name or "").strip()
    if not s or len(s) < 3:
        return False
    if re.search(r"\d", s):                 # в имени человека цифр не бывает
        return False
    if "|" in s or "&" in s:                # афиша, а не имя
        return False
    if EVENT_WORDS.search(s):               # название события
        return False
    words = [w for w in re.split(r"[\s.]+", s) if w]
    if len(words) > 5:                      # имя длиннее пяти слов = утекло название
        return False
    if len(words) == 1 and len(s) < 5:
        return False
    return True


# ── ЗАЩИТА ОТ ЛОЖНОЙ ПРИВЯЗКИ.
#
# «Mukunda Prabhu» (киртания) автоматом привязался к герою «Мукунда Госвами»
# (ачарья ИСККОН). Это РАЗНЫЕ ЛЮДИ. Односложный ключ («mukunda», «sulochana»,
# «gauranga») совпадает у десятка человек — по нему связывать НЕЛЬЗЯ.
#
# Ложная привязка хуже отсутствующей: она врёт уверенно. Связываем только по
# ключу из ДВУХ И БОЛЕЕ слов; односложные оставляем без героя и помечаем.
def linkable(key: str) -> bool:
    return len(key.split()) >= 2


def cmd_match() -> int:
    roster = json.loads((HERE / "kirtans_roster.json").read_text(encoding="utf-8"))
    heroes = d1(
        """SELECT e.id,
                  (SELECT value FROM entity_names WHERE entity_id=e.id AND lang='ru' LIMIT 1) AS ru,
                  (SELECT value FROM entity_names WHERE entity_id=e.id AND lang='en' LIMIT 1) AS en
           FROM entities e WHERE e.type='personality' AND e.status='published'"""
    )
    # ключ героя строим ТЕМ ЖЕ key_of, что и ключ исполнителя, — иначе не сойдутся
    by_key = {}
    for h in heroes:
        for nm in (h.get("en"), h.get("ru")):
            k = key_of(nm or "")
            if k and k not in by_key:
                by_key[k] = h

    existing = {r["slug"]: r for r in d1("SELECT slug, name, role, entity_id FROM kirtan_artists")}
    by_ekey = {key_of(r["name"]): s for s, r in existing.items()}

    out, linked, reviewed, dropped = [], 0, 0, 0
    for a in roster["artists"]:
        if a["n"] < 1 or a["key"] in NOT_ARTIST_KEYS:
            continue
        if not is_person(a["display"]):
            dropped += 1
            continue
        k = ALIAS.get(a["key"], a["key"])
        hero = by_key.get(k) if linkable(k) else None
        # исполнитель уже есть в D1? тогда его slug и имя — главные (правка основателя)
        slug = by_ekey.get(k) or slugify(a["display"])
        cur = existing.get(slug)

        if cur:
            ru = cur["name"]
        elif hero and hero.get("ru"):
            ru = hero["ru"]
        else:
            ru = translit_ru(a["display"])

        rec = {
            "slug": slug,
            "name_ru": ru,
            "name_channel": a["display"],
            "key": k,
            "entity_id": (cur or {}).get("entity_id") or (hero["id"] if hero else None),
            "hero_ru": hero.get("ru") if hero else None,
            "n_files": a["n"],
            "gb": round(a["bytes"] / 1e9, 2),
            "msg_ids": a["msg_ids"],
            "existing": bool(cur),
            "needs_review": not hero and not cur,
        }
        if rec["entity_id"]:
            linked += 1
        if rec["needs_review"]:
            reviewed += 1
        out.append(rec)

    dest = HERE / "kirtans_map.json"
    dest.write_text(json.dumps({"artists": out, "unresolved": roster["unresolved"]},
                               ensure_ascii=False, indent=1), encoding="utf-8")
    print("::notice::СВЕДЕНО: %d исполнителей · с героем: %d · без героя (на проверку): %d · отсеяно не-людей: %d"
          % (len(out), linked, reviewed, dropped))
    for r in sorted(out, key=lambda x: -x["n_files"])[:40]:
        mark = "герой" if r["entity_id"] else "—"
        print("::notice::  %4d  %5.2f ГБ  %-28s  %-30s  %s"
              % (r["n_files"], r["gb"], r["name_ru"][:28], r["name_channel"][:30], mark))
    return 0


def cmd_register() -> int:
    m = json.loads((HERE / "kirtans_map.json").read_text(encoding="utf-8"))
    n = 0
    floor = int(os.getenv("MIN_FILES") or "3")
    for r in m["artists"]:
        if r["n_files"] < floor:            # одиночки — почти всегда обрывки, не люди
            continue
        d1(
            """INSERT INTO kirtan_artists (slug, name, role, entity_id, sort)
               VALUES (?1, ?2, ?3, ?4, ?5)
               ON CONFLICT(slug) DO UPDATE SET
                 entity_id = COALESCE(kirtan_artists.entity_id, excluded.entity_id),
                 sort      = excluded.sort""",
            [r["slug"], r["name_ru"], "Киртания", r["entity_id"], 1000 - min(r["n_files"], 999)],
        )
        n += 1
    print("::notice::в D1 записано исполнителей: %d" % n)
    return 0


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "match"
    sys.exit(cmd_match() if cmd == "match" else cmd_register())
