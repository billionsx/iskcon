/**
 * Реактивная гидрация каталога магазина из D1. Вынесено из catalog.ts (тот держим
 * без React). Подтягивает /api/shop и через setShopData подменяет каталог; обложки
 * книжных товаров восстанавливаются из BOOKS по bookId внутри setShopData. Сбой → сид.
 */
import { useEffect, useSyncExternalStore } from "react";
import { api } from "../api";
import { setShopData, subscribeShop, shopDataVersion, type CatalogGroup } from "./catalog";

let started = false;

async function load(): Promise<void> {
  if (started) return;
  started = true;
  try {
    const r = await fetch(api("/shop"), { credentials: "same-origin" });
    if (!r.ok) return;
    const data = (await r.json()) as CatalogGroup[];
    if (Array.isArray(data) && data.length) setShopData(data);
  } catch {
    /* сеть недоступна — сид остаётся */
  }
}

/** Версия каталога магазина; меняется после гидрации → перерисовка экрана. */
export function useShop(): number {
  useEffect(() => { void load(); }, []);
  return useSyncExternalStore(subscribeShop, shopDataVersion, shopDataVersion);
}
