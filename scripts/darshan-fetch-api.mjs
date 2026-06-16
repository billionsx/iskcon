import { writeFileSync, mkdirSync } from "node:fs";

const istDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const headers = { "user-agent": UA, accept: "*/*", referer: "https://iskconvrindavan.com/daily-darshan-gallery" };

const endpoints = [
  `https://iskconvrindavan.com/daily-darshan-gallery/${istDate}/2/sringar-darshan.data`,
  "https://iskconvrindavan.com/api/create-todaydarshan.data",
];

const reFile = /[A-Za-z0-9_-]+_[0-9a-f]{8,}\.(?:jpe?g|png|webp)/gi;
function windows(t, needle, n = 3, pad = 200) {
  const out = []; let i = -1; let c = 0; const low = t.toLowerCase(); const nd = needle.toLowerCase();
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
    e.status = r.status; const t = await r.text(); e.len = t.length;
    e.files = [...new Set(t.match(reFile) || [])];
    e.statics = e.files.filter((f) => /^static-_/.test(f));
    e.win_static = windows(t, "static-_", 2);
    e.win_imageList = windows(t, "image_list", 2);
    e.win_imageField = windows(t, "\"image\"", 3, 160);
  } catch (err) { e.error = String(err).slice(0, 200); }
  out.push(e);
}

let statics = [];
for (const e of out) { if (/sringar/.test(e.url) && e.statics && e.statics.length) statics = e.statics; }
const f0 = statics[0];
const candidates = f0 ? [
  `https://cdn.iskconvrindavan.com/static/${f0}`,
  `https://cdn.iskconvrindavan.com/gallery_image/${f0}`,
  `https://cdn.iskconvrindavan.com/${f0}`,
  `https://iskconstatic.s3.ap-south-1.amazonaws.com/static/${f0}`,
  `https://iskconstatic.s3.ap-south-1.amazonaws.com/${f0}`,
] : [];
const probes = [];
for (const c of candidates) {
  try { const r = await fetch(c, { headers }); let dim = null, bytes = 0; if (r.status === 200) { const buf = Buffer.from(await r.arrayBuffer()); bytes = buf.length; dim = imgSize(buf); } probes.push({ url: c, status: r.status, bytes, dim }); }
  catch (e) { probes.push({ url: c, error: String(e).slice(0, 80) }); }
}

mkdirSync("data/darshan", { recursive: true });
writeFileSync("data/darshan/_api.json", JSON.stringify({ at: new Date().toISOString(), istDate, sringar_static_count: statics.length, statics, endpoints: out, probes }, null, 2));
console.log("date", istDate, "| sringar statics:", statics.length);
for (const p of probes) console.log(p.status, p.bytes || "", JSON.stringify(p.dim || p.error || ""), p.url);
