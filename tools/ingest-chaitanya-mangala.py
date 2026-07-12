#!/usr/bin/env python3
"""
ИНГЕСТ «ЧАЙТАНЬЯ-МАНГАЛЫ» — ПРОЗОЙ (ЗКН-Пр007 · ЗКН-БТ001).

ПОЧЕМУ ПРОЗОЙ.

Первый заход внёс «Чайтанья-бхагавату» стихами и на «Чайтанья-мангале» получил
НОЛЬ стихов. Гейт отказался писать — и был прав: это не сбой разбора, а природа
книги. Перевод Субхаг Свами — **прозаический пересказ**, а не стихотворный текст
с построчной транслитерацией. Разбирать её как стихи значило бы ломать книгу
под свой инструмент.

Приложение умеет прозаические книги (`prose: true`, как «Нектар преданности»):
    divisions   — главы
    verses      — АБЗАЦЫ (id вида `cm.adi.1.7`)
    verse_texts — текст абзаца в `translation`

УСТРОЙСТВО ИСТОЧНИКА.

    Сутра-Кханда · Ади-кханда · Мадхйа-Кханда · Шеша-Кханда   ← 4 кханды
    Глава 1.                                                  ← заголовок
    Игры рождения Шри Чаитанйи                                ← название
    Вся слава Гададхаре и Шри Гауранге…                       ← абзацы

⚠️ Оглавление (строки 39–242) отделено от тела точками-выносками («. . . .»).
Отличать заголовок тела от строки оглавления надо по ВЫНОСКЕ (точка-пробел-точка),
а не по наличию точки: настоящий заголовок — «Глава 1.» — тоже с точкой.

ЧЕСТНОСТЬ. Гейт сверяет число глав в теле с оглавлением по КАЖДОЙ кханде.
Не сошлось — в базу не пишем (ЗКН-БТ001).
"""
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "docs" / "sources" / "chaitanya-lila" / "LochanaDasa_Chaitanya-Mangala.RU.txt"

BODY_FROM = 242                      # индекс: тело начинается со строки 243
KH_RX = re.compile(r"^(Сутра|Ади|Мадхйа|Шеша)\s*-?\s*[Кк]ханда\s*$")
CH_RX = re.compile(r"^Глава\s+(\d+)\.?\s*(.*)$")
LEADER = re.compile(r"\.\s+\.")      # выноска оглавления: «. . . .»

SLUG = {"Сутра": "sutra", "Ади": "adi", "Мадхйа": "madhya", "Шеша": "shesha"}
KH_RU = {"sutra": "Сутра-кханда", "adi": "Ади-кханда",
         "madhya": "Мадхья-кханда", "shesha": "Шеша-кханда"}
ABBR = {"sutra": "Сутра", "adi": "Ади", "madhya": "Мадхья", "shesha": "Шеша"}


def read():
    return [l.strip() for l in SRC.read_text(encoding="utf-8-sig").split("\n")]


def toc(lines):
    """Оглавление: сколько глав в каждой кханде и как они называются."""
    out, kh = {}, None
    for i in range(38, BODY_FROM):
        l = lines[i]
        m = KH_RX.match(l)
        if m:
            kh = SLUG[m.group(1)]
            out.setdefault(kh, [])
            continue
        m = CH_RX.match(l)
        if m and kh:
            title = re.sub(r"[\s.]+$", "", m.group(2)).strip()
            out[kh].append((int(m.group(1)), title))
    return out


def body(lines):
    """Тело: главы и абзацы. Название главы — строка сразу после заголовка."""
    chapters = []                    # [(kh, num, title, [абзацы])]
    kh = None
    cur = None
    for i in range(BODY_FROM, len(lines)):
        l = lines[i]
        if not l:
            continue

        m = KH_RX.match(l)
        if m:
            kh = SLUG[m.group(1)]
            continue

        m = CH_RX.match(l)
        # Заголовок тела — БЕЗ выноски. «Глава 1.» с одиночной точкой — заголовок.
        if m and kh and not LEADER.search(l):
            if cur:
                chapters.append(cur)
            cur = {"kh": kh, "num": int(m.group(1)),
                   "title": m.group(2).strip() or None, "paras": []}
            continue

        if not cur:
            continue

        # Название главы отдельной строкой сразу после заголовка.
        if cur["title"] is None and not cur["paras"]:
            cur["title"] = l
            continue

        cur["paras"].append(l)

    if cur:
        chapters.append(cur)
    return chapters


