/**
 * Даршан дня — публичный read-слой (тот же воркер/origin, что и Лента и кабинет).
 *
 * Сегодняшний даршан берём ЖИВЫМ из публичных каналов храмов (t.me/s, та же
 * механика и парсер, что у Ленты @iskcone в workerHome.ts) — он всегда свежий,
 * как лента, и не зависит от ежедневного ингеста. Архив даршанов — из таблицы
 * D1 `darshan` (редакторский слой, наполняется ингестом scripts/darshan-ingest.mjs;
 * пока тот в dry-run, архив просто пуст). Та же БД, что и у кабинета (binding DB).
 *
 * Изображения — прямые URL Telegram-CDN (как фото Ленты, рендерятся <img> без
 * прокси). Эндпоинты: GET /api/darshan (сегодня + голова архива),
 * GET /api/darshan/archive?before=<id>&limit=N (постранично архив из D1).
 */
import type { D1Database } from "@cloudflare/workers-types";

interface DarshanEnv {
  DB: D1Database;
}

/* ── якорные храмы (метаданные синхронны scripts/darshan-ingest.mjs) ── */
interface Src {
  slug: string;
  kind: "tg" | "site";
  site?: "iskconvrindavan" | "mayapur";
  channel: string;
  name: string;
  deities: string;
  srcLabel: string;
  galleryType?: string;
  gallerySlug?: string;
  galleryName?: string;
}
const SOURCES: Src[] = [
  {
    // Маяпур: «сегодня» берём полноразмерными оригиналами из официальной галереи
    // даршана сайта храма (mayapur.com, ~1920px) — те же 800px-превью Telegram
    // оставляем лишь запасным источником. channel — fallback (см. darshanApi).
    slug: "mayapur",
    kind: "site",
    site: "mayapur",
    channel: "ISKCONMayapurGroup",
    galleryName: "Daily Darshan",
    name: "ИСККОН Маяпур · Шри Дхама Маяпур",
    deities: "Шри Шри Радха-Мадхава и Аштасакхи · Панча-таттва",
    srcLabel: "ISKCON Mayapur",
  },
  {
    // Вриндаван: для «сегодня» берём ВСЮ галерею Шрингара с сайта храма (≈21 фото,
    // все три алтаря) — чтобы в сторис был полный даршан, а не один альбом канала.
    slug: "vrindavan",
    kind: "site",
    channel: "iskconvrindavanofficial",
    galleryType: "2",
    gallerySlug: "sringar-darshan",
    galleryName: "Sringar Darshan",
    name: "ИСККОН Вриндаван · Шри Шри Кришна-Баларам Мандир",
    deities: "Шри Шри Кришна-Баларам · Радха-Шьямасундар · Гаура-Нитай",
    srcLabel: "ISKCON Vrindavan",
  },
];

/* ── источник: сайт храма (полная галерея даршана за сегодня IST) ── */
const SITE_CDN = "https://cdn.iskconvrindavan.com";
const SITE_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const istToday = () => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date());
async function fetchSiteGallery(src: Src): Promise<{ date: string; name: string; pageUrl: string; images: string[] } | null> {
  const date = istToday();
  const u = `https://iskconvrindavan.com/daily-darshan-gallery/${date}/${src.galleryType}/${src.gallerySlug}.data`;
  const pageUrl = `https://iskconvrindavan.com/daily-darshan-gallery/${date}/${src.galleryType}/${src.gallerySlug}`;
  try {
    const r = await fetch(u, {
      headers: { "User-Agent": SITE_UA, accept: "*/*", referer: "https://iskconvrindavan.com/daily-darshan-gallery" },
      cf: { cacheTtl: 600, cacheEverything: true },
    } as RequestInit);
    if (!r.ok) return null;
    const t = await r.text();
    const re = /static\/static-_[0-9a-zA-Z]+\.(?:jpe?g|png|webp)/g;
    const seen = new Set<string>(); const paths: string[] = []; let m: RegExpExecArray | null;
    while ((m = re.exec(t))) { if (!seen.has(m[0])) { seen.add(m[0]); paths.push(m[0]); } }
    if (!paths.length) return null;
    const name = (t.match(/"gallery_name","([^"]+)"/) || [])[1] || src.galleryName || "Darshan";
    return { date, name, pageUrl, images: paths.map((p) => `${SITE_CDN}/${p}`) };
  } catch { return null; }
}

