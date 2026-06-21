#!/usr/bin/env python3
"""
Идемпотентно встраивает страницу /downloader в два «горячих» файла монорепо:
  apps/web/worker.ts   — 3 правки (импорт, поля Env, вызов downloaderApi)
  apps/web/src/App.tsx — 9 правок (роутер по паттерну /admin)

Запускать из корня репо:  python patch_hotfiles.py
Безопасно гонять повторно (после очередного rebase на origin/main): уже
применённые правки пропускаются, отсутствующие якоря — явная ошибка.
Новые файлы (DownloaderScreen.tsx, src/downloader/server.ts, workflow, tools/*)
кладутся отдельно и в патче не нуждаются.
"""
import sys
from pathlib import Path

ROOT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")


def patch(path: Path, edits):
    s = path.read_text(encoding="utf-8")
    orig = s
    for anchor, new, guard in edits:
        if guard in s:
            continue  # уже применено
        if anchor not in s:
            raise SystemExit(f"✗ Якорь не найден в {path}:\n  {anchor[:80]!r}\n"
                             f"  (main мог измениться — поправь якорь и повтори)")
        s = s.replace(anchor, new, 1)
    if s != orig:
        path.write_text(s, encoding="utf-8")
        print(f"✓ {path} — обновлён")
    else:
        print(f"• {path} — уже актуален")


# ---- apps/web/worker.ts ----
patch(ROOT / "apps/web/worker.ts", [
    (
        'import { readingApi } from "./src/reading/server";',
        'import { readingApi } from "./src/reading/server";\nimport { downloaderApi } from "./src/downloader/server";',
        "downloader/server",
    ),
    (
        "  // Секрет для CRM-загрузчика: wrangler secret put ADMIN_TOKEN\n  ADMIN_TOKEN?: string;",
        "  // Секрет для CRM-загрузчика: wrangler secret put ADMIN_TOKEN\n  ADMIN_TOKEN?: string;\n"
        "  // Загрузчик аудио (/api/downloader/*): GitHub-токен для запуска tg-archive.yml.\n"
        "  //   wrangler secret put GH_TOKEN   (PAT: Actions read+write, Contents read)\n"
        "  GH_TOKEN?: string;\n  GH_REPO?: string;\n  GH_WORKFLOW?: string;",
        "GH_TOKEN?",
    ),
    (
        '    // Same-origin proxy to the API so the browser never makes a cross-origin call.\n    if (url.pathname.startsWith("/api/")) {',
        "    // ── Загрузчик аудио (/api/downloader/*): диспетчер GitHub Actions, защищён ADMIN_TOKEN ──\n"
        "    const dlRes = await downloaderApi(request, env, url);\n"
        "    if (dlRes) return dlRes;\n\n"
        '    // Same-origin proxy to the API so the browser never makes a cross-origin call.\n    if (url.pathname.startsWith("/api/")) {',
        "downloaderApi(request, env, url)",
    ),
])

# ---- apps/web/src/App.tsx ----
patch(ROOT / "apps/web/src/App.tsx", [
    (
        'import DarshanScreen from "./DarshanScreen";',
        'import DarshanScreen from "./DarshanScreen";\nimport DownloaderScreen from "./DownloaderScreen";',
        "import DownloaderScreen from",
    ),
    (
        "  const [openAdmin, setOpenAdmin] = useState(false);",
        "  const [openAdmin, setOpenAdmin] = useState(false);\n  const [openDownloader, setOpenDownloader] = useState(false);",
        "openDownloader, setOpenDownloader",
    ),
    ('"admin", "entity"', '"admin", "downloader", "entity"', '"downloader"'),
    (
        '    if (openAdmin) return "/admin";',
        '    if (openAdmin) return "/admin";\n    if (openDownloader) return "/downloader";',
        'return "/downloader"',
    ),
    (
        "setOpenDhama(null); setOpenTirtha(null);",
        "setOpenDhama(null); setOpenTirtha(null); setOpenDownloader(false);",
        "setOpenTirtha(null); setOpenDownloader(false);",
    ),
    (
        '    if (seg0 === "admin") { setOpenAdmin(true); return; }',
        '    if (seg0 === "admin") { setOpenAdmin(true); return; }\n    if (seg0 === "downloader") { setOpenDownloader(true); return; }',
        'setOpenDownloader(true); return;',
    ),
    (
        "openModeration, openDhama, openTirtha]);",
        "openModeration, openDhama, openTirtha, openDownloader]);",
        "openTirtha, openDownloader]);",
    ),
    (
        "&& !openDhama && !openTirtha;",
        "&& !openDhama && !openTirtha && !openDownloader;",
        "!openTirtha && !openDownloader;",
    ),
    (
        '        {openAdmin ? (\n'
        '          <main style={{ position: "relative", height: "100dvh", overflow: "hidden" }}>\n'
        '            <BookLoaderPage onBack={goBack} />\n'
        '          </main>\n'
        '        ) : openBook ? (',
        '        {openDownloader ? (\n'
        '          <main style={{ position: "relative", height: "100dvh", overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain" }}>\n'
        '            <DownloaderScreen onBack={goBack} />\n'
        '          </main>\n'
        '        ) : openAdmin ? (\n'
        '          <main style={{ position: "relative", height: "100dvh", overflow: "hidden" }}>\n'
        '            <BookLoaderPage onBack={goBack} />\n'
        '          </main>\n'
        '        ) : openBook ? (',
        "<DownloaderScreen onBack={goBack} />",
    ),
])

print("\nГотово. Дальше: cd apps/web && npx vite build  (гейт), затем обычный деплой.")
