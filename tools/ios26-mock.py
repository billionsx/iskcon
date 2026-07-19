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
            bad += css_sanity(html.name, body)
    print(f"сверено значений: {total} · расхождений: {bad}")
    return 1 if bad else 0


def css_sanity(name, body):
    """ЗКН-Д026 · вёрстка обязана быть исполнимой, а не только правильной по числам.

    Кадр 1 прошёл сверку чисел на 131 из 131 и приехал в прод развалившимся:
    `--cap-off: 0.1695px` сделал `calc(var(--cap-off)*var(--fs))` произведением
    ДВУХ ДЛИН, весь `top` у текста стал недействительным, строки сложились в одну.
    Сверка чисел такого не видит по устройству: числа-то верные. Значит гейт
    обязан читать CSS как CSS.

    Три правила, каждое — на свой класс поломки:
      1. РАЗМЕРНОСТЬ. В `calc()` нельзя умножать длину на длину и делить на
         безразмерное без нужды: `px*px` — недействительное выражение, и браузер
         молча выбрасывает ВСЮ декларацию.
      2. ОБЪЯВЛЕНА. Каждая `var(--x)` объявлена в блоке замеров: иначе значение
         тихо становится пустым и правило снова умирает целиком.
      4. ТРЕКИНГ — ТИПОГРАФИКА. Межбуквенное у Apple лежит в пределах ±0.05 em.\n         Замкнутый цикл подгонки ширины под подставной шрифт легко уводит его\n         в 1.13 em: на кадре ширину строки держит НАСТОЯЩИЙ SF Pro, а подставной\n         рисует уже — и цикл гонится за разницей метрик, накручивая межбуквенное\n         до разъезда. На настоящем шрифте такая строка расползается через полэкрана\n         (живой случай: «LTE» уехало сквозь батарею). Потолок ±0.06 em ловит подгон\n         и говорит, что править надо КЕГЕЛЬ.\n      4. ТРЕКИНГ — ТИПОГРАФИКА, А НЕ ПОДГОН. Межбуквенное у Apple лежит в пределах
         ±0.05 em. Замкнутый цикл, подгоняющий ШИРИНУ строки под подставной шрифт,
         легко уводит его в 1.13 em: ширину на кадре держит настоящий SF Pro,
         подставной рисует уже, и цикл гонится за разницей МЕТРИК, накручивая
         межбуквенное. В песочнице совпало, на настоящем шрифте строка расползлась
         через полэкрана — «LTE» уехало сквозь батарею. Потолок ±0.06 em ловит
         подгон и говорит, что править надо кегль, а не буквы.
      3. ЗНАК В ПОТОКЕ. Если в файле есть сплошной селектор `* {position:absolute}`,
         обязано быть и правило, возвращающее `svg` в поток: иначе `<svg>` внутри
         `<i>` позиционируется от ближайшего предка с позицией, а `width:100%`
         считается от НЕГО — знак раздувается на всю карточку.
    """
    import re as _re
    errs = 0
    for _k, _v in _re.findall(r"--(tr-[a-z0-9-]+)\s*:\s*([^;]+);", body, _re.I):
        try:
            _t = float(_v.strip())
        except ValueError:
            continue
        if abs(_t) > 0.06:
            print(f"🔴 {name}: трекинг --{_k} = {_t} em — это подгон, а не типографика")
            errs += 1
    decl = dict(_re.findall(r"--([a-z0-9-]+)\s*:\s*([^;]+);", body, _re.I))
    islen = {k: bool(_re.search(r"\d(px|pt|em|rem|%)", v)) for k, v in decl.items()}
    for m in _re.finditer(r"calc\(([^()]*(?:\([^()]*\)[^()]*)*)\)", body):
        e = m.group(1)
        for a, b in _re.findall(r"var\(--([a-z0-9-]+)\)\s*\*\s*var\(--([a-z0-9-]+)\)", e, _re.I):
            if islen.get(a, True) and islen.get(b, True):
                print(f"🔴 {name}: calc умножает длину на длину — --{a} * --{b}")
                errs += 1
        for a in _re.findall(r"var\(--([a-z0-9-]+)\)\s*\*\s*-?\d+(?:\.\d+)?(?:px|pt)", e, _re.I):
            if islen.get(a, True):
                print(f"🔴 {name}: calc умножает длину --{a} на длину")
                errs += 1
    used = set(_re.findall(r"var\(\s*--([^),\s]+)", body))
    for u in sorted(used - set(decl)):
        print(f"🔴 {name}: var(--{u}) не объявлена")
        errs += 1
    if _re.search(r"[^>a-z0-9_.-]\*\s*\{[^}]*position\s*:\s*absolute", body, _re.I) \
       and not _re.search(r"svg\s*\{[^}]*position\s*:\s*static", body, _re.I):
        print(f"🔴 {name}: сплошной * {{position:absolute}} без возврата svg в поток")
        errs += 1
    return errs


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "squircle":
        a = sys.argv[2:]
        print(squircle(float(a[0]), float(a[1]), float(a[2]),
                       float(a[3]) if len(a) > 3 else 2.55))
    else:
        sys.exit(verify(sys.argv[2] if len(sys.argv) > 2 else None))
