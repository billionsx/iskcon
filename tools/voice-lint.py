#!/usr/bin/env python3
"""
ЗКН-Д013 · ГЕЙТ ЧУЖОГО ГОЛОСА · полная ревизия фронта.

Закон, который держится на памяти разработчика, не держится. Новый экран —
и стих снова набран UI-шрифтом, как биография.

ТРИ СТАТЬИ:

  A · ГОЛОС      стих писания, куплет бхаджана, цитата, святое имя —
                 набраны SCRIPTURE_VOICE (Georgia + курсив)

  B · КУРСИВ     Georgia без курсива — это ни голос, ни проза. Шрифт писания
                 применяется ТОЛЬКО с наклоном (кроме деванагари)

  C · ПИСЬМО     деванагари набирается СВОИМ шрифтом (--font-deva). У Georgia
                 нет деванагарских глифов: браузер подставит случайный фолбэк
                 и синтезирует наклон. Санскрит так не набирают.

Проверен на живых нарушениях по каждой статье.
"""
import re
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / "apps" / "web" / "src"

# Поля чужого голоса. `${r.t}` — метка времени в шаблоне, отсекаем по `$`.
VOICE = re.compile(
    r"(?<!\$)\{(?:r|v|q|verse|quote|item)\.(?:translation|translit|text|t)\}"
    r"|\{stripWrap\(q\.t\)\}"
    r"|\{MANTRA(?:_DEV|_RU)?\}"
    r"|MANTRA\.map"
    # Косвенный рендер: сниппет стиха в поиске, подпись сохранённого стиха в
    # избранном. Текст писания приходит сюда пропсом и легко теряет голос.
    r"|\{hl\(sub, toks\)\}|\{second\}|\{it\.subtitle\}|\{v\.snippet\}")
# Голос может передаваться ПРОПОМ: <Row sub={v.snippet} voice />. Сам компонент
# уже несёт SCRIPTURE_VOICE — метка `voice` и есть доказательство.
HAS_VOICE = re.compile(r"SCRIPTURE_VOICE|font-scripture|font-deva|\bvoice\b|VOICE_TYPES")
DEVA_CHARS = re.compile(r"[\u0900-\u097F]")
# Деванагари приходит и переменной: {MANTRA_DEV}, scriptLines(r.deva). Такой
# рендер обязан ссылаться на --font-deva, иначе Georgia подменит письмо.
DEVA_VAR = re.compile(r"\{MANTRA_DEV\}|\{[A-Z_]*DEVA?[A-Z_]*\}|scriptLines\(|\.deva\b")
DEVA_FONT = re.compile(r"font-deva")
SCRIPT_FONT = re.compile(r'fontFamily:\s*(?:"var\(--font-scripture\)"|FS|SERIF)\b')
ITALIC = re.compile(r'fontStyle:\s*"italic"|SCRIPTURE_VOICE')
SKIP_FILES = {"voice.ts", "scripture.ts", "Skt.tsx"}


def main():
    bad = []
    for f in sorted(list(SRC.rglob("*.tsx")) + list(SRC.rglob("*.css"))):
        if f.name in SKIP_FILES:
            continue
        lines = f.read_text(encoding="utf-8").split("\n")
        for i, ln in enumerate(lines, 1):
            code = ln.split("//")[0] if not ln.strip().startswith("*") else ""
            if not code.strip():
                continue
            # Стиль в JSX стоит и выше, и НИЖЕ строки (map → элемент).
            win = "\n".join(lines[max(0, i - 4):min(len(lines), i + 5)])

            # C · ПИСЬМО: деванагари не набирается Georgia (ни литералом, ни переменной)
            deva_here = DEVA_CHARS.search(code) or DEVA_VAR.search(code)
            if deva_here and ("fontFamily" in win) and not DEVA_FONT.search(win):
                bad.append(("ПИСЬМО", f, i, "деванагари не своим шрифтом"))
                continue
            if deva_here:
                continue
            # A · ГОЛОС
            if VOICE.search(code) and not HAS_VOICE.search(win):
                bad.append(("ГОЛОС", f, i, "стих/бхаджан/цитата набраны как наша проза"))
                continue
            # B · КУРСИВ: Georgia без наклона (деванагари — исключение по письму)
            if SCRIPT_FONT.search(code) and not ITALIC.search(code) \
               and not DEVA_CHARS.search(code) and "const " not in code:
                bad.append(("КУРСИВ", f, i, "Georgia без курсива — ни голос, ни проза"))

    print("ГЕЙТ ЧУЖОГО ГОЛОСА (ЗКН-Д013)")
    print("─" * 70)
    if not bad:
        print("  ✓ ГОЛОС   стих · бхаджан · цитата · святое имя — Georgia курсивом")
        print("  ✓ КУРСИВ  шрифт писания нигде не стоит без наклона")
        print("  ✓ ПИСЬМО  деванагари везде набран своим шрифтом")
        return 0
    for art, f, i, why in bad:
        print("  ✗ %-7s %s:%d  %s" % (art, f.relative_to(SRC), i, why))
    print("\n  НАРУШЕНИЙ: %d" % len(bad))
    return 1


if __name__ == "__main__":
    sys.exit(main())
