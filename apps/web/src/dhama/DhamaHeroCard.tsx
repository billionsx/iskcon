/**
 * DhamaHeroCard — единый карточный модуль святой дхамы (юнит-стандарт, как
 * BookHeroCard/CenterHeroCard). Витрина в списке дхам и шапка подробной (ПКП).
 * Фото-герой дхамы или радиальный градиент в её акценте. Действия:
 * избранное · карты · ⋯ (вариант center без управления).
 */
import { useRef, useState, type ReactNode } from "react";
import { ActionBtn } from "../BookHeroCard";
import { BookMenuSheet } from "../BookMenuSheet";
import { HeartIcon, MoreIcon } from "../ui/icons";
import { useFavorite } from "../cardActions";
import type { Dhama } from "./dhamas";

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const PinIcon = ({ size = 18 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><g {...STROKE}><path d="M12 21s6-5.3 6-10a6 6 0 1 0-12 0c0 4.7 6 10 6 10Z" /><circle cx="12" cy="11" r="2.2" /></g></svg>;

export function dhamaMapsHref(d: Dhama): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.name + " " + d.region)}`;
}

const pl = (n: number, a: string, b: string, c: string) => {
  const x = n % 10, y = n % 100;
  return x === 1 && y !== 11 ? a : x >= 2 && x <= 4 && (y < 10 || y >= 20) ? b : c;
};

export function DhamaHeroCard({ dhama, topLeft, onOpen, presentational, onMenuSelect, flash }: {
  dhama: Dhama;
  topLeft?: ReactNode;
  onOpen?: () => void;
  presentational?: boolean;
  onMenuSelect: (id: string) => void;
  flash?: (m: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const moreRef = useRef<HTMLSpanElement>(null);
  const accent = dhama.accent;
  const photo = dhama.hero;
  const mapsHref = dhamaMapsHref(dhama);
  const { on: favorited, toggle: toggleFav } = useFavorite(`dhama:${dhama.id}`, { t: dhama.name, s: dhama.tagline, h: `/dhama/${dhama.id}` });

  return (
    <>
      <article
        style={{
          position: "relative", width: "100%", aspectRatio: "4 / 5", overflow: "hidden", borderRadius: "var(--radius-glass)",
          border: "0.5px solid var(--color-hairline, rgba(0,0,0,.08))",
          background: photo ? `center/cover no-repeat url("${photo}")` : `radial-gradient(120% 90% at 30% 8%, color-mix(in srgb, ${accent} 80%, #000) 0%, ${accent} 46%, color-mix(in srgb, ${accent} 48%, #000) 100%)`,
          boxShadow: "var(--shadow-card, 0 8px 30px rgba(0,0,0,.12))",
          display: "flex", flexDirection: "column", justifyContent: "flex-end",
        }}>
        <div aria-hidden style={{ position: "absolute", insetInline: 0, top: 0, height: 120, pointerEvents: "none", background: "linear-gradient(to bottom, rgba(0,0,0,.5) 0%, rgba(0,0,0,0) 100%)" }} />
        <div aria-hidden style={{ position: "absolute", insetInline: 0, bottom: 0, height: "74%", pointerEvents: "none", background: "linear-gradient(to top, rgba(0,0,0,.86) 0%, rgba(0,0,0,.42) 46%, rgba(0,0,0,0) 100%)" }} />

        {onOpen && !presentational && <button type="button" aria-label="Открыть дхаму" onClick={() => onOpen()} style={{ position: "absolute", inset: 0, zIndex: 10, background: "none", border: "none", cursor: "pointer" }} />}

        {/* TOP */}
        <div style={{ position: "absolute", insetInline: 20, top: 20, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-2)" }}>
          <span style={{ display: "flex", alignItems: "center", color: "#fff", minWidth: 0 }}>{topLeft}</span>
          {!presentational && (
            <div data-pdf-no-print style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <ActionBtn active={favorited} activeColor="var(--color-red)" ariaLabel="В избранное" onClick={() => toggleFav(flash)}><HeartIcon size={18} filled={favorited} /></ActionBtn>
              <ActionBtn ariaLabel="Открыть в картах" onClick={() => { try { window.open(mapsHref, "_blank", "noopener"); } catch { /* noop */ } }}><PinIcon size={18} /></ActionBtn>
              <span ref={moreRef} style={{ display: "inline-flex" }}><ActionBtn ariaLabel="Ещё" onClick={() => setMenuOpen(true)}><MoreIcon size={16} /></ActionBtn></span>
            </div>
          )}
        </div>

        {/* INFO */}
        <div style={{ position: "relative", zIndex: 20, padding: "var(--space-5)", fontFamily: "var(--font-text)", pointerEvents: "none" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
            <span style={{ width: 7, height: 7, borderRadius: 2, background: accent }} />
            <span style={{ fontSize: "var(--text-caption2)", fontWeight: "var(--weight-bold)", letterSpacing: "0.08em", textTransform: "uppercase", color: "#fff" }}>Святая дхама</span>
          </div>
          {dhama.iast && <p style={{ margin: "0 0 2px", fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: "var(--text-subhead)", color: "rgba(255,255,255,.82)" }}>{dhama.iast}</p>}
          <h3 style={{ margin: 0, fontSize: "var(--text-title1)", lineHeight: "var(--leading-tight)", fontWeight: "var(--weight-heavy)", letterSpacing: "-0.03em", color: "#fff" }}>{dhama.name}</h3>
          <p style={{ margin: "8px 0 0", fontSize: "var(--text-subhead)", fontWeight: "var(--weight-regular)", letterSpacing: "-0.01em", color: "rgba(255,255,255,.88)" }}>{dhama.tagline}</p>
          <div style={{ marginTop: "var(--space-4)", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
            <span style={{ display: "inline-flex", alignItems: "center", borderRadius: "var(--radius-pill)", background: "rgba(255,255,255,.18)", height: 26, padding: "0 12px", fontSize: "var(--text-caption)", lineHeight: 1, fontWeight: "var(--weight-semibold)", color: "#fff" }}>{dhama.deity}</span>
            <span style={{ display: "inline-flex", alignItems: "center", borderRadius: "var(--radius-pill)", background: "rgba(255,255,255,.12)", height: 26, padding: "0 12px", fontSize: "var(--text-caption)", lineHeight: 1, fontWeight: "var(--weight-medium)", color: "rgba(255,255,255,.8)" }}>{dhama.region}</span>
            {(dhama.tirthas?.length ?? 0) > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", borderRadius: "var(--radius-pill)", background: "rgba(255,255,255,.12)", height: 26, padding: "0 12px", fontSize: "var(--text-caption)", lineHeight: 1, fontWeight: "var(--weight-medium)", color: "rgba(255,255,255,.8)" }}>{dhama.tirthas.length} {pl(dhama.tirthas.length, "место", "места", "мест")}</span>
            )}
          </div>
        </div>
      </article>
      {!presentational && (
        <BookMenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} onSelect={(id) => onMenuSelect(id)} anchorRef={moreRef} variant="center" centerCanManage={false} centerHasMaps />
      )}
    </>
  );
}
