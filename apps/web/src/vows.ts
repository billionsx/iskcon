/**
 * vows — обет (санкальпа/врата): обещание на срок и на конкретные служения,
 * с ежедневным контролем и отчётностью. Хранение локальное (localStorage,
 * без авторизации — как прогресс чтения): один активный обет + архив прошлых.
 * Реактивность — через useSyncExternalStore (как «Избранное»).
 *
 * Принцип заботы: пресеты служений — только созидательные духовные практики
 * (джапа, чтение, киртан, служба, прасад, экадаши, сева). Никаких практик,
 * поощряющих вред здоровью или крайнюю аскезу.
 */
import { useCallback, useSyncExternalStore } from "react";
import { api } from "./api";

import { SITE_HOST } from "./routes";
export type Commitment = { id: string; label: string; detail?: string; target?: number; unit?: string };
export type VowStatus = "active" | "completed" | "abandoned";
export interface Vow {
  id: string;
  title: string;
  startDate: string;            // YYYY-MM-DD (локальная дата)
  endDate: string;              // YYYY-MM-DD включительно
  commitments: Commitment[];
  log: Record<string, Record<string, number>>; // дата → { id служения: достигнутое число (булевые служения: 0/1) }
  createdAt: number;
  status: VowStatus;
  closedAt?: number;
}

/** Служение засчитано за день: числовое — по достижении цели, булевое — по факту. */
export function satisfied(c: Commitment, n: number): boolean {
  return c.target && c.target > 1 ? n >= c.target : n >= 1;
}
export function isNumeric(c: Commitment): boolean { return !!(c.target && c.target > 1); }

/* ── Пресеты ─────────────────────────────────────────────────────────────── */
export const PRESET_COMMITMENTS: Commitment[] = [
  { id: "japa", label: "Джапа", detail: "16 кругов", target: 16, unit: "кругов" },
  { id: "reading", label: "Чтение священных текстов", detail: "ежедневно" },
  { id: "kirtan", label: "Киртан · слушание святого имени", detail: "ежедневно" },
  { id: "arati", label: "Мангала-арати · служба", detail: "ежедневно" },
  { id: "prasad", label: "Почитание прасада", detail: "без лука и чеснока" },
  { id: "ekadashi", label: "Соблюдение экадаши", detail: "в дни экадаши" },
  { id: "seva", label: "Служение (сева)", detail: "ежедневно" },
];

export const DURATION_PRESETS: { id: string; label: string; days: number }[] = [
  { id: "7", label: "1 неделя", days: 7 },
  { id: "14", label: "2 недели", days: 14 },
  { id: "30", label: "1 месяц", days: 30 },
  { id: "108", label: "108 дней", days: 108 },
];

/* ── Даты ────────────────────────────────────────────────────────────────── */
const z = (n: number) => String(n).padStart(2, "0");
export function ymd(d: Date = new Date()): string { return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; }
function parts(s: string): [number, number, number] { const [y, m, d] = s.split("-").map(Number); return [y, m, d]; }
export function diffDays(a: string, b: string): number {
  const [ay, am, ad] = parts(a), [by, bm, bd] = parts(b);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}
export function addDays(s: string, n: number): string {
  const [y, m, d] = parts(s); const dt = new Date(y, m - 1, d + n); return ymd(dt);
}
export function enumerateDays(start: string, end: string): string[] {
  const out: string[] = []; if (diffDays(start, end) < 0) return out;
  let cur = start; for (let i = 0; i <= diffDays(start, end); i++) { out.push(cur); cur = addDays(cur, 1); }
  return out;
}
/** Человекочитаемая дата: 16 июня 2026 / 16 июн. */
const MON = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const MON_FULL = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
export function fmtDate(s: string, full = false): string { const [y, m, d] = parts(s); return full ? `${d} ${MON_FULL[m - 1]} ${y}` : `${d} ${MON[m - 1]}`; }

/* ── Хранилище (localStorage, реактивное) ────────────────────────────────── */
const K_ACTIVE = "vow:active";
const K_ARCHIVE = "vow:archive";
const listeners = new Set<() => void>();
let activeCache: Vow | null | undefined;
let archiveCache: Vow[] | null;
const EMPTY: Vow[] = [];
function invalidate() { activeCache = undefined; archiveCache = null; listeners.forEach((l) => l()); }
function readJson<T>(key: string, fallback: T): T { try { const s = localStorage.getItem(key); return s ? (JSON.parse(s) as T) : fallback; } catch { return fallback; } }
function writeJson(key: string, val: unknown) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* приватный режим */ } }

