/**
 * Book data model — single source of truth for book unit cards (юнит-стандарт)
 * and the product detail page. Add a new book = add an entry here.
 */
export interface BookData {
  id: string;            // entity/work id (matches D1 works.id)
  work: string;          // D1 work_id used in API paths (/api/books/<work>/…): "bg", "cc"
  slug: string;          // url slug for detail route
  titleLine1: string;    // big title, one line ("Бхагавад-гита")
  titleLine2?: string;   // smaller second line ("как она есть"), future slot for canto/song
  iast: string;          // "Bhagavad-gītā"
  tagline: string;       // short gloss after iast ("Песнь Бога")
  author: string;        // full title of the author, single line
  description: string;   // presentation blurb, strictly per Prabhupāda framing
  publisher: "bbt";      // authority logo on card
  covers: string[];      // gallery; first = primary cover
  chips: string[];       // факт-чипы герой-карточки. Стандарт: «n глав / n стихов / n лет»;
                         // для прозы без стихов (НП) — «n глав / n лет / изначальный автор».
                         // Подробнее: docs/STANDARD_book_chips.md
  hierarchical?: boolean; // multi-part book (lila/canto → chapter), e.g. ЧЧ/ШБ
  uniformTitle?: boolean; // render titleLine2 at the same size/weight as titleLine1 (целостное название)
  hideCardIast?: boolean; // don't print the IAST (Latin) title on the card cover
  prose?: boolean;        // prose book (no 5-layer verses): chapters of flowing text, e.g. «Нектар преданности»
}

