#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
АНАТОМИЯ КАДРА — поэлементный обмер одного экрана эталона под мокап.

Батарея (`ios26-battery.py`) отвечает на вопрос «какие числа у продукта в целом».
Здесь вопрос другой и более узкий: **из чего сложен ровно этот экран и по каким
координатам**, чтобы мокап можно было собрать не на глаз, а по адресам.

Метод подчинён дисциплине раздела 0 стандарта:

1. Край берётся по МАТЕРИАЛУ: порог 50 % между двумя заливками, с долей пикселя
   (`edge_sub`). По яркости края не берутся — это стоило трёх чисел за день.
2. Признак элемента — его СОБСТВЕННОЕ свойство: полоса ищется по однородной
   заливке и длине прогона, разделитель — по толщине и контрасту с карточкой,
   текст — по отклонению от локального фона. Координаты не угадываются.
3. Угол подгоняется ДВУМЯ моделями (дуга и суперэллипс), печатаются обе ошибки.
4. Чего не нашли — печатаем пусто, а не подставляем ожидаемое.

Вывод — в точках (pt = px / 3 при @3x), с двумя знаками: шаг CSS равен 1/3 pt.

Запуск:
    python3 tools/ios26-frame.py <кадр.png|pdf> [номер_страницы] [--json]
