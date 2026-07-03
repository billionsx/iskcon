/**
 * Экадаши (Ц5) — клиентская логика. Ближайший Экадаши и окно параны берём из
 * /api/calendar (события type 'ekadasi' и 'parana' — рассчитаны по городу). Отметку
 * соблюдения храним локально (iol:ekadashi:v1 — работает и для гостя) и зеркалим в
 * дневник садханы на сервере (sadhana_day.ekadashi) для вошедших — чтобы соблюдение
 * попадало в реальную историю практики. Пост в честь Экадаши — зерно и бобовые
 * исключаются; данные BBT-корректны, без выдумок.
 */
import { accountClient } from "./account/api";

const OBS_KEY = "iol:ekadashi:v1";
const ymd = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export interface EkadashiInfo {
  date: string;         // дата Экадаши (YYYY-MM-DD)
  name: string;         // «Йогини», «Паванэ» …
  daysUntil: number;    // 0 — сегодня
  paranStart: string | null; // «06:12»
  paranEnd: string | null;   // «10:34»
  paranDate: string | null;  // день параны (следующее утро)
  city: string;         // город расчёта
}

interface CalEvent { date: string; title: string; type: string }

/** Ближайший (или сегодняшний) Экадаши + окно параны по сохранённому городу. */
export async function getEkadashiInfo(): Promise<EkadashiInfo | null> {
  let key = "Vrindavan [India]", city = "Вриндаван";
  let lat: number | undefined, lng: number | undefined;
  try {
    const raw = localStorage.getItem("cal-loc");
    if (raw) { const l = JSON.parse(raw) as { key?: string; ru?: string; lat?: number; lng?: number }; if (l.key) key = l.key; if (l.ru) city = l.ru; lat = l.lat; lng = l.lng; }
  } catch { /* default */ }
  const params = new URLSearchParams();
  if (/^[A-Za-z .()'-]+ \[[A-Za-z .]+\]$/.test(key)) params.set("loc", key);
  if (typeof lat === "number" && typeof lng === "number") { params.set("lat", String(lat)); params.set("lng", String(lng)); }
  if (![...params.keys()].length) params.set("loc", key);
  try {
    const r = await fetch("/api/calendar?" + params.toString());
    if (!r.ok) return null;
    const j = (await r.json()) as { events?: CalEvent[] };
    const evs = j.events || [];
    const today = ymd();
    const ek = evs.filter((e) => e.type === "ekadasi" && e.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1))[0];
    if (!ek) return null;
    const days = Math.round((new Date(ek.date + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86_400_000);
    const name = ek.title.replace(/\s*[—-]\s*пост.*$/i, "").replace(/-экадаши.*$/i, "").trim() || "Экадаши";
    // Парана — на следующее утро; ищем событие 'parana' в пределах +1..+2 дней.
    const nextDay = ymd(new Date(new Date(ek.date + "T00:00:00").getTime() + 86_400_000));
    const par = evs.filter((e) => e.type === "parana" && e.date >= ek.date).sort((a, b) => (a.date < b.date ? -1 : 1))[0];
    let paranStart: string | null = null, paranEnd: string | null = null, paranDate: string | null = null;
    if (par) {
      const m = par.title.match(/(\d{1,2}:\d{2})\s*[–—-]\s*(\d{1,2}:\d{2})/);
      if (m) { paranStart = m[1]; paranEnd = m[2]; }
      else { const s = par.title.match(/(\d{1,2}:\d{2})/); if (s) paranStart = s[1]; }
      paranDate = par.date;
    } else {
      paranDate = nextDay;
    }
    return { date: ek.date, name, daysUntil: days, paranStart, paranEnd, paranDate, city };
  } catch { return null; }
}

/* ─────────────────── соблюдение ─────────────────── */

function readObs(): Record<string, boolean> {
  try { const s = localStorage.getItem(OBS_KEY); return s ? (JSON.parse(s) as Record<string, boolean>) : {}; } catch { return {}; }
}
export function isEkadashiObserved(date: string): boolean {
  return !!readObs()[date];
}
/** Отметить/снять соблюдение Экадаши: локально + зеркало в дневник (вошедшим). */
export function markEkadashiObserved(date: string, on: boolean): void {
  try {
    const m = readObs();
    if (on) m[date] = true; else delete m[date];
    localStorage.setItem(OBS_KEY, JSON.stringify(m));
  } catch { /* приватный режим */ }
  // Зеркало на сервер — фоново; гостю вернётся 401 и молча проигнорируется.
  void accountClient.sadhana.save({ today: ymd(), day: date, ekadashi: on }).catch(() => {});
}
