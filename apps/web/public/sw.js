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
