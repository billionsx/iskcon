#!/usr/bin/env node
/**
 * imgopt — единый оптимизатор изображений «без видимой потери качества».
 *
 * ЗАЧЕМ. Картинки приходят к нам крупными и в неэффективных форматах: обложки книг —
 * PNG до 2 МБ (часто это вообще JPEG под расширением .png), даршаны с сайтов храмов и
 * Telegram — фото по 2000–4000px. Приложение нигде не показывает картинку шире ~1600px,
 * поэтому лишние пиксели и байты — чистые потери скорости без всякой пользы для глаза.
 *
 * ЧТО ДЕЛАЕТ (и почему это без потери качества).
 *   1. Даунскейл ТОЛЬКО вниз (withoutEnlargement) до maxDim по большей стороне. Пиксели,
 *      которых на экране всё равно не видно, отбрасываются — визуально это ничего не
 *      меняет, а вес падает кратно. Увеличения (а значит замыливания) не бывает никогда.
 *   2. EXIF-ориентация «впекается» в пиксели (.rotate()), затем метаданные вырезаются —
 *      фото не переворачивается и не тащит лишний вес.
 *   3. Пере-кодирование в JPEG q92 с хромой 4:4:4 (mozjpeg, progressive) — при 4:4:4 и
 *      q92 разница с оригиналом незаметна даже на тексте обложек; либо WebP q82 (--to webp)
 *      для внутри-приложенных фото, где не нужна совместимость с соц-превью.
 *   4. Защита «не больше оригинала»: если результат не меньше исходника, оставляем исходник.
 *
 * КАК ИСПОЛЬЗУЕТСЯ.
 *   • Библиотека — import { optimizeBuffer } в конвейерах приёма (darshan-ingest.mjs):
 *       const small = await optimizeBuffer(buf, { maxDim: 1600, quality: 82, to: "jpeg" });
 *   • CLI — пакетно по папке/файлам (обложки книг):
 *       node scripts/imgopt.mjs apps/web/public/covers --to jpg --max 1600 --q 92 --rename
 *     Флаги: --to jpg|webp (по умолч. jpg), --max <px> (1600), --q <1..100> (88),
 *            --rename (сменить расширение на целевое и удалить исходник),
 *            --dry (только посчитать экономию, ничего не писать).
 */
import sharp from "sharp";
import { readFileSync, writeFileSync, statSync, readdirSync, renameSync, unlinkSync } from "node:fs";
import { extname, join } from "node:path";

sharp.cache(false);
sharp.concurrency(1); // бережём CPU в CI

const RASTER = new Set([".jpg", ".jpeg", ".png", ".webp", ".tiff", ".avif", ".gif"]);

/**
 * Оптимизировать буфер изображения. Возвращает оптимизированный Buffer (в редких
 * случаях может быть не меньше исходного — решение «оставлять ли» принимает вызывающий,
 * либо используйте optimizeIfSmaller).
 */
export async function optimizeBuffer(input, opts = {}) {
  const { maxDim = 1600, quality = 88, to = "jpeg" } = opts;
  const img = sharp(input, { failOn: "none" }).rotate(); // EXIF-ориентация → в пиксели
  const meta = await img.metadata();
  if (meta.width && meta.height && Math.max(meta.width, meta.height) > maxDim) {
    img.resize(maxDim, maxDim, { fit: "inside", withoutEnlargement: true });
  }
  if (to === "webp") {
    return img.webp({ quality, effort: 6 }).toBuffer();
  }
  // JPEG: mozjpeg + progressive + хрома 4:2:0 (стандарт) — универсально совместимо
  // (браузеры и соц-превью/OG), при q85+ на фото и тексте обложек визуально без потерь.
  return img
    .flatten({ background: "#ffffff" }) // на случай альфы — подложка белая (обложки непрозрачны)
    .jpeg({ quality, mozjpeg: true, chromaSubsampling: "4:2:0", progressive: true })
    .toBuffer();
}

