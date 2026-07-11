/**
 * JapaScreen — счётчик джапы (садхана · «Моя практика»).
 *
 * Полноэкранный модуль ежедневного повторения Маха-мантры. Эстетика приложения
 * (iOS-26 · Liquid Glass): золото + мягкая заливка без обводок, токены темы,
 * только инлайн-SVG и WebAudio — без сторонних зависимостей.
 *
 * Состоит из двух режимов:
 *   • «Счётчик» — большое касание-кольцо (бусина за бусиной), три живых счётчика
 *     (бусина в круге · круги сегодня · имена сегодня), цель 16 кругов, и
 *     метроном Маха-мантры с регулируемой скоростью (медленно/средне/быстро),
 *     тоном-колокольчиком и опциональным авто-счётом бусин.
 *   • «Аналитика» — день/неделя/месяц/год/свой диапазон: круги, имена, время,
 *     дни практики, столбчатый график, стрик (дней подряд) и рекорды.
 *
 * Источник правды — localStorage на устройстве (работает офлайн и для гостя).
 * Каждый завершённый круг тихо зеркалится на сервер (recordJapa) для вошедшего
 * пользователя — кросс-устройство и сводка кабинета. Никогда не блокирует UX.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { recordJapa, type JapaRoundDTO } from "./account/track";

/* ───────────────────────── палитра / токены ───────────────────────── */
const GOLD = "var(--color-gold)";
const GOLDT = "#9c7c15";
const GREEN = "#34C759";
const RED = "#FF3B30";
const L1 = "var(--color-label)";
const L2 = "var(--color-label-2)";
const L3 = "var(--color-label-3)";
const FILL = "var(--color-glass-thin)";
const FILL2 = "var(--color-glass-regular)";
const HAIR = "var(--color-hairline)";
const FT = "var(--font-text)";
const FD = "var(--font-display)";
const FS = "var(--font-scripture)";

/* ───────────────────────── Маха-мантра ───────────────────────── */
// 16 имён — единица повторения метронома (одна мантра = одна бусина).
const MANTRA = [
  "Харе", "Кришна", "Харе", "Кришна", "Кришна", "Кришна", "Харе", "Харе",
  "Харе", "Рама", "Харе", "Рама", "Рама", "Рама", "Харе", "Харе",
] as const;
const MANTRA_DEV = "हरे कृष्ण हरे कृष्ण कृष्ण कृष्ण हरे हरे हरे राम हरे राम राम राम हरे हरे";
const NAMES_PER_BEAD = 16;

// Интервал на одно имя (мс) для трёх скоростей.
const SPEEDS: Record<"slow" | "mid" | "fast", number> = { slow: 1100, mid: 720, fast: 460 };
const SPEED_LABEL: Record<"slow" | "mid" | "fast", string> = { slow: "Медленно", mid: "Средне", fast: "Быстро" };

/* ───────────────────────── хранилище ───────────────────────── */
const KEY = "iol:japa:v1";
const DEV_KEY = "iol:device";

interface Round { t: number; d: number; b: number } // завершён (epoch ms) · длительность сек · бусин
interface JapaState { v: 1; goal: number; bpr: number; curBeads: number; curStart: number | null; rounds: Round[] }

const DEFAULT_STATE: JapaState = { v: 1, goal: 16, bpr: 108, curBeads: 0, curStart: null, rounds: [] };

function loadState(): JapaState {
  if (typeof localStorage === "undefined") return { ...DEFAULT_STATE };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const d = JSON.parse(raw) as Partial<JapaState>;
    return {
      v: 1,
      goal: Number.isFinite(d.goal) ? Math.min(192, Math.max(1, Math.round(d.goal as number))) : 16,
      bpr: Number.isFinite(d.bpr) ? Math.min(1080, Math.max(4, Math.round(d.bpr as number))) : 108,
      curBeads: Number.isFinite(d.curBeads) ? Math.max(0, Math.round(d.curBeads as number)) : 0,
      curStart: typeof d.curStart === "number" ? d.curStart : null,
      rounds: Array.isArray(d.rounds) ? d.rounds.filter((r) => r && typeof r.t === "number").map((r) => ({ t: r.t, d: Math.max(0, r.d || 0), b: Math.max(1, r.b || 108) })) : [],
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}
function saveState(s: JapaState): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* квота — не критично */ }
}
function deviceId(): string {
  if (typeof localStorage === "undefined") return "dev";
  try {
    let v = localStorage.getItem(DEV_KEY);
    if (!v) { v = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem(DEV_KEY, v); }
    return v;
  } catch { return "dev"; }
}

/* ───────────────────────── даты / формат ───────────────────────── */
const RU_WD = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const RU_MON = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

