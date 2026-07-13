#!/usr/bin/env python3
"""
ВОЗВРАТ 43 ПОТЕРЯННЫХ ПЕРЕВОДОВ «ЧАЙТАНЬЯ-БХАГАВАТЫ».

ЧТО СЛУЧИЛОСЬ.

В книге 11 441 стих. У 43 из них есть транслитерация — и НЕТ ПЕРЕВОДА. Один даже
с комментарием на 961 знак: читатель видит бенгальский стих и толкование к нему,
но НЕ ПОНИМАЕТ, что стих говорит.

ЗКН-Пл006 — ИСТОЧНИК ВАЖНЕЕ МЕТОДА. Прежде чем «чинить», я спросил: откуда они.

Ответ: русский текст ЛЕЖИТ В РЕПОЗИТОРИИ (`docs/sources/chaitanya-lila/`), и
переводы в нём ЕСТЬ. Первый разбор их просто пропустил — 43 из 11 441.

Значит переводить самому НЕ НАДО (и нельзя: ЗКН-БТ002 — ноль выдумки). Надо
найти пропущенное в источнике.

КАК ИЩЕМ.

ЗКН-Пл011 — СВЯЗЫВАЕМ ПО КЛЮЧУ, А НЕ ПО ПОРЯДКУ. Порядковый счёт в этой книге
съедет: есть слитые стихи («Стих 2-14»), есть вставки. Ключ — САМА
ТРАНСЛИТЕРАЦИЯ: она уже лежит в базе, она же стоит в источнике строкой выше
перевода.

    Стих 28
    donhara carana donhe dharibare caya…      ← ключ (есть в базе)
    Оба желали коснуться стоп друг друга…     ← перевод (берём его)

Сверяем по «отпечатку» — первым словам транслитерации, очищенным от диакритики и
знаков. Совпало — берём следующую непустую строку как перевод.

ЗКН-Ф013: батч ≤ 100 переменных.
ЗКН-Ф014: HTTPError перехватывается.
ЗКН-Р002: заливка недеструктивна (UPDATE по ключу, ничего не сносим).
"""
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "docs" / "sources" / "chaitanya-lila" / "VrindavanaDasa_Chaitanya-Bhagavata.RU.txt"

ACC = "d5cbe19470dc38599873eabfe148e6d1"
DB = "6226aded-dd03-4e74-977f-9cd0b509e73d"


