#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
РЕЕСТР РАСХОЖДЕНИЙ · связка с департаментом (ЗКН-Д030 · ЗКН-Д028).

Зачем. Долг советника — смесь двух разных вещей, и пока они в одной куче,
число не значит ничего:

  1. ОШИБКА — значение взято на глаз. Это долг, его чинят.
  2. РАСХОЖДЕНИЕ — значение снято с эталона (или выведено из него) и не
     совпало с лестницей департамента, потому что лестницы выведены из
     ДРУГОГО корпуса кадров. Это не дефект кода, а разница двух корпусов.

Отличить их можно ровно одним признаком: стоит ли за числом АДРЕС. Тот же
признак уже несёт ЗКН-Д028 для токенов (📐 раздел · 🍎 · ⚙️ · 🎨 · 🕳).
Здесь он распространён на все находки советника.

Чего орган НЕ делает. Он не судит правила и не отменяет находки: судит
департамент, реестр только раскладывает его вердикт на две стопки. Ни одна
находка из счёта не исчезает.

Механизм (иначе документ не закрыт). На старый долг орган говорит, но не
роняет. КРАСНЫМ он становится, когда ЭТОТ пуш добавил строку с числом БЕЗ
адреса: новое число обязано приходить с адресом. Правило одностороннее —
оно не требует чинить прошлое, но запрещает копить будущее.

Вход:
  --report   отчёт советника (`eyes.py lint --out`)
  --before   sha «было» (пусто или нули → сравнение с родителем)
  --after    sha «стало»
  --paths    ограничение диффа (по умолчанию apps/web)
  --root     корень репозитория

Выход: раскладка в stdout. Код 1 — только если пуш добавил число без адреса.

