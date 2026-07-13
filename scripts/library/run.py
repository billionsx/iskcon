"""
ОРКЕСТРАТОР КОНВЕЙЕРА.

  python3 -m scripts.library.run audit          # ворота прав: что нам не принадлежит
  python3 -m scripts.library.run authors        # книга → личность автора (Б005)
  python3 -m scripts.library.run discover ggd   # найти источники
  python3 -m scripts.library.run book ggd       # полный цикл по книге
  python3 -m scripts.library.run gate           # У5-ворота
"""
from __future__ import annotations
import pathlib, sys

from . import rights, discover, parse, translate, load, gate
from .registry import WORKS, QUEUE, PUBLISHABLE, LICENSE_ONLY


def book(work_id: str) -> int:
    w = WORKS.get(work_id)
    if not w:
        sys.exit(f"{work_id} не в реестре (ПР001)")

    if work_id in LICENSE_ONLY and w.rights != "licensed":
        print(f"⛔ «{w.title_ru}» — только по лицензии BBT.")
        print(f"   {w.note}")
        print(f"   Конвейер не трогает эту книгу. Положи файл лицензии в")
        print(f"   docs/library/licenses/ и укажи его в registry.py → evidence.")
        return 2

    if w.rights not in PUBLISHABLE:
        print(f"⛔ «{w.title_ru}»: класс прав `{w.rights}` — публикация запрещена (ПР002)")
        return 2

    print(f"── {w.title_ru} ({w.iast}) ──")
    man = discover.discover(work_id)
    if not man["usable"]:
        print("   Ни одного источника с чистыми правами. Стоп.")
        return 1

    raw = pathlib.Path(f"build/library/raw/{work_id}.txt")
    if not raw.exists():
        print(f"   Нет {raw} — стадия fetch выполняется в CI (открытая сеть).")
        return 1

    parsed = parse.parse(work_id, raw, man["usable"][0]["corpus"])
    translated = translate.translate_file(parsed)
    load.load_verses(work_id, translated)
    return gate.report()


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "audit"
    if cmd == "audit":
        sys.exit(rights.audit())
    if cmd == "enforce":
        sys.exit(rights.enforce())
    if cmd == "authors":
        load.backfill_authors(); sys.exit(0)
    if cmd == "discover":
        for t in (sys.argv[2:] or QUEUE): discover.discover(t)
        sys.exit(0)
    if cmd == "book":
        sys.exit(book(sys.argv[2]))
    if cmd == "gate":
        sys.exit(gate.report())
    print(__doc__)
