/**
 * DhamaDetailPage — страница одной дхамы. Hero (фото/градиент) + sticky-навбар,
 * затем sub-tabs (Места · Карта · О дхаме):
 *   • Места  — тиртхи, сгруппированные по кластерам (районам парикрамы);
 *   • Карта  — интерактивная карта со всеми местами;
 *   • О дхаме — вводные тексты и ключевые факты.
 * Тап по месту → страница тиртхи.
 */
import { useEffect, useRef, useState } from "react";
import { BackIcon } from "../ui/icons";
import { SectionSubTabs } from "../SectionSubTabs";
import DhamaMap from "./DhamaMap";
import { KIND_RU, dhamaCtx, tirthaCtx, type Dhama, type Tirtha } from "./dhamas";
import { CardActionBtns, favMetaFromCtx, useCardActions } from "../cardActions";

const NAV_H = 52;

function KindChip({ d, kind }: { d: Dhama; kind: Tirtha["kind"] }) {
  return (
    <span style={{ flexShrink: 0, alignSelf: "center", padding: "3px 9px", borderRadius: 999, fontFamily: "var(--font-text)", fontSize: 11, fontWeight: 600, letterSpacing: "0.1px",
      color: d.accent, background: `color-mix(in srgb, ${d.accent} 13%, transparent)`, border: `0.5px solid color-mix(in srgb, ${d.accent} 38%, transparent)` }}>
      {KIND_RU[kind]}
    </span>
  );
}

function TirthaRow({ d, t, onOpen }: { d: Dhama; t: Tirtha; onOpen: (id: string) => void }) {
  const { openCardMenu } = useCardActions();
  return (
    <div role="button" tabIndex={0} onClick={() => onOpen(t.id)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(t.id); } }}
      onPointerDown={(e) => (e.currentTarget.style.background = "var(--color-fill-1)")}
      onPointerUp={(e) => (e.currentTarget.style.background = "transparent")}
      onPointerLeave={(e) => (e.currentTarget.style.background = "transparent")}
      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", padding: "13px 4px", background: "transparent",
        borderBottom: "0.5px solid var(--color-hairline)", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, letterSpacing: "-0.2px", color: "var(--color-label)" }}>{t.name}</span>
          <KindChip d={d} kind={t.kind} />
        </span>
        {t.iast && <span style={{ display: "block", marginTop: 1, fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 13, color: "var(--color-label-3)" }}>{t.iast}</span>}
        <span style={{ display: "block", marginTop: 4, fontFamily: "var(--font-text)", fontSize: 14, lineHeight: 1.4, color: "var(--color-label-2)" }}>{t.blurb}</span>
      </span>
      <CardActionBtns favKey={`tirtha:${t.id}`} meta={favMetaFromCtx(tirthaCtx(d.id, t))} size={28} onMore={() => openCardMenu(tirthaCtx(d.id, t))} />
    </div>
  );
}

/* ── Остановка парикрамы: нумерованная точка маршрута с таймлайн-линией ── */
function ParikramaStop({ d, t, n, lastInGroup, onOpen }: { d: Dhama; t: Tirtha; n: number; lastInGroup: boolean; onOpen: (id: string) => void }) {
  const { openCardMenu } = useCardActions();
  return (
    <div role="button" tabIndex={0} onClick={() => onOpen(t.id)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(t.id); } }}
      onPointerDown={(e) => (e.currentTarget.style.background = "var(--color-fill-1)")}
      onPointerUp={(e) => (e.currentTarget.style.background = "transparent")}
      onPointerLeave={(e) => (e.currentTarget.style.background = "transparent")}
      style={{ display: "flex", alignItems: "stretch", gap: 12, width: "100%", textAlign: "left", padding: "10px 4px", background: "transparent",
        cursor: "pointer", WebkitTapHighlightColor: "transparent", borderRadius: 10 }}>
      <div style={{ position: "relative", width: 28, flexShrink: 0 }}>
        {!lastInGroup && <span aria-hidden style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", top: 28, bottom: -12, width: 2, background: `color-mix(in srgb, ${d.accent} 26%, transparent)` }} />}
        <span style={{ position: "relative", zIndex: 1, display: "grid", placeItems: "center", width: 28, height: 28, borderRadius: "50%", background: d.accent, color: "#fff", fontFamily: "var(--font-text)", fontSize: 13, fontWeight: 700 }}>{n}</span>
      </div>
      <span style={{ minWidth: 0, flex: 1, paddingBottom: 4 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 16.5, fontWeight: 700, letterSpacing: "-0.2px", color: "var(--color-label)" }}>{t.name}</span>
          <KindChip d={d} kind={t.kind} />
        </span>
        <span style={{ display: "block", marginTop: 3, fontFamily: "var(--font-text)", fontSize: 13.5, lineHeight: 1.42, color: "var(--color-label-2)" }}>{t.blurb}</span>
      </span>
      <span style={{ alignSelf: "center" }}>
        <CardActionBtns favKey={`tirtha:${t.id}`} meta={favMetaFromCtx(tirthaCtx(d.id, t))} size={26} onMore={() => openCardMenu(tirthaCtx(d.id, t))} />
      </span>
    </div>
  );
}

