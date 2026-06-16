/**
 * BooksHub — вкладка «Книги» как хаб библиотеки.
 *
 *  • Витрина: читаемые издания Шрилы Прабхупады крупными карточками (BookHeroCard).
 *  • Разбивка по линии парампары: Шрила Прабхупада · Ачарьи-вайшнавы · Гуру ИСККОН.
 *  • Живой поиск по названию / IAST / автору (клиентский, мгновенный).
 *  • Фильтр-сегмент по линии.
 *  • Связь «книга↔герой»: у каждой книги — переход к автору (страница героя реестра),
 *    у читаемых — открытие ридера. Раздел «Гуру ИСККОН» ведёт к полке преемников.
 *
 * Меню книги (PDF/QR/поделиться/поддержать/ошибка) живёт в App (там состояние PDF/QR/
 * отчёта) и приходит как onBookMenu(work, id). Визуальный язык — общий с приложением.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  BOOKS,
  LIBRARY,
  LINEAGE_LABEL,
  LINEAGE_NOTE,
  AUDIO_WORKS,
  bookFullTitle,
  type CatalogBook,
  type Lineage,
} from "./books";
import { BookHeroCard } from "./BookHeroCard";
import { searchBooks, highlight } from "./bookSearch";
import { recentReadings, pctOf, etaMinutesForBook, readingMinutesToday, readingGoalMin, setReadingGoalMin, readingStreakDays, READING_CHANGED_EVENT, type ReadingRec } from "./reading";

const GOLD = "#D2AA1B";

/* подсветка совпадения в строке результата (как нативный поиск) */
function Hi({ text, q }: { text: string; q: string }) {
  if (!q || !text) return <>{text}</>;
  return (
    <>
      {highlight(text, q).map((s, i) =>
        s.hit
          ? <mark key={i} style={{ background: `color-mix(in srgb, ${GOLD} 32%, transparent)`, color: "inherit", borderRadius: 3, padding: "0 1px" }}>{s.text}</mark>
          : <span key={i}>{s.text}</span>,
      )}
    </>
  );
}

/* русское склонение счётного слова */
function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

/* монохромный логотип через CSS-маску (цвет = currentColor родителя) */
function MaskMark({ src, size = 56, pos = "center", color = "currentColor" }: { src: string; size?: number; pos?: string; color?: string }) {
  return (
    <span aria-hidden style={{
      display: "block", width: size, height: size, backgroundColor: color,
      WebkitMaskImage: `url(${src})`, maskImage: `url(${src})`,
      WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
      WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskPosition: pos, maskPosition: pos,
    }} />
  );
}

/* золотая монограмма-инициал (как у героев) — для строк книг без обложки */
function BookMonogram({ ch, size = 50 }: { ch: string; size?: number }) {
  return (
    <span style={{ flexShrink: 0, width: size, height: size, borderRadius: 13, display: "grid", placeItems: "center",
      border: `1.5px solid color-mix(in srgb, ${GOLD} 50%, transparent)`,
      background: `color-mix(in srgb, ${GOLD} 9%, transparent)`,
      color: GOLD, fontFamily: "var(--font-scripture)", fontStyle: "italic", fontWeight: 600, fontSize: size * 0.44, lineHeight: 1 }}>
      {ch}
    </span>
  );
}

