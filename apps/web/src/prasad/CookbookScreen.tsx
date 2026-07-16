/**
 * prasad/CookbookScreen.tsx — ридер книги «Кухня прасада».
 *
 * Полноэкранная пушируемая страница в тёмной эстетике приложения. Два вида,
 * управляемые маршрутом: оглавление (`/prasadam/book`) и глава
 * (`/prasad/book/:id`). «Назад» всегда снимает один уровень навигации
 * (глава → оглавление → «Прасадам»). Разделы рецептов тянут блюда из RECIPES и
 * ведут на интерактивные карточки; глава подношения рендерит молитвы.
 *
 * Контент — модуль cookbook.ts (оригинальная проза). См. шапку cookbook.ts.
 */
import type { ReactNode } from "react";
import { COOKBOOK, chapterById, chapterRecipes, COOKBOOK_PRAYERS, type Block, type Chapter } from "./cookbook";
import { DIFFICULTY_LABEL } from "./prasad";
import { CardActionBtns, favMetaFromCtx, useCardActions, type CardCtx } from "../cardActions";
import { ROUTES, url } from "../routes";

const GOLD = "var(--color-gold)";

const ORIGIN = typeof window !== "undefined" ? window.location.origin : "https://gaurangers.com";
const cookbookCtx: CardCtx = {
  type: "cookbook", id: "cookbook", title: COOKBOOK.title, subtitle: COOKBOOK.subtitle,
  url: url(ROUTES.cookbook()), context: `Книга · ${COOKBOOK.title} · ${ROUTES.cookbook()}`,
};

/* ───────── иконки ───────── */
const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const ic = (size: number) => ({ width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true as const });
const Back = ({ size = 24 }: { size?: number }) => <svg {...ic(size)}><path {...S} strokeWidth={1.9} d="M15 5l-7 7 7 7" /></svg>;
const Clock = ({ size = 15 }: { size?: number }) => <svg {...ic(size)}><circle {...S} cx="12" cy="12" r="8.5" /><path {...S} d="M12 7.5V12l3 2" /></svg>;
const Gauge = ({ size = 15 }: { size?: number }) => <svg {...ic(size)}><path {...S} d="M4 18a8 8 0 0 1 16 0" /><path {...S} d="M12 18l4-5" /></svg>;
const ChevR = ({ size = 18 }: { size?: number }) => <svg {...ic(size)} style={{ flexShrink: 0, color: "var(--color-label-3)" }}><path {...S} d="M9 5l7 7-7 7" /></svg>;

