#!/usr/bin/env python3
"""
plan.py — КАРТА ЗАЛИВКИ: каталог goswami.ru → циклы, имена файлов, названия.

═══ ПОЧЕМУ КАРТА ОТДЕЛЬНО ОТ ЗАЛИВКИ (ЗКН-Пл010) ═══

Название на сайте — это не название дорожки в плеере, а адрес файла — не имя
файла в архиве:

    «Bhagavad-gita 15.5»                    латиница вперемешку с нашим каноном
    «Смена научной парадигмы. Лекция 11»    цикл, у которого 11 частей
    «Слава месяца Пурушоттама (дополнение)» довесок к соседней записи

Такое нельзя ни положить в archive.org (кириллица в URL), ни показать человеку
как есть. Поэтому карта строится ОТДЕЛЬНЫМ шагом, КОММИТИТСЯ в репозиторий и
её видно глазами ДО того, как поедут гигабайты. Заливка потом только исполняет.

═══ КАК СОБИРАЮТСЯ ЦИКЛЫ ═══

Катха — повествование, живущее ЧАСТЬЮ ЦИКЛА (см. katha.ts). У лектора циклы
разной природы, и каждая узнаётся своим признаком:

  1. ЯВНЫЙ ЦИКЛ   «Смена научной парадигмы. Лекция 11» → цикл + номер части.
                  Признак — хвост «Лекция/Часть/Занятие/Урок N».
  2. ПИСАНИЕ      «Bhagavad-gita 15.5», «Srimad-Bhagavatam 3.24.13» → цикл по
                  книге, а у большой книги — по песни/главе, иначе в одном
                  цикле окажется полторы тысячи записей и он станет свалкой.
                  Порядок внутри — по СТИХУ, а не по дате: это чтение книги.
  3. СОБЫТИЕ      «Лекция на Рама-навами», «Брахмотсава…» → цикл по празднику.
  4. ОСТАЛЬНОЕ    по году: «Лекции 2019». Год — честная опора, когда другой нет.

Пороги (сколько записей делает книгу «большой») стоят рядом с кодом и печатаются
в отчёте: карта обязана быть проверяемой, а не «на глаз».

Вход:  docs/diagnostics/goswami-catalog.json
Выход: tools/goswami/goswami_plan.json + сводка в лог
"""
import json
import os
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).parent
CATALOG = Path(os.getenv("CATALOG") or (HERE.parent.parent / "docs" / "diagnostics" / "goswami-catalog.json"))
OUT = Path(os.getenv("PLAN") or (HERE / "goswami_plan.json"))

SPEAKER = "bhakti-vijnana-goswami"
SPEAKER_NAME = "Бхакти Вигьяна Госвами Махарадж"
IA_PREFIX = "iskcone-katha-bvg-"

# книга крупнее этого порога дробится на песни/главы, иначе цикл станет свалкой
SPLIT_AT = int(os.getenv("SPLIT_AT") or 80)
# цикл мельче этого не заводится — записи уходят в годовой
MIN_ALBUM = int(os.getenv("MIN_ALBUM") or 2)

MONTHS = {1: "января", 2: "февраля", 3: "марта", 4: "апреля", 5: "мая", 6: "июня",
          7: "июля", 8: "августа", 9: "сентября", 10: "октября", 11: "ноября", 12: "декабря"}

# ─────────────────────── транслитерация ────────────────────
TRANS = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e", "ж": "zh",
    "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o",
    "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "h", "ц": "ts",
    "ч": "ch", "ш": "sh", "щ": "sch", "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu",
    "я": "ya",
}


def slugify(s: str, limit: int = 46) -> str:
    s = (s or "").lower().strip()
    s = unicodedata.normalize("NFKD", s)
    out = []
    for ch in s:
        if ch in TRANS:
            out.append(TRANS[ch])
        elif ch.isascii() and (ch.isalnum()):
            out.append(ch)
        elif ch in " -_/·.,:;()[]«»\"'":
            out.append("-")
    r = re.sub(r"-+", "-", "".join(out)).strip("-")
    r = re.sub(r"[^a-z0-9-]", "", r)
    return r[:limit].strip("-") or "lek"


