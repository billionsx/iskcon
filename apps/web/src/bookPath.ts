/* ЗКН-Н092 · АДРЕС КНИГИ СТРОИТ И РАЗБИРАЕТ ОДИН МОДУЛЬ.
 *
 * Баг основателя: закладка стиха ИНОГДА открывает стих, а иногда — обложку книги.
 * Корень был не в закладках, а в том, что путь стиха строили ТРИ разных места, и
 * два из них определяли иерархию книги проверкой `work !== "bg"`:
 *
 *     work !== "bg" ? (div.length >= 3 ? `/slug/${д}/${гл}/${стих}` : `/slug`) : …
 *
 * Иерархических книг в каноне ПЯТЬ (ШБ · ЧЧ · ЧБ · ЧМ · Вишну-пурана) — у них
 * `division_id` из трёх частей, условие проходит. У ОСТАЛЬНЫХ СЕМНАДЦАТИ книг
 * (Нектар преданности, НДМ, Бхакти-ратнакара, Прабхупада-лиламрита, Ишопанишад,
 * Нектар наставлений …) `division_id` двухчастный — условие ложно, и путь МОЛЧА
 * схлопывался до `/slug`, то есть до КНИГИ. Снимок закладки сохранял этот путь.
 * Отсюда «в одних книгах работает, в других нет».
 *
 * Инвариант закона: у стиха ВСЕГДА адрес стиха. Обеспечивается тремя правилами:
 *
 *   1. Иерархия — ТОЛЬКО из `BOOKS[work].hierarchical`. Шифр книги не признак.
 *   2. Ключ главы плоской книги — ТОЛЬКО `divisions.number` (по нему ищет API:
 *      `WHERE d.number = ?`). Ни хвост id, ни цифры из ref им не являются:
 *      у Прабхупада-лиламриты id `spl.1.5` ↔ number `9` (расходятся ВСЕ 62
 *      раздела), у предисловий number отрицательный (`brs.preface` → `-2`).
 *   3. Этот модуль СТРОИТ и РАЗБИРАЕТ адрес. Роутер приложения читает адрес
 *      через `parseBookPath` — значит писатель и читатель адреса физически один
 *      код и разойтись не могут (в отличие от ЗКН-Н060, где расходились).
 *
 * Обратимость проверяется живым self-тестом на РЕАЛЬНЫХ форматах всех книг
 * (`tools/book-path-selftest.mjs`, гейт `nav-audit.py::check_n092`).
 */
import { BOOKS, bookSlug, bookWork } from "./books";

/** Все виды тире → дефис: диапазон стихов «16–17» приходит и с en-dash. */
const DASHES = /[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\u2043\uFE58\uFE63\uFF0D]/g;

/** Многочастная книга (песнь/лила → глава). ЕДИНСТВЕННЫЙ тест иерархии. */
export function isHierBook(work: string): boolean {
  return !!BOOKS[work]?.hierarchical;
}

/** Ключ раздела-главы: id раздела в БД и/или `divisions.number`. */
export interface ChapterKey {
  /** `divisions.id` — «sb.9.8» | «cc.madhya.6» | «brs.preface» | «spl.1.5». */
  divisionId?: string | null;
  /** `divisions.number` — ключ главы ПЛОСКОЙ книги (API ищет по нему). */
  number?: string | number | null;
}

/** Сегменты id раздела без шифра книги: «cc.madhya.6» → [«madhya», «6»]. */
function divSegs(work: string, divisionId?: string | null): string[] {
  const raw = String(divisionId ?? "").trim();
  if (!raw) return [];
  const parts = raw.split(".").filter(Boolean);
  while (parts.length && parts[0] === work) parts.shift();
  return parts;
}

/**
 * Номер стиха для адреса — хвост `ref`. Форматы ref у книг РАЗНЫЕ, и это не
 * случайность: «ШБ 1.9.40» · «БГ 2.16-17» · «НП preface.9» · «НН 1» ·
 * «ИШО invocation» · «Кришна-сандарбха 28». Порядок разбора:
 * последний дотированный сегмент → цифровой хвост → слово после пробела.
 */
