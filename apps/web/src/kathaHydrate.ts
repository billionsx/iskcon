/**
 * Загрузка каталога катхи из D1. Вынесено из katha.ts, потому что тот модуль
 * грузит и воркер (React и fetch с import.meta туда нельзя). Здесь — сеть и
 * React-хук; хранилище живёт в katha.ts.
 *
 * Ц12 · ГРУЗИМ ТО, ЧТО ОТКРЫТО, А НЕ ВСЁ СРАЗУ.
 * На вход раздела едет только /api/katha/catalog — голоса и циклы со
 * счётчиками (десятки килобайт вместо мегабайта дорожек). Дорожки доезжают
 * по областям: цикл (`ensureAlbum`), голос (`ensureSpeaker`), «все записи»
 * страницами (`ensureMoreAll`), отдельные записи по хвосту audio
 * (`ensureTails` — для «Отложенного» и перехода из закладки, ЗКН-Н077).
 *
 * Каждая область грузится ОДИН РАЗ: повторный вызов при уже загруженном или
 * едущем — тишина, а не второй запрос. Сбой сети не помечает область
 * загруженной: следующий заход попробует снова, витрина тем временем честно
 * говорит «загружается», а не рисует выдуманное.
 */
import { useEffect, useSyncExternalStore } from "react";
import { api } from "./api";
import {
  kathaAlbums,
  setKathaCatalog, setAlbumTracks, setSpeakerTracks, appendAllTracks, setTailTracks,
  albumTracks, speakerTracks, allTracksLoaded, kathaAllTotal, trackByTail,
  subscribeKatha, kathaDataVersion,
  type KathaSpeaker, type KathaAlbum, type KathaTrackWire,
} from "./katha";

const ALL_PAGE = 500;

/* Что сейчас в пути. Меняется → подписчики katha.ts будят экраны, и
 * `kathaPending()` даёт им честный признак «ждём», а не «пусто». */
const pending = new Set<string>();
const inflight = new Map<string, Promise<void>>();

function run(key: string, job: () => Promise<void>): Promise<void> {
  const live = inflight.get(key);
  if (live) return live;
  pending.add(key);
  notifyPending();
  const p = job()
    .catch(() => { /* сеть упала — область осталась незагруженной, зайдут снова */ })
    .finally(() => { pending.delete(key); inflight.delete(key); notifyPending(); });
  inflight.set(key, p);
  return p;
}
/* Свой тик поверх katha-версии: pending — состояние ЗАГРУЗЧИКА, не данных. */
let _tick = 0;
const _tickSubs = new Set<() => void>();
function notifyPending(): void { _tick++; _tickSubs.forEach((f) => f()); }

export function kathaPending(key: string): boolean { return pending.has(key); }

let catDone = false;
export async function loadCatalog(): Promise<void> {
  if (catDone) return;
  return run("cat", async () => {
    const r = await fetch(api("/katha/catalog"), { credentials: "same-origin" });
    if (!r.ok) return;
    const j = (await r.json()) as { speakers?: KathaSpeaker[]; albums?: KathaAlbum[] };
    if (j && Array.isArray(j.speakers) && Array.isArray(j.albums)) {
      setKathaCatalog(j.speakers, j.albums);
      catDone = true;
    }
  });
}

export function ensureAlbum(id: string): Promise<void> {
  if (!id || albumTracks(id)) return Promise.resolve();
  return run(`alb:${id}`, async () => {
    await loadCatalog();
    /* Гидрация дорожек опирается на archive/speaker ЦИКЛА: без каталога строки
       молча выпадут, а область пометится загруженной — и останется пустой
       навсегда. Каталог не доехал → не трогаем, следующий заход попробует всё. */
    if (kathaAlbums().length === 0) return;
    const r = await fetch(api(`/katha/tracks?album=${encodeURIComponent(id)}`), { credentials: "same-origin" });
    if (!r.ok) return;
    const j = (await r.json()) as { tracks?: KathaTrackWire[] };
    if (Array.isArray(j.tracks)) setAlbumTracks(id, j.tracks);
  });
}

export function ensureSpeaker(slug: string): Promise<void> {
  if (!slug || speakerTracks(slug)) return Promise.resolve();
  return run(`spk:${slug}`, async () => {
    await loadCatalog();
    /* Гидрация дорожек опирается на archive/speaker ЦИКЛА: без каталога строки
       молча выпадут, а область пометится загруженной — и останется пустой
       навсегда. Каталог не доехал → не трогаем, следующий заход попробует всё. */
    if (kathaAlbums().length === 0) return;
    const r = await fetch(api(`/katha/tracks?speaker=${encodeURIComponent(slug)}`), { credentials: "same-origin" });
    if (!r.ok) return;
    const j = (await r.json()) as { tracks?: KathaTrackWire[] };
    if (Array.isArray(j.tracks)) setSpeakerTracks(slug, j.tracks);
  });
}

/** Следующая страница «всех записей». Первый вызов везёт первую. */
export function ensureMoreAll(): Promise<void> {
  const have = allTracksLoaded().length;
  const total = kathaAllTotal();
  if (total >= 0 && have >= total) return Promise.resolve();
  return run("all", async () => {
    await loadCatalog();
    /* Гидрация дорожек опирается на archive/speaker ЦИКЛА: без каталога строки
       молча выпадут, а область пометится загруженной — и останется пустой
       навсегда. Каталог не доехал → не трогаем, следующий заход попробует всё. */
    if (kathaAlbums().length === 0) return;
    const r = await fetch(api(`/katha/tracks?after=${have}&limit=${ALL_PAGE}`), { credentials: "same-origin" });
    if (!r.ok) return;
    const j = (await r.json()) as { tracks?: KathaTrackWire[]; total?: number };
    if (Array.isArray(j.tracks)) appendAllTracks(have, j.tracks, j.total ?? have + j.tracks.length);
  });
}

/** Точечные записи по хвостам audio; уже известные не спрашиваем. */
export function ensureTails(tails: string[]): Promise<void> {
  const need = Array.from(new Set(tails.map((t) => t.split("?")[0]).filter(Boolean)))
    .filter((t) => !trackByTail(t))
    .sort();
  if (!need.length) return Promise.resolve();
  return run(`tail:${need.join("|")}`, async () => {
    await loadCatalog();
    /* Гидрация дорожек опирается на archive/speaker ЦИКЛА: без каталога строки
       молча выпадут, а область пометится загруженной — и останется пустой
       навсегда. Каталог не доехал → не трогаем, следующий заход попробует всё. */
    if (kathaAlbums().length === 0) return;
    const qs = need.map((t) => `t=${encodeURIComponent(t)}`).join("&");
    const r = await fetch(api(`/katha/track?${qs}`), { credentials: "same-origin" });
    if (!r.ok) return;
    const j = (await r.json()) as { tracks?: (KathaTrackWire & { gi: number; vi: number; ci: number })[] };
    if (Array.isArray(j.tracks)) setTailTracks(j.tracks);
  });
}

/** Версия каталога катхи; меняется после гидрации → перерисовка экрана. */
export function useKatha(): number {
  useEffect(() => { void loadCatalog(); }, []);
  return useSyncExternalStore(subscribeKatha, kathaDataVersion, kathaDataVersion);
}

/** Тик загрузчика: перерисовать, когда что-то встало в путь или доехало. */
export function useKathaPendingTick(): number {
  return useSyncExternalStore(
    (cb) => { _tickSubs.add(cb); return () => { _tickSubs.delete(cb); }; },
    () => _tick,
    () => _tick,
  );
}