function Chevron({ muted = true }: { muted?: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden style={{ flexShrink: 0, color: muted ? "var(--color-label-3)" : "var(--color-label-2)" }}>
      <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* сегмент-фильтр по линии */
function FilterChips({ value, onChange }: { value: "all" | Lineage; onChange: (v: "all" | Lineage) => void }) {
  const opts: { id: "all" | Lineage; label: string }[] = [
    { id: "all", label: "Все" },
    { id: "prabhupada", label: "Прабхупада" },
    { id: "acharya", label: "Ачарьи" },
    { id: "guru-iskcon", label: "Гуру ИСККОН" },
  ];
  return (
    <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "2px 16px", margin: "14px -16px 0", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
      {opts.map((o) => {
        const on = value === o.id;
        return (
          <button key={o.id} type="button" onClick={() => onChange(o.id)}
            style={{ flexShrink: 0, padding: "8px 15px", borderRadius: 999, cursor: "pointer", whiteSpace: "nowrap",
              fontFamily: "var(--font-text)", fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em",
              border: on ? "0.5px solid transparent" : "0.5px solid var(--color-hairline)",
              background: on ? "var(--color-label)" : "var(--color-bg-2)",
              color: on ? "var(--color-bg)" : "var(--color-label-2)", transition: "background .15s, color .15s",
              WebkitTapHighlightColor: "transparent" }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* строка книги: открыть книгу (оверлей) + отдельная кнопка автора (связь книга↔герой) */
function BookRow({ book, last, query = "", onOpenBook, onOpenAuthor }: {
  book: CatalogBook; last: boolean; query?: string;
  onOpenBook: (b: CatalogBook) => void;
  onOpenAuthor: (id: string) => void;
}) {
  const cover = BOOKS[book.id]?.covers[0];
  const initial = (book.iast || book.title || "?").trim().charAt(0).toUpperCase();
  return (
    <li style={{ position: "relative", borderBottom: last ? "none" : "0.5px solid var(--color-hairline)" }}>
      <button type="button" aria-label={`Открыть: ${book.title}`} onClick={() => onOpenBook(book)}
        style={{ position: "absolute", inset: 0, zIndex: 1, background: "none", border: "none", cursor: "pointer", WebkitTapHighlightColor: "transparent" }} />
      <div style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "center", gap: 12, padding: "11px 13px", pointerEvents: "none" }}>
        {cover
          ? <img src={cover} alt="" loading="lazy" style={{ width: 50, height: 50, borderRadius: 11, objectFit: "cover", flexShrink: 0, border: "0.5px solid var(--color-hairline)" }} />
          : <BookMonogram ch={initial} />}
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: 15, fontWeight: 600, lineHeight: 1.25, color: "var(--color-label)",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}><Hi text={book.title} q={query} /></span>
          {book.iast && (
            <span style={{ display: "block", marginTop: 1, fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 12.5, color: "var(--color-label-3)",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}><Hi text={book.iast} q={query} /></span>
          )}
          {book.authorId ? (
            <button type="button" onClick={() => onOpenAuthor(book.authorId!)} aria-label={`Автор: ${book.authorName}`}
              style={{ pointerEvents: "auto", marginTop: 6, display: "inline-flex", alignItems: "center", gap: 4, maxWidth: "100%",
                padding: "3px 9px", borderRadius: 999, border: "0.5px solid var(--color-hairline)", background: "var(--color-fill-1)",
                fontFamily: "var(--font-text)", fontSize: 12, fontWeight: 600, color: "var(--color-label-2)", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
              onPointerDown={(e) => (e.currentTarget.style.opacity = "0.6")}
              onPointerUp={(e) => (e.currentTarget.style.opacity = "1")}
              onPointerLeave={(e) => (e.currentTarget.style.opacity = "1")}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><Hi text={book.authorName ?? ""} q={query} /></span>
              <span aria-hidden style={{ opacity: 0.7 }}>›</span>
            </button>
          ) : book.note ? (
            <span style={{ display: "block", marginTop: 3, fontFamily: "var(--font-text)", fontSize: 12.5, color: "var(--color-label-2)" }}>{book.note}</span>
          ) : null}
        </span>
        {!book.readable && (
          <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: "var(--color-label-3)", border: "0.5px solid var(--color-hairline)", borderRadius: 999, padding: "2px 8px" }}>скоро</span>
        )}
        <Chevron muted={!book.readable} />
      </div>
    </li>
  );
}

function BookList({ books, query = "", onOpenBook, onOpenAuthor }: {
  books: CatalogBook[]; query?: string;
  onOpenBook: (b: CatalogBook) => void;
  onOpenAuthor: (id: string) => void;
}) {
  if (books.length === 0) return null;
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: "none", borderRadius: 16, overflow: "hidden", background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)" }}>
      {books.map((b, i) => <BookRow key={b.id} book={b} last={i === books.length - 1} query={query} onOpenBook={onOpenBook} onOpenAuthor={onOpenAuthor} />)}
    </ul>
  );
}

/* крупная карточка-раздел (стиль карточки Прабхупады из «Ачарья») */
function SectionCard({ title, subtitle, mark, accent, onClick }: { title: string; subtitle: string; mark: ReactNode; accent?: boolean; onClick: () => void }) {
  const ring = accent
    ? { border: `1.5px solid color-mix(in srgb, ${GOLD} 55%, transparent)`, background: `color-mix(in srgb, ${GOLD} 10%, transparent)` }
    : { border: "0.5px solid var(--color-hairline)", background: "var(--color-fill-1)" };
  return (
    <button type="button" onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", padding: 15, borderRadius: 18,
        border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)", cursor: "pointer", textAlign: "left", WebkitTapHighlightColor: "transparent" }}
      onPointerDown={(e) => (e.currentTarget.style.opacity = "0.7")}
      onPointerUp={(e) => (e.currentTarget.style.opacity = "1")}
      onPointerLeave={(e) => (e.currentTarget.style.opacity = "1")}>
      <span style={{ flexShrink: 0, width: 56, height: 56, borderRadius: "50%", display: "grid", placeItems: "center", color: "var(--color-label)", overflow: "hidden", ...ring }}>
        {mark}
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700, letterSpacing: "-0.3px", color: "var(--color-label)" }}>{title}</span>
        <span style={{ display: "block", marginTop: 3, fontFamily: "var(--font-text)", fontSize: 13, color: "var(--color-label-2)", lineHeight: 1.4 }}>{subtitle}</span>
      </span>
      <span style={{ flexShrink: 0, alignSelf: "flex-start", color: "var(--color-label-3)", fontSize: 22, lineHeight: 1, marginTop: 2 }}>›</span>
    </button>
  );
}

function SectionHeader({ title, note }: { title: string; note: string }) {
  return (
    <div style={{ margin: "30px 0 12px" }}>
      <span aria-hidden style={{ display: "block", width: 28, height: 3, borderRadius: 999, background: GOLD, marginBottom: 11 }} />
      <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 800, letterSpacing: "-0.3px", color: "var(--color-label)" }}>{title}</h2>
      <p style={{ margin: "4px 0 0", fontFamily: "var(--font-text)", fontSize: 13.5, color: "var(--color-label-2)", lineHeight: 1.45 }}>{note}</p>
    </div>
  );
}

