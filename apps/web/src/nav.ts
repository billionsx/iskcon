/**
 * ЗКН-Н001 (историю пишет только этот модуль) · ЗКН-Н002 · ЗКН-Н003 («назад» не выкидывает).
 * nav — единый, единственный на приложение слой управления историей браузера.
 *
 * Проблема, которую он решает: раньше историю писали в двух местах (глобальный
 * роутер App и внутрикнижный роутер BookDetailPage), каждый со своим счётчиком
 * на основе `history.length`. Но `history.length` НЕ уменьшается при back() —
 * поэтому «есть ли куда возвращаться» определялось неверно, и кнопка «назад»
 * вылетала из приложения или вела не туда.
 *
 * Решение (стандарт Apple — навигационный стек): глубина приложения хранится в
 * `history.state.appIdx` и обновляется на каждом popstate. Любой переход «вперёд»
 * увеличивает appIdx (push); замена записи (стих↔стих) appIdx не меняет (replace);
 * возврат читает appIdx целевой записи. `canGoBack()` = appIdx > 0 — это надёжный
 * критерий «под нами есть запись приложения», в отличие от history.length.
 *
 * ВАЖНО: ВСЕ pushState/replaceState приложения должны идти ТОЛЬКО через эти
 * функции, иначе appIdx в history.state потеряется.
 */

let idx = 0;

/** Прочитать/проставить appIdx у текущей (корневой) записи. Вызывать один раз при старте. */
export function navInit(): void {
  if (typeof window === "undefined") return;
  const st = window.history.state as { appIdx?: number } | null;
  if (st && typeof st.appIdx === "number") {
    idx = st.appIdx;
  } else {
    idx = 0;
    try { window.history.replaceState({ ...(st || {}), appIdx: 0 }, ""); } catch { /* noop */ }
  }
}

/** Текущая глубина приложения. */
export function navIdx(): number { return idx; }

/** Синхронизировать счётчик из state записи, на которую перешёл браузер (popstate). */
export function navSetIdxFromState(state: unknown): void {
  const s = state as { appIdx?: number } | null;
  idx = s && typeof s.appIdx === "number" ? s.appIdx : 0;
}

/** Новый уровень навигации (новая запись истории). */
export function pushUrl(url: string): void {
  if (typeof window === "undefined") return;
  idx += 1;
  try { window.history.pushState({ appIdx: idx }, "", url); } catch { /* noop */ }
}

/** Замена текущей записи (тот же уровень: стих↔стих, нормализация адреса). appIdx не меняется. */
export function replaceUrl(url: string): void {
  if (typeof window === "undefined") return;
  try { window.history.replaceState({ appIdx: idx }, "", url); } catch { /* noop */ }
}

/** Есть ли под нами запись приложения, на которую можно вернуться через history.back(). */
export function canGoBack(): boolean { return idx > 0; }
