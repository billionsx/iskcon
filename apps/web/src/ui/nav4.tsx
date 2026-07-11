/**
 * ISKCON DESIGN · НАВИГАЦИЯ — четыре уровня, четыре МЕХАНИЗМА (ЗКН-Н006).
 *
 * Утверждено основателем 11.07.2026. Единый источник на всё приложение:
 * витрины Богатств, книги, бхаджаны, киртаны, рецепты, дхама — одна система.
 *
 * ┌─────────┬──────────────────┬─────────────────────────────────────────────┐
 * │ Уровень │ Механизм         │ Что говорит глазу                           │
 * ├─────────┼──────────────────┼─────────────────────────────────────────────┤
 * │ Tier-1  │ ЛИНИЯ            │ «Где я в приложении» — золотая рейка под    │
 * │ Витрины │ HallTabs         │ активной вкладкой. Классический таб-стрип.  │
 * ├─────────┼──────────────────┼─────────────────────────────────────────────┤
 * │ Tier-2  │ РАЗМЕР           │ «Что я смотрю» — крупный кегль 21px.        │
 * │ Область │ ScopeTitle       │ Активное чёрное/жирное, соседние светлые.   │
 * ├─────────┼──────────────────┼─────────────────────────────────────────────┤
 * │ Tier-3  │ КОНТУР           │ «Чем отфильтровано» — капсула с обводкой,   │
 * │ Фильтр  │ FilterChips      │ активная обведена золотом. БЕЗ заливки.     │
 * ├─────────┼──────────────────┼─────────────────────────────────────────────┤
 * │ Tier-4  │ РАСКРЫТИЕ        │ Структура, а НЕ ряд меню. Живёт в списке     │
 * │ Группы  │ Disclosure       │ раскрывающимися секциями (SwiftUI-стиль).   │
 * └─────────┴──────────────────┴─────────────────────────────────────────────┘
 *
 * ПОЧЕМУ ТАК. Прежде уровни различались только оттенком серого и все были
 * капсулами — иерархия не читалась, шапка выглядела свалкой. Теперь ни один
 * уровень нельзя спутать с соседним: линия ≠ размер ≠ контур ≠ раскрытие.
 *
 * ЗАЛИВОК НЕТ НИГДЕ. Вес несёт типографика, а не фон (было: чёрная капсула —
 * самое тяжёлое пятно в интерфейсе). Золото — только маркер «где я».
 *
 * СЧЁТЧИКИ — верхним индексом: «Гауранга Лила⁴⁵⁰». Они справка, а не участник
 * иерархии, поэтому не должны занимать место в строке.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";

export interface NavItem { id: string; label: string; count?: number; note?: string }

/* ── Счётчик верхним индексом (общий для всех уровней) ─────────────────── */
function Sup({ n, tone = "quiet" }: { n?: number; tone?: "quiet" | "on" }) {
  if (n == null) return null;
  return (
    <sup style={{
      fontSize: "var(--text-caption2)", fontWeight: 400, verticalAlign: "super",
      fontVariantNumeric: "tabular-nums", marginLeft: 1,
      color: tone === "on" ? "var(--color-label-3)" : "var(--color-label-4, #c2c2c7)",
    }}>{n}</sup>
  );
}

