import { useEffect, useState } from "react";

type Center = { id: string; name: string; city?: string; country?: string };
type Festival = { id: string; type?: string; name_i18n?: any; name?: any };

const tr = (v: any, lang = "ru") => {
  try {
    const o = typeof v === "string" ? JSON.parse(v) : v;
    return (o && (o[lang] || o.en)) || "";
  } catch {
    return typeof v === "string" ? v : "";
  }
};

const asArray = (d: any): any[] => {
  if (Array.isArray(d)) return d;
  if (!d || typeof d !== "object") return [];
  return d.data || d.results || d.centers || d.festivals || d.events || d.items || [];
};

function useApi<T = any>(path: string) {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let on = true;
    fetch(path)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => on && setData(d))
      .catch(() => {});
    return () => {
      on = false;
    };
  }, [path]);
  return data;
}

const ic = {
  home: "M4 11.5 12 4l8 7.5M6 10v9h12v-9",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M21 21l-4.3-4.3",
  lotus:
    "M12 21c-4.5 0-8-2.4-8-6 2 .4 3.6 1.5 4.6 3M12 21c4.5 0 8-2.4 8-6-2 .4-3.6 1.5-4.6 3M12 21c-2-3-2-6.2 0-9.2 2 3 2 6.2 0 9.2M12 12c-2-1-3-3-3-5 1.6.3 2.6 1.2 3 2.4.4-1.2 1.4-2.1 3-2.4 0 2-1 4-3 5",
  calendar: "M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 9.5h16M8 3v4M16 3v4",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M5 20.5a7 7 0 0 1 14 0",
  radio: "M4.5 8.5a16 16 0 0 1 15 0M7.5 12a10 10 0 0 1 9 0M12 15.5h.01",
  bell: "M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6M10 20.5a2 2 0 0 0 4 0",
  chat: "M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.3A8 8 0 1 1 21 12z",
  pin: "M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11M12 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5",
};

