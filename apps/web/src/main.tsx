import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { lazy, Suspense } from "react";

/* ПРОБНАЯ ОБОЛОЧКА /x — развилка стоит ЗДЕСЬ, а не внутри App.
   Текущая версия приложения о существовании /x не знает и не меняется. */
const XShell = lazy(() => import("./x/Shell"));
function Root() {
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/x")) {
    return <Suspense fallback={null}><XShell /></Suspense>;
  }
  return <App />;
}
import "./ui/globals.css";
import "./styles.css";

/**
 * Авто-обновление приложения.
 *
 * Проблема: после деплоя сервер уже отдаёт новую сборку (index.html без кэша →
 * новый хэш JS), но в открытой ВКЛАДКЕ продолжает работать старый загруженный JS,
 * пока пользователь не сделает полную перезагрузку. Из-за этого правки «не
 * появлялись», пока вручную не нажмёшь Cmd+Shift+R.
 *
 * Решение: при возврате во вкладку и периодически тянем index.html с сервера
 * (no-store), достаём хэш главного бандла и сравниваем с реально загруженным в
 * этой вкладке. Если сборка на сервере другая — мягко перезагружаем страницу.
 * Отметка в sessionStorage защищает от циклов.
 */
function runningAssetHash(): string {
  const main = Array.from(document.querySelectorAll<HTMLScriptElement>("script[src]"))
    .map((s) => s.src)
    .find((u) => /\/assets\/index-[^./]+\.js/.test(u));
  return main ? (main.match(/index-([^./]+)\.js/)?.[1] ?? "") : "";
}

let updateChecking = false;

/* Предохранитель от краш-петли перезагрузок («A problem repeatedly occurred»).
 * Все авто-reload идут через него: если за 90с накопилось 3 перезагрузки —
 * ГЛУШИМ авто-обновление до конца сессии. Лучше устаревший экран, чем
 * бесконечный цикл, который iOS Safari показывает как краш страницы. */
let reloadsBlocked = false;
function safeReload(): void {
  if (reloadsBlocked) return;
  try {
    const now = Date.now();
    const log = (JSON.parse(sessionStorage.getItem("__reload_log") || "[]") as number[]).filter((t) => now - t < 90000);
    log.push(now);
    sessionStorage.setItem("__reload_log", JSON.stringify(log));
    if (log.length >= 3) { reloadsBlocked = true; return; }
  } catch {
    // Нет доступа к sessionStorage — считать перезагрузки НЕЧЕМ, значит и
    // оборвать возможный цикл нечем. Безопаснее НЕ перезагружаться (пусть экран
    // устаревший), чем рискнуть бесконечным циклом, который iOS Safari покажет
    // как «A problem repeatedly occurred». Все пути reload идут через этот
    // предохранитель, поэтому здесь замыкается защита от петли на любом storage.
    reloadsBlocked = true; return;
  }
  window.location.reload();
}

