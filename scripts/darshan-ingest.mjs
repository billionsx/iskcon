// scripts/darshan-ingest.mjs
//
// Ежедневный ингест даршанов: читает ПУБЛИЧНЫЕ Telegram-каналы храмов через t.me/s
// (та же механика и парсер, что и боевая Лента @iskcone в apps/web/workerHome.ts),
// выбирает свежий пост-даршан, собирает подпись в фирменном стиле канала и:
//   • DRY_RUN=1 (по умолчанию) — НИЧЕГО не постит: складывает превью в data/darshan/_dryrun.json
//   • DRY_RUN=0                — публикует фото в @iskcone (sendPhoto) и пишет строку в D1
//
// Никаких зависимостей: Node 20 (глобальные fetch / FormData / Blob).
//
// ENV: DRY_RUN, TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL,
//      CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID

import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

/* ───────── источники ───────── */
// Якоря — две дхамы. «Гостевой» храм добавим ротацией позже.
const SOURCES = [
  {
    // Маяпур: основной источник — полноразмерные оригиналы (~1920px) из официальной
    // галереи даршана сайта храма (mayapur.com). Если сайт недоступен — запас:
    // свежайший даршанный пост канала (channel, превью t.me/s — те же 800px).
    slug: "mayapur",
    kind: "site",
    site: "mayapur",
    srcKey: "site:mayapur",
    channel: "ISKCONMayapurGroup",
    galleryName: "Daily Darshan",
    name: "ИСККОН Маяпур · Шри Дхама Маяпур",
    deities: "Джайа Панча-таттва · Радха-Мадхава и Аштасакхи · Шри Нрисимхадев",
    srcLabel: "ISKCON Mayapur",
    // Подпись поста (задана основателем): инвокация Божеств жирным · храм · ссылка на канал.
    capLines: [
      "<b>Радха-Мадхава и Аштасакхи · Панча-таттва · Прахлада-Нрисимхадев</b>",
      "",
      "ИСККОН Маяпур",
      "",
      '<a href="https://t.me/iskcone">ISKCON ONE LOVE</a>',
    ],
  },
  {
    // Вриндаван: источник — собственный сайт храма (галерея «Sringar Darshan»).
    // Оригиналы 2048px со всех трёх алтарей; чистый JSON .data, без браузера.
    slug: "vrindavan",
    kind: "site",
    srcKey: "site:iskconvrindavan",
    galleryType: "2",
    gallerySlug: "sringar-darshan",
    galleryName: "Sringar Darshan",
    name: "ИСККОН Вриндаван · Шри Шри Кришна-Баларам Мандир",
    deities: "Джайа Гаура Нитай · Кришна Баларам · Лалита Вишакха Радхе Шьям",
    srcLabel: "ISKCON Vrindavan",
  },
];

