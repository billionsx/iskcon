/**
 * SadhanaScreen — дневник садханы (раздел «Садхана» · «Моя практика»).
 *
 * Единая сводка ежедневной духовной практики вошедшего преданного:
 *   • круги джапы (источник — счётчик джапы, метрика берётся из japa_round);
 *   • чтение книг Шрилы Прабхупады (минуты за день);
 *   • время подъёма (мангала-арати) и заметка дня;
 *   • стрик (дней подряд с выполненной нормой кругов) и рекорд;
 *   • неделя одним взглядом, общая статистика и история практики.
 *
 * Серверный слой — GET/POST /api/me/sadhana (accountClient.sadhana). Круги в
 * дневнике не дублируются: при открытии локальные круги счётчика тихо дозаливаются
 * на сервер (идемпотентно), после чего метрика кругов едина с japa_round. Цель
 * кругов хранится на сервере (user_prefs.sadhanaGoal) и зеркалится в локальную
 * настройку счётчика, чтобы цель была одна на обоих экранах.
 *
 * Эстетика приложения (iOS-26 · Liquid Glass): токены темы, золото без обводок,
 * только инлайн-SVG — без сторонних зависимостей. Дневник доступен вошедшему;
 * гостю — аккуратное приглашение войти.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useAuth } from "./account/store";
import { requireAuth } from "./account/track";
import { accountClient, type SadhanaState, type SadhanaPatch, type SadhanaDay, type JapaSyncRound } from "./account/api";

/* ───────────────────────── палитра / токены ───────────────────────── */
const GOLD = "#D2AA1B";
const GOLDT = "#9c7c15";
const GREEN = "#34C759";
const L1 = "var(--color-label)";
const L2 = "var(--color-label-2)";
const L3 = "var(--color-label-3)";
const FILL = "var(--color-glass-thin)";
const FILL2 = "var(--color-glass-regular)";
const HAIR = "var(--color-hairline)";
const FT = "var(--font-text)";
const FD = "var(--font-display)";

/* ───────────────────────── даты / формат ───────────────────────── */
const RU_MON = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const RU_WD1 = ["В", "П", "В", "С", "Ч", "П", "С"]; // Вс Пн Вт Ср Чт Пт Сб — первые буквы

function ymd(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function prettyDate(s: string, withYear = false): string {
  const d = parseYmd(s);
  return `${d.getDate()} ${RU_MON[d.getMonth()]}${withYear ? ` ${d.getFullYear()}` : ""}`;
}
function relDay(s: string): string {
  const t = ymd();
  if (s === t) return "Сегодня";
  if (s === ymd(new Date(Date.now() - 86400000))) return "Вчера";
  return prettyDate(s, parseYmd(s).getFullYear() !== new Date().getFullYear());
}
function fmtMin(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60); const r = m % 60;
  return r ? `${h} ч ${r} мин` : `${h} ч`;
}
function pluralRu(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n) % 100; const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

/* ───────────────────────── локальный счётчик (для дозаливки/цели) ───────────────────────── */
const JAPA_KEY = "iol:japa:v1";
const DEV_KEY = "iol:device";

function deviceId(): string {
  if (typeof localStorage === "undefined") return "dev";
  try {
    let v = localStorage.getItem(DEV_KEY);
    if (!v) { v = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem(DEV_KEY, v); }
    return v;
  } catch { return "dev"; }
}
// Локальные завершённые круги → DTO для дозаливки (последние 500, свежие первыми).
function localRounds(): JapaSyncRound[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(JAPA_KEY);
    if (!raw) return [];
    const d = JSON.parse(raw) as { rounds?: { t: number; d: number; b: number }[] };
    const rounds = Array.isArray(d.rounds) ? d.rounds : [];
    const dev = deviceId();
    return rounds
      .filter((r) => r && typeof r.t === "number")
      .sort((a, b) => b.t - a.t)
      .slice(0, 500)
      .map((r) => ({ id: `${dev}:${r.t}`, day: ymd(new Date(r.t)), at: new Date(r.t).toISOString(), beads: Math.max(1, r.b || 108), durationSec: Math.max(0, r.d || 0) }));
  } catch { return []; }
}
// Синхронизируем цель кругов в локальную настройку счётчика — чтобы цель была одна.
function syncLocalGoal(goal: number): void {
  if (typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(JAPA_KEY);
    const d = raw ? JSON.parse(raw) : { v: 1, goal: 16, bpr: 108, curBeads: 0, curStart: null, rounds: [] };
    if (d.goal !== goal) { d.goal = goal; localStorage.setItem(JAPA_KEY, JSON.stringify(d)); }
  } catch { /* noop */ }
}

