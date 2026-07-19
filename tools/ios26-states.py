#!/usr/bin/env python3
"""
СОСТОЯНИЯ НИЖНЕГО СЛОЯ — восстановление кинетики по статике.

Анимацию со статичного кадра снять нельзя: ни длительность, ни кривую. Но
СОСТОЯНИЕ снять можно, и если в наборе есть кадры одного продукта в разных
состояниях, переход становится вектором между двумя измеренными точками.

Ключевое решение: слой разбирается НА СЕГМЕНТЫ. Меру «панель шириной X» брать
нельзя — она уже интерпретация и прячет механику. Меряются все капсулы в полосе
и зазоры между ними, потом внутри капсулы считаются элементы.

Так нашлось то, что по одной ширине не видно:
  · Files — на верхнем уровне капсула 274 с тремя равными табами, внутри папки
    294 с широким элементом 90 pt у левого края: разделы свернулись в один;
  · TV — в плеере капсула 281 с четырьмя элементами схлопывается в 51 с одним,
    место занимают контекстные капсулы 70 и 140;
  · арифметика полосы сходится точно: 281 + зазор + 62 = 351 = 393 − 21 − 21.

Мастера в дерево не возвращаем (ЗКН-Ф025):

    python3 tools/assets/offload.py restore --class ios26-refs

Запуск:

    python3 tools/ios26-states.py /tmp/apple_tv.pdf
"""
import io
import sys
from collections import Counter

import numpy as np

try:
    import fitz  # PyMuPDF
    from PIL import Image
except ImportError:  # pragma: no cover
    sys.exit("нужны PyMuPDF и Pillow: pip install pymupdf pillow")

REF_H = 852.0






def frames(pdf):
    d = fitz.open(pdf)
    for p in range(d.page_count):
        im = d[p].get_images(full=True)
        raw = d.extract_image(im[0][0])["image"]
        yield p + 1, np.array(Image.open(io.BytesIO(raw)).convert("RGB")).astype(int)
    d.close()


def hexc(c):
    return "#%02X%02X%02X" % tuple(int(v) for v in c)


def layer_segments(A, gap_px=10, min_w=60):
    """Сегменты нижнего слоя: все капсулы в полосе, где живёт плавающая деталь."""
    H, W, _ = A.shape
    canvas = np.median(A[int(H * 0.45):int(H * 0.5), 5:25].reshape(-1, 3), 0)
    wide = lambda y: (np.abs(A[y] - canvas).sum(1) > 26).sum()
    # нижняя граница детали: снизу вверх до первой широкой строки
    yb = None
    for y in range(H - 1, H - 460, -1):
        if wide(y) > 300:
            yb = y
            break
    if yb is None or (H - 1 - yb) < 15:
        return None
    yt = yb
    while yt > 0 and wide(yt - 1) > 300:
        yt -= 1
    ym = (yt + yb) // 2
    d = np.abs(A[ym] - canvas).sum(1) > 26
    xs = np.where(d)[0]
    if not len(xs):
        return None
    segs, s, p = [], xs[0], xs[0]
    for x in xs[1:]:
        if x - p > gap_px:
            if p - s + 1 >= min_w:
                segs.append((s, p))
            s = x
        p = x
    if p - s + 1 >= min_w:
        segs.append((s, p))
    sc = H / REF_H
    return dict(top=yt, bot=yb, h=(yb - yt + 1) / sc, gap_bottom=(H - 1 - yb) / sc,
                segs=[(round(a / sc, 1), round((b - a + 1) / sc, 1)) for a, b in segs],
                fill=hexc(A[ym, (segs[0][0] + segs[0][1]) // 2]) if segs else None)


def scan(pdf):
    out = []
    for p, A in frames(pdf):
        r = layer_segments(A)
        if r and 8 <= r["gap_bottom"] <= 45 and 30 <= r["h"] <= 75:
            out.append((p, r))
    return out


def items(A, yt, yb, x0pt, wpt):
    """Элементы внутри капсулы: кластеры чернил по колонкам, склеенные по табам."""
    sc = A.shape[0] / REF_H
    x0, x1 = int(x0pt * sc), int((x0pt + wpt) * sc)
    m = A[yt + 6:yb - 5, x0:x1].max(2) > 110
    on = m.mean(0) > 0.02
    runs, s = [], None
    for i, v in enumerate(on):
        if v and s is None:
            s = i
        if not v and s is not None:
            if i - s > 6:
                runs.append((s, i - 1))
            s = None
    if s is not None and len(on) - s > 6:
        runs.append((s, len(on) - 1))
    merged = []
    for a, b in runs:
        if merged and a - merged[-1][1] <= 22:
            merged[-1] = (merged[-1][0], b)
        else:
            merged.append((a, b))
    return [(round(x0pt + a / sc, 1), round((b - a + 1) / sc, 1)) for a, b in merged]


def main() -> int:
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    for pdf in sys.argv[1:]:
        print("=" * 66)
        print(pdf)
        rows = scan(pdf)
        sig = Counter()
        for p, r in rows:
            A = next(a for pp, a in frames(pdf) if pp == p)
            it = items(A, r["top"], r["bot"], r["segs"][0][0], r["segs"][0][1])
            segs = " ".join(f"[{a:.0f}+{w:.0f}]" for a, w in r["segs"])
            print(f"  с.{p:02d} h={r['h']:.0f} низ={r['gap_bottom']:.0f} "
                  f"ось={r['gap_bottom'] + r['h'] / 2:.0f}  {segs:32s} элементов={len(it)} {it}")
            sig[(tuple(r["segs"]), len(it))] += 1
        print("  --- состояния ---")
        for (segs, n), c in sig.most_common():
            print(f"   ×{c:2d} {segs} элементов={n}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
