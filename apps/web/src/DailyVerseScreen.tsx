/**
 * DailyVerseScreen — «Стих дня»: системное чтение Шрилы Прабхупады, стих за стихом.
 *
 * Не случайный стих, а последовательное прохождение БГ → ШБ → ЧЧ. Единица («день»)
 * = стихи до первого комментария Прабхупады включительно (в ЧЧ часто пакет из
 * нескольких стихов). Стих показан с глобальным номером из суммы всех стихов трёх
 * книг; комментарий читается прямо здесь или открывается в книге. Позиция хранится
 * на устройстве (гостю тоже), продвижение — по «Прочитано», ничего не пропускается.
 *
 * Эстетика приложения (iOS-26): токены темы, золото, инлайн-SVG. Текст — боевой
 * корпус (издание <work>-ru), ничего не выдумывается и не переводится заново.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { readingClient, type ReadUnit, type ReadVerse } from "./reading/api";
import { advance, canGoBackPlan, getPlan, goBackPlan, resetPlan, setCurrent } from "./reading/position";

/* ── токены ── */
const GOLD = "#D2AA1B";
const GOLDT = "#9c7c15";
const L1 = "var(--color-label)";
const L2 = "var(--color-label-2)";
const L3 = "var(--color-label-3)";
const FILL = "var(--color-glass-thin)";
const FILL2 = "var(--color-glass-regular)";
const HAIR = "var(--color-hairline)";
const FT = "var(--font-text)";
const FD = "var(--font-display)";
const SERIF = "'Gentium Book Plus', Georgia, 'Times New Roman', serif";

/* ── иконки ── */
const Back = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const BookIcon = () => (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15.5H5.5A1.5 1.5 0 0 1 4 18zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v15.5h5.5A1.5 1.5 0 0 0 20 18z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>);
const ArrowR = () => (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const ArrowL = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M19 12H6M11 18l-6-6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const Restart = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1M5 3v4h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const Lotus = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 3c1.8 2.2 1.8 4.6 0 7-1.8-2.4-1.8-4.8 0-7Z" fill="currentColor" /><path d="M12 10c2.8-.6 5 .6 6.5 3.4-3 1-5.2.2-6.5-2M12 10c-2.8-.6-5 .6-6.5 3.4 3 1 5.2.2 6.5-2" fill="currentColor" opacity="0.6" /><path d="M5 13.5C5 17 8 19.5 12 19.5S19 17 19 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>);

const fmt = (n: number) => n.toLocaleString("ru-RU");