def d1(sql, params=None):
    tok = os.environ.get("CF_TOKEN")
    if not tok:
        sys.exit("нет CF_TOKEN")
    body = json.dumps({"sql": sql, "params": params or []}).encode()
    rq = urllib.request.Request(
        "https://api.cloudflare.com/client/v4/accounts/%s/d1/database/%s/query" % (ACC, DB),
        data=body,
        headers={"Authorization": "Bearer " + tok, "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(rq, timeout=90) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:          # ЗКН-Ф014
        print("HTTP %d: %s" % (e.code, e.read().decode()[:300]))
        raise


CYR = "абвгдеёжзийклмнопрстуфхцчшщъыьэюя"


def fingerprint(s, words=5):
    # ⚠️ ПЯТЬ СЛОВ, НЕ ШЕСТЬ.
    #
    # При шести совпал 1 стих из 5: транслитерация в базе местами ОБРЕЗАНА —
    # шестого слова там просто нет, и отпечаток не сходился. При пяти — все пять.
    #
    # Меньше пяти брать нельзя: отпечаток перестаёт быть уникальным, и стих
    # может подцепить ЧУЖОЙ перевод. Это хуже пустого места: пустое видно, а
    # подменённый перевод читается как настоящий.
    """Отпечаток строки: буквы и цифры, без диакритики, регистра и знаков.

    Убираем диакритику, регистр и знаки — сравниваем голые буквы.
    """
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower()
    s = re.sub(r"[^a-zа-яё0-9\s]+", " ", s)
    return " ".join(s.split()[:words])


def is_translit_line(s):
    """Строка транслитерации: латиница/диакритика, без русских слов подряд."""
    t = unicodedata.normalize("NFD", s)
    t = "".join(c for c in t if not unicodedata.combining(c))
    letters = [c for c in t.lower() if c.isalpha()]
    if len(letters) < 6:
        return False
    cyr = sum(1 for c in letters if c in CYR)
    return cyr / len(letters) < 0.55        # больше латиницы, чем кириллицы


def build_index():
    """Отпечаток транслитерации → перевод (следующая непустая РУССКАЯ строка).

    ⚠️ НЕОДНОЗНАЧНЫЕ ОТПЕЧАТКИ ОТБРАСЫВАЮТСЯ.

    148 отпечатков ведут на РАЗНЫЕ переводы: пять первых слов совпали, а стихи
    разные. Взять любой — значит подставить стиху ЧУЖОЙ перевод.

    Это ХУЖЕ, чем оставить пусто. Пустое место видно сразу. Подменённый перевод
    читается как настоящий — и живёт в книге, пока кто-нибудь не сверит с
    оригиналом. А сверять никто не будет: он же выглядит правильно.

    Совпало неоднозначно — не берём. Лучше 24 немых стиха, чем один лживый.
    """
    lines = [l.rstrip() for l in SRC.read_text(encoding="utf-8").split("\n")]
    raw = {}
    for i, l in enumerate(lines):
        st = l.strip()
        if not st or not is_translit_line(st):
            continue
        # ⚠️ ВОТ ПОЧЕМУ 43 СТИХА ПОТЕРЯЛИСЬ ИЗНАЧАЛЬНО.
        #
        # Между стихом и переводом вклиниваются КОЛОНТИТУЛЫ страницы — обрывки
        # вёрстки, попавшие в текст при распознавании:
        #
        #     Стих 28
        #     donhara carana donhe dharibare caya…      ← стих
        #                                                (пустая строка)
        #     Стих 2          ← КОЛОНТИТУЛ (не стих!)
        #     Глава 5         ← КОЛОНТИТУЛ
        #     Они пытались коснуться стоп друг друга…   ← ПЕРЕВОД
        #
        # Первый разбор упирался в «Стих 2» и БРОСАЛ. Перевод оставался в
        # источнике, а стих в базе — немым.
        #
        # Колонтитул от заголовка отличается тем, что он ОДИНОК: за ним не идёт
        # стих. Просто пропускаем такие строки и ищем дальше.
        HEADER = re.compile(r"^(Стих|Глава|Ади-кханда|Мадхья-кханда|Антья-кханда)"
                            r"\s*\d*\s*$")
        for j in range(i + 1, min(i + 7, len(lines))):
            nxt = lines[j].strip()
            if not nxt or HEADER.match(nxt):
                continue                       # пустая строка или колонтитул
            if is_translit_line(nxt):
                break                          # начался следующий стих
            fp = fingerprint(st)
            if fp and len(fp) > 8:
                raw.setdefault(fp, set()).add(nxt)
            break

    # только ОДНОЗНАЧНЫЕ: один отпечаток — один перевод
    idx = {k: next(iter(v)) for k, v in raw.items() if len(v) == 1}
    dropped = len(raw) - len(idx)
    if dropped:
        print("отброшено неоднозначных отпечатков: %d" % dropped)
    return idx


def main():
    if not SRC.exists():
        sys.exit("нет источника: %s" % SRC)

    idx = build_index()
    print("отпечатков в источнике: %d" % len(idx))

    r = d1("""SELECT v.id, v.translit FROM verses v
              LEFT JOIN verse_texts t ON t.verse_id = v.id
              WHERE v.work_id = 'cb'
                AND COALESCE(t.translation, '') = ''
                AND COALESCE(v.translit, '') <> ''""")
    rows = r["result"][0]["results"]
    print("стихов без перевода: %d" % len(rows))

    found, miss = [], []
    for row in rows:
        fp = fingerprint(row["translit"])
        tr = idx.get(fp)
        if tr:
            found.append((row["id"], tr))
        else:
            miss.append(row["id"])

    print("найдено в источнике:  %d" % len(found))
    print("не найдено:           %d" % len(miss))
    for m in miss[:6]:
        print("   ? %s" % m)

    if "--dry" in sys.argv:
        print()
        print("═══ ПРИМЕР ═══")
        for vid, tr in found[:3]:
            print("  %-20s → %s" % (vid, tr[:70]))
        return

    if not found:
        sys.exit("ничего не найдено — отпечаток не совпадает (ЗКН-Пл010: ищу не там)")

    # ЗКН-Р002: недеструктивно. ЗКН-Ф013: 2 переменных × 30 = 60.
    done = 0
    for i in range(0, len(found), 30):
        chunk = found[i:i + 30]
        for vid, tr in chunk:
            d1("""INSERT INTO verse_texts (verse_id, edition_id, translation)
                  VALUES (?1, 'cb-ru', ?2)
                  ON CONFLICT(verse_id, edition_id)
                  DO UPDATE SET translation = ?2
                  WHERE COALESCE(verse_texts.translation, '') = ''""",
               [vid, tr])
        done += len(chunk)
        print("  залито %d / %d" % (done, len(found)))


if __name__ == "__main__":
    main()
