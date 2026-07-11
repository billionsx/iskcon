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
/* bag — «заказать печатное издание»; iOS bag, отличается от подарка-доната. */
const BagGlyph = () => <Svg><g {...stroke}><path d="M6 8.6h12a.8.8 0 0 1 .8.86l-.78 9.4A1.5 1.5 0 0 1 16.53 20.2H7.47a1.5 1.5 0 0 1-1.49-1.34l-.78-9.4A.8.8 0 0 1 6 8.6Z" /><path d="M9 9V7a3 3 0 0 1 6 0v2" /></g></Svg>;
/* note.text — «в заметки»: страница с линиями текста и загнутым уголком. */
const NoteGlyph = () => <Svg><g {...stroke}><path d="M6 3.6h7.4L18.4 8.6V20a.9.9 0 0 1-.9.9H6a.9.9 0 0 1-.9-.9V4.5A.9.9 0 0 1 6 3.6Z" /><path d="M13.2 3.7v4.6a.6.6 0 0 0 .6.6h4.4" /><path d="M8 12.4h6.6M8 15.4h6.6M8 18.2h3.8" /></g></Svg>;

/* telegram — официальный плейн (FontAwesome telegram-plane), монохром */
const TelegramGlyph = () => <svg width={S} height={S} viewBox="0 0 448 512" aria-hidden fill="currentColor"><path d="M446.7 98.6l-67.6 318.8c-5.1 22.5-18.4 28.1-37.3 17.5l-103-75.9-49.7 47.8c-5.5 5.5-10.1 10.1-20.7 10.1l7.4-104.9 190.9-172.5c8.3-7.4-1.8-11.5-12.9-4.1L117.8 284 16.2 252.2c-22.1-6.9-22.5-22.1 4.6-32.7L418.2 66.4c18.4-6.8 34.5 4.4 28.5 32.2z" /></svg>;

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
/* Контекстные глифы: книга = раскрытая книга, глава = закладка; действие = стрелка (share) / QR. */
const ShareBookGlyph = () => <Svg><g {...stroke}><path d="M12 9.4C10.7 8.4 9 8 6.7 8.3A.9.9 0 0 0 5.9 9.2v8.1a.9.9 0 0 0 1 .9c2-.27 3.6.08 4.8 1 1.2-.92 2.8-1.27 4.8-1a.9.9 0 0 0 1-.9V9.2a.9.9 0 0 0-.8-.9C15 8 13.3 8.4 12 9.4Z" /><path d="M12 9.4v9" /><path d="M12 2V7.4M9.8 4 12 1.8 14.2 4" /></g></Svg>;
const ShareChapterGlyph = () => <Svg><g {...stroke}><path d="M8 6.2h8a1 1 0 0 1 1 1V19l-5-2.6L7 19V7.2a1 1 0 0 1 1-1Z" /><path d="M12 1.2V6.6M9.8 3.2 12 1 14.2 3.2" /></g></Svg>;
const QrBookGlyph = () => <Svg><g fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round"><rect x="4" y="4" width="5.4" height="5.4" rx="1.4" /><rect x="14.6" y="4" width="5.4" height="5.4" rx="1.4" /><rect x="4" y="14.6" width="5.4" height="5.4" rx="1.4" /></g><g {...stroke} strokeWidth={1.2}><path d="M17 15.4c-.8-.5-1.7-.6-2.6-.4v4.2c.9-.2 1.8 0 2.6.5.8-.5 1.7-.7 2.6-.5v-4.2c-.9-.2-1.8-.1-2.6.4Z" /><path d="M17 15.4v4.3" /></g></Svg>;
const QrChapterGlyph = () => <Svg><g fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round"><rect x="4" y="4" width="5.4" height="5.4" rx="1.4" /><rect x="14.6" y="4" width="5.4" height="5.4" rx="1.4" /><rect x="4" y="14.6" width="5.4" height="5.4" rx="1.4" /></g><path d="M15.2 14.8h3.6a.6.6 0 0 1 .6.6v4.4l-2.4-1.3-2.4 1.3v-4.4a.6.6 0 0 1 .6-.6Z" {...stroke} strokeWidth={1.2} /></Svg>;

