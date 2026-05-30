import { useState } from "react";
import type { SVGProps } from "react";
import { tk } from "./ui/tokens";
import { Chip } from "./ui/primitives";

/* ───────── icons (geometry traced from apartsales icons.tsx) ───────── */
interface IconProps extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> { size?: number; filled?: boolean; }
const base = ({ size = 26 }: IconProps) => ({ width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true as const });
const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function HeartIcon(p: IconProps) {
  return p.filled
    ? <svg {...base(p)}><path fill="currentColor" d="M12 21.3 4.3 13.6a5 5 0 0 1 7.1-7.1l.6.6.6-.6a5 5 0 1 1 7.1 7.1L12 21.3Z" /></svg>
    : <svg {...base(p)}><path {...STROKE} d="M12 20.3 5 13.3a4.5 4.5 0 0 1 6.4-6.3l.6.6.6-.6A4.5 4.5 0 1 1 19 13.3l-7 7Z" /></svg>;
}
function StarIcon(p: IconProps) { return <svg {...base(p)}><path fill="currentColor" d="m12 2 2.9 6.1 6.6.8-4.9 4.5 1.3 6.5L12 17.8 6.1 20.4l1.3-6.5L2.5 8.9l6.6-.8L12 2Z" /></svg>; }
function HomeIcon(p: IconProps) {
  return p.filled
    ? <svg {...base(p)}><path fill="currentColor" d="M11.32 2.46a1 1 0 0 1 1.36 0l8.68 8.5a1 1 0 0 1 .31.71v8.7c0 1-.8 1.83-1.81 1.83H15v-7.4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1V22.2H4.14A1.81 1.81 0 0 1 2.33 20.37v-8.7c0-.27.11-.53.31-.71l8.68-8.5Z" /></svg>
    : <svg {...base(p)}><path {...STROKE} d="m3 11.4 9-8.4 9 8.4v8.78a.83.83 0 0 1-.83.82H15v-7.5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1V21H3.83a.83.83 0 0 1-.83-.82V11.4Z" /></svg>;
}
function FeedIcon(p: IconProps) { return <svg {...base(p)}><g {...STROKE}><rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.6" /><rect x="13" y="3.5" width="7.5" height="7.5" rx="1.6" /><rect x="3.5" y="13" width="7.5" height="7.5" rx="1.6" /><rect x="13" y="13" width="7.5" height="7.5" rx="1.6" /></g></svg>; }
function SearchIcon(p: IconProps) { return <svg {...base(p)}><g {...STROKE}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></g></svg>; }
function PinIcon(p: IconProps) { return <svg {...base(p)}><g {...STROKE}><path d="M12 21c4.5-4.4 7-7.6 7-11a7 7 0 1 0-14 0c0 3.4 2.5 6.6 7 11Z" /><circle cx="12" cy="10" r="2.5" /></g></svg>; }
function PlusIcon(p: IconProps) { return <svg {...base(p)}><g {...STROKE}><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><path d="M12 8.5v7M8.5 12h7" /></g></svg>; }
function PersonIcon(p: IconProps) { return <svg {...base(p)}><g {...STROKE}><circle cx="12" cy="8.5" r="3.5" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></g></svg>; }

/* ───────── original book cover art (no copyrighted BBT artwork) ───────── */
function spokes(cx: number, cy: number, r1: number, r2: number, n: number, sw: number) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i * 2 * Math.PI) / n;
    return <line key={i} x1={cx + r1 * Math.cos(a)} y1={cy + r1 * Math.sin(a)} x2={cx + r2 * Math.cos(a)} y2={cy + r2 * Math.sin(a)} stroke="#E9C977" strokeWidth={sw} />;
  });
}
function BookCover() {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" style={{ width: "100%", height: "100%", display: "block" }} aria-label="Бхагавад-гита как она есть">
      <defs>
        <linearGradient id="cv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2c2158" /><stop offset=".55" stopColor="#1d1542" /><stop offset="1" stopColor="#160f30" /></linearGradient>
        <radialGradient id="gl" cx="50%" cy="34%" r="60%"><stop offset="0" stopColor="rgba(233,201,119,.30)" /><stop offset="1" stopColor="rgba(233,201,119,0)" /></radialGradient>
      </defs>
      <rect width="400" height="300" fill="url(#cv)" />
      <rect width="400" height="300" fill="url(#gl)" />
      <text x="200" y="56" textAnchor="middle" fill="#E9C977" fontFamily="var(--font-text)" fontSize="17" letterSpacing="1">श्रीमद् भगवद्गीता</text>
      <g transform="translate(0,16)">
        <circle cx="200" cy="150" r="52" fill="none" stroke="#E9C977" strokeWidth="1.3" />
        <circle cx="200" cy="150" r="42" fill="none" stroke="#E9C977" strokeOpacity=".4" strokeWidth="1" />
        {spokes(200, 150, 18, 49, 16, 1.1)}
        <circle cx="200" cy="150" r="13" fill="none" stroke="#E9C977" strokeWidth="1.3" />
        <circle cx="200" cy="150" r="3.5" fill="#E9C977" />
      </g>
      <text x="200" y="248" textAnchor="middle" fill="#F4ECD8" fontFamily="var(--font-display)" fontSize="30" fontWeight="600">Bhagavad-gītā</text>
      <text x="200" y="272" textAnchor="middle" fill="#E9C977" fontFamily="var(--font-text)" fontSize="11" fontWeight="600" letterSpacing="5">AS IT IS</text>
    </svg>
  );
}

