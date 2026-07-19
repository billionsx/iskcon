#!/usr/bin/env python3
"""
ПЕРЕПИСЬ НАДПИСЕЙ — кегль, вес и цвет каждой строки текста.

Вес нельзя «увидеть», но его можно посчитать: у шрифта вес — это толщина
штриха, а при известной высоте заглавной отношение «стебель / cap» делит
начертания надёжнее глаза.

  Regular < 0.145 ≤ Medium < 0.168 ≤ Semibold < 0.192 ≤ Bold

Толщина стебля — мода длин горизонтальных отрезков чернил внутри литеры: строка
пересекает вертикальный штрих ровно на его толщине, и мода устойчива к
скруглениям и антиалиасингу.

Что нашлось на 837 строках пяти продуктов (раздел 5.21): весов ровно четыре,
Regular держит 59 %; один и тот же кегль несёт разный вес — выделение делается
штрихом, а не размером; серый у Apple с синим подтоном, а не нейтральный.

Оговорка, записанная в 5.21: перевод cap → кегль остаётся приблизительным,
потому что мода высокого кластера ловит и выносные. Классы сравнимы между
собой; абсолютный кегль по этому замеру называть нельзя.

Запуск:

    python3 tools/ios26-textcensus.py /tmp/apple_id.pdf
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
CAP_RATIO = 0.705






def frames(pdf):
    d = fitz.open(pdf)
    for p in range(d.page_count):
        im = d[p].get_images(full=True)
        raw = d.extract_image(im[0][0])["image"]
        yield p + 1, np.array(Image.open(io.BytesIO(raw)).convert("RGB")).astype(int)
    d.close()


def hexc(c):
    return "#%02X%02X%02X" % tuple(int(v) for v in c)


def lines(A, y0, y1, x0, x1, thr, gap=6):
    m = A[y0:y1, x0:x1].max(2) > thr
    rows = np.where(m.mean(1) > 0.004)[0]
    out, run = [], None
    for y in rows:
        if run is None:
            run = [y, y]
        elif y - run[1] <= gap:
            run[1] = y
        else:
            out.append((run[0] + y0, run[1] + y0))
            run = [y, y]
    if run:
        out.append((run[0] + y0, run[1] + y0))
    return [(a, b) for a, b in out if 8 <= b - a <= 130]


def measure_line(A, top, bot, x0, x1, thr):
    """Кегль по моде высот литер, вес по моде толщины штриха, цвет по ядру."""
    band = A[top:bot + 1, x0:x1]
    m = band.max(2) > thr
    if m.sum() < 60:
        return None
    # литеры: связные области по колонкам
    cols = np.where(m.any(0))[0]
    runs, s, p = [], cols[0], cols[0]
    for x in cols[1:]:
        if x - p > 2:
            runs.append((s, p))
            s = x
        p = x
    runs.append((s, p))
    H = []
    for a, b in runs:
        if not (3 <= b - a + 1 <= 40):
            continue
        ys = np.where(m[:, a:b + 1].any(1))[0]
        if len(ys):
            H.append(int(ys[-1] - ys[0] + 1))
    if len(H) < 3:
        return None
    vals, cnt = np.unique(H, return_counts=True)
    med = int(np.median(H))
    hi = vals[vals > med]
    cap = max(((cnt[list(vals).index(v)], v) for v in hi), default=(0, med))[1] if len(hi) else med
    # толщина штриха: мода длин горизонтальных отрезков чернил
    widths = []
    for r in range(m.shape[0]):
        row = m[r]
        if not row.any():
            continue
        i = 0
        while i < len(row):
            if row[i]:
                j = i
                while j < len(row) and row[j]:
                    j += 1
                if 1 <= j - i <= 14:
                    widths.append(j - i)
                i = j
            else:
                i += 1
    if len(widths) < 20:
        return None
    stem = Counter(widths).most_common(1)[0][0]
    # цвет ядра
    lum = band.max(2)
    core = band[lum >= np.percentile(lum[lum > thr], 80)]
    return dict(cap=cap, stem=stem, ratio=round(stem / cap, 3),
                color=hexc(np.median(core, 0)), n_glyphs=len(H))


def census(pdf, thr=95):
    out = []
    for p, A in frames(pdf):
        H, W, _ = A.shape
        sc = H / REF_H
        for top, bot in lines(A, int(H * 0.07), int(H * 0.93), 30, W - 30, thr):
            r = measure_line(A, top, bot, 30, W - 30, thr)
            if r:
                r.update(page=p, y=round(top / sc, 1),
                         cap_pt=round(r["cap"] / sc, 2),
                         size_pt=round(r["cap"] / sc / CAP_RATIO, 1),
                         stem_pt=round(r["stem"] / sc, 2))
                out.append(r)
    return out


def weight_class(ratio):
    if ratio < 0.145:
        return "Regular"
    if ratio < 0.168:
        return "Medium"
    if ratio < 0.192:
        return "Semibold"
    return "Bold"


def main() -> int:
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    rows = []
    for pdf in sys.argv[1:]:
        rows += census(pdf)
    print(f"строк измерено: {len(rows)}")
    c = Counter((r["cap_pt"], weight_class(r["ratio"])) for r in rows)
    print(f"\n{'cap, pt':>8s}  {'вес':<9s} строк")
    for (cap, w), n in sorted(c.items(), key=lambda kv: -kv[1]):
        if n >= 3:
            print(f"{cap:8.2f}  {w:<9s} {n}")
    print("\nвеса:", Counter(weight_class(r["ratio"]) for r in rows).most_common())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
