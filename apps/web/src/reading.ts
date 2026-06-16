/**
 * reading.ts — прогресс чтения книг на устройстве (без сервера, работает и для гостя).
 *
 * Зачем отдельно от account/track.ts: серверный recordRead пишет «продолжить
 * чтение» в кабинет ТОЛЬКО для вошедшего. Полка «Продолжить» в библиотеке нужна
 * каждому, мгновенно и офлайн, поэтому источник правды на устройстве — localStorage.
 * Ридер зовёт оба: recordRead (зеркало в кабинет, если вошёл) и noteRead (локально,
 * всегда). Серверная сводка и локальная полка дополняют друг друга, не мешая.
 *
 * Прогресс — по главам (грубая, честная гранулярность, как в книжных читалках):
 * процент = самая дальняя достигнутая глава ÷ всего глав. Точку возобновления
 * («где я был») держим отдельно от максимума прогресса (как Apple Books): тап по
 * полке открывает последнюю позицию, а полоска отражает дочитанность в целом.
 * Для иерархических книг (ЧЧ/ШБ) всего глав на клиенте неизвестно → процента нет,
 * но есть возобновление с подписью места.
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
  /** Самая дальняя достигнутая глава (1-based) — для полоски прогресса. */
  maxIdx: number;
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
 * Отметить открытие главы/стиха. Точка возобновления = последнее открытие;
 * максимум прогресса не регрессирует при переходе к более ранней главе.
 */
export function noteRead(input: NoteReadInput): void {
  if (!input.work || !input.ref || !input.href) return;
  const s = loadAll();
  const prev = s[input.work];
  const idx = Number.isFinite(input.idx) ? Math.max(0, input.idx as number) : 0;
  const total = Number.isFinite(input.total) ? Math.max(0, input.total as number) : 0;
  s[input.work] = {
    work: input.work,
    ref: input.ref,
    label: input.label ?? prev?.label ?? input.ref,
    href: input.href,
    kind: input.kind ?? prev?.kind ?? "chapter",
    maxIdx: Math.max(prev?.maxIdx ?? 0, idx),
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

/** Процент дочитанности 0..100 (или null, если всего глав неизвестно). */
export function pctOf(rec: ReadingRec | null | undefined): number | null {
  if (!rec || rec.total <= 0 || rec.maxIdx <= 0) return null;
  return Math.min(100, Math.max(1, Math.round((rec.maxIdx / rec.total) * 100)));
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
