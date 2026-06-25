/**
 * TirthaHeroCard — единый карточный модуль святого места (тиртхи). Витрина
 * («место дня», списки) и шапка подробной (ПКП). Своих фото у мест нет —
 * градиент в акценте дхамы. Действия: избранное · карты · ⋯.
 */
import { useRef, useState, type ReactNode } from "react";
import { ActionBtn } from "../BookHeroCard";
import { BookMenuSheet } from "../BookMenuSheet";
import { HeartIcon, MoreIcon } from "../ui/icons";
import { useFavorite } from "../cardActions";
import { KIND_RU, mapsQuery, type Tirtha } from "./dhamas";

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const PinIcon = ({ size = 18 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><g {...STROKE}><path d="M12 21s6-5.3 6-10a6 6 0 1 0-12 0c0 4.7 6 10 6 10Z" /><circle cx="12" cy="11" r="2.2" /></g></svg>;

export function tirthaMapsHref(t: Tirtha): string {
  return `https://maps.google.com/?q=${encodeURIComponent(mapsQuery(t))}`;
}

export function TirthaHeroCard({ dhamaId, tirtha, accent, dhamaName, clusterTitle, topLeft, onOpen, presentational, onMenuSelect, flash }: {
  dhamaId: string;
  tirtha: Tirtha;
  accent: string;
  dhamaName?: string;
  clusterTitle?: string;
  topLeft?: ReactNode;
  onOpen?: () => void;
  presentational?: boolean;
  onMenuSelect: (id: string) => void;
  flash?: (m: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const moreRef = useRef<HTMLSpanElement>(null);
  const t = tirtha;
  const mapsHref = tirthaMapsHref(t);
  const place = [dhamaName, clusterTitle].filter(Boolean).join(" · ");
  const { on: favorited, toggle: toggleFav } = useFavorite(`tirtha:${t.id}`, { t: t.name, s: t.iast || KIND_RU[t.kind], h: `/dhama/${dhamaId}/${t.id}` });

  return (
    <>
      <article
        style={{
          position: "relative", width: "100%", aspectRatio: "4 / 5", overflow: "hidden", borderRadius: "var(--radius-glass)",
          border: "0.5px solid var(--color-hairline, rgba(0,0,0,.08))",
          background: `radial-gradient(125% 95% at 28% 6%, color-mix(in srgb, ${accent} 82%, #000) 0%, ${accent} 48%, color-mix(in srgb, ${accent} 46%, #000) 100%)`,
          boxShadow: "var(--shadow-card, 0 8px 30px rgba(0,0,0,.12))",
          display: "flex", flexDirection: "column", justifyContent: "flex-end",
        }}>
        {t.hero_image && (
          <img src={t.hero_image} alt="" aria-hidden loading="lazy"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }} />
        )}
        <div aria-hidden style={{ position: "absolute", insetInline: 0, top: 0, height: 120, zIndex: 1, pointerEvents: "none", background: "linear-gradient(to bottom, rgba(0,0,0,.42) 0%, rgba(0,0,0,0) 100%)" }} />
        <div aria-hidden style={{ position: "absolute", insetInline: 0, bottom: 0, height: "74%", zIndex: 1, pointerEvents: "none", background: "linear-gradient(to top, rgba(0,0,0,.82) 0%, rgba(0,0,0,.38) 46%, rgba(0,0,0,0) 100%)" }} />

        {onOpen && !presentational && <button type="button" aria-label="Открыть место" onClick={() => onOpen()} style={{ position: "absolute", inset: 0, zIndex: 10, background: "none", border: "none", cursor: "pointer" }} />}

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
            <span style={{ width: 7, height: 7, borderRadius: 2, background: "rgba(255,255,255,.92)" }} />
            <span style={{ fontSize: "var(--text-caption2)", fontWeight: "var(--weight-bold)", letterSpacing: "0.08em", textTransform: "uppercase", color: "#fff" }}>{KIND_RU[t.kind]}</span>
          </div>
          {t.iast && <p style={{ margin: "0 0 2px", fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: "var(--text-subhead)", color: "rgba(255,255,255,.82)" }}>{t.iast}</p>}
          <h3 style={{ margin: 0, fontSize: "var(--text-title1)", lineHeight: "var(--leading-tight)", fontWeight: "var(--weight-heavy)", letterSpacing: "-0.025em", color: "#fff", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{t.name}</h3>
          {t.blurb && <p style={{ margin: "8px 0 0", fontSize: "var(--text-subhead)", fontWeight: "var(--weight-regular)", lineHeight: "var(--leading-snug)", letterSpacing: "-0.01em", color: "rgba(255,255,255,.88)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{t.blurb}</p>}
          {place && (
            <div style={{ marginTop: 14 }}>
              <span style={{ display: "inline-flex", alignItems: "center", borderRadius: "var(--radius-pill)", background: "rgba(255,255,255,.16)", height: 26, padding: "0 12px", fontSize: "var(--text-caption)", lineHeight: 1, fontWeight: "var(--weight-semibold)", color: "#fff" }}>{place}</span>
            </div>
          )}
        </div>
      </article>
      {!presentational && (
        <BookMenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} onSelect={(id) => onMenuSelect(id)} anchorRef={moreRef} variant="center" centerCanManage={false} centerHasMaps />
      )}
    </>
  );
}
