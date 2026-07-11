import { COVER_FALLBACK } from "./ui/CoverFallback";
/**
 * Каталог аудиотеки киртанов и бхаджанов (раздел «Киртаны»).
 *
 * Модель повторяет books.ts: каталог — статические, версионируемые данные, а
 * сам звук тянется live из Internet Archive (как у книг). «Альбом» = IA-элемент;
 * трек-лист строит воркер из метаданных IA (/api/kirtans/:id/audio), поэтому
 * добавление файлов в IA-элемент подхватывается без правок кода.
 *
 * Чистый TS (без React/DOM) — модуль импортируют и фронт, и воркер worker.ts.
 *
 * Классификации (как принято у гаудия-вайшнавов):
 *  • тип        — киртан / бхаджан / джапа / молитва / арати / мантра;
 *  • настроение — кому посвящено: маха-мантра, Кришна, Радха-Кришна, Гауранга
 *                 (Чайтанья), Нрисимха, гуру/ачарьи, Туласи, вайшнавам;
 *  • автор      — кто сложил текст (Бхактивинода Тхакур, Нароттама дас Тхакур…);
 *  • язык       — санскрит / бенгали / хинди.
 *
 * Проигрываемое ядро (проверено на Internet Archive — десятки mp3):
 *  • SP-13-Bhajans-with-Purport      — 176 бхаджанов Прабхупады с пословным смыслом;
 *  • sp-12-japa-and-kirtan_202012    — маха-мантра-киртаны 1965–1977 и джапа;
 *  • BestOfHareKrishnaKirtans        — сборник киртаний (Вайясаки, Агнидева, Мадхава…).
 */

export type KirtanType = "kirtan" | "bhajan" | "japa" | "prayer" | "arati" | "mantra";
export type KirtanMood =
  | "mahamantra" | "krishna" | "radha-krishna" | "gauranga"
  | "nrsimha" | "guru" | "tulasi" | "vaishnava";
export type KirtanLang = "sa" | "bn" | "hi";
export type KirtanComposer =
  | "prabhupada" | "bhaktivinoda" | "narottama" | "vishvanatha"
  | "jayadeva" | "bhaktisiddhanta" | "rupa" | "traditional";

export const TYPE_LABEL: Record<KirtanType, string> = {
  kirtan: "Киртан",
  bhajan: "Бхаджан",
  japa: "Джапа",
  prayer: "Молитва",
  arati: "Арати",
  mantra: "Мантра",
};

export const MOOD_LABEL: Record<KirtanMood, string> = {
  mahamantra: "Маха-мантра",
  krishna: "Кришна",
  "radha-krishna": "Радха-Кришна",
  gauranga: "Гауранга",
  nrsimha: "Нрисимха",
  guru: "Гуру и ачарьи",
  tulasi: "Туласи",
  vaishnava: "Вайшнавам",
};

export const LANG_LABEL: Record<KirtanLang, string> = {
  sa: "Санскрит",
  bn: "Бенгали",
  hi: "Хинди",
};

export const COMPOSER_LABEL: Record<KirtanComposer, string> = {
  prabhupada: "Шрила Прабхупада",
  bhaktivinoda: "Бхактивинода Тхакур",
  narottama: "Нароттама дас Тхакур",
  vishvanatha: "Вишванатха Чакраварти Тхакур",
  jayadeva: "Джаядева Госвами",
  bhaktisiddhanta: "Бхактисиддханта Сарасвати",
  rupa: "Рупа Госвами",
  traditional: "Традиционные",
};

export interface KirtanArtist {
  slug: string;
  name: string;          // отображаемое имя
  full?: string;         // полное имя/титул
  role: string;          // «Ачарья-основатель ИСККОН», «Киртания»…
  era?: string;          // годы жизни / «совр.»
  origin?: string;       // место / традиция
  bio: string;           // 1–2 предложения
  mono: string;          // 1–2 буквы для монограммы-аватара
  accent?: boolean;      // флагман (Шрила Прабхупада) — золотой акцент
  entityId?: string;     // связь с графом личностей (entities.id), если есть карточка
}

