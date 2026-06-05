import { useEffect, useState } from "react";
import QRCode from "qrcode";

/* ───────── palette (matches QrSheet / BookDetailPage) ───────── */
const PAPER = "#ffffff";
const INK = "#1f2024";
const INK2 = "#70727b";
const INK3 = "#a7a8b0";
const LINE = "rgba(0,0,0,0.08)";
const GOLD = "#D2AA1B";
const GOLDT = "#9c7c15";

const USDT_TRC20 = "TRqkjRb8g4Yf3Ew9VoM9YxB1EETnTcB5Gp";
const YOOMONEY_URL = "https://yoomoney.ru/fundraise/1I77BODCCS9.260605";

/** ISKCON emblem, painted via CSS mask (gold here). */
function IskconMark({ size = 52 }: { size?: number }) {
  return (
    <span
      role="img"
      aria-label="ИСККОН"
      style={{
        display: "block", height: size, width: size, margin: "0 auto", backgroundColor: GOLD,
        WebkitMaskImage: "url(/iskcon-sign.svg)", maskImage: "url(/iskcon-sign.svg)",
        WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
        WebkitMaskSize: "contain", maskSize: "contain",
        WebkitMaskPosition: "center", maskPosition: "center",
      }}
    />
  );
}

function Ornament() {
  return (
    <div aria-hidden style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, margin: "14px 0 18px" }}>
      <span style={{ width: 36, height: 1, background: `linear-gradient(to right, transparent, ${GOLD})`, opacity: 0.55 }} />
      <span style={{ color: GOLD, fontSize: 7 }}>◆</span>
      <span style={{ width: 36, height: 1, background: `linear-gradient(to left, transparent, ${GOLD})`, opacity: 0.55 }} />
    </div>
  );
}

/** Donation sheet: rubles via ЮMoney, plus USDT (TRC20) with copy + QR. */
export function DonateModal({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qr, setQr] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!showQr || qr) return;
    QRCode.toDataURL(USDT_TRC20, { margin: 1, width: 480, errorCorrectionLevel: "M", color: { dark: "#1f2024", light: "#ffffff" } })
      .then((d) => setQr(d))
      .catch(() => {});
  }, [showQr, qr]);

  const copy = () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(USDT_TRC20)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 1900); })
      .catch(() => {});
  };

  const eyebrow: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: INK3, marginBottom: 8 };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 360, maxHeight: "calc(100dvh - 40px)", overflowY: "auto", WebkitOverflowScrolling: "touch", background: PAPER, borderRadius: 24, padding: "26px 22px 20px", boxShadow: "0 24px 70px rgba(0,0,0,0.28)", fontFamily: "var(--font-text)" }}
      >
        <IskconMark size={52} />
        <h1 style={{ margin: "16px 0 0", fontSize: 23, lineHeight: 1.15, fontWeight: 800, letterSpacing: "-0.02em", color: INK, textAlign: "center", fontFamily: "var(--font-display, var(--font-text))" }}>
          Поддержать проект
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: 13.5, lineHeight: 1.5, color: INK2, textAlign: "center" }}>
          Ваш вклад помогает распространять «Бхагавад-гиту как она есть» и развивать ISKCON ONE LOVE.
        </p>
        <Ornament />

        {/* ── Рубли · ЮMoney ── */}
        <div style={eyebrow}>Рубли · карты · СБП</div>
        <a
          href={YOOMONEY_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 50, borderRadius: 14, background: GOLD, color: "#1f2024", fontSize: 15.5, fontWeight: 700, letterSpacing: "-0.01em", textDecoration: "none" }}
        >
          Поддержать через ЮMoney&nbsp;→
        </a>
        <div style={{ margin: "7px 0 0", fontSize: 11.5, color: INK3, textAlign: "center" }}>Откроется защищённая страница ЮMoney</div>

        {/* ── divider ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
          <span style={{ flex: 1, height: 1, background: LINE }} />
          <span style={{ fontSize: 11.5, color: INK3, whiteSpace: "nowrap" }}>или криптовалютой</span>
          <span style={{ flex: 1, height: 1, background: LINE }} />
        </div>

        {/* ── USDT TRC20 ── */}
        <div style={eyebrow}>USDT · сеть TRC20 (Tron)</div>
        <div style={{ display: "flex", alignItems: "center", padding: "12px", borderRadius: 14, border: `1px solid ${LINE}`, background: "#fafafa" }}>
          <code style={{ flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.45, color: INK, wordBreak: "break-all", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{USDT_TRC20}</code>
        </div>
        <button
          onClick={copy}
          style={{ marginTop: 10, width: "100%", height: 46, borderRadius: 14, border: `1px solid ${copied ? GOLD : LINE}`, background: copied ? "rgba(210,170,27,0.12)" : "#fff", color: copied ? GOLDT : INK, fontSize: 14.5, fontWeight: 700, letterSpacing: "-0.01em", cursor: "pointer", fontFamily: "var(--font-text)", transition: "all 0.15s ease" }}
        >
          {copied ? "Адрес скопирован ✓" : "Скопировать адрес"}
        </button>
        <button
          onClick={() => setShowQr((v) => !v)}
          style={{ marginTop: 8, width: "100%", height: 40, borderRadius: 12, border: "none", background: "transparent", color: INK2, fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-text)" }}
        >
          {showQr ? "Скрыть QR-код" : "Показать QR-код кошелька"}
        </button>
        {showQr && (
          <div style={{ width: 200, height: 200, margin: "6px auto 0", display: "grid", placeItems: "center", borderRadius: 16, background: "#fff", border: `0.5px solid ${LINE}` }}>
            {qr
              ? <img src={qr} alt="QR-код USDT TRC20" width={180} height={180} style={{ display: "block" }} />
              : <span style={{ fontSize: 13, color: INK3 }}>Генерация…</span>}
          </div>
        )}
        <div style={{ margin: "10px 0 0", fontSize: 11.5, lineHeight: 1.45, color: INK3, textAlign: "center" }}>
          Отправляйте только USDT в сети TRC20 (Tron). Перевод в другой сети может быть утерян.
        </div>

        <button
          onClick={onClose}
          style={{ marginTop: 18, width: "100%", height: 46, borderRadius: 14, border: "none", background: INK, color: "#fff", fontSize: 15.5, fontWeight: 600, letterSpacing: "-0.01em", cursor: "pointer", fontFamily: "var(--font-text)" }}
        >
          Готово
        </button>
      </div>
    </div>
  );
}
