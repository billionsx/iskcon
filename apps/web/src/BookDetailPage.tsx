/**
 * BookDetailPage (ПКП) — архитектура 1:1 из apartsales UnitDetailPage:
 *   scroll-aware TopBar над hero → hero-карусель (как витрина) →
 *   sticky-табы (механика UnitTabs: автоскролл активного, синее подчёркивание) →
 *   контент активного таба → sticky CTA-бар снизу.
 * Контент — книга (данные из books.ts). Табы: Главное · Содержание · Автор ·
 * Об источнике · Издания · Слушать.
 */
import { useEffect, useRef, useState } from "react";
import type { SVGProps, ReactNode } from "react";
import type { BookData } from "./books";
import { BOOK_MENU_ITEMS } from "./books";

/* ───────── icons (same geometry as the card) ───────── */
interface IconProps extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> { size?: number; filled?: boolean; }
const sp = ({ size = 24 }: IconProps) => ({ width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true as const });
const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function HeartIcon(p: IconProps) {
  const d = "M12 21c-7.4-4.6-9.9-8.7-9.9-12.5 0-2.85 2.04-5.2 4.85-5.2 1.97 0 3.6 1.05 5.05 3.07 1.45-2.02 3.08-3.07 5.05-3.07 2.81 0 4.85 2.35 4.85 5.2 0 3.8-2.5 7.9-9.9 12.5Z";
  return p.filled ? <svg {...sp(p)}><path d={d} fill="currentColor" /></svg> : <svg {...sp(p)}><path {...STROKE} d={d} /></svg>;
}
function ShareIcon(p: IconProps) { return <svg {...sp(p)}><path {...STROKE} d="M12 3v13M8 7l4-4 4 4" /><path {...STROKE} d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></svg>; }
function BagIcon(p: IconProps & { cornerGlyph?: "plus" | "minus" | null }) {
  const { cornerGlyph, ...rest } = p;
  const corner = cornerGlyph === "plus"
    ? <g><line x1="20" y1="3.25" x2="23.5" y2="3.25" {...STROKE} /><line x1="21.75" y1="1.5" x2="21.75" y2="5" {...STROKE} /></g>
    : cornerGlyph === "minus" ? <line x1="20" y1="3.25" x2="23.5" y2="3.25" {...STROKE} /> : null;
  return <svg {...sp(rest)} overflow="visible"><path {...STROKE} d="M5.4 7.5h13.2a1 1 0 0 1 1 1.1l-1.2 11.4a1.5 1.5 0 0 1-1.5 1.4H7.1a1.5 1.5 0 0 1-1.5-1.4L4.4 8.6a1 1 0 0 1 1-1.1Z" /><path {...STROKE} d="M8 9V6.5a4 4 0 0 1 8 0V9" />{corner}</svg>;
}
function BackIcon(p: IconProps) { return <svg {...sp(p)}><path {...STROKE} d="M15 5l-7 7 7 7" /></svg>; }
function MoreIcon(p: IconProps) { return <svg {...sp(p)}><circle cx="12" cy="5" r="1.7" fill="currentColor" /><circle cx="12" cy="12" r="1.7" fill="currentColor" /><circle cx="12" cy="19" r="1.7" fill="currentColor" /></svg>; }
function PlayIcon(p: IconProps) { return <svg {...sp(p)}><path d="M7 5l12 7-12 7V5z" fill="currentColor" /></svg>; }
function ReadIcon(p: IconProps) { return <svg {...sp(p)}><path {...STROKE} d="M12 6c-1.8-1.2-4-1.8-6.5-1.8C4 4.2 3 4.6 3 5.4v12c0 .7.7 1 1.5.9C6.7 18 9 18.4 12 20c3-1.6 5.3-2 7.5-1.7.8.1 1.5-.2 1.5-.9v-12c0-.8-1-1.2-2.5-1.2C16 4.2 13.8 4.8 12 6Zm0 0v14" /></svg>; }

