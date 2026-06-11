/**
 * workerHome — серверная часть Главной.
 *
 *   /api/places            — каталог центров/ресторанов: поиск + фильтры (D1 `places`)
 *   /api/places/facets     — континенты и страны с количеством (для саб-табов)
 *   /api/places/:id        — одно место (ПКЦ/ПКР)
 *   /api/documents         — документы ИСККОН: поиск + фильтр по типу (D1 `home_documents`)
 *   /api/tg/iskcone        — лента Telegram-канала: текст со ссылками, ВСЕ фото,
 *                            видео (превью+длительность+src если отдан), кружки,
 *                            голосовые, аудио-файлы, документы, превью ссылок.
 *
 * Источник данных каталогов — D1 (таблицы наполняет воркфлоу home-catalog-load.yml
 * из apps/web/public/data/*.json). Если таблиц ещё нет — воркер прозрачно читает
 * те же JSON из ассетов, поэтому каталоги живы при любом порядке деплоя/загрузки.
 */
import { catRu, enCountriesFor, ruCountry, CONTINENT_ORDER, type PlaceItem } from "./src/placesShared";

export interface HomeEnv {
  DB: D1Database;
  ASSETS: { fetch: (req: Request) => Promise<Response> };
}

const jh = { "Content-Type": "application/json; charset=utf-8" };
const jr = (data: unknown, status = 200, cache = "public, max-age=300") =>
  new Response(JSON.stringify(data), { status, headers: { ...jh, "Cache-Control": cache } });

/* ───────────────────────── PLACES ───────────────────────── */

interface RawPlace {
  id: string; kind: string; name: string; name_ru?: string | null; city_ru?: string | null; state_ru?: string | null; address_ru?: string | null;
  categories?: string[] | string | null;
  address?: string; city?: string; state?: string; country?: string; continent?: string;
  lat?: number | null; lng?: number | null; phone?: string; email?: string; website?: string; source?: string;
}

function normPlace(r: RawPlace): PlaceItem {
  let cats: string[] = [];
  if (Array.isArray(r.categories)) cats = r.categories;
  else if (typeof r.categories === "string") { try { cats = JSON.parse(r.categories) || []; } catch { cats = []; } }
  const kind = (r.kind === "restaurant" ? "restaurant" : "centre") as PlaceItem["kind"];
  return {
    id: r.id, kind, name: r.name || "", nameRu: r.name_ru || r.name || "", category: catRu(kind, cats),
    address: r.address || "", addressRu: r.address_ru || r.address || "", city: r.city || "", cityRu: r.city_ru || r.city || "",
    state: r.state || "", stateRu: r.state_ru || r.state || "",
    country: r.country || "", countryRu: ruCountry(r.country || ""), continent: r.continent || "Другое",
    lat: r.lat ?? null, lng: r.lng ?? null,
    phone: r.phone || "", email: r.email || "", website: r.website || "", source: r.source || "",
  };
}

