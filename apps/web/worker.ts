import { handleAdmin } from "./loader/handler";
import { BOOKS, bookShareTitle, bookShareImage } from "./src/books";
import puppeteer from "@cloudflare/puppeteer";

interface Env {
  ASSETS: { fetch: (req: Request) => Promise<Response> };
  DB: D1Database;
  // Cloudflare Browser Rendering — серверный рендер PDF (headless Chrome)
  BROWSER: Fetcher;
  // Секрет для CRM-загрузчика: wrangler secret put ADMIN_TOKEN
  ADMIN_TOKEN?: string;
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
    filename = `Бхагавад-гита — глава ${n}.pdf`;
  } else if (kind === "verse" && ref) {
    printPath = `/?pdf=verse&ref=${encodeURIComponent(ref)}`;
    filename = `${ref} — Бхагавад-гита.pdf`;
  } else {
    return new Response("bad request", { status: 400, headers: { "X-Robots-Tag": NOINDEX } });
  }
  const target = url.origin + printPath;

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  try {
    browser = await puppeteer.launch(env.BROWSER);
    const page = await browser.newPage();
    await page.setViewport({ width: 820, height: 1160, deviceScaleFactor: 2 });
    await page.goto(target, { waitUntil: "networkidle0", timeout: 30000 });
    try {
      await page.waitForFunction("window.__pdfReady === true", { timeout: 30000 });
    } catch {
      /* отрисовка затянулась — печатаем что отрисовалось */
    }
    const footer =
      `<div style="width:100%;padding:0 16mm;font-family:Arial,Helvetica,sans-serif;font-size:8px;color:#9a9a9e;text-align:center;">` +
      `ISKCON ONE LOVE &middot; gaurangers.com &nbsp;&middot;&nbsp; <span class="pageNumber"></span> / <span class="totalPages"></span></div>`;
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: footer,
      margin: { top: "18mm", bottom: "20mm", left: "16mm", right: "16mm" },
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

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
