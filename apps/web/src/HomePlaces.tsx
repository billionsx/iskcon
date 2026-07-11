/**
 * HomePlaces — каталог «Центры ИСККОН» / «Рестораны ИСККОН».
 *
 * Данные — НАША база (Cloudflare D1, таблица `places`; наполняет воркфлоу
 * home-catalog-load.yml из официального справочника). Поиск и фильтры —
 * серверные: /api/places (q · континент · страна) и /api/places/facets.
 *
 * Навигация по стандарту ISKCON ONE LOVE (три уровня на Главной, ЗКН-Н004):
 *   Tier-1 — HomeTabs (Центры | Рестораны | …)
 *   Tier-2 — континенты (SectionSubTabs, sticky под Tier-1)
 *   Tier-3 — страны выбранного континента (SectionSubTabs, sticky под Tier-2)
 *
 * ВКЦ/ВКР: имя, категория, город · страна, адрес → тап открывает ПКЦ/ПКР —
 * полную карточку места ВНУТРИ приложения (шит с контактами и маршрутом);
 * наружу ведут только действия (позвонить / написать / сайт / маршрут).
 */
import { CardActionBtns, favMetaFromCtx, useCardActions } from "./cardActions";
import { useEffect, useMemo, useRef, useState } from "react";
import { SectionSubTabs } from "./SectionSubTabs";
import { HomeSheet } from "./HomeSheet";
import { api } from "./api";
import { type PlaceItem } from "./placesShared";
import { FilterChips as NavFilterChips } from "./ui/nav4";
import { ROUTES, url } from "./routes";

const GOLD = "var(--color-gold)";
const fill: React.CSSProperties = { background: "var(--color-glass-thin)", borderRadius: 20 };

interface Facets { total: number; continents: { id: string; n: number; countries: { id: string; ru: string; n: number }[] }[] }
interface GeoHit { name: string; lat: number; lng: number; tz: string | null; country: string | null; admin1: string | null }

function haversine(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
function kmLabel(km: number): string {
  return km < 1 ? "рядом" : "~" + Math.round(km).toLocaleString("ru-RU") + " км";
}

// Полный список мест вида — для подбора ближайших, когда поиск не дал прямых совпадений.
// Грузим один раз и кэшируем; только проверенные параметры /api/places (kind/limit/offset).
const allPlacesCache: Record<string, PlaceItem[]> = {};
const allPlacesPending: Record<string, Promise<PlaceItem[]>> = {};
async function loadAllPlaces(kind: string): Promise<PlaceItem[]> {
  if (allPlacesCache[kind]) return allPlacesCache[kind];
  if (allPlacesPending[kind]) return allPlacesPending[kind];
  const job = (async () => {
    const out: PlaceItem[] = [];
    const LIM = 100;
    for (let off = 0, page = 0; page < 20; page++, off += LIM) {
      const r = await fetch(api(`/places?kind=${encodeURIComponent(kind)}&limit=${LIM}&offset=${off}`));
      if (!r.ok) break;
      const j = await r.json();
      const items = (j.items || []) as PlaceItem[];
      out.push(...items);
      if (items.length < LIM || (j.total && out.length >= j.total)) break;
    }
    allPlacesCache[kind] = out;
    return out;
  })();
  allPlacesPending[kind] = job;
  try { return await job; } finally { delete allPlacesPending[kind]; }
}

function mapsUrl(p: PlaceItem): string {
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
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => (e.currentTarget.style.opacity = "0.6")} onPointerUp={(e) => (e.currentTarget.style.opacity = "1")} onPointerLeave={(e) => (e.currentTarget.style.opacity = "1")}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 999, background: "var(--color-glass-regular)",
        fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 600, letterSpacing: "-0.01em", color: "var(--color-label)", textDecoration: "none", WebkitTapHighlightColor: "transparent" }}>
      <Ic d={icon} size={15} />{label}
    </a>
  );
}