export default function DhamaDetailPage({ dhama, onBack, onOpenTirtha }: { dhama: Dhama; onBack: () => void; onOpenTirtha: (id: string) => void }) {
  const [sub, setSub] = useState<"places" | "parikrama" | "map" | "about">("places");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { openCardMenu } = useCardActions();

  // сброс позиции при смене вкладки на карту/о дхаме нежелателен; сбрасываем при входе
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [dhama.id]);

  const hasPhoto = !!dhama.hero;
  const byCluster = dhama.clusters
    .map((c) => ({ cluster: c, items: dhama.tirthas.filter((t) => t.cluster === c.id) }))
    .filter((g) => g.items.length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", minHeight: 0, background: "var(--color-bg)" }}>
      {/* sticky навбар «жидкое стекло» */}
      <header style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 30, height: NAV_H, display: "flex", alignItems: "center", gap: 4, padding: "0 6px",
        background: "var(--color-glass-nav)", backdropFilter: "saturate(180%) blur(20px)", WebkitBackdropFilter: "saturate(180%) blur(20px)",
        borderBottom: "0.5px solid var(--color-hairline)" }}>
        <button aria-label="Назад" onClick={onBack} style={{ display: "grid", height: 38, width: 38, placeItems: "center", borderRadius: "50%", border: "none", background: "none", color: "var(--color-label)", cursor: "pointer" }}>
          <BackIcon size={22} />
        </button>
        <div style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, letterSpacing: "-0.3px", color: "var(--color-label)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{dhama.name}</div>
        <CardActionBtns favKey={`dhama:${dhama.id}`} meta={favMetaFromCtx(dhamaCtx(dhama))} size={32} onMore={() => openCardMenu(dhamaCtx(dhama))} />
      </header>

      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        {/* hero */}
        <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 10", maxHeight: 360, background: "var(--color-bg-3)", overflow: "hidden" }}>
          {hasPhoto ? (
            <img src={dhama.hero} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          ) : (
            <span aria-hidden style={{ position: "absolute", inset: 0, background: `radial-gradient(120% 90% at 30% 8%, color-mix(in srgb, ${dhama.accent} 80%, #000) 0%, ${dhama.accent} 46%, color-mix(in srgb, ${dhama.accent} 48%, #000) 100%)` }} />
          )}
          <span aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, var(--color-bg) 0%, rgba(0,0,0,0) 34%), linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.15) 100%)" }} />
          <span style={{ position: "absolute", left: 16, right: 16, bottom: 14, color: "#fff" }}>
            <span style={{ display: "block", fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 14, opacity: 0.85 }}>{dhama.iast}</span>
            <span style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 800, letterSpacing: "-0.6px", lineHeight: 1.04, textShadow: "0 1px 14px rgba(0,0,0,0.4)" }}>{dhama.name}</span>
            <span style={{ display: "block", marginTop: 3, fontFamily: "var(--font-text)", fontSize: 14.5, fontWeight: 500, opacity: 0.94 }}>{dhama.deity}</span>
          </span>
        </div>

        {/* sub-tabs */}
        <SectionSubTabs
          items={[{ id: "places", label: "Места" }, { id: "parikrama", label: "Парикрама" }, { id: "map", label: "Карта" }, { id: "about", label: "О дхаме" }]}
          active={sub} onChange={(id) => setSub(id as typeof sub)} variant="chips" tone="light" top={NAV_H} bleed={16} ariaLabel="Разделы дхамы"
        />

        <div style={{ padding: "10px 16px calc(env(safe-area-inset-bottom,0px) + 64px)" }}>
          {sub === "places" && (
            <div>
              {byCluster.map(({ cluster, items }) => (
                <section key={cluster.id} style={{ marginTop: 18 }}>
                  <h3 style={{ margin: "0 0 2px", fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700, letterSpacing: "-0.3px", color: "var(--color-label)" }}>{cluster.title}</h3>
                  {cluster.note && <p style={{ margin: "0 0 6px", fontFamily: "var(--font-text)", fontSize: 13, color: "var(--color-label-3)", lineHeight: 1.4 }}>{cluster.note}</p>}
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
                <p style={{ margin: "0 2px 12px", fontFamily: "var(--font-text)", fontSize: 14, color: "var(--color-label-2)", lineHeight: 1.5 }}>
                  Рекомендуемый маршрут по святым местам — {route.length} {plural(route.length, "остановка", "остановки", "остановок")}, сгруппированы по районам. Двигайтесь по порядку или коснитесь номера на карте.
                </p>
                <DhamaMap dhama={dhama} stops={route} ordered onOpen={onOpenTirtha} />
                <div style={{ marginTop: 18 }}>
                  {groups.map((g) => (
                    <section key={g.cluster.id} style={{ marginTop: 16 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                        <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, letterSpacing: "-0.3px", color: "var(--color-label)" }}>{g.cluster.title}</h3>
                        <span style={{ fontFamily: "var(--font-text)", fontSize: 12.5, fontWeight: 600, color: dhama.accent }}>
                          {g.items.length > 1 ? `${g.start + 1}–${g.start + g.items.length}` : `${g.start + 1}`}
                        </span>
                      </div>
                      {g.cluster.note && <p style={{ margin: "0 0 6px", fontFamily: "var(--font-text)", fontSize: 13, color: "var(--color-label-3)", lineHeight: 1.4 }}>{g.cluster.note}</p>}
                      <div>
                        {g.items.map((t, i) => <ParikramaStop key={t.id} d={dhama} t={t} n={g.start + i + 1} lastInGroup={i === g.items.length - 1} onOpen={onOpenTirtha} />)}
                      </div>
                    </section>
                  ))}
                </div>
                <p style={{ margin: "20px 2px 0", fontFamily: "var(--font-text)", fontSize: 12, color: "var(--color-label-3)", lineHeight: 1.5 }}>
                  Это удобный обзорный порядок обхода, а не канонический маршрут парикрамы. Координаты приблизительны.
                </p>
              </div>
            );
          })()}

          {sub === "map" && (
            <div style={{ marginTop: 14 }}>
              <DhamaMap dhama={dhama} onOpen={onOpenTirtha} />
              <p style={{ margin: "10px 2px 0", fontFamily: "var(--font-text)", fontSize: 13, color: "var(--color-label-3)", lineHeight: 1.45 }}>
                {dhama.tirthas.length} {plural(dhama.tirthas.length, "место", "места", "мест")} на карте. Коснитесь метки, чтобы открыть тиртху. Координаты приблизительны.
              </p>
            </div>
          )}

          {sub === "about" && (
            <div style={{ marginTop: 16 }}>
              {dhama.intro.map((p, i) => (
                <p key={i} style={{ margin: i === 0 ? 0 : "var(--space-4) 0 0", fontFamily: "var(--font-text)", fontSize: "var(--text-body)", lineHeight: "var(--leading-normal)", color: "var(--color-label)" }}>{p}</p>
              ))}
              <div style={{ marginTop: 22, borderRadius: "var(--radius-lg)", border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)", overflow: "hidden" }}>
                {dhama.facts.map((f, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, padding: "12px 16px", borderBottom: i === dhama.facts.length - 1 ? "none" : "0.5px solid var(--color-hairline)" }}>
                    <span style={{ flexShrink: 0, width: 116, fontFamily: "var(--font-text)", fontSize: 13, color: "var(--color-label-3)" }}>{f.k}</span>
                    <span style={{ flex: 1, fontFamily: "var(--font-text)", fontSize: 15, fontWeight: 500, color: "var(--color-label)" }}>{f.v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}
