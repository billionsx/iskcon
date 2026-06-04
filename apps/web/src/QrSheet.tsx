import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** QR-код текущего адреса в стиле приложения (светлая тема). */
export function QrSheet({ url, title, onClose }: { url: string; title?: string; onClose: () => void }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let live = true;
    QRCode.toDataURL(url, {
      margin: 1,
      width: 520,
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
      style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 320, background: "#fff", borderRadius: 22, padding: "26px 24px 20px", boxShadow: "0 24px 70px rgba(0,0,0,0.28)", textAlign: "center", fontFamily: "var(--font-text)" }}
      >
        <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em", color: "#1f2024" }}>QR-код</div>
        {title && <div style={{ marginTop: 4, fontSize: 13, color: "#70727b" }}>{title}</div>}
        <div style={{ marginTop: 18, width: 224, height: 224, margin: "18px auto 0", display: "grid", placeItems: "center", borderRadius: 14, background: "#fff", border: "0.5px solid rgba(0,0,0,0.08)" }}>
          {src
            ? <img src={src} alt="QR-код" width={200} height={200} style={{ display: "block" }} />
            : <span style={{ fontSize: 13, color: "#a7a8b0" }}>Генерация…</span>}
        </div>
        <div style={{ marginTop: 14, fontSize: 12.5, lineHeight: 1.4, color: "#a7a8b0", wordBreak: "break-all" }}>{url}</div>
        <button
          onClick={onClose}
          style={{ marginTop: 18, width: "100%", height: 46, borderRadius: 14, border: "none", background: "#1f2024", color: "#fff", fontSize: 15.5, fontWeight: 600, letterSpacing: "-0.01em", cursor: "pointer", fontFamily: "var(--font-text)" }}
        >
          Готово
        </button>
      </div>
    </div>
  );
}
