/**
 * DhamaScreen — раздел «Дхама». Лендинг с тремя большими карточками святых
 * земель (Вриндаван · Навадвипа · Нилачала) в стиле редакционной обложки:
 * фото на всю ширину с градиентом и подписью поверх. Тап → страница дхамы.
 *
 * Эстетика — общий язык приложения (SF/Georgia, grouped-iOS, liquid-glass).
 */
import { DHAMAS, dhamaCtx, tirthaCtx, tirthaOfDay, KIND_RU, type Dhama } from "./dhamas";
import { CardActionBtns, favMetaFromCtx, useCardActions } from "../cardActions";

function DhamaCard({ d, onOpen }: { d: Dhama; onOpen: (id: string) => void }) {
  const { openCardMenu } = useCardActions();
  const hasPhoto = !!d.hero;
  return (
    <div role="button" tabIndex={0} onClick={() => onOpen(d.id)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(d.id); } }}
      onPointerDown={(e) => (e.currentTarget.style.transform = "scale(0.985)")}
      onPointerUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
      onPointerLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      style={{ position: "relative", display: "block", width: "100%", aspectRatio: "16 / 10", border: "0.5px solid var(--color-hairline)",
        borderRadius: "var(--radius-xl)", overflow: "hidden", cursor: "pointer", background: "var(--color-bg-3)", textAlign: "left",
        transition: "transform 140ms var(--ease-standard)", boxShadow: "var(--shadow-card)", WebkitTapHighlightColor: "transparent" }}>
      {hasPhoto ? (
        <img src={d.hero} alt="" loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <span aria-hidden style={{ position: "absolute", inset: 0,
          background: `radial-gradient(120% 90% at 30% 10%, color-mix(in srgb, ${d.accent} 78%, #000) 0%, ${d.accent} 45%, color-mix(in srgb, ${d.accent} 50%, #000) 100%)` }} />
      )}
      {/* нижний градиент под подпись */}
      <span aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.66) 0%, rgba(0,0,0,0.18) 42%, rgba(0,0,0,0) 70%)" }} />
      {/* действия карточки — ♥ / ⋯ (книжный стандарт) */}
      <span style={{ position: "absolute", top: 12, right: 12, zIndex: 2 }}>
        <CardActionBtns dark favKey={`dhama:${d.id}`} meta={favMetaFromCtx(dhamaCtx(d))} onMore={() => openCardMenu(dhamaCtx(d))} />
      </span>
      <span style={{ position: "absolute", left: 18, right: 18, bottom: 16, color: "#fff" }}>
        <span style={{ display: "block", fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 13, letterSpacing: "0.2px", opacity: 0.82, marginBottom: 3 }}>{d.iast}</span>
        <span style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 27, fontWeight: 800, letterSpacing: "-0.5px", lineHeight: 1.05, textShadow: "0 1px 12px rgba(0,0,0,0.35)" }}>{d.name}</span>
        <span style={{ display: "block", marginTop: 4, fontFamily: "var(--font-text)", fontSize: 14, fontWeight: 500, opacity: 0.92 }}>{d.tagline}</span>
      </span>
    </div>
  );
}

/* ── Святое место дня — ежедневная витрина тиртхи (двухвидовой стандарт) ── */
function PlaceOfDay({ onOpenTirtha }: { onOpenTirtha: (dhamaId: string, tirthaId: string) => void }) {
  const { openCardMenu } = useCardActions();
  const { dhama: d, tirtha: t } = tirthaOfDay();
  const cluster = d.clusters.find((c) => c.id === t.cluster)?.title;
  return (
    <div role="button" tabIndex={0} onClick={() => onOpenTirtha(d.id, t.id)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenTirtha(d.id, t.id); } }}
      onPointerDown={(e) => (e.currentTarget.style.transform = "scale(0.99)")}
      onPointerUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
      onPointerLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      style={{ position: "relative", display: "block", width: "100%", overflow: "hidden", cursor: "pointer", textAlign: "left",
        borderRadius: "var(--radius-xl)", border: "0.5px solid var(--color-hairline)", boxShadow: "var(--shadow-card)",
        transition: "transform 140ms var(--ease-standard)", WebkitTapHighlightColor: "transparent", color: "#fff",
        background: `radial-gradient(135% 120% at 88% 8%, color-mix(in srgb, ${d.accent} 62%, #000) 0%, ${d.accent} 52%, color-mix(in srgb, ${d.accent} 58%, #000) 100%)` }}>
      <span aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.34) 0%, rgba(0,0,0,0) 60%)" }} />
      <span style={{ position: "absolute", top: 12, right: 12, zIndex: 2 }}>
        <CardActionBtns dark favKey={`tirtha:${t.id}`} meta={favMetaFromCtx(tirthaCtx(d.id, t))} onMore={() => openCardMenu(tirthaCtx(d.id, t))} />
      </span>
      <div style={{ position: "relative", padding: "16px 18px 18px" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-text)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", opacity: 0.92 }}>
          <span aria-hidden style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff" }} />Святое место дня
        </span>
        {t.iast && <span style={{ display: "block", marginTop: 10, fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 13.5, opacity: 0.85 }}>{t.iast}</span>}
        <span style={{ display: "block", marginTop: t.iast ? 1 : 10, fontFamily: "var(--font-display)", fontSize: 25, fontWeight: 800, letterSpacing: "-0.5px", lineHeight: 1.06, paddingRight: 84, textShadow: "0 1px 12px rgba(0,0,0,0.3)" }}>{t.name}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7, flexWrap: "wrap" }}>
          <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 999, fontFamily: "var(--font-text)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.3px", textTransform: "uppercase", background: "rgba(255,255,255,0.2)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}>{KIND_RU[t.kind]}</span>
          <span style={{ fontFamily: "var(--font-text)", fontSize: 13, fontWeight: 500, opacity: 0.9 }}>{d.name}{cluster ? ` · ${cluster}` : ""}</span>
        </span>
        <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", marginTop: 9, fontFamily: "var(--font-text)", fontSize: 14, lineHeight: 1.45, opacity: 0.94 }}>{t.lila || t.blurb}</span>
      </div>
    </div>
  );
}

export default function DhamaScreen({ onOpen, onOpenTirtha }: { onOpen: (id: string) => void; onOpenTirtha?: (dhamaId: string, tirthaId: string) => void }) {
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
          <PlaceOfDay onOpenTirtha={onOpenTirtha} />
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {DHAMAS.map((d) => <DhamaCard key={d.id} d={d} onOpen={onOpen} />)}
      </div>
    </div>
  );
}
