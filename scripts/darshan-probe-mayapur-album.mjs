// Renders a mayapur.com album page with a headless browser to discover the
// full-size photo URL pattern, any JSON/XHR endpoint the gallery calls (so prod
// can fetch without a browser), and the real pixel dimensions of originals.
import { writeFileSync, mkdirSync } from "node:fs";
import puppeteer from "puppeteer";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const uniq = (a) => [...new Set(a)];
const isImg = (u) => /\.(jpe?g|png|webp)(\?|$)/i.test(u || "");
const isIcon = (u) => /thumb|icon|logo|avatar|favicon|facebook|twitter|instagram|youtube|telegram|_cover/i.test(u || "");

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
    return { fmt: "jpeg", w: 0, h: 0 };
  }
  if (b[0] === 0x52 && b[8] === 0x57) return { fmt: "webp", w: 0, h: 0 };
  return { fmt: "?", w: 0, h: 0 };
}
async function measure(url) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, referer: "https://www.mayapur.com/" } });
    if (!r.ok) return { url, status: r.status };
    const buf = await r.arrayBuffer();
    return { url, status: 200, bytes: buf.byteLength, ...dims(buf) };
  } catch (e) { return { url, error: String(e).slice(0, 120) }; }
}

const ALBUM = process.env.ALBUM_ID || "594";
const ALBUM_URL = `https://www.mayapur.com/media/album/${ALBUM}`;
const out = { at: new Date().toISOString(), album_url: ALBUM_URL, xhr: [], json_endpoints: [], dom_images: [], network_images: [], originals: [], measured: [], notes: [] };

const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 2400, deviceScaleFactor: 1 });
await page.setUserAgent(UA);

const netImgs = [];
const xhrs = [];
page.on("response", (resp) => {
  try {
    const u = resp.url();
    const ct = resp.headers()["content-type"] || "";
    if (/mayapur\.com\/storage\//i.test(u) || (/mayapur\.com/i.test(u) && isImg(u) && !isIcon(u))) netImgs.push(u);
    if (ct.includes("application/json") || /\/api\/|\.json(\?|$)|ajax|photos|album/i.test(u)) {
      if (!isImg(u)) xhrs.push({ url: u, status: resp.status(), ct: ct.slice(0, 40) });
    }
  } catch {}
});

try { await page.goto(ALBUM_URL, { waitUntil: "networkidle2", timeout: 70000 }); }
catch (e) { out.notes.push("goto: " + String(e).slice(0, 120)); }
// trigger lazy loaders + any gallery init
try {
  await page.evaluate(async () => {
    await new Promise((res) => { let y = 0; const t = setInterval(() => { window.scrollBy(0, 1200); y += 1200; if (y > document.body.scrollHeight + 2400) { clearInterval(t); res(); } }, 150); });
  });
  await new Promise((r) => setTimeout(r, 3500));
} catch {}

const content = await page.content();
// full-size urls present in post-JS DOM
const reAbs = /https?:\/\/[^\s"')]+\.(?:jpe?g|png|webp)/gi;
const reRel = /(?:src|href|data-src|data-original|data-full)=["']([^"']+\.(?:jpe?g|png|webp))["']/gi;
const abs = uniq(content.match(reAbs) || []);
const rel = []; let mm;
while ((mm = reRel.exec(content))) rel.push(mm[1]);
const toAbs = (u) => (u.startsWith("http") ? u : `https://www.mayapur.com${u.startsWith("/") ? "" : "/"}${u}`);
const allDom = uniq([...abs, ...rel.map(toAbs)]);
out.dom_images = allDom.slice(0, 40);
out.network_images = uniq(netImgs).slice(0, 40);

// originals = storage/albums full size, excluding covers/icons
const originals = uniq([...netImgs, ...allDom]).filter((u) => /\/storage\//i.test(u) && !isIcon(u) && isImg(u));
out.originals = originals.slice(0, 40);
out.json_endpoints = uniq(xhrs.map((x) => `${x.status} ${x.ct} ${x.url}`)).slice(0, 30);

// dump a slice of post-JS DOM around first /storage/albums hit for the URL template
const si = content.search(/\/storage\/albums\/[A-Za-z0-9]/);
out.dom_sample = si >= 0 ? content.slice(Math.max(0, si - 160), si + 220).replace(/\s+/g, " ") : "(no /storage/albums in rendered DOM)";

await page.close();
await browser.close();

for (const u of (out.originals.length ? out.originals : out.dom_images).slice(0, 5)) out.measured.push(await measure(u));

mkdirSync("data/darshan", { recursive: true });
writeFileSync("data/darshan/_mayapur_album.json", JSON.stringify(out, null, 2));
console.log("album probe written for", ALBUM);
console.log("originals:", out.originals.length, "| network imgs:", out.network_images.length, "| xhr/json:", out.json_endpoints.length);
console.log("measured:", JSON.stringify(out.measured, null, 2));
console.log("json endpoints:", out.json_endpoints);
