/**
 * Даршан дня — публичный read-слой (тот же воркер/origin, что и Лента и кабинет).
 *
 * Сегодняшний даршан берём ЖИВЫМ из публичных каналов храмов (t.me/s, та же
 * механика и парсер, что у Ленты @iskcone в workerHome.ts) — он всегда свежий,
 * как лента, и не зависит от ежедневного ингеста. Архив даршанов — из таблицы
 * D1 `darshan` (редакторский слой, наполняется ингестом scripts/darshan-ingest.mjs;
 * пока тот в dry-run, архив просто пуст). Та же БД, что и у кабинета (binding DB).
 *
 * Изображения — прямые URL Telegram-CDN (как фото Ленты, рендерятся <img> без
 * прокси). Эндпоинты: GET /api/darshan (сегодня + голова архива),
 * GET /api/darshan/archive?before=<id>&limit=N (постранично архив из D1).
 */
import type { D1Database } from "@cloudflare/workers-types";

interface DarshanEnv {
  DB: D1Database;
}

/* ── якорные храмы (метаданные синхронны scripts/darshan-ingest.mjs) ── */
interface Src {
  slug: string;
  kind: "tg" | "site";
  site?: "iskconvrindavan" | "mayapur" | "chowpatty";
  channel: string;
  name: string;
  deities: string;
  place?: string;          // вторая строка подписи (храм · ИСККОН-центр); если нет — «Ежедневный даршан»
  srcLabel: string;
  galleryType?: string;
  gallerySlug?: string;
  galleryName?: string;
}
const SOURCES: Src[] = [
  {
    // Маяпур: «сегодня» берём полноразмерными оригиналами из официальной галереи
    // даршана сайта храма (mayapur.com, ~1920px) — те же 800px-превью Telegram
    // оставляем лишь запасным источником. channel — fallback (см. darshanApi).
    slug: "mayapur",
    kind: "site",
    site: "mayapur",
    channel: "ISKCONMayapurGroup",
    galleryName: "Daily Darshan",
    name: "ИСККОН Маяпур · Шри Дхама Маяпур",
    deities: "Шри Шри Радха-Мадхава и Аштасакхи · Панча-таттва",
    srcLabel: "ISKCON Mayapur",
  },
  {
    // Вриндаван: для «сегодня» берём ВСЮ галерею Шрингара с сайта храма (≈21 фото,
    // все три алтаря) — чтобы в сторис был полный даршан, а не один альбом канала.
    slug: "vrindavan",
    kind: "site",
    channel: "iskconvrindavanofficial",
    galleryType: "2",
    gallerySlug: "sringar-darshan",
    galleryName: "Sringar Darshan",
    name: "ИСККОН Вриндаван · Шри Шри Кришна-Баларам Мандир",
    deities: "Джайа Гаура Нитай, Кришна Баларам, Лалита Вишакха Радхе Шьям",
    place: "Шри Шри Кришна-Баларам Мандир · ИСККОН Вриндаван",
    srcLabel: "ISKCON Vrindavan",
  },
  {
    // Чоупати (Мумбаи): отдельный сайт даршана с датированными кадрами в полном
    // разрешении (8601px). Тянем server-side, фильтруем по сегодняшней дате IST.
    slug: "chowpatty",
    kind: "site",
    site: "chowpatty",
    channel: "iskconchowpatty",
    name: "ИСККОН Чоупати · Шри Шри Радха-Гопинатх",
    deities: "Шри Шри Радха-Гопинатх",
    place: "Шри Шри Радха-Гопинатх Мандир · ИСККОН Чоупати, Мумбаи",
    srcLabel: "ISKCON Chowpatty",
  },
  {
    // Евпатория (Крым): публичный Telegram-канал храма с ежедневным даршаном.
    // Читаем server-side через t.me/s/ (как запасной путь Маяпура) — берём свежий
    // пост с фото. Только в сторис приложения; ТГ-постинг (@iskcone) не затрагивается.
    slug: "evpatoria",
    kind: "tg",
    channel: "harekrishnaevpatoria",
    name: "ИСККОН Евпатория",
    deities: "",
    srcLabel: "ISKCON Evpatoria",
  },
];

