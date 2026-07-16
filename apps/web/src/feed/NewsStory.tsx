/**
 * NewsStory — новость в РЕДАКЦИОННОЙ вёрстке субтаба «Новости» (в отличие от
 * коробочной NewsCard общей «Ленты»). Поток без рамок, истории разделены
 * волосяной линией — читается как разворот журнала, а не список карточек.
 *
 * Три формата:
 *   • lead    — главная (свежайшая) новость: крупный заголовок, золотая метка,
 *               при рабочем фото — большое изображение 3:2;
 *   • feature — рядовая новость с рабочим фото (16:9);
 *   • text    — рядовая новость без фото — типографика несёт карточку.
 * feature/text выбирается по факту загрузки фото: мёртвое/битое прячется и
 * история перетекает в текстовый формат (никаких серых боксов).
 *
 * Редакция: лид — реальное первое предложение (не подпись), автор — деликатной
 * строкой у даты, тело раскрывается абзацами. Ссылок на оригинал нет.
 */
import { useState } from "react";
import { CardActionBtns } from "../cardActions";
import { BookMenuSheet } from "../BookMenuSheet";
import { QrSheet } from "../QrSheet";
import { ReportSheet } from "../ReportSheet";
import { exportToPdf } from "../pdf";
import { ROUTES, url as absUrl } from "../routes";
import { fmtDate, paragraphs, buildNewsPrintNode } from "./NewsCard";
import type { NewsItem } from "./types";

const GOLD = "var(--color-gold-deep)";

/** Надзаголовок: источник · рубрика — золотом, капителью (структурный маркер). */
function Kicker({ text }: { text: string }) {
  return <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.9px", textTransform: "uppercase", color: GOLD }}>{text}</div>;
}

export function NewsStory({ n, lead = false, open, onToggle, flash }: {
  n: NewsItem; lead?: boolean; open: boolean; onToggle: () => void; flash: (m: string) => void;
}) {
  const [menu, setMenu] = useState(false);
  const [qr, setQr] = useState(false);
  const [report, setReport] = useState(false);
  const [imgBroken, setImgBroken] = useState(false);

  const path = `${ROUTES.darshan()}/news/${n.slug}`;
  const shareUrl = absUrl(path);
  const favKey = `news:${n.slug}`;
  const favMeta = { t: n.title.slice(0, 140), s: n.sourceLabel, h: path };
  const paras = paragraphs(n.body);
  const showHero = !!n.hero && !imgBroken;
  const kicker = [n.sourceLabel, n.category].filter(Boolean).join(" · ");

  const onPick = (id: string) => {
    if (id === "share") {
      if (typeof navigator !== "undefined" && navigator.share) navigator.share({ title: n.title, url: shareUrl }).catch(() => {});
      else { navigator.clipboard?.writeText(shareUrl).catch(() => {}); flash("Ссылка скопирована"); }
    } else if (id === "pdf") { flash("Готовим PDF…"); void exportToPdf(buildNewsPrintNode(n), { title: n.title }); }
    else if (id === "qr") { setQr(true); }
    else if (id === "report") { setReport(true); }
  };

  // размерная шкала: lead заметно крупнее рядовых
  const titleSize = lead ? "var(--text-title1)" : "var(--text-title2)";
  const leadSize = lead ? "var(--text-body)" : "var(--text-callout)";
  const GAP = 12;   // равные интервалы: надзаголовок · заголовок · описание · «читать»

  return (
    <article style={{ position: "relative" }}>
      {lead && <div aria-hidden style={{ width: 34, height: 3, borderRadius: 2, background: GOLD, marginBottom: 16 }} />}

      {showHero ? (
        <>
          <div style={{ position: "relative", marginBottom: GAP }}>
            <img src={n.hero} alt="" loading={lead ? "eager" : "lazy"} onError={() => setImgBroken(true)}
              style={{ width: "100%", display: "block", aspectRatio: lead ? "3 / 2" : "16 / 9", objectFit: "cover", borderRadius: 16, background: "var(--color-bg-2)" }} />
            <div style={{ position: "absolute", top: 12, right: 12, zIndex: 4 }}>
              <CardActionBtns favKey={favKey} meta={favMeta} flash={flash} dark onMore={() => setMenu(true)} />
            </div>
          </div>
          <Kicker text={kicker} />
        </>
      ) : (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}><Kicker text={kicker} /></div>
          <div style={{ flexShrink: 0, marginTop: -3 }}>
            <CardActionBtns favKey={favKey} meta={favMeta} flash={flash} plain onMore={() => setMenu(true)} />
          </div>
        </div>
      )}

      <h2 style={{ margin: `${GAP}px 0 0`, fontFamily: "var(--font-display)", fontSize: titleSize, fontWeight: 800, letterSpacing: "-0.021em", lineHeight: 1.16, color: "var(--color-label)" }}>{n.title}</h2>

      {/* описание — только в свёрнутом виде (в раскрытом его несёт первый абзац тела; иначе дубль) */}
      {!open && n.lead && (
        <p style={{ margin: `${GAP}px 0 0`, fontFamily: "var(--font-text)", fontSize: leadSize, lineHeight: 1.55, color: "var(--color-label-2)" }}>{n.lead}</p>
      )}

      {open && paras.length > 0 && (
        <div style={{ marginTop: GAP }}>
          {paras.map((para, i) => (
            <p key={i} style={{ margin: i ? "12px 0 0" : 0, fontFamily: "var(--font-text)", fontSize: "var(--text-body)", lineHeight: 1.62, color: "var(--color-label)" }}>{para}</p>
          ))}
        </div>
      )}

      <div style={{ marginTop: GAP, display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        {paras.length > 0 && (
          <button type="button" onClick={onToggle}
            style={{ padding: 0, background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 700, color: GOLD, WebkitTapHighlightColor: "transparent" }}>
            {open ? "Свернуть" : "Читать полностью"}
          </button>
        )}
        {(n.author || n.publishedAt) && (
          <span style={{ marginLeft: "auto", fontFamily: "var(--font-text)", fontSize: "var(--text-caption)", textAlign: "right" }}>
            {n.author && <span style={{ color: "var(--color-label-2)", fontWeight: 600 }}>{n.author}</span>}
            {n.author && n.publishedAt && <span style={{ color: "var(--color-label-3)" }}> · </span>}
            {n.publishedAt && <span style={{ color: "var(--color-label-3)" }}>{fmtDate(n.publishedAt)}</span>}
          </span>
        )}
      </div>

      <BookMenuSheet open={menu} onClose={() => setMenu(false)} onSelect={onPick} variant="post" noTelegram />
      {qr && <QrSheet url={shareUrl} data={{ kind: "card", title: n.title, subtitle: n.sourceLabel }} onClose={() => setQr(false)} />}
      <ReportSheet open={report} onClose={() => setReport(false)} context={`Новости · ${n.sourceLabel} · ${shareUrl}`} />
    </article>
  );
}