const Icon = ({ d, size = 24 }: { d: string; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

function TopBar() {
  return (
    <header className="topbar">
      <div className="brand">Gaurāṅgers</div>
      <div className="topActions">
        <button aria-label="Krishna radio"><Icon d={ic.radio} size={22} /></button>
        <button aria-label="Уведомления"><Icon d={ic.bell} size={22} /></button>
        <button aria-label="Сангха и сообщения"><Icon d={ic.chat} size={22} /></button>
      </div>
    </header>
  );
}

function TempleCard({ c }: { c: Center }) {
  return (
    <div className="templeCard">
      <div className="tIcon"><Icon d={ic.pin} size={20} /></div>
      <div className="tInfo">
        <span className="tName">{c.name}</span>
        <span className="tMeta">{[c.city, c.country].filter(Boolean).join(", ") || "—"}</span>
      </div>
    </div>
  );
}

function Home({ centers }: { centers: Center[] }) {
  return (
    <div className="view">
      <section className="darshan">
        <span className="eyebrow">Даршан дня</span>
        <h2 className="darshanName">Шри-Шри Радха-Мадхава</h2>
        <span className="darshanLoc">Шри Маяпур Чандродая Мандир</span>
        <div className="mandala" />
      </section>

      <section className="card">
        <span className="eyebrow" style={{ color: "var(--gold)" }}>Стих дня</span>
        <p className="verseText">«Подобно тому как воплощённая душа переходит из детства в юность и старость, так и в момент смерти она переходит в новое тело».</p>
        <span className="verseRef">Бхагавад-гӣта 2.13</span>
      </section>

      <div className="rowCards">
        <div className="miniCard">
          <span className="miniLabel">Сегодня</span>
          <span className="miniValue">Экадаши</span>
          <span className="miniSub">день поста</span>
        </div>
        <div className="miniCard live">
          <span className="miniLabel"><span className="dot" />В эфире</span>
          <span className="miniValue">Киртан</span>
          <span className="miniSub">Маяпур · сейчас</span>
        </div>
      </div>

      <section>
        <div className="sectionHead"><h3>Храмы рядом</h3><span className="seeAll">Все</span></div>
        <div className="list">
          {centers.slice(0, 4).map((c) => <TempleCard key={c.id} c={c} />)}
          {centers.length === 0 && <div className="empty">Загружаем храмы…</div>}
        </div>
      </section>
    </div>
  );
}

function Search({ centers }: { centers: Center[] }) {
  const [q, setQ] = useState("");
  const list = centers.filter((c) =>
    (c.name + " " + (c.city || "") + " " + (c.country || "")).toLowerCase().includes(q.toLowerCase())
  );
  return (
    <div className="view">
      <h2 className="viewTitle">Поиск</h2>
      <div className="searchBox">
        <Icon d={ic.search} size={20} />
        <input placeholder="Храмы, книги, личности, рецепты…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="sectionHead"><h3>Храмы мира</h3><span className="seeAll">{list.length}</span></div>
      <div className="list">
        {list.map((c) => <TempleCard key={c.id} c={c} />)}
        {centers.length === 0 && <div className="empty">Загружаем храмы…</div>}
        {centers.length > 0 && list.length === 0 && <div className="empty">Ничего не найдено</div>}
      </div>
    </div>
  );
}

function Calendar({ festivals }: { festivals: Festival[] }) {
  return (
    <div className="view">
      <h2 className="viewTitle">Календарь</h2>
      <div className="banner">
        <span className="eyebrow">Сегодня</span>
        <strong>Экадаши — день поста</strong>
      </div>
      <div className="sectionHead"><h3>Праздники Вайшнавов</h3></div>
      <div className="list">
        {festivals.map((f) => (
          <div className="festRow" key={f.id}>
            <span className="fDot" />
            <span className="fName">{tr(f.name_i18n || f.name) || f.id}</span>
            <span className="fType">{f.type}</span>
          </div>
        ))}
        {festivals.length === 0 && <div className="empty">Загружаем календарь…</div>}
      </div>
    </div>
  );
}

function Temple() {
  const [beads, setBeads] = useState(0);
  const rounds = Math.floor(beads / 108);
  const inRound = beads % 108;
  return (
    <div className="view mid">
      <div className="deityPanel">
        <span className="eyebrow">Храм в кармане</span>
        <span className="deityName">Шри-Шри Радха-Мадхава</span>
        <span className="deitySub">Ваш даршан · поднесите и воспевайте</span>
        <div className="mandala sm" />
      </div>
      <div className="japa">
        <button className="japaBtn" onClick={() => setBeads((b) => b + 1)} aria-label="Джапа, добавить бусину">
          <span className="japaRounds">{rounds}</span>
          <span className="japaLabel">кругов</span>
        </button>
        <div className="bar"><div className="barFill" style={{ width: `${(inRound / 108) * 100}%` }} /></div>
        <span className="barCount">{inRound} / 108 бусин</span>
        {beads > 0 && <button className="ghost" onClick={() => setBeads(0)}>Сбросить</button>}
      </div>
    </div>
  );
}

const STAGES = ["шраддха", "садху-санга", "бхаджана-крийя", "анартха-нивритти", "ништха", "ручи", "асакти", "бхава", "према"];

function Path() {
  const current = 1;
  return (
    <div className="view">
      <div className="profile">
        <div className="avatar">अ</div>
        <div>
          <div className="pName">Преданный</div>
          <div className="pSub">Начало пути · садху-санга</div>
        </div>
      </div>
      <div className="streak">
        <div><strong>0</strong><span>дней садханы</span></div>
        <div><strong>0</strong><span>кругов</span></div>
        <div><strong>2</strong><span>ступень</span></div>
      </div>
      <div className="sectionHead"><h3>Путь: шраддха → према</h3></div>
      <div className="ladder">
        {STAGES.map((s, i) => (
          <div className={"step" + (i <= current ? " on" : "")} key={s}>
            <span className="sDot">{i + 1}</span>
            <span className="sName">{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const TABS = [
  { key: "home", label: "Сегодня", icon: ic.home },
  { key: "search", label: "Поиск", icon: ic.search },
  { key: "temple", label: "Храм", icon: ic.lotus, mid: true },
  { key: "calendar", label: "Календарь", icon: ic.calendar },
  { key: "path", label: "Мой путь", icon: ic.user },
];

export default function App() {
  const [tab, setTab] = useState("home");
  const centers = asArray(useApi("/api/centers"));
  const festivals = asArray(useApi("/api/calendar/festivals"));

  return (
    <div className="shell">
      <TopBar />
      <main className="content">
        {tab === "home" && <Home centers={centers} />}
        {tab === "search" && <Search centers={centers} />}
        {tab === "temple" && <Temple />}
        {tab === "calendar" && <Calendar festivals={festivals} />}
        {tab === "path" && <Path />}
      </main>
      <nav className="tabbar">
        {TABS.map((t) =>
          t.mid ? (
            <button key={t.key} className={"tab mid" + (tab === t.key ? " active" : "")} onClick={() => setTab(t.key)}>
              <span className="centerBtn"><Icon d={t.icon} size={26} /></span>
              <span className="tabLabel">{t.label}</span>
            </button>
          ) : (
            <button key={t.key} className={"tab" + (tab === t.key ? " active" : "")} onClick={() => setTab(t.key)}>
              <Icon d={t.icon} />
              <span className="tabLabel">{t.label}</span>
            </button>
          )
        )}
      </nav>
    </div>
  );
}
