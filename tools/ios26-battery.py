#!/usr/bin/env python3
"""
СВОДНАЯ БАТАРЕЯ — одна и та же мерка по всем кадрам продукта.

Зачем. Десять продуктов, обмеренных десятью разными руками, дают десять
несравнимых таблиц: спор между ними потом не решается ничем, кроме памяти. Этот
стенд гоняет по каждому кадру ОДИН набор замеров — поверхности, карточка, угол,
разделитель, шаг строки, акцент, — поэтому числа разных продуктов можно класть
рядом. Разнобой в результате принадлежит Apple, а не методам.

Три решения, без которых стенд врёт:

1. Край берётся по материалу (порог 50 %), а не по яркости — раздел 0 стандарта
   объясняет, чего стоила обратная привычка: три испорченных числа за день.
2. Угол подгоняется ДВУМЯ моделями сразу, дугой и суперэллипсом, и печатаются
   ошибки обеих. Модель без соперника ничего не доказывает.
3. Акцент берётся ТОЛЬКО из хрома — полоса шапки и нижний слой. По всему кадру
   мерить нельзя: в витрине обложка заливает экран насыщенным цветом, и замер
   покажет акцент постера, а не приложения.

Мастера в дерево не возвращаем (ЗКН-Ф025):

    python3 tools/assets/offload.py restore --class ios26-refs
    python3 tools/assets/offload.py restore --class ios26-refs-2

Запуск:

    python3 tools/ios26-battery.py /tmp/apple_notes.pdf

Результат 19.07.2026 по всем 217 кадрам записан в разделы 4.2 и 5.19: угол —
суперэллипс n = 2.5–2.6 на девяти продуктах из девяти, акцент у каждого свой,
разделитель 1.0 pt `#38383A`, модальный шаг строки 49.0 pt.
"""
import io
import json
import math
import statistics as st
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
        if im:
            raw = d.extract_image(im[0][0])["image"]
            A = np.array(Image.open(io.BytesIO(raw)).convert("RGB")).astype(int)
        else:
            pm = d[p].get_pixmap(dpi=216)
            A = np.array(Image.frombytes("RGB", (pm.width, pm.height), pm.samples)).astype(int)
        yield p + 1, A
    d.close()


def hexc(c):
    return "#%02X%02X%02X" % tuple(int(v) for v in c)


def canvas_of(A):
    return np.median(A[int(A.shape[0] * 0.45):int(A.shape[0] * 0.5), 5:25].reshape(-1, 3), 0)


def surfaces(A, min_run=600):
    """Поверхности: длинные однородные прогоны по строке — холст, карточка, лист."""
    H, W, _ = A.shape
    out = Counter()
    for y in range(int(H * 0.12), int(H * 0.92), 12):
        row = A[y]
        x = 0
        while x < W - 1:
            c = row[x]
            run = 1
            while x + run < W and abs(row[x + run] - c).max() <= 1:
                run += 1
            if run >= min_run:
                out[tuple(int(v) for v in c)] += run
            x += run
    return out


def cards(A):
    """Карточки: однородная заливка шириной ≥1000 px, темнее 260 по сумме, на холсте."""
    H, W, _ = A.shape
    seen, out = set(), []
    for y in range(int(H * 0.12), int(H * 0.90), 16):
        c = A[y, 48]
        if not (30 < c.sum() < 300):
            continue
        run = 1
        while 48 + run < W and abs(A[y, 48 + run] - c).max() <= 1:
            run += 1
        if run < 1000:
            continue
        xc = 48 + run // 2
        yt = y
        while yt > 1 and abs(A[yt - 1, xc] - c).max() <= 40 and A[yt - 1, xc].sum() > 25:
            yt -= 1
        if A[yt - 1, xc].sum() > 60:
            continue
        yb = y
        while yb < H - 1 and abs(A[yb + 1, xc] - c).max() <= 40 and A[yb + 1, xc].sum() > 25:
            yb += 1
        if (yt, tuple(c)) in seen or yb - yt < 120:
            continue
        seen.add((yt, tuple(c)))
        xs = [x for x in range(W) if abs(A[y, x] - c).max() <= 1]
        out.append(dict(top=yt, bot=yb, left=xs[0], right=xs[-1], fill=tuple(int(v) for v in c)))
    return out


def corner_fit(A, top, left, fill, depth=150):
    cv = A[max(top - 12, 0), max(left - 14, 0)].astype(float)
    f = np.array(fill, float)
    den = (f - cv).sum()
    if abs(den) < 20:
        return None
    prof = []
    for d in range(depth):
        y = top + d
        if y >= A.shape[0]:
            break
        for x in range(max(left - 8, 0), left + depth + 40):
            a0 = (A[y, x] - cv).sum() / den
            a1 = (A[y, x + 1] - cv).sum() / den
            if a0 < 0.5 <= a1:
                prof.append((d, x + (0.5 - a0) / max(a1 - a0, 1e-6) - left))
                break
    D = [(d, o) for d, o in prof if 1 <= d <= 75 and o >= 0]
    if len(D) < 20:
        return None

    def ec(R):
        return sum(((R - math.sqrt(max(0, 2 * R * d - d * d)) if d < R else 0.0) - o) ** 2 for d, o in D) / len(D)

    def es(R, n):
        e = 0.0
        for d, o in D:
            p = 0.0 if d >= R else R - R * max(0, 1 - ((R - d) / R) ** n) ** (1 / n)
            e += (p - o) ** 2
        return e / len(D)

    Rc = min(np.arange(30, 160, 0.5), key=ec)
    best = min(((es(R, n), R, n) for R in np.arange(30, 170, 2.0) for n in np.arange(1.8, 6.1, 0.1)))
    return dict(Rc=Rc / 3, rc=math.sqrt(ec(Rc)), Rs=best[1] / 3, n=best[2], rs=math.sqrt(best[0]))


