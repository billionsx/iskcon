/**
 * prasad/RecipeCard.tsx — витринная карточка рецепта (showcase).
 *
 * Парная к подробной карточке (RecipeDetail) по тому же принципу, что и книги:
 * витрина + детальная, с действиями ♥ избранное и ⋯ меню (Поделиться / PDF /
 * QR / Задонатить / Сообщить об ошибке) через единый слой cardActions.
 *
 * Фуд-фото у нас пока нет (под нашу будущую съёмку), поэтому «обложка» —
 * типографическая: золотой градиент + санскритское название. Карточка —
 * div role="button" (а не <button>), чтобы внутри жили кнопки действий.
 */
import { recipeBySlug, DIFFICULTY_LABEL, CATEGORIES } from "./prasad";
import { CardActionBtns, favMetaFromCtx, useCardActions } from "../cardActions";
import { recipeCtx } from "./RecipeDetail";

const GOLD = "#D2AA1B";
const ic = (s: number) => ({ width: s, height: s, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const });
const Clock = () => <svg {...ic(13)}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>;
const Gauge = () => <svg {...ic(13)}><path d="M4 18a8 8 0 0 1 16 0" /><path d="M12 18l4-5" /></svg>;

export default function RecipeCard({ slug, onOpen, flash, width = 172 }: {
  slug: string;
  onOpen: (slug: string) => void;
  flash?: (m: string) => void;
  width?: number | string;
}) {
  const { openCardMenu } = useCardActions();
  const r = recipeBySlug(slug);
  if (!r) return null;
  const cat = CATEGORIES.find((c) => c.id === r.category)?.label || "";
  const open = () => onOpen(r.slug);
  return (
    <div role="button" tabIndex={0} onClick={open}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}
      style={{ width, flexShrink: 0, borderRadius: 18, overflow: "hidden", background: "var(--color-glass-thin)", cursor: "pointer", WebkitTapHighlightColor: "transparent", textAlign: "left" }}>
      {/* типографическая обложка */}
      <div style={{ position: "relative", height: 126, display: "grid", placeItems: "center", padding: "12px 14px",
        background: `radial-gradient(130% 120% at 28% 0%, color-mix(in srgb, ${GOLD} 32%, #1b1408) 0%, #0c0a06 78%)` }}>
        {cat && (
          <span style={{ position: "absolute", top: 10, left: 10, padding: "3px 9px", borderRadius: 999, background: "rgba(0,0,0,0.32)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", fontFamily: "var(--font-text)", fontSize: 10, fontWeight: 700, letterSpacing: "0.4px", textTransform: "uppercase", color: GOLD }}>{cat}</span>
        )}
        <span style={{ position: "absolute", top: 8, right: 8 }}>
          <CardActionBtns favKey={`recipe:${r.slug}`} meta={favMetaFromCtx(recipeCtx(r))} flash={flash} dark size={30} onMore={() => openCardMenu(recipeCtx(r))} />
        </span>
        <span style={{ fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 20, lineHeight: 1.15, textAlign: "center", color: "rgba(255,255,255,0.92)", paddingTop: 14 }}>{r.sanskrit || r.title}</span>
      </div>
      {/* подпись */}
      <div style={{ padding: "11px 13px 13px" }}>
        <div style={{ fontFamily: "var(--font-text)", fontSize: 14.5, fontWeight: 600, color: "var(--color-label)", lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: 36 }}>{r.title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginTop: 8, fontFamily: "var(--font-text)", fontSize: 11.5, color: "var(--color-label-3)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ color: GOLD, display: "inline-flex" }}><Clock /></span>{r.minutes} мин</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ color: GOLD, display: "inline-flex" }}><Gauge /></span>{DIFFICULTY_LABEL[r.difficulty]}</span>
        </div>
      </div>
    </div>
  );
}
