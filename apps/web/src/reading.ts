/**
 * reading.ts — прогресс чтения книг на устройстве (без сервера, работает и для гостя).
 *
 * Зачем отдельно от account/track.ts: серверный recordRead пишет «продолжить
 * чтение» в кабинет ТОЛЬКО для вошедшего. Полка «Продолжить» в библиотеке нужна
 * каждому, мгновенно и офлайн, поэтому источник правды на устройстве — localStorage.
 * Ридер зовёт оба: recordRead (зеркало в кабинет, если вошёл) и noteRead (локально,
 * всегда). Серверная сводка и локальная полка дополняют друг друга, не мешая.
 *
 * Прогресс — по охвату глав (честно, как в книжных читалках): процент = число
 * РЕАЛЬНО открытых глав ÷ всего глав. Это НЕ «самая дальняя позиция»: если открыть
 * одну главу в середине или в конце и прочитать пару стихов, охват равен 1 главе
 * (а не «до середины книги»), и процент будет маленьким — как и должно быть.
 * Перечитывание уже открытой главы процент не меняет (главы учитываются без
 * повторов). Точку возобновления («где я был») держим отдельно от охвата: тап по
 * полке открывает последнюю позицию, а полоска отражает дочитанность в целом.
 * Для иерархических книг (ЧЧ/ШБ) всего глав и индекс берём из оглавления (/toc).
 */

const KEY = "iol:reading:v1";

/** Событие «прогресс изменился» — полки/карточки перечитывают состояние. */
export const READING_CHANGED_EVENT = "iol:reading-changed";

export interface ReadingRec {
  /** Машинный id книги (bg|cc|sb|brs|…). */
  work: string;
  /** Ref последней открытой единицы (для возобновления). */
  ref: string;
  /** Человекочитаемая подпись места: «Глава 2 · О душе», «Текст 2.13». */
  label: string;
  /** Routable-путь возобновления: /book/bg/2 · /book/bg/2/13 · /book/cc/madhya/6. */
  href: string;
  /** chapter|prose|verse. */
  kind: string;
  /** Индексы реально открытых глав (1-based), без повторов — честный охват для полоски. */
  read: number[];
  /** Всего глав в книге (0 — неизвестно, процент не показываем). */
  total: number;
  /** Метка последнего обновления, мс. */
  at: number;
}

type Store = Record<string, ReadingRec>;

function loadAll(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw) as unknown;
    return obj && typeof obj === "object" ? (obj as Store) : {};
  } catch {
    return {};
  }
}

function saveAll(s: Store): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* приватный режим / квота — телеметрия не должна ломать чтение */
  }
  try {
    window.dispatchEvent(new Event(READING_CHANGED_EVENT));
  } catch {
    /* noop */
  }
}

export interface NoteReadInput {
  work: string;
  ref: string;
  label?: string | null;
  href?: string | null;
  kind?: string;
  /** Позиция текущей главы в оглавлении (1-based). 0/undefined — неизвестно. */
  idx?: number;
  /** Всего глав в книге. 0/undefined — неизвестно. */
  total?: number;
}

/**
 * Отметить открытие главы/стиха. Точка возобновления = последнее открытие; в охват
 * добавляется текущая глава (без повторов) — процент растёт только за новые главы.
 */
export function noteRead(input: NoteReadInput): void {
  if (!input.work || !input.ref || !input.href) return;
  const s = loadAll();
  const prev = s[input.work];
  const idx = Number.isFinite(input.idx) ? Math.max(0, input.idx as number) : 0;
  const total = Number.isFinite(input.total) ? Math.max(0, input.total as number) : 0;
  const prevRead = Array.isArray(prev?.read) ? prev!.read : [];
  const read = idx > 0 && !prevRead.includes(idx) ? [...prevRead, idx].sort((a, b) => a - b) : prevRead;
  s[input.work] = {
    work: input.work,
    ref: input.ref,
    label: input.label ?? prev?.label ?? input.ref,
    href: input.href,
    kind: input.kind ?? prev?.kind ?? "chapter",
    read,
    total: total > 0 ? total : prev?.total ?? 0,
    at: Date.now(),
  };
  saveAll(s);
}

/** Прогресс по конкретной книге (или null). */
export function getReading(work: string): ReadingRec | null {
  if (!work) return null;
  return loadAll()[work] ?? null;
}

/** Недавно читаемые книги, свежие сверху (для полки «Продолжить»). */
export function recentReadings(limit = 4): ReadingRec[] {
  return Object.values(loadAll())
    .filter((r) => !!r.href)
    .sort((a, b) => b.at - a.at)
    .slice(0, Math.max(0, limit));
}

/** Процент дочитанности 0..100 = открытые главы ÷ всего глав (или null). */
export function pctOf(rec: ReadingRec | null | undefined): number | null {
  if (!rec || rec.total <= 0) return null;
  const n = Array.isArray(rec.read) ? rec.read.length : 0;
  if (n <= 0) return null;
  return Math.min(100, Math.max(1, Math.round((n / rec.total) * 100)));
}

/** Забыть прогресс по книге (для будущего смахивания/«убрать с полки»). */
export function forgetReading(work: string): void {
  if (!work) return;
  const s = loadAll();
  if (s[work]) {
    delete s[work];
    saveAll(s);
  }
}