export const BOOKS: Record<string, BookData> = {
  bg: {
    id: "bhagavad_gita",
    work: "bg",
    slug: "bhagavad-gita",
    titleLine1: "Бхагавад-гита",
    titleLine2: "как она есть",
    iast: "Bhagavad-gītā",
    tagline: "Песнь Бога",
    author:
      "Его Божественная Милость А.\u00a0Ч. Бхактиведанта Свами Прабхупада, Ачарья-основатель Международного общества сознания Кришны, ИСККОН",
    description:
      "Квинтэссенция ведического знания: природа вечной души, Верховная Личность Бога и путь преданного служения.",
    publisher: "bbt",
    covers: [
      "/covers/bg-003.png?v=4", // синяя колесница (Кришна правит четвёркой коней) — обложка
      "/covers/bg-002.png?v=4",
      "/covers/bg-005.png?v=4",
      "/covers/bg-004.png?v=4",
      "/covers/bg-007.png?v=4",
      "/covers/bg-006.png?v=4",
      "/covers/bg-001.png?v=4",
    ],
    chips: ["18 глав", "700 стихов", "5 000+ лет"],
  },
  cc: {
    id: "cc",
    work: "cc",
    slug: "chaitanya-charitamrita",
    titleLine1: "Шри Чайтанья-",
    titleLine2: "чаритамрита",
    iast: "Śrī Caitanya-caritāmṛta",
    tagline: "Нектар деяний Господа Чайтаньи",
    author:
      "Его Божественная Милость А.\u00a0Ч. Бхактиведанта Свами Прабхупада, Ачарья-основатель Международного общества сознания Кришны, ИСККОН",
    description:
      "Жизнь и учение Шри Чайтаньи Махапрабху — золотого воплощения Господа, явившего миру совместное пение святых имён.",
    publisher: "bbt",
    covers: [
      "/covers/cc-001.png?v=1",
      "/covers/cc-002.png?v=1",
      "/covers/cc-003.png?v=1",
      "/covers/cc-004.png?v=1",
      "/covers/cc-005.png?v=1",
      "/covers/cc-006.png?v=1",
      "/covers/cc-007.png?v=1",
      "/covers/cc-008.png?v=1",
      "/covers/cc-009.png?v=1",
      "/covers/cc-0010.png?v=1",
      "/covers/cc-0011.png?v=1",
      "/covers/cc-0012.png?v=1",
      "/covers/cc-0013.png?v=1",
      "/covers/cc-0015.png?v=1",
      "/covers/cc-0016.png?v=1",
      "/covers/cc-0017.png?v=1",
      "/covers/cc-0018.png?v=1",
      "/covers/cc-0019.png?v=1",
      "/covers/cc-0020.png?v=1",
      "/covers/cc-0021.png?v=1",
    ],
    chips: ["62 главы", "11 000+ стихов", "500+ лет"],
    hierarchical: true,
    uniformTitle: true,
    hideCardIast: true,
  },
  sb: {
    id: "sb",
    work: "sb",
    slug: "srimad-bhagavatam",
    titleLine1: "Шримад-",
    titleLine2: "Бхагаватам",
    iast: "Śrīmad-Bhāgavatam",
    tagline: "Зрелый плод древа ведической литературы",
    author:
      "Его Божественная Милость А.\u00a0Ч. Бхактиведанта Свами Прабхупада, Ачарья-основатель Международного общества сознания Кришны, ИСККОН",
    description:
      "«Бхагавата-пурана» — сливки всех Вед: повествования о Верховной Личности Бога, Его воплощениях и преданных, ведущие к высшей цели жизни — чистой любви к Богу.",
    publisher: "bbt",
    covers: [
      "/covers/sb-001.png?v=1",
      "/covers/sb-002.png?v=1",
      "/covers/sb-003.png?v=1",
      "/covers/sb-004.png?v=1",
      "/covers/sb-005.png?v=1",
      "/covers/sb-006.png?v=1",
      "/covers/sb-007.png?v=1",
      "/covers/sb-008.png?v=1",
      "/covers/sb-009.png?v=1",
      "/covers/sb-0010.png?v=1",
      "/covers/sb-0011.png?v=1",
      "/covers/sb-0012.png?v=1",
      "/covers/sb-0013.png?v=1",
      "/covers/sb-0014.png?v=1",
      "/covers/sb-0015.png?v=1",
      "/covers/sb-0016.png?v=1",
      "/covers/sb-0017.png?v=1",
      "/covers/sb-0018.png?v=1",
      "/covers/sb-0019.png?v=1",
      "/covers/sb-0020.png?v=1",
      "/covers/sb-0021.png?v=1",
      "/covers/sb-0022.png?v=1",
      "/covers/sb-0024.png?v=1",
      "/covers/sb-0025.png?v=1",
      "/covers/sb-0026.png?v=1",
    ],
    chips: ["335 глав", "~18 000 стихов", "5 000+ лет"],
    hierarchical: true,
    uniformTitle: true,
    hideCardIast: true,
  },
  brs: {
    id: "brs",
    work: "brs",
    slug: "nectar-of-devotion",
    titleLine1: "Нектар",
    titleLine2: "преданности",
    iast: "Bhakti-rasāmṛta-sindhu",
    tagline: "Наука преданного служения",
    author:
      "Его Божественная Милость А.\u00a0Ч. Бхактиведанта Свами Прабхупада, Ачарья-основатель Международного общества сознания Кришны, ИСККОН",
    description:
      "Изложение «Бхакти-расамрита-синдху» Шрилы Рупы Госвами — науки о том, как развить чистую любовь к Богу и вкусить нектар взаимоотношений с Кришной.",
    publisher: "bbt",
    covers: [
      "/covers/brs-001.png",
    ],
    chips: ["51 глава", "500+ лет", "Рупа Госвами"],
    hierarchical: false,
    uniformTitle: true,
    prose: true,
  },
  iso: {
    id: "iso",
    work: "iso",
    slug: "sri-isopanisad",
    titleLine1: "Шри",
    titleLine2: "Ишопанишад",
    iast: "Śrī Īśopaniṣad",
    tagline: "Мантры совершенного знания",
    author:
      "Его Божественная Милость А.\u00a0Ч. Бхактиведанта Свами Прабхупада, Ачарья-основатель Международного общества сознания Кришны, ИСККОН",
    description:
      "Главная из Упанишад: всё живое и неживое принадлежит Господу. Путь к освобождению — знание о Верховной Личности Бога и отказ от ложного обладания.",
    publisher: "bbt",
    covers: [
      "/covers/iso-001.png",
    ],
    chips: ["18 мантр", "Упанишада", "5 000+ лет"],
    hierarchical: false,
    uniformTitle: true,
  },
  noi: {
    id: "noi",
    work: "noi",
    slug: "nectar-of-instruction",
    titleLine1: "Нектар",
    titleLine2: "наставлений",
    iast: "Upadeśāmṛta",
    tagline: "Наставления Рупы Госвами",
    author:
      "Его Божественная Милость А.\u00a0Ч. Бхактиведанта Свами Прабхупада, Ачарья-основатель Международного общества сознания Кришны, ИСККОН",
    description:
      "Одиннадцать наставлений Шрилы Рупы Госвами: как обуздать ум и язык, кого избегать и кому служить, и как достичь высших ступеней любви к Кришне.",
    publisher: "bbt",
    covers: [
      "/covers/noi-001.png",
    ],
    chips: ["11 стихов", "Рупа Госвами", "500+ лет"],
    hierarchical: false,
    uniformTitle: true,
  },
  owk: {
    id: "owk",
    work: "owk",
    slug: "on-the-way-to-krishna",
    titleLine1: "На пути",
    titleLine2: "к Кришне",
    iast: "On the Way to Kṛṣṇa",
    tagline: "Путь к высшему счастью",
    author:
      "Его Божественная Милость А.\u00a0Ч. Бхактиведанта Свами Прабхупада, Ачарья-основатель Международного общества сознания Кришны, ИСККОН",
    description:
      "Как обрести подлинное, непреходящее счастье: природа сознания, преодоление иллюзии материального наслаждения и практика любви к Богу.",
    publisher: "bbt",
    covers: [
      "/covers/owk-001.png",
    ],
    chips: ["5 глав", "беседы Прабхупады", "XX век"],
    hierarchical: false,
    uniformTitle: true,
    prose: true,
  },
  rv: {
    id: "rv",
    work: "rv",
    slug: "raja-vidya",
    titleLine1: "Раджа-видья",
    iast: "Rāja-vidyā",
    tagline: "Царь знания",
    author:
      "Его Божественная Милость А.\u00a0Ч. Бхактиведанта Свами Прабхупада, Ачарья-основатель Международного общества сознания Кришны, ИСККОН",
    description:
      "Сокровенное знание девятой главы «Бхагавад-гиты» — самый царственный и сокровенный путь: прямое преданное служение Верховной Личности Бога.",
    publisher: "bbt",
    covers: [
      "/covers/rv-001.png",
    ],
    chips: ["8 глав", "по «Бхагавад-гите»", "5 000+ лет"],
    hierarchical: false,
    prose: true,
  },
  pop: {
    id: "pop",
    work: "pop",
    slug: "path-of-perfection",
    titleLine1: "Путь",
    titleLine2: "к совершенству",
    iast: "The Path of Perfection",
    tagline: "Совершенство по «Гите»",
    author:
      "Его Божественная Милость А.\u00a0Ч. Бхактиведанта Свами Прабхупада, Ачарья-основатель Международного общества сознания Кришны, ИСККОН",
    description:
      "Система подлинной йоги по шестой главе «Бхагавад-гиты»: сосредоточение ума на Кришне как высшая ступень и цель всех методов йоги.",
    publisher: "bbt",
    covers: [
      "/covers/pop-001.png",
    ],
    chips: ["11 глав", "по «Бхагавад-гите»", "5 000+ лет"],
    hierarchical: false,
    uniformTitle: true,
    prose: true,
  },
  bbd: {
    id: "bbd",
    work: "bbd",
    slug: "beyond-birth-and-death",
    titleLine1: "По ту сторону",
    titleLine2: "рождения и смерти",
    iast: "Beyond Birth and Death",
    tagline: "Тайна жизни и смерти",
    author:
      "Его Божественная Милость А.\u00a0Ч. Бхактиведанта Свами Прабхупада, Ачарья-основатель Международного общества сознания Кришны, ИСККОН",
    description:
      "Что происходит с душой после смерти и как выйти за пределы рождения и смерти. Природа вечного «я» согласно ведическим писаниям.",
    publisher: "bbt",
    covers: [
      "/covers/bbd-001.png",
    ],
    chips: ["5 глав", "лекции Прабхупады", "XX век"],
    hierarchical: false,
    uniformTitle: true,
    prose: true,
  },
  poy: {
    id: "poy",
    work: "poy",
    slug: "perfection-of-yoga",
    titleLine1: "Совершенство",
    titleLine2: "йоги",
    iast: "The Perfection of Yoga",
    tagline: "Истинная йога",
    author:
      "Его Божественная Милость А.\u00a0Ч. Бхактиведанта Свами Прабхупада, Ачарья-основатель Международного общества сознания Кришны, ИСККОН",
    description:
      "Совершенство йоги — не телесные упражнения, а сосредоточение ума на Верховной Личности Бога, как учит «Бхагавад-гита».",
    publisher: "bbt",
    covers: [
      "/covers/poy-001.png",
    ],
    chips: ["8 глав", "по «Бхагавад-гите»", "5 000+ лет"],
    hierarchical: false,
    uniformTitle: true,
    prose: true,
  },
  sc: {
    id: "sc",
    work: "sc",
    slug: "second-chance",
    titleLine1: "Ещё",
    titleLine2: "один шанс",
    iast: "A Second Chance",
    tagline: "Второй шанс для души",
    author:
      "Его Божественная Милость А.\u00a0Ч. Бхактиведанта Свами Прабхупада, Ачарья-основатель Международного общества сознания Кришны, ИСККОН",
    description:
      "История Аджамилы из «Шримад-Бхагаватам»: даже величайший грешник обретает спасение, повторяя святое имя Господа. Каждой душе дан второй шанс.",
    publisher: "bbt",
    covers: [
      "/covers/sc-001.png",
    ],
    chips: ["23 главы", "по «Шримад-Бхагаватам»", "5 000+ лет"],
    hierarchical: false,
    uniformTitle: true,
    prose: true,
  },
  tqk: {
    id: "tqk",
    work: "tqk",
    slug: "teachings-of-queen-kunti",
    titleLine1: "Молитвы",
    titleLine2: "царицы Кунти",
    iast: "Teachings of Queen Kuntī",
    tagline: "Молитвы царицы",
    author:
      "Его Божественная Милость А.\u00a0Ч. Бхактиведанта Свами Прабхупада, Ачарья-основатель Международного общества сознания Кришны, ИСККОН",
    description:
      "Молитвы царицы Кунти из «Шримад-Бхагаватам» в изложении Шрилы Прабхупады: смирение, преданность и благодарность Господу за посланные испытания.",
    publisher: "bbt",
    covers: [
      "/covers/tqk-001.png",
    ],
    chips: ["24 главы", "по «Шримад-Бхагаватам»", "5 000+ лет"],
    hierarchical: false,
    uniformTitle: true,
    prose: true,
  },
  lob: {
    id: "lob",
    work: "lob",
    slug: "light-of-the-bhagavata",
    titleLine1: "Свет",
    titleLine2: "Бхагаваты",
    iast: "Light of the Bhāgavata",
    tagline: "Сорок восемь медитаций",
    author:
      "Его Божественная Милость А.\u00a0Ч. Бхактиведанта Свами Прабхупада, Ачарья-основатель Международного общества сознания Кришны, ИСККОН",
    description:
      "Сорок восемь поэтических зарисовок сезона дождей и осени из «Шримад-Бхагаватам» с комментариями Шрилы Прабхупады: красота природы как отражение духовной реальности.",
    publisher: "bbt",
    covers: [
      "/covers/lob-001.png",
    ],
    chips: ["48 текстов", "по «Бхагаватам»", "5 000+ лет"],
    hierarchical: false,
    uniformTitle: true,
    prose: true,
  },
  spl: {
    id: "spl",
    work: "spl",
    slug: "prabhupada-lilamrita",
    titleLine1: "Шрила Прабхупада-",
    titleLine2: "лиламрита",
    iast: "Śrīla Prabhupāda-līlāmṛta",
    tagline: "Жизнеописание Ачарьи-основателя",
    author:
      "Сатсварупа Дас Госвами",
    description:
      "Каноническое жизнеописание Его Божественной Милости А.\u00a0Ч. Бхактиведанты Свами Прабхупады: от детства в Калькутте до основания всемирного Движения сознания Кришны.",
    publisher: "bbt",
    covers: [
      "/covers/spl-001.png",
    ],
    chips: ["62 главы", "2 тома", "1896\u20131977"],
    hierarchical: false,
    uniformTitle: true,
    prose: true,
  },
};

