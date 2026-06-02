/**
 * gaurangers.com — shell copied 1:1 from apartsales (TopHeader + TabBar + UnitCard/UnitHero).
 * Book card PRESENTS the book (no price/rating/compare/CTA): tap → detail page.
 * Cover: graphite background for now (real BBT artwork to be wired later).
 * Text strictly per Śrīla Prabhupāda. One type family throughout.
 */
import { useState, useRef, useEffect, type ReactNode } from "react";
import type { SVGProps, MouseEvent as ReactMouseEvent } from "react";
import { BookDetailPage } from "./BookDetailPage";
import { BOOKS } from "./books";
import BhajanDetailPage from "./BhajanDetailPage";
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

/* ═════════ TabBar — 5 tabs, outline, active=brand-blue ═════════ */
const TABS = [
  { id: "home", label: "Главная", Icon: HomeIcon, photo: null },
  { id: "feed", label: "Лента", Icon: FeedIcon, photo: null },
  { id: "search", label: "Поиск", Icon: AISearchIcon, photo: null },
  { id: "map", label: "Карта", Icon: MapPinIcon, photo: null },
  { id: "passport", label: "Паспорт", Icon: null, photo: "person" },
] as const;

function TabBar({ active, onChange }: { active: string; onChange: (k: string) => void }) {
  return (
    <nav aria-label="Главная навигация" style={{ position: "sticky", bottom: 0, zIndex: 40, flexShrink: 0, borderTop: "0.5px solid var(--color-hairline)", background: "var(--color-bg)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <ul style={{ display: "flex", height: 48, margin: 0, padding: 0, listStyle: "none", alignItems: "stretch" }}>
        {TABS.map(({ id, label, Icon }) => {
          const on = active === id;
          return (
            <li key={id} style={{ flex: 1 }}>
              <button aria-label={label} aria-current={on ? "page" : undefined} onClick={() => onChange(id)}
                style={{ position: "relative", display: "flex", height: "100%", width: "100%", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: on ? "var(--color-brand-blue)" : "var(--color-label)", transition: "color 180ms ease-out" }}>
                {Icon ? <Icon size={26} filled={false} /> : (
                  <span style={{ display: "grid", height: 26, width: 26, placeItems: "center", borderRadius: "50%", background: "var(--color-glass-regular)", color: "var(--color-label-2)", boxShadow: on ? "0 0 0 2px var(--color-brand-blue)" : "0 0 0 1px var(--color-hairline)" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 11.6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /><path d="M5.8 20c.7-3.6 3.1-5.5 6.2-5.5s5.5 1.9 6.2 5.5z" /></svg>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
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

/* ═════════ round glass action button ═════════ */
function ActionBtn({ active, activeColor, ariaLabel, onClick, children }: { active?: boolean; activeColor?: string; ariaLabel: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={ariaLabel} aria-pressed={active}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{ display: "grid", height: 36, width: 36, placeItems: "center", borderRadius: "50%", border: "none", cursor: "pointer", background: "rgba(255,255,255,.12)", color: active && activeColor ? activeColor : "#fff", backdropFilter: "blur(12px)", transition: "background .2s" }}>
      {children}
    </button>
  );
}

/* ═════════ ⋯ menu (book functions) ═════════ */
const MENU_ITEMS = [
  "Читать онлайн", "Слушать аудиокнигу", "Скачать PDF / EPUB",
  "Язык издания — Русский", "Добавить в план чтения", "Поделиться · QR-код",
  "Заказать печатную книгу", "Поддержать печать", "О книге и об авторе", "Стих дня из книги",
];
function ActionsMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,.4)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "var(--color-bg-2)", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: "8px 0 max(8px, env(safe-area-inset-bottom))", boxShadow: "var(--shadow-card)" }}>
        <div style={{ height: 5, width: 36, borderRadius: 999, background: "var(--color-hairline)", margin: "8px auto 12px" }} />
        {MENU_ITEMS.map((label) => (
          <button key={label} onClick={onClose} style={{ display: "block", width: "100%", textAlign: "left", padding: "14px 20px", background: "none", border: "none", fontFamily: "var(--font-text)", fontSize: 17, color: "var(--color-label)", cursor: "pointer" }}>{label}</button>
        ))}
      </div>
    </div>
  );
}

/* ═════════ book card — painting carousel (blue chariot first), presents the book ═════════ */
// bg-003 = синяя колесница (Кришна правит четвёркой белых коней, Арджуна, красный флаг) — обложка.
const COVERS = [
  "/covers/bg-003.png?v=4", // синяя колесница — обложка
  "/covers/bg-002.png?v=4",
  "/covers/bg-005.png?v=4",
  "/covers/bg-004.png?v=4",
  "/covers/bg-007.png?v=4",
  "/covers/bg-006.png?v=4",
  "/covers/bg-001.png?v=4",
];
const GRAPHITE = "radial-gradient(120% 80% at 50% 0%, #3a3a40 0%, #2a2a2f 45%, #1b1b1f 100%)";

function BookCard({ onOpen }: { onOpen?: () => void }) {
  const [favorited, setFavorited] = useState(false);
  const [inCart, setInCart] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const n = COVERS.length;
  const next = (e?: ReactMouseEvent) => { e?.stopPropagation(); setIdx(i => (i + 1) % n); };
  const prev = (e?: ReactMouseEvent) => { e?.stopPropagation(); setIdx(i => (i - 1 + n) % n); };

  return (
    <>
      <article
        style={{
          position: "relative", width: "100%", aspectRatio: "4 / 5", overflow: "hidden", borderRadius: 20,
          border: "0.5px solid var(--color-hairline)", background: GRAPHITE,
          boxShadow: "var(--shadow-card)",
          display: "flex", flexDirection: "column", justifyContent: "flex-end",
        }}>
        {/* cover images (current shown) */}
        {COVERS.map((src, i) => (
          <img key={src} src={src} alt="Бхагавад-гита как она есть" loading={i === 0 ? "eager" : "lazy"} decoding="async" draggable={false}
            style={{ position: "absolute", inset: 0, height: "100%", width: "100%", objectFit: "cover", opacity: i === idx ? 1 : 0, transition: "opacity .35s ease" }} />
        ))}
        {/* legibility gradients over photo */}
        <div aria-hidden style={{ position: "absolute", insetInline: 0, top: 0, height: 120, pointerEvents: "none", background: "linear-gradient(to bottom, rgba(0,0,0,.55) 0%, rgba(0,0,0,0) 100%)" }} />
        <div aria-hidden style={{ position: "absolute", insetInline: 0, bottom: 0, height: "78%", pointerEvents: "none", background: "linear-gradient(to top, rgba(0,0,0,.92) 0%, rgba(0,0,0,.6) 42%, rgba(0,0,0,0) 100%)" }} />

        {/* center opens detail; invisible edge zones flip the gallery */}
        <button type="button" aria-label="Открыть книгу" onClick={() => onOpen?.()} style={{ position: "absolute", inset: 0, zIndex: 10, background: "none", border: "none", cursor: "pointer" }} />
        {n > 1 && (
          <>
            <button type="button" aria-label="Предыдущее изображение" onClick={prev} style={{ position: "absolute", top: 56, bottom: "42%", left: 0, width: "22%", zIndex: 15, background: "none", border: "none", cursor: "pointer" }} />
            <button type="button" aria-label="Следующее изображение" onClick={next} style={{ position: "absolute", top: 56, bottom: "42%", right: 0, width: "22%", zIndex: 15, background: "none", border: "none", cursor: "pointer" }} />
          </>
        )}

        {/* TOP: BBT logo (left) · counter + actions (right) */}
        <div style={{ position: "absolute", insetInline: 20, top: 20, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ display: "flex", alignItems: "center", color: "#fff" }}>
            <LogoMark src="/bbt.svg" label="The Bhaktivedanta Book Trust" height={26} />
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ borderRadius: 999, background: "rgba(0,0,0,.55)", padding: "2px 8px", fontSize: 11, fontWeight: 600, color: "#fff", backdropFilter: "blur(12px)" }}>{idx + 1} / {n}</span>
            <ActionBtn active={favorited} activeColor="#FF453A" ariaLabel="В избранное" onClick={() => setFavorited(v => !v)}><HeartIcon size={18} filled={favorited} /></ActionBtn>
            <ActionBtn ariaLabel="Поделиться" onClick={() => {}}><ShareIcon size={17} /></ActionBtn>
            <ActionBtn active={inCart} activeColor="var(--color-brand-blue)" ariaLabel={inCart ? "Убрать из корзины" : "В корзину"} onClick={() => setInCart(v => !v)}><BagIcon size={18} cornerGlyph={inCart ? "minus" : "plus"} /></ActionBtn>
            <ActionBtn ariaLabel="Меню" onClick={() => setMenuOpen(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="5" r="1.7" fill="currentColor" /><circle cx="12" cy="12" r="1.7" fill="currentColor" /><circle cx="12" cy="19" r="1.7" fill="currentColor" /></svg>
            </ActionBtn>
          </div>
        </div>

        {/* INFO — bottom. Standard type scale (apartsales): title 28/700, body 15/400, line-height 1.4 */}
        <div onClick={() => onOpen?.()} style={{ position: "relative", zIndex: 20, padding: 20, cursor: "pointer", fontFamily: "var(--font-text)", pointerEvents: "none" }}>
          <h3 style={{ margin: 0, fontSize: 36, lineHeight: 1.04, fontWeight: 800, letterSpacing: "-0.03em", color: "#fff", whiteSpace: "nowrap" }}>Бхагавад-гита</h3>
          <div style={{ marginTop: 2, fontSize: 25, lineHeight: 1.1, fontWeight: 600, letterSpacing: "-0.02em", color: "rgba(255,255,255,.95)" }}>как она есть</div>
          <div style={{ marginTop: 6, fontSize: 15, lineHeight: 1.3, fontWeight: 400, letterSpacing: "-0.01em", color: "rgba(255,255,255,.72)" }}>Bhagavad-gītā<span style={{ margin: "0 6px", color: "rgba(255,255,255,.4)" }}>·</span>Песнь Бога</div>

          <p style={{ margin: "16px 0 0", fontSize: 15, lineHeight: 1.35, fontWeight: 400, letterSpacing: "-0.01em", color: "rgba(255,255,255,.92)" }}>
            Его Божественная Милость А.&nbsp;Ч. Бхактиведанта Свами Прабхупада, Ачарья-основатель Международного общества сознания Кришны, ИСККОН
          </p>

          <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.35, fontWeight: 400, letterSpacing: "-0.01em", color: "rgba(255,255,255,.82)" }}>
            Квинтэссенция ведического знания: природа вечной души, Верховная Личность Бога и путь преданного служения.
          </p>

          <div style={{ marginTop: 20, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
            {["18 глав", "700 стихов", "5 000+ лет"].map(p => (
              <span key={p} style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, background: "rgba(255,255,255,.16)", height: 26, padding: "0 12px", fontSize: 13, lineHeight: 1, fontWeight: 500, letterSpacing: "-0.01em", color: "#fff" }}>{p}</span>
            ))}
          </div>
        </div>
      </article>
      <ActionsMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
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

function Screen({ tab, onChange, onOpenBook, onOpenBhajan, onOpenCatalog }: { tab: string; onChange: (k: string) => void; onOpenBook: () => void; onOpenBhajan: (slug: string) => void; onOpenCatalog: () => void }) {
  const mainRef = useRef<HTMLElement>(null);
  return (
    <>
      <TopHeader />
      <main ref={mainRef} style={{ position: "relative", flex: 1, overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain" }}>
        <div style={{ padding: 16 }}>
          {tab === "home" ? (
            <>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.4px", textTransform: "uppercase", color: "var(--color-brand-blue)" }}>Библиотека</div>
                <h2 style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 700, letterSpacing: "-0.3px", color: "var(--color-label)", fontFamily: "var(--font-text)" }}>Книги Прабхупады</h2>
              </div>
              <BookCard onOpen={onOpenBook} />
              <BhajanShelf onOpen={onOpenBhajan} onOpenCatalog={onOpenCatalog} />
            </>
          ) : null}
        </div>
      </main>
      <TabBar active={tab} onChange={onChange} />
    </>
  );
}

export default function App() {
  const [tab, setTab] = useState("home");
  const [openBook, setOpenBook] = useState(false);
  const [openBhajan, setOpenBhajan] = useState<string | null>(null);
  const [openCatalog, setOpenCatalog] = useState(false);
  return (
    <div style={{ display: "flex", justifyContent: "center", minHeight: "100vh", width: "100%", background: "var(--color-bg)", color: "var(--color-label)" }}>
      <div style={{ position: "relative", display: "flex", flexDirection: "column", width: "100%", maxWidth: 480, minHeight: "100dvh", background: "var(--color-bg)" }}>
        {openBook ? (
          <main style={{ position: "relative", height: "100dvh", overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
            <BookDetailPage book={BOOKS.bg} onBack={() => setOpenBook(false)} />
          </main>
        ) : openBhajan ? (
          <main style={{ position: "relative", height: "100dvh", overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
            <BhajanDetailPage slug={openBhajan} onBack={() => setOpenBhajan(null)} />
          </main>
        ) : openCatalog ? (
          <main style={{ position: "relative", height: "100dvh", overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
            <BhajanCatalog onOpen={(slug) => { setOpenCatalog(false); setOpenBhajan(slug); }} onBack={() => setOpenCatalog(false)} />
          </main>
        ) : (
          <Screen tab={tab} onChange={setTab} onOpenBook={() => setOpenBook(true)} onOpenBhajan={setOpenBhajan} onOpenCatalog={() => setOpenCatalog(true)} />
        )}
      </div>
    </div>
  );
}
