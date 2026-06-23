/**
 * SearchScreen — глобальный сквозной поиск по всему приложению. Два источника,
 * слитых в единый список с чипами-фильтрами (Apple-стиль):
 *   · Серверный /api/search?q= — D1: личности и святые места (граф имён), стихи
 *     (FTS5 + recall-fallback, с полным названием книги), главы/части, молитвы,
 *     страницы/разделы, центры.
 *   · Клиентский searchStatic — бандл-данные, которых нет в D1: города календаря
 *     (выбор открывает «Календарь» на этом городе), рецепты прасадама,
 *     киртан-исполнители, разделы и инструменты приложения. Книги ищутся клиентом
 *     отдельно (searchBooks: фаззи/опечатки/IAST/алиасы) — мгновенно.
 * Совпадения подсвечиваются; стрелками ↑↓/Enter — навигация по результатам.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import { BOOKS, type CatalogBook } from "./books";
import { useCatalog, catalogNow } from "./bookCatalog";
import { searchBooks } from "./bookSearch";
import { loadCityDocs, searchStatic, type StaticHit, type CityDoc, type LocCity } from "./searchStatic";
import type { PlaceItem } from "./placesShared";

type Person = { id: string; type: string | null; name_ru: string | null; name_iast: string | null };
type Verse = { book: string; ref: string; work?: string; snippet: string; href: string };
type Chapter = { title: string | null; work: string; level: string | null; href: string };
type Page = { name: string | null; subtitle: string | null; snippet?: string | null; type?: string | null; href: string };
type Center = { name: string; city: string | null; href: string };
type ExactHit = { kind: "verse" | "chapter"; book: string; ref?: string; snippet?: string; title?: string; level?: string | null; href: string };
type Results = {
  exact?: ExactHit | null;
  personalities: Person[]; places: Person[]; verses: Verse[]; chapters: Chapter[];
  prayers: Page[]; pages: Page[]; centers: Center[];
};
const EMPTY: Results = { exact: null, personalities: [], places: [], verses: [], chapters: [], prayers: [], pages: [], centers: [] };

const LEVEL_LABEL: Record<string, string> = { chapter: "глава", canto: "песнь", lila: "лила", part: "часть", section: "раздел" };
function workLabel(work: string): string {
  const b = catalogNow().find((x) => x.id === work);
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

function Row({ ch, title, meta, sub, iast, toks, active, onTap }: { ch: string; title: string; meta?: string | null; sub?: string | null; iast?: string | null; toks: string[]; active?: boolean; onTap: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => { if (active) ref.current?.scrollIntoView({ block: "nearest" }); }, [active]);
  return (
    <div ref={ref} role="button" tabIndex={0} onClick={onTap}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onTap(); } }}
      style={{ display: "flex", alignItems: "center", gap: 13, padding: "11px 8px", margin: "0 -4px", borderRadius: 10, borderBottom: "0.5px solid var(--color-hairline)", background: active ? "var(--color-bg-2)" : "transparent", cursor: "pointer", textAlign: "left" }}>
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

function ExactCard({ ex, active, onTap }: { ex: ExactHit; active: boolean; onTap: () => void }) {
  const ref = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { if (active) ref.current?.scrollIntoView({ block: "nearest" }); }, [active]);
  const eyebrow = ex.kind === "verse" ? "Стих" : ex.level === "chapter" ? "Глава" : "Раздел";
  const second = ex.kind === "verse" ? ex.snippet : ex.title;
  return (
    <button ref={ref} type="button" onClick={onTap}
      style={{ display: "flex", alignItems: "center", gap: 13, width: "100%", textAlign: "left", marginTop: 14,
        padding: "13px 14px", borderRadius: 14, border: "0.5px solid var(--color-hairline)", background: active ? "var(--color-bg-3)" : "var(--color-bg-2)", cursor: "pointer" }}>
      <span style={{ flexShrink: 0, width: 42, height: 42, borderRadius: 11, display: "grid", placeItems: "center", background: "var(--color-bg-3)", color: "var(--color-label-2)" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
          <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4zM5 17a3 3 0 0 1 3-3h11" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--color-label-3)" }}>{eyebrow}</span>
        <span style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
          <span style={{ fontFamily: "var(--font-text)", fontSize: 16.5, fontWeight: 600, color: "var(--color-label)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ex.book}</span>
          {ex.kind === "verse" && ex.ref && <span style={{ flexShrink: 0, fontFamily: "var(--font-text)", fontSize: 14, fontWeight: 500, color: "var(--color-label-3)", fontVariantNumeric: "tabular-nums" }}>{ex.ref}</span>}
        </span>
        {second && <span style={{ display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden", marginTop: 1, fontFamily: "var(--font-text)", fontSize: 13, color: "var(--color-label-3)" } as React.CSSProperties}>{second}</span>}
      </span>
      <span style={{ flexShrink: 0, color: "var(--color-label-3)", fontSize: 20 }}>›</span>
    </button>
  );
}

function MoreLink({ n, active, onTap }: { n: number; active: boolean; onTap: () => void }) {
  const ref = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { if (active) ref.current?.scrollIntoView({ block: "nearest" }); }, [active]);
  return (
    <button ref={ref} type="button" onClick={onTap}
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", textAlign: "left",
        padding: "11px 8px", paddingLeft: 61, margin: "0 -4px", borderRadius: 10, border: "none",
        background: active ? "var(--color-bg-2)" : "transparent", cursor: "pointer",
        fontFamily: "var(--font-text)", fontSize: 14, fontWeight: 500, color: "var(--color-label-2)" }}>
      <span>Показать все · {n}</span>
      <span style={{ color: "var(--color-label-3)", fontSize: 20 }}>›</span>
    </button>
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

const GROUP_LABEL = { people: "Личности", books: "Книги", verses: "Стихи", chapters: "Главы", prayers: "Молитвы", kirtans: "Киртаны", places: "Святые места", centers: "Центры", restaurants: "Рестораны", cities: "Города", recipes: "Рецепты", tools: "Разделы", pages: "Страницы" } as const;
type GroupKey = keyof typeof GROUP_LABEL;
const GROUP_ORDER: GroupKey[] = ["people", "books", "verses", "chapters", "prayers", "kirtans", "places", "centers", "restaurants", "cities", "recipes", "tools", "pages"];
type PlaceHit = { id: string; title: string; sub: string | null; href: string };

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
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);
  const [dirCentresRaw, setDirCentresRaw] = useState<PlaceItem[]>([]);
  const [dirRestRaw, setDirRestRaw] = useState<PlaceItem[]>([]);
  const dirTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirSeq = useRef(0);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const query = q.trim();
  const searching = query.length >= 2;
  const toks = useMemo(() => tokensOf(query), [query]);

  // Книги — клиентский поиск (фаззи, опечатки, IAST, алиасы) по каталогу из D1.
  const catalog = useCatalog();
  const bookHits = useMemo(() => (searching ? searchBooks(query, catalog).slice(0, 8).map((h) => h.book) : []), [query, searching, catalog]);

  // Города календаря — клиентский индекс из /data/vaisnava-locations.json (≈272 города).
  const [cities, setCities] = useState<CityDoc[]>([]);
  const [citiesReady, setCitiesReady] = useState(false);
  useEffect(() => {
    let on = true;
    loadCityDocs().then((c) => { if (on) { setCities(c); setCitiesReady(true); } }).catch(() => { if (on) setCitiesReady(true); });
    return () => { on = false; };
  }, []);

  // Статический сквозной поиск: города, рецепты, киртан-исполнители, разделы приложения.
  const staticHits = useMemo<StaticHit[]>(() => (searching ? searchStatic(query, cities) : []), [query, searching, cities]);
  const cityHits = useMemo(() => staticHits.filter((h) => h.group === "cities"), [staticHits]);
  const recipeHits = useMemo(() => staticHits.filter((h) => h.group === "recipes"), [staticHits]);
  const kirtanHits = useMemo(() => staticHits.filter((h) => h.group === "kirtans"), [staticHits]);
  const toolHits = useMemo(() => staticHits.filter((h) => h.group === "tools"), [staticHits]);

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

  // Каталог центров/ресторанов из общей базы (/api/places) — RU-совпадения по
  // названию, городу, региону и стране. Так глобальный поиск находит реальный
  // центр (напр. Евпатория), а не только «город» календаря.
  useEffect(() => {
    if (dirTimer.current) clearTimeout(dirTimer.current);
    if (query.length < 2) { setDirCentresRaw([]); setDirRestRaw([]); return; }
    const id = ++dirSeq.current;
    dirTimer.current = setTimeout(() => {
      const enc = encodeURIComponent(query);
      Promise.all([
        fetch(api(`/places?kind=centre&q=${enc}&limit=12`)).then((x) => x.json()).catch(() => ({ items: [] })),
        fetch(api(`/places?kind=restaurant&q=${enc}&limit=12`)).then((x) => x.json()).catch(() => ({ items: [] })),
      ]).then(([c, rr]) => {
        if (id !== dirSeq.current) return;
        setDirCentresRaw(Array.isArray(c?.items) ? c.items : []);
        setDirRestRaw(Array.isArray(rr?.items) ? rr.items : []);
      }).catch(() => { if (id === dirSeq.current) { setDirCentresRaw([]); setDirRestRaw([]); } });
    }, 220);
    return () => { if (dirTimer.current) clearTimeout(dirTimer.current); };
  }, [query]);

  // Сброс выделения навигации при смене запроса/фильтра.
  useEffect(() => { setActive(-1); }, [query, filter]);

  const r = res ?? EMPTY;
  // Центры: заявленные (D1, богатые карточки /center) сверху, затем каталог
  // (/place/:id). Дубль каталога по совпадению англ. города с D1 убираем.
  const centresUnified = useMemo<PlaceHit[]>(() => {
    const d1 = r.centers;
    const d1Hits: PlaceHit[] = d1.map((c, i) => ({ id: "d1c:" + i, title: c.name, sub: c.city, href: c.href }));
    const d1Cities = new Set(d1.map((c) => (c.city || "").trim().toLowerCase()).filter(Boolean));
    const dir: PlaceHit[] = dirCentresRaw
      .filter((pl) => !d1Cities.has((pl.city || "").trim().toLowerCase()))
      .map((pl) => ({ id: "dc:" + pl.id, title: pl.nameRu || pl.name, sub: [pl.cityRu || pl.city, pl.countryRu].filter(Boolean).join(" · ") || null, href: "/place/" + pl.id }));
    return [...d1Hits, ...dir];
  }, [r.centers, dirCentresRaw]);
  const restaurantsHits = useMemo<PlaceHit[]>(() =>
    dirRestRaw.map((pl) => ({ id: "dr:" + pl.id, title: pl.nameRu || pl.name, sub: [pl.cityRu || pl.city, pl.countryRu].filter(Boolean).join(" · ") || null, href: "/restaurant/" + pl.id })),
    [dirRestRaw]);
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
  // Город календаря: запоминаем выбор и открываем «Календарь» уже на этом городе.
  const goCity = (loc: LocCity) => {
    recordRecent(query);
    try { localStorage.setItem("cal-loc", JSON.stringify(loc)); } catch { /* приватный режим */ }
    try { window.dispatchEvent(new CustomEvent("cal:set-loc", { detail: loc })); } catch { /* noop */ }
    onNavigate("/calendar");
  };
  // Статический результат → действие по типу навигации (путь или город).
  const goStatic = (h: StaticHit) => { if (h.nav.kind === "city") goCity(h.nav.loc); else goNav(h.nav.href); };
  const openBook = (b: CatalogBook) => {
    recordRecent(query);
    if (b.readable && (BOOKS as Record<string, unknown>)[b.id]) onOpenBook(b.id);
    else onOpenEntity(b.id, "scripture");
  };

  const counts: Record<GroupKey, number> = {
    people: r.personalities.length, books: bookHits.length, verses: r.verses.length,
    chapters: r.chapters.length, prayers: r.prayers.length, kirtans: kirtanHits.length,
    places: r.places.length, centers: centresUnified.length, restaurants: restaurantsHits.length,
    cities: cityHits.length, recipes: recipeHits.length, tools: toolHits.length, pages: r.pages.length,
  };
  const present = GROUP_ORDER.filter((k) => counts[k] > 0);
  const total = present.reduce((s, k) => s + counts[k], 0);
  // Если активный фильтр опустел после нового запроса — мягко возвращаемся к «Все».
  const activeFilter: GroupKey | "all" = filter !== "all" && counts[filter] === 0 ? "all" : filter;
  const show = (k: GroupKey) => counts[k] > 0 && (activeFilter === "all" || activeFilter === k);
  const nothing = searching && !loading && res !== null && citiesReady && total === 0 && !r.exact;

  // В обзоре («Все») каждая категория показывает превью; полный список — в фильтре.
  const PREVIEW = 6;
  const vis = (k: GroupKey) => (activeFilter === "all" ? Math.min(PREVIEW, counts[k]) : counts[k]);

  // Плоский список видимых результатов в порядке отображения — для навигации стрелками.
  const navItems: { id: string; go: () => void }[] = [];
  if (searching && r.exact && activeFilter === "all") navItems.push({ id: "exact", go: () => goNav(r.exact!.href) });
  const pushGroup = <T,>(k: GroupKey, rows: T[], idOf: (row: T, i: number) => string, goOf: (row: T) => void) => {
    if (!show(k)) return;
    rows.slice(0, vis(k)).forEach((row, i) => navItems.push({ id: idOf(row, i), go: () => goOf(row) }));
    if (activeFilter === "all" && counts[k] > PREVIEW) navItems.push({ id: "more:" + k, go: () => setFilter(k) });
  };
  pushGroup("people", r.personalities, (p) => "p:" + p.id, (p) => goEntity(p.id, p.type));
  pushGroup("books", bookHits, (b) => "b:" + b.id, (b) => openBook(b));
  pushGroup("verses", r.verses, (_v, i) => "v:" + i, (v) => goNav(v.href));
  pushGroup("chapters", r.chapters, (_c, i) => "c:" + i, (c) => goNav(c.href));
  pushGroup("prayers", r.prayers, (_p, i) => "pr:" + i, (p) => goNav(p.href));
  pushGroup("kirtans", kirtanHits, (h) => "ki:" + h.id, (h) => goStatic(h));
  pushGroup("places", r.places, (p) => "pl:" + p.id, (p) => goEntity(p.id, p.type));
  pushGroup("centers", centresUnified, (h) => "ce:" + h.id, (h) => goNav(h.href));
  pushGroup("restaurants", restaurantsHits, (h) => "re:" + h.id, (h) => goNav(h.href));
  pushGroup("cities", cityHits, (h) => "ci:" + h.id, (h) => goStatic(h));
  pushGroup("recipes", recipeHits, (h) => "rc:" + h.id, (h) => goStatic(h));
  pushGroup("tools", toolHits, (h) => "to:" + h.id, (h) => goStatic(h));
  pushGroup("pages", r.pages, (_p, i) => "pg:" + i, (p) => goNav(p.href));
  const activeId = active >= 0 && active < navItems.length ? navItems[active].id : null;
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, navItems.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, -1)); }
    else if (e.key === "Enter") { if (active >= 0 && active < navItems.length) { e.preventDefault(); navItems[active].go(); } }
    else if (e.key === "Escape") { if (q) { e.preventDefault(); setQ(""); setActive(-1); } else onBack(); }
  };

  return (
    <div style={{ minHeight: "100%", background: "var(--color-bg)", color: "var(--color-label)" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 11, display: "flex", alignItems: "center", gap: 8, height: 56, padding: "0 10px",
        background: "color-mix(in srgb, var(--color-bg) 90%, transparent)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        borderBottom: present.length >= 2 ? "none" : "0.5px solid var(--color-hairline)" }}>
        <button type="button" aria-label="Назад" onClick={onBack}
          style={{ flexShrink: 0, display: "grid", height: 38, width: 38, placeItems: "center", borderRadius: "50%", border: "none", background: "none", color: "var(--color-label)", cursor: "pointer" }}>
          <BackIcon size={22} />
        </button>
        <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="Поиск по всему приложению…" inputMode="search"
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
            Личности, книги, стихи, главы, молитвы,<br />киртаны, города, рецепты, разделы…<br />начните вводить имя, название или строку.
          </p>
        )}

        {nothing && (
          <p style={{ marginTop: 28, textAlign: "center", color: "var(--color-label-3)", fontFamily: "var(--font-text)", fontSize: 15 }}>Ничего не найдено</p>
        )}

        {searching && r.exact && activeFilter === "all" && (
          <ExactCard ex={r.exact} active={activeId === "exact"} onTap={() => goNav(r.exact!.href)} />
        )}

        {show("people") && (
          <Section title="Личности" count={counts.people}>
            {r.personalities.slice(0, vis("people")).map((p) => (
              <Row key={"p" + p.id} active={activeId === "p:" + p.id} ch={mono(p.name_ru || p.id)} title={p.name_ru || p.id} iast={p.name_iast} toks={toks} onTap={() => goEntity(p.id, p.type)} />
            ))}
            {activeFilter === "all" && counts.people > PREVIEW && <MoreLink n={counts.people} active={activeId === "more:people"} onTap={() => setFilter("people")} />}
          </Section>
        )}

        {show("books") && (
          <Section title="Книги" count={counts.books}>
            {bookHits.slice(0, vis("books")).map((b) => (
              <Row key={"b" + b.id} active={activeId === "b:" + b.id} ch={mono(b.title)} title={b.title} iast={b.iast || null} sub={b.readable ? null : "скоро"} toks={toks} onTap={() => openBook(b)} />
            ))}
            {activeFilter === "all" && counts.books > PREVIEW && <MoreLink n={counts.books} active={activeId === "more:books"} onTap={() => setFilter("books")} />}
          </Section>
        )}

        {show("verses") && (
          <Section title="Стихи" count={counts.verses}>
            {r.verses.slice(0, vis("verses")).map((v, i) => (
              <Row key={"v" + i + v.href} active={activeId === "v:" + i} ch={mono(v.book)} title={v.book} meta={v.ref || undefined} sub={v.snippet} toks={toks} onTap={() => goNav(v.href)} />
            ))}
            {activeFilter === "all" && counts.verses > PREVIEW && <MoreLink n={counts.verses} active={activeId === "more:verses"} onTap={() => setFilter("verses")} />}
          </Section>
        )}

        {show("chapters") && (
          <Section title="Главы и части" count={counts.chapters}>
            {r.chapters.slice(0, vis("chapters")).map((c, i) => (
              <Row key={"c" + i + c.href} active={activeId === "c:" + i} ch={mono(c.title || "?")} title={c.title || "—"} sub={`${workLabel(c.work)}${c.level ? " · " + (LEVEL_LABEL[c.level] || c.level) : ""}`} toks={toks} onTap={() => goNav(c.href)} />
            ))}
            {activeFilter === "all" && counts.chapters > PREVIEW && <MoreLink n={counts.chapters} active={activeId === "more:chapters"} onTap={() => setFilter("chapters")} />}
          </Section>
        )}

        {show("prayers") && (
          <Section title="Молитвы" count={counts.prayers}>
            {r.prayers.slice(0, vis("prayers")).map((p, i) => (
              <Row key={"pr" + i + p.href} active={activeId === "pr:" + i} ch={mono(p.name || "?")} title={p.name || "—"} sub={p.snippet || p.subtitle} toks={toks} onTap={() => goNav(p.href)} />
            ))}
            {activeFilter === "all" && counts.prayers > PREVIEW && <MoreLink n={counts.prayers} active={activeId === "more:prayers"} onTap={() => setFilter("prayers")} />}
          </Section>
        )}

        {show("kirtans") && (
          <Section title="Киртаны" count={counts.kirtans}>
            {kirtanHits.slice(0, vis("kirtans")).map((h) => (
              <Row key={"ki" + h.id} active={activeId === "ki:" + h.id} ch={mono(h.title)} title={h.title} sub={h.subtitle} toks={toks} onTap={() => goStatic(h)} />
            ))}
            {activeFilter === "all" && counts.kirtans > PREVIEW && <MoreLink n={counts.kirtans} active={activeId === "more:kirtans"} onTap={() => setFilter("kirtans")} />}
          </Section>
        )}

        {show("places") && (
          <Section title="Святые места" count={counts.places}>
            {r.places.slice(0, vis("places")).map((p) => (
              <Row key={"pl" + p.id} active={activeId === "pl:" + p.id} ch={mono(p.name_ru || p.id)} title={p.name_ru || p.id} iast={p.name_iast} toks={toks} onTap={() => goEntity(p.id, p.type)} />
            ))}
            {activeFilter === "all" && counts.places > PREVIEW && <MoreLink n={counts.places} active={activeId === "more:places"} onTap={() => setFilter("places")} />}
          </Section>
        )}

        {show("centers") && (
          <Section title="Центры" count={counts.centers}>
            {centresUnified.slice(0, vis("centers")).map((h) => (
              <Row key={"ce" + h.id} active={activeId === "ce:" + h.id} ch={mono(h.title)} title={h.title} sub={h.sub} toks={toks} onTap={() => goNav(h.href)} />
            ))}
            {activeFilter === "all" && counts.centers > PREVIEW && <MoreLink n={counts.centers} active={activeId === "more:centers"} onTap={() => setFilter("centers")} />}
          </Section>
        )}

        {show("restaurants") && (
          <Section title="Рестораны" count={counts.restaurants}>
            {restaurantsHits.slice(0, vis("restaurants")).map((h) => (
              <Row key={"re" + h.id} active={activeId === "re:" + h.id} ch={mono(h.title)} title={h.title} sub={h.sub} toks={toks} onTap={() => goNav(h.href)} />
            ))}
            {activeFilter === "all" && counts.restaurants > PREVIEW && <MoreLink n={counts.restaurants} active={activeId === "more:restaurants"} onTap={() => setFilter("restaurants")} />}
          </Section>
        )}

        {show("cities") && (
          <Section title="Города" count={counts.cities}>
            {cityHits.slice(0, vis("cities")).map((h) => (
              <Row key={"ci" + h.id} active={activeId === "ci:" + h.id} ch={mono(h.title)} title={h.title} sub={h.subtitle} toks={toks} onTap={() => goStatic(h)} />
            ))}
            {activeFilter === "all" && counts.cities > PREVIEW && <MoreLink n={counts.cities} active={activeId === "more:cities"} onTap={() => setFilter("cities")} />}
          </Section>
        )}

        {show("recipes") && (
          <Section title="Рецепты" count={counts.recipes}>
            {recipeHits.slice(0, vis("recipes")).map((h) => (
              <Row key={"rc" + h.id} active={activeId === "rc:" + h.id} ch={mono(h.title)} title={h.title} iast={h.iast} sub={h.subtitle} toks={toks} onTap={() => goStatic(h)} />
            ))}
            {activeFilter === "all" && counts.recipes > PREVIEW && <MoreLink n={counts.recipes} active={activeId === "more:recipes"} onTap={() => setFilter("recipes")} />}
          </Section>
        )}

        {show("tools") && (
          <Section title="Разделы" count={counts.tools}>
            {toolHits.slice(0, vis("tools")).map((h) => (
              <Row key={"to" + h.id} active={activeId === "to:" + h.id} ch={mono(h.title)} title={h.title} sub={h.subtitle} toks={toks} onTap={() => goStatic(h)} />
            ))}
            {activeFilter === "all" && counts.tools > PREVIEW && <MoreLink n={counts.tools} active={activeId === "more:tools"} onTap={() => setFilter("tools")} />}
          </Section>
        )}

        {show("pages") && (
          <Section title="Страницы и разделы" count={counts.pages}>
            {r.pages.slice(0, vis("pages")).map((p, i) => (
              <Row key={"pg" + i + p.href} active={activeId === "pg:" + i} ch={mono(p.name || "?")} title={p.name || "—"} sub={p.snippet || p.subtitle} toks={toks} onTap={() => goNav(p.href)} />
            ))}
            {activeFilter === "all" && counts.pages > PREVIEW && <MoreLink n={counts.pages} active={activeId === "more:pages"} onTap={() => setFilter("pages")} />}
          </Section>
        )}

        {searching && loading && total === 0 && (
          <p style={{ marginTop: 24, textAlign: "center", color: "var(--color-label-3)", fontFamily: "var(--font-text)", fontSize: 15 }}>Поиск…</p>
        )}
      </div>
    </div>
  );
}