// Меню плеера — плоский список (без разделения на секции); книга и глава различаются иконками.
function buildPlayerGroups(isChapter: boolean): Group[] {
  const content: Item[] = [{ id: "share-book", label: "Поделиться аудио-книгой", Icon: ShareBookGlyph }];
  if (isChapter) content.push({ id: "share-chapter", label: "Поделиться аудио-главой", Icon: ShareChapterGlyph });
  content.push({ id: "qr-book", label: "QR-код аудио-книги", Icon: QrBookGlyph });
  if (isChapter) content.push({ id: "qr-chapter", label: "QR-код аудио-главы", Icon: QrChapterGlyph });
  if (isChapter) content.push({ id: "download-chapter", label: "Скачать аудио-главу", Icon: PdfGlyph });
  return [
    { items: content },
    { items: [
      { id: "donate", label: "Задонатить", Icon: GiftGlyph },
      { id: "report", label: "Сообщить об ошибке", Icon: ReportGlyph },
    ] },
  ];
}

// Меню киртана — поделиться альбомом, скачать дорожку, поддержать, сообщить.
function buildKirtanGroups(): Group[] {
  return [
    { items: [
      { id: "share-album", label: "Поделиться альбомом", Icon: ShareBookGlyph },
      { id: "download-track", label: "Скачать дорожку", Icon: PdfGlyph },
    ] },
    { items: [
      { id: "donate", label: "Задонатить", Icon: GiftGlyph },
      { id: "report", label: "Сообщить об ошибке", Icon: ReportGlyph },
    ] },
  ];
}

// Меню поста ленты — открыть в Telegram (первой строкой), затем стандартные действия.
// Для даршан-постов (их больше нет в канале) пункт Telegram скрываем.
function buildPostGroups(noTelegram = false, noPdf = false): Group[] {
  const groups: Group[] = [
    { items: [
      { id: "share", label: "Поделиться", Icon: ShareGlyph },
      { id: "pdf", label: "Скачать PDF", Icon: PdfGlyph },
      { id: "qr", label: "QR-код", Icon: QrGlyph },
    ] },
    { items: [
      { id: "donate", label: "Задонатить", Icon: GiftGlyph },
      { id: "report", label: "Сообщить об ошибке", Icon: ReportGlyph },
    ] },
  ];
  if (!noTelegram) groups.unshift({ items: [{ id: "telegram", label: "Открыть в Telegram", Icon: TelegramGlyph }] });
  return noPdf ? groups.map((g) => ({ items: g.items.filter((it) => it.id !== "pdf") })) : groups;
}

// Меню бхаджана — поделиться, PDF (серверный card-рендер), QR, поддержать, сообщить.
function buildBhajanGroups(): Group[] {
  return [
    { items: [
      { id: "share", label: "Поделиться", Icon: ShareGlyph },
      { id: "pdf", label: "Скачать PDF", Icon: PdfGlyph },
      { id: "qr", label: "QR-код", Icon: QrGlyph },
    ] },
    { items: [
      { id: "donate", label: "Задонатить", Icon: GiftGlyph },
      { id: "report", label: "Сообщить об ошибке", Icon: ReportGlyph },
    ] },
  ];
}

/* Глифы для меню заметки. */
const PencilGlyph = () => <Svg><g {...stroke}><path d="M4.5 19.5 4 20l.5-3.4L15.2 5.9a1.8 1.8 0 0 1 2.5 0l.4.4a1.8 1.8 0 0 1 0 2.5L7.4 19.5Z" /><path d="M14.2 6.9 17.1 9.8" /></g></Svg>;
const PinGlyph = () => <Svg><g {...stroke}><path d="M9 3.6h6l-.7 5.1 2.6 2.7v1.7H7.1v-1.7l2.6-2.7L9 3.6Z" /><path d="M12 13.8V20.4" /></g></Svg>;
const SourceGlyph = () => <Svg><g {...stroke}><path d="M11 7H6.5A1.5 1.5 0 0 0 5 8.5v9A1.5 1.5 0 0 0 6.5 19h9a1.5 1.5 0 0 0 1.5-1.5V13" /><path d="M14 5h5v5" /><path d="M19 5l-7.5 7.5" /></g></Svg>;
const TrashGlyph = () => <Svg><g {...stroke}><path d="M5 7h14M9.5 7V5.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7M7 7l.8 12a1 1 0 0 0 1 .9h6.4a1 1 0 0 0 1-.9L18 7" /></g></Svg>;

