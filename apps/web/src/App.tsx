/**
 * gaurangers.com — оболочка и витринная карточка скопированы 1:1 из apartsales
 * (AppShell + TopHeader + TabBar + UnitCard/UnitHero). Контент — книга БГ.
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
function BagIcon(p: IconProps & { cornerGlyph?: "plus" | "minus" | null }) {
  const { cornerGlyph, ...rest } = p;
  const corner = cornerGlyph === "plus"
    ? <g><line x1="20" y1="3.25" x2="23.5" y2="3.25" {...STROKE} /><line x1="21.75" y1="1.5" x2="21.75" y2="5" {...STROKE} /></g>
    : cornerGlyph === "minus" ? <line x1="20" y1="3.25" x2="23.5" y2="3.25" {...STROKE} /> : null;
  return <svg {...sp(rest)} overflow="visible"><path {...STROKE} d="M5.4 7.5h13.2a1 1 0 0 1 1 1.1l-1.2 11.4a1.5 1.5 0 0 1-1.5 1.4H7.1a1.5 1.5 0 0 1-1.5-1.4L4.4 8.6a1 1 0 0 1 1-1.1Z" /><path {...STROKE} d="M8 9V6.5a4 4 0 0 1 8 0V9" />{corner}</svg>;
}
function StarIcon(p: IconProps) {
  const d = "M12 2.5c.18 0 .35.1.43.27l2.6 5.27c.06.13.18.22.32.24l5.82.85c.4.06.55.55.27.84l-4.21 4.1c-.1.1-.15.24-.13.39l1 5.8c.07.4-.35.7-.7.51l-5.2-2.74a.51.51 0 0 0-.48 0l-5.2 2.74c-.36.19-.78-.11-.7-.51l.99-5.8a.51.51 0 0 0-.13-.39l-4.21-4.1c-.29-.29-.13-.78.27-.84l5.82-.85a.51.51 0 0 0 .32-.24l2.6-5.27c.07-.18.24-.27.42-.27Z";
  return p.filled ? <svg {...sp(p)}><path d={d} fill="currentColor" /></svg> : <svg {...sp(p)}><path {...STROKE} d={d} /></svg>;
}

/* ═════════ BRAND wordmark (gaurangers) ═════════ */
function Wordmark() {
  return (
    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "0 8px" }}>
      <img src="/logo-black.svg" alt="ISKCON ONE LOVE" className="light-logo-only" style={{ width: 65, height: "auto" }} />
      <img src="/logo-white.svg" alt="ISKCON ONE LOVE" className="dark-logo-only" style={{ width: 65, height: "auto" }} />
    </span>
  );
}

/* ═════════ TopHeader (apartsales) — bag / wordmark / heart ═════════ */
function TopHeader() {
  return (
    <header style={{ position: "relative", zIndex: 30, height: 48, flexShrink: 0, background: "var(--color-bg)" }}>
      <div style={{ display: "grid", height: "100%", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "0 12px" }}>
        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <button aria-label="Корзина" style={{ position: "relative", display: "grid", height: 40, width: 40, placeItems: "center", borderRadius: "50%", background: "none", border: "none", color: "var(--color-label)", cursor: "pointer" }}><BagIcon size={26} /></button>
        </div>
        <Wordmark />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
          <button aria-label="Избранное" style={{ display: "grid", height: 40, width: 40, placeItems: "center", borderRadius: "50%", background: "none", border: "none", color: "var(--color-label)", cursor: "pointer" }}><HeartIcon size={24} /></button>
        </div>
      </div>
    </header>
  );
}

/* ═════════ TabBar (apartsales) — 5 tabs, outline, active=brand-blue ═════════ */
const TABS = [
  { id: "home", label: "Главная", Icon: HomeIcon, photo: null },
  { id: "feed", label: "Лента", Icon: FeedIcon, photo: null },
  { id: "search", label: "Поиск", Icon: AISearchIcon, photo: null },
  { id: "map", label: "Карта", Icon: MapPinIcon, photo: null },
  { id: "passport", label: "Паспорт", Icon: null, photo: "/billionsx-avatar.jpeg" },
] as const;