/* Гео-подпись без дублей: отбрасываем город/страну, если они уже в названии. */
function geoLine(p: PlaceItem, sep = " · "): string {
  const nm = `${p.nameRu || ""} ${p.name || ""}`;
  const has = (x: string) => !!x && nm.toLowerCase().includes(x.toLowerCase());
  const city = p.cityRu || p.city;
  return [city, p.stateRu && p.stateRu !== city ? p.stateRu : "", p.countryRu]
    .filter((x) => x && !has(x))
    .join(sep);
}

/* ── контекст действий карточки места (share/PDF/QR/ошибка) ── */
function placeCtx(p: PlaceItem) {
  const where = geoLine(p, ", ");
  return {
    type: (p.kind === "restaurant" ? "restaurant" : "place") as "place" | "restaurant",
    id: p.id,
    title: p.nameRu || p.name,
    subtitle: where || undefined,
    url: url("/place/" + p.id),
    context: `${p.kind === "restaurant" ? "Ресторан" : "Центр"} · ${p.nameRu || p.name}${p.addressRu || p.address ? ` · ${p.addressRu || p.address}` : ""} · /place/${p.id}`,
  };
}

/* ── ВКЦ / ВКР: тап открывает полную карточку внутри приложения ── */
function PlaceCard({ p, onOpen, flash, dist }: { p: PlaceItem; onOpen: (p: PlaceItem) => void; flash?: (m: string) => void; dist?: number }) {
  const { openCardMenu } = useCardActions();
  return (
    <article role="button" tabIndex={0} onClick={() => onOpen(p)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(p); } }}
      onPointerDown={(e) => (e.currentTarget.style.opacity = "0.7")} onPointerUp={(e) => (e.currentTarget.style.opacity = "1")} onPointerLeave={(e) => (e.currentTarget.style.opacity = "1")}
      style={{ padding: 18, cursor: "pointer", WebkitTapHighlightColor: "transparent", ...fill }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLD }}>{p.category}</div>
          <h3 style={{ margin: "4px 0 0", fontFamily: "var(--font-display)", fontSize: "var(--text-body)", fontWeight: 600, letterSpacing: "-0.014em", lineHeight: 1.22, color: "var(--color-label)" }}>{p.nameRu || p.name}</h3>
          <div style={{ marginTop: 3, fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", color: "var(--color-label-3)" }}>
            {[geoLine(p), dist != null ? kmLabel(dist) : ""].filter(Boolean).join(" · ")}
          </div>
        </div>
        <CardActionBtns favKey={`${p.kind}:${p.id}`} meta={favMetaFromCtx(placeCtx(p))} flash={flash} size={32}
          onMore={() => openCardMenu(placeCtx(p))} />
      </div>
      {p.address && (
        <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "flex-start", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", lineHeight: 1.5, color: "var(--color-label-2)" }}>
          <span style={{ color: "var(--color-label-3)", marginTop: 1 }}><Ic d={I.pin} size={15} /></span>
          <span>{p.addressRu || p.address}</span>
        </div>
      )}
    </article>
  );
}

/* ── ПКЦ / ПКР: полная карточка места внутри приложения ── */
function InfoRow({ k, v, last }: { k: string; v: string; last?: boolean }) {
  if (!v) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "11px 0", borderBottom: last ? "none" : "1px solid var(--color-separator)" }}>
      <span style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", color: "var(--color-label-3)", flexShrink: 0 }}>{k}</span>
      <span style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: 500, color: "var(--color-label)", textAlign: "right", overflowWrap: "anywhere" }}>{v}</span>
    </div>
  );
}

