/**
 * ISKCON DESIGN · СГРУППИРОВАННЫЙ ЭКРАН iOS 26.5 — ЗКН-Д018.
 *
 * ЕДИНЫЙ набор кирпичей для всех «системных» экранов приложения: кабинет,
 * настройки, профиль, листы. Геометрия здесь не выдумана — она СНЯТА
 * ПИКСЕЛЬНО со скриншотов iOS 26.5 (лист «Apple Account», настройки App Store,
 * «General», Fitness; iPhone 3x, 1179×2556 → делить на 3 = pt):
 *
 *   карточка        #FFFFFF / #2C2C2E        радиус     24
 *   разделитель     #E7E7E8 / #404043, 1px
 *   отступ карточки 16      поле внутри 16   воздух между группами 35
 *   строка          48 (одна) · 60 (с подписью)
 *   плитка иконки   29       шеврон 7×12     круглая кнопка шапки 44
 *   заголовок группы 15px, Title Case, серый, врезка 32 от края экрана
 *
 * ПОЧЕМУ ЭТОТ ФАЙЛ СУЩЕСТВУЕТ. Кабинет был собран «на глаз»: радиус 14,
 * обводка вокруг белой карточки, заголовки групп 13px капсом, строки 12px
 * padding, разделитель 0.5px. Ни одно из чисел не совпадало с Apple —
 * и экран читался как дешёвая копия системного. Числа теперь живут в ОДНОМ
 * месте, и «собрать на глаз» больше нельзя: строку списка неоткуда взять,
 * кроме как отсюда.
 *
 * МАТЕРИАЛ — НАШ, НЕ APPLE. У Apple под карточкой лежит серый холст
 * (242,242,246), и слой создаётся разницей. Серый холст был испробован на живом
 * приложении и ОТКЛОНЁН основателем 18.07.2026: «всё превратилось в убожество,
 * возвращай белый фоном везде». Причина не во вкусе: у Apple под серым лежат
 * списки настроек, у нас — Божества, алтари и книги, и серая подложка их гасит.
 * Поэтому холст БЕЛЫЙ, а группа отделяется мягкой тенью `--shadow-card`.
 * Геометрия при этом остаётся замером: она объективна, её менять не за что.
 *
 * ЧТО ЗАПРЕЩЕНО (ЗКН-Д018, гейт `tools/surface-lint.py`):
 *   · обводка вокруг карточки группы — это язык веб-формы, слой держит тень;
 *   · радиус группы мельче 20 — на iOS 26 карточка мягкая, не «таблица»;
 *   · разделитель 0.5px — у Apple он 1px и врезан с ОБЕИХ сторон;
 *   · свой велосипед строки списка вместо <Row>.
 */
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";

const FONT = "var(--font-text)";
const INK = "var(--color-label)";
const INK2 = "var(--color-label-2)";
const INK3 = "var(--color-label-3)";

/* ─────────────────────────── знаки ─────────────────────────── */

