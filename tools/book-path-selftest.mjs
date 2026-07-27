/* ЗКН-Н092 — живой self-тест ЕДИНСТВЕННОГО построителя адреса книги.
 *
 * Транспилирует РЕАЛЬНЫЙ модуль apps/web/src/bookPath.ts (без дрейфа копий) и проверяет
 * на ФАКТИЧЕСКИХ формах данных из D1 — по одному разделу и стиху из каждой книги канона,
 * плюс все известные краевые случаи, — что:
 *
 *   1. адрес стиха ВСЕГДА доходит до стиха (никогда не схлопывается до главы/книги);
 *   2. адрес ОБРАТИМ: parseBookPath(versePath(…)) отдаёт тот же раздел и тот же стих
 *      (роутер приложения пользуется этим же parseBookPath, значит писатель и читатель
 *      адреса физически один код);
 *   3. ключ главы плоской книги — `divisions.number`, а не цифры из ref: у
 *      Прабхупада-лиламриты id «spl.1.1» ↔ number «5», у предисловий number
 *      отрицательный («brs.preface» → «-2»);
 *   4. воспроизводится ровно тот баг, который ловил основатель: у плоской книги адрес
 *      стиха не равен адресу книги.
 *
 * Прошлые «фиксы» этого места проверялись глазами и возвращались. Запуск:
 *   node tools/book-path-selftest.mjs     (exit 1 при провале) */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const src = join(root, "apps", "web", "src", "bookPath.ts");
const esbuild = join(root, "node_modules", ".bin", "esbuild");

const dir = mkdtempSync(join(tmpdir(), "bpath-"));
const out = join(dir, "bookPath.mjs");
try {
  execFileSync(esbuild, [src, "--bundle", "--format=esm", "--platform=node", "--outfile=" + out], { stdio: "pipe" });
} catch (e) {
  console.error("book-path selftest: esbuild не смог собрать bookPath.ts");
  console.error(String(e && e.stderr ? e.stderr : e));
  rmSync(dir, { recursive: true, force: true });
  process.exit(1);
}
const booksOut = join(dir, "books.mjs");
try {
  execFileSync(esbuild, [join(root, "apps", "web", "src", "books.ts"), "--bundle", "--format=esm", "--platform=node", "--outfile=" + booksOut], { stdio: "pipe" });
} catch (e) {
  console.error("book-path selftest: esbuild не смог собрать books.ts");
  console.error(String(e && e.stderr ? e.stderr : e));
  rmSync(dir, { recursive: true, force: true });
  process.exit(1);
}
const M = await import(pathToFileURL(out).href);
const R = await import(pathToFileURL(booksOut).href);
rmSync(dir, { recursive: true, force: true });
const { versePath, chapterPath, bookPath, parseBookPath, verseSeg, isHierBook, pathReachesVerse } = M;
const { BOOKS, bookSlug, bookWork } = R;

/* ── Живые формы из D1 (work · division_id · divisions.number · ref · ожидаемый адрес) ──
 * Снято запросом к боевой базе: по стиху из каждой книги канона + краевые случаи. */