async function assetJson<T>(env: HomeEnv, origin: string, path: string): Promise<T | null> {
  try {
    const res = await env.ASSETS.fetch(new Request(origin + path));
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch { return null; }
}

async function allPlacesFromAsset(env: HomeEnv, origin: string): Promise<PlaceItem[]> {
  const j = await assetJson<{ places?: RawPlace[] }>(env, origin, "/data/iskcon-places.json");
  return (j?.places || []).map(normPlace);
}

async function allPlacesFromD1(env: HomeEnv): Promise<PlaceItem[] | null> {
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, kind, name, name_ru, city_ru, state_ru, address_ru, categories, address, city, state, country, continent, lat, lng, phone, email, website, source FROM places`
    ).all();
    if (!results || results.length === 0) return null;
    return (results as unknown as RawPlace[]).map(normPlace);
  } catch { return null; }
}

let placesCache: { items: PlaceItem[]; from: string; at: number } | null = null;
async function getPlaces(env: HomeEnv, origin: string): Promise<{ items: PlaceItem[]; from: string }> {
  if (placesCache && Date.now() - placesCache.at < 5 * 60_000) return placesCache;
  const d1 = await allPlacesFromD1(env);
  const items = d1 || (await allPlacesFromAsset(env, origin));
  placesCache = { items, from: d1 ? "d1" : "asset", at: Date.now() };
  return placesCache;
}

function filterPlaces(items: PlaceItem[], p: URLSearchParams): PlaceItem[] {
  const kind = p.get("kind") === "restaurant" ? "restaurant" : "centre";
  const cont = p.get("continent") || "";
  const ctry = p.get("country") || "";
  const q = (p.get("q") || "").trim().toLowerCase();
  const enQ = q ? enCountriesFor(q) : [];
  let r = items.filter((x) => x.kind === kind);
  if (cont) r = r.filter((x) => x.continent === cont);
  if (ctry) r = r.filter((x) => (x.country || "—") === ctry);
  if (q) {
    r = r.filter((x) =>
      [x.name, x.nameRu, x.city, x.cityRu, x.state, x.stateRu, x.country, x.countryRu, x.address, x.addressRu, x.category]
        .some((f) => f && f.toLowerCase().includes(q)) ||
      enQ.some((en) => x.country.toLowerCase() === en));
  }
  const key = (x: PlaceItem) => `${x.country ? 0 : 1}|${x.countryRu}|${x.cityRu}|${x.nameRu}`;
  return r.sort((a, b) => key(a).localeCompare(key(b), "ru"));
}

async function placesList(env: HomeEnv, url: URL): Promise<Response> {
  const { items, from } = await getPlaces(env, url.origin);
  const filtered = filterPlaces(items, url.searchParams);
  const limit = Math.min(60, Math.max(1, Number(url.searchParams.get("limit")) || 30));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  return jr({ total: filtered.length, from, items: filtered.slice(offset, offset + limit) });
}

async function placesFacets(env: HomeEnv, url: URL): Promise<Response> {
  const { items } = await getPlaces(env, url.origin);
  const kind = url.searchParams.get("kind") === "restaurant" ? "restaurant" : "centre";
  const byCont = new Map<string, Map<string, { ru: string; n: number }>>();
  let total = 0;
  for (const x of items) {
    if (x.kind !== kind) continue;
    total++;
    const c = byCont.get(x.continent) || new Map();
    const cc = x.country || "—";
    const cur = c.get(cc) || { ru: x.country ? x.countryRu : "—", n: 0 };
    cur.n++; c.set(cc, cur); byCont.set(x.continent, c);
  }
  const continents = CONTINENT_ORDER.filter((c) => byCont.has(c)).map((c) => {
    const m = byCont.get(c)!;
    const countries = [...m.entries()].map(([id, v]) => ({ id, ru: v.ru, n: v.n })).sort((a, b) => b.n - a.n);
    return { id: c, n: countries.reduce((s, x) => s + x.n, 0), countries };
  });
  return jr({ total, continents });
}

async function placeById(env: HomeEnv, url: URL, id: string): Promise<Response> {
  const { items } = await getPlaces(env, url.origin);
  const p = items.find((x) => x.id === id);
  return p ? jr({ place: p }) : jr({ error: "not_found" }, 404);
}

/* ───────────────────────── DOCUMENTS ───────────────────────── */

interface HomeDoc {
  id: string; type: string; year: string; title: string; issuer: string;
  summary: string; body: string[]; facts: { k: string; v: string }[]; url: string; sort: number;
}

let docsCache: { items: HomeDoc[]; at: number } | null = null;
async function getDocs(env: HomeEnv, origin: string): Promise<HomeDoc[]> {
  if (docsCache && Date.now() - docsCache.at < 5 * 60_000) return docsCache.items;
  let items: HomeDoc[] | null = null;
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, type, year, title, issuer, summary, body, facts, url, sort FROM home_documents ORDER BY sort`
    ).all();
    if (results && results.length > 0) {
      items = (results as Record<string, unknown>[]).map((r) => ({
        id: String(r.id), type: String(r.type), year: String(r.year), title: String(r.title),
        issuer: String(r.issuer), summary: String(r.summary),
        body: safeArr(r.body), facts: safeArr(r.facts), url: String(r.url || ""), sort: Number(r.sort) || 0,
      })) as HomeDoc[];
    }
  } catch { /* таблицы ещё нет — фолбэк на ассет */ }
  if (!items) {
    const j = await assetJson<{ documents?: HomeDoc[] }>(env, origin, "/data/iskcon-documents.json");
    items = j?.documents || [];
  }
  docsCache = { items, at: Date.now() };
  return items;
}
function safeArr<T>(v: unknown): T {
  if (typeof v === "string") { try { return JSON.parse(v) as T; } catch { return [] as unknown as T; } }
  return (v ?? []) as T;
}

