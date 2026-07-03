-- 0020_push_notifications.sql
-- Ц3 «Уведомления»: web-push подписки + исходящие уведомления + конфиг VAPID.
-- Таблицы создаются лениво в воркере (ensurePushSchema, CREATE IF NOT EXISTS);
-- этот файл — для паритета и чистых установок.
--
-- Модель «tickle»: крон складывает намеченное в push_outbox и шлёт пустой
-- web-push (только VAPID-подпись); service worker дёргает /api/push/pending
-- и показывает. VAPID-ключи — в app_config (vapid_public/vapid_jwk/vapid_subject),
-- задаются отдельно (генерируются per-окружение).

CREATE TABLE IF NOT EXISTS app_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT,
  auth       TEXT,
  tz_offset  INTEGER NOT NULL DEFAULT 0,   -- минуты восточнее UTC (с клиента)
  cats       TEXT NOT NULL DEFAULT '{}',   -- JSON включённых категорий
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_push_sub_user ON push_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS push_outbox (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category   TEXT NOT NULL,                -- verse · ekadashi · festival · streak
  day        TEXT NOT NULL,                -- локальный YYYY-MM-DD (ключ дедупа)
  title      TEXT NOT NULL,
  body       TEXT,
  url        TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, category, day)
);
CREATE INDEX IF NOT EXISTS idx_push_outbox_user ON push_outbox(user_id, created_at);
