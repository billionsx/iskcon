/* Тема оформления — обе полноценны (слово основателя 27.07).
 * База стилей — тёмный канон ios26.5 (:root), светлая — надстройка
 * [data-theme='light'] в ui/globals.css. Предпочтение: 'auto' следует
 * системе (prefers-color-scheme) и живёт на слушателе; выбор хранится
 * в localStorage('ol-theme'). Анти-FOUC — inline-скрипт в index.html
 * ставит data-theme ДО загрузки бандла; этот модуль — источник истины
 * после старта. */

export type ThemePref = "auto" | "light" | "dark";
const KEY = "ol-theme";
const mq = () => window.matchMedia("(prefers-color-scheme: dark)");

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "auto";
  } catch { return "auto"; }
}

export function resolveTheme(pref: ThemePref = getThemePref()): "light" | "dark" {
  if (pref === "light" || pref === "dark") return pref;
  try { return mq().matches ? "dark" : "light"; } catch { return "light"; }
}

function apply(theme: "light" | "dark"): void {
  document.documentElement.setAttribute("data-theme", theme);
  /* ЗКН-Д001: цвет строки состояния — ТОТ ЖЕ токен холста, что и у страницы.
   * Два литерала (#000000/#FFFFFF) были третьим определением холста: смена
   * канона в ui/globals.css оставила бы строку состояния прежней. Читаем
   * применённое значение --color-bg — оно уже верное для обеих тем. */
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const canvas = getComputedStyle(document.documentElement)
      .getPropertyValue("--color-bg").trim();
    if (canvas) meta.setAttribute("content", canvas);
  }
}

export function setThemePref(pref: ThemePref): void {
  try {
    if (pref === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch { /* приват-режим — тема живёт до перезагрузки */ }
  apply(resolveTheme(pref));
}

export const THEME_LABEL: Record<ThemePref, string> = {
  auto: "Авто", light: "Светлая", dark: "Тёмная",
};

/** Вызывается один раз при старте: применяет выбор и следит за системой в auto. */
export function initTheme(): void {
  apply(resolveTheme());
  try {
    mq().addEventListener("change", () => {
      if (getThemePref() === "auto") apply(resolveTheme("auto"));
    });
  } catch { /* старые браузеры без addEventListener у MQL */ }
}
