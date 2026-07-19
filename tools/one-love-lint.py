#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ЗКН-Д027 · ГЕЙТ КОНСТИТУЦИИ ИНТЕРФЕЙСА (docs/ONE_LOVE_DESIGN.md).

Свод без механизма — это пожелание. Здесь проверяется то из свода, что вообще
поддаётся машинной проверке, и каждое правило проверено на живом нарушении: ломаю
эталон — красный, чиню — зелёный.

Правила:
  1. ХОЛСТ           — мокап объявляет холст #000000 (§1).
  2. УГОЛ            — скругление больше 12 pt идёт clip-path:path(), не border-radius (§2).
  3. СПЕЦИФИЧНОСТЬ   — правило-модификатор не слабее базового, если оба ложатся на один
                       элемент и спорят за одно свойство (§10.4). Ловилось трижды подряд.
  4. ЗНАК            — знаки маски, а не обводка: <path> в мокапе запрещён (§7).
  5. ШИРИНА СТРОКИ   — каждая data-w ссылается на объявленную переменную, и каждая
                       объявленная w-* кем-то используется (§5).
  6. СВОД ЦЕЛ        — разделы конституции на месте.

Запуск: python3 tools/one-love-lint.py
"""
import pathlib
import re
import sys
from html.parser import HTMLParser

ROOT = pathlib.Path(__file__).resolve().parent.parent
DOC = ROOT / "docs" / "ONE_LOVE_DESIGN.md"
MOCKS = ROOT / "docs" / "design" / "ios26" / "mockups"
SECTIONS = ["Холст и поверхности", "Углы", "Сетка", "Акцент", "Типографика",
            "Плавающий слой", "Знаки", "Иллюстрации", "Затемнение",
            "Правила чтения CSS как CSS", "Порядок работы над экраном"]
CORNER_LIMIT = 12.0

fail = []


def note(msg):
    fail.append(msg)


def rules_of(css):
    """[(селектор, {свойство: значение}, порядковый номер)] — без @-блоков."""
    out = []
    body = re.sub(r"@[a-z-]+[^{]*\{(?:[^{}]|\{[^{}]*\})*\}", " ", css, flags=re.S)
    for i, m in enumerate(re.finditer(r"([^{}]+)\{([^{}]*)\}", body)):
        sel, decl = m.group(1).strip(), m.group(2)
        props = {}
        for d in decl.split(";"):
            if ":" in d:
                k, v = d.split(":", 1)
                props[k.strip()] = v.strip()
        for one in sel.split(","):
            one = one.strip()
            if one and not one.startswith("@"):
                out.append((one, props, i))
    return out


def spec(sel):
    """Грубая мера специфичности: (идентификаторы, классы, элементы)."""
    return (len(re.findall(r"#[\w-]+", sel)),
            len(re.findall(r"\.[\w-]+", sel)) + len(re.findall(r"\[[^\]]+\]", sel)),
            len(re.findall(r"(?:^|[\s>+~])([a-z]+)", sel)))


def classes(sel):
    return set(re.findall(r"\.([\w-]+)", sel))


class Tree(HTMLParser):
    """Собирает (классы элемента, классы всех его предков). Точного каскада тут не
    надо — надо знать, лежит ли элемент внутри контейнера, чей селектор с ним спорит."""

    VOID = {"br", "img", "input", "hr", "meta", "link", "source", "use", "path"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.items = []

    def handle_starttag(self, tag, attrs):
        cl = set((dict(attrs).get("class") or "").split())
        anc = set().union(*self.stack) if self.stack else set()
        self.items.append((cl, anc))
        if tag not in self.VOID:
            self.stack.append(cl)

    def handle_startendtag(self, tag, attrs):
        cl = set((dict(attrs).get("class") or "").split())
        anc = set().union(*self.stack) if self.stack else set()
        self.items.append((cl, anc))

    def handle_endtag(self, tag):
        if tag not in self.VOID and self.stack:
            self.stack.pop()


def check_mock(path):
    src = path.read_text(encoding="utf-8")
    tag = path.relative_to(MOCKS)
    style = re.search(r"<style>(.*?)</style>", src, re.S)
    if not style:
        note(f"{tag}: нет блока стилей")
        return
    css = style.group(1)
    rules = rules_of(css)

    # 1. ХОЛСТ
    if not re.search(r"--canvas:\s*#000000", css):
        note(f"{tag}: холст не объявлен как #000000 (ONE LOVE §1)")

    # 2. УГОЛ: скругление больше предела обязано идти суперэллипсом
    radii = {m.group(1): float(m.group(2))
             for m in re.finditer(r"--([\w-]*r):\s*([\d.]+)px", css)}
    heights = {m.group(1): float(m.group(2))
               for m in re.finditer(r"--([\w-]+):\s*([\d.]+)px", css)}
    for sel, props, _ in rules:
        br = props.get("border-radius", "")
        m = re.search(r"var\(--([\w-]+)\)", br)
        if not m:
            continue
        r = radii.get(m.group(1), 0.0)
        if r <= CORNER_LIMIT:
            continue
        # Полная капсула — законная дуга: её профиль совпадает с окружностью h/2.
        hm = re.search(r"height:\s*var\(--([\w-]+)\)", props.get("height", "") or
                       "height:" + props.get("height", ""))
        hv = heights.get(re.sub(r"-r$", "-h", m.group(1)), None)
        if hv is not None and abs(r - hv / 2.0) < 0.6:
            continue
        note(f"{tag}: {sel} гнёт угол {r} pt дугой; "
             f"больше {CORNER_LIMIT:g} pt — только clip-path:path() (ONE LOVE §2)")

    # 3. СПЕЦИФИЧНОСТЬ: конфликт на одном элементе, где поздний слабее раннего
    body = re.search(r'<div class="stage">(.*)</div>', src, re.S)
    seen = set()
    if body:
        tree = Tree()
        tree.feed(body.group(1))
        for have, anc in tree.items:
            if not have:
                continue
            # Правило ложится на элемент, если КЛЮЧЕВОЙ (последний) селектор его
            # описывает, а предковая часть селектора нашлась среди предков.
            hit = []
            for sel, props, i in rules:
                parts = sel.replace(">", " ").split()
                if not parts:
                    continue
                key = classes(parts[-1])
                rest = classes(sel) - key
                if key and key <= have and rest <= anc:
                    hit.append((sel, props, i))
            for a in range(len(hit)):
                for b in range(len(hit)):
                    (s1, p1, i1), (s2, p2, i2) = hit[a], hit[b]
                    if i2 <= i1 or spec(s2) >= spec(s1):
                        continue
                    for prop in set(p1) & set(p2):
                        key = (str(tag), s1, s2, prop)
                        if key in seen:
                            continue
                        seen.add(key)
                        note(f"{tag}: «{s2}» задаёт {prop} позже, но слабее «{s1}» — "
                             f"не применится (ONE LOVE §10.4)")

    # 4. ЗНАК — маска, а не обводка
    if re.search(r"<path[\s>]", src):
        note(f"{tag}: знак обведён контуром; знаки берутся маской (ONE LOVE §7)")

    # 5. ШИРИНА СТРОКИ
    declared = set(re.findall(r"--(w-[\w-]+):", css))
    used = set(re.findall(r'data-w="([\w-]+)"', src))
    for u in sorted(used - declared):
        note(f"{tag}: data-w=\"{u}\" ссылается на необъявленную переменную (ONE LOVE §5)")
    for d in sorted(declared - used):
        note(f"{tag}: --{d} объявлена, но ни одна строка её не просит (ONE LOVE §5)")


def main():
    if not DOC.exists():
        note("нет docs/ONE_LOVE_DESIGN.md — свода не существует")
    else:
        text = DOC.read_text(encoding="utf-8")
        for s in SECTIONS:
            if s not in text:
                note(f"ONE_LOVE_DESIGN.md: вырезан раздел «{s}»")

    mocks = sorted(MOCKS.rglob("*.html")) if MOCKS.exists() else []
    if not mocks:
        note("мокапов нет — своду нечего охранять")
    for m in mocks:
        check_mock(m)

    if fail:
        print("🔴 ЗКН-Д027 — конституция интерфейса нарушена:")
        for f in fail:
            print("   ·", f)
        return 1
    print(f"🟢 ЗКН-Д027 — свод цел, мокапов проверено: {len(mocks)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
