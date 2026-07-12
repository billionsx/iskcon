/**
 * prasad/PrasadamScreen.tsx — хаб «Прасадам» (ведическое кулинарное искусство).
 *
 * Полноэкранная пушируемая страница в тёмной эстетике приложения (как «Садхана»
 * и страницы ачарьев). Четыре подраздела (Tier-2 сегменты под sticky-шапкой):
 *
 *   Рецепты      — библиотека блюд с фильтрами по категории и диете;
 *   Подбор       — умный подбор по продуктам дома (ранжирование по покрытию);
 *   Кому дорого  — что особенно любят Божества и ачарьи + связанные рецепты;
 *   Подношение   — чистота, процедура, молитвы и источники-классика.
 *
 * Золото #D2AA1B зарезервировано под действие/акцент; рейка сегментов — белая
 * (положение в навигации), по идиоме SectionSubTabs (tone="dark").
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import RecipeCard from "./RecipeCard";
import {
  CATEGORIES, DIETS, DIFFICULTY_LABEL, PANTRY, PANTRY_LABEL,
  DEITIES, OFFERING_PRINCIPLES, OFFERING_STEPS, OFFERING_PRAYERS, CLASSICS,
  filterRecipes, matchByPantry, recipeBySlug, RECIPE_COUNT,
  type Category, type DietTag, type Recipe,
} from "./prasad";
import { useRecipes } from "./recipesHydrate";
import { FilterChips as NavFilterChips, ScopeTitle, type NavItem } from "../ui/nav4";
import { COOKBOOK } from "./cookbook";
import { HubHeader } from "../ui/HubHeader";

const GOLD = "var(--color-gold)";

/* ───────── иконки (stroke-идиома приложения) ───────── */
const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const ic = (size: number) => ({ width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true as const });
const Back = ({ size = 24 }: { size?: number }) => <svg {...ic(size)}><path {...S} strokeWidth={1.9} d="M15 5l-7 7 7 7" /></svg>;
const Clock = ({ size = 15 }: { size?: number }) => <svg {...ic(size)}><circle {...S} cx="12" cy="12" r="8.5" /><path {...S} d="M12 7.5V12l3 2" /></svg>;
const Gauge = ({ size = 15 }: { size?: number }) => <svg {...ic(size)}><path {...S} d="M4 18a8 8 0 0 1 16 0" /><path {...S} d="M12 18l4-5" /></svg>;
const Lotus = ({ size = 16 }: { size?: number }) => <svg {...ic(size)}><path {...S} d="M12 21c-4.5 0-8-2.5-8-5 1.8 0 3.2.6 4.2 1.4M12 21c4.5 0 8-2.5 8-5-1.8 0-3.2.6-4.2 1.4M12 21c-2.2-1.2-3.5-3.3-3.5-5.6S9.8 11 12 9.8c2.2 1.2 3.5 3.3 3.5 5.6S14.2 19.8 12 21Z" /></svg>;
const Check = ({ size = 15 }: { size?: number }) => <svg {...ic(size)}><path {...S} strokeWidth={2} d="M5 12.5l4.5 4.5L19 7" /></svg>;
const ChevR = ({ size = 18 }: { size?: number }) => <svg {...ic(size)} style={{ flexShrink: 0, color: "var(--color-label-3)" }}><path {...S} d="M9 5l7 7-7 7" /></svg>;

/* ───────── секции навигации ───────── */
/* ЗКН-Н017: витрина «Прасад» — книга «Кухня прасада» это ГЛАВНАЯ страница,
 * рецепты и прочее — разделы Tier-2 (ScopeTitle), а не отдельные экраны.
 * Внутри зала у витрины НЕТ своей кнопки «назад» и своей шапки: навигация — HallTabs. */
type SectionId = "book" | "recipes" | "match" | "deities" | "offering";
const SECTIONS: NavItem[] = [
  { id: "book", label: "Книга" },
  { id: "recipes", label: "Рецепты" },
  { id: "match", label: "Подбор" },
  { id: "deities", label: "Кому дорого" },
  { id: "offering", label: "Подношение" },
];

