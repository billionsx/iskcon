/**
 * FavoritesScreen — единый экран «Избранное» (iOS-26 · Liquid Glass).
 *
 * Тянет ВСЕ избранные клиента из localStorage (`fav:*` через useFavorites):
 * книги · главы · стихи · киртаны (альбомы и дорожки) · бхаджаны · герои ·
 * центры · рестораны · документы. Авторизации нет — это персональная база
 * устройства; снимок заголовка/подзаголовка/ссылки пишется в момент добавления.
 *
 * — Липкий стеклянный фильтр по категориям с живыми счётчиками (пустые скрыты).
 * — Сортировка: недавние ⇄ А–Я.
 * — Сгруппированный inset-список (по категориям в режиме «Все», плоский — в категории).
 * — Свайп-влево раскрывает красное «Убрать» (удаление с коллапсом строки).
 * — Тап по строке → навигация по in-app пути (onNavigate → applyPath приложения).
 *
 * Только инлайн-SVG и токены приложения (без сторонних зависимостей).
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useFavorites, removeFavorite, type FavItem } from "./cardActions";
import { useNotes, requestNote, requestOpenNote, type Note } from "./notes";
import { BOOKS, bookFullTitle, bookSlug } from "./books";
// ЗКН-Н083: закладка стиха/главы показывает КАНОНИЧЕСКУЮ ссылку (писание · песнь/
// лила · глава · стих), а не голое «Текст 17». Строится единым модулем bookRef.
import { scriptureRef, type ScriptureRef } from "./bookRef";

/* ── палитра (зеркало книжного эталона) ── */
const INK = "#1f2024";
const INK2 = "#70727b";
const INK3 = "#a7a8b0";
const LINE = "rgba(0,0,0,0.08)";
const GOLD = "var(--color-gold)";
const GOLDT = "#9c7c15";
const RED = "#FF3B30";

/* ── категории ── */
type CatKey = "book" | "chapter" | "verse" | "kirtan" | "bhajan" | "entity" | "centre" | "restaurant" | "doc" | "feed" | "other";
const CAT_ORDER: CatKey[] = ["book", "chapter", "verse", "kirtan", "bhajan", "entity", "centre", "restaurant", "doc", "feed", "other"];
const CAT_META: Record<CatKey, { label: string; accent: string }> = {
  book: { label: "Книги", accent: "var(--color-gold)" },
  chapter: { label: "Главы", accent: "#0CA678" },
  verse: { label: "Стихи", accent: "#E8920C" },
  kirtan: { label: "Киртаны", accent: "#E64980" },
  bhajan: { label: "Бхаджаны", accent: "#7048E8" },
  entity: { label: "Герои", accent: "#4C6EF5" },
  centre: { label: "Центры", accent: "#1098AD" },
  restaurant: { label: "Рестораны", accent: "#2F9E44" },
  doc: { label: "Документы", accent: "#7C6F64" },
  feed: { label: "Лента", accent: "#E8590C" },
  other: { label: "Прочее", accent: "#8E8E93" },
};
function catOf(type: string): CatKey {
  if (type === "book") return "book";
  if (type === "chapter") return "chapter";
  if (type === "verse") return "verse";
  if (type === "bhajan") return "bhajan";
  if (type === "entity") return "entity";
  if (type === "centre" || type === "center") return "centre";
  if (type === "restaurant") return "restaurant";
  if (type === "doc") return "doc";
  if (type === "post") return "feed";
  if (type.indexOf("kirtan") === 0) return "kirtan";
  return "other";
}

