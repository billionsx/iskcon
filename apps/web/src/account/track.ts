/**
 * Личный кабинет — слой телеметрии и закладок для всего приложения.
 *
 * Здесь нет React-контекста и НЕТ импортов из плеера/ридера — только модульное
 * состояние «вошёл ли пользователь» (pub/sub) и тонкие fire-and-forget запросы.
 * Так плеер (player/store.tsx) и ридеры могут звать recordListen/recordRead, не
 * создавая цикл импортов с AuthProvider. AuthProvider (account/store.tsx) при
 * каждом изменении сессии зовёт setAuthed(...) — и трекеры начинают/перестают
 * писать в БД.
 *
 * Принципы:
 *   - Гость ничего не пишет (тихий no-op), хартануть сердечко → событие
 *     `iol:auth-required` (App ведёт на /account).
 *   - Любая сетевая ошибка проглатывается: телеметрия не должна ломать UX.
 */
import { useEffect, useRef, useState } from "react";
import { api } from "../api";

/* ─────────────────────── authed pub/sub (без React) ─────────────────────── */

let authed = false;
const authedSubs = new Set<(v: boolean) => void>();

/** Вызывается из AuthProvider при каждом изменении статуса сессии. */
export function setAuthed(v: boolean): void {
  if (authed === v) return;
  authed = v;
  for (const fn of authedSubs) {
    try {
      fn(v);
    } catch {
      /* подписчик не должен ронять остальных */
    }
  }
}
export function isAuthed(): boolean {
  return authed;
}
function subscribeAuthed(fn: (v: boolean) => void): () => void {
  authedSubs.add(fn);
  return () => authedSubs.delete(fn);
}

/** Реактивный флаг «вошёл» для компонентов вне AuthProvider (напр. ридер). */
export function useAuthed(): boolean {
  const [v, setV] = useState(authed);
  useEffect(() => subscribeAuthed(setV), []);
  return v;
}

/* ─────────────────────── требование входа ─────────────────────── */

export const AUTH_REQUIRED_EVENT = "iol:auth-required";

/** Гость попытался сохранить/прочитать «как вошедший» → ведём в кабинет. */
export function requireAuth(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(AUTH_REQUIRED_EVENT));
  } catch {
    /* noop */
  }
}

/* ─────────────────────── низкоуровневый POST ─────────────────────── */

function post(path: string, body: unknown): void {
  if (!authed) return;
  try {
    void fetch(api(path), {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true, // долетит даже при уходе со страницы
    }).catch(() => undefined);
  } catch {
    /* noop */
  }
}

/* ─────────────────────── прогресс чтения ─────────────────────── */

export interface ReadEvent {
  /** Книга: bg|cc|sb|nod|… (машинный id произведения). */
  work: string;
  /** Стабильный ключ внутри книги: номер главы / id раздела / ref стиха. */
  ref: string;
  /** Человеко-читаемая подпись для карточки «продолжить»: «Глава 2 · Стих 13». */
  label?: string | null;
  /** Путь для открытия: /book/bg/2 либо /book/cc/madhya/8. */
  href?: string | null;
  /** chapter|verse|prose — тип единицы (по умолчанию chapter). */
  kind?: string;
}

/** Зовётся ридером при открытии главы/стиха. Тихо игнорируется для гостя. */
export function recordRead(ev: ReadEvent): void {
  if (!ev.work || !ev.ref) return;
  post("/me/progress", {
    work: ev.work,
    ref: ev.ref,
    label: ev.label ?? null,
    href: ev.href ?? null,
    kind: ev.kind ?? "chapter",
  });
}

/* ─────────────────────── история прослушивания ─────────────────────── */

export interface ListenEvent {
  /** book|kirtan. */
  source: string;
  /** Стабильный ключ трека (путь аудио /audio/<id>/<file>). */
  ref: string;
  title?: string | null;
  subtitle?: string | null;
  cover?: string | null;
  /** Машинный id книги/альбома — для «продолжить слушать». */
  album?: string | null;
  artist?: string | null;
  href?: string | null;
  durationSec?: number | null;
  positionSec?: number | null;
}

/** Зовётся плеером при реальном старте трека (autoplay). No-op для гостя. */
export function recordListen(ev: ListenEvent): void {
  if (!ev.ref) return;
  post("/me/listen", {
    source: ev.source || "book",
    ref: ev.ref,
    title: ev.title ?? null,
    subtitle: ev.subtitle ?? null,
    cover: ev.cover ?? null,
    album: ev.album ?? null,
    artist: ev.artist ?? null,
    href: ev.href ?? null,
    durationSec: ev.durationSec ?? null,
    positionSec: ev.positionSec ?? null,
  });
}

