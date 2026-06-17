/**
 * PersonHeroCard — единый модуль карточки личности (ВКЛ, юнит-стандарт).
 * Зеркалит BookHeroCard: графитовая карта 4:5, слот сверху-слева (лого/назад),
 * стандартный набор действий справа (избранное · ⋯), низ — имя, IAST·категория,
 * тождество, краткое, чипы. Используется одинаково витриной (слайдеры/ленты)
 * и как hero подробной страницы (ПКЛ).
 */
import { type ReactNode } from "react";
import { HeartIcon, MoreIcon } from "./ui/icons";
import { ActionBtn } from "./BookHeroCard";
import { useFavorite } from "./cardActions";

const GRAPHITE = "radial-gradient(120% 80% at 50% 0%, #3a3a40 0%, #2a2a2f 45%, #1b1b1f 100%)";

export function PersonHeroCard({
  id, nameRu, nameIast, image, kicker, identity, summary, chips,
  topLeft, onMore, flash, presentational,
}: {
  id: string;
  nameRu: string;
  nameIast?: string | null;
  image?: string | null;
  kicker?: string | null;       // категория/роль одной строкой (под именем)
  identity?: string | null;     // «В лиле Кришны — Лалита» и т.п.
  summary?: string | null;
  chips?: string[];
  topLeft?: ReactNode;
  onMore?: () => void;
  flash?: (m: string) => void;
  presentational?: boolean;
}) {
  const { on: favorited, toggle: toggleFav } = useFavorite(`entity:${id}`, { t: nameRu, s: summary || kicker || undefined, h: `/person/${encodeURIComponent(id)}` });
  const initial = (nameRu || "·").trim().charAt(0).toUpperCase();
  const longName = (nameRu || "").length > 15;

  return (
    <article
      style={{
        position: "relative", width: "100%", aspectRatio: "4 / 5", overflow: "hidden", borderRadius: 20,
        border: "0.5px solid var(--color-hairline, rgba(0,0,0,.08))", background: GRAPHITE,
        boxShadow: "var(--shadow-card, 0 8px 30px rgba(0,0,0,.12))",
        display: "flex", flexDirection: "column", justifyContent: "flex-end",
      }}>
      {image ? (
        <img src={image} alt={nameRu} loading="eager" decoding="async" draggable={false}
          style={{ position: "absolute", inset: 0, height: "100%", width: "100%", objectFit: "cover" }} />
      ) : (
        <div aria-hidden style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 200, fontWeight: 700, color: "rgba(255,255,255,.07)", lineHeight: 1, userSelect: "none" }}>{initial}</span>
        </div>
      )}
      <div aria-hidden style={{ position: "absolute", insetInline: 0, top: 0, height: 120, pointerEvents: "none", background: "linear-gradient(to bottom, rgba(0,0,0,.55) 0%, rgba(0,0,0,0) 100%)" }} />
      <div aria-hidden style={{ position: "absolute", insetInline: 0, bottom: 0, height: "82%", pointerEvents: "none", background: "linear-gradient(to top, rgba(0,0,0,.93) 0%, rgba(0,0,0,.62) 44%, rgba(0,0,0,0) 100%)" }} />

      {/* TOP: слот (лого/назад) · стандартные действия */}
      <div style={{ position: "absolute", insetInline: 20, top: 20, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ display: "flex", alignItems: "center", color: "#fff", minWidth: 0 }}>{topLeft}</span>
        {!presentational && (
          <div data-pdf-no-print style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ActionBtn active={favorited} activeColor="#FF453A" ariaLabel="В избранное" onClick={() => toggleFav(flash)}><HeartIcon size={18} filled={favorited} /></ActionBtn>
            {onMore && <ActionBtn ariaLabel="Ещё" onClick={onMore}><MoreIcon size={16} /></ActionBtn>}
          </div>
        )}
      </div>

      {/* INFO — низ */}
      <div style={{ position: "relative", zIndex: 20, padding: 20, fontFamily: "var(--font-text)", pointerEvents: "none" }}>
        <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: longName ? 30 : 38, lineHeight: 1.04, fontWeight: 800, letterSpacing: "-0.03em", color: "#fff" }}>{nameRu}</h1>
        {(nameIast || kicker) && (
          <div style={{ marginTop: 6, fontSize: 15, lineHeight: 1.3, fontWeight: 400, letterSpacing: "-0.01em", color: "rgba(255,255,255,.72)" }}>
            {nameIast && <span style={{ fontFamily: "var(--font-scripture)", fontStyle: "italic" }}>{nameIast}</span>}
            {nameIast && kicker && <span style={{ margin: "0 6px", color: "rgba(255,255,255,.4)" }}>·</span>}
            {kicker}
          </div>
        )}
        {identity && <p style={{ margin: "16px 0 0", fontSize: 15, lineHeight: 1.35, fontWeight: 600, letterSpacing: "-0.01em", color: "rgba(255,255,255,.95)" }}>{identity}</p>}
        {summary && <p style={{ margin: identity ? "8px 0 0" : "16px 0 0", fontSize: 14, lineHeight: 1.4, fontWeight: 400, letterSpacing: "-0.01em", color: "rgba(255,255,255,.82)" }}>{summary}</p>}
        {chips && chips.length > 0 && (
          <div style={{ marginTop: 18, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
            {chips.map((c) => (
              <span key={c} style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, background: "rgba(255,255,255,.16)", height: 26, padding: "0 12px", fontSize: 13, lineHeight: 1, fontWeight: 500, letterSpacing: "-0.01em", color: "#fff" }}>{c}</span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
