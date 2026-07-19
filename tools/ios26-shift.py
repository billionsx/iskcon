#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
КАРТА СДВИГОВ: где мокап разошёлся с кадром и НА СКОЛЬКО.

Общая доля Δ>24 говорит «плохо», но не говорит «что». Этот инструмент берёт список
именованных областей и для каждой ищет сдвиг, при котором расхождение минимально.
Дальше решение принимается по ДВУМ числам:

  · сдвиг помогает  → элемент верный, но стоит не там  → поправить координату;
  · сдвиг НЕ помогает → элемент стоит верно, но нарисован иначе → кегль, вес, начертание.

Без этого разделения правки идут наугад: я двигал то, что надо было утоньшать.

ЗНАК СДВИГА. Возвращается смещение ОКНА В МОКАПЕ, при котором оно совпало с эталоном.
Если окно нашлось левее (dx < 0) — значит содержимое мокапа левее эталонного, и
координату надо УВЕЛИЧИТЬ. Поправка = −dx. Один раз перепутав это, я сдвинул
заголовок в обратную сторону и удвоил расхождение.

Запуск: python3 tools/ios26-shift.py <эталон.png> <мокап.png> <области.json>
"""
import json
import sys

import numpy as np
from PIL import Image


def load(p):
    return np.asarray(Image.open(p).convert("RGB")).astype(float)


def probe(A, B, x0, x1, y0, y1, r=5):
    a = A[int(y0 * 3):int(y1 * 3), int(x0 * 3):int(x1 * 3)].mean(axis=2)
    bo = B[int(max(y0 - r, 0) * 3):int((y1 + r) * 3),
           int(max(x0 - r, 0) * 3):int((x1 + r) * 3)].mean(axis=2)
    best = (1e9, 0.0, 0.0)
    for dy in range(-r * 3, r * 3 + 1):
        for dx in range(-r * 3, r * 3 + 1):
            oy, ox = int(r * 3) + dy, int(r * 3) + dx
            if oy < 0 or ox < 0 or oy + a.shape[0] > bo.shape[0] or ox + a.shape[1] > bo.shape[1]:
                continue
            v = np.abs(a - bo[oy:oy + a.shape[0], ox:ox + a.shape[1]]).mean()
            if v < best[0]:
                best = (v, dx / 3.0, dy / 3.0)
    now = np.abs(a - B[int(y0 * 3):int(y1 * 3), int(x0 * 3):int(x1 * 3)].mean(axis=2)).mean()
    return now, best[0], best[1], best[2]


def density(A, B, x0, x1, y0, y1, thr=60, dark=False):
    a = A[int(y0 * 3):int(y1 * 3), int(x0 * 3):int(x1 * 3)].max(axis=2)
    b = B[int(y0 * 3):int(y1 * 3), int(x0 * 3):int(x1 * 3)].max(axis=2)
    fa = (a < thr).mean() if dark else (a > thr).mean()
    fb = (b < thr).mean() if dark else (b > thr).mean()
    return fb / fa if fa > 0 else 0.0


def main():
    if len(sys.argv) < 4:
        print(__doc__)
        return 2
    A, B = load(sys.argv[1]), load(sys.argv[2])
    zones = json.load(open(sys.argv[3], encoding="utf-8"))
    print(f"{'элемент':>18} {'Δ':>6} {'Δ мин':>6} {'поправка x':>11} {'поправка y':>11} {'плотность':>10}  вывод")
    for z in zones:
        now, best, dx, dy = probe(A, B, z["x0"], z["x1"], z["y0"], z["y1"])
        dens = density(A, B, z["x0"], z["x1"], z["y0"], z["y1"],
                       z.get("thr", 60), z.get("dark", False))
        moved = abs(dx) > 0.3 or abs(dy) > 0.3
        gain = now - best
        if moved and gain > 2:
            verdict = "СДВИНУТЬ"
        elif dens > 1.12:
            verdict = "ЖИРНЕЕ ЭТАЛОНА — убавить вес"
        elif dens < 0.89:
            verdict = "ТОНЬШЕ ЭТАЛОНА — прибавить вес"
        elif now > 12:
            verdict = "начертание или кегль"
        else:
            verdict = "в норме"
        print(f"{z['name']:>18} {now:>6.1f} {best:>6.1f} {-dx:>11.2f} {-dy:>11.2f} {dens:>10.3f}  {verdict}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
