#!/usr/bin/env python3
"""
ГЕЙТ ТИПОВ — ЗКН-Р014 · ЗКН-Ф016.

ПОЧЕМУ ЭТОТ ГЕЙТ СУЩЕСТВУЕТ.

`vite build` (esbuild) типы НЕ ПРОВЕРЯЕТ. Он честно соберёт бандл, в котором
вырезан целый компонент или перепутан тип пропса, — и отдаст RC=0. «Зелёная
сборка» ничего не гарантирует. Это уже стоило нам белого экрана Рецептов
(ЗКН-Ф016: `CATEGORIES.map((c) => ({ id: c, label: c }))`, React error #31),
и `tsc` тогда ругался — а ошибку сочли «старой и неважной».

13.07.2026 это повторилось с другой стороны. Сводя четыре копии `plural` в
примитивы, я вырезал их регуляркой `function X\\(...\\)\\s*\\{.*?\\n\\}\\n` с DOTALL.
В `VowScreen` функция была ОДНОСТРОЧНОЙ — закрывающей `}` в начале строки у неё
нет, и `.*?` пробежал дальше, до конца СЛЕДУЮЩЕЙ функции. Молча исчезли
`roundsWord`, `japaCommitment` и целый компонент `Ring`. `vite build` — RC=0.
Поймал только `tsc`.

ПОЧЕМУ ПРОСТО «ЗАПУСТИТЬ tsc» НЕ РАБОТАЕТ.

В проекте живут ~15 давних ошибок типов. Голый `tsc` падает ВСЕГДА — а гейт,
который падает всегда, не гейт: его перестают читать. Поэтому здесь ХРАПОВИК:
фон зафиксирован поимённо, и падение наступает ровно на НОВОЙ ошибке.

Долг может только СОКРАЩАТЬСЯ: починил старую ошибку — `--update-baseline`
запечатывает улучшение, и вернуть её назад уже нельзя.

Запуск:  python3 tools/tsc-gate.py
Фиксация улучшений:  python3 tools/tsc-gate.py --update-baseline
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASELINE = ROOT / "tools" / "tsc-baseline.json"
TSC = ROOT / "node_modules" / ".bin" / "tsc"
PROJECT = ROOT / "apps" / "web" / "tsconfig.json"


def collect() -> list[str]:
    """Ошибки tsc без номеров строк: правка выше по файлу не должна их «менять»."""
    if not TSC.exists():
        print("tsc не найден — сначала `npm ci`", file=sys.stderr)
        sys.exit(2)
    out = subprocess.run(
        [str(TSC), "-p", str(PROJECT), "--noEmit"],
        capture_output=True, text=True, cwd=ROOT,
    ).stdout
    errs = [l for l in out.split("\n") if "error TS" in l]
    # (строка,колонка) выкидываем: это НЕ признак ошибки, а признак места.
    return sorted(re.sub(r"\(\d+,\d+\)", "", e).strip() for e in errs)


def main() -> int:
    now = collect()

    if "--update-baseline" in sys.argv:
        first = not BASELINE.exists()
        old = [] if first else json.loads(BASELINE.read_text(encoding="utf-8"))
        # ПЕРВИЧНАЯ ФИКСАЦИЯ: долг, который уже есть, записывается поимённо — иначе
        # гейт нельзя завести вообще (курица и яйцо). Дальше — только храповик.
        grew = [] if first else sorted(set(now) - set(old))
        if grew:
            print("ХРАПОВИК: фон не растёт. Сначала почини НОВЫЕ ошибки (%d):" % len(grew))
            for e in grew:
                print("  +", e)
            return 1
        BASELINE.write_text(json.dumps(now, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(("Фон зафиксирован впервые: %d давних ошибок ✓" % len(now)) if first
              else ("Фон обновлён: %d → %d ошибок ✓" % (len(old), len(now))))
        return 0

    base = json.loads(BASELINE.read_text(encoding="utf-8")) if BASELINE.exists() else []
    new = sorted(set(now) - set(base))
    fixed = sorted(set(base) - set(now))

    print("ГЕЙТ ТИПОВ · ЗКН-Р014")
    print("─" * 70)
    print("  фон: %d · сейчас: %d · новых: %d · починено: %d" % (len(base), len(now), len(new), len(fixed)))

    if new:
        print("\nНОВЫЕ ОШИБКИ ТИПОВ (%d) — сборка их НЕ ловит, но браузер ловит:\n" % len(new))
        for e in new:
            print("  ✗", e)
        print("\nЗКН-Ф016: ошибка типа = КРАШ В БРАУЗЕРЕ, а не «замечание линтера».")
        return 1

    if fixed:
        print("\nПочинено %d — запечатать: python3 tools/tsc-gate.py --update-baseline" % len(fixed))
        for e in fixed:
            print("  ✓", e)

    print("\nНовых ошибок типов нет ✓")
    return 0


if __name__ == "__main__":
    sys.exit(main())
