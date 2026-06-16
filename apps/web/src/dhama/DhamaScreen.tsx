/**
 * DhamaScreen — раздел «Дхама». Лендинг: «святое место дня» (витрина тиртхи) и
 * три карточки святых земель (Вриндаван · Навадвипа · Нилачала). Карточки —
 * единые модули DhamaHeroCard/TirthaHeroCard (тот же модуль, что и шапка
 * подробной), действия ♥ · карты · ⋯ (книжный двухвидовой стандарт). Тап → ПКП.
 */
import { DHAMAS, tirthaOfDay, type Dhama, type Tirtha } from "./dhamas";
import { DhamaHeroCard, dhamaMapsHref } from "./DhamaHeroCard";
import { TirthaHeroCard, tirthaMapsHref } from "./TirthaHeroCard";
import { requestNote } from "../notes";

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
        {DHAMAS.map((d) => (
          <DhamaHeroCard key={d.id} dhama={d} onOpen={() => onOpen(d.id)} onMenuSelect={onMenuDhama(d)} />
        ))}
      </div>
    </div>
  );
}
