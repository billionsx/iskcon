/**
 * Реактивная гидрация дхам/тиртх из D1. Вынесено из dhamas.ts (тот может грузить и
 * воркер — React нельзя). Подтягивает /api/dhamas и через setDhamaData подменяет
 * внутренние массивы; useSyncExternalStore перерисовывает экраны. Сбой → сид.
 */
import { useEffect, useSyncExternalStore } from "react";
import { api } from "../api";
import { setDhamaData, subscribeDhamas, dhamaDataVersion, type Dhama } from "./dhamas";

let started = false;

async function load(): Promise<void> {
  if (started) return;
  started = true;
  try {
    const r = await fetch(api("/dhamas"), { credentials: "same-origin" });
    if (!r.ok) return;
    const data = (await r.json()) as Dhama[];
    if (Array.isArray(data) && data.length) setDhamaData(data);
  } catch {
    /* сеть недоступна — остаёмся на встроенном сиде */
  }
}

/** Версия каталога дхам; меняется после гидрации → перерисовка экрана. */
export function useDhamas(): number {
  useEffect(() => { void load(); }, []);
  return useSyncExternalStore(subscribeDhamas, dhamaDataVersion, dhamaDataVersion);
}
