import { useEffect, useState } from "react";
import QRCode from "qrcode";

/* ───────── palette (matches BookDetailPage: white · graphite · gold) ───────── */
const PAPER = "#ffffff";
const INK = "#1f2024";
const INK2 = "#70727b";
const INK3 = "#a7a8b0";
const LINE = "rgba(0,0,0,0.08)";
const GOLD = "var(--color-gold)";
const GOLDT = "#9c7c15";

/** What the QR card describes. Single source for verse / chapter / book screens. */
export type QrData =
  | { kind: "book"; bookTitle: string; bookSubtitle?: string; tagline?: string; cover?: string }
  | { kind: "chapter"; bookTitle: string; chapterNumber: string; chapterTitle: string }
  | { kind: "verse"; bookTitle: string; chapterNumber: string; chapterTitle?: string; verseLabel: string; verseText?: string | null }
  | { kind: "card"; title: string; subtitle?: string };

/** ISKCON emblem, graphite on white, painted via CSS mask (any solid colour). */
function IskconMark({ size = 40 }: { size?: number }) {
  return (
    <span
      role="img"
      aria-label="ИСККОН"
      style={{
        display: "block", height: size, width: size, margin: "0 auto", backgroundColor: INK,
        WebkitMaskImage: "url(/iskcon-sign.svg)", maskImage: "url(/iskcon-sign.svg)",
        WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
        WebkitMaskSize: "contain", maskSize: "contain",
        WebkitMaskPosition: "center", maskPosition: "center",
      }}
    />
  );
}

function CopyGlyph() {
  return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5" /></svg>;
}
function CheckGlyph() {
  return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12.5 10 17.5 19 6.5" /></svg>;
}

/** Rich QR card in the app's style. Light theme; QR is graphite on white. */
export function QrSheet({ url, data, onClose }: { url: string; data: QrData; onClose: () => void }) {
  const [src, setSrc] = useState("");
  const [copied, setCopied] = useState(false);
  function copyUrl() {
    try { void navigator.clipboard?.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }
    catch { /* ignore */ }
  }

  useEffect(() => {
    let live = true; setCopied(false);
    QRCode.toDataURL(url, {
      margin: 1,
      width: 560,
      errorCorrectionLevel: "M",
      color: { dark: "#1f2024", light: "#ffffff" },
    })
      .then((d) => { if (live) setSrc(d); })
      .catch(() => {});
    return () => { live = false; };
  }, [url]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 2100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 332, maxHeight: "calc(100dvh - 40px)", overflowY: "auto", WebkitOverflowScrolling: "touch", background: PAPER, borderRadius: 24, padding: "26px 24px 20px", boxShadow: "0 24px 70px rgba(0,0,0,0.28)", textAlign: "center", fontFamily: "var(--font-text)" }}
      >
        {/* ── logo (эмблема уже содержит подпись ISKCON ONE LOVE) ── */}
        <IskconMark size={56} />

        {/* ── identity (verse / chapter / book) ── */}
        <Identity data={data} />

        {/* ── QR ── */}
        <div style={{ width: 216, height: 216, margin: "20px auto 0", display: "grid", placeItems: "center", borderRadius: 16, background: "#fff", border: `0.5px solid ${LINE}` }}>
          {src
            ? <img src={src} alt="QR-код" width={192} height={192} style={{ display: "block" }} />
            : <span style={{ fontSize: "var(--text-footnote)", color: INK3 }}>Генерация…</span>}
        </div>

        <button
          onClick={copyUrl}
          style={{ marginTop: 14, width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px 10px 14px", borderRadius: 12, border: `0.5px solid ${LINE}`, background: "#F6F6F8", cursor: "pointer", textAlign: "left", fontFamily: "var(--font-text)" }}
        >
          <span style={{ flex: 1, minWidth: 0, fontSize: "var(--text-footnote)", lineHeight: 1.35, color: INK2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{url.replace(/^https?:\/\//, "")}</span>
          <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: 5, minWidth: 112, fontSize: "var(--text-footnote)", fontWeight: 600, color: copied ? "#1aa179" : GOLDT }}>
            {copied ? <CheckGlyph /> : <CopyGlyph />}{copied ? "Скопировано" : "Копировать"}
          </span>
        </button>

        <button
          onClick={onClose}
          style={{ marginTop: 12, width: "100%", height: 46, borderRadius: 14, border: "none", background: INK, color: "#fff", fontSize: "var(--text-callout)", fontWeight: 600, letterSpacing: "-0.01em", cursor: "pointer", fontFamily: "var(--font-text)" }}
        >
          Готово
        </button>
      </div>
    </div>
  );
}

function Ornament() {
  return (
    <div aria-hidden style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, margin: "14px 0 0" }}>
      <span style={{ width: 32, height: 1, background: `linear-gradient(to right, transparent, ${GOLD})`, opacity: 0.55 }} />
      <span style={{ color: GOLD, fontSize: 7 }}>◆</span>
      <span style={{ width: 32, height: 1, background: `linear-gradient(to left, transparent, ${GOLD})`, opacity: 0.55 }} />
    </div>
  );
}

