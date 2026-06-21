/**
 * gaurangers.com — shell copied 1:1 from apartsales (TopHeader + TabBar + UnitCard/UnitHero).
 * Book card PRESENTS the book (no price/rating/compare/CTA): tap → detail page.
 * Cover: graphite background for now (real BBT artwork to be wired later).
 * Text strictly per Śrīla Prabhupāda. One type family throughout.
 */
import { useState, useRef, useEffect, useLayoutEffect, type ReactNode } from "react";
import type { SVGProps, MouseEvent as ReactMouseEvent } from "react";
import { BookDetailPage } from "./BookDetailPage";
import HomeScreen from "./HomeScreen";
import { requestHomeTab } from "./homeNav";
import type { HomeTabId } from "./HomeTabs";
import { DonateModal } from "./DonateModal";
import { BOOKS, bookFullTitle } from "./books";
import BooksHub from "./BooksHub";
import { downloadBookPdf } from "./bookPdf";
import { QrSheet, type QrData } from "./QrSheet";
import { ReportSheet } from "./ReportSheet";
import { PdfDoc } from "./PdfDoc";
import { CardActionsProvider } from "./cardActions";
import { PlayerProvider } from "./player/store";
import { MiniPlayer } from "./player/MiniPlayer";
import { NowPlaying } from "./player/NowPlaying";
import BhajanDetailPage from "./BhajanDetailPage";
import KirtansScreen from "./KirtansScreen";
import KirtanArtistPage from "./KirtanArtistPage";
import ContentDetailPage from "./ContentDetailPage";
import EntityPage from "./EntityPage";
import AcharyaScreen from "./AcharyaScreen";
import PracticeHub from "./PracticeHub";
import { HomeCalendar } from "./HomeCalendar";
import { HomeFeed } from "./HomeFeed";
import SearchScreen from "./SearchScreen";
import FavoritesScreen from "./FavoritesScreen";
import NotesScreen from "./NotesScreen";
import NoteDetail from "./NoteDetail";
import { OPEN_NOTES_EVENT, takePendingNotes, requestNote, createNote, type NoteAttach } from "./notes";
import BookLoaderPage from "./BookLoaderPage";
import AccountScreen from "./AccountScreen";
import { AuthProvider } from "./account/store";
import { AUTH_REQUIRED_EVENT } from "./account/track";
import { navInit, navSetIdxFromState, pushUrl, replaceUrl, canGoBack } from "./nav";
import { api } from "./api";
import CartScreen from "./shop/CartScreen";
import JapaScreen from "./JapaScreen";
import SadhanaScreen from "./SadhanaScreen";
import VowScreen from "./VowScreen";
import DarshanScreen from "./DarshanScreen";
import DailyVerseScreen from "./DailyVerseScreen";
import MyProgressScreen from "./MyProgressScreen";
import CenterScreen from "./centers/CenterScreen";
import MyCentersScreen from "./centers/MyCentersScreen";
import CentersScreen from "./centers/CentersScreen";
import CenterEditor from "./centers/CenterEditor";
import CenterSchedule from "./centers/CenterSchedule";
import CenterDeities from "./centers/CenterDeities";
import CenterEvents from "./centers/CenterEvents";
import CenterModeration from "./centers/CenterModeration";
import CenterPhotos from "./centers/CenterPhotos";
import { useCartCount } from "./shop/cart";
import PrasadamScreen from "./prasad/PrasadamScreen";
import RecipeDetail from "./prasad/RecipeDetail";
import CookbookScreen from "./prasad/CookbookScreen";
import DhamaScreen from "./dhama/DhamaScreen";
import DhamaDetailPage from "./dhama/DhamaDetailPage";
import TirthaDetailPage from "./dhama/TirthaDetailPage";
import { getDhama } from "./dhama/dhamas";

/* ═════════ ICONS (apartsales icons.tsx, verbatim geometry) ═════════ */
interface IconProps extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> { size?: number; filled?: boolean; }
const sp = ({ size = 26 }: IconProps) => ({ width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true as const });
const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function HomeIcon(p: IconProps) {
  return p.filled
    ? <svg {...sp(p)}><path fill="currentColor" d="M11.32 2.46a1 1 0 0 1 1.36 0l8.68 8.5a1 1 0 0 1 .31.71v8.7c0 1-.8 1.83-1.81 1.83H15v-7.4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1V22.2H4.14A1.81 1.81 0 0 1 2.33 20.37v-8.7c0-.27.11-.53.31-.71l8.68-8.5Z" /></svg>
    : <svg {...sp(p)}><path {...STROKE} d="m3 11.4 9-8.4 9 8.4v8.78a.83.83 0 0 1-.83.82H15v-7.5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1V21H3.83a.83.83 0 0 1-.83-.82V11.4Z" /></svg>;
}
function FeedIcon(p: IconProps) {
  const r = (x: number, y: number) => <rect {...STROKE} x={x} y={y} width="7.5" height="7.5" rx="1.6" />;
  return <svg {...sp(p)}>{r(3.5, 3.5)}{r(13, 3.5)}{r(3.5, 13)}{r(13, 13)}</svg>;
}
function AISearchIcon(p: IconProps) {
  const sparkle = "M19 2c.06 0 .12.05.13.11l.4 2.18a1.4 1.4 0 0 0 1.18 1.18l2.18.4a.13.13 0 0 1 0 .26l-2.18.4a1.4 1.4 0 0 0-1.18 1.18l-.4 2.18a.13.13 0 0 1-.26 0l-.4-2.18a1.4 1.4 0 0 0-1.18-1.18l-2.18-.4a.13.13 0 0 1 0-.26l2.18-.4a1.4 1.4 0 0 0 1.18-1.18l.4-2.18A.13.13 0 0 1 19 2Z";
  return <svg {...sp(p)}><circle {...STROKE} cx="10.5" cy="11.5" r="7" /><path {...STROKE} strokeWidth="1.9" d="m20 21-3.5-3.5" /><path d={sparkle} fill="currentColor" /></svg>;
}
function MapPinIcon(p: IconProps) {
  return <svg {...sp(p)}><path {...STROKE} d="M12 22c-1.6-1.5-7.5-7-7.5-12 0-4.14 3.36-7.5 7.5-7.5s7.5 3.36 7.5 7.5c0 5-5.9 10.5-7.5 12Z" /><circle {...STROKE} cx="12" cy="10.2" r="2.8" /></svg>;
}
function HeartIcon(p: IconProps) {
  const d = "M12 21c-7.4-4.6-9.9-8.7-9.9-12.5 0-2.85 2.04-5.2 4.85-5.2 1.97 0 3.6 1.05 5.05 3.07 1.45-2.02 3.08-3.07 5.05-3.07 2.81 0 4.85 2.35 4.85 5.2 0 3.8-2.5 7.9-9.9 12.5Z";
  return p.filled ? <svg {...sp(p)}><path d={d} fill="currentColor" /></svg> : <svg {...sp(p)}><path {...STROKE} d={d} /></svg>;
}
function ShareIcon(p: IconProps) {
  return <svg {...sp(p)}><path {...STROKE} d="M12 3v13M8 7l4-4 4 4" /><path {...STROKE} d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></svg>;
}
function BagIcon(p: IconProps & { cornerGlyph?: "plus" | "minus" | null }) {
  const { cornerGlyph, ...rest } = p;
  const corner = cornerGlyph === "plus"
    ? <g><line x1="20" y1="3.25" x2="23.5" y2="3.25" {...STROKE} /><line x1="21.75" y1="1.5" x2="21.75" y2="5" {...STROKE} /></g>
    : cornerGlyph === "minus" ? <line x1="20" y1="3.25" x2="23.5" y2="3.25" {...STROKE} /> : null;
  return <svg {...sp(rest)} overflow="visible"><path {...STROKE} d="M5.4 7.5h13.2a1 1 0 0 1 1 1.1l-1.2 11.4a1.5 1.5 0 0 1-1.5 1.4H7.1a1.5 1.5 0 0 1-1.5-1.4L4.4 8.6a1 1 0 0 1 1-1.1Z" /><path {...STROKE} d="M8 9V6.5a4 4 0 0 1 8 0V9" />{corner}</svg>;
}

/* ═════════ TopHeader — search / wordmark / favorites ═════════ */
function TopHeader({ onHome, onFavorites, onSearch }: { onHome?: () => void; onFavorites?: () => void; onSearch?: () => void }) {
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 30, height: 56, flexShrink: 0, background: "var(--color-bg)", borderBottom: "0.5px solid var(--color-hairline)" }}>
      <div style={{ display: "grid", height: "100%", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "0 12px" }}>
        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <button aria-label="Поиск" onClick={onSearch} style={{ display: "grid", height: 40, width: 40, placeItems: "center", borderRadius: "50%", background: "none", border: "none", color: "var(--color-label)", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
            <AISearchIcon size={25} />
          </button>
        </div>
        <button type="button" aria-label="ISKCON ONE LOVE" onClick={onHome}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "0 8px", background: "none", border: "none", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
          <span role="img" style={{
            display: "block", width: 132, height: 132 * 73 / 1067, backgroundColor: "var(--color-label)",
            WebkitMaskImage: "url(/iskcon-one-love.svg)", maskImage: "url(/iskcon-one-love.svg)",
            WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskPosition: "center", maskPosition: "center",
          }} />
        </button>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
          <button aria-label="Избранное" onClick={onFavorites} style={{ display: "grid", height: 40, width: 40, placeItems: "center", borderRadius: "50%", background: "none", border: "none", color: "var(--color-label)", cursor: "pointer" }}><HeartIcon size={24} /></button>
        </div>
      </div>
    </header>
  );
}

