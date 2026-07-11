/**
 * CenterHeroCard — единый карточный модуль центра Ятры (юнит-стандарт, как
 * BookHeroCard). Витрина в локаторе/рейлах и шапка подробной карточки (ПКП).
 * Различаются только `topLeft` и `onOpen`. Действия: избранное · маршрут · ⋯.
 * Есть фото — обложка; нет — графит с подсветкой по типу центра.
 */
import { useRef, useState, type ReactNode } from "react";
import { ActionBtn } from "../BookHeroCard";
import { BookMenuSheet } from "../BookMenuSheet";
import { HeartIcon, MoreIcon } from "../ui/icons";
import { useFavorite } from "../cardActions";
import { CENTER_TYPE_LABEL, type CenterType } from "./api";
import { useCoverSlider, CoverImages, CoverTapZones, CoverCounter } from "../CardCover";

const GRAPHITE = "radial-gradient(120% 80% at 50% 0%, #3a3a40 0%, #2a2a2f 45%, #1b1b1f 100%)";

/** Минимальный набор полей карточки — подходит и CenterListItem, и CenterFull. */
export interface CenterCardData {
  id: string;
  type: CenterType;
  name: string;
  slug: string;
  city: string | null;
  region?: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  photos: string[];
  languages?: string[];
  distance_km?: number;
  status?: string;
}

export function centerAccent(type: CenterType): string {
  if (type === "temple") return "var(--color-gold)";
  if (type === "restaurant") return "#E8920C";
  if (type === "farm") return "#3FA34D";
  if (type === "namahatta") return "#4C6EF5";
  if (type === "preaching_center") return "#7048E8";
  return "var(--color-gold)";
}

