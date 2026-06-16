// Fetches the temple site's loader (.data) endpoints directly (no browser) to
// learn the JSON shape and pull full-res CDN image URLs. Also downloads one
// image to measure true pixel dimensions. Runs on GitHub Actions.
import { writeFileSync, mkdirSync } from "node:fs";

const istDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const headers = { "user-agent": UA, accept: "*/*", referer: "https://iskconvrindavan.com/daily-darshan-gallery" };

const endpoints = [
  "https://iskconvrindavan.com/api/create-todaydarshan.data",
  `https://iskconvrindavan.com/daily-darshan-gallery/${istDate}/2/sringar-darshan.data`,
  `https://iskconvrindavan.com/daily-darshan-gallery/${istDate}/3/mangala-darshan.data`,
  "https://iskconvrindavan.com/daily-darshan-gallery/sringar-darshan/2.data",
  "https://iskconvrindavan.com/daily-darshan-gallery.data",
];

const findCdn = (t) => [...new Set((t.match(/https?:\/\/cdn\.iskconvrindavan\.com\/[^\s"'\\)]+\.(?:jpe?g|png|webp)/gi) || []))];

function imgSize(buf) {
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), fmt: "png" };
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let o = 2;
    while (o < buf.length - 8) {
      if (buf[o] !== 0xff) { o++; continue; }
      const m = buf[o + 1];
      if (m === 0xd8 || m === 0xd9 || (m >= 0xd0 && m <= 0xd7)) { o += 2; continue; }
      const len = buf.readUInt16BE(o + 2);
      if ((m >= 0xc0 && m <= 0xc3) || (m >= 0xc5 && m <= 0xc7) || (m >= 0xc9 && m <= 0xcb) || (m >= 0xcd && m <= 0xcf)) {
        return { h: buf.readUInt16BE(o + 5), w: buf.readUInt16BE(o + 7), fmt: "jpg" };
      }
      o += 2 + len;
    }
  }
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
    e.cdn = findCdn(t);
    e.head = t.slice(0, 1800);
  } catch (err) { e.error = String(err).slice(0, 200); }
  out.push(e);
}

let sample = null;
for (const e of out) { if (e.cdn && e.cdn.length) { sample = e.cdn[0]; break; } }
let measured = null;
if (sample) {
  try {
    const r = await fetch(sample, { headers });
    const buf = Buffer.from(await r.arrayBuffer());
    measured = { url: sample, status: r.status, bytes: buf.length, ct: r.headers.get("content-type"), dim: imgSize(buf) };
  } catch (e) { measured = { url: sample, error: String(e).slice(0, 150) }; }
}

mkdirSync("data/darshan", { recursive: true });
writeFileSync("data/darshan/_api.json", JSON.stringify({ at: new Date().toISOString(), istDate, endpoints: out, measured }, null, 2));
console.log("date", istDate);
for (const e of out) console.log(e.status ?? e.error, "| imgs:", (e.cdn || []).length, "|", e.url);
if (measured) console.log("sample image:", measured.bytes, "bytes", measured.dim, measured.url);
