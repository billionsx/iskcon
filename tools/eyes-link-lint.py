#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ГЕЙТ СВЯЗИ С ДЕПАРТАМЕНТОМ · ЗКН-Д030 (уровень принуждения У5).

С 27.07.2026 департамент стандартов Apple живёт в своём репозитории
billionsx/eyes. Механизм закона переехал туда вместе с ним — и в ЭТОМ
репозитории закон остался бы документом без гейта. Здесь тот гейт, который
охраняет то, что охранять осталось: САМУ СВЯЗЬ.

Что проверяется (без сети, детерминированно):
  1. `.github/workflows/eyes.yml` есть и зовёт reusable департамента;
  2. в вызове объявлены `project` и `globs`, и глобы НЕ пустые — то есть
     ревью правда смотрит на код, а не на воздух;
  3. `docs/EYES.md` есть и называет новый дом;
  4. каталога `bxad/` и воркфлоу `bxad-*.yml` здесь БОЛЬШЕ НЕТ — две копии
     департамента означали бы расщеплённое сознание: судит один, чинят
     другой;
  5. если есть `ping-eyes.yml` — он будит именно billionsx/eyes.

Запуск: python3 tools/eyes-link-lint.py
"""
import glob as globlib
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WF = ROOT / ".github" / "workflows"
DEPT = "billionsx/eyes"
REUSABLE = "billionsx/eyes/.github/workflows/eyes-review-reusable.yml"

errors = []
notes = []


def read(p: Path) -> str:
    return p.read_text(encoding="utf-8") if p.exists() else ""


# 1–2. вызов reusable департамента
client = WF / "eyes.yml"
if not client.exists():
    errors.append("нет .github/workflows/eyes.yml — проект отключён от департамента; "
                  "шаблон: billionsx/eyes → templates/eyes-client.yml")
else:
    t = read(client)
    if REUSABLE not in t:
        errors.append(f"{client.name} не зовёт reusable департамента ({REUSABLE})")
    m = re.search(r"^\s*project:\s*(\S+)", t, re.M)
    if not m:
        errors.append(f"{client.name}: не объявлен вход project — департамент не знает, "
                      "чей паспорт брать")
    else:
        notes.append(f"паспорт проекта: {m.group(1)}")
    g = re.search(r"^\s*globs:\s*\"?([^\"\n]+)\"?", t, re.M)
    if not g:
        errors.append(f"{client.name}: не объявлен вход globs — ревью смотреть некуда")
    else:
        pats = [x.strip() for x in g.group(1).split(",") if x.strip()]
        empty = [x for x in pats
                 if not globlib.glob(str(ROOT / x), recursive=True)]
        if empty:
            errors.append(f"{client.name}: глобы не находят ни одного файла — "
                          f"связь пустая: {', '.join(empty)}")
        else:
            hit = sum(len(globlib.glob(str(ROOT / x), recursive=True)) for x in pats)
            notes.append(f"глобов {len(pats)}, под ревью файлов {hit}")

# 3. дорожный указатель
eyes_doc = ROOT / "docs" / "EYES.md"
if not eyes_doc.exists():
    errors.append("нет docs/EYES.md — переезд департамента не описан, следующий "
                  "читатель пойдёт искать bxad/")
elif DEPT not in read(eyes_doc):
    errors.append(f"docs/EYES.md не называет {DEPT}")

# 4. расщеплённое сознание
if (ROOT / "bxad").exists():
    errors.append("каталог bxad/ снова здесь — две копии департамента; "
                  "источник истины один: " + DEPT)
stale = sorted(p.name for p in WF.glob("bxad-*.yml")) if WF.exists() else []
if stale:
    errors.append("воркфлоу прежнего дома здесь: " + ", ".join(stale))

# 5. пинг монитора
# ── надзор на каждый коммит (второй вход: проект пишет прямо в main) ──
watch = WF / "eyes-watch.yml"
if not watch.exists():
    errors.append("нет .github/workflows/eyes-watch.yml — надзор приходит только "
                  "на pull request, а этот проект пишет прямо в main: департамент "
                  "молчал бы не от чистоты, а от отсутствия повода")
else:
    w = read(watch)
    if "billionsx/eyes" not in w:
        errors.append("eyes-watch.yml не берёт департамент из billionsx/eyes")
    if "registry/state/ae-baseline.json" not in w:
        errors.append("eyes-watch.yml не читает храповик долга у департамента — "
                      "надзор без базы не отличит рост долга от его погашения")
    if "raw.githubusercontent.com/billionsx/eyes" not in w:
        errors.append("храповик берётся не из репозитория департамента — "
                      "две базы разойдутся, и настоящую будет не найти")

# ── копий департамента здесь не заводится ──
for stray, why in (("__eyes", "разреженный клон инструмента попал в репозиторий"),
                   ("registry/state/ae-baseline.json", "копия храповика долга"),
                   ("adapters", "копия паспортов департамента")):
    if (ROOT / stray).exists():
        errors.append(f"{stray}: {why} — у департамента и клиента одна копия, "
                      "и она живёт в billionsx/eyes")

ping = WF / "ping-eyes.yml"
if ping.exists():
    t = read(ping)
    if DEPT not in t:
        errors.append(f"{ping.name} не будит {DEPT}")
    else:
        notes.append("пинг монитора после деплоя подключён")
else:
    notes.append("пинга нет — монитор департамента ходит по расписанию")

print("ГЕЙТ СВЯЗИ С ДЕПАРТАМЕНТОМ (ЗКН-Д030)")
for n in notes:
    print("  ·", n)
if errors:
    print()
    for e in errors:
        print("  ✗", e)
    print(f"\nсвязь порвана: {len(errors)}")
    sys.exit(1)
print("\nсвязь цела.")
sys.exit(0)
