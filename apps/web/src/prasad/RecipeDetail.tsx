/**
 * prasad/RecipeDetail.tsx — страница одного рецепта прасада.
 *
 * Полноэкранная пушируемая страница в тёмной эстетике приложения (как ридер /
 * страница ачарьи): sticky-шапка с «назад», заголовок с транслитерацией,
 * метаданные (время · сложность · порции · диеты), кому подносят, состав,
 * пошаговое приготовление, девотический совет и переход к «Как предлагать».
 */
import { recipeBySlug, deityById, DIFFICULTY_LABEL, DIETS, type Recipe } from "./prasad";
import { chapterForRecipe } from "./cookbook";
import { CardActionBtns, favMetaFromCtx, useCardActions, type CardCtx } from "../cardActions";
import { NotesAtSource } from "../NotesAtSource";
import { ROUTES, url } from "../routes";

const ORIGIN = typeof window !== "undefined" ? window.location.origin : "https://gaurangers.com";
export function recipeCtx(r: { slug: string; title: string; subtitle: string }): CardCtx {
  return {
    type: "recipe", id: r.slug, title: r.title, subtitle: r.subtitle,
    url: url(ROUTES.recipe(r.slug)),
    context: `Рецепт · ${r.title} · /prasadam/recipe/${r.slug}`,
  };
}

const GOLD = "var(--color-gold)";

/* ───────── иконки (STROKE-стиль приложения) ───────── */
const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const ic = (size: number) => ({ width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true as const });
const Back = ({ size = 24 }: { size?: number }) => <svg {...ic(size)}><path {...S} strokeWidth={1.9} d="M15 5l-7 7 7 7" /></svg>;
const Clock = ({ size = 17 }: { size?: number }) => <svg {...ic(size)}><circle {...S} cx="12" cy="12" r="8.5" /><path {...S} d="M12 7.5V12l3 2" /></svg>;
const Gauge = ({ size = 17 }: { size?: number }) => <svg {...ic(size)}><path {...S} d="M4 18a8 8 0 0 1 16 0" /><path {...S} d="M12 18l4-5" /></svg>;
const Bowl = ({ size = 17 }: { size?: number }) => <svg {...ic(size)}><path {...S} d="M3 11h18a8 8 0 0 1-16 0z" /><path {...S} d="M8.5 7.5c0-1.6 1-2.4 1-3.6M12.5 7.5c0-1.6 1-2.4 1-3.6" /></svg>;
const Lotus = ({ size = 17 }: { size?: number }) => <svg {...ic(size)}><path {...S} d="M12 21c-4.5 0-8-2.5-8-5 1.8 0 3.2.6 4.2 1.4M12 21c4.5 0 8-2.5 8-5-1.8 0-3.2.6-4.2 1.4M12 21c-2.2-1.2-3.5-3.3-3.5-5.6S9.8 11 12 9.8c2.2 1.2 3.5 3.3 3.5 5.6S14.2 19.8 12 21Z" /></svg>;
const ChevR = ({ size = 18 }: { size?: number }) => <svg {...ic(size)} style={{ flexShrink: 0, color: "var(--color-label-3)" }}><path {...S} d="M9 5l7 7-7 7" /></svg>;

function MetaPill({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999, background: "var(--color-glass-thin)", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 500, color: "var(--color-label)" }}>
      <span style={{ color: GOLD, display: "inline-flex" }}>{icon}</span>
      {children}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ margin: "0 0 12px", fontFamily: "var(--font-display)", fontSize: "var(--text-title3)", fontWeight: 800, letterSpacing: "-0.02em", color: "var(--color-label)" }}>{children}</h2>;
}

