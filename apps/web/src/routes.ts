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

  // ── Садхана ──
  sadhana: () => "/sadhana",
  japa: () => "/japa",
  story: () => "/story",           // дневник садханы
  verse: () => "/verse",
  promise: () => "/promise",       // обеты
  progress: () => "/progress",
  darshan: () => "/darshan",
  darshanArchive: () => "/darshan/all",
  calendar: () => "/calendar",
  ekadashi: () => "/ekadashi",
  id: () => "/id",                 // кабинет

  // ── Богатства: витрины ──
  hero: () => "/hero",             // Личности
  books: () => "/books",
  bhajans: (slug?: string) => (slug ? `/bhajans/${slug}` : "/bhajans"),
  kirtans: (slug?: string) => (slug ? `/kirtans/${slug}` : "/kirtans"),
  prasad: () => "/prasad",
  dhama: (dhamaId?: string, tirthaId?: string) =>
    ["/dhama", dhamaId, tirthaId].filter(Boolean).join("/"),

  // ── Личности: лила в корне, если имя не занято книгой ──
  gaurangaLila: (wave?: string) => ["/gauranga-lila", wave].filter(Boolean).join("/"),
  krishnaLila: (rasa?: string) => ["/krishna-lila", rasa].filter(Boolean).join("/"),
  bhagavatam: (sub?: string) => ["/bhagavatam-lila", sub].filter(Boolean).join("/"),
  mahabharata: () => "/mahabharata-lila",
  ramayana: () => "/ramayana-lila",

  // ── Прасад ──
  recipe: (slug: string) => `/prasad/${slug}`,
  cookbook: (chapterId?: string) => (chapterId ? `/prasad/book/${chapterId}` : "/prasad/book"),

  // ── Книга: КОРЕНЬ, полное имя ──
  bookRead: (slug: string, ...rest: string[]) =>
    ["", slug, ...rest].filter(Boolean).join("/") || "/",

  // ── Личность: КОРЕНЬ ──
  entity: (id: string) => `/${id}`,

  // ── ИСККОН ──
  iskcon: (sub?: string) => (sub ? `/iskcon/${sub}` : "/iskcon"),
  center: (id: string) => `/iskcon/centers/${id}`,

  krishna: (tab?: string, sub?: string) => ["/krishna", tab, sub].filter(Boolean).join("/"),
  gauranga: (tab?: string, sub?: string) => ["/gauranga", tab, sub].filter(Boolean).join("/"),

  // ── Совместимость (только для 301) ──
  practice: () => "/sadhana",
  account: () => "/id",
  lichnosti: () => "/hero",
  dhana: () => "/hero",
  book: (work: string, ...rest: string[]) => ["", work, ...rest].filter(Boolean).join("/"),
  bhajan: (slug: string) => `/bhajans/${slug}`,
  kirtanArtist: (slug: string) => `/kirtans/${slug}`,
  tirtha: (d: string, t?: string) => (t ? `/dhama/${d}/${t}` : `/dhama/${d}`),
} as const;

/** ЗКН-Н023 §4: корни разделов. Слаг личности не может совпасть ни с одним. */
export const ROOTS = [
  "",
  // садхана
  "sadhana", "japa", "story", "verse", "promise", "progress", "darshan",
  "calendar", "ekadashi", "id",
  // богатства
  "hero", "books", "bhajans", "kirtans", "prasad", "dhama",
  // лилы и кластеры В КОРНЕ (решение основателя)
  // ⚠️ advaita и nityananda в корень НЕЛЬЗЯ — это Адвайта Ачарья и Нитьянанда
  // Прабху, живые личности. Корень принадлежит им.
  "gauranga-lila", "krishna-lila", "bhagavatam-lila", "mahabharata-lila",
  "ramayana-lila", "pancha-tattva", "avatars", "rishis", "bhaktas",
  "demigods", "asuras",
  // разделы
  "iskcon", "krishna", "gauranga",
  // служебные
  "search", "favorites", "notes", "cart", "donate", "feed", "map", "admin", "my",
] as const;

