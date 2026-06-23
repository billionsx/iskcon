/**
 * Реактивная гидрация рецептов из D1. Вынесено из prasad.ts (тот должен оставаться
 * без React, т.к. его тянет searchStatic при сборке индекса). Подтягивает /api/recipes
 * и через setRecipeData подменяет внутренний массив; useSyncExternalStore перерисовывает
 * экран. Сбой сети → остаёмся на встроенном сиде (без регрессии).
 */
import { useEffect, useSyncExternalStore } from "react";
import { api } from "../api";
import { setRecipeData, subscribeRecipes, recipeDataVersion, type Recipe } from "./prasad";

let started = false;

async function load(): Promise<void> {
  if (started) return;
  started = true;
  try {
    const r = await fetch(api("/recipes"), { credentials: "same-origin" });
    if (!r.ok) return;
    const data = (await r.json()) as Recipe[];
    if (Array.isArray(data) && data.length) setRecipeData(data);
  } catch {
    /* сеть недоступна — сид остаётся */
  }
}

/** Версия каталога рецептов; меняется после гидрации → перерисовка экрана. */
export function useRecipes(): number {
  useEffect(() => { void load(); }, []);
  return useSyncExternalStore(subscribeRecipes, recipeDataVersion, recipeDataVersion);
}
