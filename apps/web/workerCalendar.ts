/**
 * workerCalendar — вайшнавский календарь по любому городу мира.
 *
 * GET /api/calendar?loc=Mayapur%20[India]
 *   → { loc, year: [2026, 2027], events: [{ date, title, orig, type, entityId? }] }
 *
 * Источник: vaisnavacalendar.info — пер-городские ICS, рассчитанные GCal 11
 * (официальная программа Календарного комитета GBC). Воркер тянет ICS на лету,
 * полностью русифицирует (полный словарь: экадаши, праздники, санкранти,
 * Чатурмасья, посты, 70+ вайшнавов в родительном падеже) и связывает личности
 * с реестром Героев (entityId → EntityPage). Кэш — caches.default, 12 часов.
 */

const ICS_BASE = "https://www.vaisnavacalendar.info/ICS";
const UA = "iskcon-one-love/1.0 (+https://gaurangers.com; ceo@billionsx.com)";

type CalType = "ekadasi" | "parana" | "festival" | "appearance" | "disappearance" | "other";
interface CalEvent { date: string; title: string; orig: string; type: CalType; entityId?: string }

/* ── вайшнавы: нормализованный ключ → родительный падеж + entity ─────── */
const PERSON: ReadonlyArray<[string, { ru: string; id: string | null }]> = [
  ["abhirama", { ru: "Шри Абхирамы Тхакура", id: null }],
  ["advaita acarya", { ru: "Шри Адвайты Ачарьи", id: "advaita" }],
  ["baladeva vidyabhusana", { ru: "Шрилы Баладевы Видьябхушаны", id: "baladeva-vidyabhushana" }],
  ["bhaktisiddhanta sarasvati", { ru: "Шрилы Бхактисиддханты Сарасвати Тхакура", id: "bhaktisiddhanta-sarasvati" }],
  ["bhaktivinoda", { ru: "Шрилы Бхактивиноды Тхакура", id: "bhaktivinoda-thakura" }],
  ["bhugarbha", { ru: "Шри Бхугарбхи Госвами", id: "bhugarbha-goswami" }],
  ["devananda", { ru: "Шри Девананды Пандита", id: "devananda-pandit" }],
  ["dhananjaya", { ru: "Шри Дхананджаи Пандита", id: "arjuna" }],
  ["gadadhara", { ru: "Шри Гададхары даса Госвами", id: "gadadhara-dasa" }],
  ["gadadhara", { ru: "Шри Гададхары Пандита", id: "gadadhara-dasa" }],
  ["gangamata", { ru: "Шримати Гангаматы Госвамини", id: null }],
  ["gaura kisora babaji", { ru: "Шрилы Гауракишоры даса Бабаджи", id: "gaurakishora-dasa-babaji" }],
  ["gauridasa", { ru: "Шри Гауридаса Пандита", id: "gauridasa-pandit" }],
  ["gopala bhatta", { ru: "Шрилы Гопалы Бхатты Госвами", id: "gopala-bhatta-goswami" }],
  ["govinda ghosh", { ru: "Шри Говинды Гхоша", id: null }],
  ["haridasa", { ru: "Шрилы Харидасы Тхакура", id: "haridasa-thakura" }],
  ["isvara puri", { ru: "Шри Ишвары Пури", id: "ishvara-puri" }],
  ["jagadisa", { ru: "Шри Джагадиши Пандита", id: "jagadisha-pandit" }],
  ["jagannatha babaji", { ru: "Шрилы Джаганнатхи даса Бабаджи", id: null }],
  ["jahnava", { ru: "Шримати Джахнавы-деви", id: null }],
  ["jayadeva", { ru: "Шри Джаядевы Госвами", id: null }],
  ["jayananda", { ru: "Шри Джаянанды Прабху", id: null }],
  ["jiva", { ru: "Шрилы Дживы Госвами", id: "jiva-goswami" }],
  ["kaliya krsnadasa", { ru: "Шри Калии Кришнадаса", id: null }],
  ["kasisvara", { ru: "Шри Кашишвары Пандита", id: "kashishvara" }],
  ["krsnadasa kaviraja", { ru: "Шрилы Кришнадасы Кавираджи Госвами", id: "krishnadasa-kaviraja" }],
  ["locana", { ru: "Шрилы Лочаны даса Тхакура", id: "lochana-dasa-thakura" }],
  ["lokanatha", { ru: "Шрилы Локанатхи Госвами", id: "lokanatha-natha" }],
  ["madhavendra puri", { ru: "Шри Мадхавендры Пури", id: "madhavendra-puri" }],
  ["madhu", { ru: "Шри Мадху Пандита", id: null }],
  ["madhvacarya", { ru: "Шри Мадхвачарьи", id: "madhva" }],
  ["mahesa", { ru: "Шри Махеши Пандита", id: "mahesha-pandit" }],
  ["mukunda datta", { ru: "Шри Мукунды Датты", id: "mukunda-datta" }],
  ["murari gupta", { ru: "Шри Мурари Гупты", id: "murari-gupta" }],
  ["narahari sarakara", { ru: "Шри Нарахари Саракары Тхакура", id: "narahari-sarakara-thakur" }],
  ["narottama", { ru: "Шрилы Нароттамы даса Тхакура", id: "narottama-dasa-thakura" }],
  ["nimbarkacarya", { ru: "Шри Нимбаркачарьи", id: null }],
  ["nityananda", { ru: "Шри Нитьянанды Прабху", id: "nityananda" }],
  ["paramesvari", { ru: "Шри Парамешвари даса Тхакура", id: null }],
  ["prabhupada", { ru: "Шрилы Прабхупады", id: "prabhupada" }],
  ["pundarika vidyanidhi", { ru: "Шри Пундарики Видьянидхи", id: "pundarika-vidyanidhi" }],
  ["purusottama", { ru: "Шри Пурушоттамы даса Тхакура", id: "purushottama-dasa" }],
  ["purusottama", { ru: "Шри Пурушоттамы даса Тхакура", id: "purushottama-dasa" }],
  ["radha ramana devaji", { ru: "Шри Шри Радха-Раманы Деваджи", id: null }],
  ["raghunandana", { ru: "Шри Рагхунанданы Тхакура", id: "raghunandana-thakura" }],
  ["raghunatha bhatta", { ru: "Шрилы Рагхунатхи Бхатты Госвами", id: "raghunatha-bhatta-goswami" }],
  ["raghunatha", { ru: "Шрилы Рагхунатхи даса Госвами", id: "raghunatha-puri" }],
  ["ramacandra kaviraja", { ru: "Шри Рамачандры Кавираджи", id: null }],
  ["ramananda raya", { ru: "Шри Рамананды Рая", id: "ramananda-raya" }],
  ["ramanujacarya", { ru: "Шри Рамануджачарьи", id: null }],
  ["rasikananda", { ru: "Шри Расикананды", id: null }],
  ["rupa", { ru: "Шрилы Рупы Госвами", id: "rupa-goswami" }],
  ["sanatana", { ru: "Шрилы Санатаны Госвами", id: "sanatana-goswami" }],
  ["saranga", { ru: "Шри Шаранги Тхакура", id: "sharanga-thakura" }],
  ["sita", { ru: "Шримати Ситы-деви", id: "sita" }],
  ["sita", { ru: "Шримати Ситы Тхакурани", id: "sita" }],
  ["sivananda sena", { ru: "Шри Шивананды Сены", id: "shivananda-sena" }],
  ["sridhara", { ru: "Шри Шридхары Пандита", id: null }],
  ["srinivasa acarya", { ru: "Шри Шринивасы Ачарьи", id: null }],
  ["srivasa", { ru: "Шри Шривасы Пандита", id: "srivas-das" }],
  ["svarupa damodara", { ru: "Шри Сварупы Дамодары Госвами", id: "svarupa-damodara" }],
  ["syamananda", { ru: "Шри Шьямананды Прабху", id: null }],
  ["uddharana datta", { ru: "Шри Уддхараны Датты Тхакура", id: "uddharana-datta" }],
  ["vakresvara", { ru: "Шри Вакрешвары Пандита", id: "vakreshvara-pandit" }],
  ["vamsidasa babaji", { ru: "Шрилы Вамшидасы Бабаджи", id: null }],
  ["vamsivadana", { ru: "Шри Вамшивадана Тхакура", id: null }],
  ["vasudeva ghosh", { ru: "Шри Васудевы Гхоша", id: null }],
  ["virabhadra", { ru: "Шри Вирабхадры", id: null }],
  ["visnupriya", { ru: "Шримати Вишнуприи-деви", id: "vishnupriya" }],
  ["visvanatha cakravarti", { ru: "Шрилы Вишванатхи Чакраварти Тхакура", id: null }],
  ["vrndavana", { ru: "Шрилы Вриндаваны даса Тхакура", id: "vrindavana-dasa-thakura" }],
  ["balarama", { ru: "Господа Баларамы", id: "balarama" }],
];

