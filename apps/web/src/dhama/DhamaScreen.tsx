/**
 * DhamaScreen — раздел «Дхама». Лендинг: «святое место дня» (витрина тиртхи) и
 * три карточки святых земель (Вриндаван · Навадвипа · Нилачала). Карточки —
 * единые модули DhamaHeroCard/TirthaHeroCard (тот же модуль, что и шапка
 * подробной), действия ♥ · карты · ⋯ (книжный двухвидовой стандарт). Тап → ПКП.
 */
import { useMemo, useState } from "react";
import { getDhama, tirthaOfDay, KIND_RU, dhamasNow, allTirthasNow, type Dhama, type Tirtha, type TirthaKind } from "./dhamas";
import { useDhamas } from "./dhamasHydrate";
import { DhamaHeroCard, dhamaMapsHref } from "./DhamaHeroCard";
import { TirthaHeroCard, tirthaMapsHref } from "./TirthaHeroCard";
import { requestNote } from "../notes";

/** Регистронезависимое сравнение без диакритики (IAST: Rādhā ↔ radha). */
function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
const KIND_ORDER: TirthaKind[] = ["temple", "kunda", "ghat", "hill", "forest", "river", "samadhi", "island", "village", "place"];
function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

function shareUrl(url: string, title: string) {
  const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { share?: (d: { title: string; url: string }) => Promise<void> }) : null;
  if (nav?.share) void nav.share({ title, url }).catch(() => undefined);
  else { try { void nav?.clipboard?.writeText(url); } catch { /* noop */ } }
}
const origin = () => (typeof window !== "undefined" ? window.location.origin : "https://gaurangers.com");