/* ── иконки категорий (STROKE-стиль приложения) ── */
const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function CatIcon({ cat, size = 22 }: { cat: CatKey; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true } as const;
  switch (cat) {
    case "book":
      return <svg {...p}><path {...STROKE} d="M12 6.6C10.4 5.4 8.3 4.9 5.5 5.3A1 1 0 0 0 4.6 6.3v10.9a1 1 0 0 0 1.1 1c2.5-.34 4.6.1 6.3 1.3 1.7-1.2 3.8-1.64 6.3-1.3a1 1 0 0 0 1.1-1V6.3a1 1 0 0 0-.9-1C15.7 4.9 13.6 5.4 12 6.6Z" /><path {...STROKE} d="M12 6.6v12.2" /></svg>;
    case "chapter":
      return <svg {...p}><path {...STROKE} d="M7 4h10a1 1 0 0 1 1 1v15l-6-3.4L6 20V5a1 1 0 0 1 1-1Z" /></svg>;
    case "verse":
      return <svg {...p}><path {...STROKE} d="M9.5 7.5C7.6 8 6.3 9.5 6.3 11.6c0 1.7 1.1 2.9 2.6 2.9 1.3 0 2.3-.9 2.3-2.2 0-1.2-.8-2-1.9-2-.2 0-.5 0-.6.1.1-1 .9-1.8 2-2.1ZM16.4 7.5c-1.9.5-3.2 2-3.2 4.1 0 1.7 1.1 2.9 2.6 2.9 1.3 0 2.3-.9 2.3-2.2 0-1.2-.8-2-1.9-2-.2 0-.5 0-.6.1.1-1 .9-1.8 2-2.1Z" /></svg>;
    case "kirtan":
      return <svg {...p}><circle {...STROKE} cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2.1" fill="currentColor" /></svg>;
    case "bhajan":
      return <svg {...p}><path {...STROKE} d="M9 17V6l9-2v11" /><circle {...STROKE} cx="6.5" cy="17.5" r="2.5" /><circle {...STROKE} cx="15.5" cy="15.5" r="2.5" /></svg>;
    case "entity":
      return <svg {...p}><circle {...STROKE} cx="12" cy="8.5" r="3.6" /><path {...STROKE} d="M5.5 20c.7-3.8 3.3-5.6 6.5-5.6S17.8 16.2 18.5 20" /></svg>;
    case "centre":
      return <svg {...p}><path {...STROKE} d="M12 3.5 19 8v1.5H5V8l7-4.5Z" /><path {...STROKE} d="M6.5 9.5v8M11 9.5v8M13 9.5v8M17.5 9.5v8M4.5 20.5h15" /></svg>;
    case "restaurant":
      return <svg {...p}><path {...STROKE} d="M7 3v8M9.5 3v8M7 11v9.5M8.25 3v5" /><path {...STROKE} d="M16.5 3c-1.4 0-2.5 2-2.5 5 0 2.3 1 3.4 2.5 3.6V20.5" /></svg>;
    case "doc":
      return <svg {...p}><path {...STROKE} d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path {...STROKE} d="M13.5 3v4.5H18M9 13h6M9 16.5h6" /></svg>;
    case "feed":
      return <svg {...p}><path {...STROKE} d="M12 3 21 8 12 13 3 8z" /><path {...STROKE} d="m3 12 9 5 9-5" /><path {...STROKE} d="m3 16 9 5 9-5" /></svg>;
    default:
      return <svg {...p}><path {...STROKE} d="M12 4.2 14.4 9l5.3.8-3.8 3.7.9 5.3-4.8-2.5-4.8 2.5.9-5.3L4.3 9.8 9.6 9 12 4.2Z" /></svg>;
  }
}

