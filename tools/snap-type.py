#!/usr/bin/env python3
"""
SNAP-TYPE — приведение типографики к шкале ISKCON Design (ЗКН-Д001, ЗКН-Д006).

Что делает:
  1. Полуразмеры (14, 12.5, 15.5…) прижимает к ролям Dynamic Type
  2. Кегли НИЖЕ ПОЛА 11px поднимает до 11 (ЗКН-Д006 — читаемость)
  3. Крупнее шкалы (36) сводит к display (34)

Чего НЕ трогает:
  · печатную вёрстку (строки с mm/pt — у PDF своя типографика)
  · декоративные глифы (◆ ● • ★ — это украшение, не текст)
  · файлы, определяющие токены (tokens.ts, globals.css) и печать (PdfDoc, pdf.ts, pdfCover.ts)

Запуск:  python3 tools/snap-type.py [--dry]
"""
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "apps" / "web" / "src"
EXEMPT = {"tokens.ts", "globals.css", "PdfDoc.tsx", "pdf.ts", "pdfCover.ts"}

FLOOR = 11
CEILING = 60          # крупнее — декоративный водяной знак (буква-подложка), не текст
GLYPHS = "◆●•★▸▾·✦"

SCALE = [(11, "caption2"), (12, "caption"), (13, "footnote"), (15, "subhead"),
         (16, "callout"), (17, "body"), (20, "title3"), (22, "title2"),
         (28, "title1"), (34, "display")]

PAT = re.compile(r"fontSize:\s*(\d+(?:\.\d+)?)(?![\d.])")
PRINT_UNITS = re.compile(r"\d+(mm|pt)\b")


def role_for(v: float) -> str:
    """Ближайшая роль. Ниже пола → caption2 (11). Выше шкалы → display (34).

    ПРИ РАВНОМ РАССТОЯНИИ ОКРУГЛЯЕМ ВВЕРХ — в сторону читаемости.
    (14 → subhead 15, а не footnote 13.)
    """
    if v < FLOOR:
        return "caption2"
    best = min(SCALE, key=lambda s: (abs(s[0] - v), -s[0]))
    return best[1]


def main():
    dry = "--dry" in sys.argv
    stats = Counter()
    floor_fixes = []
    total, files = 0, 0

    for fp in sorted(SRC.rglob("*")):
        if fp.suffix not in (".ts", ".tsx") or fp.name in EXEMPT:
            continue
        lines = fp.read_text(encoding="utf-8").split("\n")
        changed = False
        for i, line in enumerate(lines):
            if PRINT_UNITS.search(line):          # печать — своя типографика
                continue
            if any(g in line for g in GLYPHS):    # украшение, не текст
                continue
            if not PAT.search(line):
                continue

            def sub(m):
                nonlocal changed
                v = float(m.group(1))
                if v in (11, 12, 13, 15, 16, 17, 20, 22, 28, 34):
                    return m.group(0)             # уже на шкале (число) — не трогаем
                if v >= CEILING:
                    return m.group(0)             # водяной знак/подложка — не текст
                r = role_for(v)
                stats["%s→%s" % (m.group(1), r)] += 1
                if v < FLOOR:
                    floor_fixes.append((fp.name, i + 1, m.group(1)))
                changed = True
                return 'fontSize: "var(--text-%s)"' % r

            lines[i] = PAT.sub(sub, line)
        if changed and not dry:
            fp.write_text("\n".join(lines), encoding="utf-8")
            files += 1

    total = sum(stats.values())
    print("SNAP-TYPE%s" % (" (сухой прогон)" if dry else ""))
    print("  прижато кеглей: %d в %d файлах\n" % (total, files))
    print("  карта переводов:")
    for k, n in stats.most_common():
        print("    %-18s ×%d" % (k, n))
    if floor_fixes:
        print("\n  ПОДНЯТО ДО ПОЛА 11px (ЗКН-Д006 — читаемость): %d" % len(floor_fixes))
        for f, ln, v in floor_fixes[:14]:
            print("    %-24s %-5d %s" % (f, ln, v))
        if len(floor_fixes) > 14:
            print("    … ещё %d" % (len(floor_fixes) - 14))
    return 0


if __name__ == "__main__":
    sys.exit(main())
