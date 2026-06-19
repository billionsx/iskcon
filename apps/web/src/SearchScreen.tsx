/**
 * SearchScreen — глобальный сквозной поиск по всему приложению.
 * Личности (граф), книги (клиентский каталог LIBRARY с фаззи/алиасами), стихи
 * (FTS5 + recall-fallback), главы/части, молитвы и киртаны, страницы и разделы,
 * центры. Серверный поиск — /api/search?q=; книги ищутся на клиенте мгновенно.
 * Совпадения подсвечиваются, у каждой группы — счётчик.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import { BOOKS, LIBRARY, type CatalogBook } from "./books";
import { searchBooks } from "./bookSearch";

type Person = { id: string; type: string | null; name_ru: string | null; name_iast: string | null };
type Verse = { ref: string; work: string; snippet: string; href: string };
type Chapter = { title: string | null; work: string; level: string | null; href: string };
type Page = { name: string | null; subtitle: string | null; type?: string | null; href: string };
type Center = { name: string; city: string | null; href: string };
type Results = {
  personalities: Person[]; verses: Verse[]; chapters: Chapter[];
  prayers: Page[]; pages: Page[]; centers: Center[];
};
const EMPTY: Results = { personalities: [], verses: [], chapters: [], prayers: [], pages: [], centers: [] };

const LEVEL_LABEL: Record<string, string> = { chapter: "глава", canto: "песнь", lila: "лила", part: "часть", section: "раздел" };
function workLabel(work: string): string {
  const b = LIBRARY.find((x) => x.id === work);
  return b ? b.title : work.toUpperCase();
}
function mono(s: string): string {
  const t = (s || "").trim();
  return (t[0] || "?").toUpperCase();
}

const RE_ESC = /[.*+?^${}()|[\]\\]/g;
function tokensOf(q: string): string[] {
  return (q.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter((t) => t.length >= 2);
}
// Подсветка совпавших токенов в тексте (регистронезависимо), без падений.
function hl(text: string | null | undefined, toks: string[]): React.ReactNode {
  if (!text) return text ?? "";
  if (!toks.length) return text;
  let re: RegExp;
  try { re = new RegExp("(" + toks.map((t) => t.replace(RE_ESC, "\\$&")).join("|") + ")", "gi"); }
  catch { return text; }
  const out: React.ReactNode[] = [];
  let last = 0, i = 0;
  let mm: RegExpExecArray | null;
  while ((mm = re.exec(text)) !== null) {
    if (mm.index > last) out.push(text.slice(last, mm.index));
    out.push(<mark key={i++} style={{ background: "var(--color-bg-3)", color: "inherit", borderRadius: 3, padding: "0 1.5px" }}>{mm[0]}</mark>);
    last = mm.index + mm[0].length;
    if (mm.index === re.lastIndex) re.lastIndex++;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function BackIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Monogram({ ch, size = 40 }: { ch: string; size?: number }) {
  return (
    <span style={{ flexShrink: 0, width: size, height: size, borderRadius: "50%", display: "grid", placeItems: "center",
      background: "var(--color-bg-3)", color: "var(--color-label-2)", fontFamily: "var(--font-display)", fontSize: size * 0.42, fontWeight: 700 }}>
      {ch}
    </span>
  );
}

function Row({ ch, title, sub, iast, toks, onTap }: { ch: string; title: string; sub?: string | null; iast?: string | null; toks: string[]; onTap: () => void }) {
  return (
    <div role="button" tabIndex={0} onClick={onTap}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onTap(); } }}
      style={{ display: "flex", alignItems: "center", gap: 13, padding: "11px 4px", borderBottom: "0.5px solid var(--color-hairline)", cursor: "pointer", textAlign: "left" }}>
      <Monogram ch={ch} />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: 16, fontWeight: 600, color: "var(--color-label)", lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{hl(title, toks)}</span>
        {iast && <span style={{ display: "block", fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 13, color: "var(--color-label-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{iast}</span>}
        {sub && <span style={{ fontFamily: "var(--font-text)", fontSize: 13, color: "var(--color-label-3)", lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as React.CSSProperties}>{hl(sub, toks)}</span>}
      </span>
      <span style={{ flexShrink: 0, color: "var(--color-label-3)", fontSize: 20 }}>›</span>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 18 }}>
      <h3 style={{ margin: "0 0 6px", fontFamily: "var(--font-text)", fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", color: "var(--color-label-3)" }}>
        {title}{count != null && <span style={{ fontWeight: 500, opacity: 0.7 }}> · {count}</span>}
      </h3>
      {children}
    </section>
  );
}

export default function SearchScreen({ onBack, onOpenEntity, onOpenBook, onNavigate }: {
  onBack: () => void;
  onOpenEntity: (id: string, type: string | null) => void;
  onOpenBook: (work: string) => void;
  onNavigate: (href: string) => void;
}) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const query = q.trim();
  const searching = query.length >= 2;
  const toks = useMemo(() => tokensOf(query), [query]);

  // Книги — клиентский поиск (фаззи, опечатки, IAST, алиасы) по каталогу LIBRARY.
  const bookHits = useMemo(() => (searching ? searchBooks(query, LIBRARY).slice(0, 8).map((h) => h.book) : []), [query, searching]);

  // Серверный сквозной поиск (личности, стихи, главы, молитвы, страницы, центры).
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (query.length < 2) { setRes(null); setLoading(false); return; }
    setLoading(true);
    const id = ++seq.current;
    timer.current = setTimeout(() => {
      fetch(api(`/search?q=${encodeURIComponent(query)}`), { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => { if (id === seq.current) { setRes({ ...EMPTY, ...d }); setLoading(false); } })
        .catch(() => { if (id === seq.current) { setRes(EMPTY); setLoading(false); } });
    }, 200);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query]);

  const r = res ?? EMPTY;
  const openBook = (b: CatalogBook) => {
    if (b.readable && (BOOKS as Record<string, unknown>)[b.id]) onOpenBook(b.id);
    else onOpenEntity(b.id, "scripture");
  };
  const total = (res ? r.personalities.length + r.verses.length + r.chapters.length + r.prayers.length + r.pages.length + r.centers.length : 0) + bookHits.length;
  const nothing = searching && !loading && res !== null && total === 0;

  return (
    <div style={{ minHeight: "100%", background: "var(--color-bg)", color: "var(--color-label)" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center", gap: 8, height: 56, padding: "0 10px",
        background: "color-mix(in srgb, var(--color-bg) 90%, transparent)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        borderBottom: "0.5px solid var(--color-hairline)" }}>
        <button type="button" aria-label="Назад" onClick={onBack}
          style={{ flexShrink: 0, display: "grid", height: 38, width: 38, placeItems: "center", borderRadius: "50%", border: "none", background: "none", color: "var(--color-label)", cursor: "pointer" }}>
          <BackIcon size={22} />
        </button>
        <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по всему приложению…" inputMode="search"
          style={{ flex: 1, minWidth: 0, boxSizing: "border-box", padding: "11px 14px", borderRadius: 12, border: "0.5px solid var(--color-hairline)",
            background: "var(--color-bg-2)", fontFamily: "var(--font-text)", fontSize: 16, color: "var(--color-label)", outline: "none" }} />
      </div>

      <div style={{ padding: "10px 16px calc(40px + env(safe-area-inset-bottom,0px))" }}>
        {!searching && (
          <p style={{ marginTop: 28, textAlign: "center", color: "var(--color-label-3)", fontFamily: "var(--font-text)", fontSize: 15, lineHeight: 1.5 }}>
            Личности, книги, стихи, главы,<br />молитвы, киртаны, центры…<br />начните вводить имя, название или строку.
          </p>
        )}

        {nothing && (
          <p style={{ marginTop: 28, textAlign: "center", color: "var(--color-label-3)", fontFamily: "var(--font-text)", fontSize: 15 }}>Ничего не найдено</p>
        )}

        {searching && r.personalities.length > 0 && (
          <Section title="Личности" count={r.personalities.length}>
            {r.personalities.map((p) => (
              <Row key={"p" + p.id} ch={mono(p.name_ru || p.id)} title={p.name_ru || p.id} iast={p.name_iast} toks={toks} onTap={() => onOpenEntity(p.id, p.type)} />
            ))}
          </Section>
        )}

        {searching && bookHits.length > 0 && (
          <Section title="Книги" count={bookHits.length}>
            {bookHits.map((b) => (
              <Row key={"b" + b.id} ch={mono(b.title)} title={b.title} iast={b.iast || null} sub={b.readable ? null : "скоро"} toks={toks} onTap={() => openBook(b)} />
            ))}
          </Section>
        )}

        {searching && r.verses.length > 0 && (
          <Section title="Стихи" count={r.verses.length}>
            {r.verses.map((v, i) => (
              <Row key={"v" + i + v.href} ch={mono(v.ref)} title={v.ref} sub={v.snippet} toks={toks} onTap={() => onNavigate(v.href)} />
            ))}
          </Section>
        )}

        {searching && r.chapters.length > 0 && (
          <Section title="Главы и части" count={r.chapters.length}>
            {r.chapters.map((c, i) => (
              <Row key={"c" + i + c.href} ch={mono(c.title || "?")} title={c.title || "—"} sub={`${workLabel(c.work)}${c.level ? " · " + (LEVEL_LABEL[c.level] || c.level) : ""}`} toks={toks} onTap={() => onNavigate(c.href)} />
            ))}
          </Section>
        )}

        {searching && r.prayers.length > 0 && (
          <Section title="Молитвы и киртаны" count={r.prayers.length}>
            {r.prayers.map((p, i) => (
              <Row key={"pr" + i + p.href} ch={mono(p.name || "?")} title={p.name || "—"} sub={p.subtitle} toks={toks} onTap={() => onNavigate(p.href)} />
            ))}
          </Section>
        )}

        {searching && r.centers.length > 0 && (
          <Section title="Центры" count={r.centers.length}>
            {r.centers.map((c, i) => (
              <Row key={"ce" + i + c.href} ch={mono(c.name)} title={c.name} sub={c.city} toks={toks} onTap={() => onNavigate(c.href)} />
            ))}
          </Section>
        )}

        {searching && r.pages.length > 0 && (
          <Section title="Страницы и разделы" count={r.pages.length}>
            {r.pages.map((p, i) => (
              <Row key={"pg" + i + p.href} ch={mono(p.name || "?")} title={p.name || "—"} sub={p.subtitle} toks={toks} onTap={() => onNavigate(p.href)} />
            ))}
          </Section>
        )}

        {searching && loading && total === 0 && (
          <p style={{ marginTop: 24, textAlign: "center", color: "var(--color-label-3)", fontFamily: "var(--font-text)", fontSize: 15 }}>Поиск…</p>
        )}
      </div>
    </div>
  );
}
