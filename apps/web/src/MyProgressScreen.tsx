/**
 * MyProgressScreen — «Мой прогресс» (раздел «Садхана» · «Изучение»).
 *
 * Дашборд чтения: системное чтение Прабхупады (доля всего корпуса БГ+ШБ+ЧЧ),
 * прогресс по книгам (полка «продолжить»), чтение по времени и стрик. Данные —
 * локальные (как и весь прогресс чтения): работает и для гостя. Аудио-прогресс
 * пока не отслеживается, поэтому не выдумывается.
 *
 * Эстетика приложения (iOS-26): токены темы, золото, инлайн-SVG.
 */
import { useEffect, useState, type CSSProperties } from "react";
import { readingClient, type ReadUnit } from "./reading/api";
import { getPlan } from "./reading/position";
import { recentReadings, pctOf, readingMinutesToday, readingGoalMin, readingStreakDays, type ReadingRec } from "./reading";
import { BOOKS, bookFullTitle } from "./books";

/* ── токены ── */
const GOLD = "var(--color-gold)";
const GOLDT = "#9c7c15";
const L1 = "var(--color-label)";
const L2 = "var(--color-label-2)";
const L3 = "var(--color-label-3)";
const FILL = "var(--color-glass-thin)";
const FILL2 = "var(--color-glass-regular)";
const HAIR = "var(--color-hairline)";
const FT = "var(--font-text)";
const FD = "var(--font-display)";

const Back = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const ArrowR = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const ChevR = () => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0, color: L3 }}><path d="M9 5l7 7-7 7" /></svg>);
const Flame = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 3c.5 3-2 4-2 7a2 2 0 0 0 4 0c0-.8-.3-1.4-.3-1.4 1.8 1 3.3 3 3.3 5.4a5 5 0 0 1-10 0c0-3.5 3-5 5-11Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>);
const Clock = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden><circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" /><path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>);

const fmt = (n: number) => n.toLocaleString("ru-RU");
function bookTitle(work: string): string {
  // ЗКН-Б001: название книги собирает ТОЛЬКО bookFullTitle(). Своя копия расходится.
  const b = BOOKS[work];
  return b ? bookFullTitle(b) : work.toUpperCase();
}

/** Кольцо прогресса. */
function Ring({ pct, size = 132, stroke = 9 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(1, pct / 100)));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-glass-regular)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={GOLD} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition: "stroke-dashoffset .5s ease" }} />
    </svg>
  );
}

function Bar({ pct }: { pct: number }) {
  return (
    <div style={{ height: 5, borderRadius: 3, background: "var(--color-glass-regular)", overflow: "hidden" }}>
      <div style={{ width: `${Math.max(2, Math.min(100, pct))}%`, height: "100%", background: GOLD, borderRadius: 3, transition: "width .3s" }} />
    </div>
  );
}

