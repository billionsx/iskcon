#!/usr/bin/env python3
"""
МОСТ, проход разметки. Запускается один раз; дальше правду держит гейт.

Каждому токену `:root` в globals.css проставляется АДРЕС — откуда взято число:

  📐 N.NN  замер применён, раздел STANDARD_ios26_css.md
  ⚠ N.NN   замер СНЯТ, значение РАСХОДИТСЯ, правка отложена — с причиной
  🍎       канон Apple (HIG, системная семантика) — не с кадра, но и не вкус
  ⚙️       следствие: calc, env, псевдоним или вывод из замеренного
  🎨       бренд ISKCON — Apple его мерить не может
  🕳       долг знания: не снято

Два последних класса — ⚠ и 🕳 — считаются храповиком и могут только убывать.
Разница между ними существенна: 🕳 закрывается ЗАМЕРОМ, ⚠ закрывается ПРАВКОЙ.
Смешать их значило бы спрятать известное расхождение под видом незнания.

Заодно применяются правки ТЁМНОЙ ветки. Она перекрыта светлой темой целиком
(47 цветовых токенов), поэтому исправление тёмных значений на замеренные
не меняет ни одного пикселя на живом сайте — и готовит переключение.

Запуск: python3 tools/ios26-bridge-apply.py [--dry]
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSS = ROOT / "apps" / "web" / "src" / "ui" / "globals.css"

# ─── АДРЕС ЗАМЕРА для каждого токена :root ────────────────────────────────
# Ключ — имя токена. Значение — маркер (и раздел, если это замер).
MARK = {
    # ── оболочка и хром ────────────────────────────────────────────────
    "--gtab-h": "📐 5.20",            # ось 52 / низ 21 / высота 62 — 43 кадра, разброс 0
    "--gtab-bottom": "⚠ 5.20",       # замер 21; у нас 16 + safe-area = 50. Шаг 4
    "--gtab-reserve": "⚙️",
    "--h-top-header": "🕳",           # эталон шапки 44.0 pt (5.15); у нас 56 под вордмарк
    "--content-bottom": "⚙️",
    "--sheet-max": "🕳",              # ширина колонки приложения; эталон экрана 393 pt
    "--read-max": "🕳",               # мера строки чтения — из типографики, не с кадра
    "--safe-l": "⚙️",
    "--safe-r": "⚙️",
    "--player-extra": "⚙️",
    "--h-hall-tabs": "🕳",

    # ── поверхности, тёмная ветка ──────────────────────────────────────
    "--color-bg": "📐 5.19",          # холст #000000 — модальный у всех десяти
    "--color-bg-2": "📐 5.19",        # карточка на холсте
    "--color-bg-3": "📐 5.16",        # карточка НА листе — третья ступень
    "--color-canvas": "📐 5.19",
    "--color-card": "📐 5.16",
    "--color-separator": "📐 5.33",   # #38383A, восемь продуктов из десяти

    # ── текст ──────────────────────────────────────────────────────────
    "--color-label": "📐 5.21",
    "--color-label-2": "📐 5.21",     # серый с СИНИМ подтоном, не нейтральный
    "--color-label-3": "📐 5.21",     # уровень выключенного: по контрасту не проходит нигде
    "--color-label-4": "🕳",

    # ── материал Liquid Glass ──────────────────────────────────────────
    "--color-glass-thin": "🍎 6.2",
    "--color-glass-regular": "🍎 6.2",
    "--color-glass-thick": "🍎 6.2",
    "--color-glass-stroke": "🕳",
    "--color-glass-nav": "🕳",
    "--color-menu-glass": "🕳",
    "--color-header-blur": "🕳",
    "--color-hover": "🕳",
    "--color-active": "🕳",
    "--color-hairline": "🕳",
    "--color-hairline-strong": "🕳",
    "--color-scrim-soft": "🕳",

    # ── системная семантика ────────────────────────────────────────────
    "--color-blue-system": "🍎",
    "--color-green": "🍎 2.5",        # systemGreen — включённый тумблер
    "--color-orange": "🍎 2.5",       # systemOrange — предупреждение
    "--color-red": "🍎 2.5",          # systemRed — деструктив, «сегодня»
    "--color-yellow": "🍎",

    # ── бренд ISKCON ───────────────────────────────────────────────────
    **{t: "🎨" for t in (
        "--color-gold", "--color-on-gold", "--color-heart", "--color-on-dark",
        "--color-gold-deep", "--color-gold-50", "--color-gold-100",
        "--color-gold-200", "--color-gold-300", "--color-gold-400",
        "--color-gold-500", "--color-gold-600", "--color-gold-700",
        "--color-gold-800", "--color-gold-900", "--color-brand-black",
        "--color-brand-white", "--reader-accent", "--reader-accent-soft",
        "--color-blue", "--player-glow", "--tile-gold",
    )},

    # ── шрифт ──────────────────────────────────────────────────────────
    "--font-display": "🍎 3.1",       # оптический размер переключает сам шрифт от 20 pt
    "--font-text": "🍎 3.1",
    "--font-scripture": "🎨",
    "--font-deva": "🎨",
    "--ital-xheight": "🎨",

    # ── типографика: кегль (все одиннадцать сошлись со шкалой) ─────────
    **{t: "📐 3.2" for t in (
        "--text-caption2", "--text-caption", "--text-footnote", "--text-subhead",
        "--text-callout", "--text-body", "--text-headline", "--text-title3",
        "--text-title2", "--text-title1", "--text-display",
    )},

    # ── типографика: интерлиньяж и трекинг ─────────────────────────────
    "--leading-tight": "⚠ 3.2",        # 1.1; Large Title даёт 41/34 = 1.206
    "--leading-snug": "⚠ 3.2",         # 1.35; шкала даёт 1.21…1.33 по роли
    "--leading-normal": "⚠ 5.28",     # 1.5; замер 1.30 от кегля = 1.84 × cap
    "--tracking-tight": "⚠ 3.2",       # px; шкала требует em по роли
    "--tracking-normal": "📐 3.2",     # Caption 1 — единственная роль с нулём
    "--tracking-wide": "⚠ 3.2",        # +0.4 — это Large Title, а не капс-eyebrow

    # ── вес ────────────────────────────────────────────────────────────
    "--weight-regular": "📐 5.21",    # 59 % корпуса
    "--weight-medium": "📐 5.21",     # 21 %
    "--weight-semibold": "📐 5.21",   # 10 %
    "--weight-bold": "📐 5.21",       # 10 %
    "--weight-heavy": "⚠ 5.21",       # пятого начертания в корпусе нет ни разу

    # ── отступы ────────────────────────────────────────────────────────
    "--pad-screen-x": "📐 5.19",      # врезка карточки от края 16
    "--pad-card": "🕳",
    "--space-section": "🕳",
    "--space-block": "🕳",
    "--space-inner": "🕳",
    "--space-tight": "🕳",
    **{f"--space-{n}": "🕳" for n in (1, 2, 3, 5, 6, 8)},
    "--space-4": "📐 5.19",           # 16 — единственный, совпавший с замером

    # ── радиусы ────────────────────────────────────────────────────────
    "--radius-card": "📐 4.2",        # 24–26 pt, семья «карточка с врезкой 16»
    "--radius-hero": "⚠ 4.2",         # 20 = меню/лист/алерт; герой с картинкой = 16
    "--radius-glass": "📐 4.2",       # меню, лист, алерт
    "--radius-glass-lg": "🕳",
    "--radius-squircle": "🕳",
    "--radius-pill": "⚙️",            # капсула = h/2
    "--radius-control": "🕳",
    "--radius-xs": "🕳",
    "--radius-sm": "🕳",
    "--radius-md": "🕳",
    "--radius-lg": "🕳",
    "--radius-xl": "🕳",

    # ── ритм строки и элементы списка ──────────────────────────────────
    "--row-h": "⚠ 5.19",              # 48 — ни 47, ни 49: семья схлопнута в константу
    "--row-h-2": "⚠ 5.19",             # 60 — замеров 53.3 и 73.7, шестидесяти нет
    "--inset-card": "📐 5.19",
    "--inset-row": "📐 5.24",
    "--gap-group": "🕳",
    "--icon-tile": "📐 4.2",          # плитка иконки 29 pt, радиус 7
    "--control-circle": "📐 5.15",    # круг шапки 44×44 — во всю высоту шапки
    "--search-h": "🕳",
    "--search-inset": "🕳",

    # ── тени ───────────────────────────────────────────────────────────
    "--shadow-1": "🕳",
    "--shadow-2": "🕳",
    "--shadow-3": "🕳",
    "--shadow-card": "🕳",
    "--shadow-group": "🕳",
    "--shadow-search": "🕳",

    # ── семантика (псевдонимы) ─────────────────────────────────────────
    **{t: "⚙️" for t in (
        "--color-success", "--color-warning", "--color-danger", "--color-info",
        "--color-success-text", "--color-warning-text", "--color-danger-text",
        "--color-info-text", "--color-success-surface", "--color-warning-surface",
        "--color-danger-surface", "--color-info-surface",
        "--color-fill-1", "--color-fill-2",
    )},

    # ── плитки ─────────────────────────────────────────────────────────
    **{t: "🕳" for t in ("--tile-blue", "--tile-green", "--tile-red",
                         "--tile-grey", "--color-tile")},

    # ── движение ───────────────────────────────────────────────────────
    "--ease-standard": "🕳",          # со статики кривая не снимается (§12)
    "--ease-out": "🕳",
    "--ease-in": "🕳",
    "--duration-fast": "🕳",
    "--duration-base": "🕳",
    "--duration-slow": "🕳",
}

# ─── ПРАВКИ ТЁМНОЙ ВЕТКИ: значение → замеренное ───────────────────────────
# Все они перекрыты светлой темой, поэтому продакшен не меняется.
FIX = {
    "--color-bg-2": ("#0a0a0a", "#1c1c1e"),
    "--color-bg-3": ("#1c1c1e", "#2c2c2e"),
    "--color-label": ("rgba(255, 255, 255, 0.95)", "#ffffff"),
    "--color-separator": ("#404043", "#38383a"),
    "--color-glass-thin": ("rgba(255, 255, 255, 0.08)", "rgba(255, 255, 255, 0.05)"),
    "--color-glass-regular": ("rgba(255, 255, 255, 0.12)", "rgba(255, 255, 255, 0.06)"),
    "--color-glass-thick": ("rgba(255, 255, 255, 0.18)", "rgba(255, 255, 255, 0.09)"),
}

DECL = re.compile(r"^(\s*)(--[a-z0-9-]+)\s*:\s*([^;]+);(.*)$")
MARKERS = ("📐", "⚠", "🍎", "⚙️", "🎨", "🕳")
# 📐 и ⚠ ОБЯЗАНЫ нести номер раздела: без него значок — это проза, а не адрес.
# Поймано на живом токене: «⚠ синхронизировано с BAR_H» прошло как замер.
MARK_RE = re.compile(r"^/\*\s*(?:(?:📐|⚠)\s*\d+\.\d+|🍎(?:\s*\d+\.\d+)?|⚙️|🎨|🕳)(?:\s|·|\*|$)")


def main():
    dry = "--dry" in sys.argv
    lines = CSS.read_text(encoding="utf-8").splitlines()

    # границы блока :root верхнего уровня
    start = next(i for i, l in enumerate(lines) if l.strip() == ":root {")
    depth, end = 0, None
    for i in range(start, len(lines)):
        bare = re.sub(r"/\*.*?\*/", "", lines[i])
        depth += bare.count("{") - bare.count("}")
        if depth <= 0 and i > start:
            end = i
            break

    seen, fixed, missing = set(), [], []
    for i in range(start + 1, end):
        m = DECL.match(lines[i])
        if not m:
            continue
        indent, name, val, tail = m.groups()
        seen.add(name)
        mark = MARK.get(name)
        if mark is None:
            missing.append(name)
            continue
        # Маркер обязан стоять ПЕРВЫМ в комментарии. Иначе значок из прозы
        # («⚠ синхронизировано с BAR_H») выдаёт себя за адрес замера — и токен
        # молча проходит неразмеченным. Один такой уже поймали.
        if MARK_RE.match(tail.strip()):
            continue

        if name in FIX:
            old, new = FIX[name]
            if val.strip() == old:
                val = new
                fixed.append((name, old, new))

        tail = tail.strip()
        if tail.startswith("/*") and tail.endswith("*/"):
            inner = tail[2:-2].strip()
            newtail = f"/* {mark} · {inner} */"
        elif tail.startswith("/*"):
            newtail = tail.replace("/*", f"/* {mark} ·", 1)
        elif tail:
            newtail = f"/* {mark} */ {tail}"
        else:
            newtail = f"/* {mark} */"
        lines[i] = f"{indent}{name}: {val};  {newtail}"

    if missing:
        print("НЕ РАЗМЕЧЕНЫ (карта неполна):", " ".join(missing))
        return 1

    orphans = [t for t in MARK if t not in seen]
    hole = sum(1 for t in seen if MARK[t] == "🕳")
    dev = sum(1 for t in seen if MARK[t].startswith("⚠"))
    print(f"размечено: {len(seen)}   правок: {len(fixed)}   🕳 не снято: {hole}   ⚠ расходится: {dev}")
    for n, o, w in fixed:
        print(f"   ✎ {n}: {o} → {w}")
    if orphans:
        print("в карте есть, в CSS нет:", " ".join(orphans))

    if not dry:
        CSS.write_text("\n".join(lines) + "\n", encoding="utf-8")
        print("globals.css записан")
    return 0


if __name__ == "__main__":
    sys.exit(main())