// Приоритет постам с фото и «даршанной» лексикой, иначе — свежайший пост с фото.
const DARSHAN_RE = /darshan|даршан|mangala|mangal|shringar|sringar|aarti|arati|abhishek|rajbhog|raj bhog|sandhya|deity|deities|gaura|nitai|radha|krishna|kṛṣṇa|balaram|madhava/i;

/* ── источник: галерея даршана Маяпура (mayapur.com, оригиналы ~1920px) ── */
// Индекс server-rendered (блоки «дата DD/MM/YYYY → /media/album/N»). Полные кадры
// отдаёт server-rendered смотрелка /imageviewer/show-album-pictures/N/0 списком
// /storage/albums/N/{hash}_image.jpg — браузер не нужен (как у Вриндавана).
const MAYAPUR = "https://www.mayapur.com";
const ddmmyyyyIST = () => {
  const p = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Kolkata" }).formatToParts(new Date());
  const g = (t: string) => (p.find((x) => x.type === t) || { value: "" }).value;
  return `${g("day")}/${g("month")}/${g("year")}`;
};
async function fetchMayapurGallery(src: Src): Promise<{ date: string; name: string; pageUrl: string; images: string[]; albumId: string } | null> {
  try {
    const ri = await fetch(`${MAYAPUR}/media/gallery/daily-darshan`, {
      headers: { "User-Agent": SITE_UA, accept: "text/html,*/*", referer: `${MAYAPUR}/` },
      cf: { cacheTtl: 600, cacheEverything: true },
    } as RequestInit);
    if (!ri.ok) return null;
    const html = await ri.text();
    const blocks: { date: string | null; id: string }[] = [];
    const re = /<p>\s*(\d{2}\/\d{2}\/\d{4})\s*<\/p>[\s\S]{0,220}?\/media\/album\/(\d+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) blocks.push({ date: m[1], id: m[2] });
    if (!blocks.length) {
      const idre = /\/media\/album\/(\d+)/g; const ids: string[] = []; let mm: RegExpExecArray | null;
      while ((mm = idre.exec(html))) ids.push(mm[1]);
      const first = [...new Set(ids)][0];
      if (!first) return null;
      blocks.push({ date: null, id: first });
    }
    const today = ddmmyyyyIST();
    const chosen = blocks.find((b) => b.date === today) || blocks[0];
    const albumId = chosen.id;

    // Полный список кадров альбома. Источник 1 — страница альбома: ВСЕ фото в её
    // raw-HTML присутствуют как {hash}_thumbnail (полноразмерный вариант — {hash}_image.jpg).
    // Источник 2 — server-rendered смотрелка (.../0) с прямыми {hash}_image.ext.
    // Объединяем по hash (порядок страницы альбома; реальный URL смотрелки приоритетнее),
    // чтобы в сторис попали ВСЕ кадры, а не подвыборка одной страницы.
    const order: string[] = [];
    const urlByHash = new Map<string, string>();
    const note = (hash: string, url?: string) => {
      if (!order.includes(hash)) order.push(hash);
      if (url) urlByHash.set(hash, url);
    };
    try {
      const ra = await fetch(`${MAYAPUR}/media/album/${albumId}`, {
        headers: { "User-Agent": SITE_UA, accept: "text/html,*/*", referer: `${MAYAPUR}/media/gallery/daily-darshan` },
        cf: { cacheTtl: 600, cacheEverything: true },
      } as RequestInit);
      if (ra.ok) {
        const at = await ra.text();
        const thRe = new RegExp(`albums/${albumId}/([A-Za-z0-9]+)_thumbnail`, "gi");
        let t: RegExpExecArray | null;
        while ((t = thRe.exec(at))) note(t[1]);
      }
    } catch { /* нет страницы альбома — добираем смотрелкой ниже */ }
    try {
      const rv = await fetch(`${MAYAPUR}/imageviewer/show-album-pictures/${albumId}/0`, {
        headers: { "User-Agent": SITE_UA, accept: "text/html,*/*", referer: `${MAYAPUR}/media/album/${albumId}` },
        cf: { cacheTtl: 600, cacheEverything: true },
      } as RequestInit);
      if (rv.ok) {
        const vt = await rv.text();
        const imgRe = new RegExp(`storage/albums/${albumId}/([A-Za-z0-9]+)_image\\.(?:jpe?g|png|webp)`, "gi");
        let p: RegExpExecArray | null;
        while ((p = imgRe.exec(vt))) note(p[1], p[0]);
      }
    } catch { /* нет смотрелки — остаёмся на кадрах со страницы альбома */ }
    const paths = order.map((h) => urlByHash.get(h) || `storage/albums/${albumId}/${h}_image.jpg`);
    if (!paths.length) return null;
    const date = chosen.date ? chosen.date.split("/").reverse().join("-") : istToday();
    return { date, albumId, name: src.galleryName || "Daily Darshan", pageUrl: `${MAYAPUR}/media/album/${albumId}`, images: paths.map((x) => `${MAYAPUR}/${x}`) };
  } catch {
    return null;
  }
}

