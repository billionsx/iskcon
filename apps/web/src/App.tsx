import { useState } from "react";

type GlyphProps = { paths: string[]; fill?: boolean; size?: number; sw?: number };
const Glyph = ({ paths, fill = false, size = 26, sw = 1.9 }: GlyphProps) => (
  <svg viewBox="0 0 24 24" width={size} height={size}
    fill={fill ? "currentColor" : "none"}
    stroke={fill ? "none" : "currentColor"}
    strokeWidth={fill ? 0 : sw} strokeLinecap="round" strokeLinejoin="round">
    {paths.map((p, i) => <path key={i} d={p} />)}
  </svg>
);

// ---- top bar (Instagram home: create + heart) ----
const CREATE = ["M6 4.7h12A1.3 1.3 0 0 1 19.3 6v12A1.3 1.3 0 0 1 18 19.3H6A1.3 1.3 0 0 1 4.7 18V6A1.3 1.3 0 0 1 6 4.7z", "M12 8.6v6.8", "M8.6 12h6.8"];
const HEART = ["M12 20.3C7 17 3.5 13.5 3.5 9.6 3.5 7 5.4 5.2 7.8 5.2c1.7 0 3.2 1 4.2 2.5 1-1.5 2.5-2.5 4.2-2.5 2.4 0 4.3 1.8 4.3 4.4 0 3.9-3.5 7.4-8.5 10.7z"];

// ---- bottom nav: EXACT Instagram set/order ----
const HOME_O = ["M3.7 11 12 4.3l8.3 6.7", "M5.7 9.5V19a1 1 0 0 0 1 1h10.6a1 1 0 0 0 1-1V9.5"];
const HOME_F = ["M12 3.9 3.9 10.5a1 1 0 0 0-.36.77V19a1 1 0 0 0 1 1h5.1v-5.3a1 1 0 0 1 1-1h2.7a1 1 0 0 1 1 1V20h5.1a1 1 0 0 0 1-1v-7.7a1 1 0 0 0-.36-.78z"];
const REELS = [
  "M5 5.7h14A1.3 1.3 0 0 1 20.3 7v10A1.3 1.3 0 0 1 19 18.3H5A1.3 1.3 0 0 1 3.7 17V7A1.3 1.3 0 0 1 5 5.7z",
  "M3.9 9.6h16.2",
  "M8.7 5.8 10.9 9.6",
  "M14.2 5.8 16.4 9.6",
  "M10.7 11.9v3.2l2.8-1.6z",
];
const PLANE = ["M21.4 3.6 2.9 10.9c-.55.2-.5 1 .05 1.15l8.2 2.2 2.2 8.2c.15.55.95.6 1.15.05z", "M21.4 3.6 10.4 14.6"];
const SEARCH = ["M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z", "M20.5 20.5 16.2 16.2"];
const PERSON = ["M12 11.6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M5.8 19.3c.7-3.4 3.1-5.2 6.2-5.2s5.5 1.8 6.2 5.2"];

function TopBar() {
  return (
    <header className="topbar">
      <div className="brand">Gaurāṅgers</div>
      <div className="topActions">
        <button aria-label="Создать"><Glyph paths={CREATE} size={25} /></button>
        <button aria-label="Уведомления"><Glyph paths={HEART} size={25} /></button>
      </div>
    </header>
  );
}

type Tab = { key: string; label: string; o?: string[]; f?: string[]; avatar?: boolean };
const TABS: Tab[] = [
  { key: "home", label: "Главная", o: HOME_O, f: HOME_F },
  { key: "reels", label: "Reels", o: REELS, f: REELS },
  { key: "direct", label: "Сообщения", o: PLANE, f: PLANE },
  { key: "search", label: "Поиск", o: SEARCH, f: SEARCH },
  { key: "profile", label: "Профиль", avatar: true },
];

function TabBar({ active, onChange }: { active: string; onChange: (k: string) => void }) {
  return (
    <nav className="tabbar" role="tablist">
      {TABS.map((t) => {
        const on = active === t.key;
        return (
          <button key={t.key} className={"tab" + (on ? " on" : "")} role="tab"
            aria-selected={on} aria-label={t.label} onClick={() => onChange(t.key)}>
            {t.avatar ? (
              <span className={"avatar" + (on ? " on" : "")}>
                <svg className="avPerson" viewBox="0 0 24 24" width="20" height="20" fill="#8B8B8B">
                  <path d="M12 11.6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                  <path d="M5.8 20c.7-3.6 3.1-5.5 6.2-5.5s5.5 1.9 6.2 5.5z" />
                </svg>
                <i className="reddot" />
              </span>
            ) : (
              <Glyph paths={on ? t.f! : t.o!} fill={on && t.key === "home"} sw={on ? 2.2 : 1.9} />
            )}
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
