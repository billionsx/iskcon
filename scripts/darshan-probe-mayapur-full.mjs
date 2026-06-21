// Confirms the FULL-SIZE original URL for mayapur.com album photos and measures
// real dimensions. Album thumbnails are /storage/albums/{N}/{HASH}_thumbnail.jpg;
// we test the de-thumbnailed original /storage/albums/{N}/{HASH}.jpg and a few
// variants, and inspect how the hashes are embedded in the album HTML + the
// /imageviewer route, so production can fetch full-res without a browser.
import { writeFileSync, mkdirSync } from "node:fs";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const ALBUM = process.env.ALBUM_ID || "594";
const uniq = (a) => [...new Set(a)];

function dims(buf) {
  const b = new Uint8Array(buf); const dv = new DataView(buf);
  if (b[0] === 0x89 && b[1] === 0x50) return { fmt: "png", w: dv.getUint32(16), h: dv.getUint32(20) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m === 0xd8 || m === 0xd9 || (m >= 0xd0 && m <= 0xd7) || m === 0x01) { i += 2; continue; }
      const len = dv.getUint16(i + 2);
      if ((m >= 0xc0 && m <= 0xc3) || (m >= 0xc5 && m <= 0xc7) || (m >= 0xc9 && m <= 0xcb) || (m >= 0xcd && m <= 0xcf))
        return { fmt: "jpeg", h: dv.getUint16(i + 5), w: dv.getUint16(i + 7) };
      i += 2 + len;
    }
  }
  return { fmt: "?", w: 0, h: 0 };
}
async function getText(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA, referer: "https://www.mayapur.com/" }, redirect: "follow" });
  return { status: r.status, finalUrl: r.url, text: await r.text() };
}
async function measure(url) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, referer: "https://www.mayapur.com/" } });
    if (!r.ok) return { url, status: r.status };
    const buf = await r.arrayBuffer();
    return { url, status: 200, bytes: buf.byteLength, ...dims(buf) };
  } catch (e) { return { url, error: String(e).slice(0, 120) }; }
}

const out = { at: new Date().toISOString(), album: ALBUM, hashes: [], html_embed: null, originals_test: [], imageviewer: null, notes: [] };

// 1. album page raw HTML → extract hashes, see how they're embedded
let html = "";
try {
  const a = await getText(`https://www.mayapur.com/media/album/${ALBUM}`);
  html = a.text;
  out.html_len = html.length;
  // hashes from _thumbnail refs if present in raw html
  const rt = new RegExp(`albums/${ALBUM}/([A-Za-z0-9]+)_thumbnail`, "g"); let m;
  const hs = []; while ((m = rt.exec(html))) hs.push(m[1]);
  // fallback: JS arrays of short tokens near picture/image keywords
  if (!hs.length) {
    const tokRe = /["']([A-Za-z0-9]{8})["']/g; let t;
    const cand = []; while ((t = tokRe.exec(html))) cand.push(t[1]);
    out.notes.push("no _thumbnail in raw html; 8-char token candidates: " + uniq(cand).slice(0, 20).join(","));
  }
  out.hashes = uniq(hs);
  // capture how a hash is embedded
  if (out.hashes.length) {
    const idx = html.indexOf(out.hashes[0]);
    out.html_embed = html.slice(Math.max(0, idx - 120), idx + 160).replace(/\s+/g, " ");
  } else {
    const si = html.search(/storage|albums|picture|gallery|imageviewer/i);
    out.html_embed = si >= 0 ? html.slice(Math.max(0, si - 80), si + 240).replace(/\s+/g, " ") : "(none)";
  }
} catch (e) { out.notes.push("album html: " + String(e).slice(0, 120)); }

// known hashes from prior render probe (fallback if raw html had none)
const KNOWN = ["FEs7Hcfs", "xjiHhlI9", "W3nnxoCc", "vfnNUs3J", "xbo3t9Ir", "jYxHJOct", "R8S140iw", "YxO0lndb", "noebNMMm", "MhoaKVZv"];
const hashes = out.hashes.length ? out.hashes : KNOWN;

// 2. test full-size original variants for the first hash
const h0 = hashes[0];
const base = `https://www.mayapur.com/storage/albums/${ALBUM}/${h0}`;
const variants = [`${base}.jpg`, `${base}_large.jpg`, `${base}_full.jpg`, `${base}_original.jpg`, `${base}_thumbnail.jpg`];
for (const u of variants) out.originals_test.push(await measure(u));

// 3. imageviewer route — does it expose the full image url server-side?
try {
  const iv = await getText(`https://www.mayapur.com/imageviewer/show-album-pictures/${ALBUM}/0`);
  out.imageviewer = { status: iv.status, len: iv.text.length };
  const imgRe = new RegExp(`/storage/albums/${ALBUM}/[A-Za-z0-9]+(?:_[a-z]+)?\\.(?:jpe?g|png|webp)`, "gi");
  const found = uniq(iv.text.match(imgRe) || []);
  out.imageviewer.storage_urls = found.slice(0, 20);
  const nonThumb = found.filter((u) => !/_thumbnail/i.test(u));
  if (nonThumb.length) out.imageviewer.measured = await measure(`https://www.mayapur.com${nonThumb[0]}`);
  const si = iv.text.search(new RegExp(`albums/${ALBUM}`, "i"));
  out.imageviewer.sample = si >= 0 ? iv.text.slice(Math.max(0, si - 120), si + 200).replace(/\s+/g, " ") : "(no storage url; maybe JS-rendered)";
} catch (e) { out.notes.push("imageviewer: " + String(e).slice(0, 120)); }

// 4. measure full-size for ALL hashes via the winning pattern (.jpg strip) for a count/quality summary
const winners = [];
for (const h of hashes) winners.push(await measure(`https://www.mayapur.com/storage/albums/${ALBUM}/${h}.jpg`));
out.all_full_jpg = winners;

mkdirSync("data/darshan", { recursive: true });
writeFileSync("data/darshan/_mayapur_full.json", JSON.stringify(out, null, 2));
console.log("full-size probe written for album", ALBUM);
console.log("hashes in raw html:", out.hashes.length, "| using:", hashes.length);
console.log("variants:", JSON.stringify(out.originals_test, null, 2));
console.log("imageviewer:", JSON.stringify(out.imageviewer, null, 2));
console.log("all .jpg full:", JSON.stringify(out.all_full_jpg, null, 2));
