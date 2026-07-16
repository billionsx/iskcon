/* ЗКН-Н079 — живой self-тест резолва стиха для глубокой ссылки.
 *
 * Транспилирует РЕАЛЬНЫЙ модуль apps/web/src/bookVerseRef.ts (без дрейфа) и проверяет,
 * что избранный/делённый стих РЕЗОЛВИТСЯ в сам стих, а не в главу — на всех форматах
 * ref и краевых случаях, которые раньше ломали поиск. Это тот гейт, которого не было у
 * прошлого «фикса» (он проверял лишь форму URL) — потому баг «стих открывает главу»
 * возвращался.
 *
 * Запуск: node tools/verse-ref-selftest.mjs  (exit 1 при провале). */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const src = join(root, "apps", "web", "src", "bookVerseRef.ts");
const esbuild = join(root, "node_modules", ".bin", "esbuild");

const dir = mkdtempSync(join(tmpdir(), "bvr-"));
const out = join(dir, "bvr.mjs");
try {
  execFileSync(esbuild, [src, "--format=esm", "--platform=node", "--outfile=" + out], { stdio: "pipe" });
} catch (e) {
  console.error("verse-ref selftest: esbuild не смог собрать bookVerseRef.ts");
  console.error(String(e && e.stderr ? e.stderr : e));
  rmSync(dir, { recursive: true, force: true });
  process.exit(1);
}
const { resolveVerseRef } = await import(pathToFileURL(out).href);
rmSync(dir, { recursive: true, force: true });

const enDash = "bg.2.16\u201317"; // диапазон 16–17 через en-dash в ref БД
const bg = [{ ref: "bg.2.1" }, { ref: "bg.2.13" }];
const cc = [{ ref: "cc.madhya.6.1" }, { ref: "cc.madhya.6.140" }];

const cases = [
  ["простой BG стих 13 открывает стих", resolveVerseRef(bg, "13"), "bg.2.13"],
  ["ведущий ноль 013 -> стих 13", resolveVerseRef(bg, "013"), "bg.2.13"],
  ["иерарх. CC 140 открывает стих", resolveVerseRef(cc, "140"), "cc.madhya.6.140"],
  ["диапазон дефис vs en-dash в ref", resolveVerseRef([{ ref: enDash }], "16-17"), enDash],
  ["стиха нет в главе -> ref достраивается (не глава)", resolveVerseRef([{ ref: "bg.2.1" }], "99"), "bg.2.99"],
  ["пустой стих -> null", resolveVerseRef(bg, null), null],
];

let fail = 0;
for (const [name, got, exp] of cases) {
  if (got !== exp) {
    fail++;
    console.error(`FAIL | ${name} -> получено ${JSON.stringify(got)}, ожидалось ${JSON.stringify(exp)}`);
  }
}
if (fail) {
  console.error(`\nverse-ref selftest: провалов ${fail} — избранный стих открывал бы главу`);
  process.exit(1);
}
console.log("verse-ref selftest: OK (стих открывается стихом на всех форматах)");
