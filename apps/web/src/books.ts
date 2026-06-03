/**
 * Book data model — single source of truth for book unit cards (юнит-стандарт)
 * and the product detail page. Add a new book = add an entry here.
 */
export interface BookData {
  id: string;            // entity/work id (matches D1 works.id)
  slug: string;          // url slug for detail route
  titleLine1: string;    // big title, one line ("Бхагавад-гита")
  titleLine2?: string;   // smaller second line ("как она есть"), future slot for canto/song
  iast: string;          // "Bhagavad-gītā"
  tagline: string;       // short gloss after iast ("Песнь Бога")
  author: string;        // full title of the author, single line
  description: string;   // presentation blurb, strictly per Prabhupāda framing
  publisher: "bbt";      // authority logo on card
  covers: string[];      // gallery; first = primary cover
  chips: string[];       // factual chips about the text
}

export const BOOKS: Record<string, BookData> = {
  bg: {
    id: "bhagavad_gita",
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
};

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