function TabBar({ active, onChange }: { active: string; onChange: (k: string) => void }) {
  return (
    <nav aria-label="Главная навигация" style={{ position: "relative", zIndex: 40, flexShrink: 0, borderTop: "0.5px solid var(--color-hairline)", background: "var(--color-bg)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <ul style={{ display: "flex", height: 48, margin: 0, padding: 0, listStyle: "none", alignItems: "stretch" }}>
        {TABS.map(({ id, label, Icon, photo }) => {
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

/* ═════════ book cover art (original; no copyrighted BBT artwork) ═════════ */
function spokes(cx: number, cy: number, r1: number, r2: number, n: number, sw: number) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i * 2 * Math.PI) / n;
    return <line key={i} x1={cx + r1 * Math.cos(a)} y1={cy + r1 * Math.sin(a)} x2={cx + r2 * Math.cos(a)} y2={cy + r2 * Math.sin(a)} stroke="#E9C977" strokeWidth={sw} />;
  });
}
function BookCover() {
  return (
    <svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, height: "100%", width: "100%", objectFit: "cover" }} aria-label="Бхагавад-гита как она есть">
      <defs>
        <linearGradient id="cv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2c2158" /><stop offset=".55" stopColor="#1d1542" /><stop offset="1" stopColor="#140d2c" /></linearGradient>
        <radialGradient id="gl" cx="50%" cy="30%" r="60%"><stop offset="0" stopColor="rgba(233,201,119,.32)" /><stop offset="1" stopColor="rgba(233,201,119,0)" /></radialGradient>
      </defs>
      <rect width="400" height="500" fill="url(#cv)" />
      <rect width="400" height="500" fill="url(#gl)" />
      <text x="200" y="92" textAnchor="middle" fill="#E9C977" fontFamily="var(--font-text)" fontSize="20" letterSpacing="1">श्रीमद् भगवद्गीता</text>
      <g transform="translate(0,40)">
        <circle cx="200" cy="210" r="74" fill="none" stroke="#E9C977" strokeWidth="1.4" />
        <circle cx="200" cy="210" r="60" fill="none" stroke="#E9C977" strokeOpacity=".4" strokeWidth="1" />
        {spokes(200, 210, 26, 70, 16, 1.3)}
        <circle cx="200" cy="210" r="18" fill="none" stroke="#E9C977" strokeWidth="1.4" />
        <circle cx="200" cy="210" r="5" fill="#E9C977" />
      </g>
      <text x="200" y="372" textAnchor="middle" fill="#F4ECD8" fontFamily="var(--font-display)" fontSize="40" fontWeight="600">Bhagavad-gītā</text>
      <text x="200" y="398" textAnchor="middle" fill="#E9C977" fontFamily="var(--font-text)" fontSize="13" fontWeight="600" letterSpacing="6">AS IT IS</text>
    </svg>
  );
}

/* ═════════ ActionBtn (apartsales UnitCard) — round glass over photo ═════════ */
function ActionBtn({ active, activeColor, ariaLabel, onClick, children }: { active?: boolean; activeColor?: string; ariaLabel: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={ariaLabel} aria-pressed={active}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{ display: "grid", height: 36, width: 36, placeItems: "center", borderRadius: "50%", border: "none", cursor: "pointer", background: "rgba(0,0,0,.45)", color: active && activeColor ? activeColor : "#fff", backdropFilter: "blur(12px)", transition: "background .2s" }}>
      {children}
    </button>
  );
}