/* ── источник: сайт храма (полная галерея даршана за сегодня IST) ── */
const SITE_CDN = "https://cdn.iskconvrindavan.com";
const SITE_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const istToday = () => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date());

// Истинная ориентация показа кадра из JPEG: реальные размеры (маркер SOF) + EXIF-поворот
// (сегмент APP1/Exif). "p"=портрет, "l"=ландшафт, null=не разобрали. EXIF-ориентации 5–8
// (повороты 90/270) меняют ширину и высоту местами — именно это путало клиентский замер.
function jpegOrient(buf: ArrayBuffer): "p" | "l" | null {
  const b = new Uint8Array(buf); const dv = new DataView(buf);
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let w = 0, h = 0, orient = 1, i = 2;
  while (i < b.length - 1) {
    if (b[i] !== 0xff) { i++; continue; }
    const marker = b[i + 1];
    if (marker === 0xff) { i++; continue; }
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { i += 2; continue; }
    if (i + 4 > b.length) break;
    const len = dv.getUint16(i + 2); const seg = i + 4; // big-endian длина; seg — начало нагрузки
    if (marker === 0xe1 && seg + 6 <= b.length &&
        b[seg] === 0x45 && b[seg + 1] === 0x78 && b[seg + 2] === 0x69 && b[seg + 3] === 0x66 && b[seg + 4] === 0x00 && b[seg + 5] === 0x00) {
      const tiff = seg + 6; const le = b[tiff] === 0x49 && b[tiff + 1] === 0x49; // 'II'=LE, 'MM'=BE
      const u16 = (o: number) => dv.getUint16(o, le); const u32 = (o: number) => dv.getUint32(o, le);
      if (u16(tiff + 2) === 0x002a) {
        const ifd0 = tiff + u32(tiff + 4);
        if (ifd0 + 2 <= b.length) {
          const n = u16(ifd0);
          for (let e = 0; e < n; e++) {
            const ent = ifd0 + 2 + e * 12; if (ent + 12 > b.length) break;
            if (u16(ent) === 0x0112) { orient = u16(ent + 8); break; } // тег Orientation, SHORT
          }
        }
      }
    }
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      if (seg + 5 <= b.length) { h = dv.getUint16(seg + 1); w = dv.getUint16(seg + 3); }
      break; // EXIF (если есть) идёт раньше SOF — уже прочитан
    }
    if (len < 2) break;
    i = seg + (len - 2);
  }
  if (!w || !h) return null;
  if (orient >= 5 && orient <= 8) { const t = w; w = h; h = t; }
  return h > w ? "p" : "l";
}

// Тянем первые maxBytes байт кадра (Range + ограничение чтения стримом, чтобы не качать
// весь файл, даже если CDN игнорит Range). Ответ кэшируется на edge (cf cacheEverything).
async function fetchHead(url: string, referer: string, maxBytes: number): Promise<ArrayBuffer | null> {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": SITE_UA, referer, Range: `bytes=0-${maxBytes - 1}` },
      cf: { cacheTtl: 86400, cacheEverything: true },
    } as RequestInit);
    if (!r.ok && r.status !== 206) return null;
    const ab = await r.arrayBuffer().catch(() => null); // CDN отдаёт ровно ~128 КБ (206) — читаем как headDebug
    return ab && ab.byteLength ? ab : null;
  } catch { return null; }
}

// Ориентация каждого кадра — серверно, по реальным байтам файла (не по DOM в браузере).
async function orientFor(images: string[], referer: string): Promise<("p" | "l" | null)[]> {
  return Promise.all(images.map(async (u) => {
    const buf = await fetchHead(u, referer, 131072);
    return buf ? jpegOrient(buf) : null;
  }));
}

