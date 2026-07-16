/* ЗКН-Н079: НАДЁЖНЫЙ РЕЗОЛВ СТИХА ДЛЯ ГЛУБОКОЙ ССЫЛКИ.
 *
 * Избранный/делённый стих открывается ссылкой вида /<slug>/<глава>/<стих>. openTarget
 * в BookDetailPage грузит стихи главы и ОБЯЗАН найти нужный стих по номеру из URL, иначе
 * VerseReader не откроется и «схлопнется» на главу — ровно тот баг, что возвращался.
 *
 * Прежний матч `ref.split(".").pop() === want` был хрупким: любой нестандартный
 * разделитель, тире в диапазоне («16-17»), ведущий ноль или иной формат ref ронял
 * поиск. Здесь матч устойчив (все виды тире → дефис, регистр, пробелы, ведущие нули,
 * несколько стратегий), а если точного стиха в загруженной главе нет — ref достраивается
 * по образцу реального стиха главы (замена последнего сегмента), так что VerseReader всё
 * равно откроет ИМЕННО СТИХ, а не главу.
 *
 * Логика вынесена в отдельный модуль намеренно: её поведение проверяется живым
 * self-тестом (`tools/verse-ref-selftest.mjs`, гейт `nav-audit.py::check_n079`), чтобы
 * баг «стих открывает главу» не мог вернуться незамеченным. */

const VERSE_DASHES = /[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\u2043\uFE58\uFE63\uFF0D]/g;

/** Нормализация сегмента: все тире → дефис, обрезка, нижний регистр. */
export const normVerseSeg = (s: unknown): string =>
  String(s ?? "").replace(VERSE_DASHES, "-").trim().toLowerCase();

/** Находит стих главы по номеру из URL, устойчиво к формату ref
 *  ("2.13" | "bg.2.13" | "cc.madhya.6.140"), тире в диапазонах и ведущим нулям. */
export function matchChapterVerse<T extends { ref: string }>(verses: T[], want: string): T | null {
  const w = normVerseSeg(want);
  if (!w) return null;
  const wNoZero = w.replace(/^0+(?=\d)/, "");
  const last = (r: string) => normVerseSeg(String(r).split(".").pop());
  return (
    verses.find((v) => last(v.ref) === w) ??
    verses.find((v) => normVerseSeg(v.ref) === w) ??
    verses.find((v) => normVerseSeg(v.ref).endsWith("." + w)) ??
    verses.find((v) => last(v.ref).replace(/^0+(?=\d)/, "") === wNoZero) ??
    null
  );
}

/** Ref стиха для VerseReader: точный матч в главе, иначе — достроить по образцу реального
 *  стиха главы (замена последнего сегмента), чтобы открылся именно стих, а не глава. */
export function resolveVerseRef(verses: { ref: string }[], want: string | null): string | null {
  if (!want) return null;
  const hit = matchChapterVerse(verses, want);
  if (hit) return hit.ref;
  if (verses.length) {
    const parts = String(verses[0].ref).split(".");
    parts[parts.length - 1] = want;
    return parts.join(".");
  }
  return null;
}
