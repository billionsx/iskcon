/**
 * BookMenuSheet — the single ⋯ menu for the book (card, detail hero, verse reader).
 * iOS-26-style action list: label left, SF-symbol-like glyph trailing.
 * Items: Поделиться · Скачать PDF · QR-код · Задонатить · Сообщить об ошибке.
 */
import type { ReactNode } from "react";

const INK = "#1f2024";
const LINE = "rgba(0,0,0,0.08)";

const S = 21;
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function Svg({ children }: { children: ReactNode }) {
  return <svg width={S} height={S} viewBox="0 0 24 24" aria-hidden>{children}</svg>;
}
const ShareGlyph = () => <Svg><g {...stroke}><path d="M12 4v10.5" /><path d="M8.5 7.5 12 4l3.5 3.5" /><path d="M6.5 12v6.4a1.6 1.6 0 0 0 1.6 1.6h7.8a1.6 1.6 0 0 0 1.6-1.6V12" /></g></Svg>;
const PdfGlyph = () => <Svg><g {...stroke}><path d="M12 4v9" /><path d="M8.5 9.5 12 13l3.5-3.5" /><path d="M6 14v3.6a1.6 1.6 0 0 0 1.6 1.6h8.8a1.6 1.6 0 0 0 1.6-1.6V14" /></g></Svg>;
const QrGlyph = () => (
  <Svg>
    <g fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round">
      <rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" /><rect x="4" y="14" width="6" height="6" rx="1.5" />
    </g>
    <g fill="currentColor">
      <rect x="6.2" y="6.2" width="1.6" height="1.6" rx="0.4" /><rect x="16.2" y="6.2" width="1.6" height="1.6" rx="0.4" /><rect x="6.2" y="16.2" width="1.6" height="1.6" rx="0.4" />
      <rect x="14" y="14" width="2.3" height="2.3" rx="0.5" /><rect x="17.7" y="14" width="2.3" height="2.3" rx="0.5" /><rect x="14" y="17.7" width="2.3" height="2.3" rx="0.5" /><rect x="17.7" y="17.7" width="2.3" height="2.3" rx="0.5" />
    </g>
  </Svg>
);
const HeartGlyph = () => <Svg><path {...stroke} d="M12 20c-5.5-3.4-7.4-6.5-7.4-9.3 0-2.1 1.5-3.9 3.6-3.9 1.5 0 2.7 .8 3.8 2.3 1.1-1.5 2.3-2.3 3.8-2.3 2.1 0 3.6 1.8 3.6 3.9 0 2.8-1.9 5.9-7.4 9.3Z" /></Svg>;
const ReportGlyph = () => <Svg><g {...stroke}><path d="M12 4.8 20 18.6 4 18.6Z" /><path d="M12 10v3.6" /></g><circle cx="12" cy="16.6" r="0.55" fill="currentColor" /></Svg>;

const ITEMS: { id: string; label: string; Icon: () => ReactNode }[] = [
  { id: "share", label: "Поделиться", Icon: ShareGlyph },
  { id: "pdf", label: "Скачать PDF", Icon: PdfGlyph },
  { id: "qr", label: "QR-код", Icon: QrGlyph },
  { id: "donate", label: "Задонатить", Icon: HeartGlyph },
  { id: "report", label: "Сообщить об ошибке", Icon: ReportGlyph },
];

export function BookMenuSheet({ open, onClose, onSelect }: { open: boolean; onClose: () => void; onSelect: (id: string) => void }) {
  if (!open) return null;
  return (
    <div onClick={(e) => { e.stopPropagation(); onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 120, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,.4)" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 480, background: "var(--color-bg-2, #fff)", borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: "8px 0 max(8px, env(safe-area-inset-bottom))", boxShadow: "0 -8px 40px rgba(0,0,0,.18)" }}>
        <div style={{ height: 5, width: 36, borderRadius: 999, background: LINE, margin: "8px auto 6px" }} />
        {ITEMS.map((it, i) => (
          <button key={it.id} type="button" onClick={() => { onClose(); onSelect(it.id); }}
            style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "15px 22px", background: "none", border: "none", borderTop: i === 0 ? "none" : `0.5px solid ${LINE}`, fontFamily: "var(--font-text)", fontSize: 17, letterSpacing: "-0.01em", color: INK, cursor: "pointer", textAlign: "left" }}>
            <span>{it.label}</span>
            <span style={{ display: "inline-flex", flexShrink: 0, color: INK }}>{it.Icon()}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
