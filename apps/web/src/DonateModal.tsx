import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import QRCode from "qrcode";

/* ───────── palette (matches QrSheet / BookDetailPage) ───────── */
const INK = "#1f2024";
const INK2 = "#70727b";
const INK3 = "#a7a8b0";
const LINE = "rgba(0,0,0,0.10)";
const GOLD = "#D2AA1B";
const OK = "#1d9e75";

const USDT_TRC20 = "TRqkjRb8g4Yf3Ew9VoM9YxB1EETnTcB5Gp";
const YOOMONEY_URL = "https://yoomoney.ru/fundraise/1I77BODCCS9.260605";

/** ISKCON ONE LOVE emblem (gold), via CSS mask. */
function IskconMark({ size = 52 }: { size?: number }) {
  return (
    <span
      role="img"
      aria-label="ISKCON ONE LOVE"
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
    <div aria-hidden style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, margin: "14px 0 22px" }}>
      <span style={{ width: 30, height: 1, background: `linear-gradient(to right, transparent, ${GOLD})`, opacity: 0.5 }} />
      <span style={{ color: GOLD, fontSize: 7 }}>◆</span>
      <span style={{ width: 30, height: 1, background: `linear-gradient(to left, transparent, ${GOLD})`, opacity: 0.5 }} />
    </div>
  );
}

const SectionHeader = ({ children }: { children: ReactNode }) => (
  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", color: INK3, margin: "0 0 8px 4px" }}>{children}</div>
);
const Footnote = ({ children }: { children: ReactNode }) => (
  <div style={{ fontSize: 11.5, lineHeight: 1.45, color: INK3, margin: "8px 4px 0" }}>{children}</div>
);

function CopyGlyph({ color }: { color: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M5 15V5a2 2 0 0 1 2-2h8" />
    </svg>
  );
}
function QrGlyph({ color }: { color: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1.2" /><rect x="14" y="3" width="7" height="7" rx="1.2" /><rect x="3" y="14" width="7" height="7" rx="1.2" />
      <path d="M14 14h3v3M20 14v.01M14 20h.01M17 20h.01M20 17v3" />
    </svg>
  );
}

/** Donation sheet: rubles via ЮMoney, plus USDT (TRC20) with copy + QR. iOS-grouped layout. */
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

  const rowBtn: CSSProperties = { display: "flex", alignItems: "center", gap: 10, width: "100%", height: 48, padding: "0 14px", border: "none", background: "transparent", fontSize: 14.5, fontWeight: 500, letterSpacing: "-0.01em", cursor: "pointer", fontFamily: "var(--font-text)", textAlign: "left" };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 366, maxHeight: "calc(100dvh - 40px)", overflowY: "auto", WebkitOverflowScrolling: "touch", background: "#fff", borderRadius: 26, padding: "26px 20px 18px", boxShadow: "0 24px 70px rgba(0,0,0,0.28)", fontFamily: "var(--font-text)" }}
      >
        <IskconMark size={52} />
        <h1 style={{ margin: "16px 0 0", fontSize: 24, lineHeight: 1.12, fontWeight: 800, letterSpacing: "-0.02em", color: INK, textAlign: "center", fontFamily: "var(--font-display, var(--font-text))" }}>
          Поддержать
        </h1>
        <p style={{ margin: "9px 4px 0", fontSize: 13.5, lineHeight: 1.5, color: INK2, textAlign: "center" }}>
          Ваш вклад помогает распространять и развивать послание Шрилы Прабхупады и Шри Кришны Чайтаньи Махапрабху через онлайн-проект ISKCON ONE LOVE.
        </p>
        <Ornament />

        {/* ── Рубли · ЮMoney ── */}
        <SectionHeader>Рубли · карты · СБП</SectionHeader>
        <a
          href={YOOMONEY_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 52, borderRadius: 16, background: INK, color: "#fff", fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em", textDecoration: "none" }}
        >
          Поддержать через ЮMoney
        </a>
        <Footnote>Откроется защищённая страница ЮMoney.</Footnote>

        {/* ── Криптовалюта · USDT TRC20 ── */}
        <div style={{ height: 22 }} />
        <SectionHeader>Криптовалюта · USDT (TRC20)</SectionHeader>
        <div style={{ border: `0.5px solid ${LINE}`, borderRadius: 16, overflow: "hidden", background: "#fff" }}>
          <div style={{ padding: "12px 14px 11px", background: "#fafafa" }}>
            <div style={{ fontSize: 11, color: INK3, marginBottom: 3 }}>Адрес кошелька</div>
            <code style={{ display: "block", fontSize: 12.5, lineHeight: 1.4, color: INK, wordBreak: "break-all", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{USDT_TRC20}</code>
          </div>
          <button onClick={copy} style={{ ...rowBtn, borderTop: `0.5px solid ${LINE}`, color: copied ? OK : INK }}>
            <CopyGlyph color={copied ? OK : INK2} />
            <span style={{ flex: 1 }}>{copied ? "Адрес скопирован" : "Копировать адрес"}</span>
            {copied && <span style={{ fontSize: 15 }}>✓</span>}
          </button>
          <button onClick={() => setShowQr((v) => !v)} style={{ ...rowBtn, borderTop: `0.5px solid ${LINE}`, color: INK }}>
            <QrGlyph color={INK2} />
            <span style={{ flex: 1 }}>{showQr ? "Скрыть QR-код" : "Показать QR-код"}</span>
            <span style={{ color: INK3, fontSize: 11 }}>{showQr ? "▲" : "▼"}</span>
          </button>
          {showQr && (
            <div style={{ borderTop: `0.5px solid ${LINE}`, padding: "16px", display: "grid", placeItems: "center" }}>
              <div style={{ width: 188, height: 188, display: "grid", placeItems: "center", borderRadius: 14, background: "#fff", border: `0.5px solid ${LINE}` }}>
                {qr
                  ? <img src={qr} alt="QR-код USDT TRC20" width={168} height={168} style={{ display: "block" }} />
                  : <span style={{ fontSize: 13, color: INK3 }}>Генерация…</span>}
              </div>
            </div>
          )}
        </div>
        <Footnote>Отправляйте только USDT в сети TRC20 (Tron). Перевод в другой сети может быть утерян.</Footnote>

        <button
          onClick={onClose}
          style={{ marginTop: 20, width: "100%", height: 48, borderRadius: 16, border: "none", background: "#f0f0f2", color: INK, fontSize: 15.5, fontWeight: 600, letterSpacing: "-0.01em", cursor: "pointer", fontFamily: "var(--font-text)" }}
        >
          Готово
        </button>
      </div>
    </div>
  );
}
