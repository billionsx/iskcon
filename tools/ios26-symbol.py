#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ЗНАК ИЗ БИБЛИОТЕКИ APPLE ВМЕСТО ВЫРЕЗАННОЙ МАСКИ.

До сих пор каждый знак снимался с кадра альфа-маской: точно, но это растр, он не
масштабируется и тащит за собой ошибки съёмки. Пакет `sf-symbols-lib` (npm) содержит
векторные пути тех же символов, и знак можно взять готовым.

ВАЖНО ПРО ПРАВА. MIT в пакете относится к обёртке, а не к самим символам: они
принадлежат Apple, и лицензия разрешает их только в приложениях для платформ Apple.
Для НАШИХ ЭТАЛОНОВ это допустимо — мокап воспроизводит чужой экран для изучения. Для
продакшена в вебе брать их нельзя; там нужен свой знак или открытый набор.
Поэтому извлечённые пути живут в docs/ рядом с мокапами, а не в apps/web.

Запуск: python3 tools/ios26-symbol.py <ИмяЗнака> [ещё имена]
        python3 tools/ios26-symbol.py --search ходьба
"""
import json
import pathlib
import re
import sys

LIB = pathlib.Path('/home/claude/sfsym/node_modules/sf-symbols-lib/dist/monochrome/icons')
OUT = pathlib.Path('/home/claude/iskcon/docs/design/ios26/symbols')


def extract(name):
    f = LIB / f"SF{name}.js"
    if not f.exists():
        return None
    src = f.read_text(encoding='utf-8', errors='replace')
    m = re.search(r"const \w+ = '(<g>.*?</g>)'", src, re.S)
    if not m:
        return None
    body = m.group(1)
    vb = re.search(r'viewBox:\s*"([^"]+)"', src)
    paths = re.findall(r'<path\s+d="([^"]+)"', body)
    rect = re.search(r'<rect height="([\d.]+)"[^>]*width="([\d.]+)"', body)
    return dict(name=name, paths=paths,
                box=[float(rect.group(2)), float(rect.group(1))] if rect else None,
                viewBox=vb.group(1) if vb else None)


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return 2
    if args[0] == '--search':
        pat = args[1].lower()
        hits = [p.stem[2:] for p in LIB.glob('SF*.js') if pat in p.stem.lower()]
        print(f"найдено {len(hits)}:")
        for h in sorted(hits)[:40]:
            print("  ", h)
        return 0
    OUT.mkdir(parents=True, exist_ok=True)
    got = {}
    for name in args:
        d = extract(name)
        if not d:
            print(f"  {name}: не найден")
            continue
        got[name] = d
        print(f"  {name}: {len(d['paths'])} контур(ов), габарит {d['box']}")
    if got:
        (OUT / 'symbols.json').write_text(json.dumps(got, ensure_ascii=False, indent=1),
                                          encoding='utf-8')
        print(f"сохранено в {OUT/'symbols.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
