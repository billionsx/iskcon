/**
 * BookMenuSheet — the single ⋯ menu for the book (card, detail hero, verse reader).
 *
 * iOS-26 Liquid Glass context menu (dark-first, matches the app shell):
 *   • Springs from the ⋯ button (anchorRef) with the iOS spring; flips above the
 *     button when there isn't room below.
 *   • Frosted DARK material (backdrop-blur + saturate), light label text — never a
 *     light card on the dark shell.
 *   • Hairline separators, specular top rim, soft ambient lift, press/hover states.
 *
 * Items: Поделиться · Скачать PDF · QR-код · Задонатить · Сообщить об ошибке.
 * Trailing glyphs are SF-symbol-like; "Задонатить" uses a gift (give) glyph,
 * never a heart — the heart is reserved for «в избранное».
 */
import { useLayoutEffect, useState, type ReactNode, type RefObject } from "react";

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
/* Gift — «задонатить / поддержать». Lid + body + ribbon + bow. Distinct from the
   shopping bag (BagIcon) and unrelated to the heart (избранное). */
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
const ReportGlyph = () => <Svg><g {...stroke}><path d="M12 4.8 20 18.6 4 18.6Z" /><path d="M12 10v3.6" /></g><circle cx="12" cy="16.6" r="0.55" fill="currentColor" /></Svg>;

const ITEMS: { id: string; label: string; Icon: () => ReactNode; danger?: boolean }[] = [
  { id: "share", label: "Поделиться", Icon: ShareGlyph },
  { id: "pdf", label: "Скачать PDF", Icon: PdfGlyph },
  { id: "qr", label: "QR-код", Icon: QrGlyph },
  { id: "donate", label: "Задонатить", Icon: GiftGlyph },
  { id: "report", label: "Сообщить об ошибке", Icon: ReportGlyph },
];

const ROW_H = 46;
const MENU_CSS = `
@keyframes bm-pop { from { opacity: 0; transform: scale(.92) } to { opacity: 1; transform: scale(1) } }
.bm-row { position: relative; -webkit-tap-highlight-color: transparent; transition: background-color .12s ease; }
.bm-row:active { background-color: rgba(255,255,255,0.12); }
@media (hover: hover) { .bm-row:hover { background-color: rgba(255,255,255,0.06); } }
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
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.18)" }}>
      <style>{MENU_CSS}</style>
      <div className="bm-menu" role="menu" onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed", top: pos.top, right: pos.right, width: 262,
          background: "rgba(28,28,30,0.78)",
          backdropFilter: "blur(40px) saturate(180%)", WebkitBackdropFilter: "blur(40px) saturate(180%)",
          borderRadius: 14, overflow: "hidden",
          border: "0.5px solid rgba(255,255,255,0.12)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.14), 0 10px 40px rgba(0,0,0,0.45)",
          transformOrigin: pos.flip ? "bottom right" : "top right",
          animation: "bm-pop .18s cubic-bezier(.2,.9,.3,1.2)",
        }}>
        {ITEMS.map((it, i) => (
          <button key={it.id} role="menuitem" type="button" className="bm-row"
            onClick={() => { onClose(); onSelect(it.id); }}
            style={{
              display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", gap: 14,
              height: ROW_H, padding: "0 16px", background: "none", border: "none",
              borderTop: i === 0 ? "none" : "0.5px solid rgba(255,255,255,0.09)",
              fontFamily: "var(--font-text)", fontSize: 16.5, letterSpacing: "-0.01em",
              color: it.danger ? "#FF453A" : "var(--color-label, rgba(255,255,255,0.95))",
              cursor: "pointer", textAlign: "left", whiteSpace: "nowrap",
            }}>
            <span>{it.label}</span>
            <span style={{ display: "inline-flex", flexShrink: 0, color: it.danger ? "#FF453A" : "var(--color-label-2, rgba(235,235,245,0.6))" }}>{it.Icon()}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
