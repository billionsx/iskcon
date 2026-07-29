#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
НОВЫЕ НАРУШЕНИЯ ЭТОГО ПУША · связка с департаментом (ЗКН-Д030).

Что это и чего это НЕ делает. Судит департамент: правила, законы и числа
живут в billionsx/eyes и сюда не переезжают. Здесь только пересечение —
взять вердикт департамента (отчёт советника с адресами файл:строка) и
оставить те находки, что стоят на строках, добавленных ЭТИМ пушем.

Зачем отдельно от храповика. Храповик говорит «долг вырос на 2» — верно,
но не показывает пальцем. Разработчику нужен адрес: какая строка, какое
правило, что не так. Старый долг при этом остаётся долгом и не вменяется
тому, кто тронул соседнюю строку.

Прежде чем говорить о строках, орган доказывает, что строки настоящие:
открывает файл на названном адресе и смотрит, стоит ли там то, о чём речь.
Если адреса не сходятся — он молчит по делу и говорит почему, а не выдаёт
ноль находок за чистоту.

Вход:
  --report   отчёт советника (`eyes.py lint --out`)
  --before   sha «было» (пусто или нули → сравнение с родителем)
  --after    sha «стало»
  --paths    ограничение диффа (по умолчанию apps/web)

Выход: текст замечаний в stdout, код 0 всегда — это речь, а не вето.

Суд органа:  python3 tools/eyes-newfindings.py --selftest
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
MAX_SHOW = 40

# Отпечаток правила в строке: чем доказать, что адрес указывает на то самое
# место. Ключ — по слову из сообщения департамента, а не по номеру правила:
# номера могут добавляться, слова в сообщении несут смысл.
MARK = (("border-radius", "border-radius"), ("letter-spacing", "letter-spacing"),
        ("opacity", "opacity"), ("backdrop-filter", "backdrop-filter"),
        ("font-family", "font-family"), ("font-size", "font-size"),
        ("фон ", "background"), ("свечение/тень", "shadow"))


def parse_report(text: str) -> list:
    """Отчёт советника → [(правило, путь, строка, сообщение)]."""
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


def added_lines(diff: str) -> dict:
    """Унифицированный дифф → {путь: {номера ДОБАВЛЕННЫХ строк}}.

    Считается номер в новой версии. Удалённые строки счётчик не двигают:
    иначе адреса поедут и замечание встанет не на ту строку.
    """
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


def expected_mark(msg: str):
    """Что обязано стоять в строке, если адрес верен. None — проверить нечем."""
    for key, mark in MARK:
        if msg.startswith(key) or key in msg[:24]:
            return mark
    return None


def addresses_hold(findings: list, root: str = ".", sample: int = 80) -> tuple:
    """Суд над адресами: открыть файл на названной строке и убедиться, что
    там правда то, о чём речь.

    Если адреса поедут, пересечение с диффом молча вернёт ноль — и «новых
    нарушений нет» будет означать «мы не смогли посмотреть». Отсутствие
    проверки нельзя предъявлять как чистоту (ЗКН-Э001).

    Возврат: (доля сошедшихся, сколько проверено, пример расхождения).
    """
    ok = seen = 0
    example, cache = None, {}
    for rule, path, line, msg in findings[:sample]:
        mark = expected_mark(msg)
        if mark is None:
            continue
        full = os.path.join(root, path)
        if full not in cache:
            try:
                cache[full] = open(full, encoding="utf-8",
                                   errors="replace").read().splitlines()
            except OSError:
                cache[full] = []
        lines = cache[full]
        if not lines:
            continue
        seen += 1
        got = lines[line - 1] if 0 < line <= len(lines) else ""
        if mark.lower() in got.lower():
            ok += 1
        elif example is None:
            example = (rule, path, line, mark, got.strip()[:60])
    return ((ok / seen) if seen else 1.0), seen, example


def pick(findings: list, added: dict) -> list:
    """Находки на добавленных строках. Порядок детерминирован: один и тот же
    пуш обязан давать один и тот же текст, иначе замечание нельзя сверить."""
    seen, hits = set(), []
    for rule, path, line, msg in findings:
        key = (path, line, rule)
        if path in added and line in added[path] and key not in seen:
            seen.add(key)
            hits.append((rule, path, line, msg))
    return sorted(hits, key=lambda h: (h[1], h[2], h[0]))


def render(hits: list, touched: int, sha: str) -> str:
    if not hits:
        return (f"BXE · этот пуш не добавил нарушений: тронуто добавленных строк "
                f"{touched}, новых находок 0.\nСтарый долг проекта остаётся долгом "
                f"и здесь не вменяется.")
    rows = "\n".join(f"- `{p}:{l}` — **{r}** — {m}" for r, p, l, m in hits[:MAX_SHOW])
    tail = (f"\n…и ещё {len(hits) - MAX_SHOW}." if len(hits) > MAX_SHOW else "")
    return (f"## BXE · новые нарушения этого пуша\n"
            f"Добавленных строк: {touched} · новых находок: **{len(hits)}**\n\n"
            f"{rows}{tail}\n\n"
            f"Коммит `{sha[:9]}`. Судит департамент billionsx/eyes; здесь только "
            f"пересечение его вердикта с диффом. Замечания сборку не роняют.")


