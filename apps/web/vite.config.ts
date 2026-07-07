import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
