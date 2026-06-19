import { handleAdmin } from "./loader/handler";
import { homeApi } from "./workerHome";
import { calendarApi } from "./workerCalendar";
import { accountApi } from "./src/account/server";
import { centersApi } from "./src/centers/server";
import { darshanApi } from "./src/darshan/server";
import { readingApi } from "./src/reading/server";
import { BOOKS, bookShareTitle, bookShareImage, bookFullTitle, type BookData } from "./src/books";
import { albumById as kirtanAlbumById, artistBySlug as kirtanArtistBySlug } from "./src/kirtans";
import { coverHtml } from "./src/pdfCover";
import { PDF_CACHE_REV } from "./src/pdfRev";
import puppeteer from "@cloudflare/puppeteer";
import { PDFDocument } from "pdf-lib";
import { EmailMessage } from "cloudflare:email";
import { createMimeMessage } from "mimetext/browser";

interface Env {
  ASSETS: { fetch: (req: Request) => Promise<Response> };
  DB: D1Database;
  // Cloudflare Browser Rendering — серверный рендер PDF (headless Chrome)
  BROWSER: Fetcher;
  // Секрет для CRM-загрузчика: wrangler secret put ADMIN_TOKEN
  ADMIN_TOKEN?: string;
  // Отчёты об ошибках → письмо на support@billionsx.com (Resend). Без ключа отчёт
  // только сохраняется в D1, а клиент доставляет письмо через mailto-фолбэк.
  //   wrangler secret put RESEND_API_KEY
  RESEND_API_KEY?: string;
  REPORT_FROM?: string; // напр. "ISKCON ONE LOVE <noreply@gaurangers.com>"
  // Нативная отправка через Cloudflare Email Routing (без сторонних сервисов).
  // Биндинг send_email в wrangler.toml; destination support@billionsx.com должен
  // быть подтверждён, а Email Routing включён на домене-отправителе gaurangers.com.
  SEB?: { send: (m: EmailMessage) => Promise<void> };
  REPORT_FROM_ADDR?: string; // напр. "noreply@gaurangers.com"
  // Доставка отчётов в Telegram (без DNS, не зависит от домена). Секреты:
  //   wrangler secret put TELEGRAM_BOT_TOKEN   /   wrangler secret put TELEGRAM_CHAT_ID
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
}

const NOINDEX = "noindex, nofollow, noarchive, nosnippet, noimageindex";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "X-Robots-Tag": NOINDEX,
      "Cache-Control": "public, max-age=300",
    },
  });
}

// Запрет кэширования (браузер + край Cloudflare) — для динамики вроде поиска,
// чтобы устаревший/пустой ответ никогда не «залипал» по URL запроса.
function noStore(r: Response): Response {
  r.headers.set("Cache-Control", "no-store");
  r.headers.set("CDN-Cache-Control", "no-store");
  r.headers.set("Cloudflare-CDN-Cache-Control", "no-store");
  return r;
}

// Регистронезависимый GLOB-шаблон для кириллицы: SQLite LIKE не складывает регистр
// для не-ASCII, поэтому по каждой букве строим класс [строчн.ЗАГЛ.].
function ciGlob(q: string): string {
  // GLOB регистронезависимо через классы вида [аА]. SQLite отвергает паттерн как
  // «too complex» примерно с 7 классов подряд, поэтому их число ограничено: первые
  // символы матчатся без учёта регистра (покрывает заглавную в начале слова/фразы),
  // остаток — литералом в нижнем регистре. Стихи всё равно ищутся через FTS (вся фраза).
  const MAX_CLASSES = 6;
  let g = "*";
  let cls = 0;
  for (const ch of q) {
    if (ch === "*" || ch === "?" || ch === "[") { g += "[" + ch + "]"; continue; }
    const lo = ch.toLowerCase(), up = ch.toUpperCase();
    if (lo !== up && cls < MAX_CLASSES) { g += "[" + lo + up + "]"; cls++; }
    else g += lo;
  }
  return g + "*";
}

// FTS5 MATCH из пользовательского ввода: буквенно-цифровые токены, неявный AND,
// префиксная «звёздочка» на последнем токене для поиска на лету. Операторы FTS
// (кавычки, скобки, двоеточия и т.п.) отсекаются токенизацией.
function ftsMatch(q: string): string | null {
  const toks = q.toLowerCase().match(/[\p{L}\p{N}]+/gu);
  if (!toks || !toks.length) return null;
  return toks.map((t, i) => (i === toks.length - 1 ? t + "*" : t)).join(" ");
}

// Расширенный MATCH: все токены префиксами через OR — для recall (опечатка/пропуск
// слова). bm25 всё равно поднимает наверх стихи, где совпали все слова.
function ftsMatchOr(q: string): string | null {
  const toks = q.toLowerCase().match(/[\p{L}\p{N}]+/gu);
  if (!toks || !toks.length) return null;
  return toks.map((t) => t + "*").join(" OR ");
}

// ── Обложка по стандарту BBT (единая для всех книг) ──
// Вёрстка обложки вынесена в общий модуль src/pdfCover.ts — её переиспользуют и
// серверный рендер (этот воркер), и пре-генерация PDF в CI (scripts/genpdf).
// Рендер обложки в одностраничный PDF (без колонтитулов, на всю страницу).
async function renderCoverPdf(
  page: Awaited<ReturnType<Awaited<ReturnType<typeof puppeteer.launch>>["newPage"]>>,
  book: BookData,
  origin: string,
  volume?: string,
  range?: string,
): Promise<Uint8Array> {
  const imgUrl = origin + (book.covers[0] ?? "/og-default.png");
  await page.setContent(
    coverHtml({
      titleLine1: book.titleLine1, titleLine2: book.titleLine2, iast: book.iast,
      tagline: book.tagline, author: book.author, imgUrl, uniformTitle: book.uniformTitle,
      volume, range,
    }),
    { waitUntil: "load", timeout: 60000 },
  );
  // Дожидаемся загрузки иллюстрации (и шрифтов), но не дольше ~8с — обложка без
  // картинки всё равно валидна, поэтому по таймауту печатаем как есть.
  try {
    await Promise.race([
      page.evaluate(() => Promise.all([
        ...[...document.images].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; })),
        (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts?.ready ?? 0,
      ])),
      new Promise((r) => setTimeout(r, 8000)),
    ]);
  } catch { /* печатаем что есть */ }
  return await page.pdf({
    format: "A4",
    printBackground: true,
    timeout: 60000,
    displayHeaderFooter: false,
    margin: { top: "0", bottom: "0", left: "0", right: "0" },
  });
}

