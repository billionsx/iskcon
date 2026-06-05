import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import QRCode from "qrcode";

/* ───────── palette (matches BookDetailPage: white · graphite · gold) ───────── */
const PAPER = "#ffffff";
const INK = "#1f2024";
const INK2 = "#70727b";
const INK3 = "#a7a8b0";
const LINE = "rgba(0,0,0,0.08)";
const GOLD = "#D2AA1B";
const GOLDT = "#9c7c15";

/** What the QR card describes. Single source for verse / chapter / book screens. */
export type QrData =
  | { kind: "book"; bookTitle: string; bookSubtitle?: string; tagline?: string; cover?: string }
  | { kind: "chapter"; bookTitle: string; chapterNumber: string; chapterTitle: string }
  | { kind: "verse"; bookTitle: string; chapterNumber: string; chapterTitle?: string; verseLabel: string; verseText?: string | null };

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

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div style={{ marginTop: 8, fontSize: 10, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: GOLDT }}>
      {children}
    </div>
  );
}

/** Rich QR card in the app's style. Light theme; QR is graphite on white. */
export function QrSheet({ url, data, onClose }: { url: string; data: QrData; onClose: () => void }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let live = true;
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
      style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 332, maxHeight: "calc(100dvh - 40px)", overflowY: "auto", WebkitOverflowScrolling: "touch", background: PAPER, borderRadius: 24, padding: "26px 24px 20px", boxShadow: "0 24px 70px rgba(0,0,0,0.28)", textAlign: "center", fontFamily: "var(--font-text)" }}
      >
        {/* ── brand lockup ── */}
        <IskconMark size={40} />
        <Eyebrow>ISKCON ONE LOVE</Eyebrow>

        {/* ── identity (verse / chapter / book) ── */}
        <Identity data={data} />

        {/* ── QR ── */}
        <div style={{ width: 216, height: 216, margin: "20px auto 0", display: "grid", placeItems: "center", borderRadius: 16, background: "#fff", border: `0.5px solid ${LINE}` }}>
          {src
            ? <img src={src} alt="QR-код" width={192} height={192} style={{ display: "block" }} />
            : <span style={{ fontSize: 13, color: INK3 }}>Генерация…</span>}
        </div>

        <div style={{ marginTop: 12, fontSize: 12, lineHeight: 1.4, color: INK3, wordBreak: "break-all" }}>{url}</div>

        <button
          onClick={onClose}
          style={{ marginTop: 16, width: "100%", height: 46, borderRadius: 14, border: "none", background: INK, color: "#fff", fontSize: 15.5, fontWeight: 600, letterSpacing: "-0.01em", cursor: "pointer", fontFamily: "var(--font-text)" }}
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
        <h1 style={{ margin: "16px 0 0", fontSize: 25, lineHeight: 1.12, fontWeight: 800, letterSpacing: "-0.02em", color: INK, fontFamily: "var(--font-display, var(--font-text))" }}>
          {data.bookTitle}
        </h1>
        {data.bookSubtitle && (
          <div style={{ marginTop: 3, fontSize: 15, fontWeight: 600, color: INK2 }}>{data.bookSubtitle}</div>
        )}
        {data.tagline && (
          <div style={{ marginTop: 8, fontSize: 13.5, color: INK3 }}>{data.tagline}</div>
        )}
        <Ornament />
      </>
    );
  }

  if (data.kind === "chapter") {
    return (
      <>
        <div style={{ marginTop: 16, fontSize: 13.5, fontWeight: 600, color: INK2 }}>{data.bookTitle}</div>
        <div style={{ marginTop: 12, fontSize: 11, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: GOLDT }}>
          Глава {data.chapterNumber}
        </div>
        <h1 style={{ margin: "6px 0 0", fontSize: 24, lineHeight: 1.15, fontWeight: 800, letterSpacing: "-0.02em", color: INK, fontFamily: "var(--font-display, var(--font-text))" }}>
          {data.chapterTitle}
        </h1>
        <Ornament />
      </>
    );
  }

  // verse
  return (
    <>
      <div style={{ marginTop: 16, fontSize: 13.5, fontWeight: 600, color: INK2 }}>{data.bookTitle}</div>
      <div style={{ marginTop: 4, fontSize: 12.5, color: INK3 }}>
        Глава {data.chapterNumber}{data.chapterTitle ? ` · ${data.chapterTitle}` : ""}
      </div>
      <div style={{ marginTop: 12, fontSize: 12, fontWeight: 700, letterSpacing: "1.4px", textTransform: "uppercase", color: GOLDT }}>
        {data.verseLabel}
      </div>
      {data.verseText && (
        <div style={{ margin: "12px auto 0", maxWidth: 264, textAlign: "left", paddingLeft: 16, borderLeft: `2px solid ${GOLD}` }}>
          <p style={{ margin: 0, fontSize: 16.5, lineHeight: 1.5, fontWeight: 500, letterSpacing: "-0.01em", color: INK }}>
            {data.verseText}
          </p>
        </div>
      )}
      <Ornament />
    </>
  );
}