/* ───────────────────────── иконки ───────────────────────── */
const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const Back = () => (<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden><path {...S} d="M15 5l-7 7 7 7" /></svg>);
const Gear = () => (<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden><circle {...S} cx="12" cy="12" r="3" /><path {...S} d="M19.4 13.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" /></svg>);
const Flame = () => (<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden><path d="M12 2.5c2.4 3 1 5.2-.3 6.6-1 1-1.7 2-1.7 3.2 0 1.2.9 2 2 2s2-.8 2-2.1c0-.5-.2-1-.5-1.4 2 .7 3.2 2.6 3.2 4.7A5.4 5.4 0 0 1 12 21a5.4 5.4 0 0 1-5.4-5.4c0-2.6 1.4-4.4 2.7-6 1.6-2 2.9-4 2.7-7.1z" fill="currentColor" /></svg>);
const Trophy = () => (<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden><path {...S} d="M7 4h10v3a5 5 0 0 1-10 0V4Z" /><path {...S} d="M17 5h2.5a2 2 0 0 1 0 4H17M7 5H4.5a2 2 0 0 0 0 4H7" /><path {...S} d="M9.5 13.5 9 17h6l-.5-3.5M8 20h8M12 17v3" /></svg>);
const Book = () => (<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden><path {...S} d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5V5.5Z" /><path {...S} d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5A2.5 2.5 0 0 1 4 20.5Z" /></svg>);
const Sun = () => (<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden><path {...S} d="M12 3v2M5 7l1.4 1.4M19 7l-1.4 1.4M3 13h2M19 13h2" /><path {...S} d="M7 13a5 5 0 0 1 10 0" /><path {...S} d="M3 17h18M6 20h12" /></svg>);
const Pencil = () => (<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden><path {...S} d="M14.5 5.5l4 4M4 20l1-4L16 5a2 2 0 0 1 3 3L8 19l-4 1Z" /></svg>);
const Chevron = () => (<svg width="9" height="15" viewBox="0 0 9 15" fill="none" aria-hidden style={{ color: L3 }}><path d="M1.5 1.5 7 7.5l-5.5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const Check = () => (<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden><path {...S} strokeWidth="2.4" d="M5 12.5l4.5 4.5L19 7" /></svg>);

/* ───────────────────────── презентационные блоки ───────────────────────── */
function Tile({ value, label, accent }: { value: string; label: string; accent?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0, padding: "13px 10px", borderRadius: 16, background: FILL, textAlign: "center" }}>
      <div style={{ fontFamily: FD, fontSize: 21, fontWeight: 800, letterSpacing: "-0.02em", color: accent || L1, lineHeight: 1.05 }}>{value}</div>
      <div style={{ marginTop: 3, fontFamily: FT, fontSize: 11, fontWeight: 600, color: L2 }}>{label}</div>
    </div>
  );
}

function StreakCard({ icon, value, label, tone }: { icon: ReactNode; value: number; label: string; tone: string }) {
  return (
    <div style={{ flex: 1, padding: 14, borderRadius: 16, background: FILL, display: "flex", alignItems: "center", gap: 11 }}>
      <span style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center", background: `color-mix(in srgb, ${tone} 16%, transparent)`, color: tone }}>{icon}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontFamily: FD, fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", color: L1 }}>{value}</span>
        <span style={{ fontFamily: FT, fontSize: 11.5, color: L2 }}>{label}</span>
      </span>
    </div>
  );
}

/* ───────────────────────── экран ───────────────────────── */
const HM_WEEKS = 10;
const HM_WD = ["Пн", "", "Ср", "", "Пт", "", ""];

