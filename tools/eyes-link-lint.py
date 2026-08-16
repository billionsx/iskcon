#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ГЕЙТ СВЯЗИ С ДЕПАРТАМЕНТОМ · ЗКН-Д030 (уровень принуждения У5).

С 27.07.2026 департамент стандартов Apple живёт в своём репозитории
billionsx/eyes. Механизм закона переехал туда вместе с ним — и в ЭТОМ
репозитории закон остался бы документом без гейта. Здесь тот гейт, который
охраняет то, что охранять осталось: САМУ СВЯЗЬ.

⚠️ РЕДАКЦИЯ 16.08.2026 — ГЕЙТ ТРЕБОВАЛ МЁРТВЫЙ АДРЕС.

10.08 департамент снял у себя все контуры, включая три reusable. Здесь тем
же днём снесли три клиентских файла. Но этот гейт продолжал требовать
`eyes.yml` с вызовом `eyes-review-reusable.yml` — файла, которого больше
нет ни у кого. Требовать вызов мёртвого адреса значит держать `laws-lint`
красным вечно и при этом не охранять НИЧЕГО: восстановленный `eyes.yml`
падал бы на старте (startup_failure), и надзор молчал бы так, будто код
чист. Так и вышло: main стоял красным шесть суток.

Закон: гейт охраняет МЕХАНИЗМ, а не адрес. Контур ревью на pull request
снят вместе со своим reusable честно — этот проект пишет прямо в main
(один PR на тысячу деплоев), и ревью PR тут ничего не охраняло. Единственный
живой надзор — `eyes-watch.yml`, он самодостаточен: сам клонирует
департамент разреженно и сам зовёт `bin/eyes.py`. Его гейт и стережёт.

Что проверяется (без сети, детерминированно):
  1. `.github/workflows/eyes-watch.yml` есть, берёт департамент из
     billionsx/eyes разреженным клоном и читает храповик долга у него же;
  2. надзор идёт по ДВУМ паспортам — приложение и оболочка плеера: пока
     паспорт один, рост долга оболочки тонет в общем числе;
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


# 1–2. надзор над main — единственный живой контур департамента
watch = WF / "eyes-watch.yml"
if not watch.exists():
    errors.append("нет .github/workflows/eyes-watch.yml — надзора над main нет вовсе; "
                  "этот проект пишет прямо в ветку, повода ждать неоткуда, и "
                  "молчание департамента будет читаться как чистота")
else:
    w = read(watch)
    if DEPT not in w:
        errors.append("eyes-watch.yml не берёт департамент из " + DEPT)
    # Слово «sparse» встречается и в `git sparse-checkout set`, поэтому одной
    # подстроки мало: клон обязан быть И разреженным, И без блобов — иначе
    # департамент фактически переезжает сюда целиком.
    for token, why in (("--sparse", "клон не разреженный"),
                       ("--filter=blob:none", "клон тянет блобы"),
                       ("sparse-checkout set", "область клона не сужена")):
        if token not in w:
            errors.append(f"eyes-watch.yml: {why} ({token} нет) — копия "
                          "департамента переезжает в этот репозиторий")
    if "registry/state/ae-baseline.json" not in w:
        errors.append("eyes-watch.yml не читает храповик долга у департамента — "
                      "надзор без базы не отличит рост долга от его погашения")
    if "raw.githubusercontent.com/billionsx/eyes" not in w:
        errors.append("храповик берётся не из репозитория департамента — "
                      "две базы разойдутся, и настоящую будет не найти")

    # ── ДВА ПАСПОРТА (16.08.2026) ────────────────────────────────────────
    # Оболочка плеера судится каноном iOS 26.5 и обязана иметь СВОЁ число.
    # При одном паспорте её 131 находка тонула в 643 находках приложения:
    # долг оболочки мог расти, а вердикт оставался зелёным.
    for passport in ("iskcon", "iskcon-play"):
        if f"--adapter {passport} " not in w:
            errors.append(f"eyes-watch.yml не судит по паспорту {passport} — "
                          "рост долга по нему был бы невидим")
        else:
            notes.append(f"паспорт под надзором: {passport}")
    if w.count("--ratchet") < 2:
        errors.append("храповик приложен не к каждому паспорту — паспорт без "
                      "базы считает находки, но не краснеет на росте")

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

# 5. слепое пятно надзора и пинг монитора
if watch.exists():
    # ── СЛЕПОЕ ПЯТНО НАДЗОРА (05.08.2026) ────────────────────────────────
    # База долга живёт у департамента. Значит он может расширить зрение или
    # ужать базу У СЕБЯ — и клиент оказывается в долгу, не тронув ни строки.
    # Пуш-триггер сужен на `apps/web` (правильно: департамент смотрит только
    # туда) — но тогда правка на чужой стороне не будит надзор ВООБЩЕ, пока
    # не тронут фронтенд. Ровно так грейд ушёл B → D и здесь этого не узнали.
    # Правило: сузил пуш — обязан поставить расписание. Иначе молчание надзора
    # снова будет читаться как чистота.
    narrowed = re.search(r"paths:\s*\[", w) is not None
    scheduled = re.search(r"^\s*schedule:", w, re.M) is not None
    if narrowed and not scheduled:
        errors.append("eyes-watch.yml сужен фильтром paths и БЕЗ расписания — "
                      "изменение зрения департамента на его стороне не разбудит "
                      "надзор, пока не тронут apps/web (ЗКН-Д030)")
    if scheduled:
        notes.append("надзор ходит и по расписанию — правка на стороне "
                     "департамента доезжает без коммита в apps/web")
    # Шапка не вправе обещать больше, чем делает триггер (ЗКН-Ц012).
    head = w[:w.find("on:")] if "on:" in w else w
    if narrowed and re.search(r"НА КАЖДЫЙ КОММИТ\s*\.", head):
        errors.append("шапка eyes-watch.yml обещает надзор НА КАЖДЫЙ КОММИТ, "
                      "а триггер сужен фильтром paths — документ описывает "
                      "намерение вместо механизма (ЗКН-Ц012)")

if not (ROOT / "tools" / "eyes-newfindings.py").exists():
    errors.append("нет tools/eyes-newfindings.py — надзор назовёт долг числом, "
                  "но не покажет пальцем на новую строку")

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