function Header({ onBack, title, right }: { onBack: () => void; title: string; right?: ReactNode }) {
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

export default function CookbookScreen({ chapterId, onBack, onOpenChapter, onOpenRecipe, flash }: {
  chapterId: string | null;
  onBack: () => void;
  onOpenChapter: (id: string) => void;
  onOpenRecipe: (slug: string) => void;
  flash?: (m: string) => void;
}) {
  const chapter = chapterId ? chapterById(chapterId) : null;
  if (chapterId && !chapter) {
    return (
      <div style={{ height: "100dvh", background: "var(--color-bg)" }}>
        <Header onBack={onBack} title="Кухня прасада" />
        <div style={{ padding: 40, textAlign: "center", color: "var(--color-label-2)", fontFamily: "var(--font-text)" }}>Глава не найдена.</div>
      </div>
    );
  }
  return chapter ? <ChapterView chapter={chapter} onBack={onBack} onOpenChapter={onOpenChapter} onOpenRecipe={onOpenRecipe} /> : <Contents onBack={onBack} onOpenChapter={onOpenChapter} flash={flash} />;
}

/* ═══════════════════ ОГЛАВЛЕНИЕ ═══════════════════ */
function Contents({ onBack, onOpenChapter, flash }: { onBack: () => void; onOpenChapter: (id: string) => void; flash?: (m: string) => void }) {
  const { openCardMenu } = useCardActions();
  // Группировка глав по рубрике (part) с сохранением порядка.
  const parts: { part: string; items: Chapter[] }[] = [];
  for (const ch of COOKBOOK.chapters) {
    let g = parts.find((p) => p.part === ch.part);
    if (!g) { g = { part: ch.part, items: [] }; parts.push(g); }
    g.items.push(ch);
  }
  return (
    <div style={{ height: "100dvh", overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch", background: "var(--color-bg)", color: "var(--color-label)" }}>
      <Header onBack={onBack} title="Кухня прасада" right={<CardActionBtns plain favKey="book:cookbook" meta={favMetaFromCtx(cookbookCtx)} flash={flash} size={32} onMore={() => openCardMenu(cookbookCtx)} />} />
      <div style={{ padding: "8px 16px 64px", maxWidth: 600, margin: "0 auto" }}>
        <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: GOLD }}>Книга библиотеки</div>
        <h1 style={{ margin: "6px 0 0", fontFamily: "var(--font-display)", fontSize: "var(--text-display)", fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.05, color: "var(--color-label)" }}>{COOKBOOK.title}</h1>
        <div style={{ margin: "6px 0 0", fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: "var(--text-body)", color: "var(--color-label-3)" }}>{COOKBOOK.iast}</div>
        <p style={{ margin: "14px 0 0", fontFamily: "var(--font-text)", fontSize: "var(--text-callout)", lineHeight: 1.6, color: "var(--color-label-2)" }}>{COOKBOOK.blurb}</p>

        {parts.map((g) => (
          <section key={g.part} style={{ marginTop: 28 }}>
            <div style={{ margin: "0 2px 10px", fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: "var(--color-label-3)" }}>{g.part}</div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", borderRadius: 18, overflow: "hidden", background: "var(--color-glass-thin)" }}>
              {g.items.map((ch, i) => (
                <li key={ch.id} style={{ borderTop: i ? "0.5px solid var(--color-hairline)" : "none" }}>
                  <button type="button" onClick={() => onOpenChapter(ch.id)}
                    style={{ display: "flex", alignItems: "center", gap: 13, width: "100%", padding: "14px 16px", border: "none", background: "none", cursor: "pointer", textAlign: "left", font: "inherit", WebkitTapHighlightColor: "transparent" }}>
                    {ch.number && (
                      <span aria-hidden style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 9, display: "grid", placeItems: "center", background: `color-mix(in srgb, ${GOLD} 14%, transparent)`, color: GOLD, fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 700 }}>{ch.number}</span>
                    )}
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: "var(--text-callout)", fontWeight: 600, color: "var(--color-label)" }}>{ch.title}</span>
                      {ch.subtitle && <span style={{ display: "block", marginTop: 2, fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", lineHeight: 1.4, color: "var(--color-label-2)" }}>{ch.subtitle}</span>}
                    </span>
                    <ChevR />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════ ГЛАВА ═══════════════════ */
function ChapterView({ chapter, onBack, onOpenChapter, onOpenRecipe }: { chapter: Chapter; onBack: () => void; onOpenChapter: (id: string) => void; onOpenRecipe: (slug: string) => void }) {
  const idx = COOKBOOK.chapters.findIndex((c) => c.id === chapter.id);
  const prev = idx > 0 ? COOKBOOK.chapters[idx - 1] : null;
  const next = idx >= 0 && idx < COOKBOOK.chapters.length - 1 ? COOKBOOK.chapters[idx + 1] : null;
  const recipes = chapter.recipesOf ? chapterRecipes(chapter.recipesOf) : [];

  return (
    <div style={{ height: "100dvh", overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch", background: "var(--color-bg)", color: "var(--color-label)" }}>
      <Header onBack={onBack} title={COOKBOOK.title} />
      <div style={{ padding: "8px 16px 56px", maxWidth: 600, margin: "0 auto" }}>
        <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: GOLD }}>
          {chapter.number ? `${chapter.part} · Раздел ${chapter.number}` : chapter.part}
        </div>
        <h1 style={{ margin: "6px 0 0", fontFamily: "var(--font-display)", fontSize: "var(--text-title1)", fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.1, color: "var(--color-label)" }}>{chapter.title}</h1>
        {chapter.subtitle && <p style={{ margin: "8px 0 0", fontFamily: "var(--font-text)", fontSize: "var(--text-callout)", lineHeight: 1.55, color: "var(--color-label-2)" }}>{chapter.subtitle}</p>}

        <div style={{ marginTop: 22 }}>
          {(chapter.blocks ?? []).map((b, i) => <BlockView key={i} block={b} />)}
        </div>

        {/* Раздел рецептов */}
        {recipes.length > 0 && (
          <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none", borderRadius: 18, overflow: "hidden", background: "var(--color-glass-thin)" }}>
            {recipes.map((r, i) => (
              <li key={r.slug} style={{ borderTop: i ? "0.5px solid var(--color-hairline)" : "none" }}>
                <button type="button" onClick={() => onOpenRecipe(r.slug)}
                  style={{ display: "flex", alignItems: "center", gap: 13, width: "100%", padding: "13px 16px", border: "none", background: "none", cursor: "pointer", textAlign: "left", font: "inherit", WebkitTapHighlightColor: "transparent" }}>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: "var(--text-callout)", fontWeight: 600, color: "var(--color-label)" }}>{r.title}</span>
                    <span style={{ display: "block", marginTop: 2, fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", lineHeight: 1.4, color: "var(--color-label-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.subtitle}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 12, marginTop: 6, fontFamily: "var(--font-text)", fontSize: "var(--text-caption)", color: "var(--color-label-3)" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ color: GOLD, display: "inline-flex" }}><Clock /></span>{r.minutes} мин</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ color: GOLD, display: "inline-flex" }}><Gauge /></span>{DIFFICULTY_LABEL[r.difficulty]}</span>
                    </span>
                  </span>
                  <ChevR />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Молитвы подношения */}
        {chapter.prayers && (
          <div style={{ marginTop: 4, display: "grid", gap: 14 }}>
            {COOKBOOK_PRAYERS.map((pr) => (
              <div key={pr.to} style={{ padding: "16px 18px", borderRadius: 18, background: "var(--color-glass-thin)", borderLeft: `3px solid ${GOLD}` }}>
                <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLD }}>{pr.to}</div>
                <div style={{ margin: "10px 0 0", display: "grid", gap: 3 }}>
                  {pr.lines.map((ln, i) => <div key={i} style={{ fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: "var(--text-callout)", lineHeight: 1.5, color: "var(--color-label)" }}>{ln}</div>)}
                </div>
                <p style={{ margin: "11px 0 0", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", lineHeight: 1.55, color: "var(--color-label-2)" }}>{pr.meaning}</p>
              </div>
            ))}
          </div>
        )}

        {/* Переходы между главами */}
        <div style={{ display: "flex", gap: 10, marginTop: 34 }}>
          {prev && (
            <button type="button" onClick={() => onOpenChapter(prev.id)}
              style={{ flex: 1, minWidth: 0, padding: "13px 14px", borderRadius: 14, border: "none", background: "var(--color-glass-thin)", cursor: "pointer", textAlign: "left", WebkitTapHighlightColor: "transparent" }}>
              <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", color: "var(--color-label-3)" }}>Предыдущая</span>
              <span style={{ display: "block", marginTop: 2, fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 600, color: "var(--color-label)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{prev.title}</span>
            </button>
          )}
          {next && (
            <button type="button" onClick={() => onOpenChapter(next.id)}
              style={{ flex: 1, minWidth: 0, padding: "13px 14px", borderRadius: 14, border: "none", background: "var(--color-glass-thin)", cursor: "pointer", textAlign: "right", WebkitTapHighlightColor: "transparent" }}>
              <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", color: "var(--color-label-3)" }}>Следующая</span>
              <span style={{ display: "block", marginTop: 2, fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 600, color: "var(--color-label)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{next.title}</span>
            </button>
          )}
        </div>
        <button type="button" onClick={onBack}
          style={{ width: "100%", marginTop: 10, padding: "13px", borderRadius: 14, border: "0.5px solid var(--color-hairline)", background: "none", color: GOLD, fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: 600, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
          К оглавлению
        </button>
      </div>
    </div>
  );
}

/* ───────── рендер прозаических блоков ───────── */
function BlockView({ block }: { block: Block }) {
  if (block.type === "h") {
    return <h2 style={{ margin: "24px 0 10px", fontFamily: "var(--font-display)", fontSize: "var(--text-title3)", fontWeight: 800, letterSpacing: "-0.02em", color: "var(--color-label)" }}>{block.text}</h2>;
  }
  if (block.type === "p") {
    return <p style={{ margin: "0 0 14px", fontFamily: "var(--font-text)", fontSize: "var(--text-callout)", lineHeight: 1.62, color: "var(--color-label)" }}>{block.text}</p>;
  }
  if (block.type === "ul") {
    return (
      <ul style={{ margin: "0 0 16px", padding: 0, listStyle: "none", display: "grid", gap: 9 }}>
        {block.items.map((it, i) => (
          <li key={i} style={{ display: "flex", gap: 10, fontFamily: "var(--font-text)", fontSize: "var(--text-callout)", lineHeight: 1.55, color: "var(--color-label)" }}>
            <span aria-hidden style={{ color: GOLD, flexShrink: 0, fontWeight: 700 }}>·</span>{it}
          </li>
        ))}
      </ul>
    );
  }
  if (block.type === "dl") {
    return (
      <div style={{ margin: "0 0 16px", borderRadius: 16, overflow: "hidden", background: "var(--color-glass-thin)" }}>
        {block.items.map((it, i) => (
          <div key={i} style={{ padding: "13px 16px", borderTop: i ? "0.5px solid var(--color-hairline)" : "none" }}>
            <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: 700, color: "var(--color-label)" }}>{it.t}</div>
            <div style={{ marginTop: 3, fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", lineHeight: 1.5, color: "var(--color-label-2)" }}>{it.d}</div>
          </div>
        ))}
      </div>
    );
  }
  // note
  return (
    <div style={{ margin: "4px 0 18px", padding: "16px 18px", borderRadius: 16, background: "var(--color-glass-thin)", borderLeft: `3px solid ${GOLD}` }}>
      <p style={{ margin: 0, fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: "var(--text-callout)", lineHeight: 1.6, color: "var(--color-label)" }}>{block.text}</p>
    </div>
  );
}
