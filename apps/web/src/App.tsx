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
import { DonateModal } from "./DonateModal";
import { BOOKS, bookFullTitle } from "./books";
import BooksHub from "./BooksHub";
import { downloadBookPdf } from "./bookPdf";
import { QrSheet, type QrData } from "./QrSheet";
import { ReportSheet } from "./ReportSheet";
import { PdfDoc } from "./PdfDoc";
import { PlayerProvider } from "./player/store";
import { MiniPlayer } from "./player/MiniPlayer";
import { NowPlaying } from "./player/NowPlaying";
import BhajanDetailPage from "./BhajanDetailPage";
import KirtansScreen from "./KirtansScreen";
import KirtanArtistPage from "./KirtanArtistPage";
import ContentDetailPage from "./ContentDetailPage";
import EntityPage from "./EntityPage";
import AcharyaScreen from "./AcharyaScreen";
import ScriptureReader, { type ScriptureTarget } from "./ScriptureReader";
import BookLoaderPage from "./BookLoaderPage";
import { api } from "./api";

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

/* ═════════ TopHeader — bag / wordmark / heart ═════════ */
function TopHeader() {
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 30, height: 56, flexShrink: 0, background: "var(--color-bg)", borderBottom: "0.5px solid var(--color-hairline)" }}>
      <div style={{ display: "grid", height: "100%", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "0 12px" }}>
        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <button aria-label="Корзина" style={{ display: "grid", height: 40, width: 40, placeItems: "center", borderRadius: "50%", background: "none", border: "none", color: "var(--color-label)", cursor: "pointer" }}><BagIcon size={26} /></button>
        </div>
        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "0 8px" }}>
          <span aria-label="ISKCON ONE LOVE" role="img" style={{
            display: "block", width: 132, height: 132 * 73 / 1067, backgroundColor: "var(--color-label)",
            WebkitMaskImage: "url(/iskcon-one-love.svg)", maskImage: "url(/iskcon-one-love.svg)",
            WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskPosition: "center", maskPosition: "center",
          }} />
        </span>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
          <button aria-label="Избранное" style={{ display: "grid", height: 40, width: 40, placeItems: "center", borderRadius: "50%", background: "none", border: "none", color: "var(--color-label)", cursor: "pointer" }}><HeartIcon size={24} /></button>
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
  { id: "home", label: "Главная", src: "/iskcon.svg", wide: true },
  { id: "books", label: "Книги", src: "/bbt.svg", wide: false },
  { id: "kirtans", label: "Киртаны", src: "/gauranga.svg", wide: false },
  { id: "acharya", label: "Герои", src: "/prabhupada.svg", wide: false },
  { id: "dhama", label: "Дхама", src: "/vraj.svg", wide: false },
  { id: "account", label: "Личный кабинет", src: null, wide: false },
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
              aria-label={t.label} aria-current={on ? "page" : undefined} onClick={() => { if (on) scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" }); onChange(t.id); }}>
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
                  <span style={{ display: "block", fontSize: "var(--text-callout)", fontWeight: "var(--weight-semibold)", lineHeight: 1.3, color: "var(--color-label)", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{it.name}</span>
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

function Screen({ tab, onChange, onOpenBook, onOpenBhajan, onOpenKirtanArtist, onOpenCatalog, onOpenContent, onOpenEntity, onOpenCollection, onDonate }: { tab: string; onChange: (k: string) => void; onOpenBook: (work: string) => void; onOpenBhajan: (slug: string) => void; onOpenKirtanArtist: (slug: string) => void; onOpenCatalog: () => void; onOpenContent: (slug: string) => void; onOpenEntity: (id: string, type: string | null) => void; onOpenCollection: (key: string) => void; onDonate: () => void }) {
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
    onOpenBook(work);
  };
  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100dvh", minHeight: 0 }}>
      <TopHeader />
      <main ref={mainRef} style={{ position: "relative", flex: 1, minHeight: 0, overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        <div style={{ padding: "16px 16px 116px" }}>
          {tab === "books" && (
            <BooksHub
              onOpenBook={onOpenBook}
              onBookMenu={bookMenu}
              onOpenEntity={onOpenEntity}
              onOpenCollection={onOpenCollection}
              flash={flash}
            />
          )}
          {tab === "home" && <HomeScreen onChange={onChange} onOpenBook={onOpenBook} onOpenEntity={onOpenEntity} onDonate={onDonate} onBookMenu={bookMenu} flash={flash} />}
          {tab === "kirtans" && (
            <KirtansScreen onOpenArtist={onOpenKirtanArtist} onOpenBhajan={onOpenBhajan} onOpenCatalog={onOpenCatalog} />
          )}
          {tab === "feed" && <FeedScreen onOpen={onOpenContent} />}
          {tab === "acharya" && <AcharyaScreen onOpen={onOpenEntity} onOpenCollection={onOpenCollection} />}
          {tab === "dhama" && <ComingSoon src="/vraj.svg" title="Дхама" subtitle="Святые места и храмы Вриндавана. Раздел готовится." />}
          {tab === "account" && <ComingSoon title="Личный кабинет" subtitle="Профиль, закладки и пожертвования. Раздел готовится." />}
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
  const [tab, setTab] = useState("home");
  const [openBook, setOpenBook] = useState<string | null>(null);
  const [bookTarget, setBookTarget] = useState<{ div: string | null; chapter: string | null; verse: string | null } | null>(null);
  const [openBhajan, setOpenBhajan] = useState<string | null>(null);
  const [openKirtanArtist, setOpenKirtanArtist] = useState<string | null>(null);
  const [openCatalog, setOpenCatalog] = useState(false);
  const [openContent, setOpenContent] = useState<string | null>(null);
  const [scripture, setScripture] = useState<ScriptureTarget | null>(null);
  const [openAdmin, setOpenAdmin] = useState(false);
  const [openEntity, setOpenEntity] = useState<string | null>(null);
  const [openCollection, setOpenCollection] = useState<string | null>(null);
  const [donate, setDonate] = useState(false);
  const fromPop = useRef(false);

  // ── URL ↔ состояние (ссылки шарятся; SPA-fallback в воркере включён) ──
  // slug = путь напрямую: /ru/krishna, /dasa/…, /batumi (контент или бхаджан —
  // различаем резолвером при холодном входе). Структурные: /bhajans каталог,
  // /book/{id}, /read/{work}/{div?}/{ch?}/{v?}, /, /feed, /search, /map, /passport.
  const RESERVED = ["", "books", "kirtans", "kirtan", "acharya", "dhama", "account", "feed", "search", "map", "passport", "bhajans", "book", "read", "admin", "entity"];
  function pathFromState(): string {
    if (openAdmin) return "/admin";
    if (openBook) { const base = `/book/${openBook}`; return (typeof window !== "undefined" && window.location.pathname.startsWith(base)) ? window.location.pathname : base; }
    if (scripture) return ["/read", scripture.work, scripture.div, scripture.chapter, scripture.verse].filter((x) => x != null && x !== "").join("/");
    if (openBhajan) return openBhajan;     // slug сам по себе путь
    if (openKirtanArtist) return "/kirtan/" + openKirtanArtist;
    if (openCatalog) return "/bhajans";
    if (openContent) return openContent;   // slug сам по себе путь
    if (openEntity) return "/entity/" + openEntity;
    if (openCollection) return "/acharya/" + openCollection;
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
    setOpenBook(null); setBookTarget(null); setScripture(null); setOpenBhajan(null); setOpenKirtanArtist(null); setOpenCatalog(false); setOpenContent(null); setOpenAdmin(false); setOpenEntity(null); setOpenCollection(null);
    const seg0 = clean.split("/")[1] ?? "";
    if (clean === "/") { setTab("home"); return; }
    if (["books", "kirtans", "acharya", "dhama", "account", "feed"].includes(seg0) && clean === "/" + seg0) { setTab(seg0); return; }
    if (clean === "/bhajans") { setTab("home"); setOpenCatalog(true); return; }
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
    if (seg0 === "read") {
      const [, , work, div, ch, v] = clean.split("/");
      if (work) setScripture({ work, div: div ?? null, chapter: ch ?? null, verse: v ?? null });
      return;
    }
    if (seg0 === "entity") { const eid = clean.split("/")[2] ?? ""; if (eid) setOpenEntity(eid); return; }
    if (seg0 === "kirtan") { const s = clean.split("/")[2] ?? ""; if (s) setOpenKirtanArtist(s); else setTab("kirtans"); return; }
    if (seg0 === "acharya") { const ck = clean.split("/")[2] ?? ""; setTab("acharya"); if (ck) setOpenCollection(ck); return; }
    if (seg0 === "dasa") { setOpenContent(clean); return; }            // только статьи под /dasa
    if (!RESERVED.includes(seg0)) { resolveAndOpen(clean); return; }    // /ru/… или /batumi → резолвер
    setTab("home");
  }

  // инициализация из URL + кнопки назад/вперёд
  useEffect(() => {
    const onPop = () => { fromPop.current = true; applyPath(window.location.pathname); };
    window.addEventListener("popstate", onPop);
    applyPath(window.location.pathname);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // состояние → URL (pushState), кроме случаев применения из popstate
  useEffect(() => {
    if (fromPop.current) { fromPop.current = false; return; }
    const next = pathFromState();
    if (window.location.pathname !== next) window.history.pushState(null, "", next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, openBook, scripture, openBhajan, openKirtanArtist, openCatalog, openContent, openAdmin, openEntity, openCollection]);

  // «Назад»: настоящая история, но не выходим за пределы приложения при прямом входе
  const enteredAt = useRef(typeof window !== "undefined" ? window.history.length : 0);
  function goBack() {
    if (typeof window !== "undefined" && window.history.length > enteredAt.current) { window.history.back(); }
    else { window.history.pushState(null, "", "/"); applyPath("/"); }
  }

  // Донат — собственный адрес /donate (оверлей поверх текущего экрана; ссылку можно переслать).
  function openDonate() {
    if (typeof window !== "undefined" && window.location.pathname !== "/donate") window.history.pushState(null, "", "/donate");
    setDonate(true);
  }
  function closeDonate() {
    setDonate(false);
    if (typeof window === "undefined" || window.location.pathname !== "/donate") return;
    if (window.history.length > enteredAt.current) { window.history.back(); return; }  // вернуться откуда пришли
    window.history.replaceState(null, "", "/");                                         // прямой вход на /donate → на главную
  }

  // ссылка-цитата → действие. Адреса: book:{id} | chap:{id}:{div}:{ch} | verse:{id}:{div}:{ch}:{v}
  function openRef(href: string) {
    const [kind, work, div, ch, v] = href.split(":");
    if (!work) return;
    // Карточка книги (ВКП→ПКП): любая известная книга открывается в детальной странице.
    if (kind === "book" && BOOKS[work]) { setOpenContent(null); setScripture(null); setBookTarget(null); setOpenBook(work); return; }
    if (work === "bg") { setOpenContent(null); setScripture(null); setBookTarget(null); setOpenBook("bg"); return; }
    // ЧЧ/ШБ и прочие иерархические (глава/стих) — референс-ридер
    setOpenContent(null); setOpenBook(null);
    setScripture({
      work,
      div: kind === "book" ? null : (div ?? null),
      chapter: kind === "chap" || kind === "verse" ? (ch ?? null) : null,
      verse: kind === "verse" ? (v ?? null) : null,
    });
  }
  // Открытие связанной сущности: книги-читалки уходят в ридер, остальное — в EntityPage.
  function openEntityTarget(id: string, type: string | null) {
    setOpenCollection(null);
    if (type === "scripture" && BOOKS[id]) { setOpenEntity(null); openRef("book:" + id); return; }
    setOpenEntity(id);
  }
  const tabBarVisible = !openAdmin && !openBook && !scripture && !openBhajan && !openKirtanArtist && !openCatalog && !openContent && !openEntity && !openCollection;
  return (
    <PlayerProvider>
    <div style={{ display: "flex", justifyContent: "center", minHeight: "100vh", width: "100%", background: "var(--color-bg)", color: "var(--color-label)" }}>
      <div style={{ position: "relative", display: "flex", flexDirection: "column", width: "100%", maxWidth: 480, minHeight: "100dvh", background: "var(--color-bg)" }}>
        {openAdmin ? (
          <main style={{ position: "relative", height: "100dvh", overflow: "hidden" }}>
            <BookLoaderPage onBack={goBack} />
          </main>
        ) : openBook ? (
          <main style={{ position: "relative", height: "100dvh", overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
            <BookDetailPage book={BOOKS[openBook] ?? BOOKS.bg} onBack={goBack} onDonate={openDonate} initialTarget={bookTarget} />
          </main>
        ) : scripture ? (
          <main style={{ position: "relative", height: "100dvh", overflow: "hidden" }}>
            <ScriptureReader target={scripture} onBack={goBack} />
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
            <EntityPage id={openEntity} onBack={goBack} onOpen={openEntityTarget} />
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
        ) : (
          <Screen tab={tab} onChange={setTab} onOpenBook={(work) => { setBookTarget(null); setOpenBook(work); }} onOpenBhajan={setOpenBhajan} onOpenKirtanArtist={setOpenKirtanArtist} onOpenCatalog={() => setOpenCatalog(true)} onOpenContent={setOpenContent} onOpenEntity={openEntityTarget} onOpenCollection={setOpenCollection} onDonate={openDonate} />
        )}
        {donate && <DonateModal onClose={closeDonate} />}
        <MiniPlayer tabBarVisible={tabBarVisible} />
        <NowPlaying onOpenBook={(book, chapter) => { setBookTarget(chapter ? { chapter: String(chapter), verse: null } : null); setOpenBook(BOOKS[book] ? book : "bg"); }} onDonate={openDonate} />
      </div>
    </div>
    </PlayerProvider>
  );
}
