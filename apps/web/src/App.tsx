import { useState } from "react";

type GlyphProps = { paths: string[]; fill?: boolean; size?: number; sw?: number };
const Glyph = ({ paths, fill = false, size = 26, sw = 1.9 }: GlyphProps) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill={fill ? "currentColor" : "none"}
    stroke={fill ? "none" : "currentColor"}
    strokeWidth={fill ? 0 : sw}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {paths.map((p, i) => (
      <path key={i} d={p} />
    ))}
  </svg>
);

// ---- top bar (Instagram home: heart + paper-plane) ----
const HEART = ["M12 20.3C7 17 3.5 13.5 3.5 9.6 3.5 7 5.4 5.2 7.8 5.2c1.7 0 3.2 1 4.2 2.5 1-1.5 2.5-2.5 4.2-2.5 2.4 0 4.3 1.8 4.3 4.4 0 3.9-3.5 7.4-8.5 10.7z"];
const PLANE = ["M21.4 3.6 2.9 10.9c-.55.2-.5 1 .05 1.15l8.2 2.2 2.2 8.2c.15.55.95.6 1.15.05z", "M21.4 3.6 10.4 14.6"];

// ---- bottom nav glyphs (outline + filled), Instagram weight ----
const HOME_O = ["M3.7 11 12 4.3l8.3 6.7", "M5.7 9.5V19a1 1 0 0 0 1 1h10.6a1 1 0 0 0 1-1V9.5"];
const HOME_F = ["M12 3.9 3.9 10.5a1 1 0 0 0-.36.77V19a1 1 0 0 0 1 1h5.1v-5.3a1 1 0 0 1 1-1h2.7a1 1 0 0 1 1 1V20h5.1a1 1 0 0 0 1-1v-7.7a1 1 0 0 0-.36-.78z"];
const SEARCH_O = ["M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z", "M20.5 20.5 16.2 16.2"];
const LOTUS_O = [
  "M12 7c1.4 1.7 1.4 4.8 0 7-1.4-2.2-1.4-5.3 0-7z",
  "M11.4 14.4c-.5-2-2-3.7-4.1-4.4.3 2.1 1.8 3.9 4.1 4.4z",
  "M12.6 14.4c.5-2 2-3.7 4.1-4.4-.3 2.1-1.8 3.9-4.1 4.4z",
  "M6 12.6c1.1 2 3.4 3.3 6 3.3s4.9-1.3 6-3.3",
];
const LOTUS_F = [
  "M12 6.6c1.5 1.8 1.5 5.1 0 7.5-1.5-2.4-1.5-5.7 0-7.5z",
  "M11.3 14.6c-.6-2.2-2.2-4-4.5-4.7.3 2.3 1.9 4.1 4.5 4.7z",
  "M12.7 14.6c.6-2.2 2.2-4 4.5-4.7-.3 2.3-1.9 4.1-4.5 4.7z",
];
const CAL_O = [
  "M5 6.2h14a1.6 1.6 0 0 1 1.6 1.6v11.4a1.6 1.6 0 0 1-1.6 1.6H5a1.6 1.6 0 0 1-1.6-1.6V7.8A1.6 1.6 0 0 1 5 6.2z",
  "M3.4 10h17.2",
  "M8 3.7v4.2",
  "M16 3.7v4.2",
];
const CAL_F = [
  "M8 3.6a1 1 0 0 1 1 1v1.6h6V4.6a1 1 0 1 1 2 0v1.6h1.5A1.5 1.5 0 0 1 20 7.8v.7H4v-.7a1.5 1.5 0 0 1 1.5-1.5H7V4.6a1 1 0 0 1 1-1z",
  "M4 10.4h16V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z",
];

function TopBar() {
  return (
    <header className="topbar">
      <div className="brand">Gaurāṅgers</div>
      <div className="topActions">
        <button aria-label="Уведомления"><Glyph paths={HEART} size={25} sw={1.9} /></button>
        <button aria-label="Сообщения"><Glyph paths={PLANE} size={25} sw={1.9} /></button>
      </div>
    </header>
  );
}

const TABS = [
  { key: "home", label: "Сегодня", o: HOME_O, f: HOME_F },
  { key: "search", label: "Поиск", o: SEARCH_O, f: SEARCH_O, bold: true },
  { key: "temple", label: "Храм", o: LOTUS_O, f: LOTUS_F },
  { key: "calendar", label: "Календарь", o: CAL_O, f: CAL_F },
  { key: "path", label: "Мой путь", avatar: true },
];

function TabBar({ active, onChange }: { active: string; onChange: (k: string) => void }) {
  return (
    <nav className="tabbar" role="tablist">
      {TABS.map((t) => {
        const on = active === t.key;
        return (
          <button
            key={t.key}
            className={"tab" + (on ? " on" : "")}
            role="tab"
            aria-selected={on}
            aria-label={t.label}
            onClick={() => onChange(t.key)}
          >
            {t.avatar ? (
              <span className={"avatar" + (on ? " on" : "")}>
                <i className="dot" />
              </span>
            ) : (
              <Glyph paths={on ? t.f! : t.o!} fill={on && !t.bold} sw={on && t.bold ? 2.6 : 1.9} />
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