// ── Серверный рендер PDF через Cloudflare Browser Rendering ──
// Открываем печатный режим SPA (/?pdf=…) в headless Chrome и снимаем page.pdf
// с настоящими полями на каждой странице и колонтитулом с нумерацией. Для
// уровня книги/лилы спереди прикрепляется обложка BBT (см. renderCoverPdf).
async function handlePdf(env: Env, url: URL): Promise<Response> {
  const kind = url.searchParams.get("kind");
  const work = url.searchParams.get("work") || "bg";
  const lila = url.searchParams.get("lila") || "";
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  const div = url.searchParams.get("div") || "";
  const n = url.searchParams.get("n") || "";
  const ref = url.searchParams.get("ref") || "";
  const bare = url.searchParams.get("bare") === "1";
  // Том (название лилы/песни) и диапазон для обложки — присылает клиент, чтобы
  // воркер оставался книго-независимым (для ЧЧ есть запасной ccLilaName).
  const label = url.searchParams.get("label") || "";
  const rangeParam = url.searchParams.get("range") || "";
  const ccLilaName = (s: string) => s === "adi" ? "Ади-лила" : s === "madhya" ? "Мадхья-лила" : s === "antya" ? "Антья-лила" : s;
  // Книга для обложки/имени файла — единый источник BookData (по умолчанию БГ).
  const book: BookData = BOOKS[work] ?? BOOKS.bg;
  let printPath: string;
  let filename: string;
  // Параметры обложки (только для уровня книги/лилы); иначе обложка не нужна.
  let coverVolume: string | undefined;
  let coverRange: string | undefined;
  if (kind === "book") {
    // Книга целиком (БГ — стихи, прозовые книги — главы прозы): печатный режим
    // тянет содержимое по work.
    printPath = `/?pdf=book${work && work !== "bg" ? `&work=${encodeURIComponent(work)}` : ""}`;
    filename = `${bookFullTitle(book)}.pdf`;
  } else if (kind === "lila" && lila) {
    printPath = `/?pdf=lila&work=${encodeURIComponent(work)}&lila=${encodeURIComponent(lila)}${from ? `&from=${encodeURIComponent(from)}` : ""}${to ? `&to=${encodeURIComponent(to)}` : ""}${bare ? "&bare=1" : ""}`;
    coverVolume = label || ccLilaName(lila);
    coverRange = rangeParam || undefined;
    filename = `${bookFullTitle(book)}. ${coverVolume}.pdf`;
  } else if (kind === "cover" && lila) {
    // Только обложка — одна на лилу при клиентской склейке частей (pdf-lib).
    printPath = "";
    coverVolume = label || ccLilaName(lila);
    coverRange = rangeParam || undefined;
    filename = `${bookFullTitle(book)}. ${coverVolume}. Обложка.pdf`;
  } else if (kind === "lilamerged" && lila) {
    // Одна лила = ОДИН файл. Обложка + части (ranges) рендерятся в ОДНОЙ сессии
    // браузера (ОДИН запуск вместо десятков → не упираемся в rate-limit Cloudflare
    // «Unable to create new browser: 429») и склеиваются на сервере (pdf-lib).
    printPath = "";
    coverVolume = label || ccLilaName(lila);
    coverRange = rangeParam || undefined;
    filename = `${bookFullTitle(book)}. ${coverVolume}.pdf`;
  } else if (kind === "chapter" && div) {
    // ЧЧ/ШБ: глава по division id (<work>.<lila>.<n>)
    printPath = `/?pdf=chapter&work=${encodeURIComponent(work)}&div=${encodeURIComponent(div)}`;
    const parts = div.split(".");
    filename = `${bookFullTitle(book)}. ${ccLilaName(parts[1] ?? "")}. Глава ${parts[2] ?? ""}.pdf`;
  } else if (kind === "chapter" && n) {
    printPath = `/?pdf=chapter&work=${encodeURIComponent(work)}&n=${encodeURIComponent(n)}`;
    filename = `${bookFullTitle(book)}. Глава ${n}.pdf`;
  } else if (kind === "card") {
    // Печатная карточка: место/ресторан/личность/документ/бхаджан/киртан.
    const ctype = url.searchParams.get("type") || "";
    const cid = url.searchParams.get("id") || "";
    const cname = url.searchParams.get("name") || "Карточка";
    if (!ctype || !cid) return new Response("bad request", { status: 400, headers: { "X-Robots-Tag": NOINDEX } });
    const extra = ["album", "track"].map((k) => { const v = url.searchParams.get(k); return v ? `&${k}=${encodeURIComponent(v)}` : ""; }).join("");
    printPath = `/?pdf=card&type=${encodeURIComponent(ctype)}&id=${encodeURIComponent(cid)}${extra}`;
    filename = `${cname}.pdf`;
  } else if (kind === "verse" && ref) {
    printPath = `/?pdf=verse&work=${encodeURIComponent(work)}&ref=${encodeURIComponent(ref)}`;
    const rd = ref.replace(/^[^\d]*/, "");
    const vch = rd.split(".")[0];
    const vseg = rd.includes(".") ? rd.slice(rd.indexOf(".") + 1) : "";
    filename = `${bookFullTitle(book)}. Глава ${vch}${vseg ? `. Стих ${vseg}` : ""}.pdf`;
  } else {
    return new Response("bad request", { status: 400, headers: { "X-Robots-Tag": NOINDEX } });
  }
  const target = url.origin + printPath;
  const coverOnly = kind === "cover";
  const wantCover = kind === "book" || (kind === "lila" && !bare) || coverOnly || kind === "lilamerged";

  // ── Кэш на «крае» Cloudflare ───────────────────────────────────────────────
  // Тяжёлые сборки (целая книга / лила) рендерятся ОДИН раз, дальше отдаются из
  // кэша любому числу пользователей мгновенно — без запуска браузера. Это и есть
  // масштабируемость: рендерер трогается один раз на книгу/лилу, а не на каждое
  // скачивание. ?fresh=1 — принудительно пересобрать (после правок контента).
  const cacheable = kind === "lilamerged" || kind === "book";
  // PDF_CACHE_REV (см. src/pdfRev.ts) — версия edge-ключа. Бамп орфанит ВСЕ ранее
  // закэшированные book/lila-PDF (они immutable на год), заставляя пересобрать с
  // актуальной обложкой/контентом. Тот же ключ клиент шлёт как ?v=, пробивая и кэш браузера.
  const cacheKey = cacheable
    ? new Request(`https://pdfcache.internal/${PDF_CACHE_REV}/${encodeURIComponent(work)}/${kind === "book" ? "book" : "lila-" + encodeURIComponent(lila)}`)
    : null;
  const fresh = url.searchParams.get("fresh") === "1";
  const edge = (caches as unknown as { default: Cache }).default;
  if (cacheKey && !fresh) {
    try { const hit = await edge.match(cacheKey); if (hit) return hit; } catch { /* промах — рендерим */ }
  }
  const cacheCtl = cacheable ? "public, max-age=31536000, immutable" : "no-store";

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  try {
    browser = await puppeteer.launch(env.BROWSER);
    const page = await browser.newPage();
    // page.pdf() по умолчанию ограничен 30с (через CDP Page.printToPDF). Большие
    // лилы ЧЧ — сотни страниц, сериализация > 30с → page.pdf падал и возвращался
    // 500 → клиент уходил в печать. Поднимаем дефолтный таймаут страницы.
    page.setDefaultTimeout(280000);
    // Обложку рендерим ПЕРВОЙ (setContent), пока страница не ушла на тело.
    let coverBytes: Uint8Array | undefined;
    if (wantCover) {
      try { coverBytes = await renderCoverPdf(page, book, url.origin, coverVolume, coverRange); }
      catch { coverBytes = undefined; /* обложка не критична — лучше без неё, чем 500 */ }
    }
    if (coverOnly) {
      if (!coverBytes) return new Response("cover render failed", { status: 500, headers: { "X-Robots-Tag": NOINDEX } });
      return new Response(coverBytes, { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(filename)}`, "X-Robots-Tag": NOINDEX, "Cache-Control": "no-store" } });
    }
    if (kind === "lilamerged") {
      // Рендерим части лилы по очереди в ОДНОЙ вкладке (page.goto — без новых
      // запусков браузера) и склеиваем: обложка + части → один PDF на лилу.
      const ranges = (url.searchParams.get("ranges") || "").split(",").map((s) => s.trim()).filter(Boolean);
      const escH = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const headerText = `${bookFullTitle(book)}${coverVolume ? ` · ${coverVolume}` : ""}`;
      const headerT = `<div style="width:100%;padding:0 16mm;text-align:center;-webkit-print-color-adjust:exact;print-color-adjust:exact;"><div style="font-family:Georgia,'Times New Roman',serif;font-size:8px;letter-spacing:1.5px;line-height:1.3;text-transform:uppercase;color:#9a9a9e;">${escH(headerText)}</div></div>`;
      const footerT = `<div style="width:100%;padding:0 18mm;font-family:Georgia,'Times New Roman',serif;text-align:center;line-height:1.45;color:#8a8a8e;-webkit-print-color-adjust:exact;print-color-adjust:exact;"><div style="font-size:8.5px;letter-spacing:2px;">ISKCON ONE LOVE</div><div style="font-size:8px;letter-spacing:1px;color:#a7a8b0;">iskcone.com</div></div>`;
      await page.setViewport({ width: 820, height: 1160, deviceScaleFactor: 1 });
      const merged = await PDFDocument.create();
      if (coverBytes) {
        try { const c = await PDFDocument.load(coverBytes); for (const p of await merged.copyPages(c, c.getPageIndices())) merged.addPage(p); }
        catch { /* обложка не критична */ }
      }
      for (const rg of ranges) {
        const [f, t] = rg.split("-");
        const sub = `${url.origin}/?pdf=lila&work=${encodeURIComponent(work)}&lila=${encodeURIComponent(lila)}&from=${encodeURIComponent(f)}&to=${encodeURIComponent(t || f)}&bare=1`;
        await page.goto(sub, { waitUntil: "domcontentloaded", timeout: 60000 });
        try { await page.waitForFunction("window.__pdfReady === true", { timeout: 150000 }); } catch { /* печатаем что отрисовалось */ }
        const partPdf = await page.pdf({ format: "A4", printBackground: true, timeout: 220000, displayHeaderFooter: true, headerTemplate: headerT, footerTemplate: footerT, margin: { top: "20mm", bottom: "22mm", left: "18mm", right: "18mm" } });
        const pd = await PDFDocument.load(partPdf as unknown as Uint8Array);
        for (const p of await merged.copyPages(pd, pd.getPageIndices())) merged.addPage(p);
      }
      if (merged.getPageCount() === 0) return new Response("pdf render failed: empty", { status: 500, headers: { "X-Robots-Tag": NOINDEX } });
      const out = await merged.save();
      const resp = new Response(out, { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(filename)}`, "X-Robots-Tag": NOINDEX, "Cache-Control": cacheCtl } });
      if (cacheKey) { try { await edge.put(cacheKey, resp.clone()); } catch { /* кэш не критичен */ } }
      return resp;
    }
    await page.setViewport({ width: 820, height: 1160, deviceScaleFactor: (kind === "book" || kind === "lila") ? 1 : 2 });
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 60000 });
    try {
      // Книга/лила тяжёлые (вся «Гита» ≈ 1100 стр.; лилы ЧЧ — сотни страниц) —
      // даём дорисоваться; по таймауту печатаем что успело отрисоваться.
      await page.waitForFunction("window.__pdfReady === true", { timeout: kind === "book" ? 110000 : kind === "lila" ? 180000 : 45000 });
    } catch {
      /* отрисовка затянулась — печатаем что отрисовалось */
    }
    // Текст верхнего колонтитула задаёт сама страница (window.__pdfHeader):
    //   книга → «Бхагавад-гита как она есть»
    //   глава → «… · {название главы}»
    //   стих  → «… · {глава} · Текст N»
    let headerText = "Бхагавад-гита как она есть";
    try {
      const h = await page.evaluate(() => (window as unknown as { __pdfHeader?: string }).__pdfHeader);
      if (h && typeof h === "string") headerText = h;
    } catch { /* ignore */ }
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    // Нижний колонтитул: номер страницы сверху, затем бренд (ISKCON ONE LOVE / iskcone.com).
    const footer =
      `<div style="width:100%;padding:0 18mm;font-family:Georgia,'Times New Roman',serif;text-align:center;line-height:1.45;color:#8a8a8e;-webkit-print-color-adjust:exact;print-color-adjust:exact;">` +
      (bare ? "" : `<div style="font-size:8px;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>`) +
      `<div style="font-size:8.5px;letter-spacing:2px;margin-top:2.5px;">ISKCON ONE LOVE</div>` +
      `<div style="font-size:8px;letter-spacing:1px;color:#a7a8b0;">iskcone.com</div></div>`;
    // Верхний колонтитул — на каждой странице. Структура как у футера, чтобы Chrome его рисовал.
    const header =
      `<div style="width:100%;padding:0 16mm;text-align:center;-webkit-print-color-adjust:exact;print-color-adjust:exact;">` +
      `<div style="font-family:Georgia,'Times New Roman',serif;font-size:8px;letter-spacing:1.5px;line-height:1.3;text-transform:uppercase;color:#9a9a9e;">${esc(headerText)}</div></div>`;
    const bodyPdf = await page.pdf({
      format: "A4",
      printBackground: true,
      timeout: 270000,
      displayHeaderFooter: true,
      headerTemplate: header,
      footerTemplate: footer,
      margin: { top: "20mm", bottom: "22mm", left: "18mm", right: "18mm" },
    });
    // Прикрепляем обложку спереди (pdf-lib): обложка + тело → один документ.
    let out: Uint8Array = bodyPdf as unknown as Uint8Array;
    if (coverBytes) {
      try {
        const merged = await PDFDocument.create();
        const cover = await PDFDocument.load(coverBytes);
        const body = await PDFDocument.load(bodyPdf as unknown as Uint8Array);
        for (const p of await merged.copyPages(cover, cover.getPageIndices())) merged.addPage(p);
        for (const p of await merged.copyPages(body, body.getPageIndices())) merged.addPage(p);
        out = await merged.save();
      } catch { out = bodyPdf as unknown as Uint8Array; /* при сбое склейки отдаём тело */ }
    }
    const resp = new Response(out, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "X-Robots-Tag": NOINDEX,
        "Cache-Control": cacheCtl,
      },
    });
    if (cacheKey) { try { await edge.put(cacheKey, resp.clone()); } catch { /* кэш не критичен */ } }
    return resp;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response("pdf render failed: " + msg, { status: 500, headers: { "X-Robots-Tag": NOINDEX } });
  } finally {
    if (browser) { try { await browser.close(); } catch { /* ignore */ } }
  }
}

