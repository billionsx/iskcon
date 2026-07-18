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

ПРАВИЛО 4 — голый ♥/⋯ (ЗКН-Д014). `<CardActionBtns>` / `<RoundBtn>` без `plain`
  и без `dark` берёт серый кружок по умолчанию: на белой карточке это лишняя
  плашка (та же болезнь), а прижатый к краю глиф ещё и обрезается под
  `overflow:hidden`. Выбор обязателен: `plain` (чистая поверхность) | `dark`
  (поверх медиа). Именно этого механизма не хватало — закон про глифы был, а
  гейт ловил только контейнеры, поэтому голые кнопки просочились в ленту.

ПРАВИЛО 5 — обводка вокруг карточки группы (ЗКН-Д018). Замер по iOS 26.5:
  карточка сгруппированного экрана — БЕЛОЕ НА СЕРОМ, без единой линии по
  периметру. Обводка превращает группу в «таблицу» и читается как дешёвая
  копия системного экрана. Стиль с `background: var(--color-card)` и ключом
  `border:` — нарушение.

ПРАВИЛО 6 — сгруппированный экран собирается из общих кирпичей (ЗКН-Д018).
  Экраны кабинета и практики обязаны брать строку/группу/лист из `ui/ios.tsx`,
  где числа сняты со скриншотов Apple. Свой велосипед строки = свой радиус,
  свой разделитель 0.5px и свои отступы «на глаз» — ровно то, из-за чего
  кабинет выглядел дёшево.

ПРАВИЛО 7 — строка поиска одна на приложение (ЗКН-Д019). Эталон — App Store:
  капсула 38, врезка 20, заливка карточки, БЕЗ обводки, читается тенью.
  Реализация ровно одна — `<SearchField>` в `ui/ios.tsx`; собственный
  `<input inputMode="search">` где-либо ещё запрещён.

ПРАВИЛО 8 — токены сгруппированного экрана существуют (ЗКН-Д018). В
  `globals.css` обязаны быть `--color-canvas` · `--color-card` ·
  `--color-separator` · `--radius-card` · `--row-h` · `--gap-group`, причём
  цвета — и в тёмной, и в светлой теме. Молча удалить замер нельзя.

ПРАВИЛО 9 — в кабинете живёт только кабинет (ЗКН-Н088). Практика, прогресс и
  достижения переехали в «Практику» решением основателя 18.07.2026. Гейт держит
  РАЗДЕЛЕНИЕ, а не намерение: адреса практики (`/japa` · `/story` · `/promise` ·
  `/progress` · `/verse`) запрещены в `AccountScreen.tsx` и обязаны быть в
  `PracticeHub.tsx`. Иначе свалка вернётся тихо, строчка за строчкой.
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
ACTION_BTN = re.compile(r"<(CardActionBtns|RoundBtn)\b")

# ── ЗКН-Д018 · сгруппированный экран iOS 26.5 ──────────────────────────────
CARD_FILL = re.compile(r"background:\s*[\"'`]var\(--color-card\)")
BORDER_KEY = re.compile(r"\bborder:\s*[\"'`0-9]")
SHADOW_KEY = re.compile(r"\bboxShadow:")
# Экраны, обязанные собираться из ui/ios.tsx (кирпичи с замеренной геометрией).
GROUPED_SCREENS = ("AccountScreen.tsx", "PracticeHub.tsx")
IOS_IMPORT = re.compile(r"from\s+[\"'`]\./ui/ios[\"'`]")
# ЗКН-Д019 — единственная реализация строки поиска.
SEARCH_INPUT = re.compile(r"inputMode=[\"'`]search[\"'`]")
SEARCH_OK = {"ios.tsx"}
# ЗКН-Д018 — токены замера. Пропажа = возврат к «на глаз».
GROUP_TOKENS = ("--color-canvas", "--color-card", "--color-separator",
                "--radius-card", "--row-h", "--gap-group", "--shadow-group")
