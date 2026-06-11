/**
 * HomePlaces — каталог «Центры ИСККОН» / «Рестораны ИСККОН».
 *
 * Данные: apps/web/public/data/iskcon-places.json — собираются воркфлоу
 * iskcon-places-scrape.yml из ОФИЦИАЛЬНОГО каталога centres.iskcon.org.
 *
 * Навигация по стандарту apartsales (три уровня на Главной):
 *   Tier-1 — HomeTabs (Центры | Рестораны | …)
 *   Tier-2 — континенты (SectionSubTabs, sticky под Tier-1)
 *   Tier-3 — страны выбранного континента (SectionSubTabs, sticky под Tier-2)
 *
 * Витринная карточка центра (ВКЦ) / ресторана (ВКР): имя, категория, город ·
 * страна, адрес, контакты-действия (позвонить / написать / сайт), «Маршрут»
 * (Google Maps), «Источник» → официальная страница (ПКЦ/ПКР — следующий этап).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { SectionSubTabs } from "./SectionSubTabs";

const GOLD = "#D2AA1B";
const fill: React.CSSProperties = { background: "var(--color-glass-thin)", borderRadius: 20 };

export interface Place {
  id: string; name: string; categories: string[];
  address: string; city: string; state: string; country: string; continent: string;
  lat: number | null; lng: number | null;
  phone: string; email: string; website: string; source: string;
  kind: "centre" | "restaurant";
}

let cache: Place[] | null = null;
let cachePromise: Promise<Place[]> | null = null;
function loadPlaces(): Promise<Place[]> {
  if (cache) return Promise.resolve(cache);
  if (!cachePromise) {
    cachePromise = fetch("/data/iskcon-places.json")
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((j) => { cache = (j.places || []) as Place[]; return cache; });
  }
  return cachePromise;
}

const CONTINENT_ORDER = ["Азия", "Европа", "Северная Америка", "Южная Америка", "Африка", "Океания", "Другое"];

/* RU-названия частых стран для красивых ярлыков Tier-3 (остальные — как в данных) */
const COUNTRY_RU: Record<string, string> = {
  "india": "Индия", "united states": "США", "united states of america": "США", "usa": "США",
  "united kingdom": "Великобритания", "uk": "Великобритания", "russia": "Россия", "russian federation": "Россия",
  "ukraine": "Украина", "germany": "Германия", "france": "Франция", "italy": "Италия", "spain": "Испания",
  "canada": "Канада", "australia": "Австралия", "new zealand": "Новая Зеландия", "brazil": "Бразилия",
  "argentina": "Аргентина", "mexico": "Мексика", "south africa": "ЮАР", "netherlands": "Нидерланды",
  "belgium": "Бельгия", "switzerland": "Швейцария", "sweden": "Швеция", "poland": "Польша",
  "hungary": "Венгрия", "czech republic": "Чехия", "czechia": "Чехия", "bangladesh": "Бангладеш",
  "nepal": "Непал", "sri lanka": "Шри-Ланка", "malaysia": "Малайзия", "singapore": "Сингапур",
  "indonesia": "Индонезия", "philippines": "Филиппины", "china": "Китай", "japan": "Япония",
  "kazakhstan": "Казахстан", "georgia": "Грузия", "armenia": "Армения", "israel": "Израиль",
  "ireland": "Ирландия", "portugal": "Португалия", "austria": "Австрия", "finland": "Финляндия",
  "norway": "Норвегия", "denmark": "Дания", "croatia": "Хорватия", "serbia": "Сербия",
  "bulgaria": "Болгария", "romania": "Румыния", "greece": "Греция", "turkey": "Турция",
  "fiji": "Фиджи", "mauritius": "Маврикий", "kenya": "Кения", "nigeria": "Нигерия", "ghana": "Гана",
  "peru": "Перу", "chile": "Чили", "colombia": "Колумбия", "ecuador": "Эквадор", "bolivia": "Боливия",
  "venezuela": "Венесуэла", "guyana": "Гайана", "trinidad and tobago": "Тринидад и Тобаго",
  "belarus": "Беларусь", "latvia": "Латвия", "lithuania": "Литва", "estonia": "Эстония",
  "moldova": "Молдова", "slovakia": "Словакия", "slovenia": "Словения",
};
const ruCountry = (c: string) => COUNTRY_RU[c.trim().toLowerCase()] || c;

