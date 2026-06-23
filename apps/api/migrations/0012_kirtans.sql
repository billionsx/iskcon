-- 0012_kirtans.sql — киртаны/бхаджаны в D1: альбом→исполнитель (FK), исполнитель→личность (FK на entities).
-- Источник: apps/web/src/kirtans.ts (KIRTAN_ARTISTS, KIRTAN_ALBUMS). См. docs/PASSPORT.md §B-2.
DROP TABLE IF EXISTS kirtan_albums;
DROP TABLE IF EXISTS kirtan_artists;
CREATE TABLE kirtan_artists (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  full TEXT,
  role TEXT,
  era TEXT,
  origin TEXT,
  bio TEXT,
  mono TEXT,
  accent INTEGER NOT NULL DEFAULT 0,
  entity_id TEXT REFERENCES entities(id),
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE kirtan_albums (
  id TEXT PRIMARY KEY,
  artist_slug TEXT NOT NULL REFERENCES kirtan_artists(slug),
  title TEXT NOT NULL,
  archive TEXT,
  year TEXT,
  type TEXT NOT NULL,
  moods TEXT,
  langs TEXT,
  composers TEXT,
  note TEXT,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_kirtan_albums_artist ON kirtan_albums(artist_slug);
CREATE INDEX idx_kirtan_artists_entity ON kirtan_artists(entity_id);
INSERT INTO kirtan_artists (slug,name,full,role,era,origin,bio,mono,accent,entity_id,sort) VALUES
('srila-prabhupada','Шрила Прабхупада','А.Ч. Бхактиведанта Свами Шрила Прабхупада','Ачарья-основатель ИСККОН','1896–1977','Калькутта · Вриндаван · весь мир','Принёс маха-мантру и киртан на Запад. Записал первые пластинки Харе Кришна — «Happening Album» (1966) и «Radha Krishna Temple» (1971) с Джорджем Харрисоном.','ШП',1,'prabhupada',0),
('aindra','Аиндра Прабху','Аиндра дас','Основатель круглосуточного киртана','1953–2010','Шри Вриндавана-дхама · Кришна-Баларам мандир','С 1986 года вёл непрерывный 24-часовой харинама-санкиртан в Кришна-Баларам мандире. Автор альбомов «Vrindavana Mellows» и «Vraja Vilas».','А',0,NULL,1),
('vaiyasaki','Вайясаки дас',NULL,'Киртания','совр.','Канада · Маяпур','Ученик Шрилы Прабхупады, один из самых любимых киртания ИСККОН. Известен альбомом «Sweet Chant of Love» и серией харинама-записей.','В',0,NULL,2),
('agnideva','Агнидева дас',NULL,'Киртания','совр.','США · Вриндаван','Классические мелодии киртана, бережно хранящие настроение ранних дней ИСККОН.','Аг',0,NULL,3),
('madhava','Мадхава Прабху',NULL,'Киртания','совр.','Маяпур-дхама','Один из ведущих голосов современного санкиртана, постоянный участник «Kirtan Mela» в Маяпуре.','М',0,NULL,4),
('bb-govinda-swami','Б.Б. Говинда Свами','Е.С. Бхакти Бринга Говинда Свами','Санньяси · киртания','совр.','США · Центральная Азия','Глубокий, медитативный киртан; вдохновитель множества преданных-музыкантов по всему миру.','ГС',0,NULL,5),
('indradyumna-swami','Индрадьюмна Свами','Е.С. Индрадьюмна Свами','Санньяси · киртания','совр.','Польский тур · Ратха-ятры мира','Громкий праздничный санкиртан фестивалей и Ратха-ятр на всех континентах.','ИС',0,'indradyumna-swami',6),
('sacinandana-swami','Сачинандана Свами','Е.С. Сачинандана Свами','Санньяси · киртания','совр.','Германия · Говардхана','Учитель медитации на святое имя; соединяет джапу, киртан и наставления о внутренней практике.','СС',0,'sacinandana-swami',7),
('badahari','Бадахари дас',NULL,'Киртания','совр.','США','Один из первых киртания-учеников Прабхупады; узнаваемый чистый голос ранних харинам.','Б',0,NULL,8),
('jahnavi-harrison','Джахнави Харрисон',NULL,'Киртания · скрипка','совр.','Бхактиведанта-мэнор · Лондон','Выросла в общине ИСККОН в Англии; соединяет киртан со скрипкой. Дебютный альбом — «Like a River to the Sea».','ДХ',0,NULL,9),
('gaura-vani','Гаура Вани','Гаура Вани Бучвальд','Киртания','совр.','Новый Вриндаван · США','Голос второго поколения преданных; ведёт группу «As Kindred Spirits», обновляя киртан для нового времени.','ГВ',0,NULL,10),
('various','Киртания ИСККОН',NULL,'Сборник','1966 — наши дни','Храмы и фестивали мира','Совместные записи разных киртания ИСККОН — киртаны и маха-мантра из храмов и фестивалей по всему свету.','♪',0,NULL,11);
INSERT INTO kirtan_albums (id,artist_slug,title,archive,year,type,moods,langs,composers,note,sort) VALUES
('sp-bhajans','srila-prabhupada','Бхаджаны с комментариями','SP-13-Bhajans-with-Purport',NULL,'bhajan','["vaishnava", "krishna", "gauranga"]','["bn", "sa"]','["bhaktivinoda", "narottama", "traditional"]','176 бхаджанов с пословным смыслом — «Амара дживана», «Анади карама пхале», «Бхаджа бхаката-ватсала»…',0),
('sp-japa-kirtan','srila-prabhupada','Джапа и киртан','sp-12-japa-and-kirtan_202012',NULL,'kirtan','["mahamantra"]','["sa"]','["traditional"]','Маха-мантра Харе Кришна — киртаны 1965–1977, включая запись в ашраме д-ра Мишры, и джапа.',1),
('best-harekrishna','various','Лучшие киртаны Харе Кришна','BestOfHareKrishnaKirtans',NULL,'kirtan','["mahamantra", "krishna"]','["sa"]','["traditional"]','Сборник: Вайясаки, Агнидева, Мадхава, Кришна Дас и другие голоса санкиртана.',2),
('vrindavana-mellows','aindra','Vrindavana Mellows',NULL,'2009','kirtan','["mahamantra", "radha-krishna"]','["sa"]','["traditional"]','Живые киртаны Кришна-Баларам мандира в настроении Враджа.',3),
('vraja-vilas','aindra','Vraja Vilas',NULL,NULL,'kirtan','["mahamantra", "radha-krishna"]','["sa"]','["traditional"]','Продолжение враджа-настроения круглосуточного киртана.',4),
('sweet-chant-of-love','vaiyasaki','Sweet Chant of Love',NULL,NULL,'kirtan','["mahamantra", "krishna"]','["sa", "bn"]','["traditional"]','Один из самых любимых альбомов киртана ИСККОН.',5),
('like-a-river','jahnavi-harrison','Like a River to the Sea',NULL,'2015','kirtan','["mahamantra", "krishna", "radha-krishna"]','["sa", "bn"]','["bhaktivinoda", "traditional"]','Киртан и молитвы со скрипкой; дебютный альбом.',6);
