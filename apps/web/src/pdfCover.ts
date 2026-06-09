/**
 * Обложка PDF по стандарту BBT — ЕДИНАЯ вёрстка для всех книг и для всех путей
 * генерации (серверный рендер в воркере и пре-генерация в CI). Книго-независима:
 * всё из BookData. Профессиональный книжный титул: золотая двойная рамка с ◆ по
 * углам, книжный засечный шрифт (Gentium Book Plus — полная кириллица + IAST),
 * название, IAST курсивом, дек-строка, иллюстрация книги в тонком золотом
 * кейлайне, плашка тома (лила/песнь) и колофон BBT.
 *
 * Шрифт подключается по системному имени (в CI и локально TTF кладутся в шрифты
 * окружения и fc-cache) — поэтому работает и через page.setContent (без base URL).
 */
export function coverHtml(o: {
  titleLine1: string; titleLine2?: string; iast: string; tagline: string;
  author: string; imgUrl: string; uniformTitle?: boolean;
  volume?: string; range?: string;
}): string {
  const GOLD = "#C9A227", GOLDT = "#9a7b14", INK = "#1d1d1f", INK2 = "#6e6e73";
  const e = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const titleSize = o.uniformTitle ? "30pt" : "33pt";
  const t2Size = o.uniformTitle ? "30pt" : "18pt";
  const t2 = o.titleLine2
    ? `<div style="margin-top:${o.uniformTitle ? "0.5mm" : "1.5mm"};font-size:${t2Size};font-weight:700;line-height:1.05;letter-spacing:-0.006em;color:${INK}">${e(o.titleLine2)}</div>`
    : "";
  const volume = o.volume
    ? `<div class="vol"><span class="vr"></span><span class="vt">${e(o.volume)}</span><span class="vr"></span></div>${o.range ? `<div class="vrange">${e(o.range)}</div>` : ""}`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
@page{size:A4;margin:0}
html,body{width:210mm;height:297mm}
body{font-family:'Gentium Book Plus',Georgia,'Times New Roman',serif;background:#ffffff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sheet{position:relative;width:210mm;height:297mm;padding:11mm}
.frame{position:relative;width:100%;height:100%;border:0.8pt solid ${GOLD};padding:16mm 22mm;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.frame::before{content:"";position:absolute;inset:2.4mm;border:0.4pt solid rgba(201,162,39,0.5);pointer-events:none}
.cnr{position:absolute;color:${GOLD};font-size:7pt;line-height:1}
.orn{display:flex;align-items:center;justify-content:center;gap:7px;color:${GOLD}}
.orn i{display:block;width:14mm;height:0;border-top:0.6pt solid ${GOLD}}
.orn b{font-size:6pt;font-weight:400}
.art{display:flex;align-items:center;justify-content:center;margin-top:9mm}
.art img{display:block;width:auto;height:auto;max-width:112mm;max-height:122mm;border:0.8pt solid ${GOLD}}
.vol{display:flex;align-items:center;justify-content:center;gap:6mm;margin-top:10mm}
.vol .vr{display:block;width:16mm;height:0;border-top:0.6pt solid ${GOLD}}
.vol .vt{font-size:12.5pt;font-weight:700;letter-spacing:6px;text-transform:uppercase;color:${GOLDT}}
.vrange{margin-top:2.5mm;font-size:9.5pt;letter-spacing:0.4px;color:${INK2}}
.author{margin-top:9mm;font-size:10.5pt;line-height:1.5;color:${INK2};max-width:150mm}
.imprint{margin-top:4mm;font-size:8pt;letter-spacing:2.5px;text-transform:uppercase;color:${INK}}
</style></head><body>
<div class="sheet"><div class="frame">
<span class="cnr" style="top:1.6mm;left:1.6mm">◆</span><span class="cnr" style="top:1.6mm;right:1.6mm">◆</span>
<span class="cnr" style="bottom:1.6mm;left:1.6mm">◆</span><span class="cnr" style="bottom:1.6mm;right:1.6mm">◆</span>
<div class="orn"><i></i><b>◆</b><i></i></div>
<h1 style="margin-top:9mm;font-size:${titleSize};font-weight:700;line-height:1.06;letter-spacing:-0.008em;color:${INK}">${e(o.titleLine1)}</h1>
${t2}
<div style="margin-top:6mm;font-style:italic;font-size:15pt;letter-spacing:0.01em;color:${GOLDT}">${e(o.iast)}</div>
<div style="margin-top:3.5mm;font-size:8pt;letter-spacing:3.5px;text-transform:uppercase;color:${INK2}">${e(o.tagline)}</div>
<div class="art"><img src="${o.imgUrl}"></div>
${volume}
<p class="author">${e(o.author)}</p>
<div class="orn" style="margin-top:9mm"><i style="width:10mm"></i><b style="font-size:5.5pt">◆</b><i style="width:10mm"></i></div>
<div class="imprint">The Bhaktivedanta Book Trust</div>
</div></div></body></html>`;
}
