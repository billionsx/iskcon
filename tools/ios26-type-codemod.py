#!/usr/bin/env python3
"""
Кодмод: интерфейсный интерлиньяж и трекинг → РОЛЬ.

Три глобальные константы не выражают одиннадцать ролей §3.2: у Body трекинг
−0.0253em, у Large Title +0.0118em — они разного ЗНАКА. Замена не может быть
«на глаз»: роль определяется КЕГЛЕМ, который стоит в том же объекте стиля.
Поэтому кодмод читает объект целиком и берёт роль оттуда.

Проза не трогается: `--leading-normal` держит абзац сплошного текста, а среди
217 кадров такого экрана нет — переносить туда интерфейсный 1.30 значило бы
взять число из чужого контекста.

Запуск: python3 tools/ios26-type-codemod.py [--dry]
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "apps" / "web" / "src"

ROLES = ("display", "title1", "title2", "title3", "headline", "body",
         "callout", "subhead", "footnote", "caption2", "caption")

FS = re.compile(r"fontSize:\s*(?:tk\.text\.(\w+)|['\"]var\(--text-([a-z0-9]+)\)['\"])")
OLD_LH = re.compile(r"lineHeight:\s*(?:tk\.leading\.(tight|snug)|['\"]var\(--leading-(tight|snug)\)['\"])")
OLD_LS = re.compile(r"letterSpacing:\s*(?:tk\.tracking\.(tight|wide|normal)|['\"]var\(--tracking-(tight|wide|normal)\)['\"])")


def blocks(text: str):
    """Балансированные объекты стиля: `style={{ … }}` и `style={ … }`."""
    out, i = [], 0
    while True:
        m = re.search(r"style=\{\{?", text[i:])
        if not m:
            break
        start = i + m.end() - 1          # на первой `{`
        depth, j = 0, start
        while j < len(text):
            if text[j] == "{":
                depth += 1
            elif text[j] == "}":
                depth -= 1
                if depth == 0:
                    break
            j += 1
        out.append((start, j + 1))
        i = j + 1
    return out


def main() -> int:
    dry = "--dry" in sys.argv
    total, files, skipped = 0, 0, []
    for p in sorted(SRC.rglob("*.tsx")):
        text = p.read_text(encoding="utf-8")
        if not (OLD_LH.search(text) or OLD_LS.search(text)):
            continue
        out, changed = text, 0
        for a, b in reversed(blocks(text)):
            blk = text[a:b]
            if not (OLD_LH.search(blk) or OLD_LS.search(blk)):
                continue
            fs = FS.findall(blk)
            roles = {r for pair in fs for r in pair if r}
            if len(roles) != 1 or roles.pop() not in ROLES:
                # кегль условный или отсутствует — роль машиной не определить
                skipped.append(f"{p.relative_to(SRC)}: роль неоднозначна")
                continue
            role = [r for pair in fs for r in pair if r][0]
            ts = "tk." in blk
            nb = OLD_LH.sub(
                f"lineHeight: {'tk.type.' + role + '.lineHeight' if ts else chr(39) + f'var(--lh-{role})' + chr(39)}", blk)
            nb = OLD_LS.sub(
                f"letterSpacing: {'tk.type.' + role + '.letterSpacing' if ts else chr(39) + f'var(--ls-{role})' + chr(39)}", nb)
            if nb != blk:
                out = out[:a] + nb + out[b:]
                changed += 1
        if changed:
            files += 1
            total += changed
            if not dry:
                p.write_text(out, encoding="utf-8")
            print(f"  {p.relative_to(SRC)}: {changed}")
    print(f"объектов стиля переведено на роли: {total} в {files} файлах")
    if skipped:
        print(f"оставлено вручную ({len(skipped)}):")
        for s in dict.fromkeys(skipped):
            print("   ·", s)
    return 0


if __name__ == "__main__":
    sys.exit(main())
