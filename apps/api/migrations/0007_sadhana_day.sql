-- 0007_sadhana_day.sql
-- Дневник садханы: чтение/подъём/заметка на (преданный, день). Круги в этой
-- таблице НЕ хранятся — они берутся из japa_round (источник правды счётчика
-- джапы), чтобы метрика кругов была единственной. Стрики/статистика дневника
-- считаются над japa_round (круги) + sadhana_day (чтение/подъём). Цель кругов
-- (по умолчанию 16) — в user_prefs.data → ключ sadhanaGoal.
--
-- `day` — локальный день преданного «YYYY-MM-DD» (присылает клиент): воркер
-- исполняется в UTC, а граница суток у садханы локальная. Все CREATE ... IF NOT
-- EXISTS — файл идемпотентен; зеркалирует ensureSchema() в apps/web/src/account/server.ts.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sadhana_day (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day         TEXT NOT NULL,                 -- 'YYYY-MM-DD' (локальный день)
  reading_min INTEGER NOT NULL DEFAULT 0,    -- чтение, минут
  rose_at     TEXT,                          -- 'HH:MM' подъём (мангала-арати)
  note        TEXT,                          -- заметка дня
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, day)
);

CREATE INDEX IF NOT EXISTS idx_sadhana_day_user ON sadhana_day(user_id, day);
