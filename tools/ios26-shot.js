// ЗКН-Д026 · снимок мокапа для сверки с кадром.
// Мокап рисуется в headless Chrome при deviceScaleFactor 3 — тот же 1179×2556,
// что у эталона, поэтому картинки вычитаются попиксельно без пересчёта.
// Флаги гасят всё, что делает рендер непроверяемым: цветовой профиль
// приколот к sRGB, субпиксельное сглаживание и хинтинг выключены.
const path = require('path');
const { chromium } = require(process.env.PW || 'playwright-core');
(async () => {
  const [src, out, scale] = process.argv.slice(2);
  const b = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/google/chrome/chrome',
    args: ['--no-sandbox', '--force-color-profile=srgb',
           '--disable-lcd-text', '--font-render-hinting=none'] });
  const p = await b.newPage({ viewport: { width: 393, height: 852 },
                              deviceScaleFactor: Number(scale || 3) });
  await p.goto('file://' + path.resolve(src));
  await p.waitForTimeout(400);
  const el = await p.$('.stage');
  if (!el) { console.error('в файле нет .stage'); process.exit(2); }
  await el.screenshot({ path: out });
  await b.close();
})();