// ── ДИАГНОСТИКА (?debug=orient): сырые размеры + EXIF + статус ответа CDN ──
function jpegInfo(buf: ArrayBuffer): { w: number; h: number; exif: number } | null {
  const b = new Uint8Array(buf); const dv = new DataView(buf);
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let w = 0, h = 0, exif = 1, i = 2;
  while (i < b.length - 1) {
    if (b[i] !== 0xff) { i++; continue; }
    const marker = b[i + 1];
    if (marker === 0xff) { i++; continue; }
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { i += 2; continue; }
    if (i + 4 > b.length) break;
    const len = dv.getUint16(i + 2); const seg = i + 4;
    if (marker === 0xe1 && seg + 6 <= b.length &&
        b[seg] === 0x45 && b[seg + 1] === 0x78 && b[seg + 2] === 0x69 && b[seg + 3] === 0x66 && b[seg + 4] === 0x00 && b[seg + 5] === 0x00) {
      const tiff = seg + 6; const le = b[tiff] === 0x49 && b[tiff + 1] === 0x49;
      const u16 = (o: number) => dv.getUint16(o, le); const u32 = (o: number) => dv.getUint32(o, le);
      if (u16(tiff + 2) === 0x002a) {
        const ifd0 = tiff + u32(tiff + 4);
        if (ifd0 + 2 <= b.length) {
          const n = u16(ifd0);
          for (let e = 0; e < n; e++) {
            const ent = ifd0 + 2 + e * 12; if (ent + 12 > b.length) break;
            if (u16(ent) === 0x0112) { exif = u16(ent + 8); break; }
          }
        }
      }
    }
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      if (seg + 5 <= b.length) { h = dv.getUint16(seg + 1); w = dv.getUint16(seg + 3); }
      break;
    }
    if (len < 2) break;
    i = seg + (len - 2);
  }
  return w && h ? { w, h, exif } : null;
}

async function headDebug(url: string, referer: string): Promise<Record<string, unknown>> {
  try {
    const r = await fetch(url, { headers: { "User-Agent": SITE_UA, referer, Range: "bytes=0-131071" }, cf: { cacheTtl: 86400, cacheEverything: true } } as RequestInit);
    let len = 0; const buf = await r.arrayBuffer().catch(() => null);
    if (buf) len = buf.byteLength;
    const info = buf ? jpegInfo(buf) : null;
    const orient = buf ? jpegOrient(buf) : null;
    return { url: url.replace(/^https?:\/\/[^/]+/, ""), status: r.status, len, ct: r.headers.get("content-type"), w: info?.w ?? null, h: info?.h ?? null, exif: info?.exif ?? null, orient };
  } catch (e) { return { url: url.replace(/^https?:\/\/[^/]+/, ""), error: String(e) }; }
}

// Даты IST: сегодня и N предыдущих дней (YYYY-MM-DD), для отката к свежей галерее.
function istDaysBack(n: number): string[] {
  const fmt = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Kolkata" });
  const now = Date.now();
  return Array.from({ length: n + 1 }, (_, i) => fmt.format(new Date(now - i * 86400000)));
}

// Полная галерея даршана сайта за конкретный день. Берём ВСЕ кадры (regex по всем
// static-путям .data, дедуп) в полном разрешении CDN. null — если за этот день
// галереи ещё/уже нет.
async function fetchSiteGalleryDay(src: Src, date: string): Promise<{ date: string; name: string; pageUrl: string; images: string[]; orient: ("p" | "l" | null)[] } | null> {
  const u = `https://iskconvrindavan.com/daily-darshan-gallery/${date}/${src.galleryType}/${src.gallerySlug}.data`;
  const pageUrl = `https://iskconvrindavan.com/daily-darshan-gallery/${date}/${src.galleryType}/${src.gallerySlug}`;
  try {
    const r = await fetch(u, {
      headers: { "User-Agent": SITE_UA, accept: "*/*", referer: "https://iskconvrindavan.com/daily-darshan-gallery" },
      cf: { cacheTtl: 600, cacheEverything: true },
    } as RequestInit);
    if (!r.ok) return null;
    const t = await r.text();
    const re = /static\/static-_[0-9a-zA-Z]+\.(?:jpe?g|png|webp)/g;
    const seen = new Set<string>(); const paths: string[] = []; let m: RegExpExecArray | null;
    while ((m = re.exec(t))) { if (!seen.has(m[0])) { seen.add(m[0]); paths.push(m[0]); } }
    if (!paths.length) return null;
    const name = (t.match(/"gallery_name","([^"]+)"/) || [])[1] || src.galleryName || "Darshan";
    const images = paths.slice(0, 60).map((p) => `${SITE_CDN}/${p}`);
    const orient = await orientFor(images, "https://iskconvrindavan.com/");
    return { date, name, pageUrl, images, orient };
  } catch { return null; }
}

