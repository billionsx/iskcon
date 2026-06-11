/**
 * SectionSubTabs (Tier-3 «Подраздел») — внутристраничная навигация по разделам.
 *
 * Идиома портирована из apartsales: отдельный уровень навигации, где активный
 * пункт несёт рейку В ЦВЕТЕ ОСНОВНОГО ТЕКСТА (НЕ бренд-акцент — акцент маркирует
 * действие, а не положение в навигации), кегль 13, горизонтальная лента с
 * автоцентровкой активного, sticky-панель «жидкого стекла».
 *
 * Лечит «листать всё окно до нужного раздела»: показываем один активный
 * подраздел, переход между ними — тапом по ленте.
 *
 * Две темы:
 *   light — белый холст ПКП (рейка чернильная, против золотой рейки Tier-1);
 *   dark  — плеер (рейка белая, золото остаётся за действием/прогрессом).
 */
import { useEffect, useRef } from "react";

export interface SubTabDef { id: string; label: string }

const TONE = {
  light: {
    active: "#1f2024", inactive: "#70727b", rail: "#1f2024",
    glass: "var(--color-glass-nav)", edge: "var(--color-hairline)",
  },
  dark: {
    active: "#ffffff", inactive: "rgba(255,255,255,0.55)", rail: "#ffffff",
    glass: "rgba(16,16,18,0.58)", edge: "rgba(255,255,255,0.14)",
  },
} as const;

export function SectionSubTabs({
  items, active, onChange, top = 0, tone = "light", navRef, ariaLabel = "Части книги", bleed = 0, variant = "rail",
}: {
  items: SubTabDef[];
  active: string;
  onChange: (id: string) => void;
  top?: number;                                  // sticky-офсет (под вышестоящей навигацией)
  tone?: "light" | "dark";
  navRef?: (el: HTMLElement | null) => void;     // для замера высоты ленты вызывающей стороной
  ariaLabel?: string;
  bleed?: number;                                // full-bleed: вынос за паддинг контейнера (px)
  variant?: "rail" | "chips";                    // rail — рейка-подчёркивание; chips — капсулы iOS 26
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const c = TONE[tone];
  // Автоскролл активного подраздела — СТРОГО по горизонтали (не дёргаем вертикаль).
  useEffect(() => {
    const el = itemRefs.current[active]; const cont = containerRef.current;
    if (!el || !cont) return;
    const target = el.offsetLeft - (cont.clientWidth - el.clientWidth) / 2;
    cont.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [active]);

  /* ── variant="chips" — лёгкая вторичная навигация по стандарту iOS 26 (Liquid Glass):
     капсулы вместо рейки, активная — чернильная заливка, без нижней линии. ── */
  if (variant === "chips") {
    const chipFg = tone === "dark" ? "#0d0d0f" : "var(--color-bg)";
    return (
      <nav ref={navRef} data-pdf-no-print aria-label={ariaLabel}
        style={{ position: "sticky", top, zIndex: 15, marginInline: bleed ? -bleed : undefined,
          background: c.glass, backdropFilter: "blur(40px) saturate(180%)", WebkitBackdropFilter: "blur(40px) saturate(180%)" }}>
        <div ref={containerRef} style={{ display: "flex", alignItems: "center", gap: 8, overflowX: "auto",
          padding: `9px ${bleed || 16}px`, scrollPaddingLeft: bleed || 16, scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
          {items.map((it) => {
            const on = it.id === active;
            return (
              <button key={it.id} ref={(el) => { itemRefs.current[it.id] = el; }} type="button" onClick={() => onChange(it.id)}
                onPointerDown={(e) => { if (!on) e.currentTarget.style.opacity = "0.55"; }}
                onPointerUp={(e) => (e.currentTarget.style.opacity = "1")}
                onPointerLeave={(e) => (e.currentTarget.style.opacity = "1")}
                style={{ flexShrink: 0, padding: "7px 13px", borderRadius: 999, border: "none", cursor: "pointer",
                  fontSize: 13, fontFamily: "var(--font-text)", letterSpacing: "-0.01em", whiteSpace: "nowrap",
                  background: on ? c.active : "var(--color-glass-regular)",
                  color: on ? chipFg : c.inactive, fontWeight: 600,
                  transition: "background .18s, color .18s", WebkitTapHighlightColor: "transparent" }}>
                {it.label}
              </button>
            );
          })}
        </div>
      </nav>
    );
  }

  return (
    <nav ref={navRef} data-pdf-no-print aria-label={ariaLabel}
      style={{ position: "sticky", top, zIndex: 15, marginInline: bleed ? -bleed : undefined, background: c.glass, backdropFilter: "blur(40px) saturate(180%)", WebkitBackdropFilter: "blur(40px) saturate(180%)", borderBottom: `0.5px solid ${c.edge}` }}>
      <div ref={containerRef} style={{ display: "flex", alignItems: "center", overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
        {items.map((it) => {
          const on = it.id === active;
          return (
            <button key={it.id} ref={(el) => { itemRefs.current[it.id] = el; }} type="button" onClick={() => onChange(it.id)}
              style={{ position: "relative", flexShrink: 0, padding: "11px 14px", fontSize: 13, background: "none", border: "none", cursor: "pointer", color: on ? c.active : c.inactive, fontWeight: on ? 600 : 500, transition: "color .15s", WebkitTapHighlightColor: "transparent", whiteSpace: "nowrap" }}>
              {it.label}
              {on && <span aria-hidden style={{ position: "absolute", insetInline: 12, bottom: 0, height: 2, borderRadius: 999, background: c.rail }} />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
