#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ПОДГОНКА ЗОНЫ ЖАДНЫМ СПУСКОМ.

Поправка принимается ТОЛЬКО если расхождение зоны упало. Это отличает инструмент от
первой моей попытки автоподгонки: та считала поправку из замера и применяла её не
глядя — параметры заходили за оптимум, следующий проход гнал их обратно, и цикл
болтался вокруг решения, ухудшив кадр с 3.87 до 4.55 %.

Каждый шаг проверяется рендером. Дорого по времени, зато монотонно: хуже не станет.

Запуск: python3 tools/ios26-fitzone.py <зона>
"""
import re, subprocess, sys, pathlib
import numpy as np
from PIL import Image
GEN=pathlib.Path('/home/claude/gen_f03.py'); REF='/home/claude/fit/f03.png'
SHOT='/home/claude/shot03.png'; HTML='/home/claude/iskcon/docs/design/ios26/mockups/fitness/f03.html'
A=np.asarray(Image.open(REF).convert('RGB')).astype(int)
def render():
    subprocess.run([sys.executable,str(GEN)],capture_output=True)
    subprocess.run(["node","/home/claude/shot.js",HTML,SHOT,"3"],capture_output=True)
    return np.asarray(Image.open(SHOT).convert('RGB')).astype(int)
def score(B,box):
    x0,x1,y0,y1=box; d=np.abs(A-B)[int(y0*3):int(y1*3),int(x0*3):int(x1*3)]
    return float((d.max(axis=2)>24).mean())*100
def getv(s,k):
    m=re.search(rf'"{k}":\s*([\d.]+)',s); return float(m.group(1)) if m else None
def setv(s,k,v): return re.sub(rf'"{k}":\s*[\d.]+',f'"{k}":{v:.2f}',s)
ZONES={
 "chips":((10,393,172,220),[("chip-text-top",[-1,-.5,.5,1]),("fs-chip",[-.8,-.4,.4,.8]),
          ("chip1-text-top",[-1,-.5,.5,1]),("fs-chip1",[-.8,-.4,.4,.8]),
          ("chip1-y",[-.7,.35,.7]),("chip1-h",[-.7,.7]),("chip-y",[-.5,.5]),("chip-h",[-.5,.5])]),
 "bottom":((0,393,740,852),[("tab-label-top",[-1,-.5,.5,1]),("fs-tab",[-.6,-.3,.3,.6]),
          ("bar-y",[-.7,.35,.7]),("bar-x",[-.7,.7]),("pill-y",[-.7,.7]),("pill-x",[-.7,.7]),
          ("glow-y",[-2,2]),("bar-h",[-.7,.7]),("scrim-y",[-4,4])]),
 "july":((10,320,236,382),[("m1-top",[-.7,.35,.7]),("fs-month",[-.7,.7]),("col2-x",[-.7,.35,.7]),
          ("col3-x",[-.7,.35,.7]),("head-top",[-.7,.35,.7]),("fs-head",[-.5,.5]),
          ("row1-top",[-.5,.5]),("row2-top",[-.5,.5]),("row3-top",[-.5,.5]),("fs-row",[-.5,.25,.5])]),
 "oct":((10,320,496,642),[("m2-top",[-.7,.35,.7]),("head2-top",[-.7,.35,.7]),
          ("row1b-top",[-.5,.5]),("row2b-top",[-.5,.5]),("row3b-top",[-.5,.5])]),
}
name=sys.argv[1]; box,params=ZONES[name]
B=render(); best=score(B,box); print(f"{name}: старт {best:.2f} %")
src=GEN.read_text()
for key,steps in params:
    cur=getv(src,key)
    if cur is None: continue
    improved=True
    while improved:
        improved=False
        for st in steps:
            GEN.write_text(setv(GEN.read_text(),key,cur+st))
            B2=render(); s2=score(B2,box)
            if s2<best-0.02:
                best=s2; cur=cur+st; B=B2; improved=True; break
            GEN.write_text(setv(GEN.read_text(),key,cur))
    src=GEN.read_text()
print(f"{name}: итог {best:.2f} %")