// Сегодняшний даршан — ВСЕГДА полной галереей сайта. Утром свежей галереи может ещё
// не быть (её публикуют в течение дня IST), поэтому при пустом «сегодня» откатываемся
// к самому свежему доступному дню (вчера, позавчера…). Это и есть «весь даршан за
// день» в полном разрешении — не редкий компрессированный пост Telegram.
async function fetchSiteGallery(src: Src): Promise<{ date: string; name: string; pageUrl: string; images: string[]; orient: ("p" | "l" | null)[] } | null> {
  for (const date of istDaysBack(6)) {
    const gal = await fetchSiteGalleryDay(src, date);
    if (gal && gal.images.length) return gal;
  }
  return null;
}

// Все типы ежедневного даршана Вриндавана. Порядок = порядок показа в кружке:
// особый фестивальный ведёт (когда есть), затем свежайший регулярный (шрингар),
// затем мангала-аарати. Сайт публикует их в течение дня IST — набор копится.
const VRINDAVAN_DARSHANS: { type: string; slug: string }[] = [
  { type: "4", slug: "festival-darshan" },
  { type: "2", slug: "sringar-darshan" },
  { type: "3", slug: "mangala-darshan" },
];

// Кадры ОДНОГО типа даршана за конкретный день (без orient — ориентацию клиент
// определяет сам по загруженному кадру, серверный флаг не используется).
async function fetchVrindGalleryType(date: string, type: string, slug: string): Promise<string[]> {
  const u = `https://iskconvrindavan.com/daily-darshan-gallery/${date}/${type}/${slug}.data`;
  try {
    const r = await fetch(u, {
      headers: { "User-Agent": SITE_UA, accept: "*/*", referer: "https://iskconvrindavan.com/daily-darshan-gallery" },
      cf: { cacheTtl: 600, cacheEverything: true },
    } as RequestInit);
    if (!r.ok) return [];
    const t = await r.text();
    const re = /static\/static-_[0-9a-zA-Z]+\.(?:jpe?g|png|webp)/g;
    const seen = new Set<string>(); const paths: string[] = []; let m: RegExpExecArray | null;
    while ((m = re.exec(t))) { if (!seen.has(m[0])) { seen.add(m[0]); paths.push(m[0]); } }
    return paths.map((p) => `${SITE_CDN}/${p}`);
  } catch { return []; }
}

// Вриндаван для сторис: ВСЕ даршаны дня в одном наборе (фестивальный + шрингар +
// мангала), в одном кружке. Берём самый свежий день IST, где опубликован хоть один
// тип; внутри — порядок VRINDAVAN_DARSHANS. По мере публикации новых даршанов набор
// растёт сам (каждый запрос пересобирает день), старые кадры не пропадают до смены суток.
async function fetchVrindavanCombined(src: Src): Promise<{ date: string; name: string; pageUrl: string; images: string[] } | null> {
  for (const date of istDaysBack(6)) {
    const groups = await Promise.all(VRINDAVAN_DARSHANS.map((d) => fetchVrindGalleryType(date, d.type, d.slug)));
    const images: string[] = []; const seen = new Set<string>();
    groups.forEach((g) => g.forEach((u) => { if (!seen.has(u)) { seen.add(u); images.push(u); } }));
    if (images.length) {
      const pageUrl = `https://iskconvrindavan.com/daily-darshan-gallery/${date}/2/sringar-darshan`;
      return { date, name: src.galleryName || "Darshan", pageUrl, images: images.slice(0, 90) };
    }
  }
  return null;
}

// Приоритет постам с фото и «даршанной» лексикой, иначе — свежайший пост с фото.
const DARSHAN_RE = /darshan|даршан|mangala|mangal|shringar|sringar|aarti|arati|abhishek|rajbhog|raj bhog|sandhya|deity|deities|gaura|nitai|radha|krishna|kṛṣṇa|balaram|madhava/i;

