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

/* --- spokes helper for the chakra emblem --- */
function spokes(cx: number, cy: number, r1: number, r2: number, n: number, sw: number, stroke: string) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i * 2 * Math.PI) / n;
    return <line key={i} x1={cx + r1 * Math.cos(a)} y1={cy + r1 * Math.sin(a)} x2={cx + r2 * Math.cos(a)} y2={cy + r2 * Math.sin(a)} stroke={stroke} strokeWidth={sw} />;
  });
}

/* round emblem used as the post avatar */
function AvatarEmblem() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden>
      <defs>
        <radialGradient id="av" cx="50%" cy="34%" r="75%">
          <stop offset="0" stopColor="#33235f" /><stop offset="1" stopColor="#160f30" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="24" fill="url(#av)" />
      <circle cx="24" cy="24" r="13" fill="none" stroke="#E9C977" strokeWidth="1.1" />
      <g>{spokes(24, 24, 4.5, 12, 12, 1, "#E9C977")}</g>
      <circle cx="24" cy="24" r="4.2" fill="none" stroke="#E9C977" strokeWidth="1.1" />
    </svg>
  );
}

/* portrait book cover (original art — no copyrighted BBT artwork) */
function BookCover() {
  return (
    <svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" aria-label="Бхагавад-гита как она есть">
      <defs>
        <linearGradient id="cv" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2c2158" /><stop offset=".55" stopColor="#1d1542" /><stop offset="1" stopColor="#160f30" />
        </linearGradient>
        <radialGradient id="gl" cx="50%" cy="28%" r="62%">
          <stop offset="0" stopColor="rgba(233,201,119,.30)" /><stop offset="1" stopColor="rgba(233,201,119,0)" />
        </radialGradient>
      </defs>
      <rect width="400" height="500" fill="url(#cv)" />
      <rect width="400" height="500" fill="url(#gl)" />
      <rect x="16" y="16" width="368" height="468" rx="10" fill="none" stroke="#E9C977" strokeOpacity=".45" strokeWidth="1.2" />
      <text x="200" y="92" textAnchor="middle" fill="#E9C977" fontFamily="-apple-system,system-ui,sans-serif" fontSize="22" letterSpacing="1">श्रीमद् भगवद्गीता</text>
      <g>
        <circle cx="200" cy="246" r="66" fill="none" stroke="#E9C977" strokeWidth="1.4" />
        <circle cx="200" cy="246" r="54" fill="none" stroke="#E9C977" strokeOpacity=".4" strokeWidth="1" />
        {spokes(200, 246, 24, 62, 16, 1.3, "#E9C977")}
        <circle cx="200" cy="246" r="18" fill="none" stroke="#E9C977" strokeWidth="1.4" />
        <circle cx="200" cy="246" r="4.5" fill="#E9C977" />
      </g>
      <text x="200" y="372" textAnchor="middle" fill="#F4ECD8" fontFamily="-apple-system,system-ui,sans-serif" fontSize="40" fontWeight="600">Bhagavad-gītā</text>
      <text x="200" y="402" textAnchor="middle" fill="#E9C977" fontFamily="-apple-system,system-ui,sans-serif" fontSize="13" fontWeight="600" letterSpacing="6">AS IT IS</text>
      <text x="200" y="452" textAnchor="middle" fill="#F4ECD8" fillOpacity=".72" fontFamily="-apple-system,system-ui,sans-serif" fontSize="13">А.Ч. Бхактиведанта Свами Прабхупада</text>
    </svg>
  );
}

/* --- action icons (Instagram 2026 thin line) --- */
const HeartIcon = () => (<svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>);
const CommentIcon = () => (<svg viewBox="0 0 24 24"><path d="M21 11.5a8.5 8.5 0 0 1-12.7 7.4L3 21l2.2-5.2A8.5 8.5 0 1 1 21 11.5z" /></svg>);
const ShareIcon = () => (<svg viewBox="0 0 24 24"><path d="M22 2 11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg>);
const SaveIcon = () => (<svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>);
const MoreIcon = () => (<svg viewBox="0 0 24 6"><circle cx="4" cy="3" r="2" /><circle cx="12" cy="3" r="2" /><circle cx="20" cy="3" r="2" /></svg>);
const Verified = () => (<svg className="vf" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#0E5E54" /><path d="M7 12.4l3.2 3.2L17 9" fill="none" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" /></svg>);

function BookCard() {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const baseLikes = 12480;
  return (
    <article className="post">
      <div className="pHead">
        <span className="pAv"><AvatarEmblem /></span>
        <div className="pIdent">
          <span className="pName">Бхагавад-гита<Verified /></span>
          <span className="pSub">Шрила Прабхупада · Писание</span>
        </div>
        <button className="pMore" aria-label="Ещё"><MoreIcon /></button>
      </div>

      <div className="pMedia"><BookCover /></div>

      <div className="pAct">
        <button className={"heart" + (liked ? " on" : "")} aria-label="В избранное" aria-pressed={liked} onClick={() => setLiked(v => !v)}><HeartIcon /></button>
        <button aria-label="Комментарии"><CommentIcon /></button>
        <button aria-label="Поделиться"><ShareIcon /></button>
        <button className={"save" + (saved ? " on" : "")} aria-label="Сохранить" aria-pressed={saved} onClick={() => setSaved(v => !v)}><SaveIcon /></button>
      </div>

      <div className="pLikes">{(baseLikes + (liked ? 1 : 0)).toLocaleString("ru-RU")} отметок «Нравится»</div>
      <div className="pCap">
        <b>Бхагавад-гита как она есть</b> <span className="iast">Bhagavad-gītā</span> — «Произнесена Кришной Арджуне».
      </div>
      <div className="pMeta">18 глав · 700 стихов · санскрит · аудио · QR</div>

      <div className="pBuy">
        <button className="primary">Читать</button>
        <button className="sec">Заказать · 990 ₽</button>
      </div>
    </article>
  );
}

function Home() {
  return (
    <div className="feed">
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