/* Полка «Продолжить чтение» — личная, офлайн, работает и для гостя. Тап ведёт в
 * точную точку, где читатель остановился (router App по сохранённому href). */
function ContinueShelf({ items, onOpenPath }: { items: ReadingRec[]; onOpenPath: (p: string) => void }) {
  const fmtEta = (m: number) => {
    if (m <= 0) return "дочитано";
    if (m < 60) return `~${Math.max(5, Math.round(m / 5) * 5)} мин`;
    const h = m / 60;
    return h < 10 ? `~${(Math.round(h * 2) / 2).toString().replace(".", ",")} ч` : `~${Math.round(h)} ч`;
  };
  return (
    <section style={{ marginTop: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, margin: "0 2px 11px" }}>
        <span aria-hidden style={{ width: 18, height: 3, borderRadius: 999, background: GOLD }} />
        <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700, letterSpacing: "-0.2px", color: "var(--color-label)" }}>Продолжить чтение</h2>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", borderRadius: 16, overflow: "hidden", background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)" }}>
        {items.map((r, i) => {
          const b = BOOKS[r.work];
          const cover = b?.covers[0];
          const title = b ? bookFullTitle(b) : r.label;
          const pct = pctOf(r);
          const eta = etaMinutesForBook(r);
          const initial = (b?.iast || title || "?").trim().charAt(0).toUpperCase();
          return (
            <li key={r.work} style={{ position: "relative", borderBottom: i === items.length - 1 ? "none" : "0.5px solid var(--color-hairline)" }}>
              <button type="button" aria-label={`Продолжить: ${title}`} onClick={() => onOpenPath(r.href)}
                style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "11px 13px", background: "none", border: "none", cursor: "pointer", textAlign: "left", WebkitTapHighlightColor: "transparent" }}
                onPointerDown={(e) => (e.currentTarget.style.opacity = "0.6")}
                onPointerUp={(e) => (e.currentTarget.style.opacity = "1")}
                onPointerLeave={(e) => (e.currentTarget.style.opacity = "1")}>
                {cover
                  ? <img src={cover} alt="" loading="lazy" style={{ width: 50, height: 50, borderRadius: 11, objectFit: "cover", flexShrink: 0, border: "0.5px solid var(--color-hairline)" }} />
                  : <BookMonogram ch={initial} />}
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: 15, fontWeight: 600, lineHeight: 1.25, color: "var(--color-label)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</span>
                  <span style={{ display: "block", marginTop: 2, fontFamily: "var(--font-text)", fontSize: 12.5, color: "var(--color-label-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</span>
                  {pct != null && (
                    <span style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7 }}>
                      <span aria-hidden style={{ flex: 1, height: 4, borderRadius: 999, background: "var(--color-fill-1)", overflow: "hidden" }}>
                        <span style={{ display: "block", height: "100%", width: `${pct}%`, background: GOLD, borderRadius: 999 }} />
                      </span>
                      <span style={{ flexShrink: 0, fontFamily: "var(--font-text)", fontSize: 11.5, fontWeight: 600, color: "var(--color-label-3)", fontVariantNumeric: "tabular-nums" }}>{pct}%{eta != null ? ` · ${fmtEta(eta)}` : ""}</span>
                    </span>
                  )}
                </span>
                <Chevron />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* Дневная цель чтения (минуты) + серия дней — как Reading Goals в Apple Books.
 * Минуты копятся автоматически из ридера (активное время), офлайн и для гостя. */
function ReadingGoalCard() {
  const [min, setMin] = useState(() => readingMinutesToday());
  const [goal, setGoal] = useState(() => readingGoalMin());
  const [streak, setStreak] = useState(() => readingStreakDays());
  useEffect(() => {
    const refresh = () => { setMin(readingMinutesToday()); setGoal(readingGoalMin()); setStreak(readingStreakDays()); };
    const onVis = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener(READING_CHANGED_EVENT, refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener(READING_CHANGED_EVENT, refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
  const pct = Math.min(1, min / Math.max(1, goal));
  const done = min >= goal;
  const adjust = (d: number) => { const g = Math.min(120, Math.max(5, goal + d)); setReadingGoalMin(g); setGoal(g); setStreak(readingStreakDays(g)); };
  const stepBtn: CSSProperties = { width: 34, height: 28, borderRadius: 9, border: "none", background: "var(--color-fill-1)", color: "var(--color-label-2)", fontFamily: "var(--font-text)", fontSize: 13, fontWeight: 700, cursor: "pointer", WebkitTapHighlightColor: "transparent" };
  return (
    <section style={{ marginTop: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, margin: "0 2px 11px" }}>
        <span aria-hidden style={{ width: 18, height: 3, borderRadius: 999, background: GOLD }} />
        <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700, letterSpacing: "-0.2px", color: "var(--color-label)" }}>Чтение сегодня</h2>
        {streak >= 1 && (
          <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "var(--font-text)", fontSize: 12, fontWeight: 600, color: "var(--color-label-2)" }}>
            <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: GOLD }} />
            серия {streak} {plural(streak, "день", "дня", "дней")}
          </span>
        )}
      </div>
      <div style={{ borderRadius: 16, background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)", padding: "14px 15px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, color: "var(--color-label)", fontVariantNumeric: "tabular-nums" }}>{min}</span>
          <span style={{ fontFamily: "var(--font-text)", fontSize: 13.5, color: done ? GOLD : "var(--color-label-2)" }}>{done ? `норма ${goal} мин выполнена` : `из ${goal} мин`}</span>
        </div>
        <div aria-hidden style={{ marginTop: 9, height: 6, borderRadius: 999, background: "var(--color-fill-1)", overflow: "hidden" }}>
          <span style={{ display: "block", height: "100%", width: `${Math.round(pct * 100)}%`, background: GOLD, borderRadius: 999, transition: "width .3s ease" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 11 }}>
          <span style={{ fontFamily: "var(--font-text)", fontSize: 12.5, color: "var(--color-label-3)" }}>Дневная цель</span>
          <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <button type="button" aria-label="Уменьшить цель на 5 минут" onClick={() => adjust(-5)} disabled={goal <= 5} style={{ ...stepBtn, opacity: goal <= 5 ? 0.5 : 1 }}>−5</button>
            <span style={{ minWidth: 52, textAlign: "center", fontFamily: "var(--font-text)", fontSize: 13.5, fontWeight: 700, color: "var(--color-label)", fontVariantNumeric: "tabular-nums" }}>{goal} мин</span>
            <button type="button" aria-label="Увеличить цель на 5 минут" onClick={() => adjust(5)} disabled={goal >= 120} style={{ ...stepBtn, opacity: goal >= 120 ? 0.5 : 1 }}>+5</button>
          </span>
        </div>
      </div>
    </section>
  );
}