/* ── источник: галерея даршана Маяпура (mayapur.com, оригиналы ~1920px) ── */
// Индекс server-rendered (блоки «дата DD/MM/YYYY → /media/album/N»). Полные кадры
// отдаёт server-rendered смотрелка /imageviewer/show-album-pictures/N/0 списком
// /storage/albums/N/{hash}_image.jpg — браузер не нужен (как у Вриндавана).
/* ── источник: сайт даршана Чоупати (darshan.iskconchowpatty.com) ──
   Кадры — прямые датированные файлы /Photos/yr{YYYY}/{mon}{yy}/{DD}{mon}{YYYY}_{код}.jpg
   в полном разрешении. Берём сегодняшнюю дату IST; если ещё не выложили — самую
   свежую дату, присутствующую на странице. orient считает клиент. */
const CHOWPATTY = "https://darshan.iskconchowpatty.com";
const MON3: Record<string, string> = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
function chowTokenIST(d: Date): string {
  const p = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).formatToParts(d);
  const g = (t: string) => (p.find((x) => x.type === t) || { value: "" }).value;
  return `${g("day")}${g("month").toLowerCase()}${g("year")}`;   // "22jun2026"
}
async function fetchChowpattyGallery(src: Src): Promise<{ date: string; name: string; pageUrl: string; images: string[] } | null> {
  let html = "";
  try {
    const r = await fetch(`${CHOWPATTY}/`, { headers: { "User-Agent": SITE_UA, accept: "text/html,*/*", referer: `${CHOWPATTY}/` }, cf: { cacheTtl: 600, cacheEverything: true } } as RequestInit);
    if (!r.ok) return null;
    html = await r.text();
  } catch { return null; }
  const re = /Photos\/yr\d{4}\/[a-z]{3}\d{2}\/(\d{1,2}[a-z]{3}\d{4})_[A-Za-z0-9]+\.(?:jpe?g|png|webp)/gi;
  const seen = new Set<string>(); const all: { token: string; path: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) { if (!seen.has(m[0])) { seen.add(m[0]); all.push({ token: m[1].toLowerCase(), path: m[0] }); } }
  if (!all.length) return null;
  const toNum = (tok: string) => { const mm = tok.match(/^(\d{1,2})([a-z]{3})(\d{4})$/); return mm ? Number(`${mm[3]}${MON3[mm[2]] || "00"}${mm[1].padStart(2, "0")}`) : 0; };
  const today = chowTokenIST(new Date());
  const token = all.some((x) => x.token === today) ? today : all.map((x) => x.token).sort((a, b) => toNum(b) - toNum(a))[0];
  const images = all.filter((x) => x.token === token).map((x) => `${CHOWPATTY}/${x.path}`);
  if (!images.length) return null;
  const mt = token.match(/^(\d{1,2})([a-z]{3})(\d{4})$/);
  const date = mt ? `${mt[3]}-${MON3[mt[2]] || "01"}-${mt[1].padStart(2, "0")}` : istToday();
  return { date, name: src.galleryName || "Darshan", pageUrl: `${CHOWPATTY}/`, images: images.slice(0, 60) };
}