export default function RecipeDetail({ slug, onBack, onOpenRecipe, onOpenOffering, onOpenBookChapter, onOpenEntity, flash }: {
  slug: string;
  onBack: () => void;
  onOpenRecipe: (slug: string) => void;
  onOpenOffering: () => void;
  onOpenBookChapter?: (chapterId: string) => void;
  onOpenEntity?: (id: string, type: string | null) => void;
  flash?: (m: string) => void;
}) {
  const { openCardMenu } = useCardActions();
  const recipe: Recipe | undefined = recipeBySlug(slug);

  if (!recipe) {
    return (
      <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "var(--color-bg)" }}>
        <Header onBack={onBack} title="Рецепт" />
        <div style={{ padding: 40, textAlign: "center", color: "var(--color-label-2)", fontFamily: "var(--font-text)" }}>
          Рецепт не найден.
        </div>
      </div>
    );
  }

  const dietLabels = recipe.diets.map((d) => DIETS.find((x) => x.id === d)?.label).filter(Boolean) as string[];
  const cooks = recipe.favoredBy.map((id) => deityById(id)).filter(Boolean);

  return (
    <div style={{ height: "100dvh", overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch", background: "var(--color-bg)", color: "var(--color-label)" }}>
      <Header onBack={onBack} title="Прасадам" right={<CardActionBtns plain favKey={`recipe:${recipe.slug}`} meta={favMetaFromCtx(recipeCtx(recipe))} flash={flash} size={32} onMore={() => openCardMenu(recipeCtx(recipe))} />} />

      <div style={{ padding: "8px 16px 56px", maxWidth: 560, margin: "0 auto" }}>
        {/* Заголовок */}
        <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: GOLD }}>
          {recipe.region ?? "Прасад"}
        </div>
        <h1 style={{ margin: "6px 0 0", fontFamily: "var(--font-display)", fontSize: "var(--text-title1)", fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.08, color: "var(--color-label)" }}>
          {recipe.title}
        </h1>
        {recipe.sanskrit && (
          <div style={{ margin: "6px 0 0", fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: "var(--text-body)", color: "var(--color-label-3)" }}>
            {recipe.sanskrit}
          </div>
        )}
        <p style={{ margin: "12px 0 0", fontFamily: "var(--font-text)", fontSize: "var(--text-callout)", lineHeight: 1.55, color: "var(--color-label-2)" }}>
          {recipe.subtitle}
        </p>

        {/* Метаданные */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 18 }}>
          <MetaPill icon={<Clock />}>≈ {recipe.minutes} мин</MetaPill>
          <MetaPill icon={<Gauge />}>{DIFFICULTY_LABEL[recipe.difficulty]}</MetaPill>
          <MetaPill icon={<Bowl />}>{recipe.servings}</MetaPill>
        </div>

        {/* Диеты */}
        {dietLabels.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            {dietLabels.map((d) => (
              <span key={d} style={{ padding: "5px 11px", borderRadius: 999, border: `1px solid color-mix(in srgb, ${GOLD} 40%, transparent)`, fontFamily: "var(--font-text)", fontSize: "var(--text-caption)", fontWeight: 600, color: GOLD }}>
                {d}
              </span>
            ))}
          </div>
        )}

        {/* Кому подносят */}
        {cooks.length > 0 && (
          <div style={{ marginTop: 18, padding: "13px 15px", borderRadius: 16, background: `color-mix(in srgb, ${GOLD} 9%, transparent)` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: "var(--font-text)", fontSize: "var(--text-caption)", fontWeight: 700, letterSpacing: "0.4px", textTransform: "uppercase", color: GOLD }}>
              <Lotus size={15} /> Кому особенно дорого
            </div>
            <div style={{ marginTop: 6, fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", lineHeight: 1.5, color: "var(--color-label)" }}>
              {cooks.map((c, i) => (
                <span key={c!.id}>
                  {i > 0 && <span style={{ color: "var(--color-label-3)" }}> · </span>}
                  {c!.entityId && onOpenEntity ? (
                    <button type="button" onClick={() => onOpenEntity(c!.entityId, "personality")}
                      style={{ appearance: "none", background: "none", border: "none", padding: 0, font: "inherit", color: "var(--color-label)", cursor: "pointer", textDecoration: "underline", textDecorationColor: `color-mix(in srgb, ${GOLD} 55%, transparent)`, textUnderlineOffset: 3 }}>
                      {c!.name}
                    </button>
                  ) : c!.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Состав */}
        <section style={{ marginTop: 30 }}>
          <SectionTitle>Состав</SectionTitle>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", borderRadius: 18, overflow: "hidden", background: "var(--color-glass-thin)" }}>
            {recipe.ingredients.map((ing, i) => (
              <li key={i} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 14, padding: "13px 16px", borderTop: i ? "0.5px solid var(--color-hairline)" : "none" }}>
                <span style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", color: "var(--color-label)" }}>{ing.item}</span>
                {ing.amount && <span style={{ flexShrink: 0, fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 600, color: "var(--color-label-3)", textAlign: "right" }}>{ing.amount}</span>}
              </li>
            ))}
          </ul>
        </section>

        {/* Приготовление */}
        <section style={{ marginTop: 30 }}>
          <SectionTitle>Приготовление</SectionTitle>
          <ol style={{ margin: 0, padding: 0, listStyle: "none", counterReset: "step" }}>
            {recipe.steps.map((step, i) => (
              <li key={i} style={{ display: "flex", gap: 14, padding: "0 0 18px", alignItems: "flex-start" }}>
                <span aria-hidden style={{ flexShrink: 0, width: 27, height: 27, borderRadius: "50%", display: "grid", placeItems: "center", background: `color-mix(in srgb, ${GOLD} 16%, transparent)`, color: GOLD, fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 700, marginTop: 1 }}>
                  {i + 1}
                </span>
                <span style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-callout)", lineHeight: 1.55, color: "var(--color-label)", paddingTop: 2 }}>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Девотический совет */}
        {recipe.note && (
          <section style={{ marginTop: 8, padding: "18px 18px", borderRadius: 18, background: "var(--color-glass-thin)", borderLeft: `3px solid ${GOLD}` }}>
            <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: GOLD, marginBottom: 7 }}>
              Настрой повара
            </div>
            <p style={{ margin: 0, fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: "var(--text-callout)", lineHeight: 1.6, color: "var(--color-label)" }}>
              {recipe.note}
            </p>
          </section>
        )}

        {/* Переход к подношению */}
        <button type="button" onClick={onOpenOffering}
          style={{ display: "flex", alignItems: "center", gap: 13, width: "100%", marginTop: 26, padding: "16px 16px", borderRadius: 18, border: "none", background: "var(--color-glass-thin)", color: "var(--color-label)", cursor: "pointer", textAlign: "left", WebkitTapHighlightColor: "transparent" }}>
          <span aria-hidden style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center", background: `color-mix(in srgb, ${GOLD} 14%, transparent)`, color: GOLD }}><Lotus size={20} /></span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: "var(--text-callout)", fontWeight: 600, color: "var(--color-label)" }}>Как подносить прасад</span>
            <span style={{ display: "block", marginTop: 2, fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", lineHeight: 1.45, color: "var(--color-label-2)" }}>Молитвы, процедура и настрой подношения</span>
          </span>
          <ChevR />
        </button>

        {/* Читать в книге «Кухня прасада» */}
        <div style={{ marginTop: 14 }}><NotesAtSource kind="recipe" refId={`recipe:${recipe.slug}`} accent={GOLD} /></div>
        {onOpenBookChapter && (() => {
          const ch = chapterForRecipe(recipe.slug);
          if (!ch) return null;
          return (
            <button type="button" onClick={() => onOpenBookChapter(ch.id)}
              style={{ display: "flex", alignItems: "center", gap: 13, width: "100%", marginTop: 10, padding: "16px 16px", borderRadius: 18, border: "none", background: "var(--color-glass-thin)", color: "var(--color-label)", cursor: "pointer", textAlign: "left", WebkitTapHighlightColor: "transparent" }}>
              <span aria-hidden style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center", background: `color-mix(in srgb, ${GOLD} 14%, transparent)`, color: GOLD }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H18a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2z" /><path d="M8 4v14" /></svg>
              </span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: "var(--text-callout)", fontWeight: 600, color: "var(--color-label)" }}>Читать в книге</span>
                <span style={{ display: "block", marginTop: 2, fontFamily: "var(--font-text)", fontSize: 12.5, lineHeight: 1.45, color: "var(--color-label-2)" }}>«Кухня прасада» · {ch.title}</span>
              </span>
              <ChevR />
            </button>
          );
        })()}
      </div>
    </div>
  );
}

/* ───────── sticky-шапка ───────── */
function Header({ onBack, title, right }: { onBack: () => void; title: string; right?: React.ReactNode }) {
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 30, display: "flex", alignItems: "center", gap: 4, padding: "10px 8px", background: "var(--color-glass-nav)", backdropFilter: "blur(40px) saturate(180%)", WebkitBackdropFilter: "blur(40px) saturate(180%)", borderBottom: "0.5px solid var(--color-hairline)" }}>
      <button type="button" aria-label="Назад" onClick={onBack}
        style={{ display: "grid", placeItems: "center", width: 40, height: 40, borderRadius: "50%", border: "none", background: "none", color: "var(--color-label)", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
        <Back />
      </button>
      <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-text)", fontSize: "var(--text-callout)", fontWeight: 600, letterSpacing: "-0.01em", color: "var(--color-label)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</span>
      {right && <span style={{ flexShrink: 0, marginRight: 4 }}>{right}</span>}
    </header>
  );
}
