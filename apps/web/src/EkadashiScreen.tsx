/**
 * Экран Экадаши (Ц5) — практика поста. Ближайший Экадаши, окно параны по городу,
 * правила (зерно и бобовые исключаются, усиление джапы и слушания), отметка
 * соблюдения (в дневник садханы) и переход к рецептам анукалпы.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { getEkadashiInfo, isEkadashiObserved, markEkadashiObserved, type EkadashiInfo } from "./ekadashi";
import { moonPhase, moonLitPath } from "./moonPhase";

const ON_GOLD = "var(--color-on-gold)";

const GOLD = "var(--color-gold)";
const INK = "var(--color-label)";
const INK2 = "var(--color-label-2)";
const INK3 = "var(--color-label-3)";
const SURF = "var(--color-bg-2)";
const BG = "var(--color-bg)";
const HAIR = "var(--color-hairline)";
const FONT = "var(--font-text)";
const OK = "var(--color-success-text, #2a9c68)";

const WD = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
const MO = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
function ruDate(s: string): string { const d = new Date(s + "T00:00:00"); return `${WD[d.getDay()]}, ${d.getDate()} ${MO[d.getMonth()]}`; }
const daysLabel = (n: number) => (n <= 0 ? "сегодня" : n === 1 ? "завтра" : `через ${n} дн.`);

function Card({ children }: { children: ReactNode }) {
  return <div style={{ background: SURF, borderRadius: 16, border: `0.5px solid ${HAIR}`, boxShadow: "var(--shadow-card)", overflow: "hidden", marginTop: 14 }}>{children}</div>;
}
function Eyebrow({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: "var(--text-caption)", fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: GOLD, fontFamily: FONT, marginBottom: 8 }}>{children}</div>;
}

/** Лик Луны этого Экадаши: шукла — растущая (почти полная), кришна — убывающий серп. */
function MoonBadge({ date, accent }: { date: string; accent: boolean }) {
  const p = moonPhase(date);
  const col = accent ? GOLD : INK2;
  return (
    <div style={{ flexShrink: 0, width: 58, height: 58, borderRadius: 16, display: "grid", placeItems: "center", background: accent ? "color-mix(in srgb, var(--color-gold) 12%, transparent)" : "var(--color-fill-1)" }}>
      <svg width={38} height={38} viewBox="0 0 24 24" aria-hidden style={{ color: col }}>
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth={0.9} opacity={0.32} />
        <path d={moonLitPath(p.frac, p.waxing, 10)} fill="currentColor" />
      </svg>
    </div>
  );
}
const phaseLine = (date: string) => (moonPhase(date).waxing ? "Растущая Луна · шукла-пакша" : "Убывающая Луна · кришна-пакша");