const MAYAPUR = "https://www.mayapur.com";
const ddmmyyyyIST = () => {
  const p = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Kolkata" }).formatToParts(new Date());
  const g = (t: string) => (p.find((x) => x.type === t) || { value: "" }).value;
  return `${g("day")}/${g("month")}/${g("year")}`;
};
async function fetchMayapurGallery(src: Src): Promise<{ date: string; name: string; pageUrl: string; images: string[]; orient: ("p" | "l" | null)[]; albumId: string } | null> {
  try {
    const ri = await fetch(`${MAYAPUR}/media/gallery/daily-darshan`, {
      headers: { "User-Agent": SITE_UA, accept: "text/html,*/*", referer: `${MAYAPUR}/` },
      cf: { cacheTtl: 600, cacheEverything: true },
    } as RequestInit);
    if (!ri.ok) return null;
    const html = await ri.text();
    const blocks: { date: string | null; id: string }[] = [];
    const re = /<p>\s*(\d{2}\/\d{2}\/\d{4})\s*<\/p>[\s\S]{0,220}?\/media\/album\/(\d+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) blocks.push({ date: m[1], id: m[2] });
    if (!blocks.length) {
      const idre = /\/media\/album\/(\d+)/g; const ids: string[] = []; let mm: RegExpExecArray | null;
      while ((mm = idre.exec(html))) ids.push(mm[1]);
      const first = [...new Set(ids)][0];
      if (!first) return null;
      blocks.push({ date: null, id: first });
    }
    const today = ddmmyyyyIST();
    const chosen = blocks.find((b) => b.date === today) || blocks[0];
    const albumId = chosen.id;

    // Полный список кадров альбома. Источник 1 — страница альбома: ВСЕ фото в её
    // raw-HTML присутствуют как {hash}_thumbnail (полноразмерный вариант — {hash}_image.jpg).
    // Источник 2 — server-rendered смотрелка (.../0) с прямыми {hash}_image.ext.
    // Объединяем по hash (порядок страницы альбома; реальный URL смотрелки приоритетнее),
    // чтобы в сторис попали ВСЕ кадры, а не подвыборка одной страницы.
    const order: string[] = [];
    const urlByHash = new Map<string, string>();
    const note = (hash: string, url?: string) => {
      if (!order.includes(hash)) order.push(hash);
      if (url) urlByHash.set(hash, url);
    };
    try {
      const ra = await fetch(`${MAYAPUR}/media/album/${albumId}`, {
        headers: { "User-Agent": SITE_UA, accept: "text/html,*/*", referer: `${MAYAPUR}/media/gallery/daily-darshan` },
        cf: { cacheTtl: 600, cacheEverything: true },
      } as RequestInit);
      if (ra.ok) {
        const at = await ra.text();
        const thRe = new RegExp(`albums/${albumId}/([A-Za-z0-9]+)_thumbnail`, "gi");
        let t: RegExpExecArray | null;
        while ((t = thRe.exec(at))) note(t[1]);
      }
    } catch { /* нет страницы альбома — добираем смотрелкой ниже */ }
    try {
      const rv = await fetch(`${MAYAPUR}/imageviewer/show-album-pictures/${albumId}/0`, {
        headers: { "User-Agent": SITE_UA, accept: "text/html,*/*", referer: `${MAYAPUR}/media/album/${albumId}` },
        cf: { cacheTtl: 600, cacheEverything: true },
      } as RequestInit);
      if (rv.ok) {
        const vt = await rv.text();
        const imgRe = new RegExp(`storage/albums/${albumId}/([A-Za-z0-9]+)_image\\.(?:jpe?g|png|webp)`, "gi");
        let p: RegExpExecArray | null;
        while ((p = imgRe.exec(vt))) note(p[1], p[0]);
      }
    } catch { /* нет смотрелки — остаёмся на кадрах со страницы альбома */ }
    const paths = order.map((h) => urlByHash.get(h) || `storage/albums/${albumId}/${h}_image.jpg`);
    if (!paths.length) return null;
    const date = chosen.date ? chosen.date.split("/").reverse().join("-") : istToday();
    const images = paths.slice(0, 60).map((x) => `${MAYAPUR}/${x}`);
    const orient = await orientFor(images, `${MAYAPUR}/`);
    return { date, albumId, name: src.galleryName || "Daily Darshan", pageUrl: `${MAYAPUR}/media/album/${albumId}`, images, orient };
  } catch {
    return null;
  }
}

/* ── парсер t.me/s (порт из workerHome.ts, только нужные поля) ── */
const deent = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ");
const plain = (s: string) => deent(s.replace(/<[^>]+>/g, "")).replace(/\n{3,}/g, "\n\n").trim();

interface RawPost { id: string; date: string; text: string; photos: string[] }

function parsePosts(html: string): RawPost[] {
  const out: RawPost[] = [];
  for (const b of html.split("tgme_widget_message_wrap").slice(1)) {
    const idM = b.match(/data-post="[^"/]+\/(\d+)"/);
    if (!idM) continue;
    const dateM = b.match(/<time datetime="([^"]+)"/);
    const textM = b.match(/tgme_widget_message_text js-message_text[^>]*>([\s\S]*?)<\/div>/);
    const text = textM ? plain(textM[1].replace(/<br\s*\/?>/gi, "\n")) : "";
    const photos: string[] = [];
    const phRe = /tgme_widget_message_photo_wrap[^>]*background-image:url\('([^']+)'\)/g;
    let ph: RegExpExecArray | null;
    while ((ph = phRe.exec(b))) photos.push(deent(ph[1]));
    if (!photos.length && !text) continue;
    out.push({ id: idM[1], date: dateM ? dateM[1] : "", text, photos });
  }
  out.reverse(); // свежие первыми
  return out;
}

