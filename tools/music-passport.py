#!/usr/bin/env python3
# Паспорт эталона Apple Music: снимает ключевые метрики кадра 1179x2556 (pt = px/3).
# Использование: python3 tools/music-passport.py <png> [--full]
import sys, numpy as np
from PIL import Image

def segs(arr, thr, mn=1, gap=4):
    xs = [i for i, v in enumerate(arr) if v > thr]
    out = []
    if xs:
        s = p = xs[0]
        for x in xs[1:]:
            if x > p + gap:
                if p - s + 1 >= mn: out.append((round(s / 3, 1), round((p - s + 1) / 3, 1)))
                s = x
            p = x
        if p - s + 1 >= mn: out.append((round(s / 3, 1), round((p - s + 1) / 3, 1)))
    return out

def rowseg(a, y, x0, x1, t, gap=4):
    return [(round(x0 + s, 1), w) for s, w in segs(a[int(y * 3), x0 * 3:x1 * 3], t, gap=gap)]

def rws(a, y0, y1, x0, x1, t):
    z = a[y0 * 3:y1 * 3, x0 * 3:x1 * 3]
    on = (z > t).sum(1) > 3
    out, j = [], 0
    while j < len(on):
        if on[j]:
            k = j
            while k < len(on) and on[k]: k += 1
            out.append((round(y0 + j / 3, 1), round((k - j) / 3, 1))); j = k
        else:
            j += 1
    return out

def main():
    fn = sys.argv[1]
    g = np.asarray(Image.open(fn).convert('L'), dtype=np.int16)
    c = np.asarray(Image.open(fn).convert('RGB'), dtype=np.int16)
    print('==', fn.split('/')[-1], g.shape)
    print('фон edge/mid/bot:', [tuple(int(v) for v in c[y, 8]) for y in (400, 1278, 2300)])
    print('шапка LT ink (x16..220, t120):', rws(g, 52, 118, 16, 220, 120))
    print('шапка строка y81 (t26):', rowseg(g, 81, 0, 393, 26)[:6])
    for y in (200, 300, 430, 560, 700):
        print(f'строка y{y} (t22):', rowseg(g, y, 0, 393, 22)[:6])
    print('док-зона строки y788/806 (t110):', rowseg(g, 788, 16, 380, 110)[:8], '|', rowseg(g, 806, 16, 380, 110)[:8])
    # вертикальная структура: полоса контента x24..100
    band = g[:, 24 * 3:100 * 3].mean(1)
    on = band > 24
    out, j = [], 340 * 3
    while j < len(on) and len(out) < 10:
        if on[j]:
            k = j
            while k < len(on) and on[k]: k += 1
            if k - j > 60: out.append((round(j / 3, 1), round((k - j) / 3, 1)))
            j = k
        else:
            j += 1
    print('верт-блоки (полоса x24..100, t24):', out)

if __name__ == '__main__':
    main()