// ── Open-Graph / share preview metadata (read by social crawlers despite noindex) ──
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

interface OG { title: string; description: string; image: string; url: string; }

/** Derive share metadata from the route. Books come straight from books.ts (single source);
 *  every other page falls back to the graphite ISKCON lockup on white. */
function ogFor(url: URL): OG {
  const origin = url.origin;
  const pageUrl = origin + url.pathname;
  const m = url.pathname.match(/^\/book\/([^/]+)(?:\/.*)?$/);
  if (m) {
    const b = BOOKS[m[1]];
    if (b) return { title: bookShareTitle(b), description: b.description, image: origin + bookShareImage(b), url: pageUrl };
  }
  return {
    title: "ISKCON ONE LOVE. ИСККОН.",
    description: "Священные тексты в сознании Кришны: читайте, слушайте и делитесь.",
    image: origin + "/og-default.png",
    url: pageUrl,
  };
}

function ogTagsHtml(o: OG): string {
  return [
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="ISKCON ONE LOVE">`,
    `<meta property="og:locale" content="ru_RU">`,
    `<meta property="og:title" content="${esc(o.title)}">`,
    `<meta property="og:description" content="${esc(o.description)}">`,
    `<meta property="og:url" content="${esc(o.url)}">`,
    `<meta property="og:image" content="${esc(o.image)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(o.title)}">`,
    `<meta name="twitter:description" content="${esc(o.description)}">`,
    `<meta name="twitter:image" content="${esc(o.image)}">`,
  ].join("");
}

class HeadInjector {
  constructor(private readonly html: string) {}
  element(el: Element) { el.append(this.html, { html: true }); }
}
class TitleRewriter {
  constructor(private readonly title: string) {}
  element(el: Element) { el.setInnerContent(this.title); }
}

// ── Audio: stream Bhagavad-gita recordings from Internet Archive through our origin ──
// Two IA items hold the audio: iskcone-bg (verse-by-verse) and iskcone-bg-comments
// (with commentary; also carries the 4 intro tracks 00.0X.*). We proxy the bytes so the
// app stays same-origin (no CORS), Cloudflare edge-caches them, and the IA identifiers
// stay out of the client. The playlist manifest is built live from each item's IA
// metadata, so new uploads appear automatically without code changes.
const AUDIO_ITEMS = { plain: "iskcone-bg", commentary: "iskcone-bg-comments" } as const;

// Readable Russian titles for the commentary-only intro tracks (no chapter number).
const BG_INTRO_TITLES: Record<string, string> = {
  "00.01.Predystoriya": "Предыстория",
  "00.02.Predislovie": "Предисловие",
  "00.03.Vvedenie": "Введение",
  "00.04.Molitvy.mangalacharana": "Мангала-ачарана",
};

interface IaFile { name: string; source?: string; format?: string; length?: string; }
interface AudioTrack {
  kind: "intro" | "chapter" | "song";
  pos: number;            // 0-based position within this mode's playlist
  chapter: number | null; // chapter number, or null for intros/songs
  title: string;
  file: string;
  url: string;            // same-origin proxy URL
  durationSec: number | null;
  lila?: string;          // CC only: adi|madhya|antya
  lilaLabel?: string;     // CC only: «Ади-лила»
  part?: number | null;   // CC only: part index when a chapter is split (else null)
  artist?: string;        // kirtan only: исполнитель (отображаемое имя)
  album?: string;         // kirtan only: название альбома
}

function audioDuration(len?: string): number | null {
  if (!len) return null;
  if (len.includes(":")) {
    const parts = len.split(":").map(Number);
    return parts.some((x) => Number.isNaN(x)) ? null : parts.reduce((a, b) => a * 60 + b, 0);
  }
  const n = Number(len);
  return Number.isNaN(n) ? null : Math.round(n);
}

async function audioTracks(identifier: string, origin: string, titles: Map<number, string>): Promise<AudioTrack[]> {
  const meta = await fetch(`https://archive.org/metadata/${identifier}`, {
    headers: { accept: "application/json" },
    cf: { cacheEverything: true, cacheTtl: 300 },
  });
  if (!meta.ok) return [];
  const data = (await meta.json()) as { files?: IaFile[] };
  const originals = (data.files || []).filter((f) => f.source === "original" && /\.mp3$/i.test(f.name));
  const intros: AudioTrack[] = [];
  const chapters: AudioTrack[] = [];
  for (const f of originals) {
    const stem = f.name.replace(/\.mp3$/i, "");
    const url = `${origin}/audio/${identifier}/${f.name}`;
    const durationSec = audioDuration(f.length);
    const introM = stem.match(/^00\.(\d+)\./);
    if (introM) {
      intros.push({
        kind: "intro",
        pos: parseInt(introM[1], 10),
        chapter: null,
        title: BG_INTRO_TITLES[stem] || stem.replace(/^[\d.]+/, "").replace(/[._-]+/g, " ").trim() || stem,
        file: f.name,
        url,
        durationSec,
      });
    } else {
      const chM = stem.match(/^(\d{1,2})\./);
      const chapter = chM ? parseInt(chM[1], 10) : 0;
      chapters.push({
        kind: "chapter",
        pos: chapter,
        chapter,
        title: titles.get(chapter) || `Глава ${chapter}`,
        file: f.name,
        url,
        durationSec,
      });
    }
  }
  intros.sort((a, b) => a.pos - b.pos);
  chapters.sort((a, b) => (a.chapter || 0) - (b.chapter || 0));
  const ordered = [...intros, ...chapters];
  ordered.forEach((t, i) => (t.pos = i));
  return ordered;
}

async function audioManifest(env: Env, origin: string): Promise<Response> {
  // Chapter titles come straight from D1 (single source of truth for the book structure).
  const { results } = await env.DB.prepare(
    `SELECT CAST(number AS INTEGER) AS n, json_extract(title,'$.ru') AS title_ru
     FROM divisions WHERE work_id='bg' ORDER BY n`
  ).all<{ n: number; title_ru: string }>();
  const titles = new Map<number, string>();
  for (const r of results) titles.set(r.n, r.title_ru);
  const [plain, commentary] = await Promise.all([
    audioTracks(AUDIO_ITEMS.plain, origin, titles),
    audioTracks(AUDIO_ITEMS.commentary, origin, titles),
  ]);
  return json({
    book: "bg",
    modes: {
      plain: { identifier: AUDIO_ITEMS.plain, tracks: plain },
      commentary: { identifier: AUDIO_ITEMS.commentary, tracks: commentary },
    },
  });
}

// ── Чайтанья-чаритамрита: три IA-элемента по лилам (без комментариев пока) ──
// Файлы: «NN.CC.<Lila>-lila.mp3» (глава) или «NN.PP.CC.<Lila>-lila.mp3» (часть главы).
const CC_AUDIO_LILAS: { lila: string; label: string; identifier: string }[] = [
  { lila: "adi", label: "Ади-лила", identifier: "iskcone-cc-adi" },
  { lila: "madhya", label: "Мадхья-лила", identifier: "iskcone-cc-madhya" },
  { lila: "antya", label: "Антья-лила", identifier: "iskcone-cc-antya" },
];

async function ccLilaTracks(
  identifier: string, origin: string, lila: string, lilaLabel: string, titles: Map<number, string>,
): Promise<AudioTrack[]> {
  const meta = await fetch(`https://archive.org/metadata/${identifier}`, {
    headers: { accept: "application/json" },
    cf: { cacheEverything: true, cacheTtl: 300 },
  });
  if (!meta.ok) return [];
  const data = (await meta.json()) as { files?: IaFile[] };
  const originals = (data.files || []).filter((f) => f.source === "original" && /\.mp3$/i.test(f.name));
  const rows: { chapter: number; part: number; t: AudioTrack }[] = [];
  for (const f of originals) {
    const stem = f.name.replace(/\.mp3$/i, "");
    const m = stem.match(/^(\d{1,3})(?:\.(\d{1,3}))?\.CC\./i); // NN[.PP].CC.<Lila>-lila
    if (!m) continue;
    const chapter = parseInt(m[1], 10);
    const part = m[2] ? parseInt(m[2], 10) : null;
    const base = titles.get(chapter) || `Глава ${chapter}`;
    rows.push({
      chapter, part: part ?? 0,
      t: {
        kind: "chapter", pos: 0, chapter,
        title: part ? `${base} — часть ${part}` : base,
        file: f.name, url: `${origin}/audio/${identifier}/${f.name}`,
        durationSec: audioDuration(f.length), lila, lilaLabel, part,
      },
    });
  }
  rows.sort((a, b) => (a.chapter - b.chapter) || (a.part - b.part));
  return rows.map((r) => r.t);
}

