#!/usr/bin/env python3
"""
АУДИТ КОНСТИТУЦИИ — свод против реальности (ЗКН-Ц005, шаг «проверить»).

Отвечает на один вопрос: сколько законов РЕАЛЬНО принуждается, а сколько
просто записано красивыми словами.

Свод объявляет уровень принуждения (У0…У5) и статус (🔴🟡🟢). Это ДЕКЛАРАЦИЯ.
Аудитор проверяет ФАКТ: есть ли у закона механизм в коде.

  У5 = правило в laws-lint.py ИЛИ гейт в CI
  У4 = рантайм-санитайзер (cleanCardText / renderProse)
  У3 = данные в D1 приведены (проверяется отдельным SQL-аудитом)
  У2 = общий модуль (ui/nav4, ui/tokens, routes.ts, cardText…)
  У1 = только документ
  У0 = только память

Запуск: python3 tools/laws-audit.py
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LAWS = ROOT / "docs" / "LAWS.md"
LINT = ROOT / "tools" / "laws-lint.py"
SRC = ROOT / "apps" / "web" / "src"
CI = ROOT / ".github" / "workflows"

DOMAIN_NAME = {
    "Сд": "Сиддханта", "БТ": "Достоверность", "Пр": "Продукт", "И": "Имена",
    "Т": "Текст карточек", "С": "Терминология", "К": "Карточки", "Д": "Дизайн",
    "Н": "Навигация", "Б": "Книги", "Р": "Реестр", "П": "ПКЛ",
    "Пл": "Пайплайны", "Ф": "Инфраструктура", "Ц": "Скрипты/CI", "Пф": "Печать/ссылки",
}


def parse_laws():
    """Из свода: id, домен, объявленный уровень, объявленный статус."""
    rows = []
    for line in LAWS.read_text(encoding="utf-8").split("\n"):
        m = re.match(r"\|\s*(ЗКН-([А-ЯЁа-яё]{1,3})\d{3}[a-z]?)\s*\|(.+)", line)
        if not m:
            continue
        lid, dom, rest = m.group(1), m.group(2), m.group(3)
        cells = [c.strip() for c in rest.split("|")]
        text = cells[0] if cells else ""
        level = cells[1] if len(cells) > 1 else ""
        status = cells[3] if len(cells) > 3 else ""
        lvl = re.search(r"У(\d)", level)
        rows.append({
            "id": lid, "dom": dom, "text": text,
            "declared": int(lvl.group(1)) if lvl else 0,
            "status": "🟢" if "🟢" in status else ("🟡" if "🟡" in status else ("🔴" if "🔴" in status else "?")),
        })
    return rows


def actual_level(lid: str) -> tuple[int, str]:
    """Фактический уровень: ищем механизм в коде."""
    lint = LINT.read_text(encoding="utf-8") if LINT.exists() else ""
    ci_all = "\n".join(f.read_text(encoding="utf-8") for f in CI.glob("*.yml")) if CI.exists() else ""

    # У5 — правило линтера, аудит данных или гейт CI
    if lid in lint:
        return 5, "правило в laws-lint.py"
    # ЗКН-Ц004 механизирован ЗДЕСЬ ЖЕ: аудитор падает на пропавшем гейте.
    if lid == "ЗКН-Ц004":
        return 5, "гейт в laws-audit.py"

    # Гейты, живущие в отдельных инструментах.
    if lid in ("ЗКН-Н025", "ЗКН-Н026") and (ROOT / "tools" / "url-audit.py").exists():
        return 5, "гейт адресов (url-audit.py)"

    for gate, how in (("data-audit.py", "SQL-гейт данных"), ("cards-audit.py", "гейт карточек"),
                      ("infra-audit.py", "гейт инфраструктуры"),
                      ("product-audit.py", "гейт продукта/книг"),
                      ("pkl-audit.py", "гейт ПКЛ/реестра"),
                      ("nav-audit.py", "гейт навигации")):
        g = ROOT / "tools" / gate
        if g.exists() and lid in g.read_text(encoding="utf-8"):
            return 5, how
    if lid in ci_all:
        return 5, "гейт в CI"

    # У4 — рантайм-санитайзер
    for f in ("cardText.ts", "EntityPage.tsx"):
        p = SRC / f
        if p.exists() and lid in p.read_text(encoding="utf-8"):
            return 4, f"санитайзер ({f})"

    # У2 — общий модуль ссылается на закон
    for f in ("ui/nav4.tsx", "ui/tokens.ts", "ui/primitives.tsx", "routes.ts",
              "ui/CoverFallback.tsx", "nav.ts", "ui/globals.css"):
        p = SRC / f
        if p.exists() and lid in p.read_text(encoding="utf-8"):
            return 2, f"общий модуль ({f})"

    # У2/У3 — закон упомянут где-то в коде (комментарий у реализации)
    for p in SRC.rglob("*"):
        if p.suffix not in (".ts", ".tsx", ".css"):
            continue
        try:
            if lid in p.read_text(encoding="utf-8"):
                return 2, f"реализован ({p.name})"
        except Exception:
            pass

    # инструменты / воркер
    for p in list((ROOT / "tools").rglob("*.py")) + [ROOT / "apps" / "web" / "worker.ts"]:
        try:
            if p.exists() and lid in p.read_text(encoding="utf-8"):
                return 3, f"инструмент ({p.name})"
        except Exception:
            pass

    return 1, "только документ"


def main():
    laws = parse_laws()
    if not laws:
        sys.exit("не удалось разобрать LAWS.md")

    by_dom: dict[str, list] = {}
    gap = []
    for law in laws:
        act, how = actual_level(law["id"])
        law["actual"], law["how"] = act, how
        by_dom.setdefault(law["dom"], []).append(law)
        if act < law["declared"]:
            gap.append(law)

    print("═" * 74)
    print("АУДИТ КОНСТИТУЦИИ · %d законов · 16 доменов" % len(laws))
    print("═" * 74)
    print()
    print("%-6s %-16s %5s %s" % ("домен", "название", "зак.", "механизировано (У4/У5)"))
    print("─" * 74)
    tot_mech = 0
    for dom in sorted(by_dom, key=lambda d: -len(by_dom[d])):
        rows = by_dom[dom]
        mech = sum(1 for r in rows if r["actual"] >= 4)
        tot_mech += mech
        bar = "█" * mech + "·" * (len(rows) - mech)
        print("%-6s %-16s %5d  %-14s %d/%d" % (dom, DOMAIN_NAME.get(dom, "?"), len(rows), bar, mech, len(rows)))
    print("─" * 74)
    print("%-29s %5d  %20d/%d  (%.0f%%)" % ("ИТОГО", len(laws), tot_mech, len(laws), 100 * tot_mech / len(laws)))
    print()

    # ЗКН-Ц004: УДАЛЕНИЕ ГЕЙТА НЕ ПРОХОДИТ МОЛЧА.
    #
    # Вырезая один блок из data-audit.py, я срезал вместе с ним ТРИ соседних
    # (Б004/Б005/Б006) — гейт каталога книг молча исчез, а свод продолжал
    # объявлять их У5. Обнаружилось случайно, при следующем аудите.
    #
    # Теперь это ошибка: закон объявлен У5, а механизма нет → аудит ПАДАЕТ.
    lost = [l for l in laws if l["declared"] >= 5 and l["actual"] < 4]
    if lost:
        print("═" * 74)
        print("✗ ГЕЙТ ПРОПАЛ: закон объявлен У5, а механизма НЕТ (%d)" % len(lost))
        print("═" * 74)
        for law in lost:
            print("  %-11s объявлен У%d, фактически У%d — %s"
                  % (law["id"], law["declared"], law["actual"], law["how"]))
            print("             %s" % law["text"][:78])
        print()
        print("Либо вернуть гейт, либо понизить уровень в docs/LAWS.md.")
        return 1

    if gap:
        print("═" * 74)
        print("РАЗРЫВ: свод обещает больше, чем есть в коде (%d)" % len(gap))
        print("═" * 74)
        for law in sorted(gap, key=lambda x: (x["declared"] - x["actual"]), reverse=True)[:20]:
            print("  %-11s объявлен У%d, фактически У%d — %s"
                  % (law["id"], law["declared"], law["actual"], law["how"]))
            print("             %s" % law["text"][:78])
    else:
        print("Разрыва нет: каждый закон механизирован не ниже объявленного уровня.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
