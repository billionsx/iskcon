/**
 * searchStatic — клиентский индекс по бандл-данным приложения, которых нет в
 * серверном /api/search (он покрывает D1: стихи, личности/места, главы, молитвы,
 * страницы, центры). Здесь — то, что лежит статикой в самом приложении и иначе
 * нигде не находится:
 *
 *   · Города календаря  — /data/vaisnava-locations.json (272 города, рус. имена);
 *                          выбор открывает «Календарь» на этом городе.
 *   · Рецепты           — RECIPES (прасадам) → /prasadam/recipe/<slug>.
 *   · Киртан-исполнители — KIRTAN_ARTISTS (+ альбомы) → /kirtan/<slug>.
 *   · Разделы и инструменты — карта навигации по функциям приложения (Джапа,
 *                          Даршан, Обет, Прасадам, Дхамы, Магазин, …).
 *
 * Тиртхи/дхамы намеренно НЕ дублируются: они уже приходят серверным поиском как
 * «Святые места» (entities type=place) и открываются в карточке.
 *
 * Совпадение — все токены запроса как подстроки в «сене» документа (AND); ранг —
 * по позиции в заголовке (точное → префикс → граница слова → подстрока). Регистр
 * и «ё» нормализуются.
 */
import { RECIPES, CATEGORIES, DIETS } from "./prasad/prasad";
import { KIRTAN_ARTISTS, KIRTAN_ALBUMS } from "./kirtans";

export type StaticGroup = "cities" | "recipes" | "kirtans" | "tools";

/** Город календаря — форма совместима с LocCity из HomeCalendar. */
export interface LocCity { ru: string; key: string; lat?: number | null; lng?: number | null; tz?: string | null }
export interface CityDoc { ru: string; key: string; country: string; lat?: number | null; lng?: number | null; tz?: string | null }

export type NavTarget = { kind: "path"; href: string } | { kind: "city"; loc: LocCity };
export interface StaticHit {
  group: StaticGroup;
  id: string;
  title: string;
  subtitle?: string | null;
  iast?: string | null;
  nav: NavTarget;
}

/* ─────────────────────────── нормализация и матч ─────────────────────────── */

const fold = (s: string): string => (s || "").toLowerCase().replace(/ё/g, "е");
const tokensOf = (q: string): string[] => (fold(q).match(/[\p{L}\p{N}]+/gu) ?? ([] as string[])).filter((t) => t.length >= 2);
const WORD = /[\p{L}\p{N}]+/gu;

/** Все токены — на границе слова в строке (а не просто подстрокой). */
function allAtWordStart(hay: string, toks: string[]): boolean {
  const words = hay.match(WORD) ?? ([] as string[]);
  return toks.every((t) => words.some((w) => w.startsWith(t)));
}

/**
 * Ранг документа под запрос. 0 — нет совпадения (все токены обязаны быть
 * подстроками «сена»). Заголовок весомее «сена»: точное → префикс → граница →
 * подстрока. Тай-брейк отдаём короткому заголовку (точнее цель).
 */
function score(doc: Doc, fullQ: string, toks: string[]): number {
  for (const t of toks) if (!doc.hay.includes(t)) return 0;
  const title = doc.titleFold;
  let s: number;
  if (title === fullQ) s = 1000;
  else if (title.startsWith(fullQ)) s = 880;
  else if (title.includes(fullQ)) s = 760;
  else if (allAtWordStart(title, toks)) s = 620;
  else if (toks.every((t) => title.includes(t))) s = 460;
  else if (allAtWordStart(doc.hay, toks)) s = 300;
  else s = 200;
  // Короткий заголовок — ближе к цели (при равном классе совпадения).
  return s * 1000 - Math.min(doc.titleFold.length, 200);
}

interface Doc {
  group: StaticGroup;
  id: string;
  title: string;
  subtitle?: string | null;
  iast?: string | null;
  titleFold: string;
  hay: string;            // нормализованная «сена» (заголовок + алиасы + ключевые слова)
  nav: NavTarget;
}

const mkHay = (...parts: (string | null | undefined)[]) => fold(parts.filter(Boolean).join(" "));

