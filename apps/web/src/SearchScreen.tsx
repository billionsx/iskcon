/**
 * SearchScreen — глобальный сквозной поиск по всему приложению.
 * Личности (граф), книги (клиентский каталог LIBRARY с фаззи/алиасами), стихи
 * (FTS5 + recall-fallback, с полным названием книги), главы/части, молитвы и
 * киртаны, страницы и разделы, центры. Серверный поиск — /api/search?q=; книги
 * ищутся на клиенте мгновенно. Совпадения подсвечиваются; при нескольких типах
 * результатов сверху появляются чипы-фильтры по категориям (Apple-стиль).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import { BOOKS, LIBRARY, type CatalogBook } from "./books";
import { searchBooks } from "./bookSearch";

type Person = { id: string; type: string | null; name_ru: string | null; name_iast: string | null };
type Verse = { book: string; ref: string; work?: string; snippet: string; href: string };
type Chapter = { title: string | null; work: string; level: string | null; href: string };
type Page = { name: string | null; subtitle: string | null; type?: string | null; href: string };
type Center = { name: string; city: string | null; href: string };
type ExactVerse = { book: string; ref: string; snippet: string; href: string };
type Results = {
  exact?: ExactVerse | null;
  personalities: Person[]; verses: Verse[]; chapters: Chapter[];
  prayers: Page[]; pages: Page[]; centers: Center[];
};
const EMPTY: Results = { exact: null, personalities: [], verses: [], chapters: [], prayers: [], pages: [], centers: [] };

const LEVEL_LABEL: Record<string, string> = { chapter: "глава", canto: "песнь", lila: "лила", part: "часть", section: "раздел" };
function workLabel(work: string): string {
  const b = LIBRARY.find((x) => x.id === work);
  return b ? b.title : work.toUpperCase();
}
function mono(s: string): string {
  const t = (s || "").trim();
  return (t[0] || "?").toUpperCase();
}

// Недавние запросы — локально в браузере, чтобы пустой экран поиска был полезным.
const RECENT_KEY = "iskcon:recent-search";
function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string").slice(0, 8) : [];
  } catch { return []; }
}
function saveRecent(list: string[]): void {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 8))); } catch { /* приватный режим — игнорируем */ }
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