/* ───────── источник: сайт храма (галерея даршана) ───────── */
const SITE_CDN = "https://cdn.iskconvrindavan.com";
const SITE_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
function istToday() {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date());
}
// Отбор k фото из всех: выкидываем (n-k) равномерно вразброс, порядок сохраняем.
// Так при 23→20 удаляются лишь 3 кадра «через равные промежутки» — все алтари остаются.
function pickSpread(arr, k) {
  const n = arr.length;
  if (n <= k) return arr.slice();
  const dropCount = n - k;
  const drop = new Set();
  for (let i = 0; i < dropCount; i++) drop.add(Math.round(((i + 1) * n) / (dropCount + 1)));
  let j = 0; while (drop.size < dropCount && j < n) { if (!drop.has(j)) drop.add(j); j++; }
  return arr.filter((_, i) => !drop.has(i));
}
// Один пост Вриндавана = выбранные кадры. Сайт отдаёт неразмеченный упорядоченный список
// (все три алтаря, ~21 фото, без тегов по Божеству). Раскладка задана позициями в галерее
// (порядок на сайте у храма стабильный изо дня в день). Индексы получены из отбора основателя:
// Гаура-Нитай [0,1] · Кришна-Баларам [4,3] · Радхе-Шьям и сакхи [6,9,10,7,8] — итог 9 фото в этом порядке.
// Переопределить можно переменной репозитория VRINDAVAN_LAYOUT (JSON с gn/kb/rs).
const DEFAULT_VRINDAVAN_LAYOUT = { gn: [0, 1], kb: [4, 3], rs: [6, 9, 10, 7, 8] };
const VRINDAVAN_LAYOUT = process.env.VRINDAVAN_LAYOUT ? JSON.parse(process.env.VRINDAVAN_LAYOUT) : DEFAULT_VRINDAVAN_LAYOUT;
function selectVrindavan(images) {
  const L = VRINDAVAN_LAYOUT;
  if (L) {
    const order = [...(L.gn || []), ...(L.kb || []), ...(L.rs || [])];
    const picked = order.map((i) => images[i]).filter((x) => typeof x === "string");
    if (picked.length === order.length && picked.length > 0) return picked.slice(0, 10); // все позиции на месте — берём ровно выбранное
  }
  return pickSpread(images, 10); // запас: порядок сменился/мало фото — равномерный спред всех алтарей
}
// Тянет галерею даршана за дату (DARSHAN_DATE или сегодня IST). Возвращает порядок фото как на сайте.
async function fetchSiteGallery(src) {
  const date = process.env.DARSHAN_DATE || istToday();
  const url = `https://iskconvrindavan.com/daily-darshan-gallery/${date}/${src.galleryType}/${src.gallerySlug}.data`;
  const pageUrl = `https://iskconvrindavan.com/daily-darshan-gallery/${date}/${src.galleryType}/${src.gallerySlug}`;
  const r = await fetch(url, { headers: { "User-Agent": SITE_UA, accept: "*/*", referer: "https://iskconvrindavan.com/daily-darshan-gallery" } });
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  const t = await r.text();
  const re = /static\/static-_[0-9a-zA-Z]+\.(?:jpe?g|png|webp)/g;
  const seen = new Set(); const paths = []; let m;
  while ((m = re.exec(t))) { if (!seen.has(m[0])) { seen.add(m[0]); paths.push(m[0]); } }
  const name = (t.match(/"gallery_name","([^"]+)"/) || [])[1] || src.galleryName || "Darshan";
  return { date, name, pageUrl, images: paths.map((p) => `${SITE_CDN}/${p}`) };
}

/* ── источник: галерея даршана Маяпура (mayapur.com, оригиналы ~1920px) ──
   Индекс server-rendered (блоки «дата DD/MM/YYYY → /media/album/N»). Полные кадры
   отдаёт server-rendered смотрелка /imageviewer/show-album-pictures/N/0 списком
   /storage/albums/N/{hash}_image.jpg — браузер не нужен (как у Вриндавана). */
