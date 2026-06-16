/**
 * DhamaScreen — раздел «Дхама». Лендинг с тремя большими карточками святых
 * земель (Вриндаван · Навадвипа · Нилачала) в стиле редакционной обложки:
 * фото на всю ширину с градиентом и подписью поверх. Тап → страница дхамы.
 *
 * Эстетика — общий язык приложения (SF/Georgia, grouped-iOS, liquid-glass).
 */
import { DHAMAS, type Dhama } from "./dhamas";

function DhamaCard({ d, onOpen }: { d: Dhama; onOpen: (id: string) => void }) {
  const hasPhoto = !!d.hero;
  return (
    <button type="button" onClick={() => onOpen(d.id)}
      onPointerDown={(e) => (e.currentTarget.style.transform = "scale(0.985)")}
      onPointerUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
      onPointerLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      style={{ position: "relative", display: "block", width: "100%", aspectRatio: "16 / 10", padding: 0, border: "0.5px solid var(--color-hairline)",
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
      <span style={{ position: "absolute", left: 18, right: 18, bottom: 16, color: "#fff" }}>
        <span style={{ display: "block", fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 13, letterSpacing: "0.2px", opacity: 0.82, marginBottom: 3 }}>{d.iast}</span>
        <span style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 27, fontWeight: 800, letterSpacing: "-0.5px", lineHeight: 1.05, textShadow: "0 1px 12px rgba(0,0,0,0.35)" }}>{d.name}</span>
        <span style={{ display: "block", marginTop: 4, fontFamily: "var(--font-text)", fontSize: 14, fontWeight: 500, opacity: 0.92 }}>{d.tagline}</span>
      </span>
    </button>
  );
}

export default function DhamaScreen({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.4px", textTransform: "uppercase", color: "var(--color-brand-blue)" }}>Святые места</div>
        <h2 style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 700, letterSpacing: "-0.3px", color: "var(--color-label)", fontFamily: "var(--font-text)" }}>Дхама</h2>
        <p style={{ margin: "4px 0 0", fontFamily: "var(--font-text)", fontSize: 14, color: "var(--color-label-2)", lineHeight: 1.45 }}>
          Дхамы — святые земли, неотличные от духовного мира, где Господь являет Свои вечные игры. Войдите в каждую, чтобы пройти по её тиртхам, лилам и картам.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {DHAMAS.map((d) => <DhamaCard key={d.id} d={d} onOpen={onOpen} />)}
      </div>
    </div>
  );
}
