#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ЗКН-Д026 · КАРКАС МОКАПА.

Кадр 1 собирался одним самодельным скриптом. Для тридцати трёх кадров одного
продукта и двухсот семнадцати всего это не годится: общее — статусбар, слой,
шрифтовые метрики, суперэллипс, блок замеров — обязано быть построено один раз.
`MAP_surfaces.md` §4a называет это прямо: первые семь компонентов держат больше
половины вёрстки.

Что здесь лежит:

* `squircle` — путь суперэллипса. На радиусах больше 12 pt дуга ошибается на
  единицы пикселей, а суперэллипс садится на кромку; поэтому углы режутся
  `clip-path: path()`, а не `border-radius`.
* `PX_RATIO` и `varblock` — печать блока замеров. Безразмерная величина НЕ
  получает единицу: `calc(var(--k)*var(--fs))` с двумя длинами недействителен,
  и браузер молча выбрасывает всю декларацию. Именно так развалился кадр 1.
* `FONT_FACE` — подменное начертание с метриками SF Pro. Стоит в цепочке ПОСЛЕ
  настоящих имён Apple: на Mac берётся настоящий SF Pro, в песочнице и на любой
  не-Apple машине — запасное, приведённое к тем же метрикам. Без этого мокап
  нельзя проверить: подставленный шрифт сдвигает каждую строку на 1–3 pt.
* `RESET` — обнуление и правило про `svg`. Сплошной `*{position:absolute}`
  запрещён: он ловит и `<svg>` внутри `<i>`, тот начинает считать `width:100%`
  от ближайшего предка с позицией, и знак раздувается на всю карточку.
* `emit` — выпуск standalone-файла и парного `<кадр>.json` для гейта.

Единица — pt эталона. В CSS та же величина стоит в `px`, потому что при @1x они
совпадают, а `pt` в браузере равен ¹⁄₇₂ дюйма и растянул бы макет в 1.333 раза.
"""
import json
import math
from pathlib import Path

STAGE_W, STAGE_H = 393, 852

FONT_FACE = """/* Подменное начертание с метриками SF Pro (em 1000: asc 950 · desc 250 · cap 700).
   Стоит ПОСЛЕ настоящих имён Apple — на Mac берётся настоящий SF Pro. */
@font-face{font-family:"SFPro-metric";src:local("Inter Regular");font-weight:400;
 ascent-override:95%;descent-override:25%;line-gap-override:0%;size-adjust:96.2%}
@font-face{font-family:"SFPro-metric";src:local("Inter Medium");font-weight:500;
 ascent-override:95%;descent-override:25%;line-gap-override:0%;size-adjust:96.2%}
@font-face{font-family:"SFPro-metric";src:local("Inter SemiBold");font-weight:600;
 ascent-override:95%;descent-override:25%;line-gap-override:0%;size-adjust:96.2%}
@font-face{font-family:"SFPro-metric";src:local("Inter Bold");font-weight:700;
 ascent-override:95%;descent-override:25%;line-gap-override:0%;size-adjust:96.2%}"""

RESET = """*{margin:0;padding:0;box-sizing:border-box}
html,body{background:#0b0b0b;display:flex;justify-content:center;
 font-family:-apple-system,"SF Pro Display","SF Pro Text","SFPro-metric",system-ui,sans-serif;
 -webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}
.stage{position:relative;width:var(--stage-w);height:var(--stage-h);
 background:var(--canvas);overflow:hidden;color:var(--label)}
.stage>*{position:absolute}
.stage svg{position:static;display:block;width:100%;height:100%}
.t{line-height:1;white-space:nowrap}
.round{border-radius:50%;display:flex;align-items:center;justify-content:center}
.round>i,.round>span{position:static}"""

# Безразмерные величины: доли, показатели, коэффициенты. Единицу не получают.
PX_RATIO = {"cap-off", "bar-sat"}


def is_ratio(key):
    return key in PX_RATIO or key.startswith("tr-") or key.endswith("-n")


def squircle(w, h, r, n=2.55, seg=10):
    """Путь суперэллиптического прямоугольника w×h с углом r и показателем n."""
    def q(cx, cy, sx, sy):
        pts = []
        for i in range(seg + 1):
            t = i / seg * (math.pi / 2)
            c, s = math.cos(t), math.sin(t)
            x = cx + sx * r * (abs(c) ** (2.0 / n))
            y = cy + sy * r * (abs(s) ** (2.0 / n))
            pts.append((round(x, 2), round(y, 2)))
        return pts
    p = (q(r, r, -1, 0)[:1] + q(r, r, 0, -1)[::-1][1:] +
         q(w - r, r, 0, -1)[1:] + q(w - r, h - r, 0, 1)[::-1][1:] +
         q(r, h - r, 0, 1)[1:] + q(r, r, -1, 0)[::-1][1:])
    return "M" + " ".join(f"{x},{y}" for x, y in p) + "Z"


def varblock(V, ADDR=None):
    ADDR = ADDR or {}
    out = []
    for k, v in V.items():
        if k.endswith("-path"):
            out.append(f'  --{k}: "{v}";')
            continue
        s = v if not isinstance(v, (int, float)) else (f"{v}" if is_ratio(k) else f"{v}px")
        a = ADDR.get(k)
        out.append(f"  --{k}: {s};" + (f"  /* {a} */" if a else ""))
    return "\n".join(out)


HEAD = """<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<style>
/* ═══ БЛОК ЗАМЕРОВ ═══════════════════════════════════════════════════════
   Кадр: {frame} — 1179×2556 px = 393×852 pt @3x. Единица: pt эталона = px CSS.
   📐 снято · ⚙️ выведено · 🕳 долг. Литеральных чисел ниже блока быть не должно —
   их видит tools/ios26-mock.py. */