/** Шеврон строки — 7×12, тонкий, третичный (замер по iOS 26.5). */
export function Chevron({ color = INK3 }: { color?: string }) {
  return (
    <svg width="8" height="13" viewBox="0 0 8 13" fill="none" aria-hidden
      style={{ flexShrink: 0, color }}>
      <path d="M1.4 1.4 6.4 6.5l-5 5.1" stroke="currentColor" strokeWidth="1.9"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Галочка выбора — акцент (iOS: выбранный пункт списка). */
export function Checkmark({ color = "var(--color-gold-deep)" }: { color?: string }) {
  return (
    <svg width="16" height="14" viewBox="0 0 16 14" fill="none" aria-hidden style={{ flexShrink: 0, color }}>
      <path d="M1.6 7.4 5.6 11.6 14.4 1.9" stroke="currentColor" strokeWidth="2.2"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─────────────────────────── холст ─────────────────────────── */

/**
 * Холст сгруппированного экрана. Выносится на всю ширину листа приложения
 * (оболочка даёт 16px padding — здесь он снимается отрицательным полем) и
 * красится в цвет группы, чтобы белые карточки читались как СЛОЙ.
 */
export function GroupedCanvas({ children, top = 12 }: { children: ReactNode; top?: number }) {
  return (
    <div style={{
      /* ХОЛСТ ДОХОДИТ ДО КРАЁВ ЭКРАНА, а не до краёв контента: шелл кладёт
         padding 16/16/--content-bottom, и холст ровно на столько же выходит
         обратно. Числа не дублируются — берутся те же токены, поэтому смена
         воздуха шелла не оставит серую полосу по низу. */
      margin: "-16px -16px calc(-1 * (var(--content-bottom) + var(--player-extra)))",
      padding: `${top}px 0 calc(var(--content-bottom) + var(--player-extra) + env(safe-area-inset-bottom))`,
      minHeight: "calc(100dvh - 56px)",
      background: "var(--color-canvas)",
      fontFamily: FONT,
    }}>
      {children}
    </div>
  );
}

/** Заголовок группы: 15px, Title Case, серый, врезка 32 от края экрана. */
export function GroupHeader({ title, action }: {
  title: string; action?: { label: string; onClick: () => void };
}) {
  return (
    <div style={{
      display: "flex", alignItems: "baseline", justifyContent: "space-between",
      gap: 12, padding: "0 calc(var(--inset-card) + var(--inset-row))", margin: "0 0 8px",
    }}>
      <span style={{ fontFamily: FONT, fontSize: "var(--text-subhead)", fontWeight: 400, color: INK2, letterSpacing: "-0.01em" }}>
        {title}
      </span>
      {action && (
        <button type="button" onClick={action.onClick}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: FONT,
            fontSize: "var(--text-subhead)", fontWeight: 600, color: "var(--color-gold-deep)",
            WebkitTapHighlightColor: "transparent" }}>
          {action.label}
        </button>
      )}
    </div>
  );
}

/**
 * Карточка группы. Белая (в тёмной — #2C2C2E), радиус 24, БЕЗ ОБВОДКИ.
 * Между группами — 35px воздуха (ставит `<Groups>`).
 *
 * СЛОЙ ДЕРЖИТ МАТЕРИАЛ, А НЕ СЕРЫЙ ФОН (ЗКН-Д018). У Apple карточка читается
 * разницей с серым холстом; у нас холст белый — под ним лежат Божества, алтари
 * и книги, и серая подложка их гасит. Поэтому группа отделяется мягкой тенью:
 * плотной и короткой (список настроек не парит над страницей). Обводка запрещена —
 * линия по периметру превращает группу в таблицу и читается как веб-форма.
 */
export function Group({ header, action, footer, children }: {
  header?: string; action?: { label: string; onClick: () => void };
  footer?: ReactNode; children: ReactNode;
}) {
  return (
    <section>
      {header && <GroupHeader title={header} action={action} />}
      <div style={{
        margin: "0 var(--inset-card)",
        background: "var(--color-card)",
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--shadow-group)",
        overflow: "hidden",
      }}>
        {children}
      </div>
      {footer && (
        <p style={{
          margin: "8px calc(var(--inset-card) + var(--inset-row)) 0",
          fontFamily: FONT, fontSize: "var(--text-footnote)", lineHeight: 1.45, color: INK2,
        }}>
          {footer}
        </p>
      )}
    </section>
  );
}

/** Вертикальный ритм между группами — 35px (замер iOS 26.5). */
export function Groups({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap-group)" }}>{children}</div>;
}

/** Разделитель строк: 1px, врезан слева по началу содержимого, справа — на 16. */
export function Separator({ inset = 16 }: { inset?: number }) {
  return (
    <div aria-hidden style={{
      height: 1, background: "var(--color-separator)",
      marginLeft: inset, marginRight: "var(--inset-row)",
    }} />
  );
}

/**
 * ШАПКА ЛИЧНОСТИ — портрет, имя, подписи. Не строка списка, а ПРИСУТСТВИЕ.
 *
 * Кабинет открывали и видели строку контакта: кружок 52 и две строчки текста.
 * Экран «про меня» начинался как чужой список. В листе «Apple Account» сверху
 * крупный портрет и имя большим кеглем — и экран сразу твой. Замер iOS 26.5:
 * портрет 88, имя титульным кеглем, подписи 15 серым, центр, воздух под 26.
 */
export function IdentityHeader({ avatar, name, sacred, subtitle, onClick }: {
  avatar: ReactNode; name: string; sacred?: string; subtitle?: string; onClick?: () => void;
}) {
  const inner = (
    <>
      <span style={{
        display: "grid", placeItems: "center", width: 88, height: 88, margin: "0 auto",
        borderRadius: "50%",
        /* ЗКН-Д024 — МОНОГРАММА ТИХАЯ. Насыщенный золотой диск был самым
           громким пятном экрана и притягивал взгляд сильнее имени. Тон 16 %
           золота + тёмно-золотой знак: контраст высокий, присутствие спокойное.
           Ни тени, ни градиента — круг лежит на странице, а не парит. */
        background: "color-mix(in srgb, var(--color-gold) 16%, transparent)",
        color: "var(--color-gold-deep)",
        fontFamily: "var(--font-display)", fontSize: "var(--text-title1)", fontWeight: 600,
        letterSpacing: "-0.02em",
      }}>{avatar}</span>
      <span style={{
        display: "block", marginTop: 13, fontFamily: "var(--font-display)",
        fontSize: "var(--text-title1)", fontWeight: 700, letterSpacing: "-0.03em",
        lineHeight: 1.14, color: "var(--color-label)",
      }}>{name}</span>
      {sacred && (
        <span style={{
          display: "block", marginTop: 3, fontFamily: FONT, fontSize: "var(--text-subhead)",
          fontWeight: 600, color: "var(--color-gold-deep)",
        }}>{sacred}</span>
      )}
      {subtitle && (
        <span style={{
          display: "block", marginTop: 3, fontFamily: FONT, fontSize: "var(--text-subhead)",
          color: "var(--color-label-2)",
        }}>{subtitle}</span>
      )}
    </>
  );
  const style: CSSProperties = {
    display: "block", width: "100%", boxSizing: "border-box",
    padding: "6px 20px 26px", textAlign: "center",
    background: "none", border: "none", font: "inherit",
    cursor: onClick ? "pointer" : "default", WebkitTapHighlightColor: "transparent",
  };
  return onClick
    ? <button type="button" onClick={onClick} style={style}>{inner}</button>
    : <div style={style}>{inner}</div>;
}

/* ПЛИТКИ ИКОНОК ЗДЕСЬ НЕТ И НЕ БУДЕТ (ЗКН-Д024).
 *
 * Она была: сначала полупрозрачно-серая (список выглядел выключенным), потом
 * цветная по образцу настроек iOS. Решение основателя 18.07.2026 — убрать
 * совсем: «не нужно цветных иконок и плашек на иконках». И это верно для НАШЕГО
 * предмета. Цветные плитки у Apple разделяют РАЗНОРОДНОЕ — звук, экран, Wi-Fi,
 * батарею, полсотни пунктов. У нас в группе две-три строки, все одного рода;
 * цвет там ничего не разделяет, а шумит. Лист «Apple Account» — тоже без плиток.
 *
 * Строка держится ТИПОГРАФИКОЙ: 17 обычным на почти-чёрном, 15 серым во второй
 * строке, значение 17 серым справа, шеврон третичным. Больше ничего не нужно.
 */

export interface RowProps {
  title: ReactNode;
  /** Вторая строка — делает строку высотой 60. */
  subtitle?: ReactNode;
  /** Значение справа (серое) — как «Never» в настройках. */
  value?: ReactNode;
  /** Свой элемент справа вместо значения (тумблер, галочка). */
  accessory?: ReactNode;
  /** Показывать шеврон (по умолчанию — да, если есть onClick). */
  chevron?: boolean;
  onClick?: () => void;
  /** Красная (деструктивная) строка — «Выйти». */
  destructive?: boolean;
  /** Заголовок по центру, без иконки — форма кнопки-строки iOS. */
  centered?: boolean;
  /** Последняя в группе — не рисует разделитель. */
  last?: boolean;
}

/**
 * Строка сгруппированного списка. 48px (одна линия) / 60px (с подписью),
 * поле 16, плитка 29 + зазор 9, разделитель врезан по началу текста.
 */
export function Row({
  title, subtitle, value, accessory, chevron, onClick,
  destructive, centered, last,
}: RowProps) {
  const showChevron = chevron ?? (!!onClick && !accessory);
  const tone = destructive ? "var(--color-danger-text)" : INK;
  const inner = (
    <>
      <span style={{ flex: 1, minWidth: 0, textAlign: centered ? "center" : "left" }}>
        {/* ЗАГОЛОВОК СТРОКИ — 17 обычным. Не 16, не полужирным: в списке iOS
            вес несёт ИЕРАРХИЮ, а не важность каждой строки. */}
        <span style={{
          display: "block", fontFamily: FONT, fontSize: "var(--text-body)",
          fontWeight: centered ? 500 : 400, color: tone, lineHeight: 1.29,
          letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{title}</span>
        {subtitle && (
          /* ПОДПИСЬ — 15 серым, НЕ 13. Тринадцатый кегль в строке 48 читается
             как сноска и ломает вертикальный ритм: у Apple вторая строка
             ровно на ступень ниже основной, а не на две. */
          <span style={{
            display: "block", marginTop: 1, fontFamily: FONT, fontSize: "var(--text-subhead)",
            color: INK2, lineHeight: 1.33, letterSpacing: "-0.01em",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{subtitle}</span>
        )}
      </span>
      {value != null && (
        <span style={{
          flexShrink: 0, fontFamily: FONT, fontSize: "var(--text-body)", color: INK2,
          letterSpacing: "-0.01em", maxWidth: "48%", overflow: "hidden",
          textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{value}</span>
      )}
      {accessory}
      {showChevron && <Chevron />}
    </>
  );
  const style: CSSProperties = {
    display: "flex", alignItems: "center", gap: 8, width: "100%", boxSizing: "border-box",
    minHeight: subtitle ? "var(--row-h-2)" : "var(--row-h)",
    padding: "0 var(--inset-row)",
    background: "none", border: "none", cursor: onClick ? "pointer" : "default",
    textAlign: "left", font: "inherit", color: "inherit",
    WebkitTapHighlightColor: "transparent",
  };
  return (
    <>
      {onClick
        ? <button type="button" className="tap-row" onClick={onClick} style={style}>{inner}</button>
        : <div style={style}>{inner}</div>}
      {/* Разделитель начинается ТАМ ЖЕ, ГДЕ ТЕКСТ (врезка 16 = поле строки).
          Иначе линия висит под пустотой и группа рассыпается. */}
      {!last && <Separator inset={16} />}
    </>
  );
}

/** Круглая кнопка шапки листа — 44, полупрозрачная заливка (iOS 26.5). */
export function CircleButton({ label, onClick, children }: {
  label: string; onClick: () => void; children: ReactNode;
}) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="tap-press"
      style={{
        flexShrink: 0, width: "var(--control-circle)", height: "var(--control-circle)",
        borderRadius: "50%", border: "none", display: "grid", placeItems: "center",
        background: "var(--color-fill-1)", color: INK, cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
      }}>
      {children}
    </button>
  );
}

/** Капсульная кнопка — заливка карточки (plain) или акцент (filled). */
export function CapsuleButton({ label, onClick, variant = "plain", tone, disabled }: {
  label: ReactNode; onClick: () => void; variant?: "plain" | "filled";
  tone?: "accent" | "danger" | "ink"; disabled?: boolean;
}) {
  const accent = tone === "danger" ? "var(--color-danger-text)"
    : tone === "ink" ? INK : "var(--color-gold-deep)";
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="tap-press"
      style={{
        width: "100%", minHeight: 50, padding: "0 20px", borderRadius: "var(--radius-pill)",
        border: "none", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1,
        background: variant === "filled" ? accent : "var(--color-card)",
        color: variant === "filled" ? "var(--color-brand-white)" : accent,
        fontFamily: FONT, fontSize: "var(--text-body)", fontWeight: 600, letterSpacing: "-0.01em",
        WebkitTapHighlightColor: "transparent",
      }}>
      {label}
    </button>
  );
}

/** Тумблер iOS — 51×31. */
export function Toggle({ on, busy, onToggle, tint = "var(--color-gold)" }: {
  on: boolean; busy?: boolean; onToggle: () => void; tint?: string;
}) {
  return (
    <button type="button" role="switch" aria-checked={on} disabled={busy} onClick={onToggle}
      style={{
        flexShrink: 0, width: 51, height: 31, borderRadius: "var(--radius-pill)", border: "none",
        position: "relative", cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1,
        background: on ? tint : "var(--color-fill-2)", transition: "background .2s",
        WebkitTapHighlightColor: "transparent",
      }}>
      <span style={{
        position: "absolute", top: 2, left: on ? 22 : 2, width: 27, height: 27, borderRadius: "50%",
        background: "var(--color-brand-white)", boxShadow: "0 1px 3px rgba(0,0,0,0.3)", transition: "left .2s",
      }} />
    </button>
  );
}

/* ─────────────────────────── строка поиска ─────────────────────────── */

/**
 * Строка поиска — ЭТАЛОН APP STORE (ЗКН-Д019, замер по скриншоту):
 * капсула высотой 38, врезка 20 от края, заливка цвета карточки, БЕЗ обводки,
 * читается мягкой тенью; лупа 14 слева на отступе 13; подпись 17 серым.
 */
export function SearchField({ value, onChange, placeholder, inputRef, onKeyDown, onClear, autoFocus }: {
  value: string; onChange: (v: string) => void; placeholder: string;
  inputRef?: (el: HTMLInputElement | null) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  onClear?: () => void; autoFocus?: boolean;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6, boxSizing: "border-box",
      height: "var(--search-h)", padding: "0 13px",
      background: "var(--color-card)", borderRadius: "var(--radius-pill)",
      boxShadow: "var(--shadow-search)",
    }}>
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden style={{ flexShrink: 0, color: INK2 }}>
        <circle cx="6.8" cy="6.8" r="5.1" stroke="currentColor" strokeWidth="1.9" />
        <path d="M10.6 10.6 14.4 14.4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
      <input
        ref={inputRef} value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown}
        placeholder={placeholder} inputMode="search" autoFocus={autoFocus}
        style={{
          flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent",
          fontFamily: FONT, fontSize: "var(--text-body)", letterSpacing: "-0.01em", color: INK, padding: 0,
        }} />
      {value && onClear && (
        <button type="button" aria-label="Очистить" onClick={onClear}
          style={{ flexShrink: 0, display: "grid", placeItems: "center", width: 18, height: 18, padding: 0,
            border: "none", borderRadius: "50%", background: "var(--color-label-3)",
            color: "var(--color-card)", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden>
            <path d="M1.6 1.6l6.8 6.8M8.4 1.6l-6.8 6.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────── лист ─────────────────────────── */

/**
 * Лист iOS 26.5: холст группы, крупный радиус сверху, слева — заголовок,
 * справа — круглая кнопка закрытия 44. Внутри живут те же группы.
 */
export function Sheet({ title, onClose, children, action }: {
  title: string; onClose: () => void; children: ReactNode;
  action?: { label: string; onClick: () => void; disabled?: boolean };
}) {
  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1300, display: "flex", flexDirection: "column",
        justifyContent: "flex-end", background: "rgba(0,0,0,0.4)" }}
      onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "var(--color-canvas)", borderTopLeftRadius: 40, borderTopRightRadius: 40,
        width: "100%", maxWidth: "var(--sheet-max)", margin: "0 auto", maxHeight: "92dvh",
        display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: FONT,
      }}>
        <div style={{
          flexShrink: 0, display: "flex", alignItems: "center", gap: 12,
          padding: "14px var(--inset-card) 10px",
        }}>
          <h2 style={{
            flex: 1, minWidth: 0, margin: 0, fontFamily: "var(--font-display)",
            fontSize: "var(--text-title1)", fontWeight: 700, letterSpacing: "-0.03em", color: INK,
          }}>{title}</h2>
          {/* ЗКН-Д022 — ОДНА КНОПКА ЗАКРЫТИЯ, А НЕ ДВЕ. В листе профиля рядом
              стояли «Готово» и крестик: два способа уйти, и непонятно, какой
              сохраняет. У Apple либо подтверждающее действие, либо крестик. */}
          {action ? (
            <button type="button" onClick={action.onClick} disabled={action.disabled}
              style={{ flexShrink: 0, background: "none", border: "none", padding: "0 4px", cursor: "pointer",
                fontFamily: FONT, fontSize: "var(--text-body)", fontWeight: 600,
                color: "var(--color-gold-deep)", opacity: action.disabled ? 0.5 : 1,
                WebkitTapHighlightColor: "transparent" }}>
              {action.label}
            </button>
          ) : (
            <CircleButton label="Закрыть" onClick={onClose}>
              <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden>
                <path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </CircleButton>
          )}
        </div>
        <div style={{
          flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch",
          padding: "6px 0 calc(28px + env(safe-area-inset-bottom))",
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}
