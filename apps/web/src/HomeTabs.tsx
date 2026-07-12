/**
 * HomeTabs — Tier-1 навигация Главной (стандарт BookTabs: золотая рейка 2px,
 * sticky «жидкое стекло», горизонтальная лента с автоцентровкой активного).
 * Уровни ниже — SectionSubTabs (Tier-2/Tier-3).
 */
import { useEffect, useRef } from "react";

const GOLD = "var(--color-gold)";

export type HomeTabId =
  | "iskcon"       // ИСККОН — презентация
  | "sadhana"      // Садхана — хаб ежедневной практики
  | "calendar"     // Вайшнавский календарь
  | "feed"         // Лента ISKCON (@iskcone)
  | "news"         // Новости ИСККОН
  | "centres"      // Центры ИСККОН
  | "restaurants"  // Рестораны ИСККОН
  | "education"    // Образование ИСККОН
  | "structure"    // Структура ИСККОН
  | "documents"    // Документы ИСККОН
  | "links";       // Ссылки ИСККОН

export const HOME_TABS: readonly { id: HomeTabId; label: string }[] = [
  { id: "iskcon",      label: "ИСККОН" },
  { id: "news",        label: "Новости" },
  { id: "centres",     label: "Центры" },
  { id: "restaurants", label: "Рестораны" },
  { id: "education",   label: "Образование" },
  { id: "structure",   label: "Структура" },
  { id: "documents",   label: "Документы" },
  { id: "links",       label: "Ссылки" },
] as const;

export function HomeTabs({ active, onChange, navRef }: {
  active: HomeTabId;
  onChange: (id: HomeTabId) => void;
  navRef?: (el: HTMLElement | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  // Автоцентровка активного — строго по горизонтали (не дёргаем вертикаль).
  useEffect(() => {
    const el = tabRefs.current[active]; const c = containerRef.current;
    if (!el || !c) return;
    const target = el.offsetLeft - (c.clientWidth - el.clientWidth) / 2;
    c.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [active]);
  return (
    <nav ref={navRef} aria-label="Разделы Главной"
      style={{ position: "sticky", top: 0, zIndex: 30, margin: "-16px -16px 0",
        background: "var(--color-glass-nav)", backdropFilter: "blur(40px) saturate(180%)", WebkitBackdropFilter: "blur(40px) saturate(180%)",
        borderBottom: "0.5px solid var(--color-hairline)" }}>
      <div ref={containerRef} style={{ display: "flex", alignItems: "center", overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
        {HOME_TABS.map((t) => {
          const on = t.id === active;
          return (
            <button key={t.id} ref={(el) => { tabRefs.current[t.id] = el; }} type="button" onClick={() => onChange(t.id)}
              style={{ position: "relative", flexShrink: 0, padding: "0 13px", height: "var(--h-hall-tabs)", display: "flex", alignItems: "center", fontSize: "var(--text-subhead)", fontFamily: "var(--font-text)", background: "none", border: "none", cursor: "pointer",
                color: on ? "var(--color-label)" : "var(--color-label-2)", fontWeight: on ? 700 : 500, letterSpacing: on ? "-0.01em" : 0,
                transition: "color .15s", WebkitTapHighlightColor: "transparent", whiteSpace: "nowrap" }}>
              {t.label}
              {on && <span aria-hidden style={{ position: "absolute", insetInline: 12, bottom: 0, height: 2, borderRadius: 999, background: GOLD }} />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}


/* ЗКН-Н023 — АДРЕС ВКЛАДКИ ИСККОН.
 *
 * Слаг вкладки — по-английски и читаемо: `centers`, а не `centres`
 * (ЗКН-Н023: адрес читает человек). Внутренний id остаётся как есть.
 */
const TAB_SLUG: Record<string, string> = {
  iskcon: "",
  news: "news",
  centres: "centers",
  restaurants: "restaurants",
  education: "education",
  structure: "structure",
  documents: "documents",
  links: "links",
};

const SLUG_TAB: Record<string, HomeTabId> = Object.fromEntries(
  Object.entries(TAB_SLUG).filter(([, v]) => v).map(([k, v]) => [v, k as HomeTabId])
) as Record<string, HomeTabId>;

/** Адрес вкладки: /iskcon, /iskcon/centers … */
export function pathOfTab(id: HomeTabId): string {
  const slug = TAB_SLUG[id];
  return slug ? "/iskcon/" + slug : "/iskcon";
}

/** Вкладка из адреса. Неизвестный адрес → «ИСККОН». */
export function tabFromPath(): HomeTabId {
  if (typeof window === "undefined") return "iskcon";
  const seg = window.location.pathname.split("/").filter(Boolean);
  if (seg[0] !== "iskcon" || !seg[1]) return "iskcon";
  return SLUG_TAB[seg[1]] ?? "iskcon";
}
