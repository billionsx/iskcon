import { writeFileSync, mkdirSync } from "node:fs";
const istDate = process.env.DD_DATE || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const H = { "user-agent": UA, accept: "*/*", referer: "https://iskconvrindavan.com/daily-darshan-gallery" };
const url = `https://iskconvrindavan.com/daily-darshan-gallery/${istDate}/2/sringar-darshan.data`;
const PICKS = ["666a3240bc0ec8d","876a3240bd5a1dc","976a3240c1466ea","356a3240bff3415","496a3240c445f2b","886a3240c8434ff","566a3240c98445c","956a3240c59a46c","286a3240c6da69d"];
const r = await fetch(url, { headers: H }); const t = await r.text();
const re = /static\/static-_[0-9a-zA-Z]+\.(?:jpe?g|png|webp)/g;
const seen = new Set(); const ordered = []; let m;
while ((m = re.exec(t))) { if (!seen.has(m[0])) { seen.add(m[0]); ordered.push(m[0]); } }
const hashes = ordered.map((p) => (p.match(/static-_([0-9a-zA-Z]+)\./) || [])[1]);
const indexOfPick = PICKS.map((h) => ({ hash: h, index: hashes.indexOf(h) }));
const out = { istDate, status: r.status, gallery_count: ordered.length, ordered_hashes: hashes, picks: indexOfPick };
mkdirSync("data/darshan", { recursive: true });
writeFileSync("data/darshan/_order.json", JSON.stringify(out, null, 2));
console.log("count", ordered.length, "picks->idx", JSON.stringify(indexOfPick));