def git_diff(before: str, after: str, paths: str) -> str:
    rng = f"{before}..{after}" if before and before != ZERO else f"{after}~1..{after}"
    base = ["git", "diff", "--unified=0", "--no-color"]
    r = subprocess.run(base + [rng, "--"] + paths.split(","),
                       capture_output=True, text=True)
    if r.returncode != 0:
        r = subprocess.run(base + [after, "--"] + paths.split(","),
                           capture_output=True, text=True)
    return r.stdout


def selftest() -> int:
    ok = True

    def check(name, cond):
        nonlocal ok
        print(("  ✓ " if cond else "  ✗ ") + name)
        ok = ok and cond

    print("СУД · новые нарушения пуша (без сети и без git)")
    rep = ("# BXE · отчёт\n\n## AE1 · 2\n"
           "- `a.css:5` — фон #FFF вне лестницы\n"
           "- `a.css:9` — фон #EEE вне лестницы\n\n"
           "## AE2 · 1\n- `b.tsx:2` — свечение/тень на чёрном холсте\n")
    f = parse_report(rep)
    check("отчёт разобран: правило, путь, строка, сообщение",
          f == [("AE1", "a.css", 5, "фон #FFF вне лестницы"),
                ("AE1", "a.css", 9, "фон #EEE вне лестницы"),
                ("AE2", "b.tsx", 2, "свечение/тень на чёрном холсте")])
    diff = ("diff --git a/a.css b/a.css\n--- a/a.css\n+++ b/a.css\n"
            "@@ -4,0 +5 @@\n+.x{background:#FFF}\n"
            "@@ -10,2 +11,0 @@\n-.gone{}\n-.gone2{}\n"
            "diff --git a/b.tsx b/b.tsx\n--- a/b.tsx\n+++ b/b.tsx\n"
            "@@ -1,0 +2 @@\n+<div/>\n")
    a = added_lines(diff)
    check("дифф разобран: добавленные строки точны, удалённые счётчик не двигают",
          a == {"a.css": {5}, "b.tsx": {2}})
    got = pick(f, a)
    check("ломаю → красный: тронутая строка названа с правилом",
          [(r, p, l) for r, p, l, _ in got] == [("AE1", "a.css", 5), ("AE2", "b.tsx", 2)])
    check("чиню → зелёный: строка 9 не тронута пушем и не вменяется",
          all(l != 9 for _, _, l, _ in got))
    check("пустой дифф → ни одной находки, даже когда отчёт полон", pick(f, {}) == [])
    check("порядок детерминирован", pick(list(reversed(f)), a) == got)

    import tempfile
    d = tempfile.mkdtemp()
    os.makedirs(os.path.join(d, "s"), exist_ok=True)
    with open(os.path.join(d, "s", "x.css"), "w", encoding="utf-8") as fh:
        fh.write("a{}\nb{}\n.z{border-radius:22px}\n")
    good = [("AE11", "s/x.css", 3, "border-radius 22px вне лестницы")]
    bad = [("AE11", "s/x.css", 1, "border-radius 22px вне лестницы")]
    check("адрес сошёлся → доля 100%", addresses_hold(good, d)[0] == 1.0)
    sh, sn, exx = addresses_hold(bad, d)
    check("адрес уехал → доля 0%, расхождение показано с уликой",
          sh == 0.0 and sn == 1 and exx is not None and exx[3] == "border-radius")

    t0 = render([], 7, "abcdef1234")
    check("чистый пуш получает ответ и не выдаёт себя за чистый проект",
          "новых находок 0" in t0 and "остаётся долгом" in t0)
    t1 = render(got, 7, "abcdef1234")
    check("речь адресна", "`a.css:5`" in t1 and "**AE1**" in t1)
    print("СУД зелёный" if ok else "СУД КРАСНЫЙ")
    return 0 if ok else 1


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--report")
    ap.add_argument("--before", default="")
    ap.add_argument("--after", default="HEAD")
    ap.add_argument("--paths", default="apps/web")
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()
    if a.selftest:
        return selftest()
    findings = parse_report(open(a.report, encoding="utf-8").read())
    share, seen, ex = addresses_hold(findings)
    if seen and share < 0.8:
        print("BXE · НАДЗОР ПО СТРОКАМ НЕ ПРОВОДИТСЯ: адреса департамента "
              "не сходятся с файлами.")
        print(f"Проверено адресов: {seen} · сошлось: {share:.0%} (нужно от 80%).")
        if ex:
            r, p, l, mark, gotln = ex
            print(f"Пример: {r} указывает на {p}:{l} — там ожидалось «{mark}», "
                  f"а стоит «{gotln}».")
        print("")
        print("Счётчики находок при этом верны: храповик долга и вердикт гейта "
              "не затронуты. Сломана адресация — `bin/lint.py` департамента "
              "заменяет блочный комментарий одним пробелом и теряет переводы "
              "строк внутри него, после чего номера строк едут вверх.")
        print("Пока адреса не починены, орган молчит по делу, а не выдаёт ноль "
              "находок за чистоту (ЗКН-Э001).")
        return 0
    added = added_lines(git_diff(a.before, a.after, a.paths))
    touched = sum(len(v) for v in added.values())
    print(render(pick(findings, added), touched, a.after))
    return 0


if __name__ == "__main__":
    sys.exit(main())
