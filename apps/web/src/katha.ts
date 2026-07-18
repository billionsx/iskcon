/**
 * Каталог катхи — раздела «Катха» в Богатствах.
 *
 * КАТХА — НЕ КИРТАН, И ЭТО НЕ ПРИДИРКА К СЛОВУ.
 *
 * Киртан — пение: у записи есть исполнитель, настроение, язык, автор текста.
 * Катха — ПОВЕСТВОВАНИЕ: рассказчик ведёт слушателя по «Шримад-Бхагаватам»
 * неделями, и запись живёт не сама по себе, а ЧАСТЬЮ ЦИКЛА. «Гопи-гита, часть 7»
 * без частей 1–6 — не самостоятельная вещь. Поэтому здесь нет ни настроений,
 * ни жанров: главная и единственная структура — РАССКАЗЧИК → ЦИКЛ → ЧАСТЬ.
 *
 * Модель повторяет kirtans.ts: каталог — данные из D1, звук живёт на Internet
 * Archive, элемент архива = один цикл катхи. Чистый TS (без React/DOM) — модуль
 * импортируют и фронт, и воркер.
 */

export interface KathaSpeaker {
  slug: string;
  name: string;
  full?: string;
  role: string;
  era?: string;
  origin?: string;
  bio: string;
  mono: string;
  accent?: boolean;
  entityId?: string;      // связь с картой личностей
}

/** ЦИКЛ катхи = элемент archive.org = раздел очереди плеера. */
export interface KathaAlbum {
  id: string;
  speaker: string;        // slug рассказчика
  title: string;
  archive?: string;       // идентификатор Internet Archive
  year?: string;
  note?: string;
  n?: number;             // сколько частей залито (считает воркер)
}

/** ЧАСТЬ — одна залитая запись цикла. */
export interface KathaTrack {
  id: string;             // <identifier>/<file>
  speaker: string;
  album: string;
  identifier: string;
  file: string;
  title: string;          // «Часть 7» — цикл назван отдельно, повторять его незачем
  duration: number;
}

/** ОДНА ОЧЕРЕДЬ НА ВСЮ КАТХУ. Разделы очереди — циклы (ЗКН-Б011). */
export const KATHA_ALL = "all";
/** Очередь одного цикла. */
export const KATHA_ALBUM = "a:";
/** Поиск — своя очередь, а не второй список. */
export const KATHA_FIND = "q:";

// ── Гидрация из D1 (плейн, без React — модуль грузит и воркер) ──
let _speakers: KathaSpeaker[] = [];
let _albums: KathaAlbum[] = [];
let _tracks: KathaTrack[] = [];
let _version = 0;
const _subs = new Set<() => void>();

export function kathaSpeakers(): KathaSpeaker[] { return _speakers; }
export function kathaAlbums(): KathaAlbum[] { return _albums; }
export function kathaTracks(): KathaTrack[] { return _tracks; }

export function speakerBySlug(slug: string): KathaSpeaker | undefined {
  return _speakers.find((s) => s.slug === slug);
}
export function kathaAlbumById(id: string): KathaAlbum | undefined {
  return _albums.find((a) => a.id === id);
}
export function albumsBySpeaker(slug: string): KathaAlbum[] {
  return _albums.filter((a) => a.speaker === slug);
}
/** Сколько часов звучит цикл — единица измерения катхи, а не число файлов. */
export function albumHours(id: string): number {
  const sec = _tracks.filter((t) => t.album === id).reduce((s, t) => s + (t.duration || 0), 0);
  return sec / 3600;
}

export function setKathaData(speakers: KathaSpeaker[], albums: KathaAlbum[], tracks: KathaTrack[]): void {
  if (Array.isArray(speakers)) _speakers = speakers;
  if (Array.isArray(albums)) _albums = albums;
  if (Array.isArray(tracks)) _tracks = tracks;
  _version++;
  _subs.forEach((f) => f());
}
export function subscribeKatha(cb: () => void): () => void {
  _subs.add(cb);
  return () => { _subs.delete(cb); };
}
export function kathaDataVersion(): number { return _version; }
