-- 0018_vraja_ingest.sql — слой ингеста святых мест Враджа из vrajapedia.com
-- (онлайн-энциклопедия Вриндавана команды «Шри Рупа Сева Кундж», с разрешения
-- правообладателя). Расширяет tirthas медиа и структурированными источниками,
-- добавляет staging-таблицу сырого обхода. Применено на проде через MCP —
-- здесь продублировано для воспроизводимости свежей БД. См. docs/PASSPORT.md.

ALTER TABLE tirthas ADD COLUMN hero_image TEXT;      -- URL hero-фото (рехост archive.org)
ALTER TABLE tirthas ADD COLUMN gallery TEXT;         -- JSON [] доп. фото
ALTER TABLE tirthas ADD COLUMN sources_json TEXT;    -- JSON [{author,book,paragraphs[],footnotes[]}]
ALTER TABLE tirthas ADD COLUMN vp_id INTEGER;        -- vrajapedia post id (ключ синхронизации)
ALTER TABLE tirthas ADD COLUMN vp_slug TEXT;
ALTER TABLE tirthas ADD COLUMN vp_link TEXT;         -- канонический URL источника (атрибуция)
ALTER TABLE tirthas ADD COLUMN vp_modified TEXT;     -- дата правки источника (инкрементальная синхронизация)

CREATE TABLE IF NOT EXISTS vraja_raw (
  vp_id        INTEGER PRIMARY KEY,
  slug         TEXT,
  title        TEXT,
  region_cats  TEXT,      -- JSON [] id категорий-районов
  primary_cat  INTEGER,   -- приоритетный гео-район
  link         TEXT,
  modified     TEXT,
  excerpt      TEXT,
  featured_url TEXT,
  gallery      TEXT,      -- JSON []
  content_html TEXT,      -- сырой content.rendered (для повторного парса)
  sources_json TEXT,      -- разобранные источники
  about        TEXT,      -- вводный абзац (превью)
  text_plain   TEXT,
  kind_guess   TEXT,
  crawled_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_vraja_raw_slug ON vraja_raw(slug);