export default function EkadashiScreen({ onBack, onOpenPath }: { onBack: () => void; onOpenPath: (path: string) => void }) {
  const [info, setInfo] = useState<EkadashiInfo | null | "loading">("loading");
  const [observed, setObserved] = useState(false);

  useEffect(() => {
    let alive = true;
    void getEkadashiInfo().then((i) => { if (!alive) return; setInfo(i); if (i) setObserved(isEkadashiObserved(i.date)); });
    return () => { alive = false; };
  }, []);

  function toggle() {
    if (!info || info === "loading") return;
    const next = !observed;
    setObserved(next);
    markEkadashiObserved(info.date, next);
  }

  const header = (
    <div style={{ position: "sticky", top: 0, zIndex: 5, display: "flex", alignItems: "center", gap: 6, padding: "calc(8px + env(safe-area-inset-top)) 8px 8px", background: BG, borderBottom: `0.5px solid ${HAIR}` }}>
      <button onClick={onBack} aria-label="Назад" style={{ background: "none", border: "none", color: INK, cursor: "pointer", padding: 8, display: "grid", placeItems: "center" }}>
        <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
      </button>
      <span style={{ fontSize: "var(--text-body)", fontWeight: 650, color: INK, fontFamily: FONT }}>Экадаши</span>
    </div>
  );

  const label: CSSProperties = { fontSize: "var(--text-footnote)", fontWeight: 600, letterSpacing: 0.2, color: INK3, fontFamily: FONT, textTransform: "uppercase", margin: "22px 4px 0" };

  let body: ReactNode;
  if (info === "loading") {
    body = <div style={{ padding: "60px 0", textAlign: "center", color: INK3, fontFamily: FONT }}>Загрузка…</div>;
  } else if (!info) {
    body = <div style={{ padding: "40px 8px", textAlign: "center", color: INK2, fontFamily: FONT, lineHeight: 1.5 }}>Не удалось получить календарь. Проверьте город в разделе «Календарь».</div>;
  } else {
    const today = info.daysUntil <= 0;
    body = (
      <>
        {/* Герой — тихая карточка с настоящим ликом Луны (не золотая плашка) */}
        <div style={{ background: SURF, borderRadius: 20, border: `0.5px solid ${HAIR}`, boxShadow: "var(--shadow-card)", padding: "16px 16px", marginTop: 16, display: "flex", alignItems: "center", gap: 15 }}>
          <MoonBadge date={info.date} accent={today} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: "var(--text-caption)", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: GOLD, fontFamily: FONT }}>{today ? "Сегодня Экадаши" : "Следующий Экадаши"}</div>
            <div style={{ fontSize: "var(--text-title2)", fontWeight: 700, color: INK, fontFamily: FONT, letterSpacing: -0.3, marginTop: 3, lineHeight: 1.15 }}>{info.name}-экадаши</div>
            <div style={{ fontSize: "var(--text-subhead)", color: INK2, fontFamily: FONT, marginTop: 3 }}>{ruDate(info.date)} · {daysLabel(info.daysUntil)}</div>
            <div style={{ fontSize: "var(--text-footnote)", color: INK3, fontFamily: FONT, marginTop: 3 }}>{phaseLine(info.date)}</div>
          </div>
        </div>

        {/* Отметка соблюдения */}
        <button onClick={toggle} style={{ width: "100%", marginTop: 14, padding: "15px 18px", borderRadius: 14, cursor: "pointer", fontFamily: FONT, fontSize: "var(--text-body)", fontWeight: 650, border: `1.5px solid ${observed ? OK : GOLD}`, background: observed ? "color-mix(in srgb, var(--color-success-text, #2a9c68) 12%, transparent)" : GOLD, color: observed ? OK : ON_GOLD, WebkitTapHighlightColor: "transparent", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {observed ? "✓ Пост соблюдён" : "Соблюдаю пост"}
        </button>
        <div style={{ fontSize: "var(--text-footnote)", color: INK3, fontFamily: FONT, textAlign: "center", marginTop: 7, padding: "0 12px", lineHeight: 1.4 }}>Отметка сохраняется в дневник садханы.</div>

        {/* Парана */}
        <div style={label}>Выход из поста · парана</div>
        <Card>
          <div style={{ padding: "16px 16px" }}>
            {info.paranStart ? (
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontSize: "var(--text-title2)", fontWeight: 750, color: GOLD, fontFamily: FONT, letterSpacing: -0.3 }}>{info.paranStart}{info.paranEnd ? `–${info.paranEnd}` : ""}</span>
              </div>
            ) : (
              <div style={{ fontSize: "var(--text-callout)", color: INK2, fontFamily: FONT }}>Время уточняется в календаре</div>
            )}
            <div style={{ fontSize: "var(--text-subhead)", color: INK2, fontFamily: FONT, marginTop: 8, lineHeight: 1.45 }}>
              Пост завершают на следующее утро{info.paranDate ? ` (${ruDate(info.paranDate)})` : ""} в отведённое время — по городу {info.city}.
            </div>
          </div>
        </Card>

        {/* Правила */}
        <div style={label}>Как соблюдать</div>
        <Card>
          <div style={{ padding: "16px 16px", fontFamily: FONT }}>
            <Eyebrow>Пост от зерна и бобовых</Eyebrow>
            <div style={{ fontSize: "var(--text-subhead)", lineHeight: 1.55, color: INK }}>
              В Экадаши преданные воздерживаются от зерновых (рис, пшеница, кукуруза) и бобовых (дал, горох, фасоль). Усиливают повторение святого имени, слушание и чтение — это главная цель дня.
            </div>
            <div style={{ height: "0.5px", background: HAIR, margin: "14px 0" }} />
            <Eyebrow>Что можно</Eyebrow>
            <div style={{ fontSize: "var(--text-subhead)", lineHeight: 1.55, color: INK }}>
              Фрукты, овощи, орехи, молочное, картофель. Предложите Кришне и почтите как прасад. Полный пост (без воды) — по силам и желанию.
            </div>
          </div>
        </Card>

        {/* Рецепты */}
        <button onClick={() => onOpenPath("/prasad")} style={{ width: "100%", marginTop: 14, padding: "15px 16px", borderRadius: 14, border: `0.5px solid ${HAIR}`, background: SURF, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", gap: 12, WebkitTapHighlightColor: "transparent", textAlign: "left" }}>
          <span style={{ fontSize: "var(--text-title2)" }}>🍲</span>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", fontSize: "var(--text-callout)", fontWeight: 600, color: INK }}>Что готовить</span>
            <span style={{ display: "block", fontSize: "var(--text-footnote)", color: INK3, marginTop: 1 }}>Рецепты прасада без зерна и бобовых</span>
          </span>
          <span style={{ color: INK3 }}>›</span>
        </button>
      </>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: BG }}>
      {header}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain" }}>
        <div style={{ padding: "0 16px calc(28px + env(safe-area-inset-bottom))", maxWidth: 640, margin: "0 auto" }}>{body}</div>
      </div>
    </div>
  );
}