export default function PrasadamScreen({
  initialSection = "book", onBack, onOpenRecipe, onSectionChange, onOpenBook, onOpenEntity, flash,
}: {
  initialSection?: SectionId;
  onBack: () => void;
  onOpenRecipe: (slug: string) => void;
  onSectionChange?: (id: SectionId) => void;
  onOpenBook: (chapterId?: string) => void;
  onOpenEntity?: (id: string, type: string | null) => void;
  flash?: (m: string) => void;
}) {
  const [section, setSection] = useState<SectionId>(initialSection);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Внешний deep-link (например, переход «Как подносить» с рецепта) меняет секцию.
  useEffect(() => { setSection(initialSection); }, [initialSection]);

  const go = (id: SectionId) => {
    setSection(id);
    onSectionChange?.(id);
    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  };

  return (
    <div ref={scrollRef}>
      {/* ЗКН-Н017: своей шапки и «назад» у витрины НЕТ — навигация зала это HallTabs.
          Разделы — Tier-2 (ScopeTitle) из общего модуля. */}
      <ScopeTitle items={SECTIONS} active={section} onChange={(v) => go(v as SectionId)} ariaLabel="Разделы прасада" />

      <div style={{ padding: "18px 16px 64px", maxWidth: 600, margin: "0 auto" }}>
        {section === "book" && <CookbookInline onOpenChapter={(id) => onOpenBook?.(id)} onOpenRecipe={onOpenRecipe} flash={flash} />}
        {section === "recipes" && <RecipesSection onOpenRecipe={onOpenRecipe} onOpenBook={onOpenBook} flash={flash} />}
        {section === "match" && <MatchSection onOpenRecipe={onOpenRecipe} />}
        {section === "deities" && <DeitiesSection onOpenRecipe={onOpenRecipe} onOpenEntity={onOpenEntity} flash={flash} />}
        {section === "offering" && <OfferingSection />}
      </div>
    </div>
  );
}

/* ═══════════════════ сегменты (рейка, tone=dark) ═══════════════════ */

/* ═══════════════════ общие примитивы ═══════════════════ */

