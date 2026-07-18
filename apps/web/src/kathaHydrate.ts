/**
 * Реактивная гидрация каталога катхи из D1. Вынесено из katha.ts, потому что тот
 * модуль грузит и воркер (React туда нельзя). Здесь — React-хук: подтягивает
 * /api/katha и через setKathaData подменяет внутренние массивы; useSyncExternalStore
 * перерисовывает подписанные экраны. Сбой сети → каталог остаётся пустым, витрина
 * честно говорит «загружается», а не рисует выдуманное.
 */
import { useEffect, useSyncExternalStore } from "react";
import { api } from "./api";
import {
  setKathaData, subscribeKatha, kathaDataVersion,
  type KathaSpeaker, type KathaAlbum, type KathaTrack,
} from "./katha";

let started = false;

async function load(): Promise<void> {
  if (started) return;
  started = true;
  try {
    const r = await fetch(api("/katha"), { credentials: "same-origin" });
    if (!r.ok) return;
    const j = (await r.json()) as { speakers?: KathaSpeaker[]; albums?: KathaAlbum[]; tracks?: KathaTrack[] };
    if (j && Array.isArray(j.speakers) && Array.isArray(j.albums)) {
      setKathaData(j.speakers, j.albums, j.tracks ?? []);
    }
  } catch {
    /* сеть недоступна — каталог пуст, витрина скажет об этом честно */
  }
}

/** Версия каталога катхи; меняется после гидрации → перерисовка экрана. */
export function useKatha(): number {
  useEffect(() => { void load(); }, []);
  return useSyncExternalStore(subscribeKatha, kathaDataVersion, kathaDataVersion);
}
