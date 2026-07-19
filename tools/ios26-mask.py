#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ЗКН-Д026 · ЗНАК КАК АЛЬФА-МАСКА.

Обводка контура не годится для SF Symbols, и это видно на числах: у знака
«перо» доля несовпавших пикселей держалась на 28 %, у «людей» — 30 %, а форма
на глаз «плыла». Причина в устройстве знака. SF Symbol — это ШТРИХ постоянной
толщины, а обводка рисует вокруг штриха замкнутую кривую: чуть сместился порог,
и линия толстеет или худеет по всей длине. На 20 pt при @3x это 4–5 пикселей
ширины, и ошибка в один пиксель — это двадцать процентов штриха.

Здесь знак берётся иначе: считается доля материала α ∈ [0,1] на каждый пиксель
(та же проекция на отрезок «подложка → знак», что и у краёв блоков) и
сохраняется как полутоновая маска при @3x. В CSS она ставится `mask-image`, а
цвет даёт `background: currentColor` — знак перекрашивается как шрифтовой и
воспроизводится пиксель в пиксель, потому что маска И ЕСТЬ замер.

Что при этом теряется: маска не масштабируется вверх без мыла. Для эталонного
мокапа это не потеря — он снят под @3x и живёт при @3x. В приложении знаки
берутся из системных SF Symbols, а мокап отвечает на другой вопрос: где знак
стоит, какого он размера и как выглядит его кромка.

Запуск:
  python3 tools/ios26-mask.py <кадр.png> <x0> <y0> <x1> <y1>
                              [--fill R,G,B] [--back R,G,B] [--name перо]
Координаты — в pt эталона (pt = px/3).
"""
import argparse
import base64
import io
import sys

import numpy as np
from PIL import Image


def load(path):
    return np.asarray(Image.open(path).convert("RGB")).astype(float)


def alpha(img, box, fill, back, gamma=1.0):
    """Доля материала на пиксель. Габарит подрезается по непустым строкам и столбцам."""
    x0, y0, x1, y1 = [int(round(v * 3)) for v in box]
    sub = img[y0:y1, x0:x1]
    a = np.array(back, float)
    v = np.array(fill, float) - a
    t = ((sub - a) @ v) / float(v @ v)
    t = np.clip(t, 0.0, 1.0)
    if gamma != 1.0:
        t = t ** gamma
    # Габарит режется по КРАЮ МАТЕРИАЛА (порог 50 %) — тому же, что у краёв блоков,
    # плюс один пиксель запаса, чтобы не срубить полупрозрачную кромку. Резать по
    # следу антиалиасинга (α>0.06) значит объявить знак на 1–2 pt больше, чем он есть,
    # и при `mask-size:100%` растянуть его на эту разницу.
    keep = t >= 0.5
    if not keep.any():
        raise SystemExit("в прямоугольнике нет материала знака")
    ys, xs = np.where(keep)
    gy0 = max(ys.min() - 1, 0)
    gy1 = min(ys.max() + 2, t.shape[0])
    gx0 = max(xs.min() - 1, 0)
    gx1 = min(xs.max() + 2, t.shape[1])
    return t[gy0:gy1, gx0:gx1], (x0 + gx0) / 3.0, (y0 + gy0) / 3.0


def to_png(t):
    """PNG с АЛЬФА-каналом, а не в градациях серого.

    `mask-image` по умолчанию работает в режиме `match-source`: для растра это
    означает альфу, а не яркость. Полутоновый PNG без альфы браузер читает как
    непрозрачный целиком — маска перестаёт быть маской, и знак заливает свой
    прямоугольник. Поэтому яркость кладётся в альфу: L = 255, A = α·255.
    """
    a = np.uint8(np.round(np.clip(t, 0, 1) * 255))
    rgba = np.dstack([np.full_like(a, 255), a])
    im = Image.fromarray(rgba, mode="LA")
    buf = io.BytesIO()
    im.save(buf, "PNG", optimize=True)
    return buf.getvalue()


def extract(img, box, fill, back, gamma=1.0):
    t, x, y = alpha(img, box, fill, back, gamma)
    png = to_png(t)
    h_px, w_px = t.shape
    return dict(w=round(w_px / 3.0, 2), h=round(h_px / 3.0, 2), x=round(x, 2), y=round(y, 2),
                bytes=len(png), uri="data:image/png;base64," + base64.b64encode(png).decode())


def css(uri):
    return (f"-webkit-mask-image:url({uri});mask-image:url({uri});"
            "-webkit-mask-size:100% 100%;mask-size:100% 100%;"
            "-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;background:currentColor")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("frame")
    ap.add_argument("box", nargs=4, type=float)
    ap.add_argument("--fill", default="255,255,255")
    ap.add_argument("--back", default="0,0,0")
    ap.add_argument("--gamma", type=float, default=1.0)
    ap.add_argument("--name", default="знак")
    a = ap.parse_args()
    f = tuple(int(v) for v in a.fill.split(","))
    b = tuple(int(v) for v in a.back.split(","))
    r = extract(load(a.frame), a.box, f, b, a.gamma)
    print(f"# {a.name}: габарит {r['w']}×{r['h']} pt, начало {r['x']}·{r['y']} pt, "
          f"маска {r['bytes']} байт")
    print(css(r["uri"])[:120] + " …")


if __name__ == "__main__":
    sys.exit(main())