/* ─────────────────────── джапа (садхана) ─────────────────────── */

export interface JapaRoundDTO {
  /** Стабильный id круга с устройства (<device>:<ts>) — идемпотентность на сервере. */
  id: string;
  /** Локальная дата завершения круга, YYYY-MM-DD. */
  day: string;
  /** Момент завершения, ISO. */
  at: string;
  /** Бусин в круге (обычно 108). */
  beads: number;
  /** Длительность круга в секундах (если измерена). */
  durationSec?: number | null;
}

/**
 * Зеркалит завершённые круги джапы на сервер (для вошедшего — кросс-устройство и
 * сводка кабинета). Локальный счётчик остаётся источником правды на устройстве;
 * сюда летят только новые круги, идемпотентно по id. No-op для гостя.
 */
export function recordJapa(rounds: JapaRoundDTO[]): void {
  if (!authed || !rounds.length) return;
  post("/me/japa", { rounds });
}

/* ─────────────────────── закладки/избранное (хук) ─────────────────────── */

export interface BookmarkInput {
  /** book|verse|chapter|bhajan|kirtan|article — что сохраняем. */
  kind: string;
  /** Стабильный ключ объекта. */
  ref: string;
  title?: string | null;
  subtitle?: string | null;
  href?: string | null;
  cover?: string | null;
}

interface BookmarkState {
  saved: boolean;
  busy: boolean;
  toggle: () => void;
}

/**
 * Сердечко на любой карточке/ридере. Гидрируется с сервера при входе, оптимистично
 * переключается по тапу, для гостя — flash + переход в кабинет.
 */
export function useBookmark(input: BookmarkInput & { flash?: (m: string) => void }): BookmarkState {
  const { kind, ref, title, subtitle, href, cover, flash } = input;
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const isAuthedNow = useAuthed();
  const inFlight = useRef(false);

  // Гидрация состояния при входе/смене объекта.
  useEffect(() => {
    let alive = true;
    if (!isAuthedNow || !kind || !ref) {
      setSaved(false);
      return;
    }
    fetch(api(`/me/bookmark?kind=${encodeURIComponent(kind)}&ref=${encodeURIComponent(ref)}`), {
      credentials: "same-origin",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { saved?: boolean } | null) => {
        if (alive && d) setSaved(!!d.saved);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [isAuthedNow, kind, ref]);

  function toggle(): void {
    if (!isAuthed()) {
      flash?.("Войдите, чтобы сохранять в личном кабинете");
      requireAuth();
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    const next = !saved;
    setSaved(next); // оптимистично
    fetch(api("/me/bookmark"), {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind,
        ref,
        title: title ?? null,
        subtitle: subtitle ?? null,
        href: href ?? null,
        cover: cover ?? null,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { saved?: boolean } | null) => {
        if (d && typeof d.saved === "boolean") setSaved(d.saved);
        else setSaved(!next); // откат при странном ответе
      })
      .catch(() => setSaved(!next)) // откат при ошибке сети
      .finally(() => {
        inFlight.current = false;
        setBusy(false);
      });
  }

  return { saved, busy, toggle };
}

/* ─────────────────────── мост клиентского «Избранное» → сервер ─────────────────────── */

/** Метаданные избранного (снимок для карточки): t — заголовок, s — подзаголовок, h — путь. */
export interface FavMetaLite {
  t?: string;
  s?: string;
  h?: string;
}

/**
 * Зеркалит одну запись клиентского «Избранного» (localStorage) в серверные
 * закладки, чтобы личный кабинет показывал то же, что экран «Избранное».
 * Ключ — `<kind>:<ref>` (тип до первого двоеточия). No-op для гостя.
 * Использует детерминированный POST с `set` (не тумблер).
 */
export function mirrorFavorite(key: string, on: boolean, meta?: FavMetaLite): void {
  if (!authed || !key) return;
  const ci = key.indexOf(":");
  const kind = ci >= 0 ? key.slice(0, ci) : key;
  const ref = ci >= 0 ? key.slice(ci + 1) : "";
  if (!kind || !ref) return;
  post("/me/bookmark", {
    kind,
    ref,
    set: on,
    title: meta?.t ?? null,
    subtitle: meta?.s ?? null,
    href: meta?.h ?? null,
  });
}

/**
 * Разовая синхронизация всего локального «Избранного» на сервер при входе
 * (локальное — источник правды на устройстве; сервер дополняем). No-op для гостя.
 */
export function syncFavoritesToServer(items: { key: string; meta?: FavMetaLite }[]): void {
  if (!authed) return;
  for (const it of items) mirrorFavorite(it.key, true, it.meta);
}
