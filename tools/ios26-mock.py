#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ЗКН-Д026 · СТЕНД МОКАПОВ — сборка и сверка эталонных экранов.

Мокап здесь не рисунок «похоже», а **отрисованный замер**. Поэтому:

* Числа в мокапе не набираются руками. Они лежат в `<кадр>.json`, который
  выпущен обмером (`ios26-frame.py`), и попадают в HTML переменными с адресом
  замера в комментарии. Расхождение мокапа и замера ловится машиной, а не глазом.
* Литеральное число в CSS вне блока переменных — ошибка. Гейт `verify` её видит.
* Угол рисуется СУПЕРЭЛЛИПСОМ (n ≈ 2.55, замер 4.2 и здесь же по кадру), а не
  дугой: на радиусе 34 pt разница дуги и суперэллипса — 8 px RMSE, это видно
  глазом. Дуга оставлена только там, где радиус мал (< 12 pt) и разница уходит
  под пиксель, и там это записано как сознательное упрощение.

Режимы:
    python3 tools/ios26-mock.py squircle W H R [N]   — путь clip-path
    python3 tools/ios26-mock.py verify [продукт]     — сверка мокапов с замерами
"""
import json
import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MOCK = ROOT / "docs" / "design" / "ios26" / "mockups"


def squircle(w, h, r, n=2.55, seg=24):
    """Путь суперэллиптического прямоугольника в собственных координатах элемента."""
    def corner(cx, cy, sx, sy):
        pts = []
        for i in range(seg + 1):
            t = i / seg
            a = t * math.pi / 2
            # параметризация суперэллипса: |x|^n + |y|^n = 1
            ct, st = math.cos(a), math.sin(a)
            x = math.copysign(abs(ct) ** (2.0 / n), ct)
            y = math.copysign(abs(st) ** (2.0 / n), st)
            pts.append((cx + sx * r * x, cy + sy * r * y))
        return pts
    p = []
    p += corner(w - r, r, 1, -1)[::-1]          # верх-право: с верха вправо
    p += corner(w - r, h - r, 1, 1)             # низ-право
    p += corner(r, h - r, -1, 1)[::-1]
    p += corner(r, r, -1, -1)
    d = "M %.2f %.2f " % p[0] + " ".join("L %.2f %.2f" % q for q in p[1:]) + " Z"
    return d


def parse_vars(css):
    return {m.group(1): m.group(2).strip()
            for m in re.finditer(r"--([a-z0-9-]+)\s*:\s*([^;]+);", css)}


def verify(product=None):
    """Сверка: числа мокапа = числа замера. Пустой набор — не «зелено», а провал."""
    bad = total = 0
    dirs = [d for d in sorted(MOCK.iterdir()) if d.is_dir()] if MOCK.exists() else []
    if product:
        dirs = [d for d in dirs if d.name == product]
    if not dirs:
        print("нет ни одного продукта в mockups/ — сверять нечего")
        return 1
    for d in dirs:
        for js in sorted(d.glob("f*.json")):
            html = js.with_suffix(".html")
            if not html.exists():
                print(f"🔴 {js.name}: замер есть, мокапа нет")
                bad += 1
                continue
            spec = json.loads(js.read_text(encoding="utf-8"))
            v = parse_vars(html.read_text(encoding="utf-8"))
            for name, want in sorted(spec.get("vars", {}).items()):
                total += 1
                got = v.get(name)
                if got is None:
                    print(f"🔴 {html.name}: нет переменной --{name} (замер {want})")
                    bad += 1
                    continue
                gn = re.sub(r"(pt|px)$", "", got.strip())
                wn = str(want)
                try:
                    if abs(float(gn) - float(wn)) > 0.005:
                        print(f"🔴 {html.name}: --{name} = {got}, замер {want}")
                        bad += 1
                except ValueError:
                    if gn.upper() != wn.upper():
                        print(f"🔴 {html.name}: --{name} = {got}, замер {want}")
                        bad += 1
            # литеральные числа вне блока переменных
            body = html.read_text(encoding="utf-8")
            tail = body[body.index("/* конец блока замеров */"):] if "/* конец блока замеров */" in body else ""
            for m in re.finditer(r":\s*(-?\d+(?:\.\d+)?)(pt|px)\b", tail):
                if m.group(1) in ("0", "1", "100"):
                    continue
                print(f"🔴 {html.name}: литеральное число {m.group(0).strip()} вне блока замеров")
                bad += 1
    print(f"сверено значений: {total} · расхождений: {bad}")
    return 1 if bad else 0


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "squircle":
        a = sys.argv[2:]
        print(squircle(float(a[0]), float(a[1]), float(a[2]),
                       float(a[3]) if len(a) > 3 else 2.55))
    else:
        sys.exit(verify(sys.argv[2] if len(sys.argv) > 2 else None))
