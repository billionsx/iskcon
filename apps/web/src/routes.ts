/**
 * ISKCON ONE LOVE — КАНОНИЧЕСКИЕ АДРЕСА (ЗКН-Н020).
 *
 * ЕДИНСТВЕННЫЙ источник URL приложения. Ссылки, QR-коды, шаринг, PDF-подписи —
 * всё строится ТОЛЬКО отсюда.
 *
 * ПОЧЕМУ. Раньше адреса собирались строками по всему коду:
 *   `${ORIGIN}/prasadam/book`, `${ORIGIN}/kirtan/${slug}`, `${ORIGIN}/dhana/recipes`…
 * Мы несколько раз переименовывали маршруты (`/dhana/recipes` → `/dhana/prasad`),
 * и каждый такой хардкод превращался в битую ссылку. QR-коды, уже напечатанные и
 * разосланные, вели в никуда — а узнать об этом было неоткуда.
 *
 * Теперь: переименовал маршрут ЗДЕСЬ — и он поменялся везде, включая QR.
 * Хардкод `${ORIGIN}/...` в компонентах запрещён (линтер роняет сборку).
 */

/** Боевой домен. Единственное место, где он записан. */
export const ORIGIN = "https://gaurangers.com";

/** Канонические пути. Ключ — смысл, значение — построитель пути. */
/* ЗКН-Н023 — СТАНДАРТ АДРЕСОВ (полностью: docs/STANDARD_urls.md)
 *
 * Адрес — это ОБЕЩАНИЕ. Его копируют, шлют другу, печатают в QR-коде.
 * Непредсказуемый адрес ломает доверие, а не удобство.
 *
 * ЧТО БЫЛО (пять логик в одном приложении):
 *   /dhana/books           промежуточная категория «dhana» — для человека пустой звук
 *   /book/bg               а читалка уже НЕ в dhana
 *   /prasadam/recipe/...   «prasadam», хотя витрина называется «Прасад»
 *   /ru/bhajans/tulasi     ЧУЖОЙ путь iskcone.com, утёкший в наш слаг
 *   /abhimanyu             личность в корне
 *
 * ЗАКОНЫ:
 *   1. Раздел — ОДИН сегмент в корне. `/books`, а не `/dhana/books`.
 *   2. Углубление — сегментами вниз, каждый читается.
 *   3. Личность — в корне: `/abhimanyu`. Самый частый адрес, он обязан быть коротким.
 *   4. Корни разделов ЗАРЕЗЕРВИРОВАНЫ (иначе `/books` перестанет открывать Книги).
 *   5. Один раздел — один корень. Не `/prasad` И `/prasadam`.
 *   6. Старый адрес не ломается: 301 → новый (ссылки уже разошлись по закладкам и QR).
 */
export const ROUTES = {
  home: () => "/",
  practice: () => "/practice",
  calendar: () => "/calendar",
  account: () => "/account",

  // ── Богатства: шесть витрин, каждая — КОРЕНЬ ──
  lichnosti: (lila?: string, wave?: string, group?: string) =>
    ["/lichnosti", lila, wave, group].filter(Boolean).join("/"),
  /* ЗКН-Н023 §2 + ЗКН-БТ006 — КНИГА ОТКРЫВАЕТСЯ ПО ПОЛНОМУ ИМЕНИ, В КОРНЕ.
   *
   *   /bhagavad-gita        не /book/bg
   *   /brahma-samhita       не /book/bs
   *   /bhagavad-gita/2/13   глава → стих
   *
   * «bs» — это ШИФР, а не имя. Человек не знает, что такое «bs», и адрес ему
   * ничего не говорит. `/books` без аргумента — витрина. */
  books: () => "/books",
  bookRead: (slug: string, ...rest: string[]) =>
    ["", slug, ...rest].filter((x) => x !== undefined && x !== null).join("/") || "/",
  bhajans: (slug?: string) => (slug ? `/bhajans/${slug}` : "/bhajans"),
  kirtans: (slug?: string) => (slug ? `/kirtans/${slug}` : "/kirtans"),
  prasad: () => "/prasad",
  dhama: (dhamaId?: string, tirthaId?: string) =>
    ["/dhama", dhamaId, tirthaId].filter(Boolean).join("/"),

  // ── Внутри витрин ──
  recipe: (slug: string) => `/prasad/recipe/${slug}`,
  cookbook: (chapterId?: string) => (chapterId ? `/prasad/book/${chapterId}` : "/prasad/book"),
  center: (id: string) => `/iskcon/centers/${id}`,

  // ── Личность — в корне ──
  entity: (id: string) => `/${id}`,

  // ── Разделы ──
  iskcon: (sub?: string) => (sub ? `/iskcon/${sub}` : "/iskcon"),
  krishna: (tab?: string, sub?: string) => ["/krishna", tab, sub].filter(Boolean).join("/"),
  gauranga: (tab?: string, sub?: string) => ["/gauranga", tab, sub].filter(Boolean).join("/"),

  // ── Совместимость: старые адреса (только для 301) ──
  book: (work: string, ...rest: string[]) => ["/books", work, ...rest].join("/"),
  bhajan: (slug: string) => `/bhajans/${slug}`,
  kirtanArtist: (slug: string) => `/kirtans/${slug}`,
  dhana: () => "/lichnosti",
  tirtha: (dhamaId: string, tirthaId?: string) =>
    tirthaId ? `/dhama/${dhamaId}/${tirthaId}` : `/dhama/${dhamaId}`,
} as const;

