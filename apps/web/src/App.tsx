import { useState } from "react";
import { ICONS } from "./icons";

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
        <img className="logo dark" src="/logo-white.png" alt="Gaurāṅgers" />
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