function PlaceSheet({ p, onClose, flash }: { p: PlaceItem | null; onClose: () => void; flash?: (m: string) => void }) {
  const { openCardMenu } = useCardActions();
  if (!p) return null;
  const site = p.website && /^https?:\/\//.test(p.website) ? p.website : p.website ? `http://${p.website}` : "";
  return (
    <HomeSheet open={!!p} label={p.nameRu || p.name} onClose={onClose}>
      <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLD }}>
        {p.kind === "restaurant" ? "Ресторан ИСККОН" : `${p.category} ИСККОН`}
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <h2 style={{ margin: "5px 0 0", flex: 1, minWidth: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-title1)", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.12, color: "var(--color-label)" }}>{p.nameRu || p.name}</h2>
        <CardActionBtns favKey={`${p.kind}:${p.id}`} meta={favMetaFromCtx(placeCtx(p))} flash={flash} onMore={() => openCardMenu(placeCtx(p))} />
      </div>
      {p.nameRu && p.nameRu !== p.name && (
        <div style={{ marginTop: 4, fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", color: "var(--color-label-3)" }}>{p.name}</div>
      )}
      <div style={{ marginTop: 5, fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", color: "var(--color-label-3)" }}>
        {geoLine(p)}
      </div>

      <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 8 }}>
        <ActionPill href={mapsUrl(p)} label="Маршрут" icon={I.route} />
        {p.phone && <ActionPill href={`tel:${p.phone.split(",")[0].replace(/[^\d+]/g, "")}`} label="Позвонить" icon={I.phone} />}
        {p.email && <ActionPill href={`mailto:${p.email}`} label="Написать" icon={I.mail} />}
        {site && <ActionPill href={site} label="Сайт" icon={I.globe} />}
      </div>

      {p.address && (
        <div style={{ marginTop: 18, padding: 16, ...fill }}>
          <div style={{ display: "flex", gap: 9, alignItems: "flex-start", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", lineHeight: 1.55, color: "var(--color-label)" }}>
            <span style={{ color: GOLD, marginTop: 2 }}><Ic d={I.pin} size={16} /></span>
            <span>{p.addressRu || p.address}</span>
          </div>
        </div>
      )}

      <div style={{ marginTop: 14, padding: "4px 16px", ...fill }}>
        <InfoRow k="Категория" v={p.category} />
        <InfoRow k="Город" v={p.cityRu || p.city} />
        <InfoRow k="Регион" v={p.stateRu && p.stateRu !== (p.cityRu || p.city) ? p.stateRu : ""} />
        <InfoRow k="Страна" v={p.countryRu || "—"} />
        <InfoRow k="Континент" v={p.continent} />
        <InfoRow k="Телефон" v={p.phone} />
        <InfoRow k="Email" v={p.email} last />
      </div>

      <p style={{ margin: "16px 2px 0", fontFamily: "var(--font-text)", fontSize: "var(--text-caption)", lineHeight: 1.55, color: "var(--color-label-3)" }}>
        Данные — из нашей базы каталога ИСККОН; первоисточник — официальный справочник центров. Уточняйте расписание программ по контактам центра.
      </p>
    </HomeSheet>
  );
}

/* ── каталог ── */
export function HomePlaces({ kind, stickyTop, flash, openSig }: { kind: "centre" | "restaurant"; stickyTop: number; flash?: (m: string) => void; openSig?: number }) {
  const [facets, setFacets] = useState<Facets | null>(null);
  const [items, setItems] = useState<PlaceItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState(false);
  const [q, setQ] = useState("");
  const [cont, setCont] = useState("all");
  const [ctry, setCtry] = useState("all");
  const [open, setOpen] = useState<PlaceItem | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const t2Ref = useRef<HTMLElement | null>(null);
  const [t2H, setT2H] = useState(44);
  const reqSeq = useRef(0);
  const [geo, setGeo] = useState<GeoHit | null>(null);
  const [near, setNear] = useState<{ p: PlaceItem; km?: number }[] | null>(null);
  const [nearBusy, setNearBusy] = useState(false);
  const [nearNote, setNearNote] = useState<string>("");
  const sRef = useRef<HTMLDivElement | null>(null);
  const [sH, setSH] = useState(56);

  useEffect(() => { setCont("all"); setCtry("all"); setQ(""); }, [kind]);
  // Deep-link /place/<id>: открываем полную карточку, ключ одноразовый.
  // openSig растёт при каждом home-open → повторный заход открывает снова.
  useEffect(() => {
    let pid = ""; try { pid = sessionStorage.getItem("open-place") || ""; if (pid) sessionStorage.removeItem("open-place"); } catch { /* noop */ }
    if (!pid) return;
    fetch(`/api/places/${encodeURIComponent(pid)}`).then((r) => r.ok ? r.json() : null).then((j) => { const p = j?.place; if (p && p.id) setOpen(p as PlaceItem); }).catch(() => {});
  }, [openSig]);
  useEffect(() => { setCtry("all"); }, [cont]);

  useEffect(() => {
    fetch(api(`/places/facets?kind=${kind}`))
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setFacets).catch(() => setErr(true));
  }, [kind]);

  const buildQs = (offset: number) => {
    const sp = new URLSearchParams({ kind, limit: "30", offset: String(offset) });
    if (cont !== "all") sp.set("continent", cont);
    if (ctry !== "all") sp.set("country", ctry);
    if (q.trim()) sp.set("q", q.trim());
    return sp.toString();
  };

  // серверный поиск с дебаунсом
  useEffect(() => {
    const seq = ++reqSeq.current;
    setItems(null);
    const t = setTimeout(() => {
      fetch(api(`/places?${buildQs(0)}`))
        .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
        .then((j) => { if (reqSeq.current !== seq) return; setItems(j.items || []); setTotal(j.total || 0); })
        .catch(() => { if (reqSeq.current === seq) setErr(true); });
    }, q.trim() ? 280 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, cont, ctry, q]);

  // Умный подбор: текстовый поиск не дал совпадений → геокодим запрос и предлагаем
  // Ближайшие центры/рестораны, когда в самом городе их нет. Сначала точная
  // близость по координатам базы (гаверсинус). Но у ресторанов координат нет, а
  // в РФ их и вовсе ноль — поэтому фолбэк по нашей географии: тот же регион →
  // страна → часть света. Регион искомого города берём из любого места базы
  // (центра или ресторана) с этим городом, чтобы язык/политика геокодера не мешали.
  useEffect(() => {
    const t = q.trim();
    const miss = !!items && items.length === 0 && t.length >= 2;
    if (!miss) { setGeo(null); setNear(null); setNearBusy(false); setNearNote(""); return; }
    let alive = true; setGeo(null); setNear(null); setNearBusy(true); setNearNote("");
    (async () => {
      try {
        let hit: GeoHit | null = null;
        try {
          const gj = await (await fetch("/api/geocode?q=" + encodeURIComponent(t))).json();
          hit = gj && gj.result ? gj.result : null;
        } catch { hit = null; }
        if (!alive) return;
        const cur = await loadAllPlaces(kind);
        if (!alive) return;

        let ranked: { p: PlaceItem; km?: number }[] = [];
        let note = "вот ближайшие:";
        let label: string | null = hit?.name ?? null;

        if (hit) {
          ranked = cur
            .filter((p) => p.lat != null && p.lng != null)
            .map((p) => ({ p, km: haversine(hit!.lat, hit!.lng, p.lat as number, p.lng as number) }))
            .sort((a, b) => (a.km as number) - (b.km as number))
            .slice(0, 8);
        }

        if (ranked.length === 0) {
          const ql = t.toLowerCase();
          const other = await loadAllPlaces(kind === "restaurant" ? "centre" : "restaurant");
          if (!alive) return;
          const pool = [...cur, ...other];
          const probe =
            pool.find((p) => (p.cityRu || "").toLowerCase() === ql || (p.city || "").toLowerCase() === ql) ||
            pool.find((p) => (p.cityRu || "").toLowerCase().includes(ql) || (p.city || "").toLowerCase().includes(ql));
          if (probe) {
            if (!label) label = probe.cityRu || probe.city || null;
            const st = (probe.stateRu || "").trim();
            const cc = (probe.country || "").trim();
            const cont = (probe.continent || "").trim();
            const inState = st ? cur.filter((p) => (p.stateRu || "").trim() === st) : [];
            const inCountry = cc ? cur.filter((p) => (p.country || "").trim() === cc) : [];
            const inCont = cont ? cur.filter((p) => (p.continent || "").trim() === cont) : [];
            let pick = inState;
            if (pick.length) note = `вот ближайшие в регионе «${probe.stateRu}»:`;
            else if (inCountry.length) { pick = inCountry; note = `вот ближайшие в стране «${probe.countryRu || cc}»:`; }
            else if (inCont.length) { pick = inCont; note = `вот ближайшие — ${probe.continent}:`; }
            ranked = pick.slice(0, 8).map((p) => ({ p }));
          }
        }

        if (!alive) return;
        setGeo(label ? { name: label, lat: hit?.lat ?? 0, lng: hit?.lng ?? 0, tz: hit?.tz ?? null, country: hit?.country ?? null, admin1: hit?.admin1 ?? null } : null);
        setNearNote(note);
        setNear(ranked); setNearBusy(false);
      } catch { if (alive) { setNear([]); setNearBusy(false); } }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, q, kind]);

  const loadMore = () => {
    if (!items || loadingMore) return;
    setLoadingMore(true);
    fetch(api(`/places?${buildQs(items.length)}`))
      .then((r) => r.json())
      .then((j) => setItems((prev) => [...(prev || []), ...(j.items || [])]))
      .finally(() => setLoadingMore(false));
  };

  const continents = useMemo(() => (facets?.continents || []).map((c) => c.id), [facets]);
  const countries = useMemo(() => {
    if (cont === "all" || !facets) return [];
    return (facets.continents.find((c) => c.id === cont)?.countries || []);
  }, [facets, cont]);

  const title = kind === "restaurant" ? "Рестораны ИСККОН" : "Центры ИСККОН";
  const sub = kind === "restaurant"
    ? "Кафе и рестораны Говинды по всему миру — освящённая вегетарианская кухня. Каталог живёт в нашей базе и собирается из официального справочника общества."
    : "Храмы, центры, общины и фермы Международного общества сознания Кришны по всему миру. Каталог живёт в нашей базе и собирается из официального справочника общества.";

  return (
    <div>
      <div style={{ padding: "20px 0 0" }}>
        <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLD }}>Каталог</div>
        <h2 style={{ margin: "5px 0 0", fontFamily: "var(--font-display)", fontSize: "var(--text-title2)", fontWeight: 800, letterSpacing: "-0.022em", lineHeight: 1.1, color: "var(--color-label)" }}>{title}</h2>
        <p style={{ margin: "8px 0 0", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", lineHeight: 1.5, color: "var(--color-label-2)" }}>{sub}</p>
      </div>

      {/* ЗКН-Н006: Tier-2 континенты */}
      {/* Tier-2: континенты */}
      <NavFilterChips sticky ariaLabel="Континенты"
        items={[{ id: "all", label: "Все" }, ...continents.map((c) => ({ id: c, label: c }))]}
        active={cont} onChange={setCont} />

      {/* ЗКН-Н006: Tier-3 страны — общий FilterChips (контур) */}
      {cont !== "all" && countries.length > 1 && (
        <NavFilterChips ariaLabel="Страны"
          items={[{ id: "all", label: "Все" }, ...countries.map((c) => ({ id: c.id, label: c.ru, count: c.n }))]}
          active={ctry} onChange={setCtry} />
      )}

      {/* ЗКН-Н006: поиск идёт ПОД навигацией, а не между её уровнями */}
      {/* поиск — липкий к верху (как в календаре), над фильтрами */}
      <div ref={(el) => { sRef.current = el; if (el) setSH(el.offsetHeight); }}
        style={{ position: "sticky", top: stickyTop, zIndex: 18, marginTop: 14, paddingBottom: 10, background: "var(--color-bg)" }}>
        <div role="search" style={{ position: "relative" }}>
          <span aria-hidden style={{ position: "absolute", left: 13, top: 0, bottom: 0, display: "grid", placeItems: "center", color: "var(--color-label-3)", pointerEvents: "none" }}>
            <svg width="17" height="17" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="m20 20-3.4-3.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </span>
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={kind === "restaurant" ? "Город, страна или название" : "Город, страна или название центра"}
            inputMode="search" autoComplete="off" autoCorrect="off" spellCheck={false} aria-label="Поиск по каталогу"
            style={{ width: "100%", boxSizing: "border-box", padding: "12px 38px", borderRadius: 14, border: "none",
              background: "var(--color-glass-thin)", fontFamily: "var(--font-text)", fontSize: "var(--text-callout)", color: "var(--color-label)", outline: "none", WebkitAppearance: "none" }} />
          {q && (
            <button type="button" aria-label="Очистить" onClick={() => setQ("")}
              style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", width: 26, height: 26, borderRadius: "50%", border: "none",
                background: "var(--color-glass-regular)", color: "var(--color-label-2)", cursor: "pointer", display: "grid", placeItems: "center", WebkitTapHighlightColor: "transparent" }}>
              <svg width="12" height="12" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
            </button>
          )}
        </div>
      </div>

      {/* результаты */}
      <div style={{ marginTop: 14 }} aria-live="polite">
        {err && (
          <div style={{ padding: "30px 10px", textAlign: "center", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", lineHeight: 1.55, color: "var(--color-label-3)" }}>
            Каталог обновляется. Попробуйте позже —<br />данные загружаются из нашей базы.
          </div>
        )}
        {!err && !items && (
          <div style={{ display: "grid", gap: 12 }}>
            {[0, 1, 2].map((i) => <div key={i} style={{ height: 150, ...fill, opacity: 0.6 }} />)}
          </div>
        )}
        {items && (
          <>
            {items.length > 0 && (
              <div style={{ margin: "0 2px 10px", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", color: "var(--color-label-3)" }}>
                {total} {kind === "restaurant" ? "ресторанов" : "центров"}
              </div>
            )}
            {items.length === 0 ? (
              nearBusy ? (
                <div style={{ padding: "22px 8px", textAlign: "center", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", lineHeight: 1.55, color: "var(--color-label-3)" }}>
                  Ищем ближайшие {kind === "restaurant" ? "рестораны" : "центры"}…
                </div>
              ) : near && near.length > 0 ? (
                <>
                  <div style={{ margin: "0 2px 12px", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", lineHeight: 1.5, color: "var(--color-label-2)" }}>
                    {geo ? `В «${geo.name}» ${kind === "restaurant" ? "ресторанов" : "центров"} нет — ${nearNote || "вот ближайшие:"}` : "Ближайшие:"}
                  </div>
                  <div style={{ display: "grid", gap: 12 }}>
                    {near.map(({ p, km }) => <PlaceCard flash={flash} key={p.id + p.source} p={p} onOpen={setOpen} dist={km} />)}
                  </div>
                </>
              ) : (
                <div style={{ padding: "26px 8px", textAlign: "center", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", lineHeight: 1.55, color: "var(--color-label-3)" }}>
                  Ничего не найдено{q.trim() ? <> по запросу «{q.trim()}»</> : ""}.
                </div>
              )
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {items.map((p) => <PlaceCard flash={flash} key={p.id + p.source} p={p} onOpen={setOpen} />)}
              </div>
            )}
            {items.length < total && (
              <button type="button" onClick={loadMore} disabled={loadingMore}
                onPointerDown={(e) => (e.currentTarget.style.opacity = "0.6")} onPointerUp={(e) => (e.currentTarget.style.opacity = "1")} onPointerLeave={(e) => (e.currentTarget.style.opacity = "1")}
                style={{ marginTop: 14, width: "100%", padding: "13px 0", borderRadius: 14, border: "none", background: "var(--color-glass-regular)",
                  fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: 600, color: "var(--color-label)", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                {loadingMore ? "Загружаем…" : `Показать ещё ${Math.min(30, total - items.length)}`}
              </button>
            )}
          </>
        )}
      </div>

      <PlaceSheet flash={flash} p={open} onClose={() => setOpen(null)} />
    </div>
  );
}
