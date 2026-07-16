/**
 * DhamaDetailPage — страница одной дхамы. Hero (фото/градиент) + sticky-навбар,
 * затем sub-tabs (Места · Карта · О дхаме):
 *   • Места  — тиртхи, сгруппированные по кластерам (районам парикрамы);
 *   • Карта  — интерактивная карта со всеми местами;
 *   • О дхаме — вводные тексты и ключевые факты.
 * Тап по месту → страница тиртхи.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { BackIcon, HeartIcon, MoreIcon } from "../ui/icons";
import { SectionSubTabs } from "../SectionSubTabs";
import DhamaMap from "./DhamaMap";
import { KIND_RU, mapsDir, tirthaCtx, type Dhama, type Tirtha } from "./dhamas";
import { CardActionBtns, favMetaFromCtx, useCardActions, useFavorite } from "../cardActions";
import { DhamaHeroCard, dhamaMapsHref } from "./DhamaHeroCard";
import { BookMenuSheet } from "../BookMenuSheet";
import { QrSheet } from "../QrSheet";
import { requestNote } from "../notes";
import { NotesAtSource } from "../NotesAtSource";
import { FilterChips as NavFilterChips } from "../ui/nav4";
import { plural } from "../ui/primitives";   // ЗКН-Д002: одна функция, не копия

const NAV_H = 52;

const navBtn = (active: boolean): CSSProperties => ({ display: "grid", height: 44, width: 44, placeItems: "center", borderRadius: "50%", border: "none", background: "none", color: active ? "var(--color-red)" : "var(--color-label)", cursor: "pointer", WebkitTapHighlightColor: "transparent" });

const PinIconNav = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={{ display: "block" }}>
    <g fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s6-5.3 6-10a6 6 0 1 0-12 0c0 4.7 6 10 6 10Z" /><circle cx="12" cy="11" r="2.2" />
    </g>
  </svg>
);

function KindIcon({ kind, size = 13 }: { kind: Tirtha["kind"]; size?: number }) {
  let inner: ReactNode;
  switch (kind) {
    case "temple": inner = <path d="M3 21h18 M6 21V10 M12 21V10 M18 21V10 M4 10h16 M3 10 12 4 21 10" />; break;
    case "kunda": inner = <><ellipse cx="12" cy="13" rx="8" ry="4.5" /><path d="M9 12.5q1.5 -1.4 3 0 t3 0" /></>; break;
    case "ghat": inner = <><path d="M5 8h5v3h4v3h5" /><path d="M5 19q2 -1.5 4 0 t4 0 t4 0" /></>; break;
    case "forest": inner = <><path d="M12 3 5.5 13h13L12 3Z" /><path d="M12 13v6 M9 19h6" /></>; break;
    case "hill": inner = <path d="M3 19 9 8l4 6 3.5 -5L21 19Z" />; break;
    case "river": inner = <><path d="M3 9q3 -3 6 0 t6 0 t6 0" /><path d="M3 15q3 -3 6 0 t6 0 t6 0" /></>; break;
    case "samadhi": inner = <><path d="M6 12c0 -3.6 2.7 -6.5 6 -6.5s6 2.9 6 6.5" /><path d="M6 12v9 M18 12v9 M4 21h16 M12 5.5V3" /></>; break;
    case "village": inner = <><path d="M5 21V11l7 -6 7 6v10Z" /><path d="M10 21v-6h4v6" /></>; break;
    case "island": inner = <><path d="M5.5 16q6.5 -9 13 0" /><path d="M3 20q3 -2 6 0 t6 0 t6 0" /></>; break;
    default: inner = <><path d="M12 21s6 -5.3 6 -10a6 6 0 1 0 -12 0c0 4.7 6 10 6 10Z" /><circle cx="12" cy="11" r="2" /></>;
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={{ display: "block", flexShrink: 0 }}>
      <g stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">{inner}</g>
    </svg>
  );
}

function KindChip({ d, kind }: { d: Dhama; kind: Tirtha["kind"] }) {
  return (
    <span style={{ flexShrink: 0, alignSelf: "center", display: "inline-flex", alignItems: "center", gap: "var(--space-1)", padding: "3px 9px 3px 7px", borderRadius: "var(--radius-pill)", fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: "var(--weight-semibold)", letterSpacing: "0.1px",
      color: d.accent, background: `color-mix(in srgb, ${d.accent} 13%, transparent)`, border: `0.5px solid color-mix(in srgb, ${d.accent} 38%, transparent)` }}>
      <KindIcon kind={kind} size={12} />
      {KIND_RU[kind]}
    </span>
  );
}

/** Стрелка-навигатор для кнопки прокладки маршрута. */
function NavArrowIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden style={{ display: "block" }}>
      <path d="M12 2 4.6 20.3a.7.7 0 0 0 .98.84L12 18l6.42 3.14a.7.7 0 0 0 .98-.84L12 2z" />
    </svg>
  );
}