// Меню заметки — подробная карточка (ПКП). Редактирование первично; «В источник»
// — только если заметка к чему-то привязана; удаление — danger.
function buildNoteGroups(pinned: boolean, hasSource: boolean): Group[] {
  const groups: Group[] = [
    { items: [
      { id: "edit", label: "Редактировать", Icon: PencilGlyph },
      { id: "share", label: "Поделиться", Icon: ShareGlyph },
      { id: "pdf", label: "Скачать PDF", Icon: PdfGlyph },
      { id: "qr", label: "QR-код", Icon: QrGlyph },
    ] },
    { items: [
      { id: "pin", label: pinned ? "Открепить" : "Закрепить", Icon: PinGlyph },
      { id: "delete", label: "Удалить", Icon: TrashGlyph, danger: true },
    ] },
  ];
  if (hasSource) groups.splice(1, 0, { items: [{ id: "source", label: "Перейти к источнику", Icon: SourceGlyph }] });
  return groups;
}

/* Глифы для меню центра (Ятра). */
const RouteGlyph = () => <Svg><g {...stroke}><path d="M12 21s6-5.3 6-10a6 6 0 1 0-12 0c0 4.7 6 10 6 10Z" /><circle cx="12" cy="11" r="2.2" /></g></Svg>;
const ClockGlyph = () => <Svg><g {...stroke}><circle cx="12" cy="12" r="8" /><path d="M12 7.5V12l3 1.8" /></g></Svg>;

// Меню центра — подробная карточка (ПКП) Ятры. Маршрут — только при координатах;
// управление (профиль/расписание) — только редактору/админу центра.
function buildCenterGroups(canManage: boolean, hasMaps: boolean): Group[] {
  const top: Item[] = [
    { id: "share", label: "Поделиться", Icon: ShareGlyph },
    { id: "qr", label: "QR-код", Icon: QrGlyph },
  ];
  if (hasMaps) top.push({ id: "route", label: "Маршрут", Icon: RouteGlyph });
  const groups: Group[] = [
    { items: top },
    { items: [{ id: "note", label: "В заметки", Icon: NoteGlyph }] },
  ];
  if (canManage) groups.push({ items: [
    { id: "edit", label: "Профиль центра", Icon: PencilGlyph },
    { id: "schedule", label: "Расписание", Icon: ClockGlyph },
  ] });
  groups.push({ items: [{ id: "report", label: "Сообщить об ошибке", Icon: ReportGlyph }] });
  return groups;
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

export { NoteGlyph };

export function BookMenuSheet({ open, onClose, onSelect, variant = "book", isChapter = false, canOrder = false, withNote = false, noPdf = false, noTelegram = false, notePinned = false, noteHasSource = false, centerCanManage = false, centerHasMaps = false }: {
  open: boolean; onClose: () => void; onSelect: (id: string) => void;
  anchorRef?: RefObject<HTMLElement | null>;
  variant?: "book" | "player" | "kirtan" | "bhajan" | "note" | "center" | "post"; isChapter?: boolean; canOrder?: boolean; withNote?: boolean; noPdf?: boolean; noTelegram?: boolean;
  notePinned?: boolean; noteHasSource?: boolean; centerCanManage?: boolean; centerHasMaps?: boolean;
}) {
  if (!open || typeof document === "undefined") return null;
  const data: Group[] =
    variant === "note" ? buildNoteGroups(notePinned, noteHasSource)
      : variant === "center" ? buildCenterGroups(centerCanManage, centerHasMaps)
        : variant === "post" ? buildPostGroups(noTelegram, noPdf)
          : variant === "kirtan" ? buildKirtanGroups()
          : variant === "bhajan" ? buildBhajanGroups()
            : variant === "player" ? buildPlayerGroups(isChapter)
              : (() => {
                  const groups: Group[] = GROUPS.map((items) => ({ items: noPdf ? items.filter((it) => it.id !== "pdf") : items }));
                  if (canOrder) groups.splice(1, 0, { items: [{ id: "order", label: "Заказать печатное издание", Icon: BagGlyph }] });
                  return groups;
                })();
  // «В заметки» — отдельной верхней группой: жест садху «сохранить ценное» первичен.
  if (withNote) data.unshift({ items: [{ id: "note", label: "В заметки", Icon: NoteGlyph }] });
  const onPick = (id: string) => { onClose(); onSelect(id); };
  return createPortal(
    <div className="bms-scrim" onClick={(e) => { e.stopPropagation(); onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 2000, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.32)" }}>
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
              {group.title && <div style={{ padding: "0 16px 6px", fontSize: "var(--text-footnote)", fontWeight: 600, letterSpacing: "0.02em", textTransform: "uppercase", color: "rgba(60,60,67,0.55)" }}>{group.title}</div>}
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
                    <span style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-body)", letterSpacing: "-0.01em", color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.label}</span>
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
