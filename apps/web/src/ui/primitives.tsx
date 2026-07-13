/**
 * ISKCON DESIGN — примитивы.
 * Общие UI-кирпичи приложения ISKCON ONE LOVE (ЗКН-Д002).
 *
 * Заменяют разрозненные локальные реализации (SectionHeader был
 * продублирован 25 раз, Card/Chip/Stat — у каждого таба свои).
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
            letterSpacing: tk.tracking.wide,
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
          fontSize: size === 'section' ? tk.text.title3 : tk.text.headline,
          fontWeight: tk.weight.bold,
          lineHeight: tk.leading.snug,
          letterSpacing: tk.tracking.tight,
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
        letterSpacing: tk.tracking.wide,
        textTransform: 'uppercase',
        color: tk.color.brand,
      }}
    >
      {children}
    </div>
  );
}

/* ── Stat — метрика-плитка (значение + подпись) ───────────────────────── */

export function Stat({
  value,
  label,
  tone = 'neutral',
  accent = false,
}: {
  value: ReactNode;
  label: string;
  tone?: SemanticTone;
  /** accent — выделить плитку бренд-подложкой. */
  accent?: boolean;
}) {
  const valueColor = tone === 'neutral' ? (accent ? tk.color.brand : tk.color.label) : toneColors(tone).text;
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        padding: `${tk.space[2]} ${tk.space[3]}`,
        borderRadius: tk.radius.md,
        background: accent ? tk.color.infoSurface : tk.color.fill1,
      }}
    >
      <div
        style={{
          fontSize: tk.text.headline,
          fontWeight: tk.weight.heavy,
          color: valueColor,
          letterSpacing: tk.tracking.tight,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: tk.text.caption2, color: tk.color.label3, marginTop: 2 }}>
        {label}
      </div>
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

/* ── StatusBadge — статус-метка ───────────────────────────────────────── */

export function StatusBadge({ label, tone }: { label: string; tone: SemanticTone }) {
  const c = toneColors(tone);
  return (
    <span
      style={{
        fontSize: tk.text.caption2,
        fontWeight: tk.weight.semibold,
        padding: `2px ${tk.space[2]}`,
        borderRadius: tk.radius.xs,
        background: c.surface,
        color: c.text,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

/* ── KeyValueRow — строка «ключ → значение» ──────────────────────────── */

export function KeyValueRow({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: tk.space[3],
        padding: `${tk.space[2]} 0`,
      }}
    >
      <span style={{ fontSize: tk.text.footnote, color: tk.color.label2 }}>{label}</span>
      <span
        style={{
          fontSize: emphasis ? tk.text.callout : tk.text.footnote,
          fontWeight: emphasis ? tk.weight.bold : tk.weight.semibold,
          color: tk.color.label,
          textAlign: 'right',
        }}
      >
        {value}
      </span>
    </div>
  );
}

/* ── Divider — hairline-разделитель ───────────────────────────────────── */

export function Divider({ inset = 0 }: { inset?: number }) {
  return (
    <div
      style={{
        height: 0.5,
        background: tk.color.glassStroke,
        marginLeft: inset,
        marginRight: inset,
      }}
    />
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