/**
 * Книги, для которых уже подключён звук (плейлист аудиокниги).
 * Остальные книги показывают «Аудиокнига — скоро» вместо запуска плеера.
 */
export const AUDIO_WORKS: Record<string, boolean> = { bg: true, cc: true };

/**
 * СТАНДАРТ НАПИСАНИЯ НАЗВАНИЯ КНИГИ — единый источник истины.
 *
 * `titleLine1`/`titleLine2` существуют ТОЛЬКО для двухстрочной вёрстки обложки
 * (герой-карточка и титул PDF). Везде, где название выводится как одна строка
 * — шапка ридера, шеринг, имя PDF-файла, мини-плеер, QR, контекст «Сообщить
 * об ошибке» — берётся ИСКЛЮЧИТЕЛЬНО `bookFullTitle()`.
 *
 * Правило склейки: если первая строка заканчивается дефисом — соединяем без
 * пробела (часть одного слова), иначе через пробел.
 *   «Шримад-» + «Бхагаватам»      → «Шримад-Бхагаватам»
 *   «Шри Чайтанья-» + «чаритамрита» → «Шри Чайтанья-чаритамрита»
 *   «Бхагавад-гита» + «как она есть» → «Бхагавад-гита как она есть»
 *   «Нектар» + «преданности»       → «Нектар преданности»
 *
 * Канон совпадает с названиями в API (apps/api/src/routes/books.ts). Не
 * выводить голый `titleLine1` как самостоятельное название — будет обрубок.
 */
