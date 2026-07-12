/**
 * gaurangers.com — оболочка приложения: TopHeader + TabBar + карточки (ЗКН-Н004).
 * Book card PRESENTS the book (no price/rating/compare/CTA): tap → detail page.
 * Cover: graphite background for now (real BBT artwork to be wired later).
 * Text strictly per Śrīla Prabhupāda. One type family throughout.
 */
import { useState, useRef, useEffect, useLayoutEffect, Suspense, type ReactNode } from "react";
import type { SVGProps, MouseEvent as ReactMouseEvent } from "react";
import {
  HomeScreen, EntityPage, AccountScreen, BooksHub, KirtansScreen, AcharyaScreen, PracticeHub, DhamaScreen,
  BookDetailPage, BhajanDetailPage, KirtanArtistPage, ContentDetailPage, SearchScreen, FavoritesScreen,
  NotesScreen, NoteDetail, BookLoaderPage, CartScreen, JapaScreen, SadhanaScreen, VowScreen, DarshanScreen,
  DownloaderScreen, StoriesToolScreen, DailyVerseScreen, EkadashiScreen, MyProgressScreen,
  CenterScreen, MyCentersScreen, CentersScreen, CenterEditor, CenterSchedule, CenterDeities, CenterEvents,
  CenterModeration, CenterPhotos, PrasadamScreen, RecipeDetail, CookbookScreen, DhamaDetailPage,
  TirthaDetailPage, PdfDoc, prefetchTopScreens,
} from "./lazyScreens";
import LichnostiHub from "./LichnostiHub";
import { ScreenFallback } from "./ScreenFallback";
import { requestHomeTab } from "./homeNav";
import type { HomeTabId } from "./HomeTabs";
import { DonateModal } from "./DonateModal";
import { BOOKS, bookFullTitle, bookSlug, bookWork } from "./books";
import { downloadBookPdf } from "./bookPdf";
import { QrSheet, type QrData } from "./QrSheet";
import { ReportSheet } from "./ReportSheet";
import { CardActionsProvider, useCardActions, useFavorite } from "./cardActions";
import { PlayerProvider, usePlayer, AUDIO_FALLBACK_COVER, AUDIO_FALLBACK_COVER_LIGHT } from "./player/store";
import { HeartIcon, HeadphonesIcon, MoreIcon } from "./ui/icons";
import { MiniPlayer } from "./player/MiniPlayer";
import { NowPlaying } from "./player/NowPlaying";
import { HomeCalendar } from "./HomeCalendar";
import { HomeFeed, FeedPostFocus } from "./HomeFeed";
import { DarshanRings } from "./DarshanStories";
import { OPEN_NOTES_EVENT, takePendingNotes, requestNote, createNote, type NoteAttach } from "./notes";
import { HubHeader } from "./ui/HubHeader";
import { AuthProvider } from "./account/store";
import { Onboarding } from "./Onboarding";
import { AUTH_REQUIRED_EVENT } from "./account/track";
import { navInit, navSetIdxFromState, pushUrl, replaceUrl, canGoBack, notifyNav, subscribeNav } from "./nav";
import { COVER_FALLBACK } from "./ui/CoverFallback";
import { HallTabs } from "./ui/nav4";
import { api } from "./api";
import { useCartCount } from "./shop/cart";
import { getDhama } from "./dhama/dhamas";
import { ROUTES, url, canonicalPath, ROOTS } from "./routes";
import { HUB_TOP } from "./ui/HubHeader";

/* ═════════ ICONS — иконки приложения ═════════ */
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
            display: "block", width: 132, height: 132 * 53 / 815, backgroundColor: "var(--color-label)",
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
  { id: "sadhana", label: "Садхана", src: "/prabhupada.svg", wide: false },
  { id: "krishna", label: "Кришна", src: "/vraj.svg", wide: false },
  { id: "gauranga", label: "Гауранга", src: "/gauranga.svg", wide: false },
  { id: "iskcon", label: "ИСККОН", src: "/iskcon.svg", wide: true },
  { id: "bogatstva", label: "Богатства", src: "/bbt.svg", wide: false },
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

/* Плоские действия строки бхаджана — единый стиль как в книжной шапке: без серых
   кругов; слушать (если есть записи) · избранное · ещё. */
function FlatRowBtn({ ariaLabel, onClick, color, children }: { ariaLabel: string; onClick: () => void; color?: string; children: ReactNode }) {
  return (
    <button type="button" aria-label={ariaLabel} onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{ display: "grid", height: 32, width: 32, placeItems: "center", borderRadius: "50%", border: "none", background: "transparent", color: color || "var(--color-label-2)", cursor: "pointer", WebkitTapHighlightColor: "transparent", pointerEvents: "auto" }}>
      {children}
    </button>
  );
}
function BhajanRowActions({ slug, name, author, hasRecordings, onMore }: { slug: string; name: string; author: string | null; hasRecordings?: boolean; onMore: () => void }) {
  const { on, toggle } = useFavorite(`bhajan:${slug}`, { t: name, s: author || undefined, h: `/bhajans/${slug}` });
  const player = usePlayer();
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 2, position: "relative", zIndex: 1 }}>
      {hasRecordings && <FlatRowBtn ariaLabel="Слушать" onClick={() => player.playBhajan(slug, 0)}><HeadphonesIcon size={18} /></FlatRowBtn>}
      <FlatRowBtn ariaLabel="В избранное" color={on ? "#FF453A" : undefined} onClick={() => toggle()}><HeartIcon size={18} filled={on} /></FlatRowBtn>
      <FlatRowBtn ariaLabel="Ещё" onClick={onMore}><MoreIcon size={16} /></FlatRowBtn>
    </span>
  );
}

/* ═════════ Bhajan shelf — list from D1 prayers (api /bhajans) ═════════ */
interface BhajanListItem { slug: string; name: string; author: string | null; hero_image: string | null; has_recordings?: boolean; }
/* Структура молитвенника по службам Храмов ИСККОН (как на iskcone.com/ru/bhajans). */
const BHAJAN_SECTIONS: { title: string; slugs: string[] }[] = [
  { title: "Службы храмов ИСККОН", slugs: [
    "visvanatha-chakravarti-thakur-shree-shree-gurv-ashtaka",
    "tulasi", "govindam",
    "narottam-das-thakur-shree-guru-vandana",
    "sri-narasimha-pranama", "srila-prabhupada-pranama-mantra",
    "pancha-tattva-maha-mantra", "maha-mantra",
    "sri-sri-siksastaka", "sri-vaisnava-pranama",
    "gaura-arati", "tilaka", "prema-dhavani", "nama-aparadha",
  ] },
  { title: "Молитвы перед лекциями", slugs: [
    "katha-mantra", "srimad-bhagavatam-pranama", "jaya-radha-madhava",
  ] },
  { title: "Другие важные молитвы", slugs: [
    "prasada-mantra", "narayana-kavacha",
  ] },
  { title: "Молитвы и бхаджаны", slugs: [
    "rupa-goswami-shree-radhika-stava", "radharani-ki-jay",
    "shree-radha-stotram", "shrinivas-acharia-sad-goswami-ashtakam",
    "narottam-das-thakur-je-anilo-prema-dhana",
    "narottam-das-thakur-shree-krishna-chaytaniya-prabhu",
    "narottam-das-thakur-hari-hari",
    "narottam-das-thakur-gauranga-bolite-habe",
    "narottam-das-thakur-shree-radha-nishtha",
    "narottam-das-thakur-vaishnava-vigyapti",
    "narottam-das-thakur-shree-rupa-manjari-pada",
    "narottam-das-thakur-nama-sankirtana",
    "narottam-das-thakur-vrindavana-ramia-sthana",
    "lochan-das-thakur-parama-koruna",
    "bhaktivinod-thakur-gurudev",
    "bhaktivinod-thakur-ohe-vaishnava-thakur",
    "vasudeva-ghosh-gauranga-tumi-more-doya-na-chariho",
    "damodarashtaka",
  ] },
  { title: "Молитвы ачарьям", slugs: [
    "srila-bhaktisiddhanta-sarasvati-mantra", "gaurakisor-das-babaji-pranama",
    "bhaktivinod-thakur-pranama", "jagannatha-das-babaji-pranama",
    "madhvacharia-vandana", "madhavendra-puri-vandana",
    "shrila-sanatana-goswami-vighyapti", "shrila-rupa-goswami-vighyapti",
    "shri-shukadeva-goswami-pranama",
  ] },
  { title: "Молитвы Шрилы Прабхупады", slugs: [
    "prabhupada-markine-bhagavat-dharma", "prabhupada-molitva-lotosnim-stopam-krishni",
  ] },
];

