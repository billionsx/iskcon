/**
 * reading.ts — прогресс чтения книг на устройстве (без сервера, работает и для гостя).
 *
 * Модель сверена с эталонными читалками (Kindle, Apple Books, Readwise Reader):
 *
 *  1. Прогресс пропорционален ОБЪЁМУ, а не числу глав (как «локации» Kindle):
 *     процент = Σ(дочитанность главы × вес главы) ÷ Σ(вес всех глав), где вес —
 *     число стихов в главе. Глава на 78 стихов весит больше, чем на 5.
 *  2. Дочитанность главы (frac 0..1) растёт по ГЛУБИНE СКРОЛЛА внутри главы, а не
 *     от факта открытия. Открыл главу и ушёл — это 0, а не «прочитано».
 *  3. Учитывается ВРЕМЯ: глубина скролла засчитывается только после порога активного
 *     чтения (dwell); мгновенная прокрутка до конца и простой во вкладке не считаются.
 *  4. «Самая дальняя точка» (furthest-read) отделена от текущей: возврат к ранней
 *     главе или перечитывание процент не снижают (frac берём по максимуму). Точка
 *     возобновления = последнее открытие.
 *
 * Источник правды — на устройстве (localStorage). Серверный recordRead (кабинет
 * вошедшего) живёт отдельно и не мешает этой полке.
 */

const KEY = "iol:reading:v2";

/** Событие «прогресс изменился» — полки/карточки перечитывают состояние. */
export const READING_CHANGED_EVENT = "iol:reading-changed";

/** Дочитанность одной главы: frac 0..1 + вес (число стихов) для взвешивания. */
interface ChapProgress {
  frac: number;
  w: number;
}

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
  /** Дочитанность по главам: ключ — индекс главы (1-based строкой). */
  chapters: Record<string, ChapProgress>;
  /** Всего глав в книге (0 — неизвестно). */
  total: number;
  /** Σ стихов по всем главам (0 — неизвестно → равный вес глав). */
  totalWeight: number;
  /** Текущее смещение скролла в главе `ref` (0..1) — возобновление точно по месту. */
  posFrac: number;
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

function saveAll(s: Store, silent = false): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* приватный режим / квота — телеметрия не должна ломать чтение */
  }
  if (silent) return; // тихое сохранение позиции скролла — без перерисовки полок
  try {
    window.dispatchEvent(new Event(READING_CHANGED_EVENT));
  } catch {
    /* noop */
  }
}

function posInt(n: number | undefined): number {
  return Number.isFinite(n) ? Math.max(0, Math.floor(n as number)) : 0;
}

function chaptersOf(rec: ReadingRec | undefined): Record<string, ChapProgress> {
  return rec && rec.chapters && typeof rec.chapters === "object" ? rec.chapters : {};
}

export interface OpenInput {
  work: string;
  ref: string;
  label?: string | null;
  href?: string | null;
  kind?: string;
  /** Индекс открываемой главы в порядке чтения (1-based). 0 — неизвестно. */
  idx?: number;
  /** Всего глав в книге. */
  total?: number;
  /** Вес открываемой главы (число стихов). */
  weight?: number;
  /** Σ стихов по всем главам книги. */
  totalWeight?: number;
}

/**
 * Открытие главы/стиха: задаёт точку возобновления и РЕГИСТРИРУЕТ главу (frac не
 * трогаем — растёт отдельно по скроллу). Перезапись более ранней главой процент не
 * снижает: существующий frac сохраняется.
 */
