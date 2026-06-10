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
