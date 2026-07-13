#!/usr/bin/env python3
"""
ЗАЛИВКА «ПРАБХУПАДА-ШИКШАМРИТЫ» — наставлений Шрилы Прабхупады.

ЧТО ЭТО ЗА КНИГА.

Не трактат и не последовательное повествование. Это СВОД: письма, беседы и
лекции Прабхупады, разложенные ПО ТЕМАМ — живопись, общество преданных, критика,
проповедь на Западе, брахмачарья, деньги, распространение книг…

Строение источника:

    Живопись                                   ← ТЕМА
    Живопись как инструмент проповеди          ← ПОДТЕМА
    67-12 «Изображения Господа Кришны …»       ← дата + слова Прабхупады
    (ПШП Джадурани, 12 декабря 1967)           ← КОМУ и КОГДА

Атрибуция — не украшение. «ПШП Джадурани, 12 декабря 1967» говорит: это ПИСЬМО,
адресованное конкретному человеку в конкретный день. Наставление, данное одному
преданному по одному поводу, читается иначе, чем общее правило. Потерять
атрибуцию — превратить живое письмо в безличный лозунг.

Поэтому каждая единица несёт: тему, подтему, слова, адресата и дату.

ЗКН-БТ004: чужой голос НЕ РЕДАКТИРУЕТСЯ. Текст берётся дословно; чинятся только
переносы строк, разорвавшие слово, и артефакты распознавания ([p.8] на полях).

ЗКН-Ф013: батч ≤ 100 переменных на запрос.
"""
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "docs" / "sources" / "prabhupada-shikshamrita" / "Prabhupada-Shikshamrita.RU.txt"

ACC = "d5cbe19470dc38599873eabfe148e6d1"
DB = "6226aded-dd03-4e74-977f-9cd0b509e73d"
WORK = "prabhupada-shikshamrita"


def d1(sql, params=None):
    """ЗКН-Ф014: HTTPError перехватывается — иначе падает молча."""
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
    except urllib.error.HTTPError as e:
        print("HTTP %d: %s" % (e.code, e.read().decode()[:400]))
        raise


# ── разбор ────────────────────────────────────────────────────────────────

PAGE = re.compile(r"\[p\.\d+\]")            # маргиналия распознавания

# ⚠️ ЗКН-Пл010 — «СТРУКТУРЫ НЕТ» ОБЫЧНО ЗНАЧИТ «ИЩУ НЕ ТАМ».
#
# Первый разбор нашёл 19 наставлений из 5330. Я требовал, чтобы после даты
# ОБЯЗАТЕЛЬНО шла кавычка — а половина наставлений идёт БЕЗ неё:
#
#     67-12 «Изображения Господа Кришны…»     ← с кавычкой
#     68-03 Я очень рад тому, что ты…         ← БЕЗ кавычки
#
# И атрибуция часто ПЕРЕНОСИТСЯ на следующую строку — закрывающая скобка
# оказывается не в конце строки, а через одну.
#
# Структура была. Я смотрел не на неё.
DATED = re.compile(r"^(\d\d-\d\d)\s+\S")     # дата + что угодно
ATTR = re.compile(r"\((ПШП|Письмо|Лекция|Беседа|Комментарий)[^)]{0,90}\)")


def parse():
    raw = SRC.read_text(encoding="utf-8").split("\n")

    # оглавление — строки с точечным лидером; тело начинается после последней
    last_toc = max(i for i, l in enumerate(raw[:3000]) if "...." in l)

    # ТЕМЫ берём ИЗ ОГЛАВЛЕНИЯ: там они ЗАГЛАВНЫМИ и без отступа.
    # Гадать по длине строки — верный способ намешать обрывки атрибуций в темы.
    global TOPICS_UPPER
    TOPICS_UPPER = set()
    for l in raw[:last_toc + 1]:
        st = l.split("...")[0].strip()
        if st and st == st.upper() and len(st) > 3 and not st[0].isdigit():
            TOPICS_UPPER.add(st)

    body = raw[last_toc + 1:]

    # чистим маргиналии страниц, склеиваем
    lines = []
    for l in body:
        l = PAGE.sub("", l).rstrip()
        if l.strip():
            lines.append(l)

    units = []
    topic = sub = ""
    cur = None                       # накапливаемое наставление

    def flush():
        if not cur:
            return
        text = " ".join(cur["lines"]).strip()
        text = re.sub(r"\s{2,}", " ", text)
        # атрибуция — в хвосте, в скобках. Может стоять не в самом конце.
        m = None
        for m in ATTR.finditer(text):
            pass                          # берём ПОСЛЕДНЮЮ
        attr = ""
        if m:
            attr = text[m.start() + 1:m.end() - 1].strip()
            text = (text[: m.start()] + text[m.end():]).strip()
        text = text.strip().strip("«»\"").strip()
        if len(text) < 40:           # обрывок — не наставление
            return
        units.append({
            "topic": topic, "sub": sub, "date": cur["date"],
            "text": text, "attr": attr,
        })

    for l in lines:
        st = l.strip()

        m = DATED.match(st)
        if m:
            flush()
            cur = {"date": m.group(1), "lines": [st[len(m.group(1)):].strip()]}
            continue

        if cur is not None:
            cur["lines"].append(st)
            # атрибуция закрывает наставление — но только если скобка ЗАКРЫТА
            joined = " ".join(cur["lines"])
            if ATTR.search(joined):
                flush()
                cur = None
            continue

        # не внутри наставления → ЗАГОЛОВОК.
        #
        # Тема и подтема различаются не длиной, а тем, что тема стоит ОДНА,
        # а подтема — под ней. В источнике обе с заглавной, без точки, коротки.
        # Отличаем по тому, что тема повторяется в оглавлении ЗАГЛАВНЫМИ.
        if len(st) < 80 and not st.endswith(".") and "(" not in st:
            if st.upper() in TOPICS_UPPER:
                topic, sub = st, ""
            else:
                sub = st

    flush()
    return units


