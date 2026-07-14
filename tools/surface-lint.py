#!/usr/bin/env python3
"""
ЗКН-Д014 · ГЕЙТ ПОВЕРХНОСТИ.

Болезнь одна, всплывает в разных местах: КОНТЕЙНЕР КОНТЕНТА ЗАЛИВАЮТ СЕРЫМ.
`--color-glass-*` — это стекло для КОНТРОЛОВ (кнопка, чип, дорожка прогресса).
Если им залить карточку, на белом холсте получается серая плашка: контент
проваливается в дырку, интерфейс выглядит недоделанным. Один раз это уже
лечили руками у навигации (ЗКН-Н011) — и болезнь вернулась в плеер ленты.
Значит закон был без механизма.

ПРАВИЛО 1 — серая плашка. Контейнер (div/section/article/li/a) с padding и
  скруглением 14…40 не может иметь фоном `--color-glass-regular/thick` или
  `--color-fill-2`. Поверхность карточки = цвет страницы + волосяная линия.
  Кнопки (<button>) исключены: серая заливка — законная форма контрола.

ПРАВИЛО 3 — один плеер (ЗКН-Д015). Тег <audio> живёт ТОЛЬКО в ВКЗ
  (`AudioShowcaseCard.tsx`) и в глобальном плеере (`player/store.tsx`). Любой
  второй <audio> — это вторая реализация звука: она разъезжается со стандартом
  и остаётся серой, когда стандарт уже вычищен (так и вышло с голосовыми).

ПРАВИЛО 2 — скрим гасит золото (ЗКН-Д005). Там, где рисуется фирменная
  заглушка обложки, запрещён сплошной скрим `rgba(0,0,0,…)` во всю площадь
  (`inset: 0`): белая заглушка с золотым логотипом под скримом превращается в
  грязно-серый квадрат. Скрим законен ТОЛЬКО под текстом поверх обложки —
  там используется градиент, а не сплошная заливка.

Проверено на живом нарушении: вернуть `--color-glass-regular` фоном ВКЗ или
скрим поверх заглушки — гейт краснеет.
"""
import re
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / "apps" / "web" / "src"

CONTAINER_TAGS = {"div", "section", "article", "li", "a", "main", "aside"}
GREY_FILL = re.compile(r"background:\s*[\"'`]var\(--color-(?:glass-regular|glass-thick|fill-2)\)")
RADIUS = re.compile(r"borderRadius:\s*(\d+)")
PADDING = re.compile(r"\bpadding:")
FALLBACK_COVER = re.compile(r"COVER_FALLBACK|AUDIO_FALLBACK_COVER")
INSET0 = re.compile(r"inset:\s*0\b")
ABSOLUTE = re.compile(r"position:\s*[\"'`]absolute")
FLAT_SCRIM = re.compile(r"background:\s*[\"'`]rgba\(0,\s*0,\s*0,")
AUDIO_TAG = re.compile(r"<audio[\s>]")
AUDIO_OK = {"AudioShowcaseCard.tsx", "store.tsx"}


def style_objects(text: str):
    """Все инлайновые style-объекты файла: (тег, тело, номер строки)."""
    out = []
    for m in re.finditer(r"style=\{\{", text):
        i = m.end()
        depth = 2
        while i < len(text) and depth:
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
            i += 1
        body = text[m.end():i - 2]
        head = text[max(0, m.start() - 400):m.start()]
        tag, attrs = "", ""
        lt = head.rfind("<")
        if lt >= 0:
            tm = re.match(r"<([A-Za-z][\w.]*)", head[lt:])
            if tm:
                tag = tm.group(1)
                attrs = head[lt:]
        out.append((tag, attrs, body, text.count("\n", 0, m.start()) + 1))
    return out


def main() -> int:
    bad: list[str] = []
    for f in sorted(SRC.rglob("*.tsx")):
        text = f.read_text(encoding="utf-8")
        rel = f.relative_to(SRC.parents[2])
        has_fallback = bool(FALLBACK_COVER.search(text))

        # ПРАВИЛО 3 — второй плеер
        if AUDIO_TAG.search(text) and f.name not in AUDIO_OK:
            line = text.count("\n", 0, AUDIO_TAG.search(text).start()) + 1
            bad.append(
                f"{rel}:{line} — ЗКН-Д015: второй плеер. Тег <audio> вне ВКЗ "
                f"(AudioShowcaseCard.tsx) и глобального плеера (player/store.tsx). "
                f"Звук рисует ОДИН компонент")

        for tag, attrs, body, line in style_objects(text):
            # ПРАВИЛО 1 — серая плашка вместо поверхности
            if tag in CONTAINER_TAGS and GREY_FILL.search(body) and PADDING.search(body):
                r = RADIUS.search(body)
                if r and 14 <= int(r.group(1)) <= 40:
                    bad.append(
                        f"{rel}:{line} — ЗКН-Д014: серая плашка. Контейнер <{tag}> "
                        f"(padding, radius {r.group(1)}) залит --color-glass-*. "
                        f"Поверхность = var(--color-bg-2) + 0.5px var(--color-hairline)")
            # ПРАВИЛО 2 — скрим поверх фирменной заглушки. Подложка модалки/листа
            # (у неё есть role="dialog", а у position:fixed — вся страница) — не
            # обложка: её затемнение законно, это глубина, а не грязь.
            decor = "role=" not in attrs
            if has_fallback and decor and ABSOLUTE.search(body) and INSET0.search(body) and FLAT_SCRIM.search(body):
                bad.append(
                    f"{rel}:{line} — ЗКН-Д005: скрим rgba(0,0,0,…) во всю обложку. "
                    f"Он гасит золото заглушки и делает её серым квадратом")

    if bad:
        print("ГЕЙТ ПОВЕРХНОСТИ — НАРУШЕНИЯ:\n")
        for b in bad:
            print("  ✗ " + b)
        print(f"\nВсего: {len(bad)}")
        return 1
    print("Гейт поверхности (ЗКН-Д014 · Д005 · Д015): чисто.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