# ───────────────────── канон названий книг ──────────────────
# Латинские и сокращённые формы приводятся к канону приложения
# (docs/STANDARD_scripture_terms.md), иначе в витрине окажется «Bhagavad-gita».
SCRIPTURES = [
    (r"^(?:шримад[\s-]*бхагаватам|srimad[\s-]*bhagavatam|sb|шб)\b", "Шримад-Бхагаватам", "sb", "Песнь"),
    (r"^(?:бхагавад[\s-]*гита|bhagavad[\s-]*gita|bg|бг)\b", "Бхагавад-гита", "bg", "Глава"),
    (r"^(?:чайтанья[\s-]*чаритамрита|sri[\s-]*caitanya[\s-]*caritamrta|caitanya[\s-]*caritamrta|cc|чч)\b",
     "Шри Чайтанья-чаритамрита", "cc", "Глава"),
    (r"^(?:нектар[\s-]*преданности|nectar[\s-]*of[\s-]*devotion|nod)\b", "Нектар преданности", "nod", "Глава"),
    (r"^(?:нектар[\s-]*наставлений|nectar[\s-]*of[\s-]*instruction|noi|упадешамрита|upadesamrta)\b",
     "Нектар наставлений", "noi", "Стих"),
    (r"^(?:шри[\s-]*ишопанишад|sri[\s-]*isopanisad|isopanisad|ишопанишад)\b", "Шри Ишопанишад", "iso", "Мантра"),
    (r"^(?:брахма[\s-]*самхита|brahma[\s-]*samhita)\b", "Брахма-самхита", "bs", "Стих"),
    (r"^(?:шикшаштака|siksastaka|шикшаштакам)\b", "Шикшаштака", "siksa", "Стих"),
    (r"^(?:бхакти[\s-]*расамрита[\s-]*синдху|bhakti[\s-]*rasamrta[\s-]*sindhu|брс)\b",
     "Бхакти-расамрита-синдху", "brs", "Волна"),
]
REF_RX = re.compile(r"([\d]+(?:[.\-–][\d]+)*)")

SERIES_RX = re.compile(
    r"^(?P<name>.+?)[\s.,–—-]*(?:лекция|часть|занятие|урок|беседа|семинар|встреча)\s*№?\s*(?P<n>\d{1,3})\s*"
    r"(?P<tail>\(.*\))?\s*$", re.I)
SERIES_RX2 = re.compile(r"^(?P<name>.+?)[\s.,–—-]+(?P<n>\d{1,2})\s*$")

EVENTS = [
    ("Рама-навами", r"рама[\s-]*навами"),
    ("Гаура-пурнима", r"гаура[\s-]*пурнима"),
    ("Джанмаштами", r"джанмашт"),
    ("Радхаштами", r"радхашт"),
    ("Нрисимха-чатурдаши", r"нрисимха[\s-]*чатурдаши"),
    ("Говардхана-пуджа", r"говардхана[\s-]*пуджа"),
    ("Картика", r"картик"),
    ("Вьяса-пуджа", r"вьяса[\s-]*пуджа"),
    ("Day of Disappearance", r"уход[аи]?\b|disappearance"),
    ("Инициация", r"посвящен|инициац"),
    ("Экадаши", r"экадаши"),
    ("Ретрит", r"ретрит"),
    ("Джапа-медитация", r"джапа|повторени[ея] святого имени"),
]


def norm_title(t: str) -> str:
    t = re.sub(r"\s+", " ", (t or "").strip())
    return t


def scripture_of(title: str):
    low = title.lower()
    for rx, name, code, unit in SCRIPTURES:
        if re.match(rx, low):
            rest = re.sub(rx, "", low, count=1).strip(" .:-–—")
            m = REF_RX.match(rest)
            ref = m.group(1) if m else ""
            return name, code, unit, ref
    return None


def parse_date(s):
    if not s:
        return None
    m = re.search(r"(\d{4})-(\d{2})-(\d{2})", str(s))
    if m:
        return tuple(int(x) for x in m.groups())
    m = re.search(r"(\d{2})[./](\d{2})[./](\d{4})", str(s))
    if m:
        d, mo, y = (int(x) for x in m.groups())
        return (y, mo, d)
    return None


def human_date(d):
    if not d:
        return ""
    y, m, dd = d
    return "%d %s %d" % (dd, MONTHS.get(m, ""), y)


def ref_sort(ref: str) -> int:
    """Числовой ключ порядка по ссылке на стих: 3.24.13 → 3_024_013."""
    parts = re.split(r"[.\-–]", ref or "")
    key = 0
    for p in parts[:4]:
        try:
            key = key * 1000 + int(p)
        except ValueError:
            key = key * 1000
    return key


