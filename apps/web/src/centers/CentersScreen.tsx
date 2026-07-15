/**
 * CentersScreen — публичный локатор Ятры: витрина центров карточками
 * CenterHeroCard (ВКП). Поиск + фильтр по типу (сервер: /centers?q&type), тап
 * по карточке → подробная карточка /center/:slug. ⋯ на витрине держит быстрые
 * действия; тяжёлые уводят на ПКП.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { centersClient, CENTER_TYPE_LABEL, type CenterListItem, type CenterType } from "./api";
import { CenterHeroCard, centerMapsHref } from "./CenterHeroCard";
import CentersMap from "./CentersMap";
import { requestNote } from "../notes";

const GOLD = "var(--color-gold)";
const L1 = "var(--color-label)";
const L2 = "var(--color-label-2)";
const L3 = "var(--color-label-3)";
const HAIR = "var(--color-hairline)";
const FILL = "var(--color-glass-thin)";
const FT = "var(--font-text)";
const FD = "var(--font-display)";

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const Back = () => <svg width={24} height={24} viewBox="0 0 24 24" aria-hidden><path {...STROKE} d="M15 5l-7 7 7 7" /></svg>;

const TYPES: { id: CenterType | "all"; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "temple", label: "Храмы" },
  { id: "namahatta", label: "Нама-хатты" },
  { id: "restaurant", label: "Рестораны" },
  { id: "farm", label: "Фермы" },
  { id: "preaching_center", label: "Проповедь" },
];

export default function CentersScreen({ onBack, onOpenPath }: { onBack: () => void; onOpenPath: (p: string) => void }) {
  const PAGE = 80;
  const [q, setQ] = useState("");
  const [type, setType] = useState<CenterType | "all">("all");
  const [view, setView] = useState<"list" | "map">("list");
  const [items, setItems] = useState<CenterListItem[]>([]);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const reqId = useRef(0);

  // карта: отдельная, более широкая выборка (пины лёгкие — можно больше, чем карточек)
  const MAP_LIMIT = 600;
  const [mapItems, setMapItems] = useState<CenterListItem[]>([]);
  const [mapPhase, setMapPhase] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const mapReqId = useRef(0);

  // Первая страница: смена запроса/типа сбрасывает выборку и офсет.
  useEffect(() => {
    const id = ++reqId.current;
    const t = setTimeout(() => {
      setPhase((p) => (p === "ready" ? "ready" : "loading"));
      centersClient
        .list({ q: q.trim() || undefined, type: type === "all" ? undefined : type, limit: PAGE, offset: 0 })
        .then((r) => { if (id === reqId.current) { setItems(r.items); setMore(r.items.length >= PAGE); setPhase("ready"); } })
        .catch(() => { if (id === reqId.current) setPhase("error"); });
    }, q ? 280 : 0);
    return () => clearTimeout(t);
  }, [q, type]);

  // «Показать ещё» — дозагрузка следующей страницы поверх текущей (ЗКН-Пл017:
  // каталог из ~960 центров должен листаться целиком, а не обрываться на 80).
  const loadMore = () => {
    if (loadingMore) return;
    const id = reqId.current;
    setLoadingMore(true);
    centersClient
      .list({ q: q.trim() || undefined, type: type === "all" ? undefined : type, limit: PAGE, offset: items.length })
      .then((r) => {
        if (id !== reqId.current) return;
        setItems((prev) => [...prev, ...r.items]);
        setMore(r.items.length >= PAGE);
      })
      .catch(() => { /* мягко: кнопка останется — можно повторить */ })
      .finally(() => { if (id === reqId.current) setLoadingMore(false); });
  };

  // подгружаем выборку для карты лениво — при первом открытии и смене фильтра
  useEffect(() => {
    if (view !== "map") return;
    const id = ++mapReqId.current;
    const t = setTimeout(() => {
      setMapPhase((p) => (p === "ready" ? "ready" : "loading"));
      centersClient
        .list({ q: q.trim() || undefined, type: type === "all" ? undefined : type, limit: MAP_LIMIT })
        .then((r) => { if (id === mapReqId.current) { setMapItems(r.items); setMapPhase("ready"); } })
        .catch(() => { if (id === mapReqId.current) setMapPhase("error"); });
    }, q ? 280 : 0);
    return () => clearTimeout(t);
  }, [view, q, type]);

  const onMenu = (it: CenterListItem) => (id: string) => {
    const url = (typeof window !== "undefined" ? window.location.origin : "https://gaurangers.com") + "/iskcon/centers/" + it.slug;
    const place = [it.city, it.country].filter(Boolean).join(", ");
    if (id === "share") {
      const nav = typeof navigator !== "undefined" ? navigator : null;
      if (nav?.share) void nav.share({ title: it.name, url }).catch(() => undefined);
      else { try { void nav?.clipboard?.writeText(url); } catch { /* noop */ } }
    } else if (id === "route") {
      const h = centerMapsHref(it); if (h) { try { window.open(h, "_blank", "noopener"); } catch { /* noop */ } }
    } else if (id === "note") {
      requestNote({ kind: "centre", ref: it.id, title: it.name, subtitle: place || CENTER_TYPE_LABEL[it.type], href: `/iskcon/centers/${it.slug}` });
    } else {
      onOpenPath(`/iskcon/centers/${it.slug}`);
    }
  };

  const navStyle: CSSProperties = {
    position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "center", gap: 4, height: 52, padding: "0 6px",
    background: "color-mix(in srgb, var(--color-bg) 82%, transparent)", backdropFilter: "saturate(180%) blur(20px)", WebkitBackdropFilter: "saturate(180%) blur(20px)",
    borderBottom: `0.5px solid ${HAIR}`,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "var(--color-bg)", fontFamily: FT }}>
      <header style={navStyle}>
        <button type="button" aria-label="Назад" onClick={onBack} style={{ display: "grid", height: 38, width: 38, placeItems: "center", borderRadius: "50%", border: "none", background: "none", color: L1, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}><Back /></button>
        <div style={{ flex: 1, textAlign: "center", fontFamily: FD, fontSize: "var(--text-callout)", fontWeight: 700, letterSpacing: "-0.02em", color: L1 }}>Ятра · Центры</div>
        <span style={{ width: 38 }} />
      </header>

      <div style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 0 calc(40px + env(safe-area-inset-bottom,0px))" }}>
          {/* поиск */}
          <div style={{ padding: "12px 16px 8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, height: 40, padding: "0 12px", borderRadius: 12, background: "rgba(120,120,128,0.12)" }}>
              <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden style={{ color: L3, flexShrink: 0 }}><circle {...STROKE} cx="11" cy="11" r="7" /><path {...STROKE} d="m20 20-3.2-3.2" /></svg>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Город, страна, название" inputMode="search"
                style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontFamily: FT, fontSize: "var(--text-subhead)", color: L1 }} />
              {q && <button type="button" aria-label="Очистить" onClick={() => setQ("")} style={{ border: "none", background: "none", color: L3, cursor: "pointer", padding: 2, display: "grid", placeItems: "center" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="9" fill="rgba(120,120,128,0.45)" /><path d="M9 9l6 6M15 9l-6 6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" /></svg>
              </button>}
            </div>
          </div>

          {/* типы */}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "4px 16px 10px", scrollbarWidth: "none" }}>
            {TYPES.map((t) => {
              const on = type === t.id;
              return (
                <button key={t.id} type="button" onClick={() => setType(t.id)}
                  style={{ flexShrink: 0, height: 34, padding: "0 14px", borderRadius: 999, border: on ? "none" : `0.5px solid ${HAIR}`, cursor: "pointer", fontFamily: FT, fontSize: "var(--text-footnote)", fontWeight: 600, letterSpacing: "-0.01em", background: on ? L1 : FILL, color: on ? "var(--color-bg-2, #fff)" : L2, WebkitTapHighlightColor: "transparent" }}>{t.label}</button>
              );
            })}
          </div>

          {/* вид: список / карта */}
          <div style={{ padding: "0 16px 6px" }}>
            <div style={{ display: "inline-flex", padding: 3, borderRadius: 11, background: "rgba(120,120,128,0.12)", gap: 2 }}>
              {([["list", "Список"], ["map", "Карта"]] as const).map(([id, label]) => {
                const on = view === id;
                return (
                  <button key={id} type="button" onClick={() => setView(id)}
                    style={{ height: 30, padding: "0 18px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: FT, fontSize: "var(--text-footnote)", fontWeight: 600,
                      background: on ? "var(--color-bg)" : "transparent", color: on ? L1 : L2, boxShadow: on ? "0 1px 3px rgba(0,0,0,0.12)" : "none", WebkitTapHighlightColor: "transparent" }}>{label}</button>
                );
              })}
            </div>
          </div>

          {/* результаты */}
          <div style={{ padding: "4px 16px" }}>
            {view === "map" ? (
              mapPhase === "loading" && mapItems.length === 0 ? (
                <div style={{ display: "grid", placeItems: "center", padding: "80px 0", color: L3 }}>
                  <span style={{ width: 26, height: 26, borderRadius: "50%", border: `2.5px solid ${HAIR}`, borderTopColor: GOLD, animation: "cenSpin .8s linear infinite" }} />
                  <style>{`@keyframes cenSpin{to{transform:rotate(360deg)}}`}</style>
                </div>
              ) : mapPhase === "error" ? (
                <div style={{ textAlign: "center", padding: "48px 20px", color: L2, fontFamily: FT, fontSize: "var(--text-subhead)" }}>Не удалось загрузить карту. Проверьте соединение.</div>
              ) : (
                <>
                  <div style={{ fontFamily: FT, fontSize: "var(--text-footnote)", color: L3, margin: "2px 2px 12px" }}>
                    {mapItems.filter((c) => c.lat != null && c.lng != null).length} на карте{mapItems.length >= MAP_LIMIT ? " · уточните поиск, чтобы увидеть все" : ""}. Коснитесь метки, чтобы открыть центр.
                  </div>
                  <CentersMap items={mapItems} onOpen={(slug) => onOpenPath(`/iskcon/centers/${slug}`)} />
                </>
              )
            ) : phase === "loading" ? (
              <div style={{ display: "grid", placeItems: "center", padding: "60px 0", color: L3 }}>
                <span style={{ width: 26, height: 26, borderRadius: "50%", border: `2.5px solid ${HAIR}`, borderTopColor: GOLD, animation: "cenSpin .8s linear infinite" }} />
                <style>{`@keyframes cenSpin{to{transform:rotate(360deg)}}`}</style>
              </div>
            ) : phase === "error" ? (
              <div style={{ textAlign: "center", padding: "48px 20px", color: L2, fontFamily: FT, fontSize: "var(--text-subhead)" }}>Не удалось загрузить. Проверьте соединение.</div>
            ) : items.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{ fontFamily: FD, fontSize: "var(--text-body)", fontWeight: 800, color: L1 }}>Ничего не найдено</div>
                <p style={{ margin: "8px auto 16px", maxWidth: 300, fontFamily: FT, fontSize: "var(--text-footnote)", lineHeight: 1.5, color: L2 }}>Попробуйте изменить запрос или добавьте свой центр в каталог Ятры.</p>
                <button type="button" onClick={() => onOpenPath("/my/centers/new")} style={{ height: 44, padding: "0 22px", borderRadius: 13, border: "none", background: GOLD, color: "#fff", fontFamily: FT, fontSize: "var(--text-subhead)", fontWeight: 700, cursor: "pointer" }}>Добавить центр</button>
              </div>
            ) : (
              <>
                <div style={{ fontFamily: FT, fontSize: "var(--text-footnote)", color: L3, margin: "2px 2px 12px" }}>{items.length} {items.length % 10 === 1 && items.length % 100 !== 11 ? "центр" : items.length % 10 >= 2 && items.length % 10 <= 4 && (items.length % 100 < 10 || items.length % 100 >= 20) ? "центра" : "центров"}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {items.map((it) => (
                    <CenterHeroCard key={it.id} center={it} onOpen={() => onOpenPath(`/iskcon/centers/${it.slug}`)} onMenuSelect={onMenu(it)} />
                  ))}
                </div>
                {more && (
                  <button type="button" onClick={loadMore} disabled={loadingMore}
                    style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16, padding: "13px 0", borderRadius: 14, border: `0.5px solid ${HAIR}`, background: FILL, color: L1, fontFamily: FT, fontSize: "var(--text-subhead)", fontWeight: 700, cursor: loadingMore ? "default" : "pointer", opacity: loadingMore ? 0.6 : 1, WebkitTapHighlightColor: "transparent" }}>
                    {loadingMore ? "Загрузка…" : "Показать ещё"}
                  </button>
                )}
                <button type="button" onClick={() => onOpenPath("/my/centers/new")} style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 18, padding: "13px 0", borderRadius: 14, border: `1px dashed ${GOLD}88`, background: "none", color: GOLD, fontFamily: FT, fontSize: "var(--text-subhead)", fontWeight: 700, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                  Добавить свой центр
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
