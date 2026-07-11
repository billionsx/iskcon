/**
 * NoteEditor — редактор заметки садху по стандарту Apple Notes.
 *
 * Единый документ (как в Apple): первая строка — автоматически заголовок;
 * стили блоков «Заголовок / Подзаголовок / Текст», жирный/курсив/подчёркнутый/
 * зачёркнутый, списки (маркированный · нумерованный) и фирменный чек-лист.
 * Чек-бокс — CSS-псевдоэлемент в левом жёлобе строки `.todo` (клик по жёлобу
 * переключает data-done): без contenteditable-островков, поэтому каретка и
 * backspace ведут себя нативно.
 *
 * Автосохранение — debounce + сохранение на blur/закрытии/visibilitychange.
 * Привязка к источнику (стих/киртан/личность…) — чип под шапкой: тап ведёт к
 * объекту. Пустая заметка при закрытии удаляется (как в Apple).
 *
 * Только инлайн-SVG и палитра книжного эталона (приложение — светлая тема).
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { deleteNote, getNote, htmlToPlain, sanitizeHtml, updateNote, type Note } from "./notes";

const INK = "#1f2024";
const INK2 = "#70727b";
const INK3 = "#a7a8b0";
const LINE = "rgba(0,0,0,0.08)";
const GOLD = "var(--color-gold)";
const RED = "#FF3B30";
const PAPER = "#ffffff";

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

/* ── иконки ── */
const Back = ({ size = 24 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><path {...STROKE} d="M15 5l-7 7 7 7" /></svg>;
const PinIcon = ({ size = 21, filled = false }: { size?: number; filled?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path {...STROKE} fill={filled ? "currentColor" : "none"} d="M9 3.6h6l-.7 5.1 2.6 2.7v1.7H7.1v-1.7l2.6-2.7L9 3.6Z" /><path {...STROKE} d="M12 13.8V20.4" />
  </svg>
);
const ShareIcon = ({ size = 21 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><g {...STROKE}><path d="M12 3.5v11" /><path d="M8.3 7.2 12 3.5l3.7 3.7" /><path d="M7 10.5H6.2A1.8 1.8 0 0 0 4.4 12.3v6.4A1.8 1.8 0 0 0 6.2 20.5h11.6a1.8 1.8 0 0 0 1.8-1.8v-6.4a1.8 1.8 0 0 0-1.8-1.8H17" /></g></svg>;
const TrashIcon = ({ size = 21 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><path {...STROKE} d="M5 7h14M9.5 7V5.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7M7 7l.8 12a1 1 0 0 0 1 .9h6.4a1 1 0 0 0 1-.9L18 7" /></svg>;
const Bold = () => <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden><path d="M7 5h6.2a3.4 3.4 0 0 1 0 6.8H7Zm0 6.8h7a3.6 3.6 0 0 1 0 7.2H7Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>;
const Italic = () => <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden><g stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 5h7M7 19h7M14.5 5l-5 14" /></g></svg>;
const Underline = () => <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden><g stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"><path d="M7 4.5v6a5 5 0 0 0 10 0v-6" /><path d="M5.5 20h13" /></g></svg>;
const Strike = () => <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden><g stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"><path d="M5 12h14" /><path d="M8 7.5C8 6 9.6 5 12 5s3.8 1 4 2.4M8.4 15c.2 1.6 1.7 2.6 3.9 2.6 2.3 0 3.7-1 3.7-2.6 0-1-.5-1.7-1.4-2.1" /></g></svg>;
const ChecklistIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden><g {...STROKE} strokeWidth="1.8"><rect x="3.5" y="4.5" width="6" height="6" rx="1.6" /><path d="m4.8 7.4 1.3 1.3 2-2.4" /><rect x="3.5" y="13.5" width="6" height="6" rx="1.6" /><path d="M12.5 7h8M12.5 16h8" /></g></svg>;
const BulletIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden><g {...STROKE} strokeWidth="1.8"><path d="M9 6.5h11M9 12h11M9 17.5h11" /><circle cx="4.6" cy="6.5" r="1.3" fill="currentColor" stroke="none" /><circle cx="4.6" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="4.6" cy="17.5" r="1.3" fill="currentColor" stroke="none" /></g></svg>;
const NumberIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden><g {...STROKE} strokeWidth="1.8"><path d="M10 6.5h10M10 12h10M10 17.5h10" /></g><g fill="currentColor" style={{ font: "700 7px var(--font-text)" }}><text x="3" y="9">1</text><text x="3" y="14.6">2</text><text x="3" y="20">3</text></g></svg>;
const AaIcon = () => <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden><g fill="currentColor" style={{ font: "700 11px var(--font-display)" }}><text x="1.5" y="16">A</text></g><g fill="currentColor" style={{ font: "700 8px var(--font-display)" }}><text x="11.5" y="16">a</text></g></svg>;

const EDITOR_CSS = `
.note-doc { outline: none; -webkit-user-select: text; user-select: text; }
.note-doc:empty::before { content: attr(data-ph); color: ${INK3}; pointer-events: none; }
.note-doc h1 { font-family: var(--font-display); font-size: 26px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.25; margin: 0 0 6px; color: ${INK}; }
.note-doc h2 { font-family: var(--font-display); font-size: 20px; font-weight: 700; letter-spacing: -0.015em; line-height: 1.3; margin: 14px 0 4px; color: ${INK}; }
.note-doc p, .note-doc div { font-family: var(--font-text); font-size: 17px; line-height: 1.55; margin: 0; color: ${INK}; }
.note-doc ul, .note-doc ol { margin: 6px 0; padding-left: 26px; }
.note-doc li { font-family: var(--font-text); font-size: 17px; line-height: 1.55; margin: 2px 0; color: ${INK}; }
.note-doc ul { list-style: disc; } .note-doc ol { list-style: decimal; }
.note-doc i, .note-doc em { font-style: italic; }
.note-doc b, .note-doc strong { font-weight: 700; }
.note-doc .todo { position: relative; padding-left: 30px; min-height: 25px; font-family: var(--font-text); font-size: 17px; line-height: 1.55; margin: 3px 0; color: ${INK}; }
.note-doc .todo::before {
  content: ""; position: absolute; left: 0; top: 3px; width: 20px; height: 20px; border-radius: 50%;
  border: 1.8px solid ${INK3}; box-sizing: border-box; transition: background .15s, border-color .15s;
}
.note-doc .todo[data-done="true"]::before { background: ${GOLD}; border-color: ${GOLD}; }
.note-doc .todo[data-done="true"]::after {
  content: ""; position: absolute; left: 5.6px; top: 9px; width: 5px; height: 8.5px;
  border: solid #fff; border-width: 0 2px 2px 0; transform: rotate(43deg);
}
.note-doc .todo[data-done="true"] { color: ${INK3}; text-decoration: line-through; }
.nte-tool { -webkit-tap-highlight-color: transparent; }
.nte-tool:active { background: rgba(120,120,128,0.2) !important; }
`;

type Block = "p" | "h1" | "h2";

export default function NoteEditor({ id, onClose, onNavigate }: { id: string; onClose: () => void; onNavigate?: (href: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [note] = useState<Note | null>(() => getNote(id));
  const [pinned, setPinned] = useState(!!note?.pinned);
  const [stamp, setStamp] = useState<number>(note?.updatedAt ?? Date.now());
  const [styleOpen, setStyleOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedHtml = useRef<string>(note?.body ?? "");

  // первичная вставка тела (императивно — иначе React сбивает каретку)
  useLayoutEffect(() => {
    if (ref.current && note) {
      ref.current.innerHTML = note.body || "";
      // ставим каретку в конец и фокус (для новой заметки — сразу набор)
      try {
        ref.current.focus();
        const sel = window.getSelection();
        const r = document.createRange();
        r.selectNodeContents(ref.current);
        r.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(r);
      } catch {
        /* noop */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function readAndSave(): void {
    if (!ref.current || !note) return;
    const html = sanitizeHtml(ref.current.innerHTML);
    if (html === savedHtml.current) return;
    savedHtml.current = html;
    const plain = htmlToPlain(html);
    const title = (plain.split("\n").map((s) => s.trim()).find(Boolean) || "").slice(0, 200);
    const saved = updateNote(note.id, { body: html, plain, title, pinned });
    if (saved) setStamp(saved.updatedAt);
  }

  function scheduleSave(): void {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(readAndSave, 400);
  }

  // финальное сохранение + удаление пустой заметки при закрытии
  useEffect(() => {
    const flush = () => readAndSave();
    const onVis = () => { if (document.visibilityState === "hidden") readAndSave(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", flush);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      readAndSave();
      // пустую заметку удаляем (как Apple)
      const cur = note ? getNote(note.id) : null;
      if (cur && !cur.title.trim() && !cur.plain.trim() && !htmlToPlain(cur.body).trim()) deleteNote(cur.id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!note) {
    return (
      <div style={overlay}>
        <header style={navStyle}>
          <IconBtn label="Назад" onClick={onClose}><Back /></IconBtn>
          <div style={{ flex: 1 }} />
        </header>
        <div style={{ padding: 40, textAlign: "center", color: INK3, fontFamily: "var(--font-text)" }}>Заметка не найдена</div>
      </div>
    );
  }

  /* ── команды форматирования ── */
  function exec(cmd: string, val?: string): void {
    ref.current?.focus();
    try {
      document.execCommand(cmd, false, val);
    } catch {
      /* noop */
    }
    scheduleSave();
  }
  function setBlock(b: Block): void {
    exec("formatBlock", b === "p" ? "P" : b.toUpperCase());
    setStyleOpen(false);
  }
  // чек-лист: переключаем текущий блок в `.todo` и обратно
  function toggleChecklist(): void {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    let node: Node | null = sel.getRangeAt(0).startContainer;
    // поднимаемся к прямому ребёнку редактора
    while (node && node.parentNode !== el && node !== el) node = node.parentNode;
    let block = node as HTMLElement | null;
    if (block === el) {
      // нет блочной обёртки — оборачиваем содержимое в div
      document.execCommand("formatBlock", false, "P");
      let n: Node | null = sel.getRangeAt(0).startContainer;
      while (n && n.parentNode !== el) n = n.parentNode;
      block = n as HTMLElement | null;
    }
    if (!block || block === el) return;
    if (block.classList.contains("todo")) {
      block.classList.remove("todo");
      block.removeAttribute("data-done");
    } else {
      // если это li — превращаем li в div.todo вне списка слишком инвазивно; работаем по блокам p/div/h*
      if (block.tagName === "LI") return;
      block.classList.add("todo");
      block.setAttribute("data-done", "false");
    }
    scheduleSave();
  }

  // клик по левому жёлобу `.todo` — переключение готовности
  function onDocClick(e: React.MouseEvent): void {
    const target = e.target as HTMLElement;
    const todo = target.closest?.(".todo") as HTMLElement | null;
    if (!todo || !ref.current?.contains(todo)) return;
    const rect = todo.getBoundingClientRect();
    if (e.clientX - rect.left <= 30) {
      e.preventDefault();
      todo.setAttribute("data-done", todo.getAttribute("data-done") === "true" ? "false" : "true");
      scheduleSave();
    }
  }

  // вставка как простой текст (чистые заметки)
  function onPaste(e: React.ClipboardEvent): void {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    scheduleSave();
  }

  function doPin(): void {
    const v = !pinned;
    setPinned(v);
    updateNote(note.id, { pinned: v });
  }
  function doShare(): void {
    const plain = htmlToPlain(sanitizeHtml(ref.current?.innerHTML ?? note.body));
    const text = note.srcTitle ? `${plain}\n\n— из «${note.srcTitle}» · ISKCON ONE LOVE` : plain;
    if (typeof navigator !== "undefined" && navigator.share) navigator.share({ text }).catch(() => {});
    else navigator.clipboard?.writeText(text).catch(() => {});
  }
  function doDelete(): void {
    deleteNote(note.id);
    savedHtml.current = note.body; // не воскрешать при unmount-flush
    if (ref.current) ref.current.innerHTML = "";
    onClose();
  }

  return (
    <div style={overlay}>
      <style>{EDITOR_CSS}</style>

      {/* навбар */}
      <header style={navStyle}>
        <IconBtn label="Готово" onClick={onClose}><Back /></IconBtn>
        <div style={{ flex: 1 }} />
        <IconBtn label={pinned ? "Открепить" : "Закрепить"} onClick={doPin} active={pinned} activeColor={GOLD}><PinIcon filled={pinned} /></IconBtn>
        <IconBtn label="Поделиться" onClick={doShare}><ShareIcon /></IconBtn>
        <IconBtn label="Удалить" onClick={() => setConfirmDel(true)} activeColor={RED} active><TrashIcon /></IconBtn>
      </header>

      {/* привязка к источнику */}
      {note.srcTitle && (
        <button type="button" onClick={() => note.srcHref && onNavigate?.(note.srcHref)}
          style={{ display: "flex", alignItems: "center", gap: 9, margin: "8px 16px 0", padding: "9px 12px", borderRadius: 12, border: "none",
            background: "rgba(120,120,128,0.1)", cursor: note.srcHref ? "pointer" : "default", textAlign: "left", width: "calc(100% - 32px)", WebkitTapHighlightColor: "transparent" }}>
        <span style={{ display: "grid", placeItems: "center", width: 30, height: 30, borderRadius: 8, background: `${GOLD}22`, color: "#9c7c15", flexShrink: 0 }}>
          <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden><path {...STROKE} d="M6 4h9l3 3v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" /><path {...STROKE} d="M14 4v4h4" /></svg>
        </span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: INK3 }}>Из приложения</span>
          <span style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 14.5, fontWeight: 600, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{note.srcTitle}{note.srcSubtitle ? ` · ${note.srcSubtitle}` : ""}</span>
        </span>
        {note.srcHref && <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden style={{ color: INK3, flexShrink: 0 }}><path {...STROKE} d="M9 5l7 7-7 7" /></svg>}
        </button>
      )}

      {/* дата */}
      <div style={{ textAlign: "center", padding: "12px 16px 4px", fontFamily: "var(--font-text)", fontSize: 12.5, color: INK3 }}>{fmtStamp(stamp)}</div>

      {/* документ */}
      <div style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch", padding: "4px 18px calc(80px + env(safe-area-inset-bottom,0px))" }}
        onClick={() => ref.current?.focus()}>
        <div
          ref={ref}
          className="note-doc"
          contentEditable
          suppressContentEditableWarning
          data-ph="Запишите даршан, мысль из лекции, стих, что коснулся сердца…"
          onInput={scheduleSave}
          onBlur={readAndSave}
          onPaste={onPaste}
          onClick={onDocClick}
          spellCheck
          style={{ minHeight: 220 }}
        />
      </div>

      {/* панель форматирования */}
      <div style={toolbarWrap}>
        {styleOpen && (
          <div style={stylePop}>
            <StyleRow label="Заголовок" big onClick={() => setBlock("h1")} />
            <StyleRow label="Подзаголовок" mid onClick={() => setBlock("h2")} />
            <StyleRow label="Основной текст" onClick={() => setBlock("p")} />
          </div>
        )}
        <div style={toolbar}>
          <ToolBtn label="Стиль текста" onClick={() => setStyleOpen((v) => !v)} on={styleOpen}><AaIcon /></ToolBtn>
          <Sep />
          <ToolBtn label="Жирный" onClick={() => exec("bold")}><Bold /></ToolBtn>
          <ToolBtn label="Курсив" onClick={() => exec("italic")}><Italic /></ToolBtn>
          <ToolBtn label="Подчёркнутый" onClick={() => exec("underline")}><Underline /></ToolBtn>
          <ToolBtn label="Зачёркнутый" onClick={() => exec("strikeThrough")}><Strike /></ToolBtn>
          <Sep />
          <ToolBtn label="Список-галочки" onClick={toggleChecklist}><ChecklistIcon /></ToolBtn>
          <ToolBtn label="Маркированный список" onClick={() => exec("insertUnorderedList")}><BulletIcon /></ToolBtn>
          <ToolBtn label="Нумерованный список" onClick={() => exec("insertOrderedList")}><NumberIcon /></ToolBtn>
        </div>
      </div>

      {confirmDel && (
        <ConfirmDelete onCancel={() => setConfirmDel(false)} onConfirm={doDelete} />
      )}
    </div>
  );
}

/* ── строка выбора стиля ── */
function StyleRow({ label, big, mid, onClick }: { label: string; big?: boolean; mid?: boolean; onClick: () => void }) {
  return (
    <button type="button" className="nte-tool" onClick={onClick}
      style={{ display: "block", width: "100%", textAlign: "left", padding: "11px 16px", border: "none", background: "none", cursor: "pointer",
        fontFamily: big || mid ? "var(--font-display)" : "var(--font-text)", fontSize: big ? 20 : mid ? 17 : 15.5, fontWeight: big || mid ? 700 : 500,
        letterSpacing: big ? "-0.02em" : "-0.01em", color: INK, WebkitTapHighlightColor: "transparent" }}>
      {label}
    </button>
  );
}

/* ── кнопки ── */
function IconBtn({ label, onClick, children, active, activeColor }: { label: string; onClick: () => void; children: React.ReactNode; active?: boolean; activeColor?: string }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="nte-tool"
      style={{ display: "grid", height: 40, width: 40, placeItems: "center", borderRadius: "50%", border: "none", background: "none",
        color: active && activeColor ? activeColor : INK, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
      {children}
    </button>
  );
}
function ToolBtn({ label, onClick, children, on }: { label: string; onClick: () => void; children: React.ReactNode; on?: boolean }) {
  return (
    <button type="button" aria-label={label} aria-pressed={on} onMouseDown={(e) => e.preventDefault()} onClick={onClick} className="nte-tool"
      style={{ display: "grid", height: 38, width: 38, placeItems: "center", borderRadius: 9, border: "none",
        background: on ? "rgba(120,120,128,0.22)" : "transparent", color: INK, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
      {children}
    </button>
  );
}
const Sep = () => <span aria-hidden style={{ width: 0.5, height: 22, background: LINE, margin: "0 3px", flexShrink: 0 }} />;

/* ── подтверждение удаления ── */
function ConfirmDelete({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div onClick={onCancel} style={{ position: "fixed", inset: 0, zIndex: 120, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.32)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 440, margin: 8, marginBottom: "calc(8px + env(safe-area-inset-bottom,0px))" }}>
        <div style={{ borderRadius: 16, overflow: "hidden", background: "rgba(252,252,254,0.97)", backdropFilter: "blur(30px)", WebkitBackdropFilter: "blur(30px)" }}>
          <div style={{ padding: "16px 18px 14px", textAlign: "center", fontFamily: "var(--font-text)", fontSize: 13, color: INK2, borderBottom: `0.5px solid ${LINE}` }}>Удалить заметку? Действие необратимо.</div>
          <button type="button" onClick={onConfirm} className="nte-tool" style={{ display: "block", width: "100%", padding: "15px", border: "none", background: "none", color: RED, fontFamily: "var(--font-text)", fontSize: 17, fontWeight: 600, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>Удалить</button>
        </div>
        <button type="button" onClick={onCancel} className="nte-tool" style={{ marginTop: 8, display: "block", width: "100%", padding: "15px", borderRadius: 16, border: "none", background: "rgba(252,252,254,0.97)", color: "#0A84FF", fontFamily: "var(--font-text)", fontSize: 17, fontWeight: 700, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>Отмена</button>
      </div>
    </div>
  );
}

/* ── даты ── */
function fmtStamp(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `Сегодня, ${time}`;
  const months = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  const y = d.getFullYear() === now.getFullYear() ? "" : ` ${d.getFullYear()}`;
  return `${d.getDate()} ${months[d.getMonth()]}${y}, ${time}`;
}

/* ── стили контейнеров ── */
const overlay: CSSProperties = { position: "fixed", inset: 0, margin: "0 auto", width: "100%", maxWidth: 480, zIndex: 90, display: "flex", flexDirection: "column", background: PAPER };
const navStyle: CSSProperties = { position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "center", gap: 2, height: 52, padding: "0 6px",
  background: "color-mix(in srgb, #ffffff 82%, transparent)", backdropFilter: "saturate(180%) blur(20px)", WebkitBackdropFilter: "saturate(180%) blur(20px)", borderBottom: `0.5px solid ${LINE}` };
const toolbarWrap: CSSProperties = { position: "absolute", left: 0, right: 0, bottom: 0, padding: "0 10px calc(8px + env(safe-area-inset-bottom,0px))", pointerEvents: "none" };
const toolbar: CSSProperties = { pointerEvents: "auto", display: "flex", alignItems: "center", gap: 2, padding: "6px 8px", borderRadius: 16,
  background: "rgba(247,247,250,0.92)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)",
  border: `0.5px solid ${LINE}`, boxShadow: "0 6px 24px rgba(0,0,0,0.12)", overflowX: "auto", scrollbarWidth: "none" };
const stylePop: CSSProperties = { pointerEvents: "auto", marginBottom: 8, borderRadius: 16, overflow: "hidden", background: "rgba(252,252,254,0.97)",
  backdropFilter: "blur(30px) saturate(180%)", WebkitBackdropFilter: "blur(30px) saturate(180%)", border: `0.5px solid ${LINE}`, boxShadow: "0 8px 28px rgba(0,0,0,0.14)" };
