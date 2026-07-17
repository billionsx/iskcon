/* ЗКН-Н083 — живой self-тест канонической ссылки на единицу писания.
 *
 * Собирает РЕАЛЬНЫЙ модуль apps/web/src/bookRef.ts (с настоящей моделью книг, без
 * дрейфа) и проверяет, что закладка стиха/главы даёт полную опознаваемую ссылку
 * ПИСАНИЕ · песнь/лила · глава · стих, а не голое «Текст 17» без книги — на всех
 * писаниях (ШБ/ЧЧ/БГ), для стиха и главы, включая диапазон стихов.
 *
 * Запуск: node tools/book-ref-selftest.mjs  (exit 1 при провале). */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const src = join(root, "apps", "web", "src", "bookRef.ts");
const esbuild = join(root, "node_modules", ".bin", "esbuild");

const dir = mkdtempSync(join(tmpdir(), "bref-"));
const out = join(dir, "bref.mjs");
try {
  // bookRef импортирует ./books → нужен --bundle (модель книг реальная).
  execFileSync(esbuild, [src, "--bundle", "--format=esm", "--platform=node", "--outfile=" + out], { stdio: "pipe" });
} catch (e) {
  console.error("book-ref selftest: esbuild не смог собрать bookRef.ts");
  console.error(String(e && e.stderr ? e.stderr : e));
  rmSync(dir, { recursive: true, force: true });
  process.exit(1);
}
const { scriptureRef, scriptureRefLine } = await import(pathToFileURL(out).href);
rmSync(dir, { recursive: true, force: true });

/** Ожидаемая раскладка ссылки: scripture | abbr | lead[] | anchor. */
const R = (kind, work, path) => {
  const r = scriptureRef(kind, work, path);
  return r ? `${r.scripture}|${r.abbr}|${r.lead.join(">")}|${r.anchor}` : "null";
};

const cases = [
  // ШБ (числовая песнь): писание + Песнь + Глава + Текст
  ["ШБ стих 1.17.17", R("verse", "sb", "/shrimad-bhagavatam/1/17/17"), "Шримад-Бхагаватам|ШБ|Песнь 1>Глава 17|Текст 17"],
  ["ШБ диапазон 13-14", R("verse", "sb", "/shrimad-bhagavatam/1/17/13-14"), "Шримад-Бхагаватам|ШБ|Песнь 1>Глава 17|Тексты 13-14"],
  ["ШБ глава 1.17", R("chapter", "sb", "/shrimad-bhagavatam/1/17"), "Шримад-Бхагаватам|ШБ|Песнь 1|Глава 17"],
  // ЧЧ (именованная лила): писание + Лила + Глава + Текст
  ["ЧЧ стих madhya 6.140", R("verse", "cc", "/chaitanya-charitamrita/madhya/6/140"), "Шри Чайтанья-чаритамрита|ЧЧ|Мадхья-лила>Глава 6|Текст 140"],
  ["ЧЧ глава antya 20", R("chapter", "cc", "/chaitanya-charitamrita/antya/20"), "Шри Чайтанья-чаритамрита|ЧЧ|Антья-лила|Глава 20"],
  // БГ (плоская): писание + Глава + Текст (без песни/лилы; эпитет «как она есть» в ссылку не идёт)
  ["БГ стих 2.13", R("verse", "bg", "/bhagavad-gita/2/13"), "Бхагавад-гита|БГ|Глава 2|Текст 13"],
  ["БГ глава 2", R("chapter", "bg", "/bhagavad-gita/2"), "Бхагавад-гита|БГ||Глава 2"],
  // Плоская строка для снимка/шаринга
  ["ШБ линия", scriptureRefLine("verse", "sb", "/shrimad-bhagavatam/1/17/17"), "Песнь 1 · Глава 17 · Текст 17"],
  // Неизвестная книга → null (сработает прежняя логика подписи)
  ["неизвестная книга", R("verse", "zz", "/zz/1/2/3"), "null"],
];

let fail = 0;
for (const [name, got, exp] of cases) {
  if (got !== exp) {
    fail++;
    console.error(`FAIL | ${name} -> получено «${got}», ожидалось «${exp}»`);
  }
}
if (fail) {
  console.error(`\nbook-ref selftest: провалов ${fail} — закладка писания показывала бы неполную ссылку`);
  process.exit(1);
}
console.log("book-ref selftest: OK (ссылка писания полна: книга · песнь/лила · глава · стих)");