/* ───────── BookCard — structure 1:1 with apartsales PropertyCard ───────── */
function BookCard() {
  const [favorited, setFavorited] = useState(false);
  return (
    <article style={{ position: "relative", overflow: "hidden", borderRadius: tk.radius.glass, border: `0.5px solid ${tk.color.glassStroke}`, background: tk.color.fill1 }}>
      <div style={{ position: "relative", aspectRatio: "4 / 3", overflow: "hidden", background: tk.color.bg2 }}>
        <BookCover />
        <div aria-hidden style={{ position: "absolute", insetInline: 0, top: 0, height: 96, pointerEvents: "none", background: "linear-gradient(to bottom, rgba(0,0,0,.55) 0%, rgba(0,0,0,0) 100%)" }} />
        <span style={{ position: "absolute", left: 12, top: 12, display: "flex", alignItems: "center", gap: 6, borderRadius: tk.radius.pill, background: "rgba(0,0,0,.55)", padding: "4px 10px", fontSize: tk.text.caption2, fontWeight: tk.weight.semibold, color: "#fff", backdropFilter: "blur(12px)" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: tk.color.brand }} />Писание
        </span>
        <button type="button" aria-label={favorited ? "Убрать из избранного" : "В избранное"} aria-pressed={favorited} onClick={() => setFavorited(v => !v)}
          style={{ position: "absolute", right: 12, top: 12, display: "grid", placeItems: "center", height: 32, width: 32, borderRadius: "50%", border: "none", cursor: "pointer", background: "rgba(0,0,0,.4)", color: favorited ? "#FF453A" : "#fff", backdropFilter: "blur(12px)", transition: `transform ${tk.duration.fast} ${tk.ease}` }}>
          <span style={{ display: "block", transform: favorited ? "scale(1.08)" : "scale(1)", transition: `transform ${tk.duration.fast} ${tk.ease}` }}><HeartIcon size={18} filled={favorited} /></span>
        </button>
        <div style={{ position: "absolute", left: 12, bottom: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {["Бестселлер", "Аудио"].map(t => (
            <span key={t} style={{ borderRadius: tk.radius.pill, background: "rgba(0,0,0,.55)", padding: "4px 10px", fontSize: tk.text.caption2, fontWeight: tk.weight.semibold, color: "#fff", backdropFilter: "blur(12px)" }}>{t}</span>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: tk.space[2], padding: tk.space[4] }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: tk.space[2] }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: tk.text.callout, fontWeight: tk.weight.semibold, color: tk.color.label, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: tk.tracking.tight }}>Бхагавад-гита как она есть</h3>
            <p style={{ margin: 0, fontSize: tk.text.footnote, color: tk.color.label2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Bhagavad-gītā · Шрила Прабхупада</p>
          </div>
          <span style={{ display: "flex", flexShrink: 0, alignItems: "center", gap: 4, borderRadius: tk.radius.pill, background: tk.color.fill2, padding: "4px 8px", fontSize: tk.text.caption, fontWeight: tk.weight.semibold, color: tk.color.label }}>
            <span style={{ color: "#FFCC00", display: "grid", placeItems: "center" }}><StarIcon size={11} /></span>4.9
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: tk.space[2] }}>
          <span style={{ fontSize: tk.text.title3, fontWeight: tk.weight.bold, color: tk.color.label, letterSpacing: tk.tracking.tight }}>990 ₽</span>
          <span style={{ borderRadius: tk.radius.sm, background: tk.color.infoSurface, padding: "2px 8px", fontSize: tk.text.caption, fontWeight: tk.weight.semibold, color: tk.color.infoText }}>700 стихов</span>
        </div>

        <p style={{ margin: 0, fontSize: tk.text.footnote, color: tk.color.label2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>«Произнесена Кришной Арджуне» · 18 глав · санскрит · аудио · QR</p>

        <div style={{ display: "flex", gap: tk.space[2], marginTop: tk.space[1] }}>
          <Chip>Читать</Chip><Chip>Слушать</Chip><Chip>Поделиться</Chip>
        </div>

        <div style={{ display: "flex", gap: tk.space[2], marginTop: tk.space[1] }}>
          <button style={{ flex: 1, border: "none", borderRadius: tk.radius.control, padding: 12, fontFamily: "var(--font-text)", fontSize: tk.text.subhead, fontWeight: tk.weight.semibold, color: "#fff", background: tk.color.brand, cursor: "pointer" }}>Читать</button>
          <button style={{ flex: 1, border: "none", borderRadius: tk.radius.control, padding: 12, fontFamily: "var(--font-text)", fontSize: tk.text.subhead, fontWeight: tk.weight.semibold, color: tk.color.label, background: tk.color.fill2, cursor: "pointer" }}>Заказать</button>
        </div>
      </div>
    </article>
  );
}

/* ───────── shell ───────── */
function TopBar() {
  return (
    <header className="topbar">
      <button className="tIcon" aria-label="Создать"><PlusIcon size={26} /></button>
      <div className="brand">
        <img className="logo light" src="/logo-black.svg" alt="Gaurāṅgers" />
        <img className="logo dark" src="/logo-white.svg" alt="Gaurāṅgers" />
      </div>
      <button className="tIcon" aria-label="Уведомления"><HeartIcon size={26} /></button>
    </header>
  );
}

const NAV = [
  { key: "home", label: "Главная", Icon: HomeIcon },
  { key: "feed", label: "Лента", Icon: FeedIcon },
  { key: "search", label: "Поиск", Icon: SearchIcon },
  { key: "centers", label: "Центры", Icon: PinIcon },
  { key: "profile", label: "Профиль", Icon: PersonIcon },
] as const;

function TabBar({ active, onChange }: { active: string; onChange: (k: string) => void }) {
  return (
    <nav className="tabbar" role="tablist">
      {NAV.map(({ key, label, Icon }) => (
        <button key={key} className="tab" role="tab" aria-selected={active === key} aria-label={label} onClick={() => onChange(key)}>
          <Icon size={26} filled={active === key} />
        </button>
      ))}
    </nav>
  );
}

function Home() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-block)", padding: "var(--pad-screen-x)", paddingTop: "var(--space-block)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: tk.space[1] }}>
        <div style={{ fontSize: tk.text.caption2, fontWeight: tk.weight.semibold, letterSpacing: tk.tracking.wide, textTransform: "uppercase", color: tk.color.brand }}>Библиотека</div>
        <h2 style={{ margin: 0, fontSize: tk.text.title2, fontWeight: tk.weight.bold, letterSpacing: tk.tracking.tight, color: tk.color.label, fontFamily: "var(--font-display)" }}>Книги Прабхупады</h2>
      </div>
      <BookCard />
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("home");
  return (
    <div className="shell">
      <TopBar />
      <main className="content">{tab === "home" ? <Home /> : null}</main>
      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