/** Миграция старого формата лога (id[] → {id:1}) для обратной совместимости. */
function normalizeVow(v: Vow): Vow {
  let changed = false;
  const log: Record<string, Record<string, number>> = {};
  for (const [day, val] of Object.entries(v.log || {})) {
    if (Array.isArray(val)) { changed = true; const o: Record<string, number> = {}; for (const id of val as string[]) o[id] = 1; log[day] = o; }
    else log[day] = val as Record<string, number>;
  }
  return changed ? { ...v, log } : v;
}

export function getActiveVow(): Vow | null {
  if (activeCache !== undefined) return activeCache;
  const raw = readJson<Vow | null>(K_ACTIVE, null);
  activeCache = raw ? normalizeVow(raw) : null;
  return activeCache;
}
export function getArchive(): Vow[] {
  if (archiveCache) return archiveCache;
  archiveCache = readJson<Vow[]>(K_ARCHIVE, []).map(normalizeVow);
  return archiveCache;
}
function setActive(v: Vow | null) { if (v) writeJson(K_ACTIVE, v); else { try { localStorage.removeItem(K_ACTIVE); } catch { /* noop */ } } invalidate(); touch(); }
function setArchive(a: Vow[]) { writeJson(K_ARCHIVE, a); invalidate(); touch(); }

/* ── Синхронизация на сервер (Ц6) ─────────────────────────────────────────
 * Источник правды — localStorage. Снимок {active, archive} зеркалим для кросс-
 * устройства; конфликт — «новее по updated_at (epoch-ms)». Гостю PUT/GET вернут
 * 401 и молча проигнорируются. pullVows() зовём при открытии экрана обетов. */
const K_UPDATED = "vow:updatedAt";
function getUpdatedAt(): number { try { return Number(localStorage.getItem(K_UPDATED)) || 0; } catch { return 0; } }
function setUpdatedAt(t: number) { try { localStorage.setItem(K_UPDATED, String(t)); } catch { /* noop */ } }

let pushTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePush(): void {
  if (typeof window === "undefined") return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    const payload = { active: getActiveVow(), archive: getArchive(), updatedAt: getUpdatedAt() };
    void fetch(api("/me/vows"), { method: "PUT", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }).catch(() => {});
  }, 800);
}
/** Отметить локальное изменение и запланировать отправку на сервер. */
function touch(): void { setUpdatedAt(Date.now()); schedulePush(); }

/** Подтянуть обеты с сервера: если серверный снимок новее локального — заменить. */
export async function pullVows(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const r = await fetch(api("/me/vows"), { credentials: "include" });
    if (!r.ok) return;
    const d = (await r.json()) as { active: Vow | null; archive: Vow[]; updatedAt: number };
    if (!d || typeof d.updatedAt !== "number") return;
    if (d.updatedAt > getUpdatedAt()) {
      if (d.active) writeJson(K_ACTIVE, d.active); else { try { localStorage.removeItem(K_ACTIVE); } catch { /* noop */ } }
      writeJson(K_ARCHIVE, Array.isArray(d.archive) ? d.archive : []);
      setUpdatedAt(d.updatedAt);
      invalidate(); // без touch → без обратной отправки
    }
  } catch { /* офлайн/гость */ }
}

