// Probes mayapur.com daily-darshan gallery to design a full-resolution source.
// Goals: (1) does plain fetch() of the index/album HTML already contain image URLs
// (→ no browser needed in production, like Vrindavan)? (2) the full-size image URL
// pattern, (3) real dimensions + byte size of originals vs the Telegram t.me/s preview.
// Runs on GitHub Actions (sandbox has no network to mayapur.com / t.me).
import { writeFileSync, mkdirSync } from "node:fs";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const INDEX_CANDIDATES = [
  "https://www.mayapur.com/media/gallery/daily-darshan",
  "https://mayapur.com/media/gallery/daily-darshan",
];
const uniq = (a) => [...new Set(a)];

async function getText(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA, accept: "text/html,*/*", referer: "https://www.mayapur.com/" }, redirect: "follow" });
  const text = await r.text();
  return { url, finalUrl: r.url, status: r.status, len: text.length, text };
}

// Parse image pixel dimensions from the first bytes of a fetched image.
function dims(buf) {
  const b = new Uint8Array(buf);
  // PNG
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    const dv = new DataView(buf);
    return { fmt: "png", w: dv.getUint32(16), h: dv.getUint32(20) };
  }
  // JPEG
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2; const dv = new DataView(buf);
    while (i < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { i += 2; continue; }
      const segLen = dv.getUint16(i + 2);
      const isSOF = (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf);
      if (isSOF) return { fmt: "jpeg", h: dv.getUint16(i + 5), w: dv.getUint16(i + 7) };
      i += 2 + segLen;
    }
    return { fmt: "jpeg", w: 0, h: 0 };
  }
  // WebP
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    const fourcc = String.fromCharCode(b[12], b[13], b[14], b[15]);
    const dv = new DataView(buf);
    if (fourcc === "VP8X") return { fmt: "webp/x", w: (b[24] | (b[25] << 8) | (b[26] << 16)) + 1, h: (b[27] | (b[28] << 8) | (b[29] << 16)) + 1 };
    if (fourcc === "VP8L") { const n = dv.getUint32(21, true); return { fmt: "webp/l", w: (n & 0x3fff) + 1, h: ((n >> 14) & 0x3fff) + 1 }; }
    if (fourcc === "VP8 ") return { fmt: "webp", w: dv.getUint16(26, true) & 0x3fff, h: dv.getUint16(28, true) & 0x3fff };
    return { fmt: "webp", w: 0, h: 0 };
  }
  return { fmt: "?", w: 0, h: 0 };
}

async function measure(url) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, referer: "https://www.mayapur.com/" } });
    if (!r.ok) return { url, status: r.status };
    const buf = await r.arrayBuffer();
    const d = dims(buf);
    return { url, status: 200, bytes: buf.byteLength, ...d };
  } catch (e) { return { url, error: String(e).slice(0, 120) }; }
}

const out = { at: new Date().toISOString(), index: null, album: null, plain_image_urls: [], measured: [], telegram: null, notes: [] };

// ── 1. Gallery index via plain fetch ──────────────────────────────
let indexHtml = "";
for (const u of INDEX_CANDIDATES) {
  try {
    const g = await getText(u);
    if (g.status === 200 && g.len > 500) {
      out.index = { tried: u, finalUrl: g.finalUrl, status: g.status, len: g.len };
      indexHtml = g.text;
      break;
    }
    out.notes.push(`index ${u} → HTTP ${g.status} len ${g.len}`);
  } catch (e) { out.notes.push(`index ${u} → ${String(e).slice(0, 120)}`); }
}

// album links + nearby date labels
const albumIds = [];
if (indexHtml) {
  const re = /\/media\/album\/(\d+)/g; let m;
  while ((m = re.exec(indexHtml))) albumIds.push(m[1]);
  out.index.album_ids_in_order = uniq(albumIds).slice(0, 12);
  // capture a slice around the first album link to eyeball date placement
  const firstIdx = indexHtml.indexOf("/media/album/");
  out.index.sample = firstIdx >= 0 ? indexHtml.slice(Math.max(0, firstIdx - 320), firstIdx + 320).replace(/\s+/g, " ") : "(no album link in raw html — likely JS-rendered)";
  // any image URLs straight on the index (thumbs)
  const imgRe = /https?:\/\/[^\s"')]+\.(?:jpe?g|png|webp)/gi;
  out.index.image_urls_sample = uniq((indexHtml.match(imgRe) || [])).slice(0, 8);
}

// ── 2. Newest album page via plain fetch ──────────────────────────
const newestId = uniq(albumIds)[0];
if (newestId) {
  for (const host of ["https://www.mayapur.com", "https://mayapur.com"]) {
    try {
      const a = await getText(`${host}/media/album/${newestId}`);
      if (a.status === 200 && a.len > 500) {
        out.album = { id: newestId, url: a.finalUrl, status: a.status, len: a.len };
        const imgRe = /https?:\/\/[^\s"')]+\.(?:jpe?g|png|webp)/gi;
        const all = uniq(a.text.match(imgRe) || []);
        // storage/albums originals are the full-size ones; thumbs usually have /thumb or /small
        const originals = all.filter((u) => /storage|albums|upload|media/i.test(u) && !/thumb|small|icon|logo|avatar|favicon/i.test(u));
        out.album.all_image_urls = all.slice(0, 30);
        out.album.likely_originals = originals.slice(0, 30);
        out.plain_image_urls = originals.length ? originals : all;
        // sample raw context around first storage url
        const si = a.text.search(/storage|albums/i);
        out.album.sample = si >= 0 ? a.text.slice(Math.max(0, si - 200), si + 260).replace(/\s+/g, " ") : "(no storage/albums token)";
        break;
      }
      out.notes.push(`album ${host}/media/album/${newestId} → HTTP ${a.status} len ${a.len}`);
    } catch (e) { out.notes.push(`album → ${String(e).slice(0, 120)}`); }
  }
}

// ── 3. Measure real dimensions/bytes of up to 5 candidate originals ─
const toMeasure = (out.plain_image_urls || []).slice(0, 5);
for (const u of toMeasure) out.measured.push(await measure(u));

// ── 4. Telegram t.me/s preview for before/after comparison ─────────
try {
  const t = await getText("https://t.me/s/ISKCONMayapurGroup");
  const phRe = /tgme_widget_message_photo_wrap[^>]*background-image:url\('([^']+)'\)/g;
  const tgImgs = []; let pm;
  while ((pm = phRe.exec(t.text))) tgImgs.push(pm[1].replace(/&amp;/g, "&"));
  out.telegram = { count: tgImgs.length, sample_urls: uniq(tgImgs).slice(0, 3), measured: [] };
  for (const u of uniq(tgImgs).slice(0, 2)) out.telegram.measured.push(await measure(u));
} catch (e) { out.telegram = { error: String(e).slice(0, 140) }; }

mkdirSync("data/darshan", { recursive: true });
writeFileSync("data/darshan/_mayapur.json", JSON.stringify(out, null, 2));
console.log("mayapur probe written");
console.log("index:", out.index?.status, "albums:", out.index?.album_ids_in_order);
console.log("album:", out.album?.id, "originals:", (out.album?.likely_originals || []).length);
console.log("measured:", out.measured);
console.log("telegram:", out.telegram?.measured);