export default function BooksHub({ onOpenBook, onBookMenu, onOpenEntity, onOpenCollection, onOpenPath, flash }: {
  onOpenBook: (work: string) => void;
  onBookMenu: (work: string, id: string) => void;
  onOpenEntity: (id: string, type: string | null) => void;
  onOpenCollection: (key: string) => void;
  onOpenPath: (path: string) => void;
  flash: (m: string) => void;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | Lineage>("all");
  const inputRef = useRef<HTMLInputElement>(null);

  // Полка «Продолжить»: локальный прогресс, обновляется при чтении (событие) и
  // при возврате в приложение (focus) — хаб остаётся смонтирован под ридером.
  const [continueItems, setContinueItems] = useState<ReadingRec[]>(() => recentReadings(4));
  useEffect(() => {
    const refresh = () => setContinueItems(recentReadings(4));
    refresh();
    window.addEventListener(READING_CHANGED_EVENT, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener(READING_CHANGED_EVENT, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const trimmed = q.trim();
  const searching = trimmed.length >= 2;
  // ранжированный фаззи-поиск + скоуп активного фильтра
  const results = useMemo(() => {
    if (!searching) return [] as CatalogBook[];
    const hits = searchBooks(trimmed, LIBRARY);
    const scoped = filter === "all" ? hits : hits.filter((h) => h.book.lineage === filter);
    return scoped.map((h) => h.book);
  }, [trimmed, searching, filter]);

  // книга-строка → читаемые в ридер, остальные — на страницу сущности книги
  const openBook = (b: CatalogBook) => onOpenEntity(b.id, "scripture");
  const openAuthor = (id: string) => onOpenEntity(id, "personality");

  const byLineage = (l: Lineage) => LIBRARY.filter((b) => b.lineage === l);
  const prabhupadaReadable = byLineage("prabhupada").filter((b) => b.readable);
  const prabhupadaMore = byLineage("prabhupada").filter((b) => !b.readable);

  return (
    <div>
      {/* шапка */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.4px", textTransform: "uppercase", color: "var(--color-brand-blue)" }}>Библиотека</div>
        <h1 style={{ margin: "2px 0 0", fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 800, letterSpacing: "-0.4px", color: "var(--color-label)" }}>Книги</h1>
        <p style={{ margin: "4px 0 0", fontFamily: "var(--font-text)", fontSize: 14, color: "var(--color-label-2)", lineHeight: 1.4 }}>
          Священные тексты — от первоисточников парампары до изданий Шрилы Прабхупады
        </p>
      </div>

      {/* поиск — нативная строка: лупа + очистка + клавиатура (Enter → первый, Esc → сброс) */}
      <div role="search" style={{ position: "relative", marginTop: 14 }}>
        <span aria-hidden style={{ position: "absolute", left: 13, top: 0, bottom: 0, display: "grid", placeItems: "center", color: "var(--color-label-3)", pointerEvents: "none" }}>
          <svg width="18" height="18" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="m20 20-3.4-3.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </span>
        <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setQ("");
            else if (e.key === "Enter" && results.length > 0) { e.currentTarget.blur(); openBook(results[0]); }
          }}
          placeholder="Поиск книги, автора или санскрита" inputMode="search" enterKeyHint="search"
          autoComplete="off" autoCorrect="off" spellCheck={false} aria-label="Поиск по библиотеке"
          style={{ width: "100%", boxSizing: "border-box", padding: "12px 40px", borderRadius: 14, border: "0.5px solid var(--color-hairline)",
            background: "var(--color-bg-2)", fontFamily: "var(--font-text)", fontSize: 16, color: "var(--color-label)", outline: "none", WebkitAppearance: "none" }} />
        {q && (
          <button type="button" aria-label="Очистить" onClick={() => { setQ(""); inputRef.current?.focus(); }}
            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", width: 26, height: 26, borderRadius: "50%", border: "none",
              background: "var(--color-fill-1)", color: "var(--color-label-2)", cursor: "pointer", display: "grid", placeItems: "center", WebkitTapHighlightColor: "transparent" }}>
            <svg width="13" height="13" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
          </button>
        )}
      </div>

      <FilterChips value={filter} onChange={setFilter} />

      {searching ? (
        <div style={{ marginTop: 16 }} aria-live="polite">
          {results.length === 0 ? (
            <div style={{ padding: "26px 8px", textAlign: "center", color: "var(--color-label-3)", fontFamily: "var(--font-text)", fontSize: 15, lineHeight: 1.55 }}>
              Ничего не найдено по запросу «{trimmed}».<br />Попробуйте название, автора или санскрит (IAST).
            </div>
          ) : (
            <>
              <div style={{ margin: "2px 2px 10px", fontFamily: "var(--font-text)", fontSize: 12.5, color: "var(--color-label-3)" }}>{results.length} {plural(results.length, "книга", "книги", "книг")}</div>
              <BookList books={results} query={trimmed} onOpenBook={openBook} onOpenAuthor={openAuthor} />
            </>
          )}
        </div>
      ) : (
        <>
          <ReadingGoalCard />
          {continueItems.length > 0 && <ContinueShelf items={continueItems} onOpenPath={onOpenPath} />}
          {/* ── Шрила Прабхупада ── */}
          {(filter === "all" || filter === "prabhupada") && (
            <section>
              <SectionHeader title={LINEAGE_LABEL.prabhupada} note={LINEAGE_NOTE.prabhupada} />
              <SectionCard
                title="Шрила Прабхупада"
                subtitle="Ачарья-основатель ИСККОН — об авторе и его трудах"
                mark={<MaskMark src="/prabhupada.svg" size={52} pos="center bottom" />}
                accent
                onClick={() => onOpenEntity("prabhupada", "personality")}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 14 }}>
                {prabhupadaReadable.map((b) => {
                  const work = b.id;
                  return (
                    <BookHeroCard
                      key={work}
                      book={BOOKS[work]}
                      topLeft={<MaskMark src="/bbt.svg" size={26} />}
                      onOpen={() => onOpenBook(work)}
                      flash={flash}
                      onListen={AUDIO_WORKS[work] ? undefined : () => flash("Аудиокнига — скоро")}
                      onMenuSelect={(id) => onBookMenu(work, id)}
                    />
                  );
                })}
              </div>
              {prabhupadaMore.length > 0 && (
                <>
                  <div style={{ margin: "20px 2px 8px", fontFamily: "var(--font-text)", fontSize: 11, fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", color: "var(--color-label-3)" }}>Ещё книги Шрилы Прабхупады</div>
                  <BookList books={prabhupadaMore} onOpenBook={openBook} onOpenAuthor={openAuthor} />
                </>
              )}
            </section>
          )}

          {/* ── Ачарьи-вайшнавы ── */}
          {(filter === "all" || filter === "acharya") && (
            <section>
              <SectionHeader title={LINEAGE_LABEL.acharya} note={LINEAGE_NOTE.acharya} />
              <BookList books={byLineage("acharya")} onOpenBook={openBook} onOpenAuthor={openAuthor} />
            </section>
          )}

          {/* ── Гуру ИСККОН ── */}
          {(filter === "all" || filter === "guru-iskcon") && (
            <section>
              <SectionHeader title={LINEAGE_LABEL["guru-iskcon"]} note={LINEAGE_NOTE["guru-iskcon"]} />
              <div style={{ marginBottom: 12 }}>
                <BookList books={byLineage("guru-iskcon")} onOpenBook={openBook} onOpenAuthor={openAuthor} />
              </div>
              <SectionCard
                title="Преемники Прабхупады"
                subtitle="Духовные учителя ИСККОН, дающие посвящение и продолжающие линию"
                mark={<MaskMark src="/iskcon-sign.svg" size={40} />}
                onClick={() => onOpenCollection("iskcon-gurus")}
              />
            </section>
          )}

          {/* ── Практические книги ── */}
          {filter === "all" && (
            <section>
              <SectionHeader title="Кухня прасада" note="Практическая книга по прасаду — в дополнение к священным текстам" />
              <SectionCard
                title="Кухня прасада"
                subtitle="Философия, продукты и специи, техники, 100 рецептов и подношение"
                mark={<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 11h18a8 8 0 0 1-16 0z" /><path d="M8.5 7.5c0-1.6 1-2.4 1-3.6M12.5 7.5c0-1.6 1-2.4 1-3.6" /></svg>}
                onClick={() => onOpenPath("/prasadam/book")}
              />
            </section>
          )}
        </>
      )}
    </div>
  );
}
