-- 0015_shop.sql — каталог магазина в D1 + связь товар→книга (shop_products.book_id → book_catalog).
-- Источник: apps/web/src/shop/catalog.ts (CATALOG). См. docs/PASSPORT.md §B-5.
-- Обложки книжных товаров не хранятся (NULL): клиент берёт их из единого источника BOOKS по book_id.
DROP TABLE IF EXISTS shop_products;
DROP TABLE IF EXISTS shop_groups;
CREATE TABLE shop_groups (
  key TEXT PRIMARY KEY, title TEXT NOT NULL, note TEXT, sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE shop_products (
  id TEXT PRIMARY KEY,
  group_key TEXT NOT NULL REFERENCES shop_groups(key),
  kind TEXT NOT NULL, title TEXT NOT NULL, subtitle TEXT, price INTEGER NOT NULL,
  cover TEXT, weight_g INTEGER, emblem INTEGER,
  book_id TEXT REFERENCES book_catalog(id),
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_shop_products_group ON shop_products(group_key, sort);
CREATE INDEX idx_shop_products_book ON shop_products(book_id);

INSERT INTO shop_groups (key,title,note,sort) VALUES
('books','Книги Шрилы Прабхупады','Печатные издания BBT.',0),
('goods','Атрибуты для практики',NULL,1),
('digital','Цифровые материалы','Доступ открывается сразу после оплаты.',2);

INSERT INTO shop_products (id,group_key,kind,title,subtitle,price,cover,weight_g,emblem,book_id,sort) VALUES
('bk-bg','books','physical','Бхагавад-гита как она есть','Твёрдый переплёт · BBT',690,NULL,950,NULL,'bg',0),
('bk-sb','books','physical','Шримад-Бхагаватам','Том · твёрдый переплёт',890,NULL,1100,NULL,'sb',1),
('bk-cc','books','physical','Шри Чайтанья-чаритамрита','Том · твёрдый переплёт',990,NULL,1150,NULL,'cc',2),
('bk-brs','books','physical','Нектар преданности','Твёрдый переплёт · BBT',590,NULL,700,NULL,'brs',3),
('bk-iso','books','physical','Шри Ишопанишад','Мягкий переплёт · BBT',250,NULL,180,NULL,'iso',4),
('gd-mala','goods','physical','Джапа-мала из туласи','108 бусин · с сумочкой',1200,NULL,90,NULL,NULL,0),
('gd-incense','goods','physical','Благовония, набор','6 ароматов · натуральные',350,NULL,200,NULL,NULL,1),
('dg-audio-bg','digital','digital','Аудиокнига «Бхагавад-гита как она есть»','MP3 · полная начитка',390,NULL,NULL,NULL,'bg',0),
('dg-course','digital','digital','Курс «Бхакти-йога: основы»','12 видео-лекций',990,NULL,NULL,NULL,NULL,1);
