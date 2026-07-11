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
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "apps" / "web" / "src"

# cardText.ts САМ определяет запрещённые формы (в regex) — он освобождён.
ALLOW = {"cardText.ts", "nav.ts"}

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
        "id": "ЗКН-Д007",
        "name": "суррогатная обложка (спектрограмма / буква-монограмма / авто-парсинг)",
        "pattern": re.compile(r"archive\.org/services/img|audio-cover(-light)?\.png|/covers/[a-z-]+-ia\.jpg"),
        "hint": "→ COVER_FALLBACK / <CoverFallback dark /> (ЗКН-Д005/Д007). Суррогат хуже честной заглушки",
    },
    {
        "id": "ЗКН-Н001",
        "name": "прямая запись истории мимо nav.ts",
        "pattern": re.compile(r"history\.(push|replace)State"),
        "hint": "→ pushUrl() / replaceUrl() из ./nav. Сырой replaceState стирает appIdx и ломает «назад»",
    },
    {
        "id": "ЗКН-Н005",
        "name": "суб-таб в переменной модуля (мимо URL)",
        "pattern": re.compile(r"^let\s+\w*(Sub|Tab)\s*=", re.M),
        "hint": "→ состояние навигации живёт в URL: pushUrl()/replaceUrl(). Было: bogSub, sadSub",
    },
    {
        "id": "ЗКН-Н010",
        "name": "второй липкий слой на top:0 (наложение)",
        "pattern": re.compile(r"position:\s*sticky;\s*top:\s*0[;\"']"),
        "hint": "→ липнуть ПОД вышестоящим: top: var(--h-hall-tabs). Два слоя на top:0 = нижний исчезает",
    },
    {
        "id": "ЗКН-Д007b",
        "name": "буква-монограмма вместо фирменной заглушки",
        "pattern": re.compile(r"charAt\(0\)\.toUpperCase\(\)"),
        "hint": "→ COVER_FALLBACK / <CoverFallback />. Инициал в кружке — суррогат (ЗКН-Д007)",
    },
    {
        "id": "ЗКН-Н016",
        "name": "своя копия чипов навигации мимо ui/nav4",
        "pattern": re.compile(r"function (FilterChip|Pills|SegRow)\b"),
        "hint": "→ импортировать из ./ui/nav4 (ЗКН-Н006/Н016). Своя копия = разъезд системы",
    },
    {
        "id": "ЗКН-Н009",
        "name": "жёсткий дефолт-фильтр при входе (вместо «Все»)",
        "pattern": re.compile(r"sub:\s*[\"'](wave-|rasa:|bhag-)"),
        "hint": "→ sub: \"\" («Все»). Вход на витрину без фильтра в адресе показывает ВСЁ",
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


def check_floor_law():
    """ЗКН-Д006: пол типографики 11px. Ниже — нечитаемо (Apple HIG + правило globals.css).
    Исключения: печатная вёрстка (mm/pt), декоративные глифы, водяные знаки."""
    import re as _re
    pat = _re.compile(r"fontSize:\s*(\d+(?:\.\d+)?)(?![\d.])")
    pr = _re.compile(r"\d+(mm|pt)\b")
    GLYPHS = "◆●•★▸▾·✦"
    bad = []
    for fp in sorted(SRC.rglob("*")):
        if fp.suffix not in (".ts", ".tsx") or fp.name in DESIGN_EXEMPT | {"PdfDoc.tsx", "pdf.ts", "pdfCover.ts"}:
            continue
        for i, line in enumerate(fp.read_text(encoding="utf-8").split("\n"), 1):
            if pr.search(line) or any(g in line for g in GLYPHS):
                continue
            for m in pat.finditer(line):
                v = float(m.group(1))
                if v < 11:
                    bad.append(({"id": "ЗКН-Д006", "name": "кегль ниже пола 11px",
                                 "hint": "→ var(--text-caption2) (11px). Ниже 11px текст нечитаем (Apple HIG)"},
                                str(fp.relative_to(ROOT)), i, line.strip()[:80]))
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


# ═══════════════════════════════════════════════════════════════════════════
# ХРАПОВИК ДОЛГА (ЗКН-Д001) — ISKCON Design.
#
# Долг велик (~2000 магических значений), разовый рефакторинг опасен. Поэтому:
# база фиксируется, сборка падает при РОСТЕ. Уменьшать можно и нужно — база
# пересчитывается вниз (`python3 tools/laws-lint.py --update-baseline`).
# ═══════════════════════════════════════════════════════════════════════════

BASELINE = ROOT / "tools" / "laws-baseline.json"
# tokens.ts и globals.css ОПРЕДЕЛЯЮТ токены — им можно
DESIGN_EXEMPT = {"tokens.ts", "globals.css"}

DEBT = {
    "magic_font_size": {
        "law": "ЗКН-Д001",
        "name": "магический кегль вместо токена (fontSize: 13)",
        "pattern": re.compile(r"fontSize:\s*[0-9]"),
        "hint": "→ tk.text.* или var(--…); см. docs/STANDARD_design.md",
    },
    "hardcoded_hex": {
        "law": "ЗКН-Д001",
        "name": "голый hex вместо токена (#D2AA1B)",
        "pattern": re.compile(r"[\"'`]#[0-9a-fA-F]{3,8}[\"'`]"),
        "hint": "→ var(--color-gold) / var(--color-gold-deep); см. docs/STANDARD_design.md",
    },
}


def count_debt():
    counts = {k: 0 for k in DEBT}
    for fp in sorted(SRC.rglob("*")):
        if fp.suffix not in (".ts", ".tsx") or fp.name in DESIGN_EXEMPT:
            continue
        try:
            t = fp.read_text(encoding="utf-8")
        except Exception:
            continue
        for k, d in DEBT.items():
            counts[k] += len(d["pattern"].findall(t))
    return counts


def check_ratchet(update=False):
    now = count_debt()
    if update or not BASELINE.exists():
        BASELINE.write_text(json.dumps(now, indent=2) + "\n", encoding="utf-8")
        print("ХРАПОВИК: база записана → %s" % BASELINE.name)
        for k, v in now.items():
            print("  %-18s %d" % (k, v))
        return []
    base = json.loads(BASELINE.read_text(encoding="utf-8"))
    bad = []
    print("ХРАПОВИК ДОЛГА (ISKCON Design):")
    for k, d in DEBT.items():
        b, n = base.get(k, 0), now[k]
        if n > b:
            print("  ✗ %-18s %d  (база %d, ВЫРОС на %d)" % (k, n, b, n - b))
            bad.append(({"id": "%s · %s" % (d["law"], k), "name": d["name"],
                         "hint": d["hint"]},
                        "долг вырос: %d → %d" % (b, n), 0, ""))
        elif n < b:
            print("  ↓ %-18s %d  (база %d, СНИЖЕН на %d) — обнови базу" % (k, n, b, b - n))
        else:
            print("  = %-18s %d  (база держится)" % (k, n))
    return bad


def check_missing_imports():
    """ЗКН-Ф006: отсутствующий импорт (TS2304) собирается vite'ом и падает
    в браузере БЕЛОЙ СТРАНИЦЕЙ. esbuild не проверяет типы — нужен tsc."""
    import subprocess
    web = ROOT / "apps" / "web"
    tsc = ROOT / "node_modules" / ".bin" / "tsc"
    if not tsc.exists():
        return []
    try:
        out = subprocess.run([str(tsc), "--noEmit", "-p", "tsconfig.json"],
                             cwd=str(web), capture_output=True, text=True, timeout=180).stdout
    except Exception:
        return []
    bad = []
    for line in out.split("\n"):
        if "TS2304" in line or "TS2552" in line:      # Cannot find name
            bad.append(({"id": "ЗКН-Ф006", "name": "отсутствующий импорт (белая страница в проде)",
                         "hint": "→ добавить импорт. vite соберёт, но браузер упадёт ReferenceError"},
                        line.split("(")[0], 0, line.strip()[:90]))
    return bad


def main():
    if "--update-baseline" in sys.argv:
        check_ratchet(update=True)
        return 0
    bad = check_rules() + check_prose_law() + check_floor_law() + check_missing_imports() + check_ratchet()
    if not bad:
        print("\nЛИНТЕР ЗАКОНОВ: нарушений нет ✓")
        print("  правил: %d + проза (Т002) + пол 11px (Д006) + храповик (Д001)" % len(RULES))
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
