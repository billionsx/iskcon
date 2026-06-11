#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ru_geo — русификация каталога мест ИСККОН.
GEO_RU: кураторские русские экзонимы городов и регионов (полное покрытие каталога).
SANS_RU/WORD_RU: ИСККОН/санскритская лексика и общие слова для перевода названий.
translit(): практическая транскрипция для неизвестных токенов (индийский уклон).
API: ru_city, ru_state, ru_place_name.
"""
import re

# ── города и регионы: куратор, ключи в нижнем регистре ──────────────────
GEO_RU = {
  "aarhus":"Орхус","abeokuta":"Абеокута","abidjan":"Абиджан","abkhazia":"Абхазия","absheron":"Абшерон",
  "accra":"Аккра","adelaide":"Аделаида","agartala":"Агартала","agua caliente de cartago":"Агуа-Кальенте-де-Картаго",
  "ahmedabad":"Ахмадабад","ahmednagar":"Ахмаднагар","air keroh":"Аир-Керох","akluj":"Аклудж","alabama":"Алабама",
  "alachua":"Алачуа","alaminos":"Аламинос","albany":"Олбани","alberta":"Альберта","aligarh":"Алигарх",
  "allahabad":"Аллахабад","almaty":"Алматы","alor setar":"Алор-Сетар","amerikalei":"Америкалей","amlapura":"Амлапура",
  "amravati":"Амравати","amritsar":"Амритсар","amsterdam":"Амстердам","anantapur":"Анантапур","andalusia":"Андалусия","antwerp":"Антверпен","balkans":"Балканы","andhra pradesh":"Андхра-Прадеш",
  "andrés ibáñez":"Андрес-Ибаньес","andres ibanez":"Андрес-Ибаньес","angul":"Ангул","aravade":"Араваде",
  "arequipa":"Арекипа","arizona":"Аризона","arouca":"Ароука","artemovsk":"Артёмовск","aruppukottai":"Аруппукоттай",
  "ashanti":"Ашанти","ashcroft":"Ашкрофт","assam":"Ассам","asti":"Асти","asti province":"провинция Асти",
  "astrakhan":"Астрахань","asunción":"Асунсьон","asuncion":"Асунсьон","atlanta":"Атланта","auckland":"Окленд",
  "aurangabad":"Аурангабад","austin":"Остин","autonomous city of buenos aires":"Буэнос-Айрес","azuay":"Асуай",
  "ba":"Ба","bacs kiskun":"Бач-Кишкун","baden-württemberg":"Баден-Вюртемберг","baden-wurttemberg":"Баден-Вюртемберг",
  "badung":"Бадунг","bahadurgarh":"Бахадургарх","bahau":"Бахау","bahia":"Баия","bahrain":"Бахрейн",
  "baie du cap":"Бэ-дю-Кап","bakhchysarai":"Бахчисарай","bali":"Бали","balkhash":"Балхаш","balti town":"Бельцы",
  "baltic states":"Прибалтика","baltimore":"Балтимор","banat":"Банат","bangalore":"Бангалор","bangkok":"Бангкок",
  "banyuwangi":"Баньюванги","baramati":"Барамати","barcelona":"Барселона","baroda":"Барода","basilicum":"Базиликата",
  "batam":"Батам","batu berendam":"Бату-Берендам","bavaria":"Бавария","bedong":"Бедонг","beed":"Бид",
  "belfast":"Белфаст","belgaum":"Белгаум","belgium":"Бельгия","bellary":"Беллари","belo horizonte":"Белу-Оризонти",
  "benešov":"Бенешов","benesov":"Бенешов","benin city":"Бенин-Сити","bentong":"Бентонг","bergamo":"Бергамо",
  "berkeley":"Беркли","berlin":"Берлин","bern":"Берн","beroun":"Бероун","bhadrak":"Бхадрак",
  "bhaktivedanta academy mayapur":"Маяпур","bhaktivedanta college":"Радхадеш","bharatpur":"Бхаратпур",
  "bhopal":"Бхопал","bhubaneshwar":"Бхубанешвар","bhubaneswar":"Бхубанешвар","bhusawal":"Бхусавал","bihar":"Бихар",
  "birmingham":"Бирмингем","bishkent":"Бишкент","blantyre":"Блантайр","bloemfontein":"Блумфонтейн",
  "bloomington":"Блумингтон","boisar":"Бойсар","boise":"Бойсе","bologna":"Болонья","bologna province":"провинция Болонья",
  "bon accueil":"Бон-Акёй","boston":"Бостон","boxtel":"Бокстел","braga":"Брага","brahmapur":"Брахмапур",
  "brampton":"Брамптон","brampton - bhaktivedanta cultural center":"Брамптон","bratislava":"Братислава",
  "brihuega":"Бриуэга","brisbane":"Брисбен","british columbia":"Британская Колумбия","brno":"Брно",
  "brong-ahafo":"Бронг-Ахафо","brussels":"Брюссель","budapest":"Будапешт","buenos aires":"Буэнос-Айрес",
  "buenos aires province":"провинция Буэнос-Айрес","bukit mertajam":"Букит-Мертаджам","burleigh heads":"Берли-Хедс",
  "buryatia":"Бурятия","bāgmatī":"Багмати","bagmati":"Багмати","cairns":"Кэрнс","cakovec":"Чаковец",
  "calgary":"Калгари","cali":"Кали","california":"Калифорния","campina grande":"Кампина-Гранди","canberra":"Канберра",
  "canterbury":"Кентербери","cape town":"Кейптаун","capital district":"столичный округ","cardiff":"Кардифф",
  "carriere":"Каррьер","cartago":"Картаго","caruaru":"Каруару","catalonia":"Каталония","catania":"Катания",
  "cearás":"Сеара","ceara":"Сеара","central":"Центральный регион","central bohemian":"Среднечешский край",
  "central slovenia":"Центральная Словения","cercado":"Серкадо","chamorshi":"Чаморши","chandigarh":"Чандигарх",
  "charlotte":"Шарлотт","chelyabinsk":"Челябинск","chelyabinsk oblast":"Челябинская область","chennai":"Ченнай",
  "chhattisgarh":"Чхаттисгарх","chicago":"Чикаго","chita":"Чита","chittagong":"Читтагонг","chowpatty":"Чаупати",
  "chuy":"Чуйская область","châteauroux":"Шатору","chateauroux":"Шатору","coahuila":"Коауила","coast":"Прибрежная провинция",
  "coimbatore":"Коимбатур","cologne":"Кёльн","colombo":"Коломбо","colorado":"Колорадо","columbus":"Колумбус",
  "comilla":"Комилла","connecticut":"Коннектикут","copenhagen":"Копенгаген","costa rica":"Коста-Рика",
  "coventry":"Ковентри","crane":"Крейн","cuenca":"Куэнка","cumuto":"Кумуто","curitiba":"Куритиба","cusco":"Куско",
  "cuttack":"Каттак","czarnow":"Чарнув","dallas":"Даллас","darwin":"Дарвин","debe":"Дебе","debrecen":"Дебрецен",
  "dehradun":"Дехрадун","delhi":"Дели","delta state":"штат Дельта","demerara-mahaica":"Демерара-Махаика",
  "den hague":"Гаага","den hagye":"Гаага","denver":"Денвер","deobhog":"Деобхог","derrylin":"Деррилин",
  "detroit":"Детройт","dhaka":"Дакка","districts of republican subordination":"районы республиканского подчинения",
  "distrito capital":"столичный округ","distrito nacional":"Национальный округ","dnepropetrovsk":"Днепр",
  "dnipropetrovsk":"Днепр","donetsk":"Донецк","dubai":"Дубай","dublin":"Дублин","durban":"Дурбан",
  "durgapur":"Дургапур","dwaraka":"Дварака","dwarka":"Дварака","east berbice-corentyne":"Ист-Бербис-Корентайн",
  "eastern":"Восточный регион","eastern cape province":"Восточно-Капская провинция","edo":"Эдо","eger":"Эгер",
  "eindhoven":"Эйндховен","ekachakra":"Экачакра","ekaterinburg":"Екатеринбург","england":"Англия","enugu":"Энугу",
  "essequideo":"Эссекибо","estremadura":"Эштремадура","eugene":"Юджин","faridabad":"Фаридабад","faridpur":"Фаридпур",
  "federal district":"Федеральный округ","flacq":"Флак","florence":"Флоренция","florida":"Флорида",
  "fortaleza":"Форталеза","free state":"Фри-Стейт","friesland":"Фрисландия","gaborone":"Габороне",
  "gadei giri":"Гадей-Гири","gauteng":"Гаутенг","georgetown":"Джорджтаун","georgia":"Джорджия","gerung":"Герунг",
  "ghaziabad":"Газиабад","gita gitanagari farm":"Гита-Нагари","goa":"Гоа","gothenburg":"Гётеборг",
  "govinda csillaghegy":"Чиллагхедь","grand port":"Гран-Порт","greater accra":"Большая Аккра","grodinge":"Грёдинге",
  "grödinge":"Грёдинге","guadalajara":"Гвадалахара","guayaquil":"Гуаякиль","guayas":"Гуаяс","gujarat":"Гуджарат",
  "guntur":"Гунтур","gurabo":"Гурабо","gurgaon":"Гургаон","gurgaong":"Гургаон","guruvayur":"Гуруваюр",
  "guwahati":"Гувахати","habarovsk":"Хабаровск","habibpur":"Хабибпур","habiganj":"Хабигандж",
  "hajdú bihar":"Хайду-Бихар","hamburg":"Гамбург","hamilton":"Гамильтон","haridaspur":"Харидаспур",
  "haridwar":"Харидвар","harjumaa":"Харьюмаа","hartford":"Хартфорд","haryana":"Харьяна","hato rey":"Ато-Рей",
  "hawaii":"Гавайи","heidelberg":"Гейдельберг","helsinki":"Хельсинки","hesse":"Гессен","hhohho":"Хохо",
  "hillsboro":"Хиллсборо","hillsborough":"Хиллсборо","hong kong":"Гонконг","hongkong":"Гонконг","honolulu":"Гонолулу",
  "hosur":"Хосур","houston":"Хьюстон","hrishikesh":"Ришикеш","hyderabad":"Хайдарабад","ibadan":"Ибадан",
  "idaho":"Айдахо","illinois":"Иллинойс","imphal":"Импхал","indore":"Индаур","ipoh":"Ипох","irkutsk":"Иркутск",
  "istanbul":"Стамбул","istarska":"Истрия","ivano-frankivsk":"Ивано-Франковск","jabalpur":"Джабалпур",
  "jaipur":"Джайпур","jakarta":"Джакарта","jakarta special capital region":"столичный округ Джакарта",
  "jalisco":"Халиско","jammu":"Джамму","jammu and kashmir":"Джамму и Кашмир","jandelsbrunn":"Яндельсбрунн",
  "jarna":"Ярна","järna":"Ярна","java":"Ява","jessore":"Джессор","jhansi":"Джханси","jharkhand":"Джаркханд",
  "jodhpur":"Джодхпур","johor":"Джохор","jos":"Джос","juhu":"Джуху","kachin":"Качин","kaduna":"Кадуна",
  "kalimantan":"Калимантан","kampala":"Кампала","kannur":"Каннур","kanpur":"Канпур","kansai":"Кансай",
  "kansas city":"Канзас-Сити","kanyakumari":"Каньякумари","karachai-cherkessia":"Карачаево-Черкесия",
  "karlovac":"Карловац","karlovačka":"Карловацкая жупания","karnataka":"Карнатака","katakhali":"Катакхали",
  "kaunas":"Каунас","kaunas country":"Каунасский уезд","kaundanyapur":"Каунданьяпур","kazan":"Казань",
  "kedah":"Кедах","kendari":"Кендари","kerala":"Керала","kharkiv":"Харьков","kharkov":"Харьков","khulna":"Кхулна",
  "kiev":"Киев","kirovograd":"Кропивницкий","kirovohrad":"Кропивницкий","kishinev":"Кишинёв","kisumu":"Кисуму",
  "klang":"Кланг","kokosovce":"Кокошовце","kolhapur":"Колхапур","kolkata":"Калькутта","koln":"Кёльн",
  "kosice":"Кошице","kostelec na hané":"Костелец-на-Гане","kostelec na hane":"Костелец-на-Гане",
  "krasnodar":"Краснодар","krasnodar krai":"Краснодарский край","krasnoyarsk":"Красноярск","krishnagiri":"Кришнагири",
  "kuala lumpur":"Куала-Лумпур","kuantan":"Куантан","kuching":"Кучинг","kulaura":"Кулаура","kumbakonam":"Кумбаконам",
  "kurgan":"Курган","kwazulu-natal":"Квазулу-Натал","la libertad":"Ла-Либертад","labasa":"Ламбаса",
  "lagos":"Лагос","laguna":"Лагуна","laguna beach":"Лагуна-Бич","lagunes":"Лагюн","lampung":"Лампунг",
  "lanarkshire":"Ланаркшир","las vegas":"Лас-Вегас","laurence harbor":"Лоренс-Харбор","lautoka":"Лаутока",
  "lazio":"Лацио","lecce":"Лечче","lecce province":"провинция Лечче","leicester":"Лестер","leipzig":"Лейпциг",
  "lenasia":"Ленейжа","lesmahagow":"Лесмахагоу","león guanajuato":"Леон","leon guanajuato":"Леон","lima":"Лима",
  "limburg":"Лимбург","ljubljana":"Любляна","locarno":"Локарно","lombardy":"Ломбардия","lombok":"Ломбок",
  "lomé":"Ломе","lome":"Ломе","london":"Лондон","longdenville":"Лонгденвилл","los angeles":"Лос-Анджелес",
  "los corralitos-guaymallin":"Гуаймальен","louisiana":"Луизиана","lower silesian":"Нижнесилезское воеводство",
  "lucknow":"Лакхнау","ludhiana":"Лудхияна","lugansk":"Луганск","lund":"Лунд","lutotin":"Лютотин","lutsk":"Луцк",
  "luxemburg":"Люксембург","luzce":"Лузце","macchu picchu":"Мачу-Пикчу","macuata":"Макуата","madeira":"Мадейра",
  "madhya pradesh":"Мадхья-Прадеш","madrid":"Мадрид","madurai":"Мадурай","maharashtra":"Махараштра",
  "mahikeng":"Мафикенг","makati":"Макати","malmo":"Мальмё","mandalay":"Мандалай","manila":"Манила",
  "manipur":"Манипур","manokwari":"Маноквари","maritime":"Приморский регион","mariupol":"Мариуполь",
  "marondera":"Марондера","maroochydore":"Маручидор","maryland":"Мэриленд","mashonaland east":"Восточный Машоналенд",
  "massachusetts":"Массачусетс","mayapur":"Маяпур","mazowieckie":"Мазовецкое воеводство","melaka":"Малакка",
  "melbourne":"Мельбурн","mendoza":"Мендоса","mentakap":"Ментакаб","međimurska":"Меджимурская жупания",
  "miami":"Майами","michigan":"Мичиган","milan":"Милан","minas gerais":"Минас-Жерайс","minsk":"Минск",
  "mira road":"Мира-Роуд","missouri":"Миссури","monterrey":"Монтеррей","montevideo":"Монтевидео",
  "montreal":"Монреаль","moscow":"Москва","moundsville":"Маундсвилл","mulberry":"Малберри","mumbai":"Мумбаи",
  "murmansk":"Мурманск","musashino-city":"Мусасино","mykolaiv":"Николаев","nadroga-navosa":"Надрога-Навоса",
  "nairobi":"Найроби","nasik":"Насик","nausori":"Наусори","negeri sembilan":"Негери-Сембилан","nevada":"Невада",
  "new delhi":"Нью-Дели","new jersey":"Нью-Джерси","new south wales":"Новый Южный Уэльс","new vrindaban":"Нью-Вриндаван",
  "new york":"Нью-Йорк","new york state":"штат Нью-Йорк","newcastle":"Ньюкасл","nieuwegein":"Ньивегейн",
  "nigdi":"Нигди","nijny novgorod":"Нижний Новгород","nizhny tagil":"Нижний Тагил","noida":"Нойда",
  "noord-brabant":"Северный Брабант","norte":"Северный регион","north carolina":"Северная Каролина",
  "north rhine-westphalia":"Северный Рейн-Вестфалия","north west":"Северо-Западная провинция",
  "northern ireland":"Северная Ирландия","northwestern":"Северо-Западный регион","novosibirsk":"Новосибирск",
  "nuevo león":"Нуэво-Леон","nuevo leon":"Нуэво-Леон","nyanza":"Ньянза","oak hill":"Оук-Хилл","odisha":"Одиша",
  "ogun":"Огун","ohio":"Огайо","omsk":"Омск","ontario":"Онтарио","oregon":"Орегон","orissa":"Одиша",
  "osafia":"Усфия","osijek":"Осиек","osječko-baranjska":"Осиецко-Бараньская жупания","oskemen":"Усть-Каменогорск",
  "oslo":"Осло","oyo":"Ойо","pahang":"Паханг","palghar":"Палгхар","panama":"Панама","pandharpur":"Пандхарпур",
  "papua":"Папуа","paramaribo":"Парамарибо","paraná":"Парана","parana":"Парана","paraíba":"Параиба",
  "paraiba":"Параиба","parassala":"Парассала","parati":"Парати","paris":"Париж","paul":"Паул","pecs":"Печ",
  "penang":"Пенанг","pennsylvania":"Пенсильвания","perak":"Перак","pereira":"Перейра","perm":"Пермь",
  "pernambuco":"Пернамбуку","perth":"Перт","philadelphia":"Филадельфия","phoenix":"Финикс","phuket":"Пхукет",
  "pindamonhangaba":"Пиндамоньянгаба","plaines wilhems":"Плен-Вильем","plateau":"Плато","pondicherry":"Пудучерри",
  "port harcourt":"Порт-Харкорт","port moresby":"Порт-Морсби","porto alegre":"Порту-Алегри","prague":"Прага",
  "prague balarama restaurant":"Прага","presov":"Прешов","primorsko-goranska":"Приморско-Горанская жупания",
  "primorsky":"Приморский край","puerto rico":"Пуэрто-Рико","pune":"Пуна","punjab":"Пенджаб","quebec":"Квебек",
  "queensland":"Квинсленд","ra":"Ра","rajasthan":"Раджастхан","ranaghat":"Ранагхат","regina":"Реджайна",
  "rewa":"Рева","rhineland-palatinate":"Рейнланд-Пфальц","riau":"Риау","riga":"Рига","rijeka":"Риека",
  "rio de janeiro":"Рио-де-Жанейро","rio grande do sul":"Риу-Гранди-ду-Сул","risaralda":"Рисаральда",
  "rivers":"Риверс","rome":"Рим","romford":"Ромфорд","rosario":"Росарио","rostov":"Ростов-на-Дону",
  "rotterdam":"Роттердам","salem":"Салем","salt lake city":"Солт-Лейк-Сити","samara":"Самара",
  "san antonio":"Сан-Антонио","san jose":"Сан-Хосе","san salvador":"Сан-Сальвадор","santa fe":"Санта-Фе",
  "santiago":"Сантьяго","sao paulo":"Сан-Паулу","sarajevo":"Сараево","sarawak":"Саравак","saskatchewan":"Саскачеван",
  "savanne":"Саван","saxony":"Саксония","seattle":"Сиэтл","selangor":"Селангор","seoul":"Сеул","septon":"Септон",
  "sicily":"Сицилия","sigatoka":"Сингатока","silicon valley":"Кремниевая долина","siliguri":"Силигури",
  "simbirsk":"Ульяновск","singapore city":"Сингапур","skopje":"Скопье","skåne":"Сконе","skane":"Сконе",
  "sofia":"София","solapur":"Шолапур","somogyvamos":"Шомодьвамош","soukenicka":"Прага","south australia":"Южная Австралия","soukenicka-prague":"Прага","salvador":"Салвадор","teluk intan":"Телук-Интан","hanamkonda":"Ханамконда","vapi":"Вапи","rajkot":"Раджкот",
  "south-east":"Юго-Восточный регион","southern finland":"Южная Финляндия","southern region":"Южный регион",
  "spanish fork":"Спэниш-Форк","split":"Сплит","srirangam":"Шрирангам","stockholm":"Стокгольм",
  "stockholm county":"лен Стокгольм","sulawesi":"Сулавеси","sumatra":"Суматра","sumbawa":"Сумбава",
  "sundarpur":"Сундарпур","suva":"Сува","sverdlovsk":"Свердловская область","swansea":"Суонси","sydney":"Сидней",
  "sylhet":"Силхет","södermanland":"Сёдерманланд","sodermanland":"Сёдерманланд","tai pei city":"Тайбэй",
  "taichung":"Тайчжун","tailevu":"Таилеву","takoradi":"Такоради","tallinn":"Таллин","tamil nadu":"Тамилнад",
  "tangail":"Тангайл","tarkwa":"Тарква","tashkent":"Ташкент","tatarstan":"Татарстан","tbilisi":"Тбилиси",
  "tel aviv":"Тель-Авив","tennessee":"Теннесси","texas":"Техас","ticino":"Тичино","tiraspol":"Тирасполь",
  "tirupati":"Тирупати","tok pisin":"Папуа — Новая Гвинея","tokyo":"Токио","tokyo new gaya":"Токио",
  "toronto":"Торонто","towaco":"Товако","trier":"Трир","tripura":"Трипура","tucson":"Тусон","turkeyen":"Тёркьен",
  "tuscany":"Тоскана","tyumen":"Тюмень","tyumen oblast":"Тюменская область","udhampur":"Удхампур",
  "uijeongbu":"Ыйджонбу","ujjain":"Удджайн","ulyanovsk":"Ульяновск","uppland":"Уппланд","utah":"Юта",
  "utrecht":"Утрехт","uttar pradesh":"Уттар-Прадеш","uttarakhand":"Уттаракханд","vacoas":"Вакоа",
  "valle del cauca":"Валье-дель-Каука","vallabh vidyanagar":"Валлабх-Видьянагар","varazdin":"Вараждин",
  "veneto":"Венето","veracruz":"Веракрус","vicenza":"Виченца","victoria":"Виктория","vienna":"Вена",
  "vilnius":"Вильнюс","vilnius country":"Вильнюсский уезд","vinnytsia":"Винница","vitebsk":"Витебск",
  "vladimir":"Владимир","vladivostok":"Владивосток","volyn":"Волынь","vrindavan":"Вриндаван",
  "västergötland":"Вестергётланд","vastergotland":"Вестергётланд","waikato":"Уаикато","wales":"Уэльс",
  "washington":"Вашингтон","watford":"Уотфорд","wattala":"Ваттала","wellington":"Веллингтон",
  "west bengal":"Западная Бенгалия","west indies":"Вест-Индия","west virginia":"Западная Виргиния",
  "western":"Западный регион","western australia":"Западная Австралия","western cape":"Западно-Капская провинция",
  "yaroslavl":"Ярославль","yaroslavl oblast":"Ярославская область","zabaykalsky krai":"Забайкальский край",
  "zagreb":"Загреб","zagrebačka":"Загребская жупания","zaporozhye":"Запорожье","zurich":"Цюрих","zürich":"Цюрих",
  "île-de-france":"Иль-де-Франс","ile-de-france":"Иль-де-Франс",
}

# ── санскрит и имена традиции: токены названий ──────────────────────────
SANS_RU = {
  "sri":"Шри","sree":"Шри","shri":"Шри","srila":"Шрила","srimati":"Шримати","sriman":"Шриман",
  "radha":"Радха","radhe":"Радхе","radharani":"Радхарани","krishna":"Кришна","krsna":"Кришна","krishnas":"Кришны",
  "krishna's":"Кришны","krishna’s":"Кришны","krsna's":"Кришны","krsna’s":"Кришны","gopal":"Гопал","gopala":"Гопала","gopal's":"Гопала","gopal’s":"Гопала","gopinath":"Гопинатх",
  "gopinatha":"Гопинатха","govinda":"Говинда","govindas":"«Говиндас»","govinda's":"«Говиндас»","govinda’s":"«Говиндас»","govindaji":"Говиндаджи",
  "madhava":"Мадхава","madava":"Мадхава","madan":"Мадан","mohan":"Мохан","madanmohan":"Мадан-Мохан",
  "gaura":"Гаура","goura":"Гаура","gauranga":"Гауранга","nitai":"Нитай","gaur":"Гаур","nityananda":"Нитьянанда",
  "caitanya":"Чайтанья","chaitanya":"Чайтанья","candrodaya":"Чандродая","chandrodaya":"Чандродая",
  "jagannath":"Джаганнатх","jagannatha":"Джаганнатха","baladeva":"Баладева","balaram":"Баларам","balarama":"Баларама",
  "subhadra":"Субхадра","narasimha":"Нарасимха","nrsimha":"Нрисимха","giridhari":"Гиридхари","gopivallabha":"Гопиваллабха",
  "rama":"Рама","ram":"Рам","sita":"Сита","laxmi":"Лакшми","lakshmi":"Лакшми","narayan":"Нараян","narayana":"Нараяна",
  "venkateswara":"Венкатешвара","vitthal":"Виттхал","vitthala":"Виттхала","panduranga":"Пандуранга",
  "radhakanta":"Радхаканта","shyamsundar":"Шьямасундар","syamasundara":"Шьямасундара","gokulananda":"Гокулананда",
  "madhusudan":"Мадхусудан","damodar":"Дамодар","kalachandji's":"«Калачанджи»","kalachandji’s":"«Калачанджи»","damodara":"Дамодара","keshava":"Кешава","kesava":"Кешава",
  "mandir":"мандир","mandira":"мандир","dham":"дхама","dhama":"дхама","dhaam":"дхама","tirtha":"тиртха",
  "ashram":"ашрам","ashrama":"ашрам","asram":"ашрам","asrama":"ашрам","goshalla":"гошала","goshala":"гошала",
  "gosala":"гошала","kunj":"кундж","kunja":"кунджа","kund":"кунда","kutir":"кутир","kuti":"кути","vihar":"вихар",
  "puri":"Пури","prasada":"прасада","prasadam":"прасадам","bhakti":"бхакти","bhaktilata":"Бхактилата",
  "bhaktivedanta":"Бхактиведанта","prabhupada":"Прабхупада","vrindavan":"Вриндаван","vrindavana":"Вриндавана",
  "vrndavana":"Вриндавана","vraja":"Враджа","vrajabhumi":"Враджабхуми","mayapur":"Маяпур","mayapura":"Маяпура",
  "navadvipa":"Навадвипа","goloka":"Голока","gokul":"Гокул","gokula":"Гокула","govardhana":"Говардхана",
  "govardhan":"Говардхан","varshana":"Варшана","yogapitha":"Йогапитха","santipur":"Шантипур","talavan":"Талаван",
  "naimisaranya":"Наймишаранья","badarikasrama":"Бадарикашрама","ekacakra":"Экачакра","ekachakra":"Экачакра",
  "gundica":"Гундича","raman":"Раман","reti":"Рети","madhuvan":"Мадхуван","mathura":"Матхура",
  "simhachalam":"Симхачалам","pundarika":"Пундарика","rup":"Рупа","rupa":"Рупа","sanatan":"Санатана",
  "sanatana":"Санатана","smriti":"Смрити","tamal":"Тамал","murari":"Мурари","sevaka":"Севака",
  "hare":"Харе","namhatta":"Нама-хатта","outost":"форпост","outpost":"форпост","haribol":"Харибол","sankirtan":"санкиртана","kirtan":"киртан","nagari":"Нагари","gita":"Гита",
  "gitanagari":"Гита-Нагари","vedic":"ведическая","veda":"Веда","tulasi":"Туласи","atma":"Атма","ganga":"Ганга",
  "yamuna":"Ямуна","saranagati":"Шаранагати","vidyalaya":"видьялая","rajavidyalayate":"раджа-видьялая",
  "vidyanagar":"Видьянагар","vidyapitha":"Видьяпитха","bidyashram":"видьяшрам","vally":"Валли","valley":"Валли",
  "new":"Нью-","nova":"Нова-","nouvelle":"Нувель-","la":"Ла-","csillaghegy":"Чиллагхедь",
}

# ── общие слова ─────────────────────────────────────────────────────────
WORD_RU = {
  "temple":("храм","head"),"restaurant":("ресторан","head"),"restaurante":("ресторан","head"),
  "cafe":("кафе","head"),"café":("кафе","head"),"farm":("ферма","head"),"center":("центр","head"),
  "centre":("центр","head"),"house":("дом","head"),"school":("школа","head"),"academy":("академия","head"),
  "college":("колледж","head"),"institute":("институт","head"),"club":("клуб","head"),"bakery":("пекарня","head"),
  "buffet":("буфет","head"),"gallery":("галерея","head"),"island":("остров","head"),"garden":("сад","head"),
  "manor":("Мэнор","plain"),"village":("деревня","head"),"community":("община","head"),
  "cultural":("культурный","adj"),"vegetarian":("вегетарианский","adj"),"vedic":("ведический","adj"),
  "eco":("эко","adj"),"veggie":("овощной","adj"),"sweet":("сладкий","adj"),"higher":("высший","adj"),"preaching":("проповеднический","adj"),
  "matchless":("бесценный","adj"),"snacks":("закусочная","plain"),"bar":("бар","plain"),"food":("пища","plain"),
  "for":("","skip"),"of":("","skip"),"the":("","skip"),"and":("и","plain"),"&":("и","plain"),
  "life":("жизни","plain"),"my":("мой","plain"),"lord":("Господь","plain"),"taste":("вкус","plain"),
  "street":("стрит","plain"),"avenue":("авеню","plain"),"ave.":("авеню","plain"),"road":("роуд","plain"),
  "court":("корт","plain"),"corner":("корнер","plain"),"plaza":("плаза","plain"),"hill":("Хилл","plain"),
  "hilltop":("Хиллтоп","plain"),"bay":("Бэй","plain"),"second":("Вторая","plain"),"holyfood":("Holyfood","plain"),
  "movement":("движение","plain"),"understanding":("понимания","plain"),"south":("Южный","plain"),
  "east":("Восточный","plain"),"west":("Западный","plain"),"north":("Северный","plain"),
  "iskcon":("ИСККОН","plain"),"(sa)":("(ЮАР)","plain"),"hq":("штаб-квартира","plain"),"cdam":("CDAM","plain"),"nvcc":("NVCC","plain"),
}

# ── практическая транскрипция (индийский уклон) ─────────────────────────
_TR = [
  ("shch","щ"),("sch","ш"),("chh","чх"),("tch","ч"),("ck","к"),("kh","кх"),("gh","гх"),("jh","джх"),
  ("ch","ч"),("sh","ш"),("zh","ж"),("th","тх"),("dh","дх"),("ph","пх"),("bh","бх"),("ts","ц"),
  ("aa","а"),("ee","и"),("oo","у"),("ii","и"),("uu","у"),("ai","ай"),("au","ау"),("ay","ай"),("ey","ей"),
  ("oy","ой"),("ya","я"),("yu","ю"),("yo","йо"),("ye","е"),("yi","йи"),("ju","джу"),("ja","джа"),("je","дже"),
  ("ji","джи"),("jo","джо"),("qu","кв"),("x","кс"),("w","в"),("j","дж"),("y","й"),("q","к"),
  ("a","а"),("b","б"),("c","к"),("d","д"),("e","е"),("f","ф"),("g","г"),("h","х"),("i","и"),("k","к"),
  ("l","л"),("m","м"),("n","н"),("o","о"),("p","п"),("r","р"),("s","с"),("t","т"),("u","у"),("v","в"),("z","з"),
]

def translit(token: str) -> str:
    src = token.lower().replace("’", "").replace("'", "")
    out, i = [], 0
    while i < len(src):
        for pat, ru in _TR:
            if src.startswith(pat, i):
                out.append(ru); i += len(pat); break
        else:
            out.append(src[i]); i += 1
    res = "".join(out)
    return (res[:1].upper() + res[1:]) if token[:1].isupper() else res


def _city_norm(raw: str) -> str:
    c = (raw or "").strip()
    c = re.sub(r"^ISKCON\s+", "", c, flags=re.I)
    c = re.sub(r"\s+Govinda[’']s$", "", c, flags=re.I)
    c = re.sub(r"\s*\(.*$", "", c).strip()
    return c


def ru_city(raw: str) -> str:
    base = _city_norm(raw)
    if not base: return ""
    hit = GEO_RU.get(base.lower())
    if hit: return hit
    return " ".join(translit(t) for t in base.split())


def ru_state(raw: str) -> str:
    s = (raw or "").strip()
    if not s: return ""
    return GEO_RU.get(s.lower()) or " ".join(SANS_RU.get(t.lower(), GEO_RU.get(t.lower(), translit(t))) for t in s.split())


# ── перевод названия места ──────────────────────────────────────────────
_INDIC_TAIL = {"мандир","дхама","тиртха","ашрам","гошала","кундж","кунджа","кунда","кути","кутир","вихар",
               "видьялая","видьяшрам","раджа-видьялая"}

def _phrase_ru(phrase: str) -> str:
    """Перевод фразы-описания: токены → SANS/WORD/GEO/translit. Head-слово (храм,
    ресторан…) выносится вперёд, только если стоит последним; прилагательные — перед ним.
    Индийские типы (мандир, дхама…) приклеиваются дефисом к имени по стилю BBT."""
    g = GEO_RU.get(phrase.strip().lower())
    if g: return g
    raw = [w for w in re.split(r"[ ]+", phrase.replace("/", " ").strip()) if w]
    toks, adjs, head = [], [], None
    for idx, w in enumerate(raw):
        wl = w.lower().strip(",.")
        last = idx == len(raw) - 1
        kind = WORD_RU.get(wl, (None, None))[1]
        if kind == "skip": continue
        if kind == "adj": adjs.append(WORD_RU[wl][0]); continue
        if kind == "head" and last and head is None: head = WORD_RU[wl][0]; continue
        if adjs and not (kind == "head" and last):  # прилагательные не к head — вернуть в поток
            toks.extend(adjs); adjs = []
        if kind is not None:
            toks.append(WORD_RU[wl][0]); continue
        if wl in SANS_RU: toks.append(SANS_RU[wl]); continue
        if wl in GEO_RU: toks.append(GEO_RU[wl]); continue
        if "-" in w:  # Soukenicka-Prague и т.п.
            parts = [GEO_RU.get(x.lower()) or SANS_RU.get(x.lower()) or translit(x) for x in w.split("-")]
            toks.append("-".join(parts)); continue
        toks.append(translit(w))
    out = []
    for t in toks:
        if out and t in _INDIC_TAIL:
            out[-1] = out[-1] + "-" + t
        elif out and out[-1].endswith("-"):
            out[-1] = out[-1] + t
        else:
            out.append(t)
    body = " ".join(out).strip()
    if head:
        hp = " ".join(adjs + [head])
        hp = hp[:1].upper() + hp[1:]
        return (hp + (" " + body if body else "")).strip()
    if adjs: body = (" ".join(adjs) + " " + body).strip()
    return body or phrase


def ru_place_name(name: str) -> str:
    n = (name or "").strip()
    if not n: return ""
    parts = re.split(r"\s+[–—-]\s+", n, 1)
    left = parts[0].strip()
    left_ru = GEO_RU.get(left.lower()) or (_phrase_ru(left) if not re.fullmatch(r"[A-Za-zÀ-ž .,'’()-]+", left) or True else left)
    if len(parts) == 1:
        return left_ru
    right_ru = _phrase_ru(parts[1].strip())
    return f"{left_ru} — {right_ru}"