/* ── мелкие иконки управления ── */
function Back({ size = 22 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><path {...STROKE} d="M15 5l-7 7 7 7" /></svg>; }
function SortIcon({ size = 17 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><path {...STROKE} d="M7 5v14M7 19l-3-3M7 5l3 3M17 19V5M17 5l3 3M17 19l-3-3" /></svg>; }
function Chevron({ size = 17 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden style={{ color: INK3, flexShrink: 0 }}><path {...STROKE} d="M9 5l7 7-7 7" /></svg>; }
function NoteMark({ size = 17 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><g {...STROKE}><path d="M6 3.6h7.4L18.4 8.6V20a.9.9 0 0 1-.9.9H6a.9.9 0 0 1-.9-.9V4.5A.9.9 0 0 1 6 3.6Z" /><path d="M13.2 3.7v4.6a.6.6 0 0 0 .6.6h4.4" /><path d="M8 12.6h6.6M8 15.6h4.4" /></g></svg>; }
function HeartOutline({ size = 30 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><path {...STROKE} d="M12 21c-1.6-1.5-7.5-7-7.5-12 0-3 2.2-5 4.8-5 1.7 0 3 1 2.7 1 .9-1 2-1 2.7-1 2.6 0 4.8 2 4.8 5 0 5-5.9 10.5-7.5 12Z" /></svg>; }

/* ── навигация и заголовки для legacy-записей без снимка ── */
function hrefFor(it: FavItem): string | null {
  if (it.href) return it.href;
  const { type, id } = it;
  if (type === "book") return `/${bookSlug(id)}`;
  if (type === "entity") return `/${id}`;
  if (type === "doc") return `/doc/${id}`;
  if (type === "centre" || type === "restaurant") return `/place/${id}`;
  // ЗКН-Н078: полное покрытие типов — каждый вид избранного резолвится во ВНУТРЕННИЙ
  // адрес к самому объекту даже без сохранённого h (страховка для legacy-записей).
  if (type === "center") return `/iskcon/centers/${id}`;
  if (type === "dhama") return `/dhama/${id}`;
  if (type === "darshan") return id ? `/darshan?d=${encodeURIComponent(id)}` : "/darshan";
  if (type === "content") return id.charAt(0) === "/" ? id : `/${id}`;
  if (type === "bhajan") return id.charAt(0) === "/" ? id : `/bhajans/${id}`;
  /* ЗКН-Н060 · ПУТЬ РОЖДАЕТСЯ В ОДНОМ МЕСТЕ.
   *
   * Здесь стояла своя строковая хирургия: `/books/{шифр}/{глава}/{стих}`.
   * Это ВТОРОЙ построитель пути — и он разошёлся с настоящим маршрутом книги
   * (`/{слаг}/{лила}/{глава}/{стих}`, ЗКН-Н023). Папки `/books/<шифр>/` в
   * приложении нет: старое избранное вело в никуда, а новое спасал только
   * сохранённый `href`. Второй построитель обязан был разойтись — и разошёлся.
   *
   * Теперь путь строит тот же bookSlug + иерархия книги, что и читалка.
   */
  if (type === "chapter" || type === "verse") {
    const [w, ...rest] = id.split("/");
    const bk = BOOKS[w];
    if (!bk || !rest.length) return null;
    let segs = rest.join("/").split(/[./]/).filter(Boolean);
    if (segs[0] === w) segs = segs.slice(1);          // «cc.madhya.19.117» → без шифра
    return segs.length ? `/${bookSlug(w)}/${segs.join("/")}` : `/${bookSlug(w)}`;
  }
  // ЗКН-Н077: киртан-избранное ведёт к самому треку (?t=<хвост audio из ключа>),
  // а не к библиотеке. id = хвост ключа kirtan:<хвост> → работает и для старых
  // записей без сохранённого h.
  if (type.indexOf("kirtan") === 0) return id ? `/kirtans?t=${encodeURIComponent(id)}` : "/kirtans";
  return null;
}

/** ЗКН-Н083 · каноническая ссылка стиха/главы (писание · песнь/лила · глава · стих).
 *  Иерархию берём из сохранённого slug-пути `h` (иначе достроенного hrefFor).
 *  null — для не-писаний и неизвестных книг (тогда работает прежняя логика). */
function srefFor(it: FavItem): ScriptureRef | null {
  if (it.type !== "verse" && it.type !== "chapter") return null;
  const work = it.id.split("/")[0];
  return scriptureRef(it.type, work, it.href ?? hrefFor(it));
}

function titleFor(it: FavItem): string {
  // ЗКН-Н083: у писания жирная строка — ИМЯ книги; локация уходит в подпись.
  const sref = srefFor(it);
  if (sref) return sref.scripture;
  if (it.title) return it.title;
  const { type, id } = it;
  // ЗКН-Б001: название книги — только через bookFullTitle() (иначе видна половина)
  if (type === "book") { const b = BOOKS[id]; return b ? bookFullTitle(b) : id.toUpperCase(); }
  if (type === "chapter" || type === "verse") {
    const w = id.split("/")[0];
    const ref = id.split("/").slice(1).join("/");
    const bkData = BOOKS[w]; const bk = bkData ? bookFullTitle(bkData) : undefined;   // ЗКН-Б001
    return bk ? `${bk}${ref ? " · " + ref : ""}` : id;
  }
  return id || CAT_META[catOf(type)].label;
}

/** Текст для поиска по избранному: имя + полный путь ссылки (чтобы находить по
 *  «Песнь 1», «Глава 17», «Текст 17»), иначе — сохранённый подзаголовок. */
function searchTextFor(it: FavItem): string {
  const sref = srefFor(it);
  const tail = sref ? [...sref.lead, sref.anchor].join(" ") : it.subtitle ?? "";
  return `${titleFor(it)} ${tail}`;
}

/* ── ведущая плитка строки ── */
function Tile({ it, sref }: { it: FavItem; sref: ScriptureRef | null }) {
  const cat = catOf(it.type);
  const accent = CAT_META[cat].accent;
  if (cat === "book") {
    const initial = (titleFor(it).trim()[0] || "К").toUpperCase();
    return (
      <span style={{ flexShrink: 0, width: 46, height: 46, borderRadius: 11, display: "grid", placeItems: "center",
        background: "linear-gradient(135deg, #fbf4d8 0%, #f1e1a4 100%)", border: `0.5px solid ${GOLD}55`, boxShadow: "inset 0 1px 2px rgba(255,255,255,.5)" }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-title2)", fontWeight: 700, color: GOLDT, lineHeight: 1, letterSpacing: "-0.02em" }}>{initial}</span>
      </span>
    );
  }
  // ЗКН-Н083: у стиха/главы писания плитка — монограмма книги (ШБ · БГ · ЧЧ) в
  // цвете категории. Это опознаёт писание мгновенно — сильнее безликого значка.
  // Без аббревиатуры (редкая книга) остаётся штатный значок категории.
  if (sref && sref.abbr) {
    return (
      <span style={{ flexShrink: 0, width: 46, height: 46, borderRadius: 12, display: "grid", placeItems: "center", color: accent, background: `${accent}1f` }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1,
          fontSize: sref.abbr.length > 2 ? "var(--text-subhead)" : "var(--text-callout)", fontVariantNumeric: "tabular-nums" }}>{sref.abbr}</span>
      </span>
    );
  }
  return (
    <span style={{ flexShrink: 0, width: 46, height: 46, borderRadius: 12, display: "grid", placeItems: "center", color: accent, background: `${accent}1f` }}>
      <CatIcon cat={cat} size={23} />
    </span>
  );
}

/* ── строка со свайпом «Убрать» ── */
function Row({ it, first, last, onTap, reduce, notes }: { it: FavItem; first: boolean; last: boolean; onTap: () => void; reduce: boolean; notes: Note[] }) {
  const [dx, setDx] = useState(0);
  const [removing, setRemoving] = useState(false);
  const drag = useRef(false);
  const moved = useRef(false);
  const start = useRef(0);
  const REVEAL = 86;
  const THRESH = 132;

  const commit = () => { if (reduce) { removeFavorite(it.key); return; } setRemoving(true); window.setTimeout(() => removeFavorite(it.key), 240); };
  const onNote = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (dx !== 0) { setDx(0); return; }
    if (notes.length > 0) requestOpenNote(notes[0].id);
    else requestNote({ kind: it.type, ref: it.key, title: titleFor(it), subtitle: it.subtitle, href: hrefFor(it) ?? undefined });
  };
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
  const tap = () => { if (moved.current || dx !== 0) { setDx(0); return; } onTap(); };

  const title = titleFor(it);
  const sref = srefFor(it);

  return (
    <div style={{ position: "relative", maxHeight: removing ? 0 : 240, opacity: removing ? 0 : 1, overflow: "hidden",
      transition: reduce ? "none" : "max-height .24s ease, opacity .2s ease" }}>
      {/* подложка действия */}
      <button type="button" aria-label="Убрать из избранного" onClick={commit}
        style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 7, paddingRight: 22,
          background: RED, color: "#fff", border: "none", cursor: "pointer", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: 600 }}>
        <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden><path {...STROKE} stroke="#fff" d="M5 7h14M9.5 7V5.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7M7 7l.8 12a1 1 0 0 0 1 .9h6.4a1 1 0 0 0 1-.9L18 7" /></svg>
        Убрать
      </button>
      {/* строка */}
      <div role="button" tabIndex={0} onClick={tap}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onTap(); } }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        style={{ position: "relative", display: "flex", alignItems: "center", gap: 13, padding: "11px 14px", minHeight: 46,
          background: "var(--color-bg-2)", cursor: "pointer", transform: `translateX(${dx}px)`,
          transition: drag.current ? "none" : "transform .26s cubic-bezier(.22,.61,.36,1)", touchAction: "pan-y", WebkitTapHighlightColor: "transparent" }}>
        <Tile it={it} sref={sref} />
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: "block", fontFamily: "var(--font-display)", fontSize: "var(--text-body)", fontWeight: 600,
            letterSpacing: "-0.014em", color: INK, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
          {sref ? (
            // ЗКН-Н083: путь «Песнь 1 · Глава 17» приглушён, сам стих «Текст 17» —
            // темнее и весом 600 (это и есть сохранённая закладка).
            <span style={{ fontFamily: "var(--font-text)", display: "block", marginTop: 2, fontSize: "var(--text-footnote)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {sref.lead.length > 0 && <span style={{ color: INK3 }}>{sref.lead.join(" · ")}{" · "}</span>}
              <span style={{ color: INK2, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{sref.anchor}</span>
              {it.type === "chapter" && it.title && it.title.trim() && it.title.trim() !== sref.anchor && (
                <span style={{ color: INK3 }}>{" · " + it.title.trim()}</span>
              )}
            </span>
          ) : it.subtitle ? (
            <span style={{ fontFamily: "var(--font-text)", display: "block", marginTop: 2, fontSize: "var(--text-footnote)", color: INK3, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.subtitle}</span>
          ) : null}
        </span>
        <button type="button" onClick={onNote}
          aria-label={notes.length > 0 ? `Заметки (${notes.length})` : "Добавить заметку"}
          style={{ flexShrink: 0, position: "relative", display: "grid", placeItems: "center", height: 30, width: 30, borderRadius: "50%", cursor: "pointer",
            border: notes.length ? "none" : `0.5px solid ${LINE}`, background: notes.length ? `${GOLD}1f` : "transparent",
            color: notes.length ? GOLDT : INK3, WebkitTapHighlightColor: "transparent" }}>
          <NoteMark size={16} />
          {notes.length > 1 && (
            <span style={{ position: "absolute", top: -3, right: -3, minWidth: 15, height: 15, padding: "0 3px", borderRadius: 999, background: GOLD, color: "#fff",
              fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 700, lineHeight: "15px", textAlign: "center", border: "1.5px solid var(--color-bg-2)", fontVariantNumeric: "tabular-nums" }}>{notes.length}</span>
          )}
        </button>
        <Chevron />
        {!last && <span aria-hidden style={{ position: "absolute", left: 73, right: 0, bottom: 0, height: 0.5, background: LINE }} />}
      </div>
    </div>
  );
}

/* ── фильтр-пилюля ── */
function Pill({ label, count, active, accent, onClick }: { label: string; count: number; active: boolean; accent?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 7, height: 34, padding: "0 13px", borderRadius: 999, cursor: "pointer",
        border: active ? "none" : `0.5px solid ${LINE}`,
        background: active ? (accent ?? INK) : "rgba(120,120,128,0.10)",
        color: active ? "#fff" : INK, fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: 600, letterSpacing: "-0.01em",
        WebkitTapHighlightColor: "transparent", transition: "background .18s, color .18s" }}>
      {label}
      <span style={{ display: "inline-grid", placeItems: "center", minWidth: 19, height: 19, padding: "0 5px", borderRadius: 999, fontSize: "var(--text-caption)", fontWeight: 700,
        background: active ? "rgba(255,255,255,0.26)" : "rgba(120,120,128,0.16)", color: active ? "#fff" : INK2, fontVariantNumeric: "tabular-nums" }}>{count}</span>
    </button>
  );
}

/* ── секция категории (inset-карточка) ── */
function Section({ title, accent, items, onNavigate, reduce, notesByRef }: { title?: string; accent?: string; items: FavItem[]; onNavigate: (h: string) => void; reduce: boolean; notesByRef: Map<string, Note[]> }) {
  return (
    <div style={{ margin: "0 0 22px" }}>
      {title && (
        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "0 4px 8px" }}>
          <span style={{ width: 7, height: 7, borderRadius: 2, background: accent }} aria-hidden />
          <span style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption)", fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: INK2 }}>{title}</span>
          <span style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption)", fontWeight: 600, color: INK3 }}>{items.length}</span>
        </div>
      )}
      <div style={{ borderRadius: 16, overflow: "hidden", border: `0.5px solid ${LINE}`, background: "var(--color-bg-2)", boxShadow: "0 1px 3px rgba(0,0,0,0.03)" }}>
        {items.map((it, i) => (
          <Row key={it.key} it={it} first={i === 0} last={i === items.length - 1} reduce={reduce} notes={notesByRef.get(it.key) ?? EMPTY_NOTES}
            onTap={() => { const h = hrefFor(it); if (h) onNavigate(h); }} />
        ))}
      </div>
    </div>
  );
}
const EMPTY_NOTES: Note[] = [];

