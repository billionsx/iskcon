#!/usr/bin/env python3
"""
ЗКН-Д013 · ГЕЙТ ЧУЖОГО ГОЛОСА.

Закон, который держится на памяти разработчика, не держится. Новый экран,
новый компонент — и стих снова набран UI-шрифтом, как биография.

Гейт ищет по всему фронту места, где рисуется ЧУЖОЙ ГОЛОС (стих писания,
куплет бхаджана, цитата) и проверяет, что там стоит SCRIPTURE_VOICE — единый
источник правды. Ловится на живом нарушении: убери стиль — гейт покраснеет.
"""
import re
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / "apps" / "web" / "src"

# Поля чужого голоса: стих, транслитерация, куплет, цитата.
# `${r.t}` — метка времени в шаблонной строке, а не стих: отсекаем по `$`.
VOICE_FIELDS = re.compile(
    r"(?<!\$)\{(?:r|v|q|verse)\.(?:translation|translit|text|t)\}|"
    r"\{stripWrap\(q\.t\)\}")
# Деванагари — СВОЁ письмо со своим шрифтом (--font-deva). Курсивной Georgia
# санскрит не набирают: закон о голосе не отменяет закон о письме.
DEVA = re.compile(r"font-deva")
HAS_VOICE = re.compile(r"SCRIPTURE_VOICE|font-scripture|SCRIPTURE_VOICE_PRINT")
SKIP = {"voice.ts", "scripture.ts", "Skt.tsx"}


def main():
    bad = []
    for f in sorted(SRC.rglob("*.tsx")):
        if f.name in SKIP:
            continue
        lines = f.read_text(encoding="utf-8").split("\n")
        for i, ln in enumerate(lines, 1):
            if not VOICE_FIELDS.search(ln) or DEVA.search(ln):
                continue
            # стиль может стоять на этой строке или на 3 строках выше (JSX-обёртка)
            window = "\n".join(lines[max(0, i - 4):i + 1])
            if not HAS_VOICE.search(window):
                bad.append((f.relative_to(SRC), i, ln.strip()[:70]))
    print("ГЕЙТ ЧУЖОГО ГОЛОСА (ЗКН-Д013)")
    print("─" * 68)
    if not bad:
        print("  ✓ чужой голос везде набран курсивным Georgia")
        return 0
    for f, i, ln in bad:
        print("  ✗ %s:%d  %s" % (f, i, ln))
    print("\n  НАРУШЕНИЙ: %d — стих/бхаджан/цитата набраны как наша проза" % len(bad))
    return 1


if __name__ == "__main__":
    sys.exit(main())
