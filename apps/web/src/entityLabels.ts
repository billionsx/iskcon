/**
 * Русские подписи таттвы и классификации сущностей реестра. Единый источник
 * для EntityPage (чипы) и PdfDoc (печатная карточка героя), чтобы латинские
 * коды (jiva-tattva, acharya, gaudiya) не попадали в выдачу пользователю.
 */
export const TATTVA_RU: Record<string, string> = {
  "vishnu-tattva": "Вишну-таттва",
  "shakti-tattva": "Шакти-таттва",
  "shiva-tattva": "Шива-таттва",
  "jiva-tattva": "Джива-таттва",
};

// Раса — настроение в вечных отношениях с Богом. Подпись + краткий смысл.
export const RASA_RU: Record<string, { label: string; gloss: string }> = {
  shanta: { label: "Шанта", gloss: "нейтральное почитание" },
  dasya: { label: "Дасья", gloss: "настроение служения" },
  sakhya: { label: "Сакхья", gloss: "дружеская любовь" },
  vatsalya: { label: "Ватсалья", gloss: "родительская любовь" },
  madhurya: { label: "Мадхурья", gloss: "супружеская любовь" },
};

export const CATEGORY_RU: Record<string, string> = {
  "svayam-bhagavan": "Сваям Бхагаван",
  "source-of-all": "Источник всего",
  "hladini-shakti": "Хладини-шакти",
  "pancha-tattva": "Панча-таттва",
  "yuga-avatara": "Юга-аватара",
  "lila-avatara": "Лила-аватара",
  shaktyavesha: "Шактьявеша",
  avatara: "Аватара",
  gopi: "Гопи",
  gopa: "Пастушок Враджа",
  manjari: "Манджари",
  vraja: "Враджа",
  consort: "Супруга Господа",
  "gauranga-lila": "Гауранга Лила",
  "krishna-lila": "Кришна Лила",
  "krishna-family": "Семья Кришны",
  "founder-acharya": "Основатель-ачарья",
  "initiating-guru": "Дикша-гуру ИСККОН",
  "zonal-acharya-1977": "Зональный ачарья (1977)",
  "founding-disciple": "Ученик-основатель",
  gaudiya: "Гаудия-вайшнав",
  acharya: "Ачарья",
  "vaishnava-acharya": "Вайшнавский ачарья",
  associate: "Спутник",
  saint: "Святой",
  poet: "Поэт",
  deity: "Божество",
  dham: "Дхама",
  "vraja-vana": "Лес Враджа",
  "vraja-tirtha": "Святое место Враджа",
  navadvipa: "Навадвипа",
  "gaura-dham": "Гаура-дхама",
  nilachala: "Нилачала",
  "gaura-tirtha": "Святое место Гауры",
  vrindavana: "Вриндаван",
  "six-goswamis": "Шесть Госвами",
  "madhva-parampara": "Мадхва-парампара",
  parampara: "Парампара",
  "maha-jana": "Маха-джана",
  bhagavatam: "«Шримад-Бхагаватам»",
  mahabharata: "«Махабхарата»",
  ramayana: "«Рамаяна»",
  gita: "«Бхагавад-гита»",
  pandava: "Пандав",
  kuru: "Куру",
  raghu: "Династия Рагху",
  king: "Царь",
  warrior: "Воин",
  sage: "Мудрец",
  sannyasi: "Санньяси",
  demigod: "Полубог",
  demon: "Демон",
  rakshasa: "Ракшас",
  vanara: "Вáнара",
  family: "Семья",
  servant: "Слуга Господа",
  "shuddha-bhakta": "Чистый преданный",
  "krishna-associate": "Спутник Кришны",
  "channa-avatara": "Скрытая аватара",
  "prakasha-vilasa": "Пракаша-виласа",
  iskcon: "ИСККОН",
  godbrother: "Духовный брат",
  "first-expansion": "Первая экспансия",
  "eternal-associate": "Вечный спутник",
  "krishna-consort": "Супруга Кришны",
  "chaitanya-associate": "Спутник Шри Чайтаньи",
  cc: "«Чайтанья-чаритамрита»",
  pl: "Прабхупада-лиламрита",
  "canonical-scripture": "Канон",
  "prabhupada-book": "Книга Прабхупады",
};

/** Латинский код таттвы → русская подпись (фолбэк: исходный код). */
export function tattvaRu(t?: string | null): string {
  if (!t) return "";
  return TATTVA_RU[t] ?? t;
}

/** Список категорий (латиница) → русские подписи; неизвестные коды отбрасываются. */
export function categoriesRu(cats?: string[] | null): string[] {
  return (cats ?? []).map((c) => CATEGORY_RU[c]).filter(Boolean) as string[];
}