/* ─────────────────────────────── рецепты ─────────────────────────────────── */

const CAT_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));
const DIET_LABEL: Record<string, string> = Object.fromEntries(DIETS.map((d) => [d.id, d.label]));

const RECIPE_DOCS: Doc[] = RECIPES.map((r) => ({
  group: "recipes" as const,
  id: r.slug,
  title: r.title,
  iast: r.sanskrit ?? null,
  subtitle: r.subtitle,
  titleFold: fold(r.title),
  hay: mkHay(r.title, r.sanskrit, r.subtitle, CAT_LABEL[r.category], r.region, r.diets.map((d) => DIET_LABEL[d]).join(" ")),
  nav: { kind: "path", href: "/prasad/" + r.slug },
}));

/* ─────────────────────────── киртан-исполнители ──────────────────────────── */

const albumsByArtist = (slug: string) => KIRTAN_ALBUMS.filter((a) => a.artist === slug).map((a) => a.title).join(" ");

const KIRTAN_DOCS: Doc[] = KIRTAN_ARTISTS.map((a) => ({
  group: "kirtans" as const,
  id: a.slug,
  title: a.name,
  subtitle: a.role,
  titleFold: fold(a.name),
  hay: mkHay(a.name, a.full, a.role, a.origin, a.bio, albumsByArtist(a.slug), "киртан бхаджан аудио музыка"),
  nav: { kind: "path", href: "/kirtans/" + a.slug },
}));

/* ───────────────────────── разделы и инструменты ─────────────────────────── */

interface Tool { id: string; title: string; subtitle: string; keywords: string; href: string }
const TOOLS: Tool[] = [
  { id: "calendar", title: "Календарь", subtitle: "Вайшнавский календарь", keywords: "экадаши праздники посты дни ачарьев гаурабда панчанга", href: "/calendar" },
  { id: "japa", title: "Джапа", subtitle: "Счётчик кругов", keywords: "мала чётки мантра харе кришна джапа-медитация круги", href: "/japa" },
  { id: "diary", title: "Дневник садханы", subtitle: "Практика по дням", keywords: "отчёт привычки трекер дисциплина дневник", href: "/story" },
  { id: "vow", title: "Обет", subtitle: "Зарок и тапасья", keywords: "врата пост тапасья зарок дисциплина обещание", href: "/promise" },
  { id: "darshan", title: "Даршан", subtitle: "Божества храмов", keywords: "алтарь божества вриндаван маяпур фото мурти изображения", href: "/darshan" },
  { id: "verse", title: "Стих дня", subtitle: "Ежедневный стих", keywords: "стих дня бхагавад-гита шлока ежедневный", href: "/verse" },
  { id: "progress", title: "Мой прогресс", subtitle: "Статистика практики", keywords: "прогресс статистика достижения кругов джапа", href: "/progress" },
  { id: "notes", title: "Заметки", subtitle: "Личные записи", keywords: "заметки записи конспекты мысли закладки текста", href: "/notes" },
  { id: "favorites", title: "Избранное", subtitle: "Сохранённое", keywords: "избранное закладки сохранённое любимое", href: "/favorites" },
  { id: "prasadam", title: "Прасадам", subtitle: "Рецепты и кухня", keywords: "рецепты кухня вегетарианская еда готовка прасад блюда", href: "/prasad" },
  { id: "cookbook", title: "Поваренная книга", subtitle: "Кулинарная книга", keywords: "поваренная кулинарная книга рецепты главы", href: "/prasad/book" },
  { id: "offering", title: "Подношение Божеству", subtitle: "Бхога и молитвы", keywords: "подношение бхога оффер молитвы предложение пищи", href: "/prasad/offering" },
  { id: "shop", title: "Магазин", subtitle: "Книги, атрибуты, пожертвования", keywords: "магазин корзина купить заказ книги bbt мала чётки благовония пожертвование донат", href: "/cart" },
  { id: "dhama", title: "Святые дхамы", subtitle: "Вриндаван · Навадвипа · Пури", keywords: "дхама тиртхи паломничество вриндаван навадвипа пури места", href: "/dhama" },
  { id: "centers", title: "Центры ИСККОН", subtitle: "Храмы и общины", keywords: "центры храмы ятры общины найти центр сообщество", href: "/iskcon/centers" },
  { id: "books", title: "Книги", subtitle: "Библиотека писаний", keywords: "книги библиотека писания бхагавад-гита шримад-бхагаватам чайтанья-чаритамрита", href: "/books" },
  { id: "kirtans", title: "Аудио · Киртаны", subtitle: "Бхаджаны и мантры", keywords: "аудио киртаны бхаджаны музыка мантры слушать плеер", href: "/kirtans" },
];