async function ccAudioManifest(env: Env, origin: string): Promise<Response> {
  // Заголовки глав — из D1 (divisions id = cc.<lila>.<n>), единый источник структуры.
  const { results } = await env.DB.prepare(
    `SELECT id, CAST(number AS INTEGER) AS n, json_extract(title,'$.ru') AS title_ru
     FROM divisions WHERE work_id='cc' AND level='chapter'`
  ).all<{ id: string; n: number; title_ru: string }>();
  const byLila = new Map<string, Map<number, string>>();
  for (const r of results) {
    const lila = String(r.id).split(".")[1]; // cc.<lila>.<n>
    if (!byLila.has(lila)) byLila.set(lila, new Map());
    byLila.get(lila)!.set(r.n, r.title_ru);
  }
  const lilas: { lila: string; label: string; identifier: string; tracks: AudioTrack[] }[] = [];
  let flat: AudioTrack[] = [];
  for (const L of CC_AUDIO_LILAS) {
    const tracks = await ccLilaTracks(L.identifier, origin, L.lila, L.label, byLila.get(L.lila) || new Map());
    lilas.push({ lila: L.lila, label: L.label, identifier: L.identifier, tracks });
    flat = flat.concat(tracks);
  }
  flat.forEach((t, i) => (t.pos = i));
  // Та же форма, что у БГ (modes.plain.tracks) + группировка по лилам для UI. Комментариев пока нет.
  return json({ book: "cc", lilas, modes: { plain: { identifier: CC_AUDIO_LILAS[0].identifier, tracks: flat } } });
}

// ── Киртаны и бхаджаны: альбом = IA-элемент; трек-лист строится live из метаданных ──
// Файлы IA-альбомов идут с числовым префиксом дорожки («1896 Amara Jivana.mp3»,
// «10 Jaya_Radha_Madhava.mp3»). Префикс — только для сортировки; в названии он
// убирается, подчёркивания → пробелы. Имена с пробелами корректно резолвит
// serveAudio (decode→encode). Каталог (исполнители/альбомы) — единый источник в
// src/kirtans.ts, общий с фронтом.
function cleanKirtanTitle(stem: string): { sort: number; title: string } {
  const m = stem.match(/^(\d{1,4})\b[.\-_ ]*(.*)$/);
  const sort = m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
  let title = (m ? m[2] : stem).replace(/_/g, " ").replace(/\s+/g, " ").trim();
  if (!title) title = stem;
  return { sort, title };
}

async function kirtanTracks(identifier: string, origin: string, artist: string, album: string): Promise<AudioTrack[]> {
  const meta = await fetch(`https://archive.org/metadata/${identifier}`, {
    headers: { accept: "application/json" },
    cf: { cacheEverything: true, cacheTtl: 300 },
  });
  if (!meta.ok) return [];
  const data = (await meta.json()) as { files?: IaFile[] };
  const originals = (data.files || []).filter((f) => f.source === "original" && /\.mp3$/i.test(f.name));
  const rows = originals.map((f) => {
    const stem = f.name.replace(/\.mp3$/i, "");
    const { sort, title } = cleanKirtanTitle(stem);
    return {
      sort, name: f.name,
      t: {
        kind: "song" as const, pos: 0, chapter: null,
        title, file: f.name, url: `${origin}/audio/${identifier}/${f.name}`,
        durationSec: audioDuration(f.length), artist, album,
      } as AudioTrack,
    };
  });
  rows.sort((a, b) => (a.sort - b.sort) || a.name.localeCompare(b.name));
  const tracks = rows.map((r) => r.t);
  tracks.forEach((t, i) => (t.pos = i));
  return tracks;
}

async function kirtanManifest(origin: string, albumId: string): Promise<Response> {
  const album = kirtanAlbumById(albumId);
  if (!album || !album.archive) {
    return json({ book: albumId, kind: "kirtan", modes: { plain: { identifier: "", tracks: [] } } });
  }
  const artist = kirtanArtistBySlug(album.artist)?.name ?? "";
  const tracks = await kirtanTracks(album.archive, origin, artist, album.title);
  return json({ book: albumId, kind: "kirtan", modes: { plain: { identifier: album.archive, tracks } } });
}

// Stream one file from IA, forwarding Range (for seeking) and stamping an immutable cache.
async function serveAudio(request: Request, identifier: string, filename: string): Promise<Response> {
  // Имя из пути приходит percent-кодированным. encodeURI поверх него удваивал бы
  // кодировку (%20→%2520) и ломал файлы с пробелами (записи Прабхупады). Сначала
  // раскодируем, затем закодируем один раз — для имён без пробелов поведение прежнее.
  let name = filename;
  try { name = decodeURIComponent(filename); } catch { /* keep as-is */ }
  const iaUrl = `https://archive.org/download/${identifier}/${encodeURI(name)}`;
  const range = request.headers.get("Range");
  const upstream = await fetch(iaUrl, {
    method: "GET",
    headers: range ? { Range: range } : {},
    redirect: "follow",
    cf: { cacheEverything: true, cacheTtl: 31536000 },
  });
  const h = new Headers(upstream.headers);
  h.set("Accept-Ranges", "bytes");
  h.set("Cache-Control", "public, max-age=31536000, immutable");
  h.set("X-Robots-Tag", NOINDEX);
  h.delete("set-cookie");
  const ct = h.get("Content-Type");
  if (!ct || ct === "application/octet-stream") h.set("Content-Type", "audio/mpeg");
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: h });
}

function jsonResp(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": NOINDEX } });
}
function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

/** Bug report: persist to D1 (never lost) and email support@billionsx.com if Resend is configured. */
async function handleReport(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return jsonResp({ error: "method" }, 405);
  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return jsonResp({ error: "bad json" }, 400); }
  const clip = (v: unknown, n: number) => String(v ?? "").slice(0, n);
  const message = clip(body.message, 4000).trim();
  if (!message) return jsonResp({ error: "empty" }, 400);
  const rec = {
    category: clip(body.category, 40),
    categoryLabel: clip(body.categoryLabel, 80) || clip(body.category, 80) || "Другое",
    message,
    email: clip(body.email, 200) || null,
    context: clip(body.context, 300),
    url: clip(body.url, 600),
    ua: clip(body.ua, 600),
    viewport: clip(body.viewport, 40),
    lang: clip(body.lang, 40),
  };
  const cf = (request as unknown as { cf?: Record<string, unknown> }).cf || {};
  const country = clip(cf.country, 8);

  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        category TEXT, category_label TEXT, message TEXT NOT NULL,
        email TEXT, context TEXT, url TEXT, user_agent TEXT, viewport TEXT, lang TEXT, country TEXT
      )`
    ).run();
    await env.DB.prepare(
      `INSERT INTO reports (category, category_label, message, email, context, url, user_agent, viewport, lang, country)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    ).bind(rec.category, rec.categoryLabel, rec.message, rec.email, rec.context, rec.url, rec.ua, rec.viewport, rec.lang, country).run();
  } catch {
    return jsonResp({ ok: false, emailed: false, error: "store" }, 500);
  }

  // ── Compose the report email once (shared by Cloudflare Email Routing + Resend) ──
  const subject = `ISKCON ONE LOVE — отчёт: ${rec.categoryLabel}`;
  const meta: Array<[string, string]> = [
    ["Категория", rec.categoryLabel],
    ...(rec.context ? [["Раздел", rec.context] as [string, string]] : []),
    ...(rec.email ? [["Email для ответа", rec.email] as [string, string]] : []),
    ["Страница", rec.url],
    ["Устройство", rec.ua],
    ["Экран", `${rec.viewport} · ${rec.lang} · ${country}`],
  ];
  const text = [rec.message, "", "————", ...meta.map(([k, v]) => `${k}: ${v}`)].join("\n");
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;color:#1f2024;line-height:1.55">`
    + `<p style="white-space:pre-wrap;margin:0 0 16px">${escapeHtml(rec.message)}</p>`
    + `<hr style="border:none;border-top:1px solid #ececec;margin:16px 0">`
    + `<table style="font-size:13px;color:#70727b;border-collapse:collapse">`
    + meta.map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;vertical-align:top;color:#a7a8b0">${escapeHtml(k)}</td><td style="padding:2px 0;word-break:break-all">${escapeHtml(v)}</td></tr>`).join("")
    + `</table></div>`;

  let emailed = false;
  let sebErr = "";

  // 1) Cloudflare Email Routing — нативно, без сторонних сервисов (основной путь).
  const fromAddr = env.REPORT_FROM_ADDR || "noreply@gaurangers.com";
  if (env.SEB) {
    try {
      const mm = createMimeMessage();
      mm.setSender({ name: "ISKCON ONE LOVE", addr: fromAddr });
      mm.setRecipient("support@billionsx.com");
      mm.setSubject(subject);
      mm.addMessage({ contentType: "text/plain", data: text });
      await env.SEB.send(new EmailMessage(fromAddr, "support@billionsx.com", mm.asRaw()));
      emailed = true;
    } catch (e) { sebErr = String((e as Error)?.message || e).slice(0, 300); }
  } else {
    sebErr = "no SEB binding";
  }

  // 2) Резерв — Resend (если задан ключ и нативная отправка не сработала).
  let resendErr = "";
  if (!emailed && env.RESEND_API_KEY) {
    try {
      const from = env.REPORT_FROM || "ISKCON ONE LOVE <noreply@gaurangers.com>";
      const payload: Record<string, unknown> = { from, to: ["support@billionsx.com"], subject, text, html };
      if (rec.email) payload.reply_to = rec.email;
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      emailed = r.ok;
      if (!r.ok) resendErr = "resend http " + r.status;
    } catch (e) { resendErr = String((e as Error)?.message || e).slice(0, 200); }
  }

  // 3) Telegram — мгновенно, без DNS и без привязки к домену.
  let telegrammed = false;
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    try {
      const tg = [
        `🔔 ISKCON ONE LOVE — отчёт: ${rec.categoryLabel}`,
        "",
        rec.message,
        "",
        ...meta.filter(([k]) => k !== "Категория").map(([k, v]) => `${k}: ${v}`),
      ].join("\n");
      const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: tg.slice(0, 3900), disable_web_page_preview: true }),
      });
      telegrammed = r.ok;
    } catch { telegrammed = false; }
  }

  const delivered = emailed || telegrammed;
  return jsonResp({ ok: true, emailed, delivered, dbg: { seb: !!env.SEB, sebErr, resendErr } });
}