export interface KirtanAlbum {
  id: string;            // slug — в URL и API
  artist: string;        // slug исполнителя
  title: string;
  archive?: string;      // идентификатор Internet Archive (если есть звук)
  year?: string;
  type: KirtanType;
  moods: KirtanMood[];
  langs: KirtanLang[];
  composers: KirtanComposer[];
  note?: string;         // короткое описание
}

/** Исполнители-киртания (полный реестр; звук зажигается по мере добавления IA-альбомов). */
export const KIRTAN_ARTISTS: KirtanArtist[] = [
  {
    slug: "srila-prabhupada",
    name: "Шрила Прабхупада",
    full: "А.Ч. Бхактиведанта Свами Шрила Прабхупада",
    role: "Ачарья-основатель ИСККОН",
    era: "1896–1977",
    origin: "Калькутта · Вриндаван · весь мир",
    bio: "Принёс маха-мантру и киртан на Запад. Записал первые пластинки Харе Кришна — «Happening Album» (1966) и «Radha Krishna Temple» (1971) с Джорджем Харрисоном.",
    mono: "ШП",
    accent: true,
  },
  {
    slug: "aindra",
    name: "Аиндра Прабху",
    full: "Аиндра дас",
    role: "Основатель круглосуточного киртана",
    era: "1953–2010",
    origin: "Шри Вриндавана-дхама · Кришна-Баларам мандир",
    bio: "С 1986 года вёл непрерывный 24-часовой харинама-санкиртан в Кришна-Баларам мандире. Автор альбомов «Vrindavana Mellows» и «Vraja Vilas».",
    mono: "А",
  },
  {
    slug: "vaiyasaki",
    name: "Вайясаки дас",
    role: "Киртания",
    era: "совр.",
    origin: "Канада · Маяпур",
    bio: "Ученик Шрилы Прабхупады, один из самых любимых киртания ИСККОН. Известен альбомом «Sweet Chant of Love» и серией харинама-записей.",
    mono: "В",
  },
  {
    slug: "agnideva",
    name: "Агнидева дас",
    role: "Киртания",
    era: "совр.",
    origin: "США · Вриндаван",
    bio: "Классические мелодии киртана, бережно хранящие настроение ранних дней ИСККОН.",
    mono: "Аг",
  },
  {
    slug: "madhava",
    name: "Мадхава Прабху",
    role: "Киртания",
    era: "совр.",
    origin: "Маяпур-дхама",
    bio: "Один из ведущих голосов современного санкиртана, постоянный участник «Kirtan Mela» в Маяпуре.",
    mono: "М",
  },
  {
    slug: "bb-govinda-swami",
    name: "Б.Б. Говинда Свами",
    full: "Е.С. Бхакти Бринга Говинда Свами",
    role: "Санньяси · киртания",
    era: "совр.",
    origin: "США · Центральная Азия",
    bio: "Глубокий, медитативный киртан; вдохновитель множества преданных-музыкантов по всему миру.",
    mono: "ГС",
  },
  {
    slug: "indradyumna-swami",
    name: "Индрадьюмна Свами",
    full: "Е.С. Индрадьюмна Свами",
    role: "Санньяси · киртания",
    era: "совр.",
    origin: "Польский тур · Ратха-ятры мира",
    bio: "Громкий праздничный санкиртан фестивалей и Ратха-ятр на всех континентах.",
    mono: "ИС",
  },
  {
    slug: "sacinandana-swami",
    name: "Сачинандана Свами",
    full: "Е.С. Сачинандана Свами",
    role: "Санньяси · киртания",
    era: "совр.",
    origin: "Германия · Говардхана",
    bio: "Учитель медитации на святое имя; соединяет джапу, киртан и наставления о внутренней практике.",
    mono: "СС",
  },
  {
    slug: "badahari",
    name: "Бадахари дас",
    role: "Киртания",
    era: "совр.",
    origin: "США",
    bio: "Один из первых киртания-учеников Прабхупады; узнаваемый чистый голос ранних харинам.",
    mono: "Б",
  },
  {
    slug: "jahnavi-harrison",
    name: "Джахнави Харрисон",
    role: "Киртания · скрипка",
    era: "совр.",
    origin: "Бхактиведанта-мэнор · Лондон",
    bio: "Выросла в общине ИСККОН в Англии; соединяет киртан со скрипкой. Дебютный альбом — «Like a River to the Sea».",
    mono: "ДХ",
  },
  {
    slug: "gaura-vani",
    name: "Гаура Вани",
    full: "Гаура Вани Бучвальд",
    role: "Киртания",
    era: "совр.",
    origin: "Новый Вриндаван · США",
    bio: "Голос второго поколения преданных; ведёт группу «As Kindred Spirits», обновляя киртан для нового времени.",
    mono: "ГВ",
  },
  {
    slug: "various",
    name: "Киртания ИСККОН",
    role: "Сборник",
    era: "1966 — наши дни",
    origin: "Храмы и фестивали мира",
    bio: "Совместные записи разных киртания ИСККОН — киртаны и маха-мантра из храмов и фестивалей по всему свету.",
    mono: "♪",
  },
];

