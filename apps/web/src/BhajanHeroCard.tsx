/**
 * BhajanHeroCard — единый карточный модуль бхаджана (юнит-стандарт, зеркало BookHeroCard).
 * Один компонент работает и как ВКБ (showcase-карточка на витрине), и как ПКБ
 * (герой детальной страницы): различие — только слот `topLeft` (лого / назад) и
 * `onOpen` (тап на витрине открывает детальную). Стандартный набор действий:
 * избранное · наушники · ⋯.
 *
 * Данные бхаджана беднее книжных (нет мульти-обложки/iast/описания), поэтому:
 *  • обложка ← hero_image, иначе тёмная подложка GRAPHITE с тихой маской-логотипом;
 *  • заголовок ← name (перенос разрешён — санскритские названия длинные);
 *  • подпись ← author (составитель); чипы ← source_text · section.
 */
import type { ReactNode } from "react";
import { HeartIcon, HeadphonesIcon, MoreIcon } from "./ui/icons";
import { ActionBtn } from "./BookHeroCard";
import { useFavorite, useCardActions } from "./cardActions";

const GRAPHITE = "radial-gradient(120% 80% at 50% 0%, #3a3a40 0%, #2a2a2f 45%, #1b1b1f 100%)";

export interface BhajanHeroData {
  slug: string;
  name: string;
  author: string | null;
  heroImage: string | null;
  sourceText: string | null;
  section: string | null;
}

export function BhajanHeroCard({ bhajan, topLeft, onOpen, flash, presentational }: {
  bhajan: BhajanHeroData;
  topLeft?: ReactNode;
  onOpen?: () => void;
  flash?: (m: string) => void;
  presentational?: boolean;
}) {
  const { on: favorited, toggle: toggleFav } = useFavorite(`bhajan:${bhajan.slug}`);
  const { openCardMenu } = useCardActions();
  const chips = [bhajan.sourceText, bhajan.section].filter(Boolean) as string[];
  // Реальная обложка — только если это не общий дженерик-плейсхолдер ингеста
  // (один iskcon.png на все бхаджаны). Иначе — тёмное панно GRAPHITE с маской-лого.
  const realCover = !!bhajan.heroImage && !/iskcon\.png/i.test(bhajan.heroImage);
  const openMore = () => openCardMenu({
    type: "bhajan", id: bhajan.slug, title: bhajan.name, subtitle: bhajan.author || undefined,
    url: `https://gaurangers.com/bhajan/${encodeURIComponent(bhajan.slug)}`,
    context: `Бхаджан · ${bhajan.name} · /bhajan/${bhajan.slug}`,
  });

  return (
    <article
      style={{
        position: "relative", width: "100%", aspectRatio: "4 / 5", overflow: "hidden", borderRadius: 20,
        border: "0.5px solid var(--color-hairline, rgba(0,0,0,.08))", background: GRAPHITE,
        boxShadow: "var(--shadow-card, 0 8px 30px rgba(0,0,0,.12))",
        display: "flex", flexDirection: "column", justifyContent: "flex-end",
      }}>
      {realCover ? (
        <img src={bhajan.heroImage!} alt={bhajan.name} loading="eager" decoding="async" draggable={false}
          style={{ position: "absolute", inset: 0, height: "100%", width: "100%", objectFit: "cover" }} />
      ) : (
        <div aria-hidden style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "rgba(255,255,255,.07)" }}>
          <span style={{ display: "block", height: 140, width: 140, backgroundColor: "currentColor", WebkitMaskImage: "url(/iskcon-sign.svg)", maskImage: "url(/iskcon-sign.svg)", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskPosition: "center", maskPosition: "center" }} />
        </div>
      )}
      <div aria-hidden style={{ position: "absolute", insetInline: 0, top: 0, height: 120, pointerEvents: "none", background: "linear-gradient(to bottom, rgba(0,0,0,.55) 0%, rgba(0,0,0,0) 100%)" }} />
      <div aria-hidden style={{ position: "absolute", insetInline: 0, bottom: 0, height: "78%", pointerEvents: "none", background: "linear-gradient(to top, rgba(0,0,0,.92) 0%, rgba(0,0,0,.6) 42%, rgba(0,0,0,0) 100%)" }} />

      {onOpen && !presentational && <button type="button" aria-label="Открыть бхаджан" onClick={onOpen} style={{ position: "absolute", inset: 0, zIndex: 10, background: "none", border: "none", cursor: "pointer" }} />}

      {/* TOP: topLeft (лого / назад) · действия */}
      <div style={{ position: "absolute", insetInline: 20, top: 20, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ display: "flex", alignItems: "center", color: "#fff", minWidth: 0 }}>{topLeft}</span>
        {!presentational && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ActionBtn active={favorited} activeColor="#FF453A" ariaLabel="В избранное" onClick={() => toggleFav(flash)}><HeartIcon size={18} filled={favorited} /></ActionBtn>
            <ActionBtn ariaLabel="Слушать" onClick={() => flash?.("Аудио — скоро")}><HeadphonesIcon size={18} /></ActionBtn>
            <ActionBtn ariaLabel="Ещё" onClick={openMore}><MoreIcon size={16} /></ActionBtn>
          </div>
        )}
      </div>

      {/* INFO — низ */}
      <div onClick={presentational ? undefined : onOpen} style={{ position: "relative", zIndex: 20, padding: 20, cursor: onOpen && !presentational ? "pointer" : "default", fontFamily: "var(--font-text)", pointerEvents: "none" }}>
        <h3 style={{ margin: 0, fontSize: 31, lineHeight: 1.08, fontWeight: 800, letterSpacing: "-0.02em", color: "#fff" }}>{bhajan.name}</h3>
        {bhajan.author && <p style={{ margin: "12px 0 0", fontSize: 15, lineHeight: 1.35, fontWeight: 400, letterSpacing: "-0.01em", color: "rgba(255,255,255,.92)" }}>{bhajan.author}</p>}
        {chips.length > 0 && (
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
