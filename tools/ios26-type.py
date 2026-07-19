#!/usr/bin/env python3
"""
ЗАМЕР КЕГЛЯ ПО КАДРУ — cap-height, а не «на глаз по окну».

Зачем отдельный инструмент. Роспись Notes упёрлась не в кадры, а в способ
мерить: высота заглавной снималась прямоугольным окном, которое я задавал
руками. Окно то захватывало соседнюю иконку (и «строка папки» вышла 48 px
вместо 43), то срезало букву сверху, то ловило половину стебля вместо целой литеры.
Три замера из тринадцати пришлось выбросить, а два — записать долгом.

Прямоугольник — неверная единица. Верная единица — САМА ЛИТЕРА: связная
область чернил между пустыми колонками. Её границы задаёт кадр, а не рука.

Правило, по которому берётся заглавная: у подписи вида «Pinned», «Accounts»,
«Shared Notes», «Edit» первая литера — заглавная. Значит берём ПЕРВУЮ связную
область строки правее заданного края текста (край нужен, чтобы не считать
иконку слева за букву). Правило детерминировано и воспроизводится.

Кегль здесь НИКОГДА не 📐. Apple не подписывает кегль в кадре; замер — это
cap-height, а перевод в кегль — вывод ⚙️ при cap/кегль = 0.705 (SF Pro).
Инструмент печатает и то и другое раздельно, чтобы их не путали.

Мастера в дерево не возвращаем (ЗКН-Ф025):

    python3 tools/assets/offload.py restore --class ios26-refs-2

Запуск:

    python3 tools/ios26-type.py /tmp/apple_notes.pdf 9              # все строки кадра
    python3 tools/ios26-type.py /tmp/apple_notes.pdf 9 --from-x 133 # текст правее иконки
    python3 tools/ios26-type.py /tmp/apple_notes.pdf 9 --band 600 660
"""
import argparse
import io
import sys

import numpy as np

try:
    import fitz  # PyMuPDF
    from PIL import Image
except ImportError:  # pragma: no cover
    sys.exit("нужны PyMuPDF и Pillow: pip install pymupdf pillow")

CAP_RATIO = 0.705  # cap-height / кегль у SF Pro


def frame(pdf, page):
    """Кадр в исходном разрешении: встроенный JPEG, а не пересчёт страницы."""
    d = fitz.open(pdf)
    pg = d[page - 1]
    imgs = pg.get_images(full=True)
    if imgs:
        raw = d.extract_image(imgs[0][0])["image"]
        A = np.array(Image.open(io.BytesIO(raw)).convert("RGB")).astype(int)
    else:
        pm = pg.get_pixmap(dpi=216)
        A = np.array(Image.frombytes("RGB", (pm.width, pm.height), pm.samples)).astype(int)
    d.close()
    return A


def text_lines(A, y0, y1, x0, x1, thr=90, gap=6):
    """Строки текста: разрывы в профиле чернил по вертикали."""
    m = A[y0:y1, x0:x1].max(2) > thr
    rows = np.where(m.mean(1) > 0.002)[0]
    out, run = [], None
    for i, y in enumerate(rows):
        if run is None:
            run = [y, y]
        elif y - run[1] <= gap:
            run[1] = y
        else:
            out.append((run[0] + y0, run[1] + y0))
            run = [y, y]
    if run:
        out.append((run[0] + y0, run[1] + y0))
    return [(a, b) for a, b in out if b - a >= 6]


def glyphs(A, top, bot, x0, x1, thr=90, gap=2):
    """Связные области чернил по колонкам — литеры строки, слева направо."""
    m = A[top:bot + 1, x0:x1].max(2) > thr
    cols = np.where(m.any(0))[0]
    out, run = [], None
    for x in cols:
        if run is None:
            run = [x, x]
        elif x - run[1] <= gap:
            run[1] = x
        else:
            out.append(run)
            run = [x, x]
    if run:
        out.append(run)
    res = []
    for a, b in out:
        sub = m[:, a:b + 1]
        ys = np.where(sub.any(1))[0]
        res.append(dict(x0=a + x0, x1=b + x0, w=b - a + 1,
                        top=top + int(ys[0]), bot=top + int(ys[-1]),
                        h=int(ys[-1] - ys[0] + 1)))
    return res


