#!/usr/bin/env python3
"""
ЗКН-Р016 · ГЕЙТ МАРКЕРОВ КОНФЛИКТА.

14.07.2026 в `main` уехал `docs/LAWS.md` с ЖИВЫМИ маркерами конфликта внутри:

    <<<<<<< HEAD
    | ЗКН-Д013 | …старая редакция…
    =======
    | ЗКН-Д013 | …новая редакция…
    >>>>>>> 1a14e74e

Свод законов — источник правды проекта. Полурешённый ребейз превратил его в
кашу, и никто этого не заметил: ни один гейт не смотрит на конфликтные маркеры,
а Markdown не падает от них — он просто печатает мусор. Тот же мусор в `.tsx`
уронил бы сборку, в `.md` — тихо живёт.

ПРАВИЛО: ни один файл проекта (docs · src · tools · workflows) не может
содержать маркеры конфликта. Ребейз считается закрытым только после того, как
маркеров не осталось.

Проверено на живом нарушении: вернуть маркеры в LAWS.md — гейт краснеет.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AREAS = ["docs", "apps/web/src", "tools", ".github/workflows"]
EXTS = {".md", ".ts", ".tsx", ".py", ".yml", ".yaml", ".css", ".json", ".mjs"}
MARK = re.compile(r"^(<<<<<<< |=======$|>>>>>>> )")
SELF = Path(__file__).name


def main() -> int:
    bad: list[str] = []
    for area in AREAS:
        base = ROOT / area
        if not base.exists():
            continue
        for f in sorted(base.rglob("*")):
            if not f.is_file() or f.suffix not in EXTS or f.name == SELF:
                continue
            try:
                lines = f.read_text(encoding="utf-8").split("\n")
            except (UnicodeDecodeError, OSError):
                continue
            for i, ln in enumerate(lines, 1):
                if MARK.match(ln):
                    bad.append(f"{f.relative_to(ROOT)}:{i} — маркер конфликта: {ln[:40]}")

    if bad:
        print("ГЕЙТ МАРКЕРОВ КОНФЛИКТА (ЗКН-Р016) — НАРУШЕНИЯ:\n")
        for b in bad:
            print("  ✗ " + b)
        print(f"\nВсего: {len(bad)}. Ребейз не закрыт.")
        return 1
    print("Гейт маркеров конфликта (ЗКН-Р016): чисто.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
