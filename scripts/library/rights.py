"""
ВОРОТА №1 — ПРАВА.  (законы ПР001, ПР002, ПР006)

Ни один стих не входит в библиотеку и не показывается человеку, пока по его
изданию не зафиксирован класс прав. Это прямое требование docs/LEGAL.md §2.3.

Модуль делает две вещи:

  audit()   — сверяет ЖИВУЮ БД с реестром. Ничего не удаляет (Р002!),
              только считает и докладывает. Это отчёт о правовом долге.

  enforce() — проставляет editions.license по реестру, чтобы фронт мог
              рендерить только PUBLISHABLE. Тоже без удалений.

Запуск:
    python3 -m scripts.library.rights audit
    python3 -m scripts.library.rights enforce
"""
from __future__ import annotations
import sys

from . import d1
from .registry import WORKS, PUBLISHABLE, PENDING, FORBIDDEN, LICENSED, OWN, PD


def _rows():
    return d1.query("""
        SELECT w.id AS work_id,
               e.id AS edition_id,
               e.lang, e.title, e.translator, e.source,
               COALESCE(e.license,'') AS license,
               (SELECT COUNT(*) FROM verses v WHERE v.work_id = w.id) AS n
        FROM works w
        LEFT JOIN editions e ON e.work_id = w.id
    """)


def audit() -> int:
    rows = _rows()
    total = sum(r["n"] for r in rows if r["lang"] == "ru" or r["edition_id"] is None)

    debt, clean, unknown = [], [], []
    bbt_verses = 0

    for r in rows:
        wid = r["work_id"]
        w = WORKS.get(wid)
        n = r["n"] or 0
        lic = r["license"]

        if w is None:
            unknown.append((wid, n))
            continue

        if r["edition_id"] is None:          # заготовка без издания
            continue

        # Санскритский оригинал — всегда чист.
        if r["lang"] == "sa" and lic == PD:
            clean.append((wid, r["lang"], n))
            continue

        if (r["source"] or "").strip() == "vedabase.io":
            bbt_verses += n

        if lic in PUBLISHABLE and w.rights in PUBLISHABLE:
            clean.append((wid, r["lang"], n))
        else:
            debt.append((wid, w.title_ru, r["lang"], r["source"] or "—",
                         lic or "ПУСТО", w.rights, n))

    print("═" * 78)
    print("ВОРОТА №1 — ПРАВА.  Аудит живой библиотеки")
    print("═" * 78)
    print(f"Стихов в БД всего:            {total:>7}")
    print(f"С подтверждёнными правами:    {sum(c[2] for c in clean):>7}")
    print(f"ПРАВОВОЙ ДОЛГ (нельзя пуб.):  {sum(d[6] for d in debt):>7}")
    print(f"  из них снято с vedabase.io: {bbt_verses:>7}   ← текст BBT")
    print()

    if debt:
        print("ДОЛГ ПО ПРОИЗВЕДЕНИЯМ")
        print("-" * 78)
        print(f"{'work':<22}{'яз':<4}{'источник':<16}{'license':<12}{'стихов':>8}")
        print("-" * 78)
        for wid, title, lang, src, lic, cls, n in sorted(debt, key=lambda x: -x[6]):
            print(f"{wid:<22}{lang or '—':<4}{src[:15]:<16}{lic[:11]:<12}{n:>8}")
        print("-" * 78)
        print()
        print("ЧТО ЭТО ЗНАЧИТ:")
        print("  vedabase.io — официальный сайт Bhaktivedanta Book Trust.")
        print("  Переводы Шрилы Прабхупады охраняются BBT.")
        print("  Для публикации нужен ФАЙЛ ЛИЦЕНЗИИ в docs/library/licenses/,")
        print("  и ссылка на него в реестре (Work.evidence).")
        print("  Без него закон Б002 запрещает показывать эти стихи пользователю.")
        print()
        print("  ВЫХОД (LEGAL.md §2.3): собственный перевод с открытого оригинала.")
        print("  Для книг с PD-оригиналом конвейер делает это сам.")
        print("  Для «Кришна», «Учение Господа Чайтаньи», «Прабхупада-лиламрита»")
        print("  оригинала в PD НЕТ — только лицензия BBT.")

    if unknown:
        print()
        print(f"НЕ В РЕЕСТРЕ ({len(unknown)}): {', '.join(u[0] for u in unknown)}")
        print("  → внести в scripts/library/registry.py (закон Б001)")

    print("═" * 78)
    return 1 if debt else 0


def enforce() -> int:
    """Проставляет license по реестру. Никаких удалений (Р002)."""
    changed = 0
    for r in _rows():
        if not r["edition_id"]:
            continue
        w = WORKS.get(r["work_id"])
        if not w:
            continue
        want = PD if r["lang"] == "sa" else w.rights
        if (r["license"] or "") != want:
            d1.update_one("editions", {"license": want}, "id", r["edition_id"])
            print(f"  {r['work_id']:<22} {r['lang']:<3} "
                  f"{r['license'] or 'ПУСТО':<14} → {want}")
            changed += 1
    print(f"\nОбновлено изданий: {changed}. Ни одна строка не удалена (Р002).")
    return 0


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "audit"
    sys.exit(audit() if cmd == "audit" else enforce())