/**
 * Альбомы. Поле `archive` — идентификатор Internet Archive: его наличие делает
 * альбом проигрываемым (попадает в «Слушать сейчас»). Альбомы без `archive` —
 * дискография для полноты (показываются на странице исполнителя как записи).
 */
export const KIRTAN_ALBUMS: KirtanAlbum[] = [
  // ── Проигрываемое ядро (проверено на Internet Archive) ──
  {
    id: "sp-bhajans",
    artist: "srila-prabhupada",
    title: "Бхаджаны с комментариями",
    archive: "SP-13-Bhajans-with-Purport",
    type: "bhajan",
    moods: ["vaishnava", "krishna", "gauranga"],
    langs: ["bn", "sa"],
    composers: ["bhaktivinoda", "narottama", "traditional"],
    note: "176 бхаджанов с пословным смыслом — «Амара дживана», «Анади карама пхале», «Бхаджа бхаката-ватсала»…",
  },
  {
    id: "sp-japa-kirtan",
    artist: "srila-prabhupada",
    title: "Джапа и киртан",
    archive: "sp-12-japa-and-kirtan_202012",
    type: "kirtan",
    moods: ["mahamantra"],
    langs: ["sa"],
    composers: ["traditional"],
    note: "Маха-мантра Харе Кришна — киртаны 1965–1977, включая запись в ашраме д-ра Мишры, и джапа.",
  },
  {
    id: "best-harekrishna",
    artist: "various",
    title: "Лучшие киртаны Харе Кришна",
    archive: "BestOfHareKrishnaKirtans",
    type: "kirtan",
    moods: ["mahamantra", "krishna"],
    langs: ["sa"],
    composers: ["traditional"],
    note: "Сборник: Вайясаки, Агнидева, Мадхава, Кришна Дас и другие голоса санкиртана.",
  },

  // ── Дискография для полноты (звук появится по мере добавления IA-элементов) ──
  {
    id: "vrindavana-mellows",
    artist: "aindra",
    title: "Vrindavana Mellows",
    year: "2009",
    type: "kirtan",
    moods: ["mahamantra", "radha-krishna"],
    langs: ["sa"],
    composers: ["traditional"],
    note: "Живые киртаны Кришна-Баларам мандира в настроении Враджа.",
  },
  {
    id: "vraja-vilas",
    artist: "aindra",
    title: "Vraja Vilas",
    type: "kirtan",
    moods: ["mahamantra", "radha-krishna"],
    langs: ["sa"],
    composers: ["traditional"],
    note: "Продолжение враджа-настроения круглосуточного киртана.",
  },
  {
    id: "sweet-chant-of-love",
    artist: "vaiyasaki",
    title: "Sweet Chant of Love",
    type: "kirtan",
    moods: ["mahamantra", "krishna"],
    langs: ["sa", "bn"],
    composers: ["traditional"],
    note: "Один из самых любимых альбомов киртана ИСККОН.",
  },
  {
    id: "like-a-river",
    artist: "jahnavi-harrison",
    title: "Like a River to the Sea",
    year: "2015",
    type: "kirtan",
    moods: ["mahamantra", "krishna", "radha-krishna"],
    langs: ["sa", "bn"],
    composers: ["bhaktivinoda", "traditional"],
    note: "Киртан и молитвы со скрипкой. Дебютный альбом.",
  },
];