/** Заказ магазина: сохраняем в D1 (никогда не теряем) и шлём письмо на support@billionsx.com. */
async function handleOrder(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return jsonResp({ error: "method" }, 405);
  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return jsonResp({ error: "bad json" }, 400); }
  const clip = (v: unknown, n: number) => String(v ?? "").slice(0, n);
  const num = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));
  const orderNo = clip(body.orderNo, 40) || ("IOL-" + Date.now().toString(36).toUpperCase());
  type OI = { title: string; kind: string; qty: number; sum: number };
  const items: OI[] = (Array.isArray(body.items) ? body.items : []).slice(0, 60).map((it) => {
    const o = (it || {}) as Record<string, unknown>;
    return { title: clip(o.title, 160), kind: clip(o.kind, 20), qty: Math.max(1, Math.min(99, Math.round(Number(o.qty) || 1))), sum: num(o.sum) };
  }).filter((it) => it.title);
  if (!items.length) return jsonResp({ error: "empty" }, 400);
  const total = num(body.total), goods = num(body.goods), shipping = num(body.shipping);
  const method = clip(body.method, 60) || "—";
  const c = (body.contact || {}) as Record<string, unknown>;
  const contact = {
    name: clip(c.name, 120), phone: clip(c.phone, 60), email: clip(c.email, 200),
    method: clip(c.method, 20), country: clip(c.country, 80), city: clip(c.city, 120),
    street: clip(c.street, 240), zip: clip(c.zip, 20), note: clip(c.note, 300),
  };
  const cf = (request as unknown as { cf?: Record<string, unknown> }).cf || {};
  const country = clip(cf.country, 8);

  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        order_no TEXT, total INTEGER, goods INTEGER, shipping INTEGER, method TEXT,
        items TEXT, contact TEXT, url TEXT, user_agent TEXT, lang TEXT, country TEXT,
        status TEXT NOT NULL DEFAULT 'pending', paid_at TEXT, pay_ref TEXT
      )`
    ).run();
    // Идемпотентная миграция для уже существующей таблицы (ALTER падает, если колонка есть).
    for (const ddl of [
      "ALTER TABLE orders ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'",
      "ALTER TABLE orders ADD COLUMN paid_at TEXT",
      "ALTER TABLE orders ADD COLUMN pay_ref TEXT",
    ]) { try { await env.DB.prepare(ddl).run(); } catch { /* колонка уже есть */ } }
    await env.DB.prepare(
      `INSERT INTO orders (order_no, total, goods, shipping, method, items, contact, url, user_agent, lang, country, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,'pending')`
    ).bind(orderNo, total, goods, shipping, method, JSON.stringify(items), JSON.stringify(contact), clip(body.url, 600), clip(body.ua, 600), clip(body.lang, 40), country).run();
  } catch { /* не валим заказ из-за БД — продолжаем письмо */ }

  const fmt = (n: number) => n.toLocaleString("ru-RU") + " \u20bd";
  const ship = contact.method === "pickup" ? "Самовывоз" : ([contact.country, contact.city, contact.street, contact.zip].filter(Boolean).join(", ") || "—");
  const subject = `ISKCON ONE LOVE — заказ ${orderNo} · ${fmt(total)}`;
  const confirmUrl = env.ADMIN_TOKEN ? `https://gaurangers.com/api/order/confirm?no=${encodeURIComponent(orderNo)}&token=${encodeURIComponent(env.ADMIN_TOKEN)}` : "";
  const lns = items.map((it) => `• ${it.title}${it.kind === "physical" && it.qty > 1 ? ` ×${it.qty}` : ""} — ${fmt(it.sum)}`);
  const meta: Array<[string, string]> = [
    ["Сумма", fmt(total)], ["Товары", fmt(goods)], ...(shipping ? [["Доставка", fmt(shipping)] as [string, string]] : []),
    ["Оплата", method],
    ["Имя", contact.name || "—"], ["Телефон", contact.phone || "—"], ...(contact.email ? [["Email", contact.email] as [string, string]] : []),
    ["Получение", contact.method === "pickup" ? "Самовывоз" : "Доставка"], ["Адрес", ship],
    ...(contact.note ? [["Комментарий", contact.note] as [string, string]] : []),
    ["Страна (IP)", country],
  ];
  const text = [`Заказ ${orderNo}`, "", ...lns, "", "————", ...meta.map(([k, v]) => `${k}: ${v}`), ...(confirmUrl ? ["", `Подтвердить оплату: ${confirmUrl}`] : [])].join("\n");
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;color:#1f2024;line-height:1.55">`
    + `<h2 style="margin:0 0 4px;font-size:18px">Заказ ${escapeHtml(orderNo)}</h2>`
    + `<div style="font-size:20px;font-weight:800;margin:0 0 14px">${escapeHtml(fmt(total))}</div>`
    + `<table style="font-size:14px;border-collapse:collapse;margin:0 0 14px">`
    + items.map((it) => `<tr><td style="padding:3px 14px 3px 0">${escapeHtml(it.title)}${it.kind === "physical" && it.qty > 1 ? ` ×${it.qty}` : ""}</td><td style="padding:3px 0;font-weight:600;text-align:right">${escapeHtml(fmt(it.sum))}</td></tr>`).join("")
    + `</table><hr style="border:none;border-top:1px solid #ececec;margin:14px 0">`
    + `<table style="font-size:13px;color:#70727b;border-collapse:collapse">`
    + meta.map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;vertical-align:top;color:#a7a8b0">${escapeHtml(k)}</td><td style="padding:2px 0;word-break:break-word">${escapeHtml(v)}</td></tr>`).join("")
    + `</table>`
    + (confirmUrl ? `<div style="margin-top:18px"><a href="${confirmUrl}" style="display:inline-block;background:#34c759;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:11px 18px;border-radius:10px">Подтвердить оплату</a><div style="margin-top:6px;font-size:11px;color:#a7a8b0">Нажмите после поступления средств — клиент увидит «Оплачено».</div></div>` : "")
    + `</div>`;

  let emailed = false;
  const fromAddr = env.REPORT_FROM_ADDR || "noreply@gaurangers.com";
  if (env.SEB) {
    try {
      const mm = createMimeMessage();
      mm.setSender({ name: "ISKCON ONE LOVE", addr: fromAddr });
      mm.setRecipient("support@billionsx.com");
      mm.setSubject(subject);
      mm.addMessage({ contentType: "text/plain", data: text });
      await env.SEB.send(new EmailMessage(fromAddr, "support@billionsx.com", mm.asRaw()));
      emailed = true;
    } catch { /* fallthrough */ }
  }
  if (!emailed && env.RESEND_API_KEY) {
    try {
      const from = env.REPORT_FROM || "ISKCON ONE LOVE <noreply@gaurangers.com>";
      const payload: Record<string, unknown> = { from, to: ["support@billionsx.com"], subject, text, html };
      if (contact.email) payload.reply_to = contact.email;
      const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      emailed = r.ok;
    } catch { /* noop */ }
  }
  let telegrammed = false;
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    try {
      const tg = [`🛒 ISKCON ONE LOVE — заказ ${orderNo} · ${fmt(total)}`, "", ...lns, "", ...meta.filter(([k]) => k !== "Сумма").map(([k, v]) => `${k}: ${v}`)].join("\n");
      const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: tg.slice(0, 3900), disable_web_page_preview: true }) });
      telegrammed = r.ok;
    } catch { telegrammed = false; }
  }
  return jsonResp({ ok: true, orderNo, emailed, delivered: emailed || telegrammed });
}

/** Статус заказа по номеру (публичное чтение): { status, total, method, paidAt }. */
async function handleOrderStatus(orderNo: string, env: Env): Promise<Response> {
  if (!orderNo) return jsonResp({ error: "no_order" }, 400);
  try {
    const row = await env.DB.prepare("SELECT order_no, status, total, method, paid_at FROM orders WHERE order_no = ? LIMIT 1")
      .bind(orderNo).first<{ order_no: string; status: string; total: number; method: string; paid_at: string | null }>();
    if (!row) return jsonResp({ error: "not_found" }, 404);
    return jsonResp({ orderNo: row.order_no, status: row.status || "pending", total: row.total, method: row.method, paidAt: row.paid_at });
  } catch { return jsonResp({ error: "db" }, 500); }
}

/**
 * Подтверждение оплаты — РУЧНАЯ сверка (мост до автоматической). Защита: ADMIN_TOKEN
 * (заголовок X-Admin-Token или ?token= для ссылки из письма). GET/POST; номер из ?no=
 * или тела. Помечает заказ оплаченным и шлёт клиенту письмо «оплата подтверждена».
 */