def separators(A, card):
    """Разделители внутри карточки: строка ярче заливки почти на всю ширину."""
    fill = np.array(card["fill"], float)
    xa, xb = card["left"] + 120, card["right"] - 60
    if xb - xa < 200:
        return []
    rows = []
    for y in range(card["top"] + 6, card["bot"] - 5):
        r = A[y, xa:xb]
        if ((r.sum(1) > fill.sum() + 30) & (r.sum(1) < fill.sum() + 170)).mean() > 0.95:
            rows.append(y)
    out, run = [], None
    for y in rows:
        if run is None:
            run = [y, y]
        elif y - run[1] <= 1:
            run[1] = y
        else:
            out.append(run)
            run = [y, y]
    if run:
        out.append(run)
    res = []
    for a, b in out:
        xs = [x for x in range(card["left"], card["right"]) if A[(a + b) // 2, x].sum() > fill.sum() + 30]
        res.append(dict(top=a, h=b - a + 1, color=tuple(int(v) for v in A[(a + b) // 2, (xa + xb) // 2]),
                        left=xs[0] if xs else None, right=xs[-1] if xs else None))
    return res


def chrome_accent(A):
    """Акцент берётся ТОЛЬКО из хрома — шапка и нижний слой.

    В витрине (TV, App Store, Music) обложки заливают кадр насыщенным цветом и
    любой замер «по всему кадру» показывает акцент постера, а не приложения.
    """
    H, W, _ = A.shape
    band = np.vstack([A[177:309].reshape(-1, 3), A[H - 260:H - 40].reshape(-1, 3)])
    sat = band.max(1) - band.min(1)
    m = (sat > 55) & (band.max(1) > 120)
    if m.sum() < 200:
        return None, 0
    px = band[m]
    q = (px // 6 * 6)
    k, c = np.unique(q, axis=0, return_counts=True)
    return hexc(k[c.argmax()]), int(m.sum())


def analyse(pdf, name):
    S = Counter()
    corners, seps, pitches, accents, cardgeom = [], [], [], [], []
    for p, A in frames(pdf):
        s = A.shape[0] / REF_H
        S.update(surfaces(A))
        for cd in cards(A)[:2]:
            fit = corner_fit(A, cd["top"], cd["left"], cd["fill"]) if len(corners) < 25 else None
            if fit and fit["rs"] < 2.0:
                corners.append((fit["Rc"], fit["rc"], fit["Rs"], fit["n"], fit["rs"], p))
            cardgeom.append((cd["left"] / s, (cd["right"] - cd["left"] + 1) / s, cd["fill"]))
            sp = separators(A, cd)
            tops = [x["top"] for x in sp]
            for i in range(len(tops) - 1):
                pitches.append(round((tops[i + 1] - tops[i]) / s, 2))
            for x in sp:
                if x["left"] is not None:
                    seps.append((x["h"] / s, hexc(x["color"]), x["left"] / s))
        a, n = chrome_accent(A)
        if a:
            accents.append((a, n))
    return dict(name=name, surfaces=S, corners=corners, seps=seps,
                pitches=pitches, accents=accents, cardgeom=cardgeom)


def report(pdf):
    r = analyse(pdf, pdf)
    print("поверхности:", "  ".join(f"{hexc(c)}:{v // 1000}k" for c, v in r["surfaces"].most_common(6)))
    if r["cardgeom"]:
        print(f"карточка: врезка={st.median([g[0] for g in r['cardgeom']]):.2f}pt "
              f"ширина={st.median([g[1] for g in r['cardgeom']]):.2f}pt "
              f"заливка={Counter(hexc(g[2]) for g in r['cardgeom']).most_common(2)}")
    if r["corners"]:
        print(f"угол: дуга R={st.median([c[0] for c in r['corners']]):.2f}pt "
              f"RMSE={st.median([c[1] for c in r['corners']]):.2f} | "
              f"суперэллипс R={st.median([c[2] for c in r['corners']]):.2f}pt "
              f"n={st.median([c[3] for c in r['corners']]):.2f} "
              f"RMSE={st.median([c[4] for c in r['corners']]):.2f}  ({len(r['corners'])} подгонок)")
    if r["seps"]:
        print(f"разделитель: h={st.median([s[0] for s in r['seps']]):.2f}pt "
              f"цвет={Counter(s[1] for s in r['seps']).most_common(2)} "
              f"врезка={st.median([s[2] for s in r['seps']]):.2f}pt  ({len(r['seps'])} замеров)")
    if r["pitches"]:
        print("шаг строки:", Counter(r["pitches"]).most_common(4))
    if r["accents"]:
        print("акцент хрома:", Counter(a for a, _ in r["accents"]).most_common(3))


def main() -> int:
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    for pdf in sys.argv[1:]:
        print("=" * 60)
        print(pdf)
        report(pdf)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
