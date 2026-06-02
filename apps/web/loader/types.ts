/**
 * Типы загрузчика книг (CRM-ингест).
 *
 * Один «нормализованный стих» — это результат парсинга источника, независимый
 * от способа доставки (живой fetch с vedabase или присланный JSON). Движок
 * ингеста (ingest.ts) умеет писать его в D1 послойно и идемпотентно.
 */

export interface VerseToken {
  term: string; // санскритское слово (как в пословном), напр. «дхарма-кшетре»
  gloss: string | null; // значение (RU)
}

export interface NormalizedVerse {
  seg: string; // сегмент внутри главы: «1» или диапазон «16-18»
  ordinal: number; // позиция в главе (1-based) — порядок чтения
  devanagari: string | null; // оригинал (общественное достояние)
  translit: string | null; // транслитерация (общественное достояние)
  uvaca: string | null; // речевой тег («…ува̄ча»), если есть
  tokens: VerseToken[]; // пословный перевод (издание)
  translation: string | null; // художественный перевод (издание)
  purport: string | null; // комментарий (издание)
  sourceUrl: string | null; // канонический deep-link на источник
}

/** Какие слои писать. Санскрит — общедоступная база; edition — лицензируемые слои. */
export interface LayerFlags {
  sanskrit: boolean; // деванагари + транслитерация (+ структура)
  edition: boolean; // пословный + перевод + комментарий (издание <work>-ru, лицензия!)
}

/** Что реально записалось по стиху — для прозрачного отчёта оператору. */
export interface VerseLoadReport {
  ref: string;
  deva: boolean;
  translit: boolean;
  tokens: number;
  translation: boolean;
  purport: boolean;
}

/** Срез наполнения одной главы (для таблицы прогресса в CRM). */
export interface ChapterStatusRow {
  number: string;
  title_ru: string;
  verses: number;
  deva: number;
  translit: number;
  tokens: number;
  translation: number;
  purport: number;
}
