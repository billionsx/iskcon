import { api } from "./api";

/**
 * Какие песни и главы «Шримад-Бхагаватам» УЖЕ озвучены.
 *
 * Озвучка ШБ — 33.5 GB, она приезжает песнь за песнью. Пока приезжает, часть глав
 * аудио не имеет. Без этой карты «Слушать» на неозвученной главе молча подсунул бы
 * ЧУЖУЮ дорожку (плеер взял бы первую доступную) — а молчаливая подмена хуже честного
 * отказа: человек не понимает, почему слышит не то, что открыл (ЗКН-Б007, ЗКН-Пр007).
 *
 * Карта крошечная (335 чисел), тянется один раз за сессию.
 */
let cache: Record<string, number[]> | null = null;
let inflight: Promise<Record<string, number[]>> | null = null;

export function loadSbAudioMap(): Promise<Record<string, number[]>> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = fetch(api("/books/sb/audio/available"))
      .then((r) => r.json())
      .then((d: { cantos?: Record<string, number[]> }) => (cache = d.cantos ?? {}))
      .catch(() => (cache = {}));
  }
  return inflight;
}

/** Озвучена ли глава. canto — номер песни («10»), chapter — номер главы в песни. */
export async function sbChapterHasAudio(canto: string | number, chapter: number): Promise<boolean> {
  const m = await loadSbAudioMap();
  return (m[String(canto)] ?? []).includes(chapter);
}
