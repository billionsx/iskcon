/**
 * HomeCalendar — «Календарь»: вайшнавские праздники, экадаши и дни ачарьев
 * по любому городу мира. Расчёты — GCal (Гаурабда), официальный движок
 * Календарного комитета GBC; фиды self-hosted (/data/gcal/<slug>.json),
 * посчитаны по координатам каждого города. Без внешних рантайм-зависимостей.
 *
 *  · Город: пилюля → шит выбора (страна → город, живой поиск; нет в списке —
 *    геокодинг любого города мира → расчёт по координатам, воркер берёт ближайший
 *    предрасчитанный фид); выбор хранится в localStorage. Дефолт — Вриндаван.
 *  · Hero: ближайший экадаши + парана следующего дня.
 *  · Нативный поиск по событиям (русский и оригинал) + фильтр-сабтабы.
 *  · Личности связаны с Героями: явления/уходы с entityId открывают EntityPage.
 *
 * ПРОШЛОЕ. Раньше экран показывал ТОЛЬКО будущее: `filter(e => e.date >= today)`
 * срезал всё, что позади, — даже те месяцы текущего года, что уже лежали в фиде.
 * Календарь без прошлого не отвечает на простое «а когда была Гаура-пурнима в
 * 2020-м» и не даёт свериться с собственной практикой. Теперь два режима:
 *   · «Предстоящие» (умолчание) — как было: что впереди, с hero-экадаши;
 *   · месяц — любой месяц с 2016-01 по 2028-02, выбирается стрелками или
 *     календарём-шитом (год → месяц → день; день с событиями помечен точкой).
 * Архив прошлого (/data/gcal-past, 2016-01-01 … 2025-12-31, тот же движок и те же
 * координаты) грузится ЛЕНИВО — только когда человек уходит в месяц до 2026-го.
 *
 * ЗКН-Н005 / ЗКН-Н035 — месяц живёт В АДРЕСЕ, а не в переменной: `/calendar` ·
 * `/calendar/2020-03` · `/calendar/2020-03-09`. Ссылку на день можно отправить,
 * «назад» работает, обновление страницы не выкидывает в «Предстоящие».
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { HomeSheet } from "./HomeSheet";
import { api } from "./api";
import { pushUrl, subscribeNav } from "./nav";
import { EventCard, TypeIcon, TYPE_WORD, HERO_TYPES, fmtDay, goEvent, eventTarget, type EventBrief } from "./EventCard";
import { FilterChips as NavFilterChips } from "./ui/nav4";

const GOLD = "var(--color-gold)";
const CAL_CLIENT_VER = "4";
// iOS-26: поверхности карточек — чистый белый, а не серое «стекло»; отделяет
// волосяная граница + мягкая многослойная тень (карточка парит над белым холстом).
const fill: React.CSSProperties = { background: "var(--color-bg-2)", borderRadius: 22, border: "0.5px solid var(--color-hairline)", boxShadow: "0 1px 2px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.04)" };

/** Границы данных: архив начинается с 2016-01 (scripts/gcal/generate_past_archive.py),
 *  живой фид кончается в 2028-02 (generate_all_cities.py). Стык без дыры. */
const MIN_YM = "2016-01";
const FALLBACK_MAX_YM = "2028-02";
const LIVE_FROM_YM = "2026-01";

interface CalEvent { date: string; title: string; orig: string; type: "ekadasi" | "parana" | "festival" | "appearance" | "disappearance" | "other"; entityId?: string }
interface LocCity { ru: string; key: string; lat?: number | null; lng?: number | null; tz?: string | null }
interface LocCountry { country: string; cities: LocCity[] }
interface GeoHit { name: string; lat: number; lng: number; tz: string | null; country: string | null; admin1: string | null }

const DEFAULT_LOC: LocCity = { ru: "Вриндаван", key: "Vrindavan [India]" };
const LS_KEY = "cal-loc";

function loadStoredLoc(): LocCity {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) { const j = JSON.parse(raw); if (j && j.key && j.ru) return j; }
  } catch { /* noop */ }
  return DEFAULT_LOC;
}