const MAYAPUR = "https://www.mayapur.com";
function ddmmyyyyIST() {
  const p = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Kolkata" }).formatToParts(new Date());
  const g = (k) => (p.find((x) => x.type === k) || { value: "" }).value;
  return `${g("day")}/${g("month")}/${g("year")}`;
}
async function fetchMayapurGallery(src) {
  const ri = await fetch(`${MAYAPUR}/media/gallery/daily-darshan`, {
    headers: { "User-Agent": SITE_UA, accept: "text/html,*/*", referer: `${MAYAPUR}/` },
  });
  if (!ri.ok) throw new Error(`${MAYAPUR}/media/gallery/daily-darshan → HTTP ${ri.status}`);
  const html = await ri.text();
  const blocks = [];
  const re = /<p>\s*(\d{2}\/\d{2}\/\d{4})\s*<\/p>[\s\S]{0,220}?\/media\/album\/(\d+)/g;
  let m;
  while ((m = re.exec(html))) blocks.push({ date: m[1], id: m[2] });
  if (!blocks.length) {
    const idre = /\/media\/album\/(\d+)/g; const ids = []; let mm;
    while ((mm = idre.exec(html))) ids.push(mm[1]);
    const first = [...new Set(ids)][0];
    if (!first) throw new Error("mayapur gallery: no album links found");
    blocks.push({ date: null, id: first });
  }
  const today = process.env.DARSHAN_DATE
    ? process.env.DARSHAN_DATE.split("-").reverse().join("/")
    : ddmmyyyyIST();
  // Берём сегодняшний альбом; если его на сайте ещё нет — свежайший. От дубля вчерашнего
  // защищает mayapurPostedForDate() (см. ниже): уже опубликованная дата не постится повторно.
  const chosen = blocks.find((b) => b.date === today) || blocks[0];
  const albumId = chosen.id;
  const rv = await fetch(`${MAYAPUR}/imageviewer/show-album-pictures/${albumId}/0`, {
    headers: { "User-Agent": SITE_UA, accept: "text/html,*/*", referer: `${MAYAPUR}/media/album/${albumId}` },
  });
  if (!rv.ok) throw new Error(`${MAYAPUR}/imageviewer/show-album-pictures/${albumId}/0 → HTTP ${rv.status}`);
  const vt = await rv.text();
  const imgRe = new RegExp(`storage/albums/${albumId}/[A-Za-z0-9]+_image\\.(?:jpe?g|png|webp)`, "gi");
  const seen = new Set(); const paths = []; let p;
  while ((p = imgRe.exec(vt))) { if (!seen.has(p[0])) { seen.add(p[0]); paths.push(p[0]); } }
  const date = chosen.date ? chosen.date.split("/").reverse().join("-") : istToday();
  const pageUrl = `${MAYAPUR}/media/album/${albumId}`;
  return { date, albumId, name: src.galleryName || "Daily Darshan", pageUrl, images: paths.map((x) => `${MAYAPUR}/${x}`) };
}

/* ───────── парсер t.me/s (порт из workerHome.ts) ───────── */
const deent = (s) => s
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ");
const plain = (s) => deent(s.replace(/<[^>]+>/g, ""));

function parseBlock(b) {
  const idM = b.match(/data-post="[^"/]+\/(\d+)"/);
  if (!idM) return null;
  const dateM = b.match(/<time datetime="([^"]+)"/);
  const textM = b.match(/tgme_widget_message_text js-message_text[^>]*>([\s\S]*?)<\/div>/);
  const text = textM ? plain(textM[1].replace(/<br\s*\/?>/gi, "\n")).replace(/\n{3,}/g, "\n\n").trim() : "";
  const photos = [];
  const phRe = /tgme_widget_message_photo_wrap[^>]*background-image:url\('([^']+)'\)/g;
  let ph;
  while ((ph = phRe.exec(b))) photos.push(deent(ph[1]));
  if (!text && !photos.length) return null;
  return { id: idM[1], date: dateM ? dateM[1] : "", text, photos };
}

async function fetchChannel(channel) {
  const r = await fetch(`https://t.me/s/${channel}`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; iskcon-one-love/1.0)" },
  });
  if (!r.ok) throw new Error(`t.me/s/${channel} → HTTP ${r.status}`);
  const html = await r.text();
  const posts = [];
  for (const b of html.split("tgme_widget_message_wrap").slice(1)) {
    const p = parseBlock(b);
    if (p) posts.push(p);
  }
  posts.reverse(); // свежие сверху
  return posts;
}

// выбираем свежий пост-даршан: приоритет постам с фото и «даршанной» лексикой,
// иначе — просто самый свежий пост с фото.
const DARSHAN_RE = /darshan|даршан|mangala|mangal|shringar|sringar|aarti|arati|abhishek|rajbhog|raj bhog|sandhya|deity|deities|gaura|nitai|radha|krishna|kṛṣṇa|balaram|madhava/i;
function pickDarshan(posts) {
  const withPhoto = posts.filter((p) => p.photos.length);
  return withPhoto.find((p) => DARSHAN_RE.test(p.text)) || withPhoto[0] || null;
}

