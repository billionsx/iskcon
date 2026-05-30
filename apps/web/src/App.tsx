/**
 * gaurangers.com — shell copied 1:1 from apartsales (TopHeader + TabBar + UnitCard/UnitHero).
 * Book card PRESENTS the book (no price/rating/compare/CTA): tap → detail page.
 * Covers: official BBT artwork (images.bbtmedia.com), fallback to branded emblem.
 * Text strictly per Śrīla Prabhupāda (full title; framing from his Introduction).
 */
import { useState, useRef, type ReactNode } from "react";
import type { SVGProps } from "react";

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
/** Bag with corner +/− glyph (apartsales cart on card) */
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

/* ═════════ logo mark — monochrome via mask (white over photo) ═════════ */
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

/* ═════════ branded emblem (fallback when a BBT cover fails to load) ═════════ */
function spokes(cx: number, cy: number, r1: number, r2: number, n: number, sw: number) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i * 2 * Math.PI) / n;
    return <line key={i} x1={cx + r1 * Math.cos(a)} y1={cy + r1 * Math.sin(a)} x2={cx + r2 * Math.cos(a)} y2={cy + r2 * Math.sin(a)} stroke="#E9C977" strokeWidth={sw} />;
  });
}
function EmblemCover() {
  return (
    <svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, height: "100%", width: "100%" }} aria-hidden>
      <defs>
        <linearGradient id="cv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2c2158" /><stop offset=".55" stopColor="#1d1542" /><stop offset="1" stopColor="#140d2c" /></linearGradient>
        <radialGradient id="gl" cx="50%" cy="34%" r="60%"><stop offset="0" stopColor="rgba(233,201,119,.30)" /><stop offset="1" stopColor="rgba(233,201,119,0)" /></radialGradient>
      </defs>
      <rect width="400" height="500" fill="url(#cv)" /><rect width="400" height="500" fill="url(#gl)" />
      <g transform="translate(0,10)">
        <circle cx="200" cy="250" r="74" fill="none" stroke="#E9C977" strokeWidth="1.4" />
        <circle cx="200" cy="250" r="60" fill="none" stroke="#E9C977" strokeOpacity=".4" strokeWidth="1" />
        {spokes(200, 250, 26, 70, 16, 1.3)}
        <circle cx="200" cy="250" r="18" fill="none" stroke="#E9C977" strokeWidth="1.4" />
        <circle cx="200" cy="250" r="5" fill="#E9C977" />
      </g>
    </svg>
  );
}

/* Official BBT cover artwork (front covers). */
const COVERS = [
  "https://www.images.bbtmedia.com/sites/default/files/styles/medium/public/covers_front/UK%20BG%202015%20front%20cover.jpg?itok=wng7Gkyk",
  "https://www.images.bbtmedia.com/sites/default/files/styles/medium/public/covers_front/DE%20BG%202012%20cover%20front_0.jpg?itok=Nj9Q9Rw8",
  "https://www.images.bbtmedia.com/sites/default/files/styles/medium/public/covers_front/GB-BGV-89.jpg?itok=bqjye2kB",
];

