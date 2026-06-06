/**
 * BookMenuSheet — the single ⋯ menu for the book (card, detail hero, verse reader).
 *
 * iOS Share-Sheet, replicated as a FULL-WIDTH BOTTOM SHEET (light):
 *   • Dimmed full-screen scrim; sheet docked to the bottom, springs up.
 *   • Grabber, then SECTIONED grouped cards (light, slightly lighter than the
 *     sheet) with a gap between groups.
 *   • Each row: LEADING black SF-style glyph + label; no trailing element.
 *   • Hairline separators between rows WITHIN a card, inset to the label column.
 *   • Text from theme tokens (app runs light).
 *
 * Items: [Поделиться · Скачать PDF · QR-код]  [Задонатить · Сообщить об ошибке].
 * Glyphs mirror SF Symbols. "Задонатить" is a gift — never a heart.
 *
 * (anchorRef is accepted for call-site compatibility but unused — the sheet is
 *  bottom-anchored, not popover-anchored.)
 */
import type { ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";

const S = 26;
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
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
    <g fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round">
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

type Item = { id: string; label: string; Icon: () => ReactNode; danger?: boolean };
const GROUPS: Item[][] = [
  [
    { id: "share", label: "Поделиться", Icon: ShareGlyph },
    { id: "pdf", label: "Скачать PDF", Icon: PdfGlyph },
    { id: "qr", label: "QR-код", Icon: QrGlyph },
  ],
  [
    { id: "donate", label: "Задонатить", Icon: GiftGlyph },
    { id: "report", label: "Сообщить об ошибке", Icon: ReportGlyph },
  ],
];
type Group = { title?: string; items: Item[] };
// Меню плеера: действия по текущей главе и по всей книге; ссылки ведут на прослушивание.
function buildPlayerGroups(chapterLabel: string | undefined, isChapter: boolean): Group[] {
  const g: Group[] = [];
  if (isChapter) g.push({ title: chapterLabel, items: [
    { id: "share-chapter", label: "Поделиться главой", Icon: ShareGlyph },
    { id: "qr-chapter", label: "QR-код главы", Icon: QrGlyph },
    { id: "download-chapter", label: "Скачать главу", Icon: PdfGlyph },
  ] });
  g.push({ title: "Вся книга", items: [
    { id: "share-book", label: "Поделиться книгой", Icon: ShareGlyph },
    { id: "qr-book", label: "QR-код книги", Icon: QrGlyph },
  ] });
  g.push({ items: [
    { id: "donate", label: "Задонатить", Icon: GiftGlyph },
    { id: "report", label: "Сообщить об ошибке", Icon: ReportGlyph },
  ] });
  return g;
}

const ROW_H = 56;
const PAD_L = 20;
const ICON_BOX = 26;
const GAP = 16;
const SEP_LEFT = PAD_L + ICON_BOX + GAP;

const SHEET_CSS = `
.bms-scrim { animation: bms-fade .22s ease-out; }
.bms-sheet { animation: bms-rise .36s cubic-bezier(.32,.72,0,1); }
@keyframes bms-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes bms-rise { from { transform: translateY(100%) } to { transform: translateY(0) } }
.bms-row { position: relative; -webkit-tap-highlight-color: transparent; transition: background-color .12s ease; }
.bms-row:active { background-color: rgba(120,120,128,0.18); }
@media (hover: hover) { .bms-row:hover { background-color: rgba(120,120,128,0.10); } }
.bms-row:not(:first-child)::before { content: ""; position: absolute; top: 0; left: ${SEP_LEFT}px; right: 0; height: 0.5px; background: rgba(60,60,67,0.13); }
@media (prefers-reduced-motion: reduce) { .bms-scrim, .bms-sheet { animation: none !important; } }
`;

export function BookMenuSheet({ open, onClose, onSelect, variant = "book", chapterLabel, isChapter = false }: {
  open: boolean; onClose: () => void; onSelect: (id: string) => void;
  anchorRef?: RefObject<HTMLElement | null>;
  variant?: "book" | "player"; chapterLabel?: string; isChapter?: boolean;
}) {
  if (!open || typeof document === "undefined") return null;
  const data: Group[] = variant === "player" ? buildPlayerGroups(chapterLabel, isChapter) : GROUPS.map((items) => ({ items }));
  const onPick = (id: string) => { onClose(); onSelect(id); };
  return createPortal(
    <div className="bms-scrim" onClick={(e) => { e.stopPropagation(); onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.32)" }}>
      <style>{SHEET_CSS}</style>
      <div className="bms-sheet" role="menu" onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 540,
          background: "rgba(243,243,246,0.82)",
          backdropFilter: "blur(36px) saturate(180%)", WebkitBackdropFilter: "blur(36px) saturate(180%)",
          borderTopLeftRadius: 22, borderTopRightRadius: 22,
          borderTop: "0.5px solid rgba(255,255,255,0.6)",
          boxShadow: "0 -10px 50px rgba(0,0,0,0.22)",
          padding: "0 10px max(16px, env(safe-area-inset-bottom))",
          display: "flex", flexDirection: "column",
        }}>
        <div style={{ height: 5, width: 36, borderRadius: 999, background: "rgba(60,60,67,0.3)", margin: "8px auto 12px" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {data.map((group, gi) => (
            <div key={gi}>
              {group.title && <div style={{ padding: "0 16px 6px", fontSize: 12.5, fontWeight: 600, letterSpacing: "0.02em", textTransform: "uppercase", color: "rgba(60,60,67,0.55)" }}>{group.title}</div>}
              <div style={{ borderRadius: 16, overflow: "hidden", background: "rgba(252,252,254,0.94)" }}>
              {group.items.map((it) => {
                const color = it.danger ? "var(--color-red, #FF3B30)" : "var(--color-label, rgba(0,0,0,0.92))";
                return (
                  <button key={it.id} role="menuitem" type="button" className="bms-row"
                    onClick={() => onPick(it.id)}
                    style={{
                      display: "flex", width: "100%", alignItems: "center",
                      height: ROW_H, paddingLeft: PAD_L, paddingRight: 16, gap: GAP,
                      background: "none", border: "none", cursor: "pointer", textAlign: "left",
                    }}>
                    <span style={{ width: ICON_BOX, height: ICON_BOX, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color }}>{it.Icon()}</span>
                    <span style={{ fontFamily: "var(--font-text)", fontSize: 17.5, letterSpacing: "-0.01em", color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.label}</span>
                  </button>
                );
              })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
