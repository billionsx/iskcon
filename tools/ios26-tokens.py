#!/usr/bin/env python3
"""
ЗКН-Д028 · ГЕЙТ МОСТА: ТОКЕН НЕСЁТ АДРЕС ЗАМЕРА.

Между стандартом на 2161 строку и токенами приложения не было моста: ссылок из
`tokens.ts` на `STANDARD_ios26_css.md` была ровно одна. Оттого экраны строились
третьим способом — руками по скриншоту, мимо обоих, — и работа не накапливалась.

Мост держится не документом, а этим гейтом. Адрес живёт НА ТОЙ ЖЕ СТРОКЕ, что и
число: разъехаться им негде.

  📐 N.NN  замер применён, раздел стандарта
  ⚠ N.NN   замер снят, значение расходится, правка отложена — с причиной
  🍎       канон Apple (HIG, системная семантика)
  ⚙️       следствие: calc, env, псевдоним, вывод из замеренного
  🎨       бренд ISKCON — Apple его мерить не может
  🕳       долг знания: не снято

ПРАВИЛО 1 — у каждого токена `:root` есть адрес, и он стоит ПЕРВЫМ в
            комментарии. Значок в прозе адресом не считается: «⚠ синхронизировано
            с BAR_H» однажды уже прошло за замер. Поэтому 📐 и ⚠ обязаны нести
            номер раздела — без номера это не адрес, а настроение.

ПРАВИЛО 2 — адрес ведёт к живому разделу. Раздел, названный в токене, обязан
            существовать в стандарте. Мёртвый адрес хуже отсутствующего: он
            выглядит как доказательство.

ПРАВИЛО 3 — храповик, и он двойной. 🕳 (не снято) и ⚠ (снято, но расходится)
            считаются порознь: они закрываются разным — 🕳 замером, ⚠ правкой,
            и смешать их значило бы спрятать известное расхождение под видом
            незнания. Но корзины иногда надо ПЕРЕБАЛАНСИРОВАТЬ: токен бывает
            помечен неверно (⚠ `--leading-normal` держал прозу, а сравнивался
            с интерфейсным замером). Поэтому сверх двух корзин считается СУММА,
            и она может только убывать. Так исправление ошибки разметки
            проходит, а перекладывание расхождения в «незнание» — нет.

ПРАВИЛО 5 — компонент не изобретает типографику. Литеральные `fontSize`,
            `lineHeight`, `letterSpacing` в `.tsx` считаются храповиком.
            Живой пример класса: `fontSize: "var(--text-subhead)",
            lineHeight: 1.6` — кегль взят из токена, а интерлиньяж выдуман на
            месте, хотя §3.2 даёт Subheadline 15/20 = 1.333. Так три из четырёх
            свойств роли расходятся по файлам поодиночке, и роли не остаётся.
            Закрывается переводом на `tk.type.*` или класс `.t-*`.

ПРАВИЛО 4 — TS-зеркало не изобретает. Каждый `var(--x)` в `ui/tokens.ts` обязан
            быть объявлен в `globals.css`. Токен, живущий только в зеркале, —
            это число, которое браузер возьмёт из воздуха.

Запуск: python3 tools/ios26-tokens.py
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSS = ROOT / "apps" / "web" / "src" / "ui" / "globals.css"
TS = ROOT / "apps" / "web" / "src" / "ui" / "tokens.ts"
STANDARD = ROOT / "docs" / "design" / "ios26" / "STANDARD_ios26_css.md"
BASELINE = ROOT / "tools" / "ios26-tokens-baseline.json"

ADDR = re.compile(
    r"^/\*\s*(?:(?P<m>📐|⚠)\s*(?P<sec>\d+\.\d+)"
    r"|(?P<a>🍎)(?:\s*\d+\.\d+)?"
    r"|(?P<d>⚙️)|(?P<b>🎨)|(?P<h>🕳))(?:\s|·|\*|$)"
)
DECL = re.compile(r"^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);(.*)$")


def root_block(text: str):
    """Объявления блока `:root` верхнего уровня, с номерами строк."""
    lines = text.splitlines()
    start = next(i for i, l in enumerate(lines) if l.strip() == ":root {")
    depth, out = 0, []
    for i in range(start, len(lines)):
        bare = re.sub(r"/\*.*?\*/", "", lines[i])
        depth += bare.count("{") - bare.count("}")
        m = DECL.match(lines[i])
        if m and i > start:
            out.append((i + 1, m.group(1), m.group(3).strip()))
        if depth <= 0 and i > start:
            break
    return out


def main() -> int:
    fail = []
    css = CSS.read_text(encoding="utf-8")
    std = STANDARD.read_text(encoding="utf-8")
    decls = root_block(css)

    # существующие разделы стандарта: «### 5.19» и «## 4.»
    live = set(re.findall(r"^#{2,4}\s+(\d+\.\d+)", std, flags=re.M))
    live |= {f"{n}." for n in re.findall(r"^##\s+(\d+)\.", std, flags=re.M)}

    holes, devs = [], []
    for ln, name, tail in decls:
        m = ADDR.match(tail)
        if not m:
            fail.append(f"{CSS.name}:{ln}  {name} — НЕТ АДРЕСА ЗАМЕРА (правило 1)")
            continue
        if m.group("h"):
            holes.append(name)
        elif m.group("m") == "⚠":
            devs.append(name)
        sec = m.group("sec")
        if sec and sec not in live:
            fail.append(f"{CSS.name}:{ln}  {name} — адрес §{sec} не найден "
                        f"в стандарте (правило 2)")

    # правило 4 — зеркало не изобретает
    declared = {n for _, n, _ in decls}
    declared |= set(re.findall(r"^\s*(--[a-z0-9-]+)\s*:", css, flags=re.M))
    for ref in sorted(set(re.findall(r"var\((--[a-z0-9-]+)\)", TS.read_text(encoding="utf-8")))):
        if ref not in declared:
            fail.append(f"{TS.name}  {ref} — есть в зеркале, нет в globals.css (правило 4)")

    # правило 5 — компонент не изобретает типографику
    lits = 0
    LIT = re.compile(r"(?:fontSize|lineHeight|letterSpacing):\s*['\"]?-?[0-9]")
    web = ROOT / "apps" / "web" / "src"
    for f in web.rglob("*.tsx"):
        lits += len(LIT.findall(f.read_text(encoding="utf-8")))

    # правило 3 — храповик
    base = json.loads(BASELINE.read_text(encoding="utf-8")) if BASELINE.exists() else {}
    cap_h, cap_d = base.get("holes", len(holes)), base.get("deviations", len(devs))
    cap_t = base.get("total", len(holes) + len(devs))
    cap_l = base.get("literals", lits)
    if lits > cap_l:
        fail.append(f"храповик литералов: {lits} > {cap_l}. Кегль, интерлиньяж и "
                    f"трекинг берутся ролью (`tk.type.*` / `.t-*`), а не числом "
                    f"на месте (правило 5)")
    if len(holes) > cap_h:
        fail.append(f"храповик 🕳: {len(holes)} > {cap_h}. Новый токен без замера "
                    f"не заводят — сначала замер (правило 3)")
    if len(devs) > cap_d:
        fail.append(f"храповик ⚠: {len(devs)} > {cap_d}. Новое расхождение "
                    f"со стандартом не заводят (правило 3)")
    if len(holes) + len(devs) > cap_t:
        fail.append(f"храповик СУММЫ: {len(holes) + len(devs)} > {cap_t}. Корзины "
                    f"можно перебалансировать с объяснением, общий долг — только "
                    f"вниз (правило 3)")

    print(f"токенов :root — {len(decls)}   "
          f"📐/🍎/⚙️/🎨 обосновано — {len(decls) - len(holes) - len(devs)}   "
          f"🕳 не снято — {len(holes)}/{cap_h}   ⚠ расходится — {len(devs)}/{cap_d}   "
          f"долг всего — {len(holes) + len(devs)}/{cap_t}   "
          f"литералов в tsx — {lits}/{cap_l}")

    if fail:
        print("\nЗКН-Д028 — ГЕЙТ КРАСНЫЙ:")
        for f in fail:
            print("  ×", f)
        return 1
    print("ЗКН-Д028 — зелёный")
    return 0


if __name__ == "__main__":
    sys.exit(main())