/* ───────── подпись в стиле канала (🦚 ISKCON ONE LOVE) ───────── */
function humanDate(iso) {
  const d = iso ? new Date(iso) : new Date();
  const day = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(d).replace(/\s*г\.$/, "");
  const wd = new Intl.DateTimeFormat("ru-RU", { weekday: "long", timeZone: "Asia/Kolkata" }).format(d);
  return `${day}, ${wd}`;
}
function ymd(iso) {
  const d = iso ? new Date(iso) : new Date();
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Kolkata" }).format(d);
}
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function composeCaption(src) {
  // Если у источника задана собственная подпись (capLines) — используем её дословно.
  if (Array.isArray(src.capLines)) return src.capLines.join("\n");
  // Иначе дефолт: Божества (жирным) · храм · «ISKCON ONE LOVE» ссылкой на канал.
  return [
    `<b>${esc(src.deities)}</b>`,
    "",
    esc(src.name),
    "",
    '<a href="https://t.me/iskcone">ISKCON ONE LOVE</a>',
  ].join("\n");
}

/* ───────── Telegram + D1 (только LIVE) ───────── */
const TG = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL = process.env.TELEGRAM_CHANNEL || "@iskcone";
const RESULT = { mode: null, at: null, channel: CHANNEL, db_rows: null, progress: [], items: [] };

async function tg(method, body, _retry = 0) {
  const r = await fetch(`https://api.telegram.org/bot${TG}/${method}`, body);
  const j = await r.json().catch(() => ({}));
  if (!j.ok) {
    const ra = j.parameters && j.parameters.retry_after;
    if ((r.status === 429 || ra) && _retry < 3) {
      await new Promise((res) => setTimeout(res, ((ra ? ra : 2) * 1000) + 500));
      return tg(method, body, _retry + 1);
    }
    throw new Error(`${method}: HTTP ${r.status} ${JSON.stringify(j)}`);
  }
  return j.result;
}

async function sendDarshanPhoto(photoUrl, captionHtml) {
  // скачиваем байты и грузим multipart — надёжнее, чем отдавать Telegram hotlink на cdn-telegram
  const img = await fetch(photoUrl, { headers: { "User-Agent": "Mozilla/5.0 (compatible; iskcon-one-love/1.0)" } });
  if (!img.ok) throw new Error(`photo fetch ${img.status}`);
  const buf = Buffer.from(await img.arrayBuffer());
  const fd = new FormData();
  fd.append("chat_id", CHANNEL);
  if (captionHtml) { fd.append("caption", captionHtml); fd.append("parse_mode", "HTML"); }
  fd.append("photo", new Blob([buf], { type: img.headers.get("content-type") || "image/jpeg" }), "darshan.jpg");
  return tg("sendPhoto", { method: "POST", body: fd });
}

// Альбом (медиагруппа): все фото даршана; подпись — на первом элементе.
async function sendDarshanAlbum(photoUrls, captionHtml) {
  const urls = photoUrls.slice(0, 10); // Telegram: максимум 10 в группе
  const fd = new FormData();
  fd.append("chat_id", CHANNEL);
  const ok = [];
  for (let i = 0; i < urls.length; i++) {
    let img;
    try { img = await fetch(urls[i], { headers: { "User-Agent": "Mozilla/5.0 (compatible; iskcon-one-love/1.0)" } }); }
    catch { continue; }
    if (!img.ok) continue;
    const buf = Buffer.from(await img.arrayBuffer());
    const name = `photo${i}`;
    fd.append(name, new Blob([buf], { type: img.headers.get("content-type") || "image/jpeg" }), `${name}.jpg`);
    ok.push({ name, url: urls[i] });
  }
  if (ok.length === 0) throw new Error("no photos downloaded");
  if (ok.length === 1) return sendDarshanPhoto(ok[0].url, captionHtml);
  const media = ok.map((o, idx) => {
    const it = { type: "photo", media: `attach://${o.name}` };
    if (idx === 0) { it.caption = captionHtml; it.parse_mode = "HTML"; }
    return it;
  });
  fd.append("media", JSON.stringify(media));
  const res = await tg("sendMediaGroup", { method: "POST", body: fd });
  return Array.isArray(res) ? res[0] : res;
}