/* ── Tier-1 · ЛИНИЯ — витрины. Sticky, золотая рейка. ─────────────────── */
export function HallTabs({ items, active, onChange, ariaLabel = "Разделы" }: {
  items: NavItem[]; active: string; onChange: (id: string) => void; ariaLabel?: string;
}) {
  const cRef = useRef<HTMLDivElement>(null);
  const iRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  useEffect(() => {
    const el = iRefs.current[active]; const c = cRef.current;
    if (!el || !c) return;
    c.scrollTo({ left: Math.max(0, el.offsetLeft - (c.clientWidth - el.clientWidth) / 2), behavior: "smooth" });
  }, [active]);
  return (
    <nav aria-label={ariaLabel}
      style={{ position: "sticky", top: 0, zIndex: 30, margin: "-16px -16px 14px",
        background: "var(--color-glass-nav)", backdropFilter: "blur(40px) saturate(180%)",
        WebkitBackdropFilter: "blur(40px) saturate(180%)", borderBottom: "0.5px solid var(--color-hairline)" }}>
      <div ref={cRef} style={{ display: "flex", alignItems: "stretch", height: "var(--h-hall-tabs)", overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
        {items.map((t) => {
          const on = t.id === active;
          return (
            <button key={t.id} ref={(el) => { iRefs.current[t.id] = el; }} type="button"
              role="tab" aria-selected={on} onClick={() => onChange(t.id)}
              style={{ position: "relative", flexShrink: 0, padding: "0 13px", display: "flex", alignItems: "center",
                fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)",
                background: "none", border: "none", cursor: "pointer", whiteSpace: "nowrap",
                color: on ? "var(--color-label)" : "var(--color-label-3)",
                fontWeight: on ? 600 : 400, letterSpacing: "-0.01em",
                transition: "color .15s", WebkitTapHighlightColor: "transparent" }}>
              {t.label}
              {on && <span aria-hidden style={{ position: "absolute", left: 9, right: 9, bottom: 0, height: 2, borderRadius: 2, background: "var(--color-gold)" }} />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* ── Tier-2 · РАЗМЕР — область. Крупный кегль, вес. Без декора. ────────── */
export function ScopeTitle({ items, active, onChange, ariaLabel = "Область" }: {
  items: NavItem[]; active: string; onChange: (id: string) => void; ariaLabel?: string;
}) {
  const cRef = useRef<HTMLDivElement>(null);
  const iRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  useEffect(() => {
    const el = iRefs.current[active]; const c = cRef.current;
    if (!el || !c) return;
    c.scrollTo({ left: Math.max(0, el.offsetLeft - 16), behavior: "smooth" });
  }, [active]);
  return (
    <nav ref={cRef} aria-label={ariaLabel}
      style={{ display: "flex", alignItems: "baseline", gap: 14, padding: "13px 0 0",
        overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
      {items.map((t) => {
        const on = t.id === active;
        return (
          <button key={t.id} ref={(el) => { iRefs.current[t.id] = el; }} type="button"
            role="tab" aria-selected={on} onClick={() => onChange(t.id)}
            style={{ flexShrink: 0, background: "none", border: "none", padding: 0, cursor: "pointer",
              fontFamily: "var(--font-text)", fontSize: "var(--text-title3)", whiteSpace: "nowrap",
              color: on ? "var(--color-label)" : "var(--color-label-4, #c2c2c7)",
              fontWeight: on ? 700 : 400, letterSpacing: "-0.024em",
              transition: "color .15s", WebkitTapHighlightColor: "transparent" }}>
            {t.label}<Sup n={t.count} tone={on ? "on" : "quiet"} />
          </button>
        );
      })}
    </nav>
  );
}

/* ── Tier-3 · КОНТУР — фильтр. Обводка, активная — золотом. Без заливки. ─ */
export function FilterChips({ items, active, onChange, ariaLabel = "Фильтр" }: {
  items: NavItem[]; active: string; onChange: (id: string) => void; ariaLabel?: string;
}) {
  const cRef = useRef<HTMLDivElement>(null);
  const iRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  useEffect(() => {
    const el = iRefs.current[active]; const c = cRef.current;
    if (!el || !c) return;
    c.scrollTo({ left: Math.max(0, el.offsetLeft - (c.clientWidth - el.clientWidth) / 2), behavior: "smooth" });
  }, [active]);
  return (
    <nav ref={cRef} aria-label={ariaLabel}
      style={{ display: "flex", gap: 7, padding: "11px 0 12px", overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
      {items.map((t) => {
        const on = t.id === active;
        return (
          <button key={t.id} ref={(el) => { iRefs.current[t.id] = el; }} type="button"
            role="tab" aria-selected={on} onClick={() => onChange(t.id)}
            style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", height: 28, padding: "0 12px",
              borderRadius: "var(--radius-pill)", background: "none", cursor: "pointer", whiteSpace: "nowrap",
              fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)",
              border: on ? "1px solid var(--color-gold)" : "0.5px solid var(--color-hairline-strong, #e3e3e8)",
              color: on ? "var(--color-label)" : "var(--color-label-3)",
              fontWeight: on ? 600 : 400, transition: "all .15s", WebkitTapHighlightColor: "transparent" }}>
            {t.label}<Sup n={t.count} tone={on ? "on" : "quiet"} />
          </button>
        );
      })}
    </nav>
  );
}

/* ── Tier-4 · РАСКРЫТИЕ — группы. Структура в списке, а не ряд меню. ───── */
export function Disclosure({ id, title, count, note, open, onToggle, children }: {
  id: string; title: string; count?: number; note?: string;
  open: boolean; onToggle: (id: string) => void; children: ReactNode;
}) {
  return (
    <section>
      <button type="button" onClick={() => onToggle(id)} aria-expanded={open}
        style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left",
          padding: "12px 0", background: "none", border: "none",
          borderTop: "0.5px solid var(--color-hairline)", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
        <span aria-hidden style={{ flexShrink: 0, width: 15, color: "var(--color-label-3)",
          transform: open ? "rotate(90deg)" : "none", transition: "transform .2s ease" }}>›</span>
        <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)",
          fontWeight: 600, letterSpacing: "-0.01em", color: "var(--color-label)" }}>
          {title}<Sup n={count} tone="on" />
        </span>
        {note && <span style={{ flexShrink: 0, fontFamily: "var(--font-text)", fontSize: "var(--text-caption)", color: "var(--color-label-3)" }}>{note}</span>}
      </button>
      {open && <div>{children}</div>}
    </section>
  );
}

/** Состояние раскрытых групп. Свёрнуто по умолчанию, если групп больше одной. */
export function useDisclosure(ids: string[]) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(ids.length === 1 ? ids : []));
  const toggle = (id: string) => setOpen((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const openOnly = (id: string) => setOpen(new Set([id]));
  return { open, toggle, openOnly, isOpen: (id: string) => open.has(id) };
}
