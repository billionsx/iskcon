-- 0006_japa.sql
-- Садхана · счётчик джапы. Строка на завершённый круг (108 бусин = 1 круг).
-- Источник правды на устройстве — localStorage (работает офлайн и для гостя);
-- эта таблица — зеркало для вошедшего пользователя (кросс-устройство + сводка
-- кабинета). Идемпотентность по client_id, чтобы повторная отправка одного и
-- того же круга не задваивала статистику. Все CREATE ... IF NOT EXISTS —
-- файл идемпотентен и безопасно прогоняется на каждом деплое; зеркалирует
-- ensureSchema() в apps/web/src/account/server.ts.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS japa_round (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Локальная дата завершения круга (YYYY-MM-DD) с устройства — ключ дневной
  -- агрегации без догадок о часовом поясе на сервере.
  day          TEXT NOT NULL,
  -- Момент завершения круга (UTC, ISO-усечённый) — для точной хронологии.
  at           TEXT NOT NULL DEFAULT (datetime('now')),
  -- Сколько бусин в круге (обычно 108) — позволяет считать имена (бусины × 16).
  beads        INTEGER NOT NULL DEFAULT 108,
  -- Длительность круга в секундах (если измерена) — для аналитики времени.
  duration_sec INTEGER,
  -- Стабильный идентификатор круга с клиента (<device>:<ts>) для идемпотентности.
  client_id    TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, client_id)
);
CREATE INDEX IF NOT EXISTS idx_japa_user_day ON japa_round(user_id, day);
