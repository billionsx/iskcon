#!/usr/bin/env python3
"""
ЗКН-Д026 · ГЕЙТ ЭТАЛОНА iOS 26.5.

Закон говорит: любой новый элемент интерфейса сверяется с папкой
`docs/design/ios26/refs/` и с документом `STANDARD_ios26_css.md`.

«Сверяться» — не проверить машиной. Проверить машиной можно другое, и оно
важнее: **чтобы было с чем сверяться**. Эталон умирает тихо — файл переименован,
строка реестра осталась, адрес замера ведёт в пустоту, и через месяц число
в коде уже ничьё. Ровно так умер бы гейт по ЗКН-Ц011, если бы за ним не следили.

ПРАВИЛО 1 — эталон ДОСТИЖИМ. Мастер-кадры каждого продукта либо лежат в
             `refs/`, либо вынесены на два зеркала и записаны в
             `docs/assets/manifest.jsonl` (ЗКН-Ф025: тяжёлый бинарь не живёт
             в git). Инвариант — «до кадра можно дойти», а не «кадр лежит тут»:
             первая формулировка стоила бы нарушения Ф025, вторая — ничего.

ПРАВИЛО 1-бис — папка не пуста для человека. У каждого продукта есть
             контактный лист `<продукт>.contact.jpg`: открыл папку — видишь
             все кадры сразу, без скачивания мастера. Лист лёгкий (<512 КБ),
             мерить по нему нельзя — он для навигации.

ПРАВИЛО 2 — биекция «файл ↔ реестр». Каждый PDF в `refs/` назван в `INDEX.md`,
             и каждый названный в реестре файл лежит в `refs/`. Файл без строки
             = материал, о котором никто не знает. Строка без файла = ссылка
             в пустоту.

ПРАВИЛО 3 — стандарт цел. `STANDARD_ios26_css.md` на месте и содержит все
             обязательные разделы. Вырезанный раздел = молча снятое правило.

ПРАВИЛО 4 — адрес замера ведёт к кадру. Имя файла, упомянутое в стандарте,
             обязано существовать в `refs/`. Мёртвый адрес хуже отсутствующего:
             он выглядит как доказательство.

ПРАВИЛО 5 — храповик замеров. Число помеченных 📐 значений может только расти.
             Замер удаляют не «по чистке», а поправкой с объяснением — тогда
             база двигается руками (`tools/ios26-baseline.json`).

Запуск: python3 tools/ios26-lint.py
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DESIGN = ROOT / "docs" / "design" / "ios26"
REFS = DESIGN / "refs"
INDEX = DESIGN / "INDEX.md"
STANDARD = DESIGN / "STANDARD_ios26_css.md"
BASELINE = ROOT / "tools" / "ios26-baseline.json"
MANIFEST = ROOT / "docs" / "assets" / "manifest.jsonl"
REF_CLASS = "ios26-refs"   # семейство: ios26-refs, ios26-refs-2, … (offload идемпотентен по классу)

MIN_REFS = 6

# Разделы, без которых стандарт перестаёт быть стандартом.
REQUIRED_SECTIONS = [
    "Система координат",
    "Цвет",
    "Типографика",
    "Геометрия",
    "Компоненты",
    "Материал",
    "Движение",
    "Иконки",
    "Запрещено",
    "Токены",
]

MEASURE_MARK = "\U0001F4D0"  # 📐 — знак замера


def mirrored_masters() -> set[str]:
    """Мастера, вынесенные на зеркала (ЗКН-Ф025). Истина — манифест + files.tsv."""
    out: set[str] = set()
    if not MANIFEST.exists():
        return out
    for line in MANIFEST.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            rec = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not str(rec.get("class", "")).startswith(REF_CLASS):
            continue
        # Оба зеркала обязаны быть в записи: одно зеркало — это не страховка (Пл023).
        if not (rec.get("ia_url") and rec.get("gh_url")):
            continue
        idx = ROOT / str(rec.get("files_index", ""))
        if idx.exists():
            for row in idx.read_text(encoding="utf-8").splitlines():
                for cell in row.split("\t"):
                    cell = cell.strip()
                    if cell.endswith(".pdf"):
                        out.add(Path(cell).name)
    return out


def load_baseline() -> dict:
    if BASELINE.exists():
        return json.loads(BASELINE.read_text(encoding="utf-8"))
    return {}


def main() -> int:
    bad: list[str] = []

    # ── ПРАВИЛО 1 — эталон ДОСТИЖИМ ──────────────────────────────────────
    if not REFS.is_dir():
        print("ГЕЙТ ЭТАЛОНА iOS 26.5 — НАРУШЕНИЕ:\n")
        print("  \u2717 docs/design/ios26/refs/ — ЗКН-Д026: папка эталона исчезла. "
              "Сверяться не с чем, закон не принуждается ничем")
        return 1

    local = {p.name for p in REFS.glob("*.pdf")}
    mirrored = mirrored_masters()
    pdfs = sorted(local | mirrored)

    if len(pdfs) < MIN_REFS:
        bad.append(f"docs/design/ios26/ — ЗКН-Д026: мастер-кадров {len(pdfs)} "
                   f"при базе {MIN_REFS}. Референс не удаляют — его выносят на "
                   f"зеркала (Ф025) и записывают в docs/assets/manifest.jsonl")

    for name in pdfs:
        if name not in local and name not in mirrored:
            bad.append(f"{name} — ЗКН-Д026: мастер недостижим ни локально, ни по зеркалу")

    # ── ПРАВИЛО 1-бис — контактный лист у каждого продукта ───────────────
    for name in pdfs:
        sheet = REFS / (name[:-4] + ".contact.jpg")
        if not sheet.exists():
            bad.append(f"docs/design/ios26/refs/{sheet.name} — ЗКН-Д026: у продукта "
                       f"«{name[:-4]}» пропал контактный лист; папка перестала "
                       f"открываться глазами")
        elif sheet.stat().st_size > 512 * 1024:
            bad.append(f"docs/design/ios26/refs/{sheet.name} — ЗКН-Ф025: контактный "
                       f"лист {sheet.stat().st_size // 1024} КБ > 512 КБ; лист нужен "
                       f"лёгким, мастер живёт на зеркалах")

    # ── ПРАВИЛО 2 — биекция «файл ↔ реестр» ──────────────────────────────
    if not INDEX.exists():
        bad.append("docs/design/ios26/INDEX.md — ЗКН-Д026: реестр референсов исчез; "
                   "папка без реестра — свалка, адрес замера в ней не живёт")
        index_txt = ""
    else:
        index_txt = INDEX.read_text(encoding="utf-8")

    for name in pdfs:
        if name not in index_txt:
            bad.append(f"docs/design/ios26/refs/{name} — ЗКН-Д026: файл лежит, но "
                       f"в INDEX.md о нём ни строки; материал, о котором никто не знает")

    for named in sorted(set(re.findall(r"apple_[a-z0-9_]+\.pdf", index_txt))):
        if named not in pdfs:
            bad.append(f"docs/design/ios26/INDEX.md — ЗКН-Д026: реестр называет "
                       f"«{named}», а файла в refs/ нет; ссылка в пустоту")

    # ── ПРАВИЛО 3 — стандарт цел ─────────────────────────────────────────
    if not STANDARD.exists():
        bad.append("docs/design/ios26/STANDARD_ios26_css.md — ЗКН-Д026: документ-закон "
                   "исчез; остались кадры без выводов")
        std = ""
    else:
        std = STANDARD.read_text(encoding="utf-8")
        heads = "\n".join(l for l in std.split("\n") if l.startswith("#"))
        for sec in REQUIRED_SECTIONS:
            if sec not in heads:
                bad.append(f"docs/design/ios26/STANDARD_ios26_css.md — ЗКН-Д026: "
                           f"пропал раздел «{sec}»; вырезанный раздел = молча снятое правило")

    # ── ПРАВИЛО 4 — адрес замера ведёт к кадру ───────────────────────────
    for named in sorted(set(re.findall(r"apple_[a-z0-9_]+\.pdf", std))):
        if named not in pdfs:
            bad.append(f"docs/design/ios26/STANDARD_ios26_css.md — ЗКН-Д026: замер "
                       f"ссылается на «{named}», которого нет в refs/; мёртвый адрес "
                       f"выглядит как доказательство и потому вреднее отсутствующего")
    # Стандарт ссылается на кадры и коротким именем — «apple_id с.4». Проверяем и их.
    stems = {p[:-4] for p in pdfs}
    for stem in sorted(set(re.findall(r"`?(apple_[a-z0-9_]+)`?\s+с\.", std))):
        if stem not in stems:
            bad.append(f"docs/design/ios26/STANDARD_ios26_css.md — ЗКН-Д026: замер "
                       f"ссылается на кадр «{stem}», которого нет в refs/")

    # ── ПРАВИЛО 5 — храповик замеров ─────────────────────────────────────
    n_meas = std.count(MEASURE_MARK)
    base = load_baseline()
    floor = int(base.get("measures", 0))
    if n_meas < floor:
        bad.append(f"docs/design/ios26/STANDARD_ios26_css.md — ЗКН-Д026: замеров "
                   f"{n_meas} при базе {floor}. Замер удаляют не чисткой, а поправкой "
                   f"с объяснением — тогда база двигается руками в tools/ios26-baseline.json")

    if bad:
        print("ГЕЙТ ЭТАЛОНА iOS 26.5 (ЗКН-Д026) — НАРУШЕНИЯ:\n")
        for b in bad:
            print("  \u2717 " + b)
        print(f"\nВсего: {len(bad)}")
        return 1

    where = "локально" if local else "на зеркалах"
    print(f"Гейт эталона iOS 26.5 (ЗКН-Д026): чисто. Продуктов {len(pdfs)} ({where}), "
          f"контактных листов {len(list(REFS.glob('*.contact.jpg')))}, "
          f"замеров в стандарте {n_meas} (база {floor}).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