function mapsUrl(p: Place): string {
  if (p.lat != null && p.lng != null) return `https://maps.google.com/?q=${p.lat},${p.lng}`;
  return `https://maps.google.com/?q=${encodeURIComponent([p.name, p.address].filter(Boolean).join(", "))}`;
}

/* мини-иконки действий (line, 1.8) */
function Ic({ d, size = 16 }: { d: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden style={{ flexShrink: 0 }}><path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
const I = {
  pin: "M12 21s-6.5-5.4-6.5-10A6.5 6.5 0 0 1 12 4.5 6.5 6.5 0 0 1 18.5 11c0 4.6-6.5 10-6.5 10Zm0-8.2a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8Z",
  phone: "M6.6 3.8 9 3.2c.5-.1 1 .2 1.2.7l1 2.6c.2.5 0 1-.4 1.3l-1.3 1a12.6 12.6 0 0 0 5.7 5.7l1-1.3c.3-.4.8-.6 1.3-.4l2.6 1c.5.2.8.7.7 1.2l-.6 2.4c-.1.5-.6.9-1.1.9C11.4 18.6 5.4 12.6 4.7 4.9c0-.5.4-1 .9-1.1Z",
  mail: "M4 6.5h16v11H4zM4.5 7l7.5 6 7.5-6",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0c2.5-2.2 4-5.4 4-9s-1.5-6.8-4-9c-2.5 2.2-4 5.4-4 9s1.5 6.8 4 9ZM3.5 12h17",
  route: "M5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm14-10a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM7 17h7a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h7",
};

function ActionPill({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      onPointerDown={(e) => (e.currentTarget.style.opacity = "0.6")} onPointerUp={(e) => (e.currentTarget.style.opacity = "1")} onPointerLeave={(e) => (e.currentTarget.style.opacity = "1")}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 999, background: "var(--color-glass-regular)",
        fontFamily: "var(--font-text)", fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--color-label)", textDecoration: "none", WebkitTapHighlightColor: "transparent" }}>
      <Ic d={icon} size={15} />{label}
    </a>
  );
}

/* русские ярлыки категорий DT; служебные скрываем */
const CAT_RU: Record<string, string> = {
  "centre": "Центр", "centers": "Центр", "websites": "Центр",
  "agriculture": "Ферма", "farms": "Ферма",
  "farm and rural communities": "Сельская община",
  "educational institutes": "Образование", "iskcon education": "Образование",
};
function catRu(p: Place): string {
  if (p.kind === "restaurant") return "Ресторан";
  for (const c of p.categories) {
    const r = CAT_RU[c.trim().toLowerCase()];
    if (r && r !== "Центр") return r;
  }
  return "Центр";
}
function sourceLabel(src: string): string {
  try { return new URL(src).hostname.replace(/^www\./, ""); } catch { return "источник"; }
}

/* ── ВКЦ / ВКР ── */
function PlaceCard({ p }: { p: Place }) {
  const catLabel = catRu(p);
  return (
    <article style={{ padding: 18, ...fill }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: "var(--font-text)", fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLD }}>{catLabel}</div>
          <h3 style={{ margin: "4px 0 0", fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 800, letterSpacing: "-0.018em", lineHeight: 1.18, color: "var(--color-label)" }}>{p.name}</h3>
          <div style={{ marginTop: 3, fontFamily: "var(--font-text)", fontSize: 13, color: "var(--color-label-3)" }}>
            {[p.city, ruCountry(p.country)].filter(Boolean).join(" · ")}
          </div>
        </div>
      </div>
      {p.address && (
        <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "flex-start", fontFamily: "var(--font-text)", fontSize: 13.5, lineHeight: 1.5, color: "var(--color-label-2)" }}>
          <span style={{ color: "var(--color-label-3)", marginTop: 1 }}><Ic d={I.pin} size={15} /></span>
          <span>{p.address}</span>
        </div>
      )}
      <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8 }}>
        <ActionPill href={mapsUrl(p)} label="Маршрут" icon={I.route} />
        {p.phone && <ActionPill href={`tel:${p.phone.replace(/[^\d+]/g, "")}`} label="Позвонить" icon={I.phone} />}
        {p.email && <ActionPill href={`mailto:${p.email}`} label="Написать" icon={I.mail} />}
        {p.website && <ActionPill href={p.website} label="Сайт" icon={I.globe} />}
      </div>
      <a href={p.source} target="_blank" rel="noopener noreferrer"
        style={{ display: "inline-flex", alignItems: "center", gap: 3, marginTop: 12, fontFamily: "var(--font-text)", fontSize: 13, fontWeight: 600, color: "var(--color-brand-blue)", textDecoration: "none" }}>
        Подробнее на {sourceLabel(p.source)}
        <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden><path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </a>
    </article>
  );
}