export function centerMapsHref(c: { lat: number | null; lng: number | null; address: string | null }): string | null {
  if (c.lat != null && c.lng != null) return `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`;
  if (c.address) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}`;
  return null;
}

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const PinIcon = ({ size = 18 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><g {...STROKE}><path d="M12 21s6-5.3 6-10a6 6 0 1 0-12 0c0 4.7 6 10 6 10Z" /><circle cx="12" cy="11" r="2.2" /></g></svg>;

export function CenterHeroCard({ center, topLeft, onOpen, presentational, onMenuSelect, canManage, flash }: {
  center: CenterCardData;
  topLeft?: ReactNode;
  onOpen?: () => void;
  presentational?: boolean;
  onMenuSelect: (id: string) => void;
  canManage?: boolean;
  flash?: (m: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const moreRef = useRef<HTMLSpanElement>(null);
  const accent = centerAccent(center.type);
  const photos = center.photos ?? [];
  const { idx, next, prev } = useCoverSlider(photos.length);
  const place = [center.city, center.region, center.country].filter(Boolean).join(" · ");
  const mapsHref = centerMapsHref(center);
  const { on: favorited, toggle: toggleFav } = useFavorite(`center:${center.slug}`, { t: center.name, s: place || CENTER_TYPE_LABEL[center.type], h: `/center/${center.slug}` });

  return (
    <>
      <article
        style={{
          position: "relative", width: "100%", aspectRatio: "4 / 5", overflow: "hidden", borderRadius: 20,
          border: "0.5px solid var(--color-hairline, rgba(0,0,0,.08))",
          background: GRAPHITE,
          boxShadow: "var(--shadow-card, 0 8px 30px rgba(0,0,0,.12))",
          display: "flex", flexDirection: "column", justifyContent: "flex-end",
        }}>
        {photos.length
          ? <CoverImages images={photos} alt={center.name} idx={idx} />
          : <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", background: `radial-gradient(130% 90% at 50% -8%, ${accent}45 0%, ${accent}16 34%, transparent 60%)` }} />}
        <div aria-hidden style={{ position: "absolute", insetInline: 0, top: 0, height: 120, pointerEvents: "none", background: "linear-gradient(to bottom, rgba(0,0,0,.5) 0%, rgba(0,0,0,0) 100%)" }} />
        <div aria-hidden style={{ position: "absolute", insetInline: 0, bottom: 0, height: "74%", pointerEvents: "none", background: "linear-gradient(to top, rgba(0,0,0,.86) 0%, rgba(0,0,0,.42) 46%, rgba(0,0,0,0) 100%)" }} />

        {onOpen && !presentational && <button type="button" aria-label="Открыть центр" onClick={() => onOpen()} style={{ position: "absolute", inset: 0, zIndex: 10, background: "none", border: "none", cursor: "pointer" }} />}
        {photos.length > 1 && !presentational && <CoverTapZones onPrev={prev} onNext={next} />}

        {/* TOP */}
        <div style={{ position: "absolute", insetInline: 20, top: 20, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ display: "flex", alignItems: "center", color: "#fff", minWidth: 0 }}>{topLeft}</span>
          <div data-pdf-no-print style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {photos.length > 1 && <CoverCounter idx={idx} total={photos.length} />}
            {!presentational && (
              <>
                <ActionBtn active={favorited} activeColor="#FF453A" ariaLabel="В избранное" onClick={() => toggleFav(flash)}><HeartIcon size={18} filled={favorited} /></ActionBtn>
                {mapsHref && <ActionBtn ariaLabel="Маршрут" onClick={() => { try { window.open(mapsHref, "_blank", "noopener"); } catch { /* noop */ } }}><PinIcon size={18} /></ActionBtn>}
                <span ref={moreRef} style={{ display: "inline-flex" }}><ActionBtn ariaLabel="Ещё" onClick={() => setMenuOpen(true)}><MoreIcon size={16} /></ActionBtn></span>
              </>
            )}
          </div>
        </div>

        {/* INFO */}
        <div onClick={presentational ? undefined : () => onOpen?.()} style={{ position: "relative", zIndex: 20, padding: 20, cursor: onOpen && !presentational ? "pointer" : "default", fontFamily: "var(--font-text)", pointerEvents: "none" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, marginBottom: 9, flexWrap: "wrap" }}>
            <span style={{ width: 7, height: 7, borderRadius: 2, background: accent }} />
            <span style={{ fontSize: "var(--text-caption)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: accent }}>{CENTER_TYPE_LABEL[center.type]}</span>
            {center.status === "live" && <span style={{ fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "rgba(255,255,255,.6)" }}>· авторизовано ИСККОН</span>}
          </div>
          <h3 style={{ margin: 0, fontSize: "var(--text-title1)", lineHeight: 1.1, fontWeight: 800, letterSpacing: "-0.025em", color: "#fff", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{center.name}</h3>
          {place && <p style={{ margin: "8px 0 0", display: "inline-flex", alignItems: "center", gap: 5, fontSize: "var(--text-subhead)", fontWeight: 400, letterSpacing: "-0.01em", color: "rgba(255,255,255,.85)" }}><PinIcon size={14} />{place}</p>}
          <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
            {typeof center.distance_km === "number" && (
              <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, background: "rgba(255,255,255,.18)", height: 26, padding: "0 12px", fontSize: "var(--text-footnote)", lineHeight: 1, fontWeight: 600, color: "#fff", fontVariantNumeric: "tabular-nums" }}>
                {center.distance_km < 1 ? `${Math.round(center.distance_km * 1000)} м` : `${center.distance_km.toFixed(center.distance_km < 10 ? 1 : 0)} км`}
              </span>
            )}
            {(center.languages ?? []).slice(0, 3).map((l) => (
              <span key={l} style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, background: "rgba(255,255,255,.12)", height: 26, padding: "0 12px", fontSize: "var(--text-footnote)", lineHeight: 1, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.3px", color: "rgba(255,255,255,.78)" }}>{l}</span>
            ))}
          </div>
        </div>
      </article>
      {!presentational && (
        <BookMenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} onSelect={(id) => onMenuSelect(id)} anchorRef={moreRef} variant="center" centerCanManage={!!canManage} centerHasMaps={!!mapsHref} />
      )}
    </>
  );
}
