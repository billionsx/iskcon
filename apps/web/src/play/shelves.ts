/* /play — полки раздела «Книги»: наша база богатств в витринах Apple Music.
   Состав полок — фактическая группировка 25 аудиокниг реестра (BOOKS ×
   AUDIO_WORKS) по авторам; ничего выдуманного. entityId у персональной полки
   ведёт шевроном на карточку личности в основном приложении (роадмап В3). */

export interface Shelf {
  id: string;
  title: string;
  /** Карточка личности в основном приложении: шеврон заголовка → /<entityId>. */
  entityId?: string;
  /** work-id книг реестра BOOKS (порядок = порядок витрины). */
  ids: string[];
}

export const SHELVES: Shelf[] = [
  {
    id: "prabhupada",
    title: "Шрила Прабхупада",
    entityId: "prabhupada",
    ids: ["bg", "sb", "cc", "brs", "noi", "iso", "sri-namamrita", "vrindavane-bhajana"],
  },
  {
    id: "bhaktivinoda",
    title: "Бхактивинода Тхакур",
    entityId: "bhaktivinoda-thakura",
    ids: [
      "harinama-cintamani", "caitanya-siksamrta", "bhaktyaloka",
      "bhakti-tattva-viveka", "prema-pradipa", "sanmodana-bhashya",
      "navadvipa-dhama-mahatmya",
    ],
  },
  {
    id: "classics",
    title: "Гаудия-классика",
    ids: ["siksastaka", "manah-siksa", "jagannatha-vallabha-nataka", "mukunda-mala-stotra", "bs"],
  },
  {
    id: "lives",
    title: "Жизнеописания ачарьев",
    ids: ["spl", "seventh-goswami", "ray-of-vishnu"],
  },
  {
    id: "modern",
    title: "Современные учители",
    ids: ["uroki-lyubvi", "the-beggar"],
  },
];