def main():
    if not SRC.exists():
        raise SystemExit("::error::нет файла %s" % SRC)

    lines = read()
    t = toc(lines)
    ch = body(lines)

    print("«Чайтанья-мангала» — сверка тела с оглавлением:")
    ok = True
    for kh in ("sutra", "adi", "madhya", "shesha"):
        want = len(t.get(kh, []))
        got = sum(1 for c in ch if c["kh"] == kh)
        mark = "✓" if got == want else "✗"
        if got != want:
            ok = False
        print("  %s %-8s тело=%2d  оглавление=%2d" % (mark, KH_RU[kh], got, want))
    if not ok:
        raise SystemExit("::error title=PARSE::счёт глав не сошёлся — в базу НЕ пишу")

    paras = sum(len(c["paras"]) for c in ch)
    print("\nглав=%d  абзацев=%d" % (len(ch), paras))
    if paras < 800:
        raise SystemExit("::error title=PARSE::абзацев всего %d — разбор неверен" % paras)

    out = ROOT / "build/cm-prose.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(ch, ensure_ascii=False), encoding="utf-8")
    print("→ %s" % out)

    if not os.environ.get("CLOUDFLARE_API_TOKEN"):
        print("нет токена — в базу не пишу (локальный прогон)")
        return 0

    load(ch)
    return 0


# ── запись в D1 ──────────────────────────────────────────────────────────────
def ids():
    cfg = (ROOT / "apps" / "web" / "wrangler.toml").read_text(encoding="utf-8")
    a = re.search(r'account_id\s*=\s*"([^"]+)"', cfg).group(1)
    d = re.search(r'database_id\s*=\s*"([^"]+)"', cfg).group(1)
    return a, d


def d1(sql, params=None):
    acc, dbid = ids()
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
                         % (e.code, e.read().decode("utf-8", "replace")[:300], sql[:110]))
    if not out.get("success", True):
        raise SystemExit("::error title=D1::%s\n  SQL: %s"
                         % (json.dumps(out.get("errors"), ensure_ascii=False)[:250], sql[:110]))
    return out


def load(chapters):
    d1("INSERT OR REPLACE INTO editions (id, work_id, lang, title, translator, source) "
       "VALUES ('cm-ru','cm','ru','Шри Чайтанья-мангала','Субхаг Свами','Лочана дас Тхакур')")

    for kh in ("sutra", "adi", "madhya", "shesha"):
        d1("INSERT OR REPLACE INTO divisions (id, work_id, parent_id, level, number, title, ordinal) "
           "VALUES (?,'cm',NULL,'division',?,?,?)",
           ["cm." + kh, kh, json.dumps({"ru": KH_RU[kh]}, ensure_ascii=False),
            str(("sutra", "adi", "madhya", "shesha").index(kh) + 1)])

    for c in chapters:
        d1("INSERT OR REPLACE INTO divisions (id, work_id, parent_id, level, number, title, ordinal) "
           "VALUES (?,'cm',?,'chapter',?,?,?)",
           ["cm.%s.%d" % (c["kh"], c["num"]), "cm." + c["kh"], str(c["num"]),
            json.dumps({"ru": c["title"] or "Глава %d" % c["num"]}, ensure_ascii=False),
            str(c["num"])])
    print("издание и %d разделов записаны" % (4 + len(chapters)))

    # ЗКН-Ф013: держим ≤ 100 переменных на запрос. У абзаца 4 поля → 20 штук.
    B = 20
    rows = []
    for c in chapters:
        for i, p in enumerate(c["paras"], 1):
            rows.append((
                "cm.%s.%d.%d" % (c["kh"], c["num"], i),
                "cm.%s.%d" % (c["kh"], c["num"]),
                "ЧМ %s %d.%d" % (ABBR[c["kh"]], c["num"], i),
                i, p,
            ))

    for i in range(0, len(rows), B):
        chunk = rows[i:i + B]
        ph = ",".join(["(?,'cm',?,?,?,NULL,NULL,NULL,NULL)"] * len(chunk))
        pr = []
        for vid, div, ref, ordi, _ in chunk:
            pr += [vid, div, ref, str(ordi)]
        d1("INSERT OR REPLACE INTO verses "
           "(id,work_id,division_id,ref,ordinal,devanagari,translit,uvaca,source_url) "
           "VALUES " + ph, pr)

        ph2 = ",".join(["(?,'cm-ru',?,NULL)"] * len(chunk))
        pr2 = []
        for vid, _, _, _, text in chunk:
            pr2 += [vid, text]
        d1("INSERT OR REPLACE INTO verse_texts (verse_id,edition_id,translation,purport) "
           "VALUES " + ph2, pr2)

        if (i // B) % 20 == 0:
            print("  ...%d/%d" % (min(i + B, len(rows)), len(rows)))

    r = d1("SELECT COUNT(*) AS n FROM verses WHERE work_id='cm'")
    print("::notice title=CM::абзацев в базе: %d" % r["result"][0]["results"][0]["n"])

    # ЗКН-Пр007: «читать» появляется ТОЛЬКО когда текст реально внесён.
    d1("UPDATE book_catalog SET readable = 1 WHERE id = 'cm'")
    print("«Чайтанья-мангала» помечена читаемой")


if __name__ == "__main__":
    sys.exit(main())