function LogoMark({ src, label, height }: { src: string; label: string; height: number }) {
  return <span role="img" aria-label={label} style={{ display: "block", height, width: height, backgroundColor: "currentColor", WebkitMaskImage: `url(${src})`, maskImage: `url(${src})`, WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskPosition: "center", maskPosition: "center" }} />;
}

/* ───────── tabs (mechanics 1:1 from apartsales UnitTabs) ───────── */
type BookTabId = "overview" | "contents" | "author" | "source" | "editions" | "listen";
const BOOK_TABS: { id: BookTabId; label: string }[] = [
  { id: "overview", label: "Главное" },
  { id: "contents", label: "Содержание" },
  { id: "author", label: "Автор" },
  { id: "source", label: "Об источнике" },
  { id: "editions", label: "Издания" },
  { id: "listen", label: "Слушать" },
];

function BookTabs({ active, onChange }: { active: BookTabId; onChange: (id: BookTabId) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  useEffect(() => {
    const el = tabRefs.current[active]; const c = containerRef.current;
    if (!el || !c) return;
    const target = el.offsetLeft - (c.clientWidth - el.clientWidth) / 2;
    c.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [active]);
  return (
    <nav aria-label="Разделы книги" style={{ position: "sticky", top: 56, zIndex: 20, background: "var(--color-header-blur, var(--color-bg))", backdropFilter: "blur(40px) saturate(180%)", WebkitBackdropFilter: "blur(40px) saturate(180%)", borderBottom: "0.5px solid var(--color-hairline)" }}>
      <div ref={containerRef} style={{ display: "flex", alignItems: "center", overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
        {BOOK_TABS.map((t) => {
          const on = t.id === active;
          return (
            <button key={t.id} ref={(el) => { tabRefs.current[t.id] = el; }} type="button" onClick={() => onChange(t.id)}
              style={{ position: "relative", flexShrink: 0, padding: "10px 16px", fontSize: 15, background: "none", border: "none", cursor: "pointer", color: on ? "var(--color-label)" : "var(--color-label-2)", fontWeight: on ? 700 : 500, transition: "color .15s" }}>
              {t.label}
              {on && <span aria-hidden style={{ position: "absolute", insetInline: 12, bottom: 0, height: 2, borderRadius: 999, background: "var(--color-brand-blue)" }} />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* ───────── actions sheet (book functions ⋯) ───────── */
function ActionsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,.4)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "var(--color-bg-2)", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: "8px 0 max(8px, env(safe-area-inset-bottom))", boxShadow: "var(--shadow-card)" }}>
        <div style={{ height: 5, width: 36, borderRadius: 999, background: "var(--color-hairline)", margin: "8px auto 12px" }} />
        {BOOK_MENU_ITEMS.map((label) => (
          <button key={label} onClick={onClose} style={{ display: "block", width: "100%", textAlign: "left", padding: "14px 20px", background: "none", border: "none", fontFamily: "var(--font-text)", fontSize: 17, color: "var(--color-label)", cursor: "pointer" }}>{label}</button>
        ))}
      </div>
    </div>
  );
}

/* ───────── small section primitives (apartsales rhythm) ───────── */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ padding: "0 20px" }}>
      <h2 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 600, letterSpacing: "0.4px", textTransform: "uppercase", color: "var(--color-label-2)" }}>{title}</h2>
      {children}
    </section>
  );
}
function Card({ children }: { children: ReactNode }) {
  return <div style={{ borderRadius: 20, padding: 18, background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)" }}>{children}</div>;
}

/* ───────── tab content ───────── */
function Overview({ book }: { book: BookData }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, paddingTop: 24 }}>
      <Section title="О книге">
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5, color: "var(--color-label)" }}>{book.description}</p>
        <p style={{ margin: "12px 0 0", fontSize: 16, lineHeight: 1.5, color: "var(--color-label-2)" }}>
          «Бхагавад-гита» — беседа Господа Кришны и Арджуны на поле битвы Курукшетра. В 700 стихах изложена наука о душе (атме), Сверхдуше и Верховной Личности Бога, о карме, гьяне и бхакти — пути любовного преданного служения.
        </p>
      </Section>
      <Section title="Факты">
        <Card>
          <KeyVal k="Глав" v="18" />
          <KeyVal k="Стихов" v="700" />
          <KeyVal k="Поведана" v="≈ 5 000 лет назад, Курукшетра" />
          <KeyVal k="Язык издания" v="Русский" last />
        </Card>
      </Section>
    </div>
  );
}
function KeyVal({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: last ? "none" : "0.5px solid var(--color-hairline)" }}>
      <span style={{ fontSize: 15, color: "var(--color-label-2)" }}>{k}</span>
      <span style={{ fontSize: 15, fontWeight: 600, color: "var(--color-label)", textAlign: "right" }}>{v}</span>
    </div>
  );
}