function BhajanShelf({ onOpen, onOpenCatalog }: { onOpen: (slug: string) => void; onOpenCatalog: () => void }) {
  const [items, setItems] = useState<BhajanListItem[] | null>(null);
  const [q, setQ] = useState("");
  const { openCardMenu } = useCardActions();
  useEffect(() => {
    let live = true;
    fetch(api("/bhajans"))
      .then((r) => r.json())
      .then((d) => { if (live) setItems(d.bhajans ?? []); })
      .catch(() => { if (live) setItems([]); });
    return () => { live = false; };
  }, []);

  const norm = (s: string) => (s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const nq = norm(q.trim());
  const searching = nq.length > 0;
  const filtered = items ? items.filter((b) => norm(`${b.name} ${b.author || ""}`).includes(nq)) : null;
  const bySlug = new Map((items ?? []).map((b) => [b.slug, b] as const));
  const groups = !items ? [] : BHAJAN_SECTIONS
    .map((sec) => ({ title: sec.title, list: sec.slugs.map((sl) => bySlug.get(sl)).filter(Boolean) as BhajanListItem[] }))
    .filter((g) => g.list.length > 0);

  const rowOf = (b: BhajanListItem, isLast: boolean) => (
    <li key={b.slug} style={{ borderBottom: isLast ? "none" : "0.5px solid var(--color-hairline)" }}>
      <div style={{ position: "relative", display: "flex", width: "100%", alignItems: "center", gap: 12, padding: 10, color: "var(--color-label)", fontFamily: "var(--font-text)" }}>
        <button aria-label={`Открыть: ${b.name}`} onClick={() => onOpen(b.slug)} style={{ position: "absolute", inset: 0, background: "none", border: "none", cursor: "pointer", zIndex: 0 }} />
        {/* ЗКН-Д005: нет обложки → фирменная заглушка, а не битая картинка */}
        {(b.hero_image || COVER_FALLBACK)
          ? <img src={b.hero_image || COVER_FALLBACK} alt="" loading="lazy" style={{ width: 52, height: 52, borderRadius: 10, objectFit: "cover", flexShrink: 0, position: "relative", zIndex: 1, pointerEvents: "none" }} />
          : <span style={{ width: 52, height: 52, borderRadius: 10, flexShrink: 0, background: "var(--color-glass-regular)", position: "relative", zIndex: 1, pointerEvents: "none" }} />}
        <span style={{ minWidth: 0, flex: 1, position: "relative", zIndex: 1, pointerEvents: "none" }}>
          <span style={{ display: "block", fontSize: "var(--text-subhead)", fontWeight: 600, lineHeight: 1.25, color: "var(--color-label)" }}>{b.name}</span>
          {b.author && <span style={{ display: "block", marginTop: 2, fontSize: "var(--text-footnote)", color: "var(--color-label-2)" }}>{b.author}</span>}
        </span>
        <BhajanRowActions slug={b.slug} name={b.name} author={b.author} hasRecordings={b.has_recordings}
          onMore={() => openCardMenu({ type: "bhajan", id: b.slug, title: b.name, subtitle: b.author || undefined, url: url(ROUTES.bhajan(b.slug)), context: `Бхаджан · ${b.name} · /bhajan/${b.slug}` })} />
      </div>
    </li>
  );
  const listOf = (arr: BhajanListItem[]) => (
    <ul style={{ margin: 0, padding: 0, listStyle: "none", borderRadius: 18, overflow: "hidden", background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)" }}>
      {arr.map((b, i) => rowOf(b, i === arr.length - 1))}
    </ul>
  );

  return (
    <section style={{ marginTop: 28 }}>
      <HubHeader
        eyebrow="Молитвенник"
        title="Бхаджаны"
        subtitle="Песни ачарьев — от служб храмов ИСККОН до сокровенных молитв Госвами"
        action={
          <button onClick={onOpenCatalog} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 999, border: "0.5px solid var(--color-gold)", background: "transparent", color: "var(--color-gold-deep)", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 600, cursor: "pointer" }}>
            Весь каталог
            <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        }
      />
      {items && items.length > 0 && (
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по названию или автору" inputMode="search"
          style={{ width: "100%", boxSizing: "border-box", marginBottom: 12, padding: "10px 14px", borderRadius: 12, border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)", color: "var(--color-label)", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", outline: "none" }} />
      )}
      {!items && <div style={{ fontSize: "var(--text-subhead)", color: "var(--color-label-2)" }}>Загрузка…</div>}
      {items && items.length === 0 && <div style={{ fontSize: "var(--text-subhead)", color: "var(--color-label-2)" }}>Пока пусто.</div>}
      {items && items.length > 0 && searching && filtered && filtered.length === 0 && <div style={{ fontSize: "var(--text-subhead)", color: "var(--color-label-2)" }}>Ничего не найдено.</div>}
      {searching
        ? (filtered && filtered.length > 0 ? listOf(filtered) : null)
        : groups.map((g) => (
            <div key={g.title} style={{ marginTop: 20 }}>
              <div style={{ marginBottom: 8, fontSize: "var(--text-footnote)", fontWeight: 700, letterSpacing: "-0.1px", color: "var(--color-label)", fontFamily: "var(--font-text)" }}>{g.title}</div>
              {listOf(g.list)}
            </div>
          ))}
      {!searching && items && items.length > 0 && (
        <button onClick={onOpenCatalog} style={{ marginTop: 18, width: "100%", padding: "12px", borderRadius: 14, border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)", cursor: "pointer", color: "var(--color-gold-deep)", fontSize: "var(--text-subhead)", fontWeight: 600, fontFamily: "var(--font-text)" }}>
          Открыть весь каталог →
        </button>
      )}
    </section>
  );
}

