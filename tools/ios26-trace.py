#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ЗКН-Д026 · ОБВОДКА ЗНАКА С КАДРА.

SF Symbols в эталоне растровые: как контуры они не извлекаются, и до сих пор
знаки в мокапах стояли рисованные от руки. Сверка это показала прямо — все
худшие клетки расхождения приходились на знаки, а не на геометрию.

Рисовать от руки больше не нужно. Кадр снят при @3x, знак занимает 40–130 px —
этого хватает, чтобы обвести его границу по 50 % материала (тот же порог, что
у краёв блоков) и выпустить контур как путь SVG.

Что делает: берёт прямоугольник кадра, отделяет знак от подложки по цвету,
находит контуры на полупиксельной сетке (marching squares), прореживает их
по Дугласу–Пекеру с допуском в долях пикселя и печатает `<path>` в системе
координат viewBox, привязанной к снятому габариту знака.

Обводка — это **замер**, а не рисунок: порог назван, допуск назван, результат
воспроизводится. Но обводка растра не равна исходному вектору Apple: на кромке
остаётся ступень порядка ⅓ pt. Поэтому знак помечается 📐 по габариту и
положению и ⚙️ по форме.

Запуск:
  python3 tools/ios26-trace.py <кадр.png> <x0> <y0> <x1> <y1> [--fill R,G,B]
                               [--tol 0.6] [--name walk]
Координаты — в pt эталона (pt = px/3).
"""
import argparse
import sys

import numpy as np
from PIL import Image


def load(path):
    return np.asarray(Image.open(path).convert("RGB")).astype(float)


def mask(img, fill, back, thr=0.5):
    """Доля материала: проекция цвета на отрезок «подложка → знак»."""
    a = np.array(back, float)
    v = np.array(fill, float) - a
    t = ((img - a) @ v) / float(v @ v)
    return t > thr


def douglas_peucker(pts, tol):
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    ab = b - a
    n = np.hypot(*ab)
    if n < 1e-9:
        d = np.hypot(*(pts - a).T)
    else:
        w_ = pts - a
        d = np.abs(ab[0] * w_[:, 1] - ab[1] * w_[:, 0]) / n
    i = int(np.argmax(d))
    if d[i] > tol:
        left = douglas_peucker(pts[: i + 1], tol)
        right = douglas_peucker(pts[i:], tol)
        return np.vstack([left[:-1], right])
    return np.vstack([a, b])


def trace(img, box, fill, back, tol=0.6, vb=None):
    from skimage import measure
    x0, y0, x1, y1 = [int(round(v * 3)) for v in box]
    sub = img[y0:y1, x0:x1]
    mk = mask(sub, fill, back)
    if not mk.any():
        raise SystemExit("в прямоугольнике нет материала знака")
    ys, xs = np.where(mk)
    # габарит знака в pt, от левого верхнего угла прямоугольника
    gx0, gx1, gy0, gy1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    pad = np.zeros((mk.shape[0] + 2, mk.shape[1] + 2), bool)
    pad[1:-1, 1:-1] = mk
    cs = measure.find_contours(pad.astype(float), 0.5)
    w, h = (gx1 - gx0) / 3.0, (gy1 - gy0) / 3.0
    sc = (vb / max(w, h)) if vb else 1.0
    out = []
    for c in cs:
        if len(c) < 8:
            continue
        p = np.stack([c[:, 1] - 1 - gx0, c[:, 0] - 1 - gy0], axis=1) / 3.0 * sc
        p = douglas_peucker(p, tol / 3.0 * sc)
        if len(p) < 3:
            continue
        d = "M" + " ".join(f"{x:.2f},{y:.2f}" for x, y in p) + "Z"
        out.append((abs(_area(p)), d))
    out.sort(reverse=True)
    return dict(w=round(w, 2), h=round(h, 2),
                x=round(gx0 / 3.0, 2), y=round(gy0 / 3.0, 2),
                paths=[d for _, d in out])


def _area(p):
    x, y = p[:, 0], p[:, 1]
    return 0.5 * np.sum(x * np.roll(y, -1) - np.roll(x, -1) * y)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("frame")
    ap.add_argument("box", nargs=4, type=float)
    ap.add_argument("--fill", default="165,255,0")
    ap.add_argument("--back", default="15,25,1")
    ap.add_argument("--tol", type=float, default=0.6)
    ap.add_argument("--vb", type=float, default=24.0)
    ap.add_argument("--name", default="знак")
    a = ap.parse_args()
    f = tuple(int(v) for v in a.fill.split(","))
    b = tuple(int(v) for v in a.back.split(","))
    r = trace(load(a.frame), a.box, f, b, a.tol, a.vb)
    print(f"# {a.name}: габарит {r['w']}×{r['h']} pt, смещение в прямоугольнике "
          f"{r['x']}·{r['y']} pt, порог 50 %, допуск {a.tol} px")
    print(f'<svg viewBox="0 0 {a.vb} {a.vb}" fill="currentColor">'
          f'<path fill-rule="evenodd" d="{"".join(r["paths"])}"/></svg>')


if __name__ == "__main__":
    sys.exit(main())