:root{{
{vars}
}}
/* конец блока замеров */
{font}
{reset}
{css}
</style></head>
<body>
<div class="stage">
{body}
</div>
{fit}
</body></html>
"""


FIT_SCRIPT = """
<script>
/* ЗКН-Д026 · ШИРИНА СТРОКИ — ЗАМЕР, ТРЕКИНГ — СЛЕДСТВИЕ.
   Трекинг у Apple живёт в таблице ВНУТРИ шрифта: система подставляет его сама на
   каждом кегле, а браузер этого не делает. Значит letter-spacing в мокапе обязан
   воспроизвести системный трекинг — но его величина зависит от того, каким шрифтом
   строка нарисована. На машине с SF Pro поправка одна, на машине без него — другая.
   Поэтому в мокапе хранится ЗАМЕР — ширина чернил строки, снятая с кадра, — а
   трекинг вычисляется на месте под тот шрифт, который реально доступен. Меряется
   через canvas: actualBoundingBox даёт чернила, а не рамку с боковыми отступами. */
(function(){
  var st = document.querySelector('.stage');
  if (!st) return;
  var ctx = document.createElement('canvas').getContext('2d');
  function num(name){ return parseFloat(getComputedStyle(st).getPropertyValue('--'+name)); }
  function ink(el, ls){
    var cs = getComputedStyle(el);
    ctx.font = cs.fontStyle+' '+cs.fontWeight+' '+cs.fontSize+' '+cs.fontFamily;
    if ('letterSpacing' in ctx) ctx.letterSpacing = ls+'px';
    var m = ctx.measureText(el.textContent);
    return { w: m.actualBoundingBoxLeft + m.actualBoundingBoxRight, l: m.actualBoundingBoxLeft };
  }
  function fit(){
    var list = st.querySelectorAll('[data-w]');
    for (var i=0;i<list.length;i++){
      var el = list[i], target = num(el.dataset.w);
      var n = (el.textContent||'').length;
      if (!(target>0) || n<2) continue;
      var ls = 0;
      for (var k=0;k<5;k++){
        var m = ink(el, ls);
        if (Math.abs(m.w-target) < 0.02) break;
        ls += (target - m.w)/(n-1);
      }
      /* ПРЕДЕЛ ПОПРАВКИ. Системный трекинг Apple не выходит за ±0.4 pt на текстовых
         кеглях. Если подгонка просит больше — виноват не трекинг, а КЕГЛЬ: строка
         набрана не тем размером, и разницу вытягивает межбуквенный просвет. На чужом
         шрифте эта разница будет другой, и текст поедет. Поэтому поправка режется:
         лучше строка естественной ширины, чем раздавленная или растянутая. */
      if (ls >  0.4) ls =  0.4;
      if (ls < -0.4) ls = -0.4;
      el.style.letterSpacing = ls.toFixed(4)+'px';
      if (el.dataset.x){
        var mm = ink(el, ls);
        el.style.left = (num(el.dataset.x) + mm.l).toFixed(2)+'px';
      }
    }
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  else window.addEventListener('load', fit);
})();
</script>"""


def emit(out_dir, num, title, frame, V, ADDR, css, body, meta=None):
    d = Path(out_dir)
    d.mkdir(parents=True, exist_ok=True)
    html = HEAD.format(title=title, frame=frame, vars=varblock(V, ADDR),
                       font=FONT_FACE, reset=RESET, css=css, body=body, fit=FIT_SCRIPT)
    (d / f"f{num:02d}.html").write_text(html, encoding="utf-8")
    spec = dict(meta or {})
    spec["vars"] = {k: v for k, v in V.items() if not k.endswith("-path")}
    (d / f"f{num:02d}.json").write_text(
        json.dumps(spec, ensure_ascii=False, indent=1), encoding="utf-8")
    return len(html)
