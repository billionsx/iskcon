#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ПОЛНЫЙ АУДИТ ЭКРАНА: всё, что можно измерить, меряется и сравнивается.

Прежние инструменты смотрели по одному свойству: перепись — заливки, обмер — строки.
Этот сводит воедино СЕМЬ величин по каждому объекту и добавляет то, чего не было ни
в одном: РАССТОЯНИЯ между соседями и РАДИУС скругления.

  1. положение (левый край, верх)      5. цвет по 92-му процентилю
  2. габарит (ширина, высота)          6. плотность материала = вес начертания
  3. интервал до следующей строки      7. радиус скругления по форме угла
  4. отступ от края холста

Запуск: python3 tools/ios26-audit.py <эталон.png> <мокап.png>
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

S = 3  # @3x


def load(p):
    return np.asarray(Image.open(p).convert('RGB')).astype(int)


def rows(A, thr=70, gap=24):
    """Строки чернил с разрезкой по горизонтальным пропускам."""
    m = A.max(axis=2) > thr
    prof = m.any(axis=1)
    bands, st = [], None
    for i, v in enumerate(prof):
        if v and st is None:
            st = i
        if not v and st is not None:
            if i - st >= 6:
                bands.append((st, i))
            st = None
    if st is not None:
        bands.append((st, len(prof)))
    out = []
    for y0, y1 in bands:
        cols = m[y0:y1].any(axis=0)
        seg, s2, g = [], None, 0
        for j, v in enumerate(cols):
            if v:
                if s2 is None:
                    s2 = j
                g = 0
            elif s2 is not None:
                g += 1
                if g >= gap:
                    seg.append((s2, j - g + 1)); s2 = None
        if s2 is not None:
            seg.append((s2, len(cols)))
        for x0, x1 in seg:
            sub = A[y0:y1, x0:x1]
            mm = sub.max(axis=2) > thr
            if mm.sum() < 40:
                continue
            px = sub[mm]
            top = np.percentile(px, 92, axis=0)
            out.append(dict(
                x=round(x0 / S, 2), y=round(y0 / S, 2),
                w=round((x1 - x0) / S, 2), h=round((y1 - y0) / S, 2),
                col=f"#{int(top[0]):02X}{int(top[1]):02X}{int(top[2]):02X}",
                dens=round(float(mm.mean()), 4)))
    return sorted(out, key=lambda d: (d['y'], d['x']))


