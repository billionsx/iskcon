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
/* ЗКН-Ф021 — ЗАСТРЯВШИЙ SW ВЫБИВАЕТСЯ ТОЛЬКО СМЕНОЙ БАЙТОВ ЭТОГО ФАЙЛА.
 *
 * Круг, из-за которого «ничего не меняется после каждой починки»:
 *   старый SW отдаёт старую оболочку → человек грузит СТАРЫЙ бандл
 *   самолечение живёт В БАНДЛЕ       → до человека оно не доезжает
 *   значит бандл не обновится        → и так вечно
 *
 * Разорвать круг изнутри приложения НЕЛЬЗЯ: всё, что внутри бандла, приходит
 * из кеша. Мимо кеша проходит ровно один файл — `/sw.js` (воркер отдаёт его
 * с `no-cache`, ЗКН-Ф020). Значит рычаг ровно один: СМЕНИТЬ ЕГО БАЙТЫ.
 *
 * Версию кеша поднимаем при КАЖДОЙ починке, которая обязана доехать до людей.
 * Смена версии → браузер видит новый `sw.js` → install → activate сносит ВСЕ
 * прежние кеши → clients.claim → клиент ловит `controllerchange` и перезагружается
 * → оболочка берётся из сети (network-first) → свежий бандл.
 *
 * v6 — доставка ЗКН-Н039…Н043 (корень белых экранов: роутер ставил вкладки,
 * которых нет). Код был исправлен и задеплоен, но до людей не доехал. */
const CACHE = "iol-v6";
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

  /* ЗКН-Ф019 — КОД ПРИЛОЖЕНИЯ НИКОГДА НЕ БЕРЁТСЯ ИЗ КЕША ПЕРВЫМ.
   *
   * SW кэшировал ВСЁ подряд «сначала кеш». Оболочка (`index.html`) и бандл
   * попадали в кеш — и человек ГОДАМИ жил на старом коде: я чиню, деплою,
   * а у него из кеша поднимается прежняя сборка. Правки НЕ ДОЕЗЖАЛИ.
   *
   * Оболочка и JS/CSS — ВСЕГДА из сети. Кешируем только то, что не меняет
   * поведение: картинки, шрифты, иконки. */
  const isCode = /\.(?:js|css|html)$/.test(url.pathname) || url.pathname === "/";
  if (isCode) {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res) return res;
      } catch { /* офлайн */ }
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      return new Response("", { status: 504 });
    })());
    return;
  }

  /* ЗКН-Ф017 — SERVICE WORKER ОБЯЗАН ВЕРНУТЬ RESPONSE. ВСЕГДА.
   *
   * ЗДЕСЬ ЖИЛ КОРЕНЬ ВСЕХ БЕЛЫХ ЭКРАНОВ.
   *
   * Было:
   *     const net = fetch(req).then(...).catch(() => hit);
   *     return hit || net;
   *
   * Если в кеше ПУСТО (`hit === undefined`) И сеть упала — `.catch(() => hit)`
   * отдаёт `undefined`. `respondWith` получает Promise<undefined>, и браузер
   * бросает:
   *
   *     TypeError: Failed to convert value to 'Response'.
   *
   * Ответа НЕТ → страница не грузится → БЕЛЫЙ ЭКРАН. И это било по «назад»
   * ВЕЗДЕ — из дхамы, из киртана, из Бхагавад-гиты: «назад» это НАВИГАЦИЯ,
   * а навигация шла через тот же сломанный SW.
   *
   * А в ветке навигации стояло `Response.error()` — ЯВНЫЙ сетевой сбой, и
   * браузер честно показывал пустоту («resulted in a network error response»).
   *
   * ПРАВИЛО: из `respondWith` ВСЕГДА выходит настоящий Response. Пустоту —
   * НИКОГДА.
   */

  // Навигация — сеть, при сбое оболочка из кеша.
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res) return res;
      } catch { /* сеть недоступна — идём в кеш */ }

      const cache = await caches.open(CACHE);
      const shell = (await cache.match("/")) || (await cache.match("/index.html"));
      if (shell) return shell;

      return new Response(
        "<!doctype html><meta charset=utf-8><title>Нет сети</title>" +
        "<body style=\"font-family:system-ui;padding:48px;text-align:center;color:#666\">" +
        "<p>Нет соединения. Обновите страницу.</p>",
        { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    })());
    return;
  }

  // Статика — сначала кеш, затем сеть. Из обеих веток ВСЕГДА выходит Response.
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    if (hit) {
      fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === "basic") cache.put(req, res.clone());
      }).catch(() => {});
      return hit;
    }

    try {
      const res = await fetch(req);
      if (res && res.status === 200 && res.type === "basic") {
        cache.put(req, res.clone()).catch(() => {});
      }
      if (res) return res;
    } catch { /* сеть недоступна */ }

    return new Response("", { status: 504, statusText: "Gateway Timeout" });
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
