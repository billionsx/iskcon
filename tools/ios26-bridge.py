#!/usr/bin/env python3
"""
МОСТ: токены приложения ← стандарт iOS 26.5.

Разведочный проход. Достаёт обе стороны и печатает сверку.
Не гейт — гейт отдельным файлом. Здесь задача одна: увидеть расхождения
числами, а не на глаз.

Запуск: python3 tools/ios26-bridge.py
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GLOBALS = ROOT / "apps" / "web" / "src" / "ui" / "globals.css"
STD_TOKENS = ROOT / "docs" / "design" / "ios26" / "TOKENS.md"
STANDARD = ROOT / "docs" / "design" / "ios26" / "STANDARD_ios26_css.md"

DECL = re.compile(r"^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);(.*)$")


def strip_comments(text: str) -> str:
    """Комментарии естественно содержат объявления-примеры — снимаем их."""
    return re.sub(r"/\*.*?\*/", "", text, flags=re.S)


def app_blocks():
    """Токены приложения по блокам селекторов."""
    src = GLOBALS.read_text(encoding="utf-8")
    blocks, cur, depth, buf = {}, None, 0, []
    for line in src.splitlines():
        bare = re.sub(r"/\*.*?\*/", "", line)
        if depth == 0:
            m = re.match(r"^(:root[^{]*|\S[^{]*)\{\s*$", bare.strip())
            if m and "{" in bare:
                cur = m.group(1).strip()
                depth = 1
                buf = []
                continue
        else:
            depth += bare.count("{") - bare.count("}")
            if depth <= 0:
                if cur:
                    blocks.setdefault(cur, []).extend(buf)
                cur, depth, buf = None, 0, []
                continue
            m = DECL.match(line)
            if m:
                buf.append((m.group(1), m.group(2).strip(), m.group(3).strip()))
    return blocks


def std_tokens():
    """Токены стандарта: имя → (значение, ссылка на раздел)."""
    out = {}
    section = None
    for line in STD_TOKENS.read_text(encoding="utf-8").splitlines():
        h = re.match(r"^##\s+(\d+)\.\s+(.+)$", line)
        if h:
            section = f"{h.group(1)}. {h.group(2)}"
        m = DECL.match(line)
        if m:
            name, val, tail = m.group(1), m.group(2).strip(), m.group(3)
            ref = ""
            r = re.search(r"(\d+\.\d+)", tail)
            if r:
                ref = r.group(1)
            elif "🍎" in tail:
                ref = "🍎"
            out[name] = (val, ref, section or "")
    return out


def type_scale():
    """Шкала Dynamic Type из §3.2 — кегль, интерлиньяж, трекинг, вес."""
    rows = {}
    body = STANDARD.read_text(encoding="utf-8")
    m = re.search(r"### 3\.2 .*?\n(.*?)\n###", body, flags=re.S)
    if not m:
        return rows
    for line in m.group(1).splitlines():
        if not line.startswith("|") or "---" in line:
            continue
        cells = [c.strip().strip("*") for c in line.strip("|").split("|")]
        if len(cells) < 5 or cells[1] in ("Кегль", ""):
            continue
        role = cells[0].strip("*").strip()
        try:
            rows[role] = dict(
                size=float(cells[1]),
                leading=float(cells[2]),
                tracking=float(cells[3].replace("−", "-").replace("+", "")),
                weight=cells[4],
            )
        except ValueError:
            continue
    return rows


def num(v):
    m = re.match(r"^(-?[\d.]+)(px|pt)?$", v.strip())
    return float(m.group(1)) if m else None


def main():
    blocks = app_blocks()
    root = {n: (v, t) for n, v, t in blocks.get(":root", [])}
    light = {n: (v, t) for n, v, t in blocks.get(":root[data-theme='light']", [])}
    std = std_tokens()
    scale = type_scale()

    print(f"ТОКЕНЫ ПРИЛОЖЕНИЯ  :root = {len(root)}   light = {len(light)}")
    print(f"ТОКЕНЫ СТАНДАРТА   TOKENS.md = {len(std)}")
    print(f"ШКАЛА §3.2         ролей = {len(scale)}")
    print()

    # ── 1. Типографика: кегль ──────────────────────────────────────────────
    print("── ТИПОГРАФИКА: КЕГЛЬ " + "─" * 55)
    app_type = {
        "--text-caption2": "Caption 2", "--text-caption": "Caption 1",
        "--text-footnote": "Footnote", "--text-subhead": "Subheadline",
        "--text-callout": "Callout", "--text-body": "Body",
        "--text-headline": "Headline", "--text-title3": "Title 3",
        "--text-title2": "Title 2", "--text-title1": "Title 1",
        "--text-display": "Large Title",
    }
    for tok, role in app_type.items():
        a = num(root.get(tok, ("", ""))[0]) if tok in root else None
        s = scale.get(role, {}).get("size")
        mark = "=" if a == s else "≠"
        print(f"  {tok:<20} app {str(a):>6}   std {str(s):>6}  {mark}  {role}")

    # ── 2. Типографика: интерлиньяж ────────────────────────────────────────
    print()
    print("── ТИПОГРАФИКА: ИНТЕРЛИНЬЯЖ " + "─" * 49)
    for tok in ("--leading-tight", "--leading-snug", "--leading-normal"):
        a = num(root.get(tok, ("", ""))[0]) if tok in root else None
        print(f"  {tok:<20} app {a}")
    print("  стандарт §3.2 — отношение интерлиньяжа к кеглю по ролям:")
    for role, r in scale.items():
        print(f"      {role:<14} {r['size']:>5.0f} / {r['leading']:>5.0f} = {r['leading']/r['size']:.3f}")

    # ── 3. Типографика: трекинг ────────────────────────────────────────────
    print()
    print("── ТИПОГРАФИКА: ТРЕКИНГ " + "─" * 53)
    for tok in ("--tracking-tight", "--tracking-normal", "--tracking-wide"):
        a = root.get(tok, ("—", ""))[0]
        print(f"  {tok:<20} app {a}")
    print("  стандарт §3.2 — трекинг по ролям, pt (в CSS переводится в em):")
    for role, r in scale.items():
        em = r["tracking"] / r["size"]
        print(f"      {role:<14} {r['tracking']:+.2f} pt  =  {em:+.4f} em")

    # ── 4. Вес ─────────────────────────────────────────────────────────────
    print()
    print("── ВЕС " + "─" * 70)
    for tok in ("--weight-regular", "--weight-medium", "--weight-semibold",
                "--weight-bold", "--weight-heavy"):
        a = root.get(tok, ("—", ""))[0]
        s = std.get(tok, ("—", "", ""))[0]
        mark = "=" if a == s else ("НЕТ В СТАНДАРТЕ" if s == "—" else "≠")
        print(f"  {tok:<20} app {a:>6}   std {s:>6}  {mark}")

    # ── 5. Геометрия ───────────────────────────────────────────────────────
    print()
    print("── ГЕОМЕТРИЯ " + "─" * 64)
    geo = [
        ("--radius-card", "--radius-card", "карточка с врезкой 16"),
        ("--radius-hero", "--radius-card-full", "полноширинная медиа"),
        ("--inset-card", "--inset-card", "карточка от края"),
        ("--inset-row", "--inset-trailing", "поле внутри карточки"),
        ("--row-h", "--row-height", "строка списка"),
        ("--row-h-2", "--row-height-two-line", "строка в две линии"),
        ("--gtab-h", "--layer-h-tabbar", "высота таб-бара"),
        ("--search-h", "—", "поле поиска"),
        ("--control-circle", "—", "круглая кнопка"),
        ("--icon-tile", "--glyph-tile", "плитка знака"),
    ]
    for atok, stok, what in geo:
        a = root.get(atok, ("—", ""))[0]
        s = std.get(stok, ("—", "", ""))[0] if stok != "—" else "—"
        ref = std.get(stok, ("", "", ""))[1] if stok != "—" else ""
        na, ns = num(a), num(s)
        mark = "=" if (na is not None and na == ns) else "≠"
        if s == "—":
            mark = "НЕТ"
        print(f"  {atok:<20} app {a:>8}   std {s:>8} {ref:>6}  {mark}  {what}")

    # ── 6. Чего в приложении нет вовсе ─────────────────────────────────────
    print()
    print("── ЕСТЬ В СТАНДАРТЕ, НЕТ В ПРИЛОЖЕНИИ " + "─" * 39)
    have = set(root) | set(light)
    alias = {
        "--surface-canvas": "--color-bg", "--surface-card": "--color-canvas",
        "--surface-on-sheet": "--color-card", "--label": "--color-label",
        "--label-secondary": "--color-label-2", "--label-tertiary": "--color-label-3",
        "--separator": "--color-separator", "--radius-card": "--radius-card",
        "--radius-card-full": "--radius-hero", "--inset-card": "--inset-card",
        "--row-height": "--row-h", "--layer-h-tabbar": "--gtab-h",
        "--glyph-tile": "--icon-tile", "--weight-regular": "--weight-regular",
        "--weight-medium": "--weight-medium", "--weight-semibold": "--weight-semibold",
        "--weight-bold": "--weight-bold", "--system-red": "--color-red",
        "--system-green": "--color-green", "--system-orange": "--color-orange",
        "--inset-trailing": "--inset-row", "--row-height-two-line": "--row-h-2",
    }
    missing = []
    for name, (val, ref, sect) in std.items():
        if alias.get(name, name) in have:
            continue
        missing.append((sect, name, val, ref))
    cur = None
    for sect, name, val, ref in missing:
        if sect != cur:
            print(f"  · {sect}")
            cur = sect
        print(f"      {name:<24} {val:<28} §{ref}")
    print()
    print(f"ИТОГО отсутствует: {len(missing)} из {len(std)}")


if __name__ == "__main__":
    sys.exit(main() or 0)