const HONORIFICS = /\b(srila|sri|srimati|sriman|prabhu|thakura|thakurani|thakur|gosvami|gosvamini|goswami|pandita|pandit|dasa|das|devi|deviji|maharaja|deva|lord)\b/g;
function personKey(s: string): string {
  return s.toLowerCase()
    .replace(/kishora/g, "kisora").replace(/krishna/g, "krsna").replace(/chaitanya/g, "caitanya")
    .replace(HONORIFICS, " ").replace(/[^a-z]+/g, " ").trim();
}
const PERSON_MAP = new Map<string, { ru: string; id: string | null }>();
for (const [k, v] of PERSON) { PERSON_MAP.set(k, v); PERSON_MAP.set(k.replace(/ /g, ""), v); }
function findPerson(base: string): { ru: string; id: string | null } | null {
  const k = personKey(base);
  return PERSON_MAP.get(k) || PERSON_MAP.get(k.replace(/ /g, "")) || null;
}

/* ── экадаши ────────────────────────────────────────────────────────── */
const EKADASI_RU: Record<string, string> = {
  "pandava nirjala": "Пандава-нирджала", "parama": "Парама", "padmini": "Падмини", "yogini": "Йогини",
  "sayana": "Шаяна", "kamika": "Камика", "pavitropana": "Павитропана", "pavitraropana": "Павитропана",
  "annada": "Аннада", "parsva": "Паршва", "indira": "Индира", "pasankusa": "Пашанкуша", "rama": "Рама",
  "utthana": "Уттхана", "utpanna": "Утпанна", "moksada": "Мокшада", "saphala": "Сапхала", "putrada": "Путрада",
  "sat tila": "Шат-тила", "sat-tila": "Шат-тила", "bhaimi": "Бхайми", "vijaya": "Виджая",
  "amalaki vrata": "Амалаки-врата", "amalaki": "Амалаки", "papamocani": "Папамочани", "kamada": "Камада",
  "varuthini": "Варутхини", "mohini": "Мохини", "apara": "Апара",
};