async function handleOrderConfirm(request: Request, env: Env, url: URL): Promise<Response> {
  if (typeof env.ADMIN_TOKEN === "undefined") return jsonResp({ error: "admin_not_configured" }, 503);
  let bodyNo = "", bodyRef = "";
  if (request.method === "POST") {
    try { const b = (await request.json()) as Record<string, unknown>; bodyNo = String(b.orderNo ?? b.no ?? ""); bodyRef = String(b.ref ?? ""); } catch { /* пусто */ }
  }
  const token = request.headers.get("x-admin-token") ?? url.searchParams.get("token") ?? "";
  if (token !== env.ADMIN_TOKEN) return jsonResp({ error: "unauthorized" }, 401);
  const orderNo = (url.searchParams.get("no") || bodyNo || "").slice(0, 40);
  const ref = (url.searchParams.get("ref") || bodyRef || "").slice(0, 120);
  if (!orderNo) return jsonResp({ error: "no_order" }, 400);

  let row: { order_no: string; status: string; total: number; contact: string | null } | null = null;
  try {
    row = await env.DB.prepare("SELECT order_no, status, total, contact FROM orders WHERE order_no = ? LIMIT 1")
      .bind(orderNo).first();
    if (!row) return jsonResp({ error: "not_found" }, 404);
    if (row.status !== "paid") {
      await env.DB.prepare("UPDATE orders SET status='paid', paid_at=datetime('now'), pay_ref=? WHERE order_no = ?").bind(ref || null, orderNo).run();
    }
  } catch { return jsonResp({ error: "db" }, 500); }

  // письмо клиенту (если оставил email) — best-effort
  let custEmail = "", custName = "";
  try { const c = JSON.parse(row.contact || "{}") as { email?: string; name?: string }; custEmail = String(c.email || "").trim(); custName = String(c.name || "").trim(); } catch { /* noop */ }
  if (custEmail) {
    const fmt = (n: number) => n.toLocaleString("ru-RU") + " \u20bd";
    const subj = `Оплата получена — заказ ${orderNo}`;
    const txt = `${custName ? custName + ", о" : "О"}плата по заказу ${orderNo} на сумму ${fmt(row.total)} получена. Спасибо! Мы приступаем к обработке.\n\nISKCON ONE LOVE · support@billionsx.com`;
    const fromAddr = env.REPORT_FROM_ADDR || "noreply@gaurangers.com";
    let sent = false;
    if (env.SEB) {
      try {
        const mm = createMimeMessage();
        mm.setSender({ name: "ISKCON ONE LOVE", addr: fromAddr });
        mm.setRecipient(custEmail);
        mm.setSubject(subj);
        mm.addMessage({ contentType: "text/plain", data: txt });
        await env.SEB.send(new EmailMessage(fromAddr, custEmail, mm.asRaw()));
        sent = true;
      } catch { /* fallthrough */ }
    }
    if (!sent && env.RESEND_API_KEY) {
      try {
        await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: env.REPORT_FROM || "ISKCON ONE LOVE <noreply@gaurangers.com>", to: [custEmail], subject: subj, text: txt }) });
      } catch { /* noop */ }
    }
  }

  // если открыли ссылку из письма в браузере — показываем человекочитаемую страницу
  const wantsHtml = (request.headers.get("accept") || "").includes("text/html");
  if (request.method === "GET" && wantsHtml) {
    return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Оплата подтверждена</title><div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:420px;margin:18vh auto;text-align:center;color:#1d1d1f"><div style="width:72px;height:72px;border-radius:50%;background:#34c759;margin:0 auto 18px;display:grid;place-items:center"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4.5 4.5L19 7"/></svg></div><h1 style="font-size:22px;margin:0 0 6px">Оплата подтверждена</h1><p style="color:#6e6e73;font-size:15px;margin:0">Заказ ${escapeHtml(orderNo)} помечен оплаченным. Клиент уведомлён.</p></div>`, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  }
  return jsonResp({ ok: true, orderNo, status: "paid" });
}

// Чистим оригинальный текст от затёкшей при ингесте подписи-ярлыка («Бенгальский»,
// «Деванагари» и т.п.): в письменностях (деванагари/бенгали) кириллицы быть не может,
// поэтому ведущий кириллический токен — всегда артефакт.
function stripScriptLabel(s: string | null | undefined): string | null {
  if (s == null) return null;
  return s.replace(/^[\u0400-\u04FF]+\s*/, "");
}

// Пословный перевод: у последнего слова в исходнике остаётся точка-конец строки;
// рендер добавляет свою точку → «океан..». Срезаем хвостовые точки у глоссы.
function cleanGloss(s: string | null | undefined): string | null {
  if (s == null) return null;
  return String(s).replace(/[\s.\u2026]+$/u, "");
}

