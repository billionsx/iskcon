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
export const ROUTES = {
  home: () => "/",
  practice: () => "/practice",
  calendar: () => "/calendar",
  account: () => "/account",

  // ── Богатства: шесть витрин (ЗКН-Н007) ──
  dhana: () => "/dhana",
  lichnosti: (lila?: string, wave?: string, group?: string) =>
    ["/dhana", lila, wave, group].filter(Boolean).join("/"),
  books: () => "/dhana/books",
  bhajans: () => "/dhana/bhajans",
  kirtans: () => "/dhana/kirtans",
  prasad: () => "/dhana/prasad",
  dhama: () => "/dhana/dhama",

  // ── Сущности ──
  entity: (id: string) => `/${id}`,
  book: (work: string, ...rest: string[]) => ["/book", work, ...rest].join("/"),
  bhajan: (slug: string) => `/bhajan/${slug}`,
  kirtanArtist: (slug: string) => `/kirtan/${slug}`,
  recipe: (slug: string) => `/prasadam/recipe/${slug}`,
  cookbook: (chapterId?: string) => (chapterId ? `/prasadam/book/${chapterId}` : "/prasadam/book"),
  tirtha: (dhamaId: string, tirthaId?: string) =>
    tirthaId ? `/dhama/${dhamaId}/${tirthaId}` : `/dhama/${dhamaId}`,
  center: (id: string) => `/center/${id}`,

  // ── Разделы ──
  iskcon: () => "/iskcon",
  krishna: (tab?: string, sub?: string) => ["/krishna", tab, sub].filter(Boolean).join("/"),
  gauranga: (tab?: string, sub?: string) => ["/gauranga", tab, sub].filter(Boolean).join("/"),
} as const;

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
