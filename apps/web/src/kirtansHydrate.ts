/**
 * Реактивная гидрация каталога киртанов из D1. Вынесено из kirtans.ts, потому что
 * тот модуль грузит и воркер (React туда нельзя). Здесь — React-хук: подтягивает
 * /api/kirtans и через setKirtanData подменяет внутренние массивы; useSyncExternalStore
 * перерисовывает подписанные экраны. Сбой сети → тихо остаёмся на встроенном сиде.
 */
import { useEffect, useSyncExternalStore } from "react";
import { api } from "./api";
import {
  setKirtanData, subscribeKirtans, kirtanDataVersion,
  type KirtanArtist, type KirtanAlbum, type KirtanTrack,
} from "./kirtans";

let started = false;

async function load(): Promise<void> {
  if (started) return;
  started = true;
  try {
    const r = await fetch(api("/kirtans"), { credentials: "same-origin" });
    if (!r.ok) return;
    const j = (await r.json()) as { artists?: KirtanArtist[]; albums?: KirtanAlbum[]; tracks?: KirtanTrack[] };
    if (j && Array.isArray(j.artists) && Array.isArray(j.albums)) {
      setKirtanData(j.artists, j.albums, j.tracks);
    }
  } catch {
    /* сеть недоступна — остаёмся на встроенном сиде */
  }
}

/** Версия каталога киртанов; меняется после гидрации → перерисовка экрана. */
export function useKirtans(): number {
  useEffect(() => { void load(); }, []);
  return useSyncExternalStore(subscribeKirtans, kirtanDataVersion, kirtanDataVersion);
}
