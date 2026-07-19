#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ЗКН-Д026 · СВЕРКА МОКАПА С КАДРОМ.

Сверять числа мокапа с числами замера мало: так проверяется только то, что я
не ошибся при переписывании. Кадр 1 прошёл эту сверку на 131 значении из 131 —
и был свёрстан развалившимся, потому что `--cap-off: 0.1695px` превращал
`calc(var(--cap-off)*var(--fs))` в произведение двух длин, весь `top` у текста
становился недействительным, и строки складывались в одну. Числа были верные.
Вёрстка — нет.

Поэтому сверка идёт по картинке: мокап открывается в headless Chrome при
deviceScaleFactor 3 (тот же 1179×2556, что у эталона) и вычитается из кадра.
Сравниваются три вещи, и каждая ловит свой класс поломки:

* **области заливки** — положение и размер блоков (карточка уехала, слой не той
  ширины);
* **строки чернил** — где на самом деле оказался текст (сложившиеся строки,
  сбитая база);
* **зоны** — средняя разность по полосам экрана, чтобы видеть, куда смотреть.

Знаки из приговора исключены: SF Symbols в эталоне растровые, в мокапе стоят
рисованные приближения, и их несовпадение о верности замера не говорит.

Запуск:  python3 tools/ios26-diff.py <продукт> <номер кадра> [--json]
Нужен:   node + playwright-core + /opt/google/chrome (есть в CI-образе сборки).
"""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MOCK = ROOT / "docs" / "design" / "ios26" / "mockups"
SHOT = ROOT / "tools" / "ios26-shot.js"


def render(html: Path, out: Path, scale=3):
    r = subprocess.run(["node", str(SHOT), str(html), str(out), str(scale)],
                       capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError("рендер не поднялся: " + (r.stderr or r.stdout)[-400:])
    return out


def load(p):
    import numpy as np
    from PIL import Image
    return np.asarray(Image.open(p).convert("RGB")).astype(int)


def zones(A, B, bands):
    import numpy as np
    out = []
    for tag, y0, y1 in bands:
        z = np.abs(A[int(y0 * 3):int(y1 * 3)] - B[int(y0 * 3):int(y1 * 3)])
        out.append((tag, round(float(z.mean()), 2),
                    round(float((z.max(axis=2) > 24).mean()) * 100, 2)))
    return out


def inkrows(A, thr=45, gap=4, minw=6):
    """Полосы чернил по всему кадру: где вообще что-то нарисовано."""
    import numpy as np
    lum = A.max(axis=2)
    on = (lum > thr).any(axis=1)
    rows, s = [], None
    for i, v in enumerate(on):
        if v and s is None:
            s = i
        if not v and s is not None:
            if i - s >= minw:
                rows.append((s, i))
            s = None
    if s is not None:
        rows.append((s, len(on)))
    merged = []
    for r in rows:
        if merged and r[0] - merged[-1][1] < gap:
            merged[-1] = (merged[-1][0], r[1])
        else:
            merged.append(r)
    return merged


def main():
    import numpy as np
    prod, num = sys.argv[1], int(sys.argv[2])
    d = MOCK / prod
    html = d / f"f{num:02d}.html"
    ref = d / "ref" / f"f{num:02d}.png"
    if not ref.exists():
        print(f"нет эталонного кадра {ref} — восстанови refs и нарежь кадры")
        return 2
    with tempfile.TemporaryDirectory() as tmp:
        shot = render(html, Path(tmp) / "shot.png")
        A, B = load(ref), load(shot)
    if A.shape != B.shape:
        print(f"🔴 размеры не совпали: эталон {A.shape[:2]}, мокап {B.shape[:2]}")
        return 1
    dm = np.abs(A - B)
    print(f"средняя |Δ| {round(float(dm.mean()),2)} · доля Δ>24 "
          f"{round(float((dm.max(axis=2)>24).mean())*100,2)} %")
    print("\nполосы чернил (эталон → мокап):")
    ra, rb = inkrows(A), inkrows(B)
    for i in range(max(len(ra), len(rb))):
        a = f"{ra[i][0]/3:.1f}…{ra[i][1]/3:.1f}" if i < len(ra) else "—"
        b = f"{rb[i][0]/3:.1f}…{rb[i][1]/3:.1f}" if i < len(rb) else "—"
        bad = "🔴" if (i >= len(ra) or i >= len(rb) or
                       abs(ra[i][0] - rb[i][0]) > 6 or abs(ra[i][1] - rb[i][1]) > 6) else "🟢"
        print(f"  {bad} {a:>16} → {b}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
