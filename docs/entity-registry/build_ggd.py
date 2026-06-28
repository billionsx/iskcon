#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build Gaura-ganoddesha-dipika entities/relations from curated verse pairs.
Source: Kavi Karnapura, Sri Gaura-ganoddesha-dipika (iskcone.com /ru/kavi-karnapur/...).
Each tuple: (verse, gaura_slug, gaura_ru, krishna_slug, krishna_ru, category, confidence)
gaura_* = personality in Gaura-lila (the new Chaitanya-associate entity)
krishna_* = their identity in Krishna/Rama-lila (links to existing core entity when slug matches)
"""
import csv, os

# Existing core ids (to mark overlaps, not re-create)
core_ids = set()
core_path = os.path.join(os.path.dirname(__file__), "entities_core.csv")
with open(core_path, encoding="utf-8") as f:
    for row in csv.DictReader(f):
        core_ids.add(row["id"])

P = [
 # verse, gaura_slug, gaura_ru, krishna_slug, krishna_ru, category, conf
 (34,"upendra-mishra","Упендра Мишра","parjanya","Парджанья (дед Кришны, гопа)","gauranga-lila|family","verified"),
 (35,"kamalavati-devi","Камалавати-деви","variyasi-devi","Варияси-деви","gauranga-lila|family","verified"),
 (36,"shachidevi","Шачидеви","yashoda","Яшода","gauranga-lila|family","verified"),
 (36,"jagannatha-mishra","Джаганнатха Мишра Пурандара","nanda","Нанда","gauranga-lila|family","verified"),
 (39,"padmavati","Падмавати","rohini","Рохини","gauranga-lila|family","review"),
 (40,"govinda-acharya","Говинда Ачарья","paurnamasi","Паурнамаси","gauranga-lila|associate","verified"),
 (41,"malini-devi","Малини-деви","ambika-nurse","Амбика (нянька Кришны)","gauranga-lila|family","verified"),
 (42,"narayani-devi","Нараяни-деви","kilambika","Киламбика-деви","gauranga-lila|associate","verified"),
 (43,"vallabhacharya-gl","Валлабхачарья","janaka","Джанака (или Бхишмака)","gauranga-lila|associate","review"),
 (44,"lakshmipriya","Лакшмиприя","janaki-rukmini","Джанаки и Рукмини (Лакшми)","gauranga-lila|consort","verified"),
 (46,"sanatana-mishra","Санатана Мишра","satrajit","Махараджа Сатраджит","gauranga-lila|associate","verified"),
 (46,"vishnupriya","Вишнуприя","bhu-devi","Бху-деви (Бхушакти)","gauranga-lila|consort","verified"),
 (48,"vanamali-acharya","Ванамали Ачарья","vishvamitra","Вишвамитра Муни","gauranga-lila|associate","verified"),
 (49,"kashinatha","Кашинатха","kulaka","брахман Кулака","gauranga-lila|associate","verified"),
 (50,"jagadananda-pandit","Джагадананда Пандит","satyabhama","Сатьябхама","gauranga-lila|associate","verified"),
 (51,"keshava-bharati","Кешава Бхарати","sandipani","Сандипани Муни","gauranga-lila|sannyasi","verified"),
 (52,"gangadasa-pandit","Гангадаса Пандит","vasishtha","Васиштха Муни","gauranga-lila|associate","verified"),
 (52,"sudarshana","Сударшана","vasishtha","Васиштха Муни","gauranga-lila|associate","review"),
 (53,"pundarika-vidyanidhi","Пундарика Видьянидхи","vrishabhanu","Махараджа Вришабхану","gauranga-lila|associate","verified"),
 (56,"madhava-mishra","Мадхава Мишра","vrishabhanu","Махараджа Вришабхану","gauranga-lila|associate","review"),
 (56,"ratnavati-devi","Ратнавати-деви","kirtida","Киртида-деви","gauranga-lila|associate","verified"),
 (64,"vasudha-devi","Васудха-деви","varuni-devi","Варуни-деви (супруга Баларамы)","gauranga-lila|consort","verified"),
 (64,"jahnavi-devi","Джахнави-деви","revati","Ревати-деви (супруга Баларамы)","gauranga-lila|consort","verified"),
 (64,"surya-das","Сурья-дас","kakudmi","Махараджа Какудми","gauranga-lila|associate","verified"),
 (65,"vasudha-devi","Васудха-деви","ananga-manjari","Ананга-манджари","gauranga-lila|consort","review"),
 (66,"virachandra","Вирачандра Прабху","kshirodakashayi-vishnu","Кширодакашайи Вишну","gauranga-lila|vishnu-tattva","verified"),
 (68,"ganga-devi","Ганга-деви","ganga","Ганга (река из стоп Вишну)","gauranga-lila|associate","verified"),
 (68,"shri-madhava-ganga","Шри Мадхава","shantanu","Махараджа Шантану","gauranga-lila|associate","verified"),
 (69,"raghunandana-thakura","Рагхунандана Тхакур","pradyumna","Прадьюмна (Чатур-вьюха)","gauranga-lila|associate","verified"),
 (70,"vakreshvara-pandit","Вакрешвара Пандит","aniruddha","Анируддха (Чатур-вьюха)","gauranga-lila|associate","verified"),
 (72,"nakula-brahmachari","Накула Брахмачари","chaitanya","Шактьявеша Чайтаньи","gauranga-lila|shaktyavesha","verified"),
 (73,"pradyumna-mishra","Прадьюмна Мишра","chaitanya","Частичное проявление Гауры","gauranga-lila|associate","review"),
 (73,"bhagavan-acharya","Бхагаван Ачарья Кханджа","chaitanya","Частичное проявление Гауры","gauranga-lila|associate","review"),
 (74,"gopinatha-acharya","Гопинатха Ачарья","brahma","Брахма (Нававьюха)","gauranga-lila|associate","verified"),
 (80,"kuvera-pandit","Кувера Пандит","kuvera","Кувера","gauranga-lila|family","verified"),
 (85,"sita-advaita","Сита-деви (супруга Адвайты)","yogamaya","Йогамайя","gauranga-lila|consort","verified"),
 (86,"achyutananda","Ачьютананда","karttikeya","Карттикея и Ачьюта-гопи","gauranga-lila|associate","review"),
 (88,"nandini","Нандини","jaya","Джая","gauranga-lila|associate","verified"),
 (88,"jangali","Джангали","vijaya","Виджая","gauranga-lila|associate","verified"),
 (89,"srivasa","Шриваса Пандит","narada","Нарада Муни","gauranga-lila|pancha-tattva","verified"),
 (89,"rama-pandit","Рама Пандит","parvata-muni","Парвата Муни","gauranga-lila|associate","verified"),
 (90,"murari-gupta","Мурари Гупта","hanuman","Хануман","gauranga-lila|associate","verified"),
 (90,"purandara-acharya","Пурандара","angada","Ангада","gauranga-lila|associate","verified"),
 (90,"govindananda","Говиндананда","sugriva","Сугрива","gauranga-lila|associate","verified"),
 (91,"ramachandra-puri","Рамачандра Пури","vibhishana","Вибхишана (или Джатила)","gauranga-lila|sannyasi","review"),
 (92,"haridasa-thakura","Харидас Тхакур","prahlada","Брахма Махатапах и Прахлада","gauranga-lila|namacharya","review"),
 (103,"nilambara-chakravarti","Ниламбара Чакраварти","garga-muni","Гарга Муни","gauranga-lila|family","verified"),
 (105,"devananda-pandit","Девананда Пандит","bhaguri-muni","Бхагури Муни","gauranga-lila|associate","verified"),
 (108,"vrindavana-dasa-thakura","Вриндаван дас Тхакур","vyasadeva","Ведавьяса","gauranga-lila|author","verified"),
 (109,"vallabha-bhatta","Валлабха Бхатта","sukadeva","Шукадева Госвами","gauranga-lila|associate","verified"),
 (110,"jagannatha-acharya","Джаганнатха Ачарья (Гангадаса)","durvasa","Дурваса Муни","gauranga-lila|associate","verified"),
 (111,"chandrashekhara-acharya","Чандрашекхара Ачарья","chandra","Бог Луны","gauranga-lila|associate","verified"),
 (112,"vishveshvara-acharya","Вишвешвара Ачарья","surya","Бог Солнца","gauranga-lila|associate","verified"),
 (113,"bhaskara-thakura","Бхаскара Тхакур","vishvakarma","Вишвакарма","gauranga-lila|associate","verified"),
 (113,"vanamali-thakura","Ванамали Тхакур","sudama-brahmana","Судама (брахман)","gauranga-lila|associate","verified"),
 (114,"jagannatha-jv","Джаганнатха","jaya","Джая (вратарь Вайкунтхи)","gauranga-lila|associate","verified"),
 (114,"madhava-jv","Мадхава","vijaya","Виджая (вратарь Вайкунтхи)","gauranga-lila|associate","verified"),
 (115,"govinda-pk","Говинда","pundarikaksha","Пундарикакша","gauranga-lila|associate","verified"),
 (115,"garuda-kumuda","Гаруда","kumuda","Кумуда","gauranga-lila|associate","verified"),
 (116,"garuda-pandit","Гаруда Пандит","garuda","Гаруда","gauranga-lila|associate","verified"),
 (116,"gopinatha-simha","Гопинатха Симха","akrura","Акрура","gauranga-lila|associate","verified"),
 (117,"paramananda-puri","Парамананда Пури","uddhava","Уддхава","gauranga-lila|sannyasi","verified"),
 (117,"prataparudra","Махараджа Пратапарудра","indradyumna","Махараджа Индрадьюмна","gauranga-lila|patron","verified"),
 (118,"sarvabhauma-bhattacharya","Сарвабхаума Бхаттачарья","brihaspati","Брихаспати","gauranga-lila|associate","verified"),
 (119,"ramananda-raya","Рамананда Рай","arjuna","Арджуна (пастух и Пандава) и Лалита-гопи","gauranga-lila|chaitanya-associate","verified"),
 (121,"bhavananda-raya","Бхавананда Рай","pandu","Махараджа Панду","gauranga-lila|associate","verified"),
 (125,"ramadasa-abhirama","Рамадаса Абхирама","shridama","Шридама (пастух)","gauranga-lila|associate","verified"),
 (126,"sundara-thakura","Сундара Тхакур","sudama-gopa","Судама (пастух)","gauranga-lila|associate","verified"),
 (126,"dhananjaya-pandit","Дхананджая Пандит","vasudama","Васудама (пастух)","gauranga-lila|associate","verified"),
 (127,"gauridasa-pandit","Гауридаса Пандит","subala","Субала (пастух)","gauranga-lila|associate","verified"),
 (127,"kamalakara-pippalai","Камалакара Пиппалаи","mahabala","Махабала (пастух)","gauranga-lila|associate","verified"),
 (128,"uddharana-datta","Уддхарана Датта","subahu","Субаху (пастух)","gauranga-lila|associate","verified"),
 (128,"mahesha-pandit","Махеша Пандит","mahabahu","Махабаху (пастух)","gauranga-lila|associate","verified"),
 (129,"purushottama-dasa","Пурушоттама дас","stokakrishna","Стокакришна (пастух)","gauranga-lila|associate","verified"),
 (130,"nagara-purushottama","Нагара Пурушоттама","dama-gopa","Дама-гопа","gauranga-lila|associate","verified"),
 (131,"parameshvara-dasa","Парамешвара дас","arjuna-gopa","Арджуна (пастух)","gauranga-lila|associate","verified"),
 (131,"kalakrishna-dasa","Калакришна дас","lavanga-gopa","Лаванга (пастух)","gauranga-lila|associate","verified"),
 (132,"kholavecha-shridhara","Кхолавеча Шридхара","kusumashava","Кусумашава (пастух)","gauranga-lila|associate","verified"),
 (133,"halayudha-thakura","Халаюдха Тхакур","prabala","Прабала (друг Баларамы)","gauranga-lila|associate","verified"),
 (134,"rudra-pandit","Рудра Пандит","varuthapa","Варутхапа (пастух)","gauranga-lila|associate","verified"),
 (135,"kumudananda-pandit","Кумудананда Пандит","gandharva-gopa","Гандхарва (пастух)","gauranga-lila|associate","verified"),
 (136,"kashishvara","Кашишвара","bhringara","Бхрингара (слуга)","gauranga-lila|servant","verified"),
 (136,"govinda-servant","Говинда","bhangura","Бхангура (слуга)","gauranga-lila|servant","verified"),
 (137,"haridasa-servant","Харидаса","raktaka","Рактака (слуга)","gauranga-lila|servant","verified"),
 (137,"brihachchhishu","Брихаччхишу","patraka","Патрака (слуга)","gauranga-lila|servant","verified"),
 (138,"ramai","Рамай","payoda","Пайода (пастух)","gauranga-lila|servant","verified"),
 (138,"nandai","Нандай","varida","Варида (пастух)","gauranga-lila|servant","verified"),
 (139,"mukunda-datta","Мукунда Датта","madhukantha","Мадхукантха (певец)","gauranga-lila|singer","verified"),
 (139,"vasudeva-datta","Васудева Датта","madhuvrata","Мадхуврата (певец)","gauranga-lila|singer","verified"),
 (140,"makaradhvajakara","Макарадхваджакара","chandramukha","Чандрамукха (танцор)","gauranga-lila|dancer","verified"),
 (141,"shankara-ghosha","Шанкара Гхош","sudhakara","Судхакара (мридангист)","gauranga-lila|musician","verified"),
 (142,"jagadisha-pandit","Джагадиша Пандит","chandrahasa","Чандрахаса (танцор)","gauranga-lila|dancer","verified"),
 (143,"vanamala-pandit","Ванамала Пандит","maladhara","Маладхара","gauranga-lila|associate","verified"),
 (144,"chaitanya-dasa","Чайтанья дас","daksha-parrot","Дакша (попугай)","gauranga-lila|associate","verified"),
 (144,"rama-dasa","Рама дас","vichakshana-parrot","Вичакшана (попугай)","gauranga-lila|associate","verified"),
 (146,"gadadhara","Гададхара Пандит","radharani","Шримати Радхарани и Лалита-гопи","gauranga-lila|pancha-tattva","verified"),
 (151,"dhruvananda-brahmachari","Дхрувананда Брахмачари","lalita","Лалита-гопи","gauranga-lila|associate","review"),
 (153,"gadadhara-dasa","Гададхара дас","chandrakanti","Чандраканти-деви и Пурнананда-гопи","gauranga-lila|associate","verified"),
 (155,"sadashiva-kaviraja","Садашива Кавираджа","chandravali","Чандравали-гопи","gauranga-lila|associate","verified"),
 (156,"shankara-pandit","Шанкара Пандит","shribhadra","Шрибхадра-гопи","gauranga-lila|associate","verified"),
 (157,"jagannatha-tp","Джаганнатха","taraka-devi","Тарака-деви (гопи)","gauranga-lila|associate","verified"),
 (157,"gopala-tp","Гопала","pali-devi","Пали-деви (гопи)","gauranga-lila|associate","verified"),
 (158,"damodara-pandit","Дамодара Пандит","shaibya","Шайбья-гопи и Сарасвати","gauranga-lila|associate","verified"),
 (159,"svarupa-damodara","Сварупа Дамодара Госвами","vishakha","Вишакха-гопи","gauranga-lila|chaitanya-associate","verified"),
 (160,"vanamali-chitra","Шри Ванамали","chitra-devi","Читра-деви (гопи)","gauranga-lila|associate","verified"),
 (161,"raghava-goswami","Рагхава Госвами","champakalata","Чампакалата-гопи","gauranga-lila|author","verified"),
 (162,"prabodhananda-saraswati-thakur","Прабодхананда Сарасвати","tungavidya","Тунгавидья-гопи","gauranga-lila|acharya","verified"),
 (163,"krishnadasa-brahmachari","Кришнадас Брахмачари","indulekha","Индулекха-гопи","gauranga-lila|associate","verified"),
 (164,"gadadhara-bhatta","Гададхара Бхатта","rangadevi","Рангадеви-гопи","gauranga-lila|associate","verified"),
 (164,"ananta-acharya","Ананта Ачарья Госвами","sudevi","Судеви-гопи","gauranga-lila|associate","verified"),
 (165,"kashishvara-goswami","Кашишвара Госвами","shashirekha","Шаширекха-деви","gauranga-lila|associate","verified"),
 (165,"raghava-pandit","Рагхава Пандит","dhanishtha","Дхаништха-деви (гопи)","gauranga-lila|associate","verified"),
 (166,"damayanti-devi","Дамаянти-деви","gunamala","Гунамала-деви (гопи)","gauranga-lila|associate","verified"),
 (166,"krishnadas-rr","Кришнадас","ratnarekha","Ратнарекха-гопи","gauranga-lila|associate","verified"),
 (166,"krishnananda-kv","Кришнананда","kalavati","Калавати-гопи","gauranga-lila|associate","verified"),
 (167,"narayana-vachaspati","Нараяна Вачаспати","gauraseni","Гаурасени-гопи","gauranga-lila|associate","verified"),
 (167,"pitambara","Питамбара","kaveri","Кавери-гопи","gauranga-lila|associate","verified"),
 (167,"makaradhvaja","Макарадхваджа","sukeshi","Сукеши-гопи","gauranga-lila|associate","verified"),
 (168,"madhvacharya-gl","Мадхвачарья (спутник)","madhavi-gopi","Мадхави-гопи","gauranga-lila|associate","verified"),
 (168,"jiva-pandit","Джива Пандит","indira-gopi","Индира-гопи","gauranga-lila|associate","verified"),
 (169,"vidyavachaspati","Видьявачаспати","tungavidya2","Тунгавидья-гопи","gauranga-lila|associate","verified"),
 (170,"balabhadra-bhattacharya","Балабхадра Бхаттачарья","madhurekshana","Мадхурекшана-гопи","gauranga-lila|associate","verified"),
 (170,"shrinatha-mishra","Шринатха Мишра","chitrani","Читрани-гопи","gauranga-lila|associate","verified"),
 (170,"kavichandra","Кавичандра","manohara","Манохара-гопи","gauranga-lila|associate","verified"),
 (171,"sharanga-thakura","Шаранга Тхакур","nandimukhi","Нандимукхи-деви","gauranga-lila|associate","review"),
 (172,"ramananda-vasu","Рамананда Васу","kalakantha","Калакантха-деви","gauranga-lila|associate","verified"),
 (172,"satyaraja","Сатьяраджа","sukantha","Сукантха-деви","gauranga-lila|associate","verified"),
 (173,"shrikanta-sena","Шриканта Сена","katyayani","Катьяяни-деви (гопи)","gauranga-lila|associate","verified"),
 (174,"mukunda-dasa-shrikhanda","Мукунда дас (Шрикханда)","vrinda-devi","Вринда-деви","gauranga-lila|associate","verified"),
 (175,"shivananda-sena","Шивананда Сена","vira-devi","Вира-деви и Дути-деви","gauranga-lila|associate","verified"),
 (176,"narahari-sarakara-thakur","Нарахари Саракара Тхакур","madhumati","Мадхумати-деви","gauranga-lila|associate","verified"),
 (177,"gopinatha-acharya-rv","Гопинатха Ачарья","ratnavali-devi","Ратнавали-деви (гопи)","gauranga-lila|associate","verified"),
 (178,"vamshi-dasa-thakura","Вамши-дас Тхакур","krishna-flute","Флейта Господа Кришны","gauranga-lila|associate","verified"),
 (179,"rupa-goswami","Рупа Госвами","rupa-manjari","Рупа-манджари","gauranga-lila|six-goswamis","verified"),
 (180,"sanatana-goswami","Санатана Госвами","lavanga-manjari","Лаванга/Рати-манджари и Санатана Кумар","gauranga-lila|six-goswamis","verified"),
 (181,"shivananda-chakravarti","Шивананда Чакраварти","lavanga-manjari","Лаванга-манджари","gauranga-lila|associate","review"),
 (183,"gopala-bhatta-goswami","Гопал Бхатта Госвами","ananga-manjari","Ананга-манджари (или Гуна-манджари)","gauranga-lila|six-goswamis","verified"),
 (184,"raghunatha-bhatta-goswami","Рагхунатха Бхатта Госвами","raga-manjari","Рага-манджари","gauranga-lila|six-goswamis","verified"),
 (185,"raghunatha-das-goswami","Рагхунатха дас Госвами","rasa-manjari","Раса/Рати-манджари (или Бханумати)","gauranga-lila|six-goswamis","verified"),
 (186,"bhugarbha-goswami","Бхугарбха Тхакур","prema-manjari","Према-манджари","gauranga-lila|associate","verified"),
 (186,"lokanatha-goswami","Локанатха Госвами","lila-manjari","Лила-манджари","gauranga-lila|associate","verified"),
 (189,"kalidasa","Калидаса","malli-devi","Малли-деви","gauranga-lila|associate","verified"),
 (190,"shuklambara-brahmachari","Шукламбара Брахмачари","yajna-patni","Ягья-патни","gauranga-lila|associate","verified"),
 (192,"kashi-mishra","Каши Мишра","kubja","Кубджа","gauranga-lila|associate","verified"),
]

# group lists (members share one Krishna-lila collective identity)
groups = [
 (95,"eight-siddhis","Восемь мистических сил (анима и др.)",
   [("ananta-puri","Ананта"),("sukhananda-puri","Сукхананда"),("govinda-puri","Говинда"),
    ("raghunatha-puri","Рагхунатха"),("krishnananda-puri","Кришнананда"),("keshava-puri","Кешава"),
    ("damodara-puri","Дамодара"),("raghava-puri","Рагхава")],"gauranga-lila|sannyasi"),
 (98,"nine-jayantas","Девять Джаянтей",
   [("nrisimhananda-tirtha","Нрисимхананда Тиртха"),("satyananda-bharati","Сатьянанда Бхарати"),
    ("nrisimha-tirtha","Нрисимха Тиртха"),("chidananda-tirtha","Чидананда Тиртха"),
    ("jagannatha-tirtha","Джаганнатха Тиртха"),("vasudeva-tirtha","Васудева Тиртха"),
    ("rama-tirtha","Рама Тиртха"),("purushottama-tirtha-gl","Пурушоттама Тиртха"),
    ("garuda-avadhuta","Гаруда Авадхута (Гопендра Ашрама)")],"gauranga-lila|sannyasi"),
 (101,"nine-treasures-kuvera","Девять сокровищ Куверы",
   [("shrinidhi","Шринидхи"),("shrigarbha","Шригарбха"),("kaviratna","Кавиратна"),
    ("sudhanidhi","Судханидхи"),("vidyanidhi-gl","Видьянидхи"),("gunanidhi","Гунанидхи"),
    ("ratnabahu","Ратнабаху"),("acharyaratna","Ачарьяратна"),("ratnakara-pandit","Ратнакара Пандит")],"gauranga-lila|family"),
 (106,"four-kumaras","Четыре Кумара",
   [("kashinatha-natha","Кашинатха"),("lokanatha-natha","Локанатха"),
    ("shrinatha-natha","Шринатха"),("ramanatha-natha","Раманатха")],"gauranga-lila|associate"),
 (193,"sakhi-of-radharani","Служанки Шримати Радхарани (стих 193)",
   [("subhananda-dvija","Субхананда Двиджа"),("shridhara-brahmachari","Шридхара Брахмачари"),
    ("parananda-gupta","Парамананда Гупта"),("raghunatha-dvija","Рагхунатха Двиджа"),
    ("kamshari-sena","Камшари Сена"),("jagannatha-sena","Джаганнатха Сена Махашая"),
    ("subuddhi-mishra","Субуддхи Мишра"),("shriharsha","Шрихарша"),("raghu-mishra","Рагху Мишра"),
    ("jitamrita","Джитамрита"),("bhagavatacharya","Бхагаватачарья"),("jiva-pandit-vallabha","Джива Пандит (сын Валлабхи)"),
    ("vaninatha-dvija","Ванинатха Двиджа"),("ishanacharya","Ишаначарья"),("kamala-gl","Камала"),
    ("lakshminatha-pandit","Лакшминатха Пандит"),("ganga-mantri","Ганга-мантри"),
    ("jagannatha-mamu","Джаганнатха Маму"),("shrikanthabharana-ananta","Шрикантхабхарана Ананта"),
    ("hastigopala","Хастигопала"),("hari-acharya","Хари Ачарья"),("shrinayana-mishra","Шринаяна Мишра"),
    ("kavidatta","Кавидатта"),("ramadas-193","Рамадас"),("chiranjiva","Чиранджива"),("sulochana","Сулочана")],
   "gauranga-lila|associate"),
]

# Madhva-Gaudiya parampara chain (verse 21-22), as guru->disciple edges
parampara = [
 ("brahma","Брахма"),("narada","Нарада"),("vyasadeva","Вьясадева"),("madhva","Мадхвачарья"),
 ("padmanabha-tirtha","Падманабха Тиртха"),("narahari-tirtha","Нарахари Тиртха"),
 ("madhava-tirtha","Мадхава Тиртха"),("akshobhya-tirtha","Акшобхья Тиртха"),
 ("jayatirtha","Джаятиртха"),("jnanasindhu","Гьянасиндху"),("mahanidhi","Маханидхи"),
 ("vidyanidhi-tirtha","Видьянидхи"),("rajendra-tirtha","Раджендра Тиртха"),
 ("jayadharma-muni","Джаядхарма Муни"),("purushottama-tirtha","Пурушоттама Тиртха"),
 ("vyasatirtha","Вьясатиртха"),("lakshmipati-tirtha","Лакшмипати Тиртха"),
 ("madhavendra-puri","Мадхавендра Пури"),("ishvara-puri","Ишвара Пури"),
]

base = os.path.dirname(__file__)

# 1) pairs file (faithful mapping)
with open(os.path.join(base,"ggd_pairs.csv"),"w",newline="",encoding="utf-8") as f:
    w=csv.writer(f); w.writerow(["verse","gaura_id","gaura_name_ru","krishna_lila_id","krishna_lila_name_ru","category","confidence","in_core"])
    for v,gs,gr,ks,kr,cat,conf in P:
        w.writerow([v,gs,gr,ks,kr,cat,conf,"yes" if gs in core_ids else "no"])

# collect entities + relations
ent={}   # id -> (name_ru, category, source_ref, confidence)
rel=[]   # (from,relation,to)
def add_ent(eid,ru,cat,verse,conf):
    if eid in core_ids: return
    ent.setdefault(eid,(ru,cat,f"ГГД {verse}",conf))

for v,gs,gr,ks,kr,cat,conf in P:
    add_ent(gs,gr,cat,v,conf)
    rel.append((gs,"gauranga-lila-identity",ks))

for v,gid,gname,members,cat in groups:
    add_ent(gid,gname,"krishna-lila|collective",v,"verified")
    for ms,mr in members:
        add_ent(ms,mr,cat,v,"review")
        rel.append((ms,"gauranga-lila-identity",gid))

# parampara guru->disciple edges
for i in range(len(parampara)-1):
    g_id,g_ru=parampara[i]; d_id,d_ru=parampara[i+1]
    add_ent(g_id,g_ru,"madhva-parampara",21,"review")
    add_ent(d_id,d_ru,"madhva-parampara",21,"review")
    rel.append((d_id,"disciple-of",g_id))

# 2) entities file (registry schema)
with open(os.path.join(base,"ggd_entities.csv"),"w",newline="",encoding="utf-8") as f:
    w=csv.writer(f)
    w.writerow(["id","type","tattva","category","name_en","name_iast","name_ru","aliases","note","source_ref","confidence"])
    for eid,(ru,cat,src,conf) in ent.items():
        w.writerow([eid,"personality","jiva-tattva",cat,"","",ru,"","",src,conf])

# 3) relations file
seen=set(); rows=[]
for a,r,b in rel:
    k=(a,r,b)
    if k in seen: continue
    seen.add(k); rows.append([a,r,b])
with open(os.path.join(base,"ggd_relations.csv"),"w",newline="",encoding="utf-8") as f:
    w=csv.writer(f); w.writerow(["from_id","relation","to_id"]); w.writerows(rows)

print("pairs:",len(P))
print("new entities (excl. core overlaps):",len(ent))
print("relations:",len(rows))
print("core overlaps among gaura ids:",sum(1 for p in P if p[1] in core_ids))
