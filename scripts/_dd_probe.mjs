import { writeFileSync, mkdirSync } from "node:fs";
const istDate = process.env.DD_DATE || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const H = { "user-agent": UA, accept: "*/*", referer: "https://iskconvrindavan.com/daily-darshan-gallery" };

// devalue/SvelteKit flattened array → object
function hydrate(arr) {
  const seen = new Array(arr.length);
  function go(i) {
    if (i === -1 || i == null) return undefined;
    if (i in seen) return seen[i];
    const v = arr[i];
    if (v === null || typeof v !== "object") { seen[i] = v; return v; }
    if (Array.isArray(v)) { const a = []; seen[i] = a; for (const x of v) a.push(go(x)); return a; }
    const o = {}; seen[i] = o; for (const k in v) o[k] = go(v[k]); return o;
  }
  return go(0);
}
// найти все объекты, у которых есть поле, похожее на изображение
function findImageObjects(tree) {
  const res = []; const seen = new Set();
  (function walk(o) {
    if (!o || typeof o !== "object") return;
    if (seen.has(o)) return; seen.add(o);
    if (Array.isArray(o)) { o.forEach(walk); return; }
    const keys = Object.keys(o);
    const imgKey = keys.find((k) => /image|photo|img|file|url|src/i.test(k) && typeof o[k] === "string" && /\.(jpe?g|png|webp)|static|gallery_image|amazonaws|cdn/i.test(o[k]));
    if (imgKey) {
      const meta = {};
      for (const k of keys) if (typeof o[k] === "string" || typeof o[k] === "number") meta[k] = String(o[k]).slice(0, 120);
      res.push(meta);
    }
    for (const k of keys) walk(o[k]);
  })(tree);
  return res;
}
const out = { istDate, at: new Date().toISOString() };
async function probe(label, u) {
  try {
    const r = await fetch(u, { headers: H, redirect: "follow" });
    const t = await r.text(); let arr = null; try { arr = JSON.parse(t); } catch {}
    let tree = null, imgs = [];
    if (Array.isArray(arr)) { try { tree = hydrate(arr); imgs = findImageObjects(tree); } catch (e) { out[label + "_hyderr"] = String(e).slice(0, 150); } }
    out[label] = { url: u, status: r.status, len: t.length, image_objects_count: imgs.length, image_objects: imgs.slice(0, 40) };
  } catch (e) { out[label] = { url: u, error: String(e).slice(0, 200) }; }
}
await probe("sringar", `https://iskconvrindavan.com/daily-darshan-gallery/${istDate}/2/sringar-darshan.data`);
await probe("manifest", "https://iskconvrindavan.com/api/create-todaydarshan.data");
mkdirSync("data/darshan", { recursive: true });
writeFileSync("data/darshan/_dd.json", JSON.stringify(out, null, 2));
console.log("done", istDate, "sringar imgs:", out.sringar?.image_objects_count, "manifest imgs:", out.manifest?.image_objects_count);