function startOfDay(ms: number): number { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); }
function addDays(ms: number, n: number): number { const d = new Date(ms); d.setDate(d.getDate() + n); return d.getTime(); }
function dayKey(ms: number): string {
  const d = new Date(ms);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
function fmt(n: number): string { return Math.round(n).toLocaleString("ru-RU"); }
function fmtDur(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const r = s % 60;
  if (h) return `${h} ч ${m} м`;
  if (m) return `${m} м`;
  return `${r} с`;
}

/* ───────────────────────── обратная связь ───────────────────────── */
function buzz(p: number | number[]): void {
  try { if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(p); } catch { /* noop */ }
}
let audioCtx: AudioContext | null = null;
function ping(freq = 528): void {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx || new Ctx();
    const ctx = audioCtx;
    if (ctx.state === "suspended") void ctx.resume();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = "sine"; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.13, ctx.currentTime + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.24);
  } catch { /* noop */ }
}

/* ───────────────────────── иконки ───────────────────────── */
const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const Back = () => (<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden><path {...S} d="M15 5l-7 7 7 7" /></svg>);
const Gear = () => (<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden><circle {...S} cx="12" cy="12" r="3" /><path {...S} d="M19.4 13.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" /></svg>);
const Play = () => (<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg>);
const Pause = () => (<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden><rect x="6.5" y="5.5" width="3.6" height="13" rx="1.2" fill="currentColor" /><rect x="13.9" y="5.5" width="3.6" height="13" rx="1.2" fill="currentColor" /></svg>);
const Flame = () => (<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden><path d="M12 2.5c2.4 3 1 5.2-.3 6.6-1 1-1.7 2-1.7 3.2 0 1.2.9 2 2 2s2-.8 2-2.1c0-.5-.2-1-.5-1.4 2 .7 3.2 2.6 3.2 4.7A5.4 5.4 0 0 1 12 21a5.4 5.4 0 0 1-5.4-5.4c0-2.6 1.4-4.4 2.7-6 1.6-2 2.9-4 2.7-7.1z" fill="currentColor" /></svg>);
const Bell = () => (<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden><path {...S} d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5 2 6H4c.5-1 2-2 2-6Z" /><path {...S} d="M10 19a2 2 0 0 0 4 0" /></svg>);

/* ───────────────────────── аналитика ───────────────────────── */
type Mode = "day" | "week" | "month" | "year" | "range";
interface Bucket { label: string; rounds: number; beads: number; seconds: number; strong?: boolean }
interface Analytics {
  totals: { rounds: number; beads: number; seconds: number; days: number };
  buckets: Bucket[];
  best: { day: string; rounds: number } | null;
  avg: number;
}

function buildAnalytics(rounds: Round[], mode: Mode, fromStr: string, toStr: string): Analytics {
  const now = Date.now();
  const today = startOfDay(now);
  let from: number; let to: number;
  if (mode === "day") { from = today; to = addDays(today, 1); }
  else if (mode === "week") { from = addDays(today, -6); to = addDays(today, 1); }
  else if (mode === "month") { from = addDays(today, -29); to = addDays(today, 1); }
  else if (mode === "year") { const d = new Date(today); d.setDate(1); d.setMonth(d.getMonth() - 11); from = d.getTime(); to = addDays(today, 1); }
  else {
    const f = Date.parse(fromStr); const t = Date.parse(toStr);
    from = Number.isFinite(f) ? startOfDay(f) : addDays(today, -29);
    to = Number.isFinite(t) ? addDays(startOfDay(t), 1) : addDays(today, 1);
    if (to <= from) to = addDays(from, 1);
  }

  const inRange = rounds.filter((r) => r.t >= from && r.t < to);
  const byDay = new Map<string, { rounds: number; beads: number; seconds: number }>();
  for (const r of inRange) {
    const k = dayKey(r.t);
    const cur = byDay.get(k) || { rounds: 0, beads: 0, seconds: 0 };
    cur.rounds += 1; cur.beads += r.b; cur.seconds += r.d;
    byDay.set(k, cur);
  }
  const totals = inRange.reduce((a, r) => ({ rounds: a.rounds + 1, beads: a.beads + r.b, seconds: a.seconds + r.d, days: 0 }), { rounds: 0, beads: 0, seconds: 0, days: 0 });
  totals.days = byDay.size;

  let best: { day: string; rounds: number } | null = null;
  for (const [k, v] of byDay) if (!best || v.rounds > best.rounds) best = { day: k, rounds: v.rounds };
  const avg = totals.days ? totals.rounds / totals.days : 0;

  // Корзины графика.
  const buckets: Bucket[] = [];
  if (mode === "day") {
    const hours = new Array(24).fill(0).map(() => ({ rounds: 0, beads: 0, seconds: 0 }));
    for (const r of inRange) { const h = new Date(r.t).getHours(); hours[h].rounds += 1; hours[h].beads += r.b; hours[h].seconds += r.d; }
    const hNow = new Date(now).getHours();
    for (let h = 0; h < 24; h++) buckets.push({ label: h % 6 === 0 ? `${h}` : "", rounds: hours[h].rounds, beads: hours[h].beads, seconds: hours[h].seconds, strong: h === hNow });
  } else if (mode === "year") {
    for (let i = 0; i < 12; i++) {
      const d = new Date(from); d.setMonth(d.getMonth() + i);
      const ks = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      let R = 0, B = 0, Sec = 0;
      for (const [k, v] of byDay) if (k.startsWith(ks)) { R += v.rounds; B += v.beads; Sec += v.seconds; }
      const nowM = new Date(now);
      buckets.push({ label: RU_MON[d.getMonth()], rounds: R, beads: B, seconds: Sec, strong: d.getMonth() === nowM.getMonth() && d.getFullYear() === nowM.getFullYear() });
    }
  } else {
    // дневные корзины (неделя/месяц/диапазон ≤ 62 дней); иначе — помесячно.
    const spanDays = Math.round((to - from) / 86400000);
    if (spanDays > 62) {
      const seen = new Set<string>();
      const start = new Date(from); start.setDate(1);
      for (let d = start.getTime(); d < to; ) {
        const dt = new Date(d);
        const ks = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
        if (!seen.has(ks)) {
          seen.add(ks);
          let R = 0, B = 0, Sec = 0;
          for (const [k, v] of byDay) if (k.startsWith(ks)) { R += v.rounds; B += v.beads; Sec += v.seconds; }
          buckets.push({ label: `${RU_MON[dt.getMonth()]}`, rounds: R, beads: B, seconds: Sec });
        }
        dt.setMonth(dt.getMonth() + 1); d = dt.getTime();
      }
    } else {
      const stride = spanDays > 16 ? 5 : 1;
      let i = 0;
      for (let d = from; d < to; d = addDays(d, 1), i++) {
        const k = dayKey(d); const v = byDay.get(k);
        const dt = new Date(d);
        const lab = spanDays <= 7 ? RU_WD[dt.getDay()] : (i % stride === 0 ? `${dt.getDate()}` : "");
        buckets.push({ label: lab, rounds: v?.rounds || 0, beads: v?.beads || 0, seconds: v?.seconds || 0, strong: k === dayKey(now) });
      }
    }
  }
  return { totals, buckets, best, avg };
}

// Текущий стрик (дней подряд, заканчивая сегодня/вчера) с условием на круги.
function streak(rounds: Round[], minRounds: number): number {
  const perDay = new Map<string, number>();
  for (const r of rounds) perDay.set(dayKey(r.t), (perDay.get(dayKey(r.t)) || 0) + 1);
  const ok = (k: string) => (perDay.get(k) || 0) >= minRounds;
  const today = startOfDay(Date.now());
  let cursor = ok(dayKey(today)) ? today : (ok(dayKey(addDays(today, -1))) ? addDays(today, -1) : 0);
  if (!cursor) return 0;
  let n = 0;
  while (ok(dayKey(cursor))) { n += 1; cursor = addDays(cursor, -1); }
  return n;
}

/* ───────────────────────── презентационные блоки ───────────────────────── */
function Tile({ value, label, sub, accent }: { value: string; label: string; sub?: string; accent?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0, padding: "13px 12px", borderRadius: 16, background: FILL, textAlign: "center" }}>
      <div style={{ fontFamily: FD, fontSize: "var(--text-title2)", fontWeight: 800, letterSpacing: "-0.02em", color: accent || L1, lineHeight: 1.05 }}>{value}</div>
      <div style={{ marginTop: 3, fontFamily: FT, fontSize: "var(--text-caption)", fontWeight: 600, color: L2 }}>{label}</div>
      {sub && <div style={{ marginTop: 1, fontFamily: FT, fontSize: "var(--text-caption2)", color: L3 }}>{sub}</div>}
    </div>
  );
}

