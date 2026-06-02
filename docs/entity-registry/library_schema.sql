-- library_schema.sql — книжный слой (Cloudflare D1), поверх реестра сущностей.
-- Недеструктивно: CREATE IF NOT EXISTS (не сбрасывается при перезагрузке реестра).
-- works.id == entities.id книги (единый источник правды); token.entity_id -> entities.id.

CREATE TABLE IF NOT EXISTS works (
  id           TEXT PRIMARY KEY,        -- = entities.id ('sb','bg','iso',...)
  kind         TEXT,                     -- scripture|commentary|biography|songbook
  author_id    TEXT,                     -- entities.id автора
  abbrev       TEXT,                     -- 'SB','BG','ISO'
  verse_scheme TEXT,                     -- 'canto.chapter.verse'|'chapter.verse'|'mantra'
  cover_url    TEXT,
  meta         TEXT,                     -- JSON
  sort         INTEGER
);

CREATE TABLE IF NOT EXISTS editions (
  id        TEXT PRIMARY KEY,
  work_id   TEXT NOT NULL,
  lang      TEXT NOT NULL,               -- 'sa','en','ru'
  title     TEXT,
  translator TEXT,
  source    TEXT,                         -- 'vedabase.io'|'BBT'|'public'
  license   TEXT,                         -- 'public-domain'|'BBT-licensed'|'pending'
  source_url TEXT
);

CREATE TABLE IF NOT EXISTS divisions (
  id       TEXT PRIMARY KEY,             -- 'sb.1','sb.1.9','bg.2'
  work_id  TEXT NOT NULL,
  parent_id TEXT,
  level    TEXT,                          -- 'canto'|'chapter'|'section'
  number   TEXT,
  title    TEXT,                          -- JSON i18n
  ordinal  INTEGER
);

CREATE TABLE IF NOT EXISTS verses (
  id         TEXT PRIMARY KEY,           -- 'sb.1.9.40' = deeplink/QR target
  work_id    TEXT NOT NULL,
  division_id TEXT,
  ref        TEXT NOT NULL,              -- display ref 'СБ 1.9.40'
  ordinal    INTEGER,
  devanagari TEXT,
  translit   TEXT,
  uvaca      TEXT,
  UNIQUE(work_id, ref)
);

CREATE TABLE IF NOT EXISTS verse_texts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  verse_id   TEXT NOT NULL,
  edition_id TEXT NOT NULL,
  translation TEXT,
  purport    TEXT,
  UNIQUE(verse_id, edition_id)
);

CREATE TABLE IF NOT EXISTS verse_tokens (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  verse_id  TEXT NOT NULL,
  ordinal   INTEGER,
  term      TEXT NOT NULL,               -- IAST как в пословном
  lemma     TEXT,                         -- нормализованная форма
  gloss     TEXT,                         -- значение (RU)
  entity_id TEXT                          -- -> entities.id (если слово именует личность)
);

CREATE TABLE IF NOT EXISTS lemmas (
  lemma       TEXT PRIMARY KEY,
  iast        TEXT,
  devanagari  TEXT,
  gloss       TEXT,
  entity_id   TEXT,
  occurrences INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_favorites (
  user_id     TEXT NOT NULL,
  target_type TEXT NOT NULL,             -- 'work'|'division'|'verse'
  target_id   TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, target_type, target_id)
);

