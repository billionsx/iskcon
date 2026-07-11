/**
 * ISKCON DESIGN — единая точка входа дизайн-системы (ЗКН-Д002).
 *
 * Компоненты берут кирпичи отсюда, а не изобретают свои:
 *
 *   import { tk, Card, SectionHeader, Chip, Stat } from "./ui";
 *
 * Правила (docs/STANDARD_design.md):
 *   Д001 — размеры/цвета/отступы/радиусы только через `tk.*` или `var(--…)`
 *   Д002 — повторяющийся блок берётся из примитивов, а не копируется
 *   Д004 — планка Apple/iOS 2026: сетка 4pt, тихая эстетика
 *   Д005 — нет обложки → золотой логотип ИСККОН на белом (cover-fallback.svg)
 */
export { tk, toneColors, type SemanticTone } from "./tokens";
export * from "./primitives";
export { renderTerms } from "./Skt";
