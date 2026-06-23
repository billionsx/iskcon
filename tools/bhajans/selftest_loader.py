#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Самотест трансформации против эталона «Гурудев» (реальные строки из D1)."""

import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from bhajan_loader import build_record, validate, normalize_slug, canon_author

GURUDEV = {
    "slug": "ru/bhajans/bhaktivinod-thakur/gurudev",  # без ведущего слэша — проверяем нормализацию
    "name": "Гурудев",
    "author_name": "Бхактивинод Тхакур",
    "author_slug": "bhaktivinod-thakur",
    "category": "Песни ачарьев",
    "verses": [
        {
            "translit": "гурудев!\nкр̣па̄-бинду дийа̄ коро' эи да̄се,\nтр̣н̣а̄пекш̣а̄ ати дӣна\nсакала-сахане боло дийа̄ коро,\nниджа-ма̄не спр̣ха̄-хӣна",
            "translation": "Гурудев, даруй мне, твоему слуге, хотя бы каплю своей милости. Я незначительнее травинки! Молю тебя, помоги мне и дай сил! Пусть я, подобно тебе, освобожусь от всех эгоистических желаний и устремлений!",
        },
        {
            "translit": "сакале самма̄н корите ш́акати,\nдехо на̄тха! джатха̄ джатха\nтобе то' га̄ибо харина̄ма-сукхе,\nапара̄дха хобе хото",
            "translation": "Научи меня оказывать должное почтение всем! Тогда, благодаря воспеванию Святого Имени, все мои оскорбления будут полностью уничтожены!",
        },
    ],
}


def check(cond, label):
    print(("  ok  " if cond else " FAIL ") + label)
    return cond


def main():
    ok = True
    assert not validate(GURUDEV, 0), "fixture сам должен быть валиден"
    rec = build_record(GURUDEV)
    p, vs = rec["prayer"], rec["verses"]

    ok &= check(p["slug"] == "/ru/bhajans/bhaktivinod-thakur/gurudev", "slug нормализован с ведущим /")
    ok &= check(p["name"] == "Гурудев", "name")
    ok &= check(p["author_name"] == "Бхактивинод Тхакур", "author_name")
    ok &= check(p["is_section"] == 0 and p["is_catalog"] == 0, "is_section=0, is_catalog=0")
    ok &= check(p["lang"] == "ru", "lang=ru")

    ok &= check(len(vs) == 2, "два куплета")
    ok &= check(vs[0]["signature"] == "Бхактивинод Тхакур · Гурудев · 1-й стих", "подпись 1")
    ok &= check(vs[1]["signature"] == "Бхактивинод Тхакур · Гурудев · 2-й стих", "подпись 2")
    ok &= check("\n" in vs[0]["verse_translit"], "переводы строк в куплете сохранены")

    ok &= check(p["translit"].count("\n\n") == 1, "куплеты транслита разделены пустой строкой")
    ok &= check(p["translation"].count("\n\n") == 1, "куплеты перевода разделены пустой строкой")
    ok &= check(p["translit"].startswith("гурудев!"), "транслит начинается с 1-го куплета")

    service = "Гурудев. Бхактивинод Тхакур. ISKCON. ИСККОН"
    ok &= check(p["text"].split("\n", 1)[0] == service, "служебная первая строка как в базе")
    ok &= check(p["text"].split("\n", 1)[1] == p["translit"], "тело text == translit")

    ok &= check(canon_author("прабхупада") == "Шрила Прабхупада", "канон: голый Прабхупада → Шрила Прабхупада")
    ok &= check(normalize_slug("//ru//x") == "/ru/x", "нормализация двойных слэшей")

    print("\n" + ("ВСЁ ЗЕЛЁНОЕ" if ok else "ЕСТЬ ПАДЕНИЯ"))
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
