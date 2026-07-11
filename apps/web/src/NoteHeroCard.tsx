/**
 * NoteHeroCard — единый карточный модуль заметки (юнит-стандарт, как BookHeroCard).
 * Один и тот же компонент используется и витриной (ВКП) в рейлах/галерее, и
 * шапкой подробной карточки (ПКП) на странице заметки. Различаются только
 * `topLeft` (источник-eyebrow на витрине / кнопка «назад» на ПКП) и `onOpen`
 * (на витрине тап открывает ПКП). Действия на карточке: закрепить · поделиться · ⋯.
 * У заметки нет обложки — фон графитовый с подсветкой по цвету источника.
 */
import { useRef, useState, type ReactNode } from "react";
import { ActionBtn } from "./BookHeroCard";
import { BookMenuSheet } from "./BookMenuSheet";
import { MoreIcon } from "./ui/icons";
import { noteTitle, notePreview, togglePin, shareNote, type Note } from "./notes";

const GRAPHITE = "radial-gradient(120% 80% at 50% 0%, #3a3a40 0%, #2a2a2f 45%, #1b1b1f 100%)";

/** Цвет/подпись/глиф источника заметки — общий язык с иконками в хабе. */
export function noteSource(kind?: string): { accent: string; label: string } {
  if (!kind) return { accent: "var(--color-gold)", label: "Заметка" };
  if (kind === "verse") return { accent: "#E8920C", label: "Стих" };
  if (kind === "chapter") return { accent: "#E8920C", label: "Глава" };
  if (kind === "book") return { accent: "var(--color-gold)", label: "Книга" };
  if (kind.indexOf("kirtan") === 0) return { accent: "#E64980", label: "Киртан" };
  if (kind === "bhajan") return { accent: "#7048E8", label: "Бхаджан" };
  if (kind === "entity") return { accent: "#4C6EF5", label: "Личность" };
  if (kind === "place" || kind === "centre" || kind === "restaurant") return { accent: "#1098AD", label: "Место" };
  if (kind === "doc") return { accent: "#0CA678", label: "Статья" };
  return { accent: "var(--color-gold)", label: "Заметка" };
}

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const PinIcon = ({ size = 18, filled = false }: { size?: number; filled?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path {...STROKE} fill={filled ? "currentColor" : "none"} d="M9 3.6h6l-.7 5.1 2.6 2.7v1.7H7.1v-1.7l2.6-2.7L9 3.6Z" /><path {...STROKE} d="M12 13.8V20.4" />
  </svg>
);
const ShareIcon = ({ size = 18 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><g {...STROKE}><path d="M12 3.5v11" /><path d="M8.3 7.2 12 3.5l3.7 3.7" /><path d="M7 10.5H6.2A1.8 1.8 0 0 0 4.4 12.3v6.4A1.8 1.8 0 0 0 6.2 20.5h11.6a1.8 1.8 0 0 0 1.8-1.8v-6.4a1.8 1.8 0 0 0-1.8-1.8H17" /></g></svg>;

function fmtDate(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString("ru-RU", sameYear ? { day: "numeric", month: "long" } : { day: "numeric", month: "short", year: "numeric" });
}

export function NoteHeroCard({ note, topLeft, onOpen, presentational, onMenuSelect, flash }: {
  note: Note;
  topLeft?: ReactNode;
  onOpen?: () => void;
  presentational?: boolean;
  onMenuSelect: (id: string) => void;
  flash?: (m: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const moreRef = useRef<HTMLSpanElement>(null);
  const src = noteSource(note.kind);
  const title = noteTitle(note);
  const preview = notePreview(note);

  return (
    <>
      <article
        style={{
          position: "relative", width: "100%", aspectRatio: "4 / 5", overflow: "hidden", borderRadius: 20,
          border: "0.5px solid var(--color-hairline, rgba(0,0,0,.08))", background: GRAPHITE,
          boxShadow: "var(--shadow-card, 0 8px 30px rgba(0,0,0,.12))",
          display: "flex", flexDirection: "column", justifyContent: "flex-end",
        }}>
        {/* подсветка по цвету источника */}
        <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", background: `radial-gradient(130% 90% at 50% -8%, ${src.accent}40 0%, ${src.accent}14 34%, transparent 60%)` }} />
        <div aria-hidden style={{ position: "absolute", insetInline: 0, bottom: 0, height: "70%", pointerEvents: "none", background: "linear-gradient(to top, rgba(0,0,0,.78) 0%, rgba(0,0,0,.34) 46%, rgba(0,0,0,0) 100%)" }} />

        {onOpen && !presentational && <button type="button" aria-label="Открыть заметку" onClick={() => onOpen()} style={{ position: "absolute", inset: 0, zIndex: 10, background: "none", border: "none", cursor: "pointer" }} />}

        {/* TOP: topLeft slot · действия */}
        <div style={{ position: "absolute", insetInline: 20, top: 20, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ display: "flex", alignItems: "center", color: "#fff", minWidth: 0 }}>{topLeft}</span>
          {!presentational && (
            <div data-pdf-no-print style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ActionBtn active={note.pinned} activeColor="#FFD60A" ariaLabel={note.pinned ? "Открепить" : "Закрепить"} onClick={() => { togglePin(note.id); flash?.(note.pinned ? "Откреплено" : "Закреплено"); }}><PinIcon size={18} filled={note.pinned} /></ActionBtn>
              <ActionBtn ariaLabel="Поделиться" onClick={() => shareNote(note)}><ShareIcon size={18} /></ActionBtn>
              <span ref={moreRef} style={{ display: "inline-flex" }}><ActionBtn ariaLabel="Ещё" onClick={() => setMenuOpen(true)}><MoreIcon size={16} /></ActionBtn></span>
            </div>
          )}
        </div>

        {/* INFO — низ */}
        <div onClick={presentational ? undefined : () => onOpen?.()} style={{ position: "relative", zIndex: 20, padding: 20, cursor: onOpen && !presentational ? "pointer" : "default", fontFamily: "var(--font-text)", pointerEvents: "none" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
            <span style={{ width: 7, height: 7, borderRadius: 2, background: src.accent }} />
            <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: src.accent }}>{src.label}</span>
            {note.pinned && <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,.55)" }}>· закреплено</span>}
          </div>
          <h3 style={{ margin: 0, fontSize: "var(--text-title1)", lineHeight: 1.12, fontWeight: 800, letterSpacing: "-0.025em", color: "#fff", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{title}</h3>
          {preview && <p style={{ margin: "10px 0 0", fontSize: "var(--text-subhead)", lineHeight: 1.4, fontWeight: 400, letterSpacing: "-0.01em", color: "rgba(255,255,255,.82)", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{preview}</p>}
          <div style={{ marginTop: 18, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
            {note.srcTitle && (
              <span style={{ display: "inline-flex", alignItems: "center", maxWidth: "100%", borderRadius: 999, background: "rgba(255,255,255,.16)", height: 26, padding: "0 12px", fontSize: "var(--text-footnote)", lineHeight: 1, fontWeight: 500, letterSpacing: "-0.01em", color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {note.srcTitle}{note.srcSubtitle ? ` · ${note.srcSubtitle}` : ""}
              </span>
            )}
            <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, background: "rgba(255,255,255,.10)", height: 26, padding: "0 12px", fontSize: "var(--text-footnote)", lineHeight: 1, fontWeight: 500, color: "rgba(255,255,255,.7)", fontVariantNumeric: "tabular-nums" }}>{fmtDate(note.updatedAt)}</span>
          </div>
        </div>
      </article>
      {!presentational && (
        <BookMenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} onSelect={(id) => onMenuSelect(id)} anchorRef={moreRef} variant="note" notePinned={note.pinned} noteHasSource={!!note.srcHref} />
      )}
    </>
  );
}