const FIX = [
  // иерархические (5 книг)
  ["bg",  "bg.1",              "1",    "БГ 1.1",                 "/bhagavad-gita/1/1"],
  ["sb",  "sb.9.8",            "8",    "ШБ 9.8.11",              "/shrimad-bhagavatam/9/8/11"],
  ["cc",  "cc.madhya.6",       "6",    "ЧЧ Мадхья 6.140",        "/chaitanya-charitamrita/madhya/6/140"],
  ["cb",  "cb.adi.1",          "1",    "ЧБ Ади 1.1",             "/chaitanya-bhagavata/adi/1/1"],
  ["cm",  "cm.adi.1",          "1",    "ЧМ Ади 1.1",             "/chaitanya-mangala/adi/1/1"],
  ["vp",  "vp.1.12",           "12",   "Вишну-пурана 1.12.69",   "/vishnu-purana/1/12/69"],
  // артефакт данных: раздела «cb.madhya.10.4-» нет в divisions (number = null),
  // адрес обязан остаться адресом СТИХА главы 10, а не схлопнуться.
  ["cb",  "cb.madhya.10.4-",   null,   "ЧБ Мадхья 10.4-10",      "/chaitanya-bhagavata/madhya/10/4-10"],
  // плоские — ровно те, где ломался старый построитель (`work !== "bg"`)
  ["brs", "brs.1",             "1",    "НП 1.1",                 "/nectar-of-devotion/1/1"],
  ["brs", "brs.preface",       "-2",   "НП preface.9",           "/nectar-of-devotion/-2/9"],
  ["brs", "brs.concluding-words", "1054", "НП concluding-words.1", "/nectar-of-devotion/1054/1"],
  ["ndm", "ndm.1",             "1",    "НДМ 1.1",                "/navadvipa-dhama-mahatmya/1/1"],
  ["br",  "br.1",              "1",    "БР 1.1",                 "/bhakti-ratnakara/1/1"],
  ["spl", "spl.1.1",           "5",    "ПЛ 1.1.10",              "/prabhupada-lilamrita/5/10"],
  ["spl", "spl.2.preface",     "47",   "ПЛ 2.preface.9",         "/prabhupada-lilamrita/47/9"],
  ["iso", "iso.1",             "1",    "ИШО 1",                  "/shri-ishopanishad/1/1"],
  ["iso", "iso.1",             "1",    "ИШО invocation",         "/shri-ishopanishad/1/invocation"],
  ["noi", "noi.1",             "1",    "НН 1",                   "/nektar-nastavleniy/1/1"],
  ["ks",  "ks.1",              "1",    "Кришна-сандарбха 28",    "/krishna-sandarbha/1/28"],
  ["gl",  "gl.8",              "8",    "Говинда-лиламрита 8.77", "/govinda-lilamrita/8/77"],
  ["bs",  "bs.5",              "5",    "Брахма-самхита 5.1",     "/brahma-samhita/5/1"],
  ["owk", "owk.1",             "1",    "НПК 1.1",                "/na-puti-k-krishne/1/1"],
  ["rv",  "rv.1",              "1",    "РВ 1.1",                 "/raja-vidya/1/1"],
  ["pop", "pop.introduction",  "-1",   "ПС introduction.9",      "/put-k-sovershenstvu/-1/9"],
  ["bbd", "bbd.1",             "1",    "ПТС 1.1",                "/po-tu-storonu-rozhdeniya-i-smerti/1/1"],
  ["poy", "poy.1",             "1",    "СЙ 1.1",                 "/sovershenstvo-yogi/1/1"],
  ["sc",  "sc.introduction",   "-1",   "ЕОШ introduction.9",     "/still-another-chance/-1/9"],
  ["tqk", "tqk.introduction",  "-1",   "МЦК introduction.9",     "/prayers-of-queen-kunti/-1/9"],
  ["lob", "lob.preface",       "-2",   "Свет preface.9",         "/svet-bhagavaty/-2/9"],
];

const fails = [];
const ok = (name, got, want) => { if (got !== want) fails.push(`${name}: получено ${JSON.stringify(got)}, ожидалось ${JSON.stringify(want)}`); };

for (const [work, divisionId, number, ref, want] of FIX) {
  const key = { divisionId, number };
  const p = versePath(work, key, ref);
  ok(`адрес стиха ${work} «${ref}»`, p, want);
  if (!p) continue;

  // 1. адрес стиха НИКОГДА не равен адресу книги/главы — это и был баг
  if (p === bookPath(work)) fails.push(`${work} «${ref}»: адрес стиха схлопнулся до КНИГИ (${p})`);
  if (p === chapterPath(work, key, ref)) fails.push(`${work} «${ref}»: адрес стиха схлопнулся до ГЛАВЫ (${p})`);
  if (!pathReachesVerse(work, p)) fails.push(`${work} «${ref}»: путь ${p} не доходит до стиха`);

  // 2. обратимость: разбор адреса возвращает тот же раздел и тот же стих
  const back = parseBookPath(p);
  if (!back) { fails.push(`${work} «${ref}»: адрес ${p} не разобрался как книжный`); continue; }
  ok(`обратимость.work ${work} «${ref}»`, back.work, work);
  ok(`обратимость.verse ${work} «${ref}»`, back.target.verse, verseSeg(ref));
  if (isHierBook(work)) {
    const seg = String(divisionId).split(".").filter(Boolean).slice(1);
    ok(`обратимость.div ${work} «${ref}»`, back.target.div, seg[0]);
    ok(`обратимость.chapter ${work} «${ref}»`, back.target.chapter, seg[1]);
  } else {
    ok(`обратимость.chapter ${work} «${ref}»`, back.target.chapter, String(number));
    ok(`обратимость.div ${work} «${ref}»`, back.target.div, null);
  }
}