/* ── каталог ── */
export function HomePlaces({ kind, stickyTop }: { kind: "centre" | "restaurant"; stickyTop: number }) {
  const [all, setAll] = useState<Place[] | null>(null);
  const [err, setErr] = useState(false);
  const [q, setQ] = useState("");
  const [cont, setCont] = useState("all");
  const [ctry, setCtry] = useState("all");
  const [limit, setLimit] = useState(30);
  const t2Ref = useRef<HTMLElement | null>(null);
  const [t2H, setT2H] = useState(44);

  useEffect(() => { loadPlaces().then(setAll).catch(() => setErr(true)); }, []);
  useEffect(() => { setCtry("all"); setLimit(30); }, [cont]);
  useEffect(() => { setLimit(30); }, [q, ctry, kind]);

  const items = useMemo(() => (all || []).filter((p) => p.kind === kind), [all, kind]);

  const continents = useMemo(() => {
    const have = new Set(items.map((p) => p.continent));
    return CONTINENT_ORDER.filter((c) => have.has(c));
  }, [items]);

  const countries = useMemo(() => {
    if (cont === "all") return [];
    const m = new Map<string, number>();
    items.filter((p) => p.continent === cont).forEach((p) => { const c = p.country || "—"; m.set(c, (m.get(c) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }, [items, cont]);

  const trimmed = q.trim().toLowerCase();
  const filtered = useMemo(() => {
    let r = items;
    if (cont !== "all") r = r.filter((p) => p.continent === cont);
    if (ctry !== "all") r = r.filter((p) => p.country === ctry);
    if (trimmed) {
      r = r.filter((p) => [p.name, p.city, p.state, p.country, ruCountry(p.country), p.address]
        .some((f) => f && f.toLowerCase().includes(trimmed)));
    }
    return r;
  }, [items, cont, ctry, trimmed]);

  const title = kind === "restaurant" ? "Рестораны ИСККОН" : "Центры ИСККОН";
  const sub = kind === "restaurant"
    ? "Кафе и рестораны Говинды по всему миру — освящённая вегетарианская кухня. Каталог собран из официального справочника centres.iskcon.org."
    : "Храмы, центры, общины и фермы Международного общества сознания Кришны по всему миру. Каталог собран из официального справочника centres.iskcon.org.";

  return (
    <div>
      <div style={{ padding: "20px 0 0" }}>
        <div style={{ fontFamily: "var(--font-text)", fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLD }}>Каталог</div>
        <h2 style={{ margin: "5px 0 0", fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800, letterSpacing: "-0.022em", lineHeight: 1.1, color: "var(--color-label)" }}>{title}</h2>
        <p style={{ margin: "8px 0 0", fontFamily: "var(--font-text)", fontSize: 14, lineHeight: 1.5, color: "var(--color-label-2)" }}>{sub}</p>
      </div>

      {/* поиск */}
      <div role="search" style={{ position: "relative", marginTop: 14 }}>
        <span aria-hidden style={{ position: "absolute", left: 13, top: 0, bottom: 0, display: "grid", placeItems: "center", color: "var(--color-label-3)", pointerEvents: "none" }}>
          <svg width="17" height="17" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="m20 20-3.4-3.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </span>
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={kind === "restaurant" ? "Город, страна или название" : "Город, страна или название центра"}
          inputMode="search" autoComplete="off" autoCorrect="off" spellCheck={false} aria-label="Поиск по каталогу"
          style={{ width: "100%", boxSizing: "border-box", padding: "12px 38px", borderRadius: 14, border: "none",
            background: "var(--color-glass-thin)", fontFamily: "var(--font-text)", fontSize: 16, color: "var(--color-label)", outline: "none", WebkitAppearance: "none" }} />
        {q && (
          <button type="button" aria-label="Очистить" onClick={() => setQ("")}
            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", width: 26, height: 26, borderRadius: "50%", border: "none",
              background: "var(--color-glass-regular)", color: "var(--color-label-2)", cursor: "pointer", display: "grid", placeItems: "center", WebkitTapHighlightColor: "transparent" }}>
            <svg width="12" height="12" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
          </button>
        )}
      </div>

      {/* Tier-2: континенты */}
      <div style={{ height: 10 }} />
      <SectionSubTabs ariaLabel="Континенты" tone="light" top={stickyTop} bleed={16}
        navRef={(el) => { t2Ref.current = el; if (el) setT2H(el.offsetHeight); }}
        items={[{ id: "all", label: "Все" }, ...continents.map((c) => ({ id: c, label: c }))]}
        active={cont} onChange={setCont} />

      {/* Tier-3: страны выбранного континента */}
      {cont !== "all" && countries.length > 1 && (
        <SectionSubTabs ariaLabel="Страны" tone="light" top={stickyTop + t2H} bleed={16}
          items={[{ id: "all", label: "Все страны" }, ...countries.map((c) => ({ id: c, label: ruCountry(c) }))]}
          active={ctry} onChange={setCtry} />
      )}

      {/* результаты */}
      <div style={{ marginTop: 14 }} aria-live="polite">
        {err && (
          <div style={{ padding: "30px 10px", textAlign: "center", fontFamily: "var(--font-text)", fontSize: 14.5, lineHeight: 1.55, color: "var(--color-label-3)" }}>
            Каталог обновляется. Попробуйте позже —<br />данные загружаются с официального справочника.
          </div>
        )}
        {!err && !all && (
          <div style={{ display: "grid", gap: 12 }}>
            {[0, 1, 2].map((i) => <div key={i} style={{ height: 150, ...fill, opacity: 0.6 }} />)}
          </div>
        )}
        {all && (
          <>
            <div style={{ margin: "0 2px 10px", fontFamily: "var(--font-text)", fontSize: 12.5, color: "var(--color-label-3)" }}>
              {filtered.length} {kind === "restaurant" ? "ресторанов" : "центров"}
            </div>
            {filtered.length === 0 ? (
              <div style={{ padding: "26px 8px", textAlign: "center", fontFamily: "var(--font-text)", fontSize: 14.5, lineHeight: 1.55, color: "var(--color-label-3)" }}>
                Ничего не найдено{trimmed ? <> по запросу «{q.trim()}»</> : ""}.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {filtered.slice(0, limit).map((p) => <PlaceCard key={p.id + p.source} p={p} />)}
              </div>
            )}
            {filtered.length > limit && (
              <button type="button" onClick={() => setLimit((l) => l + 30)}
                onPointerDown={(e) => (e.currentTarget.style.opacity = "0.6")} onPointerUp={(e) => (e.currentTarget.style.opacity = "1")} onPointerLeave={(e) => (e.currentTarget.style.opacity = "1")}
                style={{ marginTop: 14, width: "100%", padding: "13px 0", borderRadius: 14, border: "none", background: "var(--color-glass-regular)",
                  fontFamily: "var(--font-text)", fontSize: 14.5, fontWeight: 600, color: "var(--color-label)", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                Показать ещё {Math.min(30, filtered.length - limit)}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