/** Карта практики: тепловая сетка кругов за последние недели (столбец = неделя). */
function Heatmap({ roundsByDay, goal }: { roundsByDay: Map<string, number>; goal: number }) {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const dow = (t.getDay() + 6) % 7; // 0=Пн … 6=Вс
  const firstMon = new Date(t); firstMon.setDate(t.getDate() - dow - (HM_WEEKS - 1) * 7);

  const cells: { key: string; rounds: number; future: boolean; today: boolean }[] = [];
  for (let c = 0; c < HM_WEEKS; c++) {
    for (let r = 0; r < 7; r++) {
      const d = new Date(firstMon); d.setDate(firstMon.getDate() + c * 7 + r);
      const key = ymd(d);
      cells.push({ key, rounds: roundsByDay.get(key) ?? 0, future: d.getTime() > t.getTime(), today: d.getTime() === t.getTime() });
    }
  }
  const tone = (rounds: number, future: boolean) => {
    if (future) return "transparent";
    if (rounds <= 0) return "color-mix(in srgb, var(--color-label) 8%, transparent)";
    if (rounds >= goal) return GOLD;
    return `color-mix(in srgb, ${GOLD} ${30 + Math.round((rounds / goal) * 45)}%, transparent)`;
  };

  return (
    <div style={{ padding: 16, borderRadius: 18, background: FILL, marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontFamily: FT, fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: L3 }}>Карта практики</span>
        <span style={{ fontFamily: FT, fontSize: 10.5, color: L3 }}>10 недель</span>
      </div>
      <div style={{ display: "flex", gap: 7, alignItems: "stretch" }}>
        <div style={{ display: "grid", gridTemplateRows: "repeat(7, 1fr)", gap: 3, flexShrink: 0 }}>
          {HM_WD.map((w, i) => (
            <span key={i} style={{ fontFamily: FT, fontSize: 8.5, color: L3, display: "flex", alignItems: "center", lineHeight: 1 }}>{w}</span>
          ))}
        </div>
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: `repeat(${HM_WEEKS}, 1fr)`, gridTemplateRows: "repeat(7, 1fr)", gridAutoFlow: "column", gap: 3 }}>
          {cells.map((c) => (
            <div key={c.key} title={c.future ? "" : `${prettyDate(c.key)}: ${c.rounds} кр.`}
              style={{ aspectRatio: "1 / 1", borderRadius: 4, background: tone(c.rounds, c.future), outline: c.today ? `1.5px solid ${GOLD}` : "none", outlineOffset: 1 }} />
          ))}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, marginTop: 12 }}>
        <span style={{ fontFamily: FT, fontSize: 10, color: L3 }}>меньше</span>
        {["color-mix(in srgb, var(--color-label) 8%, transparent)", `color-mix(in srgb, ${GOLD} 45%, transparent)`, `color-mix(in srgb, ${GOLD} 70%, transparent)`, GOLD].map((bg, i) => (
          <span key={i} style={{ width: 11, height: 11, borderRadius: 3, background: bg }} />
        ))}
        <span style={{ fontFamily: FT, fontSize: 10, color: L3 }}>больше</span>
      </div>
    </div>
  );
}

const sheetBtn: CSSProperties = { minWidth: 56, height: 40, padding: "0 14px", borderRadius: 11, border: "none", background: FILL2, color: L1, fontFamily: FT, fontSize: 14, fontWeight: 700, cursor: "pointer", WebkitTapHighlightColor: "transparent", display: "inline-grid", placeItems: "center" };

