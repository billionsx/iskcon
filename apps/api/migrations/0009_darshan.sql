-- 0009_darshan.sql
-- «Даршан дня»: структурный слой для in-app модуля и архива + дедуп ежедневного ингеста.
-- Источник правды по контенту — канал @iskcone; эта таблица даёт приложению
-- редакторскую карточку/архив с датами и deep-link, независимо от сырого зеркала ленты.

CREATE TABLE IF NOT EXISTS darshan (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  date          TEXT NOT NULL,                 -- YYYY-MM-DD (день даршана, по IST)
  temple_slug   TEXT NOT NULL,                 -- mayapur | vrindavan | ...
  temple_name   TEXT NOT NULL,                 -- «ИСККОН Маяпур · Шри Дхама Маяпур»
  deities       TEXT,                          -- «Шри Шри Радха-Мадхава»
  src_channel   TEXT NOT NULL,                 -- исходный публичный t.me-канал храма
  src_post_id   TEXT NOT NULL,                 -- id поста-источника (для дедупа)
  images_json   TEXT NOT NULL DEFAULT '[]',    -- JSON-массив URL фото
  caption       TEXT,                          -- готовая подпись (HTML), как опубликована
  tg_message_id INTEGER,                        -- id опубликованного поста в @iskcone
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- дедуп: один и тот же исходный пост не заводим дважды
CREATE UNIQUE INDEX IF NOT EXISTS idx_darshan_src   ON darshan(src_channel, src_post_id);
-- лента архива по дате
CREATE INDEX IF NOT EXISTS        idx_darshan_date  ON darshan(date DESC);
-- даршаны конкретного храма по дате
CREATE INDEX IF NOT EXISTS        idx_darshan_temple ON darshan(temple_slug, date DESC);