export function verseSeg(ref: string | null | undefined): string {
  const raw = String(ref ?? "").replace(DASHES, "-").trim();
  if (!raw) return "";
  const dot = raw.lastIndexOf(".");
  if (dot >= 0) return raw.slice(dot + 1).trim();
  const digits = raw.replace(/^[^\d]+/, "").trim();       // «НН 1» → «1»
  if (digits) return digits;
  const sp = raw.lastIndexOf(" ");
  return (sp >= 0 ? raw.slice(sp + 1) : raw).trim();      // «ИШО invocation» → «invocation»
}

/** Глава из ref — последняя страховка плоской книги («НП 1.1» → «1»). */
function chapterFromRef(ref: string | null | undefined): string {
  const d = String(ref ?? "").replace(DASHES, "-").replace(/^[^\d]*/, "").trim();
  if (!d) return "";
  const dot = d.indexOf(".");
  return dot >= 0 ? d.slice(0, dot) : "";
}

/**
 * Хвост адреса главы БЕЗ слага книги: «madhya/6» (иерархическая) | «-2» (плоская).
 * Пусто — если ключа главы нет (тогда адрес остаётся адресом книги, и это честно).
 */
export function chapterTail(work: string, key?: ChapterKey | null, ref?: string | null): string {
  if (isHierBook(work)) {
    const segs = divSegs(work, key?.divisionId);
    // Три и более сегментов бывают у артефактов данных («cb.madhya.10.4-»):
    // берём первые два — раздел и главу, остальное к адресу не относится.
    if (segs.length >= 2) return `${segs[0]}/${segs[1]}`;
    return "";
  }
  const n = key?.number;
  if (n !== null && n !== undefined && String(n).trim() !== "") return String(n).trim();
  const segs = divSegs(work, key?.divisionId);
  if (segs.length === 1) return segs[0];      // «brs.7» → «7» (у 14 книг из 18 совпадает с number)
  return chapterFromRef(ref);
}

/** Адрес книги — «/nectar-of-devotion». */
export function bookPath(work: string): string {
  return `/${bookSlug(work)}`;
}

/** Адрес главы. Без ключа главы — адрес книги (а не выдуманный сегмент). */
export function chapterPath(work: string, key?: ChapterKey | null, ref?: string | null): string {
  const tail = chapterTail(work, key, ref);
  return tail ? `${bookPath(work)}/${tail}` : bookPath(work);
}

/**
 * Адрес СТИХА — единственный построитель на приложение. Если главу или номер
 * стиха установить нельзя, возвращает null: НЕ выдаёт адрес книги за адрес стиха
 * (именно эта подмена и была багом — закладка «сохранялась», но вела не туда).
 */
export function versePath(work: string, key: ChapterKey | null | undefined, ref: string | null | undefined): string | null {
  const seg = verseSeg(ref);
  const tail = chapterTail(work, key, ref);
  if (!seg || !tail) return null;
  return `${bookPath(work)}/${tail}/${seg}`;
}

/** Цель внутри книги — то, что роутер кладёт в состояние. */
export interface BookTarget {
  div: string | null;
  chapter: string | null;
  verse: string | null;
}

/**
 * Разбор адреса книги. Возвращает null, если путь не принадлежит книге.
 * ЭТИМ разбором обязан пользоваться роутер приложения: тогда «как построили» и
 * «как прочитали» — один код.
 */
export function parseBookPath(path: string | null | undefined): { work: string; target: BookTarget } | null {
  const clean = String(path ?? "").replace(/^https?:\/\/[^/]+/, "").split("?")[0].replace(/\/+$/, "") || "/";
  const parts = clean.split("/");
  const work = bookWork(parts[1] ?? "");
  if (!work) return null;
  const target: BookTarget = isHierBook(work)
    ? { div: parts[2] || null, chapter: parts[3] || null, verse: parts[4] || null }
    : { div: null, chapter: parts[2] || null, verse: parts[3] || null };
  return { work, target };
}

/** Доходит ли путь до уровня стиха у этой книги (глава + стих на месте). */
export function pathReachesVerse(work: string, path: string | null | undefined): boolean {
  const p = parseBookPath(path);
  if (!p || p.work !== work) return false;
  return !!p.target.chapter && !!p.target.verse && (!isHierBook(work) || !!p.target.div);
}

/** Доходит ли путь до уровня главы. */
export function pathReachesChapter(work: string, path: string | null | undefined): boolean {
  const p = parseBookPath(path);
  if (!p || p.work !== work) return false;
  return !!p.target.chapter && (!isHierBook(work) || !!p.target.div);
}