function Identity({ data }: { data: QrData }) {
  if (data.kind === "card") {
    return (
      <>
        <h1 style={{ margin: "20px 0 0", fontSize: "var(--text-title2)", lineHeight: 1.18, fontWeight: 800, letterSpacing: "-0.02em", color: INK, fontFamily: "var(--font-display, var(--font-text))" }}>
          {data.title}
        </h1>
        {data.subtitle && <div style={{ marginTop: 6, fontSize: "var(--text-subhead)", fontWeight: 600, color: INK2 }}>{data.subtitle}</div>}
        <Ornament />
      </>
    );
  }

  if (data.kind === "book") {
    return (
      <>
        {data.cover && (
          <div style={{ margin: "18px auto 0", width: 124 }}>
            <img
              src={data.cover}
              alt={data.bookTitle}
              style={{ display: "block", width: "100%", height: "auto", borderRadius: 12, boxShadow: "0 12px 30px rgba(0,0,0,0.22)" }}
            />
          </div>
        )}
        <h1 style={{ margin: "16px 0 0", fontSize: "var(--text-title1)", lineHeight: 1.12, fontWeight: 800, letterSpacing: "-0.02em", color: INK, fontFamily: "var(--font-display, var(--font-text))" }}>
          {data.bookTitle}
        </h1>
        {data.bookSubtitle && (
          <div style={{ marginTop: 3, fontSize: "var(--text-subhead)", fontWeight: 600, color: INK2 }}>{data.bookSubtitle}</div>
        )}
        {data.tagline && (
          <div style={{ marginTop: 8, fontSize: "var(--text-footnote)", color: INK3 }}>{data.tagline}</div>
        )}
        <Ornament />
      </>
    );
  }

  if (data.kind === "chapter") {
    return (
      <>
        <div style={{ marginTop: 16, fontSize: "var(--text-footnote)", fontWeight: 600, color: INK2 }}>{data.bookTitle}</div>
        <div style={{ marginTop: 12, fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: GOLDT }}>
          Глава {data.chapterNumber}
        </div>
        <h1 style={{ margin: "6px 0 0", fontSize: "var(--text-title2)", lineHeight: 1.15, fontWeight: 800, letterSpacing: "-0.02em", color: INK, fontFamily: "var(--font-display, var(--font-text))" }}>
          {data.chapterTitle}
        </h1>
        <Ornament />
      </>
    );
  }

  // verse
  return (
    <>
      <div style={{ marginTop: 16, fontSize: "var(--text-footnote)", fontWeight: 600, color: INK2 }}>{data.bookTitle}</div>
      <div style={{ marginTop: 4, fontSize: "var(--text-footnote)", color: INK3 }}>
        Глава {data.chapterNumber}{data.chapterTitle ? ` · ${data.chapterTitle}` : ""}
      </div>
      <div style={{ marginTop: 12, fontSize: "var(--text-caption)", fontWeight: 700, letterSpacing: "1.4px", textTransform: "uppercase", color: GOLDT }}>
        {data.verseLabel}
      </div>
      {data.verseText && (
        <div style={{ margin: "12px auto 0", maxWidth: 264, textAlign: "left", paddingLeft: 16, borderLeft: `2px solid ${GOLD}` }}>
          <p style={{ margin: 0, fontSize: "var(--text-body)", lineHeight: 1.5, fontWeight: 500, letterSpacing: "-0.01em", color: INK }}>
            {data.verseText}
          </p>
        </div>
      )}
      <Ornament />
    </>
  );
}