/* ── праздники и события: подстрока (lowercase) → перевод ───────────── */
const FEST: ReadonlyArray<[string, { ru: string; type: CalType; id?: string }]> = [
  ["gaura purnima", { ru: "Гаура-пурнима — явление Шри Чайтаньи Махапрабху", type: "festival", id: "chaitanya" }],
  ["krsna janmastami", { ru: "Шри Кришна-джанмаштами — явление Господа Шри Кришны", type: "festival", id: "krishna" }],
  ["janmastami", { ru: "Шри Кришна-джанмаштами — явление Господа Шри Кришны", type: "festival", id: "krishna" }],
  ["radhastami", { ru: "Радхаштами — явление Шримати Радхарани", type: "festival", id: "radharani-de" }],
  ["rama navami", { ru: "Рама-навами — явление Господа Шри Рамачандры", type: "festival", id: "rama" }],
  ["nrsimha caturdasi", { ru: "Нрисимха-чатурдаши — явление Господа Нрисимхадевы", type: "festival", id: "nrisimha" }],
  ["narasimha caturdasi", { ru: "Нрисимха-чатурдаши — явление Господа Нрисимхадевы", type: "festival", id: "nrisimha" }],
  ["vamana dvadasi", { ru: "Вамана-двадаши — явление Господа Ваманадевы", type: "festival", id: "vamana" }],
  ["varaha dvadasi", { ru: "Вараха-двадаши — явление Господа Варахадевы", type: "festival", id: "varaha" }],
  ["lord balarama", { ru: "Явление Господа Баларамы (Баларама-пурнима)", type: "festival", id: "balarama" }],
  ["nandotsava", { ru: "Нандотсава — праздник Махараджи Нанды", type: "festival" }],
  ["govardhana puja", { ru: "Говардхана-пуджа", type: "festival" }],
  ["ratha yatra", { ru: "Ратха-ятра", type: "festival", id: "jagannatha-jv" }],
  ["snana yatra", { ru: "Снана-ятра", type: "festival", id: "jagannatha-jv" }],
  ["gundica marjana", { ru: "Гундича-марджана", type: "festival" }],
  ["panihati", { ru: "Панихати-чида-дахи-утсава", type: "festival" }],
  ["ganga sagara mela", { ru: "Ганга-сагара-мела", type: "festival" }],
  ["ganga puja", { ru: "Ганга-пуджа", type: "festival" }],
  ["tulasi jala dan", { ru: "Туласи-джала-дан — подношение воды Туласи", type: "festival" }],
  ["tulasi", { ru: "Туласи-пуджа", type: "festival" }],
  ["vyasa puja", { ru: "Вьяса-пуджа Шрилы Прабхупады", type: "festival", id: "prabhupada" }],
  ["guru (vyasa) purnima", { ru: "Гуру-пурнима (Вьяса-пурнима)", type: "festival" }],
  ["advent of srimad bhagavad-gita", { ru: "Гита-джаянти — явление «Шримад Бхагавад-гиты»", type: "festival" }],
  ["gita jayanti", { ru: "Гита-джаянти — явление «Шримад Бхагавад-гиты»", type: "festival" }],
  ["vasanta pancami", { ru: "Васанта-панчами", type: "festival" }],
  ["diwali", { ru: "Дивали (Дипавали)", type: "festival" }],
  ["dipavali", { ru: "Дивали (Дипавали)", type: "festival" }],
  ["gopastami", { ru: "Гопаштами", type: "festival" }],
  ["jagannatha misra", { ru: "Праздник Джаганнатхи Мишры", type: "festival" }],
  ["siva ratri", { ru: "Шива-ратри", type: "festival" }],
  ["bhismastami", { ru: "Бхишмаштами — день Бхишмадевы", type: "festival", id: "bhishma" }],
  ["first day of bhisma pancaka", { ru: "Начало Бхишма-панчаки", type: "other", id: "bhishma" }],
  ["last day of bhisma pancaka", { ru: "Последний день Бхишма-панчаки", type: "other", id: "bhishma" }],
  ["durga puja", { ru: "Дурга-пуджа", type: "other" }],
  ["laksmi puja", { ru: "Лакшми-пуджа", type: "festival" }],
  ["sarasvati puja", { ru: "Сарасвати-пуджа", type: "festival" }],
  ["jagaddhatri puja", { ru: "Джагаддхатри-пуджа", type: "other" }],
  ["bali daityaraja puja", { ru: "Бали-дайтьяраджа-пуджа", type: "other" }],
  ["bahulastami", { ru: "Бахулаштами — явление Радха-кунды", type: "festival" }],
  ["appearance of radha kunda", { ru: "Явление Радха-кунды, снана-дана", type: "festival" }],
  ["bhadra purnima", { ru: "Бхадра-пурнима — день «Шримад-Бхагаватам»", type: "festival" }],
  ["ananta caturdasi", { ru: "Ананта-чатурдаши-врата", type: "other" }],
  ["damanakaropana dvadasi", { ru: "Даманакаропана-двадаши", type: "other" }],
  ["rukmini dvadasi", { ru: "Рукмини-двадаши", type: "other" }],
  ["aksaya trtiya", { ru: "Акшая-трития. Начало Чандана-ятры (21 день)", type: "festival" }],
  ["jhulana yatra ends", { ru: "Окончание Джхулана-ятры", type: "festival" }],
  ["jhulana yatra begins", { ru: "Начало Радха-Говинда Джхулана-ятры", type: "festival" }],
  ["katyayani vrata begins", { ru: "Начало Катьяяни-враты", type: "other" }],
  ["katyayani vrata ends", { ru: "Окончание Катьяяни-враты", type: "other" }],
  ["krsna phula dola", { ru: "Кришна Пхула-дола, Салила-вихара", type: "festival" }],
  ["saradiya rasayatra", { ru: "Шри Кришна Шарадия Раса-ятра", type: "festival" }],
  ["krsna rasayatra", { ru: "Шри Кришна Раса-ятра", type: "festival" }],
  ["balarama rasayatra", { ru: "Шри Баларама Раса-ятра", type: "festival", id: "balarama" }],
  ["vasanta rasa", { ru: "Шри Кришна Васанта-раса", type: "festival" }],
  ["madhura utsava", { ru: "Шри Кришна Мадхура-утсава", type: "festival" }],
  ["pusya abhiseka", { ru: "Шри Кришна Пушья-абхишека", type: "festival" }],
  ["odana sasthi", { ru: "Одана-шаштхи", type: "other" }],
  ["jahnu saptami", { ru: "Джахну-саптами", type: "other" }],
  ["ramacandra vijayotsava", { ru: "Рамачандра-виджаётсава", type: "festival", id: "rama" }],
  ["visvarupa mahotsava", { ru: "Шри Вишварупа-махотсава", type: "festival" }],
  ["trisprsa mahadvadasi", { ru: "Триспришa-махадвадаши", type: "other" }],
  ["vyanjuli mahadvadasi", { ru: "Вьянджули-махадвадаши", type: "other" }],
  ["paksa vardhini mahadvadasi", { ru: "Пакша-вардхини-махадвадаши", type: "other" }],
  ["vijaya mahadvadasi", { ru: "Виджая-махадвадаши", type: "other" }],
  ["acceptance of sannyasa", { ru: "Принятие санньясы Шрилой Прабхупадой", type: "other", id: "prabhupada" }],
  ["arrival in the usa", { ru: "Прибытие Шрилы Прабхупады в США", type: "other", id: "prabhupada" }],
  ["departure for the usa", { ru: "Отплытие Шрилы Прабхупады в США", type: "other", id: "prabhupada" }],
  ["incorporation of iskcon", { ru: "Регистрация ИСККОН в Нью-Йорке", type: "other" }],
];