/* ── парсер t.me/s (порт из workerHome.ts, только нужные поля) ── */
const deent = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ");
const plain = (s: string) => deent(s.replace(/<[^>]+>/g, "")).replace(/\n{3,}/g, "\n\n").trim();

interface RawPost { id: string; date: string; text: string; photos: string[] }

function parsePosts(html: string): RawPost[] {
  const out: RawPost[] = [];
  for (const b of html.split("tgme_widget_message_wrap").slice(1)) {
    const idM = b.match(/data-post="[^"/]+\/(\d+)"/);
    if (!idM) continue;
    const dateM = b.match(/<time datetime="([^"]+)"/);
    const textM = b.match(/tgme_widget_message_text js-message_text[^>]*>([\s\S]*?)<\/div>/);
    const text = textM ? plain(textM[1].replace(/<br\s*\/?>/gi, "\n")) : "";
    const photos: string[] = [];
    const phRe = /tgme_widget_message_photo_wrap[^>]*background-image:url\('([^']+)'\)/g;
    let ph: RegExpExecArray | null;
    while ((ph = phRe.exec(b))) photos.push(deent(ph[1]));
    if (!photos.length && !text) continue;
    out.push({ id: idM[1], date: dateM ? dateM[1] : "", text, photos });
  }
  out.reverse(); // свежие первыми
  return out;
}

async function latestDarshan(channel: string): Promise<RawPost | null> {
  try {
    const r = await fetch(`https://t.me/s/${channel}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; iskcon-one-love/1.0)" },
      cf: { cacheTtl: 600, cacheEverything: true },
    } as RequestInit);
    if (!r.ok) return null;
    const posts = parsePosts(await r.text());
    const withPhoto = posts.filter((p) => p.photos.length);
    return withPhoto.find((p) => DARSHAN_RE.test(p.text)) || withPhoto[0] || null;
  } catch {
    return null;
  }
}

// Локальный день поста по IST (граница суток храмового даршана — индийская).
function ymdIST(iso: string): string {
  const d = iso ? new Date(iso) : new Date();
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Kolkata" }).format(d);
}

/* ── форма карточки для клиента ── */
interface DarshanItem {
  source: "live" | "archive";
  date: string;
  templeSlug: string;
  templeName: string;
  deities: string | null;
  images: string[];
  caption: string | null;
  srcUrl: string;
  channelUrl: string | null;
  postId: string;
}

function liveItem(src: Src, post: RawPost): DarshanItem {
  const cap = post.text ? post.text.slice(0, 400) : null;
  return {
    source: "live",
    date: ymdIST(post.date),
    templeSlug: src.slug,
    templeName: src.name,
    deities: src.deities,
    images: post.photos.slice(0, 30),
    caption: cap,
    srcUrl: `https://t.me/${src.channel}/${post.id}`,
    channelUrl: null,
    postId: post.id,
  };
}

// Карточка из полной галереи сайта (Вриндаван/Маяпур) — все фото даршана.
function siteItem(src: Src, gal: { date: string; name: string; pageUrl: string; images: string[]; albumId?: string }): DarshanItem {
  return {
    source: "live",
    date: gal.date,
    templeSlug: src.slug,
    templeName: src.name,
    deities: src.deities,
    images: gal.images.slice(0, 30),
    caption: null,
    srcUrl: gal.pageUrl,
    channelUrl: null,
    postId: gal.albumId ? `album/${gal.albumId}` : `${gal.date}/${src.galleryType}`,
  };
}

interface DarshanRow {
  id: number; date: string; temple_slug: string; temple_name: string; deities: string | null;
  src_channel: string; src_post_id: string; images_json: string; caption: string | null; tg_message_id: number | null;
}
function archiveItem(row: DarshanRow): DarshanItem {
  let images: string[] = [];
  try { const v = JSON.parse(row.images_json); if (Array.isArray(v)) images = v.filter((x) => typeof x === "string"); } catch { /* [] */ }
  return {
    source: "archive",
    date: row.date,
    templeSlug: row.temple_slug,
    templeName: row.temple_name,
    deities: row.deities,
    images: images.slice(0, 10),
    caption: row.caption ? plain(row.caption).slice(0, 400) || null : null,
    srcUrl: `https://t.me/${row.src_channel}/${row.src_post_id}`,
    channelUrl: row.tg_message_id ? `https://t.me/iskcone/${row.tg_message_id}` : null,
    postId: row.src_post_id,
  };
}

async function ensureDarshan(env: DarshanEnv): Promise<void> {
  // Таблица заводится миграцией 0009 на общей БД; CREATE IF NOT EXISTS — на случай
  // отставания миграции, чтобы read-эндпоинт был самодостаточным.
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS darshan (
        id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, temple_slug TEXT NOT NULL,
        temple_name TEXT NOT NULL, deities TEXT, src_channel TEXT NOT NULL, src_post_id TEXT NOT NULL,
        images_json TEXT NOT NULL DEFAULT '[]', caption TEXT, tg_message_id INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
    ).run();
  } catch { /* noop */ }
}