export function noteOpen(i: OpenInput): void {
  if (!i.work || !i.ref || !i.href) return;
  const s = loadAll();
  const prev = s[i.work];
  const idx = posInt(i.idx);
  const weight = posInt(i.weight);
  const total = posInt(i.total);
  const totalWeight = posInt(i.totalWeight);
  const chapters: Record<string, ChapProgress> = { ...chaptersOf(prev) };
  if (idx > 0) {
    const ex = chapters[idx];
    chapters[idx] = { frac: ex?.frac ?? 0, w: weight > 0 ? weight : ex?.w ?? 0 };
  }
  // смещение скролла привязано к ref: возвращаемся в ту же главу — храним, в новую — с начала
  const posFrac = prev && prev.ref === i.ref ? prev.posFrac ?? 0 : 0;
  s[i.work] = {
    work: i.work,
    ref: i.ref,
    label: i.label ?? prev?.label ?? i.ref,
    href: i.href,
    kind: i.kind ?? prev?.kind ?? "chapter",
    chapters,
    total: total > 0 ? total : prev?.total ?? 0,
    totalWeight: totalWeight > 0 ? totalWeight : prev?.totalWeight ?? 0,
    posFrac,
    at: Date.now(),
  };
  saveAll(s);
}

export interface ProgressInput {
  work: string;
  /** Индекс читаемой главы (1-based). */
  idx: number;
  /** Достигнутая дочитанность главы 0..1. */
  frac: number;
  weight?: number;
  total?: number;
  totalWeight?: number;
}

/**
 * Прогресс чтения главы (по скроллу, уже после порога времени). frac берём по
 * максимуму — назад не откатывается. Открытие всегда предшествует прогрессу.
 */
export function noteProgress(i: ProgressInput): void {
  if (!i.work || !(i.idx > 0)) return;
  const frac = Math.min(1, Math.max(0, i.frac));
  if (frac <= 0) return;
  const s = loadAll();
  const prev = s[i.work];
  if (!prev) return;
  const chapters: Record<string, ChapProgress> = { ...chaptersOf(prev) };
  const ex = chapters[i.idx];
  const weight = posInt(i.weight);
  chapters[i.idx] = { frac: Math.max(ex?.frac ?? 0, frac), w: weight > 0 ? weight : ex?.w ?? 0 };
  s[i.work] = {
    ...prev,
    chapters,
    total: posInt(i.total) > 0 ? posInt(i.total) : prev.total,
    totalWeight: posInt(i.totalWeight) > 0 ? posInt(i.totalWeight) : prev.totalWeight,
    at: Date.now(),
  };
  saveAll(s);
}

/**
 * Сохранить текущее смещение скролла внутри читаемой главы (возобновление точно по
 * месту). Пишем тихо (без перерисовки полок) и только для главы, которая сейчас —
 * точка возобновления (ref совпадает). `at` не трогаем: это не новое событие чтения.
 */
export function notePosition(i: { work: string; ref: string; frac: number }): void {
  if (!i.work || !i.ref) return;
  const s = loadAll();
  const prev = s[i.work];
  if (!prev || prev.ref !== i.ref) return;
  const frac = Math.min(1, Math.max(0, i.frac));
  if (Math.abs((prev.posFrac ?? 0) - frac) < 0.005) return; // микродвижения не пишем
  s[i.work] = { ...prev, posFrac: frac };
  saveAll(s, true);
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

/**
 * Процент дочитанности 0..100, взвешенный по объёму глав (или null, если ничего
 * ещё не прочитано / нет данных). Открытая, но не читанная глава (frac 0) в числитель
 * не идёт — открытие само по себе процент не поднимает.
 */
export function pctOf(rec: ReadingRec | null | undefined): number | null {
  if (!rec) return null;
  const list = Object.values(chaptersOf(rec));
  if (list.length === 0) return null;
  let num = 0;
  let den = 0;
  if (rec.totalWeight > 0) {
    for (const c of list) num += (c.frac || 0) * (c.w || 0);
    den = rec.totalWeight;
  } else if (rec.total > 0) {
    for (const c of list) num += c.frac || 0;
    den = rec.total;
  } else {
    return null;
  }
  if (den <= 0 || num <= 0) return null;
  return Math.min(100, Math.max(1, Math.round((num / den) * 100)));
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
