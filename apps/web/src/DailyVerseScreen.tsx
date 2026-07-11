/**
 * DailyVerseScreen — «Стих дня»: системное чтение Шрилы Прабхупады, стих за стихом.
 *
 * Не случайный стих, а последовательное прохождение БГ → ШБ → ЧЧ. Единица («день»)
 * = стихи до первого комментария Прабхупады включительно (в ЧЧ часто пакет из
 * нескольких стихов). Стих показан с глобальным номером из суммы всех стихов трёх
 * книг; комментарий читается прямо здесь или открывается в книге. Позиция хранится
 * на устройстве (гостю тоже), продвижение — по «Прочитано», ничего не пропускается.
 *
 * ВАЖНО: сам стих рендерится боевым интерфейсом библиотеки (VerseBody из
 * BookDetailPage) — те же слои (деванагари, транслитерация, пословный перевод,
 * перевод, комментарий), та же «бумага» и типографика, что в читалке книг.
 * Никакого отдельного дизайна: «Стих дня» = тот же стих из библиотеки, в том же
 * виде, с полной синхронизацией данных (издание <work>-ru, verse_tokens).
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { readingClient, type ReadUnit, type ReadVerse } from "./reading/api";
import { advance, canGoBackPlan, getPlan, goBackPlan, resetPlan, setCurrent } from "./reading/position";
import { VerseBody, type ChapterVerse } from "./BookDetailPage";

/* ── «бумага» библиотечной читалки (одинаково в любой теме — это поверхность чтения) ── */
const PAPER = "#ffffff";
const INK = "#1f2024";
const INK2 = "#70727b";
const INK3 = "#a0a1a8";
const LINE = "rgba(0,0,0,0.08)";
const FILL = "rgba(0,0,0,0.045)";
const GOLD = "var(--color-gold)";
const FT = "var(--font-text)";
const FD = "var(--font-display)";

/* ── иконки ── */
const Back = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const BookIcon = () => (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15.5H5.5A1.5 1.5 0 0 1 4 18zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v15.5h5.5A1.5 1.5 0 0 0 20 18z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>);
const ArrowR = () => (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const ArrowL = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M19 12H6M11 18l-6-6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const Restart = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1M5 3v4h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>);

const fmt = (n: number) => n.toLocaleString("ru-RU");

/** ReadVerse → ChapterVerse: ровно та форма, что ест боевой VerseBody библиотеки. */
function toChapterVerse(v: ReadVerse): ChapterVerse {
  return {
    ref: v.ref,
    label: v.label,
    devanagari: v.devanagari,
    translit: v.translit,
    tokens: v.tokens,
    translation: v.translation,
    purport: v.purport,
  };
}