function Eyebrow({ children }: { children: ReactNode }) {
  return <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: GOLD }}>{children}</div>;
}
function SectionTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-title2)", fontWeight: 800, letterSpacing: "-0.025em", color: "var(--color-label)" }}>{children}</h2>
      {sub && <p style={{ margin: "5px 0 0", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", lineHeight: 1.5, color: "var(--color-label-2)" }}>{sub}</p>}
    </div>
  );
}

function GroupedList({ children }: { children: ReactNode[] }) {
  const items = children.filter(Boolean);
  return (
    <div style={{ borderRadius: 18, overflow: "hidden", background: "var(--color-glass-thin)" }}>
      {items.map((child, i) => (
        <div key={i} style={{ borderTop: i ? "0.5px solid var(--color-hairline)" : "none" }}>{child}</div>
      ))}
    </div>
  );
}

/* ═══════════════════ РАЗДЕЛ: РЕЦЕПТЫ ═══════════════════ */
const FEATURED = ["sweet-rice", "gulab-jamun", "paneer-butter-masala", "khichri", "masala-dosa", "rasmalai", "makhan-mishri", "malai-kofta"];

function RecipesSection({ onOpenRecipe, onOpenBook, flash }: { onOpenRecipe: (slug: string) => void; onOpenBook: () => void; flash?: (m: string) => void }) {
  const [category, setCategory] = useState<Category | null>(null);
  /* ⚠️ ЗКН-Ф016 — ЗДЕСЬ ЖИЛ КРАШ, ДАВАВШИЙ БЕЛЫЙ ЭКРАН.
   *
   * Стояло `CATEGORIES.map((c) => ({ id: c, label: c }))`, но CATEGORIES — это
   * УЖЕ `{id, label}[]`. Получалось `{ id: {id,label}, label: {id,label} }`,
   * React пытался отрендерить ОБЪЕКТ как текст и падал:
   *   «Minified React error #31: object with keys {id, label}»
   *
   * Экран Рецептов не открывался ВООБЩЕ — белый лист.
   *
   * Сборка это НЕ ЛОВИЛА: esbuild не проверяет типы. `tsc` ругался, но я счёл
   * ошибку «старой и неважной». Ошибка типа = КРАШ В БРАУЗЕРЕ. */
  const CAT_NAV: NavItem[] = [{ id: "all", label: "Все" }, ...CATEGORIES];
  const DIET_NAV: NavItem[] = [{ id: "any", label: "Любая" }, ...DIETS.map((d) => ({ id: d.id, label: d.label ?? d.id }))];
  const [diet, setDiet] = useState<DietTag | null>(null);
  const rv = useRecipes();   // реактивная гидрация рецептов из БД (сид → БД)
  const results = useMemo(() => filterRecipes(category, diet), [category, diet, rv]);

  return (
    <>
      <SectionTitle sub={`${RECIPE_COUNT} рецептов прасада — традиционная саттвичная кухня без лука и чеснока.`}>Библиотека рецептов</SectionTitle>

      <button type="button" onClick={onOpenBook}
        style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", marginBottom: 4, padding: "16px 16px", borderRadius: 18, border: "none", background: `color-mix(in srgb, ${GOLD} 9%, transparent)`, cursor: "pointer", textAlign: "left", WebkitTapHighlightColor: "transparent" }}>
        <span aria-hidden style={{ flexShrink: 0, width: 42, height: 42, borderRadius: 12, display: "grid", placeItems: "center", background: `color-mix(in srgb, ${GOLD} 16%, transparent)`, color: GOLD }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H18a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2z" /><path d="M8 4v14" /></svg>
        </span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: "var(--text-callout)", fontWeight: 600, color: "var(--color-label)" }}>Книга «Кухня прасада»</span>
          <span style={{ display: "block", marginTop: 2, fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", lineHeight: 1.45, color: "var(--color-label-2)" }}>Философия, продукты и специи, техники, рецепты и подношение</span>
        </span>
        <ChevR />
      </button>

      <div style={{ marginTop: 18 }}><Eyebrow>Рекомендуем</Eyebrow></div>
      <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "12px 0 4px", marginInline: -16, paddingInline: 16, scrollbarWidth: "none" }}>
        {FEATURED.map((s) => <RecipeCard key={s} slug={s} onOpen={onOpenRecipe} flash={flash} />)}
      </div>

      <div style={{ marginTop: 14 }}><Eyebrow>Категории</Eyebrow></div>
      {/* ЗКН-Н006: Tier-3 — общий FilterChips (контур), а не своя копия */}
      <NavFilterChips items={CAT_NAV} active={category ?? "all"}
        onChange={(v) => setCategory(v === "all" ? null : (v as Category))} ariaLabel="Категория" />

      <div style={{ marginTop: 14 }}><Eyebrow>Диета</Eyebrow></div>
      {/* ЗКН-Н006: Tier-4 — общий FilterChips (контур) */}
      <NavFilterChips items={DIET_NAV} active={diet ?? "any"}
        onChange={(v) => setDiet(v === "any" ? null : v)} ariaLabel="Диета" />

      <div style={{ margin: "20px 0 10px", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 600, color: "var(--color-label-3)" }}>
        {results.length === 0 ? "Ничего не найдено — смягчите фильтры." : `Найдено: ${results.length}`}
      </div>

      {results.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
          {results.map((r) => <RecipeCard key={r.slug} slug={r.slug} onOpen={onOpenRecipe} flash={flash} width="100%" />)}
        </div>
      )}
    </>
  );
}