def ref_file(code: str, ref: str) -> str:
    parts = [p for p in re.split(r"[.\-–]", ref or "") if p.isdigit()]
    if not parts:
        return code
    return code + "-" + "-".join(p.zfill(2) for p in parts)


# ───────────────────────── разбор ──────────────────────────
def classify(lec: dict):
    """Куда запись попадёт: (тип, ключ цикла, название цикла, ключ сортировки, имя файла-основа)."""
    title = norm_title(lec.get("title"))
    d = parse_date(lec.get("date"))
    year = d[0] if d else None

    sc = scripture_of(title)
    if sc:
        name, code, unit, ref = sc
        head = ref.split(".")[0] if ref else ""
        return ("scripture", (code, head), name, ref_sort(ref), ref_file(code, ref),
                {"unit": unit, "code": code, "ref": ref, "book": name})

    m = SERIES_RX.match(title) or SERIES_RX2.match(title)
    if m:
        base = norm_title(m.group("name")).strip(" .,–—-")
        if len(base) >= 4:
            n = int(m.group("n"))
            return ("series", ("s", base.lower()), base, n, "%s-%s" % (slugify(base, 28), str(n).zfill(2)),
                    {"n": n})

    low = title.lower()
    for label, rx in EVENTS:
        if re.search(rx, low):
            return ("event", ("e", label), label, (year or 0) * 10000 + (d[1] * 100 + d[2] if d else 0),
                    "%s-%s" % (slugify(label, 24), (("%04d%02d%02d" % d) if d else "x")), {})

    return ("year", ("y", year or 0), "Лекции %s" % (year or "без даты"),
            (d[1] * 100 + d[2]) if d else 0,
            "%s-%s" % (year or "x", ("%02d%02d" % (d[1], d[2])) if d else slugify(title, 16)), {})


