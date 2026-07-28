#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ГЕЙТ ГЕОГРАФИИ · ЗКН-Р010b (уровень принуждения У5).

Локатор Ятры читает страны из D1 — там канон стережёт `data-audit.py`.
Но география приходит и статикой: фиды календаря и каталоги мест. Именно там
жило удвоение — «RU» (2094 файла) и «Russia» (126) как ДВЕ страны, а вместе с
ними города и острова в поле страны.

Этот гейт проверяет: КАЖДОЕ значение страны в статике уже каноническое, то есть
`countries.canon(v) == v`. Канон один — `tools/countries.py`; второе определение
было бы расхождением по построению (ЗКН-Э005 инструмента, здесь — Р010b).

Проверяются:
  apps/web/public/data/gcal/*.json · gcal-past/*.json  — `location.country`
  apps/web/public/data/iskcon-places.json               — `places[].country`
  apps/web/public/data/vaisnava-locations.json          — `countries[].country`

Запуск: python3 tools/geo-lint.py
"""
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import countries  # noqa: E402

DATA = ROOT / "apps" / "web" / "public" / "data"


def values_of(obj, out):
    """Все значения ключа `country` на любой глубине."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == "country" and isinstance(v, str) and v.strip():
                out.append(v)
            else:
                values_of(v, out)
    elif isinstance(obj, list):
        for x in obj:
            values_of(x, out)
    return out


def scan():
    bad, seen, files = Counter(), 0, 0
    targets = []
    for d in ("gcal", "gcal-past"):
        targets += sorted((DATA / d).glob("*.json")) if (DATA / d).exists() else []
    for n in ("iskcon-places.json", "vaisnava-locations.json"):
        if (DATA / n).exists():
            targets.append(DATA / n)
    for f in targets:
        try:
            j = json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            continue
        files += 1
        for v in values_of(j, []):
            seen += 1
            k = countries.canon(v)
            if k != v:
                bad[f"{v} → {k}"] += 1
    return files, seen, bad


def main() -> int:
    files, seen, bad = scan()
    print("ГЕЙТ ГЕОГРАФИИ (ЗКН-Р010b)")
    print(f"  файлов просмотрено: {files} · значений страны: {seen} · "
          f"канон: {len(countries.ALIASES)} псевдонимов")
    if not bad:
        print("\nвся статика на каноне ✓")
        return 0
    print()
    for k, v in bad.most_common():
        print(f"  ✗ {v:5}  {k}")
    print(f"\nнеканонических значений: {sum(bad.values())} "
          f"({len(bad)} видов). Канон — tools/countries.py; конвейеры зовут "
          f"countries.canon() на записи, слаги при этом не переезжают (ЗКН-Н025).")
    return 1


if __name__ == "__main__":
    sys.exit(main())