function Row({ ch, title, meta, sub, iast, toks, onTap }: { ch: string; title: string; meta?: string | null; sub?: string | null; iast?: string | null; toks: string[]; onTap: () => void }) {
  return (
    <div role="button" tabIndex={0} onClick={onTap}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onTap(); } }}
      style={{ display: "flex", alignItems: "center", gap: 13, padding: "11px 4px", borderBottom: "0.5px solid var(--color-hairline)", cursor: "pointer", textAlign: "left" }}>
      <Monogram ch={ch} />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "flex", alignItems: "baseline", gap: 7, minWidth: 0 }}>
          <span style={{ fontFamily: "var(--font-text)", fontSize: 16, fontWeight: 600, color: "var(--color-label)", lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{hl(title, toks)}</span>
          {meta && <span style={{ flexShrink: 0, fontFamily: "var(--font-text)", fontSize: 13.5, fontWeight: 500, color: "var(--color-label-3)", fontVariantNumeric: "tabular-nums" }}>{meta}</span>}
        </span>
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

const GROUP_LABEL = { people: "Личности", books: "Книги", verses: "Стихи", chapters: "Главы", prayers: "Молитвы", centers: "Центры", pages: "Страницы" } as const;
type GroupKey = keyof typeof GROUP_LABEL;
const GROUP_ORDER: GroupKey[] = ["people", "books", "verses", "chapters", "prayers", "centers", "pages"];

function Chip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      style={{
        flexShrink: 0, display: "inline-flex", alignItems: "baseline", gap: 5, padding: "6px 13px", borderRadius: 999,
        border: active ? "0.5px solid var(--color-label)" : "0.5px solid var(--color-hairline)",
        background: active ? "var(--color-label)" : "var(--color-bg-2)",
        color: active ? "var(--color-bg)" : "var(--color-label-2)",
        fontFamily: "var(--font-text)", fontSize: 14, fontWeight: active ? 600 : 500, lineHeight: 1, cursor: "pointer", whiteSpace: "nowrap",
      }}>
      {label}<span style={{ fontVariantNumeric: "tabular-nums", opacity: 0.6, fontWeight: 500 }}>{count}</span>
    </button>
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
  const [filter, setFilter] = useState<GroupKey | "all">("all");
  const [recent, setRecent] = useState<string[]>(() => loadRecent());
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
      fetch(api(`/search?q=${encodeURIComponent(query)}&_cb=${Date.now()}`), { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => { if (id === seq.current) { setRes({ ...EMPTY, ...d }); setLoading(false); } })
        .catch(() => { if (id === seq.current) { setRes(EMPTY); setLoading(false); } });
    }, 200);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query]);

  const r = res ?? EMPTY;
  const recordRecent = (term: string) => {
    const t = term.trim();
    if (t.length < 2) return;
    setRecent((prev) => {
      const next = [t, ...prev.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, 8);
      saveRecent(next);
      return next;
    });
  };
  const clearRecent = () => { setRecent([]); saveRecent([]); };
  const goEntity = (id: string, type: string | null) => { recordRecent(query); onOpenEntity(id, type); };
  const goNav = (href: string) => { recordRecent(query); onNavigate(href); };
  const openBook = (b: CatalogBook) => {
    recordRecent(query);
    if (b.readable && (BOOKS as Record<string, unknown>)[b.id]) onOpenBook(b.id);
    else onOpenEntity(b.id, "scripture");
  };

  const counts: Record<GroupKey, number> = {
    people: r.personalities.length, books: bookHits.length, verses: r.verses.length,
    chapters: r.chapters.length, prayers: r.prayers.length, centers: r.centers.length, pages: r.pages.length,
  };
  const present = GROUP_ORDER.filter((k) => counts[k] > 0);
  const total = present.reduce((s, k) => s + counts[k], 0);
  // Если активный фильтр опустел после нового запроса — мягко возвращаемся к «Все».
  const activeFilter: GroupKey | "all" = filter !== "all" && counts[filter] === 0 ? "all" : filter;
  const show = (k: GroupKey) => counts[k] > 0 && (activeFilter === "all" || activeFilter === k);
  const nothing = searching && !loading && res !== null && total === 0 && !r.exact;

  return (
    <div style={{ minHeight: "100%", background: "var(--color-bg)", color: "var(--color-label)" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 11, display: "flex", alignItems: "center", gap: 8, height: 56, padding: "0 10px",
        background: "color-mix(in srgb, var(--color-bg) 90%, transparent)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        borderBottom: present.length >= 2 ? "none" : "0.5px solid var(--color-hairline)" }}>
        <button type="button" aria-label="Назад" onClick={onBack}
          style={{ flexShrink: 0, display: "grid", height: 38, width: 38, placeItems: "center", borderRadius: "50%", border: "none", background: "none", color: "var(--color-label)", cursor: "pointer" }}>
          <BackIcon size={22} />
        </button>
        <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по всему приложению…" inputMode="search"
          style={{ flex: 1, minWidth: 0, boxSizing: "border-box", padding: "11px 14px", borderRadius: 12, border: "0.5px solid var(--color-hairline)",
            background: "var(--color-bg-2)", fontFamily: "var(--font-text)", fontSize: 16, color: "var(--color-label)", outline: "none" }} />
      </div>

      {searching && present.length >= 2 && (
        <div style={{ position: "sticky", top: 56, zIndex: 10, display: "flex", gap: 8, padding: "9px 16px", overflowX: "auto",
          background: "color-mix(in srgb, var(--color-bg) 90%, transparent)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          borderBottom: "0.5px solid var(--color-hairline)", scrollbarWidth: "none" } as React.CSSProperties}>
          <Chip label="Все" count={total} active={activeFilter === "all"} onClick={() => setFilter("all")} />
          {present.map((k) => (
            <Chip key={k} label={GROUP_LABEL[k]} count={counts[k]} active={activeFilter === k} onClick={() => setFilter(k)} />
          ))}
        </div>
      )}

      <div style={{ padding: "10px 16px calc(40px + env(safe-area-inset-bottom,0px))" }}>
        {!searching && recent.length > 0 && (
          <section style={{ marginTop: 16 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "0 0 10px" }}>
              <h3 style={{ margin: 0, fontFamily: "var(--font-text)", fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", color: "var(--color-label-3)" }}>Недавнее</h3>
              <button type="button" onClick={clearRecent}
                style={{ border: "none", background: "none", padding: 0, fontFamily: "var(--font-text)", fontSize: 13.5, color: "var(--color-label-3)", cursor: "pointer" }}>Очистить</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {recent.map((t) => (
                <button key={t} type="button" onClick={() => setQ(t)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 999, border: "0.5px solid var(--color-hairline)",
                    background: "var(--color-bg-2)", color: "var(--color-label-2)", fontFamily: "var(--font-text)", fontSize: 14, lineHeight: 1, cursor: "pointer" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden style={{ opacity: 0.55 }}>
                    <path d="M12 7v5l3 2M21 12a9 9 0 1 1-3.5-7.1M21 4v4h-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {t}
                </button>
              ))}
            </div>
          </section>
        )}

        {!searching && recent.length === 0 && (
          <p style={{ marginTop: 28, textAlign: "center", color: "var(--color-label-3)", fontFamily: "var(--font-text)", fontSize: 15, lineHeight: 1.5 }}>
            Личности, книги, стихи, главы,<br />молитвы, киртаны, центры…<br />начните вводить имя, название или строку.
          </p>
        )}

        {nothing && (
          <p style={{ marginTop: 28, textAlign: "center", color: "var(--color-label-3)", fontFamily: "var(--font-text)", fontSize: 15 }}>Ничего не найдено</p>
        )}

        {searching && r.exact && (activeFilter === "all" || activeFilter === "verses") && (
          <button type="button" onClick={() => goNav(r.exact!.href)}
            style={{ display: "flex", alignItems: "center", gap: 13, width: "100%", textAlign: "left", marginTop: 14,
              padding: "13px 14px", borderRadius: 14, border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)", cursor: "pointer" }}>
            <span style={{ flexShrink: 0, width: 42, height: 42, borderRadius: 11, display: "grid", placeItems: "center", background: "var(--color-bg-3)", color: "var(--color-label-2)" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
                <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4zM5 17a3 3 0 0 1 3-3h11" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--color-label-3)" }}>Стих</span>
              <span style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
                <span style={{ fontFamily: "var(--font-text)", fontSize: 16.5, fontWeight: 600, color: "var(--color-label)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.exact.book}</span>
                {r.exact.ref && <span style={{ flexShrink: 0, fontFamily: "var(--font-text)", fontSize: 14, fontWeight: 500, color: "var(--color-label-3)", fontVariantNumeric: "tabular-nums" }}>{r.exact.ref}</span>}
              </span>
              {r.exact.snippet && <span style={{ display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden", marginTop: 1, fontFamily: "var(--font-text)", fontSize: 13, color: "var(--color-label-3)" } as React.CSSProperties}>{r.exact.snippet}</span>}
            </span>
            <span style={{ flexShrink: 0, color: "var(--color-label-3)", fontSize: 20 }}>›</span>
          </button>
        )}

        {show("people") && (
          <Section title="Личности" count={counts.people}>
            {r.personalities.map((p) => (
              <Row key={"p" + p.id} ch={mono(p.name_ru || p.id)} title={p.name_ru || p.id} iast={p.name_iast} toks={toks} onTap={() => goEntity(p.id, p.type)} />
            ))}
          </Section>
        )}

        {show("books") && (
          <Section title="Книги" count={counts.books}>
            {bookHits.map((b) => (
              <Row key={"b" + b.id} ch={mono(b.title)} title={b.title} iast={b.iast || null} sub={b.readable ? null : "скоро"} toks={toks} onTap={() => openBook(b)} />
            ))}
          </Section>
        )}

        {show("verses") && (
          <Section title="Стихи" count={counts.verses}>
            {r.verses.map((v, i) => (
              <Row key={"v" + i + v.href} ch={mono(v.book)} title={v.book} meta={v.ref || undefined} sub={v.snippet} toks={toks} onTap={() => goNav(v.href)} />
            ))}
          </Section>
        )}

        {show("chapters") && (
          <Section title="Главы и части" count={counts.chapters}>
            {r.chapters.map((c, i) => (
              <Row key={"c" + i + c.href} ch={mono(c.title || "?")} title={c.title || "—"} sub={`${workLabel(c.work)}${c.level ? " · " + (LEVEL_LABEL[c.level] || c.level) : ""}`} toks={toks} onTap={() => goNav(c.href)} />
            ))}
          </Section>
        )}

        {show("prayers") && (
          <Section title="Молитвы и киртаны" count={counts.prayers}>
            {r.prayers.map((p, i) => (
              <Row key={"pr" + i + p.href} ch={mono(p.name || "?")} title={p.name || "—"} sub={p.subtitle} toks={toks} onTap={() => goNav(p.href)} />
            ))}
          </Section>
        )}

        {show("centers") && (
          <Section title="Центры" count={counts.centers}>
            {r.centers.map((c, i) => (
              <Row key={"ce" + i + c.href} ch={mono(c.name)} title={c.name} sub={c.city} toks={toks} onTap={() => goNav(c.href)} />
            ))}
          </Section>
        )}

        {show("pages") && (
          <Section title="Страницы и разделы" count={counts.pages}>
            {r.pages.map((p, i) => (
              <Row key={"pg" + i + p.href} ch={mono(p.name || "?")} title={p.name || "—"} sub={p.subtitle} toks={toks} onTap={() => goNav(p.href)} />
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