GROUP_TOKENS_LIGHT = ("--color-canvas", "--color-card", "--color-separator")
# ЗКН-Н088 — адреса практики: их место в «Практике», а не в кабинете.
PRACTICE_PATHS = ("/japa", "/story", "/promise", "/progress", "/verse")


def blank_block_comments(text: str) -> str:
    """Тело /* … */ → пробелы (переводы строк сохранены), чтобы <CardActionBtns>
    в doc-комментарии не ловился и номера строк не съезжали."""
    return re.sub(r"/\*.*?\*/", lambda m: re.sub(r"[^\n]", " ", m.group(0)), text, flags=re.S)


def tag_end(text: str, start: int) -> int:
    """Индекс за закрывающим '>' JSX-тега (с '<'), с учётом вложенных {…} —
    чтобы '>' внутри onMore={() => …} не принять за конец тега."""
    i, depth = start, 0
    while i < len(text):
        c = text[i]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
        elif c == ">" and depth == 0:
            return i + 1
        i += 1
    return len(text)


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


def check_grouped_screen() -> list[str]:
    """ЗКН-Д018 · ЗКН-Д019 · ЗКН-Н088 — сгруппированный экран iOS 26.5.

    Три беды одной природы: экран собирают «на глаз», строку поиска рисуют
    заново в каждом месте, а в кабинет сползает всё подряд. Гейт держит замер,
    единственную реализацию и разделение разделов.
    """
    bad: list[str] = []

    # ПРАВИЛО 8 — токены замера на месте (и в тёмной, и в светлой теме).
    css = SRC / "ui" / "globals.css"
    if css.exists():
        t = css.read_text(encoding="utf-8")
        for tok in GROUP_TOKENS:
            if f"{tok}:" not in t:
                bad.append(f"apps/web/src/ui/globals.css — ЗКН-Д018: пропал токен "
                           f"{tok}. Геометрия сгруппированного экрана снята со "
                           f"скриншотов iOS 26.5 и живёт в токенах, а не в головах")
        light = t.split(":root[data-theme='light']", 1)
        if len(light) > 1:
            for tok in GROUP_TOKENS_LIGHT:
                if f"{tok}:" not in light[1]:
                    bad.append(f"apps/web/src/ui/globals.css — ЗКН-Д018: у светлой темы "
                               f"нет {tok}. Холст и карточка обязаны быть замерены "
                               f"в ОБЕИХ темах, иначе светлая уедет на дефолт тёмной")
        else:
            bad.append("apps/web/src/ui/globals.css — ЗКН-Д018: нет блока светлой темы")
    else:
        bad.append("apps/web/src/ui/globals.css — ЗКН-Д018: файл токенов исчез")

    # ПРАВИЛО 6 — экраны кабинета/практики собираются из ui/ios.tsx.
    for name in GROUPED_SCREENS:
        p = SRC / name
        if not p.exists():
            bad.append(f"apps/web/src/{name} — ЗКН-Д018: экран исчез")
            continue
        t = p.read_text(encoding="utf-8")
        if not IOS_IMPORT.search(t):
            bad.append(f"apps/web/src/{name} — ЗКН-Д018: экран не берёт кирпичи из "
                       f"./ui/ios. Своя строка списка = свой радиус, свой "
                       f"разделитель и свои отступы «на глаз»")

    # ПРАВИЛО 9 — в кабинете живёт только кабинет.
    acc = SRC / "AccountScreen.tsx"
    prac = SRC / "PracticeHub.tsx"
    if acc.exists():
        t = blank_block_comments(acc.read_text(encoding="utf-8"))
        for path in PRACTICE_PATHS:
            if f'"{path}"' in t:
                bad.append(f"apps/web/src/AccountScreen.tsx — ЗКН-Н088: в кабинете "
                           f"адрес практики «{path}». Практика, прогресс и достижения "
                           f"живут в «Практике» (PracticeHub), кабинет — про аккаунт")
    if prac.exists():
        t = prac.read_text(encoding="utf-8")
        missing = [p for p in PRACTICE_PATHS if f'"{p}"' not in t]
        if missing:
            bad.append(f"apps/web/src/PracticeHub.tsx — ЗКН-Н088: практика потеряла "
                       f"{', '.join(missing)}. Разделы не исчезают при переезде — "
                       f"они меняют место")
    return bad