/* ── Чатурмасья ─────────────────────────────────────────────────────── */
const ORD: Record<string, string> = { first: "первого", second: "второго", third: "третьего", fourth: "четвёртого" };
const ORD_N: Record<string, string> = { first: "первый", second: "второй", third: "третий", fourth: "четвёртый" };

/* ── санкранти ──────────────────────────────────────────────────────── */
const RASHI: Record<string, [string, string]> = {
  mesa: ["Меша", "Овен"], vrsabha: ["Вришабха", "Телец"], mithuna: ["Митхуна", "Близнецы"],
  karkata: ["Карката", "Рак"], simha: ["Симха", "Лев"], kanya: ["Канья", "Дева"],
  tula: ["Тула", "Весы"], vrscika: ["Вришчика", "Скорпион"], dhanus: ["Дхану", "Стрелец"],
  makara: ["Макара", "Козерог"], kumbha: ["Кумбха", "Водолей"], mina: ["Мина", "Рыбы"],
};
const MON_RU: Record<string, string> = { jan: "янв", feb: "фев", mar: "мар", apr: "апр", may: "мая", jun: "июн", jul: "июл", aug: "авг", sep: "сен", oct: "окт", nov: "ноя", dec: "дек" };

/* ── пометки поста «(…)» — клеятся к предыдущему событию дня ────────── */
function fastNote(low: string): string | null {
  if (low.startsWith("fast till noon for") || low.startsWith("fasting till noon")) return "пост до полудня, пир завтра";
  if (low === "fast till noon") return "пост до полудня";
  if (low === "fast till sunset") return "пост до заката";
  if (low === "fast till dusk") return "пост до сумерек";
  if (low === "fast till midnight") return "пост до полуночи";
  if (low === "fast till moonrise") return "пост до восхода луны";
  if (low.startsWith("fasting is done yesterday")) return "пост был вчера, сегодня пир";
  if (low.includes("green leafy")) return "месяц поста от листовой зелени";
  if (low.includes("yogurt fast")) return "месяц поста от йогурта";
  if (low.includes("milk fast")) return "месяц поста от молока";
  if (low.includes("urad dal")) return "месяц поста от урад-дала";
  return null;
}

