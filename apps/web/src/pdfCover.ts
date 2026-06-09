/**
 * Обложка PDF по стандарту BBT — ЕДИНАЯ вёрстка для всех книг и для всех путей
 * генерации (серверный рендер в воркере и пре-генерация в CI). Книго-независима:
 * всё из BookData. Чистая полностраничная обложка (A4, без колонтитулов):
 * золотая двойная рамка с ◆ по углам, название (Georgia), IAST курсивом,
 * дек-строка, иллюстрация книги в паспарту, плашка тома (лила/песнь) при
 * необходимости, строка автора и колофон BBT.
 */
export function coverHtml(o: {
  titleLine1: string; titleLine2?: string; iast: string; tagline: string;
  author: string; imgUrl: string; uniformTitle?: boolean;
  volume?: string; range?: string;
}): string {
  const GOLD = "#C9A227", GOLDT = "#9c7c15", INK = "#1d1d1f", INK2 = "#6e6e73", MAT = "#e8e2d2";
  const e = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const t2 = o.titleLine2
    ? `<div style="margin-top:${o.uniformTitle ? "0.5mm" : "1.5mm"};font-size:${o.uniformTitle ? "29pt" : "19pt"};font-weight:700;line-height:1.06;letter-spacing:-0.012em;color:${INK}">${e(o.titleLine2)}</div>`
    : "";
  const volume = o.volume
    ? `<div style="margin-top:11mm"><div style="font-size:12pt;font-weight:700;letter-spacing:5px;text-transform:uppercase;color:${GOLDT}">${e(o.volume)}</div>${o.range ? `<div style="margin-top:2mm;font-size:9.5pt;letter-spacing:0.5px;color:${INK2}">${e(o.range)}</div>` : ""}</div>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
@page{size:A4;margin:0}
html,body{width:210mm;height:297mm}
body{font-family:Georgia,'Times New Roman',serif;background:#ffffff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sheet{position:relative;width:210mm;height:297mm;padding:10mm}
.frame{position:relative;width:100%;height:100%;border:1pt solid ${GOLD};padding:14mm 16mm;text-align:center;display:flex;flex-direction:column;justify-content:center}
.frame::before{content:"";position:absolute;inset:2.6mm;border:0.4pt solid rgba(201,162,39,0.5);pointer-events:none}
.cnr{position:absolute;color:${GOLD};font-size:7.5pt;line-height:1}
.orn{display:flex;align-items:center;justify-content:center;gap:7px;color:${GOLD}}
.orn i{display:block;width:13mm;height:0;border-top:0.7pt solid ${GOLD}}
.orn b{font-size:6.5pt;font-weight:400}
.plate{display:inline-block;background:#fff;padding:6mm;border:0.5pt solid ${MAT}}
.plate .k{border:0.8pt solid ${GOLD};line-height:0}
.plate img{display:block;width:auto;height:auto;max-width:122mm;max-height:138mm}
</style></head><body>
<div class="sheet"><div class="frame">
<span class="cnr" style="top:1.7mm;left:1.7mm">◆</span><span class="cnr" style="top:1.7mm;right:1.7mm">◆</span>
<span class="cnr" style="bottom:1.7mm;left:1.7mm">◆</span><span class="cnr" style="bottom:1.7mm;right:1.7mm">◆</span>
<div class="orn"><i></i><b>◆</b><i></i></div>
<h1 style="margin-top:8mm;font-size:${o.uniformTitle ? "29pt" : "33pt"};font-weight:700;line-height:1.05;letter-spacing:-0.014em;color:${INK}">${e(o.titleLine1)}</h1>
${t2}
<div style="margin-top:5.5mm;font-style:italic;font-size:13.5pt;color:${GOLDT}">${e(o.iast)}</div>
<div style="margin-top:3mm;font-size:8.5pt;letter-spacing:3px;text-transform:uppercase;color:${INK2}">${e(o.tagline)}</div>
<div style="margin-top:12mm"><div class="plate"><div class="k"><img src="${o.imgUrl}"></div></div></div>
${volume}
<p style="margin:11mm auto 0;font-size:10pt;line-height:1.55;color:${INK2};max-width:148mm">${e(o.author)}</p>
<div class="orn" style="margin-top:9mm"><i style="width:9mm"></i><b style="font-size:6pt">◆</b><i style="width:9mm"></i></div>
<div style="margin-top:4mm;font-size:8.5pt;letter-spacing:2.5px;text-transform:uppercase;color:${INK}">The Bhaktivedanta Book Trust</div>
</div></div></body></html>`;
}
