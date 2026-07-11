/**
 * PracticeHub — подтаб «Садхана» на Главной: хаб ежедневной практики преданного.
 * Пока заглушка: разделы перечислены карточками с бейджем «Скоро» — это каркас,
 * по которому будут собраны джапа, дневник, стих/даршан дня, прасад, новости,
 * изучение и путь. Дизайн повторяет язык Главной (золото + мягкая заливка без
 * обводок). Объём зафиксирован в docs/DECISIONS.md; разделы соответствуют
 * docs/PRODUCT_ARCHITECTURE.md и вехам docs/ROADMAP_MILESTONES.md.
 */
const GOLD = "var(--color-gold)";
const fill: React.CSSProperties = { background: "var(--color-glass-thin)", borderRadius: 20 };

type Glyph = React.ReactNode;
const I = (d: React.ReactNode): Glyph => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>
);
const ICON = {
  verse: I(<><path d="M7 7h10M7 12h10M7 17h6" /></>),
  darshan: I(<><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" /><circle cx="12" cy="12" r="2.5" /></>),
  japa: I(<><circle cx="12" cy="5" r="1.9" /><circle cx="18" cy="9" r="1.9" /><circle cx="6" cy="9" r="1.9" /><circle cx="16" cy="16" r="1.9" /><circle cx="8" cy="16" r="1.9" /></>),
  diary: I(<><path d="M5 4h11l3 3v13H5z" /><path d="M9 12l2 2 4-4" /></>),
  moon: I(<><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></>),
  bowl: I(<><path d="M3 11h18a8 8 0 0 1-16 0z" /><path d="M8.5 7.5c0-1.6 1-2.4 1-3.6M12.5 7.5c0-1.6 1-2.4 1-3.6" /></>),
  news: I(<><path d="M4 5h13v14H4z" /><path d="M17 8h3v9a2 2 0 0 1-2 2M7 9h7M7 13h7M7 17h4" /></>),
  progress: I(<><path d="M5 19V9M12 19V5M19 19v-7" /></>),
  bookmark: I(<><path d="M7 4h10v16l-5-3-5 3z" /></>),
  path: I(<><circle cx="6" cy="18" r="1.6" /><circle cx="18" cy="6" r="1.6" /><path d="M7.5 16.5l9-9" strokeDasharray="2 2.4" /></>),
  pin: I(<><path d="M12 21s7-6.3 7-11a7 7 0 0 0-14 0c0 4.7 7 11 7 11z" /><circle cx="12" cy="10" r="2.4" /></>),
};
const ChevR = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0, color: "var(--color-label-3)" }}><path d="M9 5l7 7-7 7" /></svg>;

interface Row { icon: Glyph; t: string; d: string; pri?: boolean; to?: string; go?: () => void }
interface Group { group: string; items: Row[] }

const GROUPS: Group[] = [
  { group: "Каждый день", items: [
    { icon: ICON.verse, t: "Стих дня", d: "Системное чтение Прабхупады — стих за стихом, БГ → ШБ → ЧЧ", pri: true, go: () => window.dispatchEvent(new CustomEvent("iol:open-daily-verse")) },
  ] },
  { group: "Моя практика", items: [
    { icon: ICON.japa, t: "Счётчик джапы", d: "108 бусин, цель в кругах, Маха-мантра и аналитика", pri: true, go: () => window.dispatchEvent(new CustomEvent("iol:open-japa")) },
    { icon: ICON.diary, t: "Дневник садханы", d: "Круги, чтение, подъём — стрики и статистика", pri: true, go: () => window.dispatchEvent(new CustomEvent("iol:open-diary")) },
    { icon: ICON.moon, t: "Экадаши", d: "Дни поста, время параны по городу, отметка соблюдения", to: "/ekadashi" },
  ] },
  { group: "Прасад", items: [
    { icon: ICON.bowl, t: "Рецепты прасада", d: "100 рецептов, подбор по продуктам и диете, что дорого Божествам, подношение", to: "/prasadam" },
    { icon: ICON.bookmark, t: "Книга «Кухня прасада»", d: "Философия, продукты и специи, техники, рецепты и подношение", to: "/prasadam/book" },
  ] },
  { group: "Изучение", items: [
    { icon: ICON.progress, t: "Мой прогресс", d: "Прочитано: системное чтение, книги, время и стрик", go: () => window.dispatchEvent(new CustomEvent("iol:open-progress")) },
  ] },
  { group: "Рост", items: [
    { icon: ICON.path, t: "Путь преданного", d: "Ступени от шраддхи к преме, цели и достижения" },
  ] },
];

export default function PracticeHub({ onOpen }: { onOpen?: (path: string) => void }) {
  return (
    <div style={{ fontFamily: "var(--font-text)" }}>
      <div style={{ padding: "20px 0 0" }}>
        <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLD }}>Каждый день</div>
        <h2 style={{ margin: "5px 0 0", fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800, letterSpacing: "-0.022em", lineHeight: 1.1, color: "var(--color-label)" }}>Садхана</h2>
        <p style={{ margin: "8px 0 0", fontFamily: "var(--font-text)", fontSize: 14, lineHeight: 1.5, color: "var(--color-label-2)" }}>
          Личное пространство ежедневной практики: стих дня, джапа, дневник, прасад и путь преданного. Здесь будет ваш ежедневный заход в храм.
        </p>
      </div>

      {GROUPS.map((g) => (
        <section key={g.group} style={{ marginTop: 26 }}>
          <div style={{ margin: "0 2px 10px", fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: "var(--color-label-3)" }}>{g.group}</div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", overflow: "hidden", ...fill }}>
            {g.items.map((it, i) => {
              const activate = it.to ? () => onOpen?.(it.to!) : it.go;
              const nav = !!activate;
              const inner = (
                <>
                  <span aria-hidden style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 11, display: "grid", placeItems: "center", background: `color-mix(in srgb, ${GOLD} 14%, transparent)`, color: GOLD }}>{it.icon}</span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: "var(--font-text)", fontSize: 15.5, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--color-label)" }}>{it.t}</span>
                      {it.pri && <span title="Приоритет" aria-label="приоритет" style={{ flexShrink: 0, width: 6, height: 6, borderRadius: "50%", background: GOLD }} />}
                    </span>
                    <span style={{ display: "block", marginTop: 2, fontFamily: "var(--font-text)", fontSize: 12.5, lineHeight: 1.45, color: "var(--color-label-2)" }}>{it.d}</span>
                  </span>
                  {nav
                    ? <ChevR />
                    : <span style={{ flexShrink: 0, padding: "2px 8px", borderRadius: 999, background: "var(--color-glass-regular)", fontFamily: "var(--font-text)", fontSize: 10, fontWeight: 700, letterSpacing: "0.4px", textTransform: "uppercase", color: "var(--color-label-3)" }}>Скоро</span>}
                </>
              );
              return (
                <li key={it.t} style={{ borderTop: i ? "0.5px solid var(--color-hairline)" : "none" }}>
                  {nav ? (
                    <button type="button" onClick={activate}
                      style={{ display: "flex", alignItems: "center", gap: 13, width: "100%", padding: "14px 16px", border: "none", background: "none", cursor: "pointer", textAlign: "left", font: "inherit", WebkitTapHighlightColor: "transparent" }}>
                      {inner}
                    </button>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 13, padding: "14px 16px" }}>
                      {inner}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <div style={{ height: 24 }} />
    </div>
  );
}
