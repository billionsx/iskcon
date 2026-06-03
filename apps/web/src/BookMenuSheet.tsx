/**
 * BookMenuSheet — the single ⋯ menu (card, detail hero, verse reader).
 * iOS-style floating context menu: a translucent rounded card that springs from
 * the ⋯ button (anchorRef), label-left + SF-symbol-like glyph trailing.
 * Items: Поделиться · Скачать PDF · QR-код · Задонатить · Сообщить об ошибке.
 */
import { useLayoutEffect, useState, type ReactNode, type RefObject } from "react";

const INK = "#1c1c1e";
const SEP = "rgba(0,0,0,0.08)";

const S = 21;
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function Svg({ children }: { children: ReactNode }) {
  return <svg width={S} height={S} viewBox="0 0 24 24" aria-hidden>{children}</svg>;
}
const ShareGlyph = () => <Svg><g {...stroke}><path d="M12 4v10.5" /><path d="M8.5 7.5 12 4l3.5 3.5" /><path d="M6.5 12v6.4a1.6 1.6 0 0 0 1.6 1.6h7.8a1.6 1.6 0 0 0 1.6-1.6V12" /></g></Svg>;
const PdfGlyph = () => <Svg><g {...stroke}><path d="M12 4v9" /><path d="M8.5 9.5 12 13l3.5-3.5" /><path d="M6 14v3.6a1.6 1.6 0 0 0 1.6 1.6h8.8a1.6 1.6 0 0 0 1.6-1.6V14" /></g></Svg>;
const QrGlyph = () => (
  <Svg>
    <g fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round">
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

const ITEMS: { id: string; label: string; Icon: () => ReactNode; danger?: boolean }[] = [
  { id: "share", label: "Поделиться", Icon: ShareGlyph },
  { id: "pdf", label: "Скачать PDF", Icon: PdfGlyph },
  { id: "qr", label: "QR-код", Icon: QrGlyph },
  { id: "donate", label: "Задонатить", Icon: HeartGlyph },
  { id: "report", label: "Сообщить об ошибке", Icon: ReportGlyph },
];

const ROW_H = 46;

export function BookMenuSheet({ open, onClose, onSelect, anchorRef }: {
  open: boolean; onClose: () => void; onSelect: (id: string) => void;
  anchorRef?: RefObject<HTMLElement | null>;
}) {
  const [pos, setPos] = useState<{ top: number; right: number; flip: boolean }>({ top: 64, right: 16, flip: false });

  useLayoutEffect(() => {
    if (!open) return;
    const menuH = ITEMS.length * ROW_H + 12;
    const el = anchorRef?.current;
    if (el) {
      const r = el.getBoundingClientRect();
      const below = r.bottom + 6;
      const flip = below + menuH > window.innerHeight - 10;
      setPos({
        top: flip ? Math.max(10, r.top - menuH - 6) : below,
        right: Math.max(10, window.innerWidth - r.right),
        flip,
      });
    } else {
      setPos({ top: 64, right: 16, flip: false });
    }
  }, [open, anchorRef]);

  if (!open) return null;
  return (
    <div onClick={(e) => { e.stopPropagation(); onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.12)" }}>
      <div role="menu" onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed", top: pos.top, right: pos.right, width: 262,
          background: "rgba(249,249,250,0.78)",
          backdropFilter: "blur(24px) saturate(180%)", WebkitBackdropFilter: "blur(24px) saturate(180%)",
          borderRadius: 14, overflow: "hidden",
          boxShadow: "0 12px 44px rgba(0,0,0,0.24), inset 0 0 0 0.5px rgba(0,0,0,0.05)",
          transformOrigin: pos.flip ? "bottom right" : "top right",
          animation: "bmEnter .17s cubic-bezier(.2,.9,.3,1.2)",
        }}>
        <style>{`@keyframes bmEnter{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:scale(1)}}`}</style>
        {ITEMS.map((it, i) => (
          <button key={it.id} role="menuitem" type="button"
            onClick={() => { onClose(); onSelect(it.id); }}
            style={{
              display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", gap: 14,
              height: ROW_H, padding: "0 16px", background: "none", border: "none",
              borderTop: i === 0 ? "none" : `0.5px solid ${SEP}`,
              fontFamily: "var(--font-text)", fontSize: 16.5, letterSpacing: "-0.01em",
              color: it.danger ? "#FF3B30" : INK, cursor: "pointer", textAlign: "left", whiteSpace: "nowrap",
            }}>
            <span>{it.label}</span>
            <span style={{ display: "inline-flex", flexShrink: 0, color: it.danger ? "#FF3B30" : INK }}>{it.Icon()}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