const CHAPTERS = [
  "Обзор армий на поле битвы Курукшетра",
  "Краткое изложение «Бхагавад-гиты»",
  "Карма-йога",
  "Трансцендентное знание",
  "Карма-йога — деятельность в сознании Кришны",
  "Дхьяна-йога",
  "Знание об Абсолюте",
  "Достижение обители Всевышнего",
  "Самое сокровенное знание",
  "Великолепие Абсолюта",
  "Вселенская форма",
  "Преданное служение",
  "Природа, наслаждающийся и сознание",
  "Три гуны материальной природы",
  "Йога Верховной Личности",
  "Божественные и демонические натуры",
  "Разновидности веры",
  "Совершенство отречения",
];
function Contents() {
  return (
    <div style={{ paddingTop: 24 }}>
      <Section title="18 глав">
        <ol style={{ margin: 0, padding: 0, listStyle: "none", borderRadius: 20, overflow: "hidden", background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)" }}>
          {CHAPTERS.map((c, i) => (
            <li key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", borderBottom: i < CHAPTERS.length - 1 ? "0.5px solid var(--color-hairline)" : "none" }}>
              <span style={{ flexShrink: 0, display: "grid", placeItems: "center", height: 26, width: 26, borderRadius: 8, background: "var(--color-glass-regular)", fontSize: 13, fontWeight: 600, color: "var(--color-label-2)" }}>{i + 1}</span>
              <span style={{ fontSize: 15, lineHeight: 1.35, color: "var(--color-label)" }}>{c}</span>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}
function Author() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, paddingTop: 24 }}>
      <Section title="Автор перевода и комментариев">
        <Card>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-label)" }}>Его Божественная Милость А.&nbsp;Ч. Бхактиведанта Свами Прабхупада</div>
          <div style={{ marginTop: 4, fontSize: 14, color: "var(--color-label-2)" }}>Ачарья-основатель Международного общества сознания Кришны (ИСККОН), 1896–1977</div>
          <p style={{ margin: "14px 0 0", fontSize: 15, lineHeight: 1.5, color: "var(--color-label)" }}>
            В 1965 году в возрасте 69 лет прибыл из Индии в США, чтобы исполнить наказ своего духовного учителя — донести учение «Бхагавад-гиты» до англоязычного мира. Основал ИСККОН в 1966 году и за 11 лет перевёл и прокомментировал десятки томов ведической литературы.
          </p>
        </Card>
      </Section>
    </div>
  );
}
function Source() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, paddingTop: 24 }}>
      <Section title="Об источнике">
        <Card>
          <KeyVal k="Поведана" v="Господом Кришной Арджуне" />
          <KeyVal k="Записана" v="Вьясадевой («Махабхарата»)" />
          <KeyVal k="Перевод и комментарии" v="Шрила Прабхупада" last />
        </Card>
        <p style={{ margin: "14px 0 0", fontSize: 15, lineHeight: 1.5, color: "var(--color-label-2)" }}>
          «Бхагавад-гита» входит в «Бхишма-парву» «Махабхараты», составленной мудрецом Вьясадевой. Издание «как она есть» передаёт текст без отклонений от замысла Кришны — в линии ученической преемственности (парампары).
        </p>
      </Section>
    </div>
  );
}
function Editions() {
  return (
    <div style={{ paddingTop: 24 }}>
      <Section title="Издания и языки">
        <Card>
          <KeyVal k="Издатель" v="The Bhaktivedanta Book Trust" />
          <KeyVal k="Текущее издание" v="Русский" />
          <KeyVal k="Также на" v="English · Deutsch · Українська · …" last />
        </Card>
      </Section>
    </div>
  );
}
function Listen() {
  return (
    <div style={{ paddingTop: 24 }}>
      <Section title="Слушать и читать">
        <Card>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: "var(--color-label-2)" }}>Аудиокнига, чтение онлайн и PDF/EPUB будут доступны здесь. Полнотекстовый ридер со стихами (санскрит · транслитерация · пословный перевод · литературный перевод · комментарий) — в разработке.</p>
        </Card>
      </Section>
    </div>
  );
}

