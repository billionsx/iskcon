// Ground-truth probe (runs on GitHub Actions — sandbox has no network to temples).
// 1) Vrindavan: today's Sringar gallery → download first photos, report pixel
//    dimensions (JPEG SOF) AND EXIF Orientation tag (so we know if "vertical"
//    photos are landscape-pixels+EXIF-rotate, or genuinely landscape).
// 2) Mayapur: today's album → enumerate ALL frames from the album page (thumbnails)
//    AND from the imageviewer at offsets 0/10/20/30 (pagination check). Report
//    every hash/url + dims, so we see why some (e.g. Prabhupada) are missing.
import { writeFileSync, mkdirSync } from "node:fs";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const istDate = () => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date());
const ddmmyyyyIST = () => {
  const p = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Kolkata" }).formatToParts(new Date());
  const g = (t) => (p.find((x) => x.type === t) || { value: "" }).value;
  return `${g("day")}/${g("month")}/${g("year")}`;
};
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

// EXIF Orientation (tag 0x0112) from APP1. 1=normal,3=180,6=90CW,8=90CCW.
function exifOrientation(buf) {
  const b = new Uint8Array(buf); const dv = new DataView(buf);
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i < b.length - 3) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m === 0xd8 || m === 0xd9) { i += 2; continue; }
    if (m >= 0xd0 && m <= 0xd7) { i += 2; continue; }
    const len = dv.getUint16(i + 2);
    if (m === 0xe1) {
      const s = i + 4;
      if (b[s] === 0x45 && b[s + 1] === 0x78 && b[s + 2] === 0x69 && b[s + 3] === 0x66) { // "Exif"
        const tiff = s + 6;
        const le = b[tiff] === 0x49 && b[tiff + 1] === 0x49;
        const r16 = (o) => dv.getUint16(tiff + o, le);
        const r32 = (o) => dv.getUint32(tiff + o, le);
        try {
          const ifd0 = r32(4); const n = r16(ifd0);
          for (let e = 0; e < n; e++) {
            const ent = ifd0 + 2 + e * 12;
            if (r16(ent) === 0x0112) return r16(ent + 8);
          }
        } catch { return null; }
      }
      return null;
    }
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) break; // hit SOF — no EXIF before image
    i += 2 + len;
  }
  return null;
}

async function getText(url, ref) {
  const r = await fetch(url, { headers: { "User-Agent": UA, accept: "text/html,*/*", referer: ref || "" }, redirect: "follow" });
  return { status: r.status, text: r.ok ? await r.text() : "" };
}
async function measure(url, ref) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, referer: ref || "" } });
    if (!r.ok) return { url: url.slice(-60), status: r.status };
    const buf = await r.arrayBuffer();
    const d = dims(buf); const o = exifOrientation(buf);
    const effPortrait = (o === 6 || o === 8) ? d.w > d.h : d.h > d.w; // EXIF-corrected orientation
    return { url: url.slice(-60), status: 200, bytes: buf.byteLength, px: `${d.w}x${d.h}`, exif: o, effective: effPortrait ? "portrait" : "landscape" };
  } catch (e) { return { url: url.slice(-60), error: String(e).slice(0, 100) }; }
}

const out = { at: new Date().toISOString(), istDate: istDate(), vrindavan: {}, mayapur: {} };

