#!/usr/bin/env python3
"""
ЗАМЕР УГЛА КАРТОЧКИ — дуга или непрерывное скругление.

Зачем отдельный инструмент. Раздел 4.2 стандарта полгода держался на одном
кадре и на доводе «круг дал бы 19.3 px, замер даёт 24». Довод оказался верен
по направлению и завышен по величине: отступ брался по ТОЧНОМУ совпадению
цвета заливки, а такой замер считает антиалиасинг холстом и прибавляет около
пикселя. Пиксель на краю — это и есть вся разница между дугой и суперэллипсом,
поэтому метод здесь важнее прилежания.

Что делает этот скрипт иначе: границу берёт СУБПИКСЕЛЬНО — там, где заливка
пересекает 50 % между холстом и карточкой, — и подгоняет профиль сразу двумя
моделями (дуга и суперэллипс |x/R|^n + |y/R|^n = 1), выводя RMSE обеих. Число
без соперника ничего не доказывает; выигрыш одной модели над другой — доказывает.

Мастера в дерево не возвращаем (ЗКН-Ф025). Поднять их так:

    python3 tools/assets/offload.py restore --class ios26-refs     # 6 продуктов
    git show 67ef0aef^:docs/design/ios26/refs/apple_notes.pdf > /tmp/apple_notes.pdf

Запуск:

    python3 tools/ios26-corner.py /tmp/apple_notes.pdf            # обойти кадры сам
    python3 tools/ios26-corner.py /tmp/apple_notes.pdf 9 862 48   # кадр, верх, левый край

Результат 19.07.2026 по четырём продуктам: суперэллипс точнее дуги всюду,
n = 2.4-2.5, эквивалент дуги 24-26 pt. Записано в 4.2.
"""
import io
import math
import sys

import numpy as np

try:
    import fitz  # PyMuPDF
    from PIL import Image
except ImportError:  # pragma: no cover
    sys.exit("нужны PyMuPDF и Pillow: pip install pymupdf pillow")


def frames(pdf, pages):
    d = fitz.open(pdf); out={}
    for p in pages:
        pg = d[p-1]
        imgs = pg.get_images(full=True)
        if imgs:
            base = d.extract_image(imgs[0][0])
            out[p] = np.array(Image.open(io.BytesIO(base['image'])).convert('RGB')).astype(float)
        else:
            pm = pg.get_pixmap(dpi=216)
            out[p] = np.array(Image.frombytes('RGB',(pm.width,pm.height),pm.samples)).astype(float)
    d.close(); return out

