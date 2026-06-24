// Заливает карточки ПКЛ из data/pkl/<entity_id>.json в D1 (entity_profiles.longform).
// CF D1 REST API с bound-параметрами: json(?1) валидирует payload, ?2 — id. Без SQL-экранирования.
// Идемпотентно: повторный запуск перезаписывает тем же контентом. level=gold.
import { readFileSync, readdirSync } from "node:fs";

const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const DB = "6226aded-dd03-4e74-977f-9cd0b509e73d";
if (!ACCOUNT || !TOKEN) { console.error("нет CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN"); process.exit(2); }

const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database/${DB}/query`;
const dir = "data/pkl";

async function q(sql, params) {
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sql, params }),
  });
  return r.json().catch(() => null);
}

const only = (process.env.ONLY || "").split(",").map((s) => s.trim()).filter(Boolean);
let files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
if (only.length) files = files.filter((f) => only.includes(f.replace(/\.json$/, "")));

let ok = 0, fail = 0;
for (const f of files) {
  const id = f.replace(/\.json$/, "");
  const longform = readFileSync(`${dir}/${f}`, "utf8");
  try { const a = JSON.parse(longform); if (!Array.isArray(a) || !a.length) throw new Error("пустой/не-массив"); }
  catch (e) { console.log(`SKIP ${id}: невалидный JSON (${e.message})`); fail++; continue; }

  const j = await q(
    "UPDATE entity_profiles SET longform=json(?1), level='gold', updated_at=datetime('now') WHERE entity_id=?2",
    [longform, id]
  );
  const meta = j?.result?.[0]?.meta;
  if (j?.success && meta) {
    if (meta.changes === 0) console.log(`MISS ${id}: строки профиля нет (changes=0)`);
    else { console.log(`OK   ${id}: changes=${meta.changes} rows_written=${meta.rows_written} (${longform.length} симв.)`); ok++; }
    if (meta.changes === 0) fail++;
  } else {
    console.log(`FAIL ${id}: ${JSON.stringify(j?.errors || j).slice(0, 240)}`);
    fail++;
  }
}
console.log(`\nИТОГ ПКЛ-запись: ok=${ok} fail=${fail} из ${files.length}`);
if (fail) process.exit(1);