function Bars({ buckets }: { buckets: Bucket[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.rounds));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: buckets.length > 20 ? 2 : 5, height: 132, padding: "0 2px" }}>
        {buckets.map((b, i) => {
          const h = b.rounds > 0 ? Math.max(4, Math.round((b.rounds / max) * 124)) : 2;
          return (
            <div key={i} title={`${b.rounds} кр.`} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", height: "100%" }}>
              <div style={{ width: "100%", maxWidth: 30, height: h, borderRadius: 5, background: b.rounds > 0 ? (b.strong ? GOLD : `color-mix(in srgb, ${GOLD} 42%, transparent)`) : "color-mix(in srgb, var(--color-label) 7%, transparent)" }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: buckets.length > 20 ? 2 : 5, marginTop: 7, padding: "0 2px" }}>
        {buckets.map((b, i) => (
          <div key={i} style={{ flex: 1, minWidth: 0, textAlign: "center", fontFamily: FT, fontSize: "var(--text-caption2)", color: b.strong ? GOLDT : L3, fontWeight: b.strong ? 700 : 500, whiteSpace: "nowrap", overflow: "hidden" }}>{b.label}</div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── экран ───────────────────────── */
export default function JapaScreen({ onBack }: { onBack: () => void }) {
  const [st, setSt] = useState<JapaState>(() => loadState());
  const stRef = useRef(st); stRef.current = st;
  const [view, setView] = useState<"counter" | "stats">("counter");
  const [showSet, setShowSet] = useState(false);
  const [flash, setFlash] = useState(0); // счётчик завершённых кругов для всплеска

  // Зеркало одного круга на сервер (no-op для гостя; идемпотентно по client_id).
  const mirror = useCallback((r: Round) => {
    const dto: JapaRoundDTO = { id: `${deviceId()}:${r.t}`, day: dayKey(r.t), at: new Date(r.t).toISOString(), beads: r.b, durationSec: r.d };
    recordJapa([dto]);
  }, []);

  const commit = useCallback((next: JapaState) => { stRef.current = next; setSt(next); saveState(next); }, []);

  const addBead = useCallback(() => {
    const prev = stRef.current;
    const now = Date.now();
    const start = prev.curStart ?? now;
    const nb = prev.curBeads + 1;
    if (nb >= prev.bpr) {
      const round: Round = { t: now, d: Math.max(0, Math.round((now - start) / 1000)), b: prev.bpr };
      commit({ ...prev, curBeads: 0, curStart: null, rounds: [...prev.rounds, round] });
      mirror(round);
      setFlash((f) => f + 1);
      buzz([14, 46, 14]);
      ping(660);
    } else {
      commit({ ...prev, curBeads: nb, curStart: start });
      buzz(8);
    }
  }, [commit, mirror]);

  const undoBead = useCallback(() => {
    const prev = stRef.current;
    if (prev.curBeads <= 0) return;
    commit({ ...prev, curBeads: prev.curBeads - 1, curStart: prev.curBeads - 1 === 0 ? null : prev.curStart });
    buzz(6);
  }, [commit]);

  const resetRound = useCallback(() => {
    const prev = stRef.current;
    if (prev.curBeads === 0) return;
    if (typeof window !== "undefined" && !window.confirm("Сбросить текущий круг? Бусины обнулятся.")) return;
    commit({ ...prev, curBeads: 0, curStart: null });
  }, [commit]);

  // Всплеск «+1 круг».
  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(0), 1100);
    return () => clearTimeout(id);
  }, [flash]);

  /* ── метроном Маха-мантры ── */
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<"slow" | "mid" | "fast">("mid");
  const [sound, setSound] = useState(true);
  const [autoCount, setAutoCount] = useState(false);
  const [tok, setTok] = useState(0);
  const tokRef = useRef(0);
  const soundRef = useRef(sound); soundRef.current = sound;
  const autoRef = useRef(autoCount); autoRef.current = autoCount;

  useEffect(() => {
    if (!playing) return;
    if (soundRef.current) ping(tok === 0 ? 528 : 494);
    const ms = SPEEDS[speed];
    const id = setInterval(() => {
      const n = tokRef.current + 1;
      if (n >= MANTRA.length) {
        tokRef.current = 0; setTok(0);
        if (autoRef.current) addBead();
        if (soundRef.current) ping(528);
      } else {
        tokRef.current = n; setTok(n);
        if (soundRef.current) ping(494);
      }
    }, ms);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed]);

  /* ── производные значения ── */
  const todayK = dayKey(Date.now());
  const roundsToday = useMemo(() => st.rounds.reduce((n, r) => n + (dayKey(r.t) === todayK ? 1 : 0), 0), [st.rounds, todayK]);
  const secToday = useMemo(() => st.rounds.reduce((n, r) => n + (dayKey(r.t) === todayK ? r.d : 0), 0), [st.rounds, todayK]);
  const beadsTodayTotal = roundsToday * st.bpr + st.curBeads; // включая текущий круг
  const namesToday = beadsTodayTotal * NAMES_PER_BEAD;
  const goalPct = Math.min(1, roundsToday / Math.max(1, st.goal));

  // Геометрия кольца.
  const R = 104, C = 2 * Math.PI * R;
  const ringFrac = st.curBeads / st.bpr;

  /* ── аналитика ── */
  const [mode, setMode] = useState<Mode>("week");
  const todayStr = dayKey(Date.now());
  const [rFrom, setRFrom] = useState(dayKey(addDays(Date.now(), -29)));
  const [rTo, setRTo] = useState(todayStr);
  const an = useMemo(() => buildAnalytics(st.rounds, mode, rFrom, rTo), [st.rounds, mode, rFrom, rTo]);
  const liveStreak = useMemo(() => streak(st.rounds, 1), [st.rounds]);
  const normStreak = useMemo(() => streak(st.rounds, st.goal), [st.rounds, st.goal]);
  const allTime = useMemo(() => st.rounds.reduce((a, r) => ({ rounds: a.rounds + 1, beads: a.beads + r.b }), { rounds: 0, beads: 0 }), [st.rounds]);
  const allDays = useMemo(() => new Set(st.rounds.map((r) => dayKey(r.t))).size, [st.rounds]);

  /* ── стили ── */
  const navStyle: CSSProperties = {
    position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "center", gap: 4, height: 52, padding: "0 6px",
    background: "color-mix(in srgb, var(--color-bg) 82%, transparent)", backdropFilter: "saturate(180%) blur(20px)", WebkitBackdropFilter: "saturate(180%) blur(20px)",
    borderBottom: `0.5px solid ${HAIR}`,
  };
  const seg = (on: boolean): CSSProperties => ({
    flex: 1, padding: "8px 0", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: FT, fontSize: "var(--text-footnote)",
    fontWeight: on ? 700 : 500, color: on ? "#fff" : L2, background: on ? GOLD : "transparent", WebkitTapHighlightColor: "transparent",
    transition: "background .15s, color .15s",
  });
  const chip = (on: boolean): CSSProperties => ({
    flexShrink: 0, padding: "7px 13px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: FT, fontSize: "var(--text-footnote)",
    fontWeight: on ? 700 : 500, color: on ? "#fff" : L2, background: on ? GOLD : FILL2, WebkitTapHighlightColor: "transparent",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "var(--color-bg)", fontFamily: FT }}>
      <header style={navStyle}>
        <button type="button" aria-label="Назад" onClick={onBack}
          style={{ display: "grid", height: 38, width: 38, placeItems: "center", borderRadius: "50%", border: "none", background: "none", color: L1, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
          <Back />
        </button>
        <div style={{ flex: 1, textAlign: "center", fontFamily: FD, fontSize: "var(--text-body)", fontWeight: 700, letterSpacing: "-0.02em", color: L1 }}>Джапа</div>
        <button type="button" aria-label="Настройки" onClick={() => setShowSet((v) => !v)}
          style={{ display: "grid", height: 38, width: 38, placeItems: "center", borderRadius: "50%", border: "none", background: "none", color: showSet ? GOLD : L1, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
          <Gear />
        </button>
      </header>

      <div style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "12px 16px calc(40px + env(safe-area-inset-bottom,0px))" }}>

          {/* режимы */}
          <div style={{ display: "flex", gap: 3, padding: 3, borderRadius: 12, background: FILL, marginBottom: 16 }}>
            <button type="button" style={seg(view === "counter")} onClick={() => setView("counter")}>Счётчик</button>
            <button type="button" style={seg(view === "stats")} onClick={() => setView("stats")}>Аналитика</button>
          </div>

          {/* настройки */}
          {showSet && (
            <div style={{ marginBottom: 16, padding: 14, borderRadius: 16, background: FILL }}>
              <Stepper label="Цель в день (кругов)" value={st.goal} min={1} max={64} step={st.goal >= 16 ? 4 : 1}
                onChange={(v) => commit({ ...stRef.current, goal: v })} />
              <div style={{ height: 10 }} />
              <Stepper label="Бусин в круге" value={st.bpr} min={4} max={216} step={st.bpr >= 108 ? 8 : 1}
                onChange={(v) => commit({ ...stRef.current, bpr: v })} />
              <p style={{ margin: "10px 2px 0", fontFamily: FT, fontSize: "var(--text-caption)", lineHeight: 1.5, color: L3 }}>
                Стандарт ИСККОН — 16 кругов по 108 бусин. Одна бусина — одна Маха-мантра (16 имён).
              </p>
            </div>
          )}

          {view === "counter" ? (
            <>
              {/* кольцо-счётчик */}
              <div style={{ position: "relative", display: "flex", justifyContent: "center", marginTop: 4 }}>
                <button type="button" onClick={addBead} aria-label="Бусина — отметить"
                  style={{ position: "relative", width: "min(78vw, 320px)", aspectRatio: "1 / 1", borderRadius: "50%", border: "none", background: "none", cursor: "pointer", padding: 0, WebkitTapHighlightColor: "transparent", userSelect: "none" }}>
                  <svg viewBox="0 0 240 240" width="100%" height="100%" style={{ display: "block", transform: "rotate(-90deg)" }} aria-hidden>
                    <circle cx="120" cy="120" r={R} fill="none" stroke="color-mix(in srgb, var(--color-label) 8%, transparent)" strokeWidth="13" />
                    <circle cx="120" cy="120" r={R} fill="none" stroke={GOLD} strokeWidth="13" strokeLinecap="round"
                      strokeDasharray={C} strokeDashoffset={C * (1 - ringFrac)} style={{ transition: "stroke-dashoffset .25s ease" }} />
                  </svg>
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                    <div style={{ fontFamily: FT, fontSize: "var(--text-caption)", fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: GOLDT }}>Круг {roundsToday + 1}</div>
                    <div style={{ fontFamily: FD, fontSize: "clamp(56px, 19vw, 88px)", fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, color: L1 }}>{st.curBeads}</div>
                    <div style={{ fontFamily: FT, fontSize: "var(--text-subhead)", color: L2 }}>из {st.bpr}</div>
                  </div>
                  {flash > 0 && (
                    <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none" }}>
                      <div style={{ padding: "8px 18px", borderRadius: 999, background: GOLD, color: "#fff", fontFamily: FD, fontSize: "var(--text-body)", fontWeight: 800, letterSpacing: "-0.01em", boxShadow: "0 10px 30px rgba(210,170,27,0.45)", animation: "japaPop .35s ease" }}>+1 круг</div>
                    </div>
                  )}
                </button>
              </div>

              {/* мелкие контролы под кольцом */}
              <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 14 }}>
                <button type="button" onClick={undoBead} disabled={st.curBeads <= 0}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 15px", borderRadius: 999, border: "none", background: FILL2, color: st.curBeads <= 0 ? L3 : L1, cursor: st.curBeads <= 0 ? "default" : "pointer", fontFamily: FT, fontSize: "var(--text-footnote)", fontWeight: 600, opacity: st.curBeads <= 0 ? 0.55 : 1, WebkitTapHighlightColor: "transparent" }}>− Бусина</button>
                <button type="button" onClick={resetRound} disabled={st.curBeads === 0}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 15px", borderRadius: 999, border: "none", background: FILL2, color: st.curBeads === 0 ? L3 : RED, cursor: st.curBeads === 0 ? "default" : "pointer", fontFamily: FT, fontSize: "var(--text-footnote)", fontWeight: 600, opacity: st.curBeads === 0 ? 0.55 : 1, WebkitTapHighlightColor: "transparent" }}>Сбросить круг</button>
              </div>

              {/* цель дня */}
              <div style={{ marginTop: 18, padding: 14, borderRadius: 16, background: FILL }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: FT, fontSize: "var(--text-footnote)", fontWeight: 600, color: L2 }}>Цель сегодня</span>
                  <span style={{ fontFamily: FD, fontSize: "var(--text-subhead)", fontWeight: 800, color: roundsToday >= st.goal ? GREEN : L1 }}>{roundsToday} / {st.goal} кругов</span>
                </div>
                <div style={{ marginTop: 9, height: 9, borderRadius: 999, background: "color-mix(in srgb, var(--color-label) 9%, transparent)", overflow: "hidden" }}>
                  <div style={{ width: `${goalPct * 100}%`, height: "100%", borderRadius: 999, background: roundsToday >= st.goal ? GREEN : GOLD, transition: "width .35s ease" }} />
                </div>
              </div>

              {/* три счётчика дня */}
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <Tile value={`${st.curBeads}/${st.bpr}`} label="Бусина" />
                <Tile value={fmt(roundsToday)} label="Круги" accent={roundsToday >= st.goal ? GREEN : undefined} />
                <Tile value={fmt(namesToday)} label="Имён сегодня" accent={GOLDT} />
              </div>
              <div style={{ marginTop: 8, fontFamily: FT, fontSize: "var(--text-caption)", color: L3, textAlign: "center" }}>
                Время сегодня: {fmtDur(secToday)} · стрик {liveStreak} {liveStreak === 1 ? "день" : "дн."}
              </div>

              {/* метроном Маха-мантры */}
              <div style={{ marginTop: 20, padding: 16, borderRadius: 18, background: FILL }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontFamily: FT, fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLD }}>Маха-мантра</div>
                  <button type="button" aria-label={sound ? "Звук включён" : "Звук выключен"} onClick={() => setSound((v) => !v)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 999, border: "none", background: sound ? `color-mix(in srgb, ${GOLD} 16%, transparent)` : FILL2, color: sound ? GOLDT : L3, cursor: "pointer", fontFamily: FT, fontSize: "var(--text-caption)", fontWeight: 600, WebkitTapHighlightColor: "transparent" }}>
                    <Bell /> {sound ? "Звук" : "Без звука"}
                  </button>
                </div>

                <div lang="sa" style={{ marginTop: 11, fontFamily: FS, fontStyle: "italic", fontSize: "var(--text-subhead)", lineHeight: 1.5, color: L2, textAlign: "center" }}>{MANTRA_DEV}</div>

                <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: "5px 7px", justifyContent: "center" }}>
                  {MANTRA.map((w, i) => {
                    const on = playing && i === tok;
                    return (
                      <span key={i} style={{ fontFamily: FT, fontSize: "var(--text-callout)", fontWeight: on ? 800 : 500, letterSpacing: "-0.01em", color: on ? "#fff" : L1, background: on ? GOLD : "transparent", borderRadius: 8, padding: on ? "1px 8px" : "1px 2px", transition: "background .08s, color .08s" }}>{w}</span>
                    );
                  })}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 15 }}>
                  <button type="button" aria-label={playing ? "Пауза" : "Начать"} onClick={() => { if (!playing) { tokRef.current = 0; setTok(0); } setPlaying((v) => !v); }}
                    style={{ flexShrink: 0, display: "grid", placeItems: "center", width: 52, height: 52, borderRadius: "50%", border: "none", background: GOLD, color: "#fff", cursor: "pointer", boxShadow: "0 8px 22px rgba(210,170,27,0.4)", WebkitTapHighlightColor: "transparent" }}>
                    {playing ? <Pause /> : <Play />}
                  </button>
                  <div style={{ flex: 1, display: "flex", gap: 6 }}>
                    {(["slow", "mid", "fast"] as const).map((s) => (
                      <button key={s} type="button" onClick={() => setSpeed(s)}
                        style={{ flex: 1, padding: "9px 0", borderRadius: 11, border: "none", cursor: "pointer", fontFamily: FT, fontSize: "var(--text-footnote)", fontWeight: speed === s ? 700 : 500, color: speed === s ? "#fff" : L2, background: speed === s ? "#1c1c1e" : FILL2, WebkitTapHighlightColor: "transparent" }}>{SPEED_LABEL[s]}</button>
                    ))}
                  </div>
                </div>

                <label style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 13, cursor: "pointer" }}>
                  <button type="button" role="switch" aria-checked={autoCount} onClick={() => setAutoCount((v) => !v)}
                    style={{ flexShrink: 0, width: 44, height: 26, borderRadius: 999, border: "none", padding: 2, cursor: "pointer", background: autoCount ? GREEN : "color-mix(in srgb, var(--color-label) 18%, transparent)", transition: "background .15s", WebkitTapHighlightColor: "transparent" }}>
                    <span style={{ display: "block", width: 22, height: 22, borderRadius: "50%", background: "#fff", transform: autoCount ? "translateX(18px)" : "translateX(0)", transition: "transform .18s", boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }} />
                  </button>
                  <span style={{ fontFamily: FT, fontSize: "var(--text-footnote)", color: L1 }}>Авто-счёт: каждая мантра = бусина</span>
                </label>
              </div>
            </>
          ) : (
            <>
              {/* диапазон */}
              <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 2, marginBottom: 14, scrollbarWidth: "none" }}>
                {([["day", "День"], ["week", "Неделя"], ["month", "Месяц"], ["year", "Год"], ["range", "Диапазон"]] as [Mode, string][]).map(([m, lab]) => (
                  <button key={m} type="button" style={chip(mode === m)} onClick={() => setMode(m)}>{lab}</button>
                ))}
              </div>

              {mode === "range" && (
                <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                  <label style={{ flex: 1, fontFamily: FT, fontSize: "var(--text-caption)", color: L2 }}>С
                    <input type="date" value={rFrom} max={rTo} onChange={(e) => setRFrom(e.target.value)}
                      style={{ display: "block", width: "100%", marginTop: 4, padding: "9px 10px", borderRadius: 11, border: `0.5px solid ${HAIR}`, background: FILL, color: L1, fontFamily: FT, fontSize: "var(--text-footnote)" }} />
                  </label>
                  <label style={{ flex: 1, fontFamily: FT, fontSize: "var(--text-caption)", color: L2 }}>По
                    <input type="date" value={rTo} min={rFrom} max={todayStr} onChange={(e) => setRTo(e.target.value)}
                      style={{ display: "block", width: "100%", marginTop: 4, padding: "9px 10px", borderRadius: 11, border: `0.5px solid ${HAIR}`, background: FILL, color: L1, fontFamily: FT, fontSize: "var(--text-footnote)" }} />
                  </label>
                </div>
              )}

              {/* сводка периода */}
              <div style={{ display: "flex", gap: 10 }}>
                <Tile value={fmt(an.totals.rounds)} label="Кругов" />
                <Tile value={fmt(an.totals.beads * NAMES_PER_BEAD)} label="Имён" accent={GOLDT} />
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <Tile value={fmtDur(an.totals.seconds)} label="Время" />
                <Tile value={fmt(an.totals.days)} label="Дней практики" />
              </div>

              {/* график */}
              <div style={{ marginTop: 16, padding: 16, borderRadius: 18, background: FILL }}>
                <div style={{ fontFamily: FT, fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: L3, marginBottom: 12 }}>
                  {mode === "day" ? "Круги по часам" : mode === "year" ? "Круги по месяцам" : "Круги по дням"}
                </div>
                {an.totals.rounds > 0
                  ? <Bars buckets={an.buckets} />
                  : <div style={{ padding: "26px 0", textAlign: "center", fontFamily: FT, fontSize: "var(--text-footnote)", color: L3 }}>За этот период ещё нет кругов</div>}
              </div>

              {/* стрик */}
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <div style={{ flex: 1, padding: "14px 14px", borderRadius: 16, background: FILL, display: "flex", alignItems: "center", gap: 11 }}>
                  <span style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center", background: `color-mix(in srgb, ${GOLD} 16%, transparent)`, color: GOLD }}><Flame /></span>
                  <span>
                    <span style={{ display: "block", fontFamily: FD, fontSize: "var(--text-title3)", fontWeight: 800, letterSpacing: "-0.02em", color: L1 }}>{liveStreak}</span>
                    <span style={{ fontFamily: FT, fontSize: "var(--text-caption)", color: L2 }}>дней подряд</span>
                  </span>
                </div>
                <div style={{ flex: 1, padding: "14px 14px", borderRadius: 16, background: FILL, display: "flex", alignItems: "center", gap: 11 }}>
                  <span style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center", background: `color-mix(in srgb, ${GREEN} 16%, transparent)`, color: GREEN }}><Flame /></span>
                  <span>
                    <span style={{ display: "block", fontFamily: FD, fontSize: "var(--text-title3)", fontWeight: 800, letterSpacing: "-0.02em", color: L1 }}>{normStreak}</span>
                    <span style={{ fontFamily: FT, fontSize: "var(--text-caption)", color: L2 }}>норма {st.goal} кр.</span>
                  </span>
                </div>
              </div>

              {/* рекорды */}
              <div style={{ marginTop: 12, borderRadius: 16, background: FILL, overflow: "hidden" }}>
                <Row k="Лучший день" v={an.best ? `${an.best.rounds} кр.` : "—"} sub={an.best ? prettyDay(an.best.day) : undefined} />
                <Row k="В среднем за активный день" v={`${an.avg ? an.avg.toFixed(1) : "0"} кр.`} top />
                <Row k="Всего кругов" v={fmt(allTime.rounds)} top />
                <Row k="Всего имён" v={fmt(allTime.beads * NAMES_PER_BEAD)} top />
                <Row k="Дней практики всего" v={fmt(allDays)} top />
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`@keyframes japaPop{0%{transform:scale(.7);opacity:0}40%{transform:scale(1.06);opacity:1}100%{transform:scale(1);opacity:1}}`}</style>
    </div>
  );
}

