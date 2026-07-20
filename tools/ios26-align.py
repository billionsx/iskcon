#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ПОЛНОЕ ВЫРАВНИВАНИЕ МОКАПА ПО КАДРУ.

Находит чернила каждой строки в мокапе и те же чернила в кадре, считает расхождение
по левому краю, верху и высоте, и выставляет координату и кегль. Повторяет с
ДЕМПФИРОВАНИЕМ: шаг режется вдвое, если проход не улучшил зону. Без демпфирования
поправка проскакивает оптимум и цикл болтается — так моя первая попытка автоподгонки
ухудшила кадр с 3.87 до 4.55 %.

Кегль правится по высоте чернил, а не подбирается: h_кадра / h_мокапа — прямое
отношение, потому что высота чернил линейна по кеглю.

Запуск: python3 tools/ios26-align.py <проходов>
"""
import re
import subprocess
import sys
import pathlib

import numpy as np
from PIL import Image

GEN  = pathlib.Path('/home/claude/gen_f03.py')
REF  = '/home/claude/fit/f03.png'
SHOT = '/home/claude/shot03.png'
HTML = '/home/claude/iskcon/docs/design/ios26/mockups/fitness/f03.html'

# имя · окно поиска · переменная левого края · переменная верха · переменная кегля · порог · тёмный
EL = [
 ("22:46",     (28, 96,14, 44), "sb-time-x",  "sb-time-top",  "fs-sb",   95, False),
 ("LTE",       (300,330,16, 40), "sb-lte-x",   "sb-lte-top",   "fs-lte",  95, False),
 ("Sessions",  (10,200,116,160), "title-x",    "title-top",    "fs-title",95, False),
 ("All",       (20, 60,184,210), None,         "chip-text-top","fs-chip", 90, False),
 ("Walking",   (172,248,184,210),None,         None,           None,      90, False),
 ("Other",     (262,322,184,210),None,         None,           None,      90, False),
 ("July",      (10,130,236,272), "col-x",      "m1-top",       "fs-month",95, False),
 ("Total",     (120,172,286,314),"col2-x",     "head-top",     "fs-head", 60, False),
 ("Average",   (228,304,286,314),"col3-x",     None,           None,      60, False),
 ("Workouts1", (10, 96,314,340), None,         "row1-top",     "fs-row",  95, False),
 ("Time1",     (10, 62,336,360), None,         "row2-top",     None,      95, False),
 ("Kcal1",     (10,110,354,382), None,         "row3-top",     None,      95, False),
 ("v-Time1",   (124,196,336,360),None,         None,           None,      60, False),
 ("v-Kcal1",   (124,210,354,382),None,         None,           None,      60, False),
 ("October",   (10,160,498,528), None,         "m2-top",       None,      95, False),
 ("Total2",    (120,172,548,576),None,         "head2-top",    None,      60, False),
 ("Workouts2", (10, 96,574,600), None,         "row1b-top",    None,      95, False),
 ("Time2",     (10, 62,596,620), None,         "row2b-top",    None,      95, False),
 ("Kcal2",     (10,110,614,642), None,         "row3b-top",    None,      95, False),
 ("SocDance",  (84,184,402,432), "c-text-x",   "c1-t1-top",    "fs-c-t1", 95, False),
 ("213",       (84,130,426,466), "cv-x",       "c1-t2-top",    "fs-c-t2", 60, False),
 ("KCAL",      (126,192,426,466),"c1-unit-x",  "c1-unit-top",  "fs-unit", 60, False),
 ("Today",     (316,368,436,468),"c-date-x",   "c1-date-top",  "fs-date", 60, False),
 ("OutWalk",   (84,190,664,694), None,         "c2-t1-top",    None,      95, False),
 ("0:49",      (84,152,688,728), None,         "c2-t2-top",    None,      60, False),
 ("date2",     (292,368,698,726),"c2-date-x",  "c2-date-top",  "fs-date2",60, False),
 ("lbSummary", (78,152,802,828), None,         "tab-label-top","fs-tab",  70, False),
]


def ink(I, box, thr, dark):
    x0, x1, y0, y1 = box
    s = I[int(y0 * 3):int(y1 * 3), int(x0 * 3):int(x1 * 3)]
    m = (s.max(axis=2) < thr) if dark else (s.max(axis=2) > thr)
    ys, xs = np.where(m)
    if not len(ys):
        return None
    return dict(x=x0 + xs.min() / 3.0, y=y0 + ys.min() / 3.0,
                w=(xs.max() + 1 - xs.min()) / 3.0, h=(ys.max() + 1 - ys.min()) / 3.0)


def render():
    subprocess.run([sys.executable, str(GEN)], capture_output=True)
    subprocess.run(["node", "/home/claude/shot.js", HTML, SHOT, "3"], capture_output=True)
    return np.asarray(Image.open(SHOT).convert('RGB')).astype(int)


def getv(src, k):
    m = re.search(rf'"{k}":\s*([\d.]+)', src)
    return float(m.group(1)) if m else None


def setv(src, k, v):
    return re.sub(rf'"{k}":\s*[\d.]+', f'"{k}":{v:.2f}', src)


def score(A, B):
    return float((np.abs(A - B).max(axis=2) > 24).mean()) * 100


def main():
    passes = int(sys.argv[1]) if len(sys.argv) > 1 else 6
    A = np.asarray(Image.open(REF).convert('RGB')).astype(int)
    B = render()
    best = score(A, B)
    best_src = GEN.read_text()
    damp = 1.0
    print(f"старт: {best:.2f} %")
    for it in range(1, passes + 1):
        src = GEN.read_text()
        for name, box, kx, ky, kf, thr, dark in EL:
            a = ink(A, box, thr, dark)
            b = ink(B, box, thr, dark)
            if not a or not b:
                continue
            if kf and a['h'] > 2 and b['h'] > 2:
                cur = getv(src, kf)
                if cur:
                    tgt = cur * a['h'] / b['h']
                    src = setv(src, kf, cur + (tgt - cur) * damp)
            if ky and abs(a['y'] - b['y']) > 0.15:
                cur = getv(src, ky)
                if cur is not None:
                    src = setv(src, ky, cur + (a['y'] - b['y']) * damp)
            if kx and abs(a['x'] - b['x']) > 0.15:
                cur = getv(src, kx)
                if cur is not None:
                    src = setv(src, kx, cur + (a['x'] - b['x']) * damp)
        GEN.write_text(src)
        B = render()
        s = score(A, B)
        if s < best:
            best, best_src = s, GEN.read_text()
            print(f"  проход {it}: {s:.2f} %  ← принят (шаг {damp:.2f})")
        else:
            damp *= 0.5
            GEN.write_text(best_src)
            B = render()
            print(f"  проход {it}: {s:.2f} %  отброшен, шаг уменьшен до {damp:.2f}")
            if damp < 0.06:
                break
    GEN.write_text(best_src)
    B = render()
    print(f"ИТОГ: {score(A, B):.2f} %")
    return 0


if __name__ == "__main__":
    sys.exit(main())
