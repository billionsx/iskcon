/**
 * Каталог книг — источник истины в D1 (таблица book_catalog, связь автор→личность
 * через author_entity_id). Здесь — тонкая гидрация: мгновенно отдаём встроенный
 * LIBRARY (фолбэк, экран никогда не пустой и не ждёт сети), а в фоне подтягиваем
 * каталог из /api/books/catalog и подменяем. Любое изменение в БД появляется после
 * перезагрузки без редеплоя. Если API недоступен — тихо остаёмся на бандле.
 *
 * Форма строки совпадает с CatalogBook, поэтому потребители (BooksHub, SearchScreen,
 * HomeScreen) меняются минимально: было `LIBRARY` → стало `useCatalog()`.
 */
import { useEffect } from "react";
import { useSyncExternalStore } from "react";
import { LIBRARY, type CatalogBook } from "./books";
import { api } from "./api";

let current: CatalogBook[] = LIBRARY;     // фолбэк = бандл (мгновенно, никогда не пусто)
let started = false;
const subs = new Set<() => void>();

async function load(): Promise<void> {
  if (started) return;
  started = true;
  try {
    const r = await fetch(api("/books/catalog"), { credentials: "same-origin" });
    if (!r.ok) return;
    const data = (await r.json()) as CatalogBook[];
    if (Array.isArray(data) && data.length) {
      current = data;
      subs.forEach((f) => f());
    }
  } catch {
    /* сеть недоступна — остаёмся на встроенном LIBRARY */
  }
}

/** Реактивный каталог: бандл сразу, БД — как только подтянется. */
export function useCatalog(): CatalogBook[] {
  useEffect(() => { void load(); }, []);
  return useSyncExternalStore(
    (cb) => { subs.add(cb); return () => { subs.delete(cb); }; },
    () => current,
    () => current,
  );
}

/** Императивный доступ (вне React) — запускает загрузку и возвращает текущее. */
export function catalogNow(): CatalogBook[] {
  void load();
  return current;
}