// Комментарий/перевод: при ингесте местами потерян пробел после конца предложения
// («…Чайтаньи.Движение»). Возвращаем пробел, когда строчная буква + .!? + заглавная.
function fixSentenceSpacing(s: string | null | undefined): string | null {
  if (s == null) return null;
  return String(s).replace(/([а-яёa-z])([.!?])([А-ЯЁA-Z])/gu, "$1$2 $3");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // ── Audio proxy: /audio/<ia-identifier>/<file>.mp3 → streamed from Internet Archive ──
    const audioM = url.pathname.match(/^\/audio\/([a-z0-9][a-z0-9._-]*)\/(.+\.mp3)$/i);
    if (audioM) {
      return serveAudio(request, audioM[1], audioM[2]);
    }

    // ── Library API (served from D1; structure + deep-links only) ──
    // GET /api/books/bg/chapters → 18 chapters with verse counts + source_url
    if (url.pathname === "/api/books/bg/chapters") {
      const { results } = await env.DB.prepare(
        `SELECT d.id, d.number,
                json_extract(d.title,'$.ru') AS title_ru,
                json_extract(d.title,'$.en') AS title_en,
                d.source_url,
                COUNT(v.id) AS verses
         FROM divisions d
         LEFT JOIN verses v ON v.division_id = d.id
         WHERE d.work_id = 'bg'
         GROUP BY d.id
         ORDER BY CAST(d.number AS INTEGER)`
      ).all();
      return json({ work: "bg", chapters: results });
    }

    // GET /api/books/:work/audio → ordered audio playlist, built live from IA
    if (url.pathname === "/api/books/bg/audio") {
      return audioManifest(env, url.origin);
    }
    if (url.pathname === "/api/books/cc/audio") {
      return ccAudioManifest(env, url.origin);
    }

    // GET /api/kirtans/:albumId/audio → трек-лист альбома киртанов/бхаджанов (live из IA)
    const kirtanM = url.pathname.match(/^\/api\/kirtans\/([a-z0-9][a-z0-9._-]*)\/audio$/i);
    if (kirtanM) {
      return kirtanManifest(url.origin, kirtanM[1]);
    }

    // Центры (Ятра): публичный локатор/карточка + управление на той же
    // cookie-сессии (создание/правка/публикация). Матчим ДО кабинета: его guard
    // ловит весь префикс /api/me (включая /api/me/centers) и при отсутствии своего
    // маршрута вернул бы 404 раньше нас. centersApi отдаёт null на всё, кроме
    // /api/centers* и /api/me/centers — поэтому остальные /api/me/* и /api/auth/*
    // спокойно доходят до кабинета ниже. См. apps/web/src/centers/server.ts.
    const cenRes = await centersApi(request, env, url);
    if (cenRes) return cenRes;

    // ── Личный кабинет: регистрация/вход/сессия (cookie) + закладки, прогресс
    // чтения, история прослушивания. Та же база D1, тот же origin. Матчим ДО
    // общего /api-прокси, иначе cookie-маршруты ушли бы на api.gaurangers.com.
    const accRes = await accountApi(request, env, url);
    if (accRes) return accRes;

    // Главная: каталоги (центры/рестораны/документы из D1 с фолбэком на ассеты)
    // и лента Telegram с медиа — см. workerHome.ts
    const calRes = await calendarApi(request, url, env);
    if (calRes) return calRes;
    const homeRes = await homeApi(request, env);
    if (homeRes) return homeRes;
    // Даршан дня — публичный read (сегодня живьём из храмовых каналов + архив из D1).
    const darRes = await darshanApi(request, env, url);
    if (darRes) return darRes;
    // «Стих дня» — системное чтение БГ→ШБ→ЧЧ (единица до первого пурпорта).
    const readRes = await readingApi(request, env, url);
    if (readRes) return readRes;

    // GET /api/books/bg/chapters/:n/verses → verse refs + source_url for a chapter
    const m = url.pathname.match(/^\/api\/books\/bg\/chapters\/(\d+)\/verses$/);
    if (m) {
      const divId = `bg.${m[1]}`;
      const { results } = await env.DB.prepare(
        `SELECT ref, source_url, devanagari, translit
         FROM verses WHERE work_id='bg' AND division_id=?1
         ORDER BY ordinal`
      ).bind(divId).all();
      return json({ work: "bg", chapter: Number(m[1]), verses: results });
    }

    // GET /api/books/:work/division/:divId/read → стихи главы со слоями по id раздела
    // (для ЧЧ/ШБ: номера глав повторяются между лилами/песнями, ключ — division_id)
    const divReadM = url.pathname.match(/^\/api\/books\/([a-z0-9]+)\/division\/([a-z0-9.]+)\/read$/i);
    if (divReadM) {
      const work = divReadM[1];
      const divId = divReadM[2];
      const vres = await env.DB.prepare(
        `SELECT v.id, v.ref, v.devanagari, v.translit, vt.translation, vt.purport
         FROM verses v
         LEFT JOIN verse_texts vt ON vt.verse_id = v.id AND vt.edition_id = ?1
         WHERE v.work_id = ?2 AND v.division_id = ?3
         ORDER BY v.ordinal`
      ).bind(`${work}-ru`, work, divId).all<{ id: string; ref: string; devanagari: string | null; translit: string | null; translation: string | null; purport: string | null }>();
      const tres = await env.DB.prepare(
        `SELECT t.verse_id, t.term, t.gloss FROM verse_tokens t
         JOIN verses v ON v.id = t.verse_id
         WHERE v.division_id = ?1 ORDER BY t.verse_id, t.ordinal`
      ).bind(divId).all<{ verse_id: string; term: string; gloss: string | null }>();
      const byVerse: Record<string, { term: string; gloss: string | null }[]> = {};
      for (const t of tres.results ?? []) (byVerse[t.verse_id] ??= []).push({ term: t.term, gloss: cleanGloss(t.gloss) });
      const verses = (vres.results ?? []).map((v) => {
        const tail = String(v.ref).split(".").pop() ?? "";
        const label = /[-–]/.test(tail) ? `Тексты ${tail.replace(/[–—]/g, "-")}` : `Текст ${tail}`;
        return { ref: v.ref, label, devanagari: stripScriptLabel(v.devanagari), translit: v.translit ?? null, tokens: byVerse[v.id] ?? [], translation: fixSentenceSpacing(v.translation), purport: fixSentenceSpacing(v.purport) };
      });
      return json({ work, division: divId, verses });
    }

    // ── Bug reports → сохраняем в D1 + письмо на support@billionsx.com ──
    if (url.pathname === "/api/report") {
      return handleReport(request, env);
    }

    // ── Заказы магазина → сохраняем в D1 + письмо на support@billionsx.com ──
    if (url.pathname === "/api/order") {
      return handleOrder(request, env);
    }
    // Подтверждение оплаты (ручная сверка, ADMIN_TOKEN). До префиксного статус-роута.
    if (url.pathname === "/api/order/confirm") {
      return handleOrderConfirm(request, env, url);
    }
    // Статус заказа по номеру: GET /api/order/IOL-XXXXX
    if (url.pathname.startsWith("/api/order/")) {
      return handleOrderStatus(decodeURIComponent(url.pathname.slice("/api/order/".length)), env);
    }

    // ── Admin / CRM book-loader (writes to D1; protected by ADMIN_TOKEN) ──
    if (url.pathname.startsWith("/api/admin/")) {
      return handleAdmin(request, env, url);
    }

    // ── Entity registry (героев-граф) — read-only из D1 ──
    // GET /api/entities — обзор/поиск/фильтр: type, tattva, dataset, category,
    //   rel+relTo (id это from_id связи), rel+relFrom (id это to_id), ids, q, limit, offset
    if (url.pathname === "/api/entities") {
      const qp = url.searchParams;
      const where: string[] = [];
      const binds: unknown[] = [];
      const type = qp.get("type"); if (type) { where.push("e.type = ?"); binds.push(type); }
      const tattva = qp.get("tattva"); if (tattva) { where.push("e.tattva = ?"); binds.push(tattva); }
      const dataset = qp.get("dataset"); if (dataset) { where.push("e.dataset = ?"); binds.push(dataset); }
      const category = qp.get("category"); if (category) { where.push("EXISTS (SELECT 1 FROM entity_categories ec WHERE ec.entity_id=e.id AND ec.category=?)"); binds.push(category); }
      const rel = qp.get("rel");
      const relTo = qp.get("relTo"); if (rel && relTo) { where.push("e.id IN (SELECT from_id FROM entity_relations WHERE relation=? AND to_id=?)"); binds.push(rel, relTo); }
      const relFrom = qp.get("relFrom"); if (rel && relFrom) { where.push("e.id IN (SELECT to_id FROM entity_relations WHERE relation=? AND from_id=?)"); binds.push(rel, relFrom); }
      const idsRaw = qp.get("ids");
      if (idsRaw) { const arr = idsRaw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 100); if (arr.length) { where.push(`e.id IN (${arr.map(() => "?").join(",")})`); binds.push(...arr); } }
      const q = (qp.get("q") || "").trim();
      if (q) {
        // Регистронезависимый поиск для кириллицы: SQLite LIKE чувствителен к регистру
        // для не-ASCII, поэтому строим GLOB-шаблон с классом [строчн.ЗАГЛ.] по каждой букве.
        let g = "*";
        for (const ch of q) {
          if (ch === "*" || ch === "?" || ch === "[") { g += "[" + ch + "]"; continue; }
          const lo = ch.toLowerCase(), up = ch.toUpperCase();
          g += lo !== up ? "[" + lo + up + "]" : ch;
        }
        g += "*";
        where.push("EXISTS (SELECT 1 FROM entity_names n WHERE n.entity_id=e.id AND n.value GLOB ?)");
        binds.push(g);
      }
      const limit = Math.min(Math.max(parseInt(qp.get("limit") || "60", 10) || 60, 1), 200);
      const offset = Math.max(parseInt(qp.get("offset") || "0", 10) || 0, 0);
      const sql = `
        SELECT e.id, e.type, e.tattva, e.dataset, e.note,
          (SELECT value FROM entity_names n WHERE n.entity_id=e.id AND n.lang='ru' AND n.kind='canonical' LIMIT 1) AS name_ru,
          (SELECT value FROM entity_names n WHERE n.entity_id=e.id AND n.lang='en' AND n.kind='canonical' LIMIT 1) AS name_en,
          (SELECT value FROM entity_names n WHERE n.entity_id=e.id AND n.lang='iast' AND n.kind='canonical' LIMIT 1) AS name_iast,
          (SELECT ci.hero_image FROM content_items ci
             WHERE ci.type='personality' AND ci.lang='ru' AND ci.hero_image IS NOT NULL AND ci.hero_image != ''
               AND (ci.slug = '/ru/' || e.id
                    OR ci.name = (SELECT value FROM entity_names n2 WHERE n2.entity_id=e.id AND n2.lang='ru' AND n2.kind='canonical' LIMIT 1))
             LIMIT 1) AS image
        FROM entities e
        ${where.length ? "WHERE " + where.join(" AND ") : ""}
        ORDER BY (name_ru IS NULL), name_ru
        LIMIT ${limit} OFFSET ${offset}`;
      const { results } = await env.DB.prepare(sql).bind(...binds).all();
      return json({ items: results ?? [] });
    }

    // GET /api/entities/:id — полная карточка: имена, категории, профиль, связи (обе стороны)
    const entM = url.pathname.match(/^\/api\/entities\/([A-Za-z0-9][A-Za-z0-9-]*)$/);
    if (entM) {
      const id = entM[1].toLowerCase();
      const ent = await env.DB.prepare(
        `SELECT id, type, tattva, dataset, note, source_ref FROM entities WHERE id = ?`,
      ).bind(id).first<{ id: string; type: string; tattva: string | null; dataset: string | null; note: string | null; source_ref: string | null }>();
      if (!ent) return json({ error: "not_found" }, 404);
      const namesRes = await env.DB.prepare(
        `SELECT lang, value, kind FROM entity_names WHERE entity_id = ?`,
      ).bind(id).all<{ lang: string; value: string; kind: string }>();
      const catsRes = await env.DB.prepare(
        `SELECT category FROM entity_categories WHERE entity_id = ?`,
      ).bind(id).all<{ category: string }>();
      const prof = await env.DB.prepare(
        `SELECT summary, biography, contribution, level FROM entity_profiles WHERE entity_id = ?`,
      ).bind(id).first<{ summary: string | null; biography: string | null; contribution: string | null; level: string | null }>();
      let longform: string | null = null;
      try {
        const lf = await env.DB.prepare(
          `SELECT longform FROM entity_profiles WHERE entity_id = ?`,
        ).bind(id).first<{ longform: string | null }>();
        longform = lf?.longform ?? null;
      } catch { longform = null; }
      const outRes = await env.DB.prepare(
        `SELECT r.relation, r.to_id AS id, e.type,
           (SELECT value FROM entity_names n WHERE n.entity_id=r.to_id AND n.lang='ru' AND n.kind='canonical' LIMIT 1) AS name_ru,
           (SELECT value FROM entity_names n WHERE n.entity_id=r.to_id AND n.lang='iast' AND n.kind='canonical' LIMIT 1) AS name_iast
         FROM entity_relations r LEFT JOIN entities e ON e.id=r.to_id
         WHERE r.from_id = ? ORDER BY r.relation`,
      ).bind(id).all<{ relation: string; id: string; type: string | null; name_ru: string | null; name_iast: string | null }>();
      const inRes = await env.DB.prepare(
        `SELECT r.relation, r.from_id AS id, e.type,
           (SELECT value FROM entity_names n WHERE n.entity_id=r.from_id AND n.lang='ru' AND n.kind='canonical' LIMIT 1) AS name_ru,
           (SELECT value FROM entity_names n WHERE n.entity_id=r.from_id AND n.lang='iast' AND n.kind='canonical' LIMIT 1) AS name_iast
         FROM entity_relations r LEFT JOIN entities e ON e.id=r.from_id
         WHERE r.to_id = ? ORDER BY r.relation`,
      ).bind(id).all<{ relation: string; id: string; type: string | null; name_ru: string | null; name_iast: string | null }>();
      const names = namesRes.results ?? [];
      const canon = (lang: string) => names.find((n) => n.lang === lang && n.kind === "canonical")?.value ?? null;
      const nameRu = canon("ru");
      // фото личности из перенесённого контента iskcone (там, где есть)
      const IMG_ALIAS: Record<string, string> = { nrisimha: "narasimha", matsya: "matsia", "baladeva-vidyabhushana": "baladeva-vidiabhushana" };
      const cslug = "/ru/" + (IMG_ALIAS[id] ?? id);
      const imgRow = await env.DB.prepare(
        `SELECT hero_image FROM content_items
         WHERE type='personality' AND lang='ru' AND hero_image IS NOT NULL AND hero_image != ''
           AND (slug = ?1 OR (?2 IS NOT NULL AND name = ?2))
         ORDER BY (slug = ?1) DESC LIMIT 1`,
      ).bind(cslug, nameRu).first<{ hero_image: string }>();
      // кросс-силос фасет-связи (блюда/киртаны/храмы/…). Таблица неразрушающая;
      // try/catch — чтобы гонка деплоя (воркер раньше загрузчика) не уронила выдачу.
      let linksRows: { kind: string; ref: string; title: string | null; subtitle: string | null }[] = [];
      try {
        const lr = await env.DB.prepare(
          `SELECT kind, ref, title, subtitle FROM entity_links WHERE entity_id = ? ORDER BY kind, sort, ref`,
        ).bind(id).all<{ kind: string; ref: string; title: string | null; subtitle: string | null }>();
        linksRows = lr.results ?? [];
      } catch { linksRows = []; }
      // «Даршан дня»: по связям kind=darshan берём свежий даршан каждого храма из таблицы darshan.
      // Таблица может быть пуста (ингест в dry-run) или отсутствовать — try/catch, тогда [].
      let darshansArr: { temple_slug: string; temple_name: string; deities: string | null; image: string | null; date: string; url: string | null }[] = [];
      try {
        const slugs = [...new Set(linksRows.filter((l) => l.kind === "darshan").map((l) => l.ref))];
        for (const slug of slugs) {
          const d = await env.DB.prepare(
            `SELECT temple_slug, temple_name, deities, images_json, tg_message_id, src_channel, src_post_id, date
             FROM darshan WHERE temple_slug = ? ORDER BY date DESC, id DESC LIMIT 1`,
          ).bind(slug).first<{ temple_slug: string; temple_name: string; deities: string | null; images_json: string; tg_message_id: number | null; src_channel: string; src_post_id: string; date: string }>();
          if (!d) continue;
          let image: string | null = null;
          try { const arr = JSON.parse(d.images_json || "[]"); if (Array.isArray(arr) && arr.length) image = arr[0] as string; } catch { image = null; }
          const url = d.tg_message_id ? `https://t.me/iskcone/${d.tg_message_id}` : (d.src_channel && d.src_post_id ? `https://t.me/${d.src_channel}/${d.src_post_id}` : null);
          darshansArr.push({ temple_slug: d.temple_slug, temple_name: d.temple_name, deities: d.deities ?? null, image, date: d.date, url });
        }
      } catch { darshansArr = []; }
      return json({
        id: ent.id, type: ent.type, tattva: ent.tattva ?? null, dataset: ent.dataset ?? null,
        note: ent.note ?? null, source_ref: ent.source_ref ?? null,
        name_ru: nameRu, name_en: canon("en"), name_iast: canon("iast"),
        image: imgRow?.hero_image ?? null,
        aliases: names.filter((n) => n.kind !== "canonical").map((n) => n.value),
        categories: (catsRes.results ?? []).map((r) => r.category),
        profile: prof ? { summary: prof.summary ?? null, biography: prof.biography ?? null, contribution: prof.contribution ?? null, level: prof.level ?? null, longform: longform } : (longform ? { summary: null, biography: null, contribution: null, level: null, longform } : null),
        out: outRes.results ?? [],
        in: inRes.results ?? [],
        links: linksRows,
        darshans: darshansArr,
      });
    }

    // GET /api/geocode?q=<город> → ближайшее совпадение (Open-Meteo; серверный прокси, без CORS).
    // Питает «умный» подбор в календаре: если города нет в базе — берём его координаты и
    // предлагаем ближайшие города из базы (тот же восход → тот же вайшнавский календарь).
    if (url.pathname === "/api/geocode") {
      const name = (url.searchParams.get("q") || "").trim();
      if (name.length < 2) return json({ result: null });
      try {
        const r = await fetch(
          "https://geocoding-api.open-meteo.com/v1/search?count=1&format=json&language=ru&name=" + encodeURIComponent(name),
          { headers: { accept: "application/json" } },
        );
        if (r.ok) {
          const j = (await r.json()) as { results?: Array<{ name: string; latitude: number; longitude: number; timezone?: string; country?: string; admin1?: string }> };
          const h = j.results?.[0];
          if (h) {
            const out = json({ result: { name: h.name, lat: h.latitude, lng: h.longitude, tz: h.timezone ?? null, country: h.country ?? null, admin1: h.admin1 ?? null } });
            out.headers.set("Cache-Control", "public, max-age=86400");
            return out;
          }
        }
      } catch { /* сеть */ }
      return json({ result: null });
    }

    // ── Сквозной поиск по всему приложению ──────────────────────────────────
    // Личности, стихи, главы/части, молитвы и киртаны, страницы, центры. Книги
    // ищутся на клиенте (каталог LIBRARY с алиасами/фаззи). Стихи — через FTS5
    // (verse_fts: транслитерация+увача+перевод+комментарий), остальное — GLOB по
    // компактным таблицам. Каждая группа лимитирована; запросы — последовательно.
    if (url.pathname === "/api/search") {
      const q = (url.searchParams.get("q") || "").trim();
      const empty = { q, personalities: [], verses: [], chapters: [], prayers: [], pages: [], centers: [] };
      if (q.length < 2) return noStore(json(empty));
      const g = ciGlob(q);
      const m = ftsMatch(q);

      // 1) Личности — по именам и псевдонимам (точно, без флуда описаниями).
      const people = await env.DB.prepare(
        `SELECT e.id, e.type,
           (SELECT value FROM entity_names n WHERE n.entity_id=e.id AND n.lang='ru' AND n.kind='canonical' LIMIT 1) AS name_ru,
           (SELECT value FROM entity_names n WHERE n.entity_id=e.id AND n.lang='iast' AND n.kind='canonical' LIMIT 1) AS name_iast
         FROM entities e
         WHERE EXISTS (SELECT 1 FROM entity_names n WHERE n.entity_id=e.id AND n.value GLOB ?1)
         ORDER BY (name_ru IS NULL), name_ru LIMIT 12`,
      ).bind(g).all<{ id: string; type: string | null; name_ru: string | null; name_iast: string | null }>();

      // 2) Стихи — FTS5 по транслитерации, увадже, переводу и комментарию.
      // Строгий проход (все слова, префикс на последнем). Если совпадений мало —
      // расширяем до OR-префикса (recall при опечатке/частичном вводе), дедуп.
      type VRow = { id: string; work_id: string; ref: string; snippet: string | null };
      const verseSql = `SELECT v.id, v.work_id, v.ref, substr(vt.translation,1,150) AS snippet
             FROM verse_fts f JOIN verses v ON v.id=f.verse_id LEFT JOIN verse_texts vt ON vt.verse_id=v.id
             WHERE verse_fts MATCH ?1 ORDER BY rank LIMIT 14`;
      let verseRows: VRow[] = [];
      if (m) {
        const strict = await env.DB.prepare(verseSql).bind(m).all<VRow>();
        verseRows = strict.results ?? [];
        if (verseRows.length < 5) {
          const mOr = ftsMatchOr(q);
          if (mOr && mOr !== m) {
            const relaxed = await env.DB.prepare(verseSql).bind(mOr).all<VRow>();
            const seen = new Set(verseRows.map((r) => r.id));
            for (const r of relaxed.results ?? []) {
              if (seen.has(r.id)) continue;
              verseRows.push(r); seen.add(r.id);
              if (verseRows.length >= 14) break;
            }
          }
        }
      }
      const verses = { results: verseRows };

      // 3) Главы и части — по названию (хранится JSON {ru}).
      const chapters = await env.DB.prepare(
        `SELECT d.id, d.work_id, d.level, json_extract(d.title,'$.ru') AS title
         FROM divisions d
         WHERE json_extract(d.title,'$.ru') GLOB ?1
         ORDER BY d.work_id, d.ordinal LIMIT 12`,
      ).bind(g).all<{ id: string; work_id: string; level: string | null; title: string | null }>();

      // 4) Молитвы и киртаны — content_items типа prayer (+ тело страницы page_text).
      const prayers = await env.DB.prepare(
        `SELECT ci.slug, ci.name, ci.subtitle
         FROM content_items ci
         WHERE ci.lang='ru' AND ci.type='prayer'
           AND (ci.name GLOB ?1 OR ci.subtitle GLOB ?1
                OR EXISTS (SELECT 1 FROM page_text pt WHERE pt.slug=ci.slug AND pt.text GLOB ?1))
         ORDER BY (ci.name GLOB ?1) DESC LIMIT 10`,
      ).bind(g).all<{ slug: string; name: string | null; subtitle: string | null }>();

      // 5) Страницы и разделы — прочий контент (хабы, статьи).
      const pages = await env.DB.prepare(
        `SELECT ci.slug, ci.name, ci.subtitle, ci.type
         FROM content_items ci
         WHERE ci.lang='ru' AND ci.type IN ('hub','article')
           AND (ci.name GLOB ?1 OR ci.subtitle GLOB ?1
                OR EXISTS (SELECT 1 FROM page_text pt WHERE pt.slug=ci.slug AND pt.text GLOB ?1))
         ORDER BY (ci.name GLOB ?1) DESC LIMIT 10`,
      ).bind(g).all<{ slug: string; name: string | null; subtitle: string | null; type: string | null }>();

      // 6) Центры — опубликованные храмы/ятры.
      const centers = await env.DB.prepare(
        `SELECT slug, name, city FROM centers
         WHERE status='live' AND (name GLOB ?1 OR city GLOB ?1 OR country GLOB ?1 OR region GLOB ?1)
         LIMIT 10`,
      ).bind(g).all<{ slug: string; name: string; city: string | null }>();

      // стих/глава → URL: id без префикса работы, точки → слэши (bg.4.9 → /book/bg/4/9).
      const tail = (id: string, work: string) =>
        (id.startsWith(work + ".") ? id.slice(work.length + 1) : id).replace(/\./g, "/");

      return noStore(json({
        q,
        personalities: (people.results ?? []).map((r) => ({ id: r.id, type: r.type ?? null, name_ru: r.name_ru, name_iast: r.name_iast })),
        verses: (verses.results ?? []).map((r) => ({ ref: r.ref, work: r.work_id, snippet: r.snippet ?? "", href: `/book/${r.work_id}/${tail(r.id, r.work_id)}` })),
        chapters: (chapters.results ?? []).map((r) => ({ title: r.title, work: r.work_id, level: r.level, href: `/book/${r.work_id}/${tail(r.id, r.work_id)}` })),
        prayers: (prayers.results ?? []).map((r) => ({ name: r.name, subtitle: r.subtitle ?? null, href: r.slug })),
        pages: (pages.results ?? []).map((r) => ({ name: r.name, subtitle: r.subtitle ?? null, type: r.type, href: r.slug })),
        centers: (centers.results ?? []).map((r) => ({ name: r.name, city: r.city ?? null, href: `/center/${r.slug}` })),
      }));
    }

    // Same-origin proxy to the API so the browser never makes a cross-origin call.
    if (url.pathname.startsWith("/api/")) {
      const target = "https://api.gaurangers.com/v1/" + url.pathname.slice(5) + url.search;
      const upstream = await fetch(target, {
        method: request.method,
        headers: { accept: "application/json" },
      });
      const out = new Response(upstream.body, upstream);
      out.headers.set("X-Robots-Tag", NOINDEX);
      out.headers.set("Cache-Control", "no-store");
      return out;
    }

    // ── Серверный PDF (Cloudflare Browser Rendering → headless Chrome) ──
    if (url.pathname === "/pdf") {
      return handlePdf(env, url);
    }

    const res = await env.ASSETS.fetch(request);
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("text/html")) {
      const og = ogFor(url);
      const transformed = new HTMLRewriter()
        .on("title", new TitleRewriter(og.title))
        .on("head", new HeadInjector(ogTagsHtml(og)))
        .transform(res);
      const out = new Response(transformed.body, transformed);
      out.headers.set("X-Robots-Tag", NOINDEX);
      // index.html НИКОГДА не должен кэшироваться, иначе новые хэши ассетов после
      // деплоя не подхватываются (старый JS/CSS грузится из кэша). CDN-Cache-Control
      // и Cloudflare-CDN-Cache-Control явно запрещают кэш на «крае» Cloudflare и
      // перебивают возможное правило «Cache Everything».
      out.headers.set("Cache-Control", "no-store, must-revalidate");
      out.headers.set("CDN-Cache-Control", "no-store");
      out.headers.set("Cloudflare-CDN-Cache-Control", "no-store");
      return out;
    }
    const out = new Response(res.body, res);
    out.headers.set("X-Robots-Tag", NOINDEX);
    return out;
  },
};