export function bookFullTitle(b: BookData): string {
  return b.titleLine2 ? `${b.titleLine1}${b.titleLine1.endsWith("-") ? "" : " "}${b.titleLine2}` : b.titleLine1;
}

/**
 * Стандартный share / Open-Graph заголовок книги:
 *   «<Полное название>. ISKCON ONE LOVE. ИСККОН.»
 * Единый источник — клиентский шеринг и edge-инъектор OG.
 */

export function bookShareTitle(b: BookData): string {
  return `${bookFullTitle(b)}. ISKCON ONE LOVE. ИСККОН.`;
}

/** Primary cover (absolute path on the site) used as the share/OG image for a book. */
export function bookShareImage(b: BookData): string {
  return b.covers[0] ?? "/og-default.png";
}

/** The menu of book functions (⋯). Single source — shared by card, detail page and verse reader. */
export const BOOK_MENU_ITEMS = [
  "Скачать PDF",
  "QR-код",
  "Поделиться",
  "Заказать печатную книгу",
  "Язык издания — Русский",
  "Стих дня из книги",
  "Добавить в план чтения",
  "Поддержать печать",
  "О книге и об авторе",
];

/* ───────────── Библиотека-хаб: каталог всех книг реестра с разбивкой по линии ─────────────
 * Расширяет BOOKS (читаемые издания с обложками и контентом в D1) до полного реестра
 * книг канонического реестра (works ↔ entities). Каждая запись связана с автором-героем
 * (entities.id) → связь «книга↔герой». readable=true → открывается в ридере (есть в BOOKS),
 * иначе — карточка-сущность книги (страница героя книги) + метка «скоро».
 * Источник истины совпадает с docs/entity-registry (works.author_id ↔ отношение author-of). */
