import { writeFileSync, mkdirSync } from "node:fs";

const istDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const headers = { "user-agent": UA, accept: "*/*", referer: "https://iskconvrindavan.com/daily-darshan-gallery" };

const endpoints = [
  "https://iskconvrindavan.com/api/create-todaydarshan.data",
  `https://iskconvrindavan.com/daily-darshan-gallery/${istDate}/2/sringar-darshan.data`,
  `https://iskconvrindavan.com/daily-darshan-gallery/${istDate}/3/mangala-darshan.data`,
];

const reFull = /https?:\/\/[^"\\\s)]+\.(?:jpe?g|png|webp)/gi;
const reFile = /[A-Za-z0-9_-]+_[0-9a-f]{8,}\.(?:jpe?g|png|webp)/gi;
const rePath = /(?:gallery_image|page|today_darshan|todaydarshan|darshan|upload[s]?)\/[A-Za-z0-9_\/-]+\.(?:jpe?g|png|webp)/gi;

function windows(t, needle, n = 3, pad = 230) {
  const out = []; let i = -1; let c = 0;
  const low = t.toLowerCase(); const nd = needle.toLowerCase();
  while (c < n) { i = low.indexOf(nd, i + 1); if (i < 0) break; out.push(t.slice(Math.max(0, i - pad), i + pad)); c++; }
  return out;
}
function imgSize(buf) {
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), fmt: "png" };
  if (buf[0] === 0xff && buf[1] === 0xd8) { let o = 2; while (o < buf.length - 8) { if (buf[o] !== 0xff) { o++; continue; } const m = buf[o + 1]; if (m === 0xd8 || m === 0xd9 || (m >= 0xd0 && m <= 0xd7)) { o += 2; continue; } const len = buf.readUInt16BE(o + 2); if ((m >= 0xc0 && m <= 0xc3) || (m >= 0xc5 && m <= 0xc7) || (m >= 0xc9 && m <= 0xcb) || (m >= 0xcd && m <= 0xcf)) return { h: buf.readUInt16BE(o + 5), w: buf.readUInt16BE(o + 7), fmt: "jpg" }; o += 2 + len; } }
  return null;
}

const out = [];
for (const u of endpoints) {
  const e = { url: u };
  try {
    const r = await fetch(u, { headers, redirect: "follow" });
    e.status = r.status; e.ct = r.headers.get("content-type");
    const t = await r.text();
    e.len = t.length;
    e.full = [...new Set(t.match(reFull) || [])].filter((x) => !/\/assets\//.test(x)).slice(0, 30);
    e.paths = [...new Set(t.match(rePath) || [])].slice(0, 30);
    e.files = [...new Set(t.match(reFile) || [])].slice(0, 30);
    e.win_jpg = windows(t, ".jpg", 3);
    e.win_gallery = windows(t, "gallery_image", 2);
    e.win_darshan = windows(t, "darshan_", 2);
  } catch (err) { e.error = String(err).slice(0, 200); }
  out.push(e);
}

function toUrl(tok) {
  if (/^https?:\/\//i.test(tok)) return tok;
  if (tok.startsWith("/")) return "https://cdn.iskconvrindavan.com" + tok;
  if (tok.includes("/")) return "https://cdn.iskconvrindavan.com/" + tok;
  return "https://cdn.iskconvrindavan.com/gallery_image/" + tok;
}
let sample = null;
for (const e of out) { const cand = (e.full && e.full[0]) || (e.paths && e.paths[0]) || (e.files && e.files[0]); if (cand) { sample = toUrl(cand); break; } }
let measured = null;
if (sample) { try { const r = await fetch(sample, { headers }); const buf = Buffer.from(await r.arrayBuffer()); measured = { url: sample, status: r.status, bytes: buf.length, ct: r.headers.get("content-type"), dim: imgSize(buf) }; } catch (e) { measured = { url: sample, error: String(e).slice(0, 150) }; } }

mkdirSync("data/darshan", { recursive: true });
writeFileSync("data/darshan/_api.json", JSON.stringify({ at: new Date().toISOString(), istDate, endpoints: out, measured }, null, 2));
console.log("date", istDate);
for (const e of out) console.log(e.status ?? e.error, "full:", (e.full || []).length, "paths:", (e.paths || []).length, "files:", (e.files || []).length, "|", e.url);
if (measured) console.log("sample", measured.bytes, "bytes", measured.dim, measured.url);
