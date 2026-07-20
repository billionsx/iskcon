#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Сборка файла сверки. Шрифт мокапа переносится на .stage ДОСЛОВНО.

Ошибка, ради которой это вынесено в отдельный файл: в мокапе шрифт задан правилом
html,body, а в сверке страница своя — правило туда не годится и его надо перевесить
на .stage. Я его просто ВЫРЕЗАЛ, и .stage стал наследовать шрифт страницы сверки.
Заголовок, которому положен SF Pro Display, рисовался у основателя как Text, выходил
шире и лез вправо. В моём замере этого не было видно: я мерил f03.html, а не сверку.
"""
import base64, io, re, sys, pathlib
from PIL import Image

def build(n):
    mock = pathlib.Path(f'/home/claude/iskcon/docs/design/ios26/mockups/fitness/f{n}.html')
    src  = mock.read_text(encoding='utf-8')
    css  = re.search(r'<style>(.*?)</style>', src, re.S).group(1)
    body = re.search(r'<div class="stage">(.*?)</div>\s*<script>', src, re.S).group(1)
    script = re.search(r'(<script>.*?</script>)', src, re.S).group(1)

    rule = re.search(r'html,body\{([^}]*)\}', css, re.S)
    if not rule:
        raise SystemExit("не нашёл правило html,body — сверка была бы без шрифта")
    decls = rule.group(1)
    keep = [d.strip() for d in decls.split(';')
            if d.strip() and not d.strip().startswith(('background', 'display', 'justify-content'))]
    if not any(d.startswith('font-family') for d in keep):
        raise SystemExit("в правиле нет font-family — сверка была бы без шрифта")
    css = css.replace(rule.group(0), '.stage{' + ';'.join(keep) + '}')

    im = Image.open(f'/home/claude/fit/f{n}.png').convert('RGB')
    buf = io.BytesIO(); im.save(buf, 'JPEG', quality=92, optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode()

    html = f"""<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8">
<title>Fitness · кадр {int(n)} · сверка</title><style>
{css}
*{{box-sizing:border-box}}
body{{margin:0;background:#0b0b0b;color:#e8e8ea;display:flex;flex-direction:column;
 align-items:center;gap:14px;padding:18px 12px 36px;
 font:14px/1.45 -apple-system,"SF Pro Text",system-ui,sans-serif}}
.wrap{{position:relative;width:393px;height:852px;flex:none;box-shadow:0 20px 60px rgba(0,0,0,.6)}}
.ref{{position:absolute;inset:0;width:393px;height:852px;display:block}}
.mock{{position:absolute;inset:0}} .mock .stage{{position:absolute;inset:0}}
.panel{{display:flex;gap:12px;align-items:center;flex-wrap:wrap;justify-content:center;
 max-width:640px;background:#161618;border:.5px solid #2e2e31;border-radius:14px;padding:12px 16px}}
.panel label{{display:flex;gap:8px;align-items:center;color:#a1a1a6}}
input[type=range]{{width:150px;accent-color:#C5FD2C}}
button{{background:#242427;color:#e8e8ea;border:.5px solid #3a3a3d;border-radius:9px;
 padding:7px 13px;font:inherit;cursor:pointer}}
button.on{{background:#C5FD2C;color:#111;border-color:#C5FD2C}}
.note{{max-width:640px;color:#8e8e93;font-size:12.5px;text-align:center}}
.hint{{color:#e8e8ea}} #fnt{{color:#C5FD2C}}
.zoom .wrap{{transform:scale(2);transform-origin:top center;margin-bottom:860px}}
</style></head><body>
<div class="panel">
  <label>мокап <input id="op" type="range" min="0" max="100" value="100"></label>
  <button id="wipe">шторка</button><button id="blink">мигать</button>
  <button id="only">только кадр</button><button id="zoom">×2</button>
</div>
<div class="wrap">
  <img class="ref" alt="эталонный кадр" src="data:image/jpeg;base64,{b64}">
  <div class="mock" id="mock"><div class="stage">
{body}
  </div></div>
</div>
<p class="note"><span id="fnt">проверяю шрифт…</span></p>
{script}
<script>
const mock=document.getElementById('mock'),op=document.getElementById('op'),wrap=document.querySelector('.wrap');
let mode='op',timer=null;
op.oninput=()=>{{ if(mode==='op') mock.style.opacity=op.value/100; }};
function reset(){{ clearInterval(timer); timer=null; mock.style.clipPath='none';
 mock.style.opacity=op.value/100;
 document.querySelectorAll('.panel button').forEach(b=>{{if(b.id!=='zoom')b.classList.remove('on');}}); }}
document.getElementById('wipe').onclick=e=>{{const on=mode!=='wipe';reset();mode=on?'wipe':'op';
 if(on){{e.target.classList.add('on');mock.style.opacity=1;}}}};
wrap.onmousemove=ev=>{{if(mode!=='wipe')return;
 const r=wrap.getBoundingClientRect();
 const x=Math.max(0,Math.min(393,(ev.clientX-r.left)*393/r.width));
 mock.style.clipPath=`inset(0 0 0 ${{x}}px)`;}};
document.getElementById('blink').onclick=e=>{{const on=mode!=='blink';reset();mode=on?'blink':'op';
 if(on){{e.target.classList.add('on');let v=1;timer=setInterval(()=>{{v=1-v;mock.style.opacity=v;}},600);}}}};
document.getElementById('only').onclick=e=>{{const on=mode!=='only';reset();mode=on?'only':'op';
 if(on){{e.target.classList.add('on');mock.style.opacity=0;}}}};
document.getElementById('zoom').onclick=e=>{{document.body.classList.toggle('zoom');e.target.classList.toggle('on');}};
setTimeout(()=>{{
  const st=document.querySelector('.mock .stage');
  const ff=getComputedStyle(st).fontFamily;
  const t=document.fonts&&document.fonts.check('14px "SF Pro Text"');
  const d=document.fonts&&document.fonts.check('34px "SF Pro Display"');
  document.getElementById('fnt').textContent =
    'шрифт мокапа: '+ff.slice(0,58)+' · Text '+(t?'есть':'нет')+' · Display '+(d?'есть':'нет');
}},900);
</script></body></html>"""
    pathlib.Path('/mnt/user-data/outputs/fitness-f03.html').write_text(src, encoding='utf-8')
    pathlib.Path('/mnt/user-data/outputs/fitness-f03-сверка.html').write_text(html, encoding='utf-8')
    return len(html)

if __name__ == "__main__":
    print("собрано:", build(sys.argv[1] if len(sys.argv)>1 else "03"), "байт")