function ruTitle(t: string): { title: string; type: CalType; entityId?: string } {
  const low = t.toLowerCase();
  // экадаши
  const ek = low.match(/fasting for (.+?) ekadasi/);
  if (ek) {
    const nm = ek[1].trim();
    const ru = EKADASI_RU[nm] || nm.replace(/\b\w/g, (c) => c.toUpperCase());
    return { title: `${ru}-экадаши — пост`, type: "ekadasi" };
  }
  if (low.includes("break fast")) {
    const tm = low.match(/break fast\s+(\d{1,2}:\d{2}).*?-\s*(\d{1,2}:\d{2})/);
    return { title: tm ? `Выход из поста ${tm[1]}–${tm[2]}` : "Выход из поста", type: "parana" };
  }
  // Чатурмасья
  let m = low.match(/(first|second|third|fourth) month of caturmasya begins/);
  if (m) return { title: `Начало ${ORD[m[1]]} месяца Чатурмасьи`, type: "other" };
  m = low.match(/last day of the (first|second|third|fourth) caturmasya month/);
  if (m) return { title: `${ORD_N[m[1]].replace(/^./, (c) => c.toUpperCase())} месяц Чатурмасьи — последний день`, type: "other" };
  // санкранти
  m = low.match(/([a-z]+) sankranti \(sun enters ([a-z]+) on (\d{1,2}) ([a-z]{3})[^,]*, (\d{1,2}:\d{2})/);
  if (m) {
    const r = RASHI[m[1]];
    const name = r ? r[0] : m[1].replace(/^./, (c) => c.toUpperCase());
    const sign = r ? r[1] : m[2];
    return { title: `${name}-санкранти — Солнце входит в ${sign} (${m[3]} ${MON_RU[m[4]] || m[4]}, ${m[5]})`, type: "other" };
  }
  // явления/уходы
  const dis = low.includes("disappearance");
  const app = low.includes("appearance") && !dis;
  if (app || dis) {
    // комбинированные праздничные строки ловим раньше персон
    for (const [k, v] of FEST) if (low.includes(k)) return { title: v.ru, type: v.type, entityId: v.id };
    const base = t.split(/\s*--\s*/)[0].replace(/\([^)]*\)/g, " ").trim();
    const p = findPerson(base);
    if (p) return { title: (app ? "Явление " : "Уход ") + p.ru, type: app ? "appearance" : "disappearance", entityId: p.id || undefined };
    return { title: (app ? "Явление: " : "Уход: ") + base, type: app ? "appearance" : "disappearance" };
  }
  for (const [k, v] of FEST) if (low.includes(k)) return { title: v.ru, type: v.type, entityId: v.id };
  if (low.includes("ekadasi")) return { title: t, type: "ekadasi" };
  return { title: t, type: "other" };
}

