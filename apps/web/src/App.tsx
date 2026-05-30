import { useState } from "react";
import { ICONS } from "./icons";
import { tk } from "./ui/tokens";
import { Chip } from "./ui/primitives";

/* ───────── ORIGINAL MENU (restored verbatim) ───────── */
// cqw per reference px: 1cqw = 1% of shell width; reference shell = 393pt = 1179px(@3x)
const F = 100 / (393 * 3); // ≈ 0.084818

const Img = ({ name }: { name: string }) => {
  const ic = ICONS[name];
  return (
    <img className="glyph" src={ic.uri} alt="" draggable={false}
      style={{ height: `${(ic.h * F).toFixed(2)}cqw`, width: `${(ic.w * F).toFixed(2)}cqw` }} />
  );
};

function TopBar() {
  return (
    <header className="topbar">
      <button className="tIcon" aria-label="Создать"><Img name="plus" /></button>
      <div className="brand">
        <img className="logo light" src="/logo-black.svg" alt="Gaurāṅgers" />
        <img className="logo dark" src="/logo-white.svg" alt="Gaurāṅgers" />
      </div>
      <button className="tIcon" aria-label="Уведомления"><Img name="heart" /></button>
    </header>
  );
}

const NAV = [
  { key: "home", label: "Главная", icon: "home" },
  { key: "reels", label: "Reels", icon: "reels" },
  { key: "direct", label: "Сообщения", icon: "plane" },
  { key: "search", label: "Поиск", icon: "search" },
  { key: "profile", label: "Профиль", avatar: true },
] as const;

function TabBar({ active, onChange }: { active: string; onChange: (k: string) => void }) {
  return (
    <nav className="tabbar" role="tablist">
      {NAV.map((t) => {
        const on = active === t.key;
        if ("avatar" in t && t.avatar) {
          return (
            <button key={t.key} className="tab" role="tab" aria-selected={on} aria-label={t.label} onClick={() => onChange(t.key)}>
              <span className={"avatar" + (on ? " on" : "")}>
                <svg className="avPerson" viewBox="0 0 24 24" fill="#8B8B8B"><path d="M12 11.6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /><path d="M5.8 20c.7-3.6 3.1-5.5 6.2-5.5s5.5 1.9 6.2 5.5z" /></svg>
                <i className="reddot" />
              </span>
            </button>
          );
        }
        return (
          <button key={t.key} className="tab" role="tab" aria-selected={on} aria-label={t.label} onClick={() => onChange(t.key)}>
            <Img name={(t as any).icon} />
          </button>
        );
      })}
    </nav>
  );
}

/* ───────── book cover art (original; no copyrighted BBT artwork) ───────── */
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

function HeartGlyph({ filled }: { filled: boolean }) {
  return filled
    ? <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden><path fill="#FF453A" d="M12 21.3 4.3 13.6a5 5 0 0 1 7.1-7.1l.6.6.6-.6a5 5 0 1 1 7.1 7.1L12 21.3Z" /></svg>
    : <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden><path fill="none" stroke="#fff" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" d="M12 20.3 5 13.3a4.5 4.5 0 0 1 6.4-6.3l.6.6.6-.6A4.5 4.5 0 1 1 19 13.3l-7 7Z" /></svg>;
}
function StarGlyph() {
  return <svg width={11} height={11} viewBox="0 0 24 24" aria-hidden><path fill="currentColor" d="m12 2 2.9 6.1 6.6.8-4.9 4.5 1.3 6.5L12 17.8 6.1 20.4l1.3-6.5L2.5 8.9l6.6-.8L12 2Z" /></svg>;
}

/* ───────── BookCard — apartsales PropertyCard structure 1:1 ───────── */
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
          style={{ position: "absolute", right: 12, top: 12, display: "grid", placeItems: "center", height: 32, width: 32, borderRadius: "50%", border: "none", cursor: "pointer", background: "rgba(0,0,0,.4)", backdropFilter: "blur(12px)", transition: `transform ${tk.duration.fast} ${tk.ease}` }}>
          <span style={{ display: "block", transform: favorited ? "scale(1.08)" : "scale(1)", transition: `transform ${tk.duration.fast} ${tk.ease}` }}><HeartGlyph filled={favorited} /></span>
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
            <span style={{ color: "#FFCC00", display: "grid", placeItems: "center" }}><StarGlyph /></span>4.9
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