function calParams(loc: LocCity): URLSearchParams {
  const params = new URLSearchParams();
  const latin = /^[A-Za-z .()'-]+ \[[A-Za-z .]+\]$/.test(loc.key);
  if (latin) params.set("loc", loc.key);
  if (typeof loc.lat === "number" && typeof loc.lng === "number") {
    params.set("lat", String(loc.lat)); params.set("lng", String(loc.lng));
  }
  if (![...params.keys()].length) params.set("loc", loc.key);
  return params;
}

const calCache = new Map<string, { events: CalEvent[]; maxYm: string }>();
async function loadCal(loc: LocCity): Promise<{ events: CalEvent[]; maxYm: string }> {
  const hit = calCache.get(loc.key);
  if (hit) return hit;
  try {
    // cv — версия клиента: меняется при правках маппинга календаря, чтобы браузер/CDN
    // не отдавали старый закэшированный ответ. no-store — всегда берём свежий из сети.
    const r = await fetch("/api/calendar?cv=" + CAL_CLIENT_VER + "&" + calParams(loc).toString(), { cache: "no-store" });
    if (r.ok) {
      const j = await r.json();
      const evs = (j.events || []) as CalEvent[];
      if (evs.length > 50) {
        const out = { events: evs, maxYm: (j.span?.to || "").slice(0, 7) || FALLBACK_MAX_YM };
        calCache.set(loc.key, out);
        return out;
      }
    }
  } catch { /* сеть */ }
  throw new Error("calendar unavailable");
}

/* Архив прошлого — отдельный ленивый запрос: 10 лет это ~2300 событий, и платить
 * за них на КАЖДОМ открытии календаря (где нужен всего лишь ближайший экадаши)
 * незачем. Тянем ровно тогда, когда человек ушёл в месяц до 2026-го. */
const pastCache = new Map<string, CalEvent[]>();
async function loadPast(loc: LocCity): Promise<CalEvent[]> {
  const hit = pastCache.get(loc.key);
  if (hit) return hit;
  const r = await fetch("/api/calendar?past=1&cv=" + CAL_CLIENT_VER + "&" + calParams(loc).toString(), { cache: "no-store" });
  if (!r.ok) throw new Error("archive unavailable");
  const j = await r.json();
  const evs = (j.events || []) as CalEvent[];
  if (evs.length < 50) throw new Error("archive empty");
  pastCache.set(loc.key, evs);
  return evs;
}


let locsCache: LocCountry[] | null = null;
async function loadLocs(): Promise<LocCountry[]> {
  if (locsCache) return locsCache;
  const r = await fetch("/data/vaisnava-locations.json");
  const j = await r.json();
  locsCache = (j.countries || []) as LocCountry[];
  return locsCache;
}

const MONTH_H = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
// fmtDay · TypeIcon · TYPE_WORD · HERO_TYPES живут в ./EventCard (единый модуль
// карточки события): один визуал строки на «Календарь» и на ленту Даршана.



/* ── месяц как адрес ──────────────────────────────────────────────────────
 * ЗКН-Н005/Н035: `/calendar` = «Предстоящие» · `/calendar/2020-03` = месяц ·
 * `/calendar/2020-03-09` = месяц с подсвеченным днём. Месяц в состоянии
 * компонента (а не в адресе) означал бы: ссылкой не поделиться, «назад» не
 * работает, обновление страницы выкидывает обратно в «Предстоящие».
 */
const MONTH_SHORT = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
const WD_HEAD = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];
const p2 = (n: number) => String(n).padStart(2, "0");