CREATE TABLE IF NOT EXISTS book_orders (
  id         TEXT PRIMARY KEY,
  user_id    TEXT,
  work_id    TEXT,
  format     TEXT,                         -- 'hardcover'|'paperback'|'set'
  qty        INTEGER DEFAULT 1,
  status     TEXT NOT NULL DEFAULT 'created',
  address    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_div_work    ON divisions(work_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_verse_work  ON verses(work_id, ordinal);
CREATE INDEX IF NOT EXISTS idx_vtext_verse ON verse_texts(verse_id);
CREATE INDEX IF NOT EXISTS idx_tok_verse   ON verse_tokens(verse_id, ordinal);
CREATE INDEX IF NOT EXISTS idx_tok_lemma   ON verse_tokens(lemma);
CREATE INDEX IF NOT EXISTS idx_tok_entity  ON verse_tokens(entity_id);
CREATE INDEX IF NOT EXISTS idx_fav_user    ON user_favorites(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Нормализация заголовков секций (см. migrations/0002_strip_section_labels.sql).
-- Срезает ведущую метку секции при записи из любого источника (CRM, GH Actions,
-- ручной импорт). Идемпотентно; чистые строки не трогает.
--   verses.devanagari → «Деванагари» · verses.translit/uvaca → «Текст стиха»
--   verse_texts.translation → «Перевод» · verse_texts.purport → «Комментарий»
--   verse_tokens.term → «Пословный перевод»
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_verses_strip_ins;
CREATE TRIGGER trg_verses_strip_ins AFTER INSERT ON verses
WHEN NEW.devanagari LIKE 'Деванагари%' OR NEW.translit LIKE 'Текст стиха%' OR NEW.uvaca LIKE 'Текст стиха%'
BEGIN
  UPDATE verses SET
    devanagari = CASE WHEN devanagari LIKE 'Деванагари%'  THEN SUBSTR(devanagari, LENGTH('Деванагари')+1)  ELSE devanagari END,
    translit   = CASE WHEN translit   LIKE 'Текст стиха%' THEN SUBSTR(translit,   LENGTH('Текст стиха')+1) ELSE translit   END,
    uvaca      = CASE WHEN uvaca       LIKE 'Текст стиха%' THEN SUBSTR(uvaca,      LENGTH('Текст стиха')+1) ELSE uvaca      END
  WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS trg_verses_strip_upd;
CREATE TRIGGER trg_verses_strip_upd AFTER UPDATE ON verses
WHEN NEW.devanagari LIKE 'Деванагари%' OR NEW.translit LIKE 'Текст стиха%' OR NEW.uvaca LIKE 'Текст стиха%'
BEGIN
  UPDATE verses SET
    devanagari = CASE WHEN devanagari LIKE 'Деванагари%'  THEN SUBSTR(devanagari, LENGTH('Деванагари')+1)  ELSE devanagari END,
    translit   = CASE WHEN translit   LIKE 'Текст стиха%' THEN SUBSTR(translit,   LENGTH('Текст стиха')+1) ELSE translit   END,
    uvaca      = CASE WHEN uvaca       LIKE 'Текст стиха%' THEN SUBSTR(uvaca,      LENGTH('Текст стиха')+1) ELSE uvaca      END
  WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS trg_verse_texts_strip_ins;
CREATE TRIGGER trg_verse_texts_strip_ins AFTER INSERT ON verse_texts
WHEN NEW.translation LIKE 'Перевод%' OR NEW.purport LIKE 'Комментарий%'
BEGIN
  UPDATE verse_texts SET
    translation = CASE WHEN translation LIKE 'Перевод%'     THEN SUBSTR(translation, LENGTH('Перевод')+1)     ELSE translation END,
    purport     = CASE WHEN purport     LIKE 'Комментарий%' THEN SUBSTR(purport,     LENGTH('Комментарий')+1) ELSE purport     END
  WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS trg_verse_texts_strip_upd;
CREATE TRIGGER trg_verse_texts_strip_upd AFTER UPDATE ON verse_texts
WHEN NEW.translation LIKE 'Перевод%' OR NEW.purport LIKE 'Комментарий%'
BEGIN
  UPDATE verse_texts SET
    translation = CASE WHEN translation LIKE 'Перевод%'     THEN SUBSTR(translation, LENGTH('Перевод')+1)     ELSE translation END,
    purport     = CASE WHEN purport     LIKE 'Комментарий%' THEN SUBSTR(purport,     LENGTH('Комментарий')+1) ELSE purport     END
  WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS trg_verse_tokens_strip_ins;
CREATE TRIGGER trg_verse_tokens_strip_ins AFTER INSERT ON verse_tokens
WHEN NEW.term LIKE 'Пословный перевод%'
BEGIN
  UPDATE verse_tokens SET term = SUBSTR(term, LENGTH('Пословный перевод')+1) WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS trg_verse_tokens_strip_upd;
CREATE TRIGGER trg_verse_tokens_strip_upd AFTER UPDATE ON verse_tokens
WHEN NEW.term LIKE 'Пословный перевод%'
BEGIN
  UPDATE verse_tokens SET term = SUBSTR(term, LENGTH('Пословный перевод')+1) WHERE id = NEW.id;
END;
