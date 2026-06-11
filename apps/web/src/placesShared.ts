/**
 * placesShared — единая нормализация каталога центров/ресторанов.
 * Используется и воркером (/api/places…), и клиентом (HomePlaces):
 * русские названия стран, порядок континентов, русская категория.
 */

export const CONTINENT_ORDER = ["Азия", "Европа", "Северная Америка", "Южная Америка", "Африка", "Океания", "Другое"];

/* RU-названия частых стран (остальные — как в данных) */
export const COUNTRY_RU: Record<string, string> = {
  "india": "Индия", "united states": "США", "united states of america": "США", "usa": "США",
  "united kingdom": "Великобритания", "uk": "Великобритания", "russia": "Россия", "russian federation": "Россия",
  "ukraine": "Украина", "germany": "Германия", "france": "Франция", "italy": "Италия", "spain": "Испания",
  "canada": "Канада", "australia": "Австралия", "new zealand": "Новая Зеландия", "brazil": "Бразилия",
  "argentina": "Аргентина", "mexico": "Мексика", "south africa": "ЮАР", "netherlands": "Нидерланды",
  "belgium": "Бельгия", "switzerland": "Швейцария", "sweden": "Швеция", "poland": "Польша",
  "hungary": "Венгрия", "czech republic": "Чехия", "czechia": "Чехия", "bangladesh": "Бангладеш",
  "nepal": "Непал", "sri lanka": "Шри-Ланка", "malaysia": "Малайзия", "singapore": "Сингапур",
  "indonesia": "Индонезия", "philippines": "Филиппины", "china": "Китай", "japan": "Япония",
  "kazakhstan": "Казахстан", "georgia": "Грузия", "armenia": "Армения", "israel": "Израиль",
  "ireland": "Ирландия", "portugal": "Португалия", "austria": "Австрия", "finland": "Финляндия",
  "norway": "Норвегия", "denmark": "Дания", "croatia": "Хорватия", "serbia": "Сербия",
  "bulgaria": "Болгария", "romania": "Румыния", "greece": "Греция", "turkey": "Турция",
  "fiji": "Фиджи", "mauritius": "Маврикий", "kenya": "Кения", "nigeria": "Нигерия", "ghana": "Гана",
  "peru": "Перу", "chile": "Чили", "colombia": "Колумбия", "ecuador": "Эквадор", "bolivia": "Боливия",
  "venezuela": "Венесуэла", "guyana": "Гайана", "trinidad and tobago": "Тринидад и Тобаго",
  "belarus": "Беларусь", "latvia": "Латвия", "lithuania": "Литва", "estonia": "Эстония",
  "moldova": "Молдова", "slovakia": "Словакия", "slovenia": "Словения",
  "azerbaijan": "Азербайджан", "balkans": "Балканы", "bosina & herzegovina": "Босния и Герцеговина",
  "bosnia & herzegovina": "Босния и Герцеговина", "bosnia and herzegovina": "Босния и Герцеговина",
  "botswana": "Ботсвана", "burma(myanmar)": "Мьянма", "myanmar": "Мьянма",
  "costa rica": "Коста-Рика", "dominican republic": "Доминиканская Республика", "el salvador": "Сальвадор",
  "ivory coast": "Кот-д'Ивуар", "kyrgyzstan": "Кыргызстан", "macedonia": "Северная Македония",
  "north macedonia": "Северная Македония", "malawi": "Малави", "netherland": "Нидерланды",
  "panama": "Панама", "papua new guinea": "Папуа — Новая Гвинея", "paraguay": "Парагвай",
  "puerto rico": "Пуэрто-Рико", "scotland": "Шотландия", "south korea": "Южная Корея",
  "suriname": "Суринам", "swaziland": "Эсватини", "eswatini": "Эсватини",
  "taiwan": "Тайвань", "tajikistan": "Таджикистан", "thailand": "Таиланд",
  "togo": "Того", "uganda": "Уганда", "united arab emirates": "ОАЭ",
  "uruguay": "Уругвай", "uzbekistan": "Узбекистан", "wales": "Уэльс", "zimbabwe": "Зимбабве",
};
export const ruCountry = (c: string) => COUNTRY_RU[(c || "").trim().toLowerCase()] || c;

/* обратная карта: русский запрос → английские названия стран в данных */
const RU_TO_EN: Record<string, string[]> = {};
for (const [en, ru] of Object.entries(COUNTRY_RU)) {
  const k = ru.toLowerCase();
  (RU_TO_EN[k] = RU_TO_EN[k] || []).push(en);
}
export function enCountriesFor(q: string): string[] {
  const k = q.trim().toLowerCase();
  const out = new Set<string>();
  for (const [ru, ens] of Object.entries(RU_TO_EN)) if (ru.includes(k)) ens.forEach((e) => out.add(e));
  return [...out];
}

/* русские ярлыки категорий справочника; служебные скрываем */
export const CAT_RU: Record<string, string> = {
  "centre": "Центр", "centers": "Центр", "websites": "Центр",
  "agriculture": "Ферма", "farms": "Ферма",
  "farm and rural communities": "Сельская община",
  "educational institutes": "Образование", "iskcon education": "Образование",
};
export function catRu(kind: string, categories: string[] | null | undefined): string {
  if (kind === "restaurant") return "Ресторан";
  for (const c of categories || []) {
    const r = CAT_RU[(c || "").trim().toLowerCase()];
    if (r && r !== "Центр") return r;
  }
  return "Центр";
}

export interface PlaceItem {
  id: string; kind: "centre" | "restaurant"; name: string; nameRu: string; category: string;
  address: string; city: string; cityRu: string; state: string; stateRu: string;
  country: string; countryRu: string; continent: string;
  lat: number | null; lng: number | null;
  phone: string; email: string; website: string; source: string;
}