def main() -> int:
    bad: list[str] = check_grouped_screen()
    for f in sorted(SRC.rglob("*.tsx")):
        text = f.read_text(encoding="utf-8")
        rel = f.relative_to(SRC.parents[2])
        has_fallback = bool(FALLBACK_COVER.search(text))

        # ПРАВИЛО 7 — строка поиска ровно одна (ЗКН-Д019, эталон App Store)
        if f.name not in SEARCH_OK and SEARCH_INPUT.search(text):
            line = text.count("\n", 0, SEARCH_INPUT.search(text).start()) + 1
            bad.append(
                f"{rel}:{line} — ЗКН-Д019: своя строка поиска. Эталон App Store "
                f"живёт один раз — <SearchField> в ui/ios.tsx (капсула 38, врезка 20, "
                f"без обводки, читается тенью)")

        # ПРАВИЛО 3 — второй плеер
        if AUDIO_TAG.search(text) and f.name not in AUDIO_OK:
            line = text.count("\n", 0, AUDIO_TAG.search(text).start()) + 1
            bad.append(
                f"{rel}:{line} — ЗКН-Д015: второй плеер. Тег <audio> вне ВКЗ "
                f"(AudioShowcaseCard.tsx) и глобального плеера (player/store.tsx). "
                f"Звук рисует ОДИН компонент")

        # ПРАВИЛО 4 — голый ♥/⋯ (ЗКН-Д014). CardActionBtns/RoundBtn без plain и без
        # dark берёт серый кружок по умолчанию: на белом это лишняя плашка, а
        # прижатый к краю глиф ещё и обрезается. Выбор обязателен: plain | dark.
        code = blank_block_comments(text)
        for m in ACTION_BTN.finditer(code):
            tag = code[m.start():tag_end(code, m.start())]
            if " plain" not in tag and " dark" not in tag:
                line = code.count("\n", 0, m.start()) + 1
                bad.append(
                    f"{rel}:{line} — ЗКН-Д014: голый <{m.group(1)}> (серый кружок по "
                    f"умолчанию). На чистой поверхности — plain (глиф без плашки), "
                    f"поверх медиа — dark. Голый вариант запрещён")

        for tag, attrs, body, line in style_objects(text):
            # ПРАВИЛО 5 — обводка вокруг карточки группы (ЗКН-Д018).
            # Замер iOS 26.5: карточка — белое на сером, БЕЗ линии по периметру.
            if CARD_FILL.search(body) and BORDER_KEY.search(body):
                bad.append(
                    f"{rel}:{line} — ЗКН-Д018: обводка вокруг карточки группы. "
                    f"Слой держит материал (--shadow-card), а не линия по периметру: "
                    f"обводка превращает группу в таблицу и читается как веб-форма")
            # Холст БЕЛЫЙ (решение основателя 18.07.2026) — значит без тени
            # карточки группы попросту НЕ ВИДНО. Материал обязателен.
            if CARD_FILL.search(body) and not SHADOW_KEY.search(body):
                bad.append(
                    f"{rel}:{line} — ЗКН-Д018: карточка группы без материала. "
                    f"Холст белый, обводка запрещена — слой создаёт только "
                    f"boxShadow: var(--shadow-group). Без него группы не видно")
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
    print("Гейт поверхности (ЗКН-Д014 · Д005 · Д015 · Д018 · Д019 · Н088): чисто.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