def main() -> int:
    if not CATALOG.exists():
        print("::error::нет каталога %s — сначала catalog.py" % CATALOG)
        return 1
    cat = json.loads(CATALOG.read_text(encoding="utf-8"))
    lectures = cat["lectures"] if isinstance(cat, dict) else cat
    print("каталог: %d записей" % len(lectures))

    with_audio = [x for x in lectures if x.get("file_url")]
    print("со звуком: %d · без звука: %d" % (len(with_audio), len(lectures) - len(with_audio)))

    # 1. раскладка по предварительным ключам
    buckets = defaultdict(list)
    meta = {}
    for lec in with_audio:
        kind, key, name, sortk, fbase, extra = classify(lec)
        buckets[key].append((lec, kind, name, sortk, fbase, extra))
        meta[key] = (kind, name)

    # 2. книги: мелкие собираем целиком, крупные — по песни/главе
    bybook = defaultdict(list)
    for key, items in list(buckets.items()):
        if meta[key][0] == "scripture":
            bybook[key[0]].append(key)
    merged = {}
    for code, keys in bybook.items():
        total = sum(len(buckets[k]) for k in keys)
        if total < SPLIT_AT:                       # книга небольшая — один цикл
            allitems = []
            for k in keys:
                allitems += buckets.pop(k)
            newkey = (code, "")
            buckets[newkey] = allitems
            meta[newkey] = ("scripture", allitems[0][2])
            merged[code] = ("целиком", total)
        else:
            merged[code] = ("по частям (%d)" % len(keys), total)

    # 3. мелочь → в годовые
    for key, items in list(buckets.items()):
        if meta[key][0] in ("series", "event") and len(items) < MIN_ALBUM:
            for it in buckets.pop(key):
                lec = it[0]
                d = parse_date(lec.get("date"))
                y = d[0] if d else 0
                nk = ("y", y)
                buckets[nk].append((lec, "year", "Лекции %s" % (y or "без даты"),
                                    (d[1] * 100 + d[2]) if d else 0,
                                    "%s-%s" % (y or "x", ("%02d%02d" % (d[1], d[2])) if d else slugify(lec.get("title", ""), 16)),
                                    {}))
                meta[nk] = ("year", "Лекции %s" % (y or "без даты"))

    # 4. сборка альбомов
    albums = []
    used_ids, used_ident = set(), set()
    for key, items in buckets.items():
        kind, _ = meta[key]
        items.sort(key=lambda x: (x[3], norm_title(x[0].get("title"))))
        first = items[0]
        if kind == "scripture":
            book = first[5]["book"]
            unit = first[5]["unit"]
            head = key[1]
            title = "%s · %s %s" % (book, unit, head) if head else book
            aid = slugify("%s-%s" % (first[5]["code"], head or "all"), 40)
        elif kind == "series":
            title = first[2]
            aid = slugify(title, 40)
        elif kind == "event":
            title = first[2]
            aid = slugify("prazdnik-" + title, 40)
        else:
            title = first[2]
            aid = slugify(title, 40)

        base_id, k = aid, 2
        while aid in used_ids:
            aid = "%s-%d" % (base_id, k)
            k += 1
        used_ids.add(aid)
        ident = IA_PREFIX + aid
        while ident in used_ident:
            ident = "%s-%d" % (IA_PREFIX + aid, k)
            k += 1
        used_ident.add(ident)

        years = sorted({(parse_date(x[0].get("date")) or (0,))[0] for x in items if parse_date(x[0].get("date"))})
        tracks, seen_files = [], set()
        for i, (lec, _k, _n, sortk, fbase, extra) in enumerate(items, 1):
            fname = "%s.mp3" % slugify(fbase, 56)
            if fname in seen_files:
                fname = "%s-%d.mp3" % (slugify(fbase, 52), i)
            seen_files.add(fname)
            d = parse_date(lec.get("date"))
            t = norm_title(lec.get("title"))
            if kind == "scripture":
                ttl = t
            elif kind == "series":
                ttl = "Лекция %d" % extra.get("n", i)
            else:
                ttl = t
            place = (lec.get("place") or "").strip()
            note = " · ".join([x for x in (human_date(d), place) if x])
            if note and kind != "year":
                ttl = "%s · %s" % (ttl, note) if kind == "series" else ttl
            if kind == "year":
                ttl = "%s · %s" % (t, note) if note else t
            tracks.append({
                "url": lec.get("file_url"),
                "file": fname,
                "title": ttl[:180],
                "duration": int(lec.get("duration") or 0),
                "sort": i,
                "src_id": lec.get("id"),
                "src_page": lec.get("page"),
                "date": ("%04d-%02d-%02d" % d) if d else None,
                "place": place or None,
                "video_url": lec.get("video_url") or None,
            })

        albums.append({
            "id": aid, "speaker": SPEAKER, "title": title, "identifier": ident,
            "kind": kind,
            "year": ("%d–%d" % (years[0], years[-1])) if len(years) > 1 else (str(years[0]) if years else None),
            "note": None,
            "sort": 0,
            "tracks": tracks,
        })

    # порядок витрины: писания → циклы → праздники → годы (свежие выше)
    rank = {"scripture": 0, "series": 1, "event": 2, "year": 3}
    albums.sort(key=lambda a: (rank.get(a["kind"], 9), -len(a["tracks"]), a["title"]))
    for i, a in enumerate(albums, 1):
        a["sort"] = i

    plan = {
        "source": "goswami.ru",
        "speaker": SPEAKER,
        "speaker_name": SPEAKER_NAME,
        "speaker_full": "Его Святейшество Бхакти Вигьяна Госвами Махарадж",
        "speaker_role": "Лекции и катха",
        "speaker_sort": 0,
        "n_lectures": len(lectures),
        "n_with_audio": len(with_audio),
        "n_albums": len(albums),
        "albums": albums,
    }
    OUT.write_text(json.dumps(plan, ensure_ascii=False, indent=1), encoding="utf-8")

    total_h = sum(t["duration"] for a in albums for t in a["tracks"]) / 3600
    print("\n═══ КАРТА ═══")
    print("циклов: %d · записей: %d · звучание: %.0f ч" % (len(albums), len(with_audio), total_h))
    print("книги:", json.dumps(merged, ensure_ascii=False))
    by = defaultdict(int)
    for a in albums:
        by[a["kind"]] += len(a["tracks"])
    print("по типам:", dict(by))
    print("\n── крупнейшие циклы ──")
    for a in sorted(albums, key=lambda x: -len(x["tracks"]))[:30]:
        h = sum(t["duration"] for t in a["tracks"]) / 3600
        print("  %-46s %4d зап · %6.1f ч · %s" % (a["title"][:46], len(a["tracks"]), h, a["identifier"]))
    print("\n→ %s (%d КБ)" % (OUT, OUT.stat().st_size // 1024))
    return 0


if __name__ == "__main__":
    sys.exit(main())
