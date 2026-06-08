import { handleAdmin } from "./loader/handler";
import { BOOKS, bookShareTitle, bookShareImage } from "./src/books";
import puppeteer from "@cloudflare/puppeteer";
import { EmailMessage } from "cloudflare:email";

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

// ── Серверный рендер PDF через Cloudflare Browser Rendering ──
// Открываем печатный режим SPA (/?pdf=…) в headless Chrome и снимаем page.pdf
// с настоящими полями на каждой странице и колонтитулом с нумерацией.
async function handlePdf(env: Env, url: URL): Promise<Response> {
  const kind = url.searchParams.get("kind");
  const n = url.searchParams.get("n") || "";
  const ref = url.searchParams.get("ref") || "";
  let printPath: string;
  let filename: string;
  if (kind === "book") {
    printPath = "/?pdf=book";
    filename = "Бхагавад-гита как она есть.pdf";
  } else if (kind === "chapter" && n) {
    printPath = `/?pdf=chapter&n=${encodeURIComponent(n)}`;
    filename = `Бхагавад-гита как она есть. Глава ${n}.pdf`;
  } else if (kind === "verse" && ref) {
    printPath = `/?pdf=verse&ref=${encodeURIComponent(ref)}`;
    const rd = ref.replace(/^[^\d]*/, "");
    const vch = rd.split(".")[0];
    const vseg = rd.includes(".") ? rd.slice(rd.indexOf(".") + 1) : "";
    filename = `Бхагавад-гита как она есть. Глава ${vch}${vseg ? `. Стих ${vseg}` : ""}.pdf`;
  } else {
    return new Response("bad request", { status: 400, headers: { "X-Robots-Tag": NOINDEX } });
  }
  const target = url.origin + printPath;

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  try {
    browser = await puppeteer.launch(env.BROWSER);
    const page = await browser.newPage();
    await page.setViewport({ width: 820, height: 1160, deviceScaleFactor: 2 });
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 60000 });
    try {
      // Книга тяжёлая (вся «Гита» ≈ 1100 страниц) — даём ей дорисоваться.
      await page.waitForFunction("window.__pdfReady === true", { timeout: kind === "book" ? 110000 : 45000 });
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
      `<div style="font-size:8px;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>` +
      `<div style="font-size:8.5px;letter-spacing:2px;margin-top:2.5px;">ISKCON ONE LOVE</div>` +
      `<div style="font-size:8px;letter-spacing:1px;color:#a7a8b0;">iskcone.com</div></div>`;
    // Верхний колонтитул — на каждой странице. Структура как у футера, чтобы Chrome его рисовал.
    const header =
      `<div style="width:100%;padding:0 16mm;text-align:center;-webkit-print-color-adjust:exact;print-color-adjust:exact;">` +
      `<div style="font-family:Georgia,'Times New Roman',serif;font-size:8px;letter-spacing:1.5px;line-height:1.3;text-transform:uppercase;color:#9a9a9e;">${esc(headerText)}</div></div>`;
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: header,
      footerTemplate: footer,
      margin: { top: "20mm", bottom: "22mm", left: "18mm", right: "18mm" },
    });
    return new Response(pdf, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "X-Robots-Tag": NOINDEX,
        "Cache-Control": "no-store",
      },
    });
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
  kind: "intro" | "chapter";
  pos: number;            // 0-based position within this mode's playlist
  chapter: number | null; // chapter number (1–18), or null for intros
  title: string;
  file: string;
  url: string;            // same-origin proxy URL
  durationSec: number | null;
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

// Stream one file from IA, forwarding Range (for seeking) and stamping an immutable cache.
async function serveAudio(request: Request, identifier: string, filename: string): Promise<Response> {
  const iaUrl = `https://archive.org/download/${identifier}/${encodeURI(filename)}`;
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

/** Minimal RFC-822 multipart/alternative message (UTF-8 safe) for Cloudflare Email Routing. */
function buildMime(fromName: string, fromAddr: string, to: string, replyTo: string, subject: string, text: string, html: string): string {
  const b64 = (s: string): string => {
    const bytes = new TextEncoder().encode(s);
    let bin = ""; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  };
  const wrap = (s: string): string => (s.match(/.{1,76}/g) || []).join("\r\n");
  const boundary = "b_" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const headers = [
    `From: ${fromName} <${fromAddr}>`,
    `To: ${to}`,
    ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
    `Message-ID: <${Math.random().toString(36).slice(2)}.${Date.now()}@gaurangers.com>`,
    `Date: ${new Date().toUTCString()}`,
    `Subject: =?UTF-8?B?${b64(subject)}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].join("\r\n");
  const parts = [
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=utf-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    wrap(b64(text)),
    `--${boundary}`,
    `Content-Type: text/html; charset=utf-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    wrap(b64(html)),
    `--${boundary}--`,
    ``,
  ].join("\r\n");
  return headers + "\r\n" + parts;
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

  // 1) Cloudflare Email Routing — нативно, без сторонних сервисов (основной путь).
  if (env.SEB) {
    try {
      const fromAddr = env.REPORT_FROM_ADDR || "noreply@gaurangers.com";
      const raw = buildMime("ISKCON ONE LOVE", fromAddr, "support@billionsx.com", rec.email || "", subject, text, html);
      await env.SEB.send(new EmailMessage(fromAddr, "support@billionsx.com", raw));
      emailed = true;
    } catch { emailed = false; }
  }

  // 2) Резерв — Resend (если задан ключ и нативная отправка не сработала).
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
    } catch { emailed = false; }
  }

  return jsonResp({ ok: true, emailed });
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

    // GET /api/books/bg/audio → ordered audio playlist (plain + commentary), built live from IA
    if (url.pathname === "/api/books/bg/audio") {
      return audioManifest(env, url.origin);
    }

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

    // ── Bug reports → сохраняем в D1 + письмо на support@billionsx.com ──
    if (url.pathname === "/api/report") {
      return handleReport(request, env);
    }

    // ── Admin / CRM book-loader (writes to D1; protected by ADMIN_TOKEN) ──
    if (url.pathname.startsWith("/api/admin/")) {
      return handleAdmin(request, env, url);
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