export function useActiveVow(): Vow | null {
  return useSyncExternalStore(
    useCallback((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, []),
    getActiveVow, () => null,
  );
}
export function useArchive(): Vow[] {
  return useSyncExternalStore(
    useCallback((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, []),
    getArchive, () => EMPTY,
  );
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => { if (!e.key || e.key === K_ACTIVE || e.key === K_ARCHIVE) invalidate(); });
}

/* ── Мутации ─────────────────────────────────────────────────────────────── */
export function createVow(input: { title: string; days?: number; endDate?: string; commitments: Commitment[] }): Vow {
  const start = ymd();
  const end = input.endDate && diffDays(start, input.endDate) >= 0 ? input.endDate : addDays(start, Math.max(1, input.days ?? 7) - 1);
  const vow: Vow = {
    id: `vow_${Date.now().toString(36)}`,
    title: input.title.trim() || "Мой обет",
    startDate: start, endDate: end,
    commitments: input.commitments.length ? input.commitments : [PRESET_COMMITMENTS[0]],
    log: {}, createdAt: Date.now(), status: "active",
  };
  setActive(vow);
  return vow;
}
export function toggleCommitment(date: string, commitmentId: string) {
  const v = getActiveVow(); if (!v) return;
  const day = { ...(v.log[date] || {}) };
  day[commitmentId] = day[commitmentId] ? 0 : 1;
  setActive({ ...v, log: { ...v.log, [date]: day } });
}
/** Задать число для числового служения за день (например, круги джапы). */
export function setCount(date: string, commitmentId: string, n: number) {
  const v = getActiveVow(); if (!v) return;
  const day = { ...(v.log[date] || {}) };
  day[commitmentId] = Math.max(0, Math.round(n));
  setActive({ ...v, log: { ...v.log, [date]: day } });
}
export function closeVow(status: "completed" | "abandoned") {
  const v = getActiveVow(); if (!v) return;
  const arch = getArchive();
  setArchive([{ ...v, status, closedAt: Date.now() }, ...arch]);
  setActive(null);
}
export function deleteArchived(id: string) { setArchive(getArchive().filter((v) => v.id !== id)); }

/* ── Отчётность ──────────────────────────────────────────────────────────── */
export interface VowStats {
  dayTotal: number; elapsed: number; remaining: number; started: boolean; overdue: boolean;
  doneSlots: number; expectedSlots: number; pct: number;
  current: number; longest: number;
  per: { id: string; label: string; detail?: string; done: number; total: number; pct: number; sum: number; target?: number; unit?: string; numeric: boolean }[];
  todayDone: string[]; fullDays: Set<string>; dayDone: Record<string, number>;
}
export function vowStats(vow: Vow, today: string = ymd()): VowStats {
  const ids = vow.commitments.map((c) => c.id);
  const M = ids.length || 1;
  const dayTotal = diffDays(vow.startDate, vow.endDate) + 1;
  const started = diffDays(vow.startDate, today) >= 0;
  const overdue = diffDays(today, vow.endDate) < 0;
  const lastObserved = !started ? null : (overdue ? vow.endDate : today);
  const elapsedRange = lastObserved ? enumerateDays(vow.startDate, lastObserved) : [];
  const per = vow.commitments.map((c) => ({ id: c.id, label: c.label, detail: c.detail, done: 0, total: elapsedRange.length, pct: 0, sum: 0, target: c.target, unit: c.unit, numeric: isNumeric(c) }));
  const fullDays = new Set<string>();
  const dayDone: Record<string, number> = {};
  let doneSlots = 0;
  for (const day of elapsedRange) {
    const dayLog = vow.log[day] || {};
    let sat = 0;
    vow.commitments.forEach((c, i) => {
      const n = dayLog[c.id] || 0;
      per[i].sum += n;
      if (satisfied(c, n)) { per[i].done++; sat++; }
    });
    dayDone[day] = sat;
    doneSlots += sat;
    if (vow.commitments.length > 0 && sat === vow.commitments.length) fullDays.add(day);
  }
  for (const p of per) p.pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
  const expectedSlots = elapsedRange.length * M;
  const pct = expectedSlots ? Math.round((doneSlots / expectedSlots) * 100) : 0;
  // серии
  let longest = 0, run = 0;
  for (const day of enumerateDays(vow.startDate, vow.endDate)) { if (fullDays.has(day)) { run++; if (run > longest) longest = run; } else run = 0; }
  let current = 0;
  if (started && !overdue) { let d = today; while (diffDays(vow.startDate, d) >= 0 && fullDays.has(d)) { current++; d = addDays(d, -1); } }
  const remaining = !started ? dayTotal : Math.max(0, diffDays(today, vow.endDate));
  const elapsed = elapsedRange.length;
  const todayDone = vow.commitments.filter((c) => satisfied(c, (vow.log[today] || {})[c.id] || 0)).map((c) => c.id);
  return { dayTotal, elapsed, remaining, started, overdue, doneSlots, expectedSlots, pct, current, longest, per, todayDone, fullDays, dayDone };
}

/** Текстовый отчёт для шаринга/копирования. */
export function vowReportText(vow: Vow): string {
  const s = vowStats(vow);
  const lines = [
    `Обет: ${vow.title}`,
    `Срок: ${fmtDate(vow.startDate, true)} — ${fmtDate(vow.endDate, true)} (${s.dayTotal} дн.)`,
    `Выполнено: ${s.pct}% · серия ${s.current}, лучшая ${s.longest}`,
    "Служения:",
    ...vow.commitments.map((c) => { const p = s.per.find((x) => x.id === c.id); return `• ${c.label}${c.detail ? ` (${c.detail})` : ""} — ${p?.pct ?? 0}%${p?.numeric ? ` · ${p.sum} ${c.unit || ""}`.trimEnd() : ""}`; }),
    SITE_HOST,
  ];
  return lines.join("\n");
}
