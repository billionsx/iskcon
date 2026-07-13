#!/usr/bin/env python3
"""
АУДИТ ПРОДУКТА И КНИГ — домены Пр (6) и Б (3).

Домен Пр — это дисциплина продукта: то, чем ISKCON ONE LOVE ОТЛИЧАЕТСЯ.
Его нарушают не багом, а «полезной фичей»: добавили ленту — и приложение
поехало в мирскую соцсеть. Поэтому запреты здесь проверяются кодом.

Проверяется:
  Пр001  нет соц-графа: чатов, подписок, пользовательских комментариев.
         Сангха — через совместные враты (collective_vows), а не через ленту.
  Пр003  нет свободного AI-философствования — ответ только со ссылкой на стих
  Пр005  Гаятри — гейт по уровню (`effectiveLevel`), не всем подряд
  Б001   название книги — одна строка через `bookFullTitle()`; голый `titleLine1`
         показывал ПОЛОВИНУ названия («Бхагавад-гита» вместо «…как она есть»)
  Б002   ровно 3 факт-чипа у книги
  И004   канонический титул Прабхупады в КОДЕ (не только в данных)

Запуск: python3 tools/product-audit.py
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "apps" / "web" / "src"

# Цитаты чужого голоса НЕ редактируются (ЗКН-БТ004) — исключаем из проверки титула.
QUOTE_MARKERS = ('c: "', '"c":', "text:", "quote")


def files():
    for fp in sorted(SRC.rglob("*")):
        if fp.suffix in (".ts", ".tsx"):
            yield fp


def check_pr001():
    """Соц-граф запрещён: чаты, подписки, пользовательские комментарии.

    ВАЖНО: «комментарий» в этом приложении почти всегда = ПУРПОРТ Прабхупады,
    а не соцфункция. Ловим только явные соц-конструкции.
    """
    bad = []
    pat = re.compile(r"\b(userComment|postComment|sendMessage|chatRoom|followUser|subscribeTo)\b")
    for fp in files():
        for i, l in enumerate(fp.read_text(encoding="utf-8").split("\n"), 1):
            if pat.search(l):
                bad.append((fp.name, "соц-функция: %s (ЗКН-Пр001)" % l.strip()[:40]))
    return bad


def check_pr003():
    """AI-ответ без обязательной ссылки на стих — запрещён."""
    bad = []
    for fp in files():
        t = fp.read_text(encoding="utf-8")
        if "anthropic" in t.lower() or "/api/ai" in t:
            if "ref" not in t and "стих" not in t:
                bad.append((fp.name, "AI-ответ без ссылки на стих (ЗКН-Пр003)"))
    return bad


def check_b001():
    """Название книги как ОДНА СТРОКА — только `bookFullTitle()`.

    ПРАВОМЕРНО (не нарушение):
      • двухстрочная вёрстка (ВБК-герой, печатная обложка): titleLine1 И titleLine2
        используются ВМЕСТЕ как две строки — это дизайн, а не половина названия;
      • массив зависимостей useMemo/useEffect.

    НАРУШЕНИЕ: titleLine1 ОДИН, без пары — тогда видна половина названия
    («Бхагавад-гита» вместо «Бхагавад-гита как она есть»), либо своя копия
    склейки (она расходится: теряется висячий дефис).
    """
    bad = []
    for fp in files():
        # Печать и ВБК-герой: название набирается ДВУМЯ строками по дизайну (это не
        # половина названия, а вёрстка). Вторая строка там может идти через переменную.
        if fp.name in ("books.ts", "BookHeroCard.tsx", "PdfDoc.tsx", "pdfCover.ts"):
            continue
        lines = fp.read_text(encoding="utf-8").split("\n")
        for i, l in enumerate(lines, 1):
            if not re.search(r"\.titleLine1\b", l) or "bookFullTitle" in l:
                continue
            near = "\n".join(lines[max(0, i - 3):i + 2])
            if ".titleLine2" in near:
                continue      # пара строк рядом — двухстрочная вёрстка или зависимости
            bad.append((fp.name, "одинокий titleLine1 (%d) — видна ПОЛОВИНА названия (ЗКН-Б001)" % i))
    return bad


def check_i004_code():
    """Канонический титул Прабхупады — и в КОДЕ, не только в данных.

    Гейт данных проверял D1; в коде жили 27 нарушений (все книги).
    Цитаты не редактируются (ЗКН-БТ004) — их исключаем.
    """
    bad = []
    pat = re.compile(r"Милост[а-я]+\s+А\.")
    for fp in files():
        for i, l in enumerate(fp.read_text(encoding="utf-8").split("\n"), 1):
            if not pat.search(l):
                continue
            if any(m in l for m in QUOTE_MARKERS):
                continue  # чужой голос — ЗКН-БТ004
            bad.append((fp.name, "титул с инициалами (%d) → «Абхай Чаранаравинда» (ЗКН-И004)" % i))
    return bad


def check_b007():
    """ЗКН-Б007: книга, читаемая в D1, ОБЯЗАНА быть в бандле.

    `App.tsx`: `const bk = BOOKS[work] ? work : "bg";` — если книги нет в `books.ts`,
    читалка МОЛЧА открывает «Бхагавад-гиту». Человек жмёт «Чайтанья-бхагавата»
    и попадает в другую книгу. Молчаливая подмена хуже ошибки (ЗКН-Пр007).

    Здесь сверяем `books.ts` со списком книг, у которых в D1 есть текст.
    Список читаемых берём из снимка: он меняется только через ингест.
    """
    t = (SRC / "books.ts").read_text(encoding="utf-8") if (SRC / "books.ts").exists() else ""
    if not t:
        return []
    # книги, внесённые ингестом (у них в D1 есть стихи)
    ingested = ["cb", "cm", "br", "ndm"]
    miss = [w for w in ingested if ('work: "%s"' % w) not in t]
    if miss:
        return [("books.ts", "нет в бандле: %s — читалка молча откроет «Бхагавад-гиту» (ЗКН-Б007)"
                 % ", ".join(miss))]
    return []


def check_pr005():
    """ЗКН-Пр005 — ГАЯТРИ ТОЛЬКО ИНИЦИИРОВАННЫМ. Гейт УПРЕЖДАЮЩИЙ.

    Сейчас гаятри в приложении НЕТ — нарушить нечего. Но когда она появится,
    её обязан закрывать гейт по уровню (`effectiveLevel`): брахма-гаятри и
    гуру-мантра даются на дикше и не показываются гостю.

    Правило: файл, где есть гаятри-содержимое, ОБЯЗАН звать `effectiveLevel`.
    """
    bad = []
    marks = ("гаятри", "gayatri", "гуру-мантра", "брахма-гаятри")
    for fp in files():
        t = fp.read_text(encoding="utf-8")
        low = t.lower()
        if not any(m in low for m in marks):
            continue
        # упоминание в комментарии/законе — не содержимое
        body = "\n".join(l for l in t.split("\n")
                          if not l.strip().startswith(("*", "//", "/*")))
        if not any(m in body.lower() for m in marks):
            continue
        if "effectiveLevel" not in t:
            bad.append((fp.name, "гаятри БЕЗ гейта по уровню — видна гостю (ЗКН-Пр005)"))
    return bad


def check_r011():
    """ЗКН-Р011 — ЗНАЧЕНИЕ ФИЛЬТРА В КОДЕ ОБЯЗАНО СУЩЕСТВОВАТЬ В БАЗЕ.

    Фильтр книг искал `lineage === "iskcon"`, а в базе — **"guru-iskcon"**.
    Счётчик показывал 0, хотя книги есть. Ноль выглядит как «книг нет», а не
    как «фильтр сломан» — молчаливая ложь.
    """
    t = (SRC / "BooksHub.tsx").read_text(encoding="utf-8")
    body = "\n".join(l for l in t.split("\n")
                      if not l.strip().startswith(("*", "//", "/*")))
    VALID = {"prabhupada", "acharya", "guru-iskcon", "all"}
    bad = []
    for m in re.finditer(r'b\.lineage === "([a-z-]+)"', body):
        if m.group(1) not in VALID:
            bad.append(("BooksHub.tsx", "фильтр ищет lineage «%s» — такого значения в базе "
                                        "НЕТ, счётчик покажет 0 (ЗКН-Р011)" % m.group(1)))
    return bad


def check_b009():
    """ЗКН-Б009: АУДИО И ТЕКСТ — ОДНА КНИГА. Переход в ОБЕ стороны, в ТО ЖЕ место.

    Связь ломается тихо и однобоко: «Слушать» из текста делают сразу, а обратный
    путь забывают — и человек, слушая ШБ 1.1.5, жмёт «Читать» и падает на ОБЛОЖКУ
    книги. Так и было: NowPlaying отбрасывал главу у иерархических книг (ШБ/ЧЧ).

    Проверяем ЧЕТЫРЕ звена (все — код, не намерения):
      1. плеер знает адрес текста (`textPath`) и уважает иерархию (`hierarchical`);
      2. кнопка «Читать» ведёт по этому адресу, а не в корень книги;
      3. дорожка несёт `ref` — ключ стиха (иначе «то же место» недостижимо);
      4. читалка следует за звуком по `player.track?.ref`.
    """
    bad = []
    np = (SRC / "player" / "NowPlaying.tsx")
    st = (SRC / "player" / "store.tsx")
    bd = (SRC / "BookDetailPage.tsx")
    t_np = np.read_text(encoding="utf-8") if np.exists() else ""
    t_st = st.read_text(encoding="utf-8") if st.exists() else ""
    t_bd = bd.read_text(encoding="utf-8") if bd.exists() else ""

    if "textPath" not in t_np or "hierarchical" not in t_np:
        bad.append(("player/NowPlaying.tsx",
                    "плеер не строит адрес текста с учётом иерархии — «Читать» уронит на обложку"))
    if "onOpenPath?.(textPath)" not in t_np:
        bad.append(("player/NowPlaying.tsx",
                    "кнопка «Читать» не ведёт в место звучания (ЗКН-Б009)"))
    if "ref?: string | null" not in t_st:
        bad.append(("player/store.tsx",
                    "дорожка не несёт ref стиха — связь до стиха невозможна"))
    if "player.track?.ref" not in t_bd:
        bad.append(("BookDetailPage.tsx",
                    "читалка не следует за звуком по ref стиха (ЗКН-Б009)"))
    return bad


CHECKS = [
    ("ЗКН-Б009", "аудио ↔ текст: переход в обе стороны", check_b009),
    ("ЗКН-Б007", "книга в D1 → обязана быть в бандле", check_b007),
    ("ЗКН-Р011", "значение фильтра существует в базе", check_r011),
    ("ЗКН-Пр005", "гаятри — только по уровню (упреждающе)", check_pr005),
    ("ЗКН-Пр001", "нет соц-графа (чаты/подписки/комменты)", check_pr001),
    ("ЗКН-Пр003", "AI только со ссылкой на стих", check_pr003),
    ("ЗКН-Б001", "название книги — bookFullTitle()", check_b001),
    ("ЗКН-И004", "канон титула Прабхупады в коде", check_i004_code),
]


def main():
    print("АУДИТ ПРОДУКТА И КНИГ · домены Пр · Б")
    print("─" * 70)
    details = []
    for law, name, fn in CHECKS:
        bad = fn()
        details += [(law, f, why) for f, why in bad]
        print("  %s %-11s %-40s %d" % ("✓" if not bad else "✗", law, name[:40], len(bad)))
    print("─" * 70)
    if details:
        print("\nНАРУШЕНИЯ (%d):\n" % len(details))
        for law, f, why in details[:25]:
            print("  %-11s %-24s %s" % (law, f[:24], why))
        print("\nСвод: docs/LAWS.md")
        return 1
    print("Нарушений нет ✓")
    return 0


if __name__ == "__main__":
    sys.exit(main())