function openDir(t: Tirtha) {
  try { window.open(mapsDir(t), "_blank", "noopener"); } catch { /* noop */ }
}

function TirthaRow({ d, t, onOpen }: { d: Dhama; t: Tirtha; onOpen: (id: string) => void }) {
  const { openCardMenu } = useCardActions();
  return (
    <div role="button" tabIndex={0} className="tap-row" onClick={() => onOpen(t.id)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(t.id); } }}
      style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", width: "100%", textAlign: "left", padding: "var(--space-3) var(--space-1)", background: "transparent",
        borderBottom: "0.5px solid var(--color-hairline)", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-body)", fontWeight: "var(--weight-bold)", letterSpacing: "-0.2px", color: "var(--color-label)" }}>{t.name}</span>
          <KindChip d={d} kind={t.kind} />
        </span>
        {t.iast && <span style={{ display: "block", marginTop: 1, fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: "var(--text-footnote)", color: "var(--color-label-3)" }}>{t.iast}</span>}
        <span style={{ display: "block", marginTop: "var(--space-1)", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", lineHeight: "var(--leading-snug)", color: "var(--color-label-2)" }}>{t.blurb}</span>
      </span>
      <CardActionBtns plain favKey={`tirtha:${t.id}`} meta={favMetaFromCtx(tirthaCtx(d.id, t))} size={34} onMore={() => openCardMenu(tirthaCtx(d.id, t))} />
    </div>
  );
}