/* ═════════ Bhajan catalog — сегмент-фильтр по теме + поиск, группировка автор→песенник ═════════ */
interface CatalogItem { slug: string; name: string; author: string | null; source_text: string | null; category: string | null; section: string | null; ord: number | null; has_text: boolean; }
const CAT_SEGMENTS: { id: string; label: string; match: (s: string) => boolean }[] = [
  { id: "all", label: "Все", match: () => true },
  { id: "krishna", label: "Кришна", match: (s) => /кришн/i.test(s) },
  { id: "radha", label: "Радха", match: (s) => /радх/i.test(s) },
  { id: "gauranga", label: "Гауранга", match: (s) => /гаур|нитьянанд|чайтань/i.test(s) },
  { id: "nama", label: "Святые имена", match: (s) => /нама/i.test(s) },
  { id: "sharanagati", label: "Шаранагати", match: (s) => /шаранагати|дайнь|ниведан|гоптритве|свикар|уччхвас|виджняпт/i.test(s) },
  { id: "dhama", label: "Дхама", match: (s) => /дхам/i.test(s) },
];
function BhajanCatalog({ onOpen, onBack }: { onOpen: (slug: string) => void; onBack: () => void }) {
  const [items, setItems] = useState<CatalogItem[] | null>(null);
  const [err, setErr] = useState(false);
  const [seg, setSeg] = useState("all");
  const [q, setQ] = useState("");
  useEffect(() => {
    let live = true;
    fetch(api("/bhajans/catalog"))
      .then((r) => r.json())
      .then((d) => { if (live) { if (Array.isArray(d.items)) setItems(d.items); else setErr(true); } })
      .catch(() => { if (live) setErr(true); });
    return () => { live = false; };
  }, []);

  const norm = (s: string) => (s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const nq = norm(q.trim());
  const segDef = CAT_SEGMENTS.find((x) => x.id === seg) ?? CAT_SEGMENTS[0];
  const segCount = (id: string) => {
    const d = CAT_SEGMENTS.find((x) => x.id === id)!;
    return (items ?? []).filter((it) => (id === "all" ? true : !!(it.section && d.match(it.section)))).length;
  };
  const filtered = (items ?? []).filter((it) =>
    (seg === "all" || !!(it.section && segDef.match(it.section))) &&
    (!nq || norm(`${it.name} ${it.author || ""}`).includes(nq))
  );

  // group: author -> songbook(source_text|'—') -> items (ordered)
  const groups: { author: string; books: { book: string | null; rows: CatalogItem[] }[] }[] = [];
  {
    const byAuthor = new Map<string, CatalogItem[]>();
    for (const it of filtered) {
      const a = it.author ?? "Традиционные";
      (byAuthor.get(a) ?? byAuthor.set(a, []).get(a)!).push(it);
    }
    for (const [author, rows] of byAuthor) {
      const byBook = new Map<string, CatalogItem[]>();
      for (const it of rows) { const b = it.source_text ?? "—"; (byBook.get(b) ?? byBook.set(b, []).get(b)!).push(it); }
      groups.push({ author, books: [...byBook.entries()].map(([book, r]) => ({ book: book === "—" ? null : book, rows: r })) });
    }
  }

  return (
    <div style={{ minHeight: "100%", background: "var(--color-bg)" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 30, height: 56, display: "flex", alignItems: "center", gap: 6, padding: "0 8px", borderBottom: "0.5px solid var(--color-hairline)", background: "var(--color-bg)" }}>
        <button aria-label="Назад" onClick={onBack} style={{ display: "grid", height: 40, width: 40, placeItems: "center", borderRadius: "50%", border: "none", background: "none", cursor: "pointer", color: "var(--color-label)" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0, fontSize: "var(--text-callout)", fontWeight: 700, color: "var(--color-label)" }}>Каталог бхаджанов</div>
      </header>

      {!items && !err && <div style={{ textAlign: "center", color: "var(--color-label-2)", padding: "48px 0", fontSize: "var(--text-subhead)" }}>Загрузка…</div>}
      {err && <div style={{ textAlign: "center", color: "var(--color-label-2)", padding: "48px 16px", fontSize: "var(--text-subhead)" }}>Не удалось загрузить каталог.</div>}

      {items && (
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "12px 16px 56px" }}>
          {/* сегмент-фильтр по теме */}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", margin: "0 -16px", padding: "2px 16px 12px", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
            {CAT_SEGMENTS.filter((s) => s.id === "all" || segCount(s.id) > 0).map((s) => {
              const on = seg === s.id;
              return (
                <button key={s.id} onClick={() => setSeg(s.id)} style={{ flexShrink: 0, height: 34, padding: "0 14px", borderRadius: 999, border: on ? "none" : "0.5px solid var(--color-hairline)", background: on ? "var(--color-label)" : "var(--color-bg-2)", color: on ? "var(--color-bg)" : "var(--color-label)", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", WebkitTapHighlightColor: "transparent" }}>{s.label}</button>
              );
            })}
          </div>
          {/* поиск */}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по названию или автору" inputMode="search"
            style={{ width: "100%", boxSizing: "border-box", margin: "2px 0 18px", padding: "10px 14px", borderRadius: 12, border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)", color: "var(--color-label)", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", outline: "none" }} />

          {filtered.length === 0 && <div style={{ textAlign: "center", color: "var(--color-label-2)", padding: "40px 0", fontSize: "var(--text-subhead)" }}>Ничего не найдено.</div>}

          {groups.map((g) => (
            <section key={g.author} style={{ marginBottom: 26 }}>
              <h2 style={{ margin: "0 0 10px", fontSize: "var(--text-body)", fontWeight: 800, letterSpacing: "-0.2px", color: "var(--color-label)" }}>{g.author}</h2>
              {g.books.map((bk) => (
                <div key={(g.author) + "|" + (bk.book ?? "_")} style={{ marginBottom: 12 }}>
                  {bk.book && <div style={{ fontSize: "var(--text-caption2)", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", color: "var(--color-gold-deep)", margin: "8px 2px 6px" }}>{bk.book}</div>}
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", borderRadius: 14, overflow: "hidden", background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)" }}>
                    {bk.rows.map((it, i) => (
                      <li key={it.slug} style={{ borderBottom: i === bk.rows.length - 1 ? "none" : "0.5px solid var(--color-hairline)" }}>
                        <button onClick={() => onOpen(it.slug)} style={{ display: "flex", width: "100%", alignItems: "center", gap: 10, padding: "12px 12px", textAlign: "left", background: "none", border: "none", cursor: "pointer", color: "var(--color-label)", fontFamily: "var(--font-text)" }}>
                          <span style={{ minWidth: 0, flex: 1, fontSize: "var(--text-subhead)", fontWeight: 500, lineHeight: 1.3, color: "var(--color-label)" }}>{it.name}</span>
                          {!it.has_text && <span style={{ flexShrink: 0, fontSize: "var(--text-caption2)", color: "var(--color-label-2)", border: "0.5px solid var(--color-hairline)", borderRadius: 999, padding: "2px 8px" }}>скоро</span>}
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
        <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: "var(--weight-semibold)", letterSpacing: "var(--tracking-wide)", textTransform: "uppercase", color: "var(--color-gold-deep)" }}>{eyebrow}</div>
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
        <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: "var(--weight-semibold)", letterSpacing: "var(--tracking-wide)", textTransform: "uppercase", color: "var(--color-gold-deep)" }}>ISKCON ONE LOVE</div>
        <h1 style={{ margin: "2px 0 0", fontFamily: "var(--font-display)", fontSize: "var(--text-title1)", fontWeight: "var(--weight-heavy)", letterSpacing: "var(--tracking-tight)", color: "var(--color-label)" }}>Лента</h1>
      </div>
      <ContentSection eyebrow="Личности" title="Кришна, аватары и спутники" endpoint="/content/personalities" onOpen={onOpen} />
      <ContentSection eyebrow="Заметки на полях сердца" title="Статьи" endpoint="/content/articles" onOpen={onOpen} />
      <ContentSection eyebrow="Сообщество" title="Центры ИСККОН" endpoint="/content/centers" onOpen={onOpen} />
    </div>
  );
}


/* ЗКН-Н005: суб-таб Богатств — сегмент URL, а не переменная в модуле.
 * /dhana                        → Личности (умолчание)
 * /dhana/<лила>/<волна>/<группа> → Личности с фильтрами (старые ссылки живы)
 * /dhana/books | bhajans | kirtans | recipes → соответствующая витрина
 * Слаги лил не пересекаются с id витрин, поэтому схема обратно совместима. */
export /* ЗКН-Н007: слаги лил — вход в четырёхуровневое меню Личностей.
   Те же, что в LichnostiHub::LILA_SLUG — иначе витрина уведёт в никуда. */
/* ЗКН-Н007: слаги лил — вход в четырёхуровневое меню Личностей.
   «Бхагавад-гита» отдельной лилой НЕ живёт: в ней было ДВА героя (Арджуна и
   Санджая), и оба — из Махабхараты, описанной в Шримад-Бхагаватам. Вкладка ради
   двух человек — не структура, а шум. Оба перенесены в Бхагаватам → Махабхарата. */
/* ЗКН-Н023 — КОРНИ ЛИЧНОСТЕЙ.
 * Лила и кластер живут в КОРНЕ, если их имя не занято книгой:
 *   /gauranga-lila /krishna-lila /pancha-tattva /avatars
 * Занято книгой → под /hero: /hero/shrimad-bhagavatam /hero/mahabharata */
/* ⚠️ В КОРЕНЬ идут ТОЛЬКО те, чьё имя СВОБОДНО.
 * `advaita` и `nityananda` в корень НЕЛЬЗЯ: это Адвайта Ачарья и Нитьянанда
 * Прабху — живые личности, и корень уже принадлежит им. Их кластеры остаются
 * вложенными: /gauranga-lila/first-wave/nityananda. Гейт это стережёт. */
const LILA_ROOTS = ["gauranga-lila", "krishna-lila", "bhagavatam-lila",
                    "mahabharata-lila", "ramayana-lila", "pancha-tattva",
                    "avatars", "rishis", "bhaktas", "demigods", "asuras"];

const BOG_SUBS = ["lichnosti", "books", "bhajans", "kirtans", "prasad", "dhama"] as const;
/* ЗКН-Н025 — ВИТРИНА ЧИТАЕТСЯ ИЗ ПЕРВОГО СЕГМЕНТА.
 *
 * Было `seg[1]` — под старый адрес `/dhana/books`. После переезда витрина живёт
 * в КОРНЕ (`/books`), и функция всегда возвращала «личности»: верхнее меню
 * рисовало не ту вкладку, а на `/books` и `/dhama` меню пропадало вовсе.
 *
 * Опять то же самое: адрес переехал — читатель остался. */
export function bogSubFromPath(path: string): string {
  const seg = path.split("/").filter(Boolean);
  const s0 = seg[0] || "";
  if ((BOG_SUBS as readonly string[]).includes(s0)) return s0;
  if (s0 === "hero" || LILA_ROOTS.includes(s0)) return "lichnosti";
  return "lichnosti";
}
/* ЗКН-Н005: суб-таб Садханы — сегмент URL, не переменная модуля.
 * / → Лента (умолчание) · /practice · /calendar · /account */
export const SAD_SUBS = ["feed", "practice", "calendar", "cabinet"] as const;
const SAD_PATH: Record<string, string> = { feed: "/", practice: "/sadhana", calendar: "/calendar", cabinet: "/id" };
export function sadSubFromPath(path: string): string {
  const s0 = path.split("/").filter(Boolean)[0] || "";
  if (s0 === "practice") return "practice";
  if (s0 === "calendar") return "calendar";
  if (s0 === "account") return "cabinet";
  return "feed";
}
function BogatstvaHall({ onOpenBook, onBookMenu, onOpenEntity, onOpenCollection, onOpenPath, flash, onOpenArtist, onOpenBhajan, onOpenCatalog }: {
  onOpenBook: (work: string) => void; onBookMenu: (work: string) => void; onOpenEntity: (id: string, type: string | null) => void;
  onOpenCollection: (key: string) => void; onOpenPath: (path: string) => void; flash?: string | null;
  onOpenArtist: (slug: string) => void; onOpenBhajan: (slug: string) => void; onOpenCatalog: () => void;
}) {
  const [sub, setSub] = useState(() =>
    typeof window === "undefined" ? "lichnosti" : bogSubFromPath(window.location.pathname));

  /* ЗКН-Н007 — ВХОД В ЛИЧНОСТИ = «ГЕРОИ».
   *
   *   /dhana                 → «Герои»: выбор царства
   *                            (Шрила Прабхупада · Кришна Лила · Гауранга Лила · Бхагаватам)
   *   /dhana/krishna-lila    → «Герои» внутри Кришна Лилы
   *   /dhana/gauranga-lila   → «Герои» внутри Гауранга Лилы
   *   /dhana/vse             → полный список: четырёхуровневое меню (ЗКН-Н006)
   *
   * Раньше /dhana сразу открывал список из 730 личностей — без входа и выбора. */
  /* ЗКН-Н023 — ГДЕ МЫ В ЛИЧНОСТЯХ.
   *
   *   /hero                     витрина: три входа
   *   /gauranga-lila/…          лила в КОРНЕ  → четырёхуровневое меню
   *   /pancha-tattva            кластер в КОРНЕ → меню
   *   /hero/shrimad-bhagavatam  имя занято книгой → под /hero → меню
   *
   * Меню показываем, если адрес НЕ равен просто «/hero». */
  const inMenu = () => {
    if (typeof window === "undefined") return false;
    const seg = window.location.pathname.split("/").filter(Boolean);
    if (!seg.length) return false;
    if (LILA_ROOTS.includes(seg[0])) return true;
    return seg[0] === "hero" && !!seg[1];
  };
  const [deep, setDeep] = useState(inMenu);
  useEffect(() => subscribeNav(() => setDeep(inMenu())), []);
  // ЗКН-Н005: переключение витрины меняет адресную строку (через nav.ts — ЗКН-Н001)
  const pickSub = (v: string) => {
    setSub(v);
    setDeep(false);
    pushUrl(v === "lichnosti" ? "/hero" : "/" + v);
  };
  return (
    <div>
      {/* ЗКН-Н006: Tier-1 — золотая рейка (не капсулы). Капсулы остаются за Tier-2. */}
      <HallTabs active={sub} onChange={pickSub} ariaLabel="Витрины Богатств"
        items={[{ id: "lichnosti", label: "Личности" }, { id: "books", label: "Книги" }, { id: "bhajans", label: "Бхаджаны" }, { id: "kirtans", label: "Киртаны" }, { id: "prasad", label: "Прасад" }, { id: "dhama", label: "Дхама" }]} />

      {/* ЗКН-Н024 — РАССТОЯНИЕ ОТ МЕНЮ ДО НАДПИСИ: ЕДИНОЕ, ОДИН РАЗ, В ЗАЛЕ.
       *
       * Витрины ставили отступ каждая по-своему: Бхаджаны 28, остальные — НИКАК,
       * и шапка липла к меню. Переключаешь вкладку — текст прыгает.
       *
       * Отступ живёт ЗДЕСЬ, а не в витринах: пока каждая ставит свой, любая
       * договорённость разъедется снова. Витрина об отступе не знает. */}
      <div style={{ marginTop: HUB_TOP }}>
      {/* ЗКН-Н007 — «ГЕРОИ» ТОЛЬКО НА ПЕРВОМ ЭКРАНЕ.
       *   /hero              → витрина: три входа
       *   всё глубже         → четырёхуровневое меню (LichnostiHub)
       * Оборачивать вложенные уровни в «Героев» — значит сломать меню.
       *
       * ⚠️ ЗКН-Н025: здесь ЖИЛ мёртвый обработчик `pp.startsWith("/hero/")`
       * после переезда адресов на `/gauranga-lila`. Условие не срабатывало, и
       * кнопки витрины переставали вести вглубь. Адрес переехал — читатель нет. */}
      {sub === "lichnosti" && (deep
        ? <LichnostiHub onOpenEntity={onOpenEntity} />
        : <AcharyaScreen
            onOpen={onOpenEntity}
            onOpenCollection={onOpenCollection}
            onOpenPath={(pp) => { pushUrl(pp); setDeep(true); }}
          />)}
      {sub === "books" && <BooksHub onOpenBook={onOpenBook} onBookMenu={onBookMenu} onOpenEntity={onOpenEntity} onOpenCollection={onOpenCollection} onOpenPath={onOpenPath} flash={flash} />}
      {sub === "bhajans" && <BhajanShelf onOpen={onOpenBhajan} onOpenCatalog={onOpenCatalog} />}
      {sub === "prasad" && (
        <PrasadamScreen
          onBack={() => onOpenPath("/hero")}
          onOpenRecipe={(sl) => onOpenPath("/prasad/" + sl)}
          onOpenBook={(chapterId) => onOpenPath(chapterId ? "/prasad/book/" + chapterId : "/prasad/book")}
          onOpenEntity={onOpenEntity}
          flash={flash ? () => {} : undefined}
        />
      )}
      {sub === "dhama" && <DhamaScreen onOpen={(id) => onOpenPath("/dhama/" + id)} onOpenTirtha={(d, t) => onOpenPath("/dhama/" + d + "/" + t)} />}
      {sub === "kirtans" && <KirtansScreen onOpenArtist={onOpenArtist} onOpenBhajan={onOpenBhajan} onOpenCatalog={onOpenCatalog} />}
      </div>
    </div>
  );
}

function SadhanaHall({ onOpenPath, onOpenEntity, onDonate, flash }: {
  onOpenPath: (path: string) => void; onOpenEntity: (id: string, type: string | null) => void; onDonate: () => void; flash?: string | null;
}) {
  const [sub, setSub] = useState(() =>
    typeof window === "undefined" ? "feed" : sadSubFromPath(window.location.pathname));
  // ЗКН-Н005: переключение раздела меняет адресную строку (через nav.ts — ЗКН-Н001)
  const pickSub = (v: string) => { setSub(v); pushUrl(SAD_PATH[v] || "/"); };
  return (
    <div>
      <HallTabs active={sub} onChange={pickSub} ariaLabel="Разделы Садханы"
        items={[{ id: "feed", label: "Лента" }, { id: "practice", label: "Практика" }, { id: "calendar", label: "Календарь" }, { id: "cabinet", label: "Кабинет" }]} />
      {sub === "feed" && <><DarshanRings /><HomeFeed onDonate={onDonate} /></>}
      {sub === "practice" && <PracticeHub onOpen={onOpenPath} />}
      {sub === "calendar" && <HomeCalendar stickyTop={46} onOpenEntity={onOpenEntity} />}
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
    const shareUrl = url(ROUTES.book(work));
    if (id === "share") {
      if (typeof navigator !== "undefined" && navigator.share) navigator.share({ title: bookFullTitle(b), shareUrl }).catch(() => {});
      else if (typeof navigator !== "undefined") navigator.clipboard?.writeText(shareUrl).catch(() => {});
      return;
    }
    if (id === "pdf") { setPdfHidden(false); void downloadBookPdf({ work: b.work, book: b, onStatus: flash, onProgress: setBookPct, onTitle: setBookPctTitle, cancelRef: pdfCancel, abortRef: pdfAbort }); return; }
    if (id === "qr") { setQr({ shareUrl, data: { kind: "book", bookTitle: bookFullTitle(b), tagline: b.tagline, cover: b.covers[0] } }); return; }
    if (id === "donate") { onDonate(); return; }
    if (id === "report") { setReportOpen(true); return; }
    if (id === "note") { requestNote({ kind: "book", ref: `book:${work}`, title: bookFullTitle(b), subtitle: b.tagline, href: `/${bookSlug(work)}` }); return; }
    onOpenBook(work);
  };
  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100dvh", minHeight: 0 }}>
      <TopHeader onFavorites={onFavorites} onSearch={onSearch} onHome={() => { onChange("sadhana"); window.dispatchEvent(new CustomEvent("tab-reset", { detail: "sadhana" })); mainRef.current?.scrollTo({ top: 0, behavior: "smooth" }); }} />
      <main ref={mainRef} style={{ position: "relative", flex: 1, minHeight: 0, overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain" }}>
        <div style={{ padding: "16px 16px calc(116px + var(--player-extra))" }}>
          <Suspense fallback={<ScreenFallback />}>
          {tab === "krishna" && <EntityPage id="krishna" embedded onBack={() => {}} onOpen={onOpenEntity} onNavigate={onOpenPath} onOpenCollection={onOpenCollection} />}
          {tab === "gauranga" && <EntityPage id="chaitanya" embedded onBack={() => {}} onOpen={onOpenEntity} onNavigate={onOpenPath} onOpenCollection={onOpenCollection} />}
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
          </Suspense>
        </div>
      </main>
      <TabBar active={tab} onChange={onChange} scrollRef={mainRef} />
      {qr && <QrSheet url={qr.url} data={qr.data} onClose={() => setQr(null)} />}
      <ReportSheet open={reportOpen} onClose={() => setReportOpen(false)} context={`Главная · ${bookFullTitle(BOOKS.bg)}`} />
      {toast && <div style={{ position: "fixed", left: "50%", bottom: 96, transform: "translateX(-50%)", zIndex: 1100, background: "rgba(28,28,30,0.96)", color: "#fff", padding: "13px 18px", borderRadius: 14, fontSize: "var(--text-footnote)", lineHeight: 1.5, fontFamily: "var(--font-text)", boxShadow: "0 12px 40px rgba(0,0,0,0.3)", width: "calc(100% - 40px)", maxWidth: 380, textAlign: "center" }}>{toast}</div>}
      {bookPct > 0 && !pdfHidden && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.45)" }}>
          <div style={{ position: "relative", width: 300, maxWidth: "calc(100% - 48px)", background: "#fff", borderRadius: 20, padding: "26px 22px 20px", boxShadow: "0 20px 60px rgba(0,0,0,0.35)", fontFamily: "var(--font-text)", textAlign: "center" }}>
            <button type="button" aria-label="Отменить загрузку" onClick={cancelPdf} style={{ position: "absolute", top: 12, right: 12, width: 28, height: 28, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.06)", color: "#6e6e73", cursor: "pointer", display: "grid", placeItems: "center", fontSize: "var(--text-body)", lineHeight: 1, WebkitTapHighlightColor: "transparent" }}>×</button>
            <div style={{ fontSize: "var(--text-callout)", fontWeight: 700, lineHeight: 1.3, letterSpacing: "-0.01em", color: "#1d1d1f", padding: "0 8px", textWrap: "balance" }}>{bookPctTitle}</div>
            <div style={{ fontSize: "var(--text-footnote)", color: "#8e8e93", marginTop: 5 }}>Это может занять 1–2 минуты</div>
            <div style={{ marginTop: 16, height: 8, borderRadius: 999, background: "#ececed", overflow: "hidden" }}>
              <div style={{ width: `${bookPct}%`, height: "100%", background: "var(--color-gold)", borderRadius: 999, transition: "width 0.4s ease" }} />
            </div>
            <div style={{ marginTop: 8, fontSize: "var(--text-footnote)", fontWeight: 700, color: "#9c7c15" }}>{bookPct}%</div>
            <button type="button" onClick={() => setPdfHidden(true)} style={{ marginTop: 14, width: "100%", padding: "10px 0", borderRadius: 12, border: "none", background: "#f2f2f7", color: "#1d1d1f", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: 600, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>Свернуть</button>
          </div>
        </div>
      )}
      {bookPct > 0 && pdfHidden && (
        <button type="button" onClick={() => setPdfHidden(false)} style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: "calc(84px + env(safe-area-inset-bottom))", zIndex: 1200, display: "flex", alignItems: "center", gap: 9, padding: "9px 14px", borderRadius: 999, border: "none", background: "#1d1d1f", color: "#fff", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.3)", cursor: "pointer", maxWidth: "86vw", WebkitTapHighlightColor: "transparent" }}>
          <span aria-hidden style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-gold)", flexShrink: 0 }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bookPctTitle} · {bookPct}%</span>
        </button>
      )}
    </div>
  );
}

export default function App() {
  if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("pdf")) {
    return <Suspense fallback={null}><PdfDoc /></Suspense>;
  }
  const [tab, setTab] = useState("sadhana");
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
  const [openDownloader, setOpenDownloader] = useState(false);
  const [openStoriesTool, setOpenStoriesTool] = useState(false);
  const [openEntity, setOpenEntity] = useState<string | null>(null);
  const [openPost, setOpenPost] = useState<string | null>(null);
  const [openCollection, setOpenCollection] = useState<string | null>(null);
  const [donate, setDonate] = useState(false);
  const [openCart, setOpenCart] = useState(false);
  const [openJapa, setOpenJapa] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  useEffect(() => {
    const h = () => setShowOnboarding(true);
    window.addEventListener("iskcon:onboarding", h);
    return () => window.removeEventListener("iskcon:onboarding", h);
  }, []);
  // Прогрев чанков основных вкладок в простое браузера → переключение между
  // разделами открывается мгновенно, без скелетона (модуль уже в кэше).
  useEffect(() => { prefetchTopScreens(); }, []);
  const [openDiary, setOpenDiary] = useState(false);
  const [openVow, setOpenVow] = useState(false);
  const [openDarshan, setOpenDarshan] = useState(false);
  const [openDailyVerse, setOpenDailyVerse] = useState(false);
  const [openEkadashi, setOpenEkadashi] = useState(false);
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
  /* ЗКН-Н023 §4 — КОРНИ РАЗДЕЛОВ ЗАРЕЗЕРВИРОВАНЫ.
 *
 * Личности живут в КОРНЕ (`/abhimanyu`) — это самый частый адрес, и он обязан
 * быть коротким. Но раз так, слаг личности НЕ МОЖЕТ совпасть с корнем раздела:
 * иначе `/books` перестанет открывать Книги и откроет личность по имени «books».
 *
 * Источник истины — ROOTS из routes.ts. Дублировать список здесь нельзя: он
 * разъедется (так `lichnosti`, `prasad` и `iskcon` уже выпали из RESERVED). */
const RESERVED: readonly string[] = [
  ...ROOTS,
  // служебные, не разделы
  "kirtan", "book", "bhajan", "read", "admin", "downloader", "stories-tool",
  "entity", "person", "note", "center", "centers", "passport", "dhana", "acharya",
  "prasadam", "donate", "share",
];
  function pathFromState(): string {
    if (openCart) return "/cart";
    if (openJapa) return "/japa";
    if (openDiary) return "/story";
    if (openVow) return "/promise";
    if (openDarshan) return "/darshan";
    if (openDailyVerse) return "/verse";
    if (openEkadashi) return "/ekadashi";
    if (openProgress) return "/progress";
    if (openCenterNew) return "/my/centers/new";
    if (openModeration) return "/centers/review";
    if (openCenterSchedule) return `/iskcon/centers/${openCenterSchedule}/schedule`;
    if (openCenterDeities) return `/iskcon/centers/${openCenterDeities}/deities`;
    if (openCenterEvents) return `/iskcon/centers/${openCenterEvents}/events`;
    if (openCenterPhotos) return `/iskcon/centers/${openCenterPhotos}/photos`;
    if (openCenterEdit) return `/iskcon/centers/${openCenterEdit}/edit`;
    if (openCenters) return "/iskcon/centers";
    if (openMyCenters) return "/my/centers";
    if (openCenter) return `/iskcon/centers/${openCenter}`;
    if (prasadamRecipe) return "/prasad/" + prasadamRecipe;
    if (cookbookChapter) return "/prasad/book/" + cookbookChapter;
    if (openCookbook) return "/prasad/book";
    if (prasadamSection) return prasadamSection === "offering" ? "/prasad/offering" : "/prasad";
    if (openAdmin) return "/admin";
    if (openDownloader) return "/downloader";
    if (openStoriesTool) return "/stories-tool";
    if (openBook) { const base = `/${bookSlug(openBook)}`; return (typeof window !== "undefined" && window.location.pathname.startsWith(base)) ? window.location.pathname : base; }
    if (openBhajan) return openBhajan;     // slug сам по себе путь
    if (openKirtanArtist) return "/kirtans/" + openKirtanArtist;
    if (openFavorites) return "/favorites";
    if (openNoteId) return "/note/" + openNoteId;
    if (openNotes) return "/notes";
    if (openCatalog) return "/bhajans";
    if (openContent) return openContent;   // slug сам по себе путь
    if (openEntity) return "/" + openEntity;
    if (openPost) return "/post/" + openPost;
    if (openCollection) return "/hero/" + openCollection;
    if (openTirtha) return "/dhama/" + openTirtha.dhama + "/" + openTirtha.id;
    if (openDhama) return "/dhama/" + openDhama;
    // Кришна-ПКЛ держит подтаб прямо в пути (/krishna/<таб>/<подтаб>) — не сбрасываем его при ре-синхронизации.
    if (tab === "krishna") return (typeof window !== "undefined" && window.location.pathname.startsWith("/krishna")) ? window.location.pathname : "/krishna";
    if (tab === "bogatstva") return (typeof window !== "undefined" && window.location.pathname.startsWith("/hero")) ? window.location.pathname : "/hero";
    return (tab === "home" || tab === "sadhana") ? "/" : "/" + tab;
  }
  function resolveAndOpen(slug: string) {
    fetch(api(`/content/resolve?slug=${encodeURIComponent(slug)}`))
      .then((r) => r.json())
      .then((d) => {
        fromPop.current = true;
        if (d?.kind === "entity") setOpenEntity((d.id as string) || slug.replace(/^\//, ""));
        else if (d?.kind === "bhajan") setOpenBhajan(slug);
        else setOpenContent(slug); // content или неизвестно → пробуем как контент
      })
      .catch(() => { fromPop.current = true; setOpenContent(slug); });
  }
  function applyPath(path: string) {
    fromPop.current = true;
    const clean = (path || "/").replace(/\/+$/, "") || "/";
    if (clean === "/donate") { setDonate(true); return; }   // оверлей доната — подложку не трогаем
    setDonate(false);
    setOpenBook(null); setBookTarget(null); setOpenBhajan(null); setOpenKirtanArtist(null); setOpenCatalog(false); setOpenContent(null); setOpenAdmin(false); setOpenEntity(null); setOpenCollection(null); setOpenFavorites(false); setOpenSearch(false); setOpenNotes(false); setOpenNoteId(null); setOpenCart(false); setOpenJapa(false); setOpenDiary(false); setOpenVow(false); setOpenDarshan(false); setOpenDailyVerse(false); setOpenEkadashi(false); setOpenProgress(false); setPrasadamSection(null); setPrasadamRecipe(null); setOpenCookbook(false); setCookbookChapter(null); setOpenCenter(null); setOpenMyCenters(false); setOpenCenters(false); setOpenCenterNew(false); setOpenCenterEdit(null); setOpenCenterSchedule(null); setOpenCenterDeities(null); setOpenCenterEvents(null); setOpenCenterPhotos(null); setOpenModeration(false); setOpenDhama(null); setOpenTirtha(null); setOpenDownloader(false); setOpenStoriesTool(false); setOpenPost(null);
    const seg0 = clean.split("/")[1] ?? "";
    if (clean === "/") { setTab("sadhana"); return; }
    // ЗКН-Н005: разделы Садханы — свои адреса (Практика / Календарь / Кабинет)
    /* ЗКН-Н023 — САДХАНА: каждый инструмент в КОРНЕ (схема основателя).
     *   /sadhana /japa /story /verse /promise /progress /darshan /calendar /ekadashi /id */
    if (seg0 === "sadhana") { setTab("sadhana"); return; }
    if (["japa", "story", "verse", "promise", "progress", "darshan"].includes(seg0)) {
      setTab("sadhana");
      window.dispatchEvent(new CustomEvent("iol:open-" + seg0));
      return;
    }
    if (seg0 === "id") { setTab("sadhana"); return; }
    if (seg0 === "calendar") { setTab("sadhana"); return; }
    if (["krishna", "gauranga", "iskcon", "bogatstva", "sadhana", "books", "kirtans", "acharya", "dhama", "account", "feed"].includes(seg0) && clean === "/" + seg0) { setTab(seg0); return; }
    /* ЗКН-Н023 §6 — СТАРЫЙ АДРЕС НЕ ЛОМАЕТСЯ.
     *
     * Ссылки уже разошлись: в закладках, в QR-кодах на печатных материалах,
     * в чужих постах. Ломать чужую ссылку — то же, что ломать обещание.
     * Старый адрес МОЛЧА приводится к новому (replaceUrl, без записи в историю),
     * и дальше маршрутизатор видит только канонический вид. */
    const canon = canonicalPath(clean);
    if (canon) { replaceUrl(canon); navigate(canon); return; }

    /* ЗКН-Н023 — ЛИЧНОСТИ: витрина /hero, лилы В КОРНЕ.
     *   /hero                       витрина: три входа
     *   /gauranga-lila/first-wave   лила → волна
     *   /pancha-tattva              кластер в корне
     *   /hero/shrimad-bhagavatam    имя занято КНИГОЙ → под /hero */
    if (seg0 === "hero") { setTab("bogatstva"); return; }
    if (LILA_ROOTS.includes(seg0)) { setTab("bogatstva"); return; }
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
    if (clean === "/japa") { setOpenJapa(true); return; }
    if (clean === "/story") { setOpenDiary(true); return; }
    if (clean === "/promise") { setOpenVow(true); return; }
    if (clean === "/darshan") { setOpenDarshan(true); return; }
    if (clean === "/verse") { setOpenDailyVerse(true); return; }
    if (clean === "/ekadashi") { setOpenEkadashi(true); return; }
    if (clean === "/progress") { setOpenProgress(true); return; }
    if (clean === "/centers/review") { setOpenModeration(true); return; }
    if (clean === "/my/centers/new") { setOpenCenterNew(true); return; }
    if (clean === "/my/centers") { setOpenMyCenters(true); return; }
    if (clean === "/iskcon/centers") { setOpenCenters(true); return; }
    /* ЗКН-Н023 — ПРАСАД: рецепт живёт в /prasad/<рецепт>, без папки «recipe».
     *   /prasad              витрина
     *   /prasad/book         книга «Кухня прасада»
     *   /prasad/book/<гл>    глава
     *   /prasad/offering     подношение
     *   /prasad/<рецепт>     РЕЦЕПТ — прямо здесь
     *
     * ⚠️ ЗКН-Н025: обработчик ждал `/prasad/recipe/<x>` после того, как адрес
     * переехал на `/prasad/<x>`. Рецепты не открывались — пустые экраны. */
    if (seg0 === "prasad") {
      const parts = clean.split("/");
      const p2 = parts[2] || "";
      if (p2 === "book") { if (parts[3]) setCookbookChapter(parts[3]); else setOpenCookbook(true); return; }
      if (p2 === "offering") { setPrasadamSection("offering"); setTab("bogatstva"); return; }
      if (p2) { setPrasadamRecipe(p2); return; }          // /prasad/<рецепт>
      setPrasadamSection("recipes");
      return;
    }
    /* ЗКН-Н023 — /books это ВИТРИНА. Сама книга живёт в КОРНЕ по полному имени:
     *   /bhagavad-gita          книга
     *   /bhagavad-gita/2/13     глава → стих
     * «/book/bg» было двойным нарушением: лишняя папка И шифр вместо имени. */
    if (seg0 === "books" && !clean.split("/")[2]) { setTab("bogatstva"); return; }
    if (seg0 === "admin") { setOpenAdmin(true); return; }
    if (seg0 === "downloader") { setOpenDownloader(true); return; }
    if (seg0 === "stories-tool") { setOpenStoriesTool(true); return; }
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
    if (seg0 === "post") { const pid = clean.split("/")[2] ?? ""; if (pid) { setOpenPost(pid); return; } }
    if (clean.startsWith("bhajans-")) { setOpenBhajan(clean); return; }
    /* ЗКН-Н025: без слага — В ЗАЛ Богатств, а не в старую вкладку «home». */
    if (seg0 === "bhajans") {
      const bslug = clean.split("/")[2] ?? "";
      if (bslug) setOpenBhajan(bslug); else setTab("bogatstva");
      return;
    }
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
    if (seg0 === "kirtans") {
      const ks = clean.split("/")[2] ?? "";
      if (ks) setOpenKirtanArtist(ks); else setTab("bogatstva");
      return;
    }
    if (seg0 === "lichnosti-collection") { const ck = clean.split("/")[2] ?? ""; setTab("acharya"); if (ck) setOpenCollection(ck); return; }
    if (seg0 === "dasa") { setOpenContent(clean); return; }            // только статьи под /dasa
    /* ЗКН-Н023 — ИСККОН: ВКЛАДКА ЖИВЁТ В АДРЕСЕ.
     *   /iskcon /iskcon/news /iskcon/centers /iskcon/restaurants
     *   /iskcon/education /iskcon/structure /iskcon/documents /iskcon/links
     * Было: вкладка держалась в sessionStorage, адрес не менялся — разделом
     * нельзя было поделиться. Экран без адреса — как будто его нет. */
    if (seg0 === "iskcon") { setTab("iskcon"); return; }

    /* ЗКН-Н023 — КНИГА В КОРНЕ ПО ПОЛНОМУ ИМЕНИ.
     *
     *   /bhagavad-gita        книга
     *   /bhagavad-gita/2/13   глава → стих
     *
     * Проверяется РАНЬШЕ личности: иначе `/bhagavad-gita` уйдёт в резолвер имён
     * и не найдётся. Столкновений нет — проверено: ни один слаг книги не совпадает
     * со слагом личности (гейт `data-audit.py`). */
    const bw = bookWork(seg0);
    if (bw) {
      const parts = clean.split("/");
      if (BOOKS[bw]?.hierarchical) {
        setBookTarget(parts[2] ? { div: parts[2], chapter: parts[3] ?? null, verse: parts[4] ?? null } : null);
      } else {
        setBookTarget(parts[2] ? { div: null, chapter: parts[2], verse: parts[3] ?? null } : null);
      }
      setOpenBook(bw);
      return;
    }

    if (!RESERVED.includes(seg0)) { resolveAndOpen(clean); return; }    // /ru/… или /batumi → резолвер
    setTab("home");
  }

  // инициализация из URL + кнопки назад/вперёд (единственный popstate на приложение)
  useEffect(() => {
    navInit();
    const onPop = (e: PopStateEvent) => {
      navSetIdxFromState(e.state);
      const path = window.location.pathname;
      // ЗКН-Н002: App — ЕДИНСТВЕННЫЙ владелец popstate. Внутрикнижная навигация
      // (глава/стих) не слушает событие сама, а ПОДПИСАНА (subscribeNav): сначала
      // роутер, потом подписчики. Порядок детерминирован, гонки нет.
      const ob = openBookRef.current;
      if (!(ob && (path === `/${bookSlug(ob)}` || path.startsWith(`/${bookSlug(ob)}/`)))) {
        fromPop.current = true;
        applyPath(path);
      }
      notifyNav(path);
    };
    window.addEventListener("popstate", onPop);
    applyPath(window.location.pathname);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Гость попытался сохранить закладку из ридера → ведём в кабинет (вход).
  useEffect(() => {
    const onAuthReq = () => navigate("/id");
    window.addEventListener(AUTH_REQUIRED_EVENT, onAuthReq);
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, onAuthReq);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Открытие счётчика джапы из хаба «Садхана» (вложен глубоко в HomeScreen) —
  // через событие, чтобы не пробрасывать navigate сквозь дерево. Идём через
  // navigate → корректный URL /practice/japa, история и кнопка «назад».
  useEffect(() => {
    const onJapa = () => navigate("/japa");
    window.addEventListener("iol:open-japa", onJapa);
    return () => window.removeEventListener("iol:open-japa", onJapa);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Открытие дневника садханы из хаба «Садхана» — через событие (как джапа):
  // navigate → /practice/diary, корректная история и кнопка «назад».
  useEffect(() => {
    const onDiary = () => navigate("/story");
    window.addEventListener("iol:open-diary", onDiary);
    return () => window.removeEventListener("iol:open-diary", onDiary);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Открытие даршана дня из хаба «Садхана» — через событие.
  useEffect(() => {
    const onDarshan = () => navigate("/darshan");
    window.addEventListener("iol:open-darshan", onDarshan);
    return () => window.removeEventListener("iol:open-darshan", onDarshan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Открытие «Стиха дня» (системное чтение) из хаба «Садхана».
  useEffect(() => {
    const onDaily = () => navigate("/verse");
    window.addEventListener("iol:open-daily-verse", onDaily);
    return () => window.removeEventListener("iol:open-daily-verse", onDaily);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Открытие «Моего прогресса» (дашборд чтения) из хаба «Садхана».
  useEffect(() => {
    const onProg = () => navigate("/progress");
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
  }, [tab, openBook, openBhajan, openKirtanArtist, openCatalog, openContent, openAdmin, openEntity, openCollection, openFavorites, openNotes, openNoteId, openCart, openJapa, openDiary, openVow, openDarshan, openDailyVerse, openEkadashi, openProgress, prasadamSection, prasadamRecipe, openCookbook, cookbookChapter, openCenter, openMyCenters, openCenters, openCenterNew, openCenterEdit, openCenterSchedule, openCenterDeities, openCenterEvents, openCenterPhotos, openModeration, openDhama, openTirtha, openDownloader, openStoriesTool]);

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
    if (kind === "book") { navigate(`/${bookSlug(BOOKS[work] ? work : "bg")}`); return; }
    if (work === "bg") { navigate("/books/bg"); return; }
    const seg = kind === "verse" ? `/${div ?? ""}/${ch ?? ""}/${v ?? ""}` : kind === "chap" ? `/${div ?? ""}/${ch ?? ""}` : "";
    navigate(`/books/${work}${seg}`.replace(/\/+$/, ""));
  }
  // Открыть конкретный стих по его id («Стих дня» → читалка): БГ — книга, ШБ/ЧЧ — референс-ридер.
  function openVerseId(id: string) {
    const p = id.split(".");                 // bg.2.13 | bg.13.1-2 | sb.1.9.40 | cc.adi.1.19
    const work = p[0];
    if (!work) return;
    if (work === "bg") navigate(`/books/bg/${p[1] ?? ""}/${p[2] ?? ""}`.replace(/\/+$/, ""));
    else navigate(`/books/${work}/${p[1] ?? ""}/${p[2] ?? ""}/${p[3] ?? ""}`.replace(/\/+$/, ""));
  }
  // Открытие связанной сущности: книги-читалки уходят в ридер, остальное — в EntityPage.
  function openEntityTarget(id: string, type: string | null) {
    setOpenCollection(null);
    setOpenBhajan(null); setOpenKirtanArtist(null); setOpenBook(null); setBookTarget(null); setOpenCatalog(false); setOpenContent(null); setOpenPost(null);
    if (type === "scripture" && BOOKS[id]) { setOpenEntity(null); openRef("book:" + id); return; }
    setOpenEntity(id);
  }
  const tabBarVisible = !openAdmin && !openBook && !openBhajan && !openKirtanArtist && !openCatalog && !openContent && !openEntity && !openCollection && !openFavorites && !openSearch && !openNotes && !openNoteId && !openCart && !openJapa && !openDiary && !openVow && !openDarshan && !openDailyVerse && !openEkadashi && !openProgress && !prasadamSection && !prasadamRecipe && !openCookbook && !cookbookChapter && !openCenter && !openMyCenters && !openCenters && !openCenterNew && !openCenterEdit && !openCenterSchedule && !openCenterDeities && !openCenterEvents && !openCenterPhotos && !openModeration && !openDhama && !openTirtha && !openDownloader && !openStoriesTool;
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
        <Suspense fallback={<ScreenFallback />}>
        {openStoriesTool ? (
          <main style={{ position: "relative", height: "100dvh", overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain" }}>
            <StoriesToolScreen onBack={goBack} />
          </main>
        ) : openDownloader ? (
          <main style={{ position: "relative", height: "100dvh", overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain" }}>
            <DownloaderScreen onBack={goBack} />
          </main>
        ) : openAdmin ? (
          <main style={{ position: "relative", height: "100dvh", overflow: "hidden" }}>
            <BookLoaderPage onBack={goBack} />
          </main>
        ) : openBook ? (
          <main style={{ position: "relative", height: "100dvh", overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain" }}>
            <BookDetailPage key={openBook} book={BOOKS[openBook] ?? BOOKS.bg} onBack={goBack} onDonate={openDonate} onOpenCart={() => navigate("/cart")} initialTarget={bookTarget} />
          </main>
        ) : openBhajan ? (
          <main style={{ position: "relative", height: "100dvh", overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain" }}>
            <BhajanDetailPage slug={openBhajan} onBack={goBack} onOpenEntity={openEntityTarget} onOpenBhajan={(s) => navigate(s)} onOpenCatalog={() => navigate("/bhajans")} />
          </main>
        ) : openKirtanArtist ? (
          <main key={openKirtanArtist} style={{ position: "relative", height: "100dvh", overflow: "hidden" }}>
            <KirtanArtistPage slug={openKirtanArtist} onBack={goBack} onOpenEntity={openEntityTarget} />
          </main>
        ) : openCatalog ? (
          <main style={{ position: "relative", height: "100dvh", overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain" }}>
            <BhajanCatalog onOpen={(slug) => { setOpenCatalog(false); setOpenBhajan(slug); }} onBack={goBack} />
          </main>
        ) : openCollection ? (
          <main key={openCollection} style={{ position: "relative", height: "100dvh", overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain" }}>
            <AcharyaScreen collection={openCollection} onBack={goBack} onOpen={openEntityTarget} />
          </main>
        ) : openPost ? (
          <main key={openPost} style={{ position: "relative", height: "100dvh", overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain" }}>
            <FeedPostFocus id={openPost} onBack={goBack} onDonate={openDonate} />
          </main>
        ) : openEntity ? (
          <main key={openEntity} style={{ position: "relative", height: "100dvh", overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain" }}>
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
          <main style={{ position: "relative", height: "100dvh", overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain" }}>
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
        ) : openEkadashi ? (
          <main style={{ position: "relative", height: "100dvh", overflow: "hidden" }}>
            <EkadashiScreen onBack={goBack} onOpenPath={navigate} />
          </main>
        ) : openProgress ? (
          <main style={{ position: "relative", height: "100dvh", overflow: "hidden" }}>
            <MyProgressScreen onBack={goBack} onOpen={navigate} />
          </main>
        ) : openSearch ? (
          <main style={{ position: "relative", height: "100dvh", overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain" }}>
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
            <RecipeDetail slug={prasadamRecipe} onBack={goBack} onOpenRecipe={(s) => navigate("/prasad/" + s)} onOpenOffering={() => navigate("/prasad/offering")} onOpenBookChapter={(id) => navigate("/prasad/book/" + id)} onOpenEntity={openEntityTarget} />
          </main>
        ) : cookbookChapter ? (
          <main style={{ position: "relative", height: "100dvh", overflow: "hidden" }}>
            <CookbookScreen chapterId={cookbookChapter} onBack={goBack} onOpenChapter={(id) => navigate("/prasad/book/" + id)} onOpenRecipe={(s) => navigate("/prasad/" + s)} />
          </main>
        ) : openCookbook ? (
          <main style={{ position: "relative", height: "100dvh", overflow: "hidden" }}>
            <CookbookScreen chapterId={null} onBack={goBack} onOpenChapter={(id) => navigate("/prasad/book/" + id)} onOpenRecipe={(s) => navigate("/prasad/" + s)} />
          </main>
        ) : prasadamSection ? (
          <main style={{ position: "relative", height: "100dvh", overflow: "hidden" }}>
            <PrasadamScreen initialSection={prasadamSection} onBack={goBack} onOpenRecipe={(s) => navigate("/prasad/" + s)} onSectionChange={(id) => replaceUrl(id === "offering" ? "/prasad/offering" : "/prasad")} onOpenBook={() => navigate("/prasad/book")} onOpenEntity={openEntityTarget} />
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
        </Suspense>
        </CardActionsProvider>
        {overlayTabBar && <TabBar active={tab} onChange={(k) => navigate("/" + k)} scrollRef={overlayScrollRef} />}
        {donate && <DonateModal onClose={closeDonate} />}
        {showOnboarding && <Onboarding navigate={navigate} onClose={() => setShowOnboarding(false)} />}
        <MiniPlayer tabBarVisible={tabBarVisible || overlayTabBar} />
        <NowPlaying onOpenBook={(book, chapter) => { setBookTarget(chapter ? { div: null, chapter: String(chapter), verse: null } : null); setOpenBook(BOOKS[book] ? book : "bg"); }} onOpenBhajan={setOpenBhajan} onDonate={openDonate} />
        {appToast && (
          <div role="status" aria-live="polite" style={{ position: "fixed", left: "50%", bottom: "calc(94px + env(safe-area-inset-bottom,0px))", transform: "translateX(-50%)", zIndex: 4000, maxWidth: 360, padding: "11px 18px", borderRadius: 999, background: "color-mix(in srgb, var(--color-label) 92%, transparent)", color: "var(--color-bg)", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: 600, lineHeight: 1.35, boxShadow: "var(--shadow-card)", pointerEvents: "none", textAlign: "center" }}>
            {appToast}
          </div>
        )}
      </div>
    </div>
    </PlayerProvider>
    </AuthProvider>
  );
}