/** Лист редактирования любого дня дневника: чтение/подъём/заметка (круги — read-only). */
function DayEditor({ day, initial, goal, onClose, onSaved }: { day: string; initial: SadhanaDay; goal: number; onClose: () => void; onSaved: (s: SadhanaState, day: string) => void }) {
  const [read, setRead] = useState(initial.reading_min);
  const [rose, setRose] = useState(initial.rose_at ?? "");
  const [note, setNote] = useState(initial.note ?? "");
  const [busy, setBusy] = useState(false);
  const done = initial.rounds >= goal;

  const save = async () => {
    setBusy(true);
    try {
      const s = await accountClient.sadhana.save({ today: ymd(), day, readingMin: read, roseAt: rose || null, note });
      onSaved(s, day); onClose();
    } catch { setBusy(false); }
  };

  const lbl: CSSProperties = { display: "block", fontFamily: FT, fontSize: 12, fontWeight: 700, color: L2, marginBottom: 7 };
  const field: CSSProperties = { width: "100%", boxSizing: "border-box", padding: "11px 12px", borderRadius: 12, border: `0.5px solid ${HAIR}`, background: FILL, fontFamily: FT, outline: "none" };

  return (
    <div role="dialog" aria-modal="true" onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.42)", display: "flex", alignItems: "flex-end", justifyContent: "center", animation: "sadFade .2s ease" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 480, background: "var(--color-bg-2)", borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: "8px 18px calc(20px + env(safe-area-inset-bottom,0px))", boxShadow: "0 -10px 44px rgba(0,0,0,0.32)", animation: "sadSheet .28s cubic-bezier(.32,.72,0,1)" }}>
        <div style={{ width: 38, height: 5, borderRadius: 3, background: HAIR, margin: "0 auto 14px" }} />
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
          <span style={{ fontFamily: FD, fontSize: 19, fontWeight: 800, letterSpacing: "-0.02em", color: L1 }}>{relDay(day)}</span>
          <span style={{ fontFamily: FT, fontSize: 12.5, fontWeight: 700, color: done ? GREEN : L2 }}>{initial.rounds} {pluralRu(initial.rounds, "круг", "круга", "кругов")}</span>
        </div>
        <p style={{ margin: "3px 0 16px", fontFamily: FT, fontSize: 11.5, color: L3 }}>Круги берутся из счётчика и здесь не меняются.</p>

        <label style={lbl}>Чтение Прабхупады</label>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <button type="button" onClick={() => setRead((v) => Math.max(0, v - 15))} disabled={read <= 0} style={{ ...sheetBtn, opacity: read <= 0 ? 0.5 : 1 }}>−15</button>
          <span style={{ flex: 1, textAlign: "center", fontFamily: FD, fontSize: 17, fontWeight: 800, color: read > 0 ? L1 : L3 }}>{read > 0 ? fmtMin(read) : "—"}</span>
          <button type="button" onClick={() => setRead((v) => Math.min(1440, v + 15))} style={sheetBtn}>+15</button>
          <button type="button" onClick={() => setRead((v) => Math.min(1440, v + 30))} style={sheetBtn}>+30</button>
        </div>

        <label style={lbl}>Подъём (мангала-арати)</label>
        <input type="time" value={rose} onChange={(e) => setRose(e.target.value)} style={{ ...field, color: rose ? L1 : L3, fontSize: 15, fontWeight: 600, marginBottom: 16, colorScheme: "dark light" }} />

        <label style={lbl}>Заметка дня</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} rows={3} placeholder="Реализации, благодарности, планы…"
          style={{ ...field, resize: "none", color: L1, fontSize: 14, lineHeight: 1.5, marginBottom: 18 }} />

        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, height: 48, borderRadius: 14, border: "none", background: FILL, color: L1, fontFamily: FT, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Отмена</button>
          <button type="button" onClick={save} disabled={busy} style={{ flex: 1, height: 48, borderRadius: 14, border: "none", background: GOLD, color: "#fff", fontFamily: FT, fontSize: 15, fontWeight: 700, cursor: "pointer", opacity: busy ? 0.7 : 1, boxShadow: "0 8px 22px rgba(210,170,27,0.4)" }}>{busy ? "Сохранение…" : "Сохранить"}</button>
        </div>
      </div>
    </div>
  );
}

