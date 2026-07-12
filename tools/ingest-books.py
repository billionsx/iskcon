#!/usr/bin/env python3
"""
УНИВЕРСАЛЬНЫЙ ИНГЕСТ КНИГ (ЗКН-Пр007 · ЗКН-БТ001 · ЗКН-Б007).

ПОЧЕМУ ОДИН ИНСТРУМЕНТ, А НЕ СЕМЬ СКРИПТОВ.

Каждая книга размечена по-своему, но ЗАКОНЫ у всех одни:
  • разбор сверяется с ОГЛАВЛЕНИЕМ книги, а не с моим представлением о ней
    (на «Чайтанья-бхагавате» мой «эталон» в 27 глав оказался домыслом: издание
    сокращённое, глав 12 — сверялся бы с домыслом, сломал бы разбор);
  • не сошлось — в базу НЕ пишем: партия верного лучше целого неверного;
  • «читать» появляется ТОЛЬКО когда текст реально внесён (ЗКН-Пр007);
  • книга, читаемая в D1, обязана быть в бандле, иначе читалка молча откроет
    «Бхагавад-гиту» (ЗКН-Б007).

ИЕРАРХИЯ ИСТОЧНИКОВ (свод). Вносятся только ПЕРВИЧНЫЕ — те, из которых можно
цитировать дословно. ВТОРИЧНЫЕ (Розен, Капур, «Жития святых»,
«Прабхупада-шикшамрита») — справочный материал для кузницы, НЕ книги библиотеки.
Внести их в библиотеку значило бы поставить пересказ вровень с первоисточником.
"""
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "docs" / "sources"

# ── книги цикла ──────────────────────────────────────────────────────────────
# expect = сколько глав ДОЛЖНО получиться. Берётся из САМОЙ книги (её оглавления
# или её же заголовков), а не из моих представлений.
BOOKS = [
    {
        # «Навадвипа-дхама-махатмья»: номер главы — СЛОВАМИ, и это КОЛОНТИТУЛ,
        # повторяющийся на каждой странице («Глава первая» ×164). Граница главы —
        # там, где НОМЕР МЕНЯЕТСЯ. Первый заход искал «Глава N» цифрой, нашёл
        # только оглавление (в конце файла) — и я решил, что структуры нет.
        # Она была: словами и в колонтитуле.
        "work": "ndm", "lang": "ru",
        "title": "Шри Навадвипа-дхама-махатмья",
        "author": "Шрила Бхактивинода Тхакур",
        "file": "dhama-lila/Bhaktivinoda_Navadvipa-Dhama-Mahatmya.txt",
        "chapter_word": True,          # номер словами, в колонтитуле
        "expect": 18,
        "abbr": "НДМ",
    },
    {
        "work": "br", "lang": "en",
        "title": "Бхакти-ратнакара",
        "author": "Шрила Нарахари Чакраварти",
        "file": "bhakti-ratnakara/Bhakti-Ratnakara.EN.txt",
        "chapter": r"^CHAPTER\s+(\d+)",
        "expect": 15,   # пятнадцать таранг (волн)
        "abbr": "БР",
    },
]

PAGE_RX = re.compile(r"^\[p\.\d+\]\s*")
# OCR-артефакт: «Ш р и л а Б х а к т и в и н о д а» — буквы через пробел.
SPACED = re.compile(r"^(?:\S\s){5,}\S\s*$")


def clean(line: str) -> str:
    """Снять пагинацию. Строку-артефакт OCR (буквы через пробел) — выбросить."""
    line = PAGE_RX.sub("", line).strip()
    if SPACED.match(line):
        return ""
    return line


ORD_WORD = {"первая": 1, "вторая": 2, "третья": 3, "четвёртая": 4, "четвертая": 4,
            "пятая": 5, "шестая": 6, "седьмая": 7, "восьмая": 8, "девятая": 9,
            "десятая": 10, "одиннадцатая": 11, "двенадцатая": 12, "тринадцатая": 13,
            "четырнадцатая": 14, "пятнадцатая": 15, "шестнадцатая": 16,
            "семнадцатая": 17, "восемнадцатая": 18, "девятнадцатая": 19, "двадцатая": 20}
WORD_RX = re.compile(r"^Глава\s+([а-яё]+)\s*$", re.I)
# Имена островов Навадвипы — капсом в теле. Глава книги-парикрамы = остров.
ISLAND_RX = re.compile(r"^(АНТАРДВИПА|СИМАНТАДВИПА|ГОДРУМАДВИПА|МАДХЬЯДВИПА|"
                       r"КОЛАДВИПА|РИТУДВИПА|ДЖАХНУДВИПА|МОДАДРУМАДВИПА|"
                       r"РУДРАДВИПА|НАВАДВИПА)\s*$")


