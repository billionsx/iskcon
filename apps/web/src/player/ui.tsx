/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ЗКН-Д023 · АУДИОТЕКА СОБИРАЕТСЯ ИЗ ЗАМЕРЕННЫХ КИРПИЧЕЙ, А НЕ «НА ГЛАЗ».
 *
 * Геометрия снята со скриншотов Apple Music (iOS 26.5, iPhone 393pt):
 *
 *   крупный заголовок   34/700, врезка 20, воздух снизу 12
 *   строка раздела      52, знак 24 + зазор 14 → текст на 58, шеврон 8×13
 *   разделитель         1px, врезан по НАЧАЛУ ТЕКСТА, справа 16
 *   круглая кнопка      44 · капсула из двух — 2×44, радиус 22, плавает
 *   меню                ширина 250, радиус 26, строка 44, текст 17,
 *                       ✓ слева (22) → знак (24) → текст; разделитель врезан 24
 *   строка записи       обложка 48 (радиус 6) · заголовок 17 · подпись 15 серым
 *   мини-плеер          высота 58, обложка 42/радиус 8, врезка 12
 *
 * ПОЧЕМУ ЭТОТ ФАЙЛ СУЩЕСТВУЕТ. Плеер был собран как одна коробка на 1343
 * строки, где каждый элемент рисовался на месте: свои радиусы, свои кегли,
 * свои отступы. Оттого «огромные табы» и разъезд. Числа теперь живут в ОДНОМ
 * месте, и собрать экран мимо них нельзя.
 *
 * ЦВЕТ. Плеер СВЕТЛЫЙ (решение основателя 18.07.2026): тёмная доска была
 * чужой в приложении, где всё остальное — белые карточки на холсте App Store.
 * Все цвета — токены (ЗКН-Д001), ни одного голого hex.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CheckIcon, ChevronRightIcon, ChevronLeftIcon, EllipsisIcon } from "./icons";
import { plural } from "../ui/primitives";

/** «857 записей» — число и слово вместе; склонение берётся из примитивов (ЗКН-Д002). */
export function count(n: number, one: string, few: string, many: string): string {
  return `${n} ${plural(n, one, few, many)}`;
}

const FONT = "var(--font-text)";
const INK = "var(--color-label)";
const INK2 = "var(--color-label-2)";
const INK3 = "var(--color-label-3)";
const ACCENT = "var(--color-gold-deep)";

/** ЗКН-Н066 — цель касания не меньше 44 точек. Знак может быть мелким, зона — нет. */
export const TAP = 44;

/* ─────────────────────────── кнопки шапки ─────────────────────────── */

/** Плавающая круглая кнопка шапки — 44, белое стекло, мягкая тень (замер iOS 26.5). */
export function GlassCircle({ label, onClick, active, children, anchorRef }: {
  label: string; onClick: () => void; active?: boolean; children: ReactNode;
  anchorRef?: (el: HTMLButtonElement | null) => void;
}) {
  return (
    <button ref={anchorRef} type="button" aria-label={label} onClick={onClick} className="tap-press"
      style={{
        flexShrink: 0, width: TAP, height: TAP, borderRadius: "var(--radius-pill)", border: "none",
        display: "grid", placeItems: "center", cursor: "pointer",
        background: "var(--color-card)", color: active ? ACCENT : INK,
        boxShadow: "var(--shadow-search)", WebkitTapHighlightColor: "transparent",
      }}>
      {children}
    </button>
  );
}

/**
 * Капсула из нескольких кнопок — правый угол шапки «Медиатеки» Apple Music.
 * Кнопки НЕ разделяются линией: капсула читается как один орган (замер).
 */
export function GlassCapsule({ children }: { children: ReactNode }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", flexShrink: 0,
      borderRadius: "var(--radius-pill)", background: "var(--color-card)",
      boxShadow: "var(--shadow-search)", overflow: "hidden",
    }}>
      {children}
    </span>
  );
}

