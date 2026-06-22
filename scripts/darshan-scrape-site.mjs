// Renders ISKCON Vrindavan daily-darshan pages with a headless browser and
// extracts full-res image URLs from their CDN. Also captures any JSON/API
// responses so we can later skip the browser entirely if a clean feed exists.
// Runs on GitHub Actions (the sandbox has no network to the temple site).
import { writeFileSync, mkdirSync } from "node:fs";
import puppeteer from "puppeteer";

const PAGES = (process.env.PAGES ||
  "https://iskconvrindavan.com/daily-sringar-darshan,https://iskconvrindavan.com/daily-darshan-gallery"
).split(",").map((s) => s.trim()).filter(Boolean);

const uniq = (a) => [...new Set(a)];
const isImg = (u) => /\.(jpe?g|png|webp)(\?|$)/i.test(u || "");
const onCdn = (u) => /cdn\.iskconvrindavan\.com/i.test(u || "") || (/iskconvrindavan\.com/i.test(u || "") && isImg(u));

async function launch() {
  const base = { headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] };
  try { return await puppeteer.launch({ ...base, channel: "chrome" }); }
  catch (e) { console.log("channel=chrome failed, fallback to bundled:", String(e).slice(0, 120)); return await puppeteer.launch(base); }
}

async function scrapeOne(browser, url) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 2400, deviceScaleFactor: 1 });
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");

  const json = [];
  const imgResp = [];
  page.on("response", (resp) => {
    try {
      const u = resp.url();
      const ct = resp.headers()["content-type"] || "";
      if (ct.includes("application/json") || /\/api\/|\/wp-json\/|graphql|\.json(\?|$)/i.test(u)) json.push({ url: u, status: resp.status(), ct });
      if (onCdn(u)) imgResp.push(u);
    } catch {}
  });

  let nav = "ok";
  try { await page.goto(url, { waitUntil: "networkidle2", timeout: 70000 }); }
  catch (e) { nav = "goto: " + String(e).slice(0, 120); }

  // lazy-load: scroll the whole page
  try {
    await page.evaluate(async () => {
      await new Promise((res) => {
        let y = 0; const step = 1000;
        const t = setInterval(() => { window.scrollBy(0, step); y += step; if (y > document.body.scrollHeight + 2400) { clearInterval(t); res(); } }, 180);
      });
    });
    await new Promise((r) => setTimeout(r, 3000));
  } catch {}

  const dom = await page.evaluate(() => {
    const out = { imgs: [], bg: [], og: [], hrefs: [], title: document.title };
    document.querySelectorAll("img").forEach((im) => {
      const src = im.currentSrc || im.src || "";
      if (src) out.imgs.push({ src, w: im.naturalWidth || 0, h: im.naturalHeight || 0, alt: (im.getAttribute("alt") || "").slice(0, 80), srcset: (im.getAttribute("srcset") || "").slice(0, 300) });
    });
    document.querySelectorAll("*").forEach((el) => {
      const b = window.getComputedStyle(el).backgroundImage;
      if (b && b.includes("url(")) { const m = b.match(/url\(["']?([^"')]+)["']?\)/); if (m) out.bg.push(m[1]); }
    });
    document.querySelectorAll('meta[property="og:image"],meta[name="og:image"]').forEach((m) => out.og.push(m.content));
    document.querySelectorAll("a[href]").forEach((a) => out.hrefs.push(a.href));
    return out;
  });
  await page.close();

  const allUrls = uniq([...dom.imgs.map((i) => i.src), ...dom.bg, ...dom.hrefs, ...imgResp]);
  const cdn = allUrls.filter(onCdn);
  const dims = dom.imgs.filter((i) => i.w >= 500).sort((a, b) => b.w * b.h - a.w * a.h).slice(0, 16).map((i) => ({ src: i.src, w: i.w, h: i.h, alt: i.alt }));

  return {
    url, nav, title: dom.title,
    json_endpoints: uniq(json.map((j) => j.url)).slice(0, 40),
    img_total: dom.imgs.length,
    cdn_count: cdn.length,
    cdn_images: cdn.slice(0, 100),
    og: uniq(dom.og),
    darshan_links: uniq(dom.hrefs.filter((h) => /daily-darshan-gallery\/|daily-sringar-darshan|\/darshan|mangal|sringar|shringar|rajbhog|raj-bhog|sandhya|shayan|gaura|utthapan|abhishek/i.test(h || ""))).slice(0, 80),
    biggest: dims,
  };
}

const browser = await launch();
const results = [];
for (const u of PAGES) {
  try { results.push(await scrapeOne(browser, u)); }
  catch (e) { results.push({ url: u, error: String(e).slice(0, 250) }); }
}
await browser.close();

mkdirSync("data/darshan", { recursive: true });
writeFileSync("data/darshan/_site.json", JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
console.log("site scrape written; pages:", results.length);
for (const r of results) console.log("-", r.url, "| nav:", r.nav || r.error, "| imgs:", r.img_total, "| cdn:", r.cdn_count, "| json:", (r.json_endpoints || []).length);
