/**
 * NotesScreen — хаб «Заметки садху» (iOS-эстетика, светлая тема).
 *
 * Закреплённые сверху, затем группы по дате (Сегодня · Вчера · 7 дней · по
 * месяцам). Строка: заголовок · превью · время + чип источника, если заметка
 * привязана к стиху/киртану/личности. Свайп-влево — «Удалить». Тап — редактор.
 * Кнопка-перо снизу — новая заметка. Поиск по заголовку и тексту.
 *
 * Экран сам владеет под-оверлеем редактора. App передаёт намерение (создать с
 * привязкой / открыть конкретную) через initial+nonce — раскрываем редактор.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createNote, deleteNote, noteTitle, notePreview, togglePin, useNotes, type Note, type NoteAttach } from "./notes";

const INK = "#1f2024";
const INK2 = "#70727b";
const INK3 = "#a7a8b0";
const LINE = "rgba(0,0,0,0.08)";
const GOLD = "#D2AA1B";
const GOLDT = "#9c7c15";
const RED = "#FF3B30";

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const Back = ({ size = 22 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><path {...STROKE} d="M15 5l-7 7 7 7" /></svg>;
const Compose = ({ size = 22 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><path {...STROKE} d="M5 19h4l9.5-9.5a1.8 1.8 0 0 0 0-2.6l-1.4-1.4a1.8 1.8 0 0 0-2.6 0L5 15v4Z" /><path {...STROKE} d="M13.5 6.5l4 4" /></svg>;
const PinBadge = ({ size = 13 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><path d="M9 3.6h6l-.7 5.1 2.6 2.7v1.7H7.1v-1.7l2.6-2.7L9 3.6Z" fill="currentColor" /><path {...STROKE} stroke="currentColor" d="M12 13.8V20.4" /></svg>;
const NotesGlyph = ({ size = 34 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><path {...STROKE} d="M6 3.5h8.5L19 8v11.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" /><path {...STROKE} d="M14 3.5V8h4M8 12h7M8 15.5h5" /></svg>;

function srcAccent(kind?: string): string {
  if (!kind) return INK3;
  if (kind === "verse" || kind === "chapter") return "#E8920C";
  if (kind === "book") return GOLD;
  if (kind.indexOf("kirtan") === 0) return "#E64980";
  if (kind === "bhajan") return "#7048E8";
  if (kind === "entity") return "#4C6EF5";
  if (kind === "place" || kind === "centre") return "#1098AD";
  return INK3;
}

/* ── строка со свайпом «Удалить» ── */
function Row({ n, last, onOpen, reduce }: { n: Note; last: boolean; onOpen: () => void; reduce: boolean }) {
  const [dx, setDx] = useState(0);
  const [removing, setRemoving] = useState(false);
  const drag = useRef(false);
  const moved = useRef(false);
  const start = useRef(0);
  const REVEAL = 86;
  const THRESH = 132;

  const commit = () => { if (reduce) { deleteNote(n.id); return; } setRemoving(true); window.setTimeout(() => deleteNote(n.id), 240); };
  const onDown = (e: React.PointerEvent) => { drag.current = true; moved.current = false; start.current = e.clientX - dx; try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* noop */ } };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    let nx = e.clientX - start.current;
    if (nx > 0) nx = 0;
    if (nx < -168) nx = -168;
    if (Math.abs(nx - dx) > 2) moved.current = true;
    setDx(nx);
  };
  const onUp = () => {
    if (!drag.current) return;
    drag.current = false;
    if (-dx >= THRESH) commit();
    else setDx(-dx >= REVEAL * 0.55 ? -REVEAL : 0);
  };
  const tap = () => { if (moved.current || dx !== 0) { setDx(0); return; } onOpen(); };

  const title = noteTitle(n);
  const preview = notePreview(n);
  const accent = srcAccent(n.kind);

  return (
    <div style={{ position: "relative", maxHeight: removing ? 0 : 260, opacity: removing ? 0 : 1, overflow: "hidden", transition: reduce ? "none" : "max-height .24s ease, opacity .2s ease" }}>
      <button type="button" aria-label="Удалить заметку" onClick={commit}
        style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 7, paddingRight: 22, background: RED, color: "#fff", border: "none", cursor: "pointer", fontFamily: "var(--font-text)", fontSize: 14, fontWeight: 600 }}>
        <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden><path {...STROKE} stroke="#fff" d="M5 7h14M9.5 7V5.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7M7 7l.8 12a1 1 0 0 0 1 .9h6.4a1 1 0 0 0 1-.9L18 7" /></svg>
        Удалить
      </button>
      <div role="button" tabIndex={0} onClick={tap}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", minHeight: 56, background: "var(--color-bg-2)", cursor: "pointer",
          transform: `translateX(${dx}px)`, transition: drag.current ? "none" : "transform .26s cubic-bezier(.22,.61,.36,1)", touchAction: "pan-y", WebkitTapHighlightColor: "transparent" }}>
        <span style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 10, display: "grid", placeItems: "center", marginTop: 1, color: n.kind ? accent : GOLDT, background: n.kind ? `${accent}1c` : "linear-gradient(135deg, #fbf4d8 0%, #f1e1a4 100%)", border: n.kind ? "none" : `0.5px solid ${GOLD}55` }}>
          {n.kind
            ? <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden><path {...STROKE} d="M6 4h9l3 3v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" /><path {...STROKE} d="M14 4v4h4" /></svg>
            : <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden><path {...STROKE} d="M7 4h7l4 4v11.5a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5V4.5A.5.5 0 0 1 7 4Z" /><path {...STROKE} d="M13.5 4v4.5H18M9 12h6M9 15h4" /></svg>}
        </span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {n.pinned && <span style={{ color: GOLD, flexShrink: 0, display: "inline-flex" }}><PinBadge /></span>}
            <span style={{ minWidth: 0, flex: 1, fontFamily: "var(--font-display)", fontSize: 16.5, fontWeight: 600, letterSpacing: "-0.014em", color: INK, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
          </span>
          <span style={{ display: "flex", alignItems: "baseline", gap: 7, marginTop: 2 }}>
            <span style={{ fontFamily: "var(--font-text)", fontSize: 12.5, color: INK3, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{fmtShort(n.updatedAt)}</span>
            <span style={{ minWidth: 0, flex: 1, fontFamily: "var(--font-text)", fontSize: 13, color: INK3, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{preview || (n.srcTitle ? n.srcTitle : "Нет дополнительного текста")}</span>
          </span>
        </span>
        {!last && <span aria-hidden style={{ position: "absolute", left: 64, right: 0, bottom: 0, height: 0.5, background: LINE }} />}
      </div>
    </div>
  );
}

function Section({ title, items, onOpen, reduce }: { title: string; items: Note[]; onOpen: (n: Note) => void; reduce: boolean }) {
  if (!items.length) return null;
  return (
    <div style={{ margin: "0 0 22px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "0 4px 8px" }}>
        <span style={{ fontFamily: "var(--font-text)", fontSize: 12, fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: INK2 }}>{title}</span>
        <span style={{ fontFamily: "var(--font-text)", fontSize: 12, fontWeight: 600, color: INK3 }}>{items.length}</span>
      </div>
      <div style={{ borderRadius: 16, overflow: "hidden", border: `0.5px solid ${LINE}`, background: "var(--color-bg-2)", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
        {items.map((n, i) => <Row key={n.id} n={n} last={i === items.length - 1} onOpen={() => onOpen(n)} reduce={reduce} />)}
      </div>
    </div>
  );
}

interface Initial { attach?: NoteAttach; openId?: string; nonce: number }

export default function NotesScreen({ onBack, onNavigate, initial }: { onBack: () => void; onNavigate: (href: string) => void; initial?: Initial | null }) {
  const notes = useNotes();
  const [q, setQ] = useState("");
  const lastNonce = useRef<number>(-1);
  const reduce = useMemo(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches, []);

  // намерение из App (страховка — обычно App сам уводит на /note/:id)
  useEffect(() => {
    if (!initial || initial.nonce === lastNonce.current) return;
    lastNonce.current = initial.nonce;
    if (initial.openId) onNavigate("/note/" + initial.openId);
    else if (initial.attach) onNavigate("/note/" + createNote(initial.attach).id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return notes;
    return notes.filter((n) => `${noteTitle(n)} ${n.plain} ${n.srcTitle ?? ""}`.toLowerCase().includes(term));
  }, [notes, q]);

  const groups = useMemo(() => groupByDate(filtered), [filtered]);

  function openNew(): void {
    onNavigate("/note/" + createNote().id);
  }

  return (
    <div style={{ position: "fixed", inset: 0, margin: "0 auto", width: "100%", maxWidth: 480, zIndex: 70, display: "flex", flexDirection: "column", background: "var(--color-bg)" }}>
      <header style={navStyle}>
        <button type="button" aria-label="Назад" onClick={onBack}
          style={{ display: "grid", height: 38, width: 38, placeItems: "center", borderRadius: "50%", border: "none", background: "none", color: INK, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
          <Back />
        </button>
        <div style={{ flex: 1, textAlign: "center", fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em", color: INK }}>Заметки</div>
        <div style={{ width: 38 }} />
      </header>

      {notes.length === 0 ? (
        <Empty onNew={openNew} />
      ) : (
        <div style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
          <div style={{ padding: "12px 16px 8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, height: 38, padding: "0 12px", borderRadius: 11, background: "rgba(120,120,128,0.12)" }}>
              <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden style={{ color: INK3, flexShrink: 0 }}><circle {...STROKE} cx="11" cy="11" r="7" /><path {...STROKE} d="m20 20-3.2-3.2" /></svg>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск в заметках" inputMode="search"
                style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontFamily: "var(--font-text)", fontSize: 15, color: INK }} />
              {q && <button type="button" aria-label="Очистить" onClick={() => setQ("")} style={{ border: "none", background: "none", color: INK3, cursor: "pointer", padding: 2, display: "grid", placeItems: "center" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="9" fill="rgba(120,120,128,0.45)" /><path d="M9 9l6 6M15 9l-6 6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" /></svg>
              </button>}
            </div>
          </div>

          <div style={{ padding: "4px 16px calc(96px + env(safe-area-inset-bottom,0px))" }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 20px", color: INK3, fontFamily: "var(--font-text)", fontSize: 15 }}>Ничего не найдено</div>
            ) : (
              groups.map((g) => <Section key={g.title} title={g.title} items={g.items} onOpen={(n) => onNavigate("/note/" + n.id)} reduce={!!reduce} />)
            )}
          </div>
        </div>
      )}

      {/* перо — новая заметка */}
      <button type="button" aria-label="Новая заметка" onClick={openNew}
        style={{ position: "absolute", right: 18, bottom: "calc(24px + env(safe-area-inset-bottom,0px))", display: "grid", placeItems: "center", height: 56, width: 56, borderRadius: "50%",
          border: "none", cursor: "pointer", color: "#fff", background: GOLD, boxShadow: "0 8px 26px rgba(210,170,27,0.5)", WebkitTapHighlightColor: "transparent" }}>
        <Compose size={25} />
      </button>
    </div>
  );
}

function Empty({ onNew }: { onNew: () => void }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 40px 64px" }}>
      <span style={{ display: "grid", placeItems: "center", width: 72, height: 72, borderRadius: "50%", background: "rgba(120,120,128,0.12)", color: INK3 }}><NotesGlyph size={34} /></span>
      <h2 style={{ margin: "20px 0 0", fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", color: INK }}>Заметок пока нет</h2>
      <p style={{ margin: "8px 0 0", fontFamily: "var(--font-text)", fontSize: 14.5, lineHeight: 1.5, color: INK2, maxWidth: 320 }}>Услышали мысль в лекции, увидели даршан, прочли стих, что коснулся сердца — запишите. Из любой карточки, плеера и ридера можно сохранить «В заметки».</p>
      <button type="button" onClick={onNew} style={{ marginTop: 22, height: 48, padding: "0 26px", borderRadius: 14, border: "none", background: GOLD, color: "#fff", fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>Новая заметка</button>
    </div>
  );
}

/* ── даты/группировка ── */
function startOfDay(ts: number): number { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
function fmtShort(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  if (startOfDay(ts) === startOfDay(now.getTime())) return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const days = Math.round((startOfDay(now.getTime()) - startOfDay(ts)) / 86400000);
  if (days === 1) return "Вчера";
  if (days < 7) return ["вс", "пн", "вт", "ср", "чт", "пт", "сб"][d.getDay()];
  const months = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  return `${d.getDate()} ${months[d.getMonth()]}${d.getFullYear() === now.getFullYear() ? "" : " " + d.getFullYear()}`;
}
function groupByDate(items: Note[]): { title: string; items: Note[] }[] {
  const pinned = items.filter((n) => n.pinned);
  const rest = items.filter((n) => !n.pinned);
  const now = Date.now();
  const today = startOfDay(now);
  const buckets = new Map<string, { order: number; items: Note[] }>();
  const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
  for (const n of rest) {
    const days = Math.round((today - startOfDay(n.updatedAt)) / 86400000);
    let key: string, order: number;
    if (days <= 0) { key = "Сегодня"; order = 0; }
    else if (days === 1) { key = "Вчера"; order = 1; }
    else if (days < 7) { key = "Последние 7 дней"; order = 2; }
    else if (days < 30) { key = "Последние 30 дней"; order = 3; }
    else {
      const d = new Date(n.updatedAt);
      key = `${monthNames[d.getMonth()]}${d.getFullYear() === new Date().getFullYear() ? "" : " " + d.getFullYear()}`;
      order = 4 + (new Date().getFullYear() - d.getFullYear()) * 12 + (11 - d.getMonth());
    }
    if (!buckets.has(key)) buckets.set(key, { order, items: [] });
    buckets.get(key)!.items.push(n);
  }
  const out: { title: string; items: Note[] }[] = [];
  if (pinned.length) out.push({ title: "Закреплённые", items: pinned });
  for (const [title, v] of [...buckets.entries()].sort((a, b) => a[1].order - b[1].order)) out.push({ title, items: v.items });
  return out;
}

const navStyle: CSSProperties = { position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "center", gap: 4, height: 52, padding: "0 6px",
  background: "color-mix(in srgb, var(--color-bg) 82%, transparent)", backdropFilter: "saturate(180%) blur(20px)", WebkitBackdropFilter: "saturate(180%) blur(20px)", borderBottom: `0.5px solid ${LINE}` };
