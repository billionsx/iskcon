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
const SOURCES = [
  {
    slug: "mayapur",
    channel: "ISKCONMayapurGroup",
    name: "ИСККОН Маяпур · Шри Дхама Маяпур",
    deities: "Шри Шри Радха-Мадхава и Аштасакхи · Панча-таттва",
    srcLabel: "ISKCON Mayapur",
  },
  {
    slug: "vrindavan",
    channel: "iskconvrindavanofficial",
    name: "ИСККОН Вриндаван · Шри Шри Кришна-Баларам Мандир",
    deities: "Шри Шри Кришна-Баларам · Радха-Шьямасундар · Гаура-Нитай",
    srcLabel: "ISKCON Vrindavan",
  },
] as const;

// Приоритет постам с фото и «даршанной» лексикой, иначе — свежайший пост с фото.
const DARSHAN_RE = /darshan|даршан|mangala|mangal|shringar|sringar|aarti|arati|abhishek|rajbhog|raj bhog|sandhya|deity|deities|gaura|nitai|radha|krishna|kṛṣṇa|balaram|madhava/i;

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

function liveItem(src: (typeof SOURCES)[number], post: RawPost): DarshanItem {
  const cap = post.text ? post.text.slice(0, 400) : null;
  return {
    source: "live",
    date: ymdIST(post.date),
    templeSlug: src.slug,
    templeName: src.name,
    deities: src.deities,
    images: post.photos.slice(0, 10),
    caption: cap,
    srcUrl: `https://t.me/${src.channel}/${post.id}`,
    channelUrl: null,
    postId: post.id,
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

  // Сегодня — живьём из храмовых каналов (архив отдаётся отдельно /archive,
  // чтобы пагинировать по id строки D1).
  const live = await Promise.all(
    SOURCES.map(async (s) => {
      const post = await latestDarshan(s.channel);
      return post ? liveItem(s, post) : null;
    }),
  );
  const today = live.filter((x): x is DarshanItem => x !== null);

  return jr({ today, at: new Date().toISOString() }, 200, today.length ? "public, max-age=600" : "no-store");
}