def main():
    if not SRC.exists():
        sys.exit("нет источника: %s" % SRC)

    units = parse()
    print("наставлений разобрано: %d" % len(units))
    if not units:
        sys.exit("разбор дал 0 — структура другая (ЗКН-Пл010: ищу не там)")

    topics = sorted({u["topic"] for u in units if u["topic"]})
    print("тем: %d" % len(topics))
    for t in topics[:8]:
        n = sum(1 for u in units if u["topic"] == t)
        print("   %-34s %d" % (t[:34], n))

    if "--dry" in sys.argv:
        print()
        print("═══ ПРИМЕР ═══")
        u = units[0]
        print("  тема:      %s" % u["topic"])
        print("  подтема:   %s" % u["sub"])
        print("  дата:      %s" % u["date"])
        print("  адресат:   %s" % u["attr"])
        print("  текст:     %s…" % u["text"][:120])
        return

    # ── СХЕМА: editions → divisions → verses → verse_texts ─────────────────
    #
    # `verses` — СКЕЛЕТ (id, раздел, порядок). Текст живёт в `verse_texts`,
    # связка по `verse_id` + `edition_id`. Первый заход я лил translation прямо
    # в `verses` — там таких полей НЕТ, и заливка упала.
    #
    # ТЕМА становится РАЗДЕЛОМ: «Живопись», «Общество преданных», «Проповедь на
    # Западе». Наставление — единицей внутри неё.

    ED = WORK + "-ru"
    d1("INSERT OR REPLACE INTO editions (id, work_id, lang, title) VALUES (?,?,?,?)",
       [ED, WORK, "ru", "Прабхупада-шикшамрита"])

    # разделы = темы, в порядке первого появления
    topics, seen = [], set()
    for u in units:
        t = u["topic"] or "Без темы"
        if t not in seen:
            seen.add(t); topics.append(t)
    tid = {t: "%s.%d" % (WORK, i) for i, t in enumerate(topics, 1)}

    # ЗКН-Ф013: 4 поля × 20 = 80 переменных
    for i in range(0, len(topics), 20):
        ch = topics[i:i + 20]
        ph = ",".join(["(?,?,?,?)"] * len(ch))
        prm = []
        for t in ch:
            prm += [tid[t], WORK, json.dumps({"ru": t}, ensure_ascii=False),
                    str(topics.index(t) + 1)]
        d1("INSERT OR REPLACE INTO divisions (id, work_id, title, ordinal) VALUES " + ph, prm)
    print("разделов (тем): %d" % len(topics))

    # ЗКН-Р002: недеструктивно — INSERT OR REPLACE, без сноса таблицы
    # ЗКН-Ф013: verses 5 полей × 18 = 90; verse_texts 4 × 20 = 80
    per_topic = {}
    done = 0
    for i in range(0, len(units), 18):
        chunk = units[i:i + 18]
        vph, vprm, tph, tprm = [], [], [], []
        for u in chunk:
            t = u["topic"] or "Без темы"
            per_topic[t] = per_topic.get(t, 0) + 1
            n = per_topic[t]
            vid = "%s.%d" % (tid[t], n)
            # ⚠️ `ref` ОБЯЗАН быть уникальным.
            #
            # Было «Живопись · 67-12» — но ДВА письма одной темы в один месяц
            # дают ОДИН И ТОТ ЖЕ ref, и `INSERT OR REPLACE` затирал предыдущее.
            # Так потерялось 1547 наставлений: тексты залились (у них свой ключ),
            # а скелеты затёрли друг друга. Молчаливая половинчатость.
            ref = "%s · %s · %d" % (t, u["date"], n)
            vph.append("(?,?,?,?,?)")
            vprm += [vid, WORK, tid[t], ref, n]
            tph.append("(?,?,?,?)")
            tprm += [vid, ED, u["text"], u["attr"] or None]
        d1("INSERT OR REPLACE INTO verses (id, work_id, division_id, ref, ordinal) "
           "VALUES " + ",".join(vph), vprm)
        d1("INSERT OR REPLACE INTO verse_texts (verse_id, edition_id, translation, purport) "
           "VALUES " + ",".join(tph), tprm)
        done += len(chunk)
        if done % 900 == 0 or done == len(units):
            print("  залито %d / %d" % (done, len(units)))

    d1("UPDATE book_catalog SET readable = 1 WHERE id = ?", [WORK])
    print("книга открыта для чтения")


if __name__ == "__main__":
    main()
