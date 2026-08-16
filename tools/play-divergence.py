#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ПАСПОРТ-ЗАМЕР ОБОЛОЧКИ ПЛЕЕРА · разбор долга BXE на две стопки.

ЗАЧЕМ. Департамент судит оболочку каноном iOS 26.5, снятым с 217 кадров
десяти продуктов Apple. Оболочка `/play` построена другим обмером — побитовым
разбором 45 кадров САМОГО Apple Music (LAW_MUSIC, 📐-адреса в CSS). Оба
корпуса измеренные, и они местами расходятся: департамент знает лестницу
радиусов [8, 12, 16, 24, 29, 37.8], а шторка Apple Music меряется в 40 —
число выведено геометрически из профиля края (IMG_1983, LAW_MUSIC §4.7).

Слепо подогнать 40 → 37.8 значит ИСПОРТИТЬ плеер ради числа. Но и оставить
131 находку в общей куче нельзя: пока ошибки лежат вместе с осознанными
расхождениями, число не значит ничего (тот же принцип, что несёт
`tools/eyes-divergence.py` для приложения и ЗКН-Д028 для токенов).

ЧТО ДЕЛАЕТ. Берёт отчёт советника по паспорту `iskcon-play` и раскладывает
каждую находку по признаку АДРЕСА ЗАМЕРА рядом со строкой:

  · РАСХОЖДЕНИЕ — у строки есть 📐-адрес (кадр, LAW_MUSIC §, pl_q15 и т. п.).
    Это измеренное число из корпуса Apple Music. Правится не код, а паспорт
    департамента: величина вносится в `radius_extra`/`allow_extra` адаптера
    `iskcon-play` с указанием адреса. Молча подгонять запрещено.

  · ДОЛГ — адреса нет. Это число «на глаз», и оно чинится в коде.

Запуск:
    python3 tools/play-divergence.py --report /tmp/play.md
    python3 tools/play-divergence.py --report /tmp/play.md --only AE11

Отчёт советника собирается так (департамент берётся на чтение):
    python3 __eyes/bin/eyes.py lint --adapter iskcon-play --mode report \\
        --project-root . --out /tmp/play.md
"""
import argparse
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "apps" / "web" / "src"

# Признаки адреса замера рядом со строкой. 📐 — метка обмера в CSS оболочки;
# остальные — способы сослаться на кадр или статью закона без метки.
ADDR = re.compile(
    r"📐|LAW_MUSIC|IMG_\d{3,}|pl_q\d+|open_\d+|§\s*\d|"
    r"[Зз]амер|измерен|кадр\s+\w+|ЗКН-[А-ЯA-Zа-я]+\d+",
    # Ссылка на закон свода — тоже адрес: за ЗКН стоит записанная
    # причина и механизм, а не впечатление.
)
# ⚠️ ПРИЗНАННАЯ ДЫРА — НЕ АДРЕС. В CSS оболочки есть комментарии вида
# «LAW_MUSIC §4.5: кадр шторки НЕ РАЗОБРАН до числа» — это честное признание,
# что замера нет. Ссылка на статью в такой строке ссылается на пустоту, и
# засчитывать её за адрес значит прятать долг за формой (ЗКН-БТ001: число
# без адреса хуже отсутствующего, потому что его нельзя проверить).
HOLE = re.compile(r"🕳|не разобран|не измерен|не снят|на глаз|прикидк")
# Сколько строк вверх считать «рядом»: правило CSS с длинным комментарием
# переносится, и адрес может стоять строкой выше объявления.
LOOKBACK = 3


def address_near(path: Path, line_no: int) -> str:
    """Вернуть найденный адрес замера рядом со строкой или пустую строку."""
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return ""
    lo = max(0, line_no - 1 - LOOKBACK)
    for raw in lines[lo:line_no]:
        if HOLE.search(raw):
            return ""
        m = ADDR.search(raw)
        if m:
            # вернуть кусок комментария вокруг совпадения — чтобы адрес
            # был виден в отчёте, а не только факт его наличия
            s = raw[max(0, m.start() - 4): m.start() + 60].strip()
            return re.sub(r"\s+", " ", s)
    return ""


def parse(report: Path):
    rule = None
    out = []
    for ln in report.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^## (AE\d+) · \d+$", ln)
        if m:
            rule = m.group(1)
            continue
        m = re.match(r"^- `([^`]+)` — (.+)$", ln)
        if m and rule:
            loc, why = m.groups()
            file_part, _, num = loc.rpartition(":")
            out.append((rule, file_part, int(num), why))
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--report", required=True,
                    help="отчёт советника по паспорту iskcon-play")
    ap.add_argument("--only", help="показать только это правило (например AE11)")
    a = ap.parse_args()

    rep = Path(a.report)
    if not rep.exists():
        print(f"нет отчёта {rep} — сначала собери его советником департамента")
        return 2

    rows = parse(rep)
    if not rows:
        print("в отчёте нет находок — разбирать нечего")
        return 0

    diverg, debt = [], []
    for rule, f, n, why in rows:
        if a.only and rule != a.only:
            continue
        addr = address_near(ROOT / f, n)
        (diverg if addr else debt).append((rule, f, n, why, addr))

    print("ПАСПОРТ-ЗАМЕР ОБОЛОЧКИ ПЛЕЕРА")
    print(f"  находок разобрано: {len(diverg) + len(debt)}")
    print(f"  расхождений (число С адресом замера): {len(diverg)}")
    print(f"  долга (число БЕЗ адреса): {len(debt)}")

    if debt:
        print("\n── ДОЛГ · чинится в коде ─────────────────────────────────")
        for rule, f, n, why, _ in debt:
            print(f"  {rule:5} {f.replace('apps/web/src/', '')}:{n}")
            print(f"        {why}")

    if diverg:
        print("\n── РАСХОЖДЕНИЯ · вносятся в паспорт, код не трогаем ──────")
        for rule, f, n, why, addr in diverg:
            print(f"  {rule:5} {f.replace('apps/web/src/', '')}:{n}  ← {addr}")

    print("\nПО ПРАВИЛАМ (долг / расхождения):")
    cd, cv = Counter(r[0] for r in debt), Counter(r[0] for r in diverg)
    for rule in sorted(set(cd) | set(cv)):
        print(f"  {rule:5} {cd[rule]:4} / {cv[rule]:4}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