/** ЗКН-Н023 §4: корни разделов. Слаг личности не может совпасть ни с одним. */
export const ROOTS = [
  "", "practice", "calendar", "account",
  "lichnosti", "books", "bhajans", "kirtans", "prasad", "dhama",
  "iskcon", "krishna", "gauranga",
  "search", "favorites", "notes", "cart", "feed", "map", "admin", "my",
] as const;

/** ЗКН-Н023 §6: старый адрес → новый. Ломать чужую ссылку = ломать обещание. */
export const LEGACY: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/^\/dhana\/books(\/.*)?$/, (m) => "/books" + (m[1] || "")],
  [/^\/dhana\/bhajans(\/.*)?$/, (m) => "/bhajans" + (m[1] || "")],
  [/^\/dhana\/kirtans(\/.*)?$/, (m) => "/kirtans" + (m[1] || "")],
  [/^\/dhana\/prasad(\/.*)?$/, (m) => "/prasad" + (m[1] || "")],
  [/^\/dhana\/dhama(\/.*)?$/, (m) => "/dhama" + (m[1] || "")],
  [/^\/dhana(\/.*)?$/, (m) => "/lichnosti" + (m[1] || "")],
  [/^\/acharya(\/.*)?$/, (m) => "/lichnosti" + (m[1] || "")],
  // /book/bg → /bhagavad-gita (шифр разворачивается в полное имя в App)
  [/^\/books?\/([a-z0-9-]+)((?:\/.*)?)$/, (m) => "/" + m[1] + (m[2] || "")],
  [/^\/bhajan\/(.+)$/, (m) => "/bhajans/" + m[1]],
  [/^\/kirtan\/(.+)$/, (m) => "/kirtans/" + m[1]],
  [/^\/prasadam\/(.+)$/, (m) => "/prasad/" + m[1]],
  [/^\/center\/(.+)$/, (m) => "/iskcon/centers/" + m[1]],
];

/** Привести старый адрес к новому. Вернёт null, если адрес уже канонический. */
export function canonicalPath(path: string): string | null {
  for (const [rx, to] of LEGACY) {
    const m = path.match(rx);
    if (m) return to(m);
  }
  return null;
}

/** Абсолютный адрес для шаринга и QR. Единственный способ получить полный URL. */
export function url(path: string): string {
  return ORIGIN + (path.startsWith("/") ? path : "/" + path);
}

/** Все канонические пути — для аудита живости ссылок (tools/links-audit.py). */
export function allCanonicalPaths(): string[] {
  return [
    ROUTES.home(), ROUTES.practice(), ROUTES.calendar(), ROUTES.account(),
    ROUTES.dhana(), ROUTES.books(), ROUTES.bhajans(), ROUTES.kirtans(),
    ROUTES.prasad(), ROUTES.dhama(), ROUTES.iskcon(),
    ROUTES.krishna(), ROUTES.gauranga(), ROUTES.cookbook(),
  ];
}
