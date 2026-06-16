-- 0008_notes.sql
-- «Заметки садху». Личные заметки преданного: услышал/прочитал/увидел ценное в
-- приложении → мгновенно сохранил. Источник правды на устройстве — localStorage
-- (работает офлайн и для гостя); эта таблица — зеркало для вошедшего пользователя
-- (кросс-устройство + синхронизация). Привязка к объекту (стих/книга/глава/киртан)
-- хранится в (kind, ref) тем же ключом, что и «Избранное»: 'verse:bg/2.13',
-- 'book:bg', 'chapter:sb/1.1', 'kirtan:<album>' и т.п. — чтобы заметки и избранное
-- ссылались на одну сущность.
--
-- created_at/updated_at — epoch-миллисекунды (INTEGER) с часов клиента: один и тот
-- же масштаб времени на устройстве и на сервере, поэтому слияние решает конфликт
-- детерминированно по правилу «новее побеждает» (last-write-wins) при синхронизации.
-- Идентификатор заметки генерит клиент (стабильный id), поэтому PK — TEXT без
-- автогенерации. Все CREATE ... IF NOT EXISTS — файл идемпотентен и безопасно
-- прогоняется на каждом деплое; зеркалирует ensureSchema() в
-- apps/web/src/account/server.ts один-в-один.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS notes (
  id           TEXT PRIMARY KEY,                       -- стабильный id с клиента
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT,                                   -- авто-заголовок (первая строка)
  body         TEXT,                                   -- санитизированный HTML тела
  plain        TEXT,                                   -- плоский текст (поиск/превью/шаринг)
  pinned       INTEGER NOT NULL DEFAULT 0,             -- закреплено (0/1)
  color        TEXT,                                   -- акцент заметки (опционально)
  -- Привязка к объекту приложения (как ключ «Избранного»): kind = тип, ref = полный
  -- ключ '<тип>:<id>'. NULL у свободной заметки без источника.
  kind         TEXT,
  ref          TEXT,
  src_title    TEXT,                                   -- снимок шапки источника
  src_subtitle TEXT,
  src_href     TEXT,                                   -- in-app путь к источнику
  created_at   INTEGER NOT NULL,                       -- epoch-ms (часы клиента)
  updated_at   INTEGER NOT NULL                        -- epoch-ms; ключ last-write-wins
);

-- Лента кабинета/хаба: заметки пользователя по свежести.
CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id, updated_at);
-- Заметки конкретного объекта (бейдж-счётчик в «Избранном», заметки стиха и т.п.).
CREATE INDEX IF NOT EXISTS idx_notes_ref ON notes(user_id, kind, ref);
