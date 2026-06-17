import { writeFileSync, mkdirSync } from "node:fs";

const istDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const H = { "user-agent": UA, accept: "*/*", referer: "https://iskconvrindavan.com/daily-darshan-gallery" };

const out = { istDate, at: new Date().toISOString() };
async function grab(label, u) {
  try {
    const r = await fetch(u, { headers: H, redirect: "follow" });
    const t = await r.text();
    let json = null;
    try { json = JSON.parse(t); } catch { /* not pure json */ }
    out[label] = { url: u, status: r.status, len: t.length, json: json ?? undefined, head: json ? undefined : t.slice(0, 9000) };
  } catch (e) { out[label] = { url: u, error: String(e).slice(0, 200) }; }
}

await grab("manifest", "https://iskconvrindavan.com/api/create-todaydarshan.data");
await grab("sringar", `https://iskconvrindavan.com/daily-darshan-gallery/${istDate}/2/sringar-darshan.data`);
// возможные другие типы галерей за день (mangala/raj-bhoga/…?) + индекс
for (const ty of [1, 3, 4, 5, 6]) await grab(`type${ty}`, `https://iskconvrindavan.com/daily-darshan-gallery/${istDate}/${ty}/darshan.data`);
await grab("indexDated", `https://iskconvrindavan.com/daily-darshan-gallery/${istDate}.data`);

mkdirSync("data/darshan", { recursive: true });
writeFileSync("data/darshan/_dd.json", JSON.stringify(out, null, 2));
console.log("done", istDate, "manifest", out.manifest?.status, out.manifest?.len, "sringar", out.sringar?.status, out.sringar?.len);