def parse_word_chapters(spec):
    """Номер главы СЛОВАМИ в колонтитуле. Граница — смена номера."""
    path = SRC / spec["file"]
    lines = [clean(l) for l in path.read_text(encoding="utf-8-sig", errors="replace").split("\n")]

    chapters, cur, prev = [], None, None
    for l in lines:
        if not l:
            continue
        m = WORD_RX.match(l)
        if m:
            n = ORD_WORD.get(m.group(1).lower())
            if n and n != prev:            # НОМЕР СМЕНИЛСЯ → новая глава
                if cur:
                    chapters.append(cur)
                cur = {"num": n, "title": None, "paras": []}
                prev = n
            continue                       # сам колонтитул в текст не идёт
        if not cur:
            continue
        if l.isdigit():
            continue                       # номер страницы

        # Маргиналии OCR помечены «!» — это боковые пометки, а не заголовки.
        # Снимаем знак, текст оставляем: он содержательный.
        if l.startswith("!"):
            l = l.lstrip("!").strip()
            if not l:
                continue

        # Название главы — имя ОСТРОВА (книга-парикрама: глава = остров).
        # Оно идёт капсом в теле: АНТАРДВИПА, СИМАНТАДВИПА, ГОДРУМАДВИПА…
        if ISLAND_RX.match(l):
            if cur["title"] is None:
                cur["title"] = l.capitalize()
            continue                       # сам колонтитул острова в текст не идёт

        cur["paras"].append(l)
    if cur:
        chapters.append(cur)

    # Названия, читаемые из оглавления (OCR перемешал его, но эти три ясны).
    KNOWN = {1: "Великолепие дхамы",
             17: "Нитьянанда Прабху отвечает на вопросы Дживы",
             18: "Нитьянанда Прабху продолжает отвечать на вопросы"}
    for c in chapters:
        if c["num"] in KNOWN:
            c["title"] = KNOWN[c["num"]]
        # Безымянной главе — честное «Глава N», а не выдуманное название (ЗКН-БТ001).
        if not c["title"]:
            c["title"] = "Глава %d" % c["num"]

    if len(chapters) != spec["expect"]:
        raise SystemExit("::error title=PARSE::%s: глав %d, ожидалось %d"
                         % (spec["work"], len(chapters), spec["expect"]))
    return chapters


def parse(spec):
    if spec.get("chapter_word"):
        return parse_word_chapters(spec)

    path = SRC / spec["file"]
    if not path.exists():
        raise SystemExit("::error::нет файла %s" % path)

    ch_rx = re.compile(spec["chapter"], re.I)
    lines = [clean(l) for l in path.read_text(encoding="utf-8-sig", errors="replace").split("\n")]

    # Главы собираем ПО НОМЕРУ, а не по вхождению маркера.
    #
    # ⚠️ В «Бхакти-ратнакаре» «CHAPTER 6» стоит ДВАЖДЫ: OCR разорвал главу надвое.
    # Считать главы по вхождениям = получить 16 вместо 15 (у книги пятнадцать таранг)
    # и записать сломанную структуру. Одинаковый номер = ПРОДОЛЖЕНИЕ той же главы.
    by_num = {}
    order = []
    cur = None
    for l in lines:
        if not l:
            continue
        m = ch_rx.match(l)
        if m:
            num = int(m.group(1))
            if num not in by_num:
                by_num[num] = {"num": num, "title": None, "paras": []}
                order.append(num)
            cur = by_num[num]
            continue
        if not cur:
            continue                       # предисловие до первой главы
        if cur["title"] is None:
            cur["title"] = l               # название — первая строка после заголовка
            continue
        cur["paras"].append(l)

    chapters = [by_num[n] for n in sorted(order)]

    # ГЕЙТ: счёт глав обязан сойтись с ожидаемым — иначе разбор неверен.
    if len(chapters) != spec["expect"]:
        raise SystemExit("::error title=PARSE::%s: глав %d, ожидалось %d — в базу НЕ пишу"
                         % (spec["work"], len(chapters), spec["expect"]))

    empty = [c["num"] for c in chapters if len(c["paras"]) < 3]
    if empty:
        raise SystemExit("::error title=PARSE::%s: главы почти пусты: %s — разбор неверен"
                         % (spec["work"], empty))

    return chapters


