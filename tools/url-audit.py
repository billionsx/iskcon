#!/usr/bin/env python3
"""
ЗКН-Н025 — АДРЕС ПЕРЕЕХАЛ → ПЕРЕЕХАЛИ ВСЕ, КТО ЕГО ЧИТАЛ.

ПОЧЕМУ ЭТОТ ГЕЙТ СУЩЕСТВУЕТ.

Я сломал витрину Личностей ДВАЖДЫ ПОДРЯД, и оба раза одинаково:

  1. Перевёл адреса на `/lichnosti/…`, а `LichnostiHub` продолжал ЧИТАТЬ
     `/dhana/…`. Совпадения не находил и молча падал в запасной вариант —
     Гауранга Лилу. Все три кнопки вели в одно место.

  2. Перевёл адреса на `/gauranga-lila`, а в зале остался обработчик
     `pp.startsWith("/lichnosti/")`. Условие не срабатывало, и кнопки
     переставали вести вглубь.

ОБА РАЗА: **писатель адреса переехал, читатель — нет.**

Это не случайность и не невнимательность. Это СВОЙСТВО задачи: адрес живёт в
двух местах — там, где его СТРОЯТ, и там, где его РАЗБИРАЮТ. Меняя одно, легко
забыть другое, потому что они в разных файлах и ничем не связаны.

Молчаливость — худшее здесь. Ничего не падает: приложение собирается, тесты
проходят, а кнопка просто ведёт не туда. Такое ловится только глазами.

ЧТО ДЕЛАЕТ ГЕЙТ.

Ищет в коде СТАРЫЕ адреса — те, что уже переехали. Каждое вхождение = мёртвый
читатель, который ждёт адрес, которого больше нет.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "apps" / "web" / "src"

# Адреса, которые ПЕРЕЕХАЛИ. Ключ — старый, значение — новый.
# Пополняется при КАЖДОМ переименовании: это и есть механизм закона.
MOVED = {
    "/dhana": "/hero",
    "/lichnosti": "/hero",
    "/acharya": "/hero",
    "/practice/japa": "/japa",
    "/practice/diary": "/story",
    "/practice/verse": "/verse",
    "/practice/vow": "/promise",
    "/practice/progress": "/progress",
    "/practice/darshan": "/darshan",
    "/practice": "/sadhana",
    "/account": "/id",
    "/hero/shrimad-bhagavatam": "/bhagavatam-lila",
    "/hero/mahabharata": "/mahabharata-lila",
    "/hero/ramayana": "/ramayana-lila",
    "/prasadam": "/prasad",
    "/prasad/recipe": "/prasad",
    "/bhagavatam-lila/rishis": "/rishis",
    "/bhagavatam-lila/bhaktas": "/bhaktas",
    "/bhagavatam-lila/asuras": "/asuras",
    "/bhagavatam-lila/devas": "/demigods",
    "/entity/": "/",
    "/person/": "/",
    "/bhajan/": "/bhajans/",
    "/kirtan/": "/kirtans/",
    "/center/": "/iskcon/centers/",
}

# Где старый адрес — законный: реестр переездов (301) и этот файл.
ALLOW = {"routes.ts", "url-audit.py"}


def check_iskcon_tabs():
    """ЗКН-Н026 — ЭКРАН БЕЗ АДРЕСА КАК БУДТО НЕ СУЩЕСТВУЕТ.

    Вкладки ИСККОН держались в `sessionStorage` и адрес НЕ ПИСАЛИ вовсе.
    Человек открывал «Центры», а в строке оставалось `/books`: разделом нельзя
    было поделиться, положить в закладку, вернуться назад.
    """
    t = (SRC / "HomeTabs.tsx").read_text(encoding="utf-8")
    h = (SRC / "HomeScreen.tsx").read_text(encoding="utf-8")
    bad = []
    if "pathOfTab" not in t or "tabFromPath" not in t:
        bad.append(("HomeTabs.tsx", "нет pathOfTab/tabFromPath — у вкладок ИСККОН нет адреса (ЗКН-Н026)"))
    if "pushUrl(pathOfTab" not in h:
        bad.append(("HomeScreen.tsx", "переключение вкладки НЕ пишет адрес (ЗКН-Н026)"))
    if 'sessionStorage.getItem("home-tab")' in h:
        bad.append(("HomeScreen.tsx", "вкладка читается из sessionStorage, а не из АДРЕСА (ЗКН-Н026)"))
    return bad


def main():
    bad = [(f, 0, "", "", m) for f, m in check_iskcon_tabs()]
    for fp in sorted(SRC.rglob("*")):
        if fp.suffix not in (".ts", ".tsx") or fp.name in ALLOW:
            continue
        try:
            lines = fp.read_text(encoding="utf-8").split("\n")
        except Exception:
            continue

        for i, line in enumerate(lines, 1):
            st = line.strip()
            if st.startswith(("*", "//", "/*")):
                continue                      # комментарий — там адрес ОБЪЯСНЯЮТ
            for old, new in MOVED.items():
                # ищем адрес в строке или в шаблоне, но НЕ как часть нового
                for q in ('"', "`", "'"):
                    if (q + old) in line:
                        # `/prasad` не считается вхождением `/prasadam`
                        after = line.split(q + old, 1)[1][:1]
                        if old.endswith("/") or after in ("", q, "/", "$", " "):
                            bad.append((str(fp.relative_to(ROOT)), i, old, new, st[:70]))
                            break

    if not bad:
        print("ЗКН-Н025: мёртвых читателей адресов нет ✓")
        print("ЗКН-Н026: у вкладок ИСККОН есть адреса ✓")
        print("  переездов в реестре: %d" % len(MOVED))
        return 0

    print("═" * 74)
    print("✗ ЗКН-Н025 — АДРЕС ПЕРЕЕХАЛ, А ЧИТАТЕЛЬ ОСТАЛСЯ (%d)" % len(bad))
    print("═" * 74)
    print("Молчаливая поломка: ничего не падает, кнопка просто ведёт не туда.")
    print()
    for f, i, old, new, src in bad:
        print("  %s:%d" % (f, i))
        print("      %s  →  %s" % (old, new))
        print("      %s" % src)
    print()
    print("Переезжает адрес — переезжают ВСЕ, кто его читает и строит.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