/* ── Vrindavan ── */
try {
  const date = istDate();
  const u = `https://iskconvrindavan.com/daily-darshan-gallery/${date}/2/sringar-darshan.data`;
  const g = await getText(u, "https://iskconvrindavan.com/daily-darshan-gallery");
  out.vrindavan.data_status = g.status;
  const re = /static\/static-_[0-9a-zA-Z]+\.(?:jpe?g|png|webp)/g;
  const paths = uniq(g.text.match(re) || []);
  out.vrindavan.count = paths.length;
  // does .data embed dimensions? dump a slice around the first image path + scan for width/height keys
  const si = g.text.indexOf(paths[0] || "static-_");
  out.vrindavan.data_slice = si >= 0 ? g.text.slice(Math.max(0, si - 220), si + 220) : g.text.slice(0, 400);
  out.vrindavan.has_dim_keys = /"?(width|height|w|h|orientation|portrait|landscape|ratio|aspect)"?\s*[:=]/i.test(g.text);
  const cdn = "https://cdn.iskconvrindavan.com";
  // Range support test on first image
  try {
    const rr = await fetch(`${cdn}/${paths[0]}`, { headers: { "User-Agent": UA, referer: "https://iskconvrindavan.com/", Range: "bytes=0-2047" } });
    const rbuf = await rr.arrayBuffer();
    out.vrindavan.range = { status: rr.status, accept_ranges: rr.headers.get("accept-ranges"), content_range: rr.headers.get("content-range"), got_bytes: rbuf.byteLength, dims_from_2k: dims(rbuf) };
  } catch (e) { out.vrindavan.range = { error: String(e).slice(0, 120) }; }
  const sample = [];
  for (let i = 0; i < Math.min(paths.length, 10); i++) sample.push(await measure(`${cdn}/${paths[i]}`, "https://iskconvrindavan.com/"));
  out.vrindavan.images = sample;
  out.vrindavan.summary = {
    portrait: sample.filter((x) => x.effective === "portrait").length,
    landscape: sample.filter((x) => x.effective === "landscape").length,
    with_exif_rotate: sample.filter((x) => x.exif === 6 || x.exif === 8).length,
  };
} catch (e) { out.vrindavan.error = String(e).slice(0, 200); }

/* ── Mayapur ── */
try {
  const gi = await getText("https://www.mayapur.com/media/gallery/daily-darshan", "https://www.mayapur.com/");
  out.mayapur.index_status = gi.status;
  const blocks = [];
  const bre = /<p>\s*(\d{2}\/\d{2}\/\d{4})\s*<\/p>[\s\S]{0,220}?\/media\/album\/(\d+)/g; let m;
  while ((m = bre.exec(gi.text))) blocks.push({ date: m[1], id: m[2] });
  if (!blocks.length) { const ids = uniq(gi.text.match(/\/media\/album\/(\d+)/g) || []); out.mayapur.note = "no dated blocks; album links: " + ids.slice(0, 5).join(","); }
  const today = ddmmyyyyIST();
  const chosen = blocks.find((b) => b.date === today) || blocks[0];
  out.mayapur.today = today; out.mayapur.chosen = chosen || null; out.mayapur.blocks = blocks.slice(0, 6);
  if (chosen) {
    const id = chosen.id;
    // album page — thumbnails (broad hash charset)
    const ap = await getText(`https://www.mayapur.com/media/album/${id}`, "https://www.mayapur.com/media/gallery/daily-darshan");
    out.mayapur.album_html_len = ap.text.length;
    const thRe = new RegExp(`albums/${id}/([A-Za-z0-9_-]+)_thumbnail`, "gi"); let t; const th = [];
    while ((t = thRe.exec(ap.text))) th.push(t[1]);
    out.mayapur.album_thumb_hashes = uniq(th);
    // any _image directly on album page?
    const imRe0 = new RegExp(`albums/${id}/([A-Za-z0-9_-]+)_image`, "gi"); let t2; const im0 = [];
    while ((t2 = imRe0.exec(ap.text))) im0.push(t2[1]);
    out.mayapur.album_image_hashes = uniq(im0);
    // imageviewer pagination probe: offsets 0,10,20,30
    const viewer = {};
    for (const off of [0, 10, 20, 30]) {
      const v = await getText(`https://www.mayapur.com/imageviewer/show-album-pictures/${id}/${off}`, `https://www.mayapur.com/media/album/${id}`);
      const ire = new RegExp(`storage/albums/${id}/([A-Za-z0-9_-]+)_image\\.(?:jpe?g|png|webp)`, "gi"); let p; const hs = [];
      while ((p = ire.exec(v.text))) hs.push(p[1]);
      viewer[`off_${off}`] = { status: v.status, len: v.text.length, image_hashes: uniq(hs) };
    }
    out.mayapur.viewer = viewer;
    // union of every hash seen
    const all = uniq([...out.mayapur.album_thumb_hashes, ...out.mayapur.album_image_hashes,
      ...Object.values(viewer).flatMap((x) => x.image_hashes)]);
    out.mayapur.total_unique_hashes = all.length;
    // measure first few full-size _image.jpg
    const sample = [];
    for (let i = 0; i < Math.min(all.length, 14); i++) sample.push(await measure(`https://www.mayapur.com/storage/albums/${id}/${all[i]}_image.jpg`, `https://www.mayapur.com/media/album/${id}`));
    out.mayapur.images = sample;
    // HOTLINK тест: грузится ли кадр Маяпура из БРАУЗЕРА с другого домена
    // (referer gaurangers.com) и вовсе без referer — как это делает <img> на сайте.
    if (all[0]) {
      const u0 = `https://www.mayapur.com/storage/albums/${id}/${all[0]}_image.jpg`;
      const hot = {};
      for (const [label, ref] of [["referer_gaurangers", "https://gaurangers.com/"], ["no_referer", ""], ["referer_mayapur", "https://www.mayapur.com/"]]) {
        try { const r = await fetch(u0, { headers: { "User-Agent": UA, ...(ref ? { referer: ref } : {}) } }); hot[label] = { status: r.status, ct: r.headers.get("content-type"), bytes: (await r.arrayBuffer()).byteLength }; }
        catch (e) { hot[label] = { error: String(e).slice(0, 100) }; }
      }
      out.mayapur.hotlink = hot;
    }
  }
} catch (e) { out.mayapur.error = String(e).slice(0, 200); }