// Несколько альбомов подряд (сайт: до 20 фото → 2 группы по 10). Подпись — только на первом альбоме.
async function sendAlbumChunk(urls, captionHtml) {
  const fd = new FormData();
  fd.append("chat_id", CHANNEL);
  const ok = [];
  for (let i = 0; i < urls.length; i++) {
    let img; try { img = await fetch(urls[i], { headers: { "User-Agent": SITE_UA } }); } catch { continue; }
    if (!img.ok) continue;
    const buf = Buffer.from(await img.arrayBuffer());
    const name = `photo${i}`;
    fd.append(name, new Blob([buf], { type: img.headers.get("content-type") || "image/jpeg" }), `${name}.jpg`);
    ok.push({ name, url: urls[i] });
  }
  if (ok.length === 0) throw new Error("no photos downloaded");
  if (ok.length === 1) { const m = await sendDarshanPhoto(ok[0].url, captionHtml || ""); return [m]; }
  const media = ok.map((o, idx) => {
    const it = { type: "photo", media: `attach://${o.name}` };
    if (idx === 0 && captionHtml) { it.caption = captionHtml; it.parse_mode = "HTML"; }
    return it;
  });
  fd.append("media", JSON.stringify(media));
  const res = await tg("sendMediaGroup", { method: "POST", body: fd });
  return Array.isArray(res) ? res : [res];
}
async function sendDarshanAlbums(urls, captionHtml, perAlbum = 10, maxAlbums = 2) {
  const sel = urls.slice(0, perAlbum * maxAlbums);
  const chunks = [];
  for (let i = 0; i < sel.length; i += perAlbum) chunks.push(sel.slice(i, i + perAlbum));
  let anchorId = 0; const ids = [];
  for (let ci = 0; ci < chunks.length; ci++) {
    const msgs2 = await sendAlbumChunk(chunks[ci], ci === 0 ? captionHtml : null);
    const albIds = msgs2.map((m) => m && m.message_id).filter(Boolean);
    if (ci === 0 && albIds.length) anchorId = albIds[0];
    ids.push(...albIds);
    RESULT.progress.push({ album: ci + 1, ids: albIds, count: chunks[ci].length });
    if (ci < chunks.length - 1) await new Promise((res) => setTimeout(res, 4000));
  }
  return { anchorId, ids };
}