/* ═════════ экран ═════════ */
export default function FavoritesScreen({ onBack, onNavigate }: { onBack: () => void; onNavigate: (href: string) => void }) {
  const favs = useFavorites();
  const notes = useNotes();
  const notesByRef = useMemo(() => {
    const m = new Map<string, Note[]>();
    for (const n of notes) {
      if (!n.ref) continue;
      const a = m.get(n.ref);
      if (a) a.push(n); else m.set(n.ref, [n]);
    }
    return m;
  }, [notes]);
  const [sel, setSel] = useState<CatKey | "all">("all");
  const [sort, setSort] = useState<"recent" | "az">("recent");
  const [q, setQ] = useState("");
  const reduce = useMemo(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches, []);

  // отсортированный + отфильтрованный поиском список
  const sorted = useMemo(() => {
    const term = q.trim().toLowerCase();
    const base = term
      ? favs.filter((f) => searchTextFor(f).toLowerCase().includes(term))
      : favs.slice();
    base.sort((a, b) => sort === "az"
      ? titleFor(a).localeCompare(titleFor(b), "ru")
      : (b.addedAt - a.addedAt) || titleFor(a).localeCompare(titleFor(b), "ru"));
    return base;
  }, [favs, sort, q]);

  // счётчики по категориям (по полному набору, без поискового фильтра)
  const counts = useMemo(() => {
    const c: Partial<Record<CatKey, number>> = {};
    for (const f of favs) { const k = catOf(f.type); c[k] = (c[k] ?? 0) + 1; }
    return c;
  }, [favs]);

  // если выбранная категория опустела — вернуться к «Все»
  useEffect(() => { if (sel !== "all" && (counts[sel] ?? 0) === 0) setSel("all"); }, [counts, sel]);

  const visibleCats = CAT_ORDER.filter((k) => (counts[k] ?? 0) > 0);
  const shown = sel === "all" ? sorted : sorted.filter((f) => catOf(f.type) === sel);

  const navStyle: CSSProperties = { position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "center", gap: 4, height: 52, padding: "0 6px",
    background: "color-mix(in srgb, var(--color-bg) 82%, transparent)", backdropFilter: "saturate(180%) blur(20px)", WebkitBackdropFilter: "saturate(180%) blur(20px)",
    borderBottom: `0.5px solid ${LINE}` };

  return (
    <div style={{ position: "fixed", inset: 0, margin: "0 auto", width: "100%", maxWidth: 480, zIndex: 70, display: "flex", flexDirection: "column", background: "var(--color-bg)" }}>
      {/* навбар */}
      <header style={navStyle}>
        <button type="button" aria-label="Назад" onClick={onBack}
          style={{ display: "grid", height: 38, width: 38, placeItems: "center", borderRadius: "50%", border: "none", background: "none", color: INK, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
          <Back />
        </button>
        <div style={{ flex: 1, textAlign: "center", fontFamily: "var(--font-display)", fontSize: "var(--text-body)", fontWeight: 700, letterSpacing: "-0.02em", color: INK }}>Избранное</div>
        <button type="button" aria-label={sort === "recent" ? "Сортировка: недавние" : "Сортировка: А–Я"} onClick={() => setSort((s) => (s === "recent" ? "az" : "recent"))}
          style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 32, padding: "0 11px 0 9px", borderRadius: 999, border: `0.5px solid ${LINE}`,
            background: "rgba(120,120,128,0.10)", color: INK, cursor: "pointer", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 600, WebkitTapHighlightColor: "transparent" }}>
          <SortIcon /> {sort === "recent" ? "Недавние" : "А–Я"}
        </button>
      </header>

      {favs.length === 0 ? (
        <Empty icon={<HeartOutline size={34} />} title="Здесь пока пусто" sub="Отмечайте сердечком книги, стихи, киртаны, центры и документы — они соберутся здесь." />
      ) : (
        <div style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
          {/* поиск */}
          <div style={{ padding: "12px 16px 8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, height: 38, padding: "0 12px", borderRadius: 11, background: "rgba(120,120,128,0.12)" }}>
              <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden style={{ color: INK3, flexShrink: 0 }}><circle {...STROKE} cx="11" cy="11" r="7" /><path {...STROKE} d="m20 20-3.2-3.2" /></svg>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск в избранном" inputMode="search"
                style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", color: INK }} />
              {q && <button type="button" aria-label="Очистить" onClick={() => setQ("")} style={{ border: "none", background: "none", color: INK3, cursor: "pointer", padding: 2, display: "grid", placeItems: "center" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="9" fill="rgba(120,120,128,0.45)" /><path d="M9 9l6 6M15 9l-6 6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" /></svg>
              </button>}
            </div>
          </div>

          {/* липкий фильтр-категории */}
          <div style={{ position: "sticky", top: 0, zIndex: 10, padding: "6px 0 10px",
            background: "color-mix(in srgb, var(--color-bg) 86%, transparent)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}>
            <div style={{ display: "flex", gap: 8, padding: "0 16px", overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
              <Pill label="Все" count={favs.length} active={sel === "all"} onClick={() => setSel("all")} />
              {visibleCats.map((k) => (
                <Pill key={k} label={CAT_META[k].label} count={counts[k] ?? 0} accent={CAT_META[k].accent} active={sel === k} onClick={() => setSel(k)} />
              ))}
            </div>
          </div>

          {/* список */}
          <div style={{ padding: "4px 16px calc(40px + env(safe-area-inset-bottom,0px))" }}>
            {shown.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 20px", color: INK3, fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)" }}>Ничего не найдено</div>
            ) : sel === "all" ? (
              visibleCats.map((k) => {
                const items = shown.filter((f) => catOf(f.type) === k);
                if (!items.length) return null;
                return <Section key={k} title={CAT_META[k].label} accent={CAT_META[k].accent} items={items} onNavigate={onNavigate} reduce={!!reduce} notesByRef={notesByRef} />;
              })
            ) : (
              <Section items={shown} onNavigate={onNavigate} reduce={!!reduce} notesByRef={notesByRef} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── пустое состояние ── */
function Empty({ icon, title, sub }: { icon: ReactNode; title: string; sub: string }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 40px 64px" }}>
      <span style={{ display: "grid", placeItems: "center", width: 72, height: 72, borderRadius: "50%", background: "rgba(120,120,128,0.12)", color: INK3 }}>{icon}</span>
      <h2 style={{ margin: "20px 0 0", fontFamily: "var(--font-display)", fontSize: "var(--text-title3)", fontWeight: 700, letterSpacing: "-0.02em", color: INK }}>{title}</h2>
      <p style={{ margin: "8px 0 0", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", lineHeight: 1.5, color: INK2, maxWidth: 300 }}>{sub}</p>
    </div>
  );
}