async function checkForUpdate(): Promise<void> {
  if (updateChecking) return;
  if (new URLSearchParams(window.location.search).has("pdf")) return; // печатный режим не трогаем
  updateChecking = true;
  try {
    const res = await fetch(`/?_u=${Date.now()}`, { cache: "no-store", headers: { accept: "text/html" } });
    if (!res.ok) return;
    const html = await res.text();
    const latest = html.match(/\/assets\/index-([^./"']+)\.js/)?.[1] ?? "";
    const cur = runningAssetHash();
    if (!latest || !cur || latest === cur) return;
    let last = 0;
    try { last = Number(sessionStorage.getItem("__app_reload_at") || "0"); } catch { /* ignore */ }
    if (Date.now() - last < 30000) return; // не зацикливаемся
    try { sessionStorage.setItem("__app_reload_at", String(Date.now())); } catch { /* ignore */ }
    safeReload();
  } catch {
    /* офлайн / сетевой сбой — пропускаем */
  } finally {
    updateChecking = false;
  }
}

if (typeof window !== "undefined" && !new URLSearchParams(window.location.search).has("pdf")) {
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void checkForUpdate(); });
  window.addEventListener("focus", () => void checkForUpdate());
  setTimeout(() => void checkForUpdate(), 4000);
  setInterval(() => void checkForUpdate(), 120000);

  // PWA: регистрируем service worker (офлайн-оболочка + кэш статики). Навигация в SW —
  // network-first, поэтому авто-обновление сборки выше продолжает работать как прежде.
  //
  // ВАЖНО: старые версии SW могли «заморозить» приложение — отдавать закэшированный
  // старый index.html -> старый JS, и пока байты /sw.js не менялись, обновление SW не
  // срабатывало, поэтому правки НИКОГДА не доезжали до клиента. Лечение: (1) при
  // загрузке принудительно дёргаем reg.update() (браузер тянет /sw.js в обход HTTP-кэша
  // и видит новую версию); (2) когда новый SW перехватывает управление (controllerchange)
  // — один раз перезагружаем страницу, чтобы подхватить свежий бандл без ручного
  // Cmd+Shift+R. Анти-цикл — через sessionStorage.
  if ("serviceWorker" in navigator) {
    /* ЗКН-Ф020 — РАЗРЫВ ЗАМКНУТОГО КРУГА.
     *
     * У людей уже стоит СЛОМАННЫЙ SW: он кэшировал бандл «сначала кеш» и мог
     * вернуть `undefined` вместо Response (белый экран). Пока он жив, до человека
     * не доедет НИЧЕГО — включая починку самого SW.
     *
     * Одноразовая чистка: если версия кеша устарела, СНОСИМ все кеши и
     * ПЕРЕРЕГИСТРИРУЕМ воркера. Метка в localStorage — чтобы сделать это ровно
     * один раз. */
    const HEAL_KEY = "__sw_heal_v5";
    let needHeal = false;
    // КРИТИЧНО: доступ к localStorage оборачиваем в try/catch. На iOS Safari при
    // «Block All Cookies» / приватном режиме / эфемерном хранилище getItem/setItem
    // БРОСАЮТ или молча не сохраняют — тогда метка «уже лечили» не переживает
    // перезагрузку, HEAL срабатывает КАЖДЫЙ раз, сносит кеши и перезагружается
    // по кругу → iOS Safari показывает это как «A problem repeatedly occurred».
    // Нет надёжного хранилища — НЕ лечим (и не роняем загрузку).
    try {
      if (!localStorage.getItem(HEAL_KEY)) { localStorage.setItem(HEAL_KEY, "1"); needHeal = true; }
    } catch { needHeal = false; }
    if (needHeal) {
      void (async () => {
        let changed = false;
        try {
          const keys = await caches.keys();
          if (keys.length) { await Promise.all(keys.map((k) => caches.delete(k))); changed = true; }
          const regs = await navigator.serviceWorker.getRegistrations();
          if (regs.length) { await Promise.all(regs.map((r) => r.unregister())); changed = true; }
        } catch { /* ничего не поделать */ }
        // Перезагружаемся ТОЛЬКО если реально что-то снесли, и ТОЛЬКО через
        // предохранитель safeReload (3 перезагрузки / 90с — потом глушим).
        if (changed) safeReload();
      })();
    }

    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController) return;
      let last = 0;
      try { last = Number(sessionStorage.getItem("__sw_reload_at") || "0"); } catch { /* ignore */ }
      if (Date.now() - last < 30000) return;
      try { sessionStorage.setItem("__sw_reload_at", String(Date.now())); } catch { /* ignore */ }
      safeReload();
    });
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then((reg) => {
        reg.update().catch(() => {});
        setInterval(() => reg.update().catch(() => {}), 120000);
      }).catch(() => {});
    });
  }
}

/* Диагностика загрузки (?debug=1). Показывает, ГДЕ уходят секунды: TTFB воркера
 * (отдача HTML), загрузка+парсинг бандла до интерактива, и самый медленный
 * /api-запрос — с латентностью второго бэкенда (/v1) из Server-Timing. Виден
 * ТОЛЬКО при ?debug=1 — обычных пользователей не трогает. Нужен, чтобы бить в
 * точную причину медленной загрузки, а не гадать (замер прода с телефона, без Mac). */
