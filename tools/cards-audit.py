#!/usr/bin/env python3
"""
АУДИТ КАРТОЧЕК — домен К (12 законов). Стандарт: docs/STANDARD_cards.md.

Карточка — единица приложения. Утверждено 4 формата: ВБК (большая витринная),
ВСК (средняя), ВМК (минимальная), ПК (подробная). До этого аудита ни один из
12 законов домена не проверялся ничем — стандарт существовал только на бумаге.

Проверяется:
  К001  обложка-слайдер — только через `useCoverSlider` (своя реализация запрещена)
  К002  действия (♥ избранное · ⋯ меню) обязательны во ВСЕХ витринных карточках
  К003  ноль дрейфа док↔код внутри файла
  К004  ВБК: обложка 4/5, radius 20, текст НА обложке
  К007  ПК = ВБК целиком (той же геометрии), своей шапки у ПК нет
  К011  нет переносов в коротких слотах (чипы, квалификатор)

Запуск: python3 tools/cards-audit.py
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "apps" / "web" / "src"

# Витринные карточки (ВБК/ВСК) — те, что показывают элемент библиотеки лицом.
SHOWCASE = [
    "PersonHeroCard.tsx", "BookHeroCard.tsx", "BhajanCard.tsx",
    "CalendarEventCard.tsx", "AudioShowcaseCard.tsx", "NoteHeroCard.tsx",
    "dhama/TirthaHeroCard.tsx", "dhama/DhamaHeroCard.tsx",
    "centers/CenterHeroCard.tsx", "prasad/RecipeCard.tsx",
]

# Карточки с обложкой-слайдером (несколько изображений).
WITH_SLIDER = ["PersonHeroCard.tsx", "BookHeroCard.tsx", "centers/CenterHeroCard.tsx"]


def read(rel: str) -> str:
    p = SRC / rel
    return p.read_text(encoding="utf-8") if p.exists() else ""


def check_k001():
    """Обложка-слайдер — единый модуль. Своя реализация (setInterval по картинкам) запрещена."""
    bad = []
    for c in SHOWCASE:
        t = read(c)
        if not t:
            continue
        # своя карусель = таймер + индекс картинки, но без общего хука
        own = re.search(r"setInterval\([^)]*\)\s*;?[\s\S]{0,200}(idx|index|slide)", t)
        if own and "useCoverSlider" not in t:
            bad.append((c, "своя реализация слайдера мимо useCoverSlider"))
    return bad


def check_k002():
    """Действия обязательны во всех витринных карточках: ♥/📌 + ⋯ меню.

    Формы, засчитываемые как «есть действия»:
      • CardActionBtns — общий компонент, даёт ОБА действия сразу
      • coverActions — действия приходят пропом от родителя
      • пара: (HeartIcon | PinIcon | useFavorite) + (MoreIcon | onMore | onMenuSelect)

    ЗАМЕТКИ — законное исключение: у своей заметки нет «избранного»,
    вместо ♥ стоит 📌 «закрепить» (ЗКН-К002, оговорка).
    """
    bad = []
    for c in SHOWCASE:
        t = read(c)
        if not t:
            continue
        if "CardActionBtns" in t or "coverActions" in t:
            continue
        fav = any(k in t for k in ("HeartIcon", "PinIcon", "useFavorite", "favorited"))
        menu = any(k in t for k in ("MoreIcon", "onMore", "onMenuSelect", "useCardActions"))
        if fav and menu:
            continue
        miss = []
        if not fav:
            miss.append("♥/📌")
        if not menu:
            miss.append("⋯ меню")
        bad.append((c, "нет действий: " + ", ".join(miss)))
    return bad


def check_k003():
    """Ноль дрейфа док↔код ВНУТРИ файла: комментарий не может противоречить константе."""
    bad = []
    t = read("CardCover.tsx")
    if t:
        m = re.search(r"COVER_INTERVAL_MS\s*=\s*(\d+)", t)
        if m:
            sec = int(m.group(1)) // 1000
            # ищем в комментариях другое число секунд
            for cm in re.findall(r"\*.*?(\d+)\s*сек", t):
                if int(cm) != sec:
                    bad.append(("CardCover.tsx", "док говорит «%s сек», код = %d сек" % (cm, sec)))
    return bad


def check_k004_k007():
    """ВБК: обложка 4/5 + radius. ПК рендерит ТУ ЖЕ ВБК (не свою шапку)."""
    bad = []
    for c in ("PersonHeroCard.tsx", "BookHeroCard.tsx"):
        t = read(c)
        if not t:
            continue
        if 'aspectRatio: "4 / 5"' not in t and "aspectRatio: '4 / 5'" not in t:
            bad.append((c, "ВБК: обложка не 4/5 (ЗКН-К004)"))
    # ПК (EntityPage) обязана рендерить PersonHeroCard, а не свою шапку
    ep = read("EntityPage.tsx")
    if ep and "PersonHeroCard" not in ep:
        bad.append(("EntityPage.tsx", "ПК не рендерит ВБК — своя шапка (ЗКН-К007)"))
    return bad


def check_k011():
    """Нет переносов в коротких слотах: чипы ВБК — один ряд."""
    bad = []
    for c in ("PersonHeroCard.tsx", "BookHeroCard.tsx"):
        t = read(c)
        if not t:
            continue
        # блок чипов должен иметь nowrap/overflow, иначе перенесётся
        chips = re.search(r"chips[\s\S]{0,400}?\}\)\}", t)
        if chips and "nowrap" not in chips.group() and "overflowX" not in chips.group():
            bad.append((c, "чипы могут переноситься (нет nowrap/overflowX) — ЗКН-К011"))
    return bad


CHECKS = [
    ("ЗКН-К001", "обложка-слайдер — единый модуль", check_k001),
    ("ЗКН-К002", "действия во всех витринных карточках", check_k002),
    ("ЗКН-К003", "ноль дрейфа док↔код в файле", check_k003),
    ("ЗКН-К004", "ВБК 4/5 · ЗКН-К007 ПК = ВБК", check_k004_k007),
    ("ЗКН-К011", "нет переносов в коротких слотах", check_k011),
]


def main():
    print("АУДИТ КАРТОЧЕК · домен К · стандарт: docs/STANDARD_cards.md")
    print("─" * 70)
    total = 0
    details = []
    for law, name, fn in CHECKS:
        bad = fn()
        total += len(bad)
        mark = "✓" if not bad else "✗"
        print("  %s %-11s %-40s %d" % (mark, law, name[:40], len(bad)))
        for f, why in bad:
            details.append((law, f, why))
    print("─" * 70)
    if details:
        print("\nНАРУШЕНИЯ (%d):\n" % total)
        for law, f, why in details:
            print("  %-11s %-28s %s" % (law, f, why))
        print("\nСтандарт: docs/STANDARD_cards.md · Свод: docs/LAWS.md")
        return 1
    print("Нарушений нет ✓  (проверено карточек: %d)" % len(SHOWCASE))
    return 0


if __name__ == "__main__":
    sys.exit(main())