/* ═══════════════════ РАЗДЕЛ: ПОДБОР ПО ПРОДУКТАМ ═══════════════════ */
function MatchSection({ onOpenRecipe }: { onOpenRecipe: (slug: string) => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (key: string) => setSelected((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const clear = () => setSelected(new Set());
  const rv = useRecipes();   // реактивная гидрация рецептов из БД
  const results = useMemo(() => matchByPantry(Array.from(selected)), [selected, rv]);

  return (
    <>
      <SectionTitle sub="Отметьте продукты, которые есть дома, — подберём блюда, ближайшие к классике, и покажем, чего не хватает.">Умный подбор</SectionTitle>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <Eyebrow>Что есть дома</Eyebrow>
        {selected.size > 0 && (
          <button type="button" onClick={clear} style={{ border: "none", background: "none", cursor: "pointer", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 600, color: GOLD, WebkitTapHighlightColor: "transparent" }}>
            Сбросить ({selected.size})
          </button>
        )}
      </div>

      {PANTRY.map((grp) => (
        <div key={grp.group} style={{ marginTop: 14 }}>
          <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 600, color: "var(--color-label-2)", marginBottom: 9 }}>{grp.group}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {grp.items.map((it) => {
              const on = selected.has(it.key);
              return (
                <button key={it.key} type="button" onClick={() => toggle(it.key)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999, cursor: "pointer", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 600, transition: "background .15s, color .15s, border-color .15s", WebkitTapHighlightColor: "transparent",
                    border: on ? `1px solid color-mix(in srgb, ${GOLD} 45%, transparent)` : "1px solid transparent",
                    background: on ? `color-mix(in srgb, ${GOLD} 15%, transparent)` : "var(--color-glass-thin)",
                    color: on ? GOLD : "var(--color-label)" }}>
                  {on && <span style={{ display: "inline-flex" }}><Check /></span>}
                  {it.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div style={{ height: 1, background: "var(--color-hairline)", margin: "24px 0 20px" }} />

      {selected.size === 0 ? (
        <div style={{ padding: "26px 18px", textAlign: "center", borderRadius: 18, background: "var(--color-glass-thin)", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", lineHeight: 1.55, color: "var(--color-label-2)" }}>
          Отметьте хотя бы один продукт — и здесь появятся подходящие блюда, отсортированные по тому, насколько полно подходит ваш набор.
        </div>
      ) : (
        <>
          <div style={{ margin: "0 0 12px", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 600, color: "var(--color-label-3)" }}>
            {results.length === 0 ? "Совпадений нет — добавьте продукты." : `Подходящих блюд: ${results.length}`}
          </div>
          {results.length > 0 && (
            <GroupedList>
              {results.map((m) => {
                const pct = Math.round(m.coverage * 100);
                const full = m.missing.length === 0;
                const missLabels = m.missing.map((k) => PANTRY_LABEL[k] ?? k);
                return (
                  <button key={m.recipe.slug} type="button" onClick={() => onOpenRecipe(m.recipe.slug)}
                    style={{ display: "flex", alignItems: "flex-start", gap: 13, width: "100%", padding: "13px 14px", border: "none", background: "none", cursor: "pointer", textAlign: "left", WebkitTapHighlightColor: "transparent" }}>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-callout)", fontWeight: 600, color: "var(--color-label)" }}>{m.recipe.title}</span>
                        <span style={{ flexShrink: 0, padding: "2px 8px", borderRadius: 999, fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.2px",
                          background: full ? `color-mix(in srgb, ${GOLD} 18%, transparent)` : "var(--color-glass-regular)",
                          color: full ? GOLD : "var(--color-label-2)" }}>
                          {full ? "всё есть" : `${pct}%`}
                        </span>
                      </span>
                      {!full && (
                        <span style={{ display: "block", marginTop: 5, fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", lineHeight: 1.45, color: "var(--color-label-3)" }}>
                          не хватает: {missLabels.join(", ")}
                        </span>
                      )}
                      {full && (
                        <span style={{ display: "block", marginTop: 5, fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", lineHeight: 1.45, color: "var(--color-label-2)" }}>
                          можно готовить из того, что есть
                        </span>
                      )}
                    </span>
                    <ChevR />
                  </button>
                );
              })}
            </GroupedList>
          )}
        </>
      )}
    </>
  );
}

/* ═══════════════════ РАЗДЕЛ: КОМУ ДОРОГО ═══════════════════ */
function DeitiesSection({ onOpenRecipe, onOpenEntity, flash }: { onOpenRecipe: (slug: string) => void; onOpenEntity?: (id: string, type: string | null) => void; flash?: (m: string) => void }) {
  return (
    <>
      <SectionTitle sub="Что особенно дорого Божествам и ачарьям — и рецепты из библиотеки, которыми можно Их порадовать.">Кому подносим</SectionTitle>

      <div style={{ display: "grid", gap: 16 }}>
        {DEITIES.map((d) => {
          const recipes = d.recipeSlugs.map((s) => recipeBySlug(s)).filter(Boolean) as Recipe[];
          return (
            <article key={d.id} style={{ padding: "18px 18px 16px", borderRadius: 20, background: "var(--color-glass-thin)" }}>
              <Eyebrow>{d.epithet}</Eyebrow>
              <h3 style={{ margin: "6px 0 0", fontFamily: "var(--font-display)", fontSize: "var(--text-title3)", fontWeight: 800, letterSpacing: "-0.02em", color: "var(--color-label)" }}>
                {onOpenEntity && d.entityId ? (
                  <button type="button" onClick={() => onOpenEntity(d.entityId, "personality")}
                    style={{ appearance: "none", background: "none", border: "none", padding: 0, font: "inherit", color: "inherit", cursor: "pointer", textDecoration: "underline", textDecorationColor: `color-mix(in srgb, ${GOLD} 50%, transparent)`, textUnderlineOffset: 4 }}>
                    {d.name}
                  </button>
                ) : d.name}
              </h3>
              <p style={{ margin: "9px 0 0", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", lineHeight: 1.55, color: "var(--color-label-2)" }}>{d.blurb}</p>

              <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 7, fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLD }}>
                <Lotus size={14} /> Особенно дорого
              </div>
              <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
                {d.loves.map((l, i) => (
                  <li key={i} style={{ display: "flex", gap: 9, fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", lineHeight: 1.5, color: "var(--color-label)" }}>
                    <span aria-hidden style={{ color: GOLD, flexShrink: 0 }}>·</span>{l}
                  </li>
                ))}
              </ul>

              {recipes.length > 0 && (
                <>
                  <div style={{ marginTop: 16, marginBottom: 9, fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 600, color: "var(--color-label-3)" }}>Чем порадовать</div>
                  <div style={{ display: "flex", gap: 11, overflowX: "auto", paddingBottom: 4, marginInline: -18, paddingInline: 18, scrollbarWidth: "none" }}>
                    {recipes.map((r) => <RecipeCard key={r.slug} slug={r.slug} onOpen={onOpenRecipe} flash={flash} width={150} />)}
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}

/* ═══════════════════ РАЗДЕЛ: ПОДНОШЕНИЕ ═══════════════════ */
function OfferingSection() {
  return (
    <>
      <SectionTitle sub="Прасад — это милость: пища, приготовленная для Господа и предложенная Ему с любовью. Чистота, настрой и порядок подношения.">Как подносить прасад</SectionTitle>

      {/* Принципы */}
      <Eyebrow>Принципы кухни</Eyebrow>
      <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
        {OFFERING_PRINCIPLES.map((p) => (
          <div key={p.title} style={{ padding: "15px 16px", borderRadius: 16, background: "var(--color-glass-thin)" }}>
            <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: 700, color: "var(--color-label)" }}>{p.title}</div>
            <p style={{ margin: "5px 0 0", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", lineHeight: 1.55, color: "var(--color-label-2)" }}>{p.body}</p>
          </div>
        ))}
      </div>

      {/* Процедура */}
      <div style={{ marginTop: 30 }}><Eyebrow>Порядок подношения</Eyebrow></div>
      <ol style={{ margin: "14px 0 0", padding: 0, listStyle: "none" }}>
        {OFFERING_STEPS.map((s, i) => (
          <li key={i} style={{ display: "flex", gap: 14, padding: "0 0 18px", alignItems: "flex-start" }}>
            <span aria-hidden style={{ flexShrink: 0, width: 27, height: 27, borderRadius: "50%", display: "grid", placeItems: "center", background: `color-mix(in srgb, ${GOLD} 16%, transparent)`, color: GOLD, fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 700, marginTop: 1 }}>{i + 1}</span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: "var(--text-callout)", fontWeight: 600, color: "var(--color-label)" }}>{s.t}</span>
              <span style={{ display: "block", marginTop: 3, fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", lineHeight: 1.55, color: "var(--color-label-2)" }}>{s.d}</span>
            </span>
          </li>
        ))}
      </ol>

      {/* Молитвы */}
      <div style={{ marginTop: 14 }}><Eyebrow>Молитвы подношения</Eyebrow></div>
      <p style={{ margin: "8px 0 0", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", lineHeight: 1.5, color: "var(--color-label-3)" }}>
        Прочтите каждую молитву трижды, поднося пищу с почтением.
      </p>
      <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
        {OFFERING_PRAYERS.map((pr) => (
          <div key={pr.to} style={{ padding: "16px 18px", borderRadius: 18, background: "var(--color-glass-thin)", borderLeft: `3px solid ${GOLD}` }}>
            <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLD }}>{pr.to}</div>
            <div style={{ margin: "10px 0 0", display: "grid", gap: 3 }}>
              {pr.lines.map((ln, i) => (
                <div key={i} style={{ fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: "var(--text-callout)", lineHeight: 1.5, color: "var(--color-label)" }}>{ln}</div>
              ))}
            </div>
            <p style={{ margin: "11px 0 0", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", lineHeight: 1.55, color: "var(--color-label-2)" }}>{pr.meaning}</p>
          </div>
        ))}
      </div>

      {/* Классика */}
      <div style={{ marginTop: 30 }}><Eyebrow>Классика — для изучения</Eyebrow></div>
      <p style={{ margin: "8px 0 0", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", lineHeight: 1.5, color: "var(--color-label-3)" }}>
        Канонические труды по кухне прасада, заложившие стандарт ИСККОН.
      </p>
      <div style={{ marginTop: 14 }}>
        <GroupedList>
          {CLASSICS.map((b) => (
            <div key={b.title} style={{ padding: "14px 16px" }}>
              <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: 600, color: "var(--color-label)" }}>{b.title}</div>
              <div style={{ marginTop: 2, fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 600, color: GOLD }}>{b.author}</div>
              <p style={{ margin: "6px 0 0", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", lineHeight: 1.5, color: "var(--color-label-2)" }}>{b.note}</p>
            </div>
          ))}
        </GroupedList>
      </div>
    </>
  );
}


/* ЗКН-Н017: книга «Кухня прасада» — ГЛАВНАЯ страница витрины Прасад.
 * Показываем оглавление; глава открывается переходом (а не раздутием страницы). */
function CookbookInline({ onOpenChapter, onOpenRecipe, flash }: {
  onOpenChapter: (id: string) => void;
  onOpenRecipe: (slug: string) => void;
  flash?: (m: string) => void;
}) {
  void onOpenRecipe; void flash;
  return (
    <div>
      <HubHeader
        eyebrow="Кухня прасада"
        title="Прасад"
        subtitle="Пища, предложенная Господу, — милость. Как готовить, предлагать и вкушать"
      />
      <div style={{ marginTop: 18 }}>
        {COOKBOOK.chapters.map((ch) => (
          <button key={ch.id} type="button" onClick={() => onOpenChapter(ch.id)}
            style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
              padding: "13px 0", background: "none", border: "none",
              borderTop: "0.5px solid var(--color-hairline)", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: 600, color: "var(--color-label)" }}>{ch.title}</span>
              <span style={{ display: "block", marginTop: 2, fontFamily: "var(--font-text)", fontSize: "var(--text-caption)", color: "var(--color-label-3)" }}>{ch.subtitle ?? ch.part}</span>
            </span>
            <span aria-hidden style={{ color: "var(--color-label-3)", flexShrink: 0 }}>›</span>
          </button>
        ))}
      </div>
    </div>
  );
}
