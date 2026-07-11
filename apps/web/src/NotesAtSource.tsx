/**
 * NotesAtSource — «заметки у источника». На любой странице, где можно сохранить
 * заметку (стих, глава, книга, центр, дхама, тиртха…), показывает уже сохранённые
 * к этому же объекту. Тап → подробная карточка заметки (ПКП) через мост заметок.
 * Если заметок нет — не рендерит ничего. Замыкает петлю «сохранил → вспомнил».
 */
import { useNotesForRef, requestOpenNote, noteTitle, notePreview, type Note } from "./notes";

function fmtDate(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

const PencilGlyph = ({ color }: { color: string }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

export function NotesAtSource({ kind, refId, accent = "var(--color-gold)" }: { kind: string; refId: string; accent?: string }) {
  const notes = useNotesForRef(kind, refId);
  if (notes.length === 0) return null;

  return (
    <section aria-label="Ваши заметки" style={{ borderRadius: 16, overflow: "hidden", border: `0.5px solid color-mix(in srgb, ${accent} 26%, var(--color-hairline))`, background: `color-mix(in srgb, ${accent} 6%, var(--color-bg-2))` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 14px 7px" }}>
        <span style={{ display: "grid", placeItems: "center", width: 22, height: 22, borderRadius: 7, flexShrink: 0, color: accent, background: `color-mix(in srgb, ${accent} 16%, transparent)` }}><PencilGlyph color={accent} /></span>
        <span style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 700, letterSpacing: "-0.01em", color: "var(--color-label)" }}>
          {notes.length === 1 ? "Ваша заметка" : `Ваши заметки · ${notes.length}`}
        </span>
      </div>
      <div>
        {notes.map((n: Note, i) => {
          const preview = notePreview(n);
          return (
            <button key={n.id} type="button" onClick={() => requestOpenNote(n.id)}
              onPointerDown={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--color-label) 5%, transparent)")}
              onPointerUp={(e) => (e.currentTarget.style.background = "transparent")}
              onPointerLeave={(e) => (e.currentTarget.style.background = "transparent")}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "10px 14px",
                background: "transparent", border: "none", borderTop: `0.5px solid color-mix(in srgb, ${accent} 16%, var(--color-hairline))`,
                cursor: "pointer", WebkitTapHighlightColor: "transparent", fontFamily: "var(--font-text)" }}>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: "block", fontSize: "var(--text-subhead)", fontWeight: 600, letterSpacing: "-0.01em", color: "var(--color-label)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{noteTitle(n)}</span>
                {preview && <span style={{ display: "block", marginTop: 1, fontSize: "var(--text-footnote)", color: "var(--color-label-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview}</span>}
              </span>
              <span style={{ flexShrink: 0, fontSize: "var(--text-caption)", color: "var(--color-label-3)", fontVariantNumeric: "tabular-nums" }}>{fmtDate(n.updatedAt)}</span>
              <span aria-hidden style={{ flexShrink: 0, color: "var(--color-label-3)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