/** ЗКН-Н023 §6: старый адрес → новый. Ломать чужую ссылку = ломать обещание. */
export const LEGACY: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  // садхана
  [/^\/practice\/japa$/, () => "/japa"],
  [/^\/practice\/diary$/, () => "/story"],
  [/^\/practice\/verse$/, () => "/verse"],
  [/^\/practice\/vow$/, () => "/promise"],
  [/^\/practice\/progress$/, () => "/progress"],
  [/^\/practice\/darshan$/, () => "/darshan/all"],   // архив даршанов уехал вглубь
  [/^\/feed$/, () => "/darshan"],                    // «Лента» → «Даршан» (13.07.2026)
  [/^\/practice(\/.*)?$/, (m) => "/sadhana" + (m[1] || "")],
  [/^\/account(\/.*)?$/, (m) => "/id" + (m[1] || "")],

  // личности
  [/^\/(?:dhana|lichnosti|acharya)\/gauranga-lila(\/.*)?$/, (m) => "/gauranga-lila" + (m[1] || "")],
  [/^\/(?:dhana|lichnosti|acharya)\/krishna-lila(\/.*)?$/, (m) => "/krishna-lila" + (m[1] || "")],
  [/^\/(?:dhana|lichnosti|acharya)\/shrimad-bhagavatam(\/.*)?$/, (m) => "/bhagavatam-lila" + (m[1] || "")],
  [/^\/hero\/shrimad-bhagavatam(\/.*)?$/, (m) => "/bhagavatam-lila" + (m[1] || "")],
  [/^\/hero\/mahabharata$/, () => "/mahabharata-lila"],
  [/^\/hero\/ramayana$/, () => "/ramayana-lila"],
  [/^\/(?:dhana|lichnosti|acharya)\/books(\/.*)?$/, (m) => "/books" + (m[1] || "")],
  [/^\/(?:dhana|lichnosti|acharya)\/bhajans(\/.*)?$/, (m) => "/bhajans" + (m[1] || "")],
  [/^\/(?:dhana|lichnosti|acharya)\/kirtans(\/.*)?$/, (m) => "/kirtans" + (m[1] || "")],
  [/^\/(?:dhana|lichnosti|acharya)\/prasad(\/.*)?$/, (m) => "/prasad" + (m[1] || "")],
  [/^\/(?:dhana|lichnosti|acharya)\/dhama(\/.*)?$/, (m) => "/dhama" + (m[1] || "")],
  [/^\/(?:dhana|lichnosti|acharya)(\/.*)?$/, (m) => "/hero" + (m[1] || "")],

  // старые волны
  [/^\/gauranga-lila\/1-volna(\/.*)?$/, (m) => "/gauranga-lila/first-wave" + (m[1] || "")],
  [/^\/gauranga-lila\/2-volna(\/.*)?$/, (m) => "/gauranga-lila/second-wave" + (m[1] || "")],
  [/^\/gauranga-lila\/3-volna(\/.*)?$/, (m) => "/gauranga-lila/third-wave" + (m[1] || "")],
  [/^\/gauranga-lila\/4-volna(\/.*)?$/, (m) => "/gauranga-lila/fourth-wave" + (m[1] || "")],
  [/^\/gauranga-lila\/5-volna(\/.*)?$/, (m) => "/gauranga-lila/fifth-wave" + (m[1] || "")],

  // книги, бхаджаны, киртаны, прасад, центры
  [/^\/books?\/([a-z0-9-]+)((?:\/.*)?)$/, (m) => "/" + m[1] + (m[2] || "")],
  [/^\/bhajan\/(.+)$/, (m) => "/bhajans/" + m[1]],
  [/^\/kirtan\/(.+)$/, (m) => "/kirtans/" + m[1]],
  [/^\/prasadam\/recipe\/(.+)$/, (m) => "/prasad/" + m[1]],
  [/^\/prasad\/recipe\/(.+)$/, (m) => "/prasad/" + m[1]],
  [/^\/prasadam(\/.*)?$/, (m) => "/prasad" + (m[1] || "")],
  [/^\/center\/(.+)$/, (m) => "/iskcon/centers/" + m[1]],
  [/^\/centers$/, () => "/iskcon/centers"],
  [/^\/iskcon\/news$/, () => "/darshan/news"],   // «Новости» уехали из ИСККОН в ленту Даршана (13.07.2026)
  [/^\/entity\/(.+)$/, (m) => "/" + m[1]],
  [/^\/person\/(.+)$/, (m) => "/" + m[1]],
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