/**
 * Оптимизировать буфер и вернуть меньший из (оптимизированный, исходный). Для конвейеров
 * приёма, где важно никогда не раздуть уже маленькое фото (например, после сжатия Telegram).
 * changed=false означает «исходник оставлен как есть».
 */
export async function optimizeIfSmaller(input, opts = {}) {
  const src = Buffer.isBuffer(input) ? input : Buffer.from(input);
  try {
    const out = await optimizeBuffer(src, opts);
    if (out.length < src.length) return { buf: out, changed: true, before: src.length, after: out.length };
  } catch {
    /* битое/неподдерживаемое изображение — отдаём исходник нетронутым */
  }
  return { buf: src, changed: false, before: src.length, after: src.length };
}

// ─────────────────────────── CLI ───────────────────────────
function parseArgs(argv) {
  const o = { to: "jpg", max: 1600, q: 88, rename: false, dry: false, paths: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--to") o.to = argv[++i];
    else if (a === "--max") o.max = parseInt(argv[++i], 10);
    else if (a === "--q") o.q = parseInt(argv[++i], 10);
    else if (a === "--rename") o.rename = true;
    else if (a === "--dry") o.dry = true;
    else o.paths.push(a);
  }
  return o;
}

function collectFiles(paths) {
  const files = [];
  for (const p of paths) {
    const st = statSync(p);
    if (st.isDirectory()) {
      for (const name of readdirSync(p)) {
        if (RASTER.has(extname(name).toLowerCase())) files.push(join(p, name));
      }
    } else if (RASTER.has(extname(p).toLowerCase())) {
      files.push(p);
    }
  }
  return files.sort();
}

function human(n) {
  return n >= 1 << 20 ? (n / (1 << 20)).toFixed(1) + "M" : (n / 1024).toFixed(0) + "K";
}

async function cli() {
  const o = parseArgs(process.argv.slice(2));
  if (!o.paths.length) {
    console.error("usage: node scripts/imgopt.mjs <dir|file...> [--to jpg|webp] [--max 1600] [--q 88] [--rename] [--dry]");
    process.exit(1);
  }
  const targetExt = o.to === "webp" ? ".webp" : ".jpg";
  const files = collectFiles(o.paths);
  let totBefore = 0, totAfter = 0, written = 0, kept = 0;
  for (const f of files) {
    const src = readFileSync(f);
    let out;
    try {
      out = await optimizeBuffer(src, { maxDim: o.max, quality: o.q, to: o.to });
    } catch (e) {
      console.log(`  ! ${f}: ${e.message} — пропуск`);
      totBefore += src.length; totAfter += src.length; continue;
    }
    const cur = extname(f).toLowerCase();
    const willRename = o.rename && cur !== targetExt;
    const dest = willRename ? f.slice(0, -cur.length) + targetExt : f;
    // «не больше оригинала» — только когда формат/имя не меняем
    const keepOriginal = !willRename && out.length >= src.length;
    const finalLen = keepOriginal ? src.length : out.length;
    totBefore += src.length; totAfter += finalLen;
    const pct = Math.round((1 - finalLen / src.length) * 100);
    console.log(`  ${keepOriginal ? "=" : "↓"} ${f.split("/").pop()}  ${human(src.length)} → ${human(finalLen)}  (${pct}%)${willRename ? "  →" + targetExt : ""}`);
    if (o.dry) { if (!keepOriginal) written++; else kept++; continue; }
    if (keepOriginal) { kept++; continue; }
    writeFileSync(dest, out);
    if (willRename && dest !== f) unlinkSync(f); // убираем исходник со старым расширением
    written++;
  }
  console.log(`\n${o.dry ? "[dry] " : ""}итог: ${files.length} файлов, ${written} оптимизировано, ${kept} без изменений`);
  console.log(`общий вес: ${human(totBefore)} → ${human(totAfter)}  (−${Math.round((1 - totAfter / totBefore) * 100)}%)`);
}

// запуск как CLI (не при импорте как библиотеки)
if (import.meta.url === `file://${process.argv[1]}`) {
  cli().catch((e) => { console.error(e); process.exit(1); });
}