async function documentsList(env: HomeEnv, url: URL): Promise<Response> {
  const items = await getDocs(env, url.origin);
  const type = url.searchParams.get("type") || "";
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  let r = items;
  if (type) r = r.filter((d) => d.type === type);
  if (q) r = r.filter((d) => [d.title, d.issuer, d.summary, d.year, d.body.join(" ")].some((f) => f.toLowerCase().includes(q)));
  return jr({ total: r.length, documents: r });
}

/* ───────────────────────── TELEGRAM FEED ───────────────────────── */

const TG_CHANNELS = new Set(["iskcone"]);

const deent = (s: string) => s
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ");
const plain = (s: string) => deent(s.replace(/<[^>]+>/g, ""));

export interface TgSeg { t: "t" | "a"; v: string; href?: string }
export interface TgVideo { thumb: string; src: string | null; duration: string; round: boolean }
export interface TgAudio { kind: "voice" | "audio" | "file"; title: string; meta: string; src: string | null }
export interface TgLink { href: string; title: string; desc: string; img: string | null }
export interface TgPost {
  id: string; date: string; views: string; text: string;
  rich: TgSeg[]; photos: string[]; videos: TgVideo[]; audios: TgAudio[]; link: TgLink | null;
}

function parseRich(html: string): TgSeg[] {
  const norm = html.replace(/<br\s*\/?>/gi, "\n");
  const out: TgSeg[] = [];
  const re = /<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let last = 0; let m: RegExpExecArray | null;
  const pushText = (s: string) => { const v = plain(s); if (v) out.push({ t: "t", v }); };
  while ((m = re.exec(norm))) {
    pushText(norm.slice(last, m.index));
    const label = plain(m[2]); const href = deent(m[1]);
    if (label) out.push({ t: "a", v: label, href });
    last = m.index + m[0].length;
  }
  pushText(norm.slice(last));
  // схлопываем тройные переводы строк по краям сегментов
  return out.map((s) => ({ ...s, v: s.v.replace(/\n{3,}/g, "\n\n") }));
}