export default function MyProgressScreen({ onBack, onOpen }: { onBack: () => void; onOpen: (path: string) => void }) {
  const [plan, setPlan] = useState<ReadUnit | null>(null);
  const [planErr, setPlanErr] = useState(false);
  const [books, setBooks] = useState<ReadingRec[]>([]);
  const [today, setToday] = useState(0);
  const [goal, setGoal] = useState(0);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    setBooks(recentReadings(20));
    setToday(readingMinutesToday());
    setGoal(readingGoalMin());
    setStreak(readingStreakDays());
    readingClient.unit(getPlan().from).then(setPlan).catch(() => setPlanErr(true));
  }, []);

  // прочитано в корпусе = стихи до текущей (ещё не прочитанной) единицы
  const corpusRead = plan ? Math.max(0, plan.fromGnum - 1) : 0;
  const corpusTotal = plan?.total ?? 0;
  const corpusPct = corpusTotal ? (corpusRead / corpusTotal) * 100 : 0;
  const corpusPctLabel = corpusPct === 0 ? "0" : corpusPct < 10 ? corpusPct.toFixed(1) : String(Math.round(corpusPct));
  const goalPct = goal > 0 ? (today / goal) * 100 : 0;

  const nav: CSSProperties = {
    position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "center", gap: 4, height: 52, padding: "0 6px",
    background: "color-mix(in srgb, var(--color-bg) 82%, transparent)", backdropFilter: "saturate(180%) blur(20px)", WebkitBackdropFilter: "saturate(180%) blur(20px)", borderBottom: `0.5px solid ${HAIR}`,
  };
  const card: CSSProperties = { borderRadius: 20, background: FILL, padding: "18px 16px" };
  const sectionLabel: CSSProperties = { margin: "26px 2px 10px", fontFamily: FT, fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: L3 };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "var(--color-bg)", fontFamily: FT }}>
      <header style={nav}>
        <button type="button" aria-label="Назад" onClick={onBack} style={{ display: "grid", height: 38, width: 38, placeItems: "center", borderRadius: "50%", border: "none", background: "none", color: L1, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}><Back /></button>
        <div style={{ flex: 1, textAlign: "center", fontFamily: FD, fontSize: "var(--text-body)", fontWeight: 700, letterSpacing: "-0.02em", color: L1 }}>Мой прогресс</div>
        <span style={{ width: 38 }} />
      </header>

      <div style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        <div style={{ maxWidth: 600, margin: "0 auto", padding: "18px 16px calc(40px + env(safe-area-inset-bottom,0px))" }}>

          {/* Системное чтение Прабхупады — кольцо корпуса */}
          <div style={{ ...card, display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ position: "relative", flexShrink: 0, width: 132, height: 132, display: "grid", placeItems: "center" }}>
              <Ring pct={corpusPct} />
              <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
                <div>
                  <div style={{ fontFamily: FD, fontSize: "var(--text-title1)", fontWeight: 800, letterSpacing: "-0.02em", color: L1, lineHeight: 1 }}>{corpusPctLabel}<span style={{ fontSize: "var(--text-subhead)", color: L3 }}>%</span></div>
                  <div style={{ marginTop: 3, fontFamily: FT, fontSize: "var(--text-caption2)", color: L3 }}>корпуса</div>
                </div>
              </div>
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: FT, fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLD }}>Системное чтение</div>
              <div style={{ marginTop: 4, fontFamily: FD, fontSize: "var(--text-title3)", fontWeight: 800, letterSpacing: "-0.02em", color: L1, lineHeight: 1.15 }}>
                {planErr ? "Прабхупада" : `${fmt(corpusRead)} из ${fmt(corpusTotal || 25016)}`}
              </div>
              <div style={{ marginTop: 2, fontFamily: FT, fontSize: "var(--text-footnote)", lineHeight: 1.4, color: L2 }}>
                {plan ? (corpusRead > 0 ? `Сейчас: ${plan.workName}` : "Стих за стихом: БГ → ШБ → ЧЧ") : "стихов прочитано"}
              </div>
              <button type="button" onClick={() => onOpen("/practice/verse")}
                style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 7, height: 38, padding: "0 14px", borderRadius: 11, border: "none", background: GOLD, color: "#fff", fontFamily: FT, fontSize: "var(--text-footnote)", fontWeight: 700, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                {corpusRead > 0 ? "Продолжить" : "Начать"} <ArrowR />
              </button>
            </div>
          </div>

          {/* Чтение по времени */}
          <div style={{ ...sectionLabel }}>Чтение по времени</div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ ...card, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, color: GOLDT }}><Clock /><span style={{ fontFamily: FT, fontSize: "var(--text-caption)", fontWeight: 600, color: L2 }}>Сегодня</span></div>
              <div style={{ marginTop: 8, fontFamily: FD, fontSize: "var(--text-title2)", fontWeight: 800, letterSpacing: "-0.02em", color: L1 }}>{today} <span style={{ fontSize: "var(--text-footnote)", color: L3, fontWeight: 600 }}>/ {goal} мин</span></div>
              <div style={{ marginTop: 10 }}><Bar pct={goalPct} /></div>
            </div>
            <div style={{ ...card, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, color: GOLDT }}><Flame /><span style={{ fontFamily: FT, fontSize: "var(--text-caption)", fontWeight: 600, color: L2 }}>Стрик</span></div>
              <div style={{ marginTop: 8, fontFamily: FD, fontSize: "var(--text-title2)", fontWeight: 800, letterSpacing: "-0.02em", color: L1 }}>{streak} <span style={{ fontSize: "var(--text-footnote)", color: L3, fontWeight: 600 }}>{streak % 10 === 1 && streak % 100 !== 11 ? "день" : (streak % 10 >= 2 && streak % 10 <= 4 && (streak % 100 < 10 || streak % 100 >= 20)) ? "дня" : "дней"}</span></div>
              <div style={{ marginTop: 8, fontFamily: FT, fontSize: "var(--text-caption)", lineHeight: 1.4, color: L3 }}>дней подряд с выполненной целью</div>
            </div>
          </div>

          {/* Книги */}
          <div style={{ ...sectionLabel }}>Книги</div>
          {books.length === 0 ? (
            <div style={{ ...card, textAlign: "center", padding: "30px 22px" }}>
              <p style={{ margin: "0 0 16px", fontFamily: FT, fontSize: "var(--text-footnote)", lineHeight: 1.55, color: L2 }}>Вы ещё не начали читать. Откройте любую книгу — прогресс появится здесь.</p>
              <button type="button" onClick={() => onOpen("/")} style={{ height: 40, padding: "0 18px", borderRadius: 11, border: "none", background: FILL2, color: L1, fontFamily: FT, fontSize: "var(--text-subhead)", fontWeight: 700, cursor: "pointer" }}>К библиотеке</button>
            </div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", overflow: "hidden", borderRadius: 18, background: FILL }}>
              {books.map((r, i) => {
                const pct = pctOf(r);
                return (
                  <li key={r.work} style={{ borderTop: i ? `0.5px solid ${HAIR}` : "none" }}>
                    <button type="button" onClick={() => r.href && onOpen(r.href)}
                      style={{ display: "flex", alignItems: "center", gap: 13, width: "100%", padding: "13px 15px", border: "none", background: "none", cursor: "pointer", textAlign: "left", font: "inherit", WebkitTapHighlightColor: "transparent" }}>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: "block", fontFamily: FT, fontSize: "var(--text-subhead)", fontWeight: 600, letterSpacing: "-0.01em", color: L1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{bookTitle(r.work)}</span>
                        <span style={{ display: "block", marginTop: 2, fontFamily: FT, fontSize: "var(--text-caption)", color: L2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                          <span style={{ flex: 1 }}><Bar pct={pct ?? 0} /></span>
                          <span style={{ flexShrink: 0, fontFamily: FT, fontSize: "var(--text-caption)", fontWeight: 700, color: pct ? GOLDT : L3, minWidth: 30, textAlign: "right" }}>{pct ? `${pct}%` : "—"}</span>
                        </span>
                      </span>
                      <ChevR />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <p style={{ margin: "22px 4px 0", fontFamily: FT, fontSize: "var(--text-caption)", lineHeight: 1.5, color: L3 }}>
            Прогресс хранится на этом устройстве. Цель и стрик чтения настраиваются в дневнике садханы.
          </p>
        </div>
      </div>
    </div>
  );
}