interface CalRoute { ym: string | null; day: string | null }
function routeFromPath(path: string): CalRoute {
  const s = path.split("/").filter(Boolean)[1] || "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { ym: s.slice(0, 7), day: s };
  if (/^\d{4}-\d{2}$/.test(s)) return { ym: s, day: null };
  return { ym: null, day: null };
}
function ymOfToday(): string { const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}`; }
function ymAdd(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const t = y * 12 + (m - 1) + delta;
  return `${Math.floor(t / 12)}-${p2((t % 12) + 1)}`;
}
/** Понедельник-первый: getDay() отдаёт вс=0, а русская неделя начинается с пн. */
function gridStart(y: number, m: number): number { return (new Date(y, m - 1, 1).getDay() + 6) % 7; }
function daysIn(y: number, m: number): number { return new Date(y, m, 0).getDate(); }

/* ── ВЫБОР ДАТЫ: год → месяц → день ──────────────────────────────────────
 * День с событиями помечен золотой точкой — человек видит, где искать, ещё до
 * перехода. Сетка месяца сама по себе — обещание («тут что-то есть»), и пустой
 * день без точки честнее, чем открытый пустой экран (ср. ЗКН-Пр007).
 */
function DateSheet({ open, ym, day, maxYm, dots, loading, onPreview, onPick, onUpcoming, onClose }: {
  open: boolean; ym: string | null; day: string | null; maxYm: string;
  dots: Set<string>; loading: boolean;
  onPreview: (ym: string) => void; onPick: (path: string) => void; onUpcoming: () => void; onClose: () => void;
}) {
  const today = todayISO();
  const start = ym || ymOfToday();
  const [py, setPy] = useState(() => Number(start.slice(0, 4)));
  const [pm, setPm] = useState(() => Number(start.slice(5, 7)));
  useEffect(() => {
    if (!open) return;
    const s = ym || ymOfToday();
    setPy(Number(s.slice(0, 4))); setPm(Number(s.slice(5, 7)));
  }, [open, ym]);
  const pym = `${py}-${p2(pm)}`;
  useEffect(() => { if (open) onPreview(pym); }, [open, pym, onPreview]);

  const minY = Number(MIN_YM.slice(0, 4)), maxY = Number(maxYm.slice(0, 4));
  const years = useMemo(() => Array.from({ length: maxY - minY + 1 }, (_, i) => minY + i), [minY, maxY]);
  const monthOff = (m: number) => `${py}-${p2(m)}` < MIN_YM || `${py}-${p2(m)}` > maxYm;

  const cells = useMemo(() => {
    const lead = gridStart(py, pm), n = daysIn(py, pm);
    const out: (string | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= n; d++) out.push(`${py}-${p2(pm)}-${p2(d)}`);
    return out;
  }, [py, pm]);

  const chip = (on: boolean, off = false): React.CSSProperties => ({
    padding: "8px 0", borderRadius: 12, textAlign: "center", cursor: off ? "default" : "pointer",
    border: `1px solid ${on ? GOLD : "var(--color-hairline)"}`,
    background: on ? `color-mix(in srgb, ${GOLD} 12%, transparent)` : "none",
    fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: on ? 700 : 600,
    color: off ? "var(--color-label-4)" : on ? GOLD : "var(--color-label)",
    opacity: off ? 0.45 : 1, WebkitTapHighlightColor: "transparent",
  });

  return (
    <HomeSheet open={open} label="Выбор даты" onClose={onClose}>
      <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLD }}>Календарь ИСККОН</div>
      <h2 style={{ margin: "5px 0 0", fontFamily: "var(--font-display)", fontSize: "var(--text-title2)", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.12, color: "var(--color-label)" }}>Выберите дату</h2>
      <p style={{ margin: "7px 0 0", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", lineHeight: 1.5, color: "var(--color-label-2)" }}>
        Доступны {MIN_YM.slice(0, 4)}–{maxYm.slice(0, 4)} годы. Дни с событиями отмечены точкой.
      </p>

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button type="button" onClick={() => { onUpcoming(); onClose(); }} style={{ ...chip(!ym), flex: 1 }}>Предстоящие</button>
        <button type="button" onClick={() => { onPick("/calendar/" + today); onClose(); }} style={{ ...chip(day === today), flex: 1 }}>Сегодня</button>
      </div>

      <div style={{ margin: "18px 2px 8px", fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: "var(--color-label-3)" }}>Год</div>
      <div style={{ display: "flex", gap: 7, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 2 }}>
        {years.map((y) => (
          <button key={y} type="button" onClick={() => setPy(y)} style={{ ...chip(y === py), flex: "0 0 auto", padding: "8px 14px" }}>{y}</button>
        ))}
      </div>

      <div style={{ margin: "18px 2px 8px", fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: "var(--color-label-3)" }}>Месяц</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 7 }}>
        {MONTH_SHORT.map((mn, i) => {
          const off = monthOff(i + 1);
          return (
            <button key={mn} type="button" disabled={off} onClick={() => setPm(i + 1)} style={chip(i + 1 === pm && !off, off)}>{mn}</button>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "18px 2px 8px" }}>
        <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: "var(--color-label-3)" }}>День</div>
        {loading && <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption)", color: "var(--color-label-3)" }}>Загружаем архив…</div>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {WD_HEAD.map((w) => (
          <div key={w} style={{ padding: "2px 0 6px", textAlign: "center", fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", color: "var(--color-label-4)" }}>{w}</div>
        ))}
        {cells.map((iso, i) => {
          if (!iso) return <div key={"e" + i} />;
          const has = dots.has(iso), isToday = iso === today, on = iso === day;
          return (
            <button key={iso} type="button" onClick={() => { onPick("/calendar/" + iso); onClose(); }} aria-label={iso}
              style={{
                position: "relative", padding: "9px 0 11px", borderRadius: 11, cursor: "pointer",
                border: `1px solid ${on ? GOLD : isToday ? "var(--color-hairline-strong)" : "transparent"}`,
                background: on ? `color-mix(in srgb, ${GOLD} 12%, transparent)` : "var(--color-glass-thin)",
                fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: has ? 700 : 500,
                color: on ? GOLD : has ? "var(--color-label)" : "var(--color-label-3)",
                WebkitTapHighlightColor: "transparent",
              }}>
              {Number(iso.slice(8))}
              <span aria-hidden style={{
                position: "absolute", left: "50%", bottom: 4, transform: "translateX(-50%)",
                width: 4, height: 4, borderRadius: 999,
                background: has ? (on ? GOLD : "var(--color-gold-deep)") : "transparent",
              }} />
            </button>
          );
        })}
      </div>
      <div style={{ height: 8 }} />
    </HomeSheet>
  );
}

function LocationSheet({ open, current, onPick, onClose }: { open: boolean; current: LocCity; onPick: (c: LocCity) => void; onClose: () => void }) {
  const [locs, setLocs] = useState<LocCountry[] | null>(null);
  const [q, setQ] = useState("");
  const [geo, setGeo] = useState<GeoHit | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoMe, setGeoMe] = useState<"idle" | "busy" | "denied" | "error">("idle");
  useEffect(() => { if (open) loadLocs().then(setLocs).catch(() => setLocs([])); }, [open]);
  useEffect(() => { if (!open) { setQ(""); setGeo(null); setGeoBusy(false); setGeoMe("idle"); } }, [open]);
  const filtered = useMemo(() => {
    if (!locs) return [];
    const t = q.trim().toLowerCase();
    if (!t) return locs;
    return locs
      .map((c) => ({ country: c.country, cities: c.cities.filter((x) => x.ru.toLowerCase().includes(t) || x.key.toLowerCase().includes(t) || c.country.toLowerCase().includes(t)) }))
      .filter((c) => c.cities.length > 0);
  }, [locs, q]);
  const hasDirect = filtered.length > 0;
  // Город не из базы → геокодим (/api/geocode → русское имя + координаты) и предлагаем
  // сам город; расчёт идёт по координатам — воркер берёт ближайший предрасчитанный фид.
  useEffect(() => {
    const t = q.trim();
    if (!locs || hasDirect || t.length < 2) { setGeo(null); setGeoBusy(false); return; }
    let alive = true; setGeoBusy(true);
    const id = setTimeout(async () => {
      try {
        const r = await fetch("/api/geocode?q=" + encodeURIComponent(t));
        const j = await r.json();
        if (alive) setGeo(j && j.result ? (j.result as GeoHit) : null);
      } catch { if (alive) setGeo(null); }
      finally { if (alive) setGeoBusy(false); }
    }, 350);
    return () => { alive = false; clearTimeout(id); };
  }, [q, hasDirect, locs]);
  function useMyLocation() {
    if (!("geolocation" in navigator)) { setGeoMe("error"); return; }
    setGeoMe("busy");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude, lng = pos.coords.longitude;
        onPick({ ru: "Моё местоположение", key: `@${lat.toFixed(4)},${lng.toFixed(4)}`, lat, lng, tz: null });
        setGeoMe("idle"); onClose();
      },
      (err) => setGeoMe(err.code === err.PERMISSION_DENIED ? "denied" : "error"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  }
  return (
    <HomeSheet open={open} label="Выбор города" onClose={onClose}>
      <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLD }}>Календарь по городу</div>
      <h2 style={{ margin: "5px 0 0", fontFamily: "var(--font-display)", fontSize: "var(--text-title2)", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.12, color: "var(--color-label)" }}>Выберите город</h2>
      <p style={{ margin: "7px 0 0", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", lineHeight: 1.5, color: "var(--color-label-2)" }}>
        Время экадаши и параны зависит от восхода солнца — календарь рассчитывается для конкретного города. Нет в списке? Введите любой город мира — рассчитаем календарь по нему.
      </p>
      <div style={{ position: "sticky", top: 0, zIndex: 5, background: "var(--color-bg)", padding: "12px 0 8px" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Страна или город" inputMode="search"
          style={{ width: "100%", boxSizing: "border-box", padding: "11px 14px", borderRadius: 14, border: "0.5px solid var(--color-hairline)", background: "var(--color-glass-thin)", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", color: "var(--color-label)", outline: "none" }} />
      </div>
      {!q.trim() && (
        <button type="button" onClick={useMyLocation} disabled={geoMe === "busy"} aria-label="Определить календарь по моей геолокации"
          style={{ display: "flex", width: "100%", alignItems: "center", gap: 11, padding: "13px 14px", borderRadius: 14, border: `1px solid color-mix(in srgb, ${GOLD} 35%, transparent)`, background: `color-mix(in srgb, ${GOLD} 8%, transparent)`, cursor: geoMe === "busy" ? "default" : "pointer", WebkitTapHighlightColor: "transparent" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="3.1" fill="none" stroke={GOLD} strokeWidth="1.8" />
            <path d="M12 2.2v3.1M12 18.7v3.1M2.2 12h3.1M18.7 12h3.1" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="12" cy="12" r="7.8" fill="none" stroke={GOLD} strokeWidth="1.3" opacity="0.5" />
          </svg>
          <span style={{ flex: 1, textAlign: "left", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: 600, color: "var(--color-label)" }}>
            {geoMe === "busy" ? "Определяем местоположение…" : "По моей геолокации"}
          </span>
        </button>
      )}
      {!q.trim() && geoMe === "denied" && (
        <div style={{ margin: "8px 2px 0", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", lineHeight: 1.45, color: "var(--color-label-3)" }}>Доступ к геолокации запрещён. Разрешите его в настройках браузера или выберите город вручную.</div>
      )}
      {!q.trim() && geoMe === "error" && (
        <div style={{ margin: "8px 2px 0", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", lineHeight: 1.45, color: "var(--color-label-3)" }}>Не удалось определить местоположение. Выберите город вручную.</div>
      )}
      <div style={{ marginTop: 12 }}>
        {!locs && <div style={{ height: 120, ...fill, opacity: 0.6 }} />}
        {locs && !hasDirect && geoBusy && (
          <div style={{ padding: "22px 8px", textAlign: "center", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", color: "var(--color-label-3)" }}>Ищем город…</div>
        )}
        {locs && !hasDirect && !geoBusy && geo && (
          <section style={{ marginTop: 4 }}>
            <div style={{ margin: "0 2px 8px", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", lineHeight: 1.45, color: "var(--color-label-2)" }}>Найден город:</div>
            <div style={{ overflow: "hidden", ...fill }}>
              <button type="button" onClick={() => { onPick({ ru: geo.name, key: `@${geo.lat.toFixed(4)},${geo.lng.toFixed(4)}`, lat: geo.lat, lng: geo.lng, tz: geo.tz }); onClose(); }}
                style={{ display: "flex", width: "100%", alignItems: "center", gap: 11, padding: "13px 14px", textAlign: "left", background: "none", border: "none", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden style={{ flexShrink: 0 }}><path d="M12 21s-6.7-5.4-6.7-10.3A6.7 6.7 0 0 1 12 4a6.7 6.7 0 0 1 6.7 6.7C18.7 15.6 12 21 12 21Z" fill="none" stroke={GOLD} strokeWidth="1.8" /><circle cx="12" cy="10.6" r="2.3" fill="none" stroke={GOLD} strokeWidth="1.8" /></svg>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: 600, color: "var(--color-label)" }}>{geo.name}</span>
                  <span style={{ display: "block", marginTop: 1, fontFamily: "var(--font-text)", fontSize: "var(--text-caption)", color: "var(--color-label-3)" }}>
                    {[geo.admin1, geo.country].filter(Boolean).join(", ") || "календарь по этому городу"}
                  </span>
                </span>
                <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden style={{ flexShrink: 0, color: "var(--color-label-3)" }}><path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
          </section>
        )}
        {locs && !hasDirect && !geoBusy && !geo && q.trim().length >= 2 && (
          <div style={{ padding: "26px 8px", textAlign: "center", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", color: "var(--color-label-3)" }}>Город не найден. Проверьте написание.</div>
        )}
        {filtered.map((c) => (
          <section key={c.country} style={{ marginTop: 16 }}>
            <div style={{ margin: "0 2px 8px", fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: "var(--color-label-3)" }}>{c.country}</div>
            <div style={{ overflow: "hidden", ...fill }}>
              {c.cities.map((x, i) => {
                const on = x.key === current.key;
                return (
                  <button key={x.key} type="button" onClick={() => { onPick(x); onClose(); }}
                    style={{ display: "flex", width: "100%", alignItems: "center", gap: 10, padding: "12px 14px", textAlign: "left", background: "none", border: "none", borderTop: i ? "0.5px solid var(--color-hairline)" : "none", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                    <span style={{ flex: 1, fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: on ? 700 : 500, color: on ? GOLD : "var(--color-label)" }}>{x.ru}</span>
                    {on && <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden><path d="m5 12.5 4.2 4.2L19 7" fill="none" stroke={GOLD} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </HomeSheet>
  );
}

export function HomeCalendar({ stickyTop, onOpenEntity }: { stickyTop: number; onOpenEntity?: (id: string, type: string | null) => void }) {
  const [loc, setLoc] = useState<LocCity>(loadStoredLoc);
  const [live, setLive] = useState<CalEvent[] | null>(null);
  const [maxYm, setMaxYm] = useState<string>(FALLBACK_MAX_YM);
  const [err, setErr] = useState(false);
  const [past, setPast] = useState<CalEvent[] | null>(null);
  const [pastState, setPastState] = useState<"idle" | "busy" | "err">("idle");
  const [filt, setFilt] = useState<"all" | "ekadasi" | "festival" | "vaisnava">("all");
  const [q, setQ] = useState("");
  const [pickOpen, setPickOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [briefMap, setBriefMap] = useState<Map<string, EventBrief> | null>(null);
  const gen = useRef(0);
  // Ссылка на строку выбранного дня — чтобы подвести её к центру экрана (п.1).
  const pickedRef = useRef<HTMLElement | null>(null);
  const setPicked = (el: HTMLElement | null) => { pickedRef.current = el; };

  /* ЗКН-Н033 — АДРЕС ЕДИНСТВЕННЫЙ ИСТОЧНИК ИСТИНЫ. Месяц ЧИТАЕТСЯ из пути на
   * каждое его изменение, а не снимается один раз при монтировании: иначе «назад»
   * менял бы адрес, а экран продолжал показывать прежний месяц. */
  const [route, setRoute] = useState<CalRoute>(() =>
    typeof window === "undefined" ? { ym: null, day: null } : routeFromPath(window.location.pathname));
  useEffect(() => subscribeNav(() => setRoute(routeFromPath(window.location.pathname))), []);
  // ЗКН-Н001: история — только через nav.ts.
  const goto = (path: string) => { setRoute(routeFromPath(path)); pushUrl(path); };

  // Ленивая карта личностей (лила/волна/описание) для МКСК — грузим один раз.
  useEffect(() => {
    let alive = true;
    fetch(api("/content/pkl"), { cache: "no-store" }).then((r) => r.json()).then((d) => {
      if (!alive) return;
      const m = new Map<string, EventBrief>();
      for (const p of (d.items ?? [])) m.set(p.slug, { name: p.name, note: p.note, summary: p.summary, lila: p.lila, sub: p.sub, grp: p.grp });
      setBriefMap(m);
    }).catch(() => { /* карточка покажет только событие */ });
    return () => { alive = false; };
  }, []);

  // Смена города обнуляет ОБА среза: и живой фид, и архив — они оба считаны по
  // координатам прежнего города (титхи определяется на восходе В ТОЧКЕ).
  useEffect(() => {
    const g = ++gen.current;
    setLive(null); setErr(false); setPast(null); setPastState("idle");
    loadCal(loc).then((d) => { if (gen.current === g) { setLive(d.events); setMaxYm(d.maxYm); } })
      .catch(() => { if (gen.current === g) setErr(true); });
    try { localStorage.setItem(LS_KEY, JSON.stringify(loc)); } catch { /* noop */ }
  }, [loc]);

  // Выбор города из глобального поиска (/calendar) — обновляем город «вживую»,
  // если календарь уже смонтирован (на свежем монтировании город читается из
  // localStorage в loadStoredLoc, поэтому событие нужно лишь смонтированному).
  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent).detail as LocCity | undefined;
      if (d && d.key && d.ru) setLoc(d);
    };
    window.addEventListener("cal:set-loc", h as EventListener);
    return () => window.removeEventListener("cal:set-loc", h as EventListener);
  }, []);

  /* Архив тянем ЛЕНИВО — ровно когда нужен месяц до 2026-го (сам просмотр, либо
   * предпросмотр в шите выбора даты). 10 лет это ~2300 событий: платить за них
   * при каждом открытии календаря, где нужен «ближайший экадаши», незачем. */
  const [previewYm, setPreviewYm] = useState<string | null>(null);
  const needPast = (route.ym && route.ym < LIVE_FROM_YM) || (previewYm && previewYm < LIVE_FROM_YM);
  useEffect(() => {
    if (!needPast || past || pastState !== "idle") return;
    const g = gen.current;
    setPastState("busy");
    loadPast(loc)
      .then((evs) => { if (gen.current === g) { setPast(evs); setPastState("idle"); } })
      .catch(() => { if (gen.current === g) setPastState("err"); });
  }, [needPast, past, pastState, loc]);

  const today = todayISO();
  const all = useMemo(() => [...(past || []), ...(live || [])], [past, live]);

  const upcoming = useMemo(() => (live || []).filter((e) => e.date >= today), [live, today]);

  /* Hero «что сейчас»: события СЕГОДНЯ (их может быть несколько — праздник и два
   * ухода в один день), а если сегодня пусто — БЛИЖАЙШЕЕ предстоящее. Парану
   * показываем, только когда в фокусе экадаши. */
  const todayFocus = useMemo(() => upcoming.filter((e) => e.date === today && HERO_TYPES.has(e.type)), [upcoming, today]);
  const nearestFocus = useMemo(() => upcoming.find((e) => e.date > today && HERO_TYPES.has(e.type)) || null, [upcoming, today]);
  const heroIsToday = todayFocus.length > 0;
  const heroEvents = heroIsToday ? todayFocus : (nearestFocus ? [nearestFocus] : []);
  const paranaFor = (eka: CalEvent | null): { date: string; text: string } | null => {
    if (!eka) return null;
    const p = upcoming.find((e) => e.type === "parana" && e.date > eka.date);
    if (!p) return null;
    if (/\d{1,2}:\d{2}/.test(p.title)) return { date: p.date, text: p.title };
    const m = p.orig.match(/(\d{1,2}:\d{2}).*?-\s*(\d{1,2}:\d{2})/);
    return { date: p.date, text: m ? `Выход из поста ${m[1]}–${m[2]}` : p.title };
  };

  // Парана экадаши строкой «День · выход из поста» для строки/карточки события.
  // Ищем по ВСЕМ загруженным данным (архив+живой), отсортированным по дате, —
  // так парана находится и на стыке месяцев. Формат: «12 января · 08:15–10:42».
  const paranaList = useMemo(
    () => all.filter((e) => e.type === "parana").slice().sort((a, b) => a.date.localeCompare(b.date)),
    [all],
  );
  const paranaShortFor = (eka: CalEvent): string | null => {
    const p = paranaList.find((e) => e.date > eka.date);
    if (!p) return null;
    const f = fmtDay(p.date);
    const range = p.orig.match(/(\d{1,2}:\d{2}).*?[-–]\s*(\d{1,2}:\d{2})/) || p.title.match(/(\d{1,2}:\d{2}).*?[-–]\s*(\d{1,2}:\d{2})/);
    if (range) return `${f.d} ${f.m} · ${range[1]}–${range[2]}`;
    const one = p.title.match(/(\d{1,2}:\d{2})/) || p.orig.match(/(\d{1,2}:\d{2})/);
    return one ? `${f.d} ${f.m} · ${one[1]}` : `${f.d} ${f.m}`;
  };

  // Точки в сетке шита — по ВСЕМ событиям месяца, включая парану: пустой день без
  // точки честнее, чем открытый пустой экран (ЗКН-Пр007).
  const dots = useMemo(() => {
    const s = new Set<string>();
    for (const e of all) s.add(e.date);
    return s;
  }, [all]);

  // Парана — спутник экадаши, а не самостоятельное событие: она живёт в hero и в
  // карточке экадаши. Отдельной строкой в списке она дублировала бы день.
  const source = route.ym ? all.filter((e) => e.date.slice(0, 7) === route.ym) : upcoming;
  const filtered = useMemo(() => {
    let r = source.filter((e) => e.type !== "parana");
    if (filt === "ekadasi") r = r.filter((e) => e.type === "ekadasi");
    else if (filt === "festival") r = r.filter((e) => e.type === "festival" || e.type === "other");
    else if (filt === "vaisnava") r = r.filter((e) => e.type === "appearance" || e.type === "disappearance");
    const t = q.trim().toLowerCase();
    if (t) r = r.filter((e) => e.title.toLowerCase().includes(t) || e.orig.toLowerCase().includes(t));
    return r.slice().sort((a, b) => a.date.localeCompare(b.date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, filt, q]);

  const months = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    filtered.forEach((e) => { const k = e.date.slice(0, 7); (m.get(k) || m.set(k, []).get(k)!).push(e); });
    return [...m.entries()];
  }, [filtered]);

  const busy = !live && !err;
  const monthBusy = !!route.ym && route.ym < LIVE_FROM_YM && !past && pastState === "busy";
  const monthErr = !!route.ym && route.ym < LIVE_FROM_YM && pastState === "err";
  const canPrev = !route.ym || route.ym > MIN_YM;
  const canNext = !!route.ym && route.ym < maxYm;
  const navLabel = route.ym
    ? `${MONTH_H[Number(route.ym.slice(5, 7)) - 1]} ${route.ym.slice(0, 4)}`
    : "Выбрать дату";

  const arrow = (on: boolean): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34,
    flexShrink: 0, borderRadius: 999, border: "0.5px solid var(--color-hairline)",
    background: "var(--color-bg-2)", cursor: on ? "pointer" : "default",
    color: on ? "var(--color-label)" : "var(--color-label-4)", opacity: on ? 1 : 0.5,
    WebkitTapHighlightColor: "transparent",
  });

  /* На /calendar/YYYY-MM-DD подводим выбранный день к центру экрана — иначе месяц
   * открывается сверху и нажатое событие остаётся за кадром (п.1). Ждём загрузку
   * данных и отрисовку (deps: months). Без анимации: на холодной загрузке плавная
   * прокрутка выглядела бы рывком. */
  useEffect(() => {
    if (!route.day || busy || monthBusy) return;
    const el = pickedRef.current;
    if (el) el.scrollIntoView({ behavior: "auto", block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.day, busy, monthBusy, months]);

  return (
    <div>
      <div style={{ padding: "20px 0 0" }}>
        <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLD }}>Вайшнавский календарь</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 5 }}>
          <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-title2)", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1, color: "var(--color-label)" }}>Календарь ИСККОН</h2>
          <button type="button" onClick={() => setPickOpen(true)} aria-label="Сменить город календаря"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, border: `1px solid color-mix(in srgb, ${GOLD} 45%, transparent)`, background: `color-mix(in srgb, ${GOLD} 10%, transparent)`, cursor: "pointer", WebkitTapHighlightColor: "transparent", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 600, color: "var(--color-label)" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden><path d="M12 21s-6.7-5.4-6.7-10.3A6.7 6.7 0 0 1 12 4a6.7 6.7 0 0 1 6.7 6.7C18.7 15.6 12 21 12 21Z" fill="none" stroke={GOLD} strokeWidth="1.8" /><circle cx="12" cy="10.6" r="2.3" fill="none" stroke={GOLD} strokeWidth="1.8" /></svg>
            {loc.ru}
            <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden><path d="m7 10 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
        <p style={{ margin: "8px 0 0", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", lineHeight: 1.5, color: "var(--color-label-2)" }}>
          Экадаши, праздники и дни великих вайшнавов по расчётам GCal — официальной программы Календарного комитета GBC.
        </p>
      </div>

      {/* Навигатор месяца: ‹ · пилюля-дата · › · возврат в «Предстоящие».
          Не липкий — иначе он встал бы вторым sticky-слоем поверх фильтра (ЗКН-Н010). */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
        <button type="button" aria-label="Предыдущий месяц" disabled={!canPrev} style={arrow(canPrev)}
          onClick={() => canPrev && goto("/calendar/" + (route.ym ? ymAdd(route.ym, -1) : ymOfToday()))}>
          <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden><path d="m15 6-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <button type="button" onClick={() => setDateOpen(true)} aria-label="Выбрать дату"
          style={{ display: "inline-flex", flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", gap: 7, padding: "9px 12px", borderRadius: 999, border: `1px solid ${route.ym ? `color-mix(in srgb, ${GOLD} 45%, transparent)` : "var(--color-hairline)"}`, background: route.ym ? `color-mix(in srgb, ${GOLD} 10%, transparent)` : "var(--color-bg-2)", cursor: "pointer", WebkitTapHighlightColor: "transparent", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: 600, color: "var(--color-label)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden style={{ flexShrink: 0 }}>
            <rect x="3.5" y="5" width="17" height="15.5" rx="3" fill="none" stroke={GOLD} strokeWidth="1.7" />
            <path d="M3.5 9.6h17M8 3.5V6m8-2.5V6" stroke={GOLD} strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{navLabel}</span>
          <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden style={{ flexShrink: 0 }}><path d="m7 10 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <button type="button" aria-label="Следующий месяц" disabled={!canNext} style={arrow(canNext)}
          onClick={() => canNext && route.ym && goto("/calendar/" + ymAdd(route.ym, 1))}>
          <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden><path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        {route.ym && (
          <button type="button" onClick={() => goto("/calendar")} aria-label="К ближайшим событиям"
            style={{ flexShrink: 0, padding: "9px 12px", borderRadius: 999, border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)", cursor: "pointer", WebkitTapHighlightColor: "transparent", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 600, color: "var(--color-gold-deep)" }}>
            Вперёд
          </button>
        )}
      </div>

      {/* hero «что сейчас» — только в режиме ближайших (в выбранном месяце
          «сегодня/ближайшее» не к месту). Чистая белая карточка с лёгким золотым
          акцентом — без тяжёлого градиента (п.4). */}
      {!route.ym && heroEvents.length > 0 && (() => {
        const single = heroEvents.length === 1;
        const par = paranaFor(heroEvents.find((e) => e.type === "ekadasi") || null);
        return (
          <div style={{ marginTop: 16, padding: 20, borderRadius: 24, background: "var(--color-bg-2)", border: `1px solid color-mix(in srgb, ${GOLD} 30%, transparent)`, boxShadow: "0 1px 2px rgba(0,0,0,0.05), 0 5px 14px rgba(0,0,0,0.05)" }}>
            <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: GOLD }}>
              {heroIsToday ? "Сегодня" : "Ближайшее"} · {loc.ru}
            </div>
            {single ? (
              <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 14 }}>
                <TypeIcon type={heroEvents[0].type} size={48} today />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-title2)", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.15, color: "var(--color-label)" }}>{heroEvents[0].title.replace(" — пост", "")}</div>
                  <div style={{ marginTop: 4, fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: 500, color: "var(--color-label-2)" }}>
                    {(() => { const f = fmtDay(heroEvents[0].date); return `${f.wd}, ${f.d} ${f.m} ${f.y}`; })()} · {TYPE_WORD[heroEvents[0].type]}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 12, display: "grid" }}>
                {heroEvents.map((e, i) => {
                  const tgt = eventTarget(e);
                  const canTap = (tgt === "entity" && !!onOpenEntity) || tgt === "ekadashi";
                  const rowInner = (
                    <>
                      <TypeIcon type={e.type} size={34} today />
                      <span style={{ minWidth: 0, flex: 1, fontFamily: "var(--font-text)", fontSize: "var(--text-callout)", fontWeight: 600, letterSpacing: "-0.015em", lineHeight: 1.25, color: "var(--color-label)" }}>{e.title.replace(" — пост", "")}</span>
                      <span style={{ flexShrink: 0, fontFamily: "var(--font-text)", fontSize: "var(--text-caption)", fontWeight: 600, color: "var(--color-label-2)" }}>{TYPE_WORD[e.type]}</span>
                      {canTap && (
                        <span aria-hidden style={{ flexShrink: 0, color: "var(--color-label-4)" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </span>
                      )}
                    </>
                  );
                  const heroRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: i ? "0.5px solid var(--color-hairline)" : "none" };
                  return canTap ? (
                    <button key={e.date + e.orig + i} type="button" onClick={() => goEvent(e, onOpenEntity)}
                      style={{ ...heroRow, border: "none", borderTop: heroRow.borderTop, background: "none", textAlign: "left", cursor: "pointer", WebkitTapHighlightColor: "transparent", width: "100%" }}>
                      {rowInner}
                    </button>
                  ) : (
                    <div key={e.date + e.orig + i} style={heroRow}>{rowInner}</div>
                  );
                })}
              </div>
            )}
            {par && (
              <div style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 13px", borderRadius: 999, background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 600, color: "var(--color-label)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden style={{ color: GOLD }}><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                {(() => { const f = fmtDay(par.date); return `${f.d} ${f.m}: ${par.text}`; })()}
              </div>
            )}
          </div>
        );
      })()}

      <div style={{ height: 10 }} />
      <NavFilterChips sticky ariaLabel="Фильтр календаря"
        items={[{ id: "all", label: "Все" }, { id: "ekadasi", label: "Экадаши" }, { id: "festival", label: "Праздники" }]}
        active={filt} onChange={(id) => setFilt(id as typeof filt)} />

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск: праздник, экадаши или имя" inputMode="search" aria-label="Поиск по календарю"
        style={{ marginTop: 12, width: "100%", boxSizing: "border-box", padding: "11px 14px", borderRadius: 14, border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", color: "var(--color-label)", outline: "none" }} />

      <div style={{ marginTop: 6 }} aria-live="polite">
        {err && (
          <div style={{ padding: "30px 10px", textAlign: "center", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", lineHeight: 1.55, color: "var(--color-label-3)" }}>
            Календарь для города «{loc.ru}» сейчас недоступен.{" "}
            {loc.key !== DEFAULT_LOC.key && (
              <button type="button" onClick={() => setLoc(DEFAULT_LOC)} style={{ padding: 0, border: "none", background: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "inherit", fontWeight: 600, color: "var(--color-gold-deep)" }}>Показать Вриндаван</button>
            )}
          </div>
        )}
        {(busy || monthBusy) && !err && (
          <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
            {[0, 1, 2].map((i) => <div key={i} style={{ height: 76, borderRadius: 20, background: "var(--color-glass-thin)", opacity: 0.7 }} />)}
          </div>
        )}
        {monthErr && (
          <div style={{ padding: "30px 10px", textAlign: "center", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", lineHeight: 1.55, color: "var(--color-label-3)" }}>
            Архив за {navLabel.toLowerCase()} для города «{loc.ru}» сейчас недоступен.
          </div>
        )}
        {!busy && !monthBusy && !monthErr && !err && filtered.length === 0 && (
          <div style={{ padding: "26px 8px", textAlign: "center", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", color: "var(--color-label-3)" }}>
            {q.trim() ? "Ничего не найдено." : "В этом месяце событий нет."}
          </div>
        )}
        {!busy && !monthBusy && months.map(([key, evs]) => {
          const [y, mo] = key.split("-").map(Number);
          return (
            <section key={key} style={{ marginTop: 16 }}>
              <div style={{ margin: "0 2px 10px", fontFamily: "var(--font-display)", fontSize: "var(--text-callout)", fontWeight: 700, letterSpacing: "-0.015em", color: "var(--color-label)" }}>
                {MONTH_H[mo - 1]} <span style={{ color: "var(--color-label-3)", fontWeight: 600 }}>{y}</span>
              </div>
              <div style={{ overflow: "hidden", ...fill }}>
                {evs.map((e, i) => {
                  const isPicked = e.date === route.day;
                  return (
                    <EventCard key={e.date + e.orig + i} variant="list" event={e}
                      brief={e.entityId && briefMap ? (briefMap.get(e.entityId) || null) : null}
                      parana={e.type === "ekadasi" ? paranaShortFor(e) : null}
                      first={i === 0} today={e.date === today} picked={isPicked}
                      onOpenEntity={onOpenEntity}
                      innerRef={isPicked ? setPicked : undefined} />
                  );
                })}
              </div>
            </section>
          );
        })}
        {live && (
          <p style={{ margin: "18px 2px 0", fontFamily: "var(--font-text)", fontSize: "var(--text-caption)", lineHeight: 1.55, color: "var(--color-label-3)" }}>
            Время параны указано по местному времени города «{loc.ru}». Расчёты — GCal (Гаурабда), официальный движок Календарного комитета GBC. Доступны {MIN_YM.slice(0, 4)}–{maxYm.slice(0, 4)} годы.
          </p>
        )}
      </div>

      <LocationSheet open={pickOpen} current={loc} onPick={setLoc} onClose={() => setPickOpen(false)} />
      <DateSheet
        open={dateOpen} ym={route.ym} day={route.day} maxYm={maxYm} dots={dots}
        loading={pastState === "busy"}
        onPreview={setPreviewYm}
        onPick={goto}
        onUpcoming={() => goto("/calendar")}
        onClose={() => { setDateOpen(false); setPreviewYm(null); }} />
    </div>
  );
}
