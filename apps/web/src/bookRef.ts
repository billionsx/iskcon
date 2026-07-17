/* ЗКН-Н083 · КАНОНИЧЕСКАЯ ССЫЛКА НА ЕДИНИЦУ ПИСАНИЯ — ОДИН ИСТОЧНИК.
 *
 * Закладка стиха / главы обязана в мини-карточке «Избранного» показывать, ЧТО
 * она такое: ПИСАНИЕ · песнь/лила · глава · стих. Раньше карточка показывала
 * лишь «Текст 17» без книги, песни и главы — по такой подписи невозможно понять,
 * что за закладка (текст 17 есть в тысячах глав). Это и была жалоба основателя.
 *
 * Ссылка «рождается в одном месте» (в духе ЗКН-Н060): этот модуль — единственный
 * строитель канонической подписи. Его переиспользуют И экран «Избранное» (рендер
 * карточки), И читалка (снимок t/s при добавлении в избранное), поэтому формат не
 * может разойтись между «как сохранили» и «как показали».
 *
 * Иерархию берём из чистого slug-пути закладки (`h`, напр. `/shrimad-bhagavatam/1/17/17`)
 * ИЛИ из division-строки читалки (`sb.1.17`) — оба разбираются одинаково:
 *   ШБ  → Песнь 1 · Глава 17 · Текст 17      (числовая песнь)
 *   ЧЧ  → Мадхья-лила · Глава 6 · Текст 140   (именованная лила)
 *   БГ  → Глава 2 · Текст 13                  (плоская книга)
 * Диапазон стихов («13-14») склоняется во множественное: «Тексты 13-14».
 *
 * Поведение проверяется живым self-тестом (`tools/book-ref-selftest.mjs`,
 * гейт `nav-audit.py::check_b004`), чтобы регресс «Текст 17 без книги» не вернулся.
 */
import { BOOKS, bookFullTitle, bookSlug, type BookData } from "./books";

/** Именованные лилы Чайтанья-чаритамриты (единственная лила-книга канона). */
const LILA_LABEL: Record<string, string> = {
  adi: "Ади-лила",
  madhya: "Мадхья-лила",
  antya: "Антья-лила",
};

/** Ядро имени писания для подписи. Для целостных названий (ШБ, ЧЧ — uniformTitle)
 *  — обе строки склеены; для книги с эпитетом во второй строке (БГ «как она есть»)
 *  — только основное имя (эпитет в ссылку не идёт). */
export function scriptureName(b: BookData): string {
  return b.uniformTitle && b.titleLine2 ? bookFullTitle(b) : b.titleLine1;
}

/** Монограмма писания для плитки (ШБ / БГ / ЧЧ). Нет abbr — пусто; плитка тогда
 *  показывает штатный значок категории (ЗКН-Д007: буква-суррогат не годится). */
export function scriptureAbbr(b: BookData): string {
  return b.abbr || "";
}

export interface ScriptureRef {
  /** Имя писания — «Шримад-Бхагаватам». Жирная строка карточки. */
  scripture: string;
  /** Монограмма для плитки — «ШБ». */
  abbr: string;
  /** Путь БЕЗ якоря: ["Песнь 1", "Глава 17"] (стих) | ["Песнь 1"] (глава). */
  lead: string[];
  /** Сама закладка: «Текст 17» / «Тексты 13-14» / «Глава 17». Подсвечивается. */
  anchor: string;
}

const NUMERIC = /^\d/;
const RANGE = /[-\u2010-\u2015\u2212]/; // дефис и все виды тире

/** Подпись стиха с корректным числом: «Текст 17» | «Тексты 13-14». */
function verseWord(seg: string): string {
  return `${RANGE.test(seg) ? "Тексты" : "Текст"} ${seg}`;
}

/** Разбор одной строки в чистые числовые/лила-сегменты иерархии.
 *  Принимает slug-хвост (`1/17/17`) ИЛИ division (`sb.1.17`) ИЛИ хвост ключа. */
function segsOf(raw: string, work: string): string[] {
  let s = raw.replace(/^https?:\/\/[^/]+/, "").split("?")[0];
  const parts = s.split(/[/.]/).filter(Boolean);
  // Отбрасываем ведущий шифр/слаг книги, если он попал в строку.
  const slug = bookSlug(work);
  while (parts.length && (parts[0] === work || parts[0] === slug)) parts.shift();
  return parts;
}

/**
 * Единственный строитель канонической ссылки. `kind` — стих или глава; `work` —
 * шифр книги (`sb`/`cc`/`bg`); `path` — предпочтительно сохранённый slug-путь `h`,
 * иначе division/хвост ключа (страховка для legacy-записей без `h`).
 */
export function scriptureRef(kind: "verse" | "chapter", work: string, path: string | null | undefined): ScriptureRef | null {
  const b = BOOKS[work];
  if (!b) return null;
  const segs = path ? segsOf(path, work) : [];
  if (!segs.length) return null;

  const hierarchical = !!b.hierarchical;
  const lead: string[] = [];
  let chapter: string | undefined;
  let verse: string | undefined;

  if (hierarchical) {
    // [div, глава, (стих)] — div числовой = песнь, буквенный = лила.
    const div = segs[0];
    chapter = segs[1];
    verse = segs[2];
    if (NUMERIC.test(div)) lead.push(`${work === "sb" ? "Песнь" : "Часть"} ${div}`);
    else lead.push(LILA_LABEL[div] ?? div);
  } else {
    // Плоская книга (БГ): [глава, (стих)].
    chapter = segs[0];
    verse = segs[1];
  }

  const anchor =
    kind === "verse"
      ? verseWord(verse || chapter || "")
      : `Глава ${chapter || segs[0] || ""}`;

  // Для стиха глава уходит в путь; для главы — глава и есть якорь.
  if (kind === "verse" && chapter) lead.push(`Глава ${chapter}`);

  return { scripture: scriptureName(b), abbr: scriptureAbbr(b), lead, anchor };
}

/** Плоская подпись «Песнь 1 · Глава 17 · Текст 17» — путь + якорь одной строкой
 *  (для снимка `s` в избранном, share-текста, где спотлайт не нужен). */
export function scriptureRefLine(kind: "verse" | "chapter", work: string, path: string | null | undefined): string | null {
  const r = scriptureRef(kind, work, path);
  if (!r) return null;
  return [...r.lead, r.anchor].join(" · ");
}
