import { useState } from "react";
import { ICONS } from "./icons";

const Img = ({ name, h }: { name: string; h: number }) => {
  const ic = ICONS[name];
  return <img src={ic.uri} alt="" draggable={false} style={{ height: h, width: (ic.w / ic.h) * h, display: "block" }} />;
};

function TopBar() {
  return (
    <header className="topbar">
      <button className="tIcon" aria-label="Создать"><Img name="plus" h={23} /></button>
      <div className="brand">Gaurāṅgers</div>
      <button className="tIcon" aria-label="Уведомления"><Img name="heart" h={25} /></button>
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

const ICON_H = 27;

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
        return (
          <button key={t.key} className="tab" role="tab" aria-selected={on} aria-label={t.label} onClick={() => onChange(t.key)}>
            <Img name={(t as any).icon} h={ICON_H} />
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