/** Кнопка ВНУТРИ капсулы — та же зона 44, но без своей заливки и тени. */
export function CapsuleIcon({ label, onClick, active, children, anchorRef }: {
  label: string; onClick: () => void; active?: boolean; children: ReactNode;
  anchorRef?: (el: HTMLButtonElement | null) => void;
}) {
  return (
    <button ref={anchorRef} type="button" aria-label={label} onClick={onClick} className="tap-press"
      style={{
        width: TAP, height: TAP, border: "none", background: "none", padding: 0,
        display: "grid", placeItems: "center", cursor: "pointer",
        color: active ? ACCENT : INK, WebkitTapHighlightColor: "transparent",
      }}>
      {children}
    </button>
  );
}

/** Голый глиф панели навигации — без заливки и тени (замер iOS 26.5). */
export function PlainIcon({ label, onClick, active, children, anchorRef }: {
  label: string; onClick: () => void; active?: boolean; children: ReactNode;
  anchorRef?: (el: HTMLButtonElement | null) => void;
}) {
  return (
    <button ref={anchorRef} type="button" aria-label={label} onClick={onClick}
      style={{
        width: TAP, height: TAP, border: "none", background: "none", padding: 0,
        display: "grid", placeItems: "center", cursor: "pointer",
        color: ACCENT, opacity: active ? 0.6 : 1, WebkitTapHighlightColor: "transparent",
      }}>
      {children}
    </button>
  );
}

/**
 * Шапка экрана аудиотеки: [‹] крупный заголовок … [действия].
 *
 * У Apple заголовок ВСЕГДА один и всегда слева — «Медиатека», «Исполнители»,
 * «Альбомы». Подзаголовок не обязателен: если он есть, он говорит, ЧТО тут
 * найдётся, а не повторяет заголовок другими словами.
 */
export function ScreenHeader({ title, subtitle, onBack, backLabel, actions }: {
  title: string; subtitle?: string; onBack?: () => void; backLabel?: string; actions?: ReactNode;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      {/* ⚠️ НАЗАД БЫЛ ПЛАВАЮЩИМ БЕЛЫМ КРУЖКОМ НА БЕЛОМ ЛИСТЕ.
          У Apple круглая кнопка живёт ПОВЕРХ МЕДИА — там её держит картинка. На
          обычном списке навигация выглядит иначе: строка «‹ Откуда пришёл» над
          крупным заголовком. Круг на белом — это пузырь ниоткуда, и он ещё и
          прячет, КУДА возвращает. */}
      {(onBack || actions) && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: TAP, marginBottom: 2 }}>
          {onBack && (
            <button type="button" onClick={onBack} className="tap-row"
              style={{
                display: "inline-flex", alignItems: "center", gap: 2, height: TAP,
                margin: "0 0 0 -6px", padding: "0 6px", border: "none", background: "none",
                cursor: "pointer", color: ACCENT, fontFamily: FONT, fontSize: "var(--text-body)",
                letterSpacing: "-0.01em", WebkitTapHighlightColor: "transparent",
              }}>
              <ChevronLeftIcon size={19} />
              {backLabel ?? "Назад"}
            </button>
          )}
          <span style={{ flex: 1 }} />
          {actions}
        </div>
      )}
      <h1 style={{
        margin: 0, fontFamily: "var(--font-display)",
        fontSize: title.length > 22 ? "var(--text-title1)" : "var(--text-display)",
        fontWeight: 800, letterSpacing: "-0.6px", lineHeight: 1.08, color: INK,
        overflowWrap: "anywhere", hyphens: "auto",
      }}>{title}</h1>
      {subtitle && (
        <p style={{ margin: "6px 2px 0", fontFamily: FONT, fontSize: "var(--text-subhead)",
          color: INK2, lineHeight: 1.4 }}>{subtitle}</p>
      )}
    </div>
  );
}

/* ─────────────────────────── всплывающее меню ─────────────────────────── */