const TOOL_DOCS: Doc[] = TOOLS.map((t) => ({
  group: "tools" as const,
  id: t.id,
  title: t.title,
  subtitle: t.subtitle,
  titleFold: fold(t.title),
  hay: mkHay(t.title, t.subtitle, t.keywords),
  nav: { kind: "path", href: t.href },
}));

/* ───────────────────────── города календаря (async) ─────────────────────── */

interface RawLoc { ru: string; key: string; lat?: number | null; lng?: number | null; tz?: string | null }
interface RawCountry { country: string; cities: RawLoc[] }
let cityCache: CityDoc[] | null = null;
let cityPromise: Promise<CityDoc[]> | null = null;

/** Загружает и кеширует города календаря (с русскими именами) для поиска. */
export function loadCityDocs(): Promise<CityDoc[]> {
  if (cityCache) return Promise.resolve(cityCache);
  if (cityPromise) return cityPromise;
  cityPromise = fetch("/data/vaisnava-locations.json")
    .then((r) => r.json())
    .then((j) => {
      const out: CityDoc[] = [];
      for (const c of (j.countries || []) as RawCountry[]) {
        for (const x of c.cities || []) {
          out.push({ ru: x.ru, key: x.key, country: c.country, lat: x.lat ?? null, lng: x.lng ?? null, tz: x.tz ?? null });
        }
      }
      cityCache = out;
      return out;
    })
    .catch(() => { cityCache = []; return cityCache; });
  return cityPromise;
}

function cityDocsToIndex(cities: CityDoc[]): Doc[] {
  return cities.map((c) => ({
    group: "cities" as const,
    id: c.key,
    title: c.ru,
    subtitle: c.country,
    titleFold: fold(c.ru),
    hay: mkHay(c.ru, c.key, c.country),
    nav: { kind: "city" as const, loc: { ru: c.ru, key: c.key, lat: c.lat, lng: c.lng, tz: c.tz } },
  }));
}

/* ──────────────────────────────── поиск ──────────────────────────────────── */

const PER_GROUP = 30;

/**
 * Поиск по статическим данным. `cities` — результат loadCityDocs() (пока не
 * загружен, передавайте []). Возвращает плоский список совпадений, отсортированных
 * по убыванию релевантности внутри каждой группы (порядок групп задаёт UI).
 */
export function searchStatic(query: string, cities: CityDoc[] = []): StaticHit[] {
  const fullQ = fold(query.trim());
  const toks = tokensOf(query);
  if (!fullQ || !toks.length) return [];

  const pools: Doc[][] = [cityDocsToIndex(cities), RECIPE_DOCS, KIRTAN_DOCS, TOOL_DOCS];
  const byGroup = new Map<StaticGroup, { doc: Doc; s: number }[]>();
  for (const pool of pools) {
    for (const doc of pool) {
      const s = score(doc, fullQ, toks);
      if (s <= 0) continue;
      const arr = byGroup.get(doc.group) || [];
      arr.push({ doc, s });
      byGroup.set(doc.group, arr);
    }
  }

  const out: StaticHit[] = [];
  for (const [, arr] of byGroup) {
    arr.sort((a, b) => b.s - a.s || a.doc.titleFold.localeCompare(b.doc.titleFold));
    for (const { doc } of arr.slice(0, PER_GROUP)) {
      out.push({ group: doc.group, id: doc.id, title: doc.title, subtitle: doc.subtitle ?? null, iast: doc.iast ?? null, nav: doc.nav });
    }
  }
  return out;
}