/* ═════════ UnitHero (apartsales) — book content ═════════ */
function BookHero({ onOpen }: { onOpen?: () => void }) {
  const [favorited, setFavorited] = useState(false);
  const [compared, setCompared] = useState(false);
  const [inCart, setInCart] = useState(false);
  const photoIdx = 0, photosLen = 3;

  return (
    <div style={{ position: "relative", aspectRatio: "4 / 5", width: "100%", overflow: "hidden", background: "var(--color-bg-3)", userSelect: "none" }}>
      <BookCover />
      {/* gradients */}
      <div aria-hidden style={{ position: "absolute", insetInline: 0, top: 0, height: 96, pointerEvents: "none", background: "linear-gradient(to bottom, rgba(0,0,0,.50) 0%, rgba(0,0,0,0) 100%)" }} />
      <div aria-hidden style={{ position: "absolute", insetInline: 0, bottom: 0, height: "72%", pointerEvents: "none", background: "linear-gradient(to top, rgba(0,0,0,.92) 0%, rgba(0,0,0,.55) 40%, rgba(0,0,0,0) 100%)" }} />
      {/* center tap = open */}
      <button type="button" aria-label="Открыть полностью" onClick={onOpen} style={{ position: "absolute", inset: 0, zIndex: 10, background: "none", border: "none", cursor: "pointer" }} />

      {/* TOP overlay: score + counter + actions */}
      <div style={{ position: "absolute", insetInline: 12, top: 12, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4, borderRadius: 999, background: "rgba(0,0,0,.55)", padding: "4px 8px", fontSize: 12, fontWeight: 600, color: "#fff", backdropFilter: "blur(12px)" }}>
          <StarIcon size={12} filled />4.9
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ borderRadius: 999, background: "rgba(0,0,0,.55)", padding: "2px 8px", fontSize: 11, fontWeight: 600, color: "#fff", backdropFilter: "blur(12px)" }}>{photoIdx + 1} / {photosLen}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <ActionBtn active={favorited} activeColor="#FF453A" ariaLabel="В избранное" onClick={() => setFavorited(v => !v)}><HeartIcon size={18} filled={favorited} /></ActionBtn>
            <ActionBtn active={compared} activeColor="var(--color-brand-blue)" ariaLabel="Сравнить" onClick={() => setCompared(v => !v)}>
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden><rect x="5" y="5" width="6" height="14" rx="1.5" fill="currentColor" /><rect x="13" y="8" width="6" height="11" rx="1.5" fill="currentColor" opacity={compared ? 1 : 0.55} /></svg>
            </ActionBtn>
            <ActionBtn active={inCart} activeColor="var(--color-brand-blue)" ariaLabel="В корзину" onClick={() => setInCart(v => !v)}><BagIcon size={18} cornerGlyph={inCart ? "minus" : "plus"} /></ActionBtn>
            <ActionBtn ariaLabel="Меню действий" onClick={() => {}}>
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="5" r="1.7" fill="currentColor" /><circle cx="12" cy="12" r="1.7" fill="currentColor" /><circle cx="12" cy="19" r="1.7" fill="currentColor" /></svg>
            </ActionBtn>
          </div>
        </div>
      </div>

      {/* INFO block — bottom */}
      <div style={{ position: "absolute", insetInline: 12, bottom: 16, zIndex: 20, filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.6))" }}>
        {/* price */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.3px", color: "#fff" }}>990 ₽</span>
          <span style={{ display: "flex", alignItems: "center", borderRadius: 999, background: "#FF453A", padding: "2px 8px", fontSize: 12, fontWeight: 700, color: "#fff" }}>−15%</span>
        </div>
        {/* subline */}
        <div style={{ marginTop: 2, display: "flex", alignItems: "baseline", gap: 6, fontSize: 13, color: "rgba(255,255,255,.8)" }}>
          <span>аудио + PDF бесплатно</span><span style={{ color: "rgba(255,255,255,.4)" }}>·</span><span>700 стихов</span>
        </div>
        {/* pills */}
        <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4 }}>
          {["18 глав", "санскрит", "IAST", "комментарии"].map(p => (
            <span key={p} style={{ borderRadius: 999, background: "rgba(255,255,255,.15)", padding: "2px 10px", fontSize: 13, fontWeight: 500, color: "#fff", backdropFilter: "blur(4px)" }}>{p}</span>
          ))}
        </div>
        {/* developer + title + meta */}
        <div style={{ marginTop: 16, lineHeight: 1.2 }}>
          <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.4px", color: "rgba(255,255,255,.65)" }}>BBT · Шрила Прабхупада</div>
          <div style={{ marginTop: 2, fontSize: 17, fontWeight: 600, color: "#fff" }}>Бхагавад-гита как она есть</div>
          <div style={{ marginTop: 2, fontSize: 13, color: "rgba(255,255,255,.7)" }}>Bhagavad-gītā<span style={{ margin: "0 4px", color: "rgba(255,255,255,.4)" }}>·</span>«Произнесена Кришной Арджуне»</div>
        </div>
        {/* CTA crumb + verified */}
        <div style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, background: "rgba(42,150,251,.85)", padding: "4px 10px", fontSize: 13, fontWeight: 600, color: "#fff", backdropFilter: "blur(4px)" }}>Читать · Слушать</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4, borderRadius: 999, background: "rgba(0,0,0,.55)", padding: "4px 8px", fontSize: 11, fontWeight: 600, color: "#fff", backdropFilter: "blur(12px)" }}>
            <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#30D158" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>vedabase
          </span>
        </div>
      </div>
    </div>
  );
}

/* ═════════ UnitCard wrapper (apartsales) ═════════ */
function BookCard() {
  return (
    <article style={{ position: "relative", width: "100%", overflow: "hidden", borderRadius: 20, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)" }}>
      <BookHero onOpen={() => {}} />
    </article>
  );
}

/* ═════════ APP SHELL (apartsales) — phone frame on desktop ═════════ */
function Screen({ tab, onChange }: { tab: string; onChange: (k: string) => void }) {
  const mainRef = useRef<HTMLElement>(null);
  return (
    <>
      <TopHeader />
      <main ref={mainRef} style={{ position: "relative", flex: 1, overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain" }}>
        <div style={{ padding: 16 }}>{tab === "home" ? <BookCard /> : null}</div>
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
