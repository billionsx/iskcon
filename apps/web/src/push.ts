/**
 * Уведомления (Ц3) — клиентская часть. Запрашивает разрешение, подписывается на
 * web-push через service worker и отправляет подписку на сервер (/api/me/push/*).
 * Модель «tickle»: сервер шлёт пустой пуш, SW спрашивает /api/push/pending. Здесь
 * только подписка/отписка/категории; показ уведомлений — в public/sw.js.
 *
 * Разрешение (Notification.requestPermission) запрашиваем ТОЛЬКО из жеста
 * пользователя (тап по тумблеру), иначе браузер отклонит. На iOS web-push
 * работает лишь для установленного на домашний экран PWA (iOS 16.4+).
 */
import { api } from "./api";

export type PushCats = { verse?: boolean; ekadashi?: boolean; festival?: boolean; streak?: boolean };
export const DEFAULT_CATS: PushCats = { verse: true, ekadashi: true, festival: true, streak: true };
const CATS_KEY = "push:cats";

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}
export function pushPermission(): NotificationPermission | "unsupported" {
  return pushSupported() ? Notification.permission : "unsupported";
}
export function loadCats(): PushCats {
  try { const s = localStorage.getItem(CATS_KEY); if (s) return { ...DEFAULT_CATS, ...(JSON.parse(s) as PushCats) }; } catch { /* приватный режим */ }
  return { ...DEFAULT_CATS };
}
function saveCats(c: PushCats) { try { localStorage.setItem(CATS_KEY, JSON.stringify(c)); } catch { /* noop */ } }

function urlB64ToUint8(base64: string): Uint8Array {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function isSubscribed(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    return !!(await reg.pushManager.getSubscription());
  } catch { return false; }
}

async function vapidKey(): Promise<string | null> {
  try {
    const res = await fetch(api("/push/vapid-public"));
    if (!res.ok) return null;
    return ((await res.json()) as { key: string | null }).key;
  } catch { return null; }
}

/** Запросить разрешение, подписаться, отправить подписку на сервер. */
export async function enablePush(cats: PushCats = loadCats()): Promise<{ ok: boolean; reason?: string }> {
  if (!pushSupported()) return { ok: false, reason: "unsupported" };
  let perm: NotificationPermission;
  try { perm = await Notification.requestPermission(); } catch { return { ok: false, reason: "denied" }; }
  if (perm !== "granted") return { ok: false, reason: perm };
  const key = await vapidKey();
  if (!key) return { ok: false, reason: "no_key" };
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(key) as BufferSource });
    const js = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    const tzOffset = -new Date().getTimezoneOffset(); // минуты восточнее UTC
    const res = await fetch(api("/me/push/subscribe"), {
      method: "POST", credentials: "include", headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: js.endpoint, keys: js.keys, tzOffset, cats }),
    });
    if (!res.ok) return { ok: false, reason: "save_failed" };
    saveCats(cats);
    return { ok: true };
  } catch {
    return { ok: false, reason: "subscribe_failed" };
  }
}

export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    const endpoint = sub?.endpoint;
    if (sub) await sub.unsubscribe();
    if (endpoint) {
      await fetch(api("/me/push/unsubscribe"), {
        method: "POST", credentials: "include", headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
    }
  } catch { /* noop */ }
}

/** Обновить набор категорий на сервере (по всем устройствам). */
export async function updateCats(cats: PushCats): Promise<void> {
  saveCats(cats);
  try {
    await fetch(api("/me/push/cats"), {
      method: "PATCH", credentials: "include", headers: { "content-type": "application/json" },
      body: JSON.stringify({ cats }),
    });
  } catch { /* noop */ }
}