export default function SadhanaScreen({ onBack }: { onBack: () => void }) {
  const { status } = useAuth();
  const [st, setSt] = useState<SadhanaState | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [showSet, setShowSet] = useState(false);
  const [editDay, setEditDay] = useState<SadhanaDay | null>(null);

  // Локальные «черновики» редактируемых полей — мгновенный отклик; на сервер
  // улетают сами (чтение/цель — с дебаунсом, подъём — сразу, заметка — на blur).
  const [readMin, setReadMin] = useState(0);
  const [roseAt, setRoseAt] = useState("");
  const [note, setNote] = useState("");
  const [goal, setGoal] = useState(16);

  const load = useCallback(async () => {
    setLoading(true); setFailed(false);
    try {
      // Дозалить локальные круги (до входа/офлайн) — идемпотентно; затем читать.
      try { const r = localRounds(); if (r.length) await accountClient.japa.sync(r); } catch { /* не критично */ }
      const s = await accountClient.sadhana.get(ymd(), 90);
      setSt(s); syncLocalGoal(s.goal);
      setReadMin(s.todayRow.reading_min); setRoseAt(s.todayRow.rose_at ?? ""); setNote(s.todayRow.note ?? ""); setGoal(s.goal);
    } catch { setFailed(true); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (status === "authed") void load();
    else if (status === "guest") { setLoading(false); }
  }, [status, load]);

  // Сохранение патча: сервер возвращает полное состояние (стрики/неделя пересчитаны).
  const send = useCallback(async (p: SadhanaPatch) => {
    try {
      const s = await accountClient.sadhana.save({ today: ymd(), day: ymd(), ...p });
      setSt(s);
      if (typeof p.goal === "number") syncLocalGoal(s.goal);
    } catch { /* оставляем локальное значение; следующее действие повторит */ }
  }, []);

  // Чтение — дебаунс, чтобы серия касаний свернулась в одно сохранение.
  const readRef = useRef(0); useEffect(() => { readRef.current = readMin; }, [readMin]);
  const readTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const bumpRead = useCallback((d: number) => {
    setReadMin((v) => Math.max(0, Math.min(1440, v + d)));
    if (readTimer.current) clearTimeout(readTimer.current);
    readTimer.current = setTimeout(() => void send({ readingMin: readRef.current }), 650);
  }, [send]);

  // Цель — дебаунс (степпер).
  const goalRef = useRef(16); useEffect(() => { goalRef.current = goal; }, [goal]);
  const goalTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const bumpGoal = useCallback((g: number) => {
    const v = Math.max(1, Math.min(64, g));
    setGoal(v);
    if (goalTimer.current) clearTimeout(goalTimer.current);
    goalTimer.current = setTimeout(() => void send({ goal: goalRef.current }), 500);
  }, [send]);

  const openJapa = useCallback(() => { window.dispatchEvent(new CustomEvent("iol:open-japa")); }, []);

  const todayRounds = st?.stats.todayRounds ?? 0;
  const goalPct = Math.min(1, todayRounds / Math.max(1, goal));
  const done = todayRounds >= goal;
  const ringColor = done ? GREEN : GOLD;

  // Геометрия кольца кругов.
  const R = 76, C = 2 * Math.PI * R;

  const weekMax = useMemo(() => Math.max(goal, ...(st?.week.map((w) => w.rounds) ?? [1])), [st, goal]);

  // Карта кругов по дням (для тепловой сетки): активные дни из истории + неделя.
  const roundsByDay = useMemo(() => {
    const m = new Map<string, number>();
    st?.history.forEach((d) => m.set(d.day, d.rounds));
    st?.week.forEach((w) => { if (!m.has(w.day)) m.set(w.day, w.rounds); });
    return m;
  }, [st]);

  /* ── стили ── */
  const navStyle: CSSProperties = {
    position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "center", gap: 4, height: 52, padding: "0 6px",
    background: "color-mix(in srgb, var(--color-bg) 82%, transparent)", backdropFilter: "saturate(180%) blur(20px)", WebkitBackdropFilter: "saturate(180%) blur(20px)",
    borderBottom: `0.5px solid ${HAIR}`,
  };
  const iconBtn = (active = false): CSSProperties => ({
    display: "grid", height: 38, width: 38, placeItems: "center", borderRadius: "50%", border: "none", background: "none",
    color: active ? GOLD : L1, cursor: "pointer", WebkitTapHighlightColor: "transparent",
  });
  const card: CSSProperties = { padding: 16, borderRadius: 18, background: FILL };
  const miniBtn: CSSProperties = {
    minWidth: 44, height: 34, padding: "0 12px", borderRadius: 10, border: "none", background: FILL2, color: L1,
    cursor: "pointer", fontFamily: FT, fontSize: 14, fontWeight: 700, display: "inline-grid", placeItems: "center", WebkitTapHighlightColor: "transparent",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "var(--color-bg)", fontFamily: FT }}>
      <header style={navStyle}>
        <button type="button" aria-label="Назад" onClick={onBack} style={iconBtn()}><Back /></button>
        <div style={{ flex: 1, textAlign: "center", fontFamily: FD, fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em", color: L1 }}>Дневник садханы</div>
        {st
          ? <button type="button" aria-label="Настройки" onClick={() => setShowSet((v) => !v)} style={iconBtn(showSet)}><Gear /></button>
          : <span style={{ width: 38 }} />}
      </header>

      <div style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "14px 16px calc(40px + env(safe-area-inset-bottom,0px))" }}>

          {/* — гость — */}
          {status === "guest" && (
            <div style={{ ...card, textAlign: "center", padding: "34px 22px", marginTop: 8 }}>
              <div style={{ width: 56, height: 56, margin: "0 auto 14px", borderRadius: 16, display: "grid", placeItems: "center", background: `color-mix(in srgb, ${GOLD} 14%, transparent)`, color: GOLD }}><Flame /></div>
              <div style={{ fontFamily: FD, fontSize: 19, fontWeight: 800, letterSpacing: "-0.02em", color: L1 }}>Ведите дневник садханы</div>
              <p style={{ margin: "8px auto 18px", maxWidth: 320, fontFamily: FT, fontSize: 13.5, lineHeight: 1.55, color: L2 }}>
                Круги джапы, чтение книг и время подъёма — со стриками, статистикой и историей. Войдите, чтобы практика сохранялась на всех устройствах.
              </p>
              <button type="button" onClick={() => requireAuth()}
                style={{ padding: "11px 26px", borderRadius: 999, border: "none", background: GOLD, color: "#fff", fontFamily: FT, fontSize: 14.5, fontWeight: 700, cursor: "pointer", boxShadow: "0 8px 22px rgba(210,170,27,0.4)", WebkitTapHighlightColor: "transparent" }}>
                Войти
              </button>
            </div>
          )}

          {/* — загрузка — */}
          {status !== "guest" && loading && (
            <div style={{ padding: "60px 0", textAlign: "center", color: L3, fontFamily: FT, fontSize: 14 }}>Загрузка…</div>
          )}

          {/* — ошибка — */}
          {status !== "guest" && !loading && failed && (
            <div style={{ ...card, textAlign: "center", padding: "34px 22px", marginTop: 8 }}>
              <p style={{ margin: "0 0 16px", fontFamily: FT, fontSize: 14, color: L2 }}>Не удалось загрузить дневник.</p>
              <button type="button" onClick={() => void load()} style={{ ...miniBtn, minWidth: 120 }}>Повторить</button>
            </div>
          )}

          {/* — данные — */}
          {st && !loading && !failed && (
            <>
              {/* настройки */}
              {showSet && (
                <div style={{ ...card, marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <span style={{ fontFamily: FT, fontSize: 14, color: L1 }}>Цель в день (кругов)</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                      <button type="button" aria-label="Меньше" onClick={() => bumpGoal(goal - (goal > 16 ? 4 : 1))} disabled={goal <= 1} style={{ ...miniBtn, width: 36, minWidth: 36, opacity: goal <= 1 ? 0.5 : 1 }}>−</button>
                      <span style={{ minWidth: 30, textAlign: "center", fontFamily: FD, fontSize: 17, fontWeight: 800, color: L1 }}>{goal}</span>
                      <button type="button" aria-label="Больше" onClick={() => bumpGoal(goal + (goal >= 16 ? 4 : 1))} disabled={goal >= 64} style={{ ...miniBtn, width: 36, minWidth: 36, opacity: goal >= 64 ? 0.5 : 1 }}>+</button>
                    </span>
                  </div>
                  <p style={{ margin: "10px 2px 0", fontFamily: FT, fontSize: 11.5, lineHeight: 1.5, color: L3 }}>
                    Стандарт ИСККОН — 16 кругов в день. Цель общая со счётчиком джапы.
                  </p>
                </div>
              )}

              {/* герой: круги сегодня */}
              <div style={{ fontFamily: FT, fontSize: 12, fontWeight: 700, letterSpacing: "0.4px", textTransform: "uppercase", color: L3, margin: "0 2px 10px" }}>
                {relDay(st.today)}, {prettyDate(st.today)}
              </div>
              <button type="button" onClick={openJapa} aria-label="Открыть счётчик джапы"
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 16, padding: 16, borderRadius: 20, border: "none", background: FILL, cursor: "pointer", WebkitTapHighlightColor: "transparent", textAlign: "left" }}>
                <div style={{ position: "relative", flexShrink: 0, width: 96, height: 96 }}>
                  <svg viewBox="0 0 176 176" width="96" height="96" style={{ transform: "rotate(-90deg)" }} aria-hidden>
                    <circle cx="88" cy="88" r={R} fill="none" stroke="color-mix(in srgb, var(--color-label) 9%, transparent)" strokeWidth="11" />
                    <circle cx="88" cy="88" r={R} fill="none" stroke={ringColor} strokeWidth="11" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - goalPct)} style={{ transition: "stroke-dashoffset .35s ease, stroke .2s" }} />
                  </svg>
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontFamily: FD, fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, color: L1 }}>{todayRounds}</span>
                    <span style={{ fontFamily: FT, fontSize: 10.5, color: L2, marginTop: 1 }}>из {goal}</span>
                  </div>
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ fontFamily: FD, fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em", color: done ? GREEN : L1 }}>
                      {done ? "Норма выполнена" : `${todayRounds} ${pluralRu(todayRounds, "круг", "круга", "кругов")}`}
                    </span>
                    {done && <span style={{ color: GREEN, display: "inline-flex" }}><Check /></span>}
                  </div>
                  <div style={{ marginTop: 3, fontFamily: FT, fontSize: 12.5, color: L2 }}>
                    {done ? "Харе Кришна! Можно продолжать." : `Ещё ${goal - todayRounds} ${pluralRu(goal - todayRounds, "круг", "круга", "кругов")} до нормы`}
                  </div>
                  <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 4, fontFamily: FT, fontSize: 12.5, fontWeight: 600, color: GOLDT }}>
                    Открыть счётчик <Chevron />
                  </div>
                </div>
              </button>

              {/* чтение / подъём / заметка */}
              <div style={{ ...card, marginTop: 12 }}>
                {/* чтение */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center", background: `color-mix(in srgb, ${GOLD} 14%, transparent)`, color: GOLD }}><Book /></span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: "block", fontFamily: FT, fontSize: 14, color: L1 }}>Чтение Прабхупады</span>
                    <span style={{ display: "block", marginTop: 1, fontFamily: FD, fontSize: 16, fontWeight: 800, color: readMin > 0 ? L1 : L3 }}>{readMin > 0 ? fmtMin(readMin) : "—"}</span>
                  </span>
                  <span style={{ display: "inline-flex", gap: 6, flexShrink: 0 }}>
                    <button type="button" aria-label="−15 минут" onClick={() => bumpRead(-15)} disabled={readMin <= 0} style={{ ...miniBtn, opacity: readMin <= 0 ? 0.5 : 1 }}>−15</button>
                    <button type="button" aria-label="+15 минут" onClick={() => bumpRead(15)} style={miniBtn}>+15</button>
                  </span>
                </div>
                <div style={{ display: "flex", gap: 7, marginTop: 11, paddingLeft: 50 }}>
                  {[30, 60].map((q) => (
                    <button key={q} type="button" onClick={() => bumpRead(q)}
                      style={{ padding: "5px 12px", borderRadius: 999, border: "none", background: FILL2, color: L2, fontFamily: FT, fontSize: 12, fontWeight: 600, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                      +{q} мин
                    </button>
                  ))}
                </div>

                <div style={{ height: 1, background: HAIR, margin: "14px 0" }} />

                {/* подъём */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center", background: `color-mix(in srgb, ${GOLD} 14%, transparent)`, color: GOLD }}><Sun /></span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: "block", fontFamily: FT, fontSize: 14, color: L1 }}>Подъём (мангала-арати)</span>
                    <span style={{ display: "block", marginTop: 1, fontFamily: FT, fontSize: 11.5, color: L3 }}>Во сколько встали сегодня</span>
                  </span>
                  <input type="time" value={roseAt} onChange={(e) => { setRoseAt(e.target.value); void send({ roseAt: e.target.value || null }); }}
                    style={{ flexShrink: 0, padding: "8px 10px", borderRadius: 10, border: `0.5px solid ${HAIR}`, background: FILL2, color: roseAt ? L1 : L3, fontFamily: FT, fontSize: 14.5, fontWeight: 600, colorScheme: "dark light" }} />
                </div>

                <div style={{ height: 1, background: HAIR, margin: "14px 0" }} />

                {/* заметка */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <span style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center", background: `color-mix(in srgb, ${GOLD} 14%, transparent)`, color: GOLD }}><Pencil /></span>
                  <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} onBlur={() => send({ note })}
                    placeholder="Заметка дня: реализации, благодарности, планы…" rows={2}
                    style={{ flex: 1, minWidth: 0, resize: "none", padding: "9px 11px", borderRadius: 12, border: `0.5px solid ${HAIR}`, background: FILL2, color: L1, fontFamily: FT, fontSize: 13.5, lineHeight: 1.5, outline: "none" }} />
                </div>
              </div>

              {/* стрики */}
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <StreakCard icon={<Flame />} value={st.stats.currentStreak} label={`${pluralRu(st.stats.currentStreak, "день", "дня", "дней")} подряд`} tone={GOLD} />
                <StreakCard icon={<Trophy />} value={st.stats.longestStreak} label="рекорд серии" tone={GREEN} />
              </div>

              {/* неделя */}
              <div style={{ ...card, marginTop: 12 }}>
                <div style={{ fontFamily: FT, fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: L3, marginBottom: 14 }}>Эта неделя</div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 96 }}>
                  {st.week.map((w) => {
                    const frac = Math.min(1, w.rounds / Math.max(1, weekMax));
                    const h = w.rounds > 0 ? Math.max(8, Math.round(frac * 78)) : 4;
                    const wd = parseYmd(w.day).getDay();
                    const col = w.done ? GREEN : w.rounds > 0 ? `color-mix(in srgb, ${GOLD} 55%, transparent)` : "color-mix(in srgb, var(--color-label) 8%, transparent)";
                    return (
                      <div key={w.day} title={`${prettyDate(w.day)}: ${w.rounds} кр.`} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", gap: 6 }}>
                        <div style={{ fontFamily: FT, fontSize: 10, fontWeight: 700, color: w.rounds > 0 ? L2 : "transparent", lineHeight: 1 }}>{w.rounds || 0}</div>
                        <div style={{ width: "100%", maxWidth: 30, height: h, borderRadius: 6, background: col, outline: w.today ? `2px solid ${GOLD}` : "none", outlineOffset: 1, transition: "height .3s ease" }} />
                        <div style={{ fontFamily: FT, fontSize: 11, fontWeight: w.today ? 800 : 500, color: w.today ? GOLDT : L3, lineHeight: 1 }}>{RU_WD1[wd]}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* карта практики */}
              <Heatmap roundsByDay={roundsByDay} goal={goal} />

              {/* статистика всего */}
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <Tile value={st.stats.totalRounds.toLocaleString("ru-RU")} label="Кругов всего" />
                <Tile value={String(st.stats.daysPracticed)} label="Дней практики" />
                <Tile value={fmtMin(st.stats.totalReadingMin)} label="Чтение всего" accent={GOLDT} />
              </div>

              {/* история */}
              {st.history.length > 0 && (
                <>
                  <div style={{ fontFamily: FT, fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: L3, margin: "22px 2px 10px" }}>История</div>
                  <div style={{ borderRadius: 16, background: FILL, overflow: "hidden" }}>
                    {st.history.slice(0, 30).map((d, i) => (
                      <button type="button" key={d.day} onClick={() => setEditDay(d)} aria-label={`Изменить день: ${relDay(d.day)}`}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 15px", borderTop: i ? `0.5px solid ${HAIR}` : "none", background: "none", border: "none", cursor: "pointer", textAlign: "left", WebkitTapHighlightColor: "transparent", font: "inherit" }}>
                        <span style={{ flexShrink: 0, width: 64 }}>
                          <span style={{ display: "block", fontFamily: FD, fontSize: 13.5, fontWeight: 700, color: L1, lineHeight: 1.2 }}>{relDay(d.day)}</span>
                        </span>
                        <span style={{ minWidth: 0, flex: 1, display: "flex", flexWrap: "wrap", gap: "2px 12px", alignItems: "baseline" }}>
                          <span style={{ fontFamily: FT, fontSize: 13.5, fontWeight: 700, color: d.rounds >= goal ? GREEN : L1 }}>
                            {d.rounds} {pluralRu(d.rounds, "круг", "круга", "кругов")}
                          </span>
                          {d.reading_min > 0 && <span style={{ fontFamily: FT, fontSize: 12, color: L2 }}>чтение {fmtMin(d.reading_min)}</span>}
                          {d.rose_at && <span style={{ fontFamily: FT, fontSize: 12, color: L2 }}>подъём {d.rose_at}</span>}
                          {d.note && <span style={{ flexBasis: "100%", fontFamily: FT, fontSize: 12, color: L3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.note}</span>}
                        </span>
                        {d.rounds >= goal && <span style={{ flexShrink: 0, color: GREEN, display: "inline-flex" }}><Check /></span>}
                        <span style={{ flexShrink: 0, display: "inline-flex" }}><Chevron /></span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              <p style={{ margin: "18px 2px 0", fontFamily: FT, fontSize: 11, lineHeight: 1.5, color: L3, textAlign: "center" }}>
                Круги берутся из счётчика джапы. Серия не прерывается, если сегодняшняя норма ещё не закрыта.
              </p>
            </>
          )}
        </div>
      </div>

      {editDay && (
        <DayEditor
          day={editDay.day}
          initial={editDay}
          goal={goal}
          onClose={() => setEditDay(null)}
          onSaved={(s, d) => {
            setSt(s);
            if (d === ymd()) { setReadMin(s.todayRow.reading_min); setRoseAt(s.todayRow.rose_at ?? ""); setNote(s.todayRow.note ?? ""); }
          }}
        />
      )}

      <style>{`@keyframes sadFade{from{opacity:0}to{opacity:1}}@keyframes sadSheet{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
    </div>
  );
}