# ── D1 ───────────────────────────────────────────────────────────────────────
def cf():
    cfg = (ROOT / "apps" / "web" / "wrangler.toml").read_text(encoding="utf-8")
    return (re.search(r'account_id\s*=\s*"([^"]+)"', cfg).group(1),
            re.search(r'database_id\s*=\s*"([^"]+)"', cfg).group(1))


def d1(sql, params=None):
    acc, dbid = cf()
    tok = os.environ["CLOUDFLARE_API_TOKEN"]
    url = "https://api.cloudflare.com/client/v4/accounts/%s/d1/database/%s/query" % (acc, dbid)
    payload = {"sql": sql}
    if params:
        payload["params"] = params
    req = urllib.request.Request(url, data=json.dumps(payload).encode(),
                                 headers={"Authorization": "Bearer " + tok,
                                          "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            out = json.load(r)
    except urllib.error.HTTPError as e:
        # ЗКН-Ф014: скрипт говорит, ЧТО именно сломалось.
        raise SystemExit("::error title=D1::HTTP %s — %s\n  SQL: %s"
                         % (e.code, e.read().decode("utf-8", "replace")[:280], sql[:110]))
    if not out.get("success", True):
        raise SystemExit("::error title=D1::%s\n  SQL: %s"
                         % (json.dumps(out.get("errors"), ensure_ascii=False)[:240], sql[:110]))
    return out


def load(spec, chapters):
    w = spec["work"]
    d1("INSERT OR REPLACE INTO works (id, kind, abbrev, verse_scheme) VALUES (?,'scripture',?,'chapter.verse')",
       [w, spec["abbr"]])
    d1("INSERT OR REPLACE INTO editions (id, work_id, lang, title, translator) VALUES (?,?,?,?,NULL)",
       [w + "-" + spec["lang"], w, spec["lang"], spec["title"]])

    for c in chapters:
        d1("INSERT OR REPLACE INTO divisions (id, work_id, parent_id, level, number, title, ordinal) "
           "VALUES (?,?,NULL,'chapter',?,?,?)",
           ["%s.%d" % (w, c["num"]), w, str(c["num"]),
            json.dumps({"ru": c["title"] or "Глава %d" % c["num"]}, ensure_ascii=False),
            str(c["num"])])

    rows = []
    for c in chapters:
        for i, p in enumerate(c["paras"], 1):
            rows.append(("%s.%d.%d" % (w, c["num"], i), "%s.%d" % (w, c["num"]),
                         "%s %d.%d" % (spec["abbr"], c["num"], i), i, p))

    # ЗКН-Ф013: D1 «too many SQL variables» — держим ≤ 100 переменных на запрос.
    B = 20
    for i in range(0, len(rows), B):
        chunk = rows[i:i + B]
        ph = ",".join(["(?,?,?,?,?,NULL,NULL,NULL,NULL)"] * len(chunk))
        pr = []
        for vid, div, ref, ordi, _ in chunk:
            pr += [vid, w, div, ref, str(ordi)]
        d1("INSERT OR REPLACE INTO verses "
           "(id,work_id,division_id,ref,ordinal,devanagari,translit,uvaca,source_url) VALUES " + ph, pr)

        ph2 = ",".join(["(?,?,?,NULL)"] * len(chunk))
        pr2 = []
        for vid, _, _, _, text in chunk:
            pr2 += [vid, w + "-" + spec["lang"], text]
        d1("INSERT OR REPLACE INTO verse_texts (verse_id,edition_id,translation,purport) VALUES " + ph2, pr2)

    n = d1("SELECT COUNT(*) AS n FROM verses WHERE work_id=?", [w])["result"][0]["results"][0]["n"]
    print("::notice title=%s::абзацев в базе: %d" % (w.upper(), n))

    # ЗКН-Пр007: «читать» — только когда текст РЕАЛЬНО внесён.
    d1("UPDATE book_catalog SET readable = 1 WHERE id = ?", [w])


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    for spec in BOOKS:
        if only and spec["work"] != only:
            continue
        print("── %s (%s) ──" % (spec["title"], spec["lang"]))
        ch = parse(spec)
        paras = sum(len(c["paras"]) for c in ch)
        print("  глав=%d  абзацев=%d  ✓ сверка пройдена" % (len(ch), paras))
        for c in ch[:2]:
            print("    гл.%d «%s» — %d абз." % (c["num"], (c["title"] or "")[:40], len(c["paras"])))

        if not os.environ.get("CLOUDFLARE_API_TOKEN"):
            print("  нет токена — в базу не пишу\n")
            continue
        load(spec, ch)
        print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