// Крэш-диагностика (только ?debug): ловим последнюю JS-ошибку и считаем загрузки за
// минуту (частые = цикл краш→автоперезагрузка Safari). Ставим РАНО, до монтирования
// приложения, чтобы поймать причину «A problem repeatedly occurred», а не гадать.
if (typeof window !== "undefined") {
  try {
    if (new URLSearchParams(location.search).has("debug")) {
      const put = (m: string) => { try { sessionStorage.setItem("__dbg_err", m.slice(0, 170) + " @" + new Date().toLocaleTimeString()); } catch { /* ignore */ } };
      window.addEventListener("error", (e) => put("JS: " + (e.message || (e.error && e.error.message) || "error")));
      window.addEventListener("unhandledrejection", (e) => put("promise: " + String((e as PromiseRejectionEvent).reason).slice(0, 130)));
      const loads = (JSON.parse(sessionStorage.getItem("__dbg_loads") || "[]") as number[]).filter((t) => Date.now() - t < 60000);
      loads.push(Date.now());
      sessionStorage.setItem("__dbg_loads", JSON.stringify(loads));
    }
  } catch { /* ignore */ }
}

function bootDiag(): void {
  try { if (!new URLSearchParams(location.search).has("debug")) return; } catch { return; }
  const box = document.createElement("div");
  box.style.cssText = "position:fixed;left:8px;right:8px;top:8px;z-index:99999;font:12px/1.45 ui-monospace,Menlo,monospace;background:rgba(0,0,0,.87);color:#fff;padding:10px 12px;border-radius:10px;white-space:pre-wrap;box-shadow:0 6px 20px rgba(0,0,0,.45)";
  box.onclick = () => box.remove();
  document.body.appendChild(box);
  const ms = (n: number) => (n >= 1000 ? (n / 1000).toFixed(1) + "s" : Math.round(n) + "ms");
  const render = () => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const res = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const apis = res.filter((r) => r.name.includes("/api/"));
    let slow: PerformanceResourceTiming | null = null;
    for (const r of apis) if (!slow || r.duration > slow.duration) slow = r;
    const js = res.filter((r) => /\/assets\/index-.*\.js/.test(r.name)).reduce((a, r) => a + r.duration, 0);
    let v1 = "";
    const st = slow ? ((slow as unknown as { serverTiming?: { name: string; duration: number }[] }).serverTiming || []) : [];
    for (const s of st) if (s.name === "v1") v1 = "  /v1=" + ms(s.duration);
    for (const s of st) if (s.name === "img") v1 = "  исходник=" + ms(s.duration);
    let app = "";
    const nst = nav ? ((nav as unknown as { serverTiming?: { name: string; duration: number }[] }).serverTiming || []) : [];
    for (const s of nst) if (s.name === "app") app = ms(s.duration);
    const name = slow ? slow.name.replace(/^https?:\/\/[^/]+/, "").split("?")[0] : "—";
    let loads = 0; try { loads = (JSON.parse(sessionStorage.getItem("__dbg_loads") || "[]") as number[]).filter((t) => Date.now() - t < 60000).length; } catch { /* ignore */ }
    const nodes = document.getElementsByTagName("*").length;
    let lastErr = ""; try { lastErr = sessionStorage.getItem("__dbg_err") || ""; } catch { /* ignore */ }
    box.textContent =
      "ДИАГНОСТИКА ЗАГРУЗКИ · тап — скрыть\n" +
      "TTFB воркера (HTML): " + ms(nav ? nav.responseStart : 0) + (app ? "  (обработка " + app + ", остальное — старт+сеть)" : "") + "\n" +
      "JS до интерактива: " + ms(nav ? nav.domInteractive : 0) + "  (сеть JS " + ms(js) + ")\n" +
      "запросов /api: " + apis.length + "\n" +
      "самый медленный API: " + ms(slow ? slow.duration : 0) + v1 + "\n" + name + "\n" +
      "загрузок за 60с: " + loads + "  ·  узлов DOM: " + nodes +
      (lastErr ? "\nОШИБКА: " + lastErr : "");
  };
  render();
  const iv = window.setInterval(render, 1500);
  window.setTimeout(() => window.clearInterval(iv), 45000);
}
if (typeof window !== "undefined") {
  if (document.readyState === "complete") window.setTimeout(bootDiag, 600);
  else window.addEventListener("load", () => window.setTimeout(bootDiag, 600));
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
