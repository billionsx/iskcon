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
const CHUNK_BUDGET = 700;                  // стихов на кусок рендера (гранулярность баланса томов)
const SIZE_CAP = 24 * 1024 * 1024;         // потолок ФАКТИЧЕСКОГО размера склеенного PDF (< 25 MiB)
// Версия конвейера: входит в подпись книги. Бамп → подпись всех книг меняется →
// принудительная пересборка ВСЕХ. Для пересборки одной книги — ручной триггер с
// gen_works=<книга> и force_pdf=true (не трогает остальные).
const GEN_VERSION = "4"; // v4: 1 том = 1 логический файл (крупные режутся на части, обложка в 1-й, клиент склеивает)
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

// Один ЛОГИЧЕСКИЙ том = одна лила/песнь. Если целиком ≤ cap — одна часть с
// обложкой. Если больше лимита ассета — режем на минимум частей ≤ cap по
// ФАКТИЧЕСКОМУ размеру склейки; обложка только в ПЕРВОЙ части (остальные —
// продолжение без титула), клиент склеит части в один файл при скачивании.
async function packParts(cover: Uint8Array | null, chunks: Uint8Array[], cap: number): Promise<Uint8Array[]> {
  if (!chunks.length) return [];
  const build = async (cbs: Uint8Array[], withCover: boolean): Promise<Uint8Array> => {
    const d = await PDFDocument.create();
    if (withCover && cover) await appendInto(d, cover).catch(() => {});
    for (const cb of cbs) await appendInto(d, cb);
    return await d.save();
  };
  const weights = chunks.map((c) => c.length);
  const sumW = weights.reduce((a, b) => a + b, 0) || 1;
  const whole = await build(chunks, true);
  if (whole.length <= cap) return [whole];
  const startK = Math.max(2, Math.ceil(whole.length / cap));
  for (let K = startK; K <= chunks.length; K++) {
    const groups: Uint8Array[][] = Array.from({ length: K }, () => []);
    const target = sumW / K;
    let gi = 0, acc = 0;
    for (let i = 0; i < chunks.length; i++) {
      groups[gi].push(chunks[i]); acc += weights[i];
      if (gi < K - 1 && acc >= target * (gi + 1)) gi++;
    }
    const nonEmpty = groups.filter((g) => g.length);
    const built: Uint8Array[] = [];
    let ok = true;
    for (let j = 0; j < nonEmpty.length; j++) {
      const b = await build(nonEmpty[j], j === 0);
      if (b.length > cap && nonEmpty[j].length > 1) { ok = false; break; }
      built.push(b);
    }
    if (ok && built.length) return built;
  }
  // запас: по одному куску на часть (обложка в первой)
  return Promise.all(chunks.map((c, idx) => build([c], idx === 0)));
}

type ManVolume = { label: string; name: string; parts: string[] };
type ManEntry = { hierarchical: boolean; volumes: ManVolume[]; sig: string; generatedAt: string; files?: Array<{ file: string }> };

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
  const volumes: ManVolume[] = [];

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
      const chunks: Uint8Array[] = [];
      for (const rg of ranges) {
        const [f, t] = rg.split("-");
        chunks.push(await renderBody(page, `${ORIGIN}/?pdf=lila&work=${encodeURIComponent(work)}&lila=${encodeURIComponent(slug)}&from=${encodeURIComponent(f)}&to=${encodeURIComponent(t || f)}&bare=1`, header, footer));
      }
      // один логический том = одна лила; крупная режется на части ≤ SIZE_CAP
      const parts = await packParts(cover, chunks, SIZE_CAP);
      const partFiles: string[] = [];
      for (let pi = 0; pi < parts.length; pi++) {
        const fname = parts.length > 1 ? `${work}-${slug}-${pi + 1}.pdf` : `${work}-${slug}.pdf`;
        fs.writeFileSync(path.join(OUT, fname), parts[pi]);
        partFiles.push(`/books/${fname}`);
        console.log(`  ✓ ${fname} (${(parts[pi].length / 1048576).toFixed(1)} MiB)`);
      }
      volumes.push({ label, name: `${full}. ${label}.pdf`, parts: partFiles });
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
    volumes.push({ label: "", name: `${full}.pdf`, parts: [`/books/${fname}`] });
    console.log(`  ✓ ${fname} (${merged.getPageCount()} pages)`);
  }
  if (!volumes.length) return null;
  return { hierarchical: !!book.hierarchical, volumes, sig, generatedAt: new Date().toISOString() };
}

function entryFilesExist(e: ManEntry): boolean {
  const parts = (e.volumes ?? []).flatMap((v) => v.parts ?? []);
  return parts.length > 0 && parts.every((p) => fs.existsSync(path.join(DIST, p.replace(/^\//, ""))));
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
  const keep = new Set(Object.values(out).flatMap((e) =>
    (e.volumes ? e.volumes.flatMap((v) => v.parts ?? []) : (e.files ?? []).map((f) => f.file)).map((p) => path.basename(p))
  ));
  for (const f of fs.readdirSync(OUT)) {
    if (f.endsWith(".pdf") && !keep.has(f)) { try { fs.unlinkSync(path.join(OUT, f)); console.log(`  ⌫ удалён устаревший ${f}`); } catch { /* ignore */ } }
  }
  console.log(`\nmanifest: ${Object.keys(out).join(", ") || "(пусто)"}`);

  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
}

main().catch((e) => { console.error("gen-pdf fatal:", e); process.exit(0); });
