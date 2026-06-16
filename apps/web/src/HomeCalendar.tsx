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
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { SectionSubTabs } from "./SectionSubTabs";
import { HomeSheet } from "./HomeSheet";

const GOLD = "#D2AA1B";
const fill: React.CSSProperties = { background: "var(--color-glass-thin)", borderRadius: 20 };

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

const calCache = new Map<string, CalEvent[]>();
async function loadCal(loc: LocCity): Promise<CalEvent[]> {
  const hit = calCache.get(loc.key);
  if (hit) return hit;
  try {
    const params = new URLSearchParams();
    const latin = /^[A-Za-z .()'-]+ \[[A-Za-z .]+\]$/.test(loc.key);
    if (latin) params.set("loc", loc.key);
    if (typeof loc.lat === "number" && typeof loc.lng === "number") {
      params.set("lat", String(loc.lat)); params.set("lng", String(loc.lng));
    }
    if (![...params.keys()].length) params.set("loc", loc.key);
    const r = await fetch("/api/calendar?" + params.toString());
    if (r.ok) {
      const j = await r.json();
      const evs = (j.events || []) as CalEvent[];
      if (evs.length > 50) { calCache.set(loc.key, evs); return evs; }
    }
  } catch { /* сеть */ }
  throw new Error("calendar unavailable");
}

let locsCache: LocCountry[] | null = null;
async function loadLocs(): Promise<LocCountry[]> {
  if (locsCache) return locsCache;
  const r = await fetch("/data/vaisnava-locations.json");
  const j = await r.json();
  locsCache = (j.countries || []) as LocCountry[];
  return locsCache;
}

const MONTH_RU = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const MONTH_H = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const WD_RU = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtDay(iso: string): { d: string; wd: string; m: string; y: number } {
  const dt = new Date(iso + "T12:00:00");
  return { d: String(dt.getDate()), wd: WD_RU[dt.getDay()], m: MONTH_RU[dt.getMonth()], y: dt.getFullYear() };
}

const TYPE_META: Record<CalEvent["type"], { label: string; color: string }> = {
  ekadasi: { label: "Экадаши", color: GOLD },
  parana: { label: "Парана", color: "var(--color-label-3)" },
  festival: { label: "Праздник", color: "var(--color-brand-blue)" },
  appearance: { label: "Явление", color: "#2E9E5B" },
  disappearance: { label: "Уход", color: "var(--color-label-2)" },
  other: { label: "Событие", color: "var(--color-label-3)" },
};

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
      <div style={{ fontFamily: "var(--font-text)", fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLD }}>Календарь по городу</div>
      <h2 style={{ margin: "5px 0 0", fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.12, color: "var(--color-label)" }}>Выберите город</h2>
      <p style={{ margin: "7px 0 0", fontFamily: "var(--font-text)", fontSize: 13.5, lineHeight: 1.5, color: "var(--color-label-2)" }}>
        Время экадаши и параны зависит от восхода солнца — календарь рассчитывается для конкретного города. Нет в списке? Введите любой город мира — рассчитаем календарь по нему.
      </p>
      <div style={{ position: "sticky", top: 0, zIndex: 5, background: "var(--color-bg)", padding: "12px 0 8px" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Страна или город" inputMode="search"
          style={{ width: "100%", boxSizing: "border-box", padding: "11px 14px", borderRadius: 14, border: "0.5px solid var(--color-hairline)", background: "var(--color-glass-thin)", fontFamily: "var(--font-text)", fontSize: 15, color: "var(--color-label)", outline: "none" }} />
      </div>
      {!q.trim() && (
        <button type="button" onClick={useMyLocation} disabled={geoMe === "busy"} aria-label="Определить календарь по моей геолокации"
          style={{ display: "flex", width: "100%", alignItems: "center", gap: 11, padding: "13px 14px", borderRadius: 14, border: `1px solid color-mix(in srgb, ${GOLD} 35%, transparent)`, background: `color-mix(in srgb, ${GOLD} 8%, transparent)`, cursor: geoMe === "busy" ? "default" : "pointer", WebkitTapHighlightColor: "transparent" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="3.1" fill="none" stroke={GOLD} strokeWidth="1.8" />
            <path d="M12 2.2v3.1M12 18.7v3.1M2.2 12h3.1M18.7 12h3.1" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="12" cy="12" r="7.8" fill="none" stroke={GOLD} strokeWidth="1.3" opacity="0.5" />
          </svg>
          <span style={{ flex: 1, textAlign: "left", fontFamily: "var(--font-text)", fontSize: 15, fontWeight: 600, color: "var(--color-label)" }}>
            {geoMe === "busy" ? "Определяем местоположение…" : "По моей геолокации"}
          </span>
        </button>
      )}
      {!q.trim() && geoMe === "denied" && (
        <div style={{ margin: "8px 2px 0", fontFamily: "var(--font-text)", fontSize: 12.5, lineHeight: 1.45, color: "var(--color-label-3)" }}>Доступ к геолокации запрещён. Разрешите его в настройках браузера или выберите город вручную.</div>
      )}
      {!q.trim() && geoMe === "error" && (
        <div style={{ margin: "8px 2px 0", fontFamily: "var(--font-text)", fontSize: 12.5, lineHeight: 1.45, color: "var(--color-label-3)" }}>Не удалось определить местоположение. Выберите город вручную.</div>
      )}
      <div style={{ marginTop: 12 }}>
        {!locs && <div style={{ height: 120, ...fill, opacity: 0.6 }} />}
        {locs && !hasDirect && geoBusy && (
          <div style={{ padding: "22px 8px", textAlign: "center", fontFamily: "var(--font-text)", fontSize: 14, color: "var(--color-label-3)" }}>Ищем город…</div>
        )}
        {locs && !hasDirect && !geoBusy && geo && (
          <section style={{ marginTop: 4 }}>
            <div style={{ margin: "0 2px 8px", fontFamily: "var(--font-text)", fontSize: 12.5, lineHeight: 1.45, color: "var(--color-label-2)" }}>Найден город:</div>
            <div style={{ overflow: "hidden", ...fill }}>
              <button type="button" onClick={() => { onPick({ ru: geo.name, key: `@${geo.lat.toFixed(4)},${geo.lng.toFixed(4)}`, lat: geo.lat, lng: geo.lng, tz: geo.tz }); onClose(); }}
                style={{ display: "flex", width: "100%", alignItems: "center", gap: 11, padding: "13px 14px", textAlign: "left", background: "none", border: "none", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden style={{ flexShrink: 0 }}><path d="M12 21s-6.7-5.4-6.7-10.3A6.7 6.7 0 0 1 12 4a6.7 6.7 0 0 1 6.7 6.7C18.7 15.6 12 21 12 21Z" fill="none" stroke={GOLD} strokeWidth="1.8" /><circle cx="12" cy="10.6" r="2.3" fill="none" stroke={GOLD} strokeWidth="1.8" /></svg>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: 15, fontWeight: 600, color: "var(--color-label)" }}>{geo.name}</span>
                  <span style={{ display: "block", marginTop: 1, fontFamily: "var(--font-text)", fontSize: 12, color: "var(--color-label-3)" }}>
                    {[geo.admin1, geo.country].filter(Boolean).join(", ") || "календарь по этому городу"}
                  </span>
                </span>
                <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden style={{ flexShrink: 0, color: "var(--color-label-3)" }}><path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </div>
          </section>
        )}
        {locs && !hasDirect && !geoBusy && !geo && q.trim().length >= 2 && (
          <div style={{ padding: "26px 8px", textAlign: "center", fontFamily: "var(--font-text)", fontSize: 14, color: "var(--color-label-3)" }}>Город не найден. Проверьте написание.</div>
        )}
        {filtered.map((c) => (
          <section key={c.country} style={{ marginTop: 16 }}>
            <div style={{ margin: "0 2px 8px", fontFamily: "var(--font-text)", fontSize: 11, fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: "var(--color-label-3)" }}>{c.country}</div>
            <div style={{ overflow: "hidden", ...fill }}>
              {c.cities.map((x, i) => {
                const on = x.key === current.key;
                return (
                  <button key={x.key} type="button" onClick={() => { onPick(x); onClose(); }}
                    style={{ display: "flex", width: "100%", alignItems: "center", gap: 10, padding: "12px 14px", textAlign: "left", background: "none", border: "none", borderTop: i ? "0.5px solid var(--color-hairline)" : "none", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                    <span style={{ flex: 1, fontFamily: "var(--font-text)", fontSize: 15, fontWeight: on ? 700 : 500, color: on ? GOLD : "var(--color-label)" }}>{x.ru}</span>
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
  const [all, setAll] = useState<CalEvent[] | null>(null);
  const [err, setErr] = useState(false);
  const [filt, setFilt] = useState<"all" | "ekadasi" | "festival" | "vaisnava">("all");
  const [q, setQ] = useState("");
  const [pickOpen, setPickOpen] = useState(false);
  const gen = useRef(0);

  useEffect(() => {
    const g = ++gen.current;
    setAll(null); setErr(false);
    loadCal(loc).then((evs) => { if (gen.current === g) setAll(evs); })
      .catch(() => { if (gen.current === g) setErr(true); });
    try { localStorage.setItem(LS_KEY, JSON.stringify(loc)); } catch { /* noop */ }
  }, [loc]);

  const today = todayISO();
  const upcoming = useMemo(() => (all || []).filter((e) => e.date >= today), [all, today]);

  const nextEka = useMemo(() => upcoming.find((e) => e.type === "ekadasi") || null, [upcoming]);
  const nextParana = useMemo(() => {
    if (!nextEka) return null;
    return upcoming.find((e) => e.type === "parana" && e.date > nextEka.date) || null;
  }, [upcoming, nextEka]);
  const paranaText = useMemo(() => {
    if (!nextParana) return "";
    if (/\d{1,2}:\d{2}/.test(nextParana.title)) return nextParana.title;
    const m = nextParana.orig.match(/(\d{1,2}:\d{2}).*?-\s*(\d{1,2}:\d{2})/);
    return m ? `Выход из поста ${m[1]}–${m[2]}` : nextParana.title;
  }, [nextParana]);

  const filtered = useMemo(() => {
    let r = upcoming.filter((e) => e.type !== "parana");
    if (filt === "ekadasi") r = r.filter((e) => e.type === "ekadasi");
    else if (filt === "festival") r = r.filter((e) => e.type === "festival" || e.type === "other");
    else if (filt === "vaisnava") r = r.filter((e) => e.type === "appearance" || e.type === "disappearance");
    const t = q.trim().toLowerCase();
    if (t) r = r.filter((e) => e.title.toLowerCase().includes(t) || e.orig.toLowerCase().includes(t));
    return r;
  }, [upcoming, filt, q]);

  const months = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    filtered.forEach((e) => { const k = e.date.slice(0, 7); (m.get(k) || m.set(k, []).get(k)!).push(e); });
    return [...m.entries()];
  }, [filtered]);

  return (
    <div>
      <div style={{ padding: "20px 0 0" }}>
        <div style={{ fontFamily: "var(--font-text)", fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLD }}>Вайшнавский календарь</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 5 }}>
          <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1, color: "var(--color-label)" }}>Календарь ИСККОН</h2>
          <button type="button" onClick={() => setPickOpen(true)} aria-label="Сменить город календаря"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, border: `1px solid color-mix(in srgb, ${GOLD} 45%, transparent)`, background: `color-mix(in srgb, ${GOLD} 10%, transparent)`, cursor: "pointer", WebkitTapHighlightColor: "transparent", fontFamily: "var(--font-text)", fontSize: 13.5, fontWeight: 600, color: "var(--color-label)" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden><path d="M12 21s-6.7-5.4-6.7-10.3A6.7 6.7 0 0 1 12 4a6.7 6.7 0 0 1 6.7 6.7C18.7 15.6 12 21 12 21Z" fill="none" stroke={GOLD} strokeWidth="1.8" /><circle cx="12" cy="10.6" r="2.3" fill="none" stroke={GOLD} strokeWidth="1.8" /></svg>
            {loc.ru}
            <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden><path d="m7 10 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
        <p style={{ margin: "8px 0 0", fontFamily: "var(--font-text)", fontSize: 14, lineHeight: 1.5, color: "var(--color-label-2)" }}>
          Экадаши, праздники и дни великих вайшнавов по расчётам GCal — официальной программы Календарного комитета GBC. Время — по городу {loc.ru}.
        </p>
      </div>

      {/* hero — ближайший экадаши */}
      {nextEka && (
        <div style={{ marginTop: 16, padding: "20px 18px", borderRadius: 22, background: `linear-gradient(135deg, color-mix(in srgb, ${GOLD} 16%, var(--color-glass-thin)), var(--color-glass-thin))` }}>
          <div style={{ fontFamily: "var(--font-text)", fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLD }}>Ближайший экадаши · {loc.ru}</div>
          <div style={{ marginTop: 6, fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 700, letterSpacing: "-0.018em", lineHeight: 1.18, color: "var(--color-label)" }}>{nextEka.title.replace(" — пост", "")}</div>
          <div style={{ marginTop: 5, fontFamily: "var(--font-text)", fontSize: 14, color: "var(--color-label-2)" }}>
            {(() => { const f = fmtDay(nextEka.date); return `${f.wd}, ${f.d} ${f.m} ${f.y}`; })()} · пост
          </div>
          {nextParana && (
            <div style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 12px", borderRadius: 999, background: "var(--color-glass-regular)", fontFamily: "var(--font-text)", fontSize: 13, fontWeight: 600, color: "var(--color-label)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
              {(() => { const f = fmtDay(nextParana.date); return `${f.d} ${f.m}: ${paranaText}`; })()}
            </div>
          )}
        </div>
      )}

      <div style={{ height: 10 }} />
      <SectionSubTabs variant="chips" ariaLabel="Фильтр календаря" tone="light" top={stickyTop} bleed={16}
        items={[{ id: "all", label: "Все" }, { id: "ekadasi", label: "Экадаши" }, { id: "festival", label: "Праздники" }, { id: "vaisnava", label: "Вайшнавы" }]}
        active={filt} onChange={(id) => setFilt(id as typeof filt)} />

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск: праздник, экадаши или имя" inputMode="search" aria-label="Поиск по календарю"
        style={{ marginTop: 12, width: "100%", boxSizing: "border-box", padding: "11px 14px", borderRadius: 14, border: "0.5px solid var(--color-hairline)", background: "var(--color-glass-thin)", fontFamily: "var(--font-text)", fontSize: 15, color: "var(--color-label)", outline: "none" }} />

      <div style={{ marginTop: 6 }} aria-live="polite">
        {err && (
          <div style={{ padding: "30px 10px", textAlign: "center", fontFamily: "var(--font-text)", fontSize: 14.5, lineHeight: 1.55, color: "var(--color-label-3)" }}>
            Календарь для города «{loc.ru}» сейчас недоступен.{" "}
            {loc.key !== DEFAULT_LOC.key && (
              <button type="button" onClick={() => setLoc(DEFAULT_LOC)} style={{ padding: 0, border: "none", background: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "inherit", fontWeight: 600, color: "var(--color-brand-blue)" }}>Показать Вриндаван</button>
            )}
          </div>
        )}
        {!err && !all && (
          <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
            {[0, 1, 2].map((i) => <div key={i} style={{ height: 76, ...fill, opacity: 0.6 }} />)}
          </div>
        )}
        {all && q.trim() && filtered.length === 0 && (
          <div style={{ padding: "26px 8px", textAlign: "center", fontFamily: "var(--font-text)", fontSize: 14, color: "var(--color-label-3)" }}>Ничего не найдено.</div>
        )}
        {all && months.map(([key, evs]) => {
          const [y, mo] = key.split("-").map(Number);
          return (
            <section key={key} style={{ marginTop: 20 }}>
              <div style={{ margin: "0 2px 10px", fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, letterSpacing: "-0.015em", color: "var(--color-label)" }}>
                {MONTH_H[mo - 1]} <span style={{ color: "var(--color-label-3)", fontWeight: 600 }}>{y}</span>
              </div>
              <div style={{ overflow: "hidden", ...fill }}>
                {evs.map((e, i) => {
                  const f = fmtDay(e.date); const meta = TYPE_META[e.type];
                  const isToday = e.date === today;
                  const linked = !!e.entityId && !!onOpenEntity;
                  const inner = (
                    <>
                      <div style={{ flexShrink: 0, width: 44, textAlign: "center" }}>
                        <div style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700, lineHeight: 1, color: isToday ? GOLD : "var(--color-label)" }}>{f.d}</div>
                        <div style={{ marginTop: 2, fontFamily: "var(--font-text)", fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", color: isToday ? GOLD : "var(--color-label-3)" }}>{f.wd}</div>
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontFamily: "var(--font-text)", fontSize: 14.5, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.35, color: "var(--color-label)" }}>{e.title}</div>
                        <div style={{ marginTop: 2, fontFamily: "var(--font-text)", fontSize: 11.5, fontWeight: 600, color: meta.color }}>{isToday ? "Сегодня · " : ""}{meta.label}{linked ? " · Герой" : ""}</div>
                      </div>
                      {linked && (
                        <span aria-hidden style={{ flexShrink: 0, color: "var(--color-label-3)" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </span>
                      )}
                    </>
                  );
                  const rowStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 13, padding: "12px 14px", borderTop: i ? "0.5px solid var(--color-hairline)" : "none" };
                  return linked ? (
                    <button key={e.date + e.orig + i} type="button" onClick={() => onOpenEntity!(e.entityId!, "personality")}
                      style={{ ...rowStyle, width: "100%", textAlign: "left", background: "none", border: "none", borderTop: rowStyle.borderTop, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                      {inner}
                    </button>
                  ) : (
                    <div key={e.date + e.orig + i} style={rowStyle}>{inner}</div>
                  );
                })}
              </div>
            </section>
          );
        })}
        {all && (
          <p style={{ margin: "18px 2px 0", fontFamily: "var(--font-text)", fontSize: 11.5, lineHeight: 1.55, color: "var(--color-label-3)" }}>
            Время параны указано по местному времени города «{loc.ru}». Расчёты — GCal (Гаурабда), официальный движок Календарного комитета GBC.
          </p>
        )}
      </div>

      <LocationSheet open={pickOpen} current={loc} onPick={setLoc} onClose={() => setPickOpen(false)} />
    </div>
  );
}
