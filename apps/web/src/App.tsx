import { useState } from "react";

type GlyphProps = { paths: string[]; fill?: boolean; size?: number; sw?: number };
const Glyph = ({ paths, fill = false, size = 26, sw = 1.8 }: GlyphProps) => (
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

// ---- top bar line icons ----
const RADIO = ["M4.6 8.6a16 16 0 0 1 14.8 0", "M7.6 12a10 10 0 0 1 8.8 0", "M12 15.4h.01"];
const BELL = ["M6 9.2a6 6 0 1 1 12 0c0 4.8 2 6 2 6H4s2-1.2 2-6", "M10 20.4a2 2 0 0 0 4 0"];
const SEND = ["M21 4 3 11l7 2.6L13 21l8-17z", "M10 13.6 21 4"];

// ---- bottom nav glyphs (outline + filled) ----
const HOME_O = ["M3.6 11.3 12 4.4l8.4 6.9", "M5.8 9.8V19.4h4.3v-5.4h3.8v5.4h4.3V9.8"];
const HOME_F = ["M12 3.6 2.6 11.5h2.6v8.1h4.3v-5.3h5v5.3h4.3v-8.1h2.6z"];
const SEARCH_O = ["M11 4.6a6.4 6.4 0 1 0 0 12.8 6.4 6.4 0 0 0 0-12.8z", "M20.2 20.2l-4.4-4.4"];
const SEARCH_F = ["M11 4a7 7 0 0 1 5.2 11.7l4 4-1.5 1.5-4-4A7 7 0 1 1 11 4z"];
const LOTUS_O = [
  "M12 19.6c-4.3 0-7.8-2.2-7.8-5.5 1.9.3 3.5 1.3 4.6 3",
  "M12 19.6c4.3 0 7.8-2.2 7.8-5.5-1.9.3-3.5 1.3-4.6 3",
  "M12 19.6c-2-2.8-2-5.9 0-8.8 2 2.9 2 6 0 8.8",
  "M12 11c-1.9-1-2.8-2.7-2.8-4.6 1.5.3 2.5 1 2.8 2.2.3-1.2 1.3-1.9 2.8-2.2 0 1.9-.9 3.6-2.8 4.6",
];
const LOTUS_F = [
  "M12 20.2c-2.2-2.9-2.2-6.3 0-9.6 2.2 3.3 2.2 6.7 0 9.6z",
  "M11.4 20c-1-2-2.7-3.2-5-3.6-1-.2-1.9-.9-2.4-1.9 2.1.2 6.3.9 7.6 4.9.2.6-.1.9-.2.6z",
  "M12.6 20c1-2 2.7-3.2 5-3.6 1-.2 1.9-.9 2.4-1.9-2.1.2-6.3.9-7.6 4.9-.2.6.1.9.2.6z",
  "M12 11.4c-2-1-3-2.9-3-5 1.6.3 2.6 1.1 3 2.4.4-1.3 1.4-2.1 3-2.4 0 2.1-1 4-3 5z",
];
const CAL_O = [
  "M4.8 6.2h14.4a1.4 1.4 0 0 1 1.4 1.4v11.4a1.4 1.4 0 0 1-1.4 1.4H4.8a1.4 1.4 0 0 1-1.4-1.4V7.6a1.4 1.4 0 0 1 1.4-1.4z",
  "M3.4 10.2h17.2",
  "M7.8 3.6v4",
  "M16.2 3.6v4",
];
const CAL_F = [
  "M4.8 6.2h14.4a1.4 1.4 0 0 1 1.4 1.4v1.6H3.4V7.6a1.4 1.4 0 0 1 1.4-1.4z",
  "M3.4 11h17.2v8a1.4 1.4 0 0 1-1.4 1.4H4.8A1.4 1.4 0 0 1 3.4 19z",
  "M7.8 3.4v4",
  "M16.2 3.4v4",
];

function TopBar() {
  return (
    <header className="topbar">
      <div className="brand">Gaurāṅgers</div>
      <div className="topActions">
        <button aria-label="Радио"><Glyph paths={RADIO} size={23} /></button>
        <button aria-label="Уведомления"><Glyph paths={BELL} size={23} /></button>
        <button aria-label="Сообщения"><Glyph paths={SEND} size={23} /></button>
      </div>
    </header>
  );
}

const TABS = [
  { key: "home", label: "Сегодня", o: HOME_O, f: HOME_F },
  { key: "search", label: "Поиск", o: SEARCH_O, f: SEARCH_F },
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
              <span className={"avatar" + (on ? " on" : "")} />
            ) : (
              <Glyph paths={on ? t.f! : t.o!} fill={on} sw={1.9} />
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