/* ───────── round glass action (over hero) ───────── */
function GlassBtn({ active, activeColor, ariaLabel, onClick, children }: { active?: boolean; activeColor?: string; ariaLabel: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={ariaLabel} aria-pressed={active} onClick={onClick}
      style={{ display: "grid", height: 36, width: 36, placeItems: "center", borderRadius: "50%", border: "none", cursor: "pointer", background: "rgba(0,0,0,.45)", color: active && activeColor ? activeColor : "#fff", backdropFilter: "blur(12px)" }}>
      {children}
    </button>
  );
}

/* ═════════ MAIN ═════════ */
export function BookDetailPage({ book, onBack }: { book: BookData; onBack: () => void }) {
  const [idx, setIdx] = useState(0);
  const [favorited, setFavorited] = useState(false);
  const [inCart, setInCart] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [tab, setTab] = useState<BookTabId>("overview");
  const n = book.covers.length;

  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    const onScroll = () => setScrolled(main.scrollTop > 60);
    main.addEventListener("scroll", onScroll, { passive: true });
    return () => main.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div style={{ position: "relative", minHeight: "100%", background: "var(--color-bg)", paddingBottom: "calc(env(safe-area-inset-bottom,0px) + 96px)" }}>
      {/* scroll-aware top bar over hero */}
      <header style={{ position: "sticky", top: 0, zIndex: 30, height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", transition: "background .2s", background: scrolled ? "var(--color-header-blur, var(--color-bg))" : "transparent", backdropFilter: scrolled ? "blur(40px) saturate(180%)" : "none", WebkitBackdropFilter: scrolled ? "blur(40px) saturate(180%)" : "none", borderBottom: scrolled ? "0.5px solid var(--color-hairline)" : "0.5px solid transparent" }}>
        <button aria-label="Назад" onClick={onBack} style={{ display: "grid", height: 36, width: 36, placeItems: "center", borderRadius: "50%", border: "none", cursor: "pointer", background: scrolled ? "transparent" : "rgba(0,0,0,.45)", color: scrolled ? "var(--color-label)" : "#fff", backdropFilter: scrolled ? "none" : "blur(12px)" }}><BackIcon size={22} /></button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <GlassBtn active={favorited} activeColor="#FF453A" ariaLabel="В избранное" onClick={() => setFavorited(v => !v)}><HeartIcon size={18} filled={favorited} /></GlassBtn>
          <GlassBtn ariaLabel="Поделиться" onClick={() => {}}><ShareIcon size={17} /></GlassBtn>
          <GlassBtn active={inCart} activeColor="var(--color-brand-blue)" ariaLabel={inCart ? "Убрать из корзины" : "В корзину"} onClick={() => setInCart(v => !v)}><BagIcon size={18} cornerGlyph={inCart ? "minus" : "plus"} /></GlassBtn>
          <GlassBtn ariaLabel="Меню" onClick={() => setMoreOpen(true)}><MoreIcon size={16} /></GlassBtn>
        </div>
      </header>

      {/* HERO — same carousel as the card, edge-to-edge, pulled under the bar */}
      <article style={{ position: "relative", marginTop: -56, aspectRatio: "4 / 5", overflow: "hidden", background: "var(--color-bg-3)" }}>
        {book.covers.map((src, i) => (
          <img key={src} src={src} alt={book.titleLine1} loading={i === 0 ? "eager" : "lazy"} decoding="async" draggable={false}
            style={{ position: "absolute", inset: 0, height: "100%", width: "100%", objectFit: "cover", opacity: i === idx ? 1 : 0, transition: "opacity .35s ease" }} />
        ))}
        <div aria-hidden style={{ position: "absolute", insetInline: 0, top: 0, height: 120, pointerEvents: "none", background: "linear-gradient(to bottom, rgba(0,0,0,.5) 0%, rgba(0,0,0,0) 100%)" }} />
        <div aria-hidden style={{ position: "absolute", insetInline: 0, bottom: 0, height: "70%", pointerEvents: "none", background: "linear-gradient(to top, rgba(0,0,0,.92) 0%, rgba(0,0,0,.55) 45%, rgba(0,0,0,0) 100%)" }} />
        {n > 1 && (<>
          <button aria-label="Предыдущее" onClick={() => setIdx(i => (i - 1 + n) % n)} style={{ position: "absolute", top: 56, bottom: "40%", left: 0, width: "24%", zIndex: 10, background: "none", border: "none", cursor: "pointer" }} />
          <button aria-label="Следующее" onClick={() => setIdx(i => (i + 1) % n)} style={{ position: "absolute", top: 56, bottom: "40%", right: 0, width: "24%", zIndex: 10, background: "none", border: "none", cursor: "pointer" }} />
          <span style={{ position: "absolute", right: 16, top: 64, zIndex: 12, borderRadius: 999, background: "rgba(0,0,0,.55)", padding: "2px 8px", fontSize: 11, fontWeight: 600, color: "#fff", backdropFilter: "blur(12px)" }}>{idx + 1} / {n}</span>
        </>)}
        <div style={{ position: "absolute", left: 20, bottom: 20, right: 20, zIndex: 12, color: "#fff" }}>
          <div style={{ color: "#fff", marginBottom: 14 }}><LogoMark src="/bbt.svg" label="The Bhaktivedanta Book Trust" height={24} /></div>
          <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.04, fontWeight: 800, letterSpacing: "-0.03em", whiteSpace: "nowrap" }}>{book.titleLine1}</h1>
          {book.titleLine2 && <div style={{ marginTop: 2, fontSize: 23, lineHeight: 1.1, fontWeight: 600, letterSpacing: "-0.02em" }}>{book.titleLine2}</div>}
          <div style={{ marginTop: 6, fontSize: 15, color: "rgba(255,255,255,.72)" }}>{book.iast}<span style={{ margin: "0 6px", color: "rgba(255,255,255,.4)" }}>·</span>{book.tagline}</div>
        </div>
      </article>

      <BookTabs active={tab} onChange={setTab} />

      <div style={{ paddingBottom: 8 }}>
        {tab === "overview" && <Overview book={book} />}
        {tab === "contents" && <Contents />}
        {tab === "author" && <Author />}
        {tab === "source" && <Source />}
        {tab === "editions" && <Editions />}
        {tab === "listen" && <Listen />}
      </div>

      {/* sticky CTA bar */}
      <div style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 0, zIndex: 40, width: "100%", maxWidth: 480, display: "flex", gap: 10, padding: "12px 16px calc(12px + env(safe-area-inset-bottom))", background: "var(--color-header-blur, var(--color-bg))", backdropFilter: "blur(40px) saturate(180%)", WebkitBackdropFilter: "blur(40px) saturate(180%)", borderTop: "0.5px solid var(--color-hairline)" }}>
        <button style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 48, borderRadius: 14, border: "none", cursor: "pointer", background: "var(--color-brand-blue)", color: "#fff", fontFamily: "var(--font-text)", fontSize: 16, fontWeight: 600 }}><ReadIcon size={20} />Читать</button>
        <button style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 48, borderRadius: 14, border: "none", cursor: "pointer", background: "var(--color-glass-regular)", color: "var(--color-label)", fontFamily: "var(--font-text)", fontSize: 16, fontWeight: 600 }}><PlayIcon size={18} />Слушать</button>
      </div>

      <ActionsSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </div>
  );
}
