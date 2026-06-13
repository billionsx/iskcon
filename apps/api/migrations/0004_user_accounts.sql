-- 0004_user_accounts.sql
-- Личный кабинет: учётные данные, сессии и активность преданного (закладки,
-- прогресс чтения, история прослушивания, настройки). Таблица users уже есть
-- (0001_init_core.sql) — здесь только добавочные таблицы, все CREATE ... IF NOT
-- EXISTS, поэтому файл идемпотентен и безопасно прогоняется на каждом деплое.
-- Зеркалирует ensureSchema() в apps/web/src/account/server.ts.

PRAGMA foreign_keys = ON;

-- Пароль/верификация (отдельно от users, чтобы не трогать схему франшизы).
-- Хэш: PBKDF2-HMAC-SHA256, формат «pbkdf2$<iters>$<salt_b64u>$<hash_b64u>».
CREATE TABLE IF NOT EXISTS user_auth (
  user_id        TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash  TEXT NOT NULL,
  algo           TEXT NOT NULL DEFAULT 'pbkdf2-sha256',
  email_verified INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Сессии. В БД лежит только SHA-256 от токена (cookie HttpOnly/Secure/Lax).
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  user_agent TEXT,
  ip         TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Закладки / избранное (главы, стихи, бхаджаны, личности, статьи, киртаны …).
CREATE TABLE IF NOT EXISTS bookmarks (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  ref        TEXT NOT NULL,
  title      TEXT,
  subtitle   TEXT,
  href       TEXT,
  cover      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, kind, ref)
);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id, created_at);

-- Прогресс чтения: строка на открытую главу/стих; «продолжить» = последняя по книге.
CREATE TABLE IF NOT EXISTS reading_progress (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work       TEXT NOT NULL,
  ref        TEXT NOT NULL,
  label      TEXT,
  kind       TEXT NOT NULL DEFAULT 'chapter',
  href       TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, work, ref)
);
CREATE INDEX IF NOT EXISTS idx_progress_user ON reading_progress(user_id, updated_at);

-- История прослушивания: строка на трек, апсертится с инкрементом play_count.
CREATE TABLE IF NOT EXISTS listening (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source       TEXT NOT NULL,
  ref          TEXT NOT NULL,
  title        TEXT,
  subtitle     TEXT,
  cover        TEXT,
  album        TEXT,
  artist       TEXT,
  href         TEXT,
  duration_sec INTEGER,
  position_sec INTEGER,
  play_count   INTEGER NOT NULL DEFAULT 1,
  first_at     TEXT NOT NULL DEFAULT (datetime('now')),
  last_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, source, ref)
);
CREATE INDEX IF NOT EXISTS idx_listening_user ON listening(user_id, last_at);

-- Настройки кабинета (на будущее: тема, язык …) — JSON.
CREATE TABLE IF NOT EXISTS user_prefs (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data       TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
