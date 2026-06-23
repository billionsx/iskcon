import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
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
    window.location.reload();
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
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => { navigator.serviceWorker.register("/sw.js").catch(() => {}); });
  }
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
