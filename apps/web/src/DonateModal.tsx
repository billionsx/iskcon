import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import QRCode from "qrcode";

/* ───────── palette ───────── */
const INK = "#1d1d1f";       // Apple label
const INK2 = "#6e6e73";      // secondary label
const INK3 = "#8e8e93";      // tertiary
const GROUPED = "#f2f2f7";   // systemGroupedBackground
const HAIR = "rgba(60,60,67,0.10)";
const GOLD = "#D2AA1B";
const OK = "#1d9e75";

const USDT_TRC20 = "TRqkjRb8g4Yf3Ew9VoM9YxB1EETnTcB5Gp";
const YOOMONEY_URL = "https://yoomoney.ru/fundraise/1I77BODCCS9.260605";

/** ISKCON ONE LOVE emblem (gold), via CSS mask. */
function IskconMark({ size = 56 }: { size?: number }) {
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

const SectionHeader = ({ children }: { children: ReactNode }) => (
  <div style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: "0.02em", textTransform: "uppercase", color: INK3, margin: "0 0 9px 16px" }}>{children}</div>
);
const Footnote = ({ children }: { children: ReactNode }) => (
  <div style={{ fontSize: 12.5, lineHeight: 1.42, color: INK3, margin: "9px 16px 0" }}>{children}</div>
);

function CloseGlyph() {
  return (
    <svg width="12.5" height="12.5" viewBox="0 0 14 14" fill="none" stroke="#8a8a8e" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
      <path d="M2 2l10 10M12 2L2 12" />
    </svg>
  );
}
function CopyGlyph({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M5 15V5a2 2 0 0 1 2-2h8" />
    </svg>
  );
}
function QrGlyph({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1.2" /><rect x="14" y="3" width="7" height="7" rx="1.2" /><rect x="3" y="14" width="7" height="7" rx="1.2" />
      <path d="M14 14h3v3M20 14v.01M14 20h.01M17 20h.01M20 17v3" />
    </svg>
  );
}

/** Donation sheet — iOS grouped layout: rubles via ЮMoney + USDT (TRC20) with copy & QR. */
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
    QRCode.toDataURL(USDT_TRC20, { margin: 1, width: 480, errorCorrectionLevel: "M", color: { dark: "#1d1d1f", light: "#ffffff" } })
      .then((d) => setQr(d))
      .catch(() => {});
  }, [showQr, qr]);

  const copy = () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(USDT_TRC20)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 1900); })
      .catch(() => {});
  };

  const card: CSSProperties = { background: "#fff", borderRadius: 14, overflow: "hidden" };
  const row: CSSProperties = { display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 52, padding: "0 16px", border: "none", background: "transparent", fontSize: 15.5, fontWeight: 500, letterSpacing: "-0.01em", cursor: "pointer", fontFamily: "var(--font-text)", textAlign: "left" };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(0,0,0,0.42)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: "relative", width: "100%", maxWidth: 376, maxHeight: "calc(100dvh - 40px)", overflowY: "auto", WebkitOverflowScrolling: "touch", background: GROUPED, borderRadius: 30, padding: "30px 16px 22px", boxShadow: "0 30px 80px rgba(0,0,0,0.30)", fontFamily: "var(--font-text)" }}
      >
        <button
          onClick={onClose}
          aria-label="Закрыть"
          style={{ position: "absolute", top: 14, right: 14, display: "grid", placeItems: "center", width: 30, height: 30, borderRadius: "50%", border: "none", background: "rgba(120,120,128,0.16)", cursor: "pointer", padding: 0, zIndex: 2 }}
        >
          <CloseGlyph />
        </button>
        {/* ── header ── */}
        <IskconMark size={56} />
        <h1 style={{ margin: "18px 0 0", fontSize: 26, lineHeight: 1.1, fontWeight: 700, letterSpacing: "-0.022em", color: INK, textAlign: "center", fontFamily: "var(--font-text)" }}>
          Поддержать
        </h1>
        <p style={{ margin: "11px auto 0", maxWidth: 300, fontSize: 14, lineHeight: 1.5, color: INK2, textAlign: "center" }}>
          Ваш вклад помогает распространять и развивать послание Шрилы Прабхупады и Шри Кришны Чайтаньи Махапрабху через онлайн-проект ISKCON ONE LOVE.
        </p>

        {/* ── Рубли · ЮMoney ── */}
        <div style={{ marginTop: 32 }}>
          <SectionHeader>Рубли · карты · СБП</SectionHeader>
          <a
            href={YOOMONEY_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 54, borderRadius: 14, background: INK, color: "#fff", fontSize: 16.5, fontWeight: 600, letterSpacing: "-0.01em", textDecoration: "none" }}
          >
            Поддержать через ЮMoney
          </a>
          <Footnote>Откроется защищённая страница ЮMoney.</Footnote>
        </div>

        {/* ── Криптовалюта · USDT TRC20 ── */}
        <div style={{ marginTop: 28 }}>
          <SectionHeader>Криптовалюта · USDT (TRC20)</SectionHeader>
          <div style={card}>
            <div style={{ padding: "14px 16px 13px" }}>
              <div style={{ fontSize: 11.5, color: INK3, marginBottom: 5 }}>Адрес кошелька</div>
              <code style={{ display: "block", fontSize: 13.5, lineHeight: 1.4, color: INK, wordBreak: "break-all", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{USDT_TRC20}</code>
            </div>
            <button onClick={copy} style={{ ...row, borderTop: `0.5px solid ${HAIR}`, color: copied ? OK : INK }}>
              <CopyGlyph color={copied ? OK : INK2} />
              <span style={{ flex: 1 }}>{copied ? "Адрес скопирован" : "Копировать адрес"}</span>
              {copied && <span style={{ fontSize: 16 }}>✓</span>}
            </button>
            <button onClick={() => setShowQr((v) => !v)} style={{ ...row, borderTop: `0.5px solid ${HAIR}`, color: INK }}>
              <QrGlyph color={INK2} />
              <span style={{ flex: 1 }}>{showQr ? "Скрыть QR-код" : "Показать QR-код"}</span>
              <span style={{ color: INK3, fontSize: 11 }}>{showQr ? "▲" : "▼"}</span>
            </button>
            {showQr && (
              <div style={{ borderTop: `0.5px solid ${HAIR}`, padding: 18, display: "grid", placeItems: "center" }}>
                <div style={{ width: 196, height: 196, display: "grid", placeItems: "center", borderRadius: 14, background: "#fff", boxShadow: "0 0 0 0.5px " + HAIR }}>
                  {qr
                    ? <img src={qr} alt="QR-код USDT TRC20" width={172} height={172} style={{ display: "block" }} />
                    : <span style={{ fontSize: 13, color: INK3 }}>Генерация…</span>}
                </div>
              </div>
            )}
          </div>
          <Footnote>Отправляйте только USDT в сети TRC20 (Tron). Перевод в другой сети может быть утерян.</Footnote>
        </div>
      </div>
    </div>
  );
}
