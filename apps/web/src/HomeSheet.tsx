/**
 * HomeSheet — переиспользуемый iOS-лист Главной (по паттерну PrabhupadaSheet):
 * затемнение + блюр, слайд снизу, ручка, круглая кнопка закрытия, скролл-тело.
 * Используется для ПКЦ/ПКР (место) и ПКД (документ).
 */
import { useEffect } from "react";

export function HomeSheet({ open, label, onClose, children }: {
  open: boolean; label: string; onClose: () => void; children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    document.body.classList.add("gtab-off");
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; document.body.classList.remove("gtab-off"); window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={label} onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(0,0,0,0.42)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center", animation: "hsFade .2s ease-out" }}>
      <style>{`
        @keyframes hsFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes hsSlide { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 560, maxHeight: "92vh", background: "var(--color-bg)", borderTopLeftRadius: 22, borderTopRightRadius: 22,
          overflow: "hidden", display: "flex", flexDirection: "column", animation: "hsSlide .32s cubic-bezier(.22,1,.36,1)", boxShadow: "0 -10px 50px rgba(0,0,0,0.35)" }}>
        <div style={{ display: "grid", placeItems: "center", padding: "10px 0 4px", flexShrink: 0 }}>
          <span aria-hidden style={{ width: 38, height: 5, borderRadius: 3, background: "var(--color-label-3)", opacity: 0.5 }} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 14px", flexShrink: 0 }}>
          <button type="button" aria-label="Закрыть" onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: "50%", border: "none", background: "var(--color-glass-regular)", color: "var(--color-label-2)", cursor: "pointer", display: "grid", placeItems: "center", WebkitTapHighlightColor: "transparent" }}>
            <svg width="14" height="14" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "6px 22px 34px", fontFamily: "var(--font-text)" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