def first_capital(gl, from_x, min_w=8, max_w=90):
    """Первая литера правее края текста. Узкие огрызки и широкие плашки — мимо."""
    for g in gl:
        if g["x0"] >= from_x and min_w <= g["w"] <= max_w:
            return g
    return None


def cluster_cap(A, y0, y1, x0, x1, thr=90, scale=3.0):
    """Кегль панели по МОДЕ, а не по первой литере строки.

    В меню строка устроена сложнее подписи: слева знак, справа галочка, между
    ними текст. «Первая связная область правее края» ловит там знак (42x42 px)
    и выдаёт кегль 20 pt вместо 14 — так и вышло при первом заходе.

    Литеры, в отличие от знаков, кучкуются: высоты собираются в две горки —
    строчные (x-height) и заглавные с выносными (cap). Знак в такую горку не
    попадает, он одиночка. Поэтому берём моду верхней горки по ВСЕЙ панели.

    Условие применимости: в полосе один кегль. Если смешать заголовок строки
    с подписью под ним, мода назовёт тот, которого больше, и будет неправа.
    """
    H = []
    for top, bot in text_lines(A, y0, y1, x0, x1, thr=thr):
        if bot - top > 60:      # двухстрочный пункт — не литера
            continue
        for g in glyphs(A, top, bot, x0, x1, thr=thr):
            if 4 <= g["w"] <= 40 and 8 <= g["h"] <= 60:
                H.append(g["h"])
    if not H:
        print("литер не нашлось — проверь полосу и порог")
        return None
    H = np.array(H)
    vals, cnt = np.unique(H, return_counts=True)
    med = int(np.median(H))
    def mode_of(sub):
        pairs = [(cnt[list(vals).index(v)], v) for v in sub]
        return max(pairs)[1] if pairs else 0
    xh = mode_of(vals[vals <= med])
    cap = mode_of(vals[vals > med])
    print(f"литер={len(H)}  x-height={xh} px  CAP={cap} px = {cap / scale:.2f} pt"
          f"  ⚙️ кегль ≈ {cap / scale / CAP_RATIO:.1f} pt")
    print("  гистограмма: " + " ".join(f"{v}:{n}" for v, n in zip(vals, cnt) if n >= 3))
    return cap


def report(A, y0, y1, x0, x1, from_x, scale=3.0):
    print(f"{'полоса':>13s} {'литера':>11s} {'cap px':>7s} {'cap pt':>7s}  ⚙️ кегль")
    for top, bot in text_lines(A, y0, y1, x0, x1):
        gl = glyphs(A, top, bot, x0, x1)
        if not gl:
            continue
        g = first_capital(gl, from_x)
        if not g:
            continue
        cap_px = g["h"]
        cap_pt = cap_px / scale
        print(f"  y{top:5d}..{bot:<5d} x{g['x0']:5d} {cap_px:7d} {cap_pt:7.2f}  ≈ {cap_pt / CAP_RATIO:5.1f} pt")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("page", type=int)
    ap.add_argument("--band", nargs=2, type=int, default=None, metavar=("Y0", "Y1"))
    ap.add_argument("--from-x", type=int, default=0, help="край текста: всё левее считается иконкой")
    ap.add_argument("--x", nargs=2, type=int, default=None, metavar=("X0", "X1"))
    ap.add_argument("--scale", type=float, default=3.0, help="пикселей на pt (@3x = 3)")
    ap.add_argument("--cluster", action="store_true",
                    help="кегль по моде высот всей полосы — для меню, где в строке есть знаки")
    a = ap.parse_args()
    A = frame(a.pdf, a.page)
    H, W, _ = A.shape
    y0, y1 = a.band if a.band else (int(H * 0.06), int(H * 0.95))
    x0, x1 = a.x if a.x else (0, W)
    print(f"кадр {W}x{H}, полоса y {y0}..{y1}, край текста x={a.from_x}")
    if a.cluster:
        cluster_cap(A, y0, y1, max(x0, a.from_x), x1, scale=a.scale)
    else:
        report(A, y0, y1, x0, x1, a.from_x, a.scale)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
