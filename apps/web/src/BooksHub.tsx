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
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  BOOKS,
  LIBRARY,
  LINEAGE_LABEL,
  LINEAGE_NOTE,
  AUDIO_WORKS,
  type CatalogBook,
  type Lineage,
} from "./books";
import { BookHeroCard } from "./BookHeroCard";

const GOLD = "#D2AA1B";

/** Снимает диакритику (IAST → ASCII) и регистр: «Bhāgavatam»→«bhagavatam». Кириллицу не трогает. */
const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

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
function BookRow({ book, last, onOpenBook, onOpenAuthor }: {
  book: CatalogBook; last: boolean;
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
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{book.title}</span>
          {book.iast && (
            <span style={{ display: "block", marginTop: 1, fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 12.5, color: "var(--color-label-3)",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{book.iast}</span>
          )}
          {book.authorId ? (
            <button type="button" onClick={() => onOpenAuthor(book.authorId!)} aria-label={`Автор: ${book.authorName}`}
              style={{ pointerEvents: "auto", marginTop: 6, display: "inline-flex", alignItems: "center", gap: 4, maxWidth: "100%",
                padding: "3px 9px", borderRadius: 999, border: "0.5px solid var(--color-hairline)", background: "var(--color-fill-1)",
                fontFamily: "var(--font-text)", fontSize: 12, fontWeight: 600, color: "var(--color-label-2)", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
              onPointerDown={(e) => (e.currentTarget.style.opacity = "0.6")}
              onPointerUp={(e) => (e.currentTarget.style.opacity = "1")}
              onPointerLeave={(e) => (e.currentTarget.style.opacity = "1")}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{book.authorName}</span>
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

function BookList({ books, onOpenBook, onOpenAuthor }: {
  books: CatalogBook[];
  onOpenBook: (b: CatalogBook) => void;
  onOpenAuthor: (id: string) => void;
}) {
  if (books.length === 0) return null;
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: "none", borderRadius: 16, overflow: "hidden", background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)" }}>
      {books.map((b, i) => <BookRow key={b.id} book={b} last={i === books.length - 1} onOpenBook={onOpenBook} onOpenAuthor={onOpenAuthor} />)}
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

export default function BooksHub({ onOpenBook, onBookMenu, onOpenEntity, onOpenCollection, flash }: {
  onOpenBook: (work: string) => void;
  onBookMenu: (work: string, id: string) => void;
  onOpenEntity: (id: string, type: string | null) => void;
  onOpenCollection: (key: string) => void;
  flash: (m: string) => void;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | Lineage>("all");

  const trimmed = q.trim();
  const searching = trimmed.length >= 2;
  const results = useMemo(() => {
    if (!searching) return [];
    const needle = fold(trimmed);
    return LIBRARY.filter((b) =>
      fold([b.title, b.iast, b.authorName, b.note, b.also].filter(Boolean).join(" ")).includes(needle),
    );
  }, [trimmed, searching]);

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

      {/* поиск */}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск книги или автора…" inputMode="search"
        style={{ width: "100%", boxSizing: "border-box", marginTop: 14, padding: "12px 15px", borderRadius: 14, border: "0.5px solid var(--color-hairline)",
          background: "var(--color-bg-2)", fontFamily: "var(--font-text)", fontSize: 16, color: "var(--color-label)", outline: "none" }} />

      {searching ? (
        <div style={{ marginTop: 18 }}>
          {results.length === 0
            ? <div style={{ padding: "22px 0", textAlign: "center", color: "var(--color-label-3)", fontFamily: "var(--font-text)", fontSize: 15 }}>Ничего не найдено</div>
            : <BookList books={results} onOpenBook={openBook} onOpenAuthor={openAuthor} />}
        </div>
      ) : (
        <>
          <FilterChips value={filter} onChange={setFilter} />

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
        </>
      )}
    </div>
  );
}
