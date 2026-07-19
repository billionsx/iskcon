#!/usr/bin/env python3
"""
ЗАМЕР ПЛАВАЮЩЕЙ НИЖНЕЙ ПАНЕЛИ — по оси, а не по кромке.

Зачем отдельный инструмент. Раздел 12 полгода держал вопрос «почему низ бара
то 21.3, то 28.3» и гадал про тип экрана и мини-плеер. Оба числа были верны и
оба меряли не то: у продуктов с таб-баром деталь высотой 62 pt, у Notes внизу
панель «поиск + действие» высотой 48 pt. Обе центрированы по ОДНОЙ линии —
52.00 pt над низом экрана. 21+31 = 52; 28+24 = 52. Кромка — следствие, ось —
причина; мерили следствие и потому видели разброс.

Отсюда правило: у плавающего слоя постоянна СЕРЕДИНА, а не отступ снизу.
Собственную деталь верстаем от её высоты, чужое число не переносим.

Что отсекается и почему: домашний индикатор узкий (<450 px) — по ширине;
клавиатура и лист касаются низа — по зазору; карточка не имеет боковой врезки
панели — по врезке. Без этих отсечек в выборку лезет всё подряд, проверено.

Мастера в дерево не возвращаем (ЗКН-Ф025):

    python3 tools/assets/offload.py restore --class ios26-refs

Запуск:

    python3 tools/ios26-bar.py /tmp/apple_music.pdf

Результат 19.07.2026: 88 кадров, 7 продуктов, ось 52.00 pt, у пяти продуктов
разброс нулевой. Записано в 5.2.
"""
import argparse
import io
import statistics as st
import sys

import numpy as np

try:
    import fitz  # PyMuPDF
    from PIL import Image
except ImportError:  # pragma: no cover
    sys.exit("нужны PyMuPDF и Pillow: pip install pymupdf pillow")


def pages(pdf):
    d=fitz.open(pdf); n=d.page_count; d.close(); return n

def frame(pdf,p):
    d=fitz.open(pdf); pg=d[p-1]; im=pg.get_images(full=True)
    if im:
        raw=d.extract_image(im[0][0])["image"]
        A=np.array(Image.open(io.BytesIO(raw)).convert("RGB")).astype(int)
    else:
        pm=pg.get_pixmap(dpi=216); A=np.array(Image.frombytes("RGB",(pm.width,pm.height),pm.samples)).astype(int)
    d.close(); return A

def floating_bar(A, min_w=450):
    """Нижняя плавающая панель: широкая полоса материала, не достающая до низа.
    Домашний индикатор узкий (<450 px) — отсекается шириной."""
    H,W,_=A.shape
    canvas=np.median(A[int(H*0.45):int(H*0.5), 5:25].reshape(-1,3),0)
    rows=[]
    for y in range(H-1, H-460, -1):
        d=np.abs(A[y]-canvas).sum(1)
        xs=np.where(d>26)[0]
        if len(xs)==0: rows.append(None); continue
        # самый длинный непрерывный прогон
        best=(0,0,0); s=xs[0]; p=xs[0]
        for x in xs[1:]:
            if x-p>3:
                if p-s+1>best[0]: best=(p-s+1,s,p)
                s=x
            p=x
        if p-s+1>best[0]: best=(p-s+1,s,p)
        rows.append(best if best[0]>=min_w else None)
    # снизу вверх: первый непустой блок
    i=0
    while i<len(rows) and rows[i] is None: i+=1
    if i>=len(rows): return None
    j=i
    while j<len(rows) and rows[j] is not None: j+=1
    y_bot=H-1-i; y_top=H-1-(j-1)
    widths=[rows[k][0] for k in range(i,j)]
    w=max(widths)
    k=int(np.argmax(widths))+i
    x0,x1=rows[k][1],rows[k][2]
    return dict(top=y_top, bot=y_bot, h=y_bot-y_top+1, x0=int(x0), x1=int(x1), w=int(w),
                gap_bottom=H-1-y_bot, H=H, W=W)


def scan(pdf, ref_h=852.0):
    """Кадры продукта → (кадр, низ, высота, ширина, врезка, ось), всё в pt."""
    out = []
    for p in range(1, pages(pdf) + 1):
        b = floating_bar(frame(pdf, p))
        if not b:
            continue
        s = b["H"] / ref_h
        gap, h, w, x0 = b["gap_bottom"] / s, b["h"] / s, b["w"] / s, b["x0"] / s
        if not (8 <= gap <= 40):    # приклеена к низу — клавиатура или лист
            continue
        if x0 < 6:                  # во всю ширину — не плавает
            continue
        if not (36 <= h <= 70):     # не панель
            continue
        out.append((p, gap, h, w, x0, gap + h / 2))
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--all", action="store_true", help="печатать каждый кадр, а не только сводку")
    a = ap.parse_args()
    rows = scan(a.pdf)
    if not rows:
        print("плавающей панели не нашлось (продукт может её не иметь — Wallet, Apple ID)")
        return 0
    if a.all:
        print(f"{'кадр':>5s} {'низ':>7s} {'высота':>7s} {'ширина':>8s} {'врезка':>7s} {'ось':>7s}")
        for p, gap, h, w, x0, c in rows:
            print(f"{p:5d} {gap:7.2f} {h:7.2f} {w:8.2f} {x0:7.2f} {c:7.2f}")
    C = [r[5] for r in rows]
    print(f"кадров={len(rows)}  низ={st.median([r[1] for r in rows]):.2f}  "
          f"высота={st.median([r[2] for r in rows]):.2f}  "
          f"ОСЬ={st.median(C):.2f} pt над низом экрана (разброс {min(C):.2f}..{max(C):.2f})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