// D1 через wrangler (CLOUDFLARE_API_TOKEN + account_id из env). База биндится в apps/web/wrangler.toml как «iskcon».
function d1(sql) {
  const out = execFileSync("npx", ["wrangler", "d1", "execute", "iskcon", "--remote", "--json", "--config", "apps/web/wrangler.toml", "--command", sql], {
    encoding: "utf8",
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  try { return JSON.parse(out); } catch { return null; }
}
function alreadyPostedKey(channel, postId) {
  if (process.env.FORCE === "1") return false;
  try {
    const res = d1(`SELECT 1 FROM darshan WHERE src_channel='${channel}' AND src_post_id='${postId}' LIMIT 1`);
    const rows = res?.[0]?.results || [];
    return rows.length > 0;
  } catch { return false; }
}
function alreadyPosted(src) { return alreadyPostedKey(src.channel, src._postId); }
// Маяпур: гарантия «один даршан в день» независимо от источника (сайт vs Telegram-запас).
// Вчерашний постился под Telegram-ключом, сегодня — под site:mayapur; сверяем по дате+храму.
function mayapurPostedForDate(date) {
  if (process.env.FORCE === "1") return false;
  try {
    const res = d1(`SELECT 1 FROM darshan WHERE temple_slug='mayapur' AND date='${date}' LIMIT 1`);
    return (res?.[0]?.results || []).length > 0;
  } catch { return false; }
}

/* ───────── режимы ───────── */
async function run() {
  const dry = (process.env.DRY_RUN ?? "1") !== "0";
  const only = (process.env.ONLY || "").split(",").map((s) => s.trim()).filter(Boolean);

  if (process.env.DELETE_IDS) {
    const raw = process.env.DELETE_IDS.split(",").map((s) => s.trim()).filter(Boolean);
    const ids = [];
    for (const tok of raw) { const m = tok.match(/^(\d+)-(\d+)$/); if (m) { for (let n = +m[1]; n <= +m[2]; n++) ids.push(String(n)); } else ids.push(tok); }
    const res = [];
    for (const id of ids) {
      try { await tg("deleteMessage", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: CHANNEL, message_id: Number(id) }) }); res.push({ id, ok: true }); }
      catch (e) { res.push({ id, err: String(e).slice(0, 120) }); }
      await new Promise((r) => setTimeout(r, 200));
    }
    const okN = res.filter((x) => x.ok).length;
    RESULT.mode = "cleanup"; RESULT.at = new Date().toISOString(); RESULT.deleted = res; RESULT.deleted_ok = okN;
    mkdirSync("data/darshan", { recursive: true });
    writeFileSync("data/darshan/_dryrun.json", JSON.stringify(RESULT, null, 2));
    console.log("deleted ok:", okN, "of", ids.length);
    return;
  }

  if (process.env.DIAG === "1") {
    const dc = (process.env.DIAG_CHANNELS || "").split(",").map((s) => s.trim()).filter(Boolean);
    const targets = dc.length ? dc.map((c) => ({ slug: c, channel: c })) : SOURCES.filter((s) => s.kind === "tg" && (!only.length || only.includes(s.slug)));
    const out = [];
    for (const src of targets) {
      let posts;
      try { posts = await fetchChannel(src.channel); } catch (e) { out.push({ slug: src.slug, error: String(e) }); continue; }
      const list = posts.slice(0, 20).filter((p) => p.photos.length).map((p) => {
        const d = p.date ? new Date(p.date) : null;
        const ist = d ? new Intl.DateTimeFormat("ru-RU", { weekday: "short", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", timeZone: "Asia/Kolkata" }).format(d) : "";
        return { id: p.id, ist_time: ist, photos: p.photos.length, head: (p.text || "").slice(0, 80), url: `https://t.me/${src.channel}/${p.id}` };
      });
      out.push({ slug: src.slug, posts: list });
    }
    mkdirSync("data/darshan", { recursive: true });
    writeFileSync("data/darshan/_dryrun.json", JSON.stringify({ mode: "diag", at: new Date().toISOString(), sources: out }, null, 2));
    console.log("diag written");
    return;
  }

  const preview = [];

  for (const src of SOURCES) {
    if (only.length && !only.includes(src.slug)) continue;

    if (src.kind === "site") {
      let gal = null;
      try { gal = src.site === "mayapur" ? await fetchMayapurGallery(src) : await fetchSiteGallery(src); }
      catch (e) {
        // Вриндаван — пропускаем источник; Маяпур — падаем в Telegram-запас ниже.
        if (src.site !== "mayapur") { preview.push({ slug: src.slug, error: String(e) }); continue; }
        gal = null;
      }
      if (gal && gal.images.length) {
        src._postId = src.site === "mayapur" ? `album/${gal.albumId}` : `${gal.date}/${src.galleryType}`;
        const caption = composeCaption(src);
        const imgsSel = src.site === "mayapur" ? pickSpread(gal.images, 10) : selectVrindavan(gal.images);
        const row = {
          slug: src.slug, kind: "site", date: gal.date, temple_name: src.name, deities: src.deities,
          src_channel: src.srcKey, src_post_id: src._postId, src_url: gal.pageUrl, gallery_name: gal.name,
          photo_count: gal.images.length, albums_planned: 1,
          photos: imgsSel, caption_preview: caption,
        };
        if (alreadyPostedKey(src.srcKey, src._postId)) { preview.push({ ...row, posted: "skip (dedup)" }); continue; }
        if (src.site === "mayapur" && mayapurPostedForDate(gal.date)) { preview.push({ ...row, posted: `skip (даршан Маяпура за ${gal.date} уже опубликован)` }); continue; }
        if (dry) { preview.push(row); continue; }
        const sent = await sendDarshanAlbums(imgsSel, caption, 10, 1);
        const anchorId = sent.anchorId || 0;
        const msgIds = sent.ids;
        const imagesJson = JSON.stringify(imgsSel).replace(/'/g, "''");
        const capSql = caption.replace(/'/g, "''");
        try {
          d1(`INSERT INTO darshan (date,temple_slug,temple_name,deities,src_channel,src_post_id,images_json,caption,tg_message_id)
              VALUES ('${gal.date}','${src.slug}','${src.name.replace(/'/g, "''")}','${src.deities.replace(/'/g, "''")}','${src.srcKey}','${src._postId}','${imagesJson}','${capSql}',${anchorId})
              ON CONFLICT(src_channel,src_post_id) DO UPDATE SET tg_message_id=excluded.tg_message_id, images_json=excluded.images_json, caption=excluded.caption, date=excluded.date`);
        } catch (e) { console.error("D1 insert failed (post still sent):", String(e)); }
        preview.push({ ...row, posted: `ok msgs=${msgIds.join(",")}` });
        continue;
      }
      // Галерея пуста/недоступна.
      if (src.site !== "mayapur") { preview.push({ slug: src.slug, date: gal && gal.date, error: `site gallery empty` }); continue; }
      // Маяпур: НЕ continue — проваливаемся в Telegram-блок (src.channel) ниже.
    }

    let posts;
    try { posts = await fetchChannel(src.channel); }
    catch (e) { preview.push({ slug: src.slug, error: String(e) }); continue; }

    const post = pickDarshan(posts);
    if (!post) { preview.push({ slug: src.slug, error: "no darshan post with photo found" }); continue; }
    src._postId = post.id;

    const caption = composeCaption(src);
    const row = {
      slug: src.slug,
      date: ymd(post.date),
      temple_name: src.name,
      deities: src.deities,
      src_channel: src.channel,
      src_post_id: post.id,
      src_url: `https://t.me/${src.channel}/${post.id}`,
      photos: post.photos,
      photo_count: post.photos.length,
      caption_preview: caption,
      source_text_head: (post.text || "").slice(0, 200),
    };

    // дедуп (и в dry-режиме показываем, что будет пропущено)
    if (alreadyPosted(src)) { preview.push({ ...row, posted: "skip (dedup)" }); continue; }
    if (src.slug === "mayapur" && mayapurPostedForDate(row.date)) { preview.push({ ...row, posted: `skip (даршан Маяпура за ${row.date} уже опубликован)` }); continue; }
    if (dry) { preview.push(row); continue; }

    // LIVE
    const msg = await sendDarshanAlbum(post.photos, caption);
    const imagesJson = JSON.stringify(post.photos).replace(/'/g, "''");
    const capSql = caption.replace(/'/g, "''");
    try {
      d1(`INSERT INTO darshan (date,temple_slug,temple_name,deities,src_channel,src_post_id,images_json,caption,tg_message_id)
          VALUES ('${row.date}','${src.slug}','${src.name.replace(/'/g, "''")}','${src.deities.replace(/'/g, "''")}','${src.channel}','${post.id}','${imagesJson}','${capSql}',${msg.message_id})
          ON CONFLICT(src_channel,src_post_id) DO UPDATE SET tg_message_id=excluded.tg_message_id, images_json=excluded.images_json, caption=excluded.caption, date=excluded.date`);
    } catch (e) { console.error("D1 insert failed (post still sent):", String(e)); }
    preview.push({ ...row, posted: `ok msg_id=${msg.message_id}` });
  }

  let dbRows = null;
  if (!dry) {
    try {
      const res = d1("SELECT COUNT(*) AS n FROM darshan");
      dbRows = res?.[0]?.results?.[0]?.n ?? null;
    } catch (e) { dbRows = "error: " + String(e).slice(0, 140); }
  }

  RESULT.mode = dry ? "dry-run" : "live";
  RESULT.at = new Date().toISOString();
  RESULT.db_rows = dbRows;
  RESULT.items = preview;
  mkdirSync("data/darshan", { recursive: true });
  writeFileSync("data/darshan/_dryrun.json", JSON.stringify(RESULT, null, 2));
  console.log(JSON.stringify(RESULT, null, 2));
}

run().catch((e) => {
  RESULT.error = String((e && e.stack) || e).slice(0, 1400);
  RESULT.mode = RESULT.mode || ((process.env.DRY_RUN ?? "1") !== "0" ? "dry-run" : "live");
  RESULT.at = new Date().toISOString();
  try { mkdirSync("data/darshan", { recursive: true }); writeFileSync("data/darshan/_dryrun.json", JSON.stringify(RESULT, null, 2)); } catch {}
  console.error(e);
  process.exit(1);
});