async function latestDarshan(channel: string): Promise<RawPost | null> {
  try {
    const r = await fetch(`https://t.me/s/${channel}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; iskcon-one-love/1.0)" },
      cf: { cacheTtl: 600, cacheEverything: true },
    } as RequestInit);
    if (!r.ok) return null;
    const posts = parsePosts(await r.text());
    const withPhoto = posts.filter((p) => p.photos.length);
    return withPhoto.find((p) => DARSHAN_RE.test(p.text)) || withPhoto[0] || null;
  } catch {
    return null;
  }
}

// Локальный день поста по IST (граница суток храмового даршана — индийская).
function ymdIST(iso: string): string {
  const d = iso ? new Date(iso) : new Date();
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Kolkata" }).format(d);
}

/* ── форма карточки для клиента ── */
interface DarshanItem {
  source: "live" | "archive";
  date: string;
  templeSlug: string;
  templeName: string;
  deities: string | null;
  place: string | null;
  images: string[];
  orient?: ("p" | "l" | null)[];   // ориентация показа каждого кадра (серверно, по EXIF), выровнена с images
  caption: string | null;
  srcUrl: string;
  channelUrl: string | null;
  postId: string;
}

function liveItem(src: Src, post: RawPost): DarshanItem {
  const cap = post.text ? post.text.slice(0, 400) : null;
  return {
    source: "live",
    date: ymdIST(post.date),
    templeSlug: src.slug,
    templeName: src.name,
    deities: src.deities,
    place: src.place ?? null,
    images: post.photos.slice(0, 30),
    caption: cap,
    srcUrl: `https://t.me/${src.channel}/${post.id}`,
    channelUrl: null,
    postId: post.id,
  };
}

// Карточка из полной галереи сайта (Вриндаван/Маяпур) — все фото даршана.
function siteItem(src: Src, gal: { date: string; name: string; pageUrl: string; images: string[]; orient?: ("p" | "l" | null)[]; albumId?: string }): DarshanItem {
  return {
    source: "live",
    date: gal.date,
    templeSlug: src.slug,
    templeName: src.name,
    deities: src.deities,
    place: src.place ?? null,
    images: gal.images.slice(0, 60),
    orient: gal.orient ? gal.orient.slice(0, 60) : undefined,
    caption: null,
    srcUrl: gal.pageUrl,
    channelUrl: null,
    postId: gal.albumId ? `album/${gal.albumId}` : `${gal.date}/${src.galleryType}`,
  };
}

interface DarshanRow {
  id: number; date: string; temple_slug: string; temple_name: string; deities: string | null;
  src_channel: string; src_post_id: string; images_json: string; caption: string | null; tg_message_id: number | null;
}
function archiveItem(row: DarshanRow): DarshanItem {
  let images: string[] = [];
  try { const v = JSON.parse(row.images_json); if (Array.isArray(v)) images = v.filter((x) => typeof x === "string"); } catch { /* [] */ }
  return {
    source: "archive",
    date: row.date,
    templeSlug: row.temple_slug,
    templeName: row.temple_name,
    deities: row.deities,
    place: null,
    images: images.slice(0, 10),
    caption: row.caption ? plain(row.caption).slice(0, 400) || null : null,
    srcUrl: `https://t.me/${row.src_channel}/${row.src_post_id}`,
    channelUrl: row.tg_message_id ? `https://t.me/iskcone/${row.tg_message_id}` : null,
    postId: row.src_post_id,
  };
}

async function ensureDarshan(env: DarshanEnv): Promise<void> {
  // Таблица заводится миграцией 0009 на общей БД; CREATE IF NOT EXISTS — на случай
  // отставания миграции, чтобы read-эндпоинт был самодостаточным.
  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS darshan (
        id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, temple_slug TEXT NOT NULL,
        temple_name TEXT NOT NULL, deities TEXT, src_channel TEXT NOT NULL, src_post_id TEXT NOT NULL,
        images_json TEXT NOT NULL DEFAULT '[]', caption TEXT, tg_message_id INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
    ).run();
  } catch { /* noop */ }
}

