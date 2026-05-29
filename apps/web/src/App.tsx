import { useState } from "react";
import { ICONS } from "./icons";

// Top-bar icons (create + heart), drawn to Instagram weight
const Glyph = ({ paths, size = 25, sw = 1.9 }: { paths: string[]; size?: number; sw?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {paths.map((p, i) => <path key={i} d={p} />)}
  </svg>
);
const CREATE = ["M6 4.7h12A1.3 1.3 0 0 1 19.3 6v12A1.3 1.3 0 0 1 18 19.3H6A1.3 1.3 0 0 1 4.7 18V6A1.3 1.3 0 0 1 6 4.7z", "M12 8.6v6.8", "M8.6 12h6.8"];
const HEART = ["M12 20.3C7 17 3.5 13.5 3.5 9.6 3.5 7 5.4 5.2 7.8 5.2c1.7 0 3.2 1 4.2 2.5 1-1.5 2.5-2.5 4.2-2.5 2.4 0 4.3 1.8 4.3 4.4 0 3.9-3.5 7.4-8.5 10.7z"];

function TopBar() {
  return (
    <header className="topbar">
      <div className="brand">Gaurāṅgers</div>
      <div className="topActions">
        <button aria-label="Создать"><Glyph paths={CREATE} /></button>
        <button aria-label="Уведомления"><Glyph paths={HEART} /></button>
      </div>
    </header>
  );
}

// Bottom nav: glyphs traced pixel-for-pixel from the reference; icon render height set
// to the screenshot's proportion (22pt of 393 ≈ 5.6% → ~27px in a 480 container).
const NAV = [
  { key: "home", label: "Главная", icon: "home" },
  { key: "reels", label: "Reels", icon: "reels" },
  { key: "direct", label: "Сообщения", icon: "plane" },
  { key: "search", label: "Поиск", icon: "search" },
  { key: "profile", label: "Профиль", avatar: true },
] as const;

const ICON_H = 27; // px, proportional to the measured 22pt glyph

function TabBar({ active, onChange }: { active: string; onChange: (k: string) => void }) {
  return (
    <nav className="tabbar" role="tablist">
      {NAV.map((t) => {
        const on = active === t.key;
        if ("avatar" in t && t.avatar) {
          return (
            <button key={t.key} className="tab" role="tab" aria-selected={on} aria-label={t.label} onClick={() => onChange(t.key)}>
              <span className={"avatar" + (on ? " on" : "")}>
                <svg className="avPerson" viewBox="0 0 24 24" width="20" height="20" fill="#8B8B8B">
                  <path d="M12 11.6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                  <path d="M5.8 20c.7-3.6 3.1-5.5 6.2-5.5s5.5 1.9 6.2 5.5z" />
                </svg>
                <i className="reddot" />
              </span>
            </button>
          );
        }
        const ic = ICONS[(t as any).icon];
        return (
          <button key={t.key} className="tab" role="tab" aria-selected={on} aria-label={t.label} onClick={() => onChange(t.key)}>
            <img src={ic.uri} alt="" draggable={false}
              style={{ height: ICON_H, width: (ic.w / ic.h) * ICON_H, display: "block" }} />
          </button>
        );
      })}
    </nav>
  );
}

export default function App() {
  const [tab, setTab] = useState("home");
  return (
    <div className="shell">
      <TopBar />
      <main className="content" />
      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