def find_cards(A, minw=600, minh=120):
    """карточки: длинный горизонтальный прогон однородной заливки на тёмном холсте"""
    H,W,_ = A.shape
    lum = A.sum(2)
    cards=[]
    y=int(H*0.10)
    seen=set()
    while y < int(H*0.92):
        rowc = A[y]
        x = 20
        while x < W-minw:
            c = rowc[x]
            if lum[y,x] > 30 and lum[y,x] < 400:
                run = 1
                while x+run < W and abs(rowc[x+run]-c).max() <= 1: run += 1
                if run >= minw:
                    # вверх до края
                    yt = y
                    while yt > 0 and abs(A[yt-1, x+run//2]-c).max() <= 1: yt -= 1
                    yb = y
                    while yb < H-1 and abs(A[yb+1, x+run//2]-c).max() <= 1: yb += 1
                    key=(yt, x)
                    if yb-yt >= minh and key not in seen:
                        seen.add(key)
                        cards.append(dict(top=yt, bot=yb, left=x, w=run, h=yb-yt+1, fill=tuple(int(v) for v in c)))
                    x += run; continue
            x += 1
        y += 25
    return cards

def subpixel_profile(A, top, left, fill, depth=140):
    """отступ левого края по строкам, с субпиксельной границей (порог 50%)"""
    canvas = A[max(top-12,0), max(left-14,0)]
    f = np.array(fill, float); cv = np.array(canvas, float)
    denom = (f-cv).sum()
    if abs(denom) < 20: return None
    prof=[]
    for d in range(depth):
        y = top+d
        if y >= A.shape[0]: break
        best=None
        for x in range(max(left-8,0), left+depth+40):
            a0 = (A[y,x]-cv).sum()/denom
            a1 = (A[y,x+1]-cv).sum()/denom
            if a0 < 0.5 <= a1:
                t = (0.5-a0)/max(a1-a0,1e-6)
                best = x + t; break
        if best is not None: prof.append((d, best-left))
    return prof

def fit(prof, lo=2, hi=None):
    D=[(d,o) for d,o in prof if o is not None and o>=0]
    if hi: D=[(d,o) for d,o in D if lo<=d<=hi]
    else:  D=[(d,o) for d,o in D if d>=lo]
    if len(D)<15: return None
    def ec(R):
        e=sum(((R-math.sqrt(max(0,2*R*d-d*d)) if d<R else 0.0)-o)**2 for d,o in D)
        return e/len(D)
    Rc=min(np.arange(30,160,0.5), key=ec); rc=math.sqrt(ec(Rc))
    def es(R,n):
        e=0
        for d,o in D:
            if d>=R: p=0.0
            else:
                t=(R-d)/R; p=R-R*max(0,1-t**n)**(1/n)
            e+=(p-o)**2
        return e/len(D)
    best=min(((es(R,n),R,n) for R in np.arange(30,170,1.0) for n in np.arange(1.6,8.1,0.1)))
    return dict(Rc=Rc, rmse_c=rc, Rs=best[1], n=best[2], rmse_s=math.sqrt(best[0]), N=len(D))

def true_top(A, y, xc, fill, canvas_lum=25):
    f=np.array(fill,float)
    while y>1 and abs(A[y-1,xc]-f).max()<=40 and A[y-1,xc].sum()>canvas_lum: y-=1
    return y

def best_card(pdf, pages):
    out=[]
    for p,A in frames(pdf,pages).items():
        H,W,_=A.shape
        for y in range(int(H*0.12), int(H*0.90), 20):
            x=48
            c=A[y,x]
            if not (30 < c.sum() < 260): continue
            run=1
            while x+run<W and abs(A[y,x+run]-c).max()<=1: run+=1
            if run<1000: continue
            xc=x+run//2
            yt=true_top(A,y,xc,tuple(c))
            if A[yt-1,xc].sum() > 60: continue          # выше должен быть тёмный холст
            yb=y
            while yb<H-1 and abs(A[yb+1,xc]-c).max()<=40 and A[yb+1,xc].sum()>25: yb+=1
            h=yb-yt+1
            if h<200: continue
            out.append((h,p,yt,x,tuple(int(v) for v in c)))
    out.sort(reverse=True)
    return out[:1]


def main() -> int:
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    pdf = sys.argv[1]
    if len(sys.argv) >= 5:
        page, top, left = int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4])
        A = frames(pdf, [page])[page]
        fill = tuple(int(v) for v in A[top + 6, left + 40])
        cards = [(0, page, top, left, fill)]
    else:
        d = fitz.open(pdf)
        pages = list(range(1, min(d.page_count, 10) + 1))
        d.close()
        cards = best_card(pdf, pages)
        if not cards:
            print("карточки на тёмном холсте не нашлось — задай кадр/верх/край руками")
            return 1
    for h, page, top, left, fill in cards:
        A = frames(pdf, [page])[page]
        prof = subpixel_profile(A, top, left, fill)
        r = fit(prof, lo=1, hi=75)
        if not r:
            print(f"с.{page}: профиль не сошёлся")
            continue
        print(f"с.{page}  верх={top} край={left} заливка={fill}")
        print(f"  ДУГА         R={r['Rc'] / 3:6.2f} pt   RMSE={r['rmse_c']:.2f} px")
        print(f"  СУПЕРЭЛЛИПС  R={r['Rs'] / 3:6.2f} pt   n={r['n']:.1f}   RMSE={r['rmse_s']:.2f} px")
        win = "суперэллипс" if r["rmse_s"] < r["rmse_c"] else "дуга"
        print(f"  ближе: {win}  (n=2 — это ровно окружность)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