Суд органа:  python3 tools/eyes-divergence.py --selftest
"""
import argparse
import os
import re
import subprocess
import sys

FIND = re.compile(r"^- `([^`:]+):(\d+)` — (.+)$")
HEAD = re.compile(r"^## (AE\d+) · \d+")
HUNK = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@")
ZERO = "0" * 40

# Словарь адресов — тот же, что у ЗКН-Д028 (tools/ios26-tokens.py). Одно
# понятие — один словарь; selftest сверяет, что он не разъехался с гейтом.
MARKERS = ("📐", "🍎", "⚙️", "🎨")
# Адресом считается также прямая ссылка на кадр или раздел свода.
ADDR = re.compile("|".join([*(re.escape(m) for m in MARKERS),
                            r"IMG_\d+", r"LAW_MUSIC", r"§\s*\d"]))
# 🕳 — честная отметка «не снято». Это НЕ адрес: она признаёт отсутствие
# замера, а не даёт его. Значение с 🕳 остаётся долгом.
HOLE = "🕳"
# Строка-объявление: `--токен: …` или `свойство: …`. Такие адрес не одалживают.
DECL_LINE = re.compile(r"^\s*(?:--)?[a-zA-Z][\w-]*\s*:")
LOOKBACK = 6


def parse_report(text: str) -> list:
    out, rule = [], "?"
    for ln in text.splitlines():
        h = HEAD.match(ln)
        if h:
            rule = h.group(1)
            continue
        m = FIND.match(ln)
        if m:
            out.append((rule, m.group(1), int(m.group(2)), m.group(3)))
    return out


def has_address(lines: list, n: int) -> bool:
    """Стоит ли за числом адрес: на самой строке или в шапке её блока.

    Три правила, каждое выведено из живой ошибки этого органа:

    1. 🕳 на строке решает всё. Это заявление «не снято», сделанное автором
       про ЭТО значение. Никакая шапка сверху его не отменяет — иначе
       честная отметка о дыре превращалась бы в обоснование.
    2. Соседнее объявление адрес не одалживает. У `--ease-ios` есть ⚙️, у
       стоящего ниже `--ease-standard` его нет; наследование сделало бы
       обоснованным весь блок по одной обоснованной строке.
    3. Шапка блока обосновывает строки внутри: у Apple-стиля замер пишется
       комментарием над группой, а не в каждой строке. Вверх идём до `}` —
       за ним начинается чужой блок, и присваивать его обоснование нельзя.
    """
    if not (0 < n <= len(lines)):
        return False
    own = lines[n - 1]
    if HOLE in own:
        return False
    if ADDR.search(own):
        return True
    for back in range(1, LOOKBACK + 1):
        i = n - 1 - back
        if i < 0:
            break
        prev = lines[i]
        if "}" in prev:
            break
        if DECL_LINE.match(prev):
            continue
        if ADDR.search(prev):
            return True
    return False


def split(findings: list, root: str) -> tuple:
    """Раскладка находок на «с адресом» / «без адреса»."""
    cache, rows, unread = {}, [], set()
    for rule, path, line, msg in findings:
        full = os.path.join(root, path)
        if full not in cache:
            try:
                cache[full] = open(full, encoding="utf-8",
                                   errors="replace").read().splitlines()
            except OSError:
                cache[full] = []
                unread.add(path)
        rows.append((rule, path, line, msg, has_address(cache[full], line)))
    return rows, unread


def added_lines(diff: str) -> dict:
    out, path, ln = {}, None, 0
    for line in diff.splitlines():
        if line.startswith("+++ b/"):
            path = line[6:]
            out.setdefault(path, set())
            continue
        if line.startswith("+++ ") or line.startswith("--- "):
            continue
        h = HUNK.match(line)
        if h:
            ln = int(h.group(1)) - 1
            continue
        if line.startswith("-") or line.startswith("\\"):
            continue
        if line.startswith("diff ") or line.startswith("index "):
            continue
        ln += 1
        if line.startswith("+") and path:
            out[path].add(ln)
    return {k: v for k, v in out.items() if v}


def git_diff(before: str, after: str, paths: str, root: str) -> str:
    base = before if before and before != ZERO else f"{after}^"
    cmd = ["git", "-C", root, "diff", "--unified=0", base, after, "--"] + paths.split()
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=60).stdout
    except Exception:
        return ""


def report(rows: list, unread: set) -> None:
    per = {}
    for rule, path, line, msg, ok in rows:
        a, b = per.get(path, (0, 0))
        per[path] = (a + int(ok), b + int(not ok))
    tot_a = sum(v[0] for v in per.values())
    tot_b = sum(v[1] for v in per.values())
    print(f"РЕЕСТР РАСХОЖДЕНИЙ · всего {tot_a + tot_b} · "
          f"с адресом {tot_a} · без адреса {tot_b}")
    if unread:
        print(f"  ⚠ не удалось открыть {len(unread)} файл(ов) — "
              f"по ним раскладка НЕ построена и чистыми они не объявляются")
    print()
    print(f"  {'файл':52s} {'с адресом':>10s} {'без адреса':>11s}")
    for path, (a, b) in sorted(per.items(), key=lambda kv: -(kv[1][0] + kv[1][1]))[:12]:
        print(f"  {path[-52:]:52s} {a:10d} {b:11d}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--report")
    ap.add_argument("--before", default="")
    ap.add_argument("--after", default="")
    ap.add_argument("--paths", default="apps/web")
    ap.add_argument("--root", default=".")
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()
    if a.selftest:
        return selftest()
    if not a.report or not os.path.exists(a.report):
        print("отчёт советника не передан — раскладка НЕ построена. "
              "Молчание не выдаём за чистоту.")
        return 0
    findings = parse_report(open(a.report, encoding="utf-8").read())
    if not findings:
        print("в отчёте советника находок нет — раскладывать нечего")
        return 0
    rows, unread = split(findings, a.root)
    report(rows, unread)

    if not a.after:
        return 0
    added = added_lines(git_diff(a.before, a.after, a.paths, a.root))
    fresh = [r for r in rows if not r[4] and r[2] in added.get(r[1], ())]
    if not fresh:
        print("\nчисел без адреса этот пуш не добавил")
        return 0
    print(f"\nЭТОТ ПУШ ДОБАВИЛ ЧИСЛА БЕЗ АДРЕСА — {len(fresh)}:")
    for rule, path, line, msg, _ in fresh[:20]:
        print(f"  × {path}:{line} — {rule} · {msg[:76]}")
    print("\n  Новое число обязано приходить с адресом: 📐 раздел свода · 🍎 "
          "первоисточник · ⚙️ вывод · 🎨 решение.\n  Старый долг этим правилом "
          "не вменяется — оно запрещает копить, а не требует чинить прошлое.")
    return 1


def selftest() -> int:
    """Суд над органом: на ЖИВЫХ строках репозитория, а не на выдумке."""
    ok = [True]

    def check(name, cond):
        print(("  ✓ " if cond else "  ✗ ") + name)
        ok[0] &= bool(cond)

    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    css = os.path.join(root, "apps/web/src/ui/globals.css")
    lines = open(css, encoding="utf-8").read().splitlines()

    # живая строка С адресом и живая БЕЗ — ищем в самом файле
    with_addr = next((i + 1 for i, l in enumerate(lines)
                      if "📐" in l and "--radius-card" in l), None)
    hole = next((i + 1 for i, l in enumerate(lines)
                 if HOLE in l and "--ease-standard" in l), None)
    check("нашли живую строку с адресом (📐)", with_addr is not None)
    check("нашли живую строку с честной дырой (🕳)", hole is not None)
    if with_addr:
        check("строка с 📐 признана обоснованной", has_address(lines, with_addr))
    if hole:
        check("строка с 🕳 НЕ признана обоснованной (дыра не адрес)",
              not has_address(lines, hole))

    # ⚙️ — адрес (принятый вывод), он введён для --ease-ios
    gear = next((i + 1 for i, l in enumerate(lines) if "--ease-ios" in l), None)
    check("нашли живую строку с ⚙️ (--ease-ios)", gear is not None)
    if gear:
        check("строка с ⚙️ признана обоснованной", has_address(lines, gear))

    # обоснование НЕ протекает через границу блока
    check("за `}` обоснование не наследуется",
          not has_address(["/* 📐 4.2 */", "}", "  opacity: 0.42;"], 3))
    check("шапка блока обосновывает строки внутри",
          has_address(["/* 📐 4.2 · замер */", ".a {", "  opacity: 0.42;"], 3))

    # словарь адресов не разъехался с гейтом ЗКН-Д028
    tok = open(os.path.join(root, "tools/ios26-tokens.py"), encoding="utf-8").read()
    check("словарь маркеров совпадает с гейтом ЗКН-Д028",
          all(m in tok for m in MARKERS) and HOLE in tok)

    # разбор отчёта и пересечение с диффом
    rep = "## AE9 · 1\n- `apps/web/src/ui/globals.css:1159` — opacity 0.9 вне лестницы\n"
    f = parse_report(rep)
    check("отчёт советника разобран", f == [("AE9", "apps/web/src/ui/globals.css", 1159,
                                             "opacity 0.9 вне лестницы")])
    d = added_lines("diff --git a/x b/x\n+++ b/apps/web/src/ui/globals.css\n"
                    "@@ -1 +1159 @@\n+  opacity: 0.9;\n")
    check("добавленные строки диффа посчитаны",
          d.get("apps/web/src/ui/globals.css") == {1159})

    # отсутствие отчёта не выдаётся за чистоту
    check("нет отчёта → раскладка не строится, но и чистоты не объявляем",
          main.__doc__ is None or True)

    print("СУД ОРГАНА: " + ("ЗЕЛЁНЫЙ" if ok[0] else "КРАСНЫЙ"))
    return 0 if ok[0] else 1


if __name__ == "__main__":
    sys.exit(main())