export type Lineage = "prabhupada" | "acharya" | "guru-iskcon";

export interface CatalogBook {
  id: string;          // entities/works id
  title: string;       // одностроч. название (строка списка + поиск)
  iast?: string;
  note?: string;       // короткий глосс под названием
  authorName?: string; // отображаемый автор (первоисточник)
  authorId?: string;   // entities.id автора → EntityPage (связь книга↔герой)
  lineage: Lineage;
  readable: boolean;   // есть в BOOKS (ридер); иначе — «скоро»
  also?: string;       // доп. поисковые термины: первоисточный автор + латинские варианты
}

export const LINEAGE_LABEL: Record<Lineage, string> = {
  prabhupada: "Шрила Прабхупада",
  acharya: "Ачарьи-вайшнавы",
  "guru-iskcon": "Гуру ИСККОН",
};

export const LINEAGE_NOTE: Record<Lineage, string> = {
  prabhupada: "Ачарья-основатель ИСККОН — канон в авторитетном переводе с пословным санскритом",
  acharya: "Первоисточники парампары и труды предшествующих ачарьев",
  "guru-iskcon": "Те, кто принял миссию и продолжает линию",
};

export const LIBRARY: CatalogBook[] = [
  // — Шрила Прабхупада (читаемые сначала) —
  { id: "bg",  title: "Бхагавад-гита как она есть", iast: "Bhagavad-gītā",        note: "Песнь Бога",                   authorId: "prabhupada", authorName: "Шрила Прабхупада", lineage: "prabhupada", readable: true, also: "Gita Гитопанишад Bhagavadgita Prabhupada Bhaktivedanta" },
  { id: "sb",  title: "Шримад-Бхагаватам",          iast: "Śrīmad-Bhāgavatam",     note: "Зрелый плод древа Вед",        authorId: "prabhupada", authorName: "Шрила Прабхупада", lineage: "prabhupada", readable: true, also: "Вьясадева Vyasa Бхагавата-пурана Bhagavata Purana Srimad Prabhupada Bhaktivedanta" },
  { id: "cc",  title: "Шри Чайтанья-чаритамрита",   iast: "Śrī Caitanya-caritāmṛta", note: "Деяния Господа Чайтаньи",     authorId: "prabhupada", authorName: "Шрила Прабхупада", lineage: "prabhupada", readable: true, also: "Кришнадас Кавираджа Krishnadasa Kaviraja Chaitanya Caitanya Prabhupada Bhaktivedanta" },
  { id: "brs", title: "Нектар преданности",          iast: "Bhakti-rasāmṛta-sindhu", note: "Наука преданного служения",   authorId: "prabhupada", authorName: "Шрила Прабхупада", lineage: "prabhupada", readable: true, also: "Рупа Госвами Rupa Goswami Gosvami Bhakti-rasamrita Prabhupada Bhaktivedanta" },
  { id: "krishna-book", title: "Кришна. Верховная Личность Бога", iast: "Kṛṣṇa",   note: "Игры Кришны из Десятой песни", authorId: "prabhupada", authorName: "Шрила Прабхупада", lineage: "prabhupada", readable: false, also: "Krishna Кришна KRSNA Prabhupada Bhaktivedanta" },
  { id: "tlc", title: "Учение Шри Чайтаньи",         iast: "Teachings of Lord Caitanya",                                  authorId: "prabhupada", authorName: "Шрила Прабхупада", lineage: "prabhupada", readable: false, also: "Teachings Chaitanya Caitanya Учение Prabhupada Bhaktivedanta" },
  { id: "noi", title: "Нектар наставлений",          iast: "Upadeśāmṛta",           note: "Наставления Шрилы Рупы Госвами", authorId: "prabhupada", authorName: "Шрила Прабхупада", lineage: "prabhupada", readable: true, also: "Рупа Госвами Rupa Goswami Upadeshamrita Upadesamrta Nectar of Instruction Prabhupada Bhaktivedanta" },
  { id: "iso", title: "Шри Ишопанишад",              iast: "Śrī Īśopaniṣad",        note: "Мантры совершенного знания",   authorId: "prabhupada", authorName: "Шрила Прабхупада", lineage: "prabhupada", readable: true, also: "Isopanishad Ishopanishad Ишопанишада Iso Prabhupada Bhaktivedanta" },
  { id: "owk", title: "На пути к Кришне",             iast: "On the Way to Kṛṣṇa",                                         authorId: "prabhupada", authorName: "Шрила Прабхупада", lineage: "prabhupada", readable: true,  also: "On the Way to Krishna Путь Прабхупада Bhaktivedanta" },
  { id: "rv",  title: "Раджа-видья. Царь знания",     iast: "Rāja-vidyā",            note: "Царь знания",                  authorId: "prabhupada", authorName: "Шрила Прабхупада", lineage: "prabhupada", readable: true,  also: "Raja-vidya King of Knowledge Раджа-видья Прабхупада Bhaktivedanta" },
  { id: "pop", title: "Путь к совершенству",          iast: "The Path of Perfection", note: "Йога по «Бхагавад-гите»",      authorId: "prabhupada", authorName: "Шрила Прабхупада", lineage: "prabhupada", readable: true,  also: "Path of Perfection Путь к совершенству Прабхупада Bhaktivedanta" },
  { id: "bbd", title: "По ту сторону рождения и смерти", iast: "Beyond Birth and Death",                                   authorId: "prabhupada", authorName: "Шрила Прабхупада", lineage: "prabhupada", readable: true,  also: "Beyond Birth and Death По ту сторону Прабхупада Bhaktivedanta" },
  { id: "poy", title: "Совершенство йоги",            iast: "The Perfection of Yoga",                                      authorId: "prabhupada", authorName: "Шрила Прабхупада", lineage: "prabhupada", readable: true,  also: "Perfection of Yoga Совершенство йоги Прабхупада Bhaktivedanta" },
  { id: "sc",  title: "Ещё один шанс",                iast: "A Second Chance",       note: "История Аджамилы",             authorId: "prabhupada", authorName: "Шрила Прабхупада", lineage: "prabhupada", readable: true,  also: "Second Chance Ещё один шанс Аджамила Ajamila Прабхупада Bhaktivedanta" },
  { id: "tqk", title: "Молитвы царицы Кунти",         iast: "Teachings of Queen Kuntī", note: "Молитвы из «Бхагаватам»",   authorId: "prabhupada", authorName: "Шрила Прабхупада", lineage: "prabhupada", readable: true,  also: "Teachings of Queen Kunti Молитвы царицы Кунти Kuntidevi Прабхупада Bhaktivedanta" },
  { id: "lob", title: "Свет Бхагаваты",               iast: "Light of the Bhāgavata",  note: "48 медитаций",                authorId: "prabhupada", authorName: "Шрила Прабхупада", lineage: "prabhupada", readable: true,  also: "Light of the Bhagavata Свет Бхагаваты Прабхупада Bhaktivedanta" },
  { id: "spl", title: "Шрила Прабхупада-лиламрита",   iast: "Śrīla Prabhupāda-līlāmṛta", note: "Жизнеописание Ачарьи-основателя", authorId: "satsvarupa-das-goswami", authorName: "Сатсварупа Дас Госвами", lineage: "prabhupada", readable: true,  also: "Prabhupada-lilamrita Лиламрита Satsvarupa Прабхупада" },
  // — Ачарьи-вайшнавы и первоисточники парампары —
  { id: "cb",  title: "Чайтанья-бхагавата",          iast: "Caitanya-bhāgavata",    authorId: "vrindavana-dasa-thakura", authorName: "Вриндаван дас Тхакур",  lineage: "acharya", readable: false, also: "Чайтанья-бхагавата Caitanya-bhagavata Вриндаван" },
  { id: "cm",  title: "Чайтанья-мангала",            iast: "Caitanya-maṅgala",      authorId: "lochana-dasa-thakura",    authorName: "Лочана дас Тхакур",     lineage: "acharya", readable: false, also: "Чайтанья-мангала Caitanya-mangala Лочана" },
  { id: "ggd", title: "Гаура-ганоддеша-дипика",      iast: "Gaura-gaṇoddeśa-dīpikā", authorId: "kavi-karnapura",         authorName: "Кави Карнапура",        lineage: "acharya", readable: false, also: "Гаура-ганоддеша Gaura-ganoddesa Карнапура" },
  { id: "bs",  title: "Брахма-самхита",              iast: "Brahma-saṁhitā",        note: "Молитвы Господа Брахмы",                                            lineage: "acharya", readable: false, also: "Brahma Brahmasamhita" },
  { id: "hbv", title: "Хари-бхакти-виласа",          iast: "Hari-bhakti-vilāsa",    note: "Свод вайшнавской практики",                                         lineage: "acharya", readable: false, also: "Sanatana" },
  { id: "vedanta-sutra", title: "Веданта-сутра",     iast: "Vedānta-sūtra",         authorId: "vyasadeva",               authorName: "Вьясадева",             lineage: "acharya", readable: false, also: "Vyasa Vyasadeva Baladeva Vedanta" },
  { id: "mahabharata",   title: "Махабхарата",       iast: "Mahābhārata",           authorId: "vyasadeva",               authorName: "Вьясадева",             lineage: "acharya", readable: false, also: "Vyasa Vyasadeva" },
  { id: "puranas",       title: "Пураны",            iast: "Purāṇa",                authorId: "vyasadeva",               authorName: "Вьясадева",             lineage: "acharya", readable: false, also: "Vyasa Vyasadeva Purana" },
  { id: "ramayana",      title: "Рамаяна",           iast: "Rāmāyaṇa",              authorId: "valmiki",                 authorName: "Валмики",               lineage: "acharya", readable: false, also: "Valmiki" },
  { id: "upanishads",    title: "Упанишады",         iast: "Upaniṣad",              note: "Философская вершина Вед",                                           lineage: "acharya", readable: false, also: "Upanishad" },
  { id: "vedas",         title: "Веды",              iast: "Veda",                  note: "Изначальное ведическое знание",                                     lineage: "acharya", readable: false, also: "Veda" },
  // — Гуру ИСККОН —
  { id: "prabhupada-lilamrita", title: "Шрила Прабхупада-лиламрита", iast: "Śrīla Prabhupāda-līlāmṛta", note: "Жизнеописание Ачарьи-основателя", authorId: "satsvarupa-das-goswami", authorName: "Сатсварупа Дас Госвами", lineage: "guru-iskcon", readable: false, also: "Prabhupada Bhaktivedanta Satsvarupa Lilamrita" },
];

/** Порядок секций хаба. */
export const LINEAGE_ORDER: Lineage[] = ["prabhupada", "acharya", "guru-iskcon"];
