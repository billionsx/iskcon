/**
 * ISKCON DESIGN — токены.
 * Дизайн-система приложения ISKCON ONE LOVE. Единственный источник размеров,
 * цветов, отступов и радиусов (ЗКН-Д001). Магические числа в компонентах запрещены.
 *
 * TS-зеркало CSS-переменных из globals.css. Компоненты пишут
 * `tk.text.footnote` вместо магического числа `13` — единый
 * золотой стандарт интерфейса карточки.
 *
 * Значения — строки `var(--…)`, тема применяется автоматически.
 */

export const tk = {
  /** Размеры шрифта — роли Dynamic Type. */
  text: {
    caption2: 'var(--text-caption2)', // 11
    caption: 'var(--text-caption)', //  12
    footnote: 'var(--text-footnote)', // 13
    subhead: 'var(--text-subhead)', //  15
    callout: 'var(--text-callout)', //  16
    body: 'var(--text-body)', //        17
    headline: 'var(--text-headline)', // 17
    title3: 'var(--text-title3)', //    20
    title2: 'var(--text-title2)', //    22
    title1: 'var(--text-title1)', //    28
    display: 'var(--text-display)', //  34
  },
  /** Жирности. */
  weight: {
    regular: 'var(--weight-regular)', //   400
    medium: 'var(--weight-medium)', //     500
    semibold: 'var(--weight-semibold)', // 600
    bold: 'var(--weight-bold)', //         700
    heavy: 'var(--weight-heavy)', //       800
  },
  /** Межстрочный интервал. */
  leading: {
    tight: 'var(--leading-tight)', //   1.1
    snug: 'var(--leading-snug)', //     1.35
    normal: 'var(--leading-normal)', // 1.5
  },
  /** Трекинг. */
  tracking: {
    tight: 'var(--tracking-tight)', //   -0.3
    normal: 'var(--tracking-normal)', //  0
    wide: 'var(--tracking-wide)', //      0.4
  },
  /** Мелкая сетка отступов — 4pt. */
  space: {
    1: 'var(--space-1)', // 4
    2: 'var(--space-2)', // 8
    3: 'var(--space-3)', // 12
    4: 'var(--space-4)', // 16
    5: 'var(--space-5)', // 20
    6: 'var(--space-6)', // 24
    8: 'var(--space-8)', // 32
  },
  /** Радиусы. */
  radius: {
    xs: 'var(--radius-xs)', //   8
    sm: 'var(--radius-sm)', //   10
    md: 'var(--radius-md)', //   14
    lg: 'var(--radius-lg)', //   18
    glass: 'var(--radius-glass)', // 20
    xl: 'var(--radius-xl)', //   22
    /** ЗКН-Д018 — карточка сгруппированного экрана iOS 26.5 (замер: 24). */
    card: 'var(--radius-card)', // 24
    /** ЗКН-Д018 — крупная медиа-карточка App Store (замер: 20). */
    hero: 'var(--radius-hero)', // 20
    pill: 'var(--radius-pill)', // 999
  },
  /**
   * ЗКН-Д018 · СГРУППИРОВАННЫЙ ЭКРАН iOS 26.5.
   * Геометрия снята пиксельно со скриншотов App Store / Settings / Fitness
   * (см. шапку globals.css). Компоненты берут отсюда, а не выдумывают.
   */
  group: {
    canvas: 'var(--color-canvas)', //   холст группы   #F2F2F6 / #1C1C1E
    card: 'var(--color-card)', //       карточка       #FFFFFF / #2C2C2E
    separator: 'var(--color-separator)', // разделитель #E7E7E8 / #404043, 1px
    rowH: 'var(--row-h)', //            48
    rowH2: 'var(--row-h-2)', //         60
    insetCard: 'var(--inset-card)', //  16
    insetRow: 'var(--inset-row)', //    16
    gap: 'var(--gap-group)', //         35
    tile: 'var(--icon-tile)', //        29
    circle: 'var(--control-circle)', // 44
  },
  /** Цвета. */
  color: {
    label: 'var(--color-label)',
    label2: 'var(--color-label-2)',
    label3: 'var(--color-label-3)',
    brand: 'var(--color-gold-deep)',
    bg: 'var(--color-bg)',
    bg2: 'var(--color-bg-2)',
    /** Поверхность карточки контента (iOS grouped card — белая на сером). */
    surface: 'var(--color-bg-2)',
    fill1: 'var(--color-fill-1)',
    fill2: 'var(--color-fill-2)',
    glassThin: 'var(--color-glass-thin)',
    glassStroke: 'var(--color-glass-stroke)',
    hairline: 'var(--color-hairline)',
    /** Текст/иконка на цветной заливке (success/danger badge) — §2. */
    onColor: 'var(--color-brand-white)',
    // семантика — заливки/иконки
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    danger: 'var(--color-danger)',
    info: 'var(--color-info)',
    // семантика — текст (контраст под тему)
    successText: 'var(--color-success-text)',
    warningText: 'var(--color-warning-text)',
    dangerText: 'var(--color-danger-text)',
    infoText: 'var(--color-info-text)',
    // семантика — подложки
    successSurface: 'var(--color-success-surface)',
    warningSurface: 'var(--color-warning-surface)',
    dangerSurface: 'var(--color-danger-surface)',
    infoSurface: 'var(--color-info-surface)',
  },
  /** Возвышение. */
  shadow: {
    1: 'var(--shadow-1)',
    2: 'var(--shadow-2)',
    3: 'var(--shadow-3)',
  },
  /** Движение. */
  ease: 'var(--ease-standard)',
  duration: {
    fast: 'var(--duration-fast)', // 120ms
    base: 'var(--duration-base)', // 180ms
  },
} as const;

/** Стандартный переход для интерактивных элементов. */
export const transitionStandard = `all var(--duration-fast) var(--ease-standard)`;

/** Тон семантики (по статусу) → текст + подложка. */
export type SemanticTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export function toneColors(tone: SemanticTone): { text: string; surface: string } {
  switch (tone) {
    case 'success':
      return { text: tk.color.successText, surface: tk.color.successSurface };
    case 'warning':
      return { text: tk.color.warningText, surface: tk.color.warningSurface };
    case 'danger':
      return { text: tk.color.dangerText, surface: tk.color.dangerSurface };
    case 'info':
      return { text: tk.color.infoText, surface: tk.color.infoSurface };
    default:
      return { text: tk.color.label2, surface: tk.color.fill1 };
  }
}