function parseTgBlock(b: string): TgPost | null {
  const idM = b.match(/data-post="[^"/]+\/(\d+)"/);
  if (!idM) return null;
  const dateM = b.match(/<time datetime="([^"]+)"/);
  const viewsM = b.match(/tgme_widget_message_views">([^<]+)</);

  // текст со ссылками
  const textM = b.match(/tgme_widget_message_text js-message_text[^>]*>([\s\S]*?)<\/div>/);
  const rich = textM ? parseRich(textM[1]) : [];
  const text = rich.map((s) => s.v).join("").replace(/\n{3,}/g, "\n\n").trim();

  // все фото поста (включая альбомы); превью ссылок сюда не попадает — другой класс
  const photos: string[] = [];
  const phRe = /tgme_widget_message_photo_wrap[^>]*background-image:url\('([^']+)'\)/g;
  let ph: RegExpExecArray | null;
  while ((ph = phRe.exec(b))) photos.push(deent(ph[1]));

  // видео и кружки
  const videos: TgVideo[] = [];
  const grabVideos = (marker: string, round: boolean) => {
    const parts = b.split(marker);
    for (let i = 1; i < parts.length; i++) {
      const c = parts[i];
      const head = c.slice(0, 400);
      const thumb = c.match(/background-image:url\('([^']+)'\)/);
      const src = c.match(/<video[^>]*\ssrc="([^"]+)"/);
      const dur = c.match(/duration[^>]*>([\d:]+)</);
      const unsupported = /^[^>]*not_supported/.test(head);
      videos.push({
        thumb: thumb ? deent(thumb[1]) : "",
        src: !unsupported && src ? deent(src[1]) : null,
        duration: dur ? dur[1] : "",
        round,
      });
    }
  };
  grabVideos("tgme_widget_message_video_player", false);
  grabVideos("tgme_widget_message_roundvideo_player", true);

  // аудио: голосовые (есть src) и аудио-файлы/документы (открываются в Telegram)
  const audios: TgAudio[] = [];
  const voRe = /<audio[^>]*>/gi;
  let vo: RegExpExecArray | null;
  while ((vo = voRe.exec(b))) {
    const tag = vo[0];
    if (!/voice/.test(tag)) continue;
    const src = tag.match(/\ssrc="([^"]+)"/);
    const after = b.slice(vo.index, vo.index + 600);
    const dur = after.match(/voice_duration[^>]*>([\d:]+)</);
    audios.push({ kind: "voice", title: "Голосовое сообщение", meta: dur ? dur[1] : "", src: src ? deent(src[1]) : null });
  }
  const docParts = b.split("tgme_widget_message_document_wrap");
  for (let i = 1; i < docParts.length; i++) {
    const c = docParts[i];
    const title = c.match(/document_title[^>]*>([\s\S]*?)<\//);
    const extra = c.match(/document_extra[^>]*>([\s\S]*?)<\//);
    const t = title ? plain(title[1]).trim() : "Файл";
    const meta = extra ? plain(extra[1]).trim() : "";
    const isAudio = /\b\d+:\d{2}\b/.test(meta) || /\.(mp3|m4a|ogg|wav|flac|aac)\b/i.test(t);
    audios.push({ kind: isAudio ? "audio" : "file", title: t, meta, src: null });
  }

  // превью ссылки
  let link: TgLink | null = null;
  const lpHref = b.match(/<a[^>]*class="[^"]*link_preview[^"]*"[^>]*href="([^"]+)"/);
  if (lpHref) {
    const lt = b.match(/link_preview_title[^>]*>([\s\S]*?)<\/div>/);
    const ld = b.match(/link_preview_description[^>]*>([\s\S]*?)<\/div>/);
    const li = b.match(/link_preview_(?:right_)?image[^>]*background-image:url\('([^']+)'\)/);
    link = { href: deent(lpHref[1]), title: lt ? plain(lt[1]).trim() : "", desc: ld ? plain(ld[1]).trim() : "", img: li ? deent(li[1]) : null };
  }

  if (!text && !photos.length && !videos.length && !audios.length && !link) return null;
  return {
    id: idM[1], date: dateM ? dateM[1] : "", views: viewsM ? viewsM[1].trim() : "",
    text, rich, photos, videos, audios, link,
  };
}

async function tgFeed(channel: string, before: string): Promise<Response> {
  if (!TG_CHANNELS.has(channel)) return jr({ error: "unknown_channel" }, 404);
  try {
    // t.me/s отдаёт ~20 постов; ?before=<id> — страница более старых (бесконечная лента)
    const qs = /^\d+$/.test(before) ? `?before=${before}` : "";
    const r = await fetch(`https://t.me/s/${channel}${qs}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; iskcon-one-love/1.0)" },
      cf: { cacheTtl: 300, cacheEverything: true },
    } as RequestInit);
    const html = await r.text();
    const posts: TgPost[] = [];
    for (const b of html.split("tgme_widget_message_wrap").slice(1)) {
      const p = parseTgBlock(b);
      if (p) posts.push(p);
    }
    posts.reverse(); // свежие сверху
    const oldest = posts.length ? posts[posts.length - 1].id : null;
    // конец истории: страница пуста или старее уже некуда
    const hasMore = posts.length > 0 && oldest !== null && Number(oldest) > 1;
    return jr({ channel, posts, oldest, hasMore }, 200, "public, max-age=300");
  } catch {
    return jr({ channel, posts: [], oldest: null, hasMore: false }, 502, "no-store");
  }
}

/* ───────────────────────── РОУТЕР ───────────────────────── */

export async function homeApi(request: Request, env: HomeEnv): Promise<Response | null> {
  const url = new URL(request.url);
  const p = url.pathname;
  if (p === "/api/places") return placesList(env, url);
  if (p === "/api/places/facets") return placesFacets(env, url);
  const pid = p.match(/^\/api\/places\/([a-z0-9][a-z0-9._-]*)$/i);
  if (pid && pid[1] !== "facets") return placeById(env, url, pid[1]);
  if (p === "/api/documents") return documentsList(env, url);
  const tg = p.match(/^\/api\/tg\/([a-z0-9_]+)$/i);
  if (tg) return tgFeed(tg[1].toLowerCase(), url.searchParams.get("before") || "");
  return null;
}