// ── Гидрация из D1 ──
// Источник истины — таблицы kirtan_artists/kirtan_albums (связь альбом→исполнитель,
// исполнитель→личность через entity_id). KIRTAN_* выше — сид/фолбэк (мгновенно,
// и синхронный поисковый индекс). Внутренние _artists/_albums хелперы читают живьём;
// hydrateKirtans() подменяет их данными из БД, useKirtans() даёт реактивность экранам.
let _artists: KirtanArtist[] = KIRTAN_ARTISTS;
let _albums: KirtanAlbum[] = KIRTAN_ALBUMS;

// ── Производные хелперы (используются хабом и страницей исполнителя) ──

export function artistBySlug(slug: string): KirtanArtist | undefined {
  return _artists.find((a) => a.slug === slug);
}

export function albumById(id: string): KirtanAlbum | undefined {
  return _albums.find((a) => a.id === id);
}

export function albumsByArtist(slug: string): KirtanAlbum[] {
  return _albums.filter((a) => a.artist === slug);
}

/** Альбомы со звуком (есть IA-идентификатор) — витрина «Слушать сейчас». */
export function playableAlbums(): KirtanAlbum[] {
  return _albums.filter((a) => !!a.archive);
}

export function artistPlayableCount(slug: string): number {
  return _albums.filter((a) => a.artist === slug && a.archive).length;
}

/** Обложка альбома: фирменная картинка IA-элемента (грузится напрямую, без прокси). */
export function albumCover(a: KirtanAlbum): string {
  // ЗКН-Д007: спектрограмма archive.org (services/img) — суррогат, не обложка.
  // Своих обложек у альбомов нет → фирменная заглушка.
  return COVER_FALLBACK;
}

/** Все настроения/типы, реально встречающиеся в каталоге (для чипов классификаций). */
export function moodsInCatalog(): KirtanMood[] {
  const set = new Set<KirtanMood>();
  for (const a of _albums) for (const m of a.moods) set.add(m);
  return (Object.keys(MOOD_LABEL) as KirtanMood[]).filter((m) => set.has(m));
}

export function typesInCatalog(): KirtanType[] {
  const set = new Set<KirtanType>();
  for (const a of _albums) set.add(a.type);
  return (Object.keys(TYPE_LABEL) as KirtanType[]).filter((t) => set.has(t));
}

/** Фильтр альбомов по типу и/или настроению (для секции «Жанры и настроения»). */
export function filterAlbums(opts: { type?: KirtanType | null; mood?: KirtanMood | null }): KirtanAlbum[] {
  return _albums.filter((a) =>
    (opts.type == null || a.type === opts.type) &&
    (opts.mood == null || a.moods.includes(opts.mood))
  );
}

// ── Гидрация из БД (плейн, без React — модуль грузит и воркер worker.ts) ──
// Реактивный хук useKirtans() живёт в отдельном модуле kirtansHydrate.ts.
let _version = 0;
const _subs = new Set<() => void>();

/** Текущие (гидрированные или сид) данные — для прямого рендера в хабе. */
export function kirtanArtists(): KirtanArtist[] { return _artists; }
export function kirtanAlbums(): KirtanAlbum[] { return _albums; }

/** Подменить каталог данными из D1 (вызывает kirtansHydrate). */
export function setKirtanData(artists: KirtanArtist[], albums: KirtanAlbum[]): void {
  if (Array.isArray(artists) && artists.length) _artists = artists;
  if (Array.isArray(albums) && albums.length) _albums = albums;
  _version++;
  _subs.forEach((f) => f());
}
export function subscribeKirtans(cb: () => void): () => void {
  _subs.add(cb);
  return () => { _subs.delete(cb); };
}
export function kirtanDataVersion(): number { return _version; }