mkdirSync("data/darshan", { recursive: true });
writeFileSync("data/darshan/_orient.json", JSON.stringify(out, null, 2));
// (live-секция ниже допишет out.live и перезапишет файл в конце)

/* ── LIVE prod: что реально отдаёт gaurangers.com ── */
out.live = {};
try {
  const r = await fetch("https://gaurangers.com/api/darshan", { headers: { "User-Agent": UA, accept: "application/json" } });
  out.live.api_status = r.status;
  const j = await r.json();
  out.live.api = (j.today || []).map((it) => ({
    temple: it.templeSlug, source: it.source, images: (it.images || []).length, first: (it.images || [])[0] ? it.images[0].slice(-50) : null,
  }));
} catch (e) { out.live.api_error = String(e).slice(0, 200); }
try {
  const h = await fetch("https://gaurangers.com/", { headers: { "User-Agent": UA, accept: "text/html" } });
  const html = await h.text();
  const js = uniq(html.match(/\/assets\/[A-Za-z0-9_.-]+\.js/g) || []);
  out.live.html_status = h.status;
  out.live.bundles = js.slice(0, 8);
  // главный бандл — самый большой index-*.js; проверим маркеры
  let main = js.find((u) => /index-/.test(u)) || js[0];
  if (main) {
    const b = await fetch("https://gaurangers.com" + main, { headers: { "User-Agent": UA } });
    const code = await b.text();
    out.live.main = main;
    out.live.bundle_len = code.length;
    out.live.has_backdrop_blur = code.includes("brightness(0.5");      // мой новый код (подложка)
    out.live.has_dailydarshan_label = code.includes("Ежедневный даршан"); // более ранний деплой
    out.live.has_old_client_filter = code.includes("naturalHeight");    // откат должен был убрать
  }
} catch (e) { out.live.bundle_error = String(e).slice(0, 200); }

console.log(JSON.stringify(out, null, 2));
writeFileSync("data/darshan/_orient.json", JSON.stringify(out, null, 2));