def radius(A, box, col_hex):
    """Радиус скругления: сколько не хватает до прямого угла по диагонали."""
    x, y, w, h = box
    c = np.array([int(col_hex[i:i+2], 16) for i in (1, 3, 5)])
    sub = A[int(y*S):int((y+h)*S), int(x*S):int((x+w)*S)]
    m = (np.abs(sub - c).max(axis=2) < 10)
    if m.size == 0 or not m.any():
        return None
    n = min(int(min(w, h) * S // 2), 90)
    k = 0
    for i in range(n):
        if m[i, i]:
            break
        k += 1
    return round(k / S * 1.41, 2)


def fills(A, min_area=1400):
    key = A[:, :, 0]*65536 + A[:, :, 1]*256 + A[:, :, 2]
    vals, cnt = np.unique(key, return_counts=True)
    out = []
    for col in vals[cnt >= min_area]:
        lab, n = ndimage.label(key == col)
        for i in range(1, n+1):
            z = (lab == i)
            a = int(z.sum())
            if a < min_area:
                continue
            ys, xs = np.where(z)
            x0, x1, y0, y1 = xs.min(), xs.max()+1, ys.min(), ys.max()+1
            r, g, b = int(col >> 16), int((col >> 8) & 255), int(col & 255)
            hexc = f"#{r:02X}{g:02X}{b:02X}"
            box = (x0/S, y0/S, (x1-x0)/S, (y1-y0)/S)
            out.append(dict(x=round(box[0], 2), y=round(box[1], 2),
                            w=round(box[2], 2), h=round(box[3], 2),
                            col=hexc, area=a, r=radius(A, box, hexc)))
    return sorted(out, key=lambda d: (d['y'], d['x']))


def iou(a, b):
    """Доля перекрытия двух прямоугольников."""
    x0 = max(a['x'], b['x']); y0 = max(a['y'], b['y'])
    x1 = min(a['x']+a['w'], b['x']+b['w']); y1 = min(a['y']+a['h'], b['y']+b['h'])
    if x1 <= x0 or y1 <= y0:
        return 0.0
    inter = (x1-x0) * (y1-y0)
    union = a['w']*a['h'] + b['w']*b['h'] - inter
    return inter / union if union > 0 else 0.0


def pair(a, b, tol=0.30):
    """Пара ищется по ПЕРЕКРЫТИЮ, а не по сумме расстояний.

    Сумма расстояний ложно объявляла элемент отсутствующим, если он сместился
    на пару пунктов: 91 «пропажа» в аудите экрана 3 оказалась артефактом — все
    объекты были на месте. Перекрытие площадей от смещения почти не страдает,
    зато честно отделяет ДРУГОЙ объект от того же самого.
    """
    best, bv = None, 0.0
    for y in b:
        v = iou(a, y)
        if v > bv:
            bv, best = v, y
    return best if bv >= tol else None


def main():
    A, B = load(sys.argv[1]), load(sys.argv[2])
    RA, RB = rows(A), rows(B)
    FA, FB = fills(A), fills(B)
    print(f"эталон: {len(RA)} строк · {len(FA)} заливок")
    print(f"мокап : {len(RB)} строк · {len(FB)} заливок\n")

    bad = 0
    print("СТРОКИ — положение · габарит · цвет · вес")
    for i, a in enumerate(RA):
        b = pair(a, RB)
        if not b:
            print(f"  ✗ ОТСУТСТВУЕТ строка {a['col']} {a['w']}×{a['h']} @ {a['x']},{a['y']}")
            bad += 1
            continue
        v = []
        if abs(a['x']-b['x']) > 0.5: v.append(f"лев {a['x']}→{b['x']}")
        if abs(a['y']-b['y']) > 0.5: v.append(f"верх {a['y']}→{b['y']}")
        if abs(a['w']-b['w']) > 1.0: v.append(f"шир {a['w']}→{b['w']}")
        if abs(a['h']-b['h']) > 0.7: v.append(f"выс {a['h']}→{b['h']}")
        if a['col'] != b['col']:      v.append(f"цвет {a['col']}→{b['col']}")
        if a['dens'] and abs(a['dens']-b['dens'])/a['dens'] > 0.12:
            v.append(f"вес {a['dens']:.3f}→{b['dens']:.3f}")
        if v:
            print(f"  · @ {a['x']:>6},{a['y']:>6}: " + " · ".join(v))
            bad += 1

    print("\nИНТЕРВАЛЫ между соседними строками")
    for i in range(len(RA)-1):
        ga = round(RA[i+1]['y'] - (RA[i]['y'] + RA[i]['h']), 2)
        b1, b2 = pair(RA[i], RB), pair(RA[i+1], RB)
        if not b1 or not b2:
            continue
        gb = round(b2['y'] - (b1['y'] + b1['h']), 2)
        if abs(ga - gb) > 0.7:
            print(f"  · после строки @ {RA[i]['y']}: эталон {ga} → мокап {gb}")
            bad += 1

    print("\nЗАЛИВКИ — габарит · цвет · скругление")
    for a in FA:
        b = pair(a, FB)
        if not b:
            print(f"  ✗ ОТСУТСТВУЕТ {a['col']} {a['w']}×{a['h']} @ {a['x']},{a['y']} (R={a['r']})")
            bad += 1
            continue
        v = []
        if abs(a['x']-b['x']) > 0.7: v.append(f"лев {a['x']}→{b['x']}")
        if abs(a['y']-b['y']) > 0.7: v.append(f"верх {a['y']}→{b['y']}")
        if abs(a['w']-b['w']) > 0.7: v.append(f"шир {a['w']}→{b['w']}")
        if abs(a['h']-b['h']) > 0.7: v.append(f"выс {a['h']}→{b['h']}")
        if a['col'] != b['col']:      v.append(f"цвет {a['col']}→{b['col']}")
        if a['r'] is not None and b['r'] is not None and abs(a['r']-b['r']) > 1.5:
            v.append(f"радиус {a['r']}→{b['r']}")
        if v:
            print(f"  · {a['col']} {a['w']}×{a['h']} @ {a['x']},{a['y']}: " + " · ".join(v))
            bad += 1

    print(f"\nВСЕГО РАСХОЖДЕНИЙ: {bad}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