function jr(data: unknown, status = 200, cache = "no-store"): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": cache },
  });
}

const clampInt = (v: string | null, def: number, lo: number, hi: number) => {
  const n = parseInt(v || "", 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, lo), hi) : def;
};

export async function darshanApi(request: Request, env: DarshanEnv, url: URL): Promise<Response | null> {
  const p = url.pathname;
  if (p !== "/api/darshan" && p !== "/api/darshan/archive") return null;
  if (request.method !== "GET") return jr({ error: "method" }, 405);

  await ensureDarshan(env);

  // Постраничный архив из D1 (для «показать ещё»).
  if (p === "/api/darshan/archive") {
    const limit = clampInt(url.searchParams.get("limit"), 24, 1, 40);
    const before = url.searchParams.get("before");
    try {
      const q = /^\d+$/.test(before || "")
        ? env.DB.prepare(`SELECT * FROM darshan WHERE id < ?1 ORDER BY id DESC LIMIT ?2`).bind(Number(before), limit)
        : env.DB.prepare(`SELECT * FROM darshan ORDER BY id DESC LIMIT ?1`).bind(limit);
      const res = await q.all<DarshanRow>();
      const rows = res.results ?? [];
      const items = rows.map(archiveItem);
      const oldest = rows.length ? rows[rows.length - 1].id : null;
      return jr({ items, oldest, hasMore: rows.length === limit }, 200, "public, max-age=120");
    } catch {
      return jr({ items: [], oldest: null, hasMore: false }, 200, "no-store");
    }
  }

  // Сегодня — живьём: и Вриндаван, и Маяпур берём полной галереей с сайта
  // (полноразмерные оригиналы даршана). Если сайт недоступен — запас:
  // свежайший даршанный пост канала храма. Архив — отдельно /archive.
  const live = await Promise.all(
    SOURCES.map(async (s) => {
      if (s.kind === "site") {
        const gal = s.site === "mayapur" ? await fetchMayapurGallery(s) : await fetchSiteGallery(s);
        if (gal && gal.images.length) return siteItem(s, gal);
        // запас: если сайт недоступен — пробуем канал храма
        const post = await latestDarshan(s.channel);
        return post ? liveItem(s, post) : null;
      }
      const post = await latestDarshan(s.channel);
      return post ? liveItem(s, post) : null;
    }),
  );
  const today = live.filter((x): x is DarshanItem => x !== null);

  return jr({ today, at: new Date().toISOString() }, 200, today.length ? "public, max-age=600" : "no-store");
}
