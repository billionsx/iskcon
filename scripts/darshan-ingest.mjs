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
    slug: "mayapur",
    channel: "ISKCONMayapurGroup",
    name: "ИСККОН Маяпур · Шри Дхама Маяпур",
    deities: "Джайа Панча-таттва · Радха-Мадхава и Аштасакхи · Шри Нрисимхадев",
    srcLabel: "ISKCON Mayapur",
  },
  {
    slug: "vrindavan",
    channel: "iskconvrindavanofficial",
    name: "ИСККОН Вриндаван · Шри Шри Кришна-Баларам Мандир",
    deities: "Джайа Гаура Нитай · Кришна Баларам · Лалита Вишакха Радхе Шьям",
    srcLabel: "ISKCON Vrindavan",
  },
];

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
  // Без эмодзи/заголовка/даты/источника. Абзацы (пустые строки) между блоками.
  // Инвокация Божеств (жирным) · храм · «ISKCON ONE LOVE» ссылкой на канал.
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

async function tg(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${TG}/${method}`, body);
  const j = await r.json();
  if (!j.ok) throw new Error(`${method}: ${JSON.stringify(j)}`);
  return j.result;
}

async function sendDarshanPhoto(photoUrl, captionHtml) {
  // скачиваем байты и грузим multipart — надёжнее, чем отдавать Telegram hotlink на cdn-telegram
  const img = await fetch(photoUrl, { headers: { "User-Agent": "Mozilla/5.0 (compatible; iskcon-one-love/1.0)" } });
  if (!img.ok) throw new Error(`photo fetch ${img.status}`);
  const buf = Buffer.from(await img.arrayBuffer());
  const fd = new FormData();
  fd.append("chat_id", CHANNEL);
  fd.append("caption", captionHtml);
  fd.append("parse_mode", "HTML");
  fd.append("photo", new Blob([buf], { type: img.headers.get("content-type") || "image/jpeg" }), "darshan.jpg");
  return tg("sendPhoto", { method: "POST", body: fd });
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
function alreadyPosted(src) {
  try {
    const res = d1(`SELECT 1 FROM darshan WHERE src_channel='${src.channel}' AND src_post_id='${src._postId}' LIMIT 1`);
    const rows = res?.[0]?.results || [];
    return rows.length > 0;
  } catch { return false; }
}

/* ───────── режимы ───────── */
async function run() {
  const dry = (process.env.DRY_RUN ?? "1") !== "0";
  const preview = [];

  for (const src of SOURCES) {
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

    if (dry) { preview.push(row); continue; }

    // LIVE
    if (alreadyPosted(src)) { preview.push({ ...row, posted: "skip (dedup)" }); continue; }
    const hero = post.photos[0];
    const msg = await sendDarshanPhoto(hero, caption);
    const imagesJson = JSON.stringify(post.photos).replace(/'/g, "''");
    const capSql = caption.replace(/'/g, "''");
    try {
      d1(`INSERT OR IGNORE INTO darshan (date,temple_slug,temple_name,deities,src_channel,src_post_id,images_json,caption,tg_message_id)
          VALUES ('${row.date}','${src.slug}','${src.name.replace(/'/g, "''")}','${src.deities.replace(/'/g, "''")}','${src.channel}','${post.id}','${imagesJson}','${capSql}',${msg.message_id})`);
    } catch (e) { console.error("D1 insert failed (post still sent):", String(e)); }
    preview.push({ ...row, posted: `ok msg_id=${msg.message_id}` });
  }

  mkdirSync("data/darshan", { recursive: true });
  const result = { mode: dry ? "dry-run" : "live", at: new Date().toISOString(), channel: CHANNEL, items: preview };
  writeFileSync("data/darshan/_dryrun.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

run().catch((e) => { console.error(e); process.exit(1); });
