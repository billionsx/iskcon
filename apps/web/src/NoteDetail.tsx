/**
 * NoteDetail — подробная карточка заметки (ПКП), по тому же принципу, что и
 * BookDetailPage у книги: сверху единый карточный модуль-шапка (NoteHeroCard) с
 * кнопкой «назад» и полным набором действий, ниже — тело заметки и крупная
 * кнопка «Редактировать». Всплывающее ⋯-меню (вариант "note" у BookMenuSheet):
 * редактировать · поделиться · PDF · QR · в источник · закрепить · удалить.
 * Редактор и QR — подложки поверх ПКП. Пустая (только что созданная) заметка
 * сразу открывает редактор.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NoteHeroCard } from "./NoteHeroCard";
import NoteEditor from "./NoteEditor";
import { QrSheet } from "./QrSheet";
import { exportToPdf } from "./pdf";
import { useNotes, getNote, togglePin, deleteNote, shareNote, noteTitle, notePreview, type Note } from "./notes";

const INK = "#1f2024";
const INK2 = "#70727b";
const INK3 = "#a7a8b0";
const LINE = "rgba(0,0,0,0.08)";
const GOLD = "#D2AA1B";
const RED = "#FF3B30";
const PAPER = "#ffffff";

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const Back = ({ size = 24 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><path {...STROKE} d="M15 5l-7 7 7 7" /></svg>;
const PencilIcon = ({ size = 19 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><g {...STROKE}><path d="M4.5 19.5 4 20l.5-3.4L15.2 5.9a1.8 1.8 0 0 1 2.5 0l.4.4a1.8 1.8 0 0 1 0 2.5L7.4 19.5Z" /><path d="M14.2 6.9 17.1 9.8" /></g></svg>;

const DOC_CSS = `
.note-view { outline: none; }
.note-view h1 { font-family: var(--font-display); font-size: 26px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.25; margin: 0 0 6px; color: ${INK}; }
.note-view h2 { font-family: var(--font-display); font-size: 20px; font-weight: 700; letter-spacing: -0.015em; line-height: 1.3; margin: 14px 0 4px; color: ${INK}; }
.note-view p, .note-view div { font-family: var(--font-text); font-size: 17px; line-height: 1.55; margin: 0; color: ${INK}; }
.note-view ul, .note-view ol { margin: 6px 0; padding-left: 26px; }
.note-view li { font-family: var(--font-text); font-size: 17px; line-height: 1.55; margin: 2px 0; color: ${INK}; }
.note-view ul { list-style: disc; } .note-view ol { list-style: decimal; }
.note-view i, .note-view em { font-style: italic; }
.note-view b, .note-view strong { font-weight: 700; }
.note-view .todo { position: relative; padding-left: 30px; min-height: 25px; font-family: var(--font-text); font-size: 17px; line-height: 1.55; margin: 3px 0; color: ${INK}; }
.note-view .todo::before { content: ""; position: absolute; left: 0; top: 3px; width: 20px; height: 20px; border-radius: 50%; border: 1.8px solid ${INK3}; box-sizing: border-box; }
.note-view .todo[data-done="true"]::before { background: ${GOLD}; border-color: ${GOLD}; }
.note-view .todo[data-done="true"]::after { content: ""; position: absolute; left: 5.6px; top: 9px; width: 5px; height: 8.5px; border: solid #fff; border-width: 0 2px 2px 0; transform: rotate(43deg); }
.note-view .todo[data-done="true"] { color: ${INK3}; text-decoration: line-through; }
.nd-press:active { background: rgba(120,120,128,0.16) !important; }
`;

function fmtFull(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }) + ", " + d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export default function NoteDetail({ id, onBack, onNavigate }: { id: string; onBack: () => void; onNavigate: (href: string) => void }) {
  const notes = useNotes();
  const note: Note | null = notes.find((n) => n.id === id) ?? getNote(id);
  const [editing, setEditing] = useState(false);
  const [qr, setQr] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const autoStarted = useRef(false);

  // Пустая (только что созданная) заметка → сразу редактор.
  useEffect(() => {
    if (autoStarted.current || !note) return;
    autoStarted.current = true;
    if (!note.title && !note.plain) setEditing(true);
  }, [note]);

  // Если заметка исчезла (удалена / пустая удалена редактором) — выходим.
  useEffect(() => {
    if (autoStarted.current && !note && !editing) onBack();
  }, [note, editing, onBack]);

  if (!note) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 70, background: "var(--color-bg)", display: "grid", placeItems: "center" }}>
        <div style={{ textAlign: "center", fontFamily: "var(--font-text)", color: INK3 }}>
          <p style={{ fontSize: 15, color: INK2 }}>Заметка не найдена.</p>
          <button onClick={onBack} style={{ marginTop: 8, height: 42, padding: "0 20px", borderRadius: 12, border: "none", background: INK, color: "#fff", fontFamily: "var(--font-text)", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Назад</button>
        </div>
      </div>
    );
  }

  const onMenu = (mid: string) => {
    if (mid === "edit") { setEditing(true); return; }
    if (mid === "share") { shareNote(note); return; }
    if (mid === "qr") { setQr(true); return; }
    if (mid === "pin") { togglePin(note.id); return; }
    if (mid === "source") { if (note.srcHref) onNavigate(note.srcHref); return; }
    if (mid === "delete") { setConfirmDel(true); return; }
    if (mid === "pdf") {
      exportToPdf(bodyRef.current, { title: `${noteTitle(note)} · Заметка`, heading: noteTitle(note), subheading: note.srcTitle ? `${note.srcTitle}${note.srcSubtitle ? " · " + note.srcSubtitle : ""}` : fmtFull(note.updatedAt) });
      return;
    }
  };

  const noteUrl = (typeof window !== "undefined" ? window.location.origin : "https://gaurangers.com") + "/note/" + note.id;

  return (
    <div style={{ position: "fixed", inset: 0, margin: "0 auto", width: "100%", maxWidth: 480, zIndex: 70, display: "flex", flexDirection: "column", background: "var(--color-bg)", overflow: "hidden" }}>
      <style>{DOC_CSS}</style>
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "12px 16px calc(40px + env(safe-area-inset-bottom))" }}>
        {/* шапка-карточка (ПКП hero) */}
        <NoteHeroCard
          note={note}
          onMenuSelect={onMenu}
          topLeft={
            <button type="button" aria-label="Назад" onClick={onBack}
              style={{ display: "grid", height: 36, width: 36, placeItems: "center", borderRadius: "50%", border: "none", cursor: "pointer", background: "rgba(255,255,255,.14)", color: "#fff", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
              <Back size={22} />
            </button>
          }
        />

        {/* тело заметки */}
        <div ref={bodyRef} data-pdf-root style={{ marginTop: 22 }}>
          {notePreview(note)
            ? <div className="note-view" dangerouslySetInnerHTML={{ __html: note.body || "" }} />
            : <p style={{ fontFamily: "var(--font-text)", fontSize: 16, color: INK3, margin: 0 }}>Пустая заметка — нажмите «Редактировать», чтобы добавить текст.</p>}
        </div>

        {/* метка времени */}
        <div data-pdf-no-print style={{ marginTop: 22, paddingTop: 14, borderTop: `0.5px solid ${LINE}`, fontFamily: "var(--font-text)", fontSize: 12.5, color: INK3 }}>
          Изменено: {fmtFull(note.updatedAt)}
        </div>

        {/* первичное действие */}
        <button data-pdf-no-print type="button" className="nd-press" onClick={() => setEditing(true)}
          style={{ marginTop: 18, width: "100%", height: 50, display: "flex", alignItems: "center", justifyContent: "center", gap: 9, borderRadius: 14, border: "none", background: INK, color: "var(--color-bg-2, #fff)", fontFamily: "var(--font-text)", fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
          <PencilIcon size={19} /> Редактировать
        </button>
      </div>

      {editing && <NoteEditor id={note.id} onClose={() => setEditing(false)} onNavigate={onNavigate} />}
      {qr && <QrSheet url={noteUrl} data={{ kind: "card", title: noteTitle(note), subtitle: note.srcTitle ?? "Заметка · ISKCON ONE LOVE" }} onClose={() => setQr(false)} />}

      {confirmDel && createPortal(
        <div onClick={() => setConfirmDel(false)} style={{ position: "fixed", inset: 0, zIndex: 2100, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.32)" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, margin: "0 10px max(16px, env(safe-area-inset-bottom))", borderRadius: 16, overflow: "hidden", background: "rgba(252,252,254,0.98)", backdropFilter: "blur(30px)", WebkitBackdropFilter: "blur(30px)" }}>
            <div style={{ padding: "18px 18px 14px", textAlign: "center", fontFamily: "var(--font-text)" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: INK }}>Удалить заметку?</div>
              <div style={{ marginTop: 4, fontSize: 13.5, color: INK2, lineHeight: 1.4 }}>Это действие необратимо.</div>
            </div>
            <button type="button" onClick={() => { deleteNote(note.id); setConfirmDel(false); onBack(); }}
              style={{ width: "100%", height: 52, border: "none", borderTop: `0.5px solid ${LINE}`, background: "none", color: RED, fontFamily: "var(--font-text)", fontSize: 17, fontWeight: 600, cursor: "pointer" }}>Удалить</button>
            <button type="button" onClick={() => setConfirmDel(false)}
              style={{ width: "100%", height: 52, border: "none", borderTop: `0.5px solid ${LINE}`, background: "none", color: INK, fontFamily: "var(--font-text)", fontSize: 17, fontWeight: 400, cursor: "pointer" }}>Отмена</button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