function prettyDay(k: string): string {
  const ms = Date.parse(k);
  if (!Number.isFinite(ms)) return k;
  const d = new Date(ms);
  return `${d.getDate()} ${RU_MON[d.getMonth()].toLowerCase()} ${d.getFullYear()}`;
}

function Row({ k, v, sub, top }: { k: string; v: string; sub?: string; top?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "13px 15px", borderTop: top ? `0.5px solid ${HAIR}` : "none" }}>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontFamily: FT, fontSize: "var(--text-subhead)", color: L1 }}>{k}</span>
        {sub && <span style={{ fontFamily: FT, fontSize: "var(--text-caption)", color: L3 }}>{sub}</span>}
      </span>
      <span style={{ flexShrink: 0, fontFamily: FD, fontSize: "var(--text-subhead)", fontWeight: 700, color: L1 }}>{v}</span>
    </div>
  );
}

function Stepper({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(Math.min(max, value + step));
  const btn: CSSProperties = { width: 36, height: 36, borderRadius: 10, border: "none", background: FILL2, color: L1, cursor: "pointer", fontSize: "var(--text-title3)", fontWeight: 600, lineHeight: 1, display: "grid", placeItems: "center", WebkitTapHighlightColor: "transparent" };
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <span style={{ fontFamily: FT, fontSize: "var(--text-subhead)", color: L1 }}>{label}</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
        <button type="button" aria-label="Меньше" onClick={dec} disabled={value <= min} style={{ ...btn, opacity: value <= min ? 0.5 : 1 }}>−</button>
        <span style={{ minWidth: 34, textAlign: "center", fontFamily: FD, fontSize: "var(--text-body)", fontWeight: 800, color: L1 }}>{value}</span>
        <button type="button" aria-label="Больше" onClick={inc} disabled={value >= max} style={{ ...btn, opacity: value >= max ? 0.5 : 1 }}>+</button>
      </span>
    </div>
  );
}
