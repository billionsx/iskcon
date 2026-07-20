#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ГЕЙТ: файл сверки обязан рисовать то же, что мокап.

Сверка собирается из мокапа переносом стилей на другую страницу, и на этом переносе
легко потерять правило. Так и вышло: шрифт в мокапе висит на `html,body`, а я при
сборке это правило вырезал — `.stage` в сверке наследовал шрифт страницы, заголовок
рисовался не тем начертанием и лез вправо. В моих замерах этого не было видно, потому
что я мерил мокап, а основатель смотрел сверку.

Гейт открывает оба файла и сравнивает ВЫЧИСЛЕННЫЕ стили каждой строки: семейство,
кегль, вес, трекинг, координаты. Расхождение — красный свет.

Запуск: python3 tools/ios26-verify-gate.py
"""
import json
import pathlib
import subprocess
import sys

PROBE = r"""
const { chromium } = require('%(pw)s');
(async () => {
  const b = await chromium.launch({ executablePath:'/opt/google/chrome/chrome', args:['--no-sandbox'] });
  const p = await b.newPage({ viewport:{width:900,height:1100}, deviceScaleFactor:3 });
  await p.goto('file://' + process.argv[process.argv.length-1]);
  await p.waitForTimeout(1400);
  const r = await p.evaluate(() => {
    const out = [];
    document.querySelectorAll('.stage [data-w], .stage .t').forEach(el => {
      const cs = getComputedStyle(el);
      out.push({
        t: (el.textContent||'').slice(0,20),
        ff: cs.fontFamily.split(',')[0].replace(/"/g,''),
        fs: cs.fontSize, fw: cs.fontWeight,
        ls: (el.style.letterSpacing||'0px'),
        l: Math.round(parseFloat(cs.left)*100)/100,
        tp: Math.round(parseFloat(cs.top)*100)/100
      });
    });
    return out;
  });
  console.log(JSON.stringify(r));
  await b.close();
})();
"""


def probe(path, pw):
    js = pathlib.Path('/tmp/_probe.js')
    js.write_text(PROBE % {'pw': pw})
    r = subprocess.run(['node', str(js), path], capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[:400]); return None
    return json.loads(r.stdout.strip().splitlines()[-1])


def main():
    pw = '/home/claude/iskcon/node_modules/playwright-core'
    mock = '/home/claude/iskcon/docs/design/ios26/mockups/fitness/f03.html'
    ver = '/mnt/user-data/outputs/fitness-f03-сверка.html'
    if not pathlib.Path(ver).exists():
        print("файла сверки нет — гейт пропущен"); return 0
    a, b = probe(mock, pw), probe(ver, pw)
    if a is None or b is None:
        print("не удалось снять стили"); return 1
    if len(a) != len(b):
        print(f"🔴 разное число строк: мокап {len(a)} · сверка {len(b)}"); return 1
    bad = []
    for x, y in zip(a, b):
        for k, name in (('ff','семейство'), ('fs','кегль'), ('fw','вес'),
                        ('ls','трекинг'), ('l','левый край'), ('tp','верх')):
            if x[k] != y[k]:
                bad.append(f"  «{x['t']}» · {name}: мокап {x[k]} ≠ сверка {y[k]}")
    if bad:
        print(f"🔴 сверка рисует НЕ ТО, что мокап — расхождений {len(bad)}:")
        for line in bad[:12]:
            print(line)
        return 1
    print(f"🟢 сверка совпадает с мокапом по всем {len(a)} строкам")
    return 0


if __name__ == "__main__":
    sys.exit(main())