export interface MenuItem {
  id: string;
  label: string;
  /** Вторая строка серым — «THERAPY AT THE CLUB» под «Перейти к альбому». */
  note?: string;
  icon?: ReactNode;
  /** Выбранный пункт получает ✓ слева. */
  checked?: boolean;
  /** Разделитель ПЕРЕД пунктом — группирует смысл, как у Apple. */
  divider?: boolean;
  destructive?: boolean;
  onSelect: () => void;
}

/** Верхний ряд меню записи: две-три квадратные кнопки со знаком сверху и подписью снизу. */
export interface MenuAction { id: string; label: string; icon: ReactNode; onSelect: () => void }

/**
 * Меню Apple: белое стекло, радиус 26, ширина 250, строка 44.
 *
 * ЗКН-Н068 — рисуется ПОРТАЛОМ в body: `fixed` внутри скроллера Safari
 * прижимается к скроллеру, а не к окну, и меню запирало бы в коробке.
 */
export function PopMenu({ anchor, items, actions, onClose, width = 250 }: {
  anchor: HTMLElement | null; items: MenuItem[]; actions?: MenuAction[];
  onClose: () => void; width?: number;
}) {
  const [pos, setPos] = useState<{ top: number; left: number; origin: string } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const r = anchor?.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const h = boxRef.current?.offsetHeight ?? 240;
    if (!r) { setPos({ top: Math.round(vh / 2 - h / 2), left: Math.round(vw / 2 - width / 2), origin: "center" }); return; }
    // По Apple меню «вырастает» из кнопки: правый край меню = правый край кнопки.
    let left = Math.round(r.right - width);
    left = Math.max(8, Math.min(left, vw - width - 8));
    const below = r.bottom + 6;
    const fits = below + h < vh - 12;
    const top = fits ? Math.round(below) : Math.round(Math.max(8, r.top - h - 6));
    setPos({ top, left, origin: fits ? "top right" : "bottom right" });
  }, [anchor, width, items.length]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const hasCheck = items.some((i) => i.checked !== undefined);
  const hasIcon = items.some((i) => !!i.icon);

  return createPortal(
    <div role="dialog" aria-modal="true" onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1400, background: "var(--color-scrim-soft)" }}>
      <div ref={boxRef} onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed", top: pos?.top ?? -9999, left: pos?.left ?? -9999, width,
          borderRadius: 26, overflow: "hidden", fontFamily: FONT,
          background: "var(--color-menu-glass)",
          backdropFilter: "blur(30px) saturate(180%)", WebkitBackdropFilter: "blur(30px) saturate(180%)",
          boxShadow: "var(--shadow-3)",
          transformOrigin: pos?.origin ?? "top right",
          animation: "iolPop .18s cubic-bezier(.32,.72,0,1)",
        }}>
        {actions && actions.length > 0 && (
          <>
            <div style={{ display: "flex", padding: "12px 0 10px" }}>
              {actions.map((a) => (
                <button key={a.id} type="button" onClick={() => { a.onSelect(); onClose(); }}
                  style={{
                    flex: 1, minWidth: 0, border: "none", background: "none", cursor: "pointer",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                    padding: "4px 6px", color: INK, WebkitTapHighlightColor: "transparent",
                  }}>
                  <span aria-hidden style={{ display: "grid", placeItems: "center" }}>{a.icon}</span>
                  <span style={{ fontSize: "var(--text-subhead)", fontWeight: 500, letterSpacing: "-0.01em",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{a.label}</span>
                </button>
              ))}
            </div>
            <MenuLine />
          </>
        )}
        {items.map((it, i) => (
          <div key={it.id}>
            {it.divider && i > 0 && <MenuLine />}
            <button type="button" onClick={() => { it.onSelect(); onClose(); }} className="tap-row"
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%", boxSizing: "border-box",
                minHeight: it.note ? 56 : TAP, padding: "0 16px", border: "none", background: "none",
                cursor: "pointer", textAlign: "left", WebkitTapHighlightColor: "transparent",
                color: it.destructive ? "var(--color-danger-text)" : INK,
              }}>
              {hasCheck && (
                <span aria-hidden style={{ flexShrink: 0, width: 20, display: "grid", placeItems: "center" }}>
                  {it.checked ? <CheckIcon size={17} /> : null}
                </span>
              )}
              {hasIcon && (
                <span aria-hidden style={{ flexShrink: 0, width: 24, display: "grid", placeItems: "center", color: INK }}>
                  {it.icon}
                </span>
              )}
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: "var(--text-body)", fontWeight: 400,
                  letterSpacing: "-0.01em", lineHeight: 1.25, overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
                {it.note && (
                  <span style={{ display: "block", marginTop: 2, fontSize: "var(--text-footnote)",
                    color: INK2, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis",
                    whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.02em" }}>{it.note}</span>
                )}
              </span>
            </button>
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
}

function MenuLine() {
  return <div aria-hidden style={{ height: 1, background: "var(--color-separator)", marginInline: 24 }} />;
}

/** Кнопка, открывающая меню: держит свой якорь и состояние.
 *  `plain` — голый глиф без плашки: так выглядит кнопка панели навигации на
 *  обычном списке. Плашка нужна только поверх медиа, где глиф иначе теряется. */
export function MenuButton({ label, items, actions, capsule, plain, children, width }: {
  label: string; items: MenuItem[]; actions?: MenuAction[]; capsule?: boolean; plain?: boolean;
  children: ReactNode; width?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement | null>(null);
  const Btn = plain ? PlainIcon : capsule ? CapsuleIcon : GlassCircle;
  return (
    <>
      <Btn label={label} onClick={() => setOpen(true)} active={open} anchorRef={(el) => { ref.current = el; }}>
        {children}
      </Btn>
      {open && <PopMenu anchor={ref.current} items={items} actions={actions} width={width} onClose={() => setOpen(false)} />}
    </>
  );
}

/* ─────────────────────────── строки списка ─────────────────────────── */

/** Разделитель списка: 1px, врезан по началу текста (замер iOS 26.5). */
export function RowLine({ inset = 16 }: { inset?: number }) {
  return <div aria-hidden style={{ height: 1, background: "var(--color-separator)", marginLeft: inset }} />;
}

/**
 * Строка раздела медиатеки — «Плейлисты · Исполнители · Альбомы · Песни».
 * Знак 24 акцентом, текст 17, шеврон. Высота 52 (замер).
 */
export function SectionRow({ icon, title, value, onClick, last }: {
  icon: ReactNode; title: string; value?: string; onClick: () => void; last?: boolean;
}) {
  return (
    <>
      <button type="button" onClick={onClick} className="tap-row"
        style={{
          display: "flex", alignItems: "center", gap: 14, width: "100%", boxSizing: "border-box",
          minHeight: 52, padding: "0 16px 0 0", border: "none", background: "none", cursor: "pointer",
          textAlign: "left", fontFamily: FONT, WebkitTapHighlightColor: "transparent",
        }}>
        <span aria-hidden style={{ flexShrink: 0, width: 24, display: "grid", placeItems: "center", color: ACCENT }}>
          {icon}
        </span>
        <span style={{ flex: 1, minWidth: 0, fontSize: "var(--text-body)", color: INK,
          letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title}
        </span>
        {value && (
          <span style={{ flexShrink: 0, fontSize: "var(--text-body)", color: INK2, fontVariantNumeric: "tabular-nums" }}>
            {value}
          </span>
        )}
        <span style={{ flexShrink: 0, display: "grid", placeItems: "center", color: INK3 }}>
          <ChevronRightIcon size={16} />
        </span>
      </button>
      {!last && <RowLine inset={38} />}
    </>
  );
}

/**
 * Строка записи/собрания: обложка или номер · заголовок · подпись · ⋯
 *
 * ЗКН-Д023: играющая запись помечается не подсветкой всей строки (пятно на
 * белом), а АКЦЕНТОМ ЗАГОЛОВКА и знаком эквалайзера — так же, как у Apple.
 */
export function MediaRow({
  art, num, title, subtitle, meta, active, playing, round, onClick, onMore, moreLabel, last, accessory,
}: {
  art?: string; num?: number; title: string; subtitle?: string; meta?: string;
  active?: boolean; playing?: boolean; round?: boolean;
  onClick: () => void; onMore?: (anchor: HTMLElement) => void; moreLabel?: string;
  last?: boolean; accessory?: ReactNode;
}) {
  const inset = art ? 74 : num != null ? 42 : 0;
  return (
    <>
      <div data-active={active ? "1" : undefined}
        style={{ display: "flex", alignItems: "center", gap: 12,
          minHeight: art ? 60 : 54, fontFamily: FONT }}>
        <button type="button" onClick={onClick} className="tap-row"
          style={{
            flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12,
            minHeight: art ? 60 : 54, padding: "6px 0", border: "none", background: "none",
            cursor: "pointer", textAlign: "left", WebkitTapHighlightColor: "transparent",
          }}>
          {art !== undefined && (
            <span style={{ position: "relative", flexShrink: 0, width: 48, height: 48 }}>
              <img src={art} alt="" loading="lazy" draggable={false}
                style={{ width: 48, height: 48, objectFit: "cover", display: "block",
                  borderRadius: round ? "50%" : "var(--radius-xs)", background: "var(--color-bg-3)" }} />
              {/* Играющая запись помечается и на обложке — иначе в списке с
                  картинками непонятно, что именно звучит (замер Apple Music). */}
              {playing && (
                <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center",
                  borderRadius: round ? "50%" : "var(--radius-xs)",
                  background: "color-mix(in srgb, var(--color-label) 46%, transparent)" }}>
                  <EqBars color="var(--color-bg-2)" />
                </span>
              )}
            </span>
          )}
          {art === undefined && num != null && (
            <span style={{ flexShrink: 0, width: 30, textAlign: "center", fontSize: "var(--text-subhead)",
              color: active ? ACCENT : INK3, fontVariantNumeric: "tabular-nums" }}>
              {playing ? <EqBars /> : num}
            </span>
          )}
          {/* Без обложки и без номера играющую запись всё равно видно: знак
              звучания слева. Иначе в списке на тысячу строк непонятно, что идёт. */}
          {art === undefined && num == null && playing && (
            <span style={{ flexShrink: 0, display: "grid", placeItems: "center", width: 16 }}>
              <EqBars />
            </span>
          )}
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{
              display: "block", fontSize: "var(--text-body)", fontWeight: 400, letterSpacing: "-0.01em",
              color: active ? ACCENT : INK, lineHeight: 1.3,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{title}</span>
            {subtitle && (
              <span style={{
                display: "block", marginTop: 2, fontSize: "var(--text-subhead)", color: INK2, lineHeight: 1.3,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{subtitle}</span>
            )}
          </span>
          {meta && (
            <span style={{ flexShrink: 0, fontSize: "var(--text-subhead)", color: INK3,
              fontVariantNumeric: "tabular-nums" }}>{meta}</span>
          )}
        </button>
        {accessory}
        {onMore && (
          <button type="button" aria-label={moreLabel ?? "Ещё"}
            onClick={(e) => onMore(e.currentTarget)}
            style={{ flexShrink: 0, width: TAP, height: TAP, border: "none", background: "none",
              display: "grid", placeItems: "center", cursor: "pointer", color: INK3,
              WebkitTapHighlightColor: "transparent" }}>
            <EllipsisIcon size={18} />
          </button>
        )}
      </div>
      {!last && <RowLine inset={inset} />}
    </>
  );
}

/** Эквалайзер играющей записи — три полоски (Apple ставит его вместо номера).
 *  Движение берётся из общего `iol-eq` (ЗКН-Н056): второй анимации не заводим. */
export function EqBars({ color = ACCENT }: { color?: string }) {
  return (
    <span aria-label="Играет" style={{ display: "inline-flex", alignItems: "flex-end", gap: 2, height: 14 }}>
      {[0, 1, 2].map((i) => (
        <span key={i} className="iol-eq-bar" style={{
          width: 2.5, borderRadius: 2, background: color, height: 14,
          transformOrigin: "bottom", animation: `iol-eq .9s ${i * 0.18}s ease-in-out infinite`,
        }} />
      ))}
    </span>
  );
}

/* ─────────────────────────── кнопки воспроизведения ─────────────────────────── */

/**
 * Пара «Слушать · Перемешать» — шапка альбома Apple Music.
 * Две равные капсулы: не одна кнопка с меню, а два разных намерения.
 */
export function PlayShuffle({ onPlay, onShuffle }: { onPlay: () => void; onShuffle: () => void }) {
  const base: CSSProperties = {
    flex: 1, minWidth: 0, minHeight: 50, borderRadius: "var(--radius-md)", border: "none",
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
    /* Белая кнопка на белом листе держится только тенью — её ВИДНО, но она не
       читается как орган. У Apple здесь заливка, а акцент отдан надписи. */
    background: "var(--color-fill-1)", color: ACCENT, cursor: "pointer", fontFamily: FONT,
    fontSize: "var(--text-body)", fontWeight: 600, letterSpacing: "-0.01em",
    WebkitTapHighlightColor: "transparent",
  };
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <button type="button" onClick={onPlay} className="tap-press" style={base}>
        <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg>
        Слушать
      </button>
      <button type="button" onClick={onShuffle} className="tap-press" style={base}>
        <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor"
          strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.6 6.6h3.2c1.4 0 2.3.7 3.1 1.8l4.3 6c.8 1.1 1.7 1.8 3.1 1.8h3.1M3.6 17.4h3.2c1.4 0 2.3-.7 3.1-1.8M14.2 8.4c.8-1.1 1.7-1.8 3.1-1.8h3.1" />
          <path d="m17.8 3.8 2.8 2.8-2.8 2.8M17.8 13.8l2.8 2.8-2.8 2.8" />
        </svg>
        Перемешать
      </button>
    </div>
  );
}

/* ─────────────────────────── пустое состояние ─────────────────────────── */

/**
 * Пустой экран Apple: крупный серый знак, короткая фраза О ТОМ, ЧТО СДЕЛАТЬ.
 * «Плейлисты, которые вы создадите, появятся здесь» — не «пусто».
 */
export function EmptyState({ icon, text, hint }: { icon: ReactNode; text: string; hint?: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 12, padding: "72px 32px", textAlign: "center", fontFamily: FONT,
    }}>
      <span aria-hidden style={{ color: INK3 }}>{icon}</span>
      <span style={{ fontSize: "var(--text-body)", color: INK2, lineHeight: 1.4 }}>{text}</span>
      {hint && <span style={{ fontSize: "var(--text-subhead)", color: INK3, lineHeight: 1.45 }}>{hint}</span>}
    </div>
  );
}

/** Заголовок группы внутри экрана — «Далее», «Недавнее». 22/700, врезка 0. */
export function GroupTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between",
      gap: 12, margin: "0 0 6px" }}>
      <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-title2)",
        fontWeight: 700, letterSpacing: "-0.4px", color: INK }}>{children}</h2>
      {action}
    </div>
  );
}

/** Белая карточка-список (группа iOS): без обводки, слой создаёт разница с холстом. */
export function ListCard({ children }: { children: ReactNode }) {
  return (
    <div style={{ background: "var(--color-card)", borderRadius: "var(--radius-card)",
      overflow: "hidden", boxShadow: "var(--shadow-1)" }}>
      {children}
    </div>
  );
}

/** Часы·минуты записи — «1 ч 24 мин» / «7 мин». Единица катхи — время, не число файлов. */
export function fmtDur(sec: number): string {
  if (!sec || !isFinite(sec) || sec < 0) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h > 0) return m > 0 ? `${h} ч ${m} мин` : `${h} ч`;
  return `${Math.max(1, m)} мин`;
}

