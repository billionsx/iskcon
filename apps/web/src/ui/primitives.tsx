/**
 * ISKCON DESIGN — примитивы.
 * Общие UI-кирпичи приложения ISKCON ONE LOVE (ЗКН-Д002).
 *
 * Заменяют разрозненные локальные реализации (SectionHeader был
 * продублирован 25 раз, Card/Chip — у каждого таба свои).
 * Один источник правды для шрифтов, цветов, отступов, радиусов.
 */

import type { CSSProperties, ReactNode } from 'react';
import { tk, toneColors, type SemanticTone } from './tokens';

/* ── Card — стандартная стеклянная карточка ───────────────────────────── */

export function Card({
  children,
  padded = true,
  style,
}: {
  children: ReactNode;
  padded?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        borderRadius: tk.radius.lg,
        background: tk.color.surface,
        boxShadow: 'var(--shadow-card)',
        padding: padded ? tk.space[4] : 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ── SectionHeader — eyebrow + заголовок + подзаголовок ───────────────── */

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  size = 'block',
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** block — заголовок блока (17); section — заголовок секции (20). */
  size?: 'block' | 'section';
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tk.space[1] }}>
      {eyebrow && (
        <div
          style={{
            fontSize: tk.text.caption2,
            fontWeight: tk.weight.semibold,
            letterSpacing: tk.type.caption2.letterSpacing,
            textTransform: 'uppercase',
            color: tk.color.brand,
          }}
        >
          {eyebrow}
        </div>
      )}
      <h3
        style={{
          margin: 0,
          // Роль целиком: кегль, интерлиньяж, трекинг и СЕМЕЙСТВО ходят вместе.
          // 20 pt — порог оптического размера (§3.1), поэтому «section» берёт
          // Display, а «card» — Text. Раньше семейство наследовалось от родителя.
          ...(size === 'section' ? tk.type.title3 : tk.type.headline),
          fontWeight: tk.weight.bold,
          color: tk.color.label,
        }}
      >
        {title}
      </h3>
      {subtitle && (
        <p
          style={{
            margin: 0,
            fontSize: tk.text.footnote,
            lineHeight: tk.leading.normal,
            color: tk.color.label2,
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

/* ── Eyebrow — отдельная капс-метка ───────────────────────────────────── */

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: tk.text.caption2,
        fontWeight: tk.weight.semibold,
        letterSpacing: tk.type.caption2.letterSpacing,
        textTransform: 'uppercase',
        color: tk.color.brand,
      }}
    >
      {children}
    </div>
  );
}

/* ── Chip — пилюля-тег ────────────────────────────────────────────────── */

export function Chip({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: SemanticTone;
}) {
  const c = toneColors(tone);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: tk.space[1],
        fontSize: tk.text.footnote,
        fontWeight: tk.weight.medium,
        padding: `${tk.space[1]} ${tk.space[3]}`,
        borderRadius: tk.radius.xs,
        background: tone === 'neutral' ? tk.color.fill1 : c.surface,
        color: tone === 'neutral' ? tk.color.label : c.text,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

/* ── Caption — мелкий вторичный текст (дисклеймеры) ──────────────────── */

export function Caption({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        margin: 0,
        fontSize: tk.text.caption2,
        lineHeight: tk.leading.normal,
        color: tk.color.label3,
      }}
    >
      {children}
    </p>
  );
}

/**
 * ЗКН-Д002 — РУССКОЕ ЧИСЛО: ОДНА ФУНКЦИЯ, А НЕ ЧЕТЫРЕ КОПИИ.
 *
 * Одна и та же `plural` лежала слово-в-слово в BooksHub, KirtansScreen,
 * DhamaScreen и DhamaDetailPage. Четыре копии — четыре места, где правка
 * не доедет. Повторяющийся блок берётся из примитивов.
 *
 *   plural(1, "книга", "книги", "книг")  → «книга»
 *   plural(3, …)                          → «книги»
 *   plural(7, …)                          → «книг»
 */
export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}
