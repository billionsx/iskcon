/**
 * PersonHeroCard — единый модуль карточки личности (ВКЛ, юнит-стандарт).
 * Зеркалит BookHeroCard: графитовая карта 4:5, слот сверху-слева (лого/назад),
 * стандартный набор действий справа (избранное · ⋯). Низ — «надпись»-
 * классификация (eyebrow, золотом, как заголовки разделов), имя, IAST,
 * тождество, краткое, чипы. Используется как hero подробной страницы (ПКЛ).
 */
import { type ReactNode } from "react";
import { HeartIcon, MoreIcon } from "./ui/icons";
import { ActionBtn } from "./BookHeroCard";
import { useFavorite } from "./cardActions";
import { useCoverSlider, CoverImages, CoverTapZones, CoverCounter } from "./CardCover";
import { cleanCardText } from "./cardText";

const GRAPHITE = "radial-gradient(120% 80% at 50% 0%, #3a3a40 0%, #2a2a2f 45%, #1b1b1f 100%)";
const GOLD = "#E6BE55"; // золото для тёмного фона (рифмуется с заголовками разделов)

export function PersonHeroCard({
  id, nameRu, nameIast, image, images, eyebrow, identity, summary, chips,
  topLeft, onMore, flash, presentational,
}: {
  id: string;
  nameRu: string;
  nameIast?: string | null;
  image?: string | null;
  images?: string[] | null;     // галерея обложек (слайдер, авто-смена 3с); если пусто — берётся image
  eyebrow?: string | null;      // классификация одной строкой (над именем): «Верховная Личность Бога», «Гопи Враджа · Мадхурья-раса»…
  identity?: string | null;     // тождество: «В лиле Кришны — Лалита» и т.п.
  summary?: string | null;      // краткий эпитет (до 3 строк)
  chips?: string[];
  topLeft?: ReactNode;
  onMore?: () => void;
  flash?: (m: string) => void;
  presentational?: boolean;
}) {
  const { on: favorited, toggle: toggleFav } = useFavorite(`entity:${id}`, { t: nameRu, s: summary || eyebrow || undefined, h: `/${encodeURIComponent(id)}` });
  const imgs = images && images.length ? images : (image ? [image] : []);
  const { idx, next, prev } = useCoverSlider(imgs.length);
  const initial = (nameRu || "·").trim().charAt(0).toUpperCase();
  const len = (nameRu || "").length;
  const nameSize = len > 22 ? 27 : len > 15 ? 32 : 38;

  return (
    <article
      style={{
        position: "relative", width: "100%", aspectRatio: "4 / 5", overflow: "hidden", borderRadius: 20,
        border: "0.5px solid var(--color-hairline, rgba(0,0,0,.08))", background: GRAPHITE,
        boxShadow: "var(--shadow-card, 0 8px 30px rgba(0,0,0,.12))",
        display: "flex", flexDirection: "column", justifyContent: "flex-end",
      }}>
      {imgs.length ? (
        <CoverImages images={imgs} alt={nameRu} idx={idx} />
      ) : (
        <div aria-hidden style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(58% 46% at 50% 36%, rgba(230,190,85,.12), transparent 72%)" }} />
          <span style={{ fontFamily: "var(--font-display)", fontSize: 200, fontWeight: 700, color: "rgba(255,255,255,.07)", lineHeight: 1, userSelect: "none" }}>{initial}</span>
        </div>
      )}
      <div aria-hidden style={{ position: "absolute", insetInline: 0, top: 0, height: 120, pointerEvents: "none", background: "linear-gradient(to bottom, rgba(0,0,0,.55) 0%, rgba(0,0,0,0) 100%)" }} />
      <div aria-hidden style={{ position: "absolute", insetInline: 0, bottom: 0, height: "86%", pointerEvents: "none", background: "linear-gradient(to top, rgba(0,0,0,.95) 0%, rgba(0,0,0,.7) 40%, rgba(0,0,0,0) 100%)" }} />

      {imgs.length > 1 && !presentational && <CoverTapZones onPrev={prev} onNext={next} />}

      {/* TOP: слот (лого/назад) · счётчик + стандартные действия */}
      <div style={{ position: "absolute", insetInline: 20, top: 20, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ display: "flex", alignItems: "center", color: "#fff", minWidth: 0 }}>{topLeft}</span>
        <div data-pdf-no-print style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {imgs.length > 1 && <CoverCounter idx={idx} total={imgs.length} />}
          {!presentational && (
            <>
              <ActionBtn active={favorited} activeColor="#FF453A" ariaLabel="В избранное" onClick={() => toggleFav(flash)}><HeartIcon size={18} filled={favorited} /></ActionBtn>
              {onMore && <ActionBtn ariaLabel="Ещё" onClick={onMore}><MoreIcon size={16} /></ActionBtn>}
            </>
          )}
        </div>
      </div>

      {/* INFO — низ */}
      <div style={{ position: "relative", zIndex: 20, padding: 20, fontFamily: "var(--font-text)", pointerEvents: "none" }}>
        {eyebrow && (
          <div style={{ margin: "0 0 10px", fontSize: 11.5, fontWeight: 700, letterSpacing: "1.4px", textTransform: "uppercase", color: GOLD, lineHeight: 1.3 }}>{eyebrow}</div>
        )}
        <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: nameSize, lineHeight: 1.05, fontWeight: 800, letterSpacing: "-0.03em", color: "#fff" }}>{nameRu}</h1>
        {nameIast && (
          <div style={{ marginTop: 6, fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 16, lineHeight: 1.3, color: "rgba(255,255,255,.72)" }}>{nameIast}</div>
        )}
        {identity && <p style={{ margin: "16px 0 0", fontSize: 15.5, lineHeight: 1.35, fontWeight: 600, letterSpacing: "-0.01em", color: "rgba(255,255,255,.96)" }}>{cleanCardText(identity)}</p>}
        {summary && (
          <p style={{ margin: identity ? "8px 0 0" : "16px 0 0", fontSize: 14, lineHeight: 1.45, fontWeight: 400, letterSpacing: "-0.01em", color: "rgba(255,255,255,.82)", whiteSpace: "pre-line", display: "-webkit-box", WebkitLineClamp: 8, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{cleanCardText(summary)}</p>
        )}
        {chips && chips.length > 0 && (
          <div style={{ marginTop: 18, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
            {chips.map((c) => (
              <span key={c} style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, background: "rgba(255,255,255,.15)", border: "0.5px solid rgba(255,255,255,.18)", height: 26, padding: "0 11px", fontSize: 12.5, lineHeight: 1, fontWeight: 500, letterSpacing: "-0.01em", color: "rgba(255,255,255,.95)" }}>{c}</span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