"""
import io
import json
import math
import sys
from collections import Counter

import numpy as np

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    sys.exit("нужен Pillow: pip install pillow")

S = 3.0  # @3x


def pt(px):
    return round(px / S, 2)


def hexc(c):
    return "#%02X%02X%02X" % tuple(int(round(v)) for v in c)


def load(path, page=1):
    if path.lower().endswith(".pdf"):
        import fitz
        d = fitz.open(path)
        imgs = d[page - 1].get_images(full=True)
        raw = d.extract_image(imgs[0][0])["image"]
        im = Image.open(io.BytesIO(raw)).convert("RGB")
        d.close()
    else:
        im = Image.open(path).convert("RGB")
    return np.array(im).astype(int)


# ─────────────────────────── края по материалу ───────────────────────────

def edge_sub(a, b, mid):
    """Доля пикселя на границе двух заливок a→b по значению переходного mid."""
    a, b, mid = np.asarray(a, float), np.asarray(b, float), np.asarray(mid, float)
    d = b - a
    k = np.abs(d) > 4
    if not k.any():
        return 0.5
    f = ((mid - a)[k] / d[k])
    return float(np.clip(np.median(f), 0.0, 1.0))


def hedges(A, y, x0, x1, fill, bg):
    """Левый/правый край полосы заливки fill на фоне bg в строке y, в px с долей."""
    row = A[y]
    L = R = None
    for x in range(x0, x1):
        if np.abs(row[x] - fill).max() <= 2:
            L = x
            break
    if L is None:
        return None, None
    for x in range(x1 - 1, x0 - 1, -1):
        if np.abs(row[x] - fill).max() <= 2:
            R = x
            break
    lf = edge_sub(bg, fill, row[L - 1]) if L > 0 else 1.0
    rf = edge_sub(bg, fill, row[R + 1]) if R + 1 < A.shape[1] else 1.0
    return L - lf, R + rf + 1.0   # [левый край, правый край) в px


# ─────────────────────────── полосы материала ───────────────────────────

def bands(A, min_run=900, y0=None, y1=None):
    """Горизонтальные полосы однородной заливки: (y_top, y_bot, fill, x_l, x_r)."""
    H, W, _ = A.shape
    y0 = 0 if y0 is None else y0
    y1 = H if y1 is None else y1
    prof = []
    for y in range(y0, y1):
        row = A[y]
        best, x = None, 0
        while x < W:
            c = row[x]
            r = 1
            while x + r < W and np.abs(row[x + r] - c).max() <= 1:
                r += 1
            if r >= min_run and (best is None or r > best[0]):
                best = (r, x, tuple(int(v) for v in c))
            x += r
        prof.append(best)
    out, i = [], 0
    while i < len(prof):
        if prof[i] is None:
            i += 1
            continue
        c = prof[i][2]
        j = i
        while j + 1 < len(prof) and prof[j + 1] is not None and prof[j + 1][2] == c:
            j += 1
        if j - i >= 1:
            xs = [prof[k][1] for k in range(i, j + 1)]
            rs = [prof[k][0] for k in range(i, j + 1)]
            out.append(dict(y0=y0 + i, y1=y0 + j + 1, fill=c,
                            xl=int(np.median(xs)), xr=int(np.median(xs)) + int(np.median(rs))))
        i = j + 1
    return out


def canvas_of(A):
    H = A.shape[0]
    reg = A[int(H * .40):int(H * .60), 2:14].reshape(-1, 3)
    return tuple(int(v) for v in np.median(reg, 0))


# ─────────────────────────── разделители ───────────────────────────

def separators(A, xl, xr, y0, y1, fill, maxth=9, minfrac=0.5):
    """Разделители внутри карточки.

    Признак — СОБСТВЕННОЕ свойство линии: непрерывный прогон одного цвета вдоль x
    длиной не меньше половины карточки. Раньше признаком была «строка, отличная от
    заливки» — и в разделители попадал каждый ряд букв: текст тоже отличается от
    заливки и тоже тянется широко, только прерывисто. Провал записан здесь, чтобы
    следующий заход не повторил: прерывистость и есть отличие буквы от линии.
    """
    out = []
    W = xr - xl
    fillv = np.asarray(fill, float)
    y = y0
    while y < y1:
        row = A[y, xl:xr]
        d = np.abs(row - fillv).max(axis=1)
        if d.max() <= 3:
            y += 1
            continue
        # самый длинный прогон одного цвета, отличного от заливки
        best = (0, None)
        x = 0
        while x < W:
            c = row[x]
            if np.abs(c - fillv).max() <= 3:
                x += 1
                continue
            r = 1
            while x + r < W and np.abs(row[x + r] - c).max() <= 3:
                r += 1
            if r > best[0]:
                best = (r, x, tuple(int(v) for v in c))
            x += r
        if best[0] >= W * minfrac:
            run, x0, col = best
            t = 1
            while y + t < y1 and np.abs(A[y + t, xl + x0 + run // 2] - np.asarray(col, float)).max() <= 3:
                t += 1
            if t <= maxth:
                out.append(dict(y=y, th=t, col=col, inset_l=x0, inset_r=W - (x0 + run)))
            y += t
        else:
            y += 1
    return out


# ─────────────────────────── текст ───────────────────────────

def textrows(A, xl, xr, y0, y1, bg, thr=45, gap=4):
    """Полосы текста: непрерывные y, где есть отклонение от фона."""
    sub = A[y0:y1, xl:xr]
    bg = np.asarray(bg, float)
    dev = np.abs(sub - bg).max(axis=2)
    hit = (dev > thr).sum(axis=1)
    rows, cur = [], None
    for i, h in enumerate(hit):
        if h > 0:
            cur = [i, i] if cur is None else [cur[0], i]
        else:
            if cur is not None and i - cur[1] > gap:
                rows.append(cur)
                cur = None
    if cur is not None:
        rows.append(cur)
    out = []
    for a, b in rows:
        m = dev[a:b + 1] > thr
        cols = np.where(m.any(axis=0))[0]
        if not len(cols):
            continue
        px = sub[a:b + 1][m]
        out.append(dict(y0=y0 + a, y1=y0 + b + 1, x0=xl + int(cols[0]), x1=xl + int(cols[-1]) + 1,
                        col=hexc(np.percentile(px, 90, axis=0))))
    return out


def ink_profile(A, x0, x1, y0, y1, bg, thr=45):
    """Метрики строки текста: верх прописной, верх строчной, база, низ выносного.

    Кегль замером не берётся — берётся cap-height (5.21). Разделение уровней идёт
    по СКАЧКУ количества чернил по строкам: у прописной ink малый (одна-две буквы),
    у строчной резко больше, ниже базы — снова малый (выносные). Признак — сам
    профиль, не ожидаемая пропорция шрифта.
    """
    sub = A[y0:y1, x0:x1]
    dev = np.abs(sub - np.asarray(bg, float)).max(axis=2)
    ink = (dev > thr).sum(axis=1).astype(float)
    if ink.max() == 0:
        return None
    n = ink / ink.max()
    rows = np.where(n > 0.02)[0]
    top, bot = int(rows[0]), int(rows[-1])
    hi = np.where(n > 0.45)[0]
    xtop, base = (int(hi[0]), int(hi[-1])) if len(hi) else (top, bot)
    return dict(top=top + y0, xtop=xtop + y0, base=base + y0 + 1, bot=bot + y0 + 1,
                cap=(base + 1) - xtop, prof=[round(float(v), 2) for v in n])


# ─────────────────────────── угол ───────────────────────────

def corner_fit(A, xl, yt, fill, bg, r=120):
    """Верхне-левый угол: граница по МАТЕРИАЛУ (порог 50 %), затем две модели.

    Граница ищется не «первым пикселем точного цвета» — так кривая уезжает внутрь
    на ширину антиалиасного пояска и обе модели садятся одинаково плохо. Берётся
    доля материала f(x) ∈ [0,1] и точка пересечения f = 0.5 с линейной вставкой.
    Дуга и суперэллипс подгоняются вместе: модель без соперника ничего не доказывает.
    """
    fill = np.asarray(fill, float)
    bg = np.asarray(bg, float)
    H, W, _ = A.shape
    x0, y0 = int(round(xl)), int(round(yt))
    pts = []
    for dy in range(0, r):
        y = y0 + dy
        if y >= H:
            break
        prev = None
        for dx in range(-3, r):
            x = x0 + dx
            if x < 0 or x >= W:
                continue
            f = edge_sub(bg, fill, A[y, x])
            if prev is not None and prev[1] < 0.5 <= f:
                t = (0.5 - prev[1]) / max(1e-6, f - prev[1])
                pts.append((prev[0] + t, dy))
                break
            prev = (dx, f)
    if len(pts) < 24:
        return None
    R = max(p[0] for p in pts) - min(p[0] for p in pts)
    if R < 4:
        return None
    base = min(p[0] for p in pts)

    def rmse(n):
        e = []
        for dx, dy in pts:
            if dy > R:
                continue
            u = 1.0 - (max(0.0, R - dy) / R) ** n
            e.append((R - (dx - base)) - R * (max(0.0, u) ** (1.0 / n)))
        return math.sqrt(sum(v * v for v in e) / max(1, len(e)))

    cand = [(float(n), rmse(float(n))) for n in np.arange(1.6, 6.01, 0.05)]
    best = min(cand, key=lambda t: t[1])
    return dict(R=R, arc_rmse=round(rmse(2.0), 3), n=round(best[0], 2),
                se_rmse=round(best[1], 3), pts=len(pts))


# ─────────────────────────── области заливки ───────────────────────────

def regions(A, cv, min_area_px=9000, tol=5, topn=12):
    """Связные области однородной заливки: бокс с долей пикселя, площадь, цвет.

    Признак — СОБСТВЕННАЯ заливка области, не координата и не окружение.
    JPEG уводит значение на ±2 по каналу, поэтому близкие цвета сливаются
    в одно семейство (tol), иначе одна карточка распадается на десяток «областей».
    Края уточняются по материалу (порог 50 %), а не по границе точного совпадения:
    антиалиасный поясок иначе теряется и карточка выходит на 2/3 pt уже.
    """
    from scipy import ndimage
    H, W, _ = A.shape
    flat = (A[:, :, 0].astype(np.int64) << 16) | (A[:, :, 1].astype(np.int64) << 8) | A[:, :, 2]
    vals, cnts = np.unique(flat, return_counts=True)
    order = np.argsort(-cnts)
    fams = []
    for i in order[:400]:
        if cnts[i] < min_area_px // 3:
            break
        v = int(vals[i])
        col = np.array([(v >> 16) & 255, (v >> 8) & 255, v & 255])
        if np.abs(col - np.asarray(cv)).max() <= tol:
            continue
        if any(np.abs(col - f).max() <= tol for f in fams):
            continue
        fams.append(col)
        if len(fams) >= 18:
            break
    out = []
    for col in fams:
        m = (np.abs(A - col).max(axis=2) <= tol)
        lab, n = ndimage.label(m)
        if n == 0:
            continue
        areas = ndimage.sum(m, lab, range(1, n + 1))
        for k, sl in enumerate(ndimage.find_objects(lab)):
            if areas[k] < min_area_px:
                continue
            ys, xs = sl
            yc, xc = (ys.start + ys.stop) // 2, (xs.start + xs.stop) // 2
            box = refine_box(A, col, cv, xs.start, xs.stop, ys.start, ys.stop, xc, yc)
            out.append(dict(fill=hexc(col), area=int(areas[k]), **box,
                            fillpct=round(100.0 * areas[k] / ((xs.stop - xs.start) * (ys.stop - ys.start)), 1)))
    out.sort(key=lambda r: -r["area"])
    ded = []
    for r in out:
        if any(abs(r["x0"] - q["x0"]) < 4 and abs(r["y0"] - q["y0"]) < 4 and
               abs(r["x1"] - q["x1"]) < 4 and abs(r["y1"] - q["y1"]) < 4 for q in ded):
            continue
        ded.append(r)
    return ded[:topn]


def refine_box(A, fill, bg, x0, x1, y0, y1, xc, yc):
    """Края бокса по материалу: субпиксельная доля на переходе заливка↔фон."""
    H, W, _ = A.shape
    fill = np.asarray(fill, float)
    def scan(axis, start, step, limit):
        p = start
        while 0 <= p + step < limit:
            c = A[p + step, xc] if axis == 0 else A[yc, p + step]
            if np.abs(c - fill).max() > 5:
                nb = A[p + step, xc] if axis == 0 else A[yc, p + step]
                f = edge_sub(nb, fill, (A[p, xc] if axis == 0 else A[yc, p]))
                return p + (0.0 if step > 0 else 1.0) + step * 0.0, nb
            p += step
        return p, None
    yt = y0
    while yt > 0 and np.abs(A[yt - 1, xc] - fill).max() <= 5:
        yt -= 1
    yb = y1 - 1
    while yb < H - 1 and np.abs(A[yb + 1, xc] - fill).max() <= 5:
        yb += 1
    xl = x0
    while xl > 0 and np.abs(A[yc, xl - 1] - fill).max() <= 5:
        xl -= 1
    xr = x1 - 1
    while xr < W - 1 and np.abs(A[yc, xr + 1] - fill).max() <= 5:
        xr += 1
    ft = edge_sub(A[yt - 1, xc], fill, A[yt - 1, xc]) if yt > 0 else 0.0
    # доля пикселя: сколько материала в соседнем переходном пикселе
    def frac(nb):
        return edge_sub(np.asarray(bg, float), fill, np.asarray(nb, float))
    top = yt - (frac(A[yt - 1, xc]) if yt > 0 else 0.0)
    bot = yb + 1 + (frac(A[yb + 1, xc]) if yb < H - 1 else 0.0)
    lef = xl - (frac(A[yc, xl - 1]) if xl > 0 else 0.0)
    rig = xr + 1 + (frac(A[yc, xr + 1]) if xr < W - 1 else 0.0)
    return dict(x0=lef, x1=rig, y0=top, y1=bot)


# ─────────────────────────── отчёт ───────────────────────────

def report(A, deep=False):
    H, W, _ = A.shape
    cv = canvas_of(A)
    o = dict(size_pt=[pt(W), pt(H)], canvas=hexc(cv), regions=[], detail=[])
    print(f"кадр {W}×{H} px = {pt(W)}×{pt(H)} pt   холст {hexc(cv)}")
    print()
    rs = regions(A, cv)
    print("ОБЛАСТИ ЗАЛИВКИ (связные, ≥9000 px, края по материалу)")
    print(f"{'x':>7} {'y':>7} {'w':>7} {'h':>7} | {'запол':>6} | заливка")
    for r in rs:
        rec = dict(x=pt(r["x0"]), y=pt(r["y0"]), w=pt(r["x1"] - r["x0"]),
                   h=pt(r["y1"] - r["y0"]), fill=r["fill"], fillpct=r["fillpct"])
        o["regions"].append(rec)
        print(f"{rec['x']:>7} {rec['y']:>7} {rec['w']:>7} {rec['h']:>7} | "
              f"{rec['fillpct']:>5}% | {rec['fill']}")
    if not deep:
        return o
    print()
    print("ВНУТРИ ОБЛАСТЕЙ")
    for r in rs[:8]:
        xl, xr = int(math.ceil(r["x0"])) + 1, int(r["x1"]) - 1
        yt, yb = int(math.ceil(r["y0"])) + 1, int(r["y1"]) - 1
        if xr - xl < 60 or yb - yt < 30:
            continue
        fill = [int(r["fill"][i:i + 2], 16) for i in (1, 3, 5)]
        print(f"\n— область {r['fill']} @ {pt(r['x0'])},{pt(r['y0'])} "
              f"{pt(r['x1']-r['x0'])}×{pt(r['y1']-r['y0'])}")
        cf = corner_fit(A, r["x0"], r["y0"], fill, cv)
        if cf:
            print(f"  угол: R={pt(cf['R'])} pt · дуга RMSE={cf['arc_rmse']} px · "
                  f"суперэллипс n={cf['n']} RMSE={cf['se_rmse']} px")
        sp = separators(A, xl, xr, yt, yb, fill)
        for q in sp:
            print(f"  разделитель y={pt(q['y'])} т={pt(q['th'])} {hexc(q['col'])} "
                  f"врезка {pt(q['inset_l'])}/{pt(q['inset_r'])}")
        for t in textrows(A, xl, xr, yt, yb, fill):
            print(f"  текст y={pt(t['y0'])}…{pt(t['y1'])} cap={pt(t['y1']-t['y0'])} "
                  f"x={pt(t['x0'])}…{pt(t['x1'])} w={pt(t['x1']-t['x0'])} {t['col']}")
    print("\n— на холсте")
    cvv = list(cv)
    used = [(int(r["y0"]), int(r["y1"])) for r in rs]
    for t in textrows(A, 0, W, 0, H, cvv):
        if any(a - 2 <= t["y0"] and t["y1"] <= b + 2 for a, b in used):
            continue
        print(f"  текст y={pt(t['y0'])}…{pt(t['y1'])} cap={pt(t['y1']-t['y0'])} "
              f"x={pt(t['x0'])}…{pt(t['x1'])} w={pt(t['x1']-t['x0'])} {t['col']}")
    return o


if __name__ == "__main__":
    a = [x for x in sys.argv[1:] if not x.startswith("--")]
    A = load(a[0], int(a[1]) if len(a) > 1 else 1)
    o = report(A, deep="--deep" in sys.argv)
    if "--json" in sys.argv:
        print(json.dumps(o, ensure_ascii=False))