/* ── Регрессия ровно на баг основателя: у ПЛОСКОЙ книги (не БГ) адрес стиха обязан
 *    отличаться от адреса книги. Старый построитель для всех них давал «/slug». ── */
for (const [work, divisionId, number, ref] of FIX) {
  if (isHierBook(work)) continue;
  const p = versePath(work, { divisionId, number }, ref);
  if (!p || p === bookPath(work)) fails.push(`РЕГРЕССИЯ Н092: плоская книга ${work} «${ref}» снова открывается обложкой (${p})`);
}

/* ── Иерархия определяется реестром книг, а не шифром. ── */
ok("иерархия: sb", isHierBook("sb"), true);
ok("иерархия: cc", isHierBook("cc"), true);
ok("иерархия: cb", isHierBook("cb"), true);
ok("иерархия: cm", isHierBook("cm"), true);
ok("иерархия: vp", isHierBook("vp"), true);
for (const w of ["bg", "brs", "ndm", "br", "spl", "iso", "noi", "ks", "gl", "bs", "owk", "rv", "pop", "bbd", "poy", "sc", "tqk", "lob"]) {
  ok(`иерархия: ${w} плоская`, isHierBook(w), false);
}

/* ── Номер стиха: диапазоны, en-dash, кириллические метки, слово вместо числа. ── */
ok("хвост «ШБ 1.9.40»", verseSeg("ШБ 1.9.40"), "40");
ok("хвост «БГ 2.16-17»", verseSeg("БГ 2.16-17"), "16-17");
ok("хвост «БГ 2.16–17» (en-dash → дефис)", verseSeg("БГ 2.16\u201317"), "16-17");
ok("хвост «НН 1»", verseSeg("НН 1"), "1");
ok("хвост «ИШО invocation»", verseSeg("ИШО invocation"), "invocation");
ok("хвост «Кришна-сандарбха 28»", verseSeg("Кришна-сандарбха 28"), "28");
ok("пустой ref", verseSeg(""), "");

/* ── Невозможность построить адрес = null, а НЕ подмена уровнем книги.
 *    Именно эта подмена и делала закладку лживой. ── */
/* Страховка для legacy-закладок: без ключа раздела глава выводится из ref — для
 * четырнадцати книг из восемнадцати это совпадает с divisions.number. Но там, где
 * главу вывести НЕЛЬЗЯ (ref из одного сегмента), честный ответ — null. */
ok("без ключа раздела глава берётся из ref", versePath("brs", null, "НП 1.1"), "/nectar-of-devotion/1/1");
ok("главу вывести нельзя → null", versePath("noi", null, "НН 1"), null);
ok("нет ref → null", versePath("brs", { number: "1" }, ""), null);
ok("иерархическая без раздела → null", versePath("sb", { number: "8" }, "ШБ 9.8.11"), null);
ok("нет главы → адрес книги", chapterPath("brs", null, ""), "/nectar-of-devotion");

/* ── СЛАГ ОБРАТИМ ДЛЯ КАЖДОЙ ЧИТАЕМОЙ КНИГИ.
 *    Здесь тест поймал живую коллизию: слаг «navadvipa-dhama-mahatmya» занимали ДВА
 *    входа реестра — книга `ndm` с 6796 стихами и каталожная заглушка noText под тем
 *    же именем. Побеждала заглушка, и адрес НДМ вёл в книгу без текста. ── */
for (const b of Object.values(BOOKS)) {
  if (b.noText) continue;
  ok(`слаг обратим: ${b.work}`, bookWork(bookSlug(b.work)), b.work);
}

/* ── Разбор чужих адресов не должен выдавать книгу. ── */
ok("не книжный адрес", parseBookPath("/japa"), null);
ok("корень", parseBookPath("/"), null);

if (fails.length) {
  console.error("book-path selftest: ПРОВАЛ (%d)".replace("%d", String(fails.length)));
  for (const f of fails) console.error("  ✗ " + f);
  process.exit(1);
}
console.log("book-path selftest: ✓ %d форм из боевой базы, обратимость и регрессия Н092 чисты".replace("%d", String(FIX.length)));