function CoverImage({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <EmblemCover />;
  return (
    <img src={src} alt="Бхагавад-гита как она есть — обложка" loading="eager" decoding="async" draggable={false}
      onError={() => setFailed(true)}
      style={{ position: "absolute", inset: 0, height: "100%", width: "100%", objectFit: "cover" }} />
  );
}

/* ═════════ round glass action button ═════════ */
function ActionBtn({ active, activeColor, ariaLabel, onClick, children }: { active?: boolean; activeColor?: string; ariaLabel: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={ariaLabel} aria-pressed={active}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{ display: "grid", height: 36, width: 36, placeItems: "center", borderRadius: "50%", border: "none", cursor: "pointer", background: "rgba(0,0,0,.45)", color: active && activeColor ? activeColor : "#fff", backdropFilter: "blur(12px)", transition: "background .2s" }}>
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

/* ═════════ UnitHero — adapted to PRESENT a book ═════════ */
function BookHero({ onOpen }: { onOpen?: () => void }) {
  const [favorited, setFavorited] = useState(false);
  const [inCart, setInCart] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);
  const photosLen = COVERS.length;
  const next = () => setPhotoIdx((i) => (i + 1) % photosLen);
  const prev = () => setPhotoIdx((i) => (i - 1 + photosLen) % photosLen);

  return (
    <>
      <div style={{ position: "relative", aspectRatio: "4 / 5", width: "100%", overflow: "hidden", background: "var(--color-bg-3)", userSelect: "none" }}>
        <CoverImage key={photoIdx} src={COVERS[photoIdx]} />
        {/* gradients */}
        <div aria-hidden style={{ position: "absolute", insetInline: 0, top: 0, height: 110, pointerEvents: "none", background: "linear-gradient(to bottom, rgba(0,0,0,.55) 0%, rgba(0,0,0,0) 100%)" }} />
        <div aria-hidden style={{ position: "absolute", insetInline: 0, bottom: 0, height: "78%", pointerEvents: "none", background: "linear-gradient(to top, rgba(0,0,0,.94) 0%, rgba(0,0,0,.6) 42%, rgba(0,0,0,0) 100%)" }} />

        {/* photo nav zones (edges) + center opens detail */}
        <button type="button" aria-label="Предыдущее фото" onClick={prev} style={{ position: "absolute", insetBlock: 0, left: 0, width: "15%", zIndex: 10, background: "none", border: "none", cursor: "pointer" }} />
        <button type="button" aria-label="Открыть книгу" onClick={onOpen} style={{ position: "absolute", insetBlock: 0, left: "15%", right: "15%", zIndex: 10, background: "none", border: "none", cursor: "pointer" }} />
        <button type="button" aria-label="Следующее фото" onClick={next} style={{ position: "absolute", insetBlock: 0, right: 0, width: "15%", zIndex: 10, background: "none", border: "none", cursor: "pointer" }} />

        {/* TOP overlay: ISKCON + BBT (left, where rating was) · counter + actions (right) */}
        <div style={{ position: "absolute", insetInline: 12, top: 12, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 10, height: 34, padding: "0 12px", borderRadius: 999, background: "rgba(0,0,0,.45)", color: "#fff", backdropFilter: "blur(12px)" }}>
            <LogoMark src="/iskcon-sign.svg" label="ISKCON" height={20} />
            <LogoMark src="/bbt.svg" label="The Bhaktivedanta Book Trust" height={20} />
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ borderRadius: 999, background: "rgba(0,0,0,.55)", padding: "2px 8px", fontSize: 11, fontWeight: 600, color: "#fff", backdropFilter: "blur(12px)" }}>{photoIdx + 1} / {photosLen}</span>
            <ActionBtn active={favorited} activeColor="#FF453A" ariaLabel="В избранное" onClick={() => setFavorited(v => !v)}><HeartIcon size={18} filled={favorited} /></ActionBtn>
            <ActionBtn ariaLabel="Поделиться" onClick={() => {}}><ShareIcon size={17} /></ActionBtn>
            <ActionBtn active={inCart} activeColor="var(--color-brand-blue)" ariaLabel={inCart ? "Убрать из корзины" : "В корзину"} onClick={() => setInCart(v => !v)}><BagIcon size={18} cornerGlyph={inCart ? "minus" : "plus"} /></ActionBtn>
            <ActionBtn ariaLabel="Меню" onClick={() => setMenuOpen(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="5" r="1.7" fill="currentColor" /><circle cx="12" cy="12" r="1.7" fill="currentColor" /><circle cx="12" cy="19" r="1.7" fill="currentColor" /></svg>
            </ActionBtn>
          </div>
        </div>

        {/* INFO block — presents the book (tap opens detail) */}
        <div onClick={onOpen} style={{ position: "absolute", insetInline: 16, bottom: 16, zIndex: 20, cursor: "pointer", filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.6))" }}>
          <div style={{ fontSize: 25, fontWeight: 700, letterSpacing: "-0.3px", lineHeight: 1.1, color: "#fff", fontFamily: "var(--font-display)" }}>Бхагавад-гита как она есть</div>
          <div style={{ marginTop: 4, fontSize: 13, color: "rgba(255,255,255,.72)" }}>Bhagavad-gītā<span style={{ margin: "0 5px", color: "rgba(255,255,255,.4)" }}>·</span>«Произнесена Господом Кришной Арджуне»</div>

          {/* full title of the author */}
          <div style={{ marginTop: 12, lineHeight: 1.3 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "#fff" }}>Его Божественная Милость А.&nbsp;Ч. Бхактиведанта Свами Прабхупада</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.7)" }}>Ачарья-основатель Международного общества сознания Кришны</div>
          </div>

          {/* description — strictly per Prabhupada's Introduction framing */}
          <p style={{ margin: "12px 0 0", fontSize: 14.5, lineHeight: 1.45, color: "rgba(255,255,255,.88)" }}>
            Квинтэссенция ведического знания: беседа Господа Кришны и Арджуны о вечной душе, Верховной Личности Бога и пути преданного служения.
          </p>

          {/* pills — only chapters & verses */}
          <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
            {["18 глав", "700 стихов"].map(p => (
              <span key={p} style={{ borderRadius: 999, background: "rgba(255,255,255,.16)", padding: "3px 11px", fontSize: 13, fontWeight: 500, color: "#fff", backdropFilter: "blur(4px)" }}>{p}</span>
            ))}
          </div>
        </div>
      </div>
      <ActionsMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}

function BookCard() {
  return (
    <article style={{ position: "relative", width: "100%", overflow: "hidden", borderRadius: 20, border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)", boxShadow: "var(--shadow-card)" }}>
      <BookHero onOpen={() => {}} />
    </article>
  );
}

function Screen({ tab, onChange }: { tab: string; onChange: (k: string) => void }) {
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
                <h2 style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 700, letterSpacing: "-0.3px", color: "var(--color-label)", fontFamily: "var(--font-display)" }}>Книги Прабхупады</h2>
              </div>
              <BookCard />
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
  return (
    <div style={{ display: "flex", justifyContent: "center", minHeight: "100vh", width: "100%", background: "var(--color-bg)", color: "var(--color-label)" }}>
      <div style={{ position: "relative", display: "flex", flexDirection: "column", width: "100%", maxWidth: 480, minHeight: "100dvh", background: "var(--color-bg)" }}>
        <Screen tab={tab} onChange={setTab} />
      </div>
    </div>
  );
}
