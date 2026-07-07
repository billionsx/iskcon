import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Preload основного шрифта (Gentium Regular woff2) в <head>.
 *
 * Иначе браузер узнаёт о шрифте только после парсинга CSS и стартует его загрузку
 * поздно → дольше держится подмена шрифта (FOUT). Preload запускает скачивание
 * параллельно с JS сразу из HTML. Имя файла содержит контент-хэш, поэтому берём
 * его из финального бандла (ctx.bundle доступен только на сборке; в dev — no-op).
 */
function preloadRegularFont(): Plugin {
  return {
    name: "preload-regular-font",
    enforce: "post",
    transformIndexHtml(html, ctx) {
      const bundle = ctx?.bundle;
      if (!bundle) return html; // dev-режим — бандла ещё нет
      const font = Object.keys(bundle).find((f) =>
        /GentiumBookPlus-Regular-[^/]*\.woff2$/.test(f)
      );
      if (!font) return html;
      return {
        html,
        tags: [
          {
            tag: "link",
            attrs: {
              rel: "preload",
              as: "font",
              type: "font/woff2",
              href: "/" + font,
              crossorigin: "", // запросы шрифтов всегда в CORS-режиме — атрибут обязателен, иначе preload не совпадёт
            },
            injectTo: "head-prepend",
          },
        ],
      };
    },
  };
}

export default defineConfig({
  plugins: [react(), preloadRegularFont()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Экраны разбиты на чанки через React.lazy (см. src/lazyScreens.tsx),
    // поэтому крупными остаются лишь вендор и печатный PDF-чанк.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // React/ReactDOM/scheduler редко меняются → выносим в стабильный
        // долгокэшируемый чанк, чтобы деплой кода не инвалидировал их у клиента.
        manualChunks(id: string) {
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/scheduler/")
          ) {
            return "react-vendor";
          }
        },
      },
    },
  },
});
