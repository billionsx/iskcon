/**
 * BookMenuSheet — the single ⋯ menu for the book (card, detail hero, verse reader).
 *
 * iOS-26 system action menu (the Photos/Share-sheet list standard):
 *   • Grouped rounded card; each row is a LEADING SF-style glyph + label.
 *   • Hairline separators inset to the label column.
 *   • Material + text follow the app theme tokens (the app runs light, so this
 *     reads as a light frosted card — matching the iOS light share sheet).
 *   • Springs from the ⋯ button (anchorRef) with the iOS spring; flips above the
 *     button when there isn't room below.
 *
 * Items: Поделиться · Скачать PDF · QR-код · Задонатить · Сообщить об ошибке.
 * Glyphs mirror SF Symbols (square.and.arrow.up / .down, qrcode, gift,
 * exclamationmark.triangle). "Задонатить" is a gift — never a heart (the heart is
 * reserved for «в избранное»).
 */
import { useLayoutEffect, useState, type ReactNode, type RefObject } from "react";

const S = 23;
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function Svg({ children }: { children: ReactNode }) {
  return <svg width={S} height={S} viewBox="0 0 24 24" aria-hidden>{children}</svg>;
}

/* square.and.arrow.up */
const ShareGlyph = () => <Svg><g {...stroke}><path d="M12 3.5v11" /><path d="M8.3 7.2 12 3.5l3.7 3.7" /><path d="M7 10.5H6.2A1.8 1.8 0 0 0 4.4 12.3v6.4A1.8 1.8 0 0 0 6.2 20.5h11.6a1.8 1.8 0 0 0 1.8-1.8v-6.4a1.8 1.8 0 0 0-1.8-1.8H17" /></g></Svg>;
/* square.and.arrow.down */
const PdfGlyph = () => <Svg><g {...stroke}><path d="M12 4v10.5" /><path d="M8.3 10.8 12 14.5l3.7-3.7" /><path d="M7 13.5H6.2A1.8 1.8 0 0 0 4.4 15.3v3.4A1.8 1.8 0 0 0 6.2 20.5h11.6a1.8 1.8 0 0 0 1.8-1.8v-3.4a1.8 1.8 0 0 0-1.8-1.8H17" /></g></Svg>;
/* qrcode */
const QrGlyph = () => (
  <Svg>
    <g fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinejoin="round">
      <rect x="4" y="4" width="6" height="6" rx="1.6" /><rect x="14" y="4" width="6" height="6" rx="1.6" /><rect x="4" y="14" width="6" height="6" rx="1.6" />
    </g>
    <g fill="currentColor">
      <rect x="14" y="14" width="2.4" height="2.4" rx="0.5" /><rect x="17.6" y="14" width="2.4" height="2.4" rx="0.5" /><rect x="14" y="17.6" width="2.4" height="2.4" rx="0.5" /><rect x="17.6" y="17.6" width="2.4" height="2.4" rx="0.5" />
    </g>
  </Svg>
);
/* gift — «задонатить / поддержать»; distinct from BagIcon, unrelated to the heart. */
const GiftGlyph = () => (
  <Svg>
    <g {...stroke}>
      <rect x="3.8" y="8.6" width="16.4" height="3.6" rx="1.2" />
      <path d="M5.4 12.2v6.2a1.6 1.6 0 0 0 1.6 1.6h10a1.6 1.6 0 0 0 1.6-1.6v-6.2" />
      <path d="M12 8.6v11.6" />
      <path d="M12 8.6C12 8.6 11 4.8 8.7 5.1 6.9 5.3 6.9 8 9 8.4c1 .2 3 .2 3 .2Z" />
      <path d="M12 8.6c0 0 1-3.8 3.3-3.5 1.8.2 1.8 2.9-.3 3.3-1 .2-3 .2-3 .2Z" />
    </g>
  </Svg>
);
/* exclamationmark.triangle */
const ReportGlyph = () => <Svg><g {...stroke}><path d="M12 4.5 20.5 19 3.5 19Z" /><path d="M12 10v3.8" /></g><circle cx="12" cy="16.4" r="0.6" fill="currentColor" /></Svg>;

const ITEMS: { id: string; label: string; Icon: () => ReactNode; danger?: boolean }[] = [
  { id: "share", label: "Поделиться", Icon: ShareGlyph },
  { id: "pdf", label: "Скачать PDF", Icon: PdfGlyph },
  { id: "qr", label: "QR-код", Icon: QrGlyph },
  { id: "donate", label: "Задонатить", Icon: GiftGlyph },
  { id: "report", label: "Сообщить об ошибке", Icon: ReportGlyph },
];

const ROW_H = 54;
const TEXT_X = 58; // leading icon column width — labels & separators start here
const MENU_CSS = `
@keyframes bm-pop { from { opacity: 0; transform: scale(.92) } to { opacity: 1; transform: scale(1) } }
.bm-row { position: relative; -webkit-tap-highlight-color: transparent; transition: background-color .12s ease; }
.bm-row:active { background-color: rgba(120,120,128,0.20); }
@media (hover: hover) { .bm-row:hover { background-color: rgba(120,120,128,0.10); } }
.bm-row:not(:first-of-type)::before { content: ""; position: absolute; top: 0; left: ${TEXT_X}px; right: 0; height: 0.5px; background: var(--color-glass-stroke, rgba(0,0,0,0.12)); }
@media (prefers-reduced-motion: reduce) { .bm-menu { animation: none !important; } }
`;

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
      const below = r.bottom + 8;
      const flip = below + menuH > window.innerHeight - 10;
      setPos({
        top: flip ? Math.max(10, r.top - menuH - 8) : below,
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
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.18)" }}>
      <style>{MENU_CSS}</style>
      <div className="bm-menu" role="menu" onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed", top: pos.top, right: pos.right, width: 290,
          background: "var(--color-glass-nav, rgba(252,252,253,0.97))",
          backdropFilter: "blur(40px) saturate(180%)", WebkitBackdropFilter: "blur(40px) saturate(180%)",
          borderRadius: 20, overflow: "hidden",
          border: "0.5px solid var(--color-glass-stroke, rgba(0,0,0,0.12))",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), 0 12px 40px rgba(0,0,0,0.18)",
          transformOrigin: pos.flip ? "bottom right" : "top right",
          animation: "bm-pop .18s cubic-bezier(.2,.9,.3,1.2)",
        }}>
        {ITEMS.map((it) => {
          const color = it.danger ? "var(--color-red, #FF3B30)" : "var(--color-label, rgba(0,0,0,0.92))";
          return (
            <button key={it.id} role="menuitem" type="button" className="bm-row"
              onClick={() => { onClose(); onSelect(it.id); }}
              style={{
                display: "flex", width: "100%", alignItems: "center", gap: 0,
                height: ROW_H, padding: 0, background: "none", border: "none",
                cursor: "pointer", textAlign: "left",
              }}>
              <span style={{ width: TEXT_X, display: "inline-flex", justifyContent: "center", flexShrink: 0, color }}>{it.Icon()}</span>
              <span style={{ fontFamily: "var(--font-text)", fontSize: 17, letterSpacing: "-0.01em", color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingRight: 18 }}>{it.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
