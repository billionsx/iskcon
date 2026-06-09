/* eslint-disable no-console */
/**
 * ЗАКОН формирования PDF книг на хостинг (генеричный, для ВСЕХ книг).
 *
 * Запускается в CI (локальный Chromium, без лимита Cloudflare Browser Rendering)
 * на каждый деплой. Для каждой книги из BOOKS:
 *   • hierarchical (ЧЧ/ШБ) → один PDF на ТОМ (лила/песнь), с обложкой и плашкой;
 *   • прозовые/обычные (Нектар, БГ) → один PDF (обложка + тело).
 * Вёрстка — та же, что у живого ридера (печатный режим SPA /?pdf=…) и та же
 * обложка (src/pdfCover.ts). Результат кладётся в dist/books/*.pdf + manifest.json
 * и едет на хостинг как статические ассеты. Скачивание = отдача готового файла:
 * мгновенно, масштабируется на любое число пользователей, без рендера на лету.
 *
 * Новая книга = запись в BOOKS. Никакой ручной возни.
 *
 * Конфиг через env:
 *   GEN_API_ORIGIN  куда проксировать /api (по умолчанию https://gaurangers.com)
 *   GEN_WORKS       список работ через запятую (по умолчанию все из BOOKS)
 *   GEN_PORT        порт локального сервера (по умолчанию 8791)
 *   GEN_DIST        каталог собранного фронта (по умолчанию <repo>/apps/web/dist)
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import type { Page } from "playwright";
import type { PDFDocument as PDFDoc } from "pdf-lib";
import { BOOKS, bookFullTitle, type BookData } from "../src/books";
import { coverHtml } from "../src/pdfCover";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright") as typeof import("playwright");
const { PDFDocument } = require("pdf-lib") as typeof import("pdf-lib");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(__dirname, "..");
const DIST = process.env.GEN_DIST || path.join(WEB_ROOT, "dist");
const OUT = path.join(DIST, "books");
const API_ORIGIN = (process.env.GEN_API_ORIGIN || "https://gaurangers.com").replace(/\/$/, "");
const PORT = Number(process.env.GEN_PORT || 8791);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const WORKS = (process.env.GEN_WORKS || Object.keys(BOOKS).join(",")).split(",").map((s) => s.trim()).filter(Boolean);
// Рендерим лилу мелкими кусками (память + гранулярность упаковки), затем
// пакуем куски в файлы-тома по РЕАЛЬНОМУ размеру: Cloudflare-ассеты ≤ 25 MiB,
// поэтому держим каждый файл ≤ SIZE_CAP (с запасом). Так лила 42 МБ режется на
// несколько томов вместо одного неподъёмного файла.
const CHUNK_BUDGET = 500;                  // стихов на кусок рендера (мельче → плотнее упаковка томов)
const SIZE_CAP = 23 * 1024 * 1024;         // потолок размера PDF по СУММЕ кусков; склейка pdf-lib дедуплицирует шрифты → итог ещё меньше (надёжно < 25 MiB)
// Версия конвейера: входит в подпись книги. Бамп → подпись всех книг меняется →
// принудительная пересборка ВСЕХ. Для пересборки одной книги — ручной триггер с
// gen_works=<книга> и force_pdf=true (не трогает остальные).
const GEN_VERSION = "2";
const CC_LILA: Record<string, string> = { adi: "Ади-лила", madhya: "Мадхья-лила", antya: "Антья-лила" };

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".webp": "image/webp", ".ico": "image/x-icon",
  ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf", ".map": "application/json",
};

function serveStatic(res: http.ServerResponse, fp: string): boolean {
  try {
    if (!fs.existsSync(fp) || !fs.statSync(fp).isFile()) return false;
    res.writeHead(200, { "content-type": MIME[path.extname(fp).toLowerCase()] || "application/octet-stream" });
    res.end(fs.readFileSync(fp));
    return true;
  } catch { return false; }
}

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url || "/", ORIGIN);
    if (u.pathname.startsWith("/api/")) {
      const r = await fetch(API_ORIGIN + u.pathname + u.search, { headers: { accept: "application/json" } });
      const body = Buffer.from(await r.arrayBuffer());
      res.writeHead(r.status, { "content-type": r.headers.get("content-type") || "application/json" });
      res.end(body);
      return;
    }
    // статический файл из dist
    const safe = path.normalize(u.pathname).replace(/^(\.\.[/\\])+/, "");
    if (serveStatic(res, path.join(DIST, safe))) return;
    // SPA-фоллбэк
    if (serveStatic(res, path.join(DIST, "index.html"))) return;
    res.writeHead(404); res.end("not found");
  } catch (e) {
    res.writeHead(502); res.end("proxy error: " + (e as Error).message);
  }
});

function computeRanges(chs: Array<{ number: string; verses: number }>, budget: number): string[] {
  const total = chs.reduce((s, c) => s + (Number(c.verses) || 0), 0);
  const parts = Math.max(1, Math.ceil(total / budget));
  const tgt = total / parts;
  const ranges: string[] = [];
  let from = "", last = "", curV = 0, made = 0;
  for (const c of chs) {
    if (!from) from = c.number;
    last = c.number; curV += Number(c.verses) || 0;
    if (made < parts - 1 && curV >= tgt) { ranges.push(`${from}-${last}`); from = ""; curV = 0; made++; }
  }
  if (from) ranges.push(`${from}-${last}`);
  return ranges;
}

const escH = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const brand = `<div style="font-size:8.5px;letter-spacing:2px;">ISKCON ONE LOVE</div><div style="font-size:8px;letter-spacing:1px;color:#a7a8b0;">iskcone.com</div>`;
function headerTpl(text: string): string {
  return `<div style="width:100%;padding:0 16mm;text-align:center;-webkit-print-color-adjust:exact;print-color-adjust:exact;"><div style="font-family:Georgia,'Times New Roman',serif;font-size:8px;letter-spacing:1.5px;line-height:1.3;text-transform:uppercase;color:#9a9a9e;">${escH(text)}</div></div>`;
}
function footerTpl(withPageNo: boolean): string {
  return `<div style="width:100%;padding:0 18mm;font-family:Georgia,'Times New Roman',serif;text-align:center;line-height:1.45;color:#8a8a8e;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${withPageNo ? `<div style="font-size:8px;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>` : ""}<div style="font-size:8.5px;letter-spacing:2px;margin-top:2.5px;">ISKCON ONE LOVE</div><div style="font-size:8px;letter-spacing:1px;color:#a7a8b0;">iskcone.com</div></div>`;
}
const MARGIN = { top: "20mm", bottom: "22mm", left: "18mm", right: "18mm" };

async function renderCover(page: Page, book: BookData, volume?: string, range?: string): Promise<Uint8Array | null> {
  try {
    const imgUrl = ORIGIN + (book.covers[0] ?? "/og-default.png");
    await page.setContent(coverHtml({
      titleLine1: book.titleLine1, titleLine2: book.titleLine2, iast: book.iast,
      tagline: book.tagline, author: book.author, imgUrl, uniformTitle: book.uniformTitle, volume, range,
    }), { waitUntil: "load", timeout: 60000 });
    await Promise.race([
      page.evaluate(() => Promise.all([
        ...[...document.images].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; })),
        (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts?.ready ?? 0,
      ])),
      new Promise((r) => setTimeout(r, 8000)),
    ]).catch(() => {});
    return await page.pdf({ format: "A4", printBackground: true, margin: { top: "0", bottom: "0", left: "0", right: "0" } });
  } catch (e) { console.warn("  cover failed:", (e as Error).message); return null; }
}

async function renderBody(page: Page, url: string, header: string, footer: string): Promise<Uint8Array> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction("window.__pdfReady === true", { timeout: 220000 }).catch(() => {});
  return await page.pdf({ format: "A4", printBackground: true, displayHeaderFooter: true, headerTemplate: header, footerTemplate: footer, margin: MARGIN });
}

async function appendInto(merged: PDFDoc, bytes: Uint8Array): Promise<void> {
  const doc = await PDFDocument.load(bytes);
  for (const p of await merged.copyPages(doc, doc.getPageIndices())) merged.addPage(p);
}

type ManFile = { label: string; file: string; name: string };
type ManEntry = { hierarchical: boolean; files: ManFile[]; sig: string; generatedAt: string };

type TocResp = { divisions?: Array<{ id: string; slug: string; title_ru: string; chapters: Array<{ id: string; number: string; title_ru: string; verses: number }> }> };
type ChaptersResp = { chapters?: Array<{ id: string; number: string; title_ru: string; verses: number }> };
const sha = (s: string) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 16);

// Дешёвая подпись содержимого книги (структура из API) — чтобы не пересобирать
// неизменные книги на каждом деплое. Меняется при добавлении/удалении/переименовании
// глав/томов и изменении числа стихов. Чистые правки текста той же длины подписью не
// ловятся → форсировать пересборку: env GEN_FORCE=1.
async function signature(work: string, book: BookData): Promise<{ sig: string; toc?: TocResp }> {
  if (book.hierarchical) {
    const toc = await (await fetch(`${ORIGIN}/api/books/${work}/toc`)).json() as TocResp;
    const skel = (toc.divisions ?? []).map((d) => [d.id, (d.chapters ?? []).map((c) => [c.id, c.number, c.verses, c.title_ru])]);
    return { sig: sha(`${GEN_VERSION}|${JSON.stringify(skel)}`), toc };
  }
  const ch = await (await fetch(`${ORIGIN}/api/books/${work}/chapters`)).json() as ChaptersResp;
  const skel = (ch.chapters ?? []).map((c) => [c.id, c.number, c.verses, c.title_ru]);
  return { sig: sha(`${GEN_VERSION}|${JSON.stringify(skel)}`) };
}

async function genBook(page: Page, work: string, sig: string, toc: TocResp | undefined): Promise<ManEntry | null> {
  const book = BOOKS[work];
  if (!book) { console.warn(`! ${work}: нет в BOOKS`); return null; }
  const full = bookFullTitle(book);
  const files: ManFile[] = [];

  if (book.hierarchical) {
    const divisions = toc?.divisions ?? [];
    if (!divisions.length) { console.warn(`! ${work}: пустое оглавление`); return null; }
    for (const d of divisions) {
      const slug = d.id.split(".")[1] || d.slug;
      const label = d.title_ru || CC_LILA[slug] || slug;
      const ranges = computeRanges(d.chapters ?? [], CHUNK_BUDGET);
      if (!ranges.length) continue;
      console.log(`  ${work}/${slug} (${label}): ${ranges.length} chunk(s)`);
      const header = headerTpl(`${full} · ${label}`);
      const footer = footerTpl(false);
      const cover = await renderCover(page, book, label);
      // рендерим куски в байты
      const chunks: Uint8Array[] = [];
      for (const rg of ranges) {
        const [f, t] = rg.split("-");
        chunks.push(await renderBody(page, `${ORIGIN}/?pdf=lila&work=${encodeURIComponent(work)}&lila=${encodeURIComponent(slug)}&from=${encodeURIComponent(f)}&to=${encodeURIComponent(t || f)}&bare=1`, header, footer));
      }
      // пакуем куски в тома по размеру (каждый файл ≤ SIZE_CAP, обложка на каждом)
      const coverSize = cover ? cover.length : 0;
      const vols: Uint8Array[][] = [];
      let cur: Uint8Array[] = [], curSize = 0;
      for (const cb of chunks) {
        if (cur.length && coverSize + curSize + cb.length > SIZE_CAP) { vols.push(cur); cur = []; curSize = 0; }
        cur.push(cb); curSize += cb.length;
      }
      if (cur.length) vols.push(cur);
      const K = vols.length;
      for (let vi = 0; vi < K; vi++) {
        const merged = await PDFDocument.create();
        if (cover) await appendInto(merged, cover).catch(() => {});
        for (const cb of vols[vi]) await appendInto(merged, cb);
        if (merged.getPageCount() === 0) { continue; }
        const fname = K > 1 ? `${work}-${slug}-${vi + 1}.pdf` : `${work}-${slug}.pdf`;
        const vlabel = K > 1 ? `${label} (часть ${vi + 1} из ${K})` : label;
        fs.writeFileSync(path.join(OUT, fname), await merged.save());
        files.push({ label: vlabel, file: `/books/${fname}`, name: `${full}. ${vlabel}.pdf` });
        console.log(`  ✓ ${fname} (${merged.getPageCount()} pages)`);
      }
    }
  } else {
    console.log(`  ${work}: single file`);
    const merged = await PDFDocument.create();
    const cover = await renderCover(page, book);
    if (cover) await appendInto(merged, cover).catch(() => {});
    const url = `${ORIGIN}/?pdf=book&work=${encodeURIComponent(work)}`;
    const body = await renderBody(page, url, headerTpl(full), footerTpl(true));
    await appendInto(merged, body);
    if (merged.getPageCount() === 0) { console.warn(`  ${work}: пусто`); return null; }
    const fname = `${work}.pdf`;
    fs.writeFileSync(path.join(OUT, fname), await merged.save());
    files.push({ label: "", file: `/books/${fname}`, name: `${full}.pdf` });
    console.log(`  ✓ ${fname} (${merged.getPageCount()} pages)`);
  }
  if (!files.length) return null;
  return { hierarchical: !!book.hierarchical, files, sig, generatedAt: new Date().toISOString() };
}

function entryFilesExist(e: ManEntry): boolean {
  return e.files.length > 0 && e.files.every((f) => fs.existsSync(path.join(DIST, f.file.replace(/^\//, ""))));
}

async function main(): Promise<void> {
  if (!fs.existsSync(DIST)) { console.error(`dist не найден: ${DIST} (сначала vite build)`); process.exit(0); }
  fs.mkdirSync(OUT, { recursive: true });
  await new Promise<void>((r) => server.listen(PORT, "127.0.0.1", () => r()));
  console.log(`gen-pdf: dist=${DIST} api→${API_ORIGIN} works=[${WORKS.join(", ")}]`);

  // прежний манифест (восстановлен из кэша CI) — для пропуска неизменных книг
  let prev: Record<string, ManEntry> = {};
  try { prev = JSON.parse(fs.readFileSync(path.join(OUT, "manifest.json"), "utf8")); } catch { /* нет — ок */ }
  const force = process.env.GEN_FORCE === "1";

  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const ctx = await browser.newContext({ viewport: { width: 820, height: 1160 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  const manifest: Record<string, ManEntry> = {};
  // не валим деплой: ошибка по одной книге не мешает остальным
  for (const work of WORKS) {
    console.log(`\n→ ${work}`);
    try {
      const { sig, toc } = await signature(work, BOOKS[work]);
      const pe = prev[work];
      if (!force && pe && pe.sig === sig && entryFilesExist(pe)) {
        manifest[work] = pe;
        console.log(`  = без изменений (${sig}) — пропуск`);
        continue;
      }
      const entry = await genBook(page, work, sig, toc);
      if (entry) manifest[work] = entry;
    } catch (e) { console.error(`✗ ${work}: ${(e as Error).message}`); if (prev[work]) manifest[work] = prev[work]; }
  }

  const out = { ...prev, ...manifest };
  fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(out, null, 2));
  // чистим устаревшие PDF (не упомянутые в финальном манифесте) — иначе старые
  // версии файлов (в т.ч. слишком большие) остаются в ассетах и валят деплой
  const keep = new Set(Object.values(out).flatMap((e) => e.files.map((f) => path.basename(f.file))));
  for (const f of fs.readdirSync(OUT)) {
    if (f.endsWith(".pdf") && !keep.has(f)) { try { fs.unlinkSync(path.join(OUT, f)); console.log(`  ⌫ удалён устаревший ${f}`); } catch { /* ignore */ } }
  }
  console.log(`\nmanifest: ${Object.keys(out).join(", ") || "(пусто)"}`);

  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
}

main().catch((e) => { console.error("gen-pdf fatal:", e); process.exit(0); });
