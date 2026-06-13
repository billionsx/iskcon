/**
 * shop/catalog.ts — каталог-сид магазина ISKCON ONE LOVE.
 *
 * ⚠️ Цены и состав — стартовые. Отредактируйте под реальный ассортимент BBT/лавки.
 * Обложки книг переиспользуются из единого источника BOOKS.
 */
import { BOOKS } from "../books";
import type { Product } from "./cart";

const cover = (work: string): string | undefined => BOOKS[work]?.covers[0];

export interface CatalogGroup { key: string; title: string; note?: string; items: Product[]; }

export const CATALOG: CatalogGroup[] = [
  {
    key: "books",
    title: "Книги Шрилы Прабхупады",
    note: "Печатные издания BBT.",
    items: [
      { id: "bk-bg",  kind: "physical", title: "Бхагавад-гита как она есть", subtitle: "Твёрдый переплёт · BBT", price: 690, cover: cover("bg"),  weightG: 950 },
      { id: "bk-sb",  kind: "physical", title: "Шримад-Бхагаватам",          subtitle: "Том · твёрдый переплёт",  price: 890, cover: cover("sb"),  weightG: 1100 },
      { id: "bk-cc",  kind: "physical", title: "Шри Чайтанья-чаритамрита",   subtitle: "Том · твёрдый переплёт",  price: 990, cover: cover("cc"),  weightG: 1150 },
      { id: "bk-brs", kind: "physical", title: "Нектар преданности",         subtitle: "Твёрдый переплёт · BBT", price: 590, cover: cover("brs"), weightG: 700 },
      { id: "bk-iso", kind: "physical", title: "Шри Ишопанишад",             subtitle: "Мягкий переплёт · BBT",  price: 250, cover: cover("iso"), weightG: 180 },
    ],
  },
  {
    key: "goods",
    title: "Атрибуты для практики",
    items: [
      { id: "gd-mala",    kind: "physical", title: "Джапа-мала из туласи", subtitle: "108 бусин · с сумочкой",  price: 1200, weightG: 90 },
      { id: "gd-incense", kind: "physical", title: "Благовония, набор",     subtitle: "6 ароматов · натуральные", price: 350,  weightG: 200 },
    ],
  },
  {
    key: "digital",
    title: "Цифровые материалы",
    note: "Доступ открывается сразу после оплаты.",
    items: [
      { id: "dg-audio-bg", kind: "digital", title: "Аудиокнига «Бхагавад-гита как она есть»", subtitle: "MP3 · полная начитка", price: 390 },
      { id: "dg-course",   kind: "digital", title: "Курс «Бхакти-йога: основы»",               subtitle: "12 видео-лекций",       price: 990 },
    ],
  },
];

export const DONATION_PRESETS = [300, 500, 1000, 2000];

export function donationProduct(amount: number): Product {
  return { id: "donation", kind: "donation", title: "Пожертвование", subtitle: "ISKCON ONE LOVE", price: amount, emblem: true };
}

/**
 * Печатный товар для книги по её work-коду (bg/sb/cc/…).
 * Сперва ищем в каталоге-сиде (выверенные цены), иначе строим карточку из BOOKS
 * со стартовой ценой — чтобы любую книгу реестра можно было заказать. undefined —
 * только для неизвестного work.
 */
export function bookProduct(work: string): Product | undefined {
  for (const g of CATALOG) {
    const hit = g.items.find((p) => p.id === `bk-${work}`);
    if (hit) return hit;
  }
  const b = BOOKS[work];
  if (!b) return undefined;
  const title = [b.titleLine1, b.titleLine2].filter(Boolean).join(" ");
  return { id: `bk-${work}`, kind: "physical", title, subtitle: "Печатное издание · BBT", price: 590, cover: b.covers?.[0], weightG: 700 };
}
