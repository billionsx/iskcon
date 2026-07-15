/**
 * NewsCard — новость как элемент ленты Даршана (стиль Threads: карточка с hero,
 * заголовком, коротким лидом и раскрытием в полный текст). По эталону поста ленты:
 * действия ОВЕРЛЕЕМ на hero (♥ избранное · ⋯), рубрика и источник — подписью.
 *
 * ⋯ → Поделиться (in-app адрес /darshan/news/<slug>) · Скачать PDF (клиентский
 * печатный конвейер — новости в D1, серверный /pdf?kind=card их не рендерит) ·
 * QR-код · Сообщить об ошибке. ♥ — ключ news:<slug>.
 *
 * Тело новости РУ отдаётся сразу вместе с лидом — раскрытие без второго запроса.
 */
import { useState } from "react";
import { CardActionBtns } from "../cardActions";
import { BookMenuSheet } from "../BookMenuSheet";
import { QrSheet } from "../QrSheet";
import { ReportSheet } from "../ReportSheet";
import { exportToPdf } from "../pdf";
import { COVER_FALLBACK } from "../ui/CoverFallback";
import { ROUTES, url as absUrl } from "../routes";
import type { NewsItem } from "./types";

function fmtDate(iso: string): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }).replace(/\s*г\.$/, ""); }
  catch { return ""; }
}

/** Абзацы тела: пустая строка — граница абзаца; одиночные переводы строки склеиваем. */
function paragraphs(body: string): string[] {
  return (body || "")
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}

/* ── PDF новости: печатный конвейер браузера + книжный print-CSS ── */
function buildNewsPrintNode(n: NewsItem): HTMLElement {
  const root = document.createElement("div");
  root.style.maxWidth = "640px";
  root.style.margin = "0 auto";

  const head = document.createElement("div");
  head.setAttribute("data-pdf-block", "");

  const eyebrow = document.createElement("div");
  eyebrow.textContent = `Новости · ${n.sourceLabel}`;
  Object.assign(eyebrow.style, { fontSize: "10pt", letterSpacing: "2px", textTransform: "uppercase", color: "#9a7a14", fontFamily: "Georgia, serif" });
  head.appendChild(eyebrow);

  const h1 = document.createElement("h1");
  h1.textContent = n.title;
  Object.assign(h1.style, { margin: "10pt 0 0", fontSize: "21pt", lineHeight: "1.18", letterSpacing: "-0.01em", fontWeight: "800" });
  head.appendChild(h1);

  const sub = document.createElement("div");
  sub.textContent = [fmtDate(n.publishedAt), n.category].filter(Boolean).join(" · ");
  Object.assign(sub.style, { marginTop: "5pt", fontSize: "11pt", color: "#8a8a8e" });
  head.appendChild(sub);
  root.appendChild(head);

  for (const para of paragraphs(n.body)) {
    const p = document.createElement("p");
    p.textContent = para;
    Object.assign(p.style, { margin: "11pt 0 0", fontSize: "11.5pt", lineHeight: "1.55", color: "#26272b" });
    root.appendChild(p);
  }

  const src = document.createElement("div");
  src.textContent = `Источник: ${n.sourceLabel} — ${n.url}`;
  Object.assign(src.style, { marginTop: "16pt", fontSize: "9.5pt", color: "#9a9aa0" });
  root.appendChild(src);
  return root;
}

export function NewsCard({ n, open, onToggle, flash }: {
  n: NewsItem; open: boolean; onToggle: () => void; flash: (m: string) => void;
}) {
  const [menu, setMenu] = useState(false);
  const [qr, setQr] = useState(false);
  const [report, setReport] = useState(false);

  const path = `${ROUTES.darshan()}/news/${n.slug}`;
  const shareUrl = absUrl(path);
  const favKey = `news:${n.slug}`;
  const favMeta = { t: n.title.slice(0, 140), s: n.sourceLabel, h: path };
  const paras = paragraphs(n.body);

  const onPick = (id: string) => {
    if (id === "share") {
      if (typeof navigator !== "undefined" && navigator.share) navigator.share({ title: n.title, url: shareUrl }).catch(() => {});
      else { navigator.clipboard?.writeText(shareUrl).catch(() => {}); flash("Ссылка скопирована"); }
    } else if (id === "pdf") { flash("Готовим PDF…"); void exportToPdf(buildNewsPrintNode(n), { title: n.title }); }
    else if (id === "qr") { setQr(true); }
    else if (id === "report") { setReport(true); }
  };

  return (
    <article style={{ overflow: "hidden", background: "var(--color-bg)", borderRadius: 20 }}>
      {/* hero + действия оверлеем (эталон поста ленты) */}
      <div style={{ position: "relative" }}>
        <img src={n.hero || COVER_FALLBACK} alt="" loading="lazy"
          style={{ width: "100%", display: "block", aspectRatio: "16 / 9", objectFit: "cover", background: "var(--color-bg-2)" }} />
        <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(rgba(0,0,0,0.42), transparent 34%, transparent 62%, rgba(0,0,0,0.5))", pointerEvents: "none" }} />
        {/* рубрика + источник — слева снизу на hero */}
        <div style={{ position: "absolute", left: 14, bottom: 12, right: 64, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <span style={{ padding: "3px 9px", borderRadius: 999, background: "rgba(255,255,255,0.16)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.4px", textTransform: "uppercase", color: "#fff" }}>{n.sourceLabel}</span>
          {n.category && <span style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption)", fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>{n.category}</span>}
        </div>
        <div style={{ position: "absolute", top: 16, right: 16, zIndex: 4 }}>
          <CardActionBtns favKey={favKey} meta={favMeta} flash={flash} dark onMore={() => setMenu(true)} />
        </div>
      </div>

      {/* заголовок + лид + раскрытие */}
      <div style={{ padding: "13px 15px 15px" }}>
        <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-title3)", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.22, color: "var(--color-label)" }}>{n.title}</h3>
        {n.lead && (
          <p style={{ margin: "8px 0 0", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", lineHeight: 1.52, color: "var(--color-label-2)" }}>{n.lead}</p>
        )}

        {open && paras.length > 0 && (
          <div style={{ marginTop: 10 }}>
            {paras.map((para, i) => (
              <p key={i} style={{ margin: i ? "10px 0 0" : 0, fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", lineHeight: 1.58, color: "var(--color-label)" }}>{para}</p>
            ))}
            <a href={n.url} target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-block", marginTop: 12, fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 600, color: "var(--color-gold-deep)", textDecoration: "none" }}>
              Оригинал на {n.sourceLabel} →
            </a>
          </div>
        )}

        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
          {paras.length > 0 && (
            <button type="button" onClick={onToggle}
              style={{ padding: 0, background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 700, color: "var(--color-gold-deep)", WebkitTapHighlightColor: "transparent" }}>
              {open ? "Свернуть" : "Читать полностью"}
            </button>
          )}
          <span style={{ marginLeft: "auto", fontFamily: "var(--font-text)", fontSize: "var(--text-caption)", color: "var(--color-label-3)" }}>{fmtDate(n.publishedAt)}</span>
        </div>
      </div>

      <BookMenuSheet open={menu} onClose={() => setMenu(false)} onSelect={onPick} variant="post" noTelegram />
      {qr && <QrSheet url={shareUrl} data={{ kind: "card", title: n.title, subtitle: n.sourceLabel }} onClose={() => setQr(false)} />}
      <ReportSheet open={report} onClose={() => setReport(false)} context={`Новости · ${n.sourceLabel} · ${shareUrl}`} />
    </article>
  );
}