export default function DailyVerseScreen({ onBack, onOpenVerse }: { onBack: () => void; onOpenVerse: (verseId: string) => void }) {
  const [unit, setUnit] = useState<ReadUnit | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [canBack, setCanBack] = useState(false);
  const scroller = useRef<HTMLDivElement | null>(null);

  const toTop = () => { if (scroller.current) scroller.current.scrollTop = 0; };

  const load = useCallback(async (from: string | null) => {
    setLoading(true); setFailed(false);
    try {
      const u = await readingClient.unit(from);
      setUnit(u);
      setCurrent(u.startId);          // якорь возобновления = старт этой единицы
      setCanBack(canGoBackPlan());
    } catch { setFailed(true); } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(getPlan().from); }, [load]);

  const onNext = () => {
    if (!unit || unit.done) return;
    advance(unit.startId, unit.nextFrom);
    setCanBack(canGoBackPlan());
    void load(unit.nextFrom);
    toTop();
  };
  const onPrev = () => {
    const prev = goBackPlan();
    setCanBack(canGoBackPlan());
    void load(prev);
    toTop();
  };
  const onReset = () => { resetPlan(); setCanBack(false); void load(null); toTop(); };

  const nav: CSSProperties = {
    position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "center", gap: 4, height: 54, padding: "0 6px",
    background: PAPER, borderBottom: `0.5px solid ${LINE}`,
  };

  const verses = unit?.verses ?? [];
  const multi = verses.length > 1;
  const hasUnitPurport = verses.some((v) => !!v.purport);
  const numLabel = unit ? (unit.fromGnum === unit.toGnum ? `Стих ${fmt(unit.toGnum)}` : `Стихи ${fmt(unit.fromGnum)}–${fmt(unit.toGnum)}`) : "";
  const pct = unit ? Math.min(100, (unit.toGnum / unit.total) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: PAPER, fontFamily: FT }}>
      <header style={nav}>
        <button type="button" aria-label="Назад" onClick={onBack} style={{ display: "grid", height: 38, width: 38, placeItems: "center", borderRadius: "50%", border: "none", background: "none", color: INK, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}><Back /></button>
        <div style={{ flex: 1, textAlign: "center", fontFamily: FD, fontSize: "var(--text-body)", fontWeight: 700, letterSpacing: "-0.02em", color: INK }}>Стих дня</div>
        <span style={{ width: 38 }} />
      </header>

      <div ref={scroller} style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 20px calc(120px + env(safe-area-inset-bottom,0px))" }}>

          {loading && <div style={{ padding: "70px 0", textAlign: "center", color: INK3, fontFamily: FT, fontSize: 14 }}>Загрузка…</div>}

          {!loading && failed && (
            <div style={{ borderRadius: 18, background: FILL, padding: "34px 22px", textAlign: "center" }}>
              <p style={{ margin: "0 0 16px", fontFamily: FT, fontSize: 14, color: INK2 }}>Не удалось загрузить стих.</p>
              <button type="button" onClick={() => void load(getPlan().from)} style={{ minWidth: 120, height: 40, padding: "0 16px", borderRadius: 11, border: "none", background: FILL, color: INK, fontFamily: FT, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Повторить</button>
            </div>
          )}

          {!loading && !failed && unit && (
            <>
              {/* прогресс системного чтения */}
              <div style={{ marginBottom: 22 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ fontFamily: FT, fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLD }}>Системное чтение Прабхупады</span>
                  <span style={{ fontFamily: FT, fontSize: 11.5, color: INK3, whiteSpace: "nowrap" }}>{numLabel} из {fmt(unit.total)}</span>
                </div>
                <div style={{ marginTop: 8, height: 4, borderRadius: 3, background: FILL, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: GOLD, borderRadius: 3, transition: "width .3s" }} />
                </div>
                <div style={{ marginTop: 9, fontFamily: FT, fontSize: 12.5, color: INK2 }}>
                  {unit.workName}{multi && <span style={{ color: INK3 }}> · {verses.length} стихов до комментария</span>}
                </div>
              </div>

              {/* сам стих — боевой интерфейс библиотеки */}
              {verses.map((v) => (
                <VerseBody key={v.id} v={toChapterVerse(v)} />
              ))}

              {!hasUnitPurport && (
                <div style={{ marginTop: -16, marginBottom: 20, fontFamily: FT, fontSize: "var(--text-footnote)", color: INK3 }}>
                  К этим стихам комментария нет — продолжайте к следующему.
                </div>
              )}

              <button type="button" onClick={() => onOpenVerse(unit.startId)}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 42, padding: "0 16px", borderRadius: 12, border: `1px solid ${LINE}`, background: PAPER, color: INK, fontFamily: FT, fontSize: 14, fontWeight: 600, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                <BookIcon /> Открыть и читать в книге
              </button>

              {/* навигация по прочитанному */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 18 }}>
                <button type="button" onClick={onPrev} disabled={!canBack}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 38, padding: "0 12px", borderRadius: 10, border: "none", background: "none", color: canBack ? INK2 : "transparent", fontFamily: FT, fontSize: 13.5, fontWeight: 600, cursor: canBack ? "pointer" : "default", WebkitTapHighlightColor: "transparent" }}>
                  <ArrowL /> Назад
                </button>
                <button type="button" onClick={onReset}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 38, padding: "0 12px", borderRadius: 10, border: "none", background: "none", color: INK3, fontFamily: FT, fontSize: 12.5, fontWeight: 600, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                  <Restart /> Сначала
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* нижняя панель действия */}
      {!loading && !failed && unit && (
        <div style={{ position: "sticky", bottom: 0, padding: "12px 16px calc(14px + env(safe-area-inset-bottom,0px))", background: PAPER, borderTop: `0.5px solid ${LINE}` }}>
          <div style={{ maxWidth: 480, margin: "0 auto" }}>
            <button type="button" onClick={onNext} disabled={unit.done}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", height: 50, borderRadius: 14, border: "none", background: unit.done ? FILL : GOLD, color: unit.done ? INK3 : "#fff", fontFamily: FT, fontSize: "var(--text-callout)", fontWeight: 700, cursor: unit.done ? "default" : "pointer", WebkitTapHighlightColor: "transparent", boxShadow: unit.done ? "none" : "0 4px 16px color-mix(in srgb, " + GOLD + " 40%, transparent)" }}>
              {unit.done ? "Корпус прочитан" : <>Прочитано · дальше <ArrowR /></>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