function jr(data: unknown, status = 200, cache = "no-store"): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": cache },
  });
}

const clampInt = (v: string | null, def: number, lo: number, hi: number) => {
  const n = parseInt(v || "", 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, lo), hi) : def;
};

export async function darshanApi(request: Request, env: DarshanEnv, url: URL): Promise<Response | null> {
  const p = url.pathname;
  if (p !== "/api/darshan" && p !== "/api/darshan/archive") return null;
  if (request.method !== "GET") return jr({ error: "method" }, 405);

  await ensureDarshan(env);

  // Диагностика ориентации: GET /api/darshan?debug=orient — для каждого кадра свежей
  // галереи Вриндавана показывает статус ответа CDN, реальные размеры, EXIF и итог парсера.
  if (p === "/api/darshan" && url.searchParams.get("debug") === "orient") {
    const src = SOURCES.find((s) => s.kind === "site" && s.site !== "mayapur");
    if (!src) return jr({ error: "no_site_source" }, 200, "no-store");
    const gal = await fetchSiteGallery(src);
    if (!gal) return jr({ error: "no_gallery", note: "сайт Вриндавана не отдал галерею воркеру" }, 200, "no-store");
    const sample = gal.images.slice(0, 10);
    const rows = await Promise.all(sample.map((u) => headDebug(u, "https://iskconvrindavan.com/")));
    return jr({ date: gal.date, count: gal.images.length, referer: "https://iskconvrindavan.com/", frames: rows }, 200, "no-store");
  }

  // Постраничный архив из D1 (для «показать ещё»).
  if (p === "/api/darshan/archive") {
    const limit = clampInt(url.searchParams.get("limit"), 24, 1, 40);
    const before = url.searchParams.get("before");
    try {
      const q = /^\d+$/.test(before || "")
        ? env.DB.prepare(`SELECT * FROM darshan WHERE id < ?1 ORDER BY id DESC LIMIT ?2`).bind(Number(before), limit)
        : env.DB.prepare(`SELECT * FROM darshan ORDER BY id DESC LIMIT ?1`).bind(limit);
      const res = await q.all<DarshanRow>();
      const rows = res.results ?? [];
      const items = rows.map(archiveItem);
      const oldest = rows.length ? rows[rows.length - 1].id : null;
      return jr({ items, oldest, hasMore: rows.length === limit }, 200, "public, max-age=120");
    } catch {
      return jr({ items: [], oldest: null, hasMore: false }, 200, "no-store");
    }
  }

  // Сегодня — живьём: и Вриндаван, и Маяпур берём полной галереей с сайта
  // (полноразмерные оригиналы даршана). Если сайт недоступен — запас:
  // свежайший даршанный пост канала храма. Архив — отдельно /archive.
  const live = await Promise.all(
    SOURCES.map(async (s) => {
      if (s.kind === "site") {
        const gal = s.site === "mayapur" ? await fetchMayapurGallery(s) : s.site === "chowpatty" ? await fetchChowpattyGallery(s) : await fetchVrindavanCombined(s);
        if (gal && gal.images.length) {
          // Показываем ВСЮ галерею даршана за сегодня (и Вриндаван, и Маяпур): и
          // широкие кадры алтарей, и вертикальные крупные планы мурти. Сторис-вьювер
          // вписывает любой кадр целиком (object-fit: contain) на размытую подложку —
          // горизонтальные фото не «лежат боком», ничего не отсеиваем.
          return siteItem(s, gal);
        }
        // запас: если сайт недоступен — пробуем канал храма
        const post = await latestDarshan(s.channel);
        return post ? liveItem(s, post) : null;
      }
      const post = await latestDarshan(s.channel);
      return post ? liveItem(s, post) : null;
    }),
  );
  const today = live.filter((x): x is DarshanItem => x !== null);

  return jr({ today, at: new Date().toISOString() }, 200, today.length ? "public, max-age=600" : "no-store");
}