/** Один стих внутри единицы. full = показывать деванагари/транслит (для коротких единиц). */
function VerseBlock({ v, full, showRef }: { v: ReadVerse; full: boolean; showRef: boolean }) {
  return (
    <div style={{ paddingTop: showRef ? 14 : 0 }}>
      {showRef && (
        <div style={{ fontFamily: FT, fontSize: 11.5, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLDT, marginBottom: 7 }}>{v.ref}</div>
      )}
      {full && v.devanagari && (
        <p style={{ margin: "0 0 8px", fontFamily: SERIF, fontSize: 19, lineHeight: 1.7, color: L1, whiteSpace: "pre-line" }}>{v.devanagari}</p>
      )}
      {full && v.translit && (
        <p style={{ margin: "0 0 10px", fontFamily: SERIF, fontStyle: "italic", fontSize: 15, lineHeight: 1.6, color: L2, whiteSpace: "pre-line" }}>{v.translit}</p>
      )}
      {v.translation && (
        <p style={{ margin: 0, fontFamily: SERIF, fontSize: 16.5, lineHeight: 1.62, color: L1, whiteSpace: "pre-line" }}>{v.translation}</p>
      )}
    </div>
  );
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
    position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "center", gap: 4, height: 52, padding: "0 6px",
    background: "color-mix(in srgb, var(--color-bg) 82%, transparent)", backdropFilter: "saturate(180%) blur(20px)", WebkitBackdropFilter: "saturate(180%) blur(20px)", borderBottom: `0.5px solid ${HAIR}`,
  };

  const verses = unit?.verses ?? [];
  const multi = verses.length > 1;
  const full = verses.length <= 4;                 // короткая единица — со священным текстом
  const range = multi ? `${verses[0].ref} — ${verses[verses.length - 1].ref}` : verses[0]?.ref ?? "";
  const numLabel = unit ? (unit.fromGnum === unit.toGnum ? `Стих ${fmt(unit.toGnum)}` : `Стихи ${fmt(unit.fromGnum)}–${fmt(unit.toGnum)}`) : "";
  const pct = unit ? Math.min(100, (unit.toGnum / unit.total) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "var(--color-bg)", fontFamily: FT }}>
      <header style={nav}>
        <button type="button" aria-label="Назад" onClick={onBack} style={{ display: "grid", height: 38, width: 38, placeItems: "center", borderRadius: "50%", border: "none", background: "none", color: L1, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}><Back /></button>
        <div style={{ flex: 1, textAlign: "center", fontFamily: FD, fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em", color: L1 }}>Стих дня</div>
        <span style={{ width: 38 }} />
      </header>

      <div ref={scroller} style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        <div style={{ maxWidth: 600, margin: "0 auto", padding: "16px 16px calc(120px + env(safe-area-inset-bottom,0px))" }}>

          {loading && <div style={{ padding: "70px 0", textAlign: "center", color: L3, fontFamily: FT, fontSize: 14 }}>Загрузка…</div>}

          {!loading && failed && (
            <div style={{ borderRadius: 18, background: FILL, padding: "34px 22px", textAlign: "center" }}>
              <p style={{ margin: "0 0 16px", fontFamily: FT, fontSize: 14, color: L2 }}>Не удалось загрузить стих.</p>
              <button type="button" onClick={() => void load(getPlan().from)} style={{ minWidth: 120, height: 40, padding: "0 16px", borderRadius: 11, border: "none", background: FILL2, color: L1, fontFamily: FT, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Повторить</button>
            </div>
          )}

          {!loading && !failed && unit && (
            <>
              {/* прогресс системного чтения */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ fontFamily: FT, fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLD }}>Системное чтение Прабхупады</span>
                  <span style={{ fontFamily: FT, fontSize: 11.5, color: L3, whiteSpace: "nowrap" }}>{numLabel} из {fmt(unit.total)}</span>
                </div>
                <div style={{ marginTop: 8, height: 4, borderRadius: 3, background: "var(--color-glass-regular)", overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: GOLD, borderRadius: 3, transition: "width .3s" }} />
                </div>
              </div>

              {/* карточка единицы */}
              <article style={{ borderRadius: 22, background: FILL, padding: "20px 18px 22px" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <h1 style={{ margin: 0, fontFamily: FD, fontSize: 21, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.15, color: L1 }}>{range}</h1>
                </div>
                <div style={{ marginTop: 3, fontFamily: FT, fontSize: 13, color: L2 }}>
                  {unit.workName}{multi && <span style={{ color: L3 }}> · {verses.length} стихов до комментария</span>}
                </div>

                <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: multi ? 4 : 0 }}>
                  {verses.map((v, i) => (
                    <VerseBlock key={v.id} v={v} full={full} showRef={multi} />
                  ))}
                </div>

                {unit.purport ? (
                  <div style={{ marginTop: 22, paddingTop: 18, borderTop: `0.5px solid ${HAIR}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 8, display: "grid", placeItems: "center", background: `color-mix(in srgb, ${GOLD} 16%, transparent)`, color: GOLD }}><Lotus /></span>
                      <span style={{ fontFamily: FT, fontSize: 12.5, fontWeight: 700, letterSpacing: "0.2px", color: L1 }}>Комментарий Шрилы Прабхупады</span>
                      {multi && <span style={{ fontFamily: FT, fontSize: 11.5, color: L3 }}>· {unit.purport.ref}</span>}
                    </div>
                    <div style={{ fontFamily: SERIF, fontSize: 16, lineHeight: 1.68, color: L1, whiteSpace: "pre-line" }}>{unit.purport.text}</div>
                  </div>
                ) : (
                  <div style={{ marginTop: 18, paddingTop: 16, borderTop: `0.5px solid ${HAIR}`, fontFamily: FT, fontSize: 13, color: L3 }}>
                    К этим стихам комментария нет — продолжайте к следующему.
                  </div>
                )}

                <button type="button" onClick={() => onOpenVerse(unit.startId)}
                  style={{ marginTop: 20, display: "inline-flex", alignItems: "center", gap: 8, height: 42, padding: "0 16px", borderRadius: 12, border: `1px solid ${HAIR}`, background: FILL2, color: L1, fontFamily: FT, fontSize: 14, fontWeight: 600, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                  <BookIcon /> Открыть и читать в книге
                </button>
              </article>

              {/* навигация по прочитанному */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 16 }}>
                <button type="button" onClick={onPrev} disabled={!canBack}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 38, padding: "0 12px", borderRadius: 10, border: "none", background: "none", color: canBack ? L2 : "transparent", fontFamily: FT, fontSize: 13.5, fontWeight: 600, cursor: canBack ? "pointer" : "default", WebkitTapHighlightColor: "transparent" }}>
                  <ArrowL /> Назад
                </button>
                <button type="button" onClick={onReset}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 38, padding: "0 12px", borderRadius: 10, border: "none", background: "none", color: L3, fontFamily: FT, fontSize: 12.5, fontWeight: 600, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                  <Restart /> Сначала
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* нижняя панель действия */}
      {!loading && !failed && unit && (
        <div style={{ position: "sticky", bottom: 0, padding: "12px 16px calc(14px + env(safe-area-inset-bottom,0px))", background: "color-mix(in srgb, var(--color-bg) 86%, transparent)", backdropFilter: "saturate(180%) blur(20px)", WebkitBackdropFilter: "saturate(180%) blur(20px)", borderTop: `0.5px solid ${HAIR}` }}>
          <div style={{ maxWidth: 600, margin: "0 auto" }}>
            <button type="button" onClick={onNext} disabled={unit.done}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", height: 50, borderRadius: 14, border: "none", background: unit.done ? FILL2 : GOLD, color: unit.done ? L3 : "#fff", fontFamily: FT, fontSize: 16, fontWeight: 700, cursor: unit.done ? "default" : "pointer", WebkitTapHighlightColor: "transparent", boxShadow: unit.done ? "none" : "0 4px 16px color-mix(in srgb, " + GOLD + " 40%, transparent)" }}>
              {unit.done ? "Корпус прочитан" : <>Прочитано · дальше <ArrowR /></>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
