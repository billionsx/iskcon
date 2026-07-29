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
 * Ц12 · ХРАНИЛИЩЕ СТАЛО ЛЕНИВЫМ. Раньше сюда приезжали ВСЕ дорожки одним
 * массивом — 0,96 МБ разбора на телефоне при каждом холодном открытии, и это
 * до фонотеки goswami.ru на 5000+ записей. Теперь на входе живут только
 * ГОЛОСА и ЦИКЛЫ СО СЧЁТЧИКАМИ (`n`, `secs` считает воркер), а дорожки
 * складываются сюда ПО ОБЛАСТЯМ по мере того, как человек их открывает:
 * цикл целиком, голос целиком, «все записи» страницами, отдельные записи —
 * точечно по хвосту audio. Загрузкой занимается kathaHydrate.ts (там fetch и
 * React); этот модуль — чистый TS без DOM: его импортирует и плеер.
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
  secs?: number;          // сколько секунд звучит цикл (считает воркер)
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

/** Запись С МЕСТАМИ в трёх очередях — так её присылает точечный поиск
 *  (/api/katha/track): полного списка у витрины больше нет, и позицию в
 *  очереди для неё считает ROW_NUMBER на сервере. */
export interface KathaTrackAt extends KathaTrack {
  gi: number;             // место в очереди «вся катха»
  vi: number;             // …в очереди своего рассказчика
  ci: number;             // …в очереди своего цикла
}

/** ОДНА ОЧЕРЕДЬ НА ВСЮ КАТХУ. Разделы очереди — циклы (ЗКН-Б011). */
export const KATHA_ALL = "all";
/** Очередь одного цикла. */
export const KATHA_ALBUM = "a:";
/** Поиск — своя очередь, а не второй список. */
export const KATHA_FIND = "q:";

// ── Хранилище (плейн, без React — модуль грузит и воркер) ──
let _speakers: KathaSpeaker[] = [];
let _albums: KathaAlbum[] = [];
const _byAlbum = new Map<string, KathaTrack[]>();
const _bySpeaker = new Map<string, KathaTrack[]>();
let _all: KathaTrack[] = [];
let _allTotal = -1;                       // −1 = «сервер ещё не называл число»
const _byTail = new Map<string, KathaTrackAt>();
let _version = 0;
const _subs = new Set<() => void>();

function bump(): void {
  _version++;
  _subs.forEach((f) => f());
}

export function kathaSpeakers(): KathaSpeaker[] { return _speakers; }
export function kathaAlbums(): KathaAlbum[] { return _albums; }

export function speakerBySlug(slug: string): KathaSpeaker | undefined {
  return _speakers.find((s) => s.slug === slug);
}
export function kathaAlbumById(id: string): KathaAlbum | undefined {
  return _albums.find((a) => a.id === id);
}
export function albumsBySpeaker(slug: string): KathaAlbum[] {
  return _albums.filter((a) => a.speaker === slug);
}
/** Сколько часов звучит цикл — единица измерения катхи, а не число файлов.
 *  Секунды теперь считает воркер вместе со счётчиком частей. */
export function albumHours(id: string): number {
  return (kathaAlbumById(id)?.secs ?? 0) / 3600;
}

// ── Ленивые области ──
export function albumTracks(id: string): KathaTrack[] | undefined { return _byAlbum.get(id); }
export function speakerTracks(slug: string): KathaTrack[] | undefined { return _bySpeaker.get(slug); }
export function allTracksLoaded(): KathaTrack[] { return _all; }
/** Сколько записей во всей катхе по слову сервера; −1 — ещё не спрашивали. */
export function kathaAllTotal(): number { return _allTotal; }
export function trackByTail(tail: string): KathaTrackAt | undefined {
  return _byTail.get(tail.split("?")[0]);
}

/** Дорожка, КАК ЕЁ ПРИСЫЛАЕТ ВОРКЕР: без полей, которые выводятся из цикла.
 *  `identifier` и `speaker` приходят, только если отличаются от цикла (два
 *  рассказчика на одну «Упадешамриту»); `id` не приходит никогда — это склейка. */
export interface KathaTrackWire {
  album: string;
  file: string;
  title: string;
  duration: number;
  identifier?: string;
  speaker?: string;
}

/** Собрать полный вид дорожки обратно. Всё, что ниже по коду ждёт `KathaTrack`,
 *  продолжает получать его целиком — экономия живёт только на проводе. */
function hydrateTracks(wire: KathaTrackWire[], albums: KathaAlbum[]): KathaTrack[] {
  const byId = new Map(albums.map((a) => [a.id, a]));
  const out: KathaTrack[] = [];
  for (const w of wire) {
    const a = byId.get(w.album);
    const identifier = w.identifier ?? a?.archive;
    const speaker = w.speaker ?? a?.speaker;
    /* Без идентификатора архива дорожку НЕ СОБРАТЬ: из него строится адрес звука.
       Молча подставить пустую строку значит выдать в витрину карточку, которая
       при нажатии не заиграет. Такую строку пропускаем — лучше её отсутствие,
       чем мёртвая кнопка. */
    if (!identifier || !speaker) continue;
    out.push({
      id: `${identifier}/${w.file}`,
      speaker, album: w.album, identifier,
      file: w.file, title: w.title, duration: w.duration || 0,
    });
  }
  return out;
}

export function setKathaCatalog(speakers: KathaSpeaker[], albums: KathaAlbum[]): void {
  if (Array.isArray(speakers)) _speakers = speakers;
  if (Array.isArray(albums)) _albums = albums;
  bump();
}
export function setAlbumTracks(id: string, wire: KathaTrackWire[]): void {
  _byAlbum.set(id, hydrateTracks(wire, _albums));
  bump();
}
export function setSpeakerTracks(slug: string, wire: KathaTrackWire[]): void {
  _bySpeaker.set(slug, hydrateTracks(wire, _albums));
  bump();
}
/** Страница «всех записей». `after` обязан равняться числу уже загруженных:
 *  страницы клеятся встык, позиция строки в массиве = её индекс в очереди. */
export function appendAllTracks(after: number, wire: KathaTrackWire[], total: number): void {
  if (after !== _all.length) return;      // пришла не та страница — не рвём порядок
  _all = _all.concat(hydrateTracks(wire, _albums));
  _allTotal = total;
  bump();
}
export function setTailTracks(rows: (KathaTrackWire & { gi: number; vi: number; ci: number })[]): void {
  /* Построчно: hydrateTracks ПРОПУСКАЕТ несобираемые строки, и спаривание
     «по индексу» двух массивов разной длины подсунуло бы записи чужие места
     в очередях. Строка за строкой — пар просто не из чего перепутать. */
  for (const r of rows) {
    const [t] = hydrateTracks([r], _albums);
    if (t) _byTail.set(t.id, { ...t, gi: r.gi, vi: r.vi, ci: r.ci });
  }
  bump();
}
export function subscribeKatha(cb: () => void): () => void {
  _subs.add(cb);
  return () => { _subs.delete(cb); };
}
export function kathaDataVersion(): number { return _version; }
