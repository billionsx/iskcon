#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
СПЛОШНАЯ ПЕРЕПИСЬ КАДРА.

Все прежние инструменты проверяли то, что я СПИСКОМ ЗАДАЛ. Что не попало в список —
не проверялось никогда. Этот находит объекты сам: связные области одного цвета
(карточки, капсулы, круги, подложки) и полосы чернил (строки), без списка вообще.

Сравнение двух переписей — эталона и мокапа — сразу даёт две вещи, которых не давал
ни один прежний инструмент: **чего в мокапе НЕТ** и **что отличается по цвету**.
На кадре 3 так нашлись девять отсутствующих заливок и неверный размер выбранного чипа
(я год держал его выше остальных на 3 pt, тогда как все чипы 32.33).

Запуск: python3 tools/ios26-census.py <кадр.png> <куда.json>
"""
import json, sys
import numpy as np
from PIL import Image
from scipy import ndimage

def load(p): return np.asarray(Image.open(p).convert('RGB')).astype(int)

def fills(A, min_area=900):
    """Связные области одного цвета — карточки, капсулы, круги, подложки."""
    H,W,_=A.shape
    key = A[:,:,0]*65536 + A[:,:,1]*256 + A[:,:,2]
    vals, cnt = np.unique(key, return_counts=True)
    vals = vals[cnt >= min_area]          # только цвета, которых достаточно много
    out=[]
    for col in vals:
        m = (key==col)
        if m.sum() < min_area: continue
        lab,n = ndimage.label(m)
        for i in range(1, n+1):
            z = (lab==i)
            a = int(z.sum())
            if a < min_area: continue
            ys,xs = np.where(z)
            x0,x1,y0,y1 = xs.min(), xs.max()+1, ys.min(), ys.max()+1
            w,h = x1-x0, y1-y0
            fill = a/(w*h)
            r,g,b = int(col>>16), int((col>>8)&255), int(col&255)
            out.append(dict(x=round(x0/3,2), y=round(y0/3,2), w=round(w/3,2), h=round(h/3,2),
                            color=f"#{r:02X}{g:02X}{b:02X}", fill=round(fill,3), area=a))
    out.sort(key=lambda d:(d['y'], d['x']))
    return out

def rows(A, thr=70):
    """Строки чернил: горизонтальные полосы, где есть светлые пиксели."""
    m = A.max(axis=2) > thr
    prof = m.any(axis=1)
    out=[]; st=None
    for i,v in enumerate(prof):
        if v and st is None: st=i
        if not v and st is not None:
            if i-st >= 6: out.append((st,i))
            st=None
    if st is not None: out.append((st,len(prof)))
    res=[]
    for y0,y1 in out:
        band = m[y0:y1]
        cols = band.any(axis=0)
        # разрезаем полосу на куски по пропускам ≥ 8 px
        seg=[]; s2=None; gap=0
        for j,v in enumerate(cols):
            if v:
                if s2 is None: s2=j
                gap=0
            else:
                if s2 is not None:
                    gap+=1
                    if gap>=24: seg.append((s2, j-gap+1)); s2=None
        if s2 is not None: seg.append((s2, len(cols)))
        for x0,x1 in seg:
            sub = A[y0:y1, x0:x1]
            mm = sub.max(axis=2) > thr
            if mm.sum() < 40: continue
            px = sub[mm]
            res.append(dict(x=round(x0/3,2), y=round(y0/3,2),
                            w=round((x1-x0)/3,2), h=round((y1-y0)/3,2),
                            color=f"#{int(np.median(px[:,0])):02X}{int(np.median(px[:,1])):02X}{int(np.median(px[:,2])):02X}",
                            ink=int(mm.sum())))
    return res

if __name__ == "__main__":
    A = load(sys.argv[1])
    F, R = fills(A), rows(A)
    json.dump(dict(fills=F, rows=R), open(sys.argv[2],'w'), ensure_ascii=False, indent=1)
    print(f"заливок: {len(F)} · строк: {len(R)}")
