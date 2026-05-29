-- 0001_init_core.sql
-- Платформа ИСККОН — стартовая схема ядра франшизы (Cloudflare D1 / SQLite)
-- Конвенции:
--   - id: TEXT, по умолчанию случайный hex (lower(hex(randomblob(16))))
--   - i18n-поля хранятся как JSON-текст: {"en":"...","ru":"..."}; читать через json_extract()
--   - массивы (languages, days_of_week) — JSON-текст
--   - гео: lat/lng REAL; поиск по дистанции — формулой Haversine в SQL
--   - изоляция тенантов (RLS отсутствует в SQLite) обеспечивается в Worker:
--     middleware проверяет, что user админит данный center_id (см. center_admins)

PRAGMA foreign_keys = ON;

-- Пользователи (преданные и админы). Авторизация по JWT; таблицы Better Auth добавим позже.
CREATE TABLE IF NOT EXISTS users (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email            TEXT UNIQUE,
  name             TEXT,
  spiritual_name   TEXT,
  languages        TEXT NOT NULL DEFAULT '["en"]',
  home_center_id   TEXT,
  is_global_editor INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Центры = тенанты-франчайзи (храмы, рестораны, фермы, нама-хатты, проповеднические центры)
CREATE TABLE IF NOT EXISTS centers (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  type           TEXT NOT NULL DEFAULT 'temple'
                   CHECK (type IN ('temple','namahatta','restaurant','farm','preaching_center')),
  name           TEXT NOT NULL,
  slug           TEXT NOT NULL UNIQUE,
  parent_id      TEXT REFERENCES centers(id) ON DELETE SET NULL,
  gbc_zone       TEXT,
  country        TEXT,
  region         TEXT,
  city           TEXT,
  lat            REAL,
  lng            REAL,
  address        TEXT,
  timezone       TEXT,
  languages      TEXT NOT NULL DEFAULT '["en"]',
  phone          TEXT,
  whatsapp       TEXT,
  email          TEXT,
  website        TEXT,
  socials        TEXT,
  photos         TEXT NOT NULL DEFAULT '[]',
  status         TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','review','live')),
  claimed_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
  established_on TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_centers_geo ON centers(lat, lng);
CREATE INDEX IF NOT EXISTS idx_centers_country_city ON centers(country, city);
CREATE INDEX IF NOT EXISTS idx_centers_status ON centers(status);

-- Кто администрирует какой центр (контроль записи в Worker)
CREATE TABLE IF NOT EXISTS center_admins (
  center_id TEXT NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin','editor')),
  PRIMARY KEY (center_id, user_id)
);

-- Регулярные программы центра (мангала-арати, даршан, лекции, киртан, ...)
CREATE TABLE IF NOT EXISTS center_programs (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  center_id    TEXT NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  days_of_week TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
  start_time   TEXT,
  end_time     TEXT,
  notes_i18n   TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_programs_center ON center_programs(center_id);

-- Глобальный каталог божеств
CREATE TABLE IF NOT EXISTS deities (
  id               TEXT PRIMARY KEY,
  canonical_name   TEXT NOT NULL,
  description_i18n TEXT
);

-- Божества, установленные в центре (локальное), со ссылкой на глобальный каталог
CREATE TABLE IF NOT EXISTS center_deities (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  center_id       TEXT NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  deity_id        TEXT REFERENCES deities(id) ON DELETE SET NULL,
  local_name_i18n TEXT,
  installed_on    TEXT,
  darshan_times   TEXT,
  photos          TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_center_deities_center ON center_deities(center_id);

-- Глобальный календарь Вайшнавов
CREATE TABLE IF NOT EXISTS festivals (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  type             TEXT NOT NULL CHECK (type IN ('ekadashi','appearance','disappearance','festival')),
  name_i18n        TEXT NOT NULL,
  lunar_rule       TEXT,
  description_i18n TEXT
);

-- Локальные события (опционально привязаны к глобальному празднику)
CREATE TABLE IF NOT EXISTS center_events (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  center_id        TEXT NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  festival_id      TEXT REFERENCES festivals(id) ON DELETE SET NULL,
  title_i18n       TEXT NOT NULL,
  description_i18n TEXT,
  starts_at        TEXT NOT NULL,
  ends_at          TEXT,
  images           TEXT NOT NULL DEFAULT '[]',
  livestream_url   TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_center ON center_events(center_id);
CREATE INDEX IF NOT EXISTS idx_events_starts ON center_events(starts_at);
