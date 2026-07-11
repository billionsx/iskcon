#!/usr/bin/env python3
"""
ЛИНТЕР ЗАКОНОВ — уровень принуждения У5 (docs/LAWS.md §1).

Нарушение закона не может попасть в прод: линтер роняет сборку.
Проверяет ИСХОДНЫЙ КОД (apps/web/src) — не данные D1.

Правила:
  Д003  ноль шаблонного мусора (leftover `Apartsales`)
  И001  голая «Шри Чайтанья Махапрабху» в UI-строках запрещена
  И003  «Гауранга-лила» / «Кришна-лила» — с заглавной, без дефиса (кроме slug/id)
  Т002  проза карточки идёт через cleanCardText (единая точка renderProse)
  Ц001  секреты не хардкодятся (ghp_ / github_pat_)

Чужой голос (ЗКН-БТ004): цитаты, стихи и выдержки Прабхупады НЕ проверяются на
канон имён — они не редактируются. В коде это данные из БД, линтер их не видит.

Запуск: python3 tools/laws-lint.py
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "apps" / "web" / "src"

# cardText.ts САМ определяет запрещённые формы (в regex) — он освобождён.
ALLOW = {"cardText.ts"}

RULES = [
    {
        "id": "ЗКН-Д003",
        "name": "ноль шаблонного мусора (Apartsales)",
        "pattern": re.compile(r"apartsales", re.I),
        "hint": "заменить на наши названия (ISKCON ONE LOVE) и токены --color-gold*",
    },
    {
        "id": "ЗКН-И001",
        "name": "голая «Шри Чайтанья Махапрабху»",
        # «Шри Кришна Чайтанья Махапрабху» — КАНОНИЧНА (между Шри и Чайтанья стоит Кришна)
        "pattern": re.compile(r"Шри\s+Чайтань[а-я]*\s+Махапрабху"),
        "hint": "→ «Гауранга Махапрабху» (общий/Навадвипа) или «Шри Кришна Чайтанья Махапрабху» (санньяса/Пури)",
    },
    {
        "id": "ЗКН-И003",
        "name": "дефисные «Гауранга-лила» / «Кришна-лила»",
        "pattern": re.compile(r"(Гауранга|Кришна)-лил[а-я]"),
        "hint": "→ «Гауранга Лила» / «Кришна Лила» (оба слова с заглавной, без дефиса)",
    },
    {
        "id": "ЗКН-Ц001",
        "name": "секрет в коде",
        "pattern": re.compile(r"(ghp_|github_pat_)[A-Za-z0-9_]{10,}"),
        "hint": "секреты только в GitHub Secrets / D1 app_config",
    },
]


def check_rules():
    bad = []
    for fp in sorted(SRC.rglob("*")):
        if fp.suffix not in (".ts", ".tsx", ".css") or fp.name in ALLOW:
            continue
        try:
            text = fp.read_text(encoding="utf-8")
        except Exception:
            continue
        for i, line in enumerate(text.split("\n"), 1):
            for r in RULES:
                if r["pattern"].search(line):
                    bad.append((r, str(fp.relative_to(ROOT)), i, line.strip()[:90]))
    return bad


def check_prose_law():
    """ЗКН-Т002: EntityPage — единая точка прозы обязана прогонять cleanCardText."""
    ep = SRC / "EntityPage.tsx"
    if not ep.exists():
        return []
    s = ep.read_text(encoding="utf-8")
    m = re.search(r"function renderProse\([^)]*\)[^{]*\{(.{0,400})", s, re.S)
    if not m or "cleanCardText" not in m.group(1):
        return [({"id": "ЗКН-Т002", "name": "проза мимо закона",
                  "hint": "renderProse обязан прогонять текст через cleanCardText"},
                 "apps/web/src/EntityPage.tsx", 0, "renderProse без cleanCardText")]
    return []


def main():
    bad = check_rules() + check_prose_law()
    if not bad:
        print("ЛИНТЕР ЗАКОНОВ: нарушений нет ✓")
        print("  проверено правил: %d + закон прозы (Т002)" % len(RULES))
        return 0

    by_rule = {}
    for r, f, i, line in bad:
        by_rule.setdefault(r["id"], []).append((r, f, i, line))

    print("ЛИНТЕР ЗАКОНОВ: НАРУШЕНИЯ (%d)\n" % len(bad))
    for rid, items in sorted(by_rule.items()):
        r = items[0][0]
        print("── %s · %s ── (%d)" % (rid, r["name"], len(items)))
        print("   %s" % r["hint"])
        for _, f, i, line in items[:12]:
            print("   %s:%s  %s" % (f, i, line))
        if len(items) > 12:
            print("   … ещё %d" % (len(items) - 12))
        print("")
    print("Свод законов: docs/LAWS.md")
    return 1


if __name__ == "__main__":
    sys.exit(main())
