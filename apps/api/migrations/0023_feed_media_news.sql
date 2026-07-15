-- 0023_feed_media_news.sql
-- Лента Даршана как единый контент-хаб (ЗКН-Пл018 «одна лента, много линз»):
-- к живым постам Telegram-канала добавляются ДВА хранимых типа контента.
--
--   news_posts  — новости официальных агентств ИСККОН (iskconnews.org, iskcon.org,
--                 dandavats.com), переведённые на русский с BBT-точностью. Пишет
--                 парсер tools/news/iskcon_news.py; читает воркер /api/news.
--   feed_media  — автономные видео/аудио, перезалитые на archive.org (ролики
--                 @bhakti.school и т. п.), НЕ привязанные к посту канала. Пишет
--                 tools/video/bhakti_school.py; читает воркер /api/media.
--
-- guid — ключ дедупликации источника («in:123», «dv:456», «youtube:<vid>»):
-- повторный прогон парсера уже загруженное ПРОПУСКАЕТ (ЗКН-Пл006). slug у новостей
-- с префиксом источника, чтобы слаги двух сайтов не сталкивались.
--
-- Таблицы уже созданы в боевой D1 напрямую (MCP) — этот файл для ПАРИТЕТА и
-- воспроизводимости (пересоздание базы с нуля должно давать ту же схему).

CREATE TABLE IF NOT EXISTS news_posts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  guid         TEXT UNIQUE NOT NULL,                         -- <short>:<id> источника
  slug         TEXT UNIQUE NOT NULL,                         -- <short>-<slug>: адрес /darshan/news/<slug>
  source       TEXT NOT NULL DEFAULT 'iskconnews.org',       -- домен-источник
  source_label TEXT NOT NULL DEFAULT 'ISKCON News',          -- человекочитаемый ярлык
  url          TEXT NOT NULL,                                -- ссылка на оригинал (EN)
  published_at TEXT NOT NULL,                                -- ISO-дата публикации
  author       TEXT,
  hero         TEXT,                                         -- URL hero-изображения (сырой; фронт заворачивает в /api/img)
  category     TEXT,                                         -- русский ярлык рубрики
  title_ru     TEXT NOT NULL,
  title_en     TEXT,
  lead_ru      TEXT NOT NULL,                                -- короткий лид
  body_ru      TEXT NOT NULL,                                -- полное тело (перевод)
  body_en      TEXT,
  status       TEXT NOT NULL DEFAULT 'published',
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS feed_media (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  guid          TEXT UNIQUE NOT NULL,                        -- youtube:<vid> и т. п.
  kind          TEXT NOT NULL DEFAULT 'video',               -- video | audio
  source        TEXT NOT NULL,                               -- youtube.com …
  source_label  TEXT NOT NULL,                               -- «Школа Бхакти» …
  url           TEXT NOT NULL,                               -- оригинал (YouTube)
  stream_url    TEXT,                                        -- прямой mp4/аудио на archive.org
  ia_identifier TEXT,                                        -- идентификатор объекта IA
  thumb         TEXT,                                        -- превью (сырой URL)
  duration      TEXT,
  published_at  TEXT NOT NULL,
  author        TEXT,
  title_en      TEXT,
  title_ru      TEXT NOT NULL,
  summary_ru    TEXT,
  status        TEXT NOT NULL DEFAULT 'published',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Кейсет-пагинация ленты: свежие первыми, устойчиво к вставкам (ЗКН-Ф013 — без OFFSET).
CREATE INDEX IF NOT EXISTS idx_news_pub         ON news_posts (published_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_news_source_pub  ON news_posts (source, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_media_pub   ON feed_media (kind, published_at DESC, id DESC);