export default function DhamaScreen({ onOpen, onOpenTirtha }: { onOpen: (id: string) => void; onOpenTirtha?: (dhamaId: string, tirthaId: string) => void }) {
  const onMenuDhama = (d: Dhama) => (id: string) => {
    if (id === "share") shareUrl(`${origin()}/dhama/${d.id}`, d.name);
    else if (id === "route") { try { window.open(dhamaMapsHref(d), "_blank", "noopener"); } catch { /* noop */ } }
    else if (id === "note") requestNote({ kind: "place", ref: d.id, title: d.name, subtitle: d.region, href: `/dhama/${d.id}` });
    else onOpen(d.id);
  };
  const onMenuTirtha = (d: Dhama, t: Tirtha) => (id: string) => {
    if (id === "share") shareUrl(`${origin()}/dhama/${d.id}/${t.id}`, t.name);
    else if (id === "route") { try { window.open(tirthaMapsHref(t), "_blank", "noopener"); } catch { /* noop */ } }
    else if (id === "note") requestNote({ kind: "place", ref: t.id, title: t.name, subtitle: d.name, href: `/dhama/${d.id}/${t.id}` });
    else onOpenTirtha?.(d.id, t.id);
  };

  const [q, setQ] = useState("");
  const [kind, setKind] = useState<TirthaKind | "all">("all");
  const searching = q.trim() !== "" || kind !== "all";

  const dv = useDhamas();   // реактивная гидрация дхам из БД (сид → БД)

  const presentKinds = useMemo(() => {
    const set = new Set(allTirthasNow().map((t) => t.kind));
    return KIND_ORDER.filter((k) => set.has(k));
  }, [dv]);

  const results = useMemo(() => {
    if (!searching) return [];
    const nq = norm(q.trim());
    const scored: { t: Tirtha; score: number }[] = [];
    for (const t of allTirthasNow()) {
      if (kind !== "all" && t.kind !== kind) continue;
      if (!nq) { scored.push({ t, score: 5 }); continue; }
      const name = norm(t.name), iast = norm(t.iast || ""), blurb = norm(t.blurb || "");
      const d = getDhama(t.dhama);
      const ctx = norm(`${d?.name || ""} ${d?.clusters.find((c) => c.id === t.cluster)?.title || ""}`);
      let score = -1;
      if (name.startsWith(nq)) score = 0;
      else if (name.includes(nq)) score = 1;
      else if (iast.includes(nq)) score = 2;
      else if (ctx.includes(nq)) score = 3;
      else if (blurb.includes(nq)) score = 4;
      if (score >= 0) scored.push({ t, score });
    }
    scored.sort((a, b) => a.score - b.score || a.t.name.localeCompare(b.t.name, "ru"));
    return scored.map((s) => s.t);
  }, [q, kind, searching, dv]);

  const tod = tirthaOfDay();
  const todCluster = tod.dhama.clusters.find((c) => c.id === tod.tirtha.cluster)?.title;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.4px", textTransform: "uppercase", color: "var(--color-brand-blue)" }}>Святые места</div>
        <h2 style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 700, letterSpacing: "-0.3px", color: "var(--color-label)", fontFamily: "var(--font-text)" }}>Дхама</h2>
        <p style={{ margin: "4px 0 0", fontFamily: "var(--font-text)", fontSize: 14, color: "var(--color-label-2)", lineHeight: 1.45 }}>
          Дхамы — святые земли, неотличные от духовного мира, где Господь являет Свои вечные игры. Войдите в каждую, чтобы пройти по её тиртхам, лилам и картам.
        </p>
      </div>

      {/* поиск по всем святым местам */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, height: 40, padding: "0 12px", borderRadius: 12, background: "rgba(120,120,128,0.12)" }}>
          <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden style={{ color: "var(--color-label-3)", flexShrink: 0 }}><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="m20 20-3.2-3.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти святое место" inputMode="search"
            style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontFamily: "var(--font-text)", fontSize: 15, color: "var(--color-label)" }} />
          {q && <button type="button" aria-label="Очистить" onClick={() => setQ("")} style={{ border: "none", background: "none", color: "var(--color-label-3)", cursor: "pointer", padding: 2, display: "grid", placeItems: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="9" fill="rgba(120,120,128,0.45)" /><path d="M9 9l6 6M15 9l-6 6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>}
        </div>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "10px 0 0", scrollbarWidth: "none" }}>
          {(["all", ...presentKinds] as ("all" | TirthaKind)[]).map((k) => {
            const on = kind === k;
            return (
              <button key={k} type="button" onClick={() => setKind(k)}
                style={{ flexShrink: 0, height: 32, padding: "0 13px", borderRadius: 999, border: on ? "none" : "0.5px solid var(--color-hairline)", cursor: "pointer", fontFamily: "var(--font-text)", fontSize: 13, fontWeight: 600, background: on ? "var(--color-label)" : "var(--color-glass-thin)", color: on ? "var(--color-bg)" : "var(--color-label-2)", WebkitTapHighlightColor: "transparent" }}>
                {k === "all" ? "Все" : KIND_RU[k]}
              </button>
            );
          })}
        </div>
      </div>

      {searching ? (
        results.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 20px" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 800, color: "var(--color-label)" }}>Ничего не найдено</div>
            <p style={{ margin: "8px auto 0", maxWidth: 300, fontFamily: "var(--font-text)", fontSize: 13.5, lineHeight: 1.5, color: "var(--color-label-2)" }}>Измените запрос или выберите другой тип места.</p>
          </div>
        ) : (
          <>
            <div style={{ fontFamily: "var(--font-text)", fontSize: 12.5, color: "var(--color-label-3)", margin: "0 2px 12px" }}>{results.length} {plural(results.length, "место", "места", "мест")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {results.map((t) => {
                const d = getDhama(t.dhama)!;
                return (
                  <TirthaHeroCard key={t.id} dhamaId={d.id} tirtha={t} accent={d.accent} dhamaName={d.name}
                    clusterTitle={d.clusters.find((c) => c.id === t.cluster)?.title}
                    onOpen={onOpenTirtha ? () => onOpenTirtha(d.id, t.id) : undefined}
                    onMenuSelect={onMenuTirtha(d, t)} />
                );
              })}
            </div>
          </>
        )
      ) : (
      <>
      {onOpenTirtha && (
        <div style={{ marginBottom: 18 }}>
          <TirthaHeroCard
            dhamaId={tod.dhama.id}
            tirtha={tod.tirtha}
            accent={tod.dhama.accent}
            dhamaName={tod.dhama.name}
            clusterTitle={todCluster}
            onOpen={() => onOpenTirtha(tod.dhama.id, tod.tirtha.id)}
            onMenuSelect={onMenuTirtha(tod.dhama, tod.tirtha)}
            topLeft={
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 28, padding: "0 11px", borderRadius: 999, background: "rgba(255,255,255,0.22)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", fontFamily: "var(--font-text)", fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: "#fff" }}>
                <span aria-hidden style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff" }} />Место дня
              </span>
            }
          />
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {dhamasNow().map((d) => (
          <DhamaHeroCard key={d.id} dhama={d} onOpen={() => onOpen(d.id)} onMenuSelect={onMenuDhama(d)} />
        ))}
      </div>
      </>
      )}
    </div>
  );
}