/* ── Остановка парикрамы: нумерованная точка маршрута с таймлайн-линией ── */
function ParikramaStop({ d, t, n, lastInGroup, onOpen }: { d: Dhama; t: Tirtha; n: number; lastInGroup: boolean; onOpen: (id: string) => void }) {
  const { openCardMenu } = useCardActions();
  return (
    <div role="button" tabIndex={0} className="tap-row" onClick={() => onOpen(t.id)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(t.id); } }}
      style={{ display: "flex", alignItems: "stretch", gap: "var(--space-3)", width: "100%", textAlign: "left", padding: "var(--space-3) var(--space-1)", background: "transparent",
        cursor: "pointer", WebkitTapHighlightColor: "transparent", borderRadius: "var(--radius-sm)" }}>
      <div style={{ position: "relative", width: 28, flexShrink: 0 }}>
        {!lastInGroup && <span aria-hidden style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", top: 28, bottom: -12, width: 2, background: `color-mix(in srgb, ${d.accent} 26%, transparent)` }} />}
        <span style={{ position: "relative", zIndex: 1, display: "grid", placeItems: "center", width: 28, height: 28, borderRadius: "50%", background: d.accent, color: "#fff", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: "var(--weight-bold)" }}>{n}</span>
      </div>
      <span style={{ minWidth: 0, flex: 1, paddingBottom: "var(--space-1)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-callout)", fontWeight: "var(--weight-bold)", letterSpacing: "-0.2px", color: "var(--color-label)" }}>{t.name}</span>
          <KindChip d={d} kind={t.kind} />
        </span>
        <span style={{ display: "block", marginTop: 3, fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", lineHeight: "var(--leading-snug)", color: "var(--color-label-2)" }}>{t.blurb}</span>
      </span>
      <span style={{ alignSelf: "center", display: "flex", alignItems: "center", gap: 6 }}>
        <button aria-label="Проложить маршрут" title="Проложить маршрут в Google Maps" className="tap-press"
          onClick={(e) => { e.stopPropagation(); openDir(t); }}
          style={{ display: "grid", placeItems: "center", width: 36, height: 36, borderRadius: "50%", border: `1px solid color-mix(in srgb, ${d.accent} 55%, transparent)`, background: `color-mix(in srgb, ${d.accent} 8%, transparent)`, color: d.accent, cursor: "pointer", flexShrink: 0, WebkitTapHighlightColor: "transparent" }}>
          <NavArrowIcon size={16} />
        </button>
        <CardActionBtns plain favKey={`tirtha:${t.id}`} meta={favMetaFromCtx(tirthaCtx(d.id, t))} size={34} onMore={() => openCardMenu(tirthaCtx(d.id, t))} />
      </span>
    </div>
  );
}

const KIND_PL: Record<string, [string, string, string]> = {
  temple: ["храм", "храма", "храмов"],
  kunda: ["кунда", "кунды", "кунд"],
  ghat: ["гхат", "гхата", "гхатов"],
  forest: ["лес", "леса", "лесов"],
  hill: ["холм", "холма", "холмов"],
  river: ["река", "реки", "рек"],
  samadhi: ["самадхи", "самадхи", "самадхи"],
  village: ["деревня", "деревни", "деревень"],
  place: ["место", "места", "мест"],
  island: ["остров", "острова", "островов"],
};
const KIND_ORDER = ["temple", "kunda", "ghat", "forest", "hill", "river", "samadhi", "village", "place", "island"];

export default function DhamaDetailPage({ dhama, onBack, onOpenTirtha }: { dhama: Dhama; onBack: () => void; onOpenTirtha: (id: string) => void }) {
  const [sub, setSub] = useState<"places" | "parikrama" | "map" | "about">("places");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [qr, setQr] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const moreRef = useRef<HTMLSpanElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const [navSolid, setNavSolid] = useState(false);
  const { on: favorited, toggle: toggleFav } = useFavorite(`dhama:${dhama.id}`, { t: dhama.name, s: dhama.tagline, h: `/dhama/${dhama.id}` });
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = (m: string) => { setToast(m); if (toastTimer.current) clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 1800); };
  const onMenu = (id: string) => {
    if (id === "share") {
      const url = `${window.location.origin}/dhama/${dhama.id}`;
      const nav = window.navigator as Navigator & { share?: (d: { title: string; url: string }) => Promise<void> };
      if (nav.share) void nav.share({ title: dhama.name, url }).catch(() => undefined);
      else { try { void window.navigator.clipboard?.writeText(url); flash("Ссылка скопирована"); } catch { flash(url); } }
    } else if (id === "qr") setQr(true);
    else if (id === "route") { try { window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dhama.name + " " + dhama.region)}`, "_blank", "noopener"); } catch { /* noop */ } }
    else if (id === "note") requestNote({ kind: "place", ref: dhama.id, title: dhama.name, subtitle: dhama.region, href: `/dhama/${dhama.id}` });
    else if (id === "report") flash("Спасибо! Передадим редакции.");
  };

  // сброс позиции при смене вкладки на карту/о дхаме нежелателен; сбрасываем при входе
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [dhama.id]);
  // iOS large-title: имя в шапке проявляется, когда герой ушёл под навбар.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const h = heroRef.current;
        const trig = h ? h.offsetHeight - NAV_H - 8 : 240;
        setNavSolid(el.scrollTop > trig);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => { el.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [dhama.id]);

  const byCluster = dhama.clusters
    .map((c) => ({ cluster: c, items: dhama.tirthas.filter((t) => t.cluster === c.id) }))
    .filter((g) => g.items.length > 0);

  const kindCounts: Record<string, number> = {};
  for (const t of dhama.tirthas) kindCounts[t.kind] = (kindCounts[t.kind] || 0) + 1;
  const breakdown = KIND_ORDER.filter((k) => kindCounts[k]).map((k) => ({ k, n: kindCounts[k] }));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", minHeight: 0, background: "var(--color-bg)" }}>
      {/* sticky навбар — iOS 26 Liquid Glass */}
      <header className={navSolid ? "glass-nav glass-nav-edge" : "glass-nav"} style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 30, height: NAV_H, display: "flex", alignItems: "center", gap: "var(--space-1)", padding: "0 6px" }}>
        <button aria-label="Назад" onClick={onBack} style={navBtn(false)}>
          <BackIcon size={24} />
        </button>
        <div style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-headline)", fontWeight: "var(--weight-semibold)", letterSpacing: "var(--tracking-tight)", color: "var(--color-label)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", opacity: navSolid ? 1 : 0, transform: navSolid ? "none" : "translateY(3px)", transition: "opacity var(--duration-base) var(--ease-standard), transform var(--duration-base) var(--ease-standard)", pointerEvents: "none" }}>{dhama.name}</div>
        <div data-pdf-no-print style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          <button aria-label="В избранное" onClick={() => toggleFav(flash)} style={navBtn(favorited)}><HeartIcon size={22} filled={favorited} /></button>
          <button aria-label="Открыть в картах" onClick={() => { try { window.open(dhamaMapsHref(dhama), "_blank", "noopener"); } catch { /* noop */ } }} style={navBtn(false)}><PinIconNav size={22} /></button>
          <span ref={moreRef} style={{ display: "inline-flex" }}><button aria-label="Ещё" onClick={() => setMenuOpen(true)} style={navBtn(false)}><MoreIcon size={20} /></button></span>
        </div>
      </header>

      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        {/* hero (ПКП) */}
        <div ref={heroRef} style={{ padding: "16px 16px 0" }}>
          <DhamaHeroCard dhama={dhama} presentational onMenuSelect={onMenu} flash={flash} />
        </div>

        <div style={{ padding: "12px 16px 0" }}>
          <NotesAtSource kind="place" refId={dhama.id} accent={dhama.accent} />
        </div>

        {/* sub-tabs */}
        {/* ЗКН-Н016: общий FilterChips (контур), а не чёрные капсулы */}
        <NavFilterChips ariaLabel="Разделы дхамы"
          items={[{ id: "places", label: "Места" }, { id: "parikrama", label: "Парикрама" }, { id: "map", label: "Карта" }]}
          active={sub} onChange={(id) => setSub(id as typeof sub)} />

        <div style={{ padding: "10px 16px calc(env(safe-area-inset-bottom,0px) + 64px)" }}>
          {sub === "places" && (
            <div>
              <div style={{ marginTop: "var(--space-2)", padding: "var(--space-3) var(--space-4)", borderRadius: "var(--radius-lg)", border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)" }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-subhead)", fontWeight: "var(--weight-bold)", letterSpacing: "-0.2px", color: "var(--color-label)" }}>
                  {dhama.tirthas.length} {plural(dhama.tirthas.length, "святое место", "святых места", "святых мест")} · {byCluster.length} {plural(byCluster.length, "район", "района", "районов")} парикрамы
                </div>
                {breakdown.length > 0 && (
                  <div style={{ marginTop: 9, display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {breakdown.map(({ k, n }) => (
                      <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 5, borderRadius: "var(--radius-pill)", border: "0.5px solid var(--color-hairline)", background: "var(--color-bg)", height: 26, padding: "0 11px 0 9px", fontFamily: "var(--font-text)", fontSize: "var(--text-caption)", color: "var(--color-label-2)" }}>
                        <KindIcon kind={k as Tirtha["kind"]} size={12} /><b style={{ fontWeight: "var(--weight-bold)", color: "var(--color-label)" }}>{n}</b> {plural(n, KIND_PL[k][0], KIND_PL[k][1], KIND_PL[k][2])}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {byCluster.map(({ cluster, items }) => (
                <section key={cluster.id} style={{ marginTop: 18 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)", margin: "0 0 2px" }}>
                    <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-title3)", fontWeight: "var(--weight-bold)", letterSpacing: "-0.3px", color: "var(--color-label)" }}>{cluster.title}</h3>
                    <span style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption)", fontWeight: "var(--weight-semibold)", color: "var(--color-label-3)", flexShrink: 0 }}>{items.length}</span>
                  </div>
                  {cluster.note && <p style={{ margin: "0 0 6px", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", color: "var(--color-label-3)", lineHeight: "var(--leading-snug)" }}>{cluster.note}</p>}
                  <div>
                    {items.map((t) => <TirthaRow key={t.id} d={dhama} t={t} onOpen={onOpenTirtha} />)}
                  </div>
                </section>
              ))}
            </div>
          )}

          {sub === "parikrama" && (() => {
            const route = byCluster.flatMap((g) => g.items);
            let offset = 0;
            const groups = byCluster.map((g) => { const start = offset; offset += g.items.length; return { ...g, start }; });
            return (
              <div style={{ marginTop: 14 }}>
                <p style={{ margin: "0 2px 12px", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", color: "var(--color-label-2)", lineHeight: "var(--leading-normal)" }}>
                  Рекомендуемый маршрут по святым местам — {route.length} {plural(route.length, "остановка", "остановки", "остановок")}, сгруппированы по районам. Двигайтесь по порядку или коснитесь номера на карте.
                </p>
                <DhamaMap dhama={dhama} stops={route} ordered onOpen={onOpenTirtha} />
                <div style={{ marginTop: 18 }}>
                  {groups.map((g) => (
                    <section key={g.cluster.id} style={{ marginTop: "var(--space-4)" }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)", marginBottom: "var(--space-1)" }}>
                        <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-title3)", fontWeight: "var(--weight-bold)", letterSpacing: "-0.3px", color: "var(--color-label)" }}>{g.cluster.title}</h3>
                        <span style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption)", fontWeight: "var(--weight-semibold)", color: dhama.accent }}>
                          {g.items.length > 1 ? `${g.start + 1}–${g.start + g.items.length}` : `${g.start + 1}`}
                        </span>
                      </div>
                      {g.cluster.note && <p style={{ margin: "0 0 6px", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", color: "var(--color-label-3)", lineHeight: "var(--leading-snug)" }}>{g.cluster.note}</p>}
                      <div>
                        {g.items.map((t, i) => <ParikramaStop key={t.id} d={dhama} t={t} n={g.start + i + 1} lastInGroup={i === g.items.length - 1} onOpen={onOpenTirtha} />)}
                      </div>
                    </section>
                  ))}
                </div>
                <p style={{ margin: "20px 2px 0", fontFamily: "var(--font-text)", fontSize: "var(--text-caption)", color: "var(--color-label-3)", lineHeight: "var(--leading-normal)" }}>
                  Места сгруппированы по районам в порядке парикрамы. У части мест координаты приблизительны или будут добавлены позже — их можно открыть в списке и проложить маршрут по названию.
                </p>
              </div>
            );
          })()}

          {sub === "map" && (
            <div style={{ marginTop: 14 }}>
              <DhamaMap dhama={dhama} onOpen={onOpenTirtha} />
              <p style={{ margin: "10px 2px 0", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", color: "var(--color-label-3)", lineHeight: "var(--leading-normal)" }}>
                {dhama.tirthas.length} {plural(dhama.tirthas.length, "место", "места", "мест")} на карте. Коснитесь метки, чтобы открыть тиртху. Координаты приблизительны.
              </p>
            </div>
          )}

          {sub === "about" && (
            <div style={{ marginTop: "var(--space-4)" }}>
              {dhama.intro.map((p, i) => (
                <p key={i} style={{ margin: i === 0 ? 0 : "var(--space-4) 0 0", fontFamily: "var(--font-text)", fontSize: "var(--text-body)", lineHeight: "var(--leading-normal)", color: "var(--color-label)" }}>{p}</p>
              ))}
              <div style={{ marginTop: 22, borderRadius: "var(--radius-lg)", border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)", overflow: "hidden" }}>
                {dhama.facts.map((f, i) => (
                  <div key={i} style={{ display: "flex", gap: "var(--space-3)", padding: "var(--space-3) var(--space-4)", borderBottom: i === dhama.facts.length - 1 ? "none" : "0.5px solid var(--color-hairline)" }}>
                    <span style={{ flexShrink: 0, width: 116, fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", color: "var(--color-label-3)" }}>{f.k}</span>
                    <span style={{ flex: 1, fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: "var(--weight-medium)", color: "var(--color-label)" }}>{f.v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {qr && typeof window !== "undefined" && (
        <QrSheet url={`${window.location.origin}/dhama/${dhama.id}`} data={{ kind: "card", title: dhama.name, subtitle: dhama.region }} onClose={() => setQr(false)} />
      )}
      <BookMenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} onSelect={(id) => onMenu(id)} anchorRef={moreRef} variant="center" centerCanManage={false} centerHasMaps />
      {toast && <div style={{ position: "fixed", left: "50%", bottom: "calc(40px + env(safe-area-inset-bottom,0px))", transform: "translateX(-50%)", zIndex: 90, padding: "11px 18px", borderRadius: "var(--radius-pill)", maxWidth: "86vw", textAlign: "center", background: "var(--color-label)", color: "var(--color-bg)", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: "var(--weight-medium)", boxShadow: "var(--shadow-card)" }}>{toast}</div>}
    </div>
  );
}