/* ═════════ TabBar — нижнее меню gaurangers (Instagram-2026 · liquid glass) ═════════
 * Плавающая «таблетка», два размера (обычный ↔ компактный при прокрутке),
 * овальное выделение активного таба, иконки — логотипы через CSS-маску
 * (цвет = --color-label, т.е. чёрные в светлой теме / белые в тёмной). */
const TABS = [
  { id: "krishna", label: "Кришна", src: "/vraj.svg", wide: false },
  { id: "gauranga", label: "Гауранга", src: "/gauranga.svg", wide: false },
  { id: "iskcon", label: "ИСККОН", src: "/iskcon.svg", wide: true },
  { id: "bogatstva", label: "Богатства", src: "/bbt.svg", wide: false },
  { id: "sadhana", label: "Садхана", src: "/prabhupada.svg", wide: false },
] as const;

function TabBar({ active, onChange, scrollRef }: { active: string; onChange: (k: string) => void; scrollRef: { current: HTMLElement | null } }) {
  const navRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [compact, setCompact] = useState(false);

  const moveHighlight = () => {
    const i = TABS.findIndex((t) => t.id === active);
    const slot = slotRefs.current[i];
    const nav = navRef.current;
    const pill = pillRef.current;
    if (!slot || !nav || !pill) return;
    const nr = nav.getBoundingClientRect();
    const sr = slot.getBoundingClientRect();
    pill.style.width = `${sr.width}px`;
    pill.style.transform = `translateX(${sr.left - nr.left}px)`;
  };

  // держим овал приклеенным к активному табу (смена таба / компакт / лейаут)
  const moveRef = useRef(moveHighlight);
  moveRef.current = moveHighlight;
  useLayoutEffect(() => { moveHighlight(); }, [active, compact]);
  useEffect(() => {
    const nav = navRef.current;
    if (!nav || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => moveRef.current());
    ro.observe(nav);
    return () => ro.disconnect();
  }, []);

  // прокрутка → компактный размер (как в Instagram 2026)
  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    const onScroll = () => setCompact((c) => { const w = sc.scrollTop > 22; return c === w ? c : w; });
    onScroll();
    sc.addEventListener("scroll", onScroll, { passive: true });
    return () => sc.removeEventListener("scroll", onScroll);
  }, [scrollRef]);

  return (
    <div className="gtab-wrap">
      <nav ref={navRef} className={compact ? "gtab compact" : "gtab"} aria-label="Главная навигация">
        <div ref={pillRef} className="gtab-pill" aria-hidden />
        {TABS.map((t, i) => {
          const on = active === t.id;
          return (
            <button key={t.id} ref={(el) => { slotRefs.current[i] = el; }} className="gtab-slot"
              aria-label={t.label} aria-current={on ? "page" : undefined} onClick={() => { if (on) { scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" }); window.dispatchEvent(new CustomEvent("tab-reset", { detail: t.id })); } onChange(t.id); }}>
              {t.src ? (
                <span className={t.wide ? "gtab-ic wide" : "gtab-ic"} style={{ WebkitMaskImage: `url(${t.src})`, maskImage: `url(${t.src})` }} />
              ) : (
                <span className="gtab-ava">
                  <svg viewBox="0 0 24 24" aria-hidden><path d="M12 11.6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" fill="currentColor" /><path d="M5.8 20c.7-3.6 3.1-5.5 6.2-5.5s5.5 1.9 6.2 5.5z" fill="currentColor" /></svg>
                  <span className="gtab-dot" />
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/* ═════════ ComingSoon — экран-заглушка раздела (эмблема + название) ═════════ */
function ComingSoon({ src, title, subtitle }: { src?: string; title: string; subtitle: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "72px 24px 24px" }}>
      {src ? (
        <LogoMark src={src} label={title} height={116} />
      ) : (
        <span style={{ display: "grid", placeItems: "center", width: 116, height: 116, borderRadius: "50%", background: "var(--color-glass-regular)", color: "var(--color-label-2)" }}>
          <svg width="58" height="58" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 11.6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /><path d="M5.8 20c.7-3.6 3.1-5.5 6.2-5.5s5.5 1.9 6.2 5.5z" /></svg>
        </span>
      )}
      <h1 style={{ margin: "24px 0 0", fontFamily: "var(--font-display)", fontSize: "var(--text-title1)", fontWeight: "var(--weight-heavy)", letterSpacing: "var(--tracking-tight)", color: "var(--color-label)" }}>{title}</h1>
      <p style={{ margin: "8px 0 0", fontSize: "var(--text-subhead)", color: "var(--color-label-2)", lineHeight: 1.45, maxWidth: 290 }}>{subtitle}</p>
    </div>
  );
}

/* ═════════ logo mark — monochrome via mask, color from parent ═════════ */
function LogoMark({ src, label, height }: { src: string; label: string; height: number }) {
  return (
    <span role="img" aria-label={label} style={{
      display: "block", height, width: height, backgroundColor: "currentColor",
      WebkitMaskImage: `url(${src})`, maskImage: `url(${src})`,
      WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
      WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskPosition: "center", maskPosition: "center",
    }} />
  );
}

/* ═════════ Bhajan shelf — list from D1 prayers (api /bhajans) ═════════ */
interface BhajanListItem { slug: string; name: string; author: string | null; hero_image: string | null; }
function BhajanShelf({ onOpen, onOpenCatalog }: { onOpen: (slug: string) => void; onOpenCatalog: () => void }) {
  const [items, setItems] = useState<BhajanListItem[] | null>(null);
  useEffect(() => {
    let live = true;
    fetch(api("/bhajans"))
      .then((r) => r.json())
      .then((d) => { if (live) setItems(d.bhajans ?? []); })
      .catch(() => { if (live) setItems([]); });
    return () => { live = false; };
  }, []);

  return (
    <section style={{ marginTop: 28 }}>
      <div style={{ marginBottom: 12, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.4px", textTransform: "uppercase", color: "var(--color-brand-blue)" }}>Молитвенник</div>
          <h2 style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 700, letterSpacing: "-0.3px", color: "var(--color-label)", fontFamily: "var(--font-text)" }}>Бхаджаны</h2>
        </div>
        <button onClick={onOpenCatalog} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 999, border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)", cursor: "pointer", color: "var(--color-brand-blue)", fontSize: 13, fontWeight: 600, fontFamily: "var(--font-text)" }}>
          Весь каталог
          <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
      {!items && <div style={{ fontSize: 15, color: "var(--color-label-2)" }}>Загрузка…</div>}
      {items && items.length === 0 && <div style={{ fontSize: 15, color: "var(--color-label-2)" }}>Пока пусто.</div>}
      {items && items.length > 0 && (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", borderRadius: 18, overflow: "hidden", background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)" }}>
          {items.map((b, i) => (
            <li key={b.slug} style={{ borderBottom: i === items.length - 1 ? "none" : "0.5px solid var(--color-hairline)" }}>
              <button onClick={() => onOpen(b.slug)} style={{ display: "flex", width: "100%", alignItems: "center", gap: 12, padding: 10, textAlign: "left", background: "none", border: "none", cursor: "pointer", color: "var(--color-label)", fontFamily: "var(--font-text)" }}>
                {b.hero_image
                  ? <img src={b.hero_image} alt="" loading="lazy" style={{ width: 52, height: 52, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                  : <span style={{ width: 52, height: 52, borderRadius: 10, flexShrink: 0, background: "var(--color-glass-regular)" }} />}
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "block", fontSize: 15, fontWeight: 600, lineHeight: 1.25, color: "var(--color-label)" }}>{b.name}</span>
                  {b.author && <span style={{ display: "block", marginTop: 2, fontSize: 13, color: "var(--color-label-2)" }}>{b.author}</span>}
                </span>
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden style={{ flexShrink: 0, color: "var(--color-label-2)" }}><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ═════════ Bhajan catalog — grouped author → songbook → section ═════════ */
interface CatalogItem { slug: string; name: string; author: string | null; source_text: string | null; category: string | null; section: string | null; ord: number | null; has_text: boolean; }
function BhajanCatalog({ onOpen, onBack }: { onOpen: (slug: string) => void; onBack: () => void }) {
  const [items, setItems] = useState<CatalogItem[] | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let live = true;
    fetch(api("/bhajans/catalog"))
      .then((r) => r.json())
      .then((d) => { if (live) { if (Array.isArray(d.items)) setItems(d.items); else setErr(true); } })
      .catch(() => { if (live) setErr(true); });
    return () => { live = false; };
  }, []);

  // group: author -> songbook(source_text|'—') -> items (ordered)
  const groups: { author: string; books: { book: string | null; rows: CatalogItem[] }[] }[] = [];
  if (items) {
    const byAuthor = new Map<string, CatalogItem[]>();
    for (const it of items) {
      const a = it.author ?? "Традиционные";
      (byAuthor.get(a) ?? byAuthor.set(a, []).get(a)!).push(it);
    }
    for (const [author, rows] of byAuthor) {
      const byBook = new Map<string, CatalogItem[]>();
      for (const it of rows) {
        const b = it.source_text ?? "—";
        (byBook.get(b) ?? byBook.set(b, []).get(b)!).push(it);
      }
      const books = [...byBook.entries()].map(([book, r]) => ({ book: book === "—" ? null : book, rows: r }));
      groups.push({ author, books });
    }
  }
  const totalText = items ? items.filter((i) => i.has_text).length : 0;

  return (
    <div style={{ minHeight: "100%", background: "var(--color-bg)" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 30, height: 56, display: "flex", alignItems: "center", gap: 6, padding: "0 8px", borderBottom: "0.5px solid var(--color-hairline)", background: "var(--color-bg)" }}>
        <button aria-label="Назад" onClick={onBack} style={{ display: "grid", height: 40, width: 40, placeItems: "center", borderRadius: "50%", border: "none", background: "none", cursor: "pointer", color: "var(--color-label)" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0, fontSize: 15.5, fontWeight: 700, color: "var(--color-label)" }}>Каталог бхаджанов</div>
      </header>

      {!items && !err && <div style={{ textAlign: "center", color: "var(--color-label-2)", padding: "48px 0", fontSize: 15 }}>Загрузка…</div>}
      {err && <div style={{ textAlign: "center", color: "var(--color-label-2)", padding: "48px 16px", fontSize: 15 }}>Не удалось загрузить каталог.</div>}

      {items && (
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "16px 16px 56px" }}>
          <div style={{ fontSize: 13, color: "var(--color-label-2)", marginBottom: 18 }}>
            {items.length} молитв и песен · {totalText} с полным текстом
          </div>
          {groups.map((g) => (
            <section key={g.author} style={{ marginBottom: 26 }}>
              <h2 style={{ margin: "0 0 10px", fontSize: 18, fontWeight: 800, letterSpacing: "-0.2px", color: "var(--color-label)" }}>{g.author}</h2>
              {g.books.map((bk) => (
                <div key={(g.author) + "|" + (bk.book ?? "_")} style={{ marginBottom: 12 }}>
                  {bk.book && <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", color: "var(--color-brand-blue)", margin: "8px 2px 6px" }}>{bk.book}</div>}
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", borderRadius: 14, overflow: "hidden", background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)" }}>
                    {bk.rows.map((it, i) => (
                      <li key={it.slug} style={{ borderBottom: i === bk.rows.length - 1 ? "none" : "0.5px solid var(--color-hairline)" }}>
                        <button onClick={() => onOpen(it.slug)} style={{ display: "flex", width: "100%", alignItems: "center", gap: 10, padding: "11px 12px", textAlign: "left", background: "none", border: "none", cursor: "pointer", color: "var(--color-label)", fontFamily: "var(--font-text)" }}>
                          <span style={{ minWidth: 0, flex: 1 }}>
                            <span style={{ display: "block", fontSize: 15, fontWeight: 500, lineHeight: 1.3, color: "var(--color-label)" }}>{it.name}</span>
                            {it.section && <span style={{ display: "block", marginTop: 2, fontSize: 12.5, color: "var(--color-label-2)" }}>{it.section}</span>}
                          </span>
                          {!it.has_text && <span style={{ flexShrink: 0, fontSize: 11, color: "var(--color-label-2)", border: "0.5px solid var(--color-hairline)", borderRadius: 999, padding: "2px 8px" }}>скоро</span>}
                          <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden style={{ flexShrink: 0, color: "var(--color-label-2)" }}><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═════════ Feed — перенос контента iskcone (статьи · личности · центры) ═════════ */
interface FeedItem { slug: string; name: string; hero_image: string | null; kind?: string | null; n_quotes?: number }

function ContentSection({ eyebrow, title, endpoint, onOpen }: { eyebrow: string; title: string; endpoint: string; onOpen: (slug: string) => void }) {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  useEffect(() => {
    let live = true;
    fetch(api(endpoint))
      .then((r) => r.json())
      .then((d) => { if (live) setItems(d.items ?? []); })
      .catch(() => { if (live) setItems([]); });
    return () => { live = false; };
  }, [endpoint]);

  if (items && items.length === 0) return null;
  return (
    <section style={{ marginTop: "var(--space-8)" }}>
      <div style={{ marginBottom: "var(--space-3)" }}>
        <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: "var(--weight-semibold)", letterSpacing: "var(--tracking-wide)", textTransform: "uppercase", color: "var(--color-brand-blue)" }}>{eyebrow}</div>
        <h2 style={{ margin: "2px 0 0", fontFamily: "var(--font-display)", fontSize: "var(--text-title2)", fontWeight: "var(--weight-bold)", letterSpacing: "var(--tracking-tight)", color: "var(--color-label)" }}>{title}</h2>
      </div>
      {!items && <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", color: "var(--color-label-2)" }}>Загрузка…</div>}
      {items && (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)" }}>
          {items.map((it, i) => (
            <li key={it.slug} style={{ borderBottom: i === items.length - 1 ? "none" : "0.5px solid var(--color-hairline)" }}>
              <button onClick={() => onOpen(it.slug)} style={{ display: "flex", width: "100%", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-3)", textAlign: "left", background: "none", border: "none", cursor: "pointer", color: "var(--color-label)", fontFamily: "var(--font-text)" }}>
                {it.hero_image
                  ? <img src={it.hero_image} alt="" loading="lazy" style={{ width: 56, height: 56, borderRadius: "var(--radius-md)", objectFit: "cover", flexShrink: 0 }} />
                  : <span style={{ display: "grid", placeItems: "center", width: 56, height: 56, borderRadius: "var(--radius-md)", flexShrink: 0, background: "var(--color-bg-3)", color: "var(--color-label-3)" }}><LogoMark src="/iskcon-sign.svg" label="" height={30} /></span>}
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: "var(--text-callout)", fontWeight: "var(--weight-semibold)", lineHeight: 1.3, color: "var(--color-label)", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{it.name}</span>
                  {(it.kind || it.n_quotes) ? (
                    <span style={{ display: "block", marginTop: 2, fontSize: "var(--text-footnote)", color: "var(--color-label-2)" }}>
                      {[it.kind, it.n_quotes ? `${it.n_quotes} цитат` : null].filter(Boolean).join(" · ")}
                    </span>
                  ) : null}
                </span>
                <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden style={{ flexShrink: 0, color: "var(--color-label-2)" }}><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FeedScreen({ onOpen }: { onOpen: (slug: string) => void }) {
  return (
    <div>
      <div style={{ marginBottom: "var(--space-2)" }}>
        <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: "var(--weight-semibold)", letterSpacing: "var(--tracking-wide)", textTransform: "uppercase", color: "var(--color-brand-blue)" }}>ISKCON ONE LOVE</div>
        <h1 style={{ margin: "2px 0 0", fontFamily: "var(--font-display)", fontSize: "var(--text-title1)", fontWeight: "var(--weight-heavy)", letterSpacing: "var(--tracking-tight)", color: "var(--color-label)" }}>Лента</h1>
      </div>
      <ContentSection eyebrow="Личности" title="Кришна, аватары и спутники" endpoint="/content/personalities" onOpen={onOpen} />
      <ContentSection eyebrow="Заметки на полях сердца" title="Статьи" endpoint="/content/articles" onOpen={onOpen} />
      <ContentSection eyebrow="Сообщество" title="Центры ИСККОН" endpoint="/content/centers" onOpen={onOpen} />
    </div>
  );
}

function SegRow({ value, onChange, items }: { value: string; onChange: (v: string) => void; items: [string, string][] }) {
  return (
    <div role="tablist" style={{ display: "flex", gap: 8, marginBottom: 18, overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
      {items.map(([id, label]) => {
        const on = value === id;
        return (
          <button key={id} role="tab" aria-selected={on} onClick={() => onChange(id)}
            style={{ flexShrink: 0, padding: "8px 16px", borderRadius: 999, border: "none", cursor: "pointer",
              fontFamily: "var(--font-text)", fontSize: 14.5, fontWeight: 600, letterSpacing: "-0.2px",
              background: on ? "var(--color-label)" : "var(--color-bg-2)", color: on ? "var(--color-bg)" : "var(--color-label-2)" }}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

function BogatstvaHall({ onOpenBook, onBookMenu, onOpenEntity, onOpenCollection, onOpenPath, flash, onOpenArtist, onOpenBhajan, onOpenCatalog }: {
  onOpenBook: (work: string) => void; onBookMenu: (work: string) => void; onOpenEntity: (id: string, type: string | null) => void;
  onOpenCollection: (key: string) => void; onOpenPath: (path: string) => void; flash?: string | null;
  onOpenArtist: (slug: string) => void; onOpenBhajan: (slug: string) => void; onOpenCatalog: () => void;
}) {
  const [sub, setSub] = useState("books");
  return (
    <div>
      <SegRow value={sub} onChange={setSub} items={[["books", "Книги"], ["audio", "Аудио"]]} />
      {sub === "books" && <BooksHub onOpenBook={onOpenBook} onBookMenu={onBookMenu} onOpenEntity={onOpenEntity} onOpenCollection={onOpenCollection} onOpenPath={onOpenPath} flash={flash} />}
      {sub === "audio" && <KirtansScreen onOpenArtist={onOpenArtist} onOpenBhajan={onOpenBhajan} onOpenCatalog={onOpenCatalog} />}
    </div>
  );
}

function SadhanaHall({ onOpenPath, onOpenEntity, onDonate, flash }: {
  onOpenPath: (path: string) => void; onOpenEntity: (id: string, type: string | null) => void; onDonate: () => void; flash?: string | null;
}) {
  const [sub, setSub] = useState("practice");
  return (
    <div>
      <SegRow value={sub} onChange={setSub} items={[["practice", "Практика"], ["calendar", "Календарь"], ["feed", "Лента"], ["cabinet", "Кабинет"]]} />
      {sub === "practice" && <PracticeHub onOpen={onOpenPath} />}
      {sub === "calendar" && <HomeCalendar stickyTop={0} onOpenEntity={onOpenEntity} />}
      {sub === "feed" && <HomeFeed />}
      {sub === "cabinet" && <AccountScreen onOpenPath={onOpenPath} onDonate={onDonate} flash={flash} />}
    </div>
  );
}

function Screen({ tab, onChange, onOpenBook, onOpenBhajan, onOpenKirtanArtist, onOpenCatalog, onOpenContent, onOpenEntity, onOpenCollection, onFavorites, onDonate, onOpenPath, onSearch }: { tab: string; onChange: (k: string) => void; onOpenBook: (work: string) => void; onOpenBhajan: (slug: string) => void; onOpenKirtanArtist: (slug: string) => void; onOpenCatalog: () => void; onOpenContent: (slug: string) => void; onOpenEntity: (id: string, type: string | null) => void; onOpenCollection: (key: string) => void; onFavorites: () => void; onDonate: () => void; onOpenPath: (path: string) => void; onSearch: () => void }) {
  const mainRef = useRef<HTMLElement>(null);
  // Смена вкладки нижней навигации → новая вкладка начинается с верха
  // (прокрутка не переносится из покинутой). Первый монтаж пропускаем.
  const navReady = useRef(false);
  useLayoutEffect(() => {
    if (!navReady.current) { navReady.current = true; return; }
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [tab]);
  const [qr, setQr] = useState<{ url: string; data: QrData } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [bookPct, setBookPct] = useState(0);
  const [bookPctTitle, setBookPctTitle] = useState("Готовлю PDF книги");
  const [pdfHidden, setPdfHidden] = useState(false);
  const pdfCancel = useRef(false);
  const pdfAbort = useRef<AbortController | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = (m: string) => {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  };
  const cancelPdf = () => { pdfCancel.current = true; pdfAbort.current?.abort(); setBookPct(0); setPdfHidden(false); };
  // Единое меню книги (⋯) — общий обработчик для всех карточек хаба.
  const bookMenu = (work: string, id: string) => {
    const b = BOOKS[work];
    if (!b) return;
    const url = `https://gaurangers.com/book/${work}`;
    if (id === "share") {
      if (typeof navigator !== "undefined" && navigator.share) navigator.share({ title: bookFullTitle(b), url }).catch(() => {});
      else if (typeof navigator !== "undefined") navigator.clipboard?.writeText(url).catch(() => {});
      return;
    }
    if (id === "pdf") { setPdfHidden(false); void downloadBookPdf({ work: b.work, book: b, onStatus: flash, onProgress: setBookPct, onTitle: setBookPctTitle, cancelRef: pdfCancel, abortRef: pdfAbort }); return; }
    if (id === "qr") { setQr({ url, data: { kind: "book", bookTitle: bookFullTitle(b), tagline: b.tagline, cover: b.covers[0] } }); return; }
    if (id === "donate") { onDonate(); return; }
    if (id === "report") { setReportOpen(true); return; }
    if (id === "note") { requestNote({ kind: "book", ref: `book:${work}`, title: bookFullTitle(b), subtitle: b.tagline, href: `/book/${work}` }); return; }
    onOpenBook(work);
  };
  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100dvh", minHeight: 0 }}>
      <TopHeader onFavorites={onFavorites} onSearch={onSearch} onHome={() => { onChange("krishna"); window.dispatchEvent(new CustomEvent("tab-reset", { detail: "krishna" })); mainRef.current?.scrollTo({ top: 0, behavior: "smooth" }); }} />
      <main ref={mainRef} style={{ position: "relative", flex: 1, minHeight: 0, overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        <div style={{ padding: "16px 16px 116px" }}>
          {tab === "krishna" && <EntityPage id="krishna" embedded onBack={() => {}} onOpen={onOpenEntity} onNavigate={onOpenPath} onOpenCollection={onOpenCollection} />}
          {tab === "gauranga" && <AcharyaScreen realm="gauranga" onOpen={onOpenEntity} onOpenCollection={onOpenCollection} onOpenPath={onOpenPath} />}
          {tab === "iskcon" && <HomeScreen onChange={onChange} onOpenBook={onOpenBook} onOpenEntity={onOpenEntity} onDonate={onDonate} onBookMenu={bookMenu} flash={flash} onOpenPath={onOpenPath} />}
          {tab === "bogatstva" && <BogatstvaHall onOpenBook={onOpenBook} onBookMenu={bookMenu} onOpenEntity={onOpenEntity} onOpenCollection={onOpenCollection} onOpenPath={onOpenPath} flash={flash} onOpenArtist={onOpenKirtanArtist} onOpenBhajan={onOpenBhajan} onOpenCatalog={onOpenCatalog} />}
          {tab === "sadhana" && <SadhanaHall onOpenPath={onOpenPath} onOpenEntity={onOpenEntity} onDonate={onDonate} flash={flash} />}
          {tab === "books" && (
            <BooksHub
              onOpenBook={onOpenBook}
              onBookMenu={bookMenu}
              onOpenEntity={onOpenEntity}
              onOpenCollection={onOpenCollection}
              onOpenPath={onOpenPath}
              flash={flash}
            />
          )}
          {tab === "home" && <HomeScreen onChange={onChange} onOpenBook={onOpenBook} onOpenEntity={onOpenEntity} onDonate={onDonate} onBookMenu={bookMenu} flash={flash} onOpenPath={onOpenPath} />}
          {tab === "kirtans" && (
            <KirtansScreen onOpenArtist={onOpenKirtanArtist} onOpenBhajan={onOpenBhajan} onOpenCatalog={onOpenCatalog} />
          )}
          {tab === "feed" && <FeedScreen onOpen={onOpenContent} />}
          {tab === "acharya" && <AcharyaScreen onOpen={onOpenEntity} onOpenCollection={onOpenCollection} />}
          {tab === "dhama" && <DhamaScreen onOpen={(id) => onOpenPath("/dhama/" + id)} onOpenTirtha={(d, t) => onOpenPath("/dhama/" + d + "/" + t)} />}
          {tab === "account" && <AccountScreen onOpenPath={onOpenPath} onDonate={onDonate} flash={flash} />}
        </div>
      </main>
      <TabBar active={tab} onChange={onChange} scrollRef={mainRef} />
      {qr && <QrSheet url={qr.url} data={qr.data} onClose={() => setQr(null)} />}
      <ReportSheet open={reportOpen} onClose={() => setReportOpen(false)} context={`Главная · ${bookFullTitle(BOOKS.bg)}`} />
      {toast && <div style={{ position: "fixed", left: "50%", bottom: 96, transform: "translateX(-50%)", zIndex: 1100, background: "rgba(28,28,30,0.96)", color: "#fff", padding: "13px 18px", borderRadius: 14, fontSize: 13.5, lineHeight: 1.5, fontFamily: "var(--font-text)", boxShadow: "0 12px 40px rgba(0,0,0,0.3)", width: "calc(100% - 40px)", maxWidth: 380, textAlign: "center" }}>{toast}</div>}
      {bookPct > 0 && !pdfHidden && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.45)" }}>
          <div style={{ position: "relative", width: 300, maxWidth: "calc(100% - 48px)", background: "#fff", borderRadius: 20, padding: "26px 22px 20px", boxShadow: "0 20px 60px rgba(0,0,0,0.35)", fontFamily: "var(--font-text)", textAlign: "center" }}>
            <button type="button" aria-label="Отменить загрузку" onClick={cancelPdf} style={{ position: "absolute", top: 12, right: 12, width: 28, height: 28, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.06)", color: "#6e6e73", cursor: "pointer", display: "grid", placeItems: "center", fontSize: 18, lineHeight: 1, WebkitTapHighlightColor: "transparent" }}>×</button>
            <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3, letterSpacing: "-0.01em", color: "#1d1d1f", padding: "0 8px", textWrap: "balance" }}>{bookPctTitle}</div>
            <div style={{ fontSize: 12.5, color: "#8e8e93", marginTop: 5 }}>Это может занять 1–2 минуты</div>
            <div style={{ marginTop: 16, height: 8, borderRadius: 999, background: "#ececed", overflow: "hidden" }}>
              <div style={{ width: `${bookPct}%`, height: "100%", background: "#D2AA1B", borderRadius: 999, transition: "width 0.4s ease" }} />
            </div>
            <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: "#9c7c15" }}>{bookPct}%</div>
            <button type="button" onClick={() => setPdfHidden(true)} style={{ marginTop: 14, width: "100%", padding: "10px 0", borderRadius: 12, border: "none", background: "#f2f2f7", color: "#1d1d1f", fontFamily: "var(--font-text)", fontSize: 14, fontWeight: 600, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>Свернуть</button>
          </div>
        </div>
      )}
      {bookPct > 0 && pdfHidden && (
        <button type="button" onClick={() => setPdfHidden(false)} style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: "calc(84px + env(safe-area-inset-bottom))", zIndex: 1200, display: "flex", alignItems: "center", gap: 9, padding: "9px 14px", borderRadius: 999, border: "none", background: "#1d1d1f", color: "#fff", fontFamily: "var(--font-text)", fontSize: 13, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.3)", cursor: "pointer", maxWidth: "86vw", WebkitTapHighlightColor: "transparent" }}>
          <span aria-hidden style={{ width: 8, height: 8, borderRadius: "50%", background: "#D2AA1B", flexShrink: 0 }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bookPctTitle} · {bookPct}%</span>
        </button>
      )}
    </div>
  );
}

export default function App() {
  if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("pdf")) {
    return <PdfDoc />;
  }
  const [tab, setTab] = useState("krishna");
  const [openBook, setOpenBook] = useState<string | null>(null);
  const [bookTarget, setBookTarget] = useState<{ div: string | null; chapter: string | null; verse: string | null } | null>(null);
  const [openBhajan, setOpenBhajan] = useState<string | null>(null);
  const [openKirtanArtist, setOpenKirtanArtist] = useState<string | null>(null);
  const [openFavorites, setOpenFavorites] = useState(false);
  const [openSearch, setOpenSearch] = useState(false);
  const [openNotes, setOpenNotes] = useState(false);
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const [notesInitial, setNotesInitial] = useState<{ attach?: NoteAttach; openId?: string; nonce: number } | null>(null);
  const [openCatalog, setOpenCatalog] = useState(false);
  const [openContent, setOpenContent] = useState<string | null>(null);
  const [openAdmin, setOpenAdmin] = useState(false);
  const [openEntity, setOpenEntity] = useState<string | null>(null);
  const [openCollection, setOpenCollection] = useState<string | null>(null);
  const [donate, setDonate] = useState(false);
  const [openCart, setOpenCart] = useState(false);
  const [openJapa, setOpenJapa] = useState(false);
  const [openDiary, setOpenDiary] = useState(false);
  const [openVow, setOpenVow] = useState(false);
  const [openDarshan, setOpenDarshan] = useState(false);
  const [openDailyVerse, setOpenDailyVerse] = useState(false);
  const [openProgress, setOpenProgress] = useState(false);
  const [openCenter, setOpenCenter] = useState<string | null>(null);
  const [openMyCenters, setOpenMyCenters] = useState(false);
  const [openCenters, setOpenCenters] = useState(false);
  const [openCenterNew, setOpenCenterNew] = useState(false);
  const [openCenterEdit, setOpenCenterEdit] = useState<string | null>(null);
  const [openCenterSchedule, setOpenCenterSchedule] = useState<string | null>(null);
  const [openCenterDeities, setOpenCenterDeities] = useState<string | null>(null);
  const [openCenterEvents, setOpenCenterEvents] = useState<string | null>(null);
  const [openCenterPhotos, setOpenCenterPhotos] = useState<string | null>(null);
  const [openModeration, setOpenModeration] = useState(false);
  const [appToast, setAppToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = (m: string) => {
    setAppToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setAppToast(null), 2400);
  };
  const [prasadamSection, setPrasadamSection] = useState<"recipes" | "match" | "deities" | "offering" | null>(null);
  const [prasadamRecipe, setPrasadamRecipe] = useState<string | null>(null);
  const [openCookbook, setOpenCookbook] = useState(false);
  const [cookbookChapter, setCookbookChapter] = useState<string | null>(null);
  const [openDhama, setOpenDhama] = useState<string | null>(null);
  const [openTirtha, setOpenTirtha] = useState<{ dhama: string; id: string } | null>(null);
  const fromPop = useRef(false);
  // Текущий открытый код книги — для делегирования внутрикнижного popstate (замыкание onPop иначе видит устаревшее значение).
  const openBookRef = useRef<string | null>(null);
  openBookRef.current = openBook;
  // Глобальное нижнее меню поверх страниц-оверлеев со скроллом: стабильный ref-заглушка
  // (компакт-режим по скроллу не нужен — пилюля всегда полного размера).
  const overlayScrollRef = useRef<HTMLElement | null>(null);

  // ── URL ↔ состояние (ссылки шарятся; SPA-fallback в воркере включён) ──
  // slug = путь напрямую: /ru/krishna, /dasa/…, /batumi (контент или бхаджан —
  // различаем резолвером при холодном входе). Структурные: /bhajans каталог,
  // /book/{id}/{div?}/{ch?}/{v?}, /, /feed, /search, /map, /passport.
  const RESERVED = ["", "books", "kirtans", "kirtan", "acharya", "dhama", "account", "feed", "search", "map", "passport", "bhajans", "book", "read", "admin", "entity", "person", "favorites", "notes", "note", "cart", "practice", "prasadam", "center", "centers", "my"];
  function pathFromState(): string {
    if (openCart) return "/cart";
    if (openJapa) return "/practice/japa";
    if (openDiary) return "/practice/diary";
    if (openVow) return "/practice/vow";
    if (openDarshan) return "/practice/darshan";
    if (openDailyVerse) return "/practice/verse";
    if (openProgress) return "/practice/progress";
    if (openCenterNew) return "/my/centers/new";
    if (openModeration) return "/centers/review";
    if (openCenterSchedule) return `/center/${openCenterSchedule}/schedule`;
    if (openCenterDeities) return `/center/${openCenterDeities}/deities`;
    if (openCenterEvents) return `/center/${openCenterEvents}/events`;
    if (openCenterPhotos) return `/center/${openCenterPhotos}/photos`;
    if (openCenterEdit) return `/center/${openCenterEdit}/edit`;
    if (openCenters) return "/centers";
    if (openMyCenters) return "/my/centers";
    if (openCenter) return `/center/${openCenter}`;
    if (prasadamRecipe) return "/prasadam/recipe/" + prasadamRecipe;
    if (cookbookChapter) return "/prasadam/book/" + cookbookChapter;
    if (openCookbook) return "/prasadam/book";
    if (prasadamSection) return prasadamSection === "offering" ? "/prasadam/offering" : "/prasadam";
    if (openAdmin) return "/admin";
    if (openBook) { const base = `/book/${openBook}`; return (typeof window !== "undefined" && window.location.pathname.startsWith(base)) ? window.location.pathname : base; }
    if (openBhajan) return openBhajan;     // slug сам по себе путь
    if (openKirtanArtist) return "/kirtan/" + openKirtanArtist;
    if (openFavorites) return "/favorites";
    if (openNoteId) return "/note/" + openNoteId;
    if (openNotes) return "/notes";
    if (openCatalog) return "/bhajans";
    if (openContent) return openContent;   // slug сам по себе путь
    if (openEntity) return "/person/" + openEntity;
    if (openCollection) return "/acharya/" + openCollection;
    if (openTirtha) return "/dhama/" + openTirtha.dhama + "/" + openTirtha.id;
    if (openDhama) return "/dhama/" + openDhama;
    // Кришна-ПКЛ держит подтаб прямо в пути (/krishna/<таб>/<подтаб>) — не сбрасываем его при ре-синхронизации.
    if (tab === "krishna") return (typeof window !== "undefined" && window.location.pathname.startsWith("/krishna")) ? window.location.pathname : "/krishna";
    return tab === "home" ? "/" : "/" + tab;
  }
  function resolveAndOpen(slug: string) {
    fetch(api(`/content/resolve?slug=${encodeURIComponent(slug)}`))
      .then((r) => r.json())
      .then((d) => {
        fromPop.current = true;
        if (d?.kind === "bhajan") setOpenBhajan(slug);
        else setOpenContent(slug); // content или неизвестно → пробуем как контент
      })
      .catch(() => { fromPop.current = true; setOpenContent(slug); });
  }
  function applyPath(path: string) {
    fromPop.current = true;
    const clean = (path || "/").replace(/\/+$/, "") || "/";
    if (clean === "/donate") { setDonate(true); return; }   // оверлей доната — подложку не трогаем
    setDonate(false);
    setOpenBook(null); setBookTarget(null); setOpenBhajan(null); setOpenKirtanArtist(null); setOpenCatalog(false); setOpenContent(null); setOpenAdmin(false); setOpenEntity(null); setOpenCollection(null); setOpenFavorites(false); setOpenSearch(false); setOpenNotes(false); setOpenNoteId(null); setOpenCart(false); setOpenJapa(false); setOpenDiary(false); setOpenVow(false); setOpenDarshan(false); setOpenDailyVerse(false); setOpenProgress(false); setPrasadamSection(null); setPrasadamRecipe(null); setOpenCookbook(false); setCookbookChapter(null); setOpenCenter(null); setOpenMyCenters(false); setOpenCenters(false); setOpenCenterNew(false); setOpenCenterEdit(null); setOpenCenterSchedule(null); setOpenCenterDeities(null); setOpenCenterEvents(null); setOpenCenterPhotos(null); setOpenModeration(false); setOpenDhama(null); setOpenTirtha(null);
    const seg0 = clean.split("/")[1] ?? "";
    if (clean === "/") { setTab("krishna"); return; }
    if (["krishna", "gauranga", "iskcon", "bogatstva", "sadhana", "books", "kirtans", "acharya", "dhama", "account", "feed"].includes(seg0) && clean === "/" + seg0) { setTab(seg0); return; }
    // Кришна-ПКЛ: /krishna и /krishna/<таб>/<подтаб> — EntityPage прочитает таб/подтаб из пути.
    if (seg0 === "krishna") { setTab("krishna"); return; }
    if (seg0 === "dhama") {
      const parts = clean.split("/");               // ["", "dhama", <id>, <tirthaId>?]
      const did = parts[2];
      if (did && getDhama(did)) {
        setTab("dhama");
        if (parts[3]) setOpenTirtha({ dhama: did, id: parts[3] });
        else setOpenDhama(did);
      } else { setTab("dhama"); }
      return;
    }
    if (clean === "/bhajans") { setTab("home"); setOpenCatalog(true); return; }
    if (clean === "/favorites") { setOpenFavorites(true); return; }
    if (clean === "/search") { setOpenSearch(true); return; }
    if (clean === "/calendar" || seg0 === "calendar") {
      // Календарь живёт подтабом «Главной» (ISKCON). Город уже положен в localStorage
      // (cal-loc) вызывающим — свежий HomeCalendar прочитает его при монтировании.
      // Подтаб выбираем тремя каналами: синглтон homeNav (надёжно, синхронно),
      // sessionStorage (дубль) и событие home-open (если HomeScreen уже смонтирован).
      setTab("home");
      requestHomeTab("calendar");
      try { sessionStorage.setItem("home-tab", "calendar"); } catch { /* noop */ }
      try { window.dispatchEvent(new CustomEvent("home-open", { detail: { tab: "calendar" } })); } catch { /* noop */ }
      return;
    }
    if (clean === "/notes") { setOpenNotes(true); return; }
    if (seg0 === "note") { const nid = clean.split("/")[2]; if (nid) { setOpenNoteId(nid); return; } }
    if (clean === "/cart") { setOpenCart(true); return; }
    if (clean === "/practice/japa") { setOpenJapa(true); return; }
    if (clean === "/practice/diary") { setOpenDiary(true); return; }
    if (clean === "/practice/vow") { setOpenVow(true); return; }
    if (clean === "/practice/darshan") { setOpenDarshan(true); return; }
    if (clean === "/practice/verse") { setOpenDailyVerse(true); return; }
    if (clean === "/practice/progress") { setOpenProgress(true); return; }
    if (clean === "/centers/review") { setOpenModeration(true); return; }
    if (clean === "/my/centers/new") { setOpenCenterNew(true); return; }
    if (clean === "/my/centers") { setOpenMyCenters(true); return; }
    if (clean === "/centers") { setOpenCenters(true); return; }
    if (seg0 === "prasadam") {
      const parts = clean.split("/");   // ["", "prasadam", ("recipe"|"offering"|"book")?, <slug|chapter>?]
      if (parts[2] === "recipe" && parts[3]) { setPrasadamRecipe(parts[3]); return; }
      if (parts[2] === "book") { if (parts[3]) setCookbookChapter(parts[3]); else setOpenCookbook(true); return; }
      setPrasadamSection(parts[2] === "offering" ? "offering" : "recipes");
      return;
    }
    if (seg0 === "book") {
      const parts = clean.split("/");           // ["", "book", <work>, a?, b?, c?]
      const work = parts[2] || "bg";
      const bk = BOOKS[work] ? work : "bg";
      if (BOOKS[bk]?.hierarchical) {
        // /book/<work>/<lila|canto>/<chapter>/<verse?>
        setBookTarget(parts[3] ? { div: parts[3], chapter: parts[4] ?? null, verse: parts[5] ?? null } : null);
      } else {
        // /book/<work>/<chapter>/<verse?>
        setBookTarget(parts[3] ? { div: null, chapter: parts[3], verse: parts[4] ?? null } : null);
      }
      setOpenBook(bk);
      return;
    }
    if (seg0 === "admin") { setOpenAdmin(true); return; }
    if (seg0 === "center") {
      const parts = clean.split("/");        // ["", "center", <slug>, "edit"?]
      const cslug = parts[2] ?? "";
      if (!cslug) { setTab("home"); return; }
      if (parts[3] === "edit") setOpenCenterEdit(cslug);
      else if (parts[3] === "schedule") setOpenCenterSchedule(cslug);
      else if (parts[3] === "deities") setOpenCenterDeities(cslug);
      else if (parts[3] === "events") setOpenCenterEvents(cslug);
      else if (parts[3] === "photos") setOpenCenterPhotos(cslug);
      else setOpenCenter(cslug);
      return;
    }
    if (seg0 === "read") {
      // /read устарел — открываем то же место в загруженной книге /book/
      const [, , work, a, b, c] = clean.split("/");
      if (work) {
        const bk = BOOKS[work] ? work : "bg";
        if (BOOKS[bk]?.hierarchical) setBookTarget(a ? { div: a, chapter: b ?? null, verse: c ?? null } : null);
        else setBookTarget(a ? { div: null, chapter: a, verse: b ?? null } : null);
        setOpenBook(bk);
      }
      return;
    }
    if (seg0 === "person" || seg0 === "entity") { const eid = clean.split("/")[2] ?? ""; if (eid) setOpenEntity(eid); return; }
    if (seg0 === "bhajan") { const bslug = clean.split("/")[2] ?? ""; if (bslug) setOpenBhajan(bslug); else { setTab("home"); setOpenCatalog(true); } return; }
    if (seg0 === "place" || seg0 === "doc" || seg0 === "restaurant") {
      const pid = clean.split("/")[2] ?? "";
      const sub: HomeTabId = seg0 === "doc" ? "documents" : seg0 === "restaurant" ? "restaurants" : "centres";
      setTab("home");
      requestHomeTab(sub);
      try {
        sessionStorage.setItem("home-tab", sub);
        if (pid) sessionStorage.setItem(seg0 === "doc" ? "open-doc" : "open-place", pid);
      } catch { /* noop */ }
      // Сигнал смонтированному HomeScreen переключить подтаб (sessionStorage уже
      // прочитан при инициализации, поэтому одного его мало). Дочерние эффекты
      // регистрируют слушатель раньше, чем сработает этот applyPath из App.
      try { window.dispatchEvent(new CustomEvent("home-open", { detail: { tab: sub, id: pid } })); } catch { /* noop */ }
      return;
    }
    if (seg0 === "kirtan") { const s = clean.split("/")[2] ?? ""; if (s) setOpenKirtanArtist(s); else setTab("kirtans"); return; }
    if (seg0 === "acharya") { const ck = clean.split("/")[2] ?? ""; setTab("acharya"); if (ck) setOpenCollection(ck); return; }
    if (seg0 === "dasa") { setOpenContent(clean); return; }            // только статьи под /dasa
    if (!RESERVED.includes(seg0)) { resolveAndOpen(clean); return; }    // /ru/… или /batumi → резолвер
    setTab("home");
  }

  // инициализация из URL + кнопки назад/вперёд (единственный popstate на приложение)
  useEffect(() => {
    navInit();
    const onPop = (e: PopStateEvent) => {
      navSetIdxFromState(e.state);
      const path = window.location.pathname;
      // Внутрикнижная навигация (глава/стих) — за неё отвечает BookDetailPage.
      // Глобальный роутер её НЕ трогает, иначе двойная обработка одного popstate.
      const ob = openBookRef.current;
      if (ob && (path === `/book/${ob}` || path.startsWith(`/book/${ob}/`))) return;
      fromPop.current = true;
      applyPath(path);
    };
    window.addEventListener("popstate", onPop);
    applyPath(window.location.pathname);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Гость попытался сохранить закладку из ридера → ведём в кабинет (вход).
  useEffect(() => {
    const onAuthReq = () => navigate("/account");
    window.addEventListener(AUTH_REQUIRED_EVENT, onAuthReq);
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, onAuthReq);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Открытие счётчика джапы из хаба «Садхана» (вложен глубоко в HomeScreen) —
  // через событие, чтобы не пробрасывать navigate сквозь дерево. Идём через
  // navigate → корректный URL /practice/japa, история и кнопка «назад».
  useEffect(() => {
    const onJapa = () => navigate("/practice/japa");
    window.addEventListener("iol:open-japa", onJapa);
    return () => window.removeEventListener("iol:open-japa", onJapa);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Открытие дневника садханы из хаба «Садхана» — через событие (как джапа):
  // navigate → /practice/diary, корректная история и кнопка «назад».
  useEffect(() => {
    const onDiary = () => navigate("/practice/diary");
    window.addEventListener("iol:open-diary", onDiary);
    return () => window.removeEventListener("iol:open-diary", onDiary);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Открытие даршана дня из хаба «Садхана» — через событие.
  useEffect(() => {
    const onDarshan = () => navigate("/practice/darshan");
    window.addEventListener("iol:open-darshan", onDarshan);
    return () => window.removeEventListener("iol:open-darshan", onDarshan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Открытие «Стиха дня» (системное чтение) из хаба «Садхана».
  useEffect(() => {
    const onDaily = () => navigate("/practice/verse");
    window.addEventListener("iol:open-daily-verse", onDaily);
    return () => window.removeEventListener("iol:open-daily-verse", onDaily);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Открытие «Моего прогресса» (дашборд чтения) из хаба «Садхана».
  useEffect(() => {
    const onProg = () => navigate("/practice/progress");
    window.addEventListener("iol:open-progress", onProg);
    return () => window.removeEventListener("iol:open-progress", onProg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Быстрый захват заметки из любого меню (⋯ / плеер / стих / избранное).
  useEffect(() => {
    const onOpenNotes = () => {
      const p = takePendingNotes();
      if (p?.openId) { navigate("/note/" + p.openId); return; }
      if (p?.create) { const n = createNote(p.attach); navigate("/note/" + n.id); return; }
      setNotesInitial(p); navigate("/notes");
    };
    window.addEventListener(OPEN_NOTES_EVENT, onOpenNotes);
    return () => window.removeEventListener(OPEN_NOTES_EVENT, onOpenNotes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // состояние → URL (push нового уровня), кроме случаев применения из popstate
  useEffect(() => {
    if (fromPop.current) { fromPop.current = false; return; }
    const next = pathFromState();
    if (window.location.pathname !== next) pushUrl(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, openBook, openBhajan, openKirtanArtist, openCatalog, openContent, openAdmin, openEntity, openCollection, openFavorites, openNotes, openNoteId, openCart, openJapa, openDiary, openVow, openDarshan, openDailyVerse, openProgress, prasadamSection, prasadamRecipe, openCookbook, cookbookChapter, openCenter, openMyCenters, openCenters, openCenterNew, openCenterEdit, openCenterSchedule, openCenterDeities, openCenterEvents, openCenterPhotos, openModeration, openDhama, openTirtha]);

  // «Назад»: единый стек. Если под нами есть запись приложения — pop; иначе (прямой
  // вход/QR на корневой записи) уходим к логическому родителю (главная), НЕ покидая сайт.
  function goBack() {
    if (canGoBack()) { window.history.back(); return; }
    fromPop.current = true;
    replaceUrl("/");
    applyPath("/");
  }

  // Переход по in-app пути (строки «Избранного» и пр.): пушим уровень и применяем тот же роутер.
  function navigate(href: string) {
    if (typeof window !== "undefined" && window.location.pathname !== href) pushUrl(href);
    applyPath(href);
  }

  // Донат — собственный адрес /donate (оверлей поверх текущего экрана; ссылку можно переслать).
  function openDonate() {
    if (typeof window !== "undefined" && window.location.pathname !== "/donate") pushUrl("/donate");
    setDonate(true);
  }
  function closeDonate() {
    setDonate(false);
    if (typeof window === "undefined" || window.location.pathname !== "/donate") return;
    if (canGoBack()) { window.history.back(); return; }   // снять запись /donate, вернуться откуда пришли
    replaceUrl("/"); fromPop.current = true; applyPath("/"); // прямой вход на /donate → на главную
  }

  // ссылка-цитата → действие. Адреса: book:{id} | chap:{id}:{div}:{ch} | verse:{id}:{div}:{ch}:{v}
  function openRef(href: string) {
    const [kind, work, div, ch, v] = href.split(":");
    if (!work) return;
    // Любое место писания открывается в загруженной книге /book/ (стаб /read удалён).
    if (kind === "book") { navigate(`/book/${BOOKS[work] ? work : "bg"}`); return; }
    if (work === "bg") { navigate("/book/bg"); return; }
    const seg = kind === "verse" ? `/${div ?? ""}/${ch ?? ""}/${v ?? ""}` : kind === "chap" ? `/${div ?? ""}/${ch ?? ""}` : "";
    navigate(`/book/${work}${seg}`.replace(/\/+$/, ""));
  }
  // Открыть конкретный стих по его id («Стих дня» → читалка): БГ — книга, ШБ/ЧЧ — референс-ридер.
  function openVerseId(id: string) {
    const p = id.split(".");                 // bg.2.13 | bg.13.1-2 | sb.1.9.40 | cc.adi.1.19
    const work = p[0];
    if (!work) return;
    if (work === "bg") navigate(`/book/bg/${p[1] ?? ""}/${p[2] ?? ""}`.replace(/\/+$/, ""));
    else navigate(`/book/${work}/${p[1] ?? ""}/${p[2] ?? ""}/${p[3] ?? ""}`.replace(/\/+$/, ""));
  }
  // Открытие связанной сущности: книги-читалки уходят в ридер, остальное — в EntityPage.
  function openEntityTarget(id: string, type: string | null) {
    setOpenCollection(null);
    if (type === "scripture" && BOOKS[id]) { setOpenEntity(null); openRef("book:" + id); return; }
    setOpenEntity(id);
  }
  const tabBarVisible = !openAdmin && !openBook && !openBhajan && !openKirtanArtist && !openCatalog && !openContent && !openEntity && !openCollection && !openFavorites && !openSearch && !openNotes && !openNoteId && !openCart && !openJapa && !openDiary && !openVow && !openDarshan && !openDailyVerse && !openProgress && !prasadamSection && !prasadamRecipe && !openCookbook && !cookbookChapter && !openCenter && !openMyCenters && !openCenters && !openCenterNew && !openCenterEdit && !openCenterSchedule && !openCenterDeities && !openCenterEvents && !openCenterPhotos && !openModeration && !openDhama && !openTirtha;
  // Главное нижнее меню остаётся поверх страниц-оверлеев со скроллом (книга, ПКЛ,
  // контент, каталоги) — чтобы из любой главы/карточки можно было перейти в раздел.
  // Читалки (fixed, z70) и модалки перекрывают пилюлю (z40) сами → конфликта нет.
  const overlayTabBar = !donate && (!!openBook || !!openBhajan || !!openCatalog || !!openCollection || !!openEntity || !!openContent);
  return (
    <AuthProvider>
    <PlayerProvider>
    <div style={{ display: "flex", justifyContent: "center", minHeight: "100vh", width: "100%", background: "var(--color-bg)", color: "var(--color-label)" }}>
      <div className={overlayTabBar ? "has-overlay-tabbar" : undefined} style={{ position: "relative", display: "flex", flexDirection: "column", width: "100%", maxWidth: 480, minHeight: "100dvh", background: "var(--color-bg)" }}>
        <CardActionsProvider onDonate={openDonate}>
        {openAdmin ? (
          <main style={{ position: "relative", height: "100dvh", overflow: "hidden" }}>
            <BookLoaderPage onBack={goBack} />
          </main>
        ) : openBook ? (
          <main style={{ position: "relative", height: "100dvh", overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
            <BookDetailPage key={openBook} book={BOOKS[openBook] ?? BOOKS.bg} onBack={goBack} onDonate={openDonate} onOpenCart={() => navigate("/cart")} initialTarget={bookTarget} />
          </main>
        ) : openBhajan ? (
          <main style={{ position: "relative", height: "100dvh", overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
            <BhajanDetailPage slug={openBhajan} onBack={goBack} />
          </main>
        ) : openKirtanArtist ? (
          <main key={openKirtanArtist} style={{ position: "relative", height: "100dvh", overflow: "hidden" }}>
            <KirtanArtistPage slug={openKirtanArtist} onBack={goBack} />
          </main>
        ) : openCatalog ? (
          <main style={{ position: "relative", height: "100dvh", overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
            <BhajanCatalog onOpen={(slug) => { setOpenCatalog(false); setOpenBhajan(slug); }} onBack={goBack} />
          </main>
        ) : openCollection ? (
          <main key={openCollection} style={{ position: "relative", height: "100dvh", overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
            <AcharyaScreen collection={openCollection} onBack={goBack} onOpen={openEntityTarget} />
          </main>
        ) : openEntity ? (
          <main key={openEntity} style={{ position: "relative", height: "100dvh", overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
            <EntityPage id={openEntity} onBack={goBack} onOpen={openEntityTarget} onNavigate={navigate} onOpenCollection={setOpenCollection} />
          </main>
        ) : openTirtha && getDhama(openTirtha.dhama) ? (
          <main key={openTirtha.dhama + "/" + openTirtha.id} style={{ position: "relative", height: "100dvh", overflow: "hidden" }}>
            <TirthaDetailPage dhama={getDhama(openTirtha.dhama)!} tirthaId={openTirtha.id} onBack={goBack} onOpenEntity={openEntityTarget} />
          </main>
        ) : openDhama && getDhama(openDhama) ? (
          <main key={openDhama} style={{ position: "relative", height: "100dvh", overflow: "hidden" }}>
            <DhamaDetailPage dhama={getDhama(openDhama)!} onBack={goBack} onOpenTirtha={(tid) => setOpenTirtha({ dhama: openDhama!, id: tid })} />
          </main>
        ) : openContent ? (
          <main style={{ position: "relative", height: "100dvh", overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
            <ContentDetailPage
              slug={openContent}
              onBack={goBack}
              onOpenContent={(s) => setOpenContent(s)}
              onOpenBook={(workId) => openRef(`book:${workId}`)}
              onOpenRef={(href) => openRef(href)}
            />
          </main>
        ) : openJapa ? (
          <main style={{ position: "relative", height: "100dvh", overflow: "hidden" }}>
            <JapaScreen onBack={goBack} />
          </main>
        ) : openDiary ? (
          <main style={{ position: "relative", height: "100dvh", overflow: "hidden" }}>
            <SadhanaScreen onBack={goBack} onOpenPath={navigate} />
          </main>
        ) : openVow ? (
          <main style={{ position: "relative", height: "100dvh", overflow: "hidden" }}>
            <VowScreen onBack={goBack} />
          </main>
        ) : openDarshan ? (
          <main style={{ position: "relative", height: "100dvh", overflow: "hidden" }}>
            <DarshanScreen onBack={goBack} />
          </main>
        ) : openDailyVerse ? (
          <main style={{ position: "relative", height: "100dvh", overflow: "hidden" }}>
            <DailyVerseScreen onBack={goBack} onOpenVerse={openVerseId} />
          </main>
        ) : openProgress ? (
          <main style={{ position: "relative", height: "100dvh", overflow: "hidden" }}>
            <MyProgressScreen onBack={goBack} onOpen={navigate} />
          </main>
        ) : openSearch ? (
          <main style={{ position: "relative", height: "100dvh", overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
            <SearchScreen onBack={goBack} onOpenEntity={openEntityTarget} onOpenBook={(work) => { setBookTarget(null); setOpenBook(work); }} onNavigate={navigate} />
          </main>
        ) : openCart ? (
          <main style={{ position: "relative", height: "100dvh", overflow: "hidden" }}>
            <CartScreen onClose={goBack} />
          </main>
        ) : openFavorites ? (
          <main style={{ position: "relative", height: "100dvh", overflow: "hidden" }}>
            <FavoritesScreen onBack={goBack} onNavigate={navigate} />
          </main>
        ) : prasadamRecipe ? (
          <main style={{ position: "relative", height: "100dvh", overflow: "hidden" }}>
            <RecipeDetail slug={prasadamRecipe} onBack={goBack} onOpenRecipe={(s) => navigate("/prasadam/recipe/" + s)} onOpenOffering={() => navigate("/prasadam/offering")} onOpenBookChapter={(id) => navigate("/prasadam/book/" + id)} />
          </main>
        ) : cookbookChapter ? (
          <main style={{ position: "relative", height: "100dvh", overflow: "hidden" }}>
            <CookbookScreen chapterId={cookbookChapter} onBack={goBack} onOpenChapter={(id) => navigate("/prasadam/book/" + id)} onOpenRecipe={(s) => navigate("/prasadam/recipe/" + s)} />
          </main>
        ) : openCookbook ? (
          <main style={{ position: "relative", height: "100dvh", overflow: "hidden" }}>
            <CookbookScreen chapterId={null} onBack={goBack} onOpenChapter={(id) => navigate("/prasadam/book/" + id)} onOpenRecipe={(s) => navigate("/prasadam/recipe/" + s)} />
          </main>
        ) : prasadamSection ? (
          <main style={{ position: "relative", height: "100dvh", overflow: "hidden" }}>
            <PrasadamScreen initialSection={prasadamSection} onBack={goBack} onOpenRecipe={(s) => navigate("/prasadam/recipe/" + s)} onSectionChange={(id) => replaceUrl(id === "offering" ? "/prasadam/offering" : "/prasadam")} onOpenBook={() => navigate("/prasadam/book")} />
          </main>
        ) : openNoteId ? (
          <main style={{ position: "relative", height: "100dvh", overflow: "hidden" }}>
            <NoteDetail id={openNoteId} onBack={goBack} onNavigate={navigate} />
          </main>
        ) : openNotes ? (
          <main style={{ position: "relative", height: "100dvh", overflow: "hidden" }}>
            <NotesScreen onBack={goBack} onNavigate={navigate} initial={notesInitial} />
          </main>
        ) : openCenterNew ? (
          <main style={{ position: "relative", height: "100dvh", overflow: "hidden" }}>
            <CenterEditor onBack={goBack} onOpenPath={navigate} flash={flash} />
          </main>
        ) : openCenterEdit ? (
          <main key={openCenterEdit} style={{ position: "relative", height: "100dvh", overflow: "hidden" }}>
            <CenterEditor slug={openCenterEdit} onBack={goBack} onOpenPath={navigate} flash={flash} />
          </main>
        ) : openCenterSchedule ? (
          <main key={openCenterSchedule} style={{ position: "relative", height: "100dvh", overflow: "hidden" }}>
            <CenterSchedule slug={openCenterSchedule} onBack={goBack} flash={flash} />
          </main>
        ) : openCenterDeities ? (
          <main key={openCenterDeities} style={{ position: "relative", height: "100dvh", overflow: "hidden" }}>
            <CenterDeities slug={openCenterDeities} onBack={goBack} flash={flash} />
          </main>
        ) : openCenterEvents ? (
          <main key={openCenterEvents} style={{ position: "relative", height: "100dvh", overflow: "hidden" }}>
            <CenterEvents slug={openCenterEvents} onBack={goBack} flash={flash} />
          </main>
        ) : openCenterPhotos ? (
          <main key={openCenterPhotos} style={{ position: "relative", height: "100dvh", overflow: "hidden" }}>
            <CenterPhotos slug={openCenterPhotos} onBack={goBack} flash={flash} />
          </main>
        ) : openCenters ? (
          <main style={{ position: "relative", height: "100dvh", overflow: "hidden" }}>
            <CentersScreen onBack={goBack} onOpenPath={navigate} />
          </main>
        ) : openModeration ? (
          <main style={{ position: "relative", height: "100dvh", overflow: "hidden" }}>
            <CenterModeration onBack={goBack} onOpenPath={navigate} flash={flash} />
          </main>
        ) : openMyCenters ? (
          <main style={{ position: "relative", height: "100dvh", overflow: "hidden" }}>
            <MyCentersScreen onBack={goBack} onOpenPath={navigate} flash={flash} />
          </main>
        ) : openCenter ? (
          <main key={openCenter} style={{ position: "relative", height: "100dvh", overflow: "hidden" }}>
            <CenterScreen slug={openCenter} onBack={goBack} onOpenPath={navigate} flash={flash} />
          </main>
        ) : (
          <Screen tab={tab} onChange={setTab} onOpenBook={(work) => { setBookTarget(null); setOpenBook(work); }} onOpenBhajan={setOpenBhajan} onOpenKirtanArtist={setOpenKirtanArtist} onOpenCatalog={() => setOpenCatalog(true)} onOpenContent={setOpenContent} onOpenEntity={openEntityTarget} onOpenCollection={setOpenCollection} onFavorites={() => setOpenFavorites(true)} onDonate={openDonate} onOpenPath={navigate} onSearch={() => navigate("/search")} />
        )}
        </CardActionsProvider>
        {overlayTabBar && <TabBar active={tab} onChange={(k) => navigate("/" + k)} scrollRef={overlayScrollRef} />}
        {donate && <DonateModal onClose={closeDonate} />}
        <MiniPlayer tabBarVisible={tabBarVisible || overlayTabBar} />
        <NowPlaying onOpenBook={(book, chapter) => { setBookTarget(chapter ? { div: null, chapter: String(chapter), verse: null } : null); setOpenBook(BOOKS[book] ? book : "bg"); }} onDonate={openDonate} />
        {appToast && (
          <div role="status" aria-live="polite" style={{ position: "fixed", left: "50%", bottom: "calc(94px + env(safe-area-inset-bottom,0px))", transform: "translateX(-50%)", zIndex: 4000, maxWidth: 360, padding: "11px 18px", borderRadius: 999, background: "color-mix(in srgb, var(--color-label) 92%, transparent)", color: "var(--color-bg)", fontFamily: "var(--font-text)", fontSize: 14, fontWeight: 600, lineHeight: 1.35, boxShadow: "var(--shadow-card)", pointerEvents: "none", textAlign: "center" }}>
            {appToast}
          </div>
        )}
      </div>
    </div>
    </PlayerProvider>
    </AuthProvider>
  );
}