/* ── ICS ────────────────────────────────────────────────────────────── */
function parseIcs(text: string): { date: string; title: string }[] {
  const out: { date: string; title: string }[] = [];
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  for (const block of unfolded.split("BEGIN:VEVENT").slice(1)) {
    const body = block.split("END:VEVENT")[0];
    const dm = body.match(/DTSTART(?:;VALUE=DATE)?[:;][^:\n]*:?(\d{8})/);
    const sm = body.match(/SUMMARY[^:\n]*:(.+)/);
    if (!dm || !sm) continue;
    const d = dm[1];
    const title = sm[1].trim().replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\n/g, " · ").replace(/\\'/g, "'");
    out.push({ date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, title });
  }
  return out;
}

async function fetchIcs(loc: string, year: number): Promise<string | null> {
  const path = `/${year}/${loc}-a${year}-ICS.ics`;
  const url = ICS_BASE + encodeURI(path).replace(/\[/g, "%5B").replace(/\]/g, "%5D");
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

export async function calendarApi(request: Request, url: URL): Promise<Response | null> {
  if (url.pathname !== "/api/calendar") return null;
  const loc = (url.searchParams.get("loc") || "Mayapur [India]").trim().slice(0, 80);
  if (!/^[A-Za-z .()'-]+ \[[A-Za-z .]+\]$/.test(loc)) {
    return new Response(JSON.stringify({ error: "bad loc" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const cache = (caches as unknown as { default: Cache }).default;
  const cacheKey = new Request(url.origin + "/api/calendar?loc=" + encodeURIComponent(loc));
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const now = new Date();
  const years = [now.getUTCFullYear(), now.getUTCFullYear() + 1];
  const texts = await Promise.all(years.map((y) => fetchIcs(loc, y)));
  const raw: { date: string; title: string }[] = [];
  texts.forEach((t) => { if (t) raw.push(...parseIcs(t)); });
  if (raw.length < 50) {
    return new Response(JSON.stringify({ error: "no calendar for location", loc }), {
      status: 404, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
  raw.sort((a, b) => a.date.localeCompare(b.date));

  const events: CalEvent[] = [];
  for (const e of raw) {
    const par = e.title.match(/^\((.+)\)$/);
    if (par) {
      const note = fastNote(par[1].toLowerCase().trim());
      const prev = [...events].reverse().find((x) => x.date === e.date && x.type !== "parana");
      if (note && prev) { prev.title += ` · ${note}`; continue; }
      if (note) { events.push({ date: e.date, title: note.replace(/^./, (c) => c.toUpperCase()), orig: e.title, type: "other" }); continue; }
    }
    const clean = e.title.replace(/^-+\s*/, "").replace(/\s*-+$/, "");
    const r = ruTitle(clean);
    events.push({ date: e.date, title: r.title, orig: e.title, type: r.type, ...(r.entityId ? { entityId: r.entityId } : {}) });
  }

  const res = new Response(JSON.stringify({ loc, years, events }), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=43200" },
  });
  await cache.put(cacheKey, res.clone());
  return res;
}
