/* ISKCON ONE LOVE — service worker.
 * Стратегия безопасна для конвейера «свежий бандл на 100%»:
 *  • навигация (HTML) — network-first → офлайн-фолбэк на оболочку (юзеры всегда видят свежую сборку);
 *  • /api/* — никогда не кэшируем (даршан/лента/заказы динамичны; воркер сам ставит cache-control);
 *  • внешние домены (archive.org, храмовые CDN через /api/img — но это same-origin) — не трогаем;
 *  • хэшированная статика (assets/*, иконки) — cache-first + фоновое обновление (content-hash → иммутабельно).
 * Версию кэша поднимать при смене стратегии ИЛИ чтобы выбить зависшие старые SW:
 * смена байтов этого файла триггерит обновление SW (браузер тянет /sw.js в обход
 * HTTP-кэша), activate сносит все прежние кэши, clients.claim + перезагрузка на
 * клиенте подхватывают свежий бандл. */
const CACHE = "iol-v3";
const SHELL = ["/", "/manifest.webmanifest", "/icon-192.png", "/favicon.svg"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return;     // внешнее — браузеру
  if (url.pathname.startsWith("/api/")) return;          // динамика — всегда сеть

  // Навигация — network-first, офлайн-фолбэк на оболочку.
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        return await fetch(req);
      } catch {
        const cache = await caches.open(CACHE);
        return (await cache.match("/")) || Response.error();
      }
    })());
    return;
  }

  // Статика — cache-first + фоновое обновление.
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    const net = fetch(req).then((res) => {
      if (res && res.status === 200 && res.type === "basic") cache.put(req, res.clone());
      return res;
    }).catch(() => hit);
    return hit || net;
  })());
});

/* Уведомления (Ц3). Модель «tickle»: пуш приходит без данных → спрашиваем сервер,
 * что показать (cookie-сессия уходит сама), и показываем. Тег = id уведомления,
 * чтобы браузер не плодил дубли при повторной доставке. */
self.addEventListener("push", (e) => {
  e.waitUntil((async () => {
    let items = [];
    try {
      const res = await fetch("/api/push/pending", { credentials: "include" });
      if (res.ok) items = ((await res.json()) || {}).items || [];
    } catch { /* сеть/сессия недоступны */ }
    // Фолбэк: если сервер молчит, но пуш нёс данные — показать их.
    if (!items.length && e.data) {
      try { const d = e.data.json(); if (d && d.title) items = [d]; } catch { /* нет тела */ }
    }
    for (const it of items.slice(0, 3)) {
      await self.registration.showNotification(it.title || "ISKCON ONE LOVE", {
        body: it.body || "",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: it.id || undefined,
        data: { url: it.url || "/" },
      });
    }
  })());
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if ("focus" in c) { try { await c.navigate(url); } catch { /* кросс-док */ } return c.focus(); }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});
