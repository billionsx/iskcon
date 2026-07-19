#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ПРИЁМ РЕФЕРЕНСА iOS 26.5 (ЗКН-Д026 · Ф025).

Основатель кладёт `apple_<продукт>.pdf` в `docs/design/ios26/refs/` — руками,
через веб-интерфейс GitHub. Дальше всё делает машина, потому что ручные шаги
после заливки — это те самые шаги, которые забываются:

  1. КОНТАКТНЫЙ ЛИСТ. Все кадры продукта одной картинкой ≤512 КБ. Без него
     папка после выноса мастеров пуста, и открыть её глазами нельзя.
  2. СТРОКА В РЕЕСТРЕ. Гейт Д026 требует биекции «файл ↔ INDEX.md». Файл без
     строки = материал, о котором никто не знает. Заглушка честно говорит, что
     покадровая роспись НЕ сделана — это 🕳, а не выдумка (ЗКН-БТ001).
  3. ИМЯ КЛАССА ДЛЯ ВЫНОСА. `offload.py` идемпотентен по классу: класс уже в
     манифесте → пропуск. Значит вторая партия обязана ехать СВОИМ классом,
     иначе мастер молча останется в git и Ф025 покраснеет на следующем же
     коммите в tools/.

Запуск: python3 tools/ios26-intake.py [--dry]
Печатает в stdout строку `CLASS=<имя>` — её подхватывает воркфлоу.
"""
import argparse
import datetime as dt
import hashlib
import json
import math
import os
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REFS = ROOT / "docs" / "design" / "ios26" / "refs"
INDEX = ROOT / "docs" / "design" / "ios26" / "INDEX.md"
MANIFEST = ROOT / "docs" / "assets" / "manifest.jsonl"
CLASS_PREFIX = "ios26-refs"
TSV_GLOB = "iskcon-onelove-ios26-refs*.files.tsv"

# Куда основатель РЕАЛЬНО кладёт файлы. 19.07.2026 он залил десять продуктов
# в `tools/assets/` — потому что папка называется «assets», и это разумно.
# Инструмент, который на это отвечает «не туда», перекладывает свою работу на
# человека. Приём подбирает `apple*.pdf` из любой из этих точек.
DROP_POINTS = ["docs/design/ios26/refs", "docs/design/ios26", "tools/assets", "docs/assets", "."]
SHEET_MAX = 512 * 1024
COLS = 8
THUMB = (170, 369)


def normalize(stem: str) -> str:
    """«apple app store-1-15_compressed» → «apple_app_store_1_15».

    Имя обязано быть машинным, потому что на него ссылается стандарт. Но
    приводить его к машинному — работа МАШИНЫ, а не человека с телефоном."""
    t = stem.lower().strip()
    t = re.sub(r"_?compressed", "", t)
    t = re.sub(r"[^a-z0-9]+", "_", t).strip("_")
    if not t.startswith("apple"):
        t = "apple_" + t
    t = re.sub(r"^apple_?", "apple_", t)
    return re.sub(r"_+", "_", t).strip("_")


def offloaded_hashes() -> dict:
    """SHA уже вынесенных мастеров: повторную заливку не принимаем дважды."""
    out = {}
    d = ROOT / "docs" / "assets"
    if not d.is_dir():
        return out
    for tsv in d.glob(TSV_GLOB):
        for row in tsv.read_text(encoding="utf-8").splitlines()[1:]:
            c = row.split("\t")
            if len(c) >= 3 and c[0].endswith(".pdf"):
                out[c[2]] = Path(c[0]).name
    return out


def sweep() -> list[str]:
    """Собрать `apple*.pdf` из всех точек сброса в refs/ с машинным именем."""
    notes, known = [], offloaded_hashes()
    REFS.mkdir(parents=True, exist_ok=True)
    for dp in DROP_POINTS:
        d = ROOT / dp
        if not d.is_dir():
            continue
        for f in sorted(d.glob("*.pdf")):
            if not f.name.lower().startswith("apple"):
                continue
            h = hashlib.sha256(f.read_bytes()).hexdigest()
            if h in known:
                if f.parent != REFS or f.name != known[h]:
                    f.unlink()
                    notes.append(f"{dp}/{f.name}: повтор уже вынесенного «{known[h]}» — удалён")
                continue
            dst = REFS / (normalize(f.stem) + ".pdf")
            if f.resolve() == dst.resolve():
                continue
            if dst.exists():
                f.unlink()
                notes.append(f"{dp}/{f.name}: «{dst.name}» уже принят — удалён")
                continue
            shutil.move(str(f), str(dst))
            notes.append(f"{dp}/{f.name} → refs/{dst.name}")
    return notes


def next_class() -> str:
    """Свободное имя класса: ios26-refs, ios26-refs-2, ios26-refs-3…"""
    used = set()
    if MANIFEST.exists():
        for line in MANIFEST.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                cls = json.loads(line).get("class", "")
            except json.JSONDecodeError:
                continue
            if cls.startswith(CLASS_PREFIX):
                used.add(cls)
    if CLASS_PREFIX not in used:
        return CLASS_PREFIX
    n = 2
    while f"{CLASS_PREFIX}-{n}" in used:
        n += 1
    return f"{CLASS_PREFIX}-{n}"


def frames(pdf: Path) -> list[bytes]:
    """Кадры из PDF как есть — без пересжатия: мерить будут по ним."""
    import fitz
    doc = fitz.open(pdf)
    out = []
    for page in doc:
        for img in page.get_images(full=True):
            out.append(doc.extract_image(img[0])["image"])
    return out


def contact_sheet(pdf: Path) -> tuple[Path, int]:
    """Лист для НАВИГАЦИИ, не для замера. Ужимается, пока не влезет в 512 КБ."""
    from PIL import Image
    import io
    imgs = frames(pdf)
    if not imgs:
        raise SystemExit(f"::error::в {pdf.name} нет кадров — это не скриншоты")
    rows = math.ceil(len(imgs) / COLS)
    tw, th = THUMB
    sheet = Image.new("RGB", (COLS * tw, rows * th), "#0A0A0A")
    for i, raw in enumerate(imgs):
        im = Image.open(io.BytesIO(raw)).convert("RGB").resize((tw - 4, th - 4), Image.LANCZOS)
        sheet.paste(im, ((i % COLS) * tw + 2, (i // COLS) * th + 2))
    out = pdf.with_suffix("").with_suffix("")
    out = REFS / (pdf.stem + ".contact.jpg")
    q = 72
    while True:
        sheet.save(out, "JPEG", quality=q, optimize=True, progressive=True)
        if out.stat().st_size <= SHEET_MAX or q <= 32:
            break
        q -= 8
    return out, len(imgs)


def human_name(stem: str) -> str:
    return stem.replace("apple_", "").replace("_", " ").strip().title()


def register(stem: str, n_frames: int) -> bool:
    """Строка в таблицу «Продукты» + раздел-заглушка. Возвращает True, если писали."""
    txt = INDEX.read_text(encoding="utf-8")
    if f"{stem}.pdf" in txt:
        return False

    lines = txt.split("\n")
    # последняя строка таблицы «Продукты» — она начинается с «| <число> | `apple_»
    last, num = None, 0
    for i, l in enumerate(lines):
        m = re.match(r"\|\s*(\d+)\s*\|\s*`apple_", l)
        if m:
            last, num = i, int(m.group(1))
    if last is None:
        return False
    row = (f"| {num + 1} | `{stem}.pdf` | {human_name(stem)} | {n_frames} | "
           f"🕳 роспись не сделана — принят автоматически |")
    lines.insert(last + 1, row)
    txt = "\n".join(lines)

    today = dt.date.today().strftime("%d.%m.%Y")
    stub = (f"\n## {num + 1}. `{stem}.pdf` — {human_name(stem)} · {n_frames} кадров\n\n"
            f"> **Роспись — долг 🕳.** Файл принят автоматически {today}. Покадровый\n"
            f"> разбор не сделан. Писать его «примерно» значит выдумать (ЗКН-БТ001):\n"
            f"> заглушка честнее правдоподобной таблицы, которую нельзя проверить.\n")
    anchor = "\n---\n\n## Где физически лежат кадры"
    txt = txt.replace(anchor, stub + anchor, 1) if anchor in txt else txt + stub
    INDEX.write_text(txt, encoding="utf-8")
    return True


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true")
    a = ap.parse_args()

    if not REFS.is_dir():
        print("::error::нет docs/design/ios26/refs/")
        return 1

    for n in sweep():
        print(f"::notice::{n}")

    pdfs = sorted(REFS.glob("*.pdf"))
    if not pdfs:
        print("::notice::новых мастеров нет — приём пропущен")
        print("CLASS=")
        return 0

    for pdf in pdfs:
        if a.dry:
            print(f"::notice::[dry] {pdf.name}")
            continue
        sheet, n = contact_sheet(pdf)
        wrote = register(pdf.stem, n)
        print(f"::notice::{pdf.name}: кадров {n}, лист {sheet.stat().st_size // 1024} КБ, "
              f"реестр {'дополнен' if wrote else 'уже знал'}")

    cls = next_class()
    print(f"::notice::класс для выноса: {cls}")
    print(f"CLASS={cls}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
