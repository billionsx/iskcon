-- 0022_vows.sql
-- Ц6 «Обеты на сервер + совместные враты».
--   user_vows              — снимок личных обетов {active, archive} для кросс-
--                            устройства (источник правды — localStorage; LWW по
--                            updated_at, epoch-ms).
--   collective_vows        — курируемые совместные враты (сангха без ленты/чата).
--   collective_vow_members — участие и вклад (агрегат = SUM(amount)).
-- Таблицы создаются лениво в воркере (ensureVowsSchema); файл — для паритета.

CREATE TABLE IF NOT EXISTS user_vows (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  active     TEXT,
  archive    TEXT NOT NULL DEFAULT '[]',
  updated_at INTEGER NOT NULL DEFAULT 0,
  saved_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS collective_vows (
  id           TEXT PRIMARY KEY,
  slug         TEXT UNIQUE NOT NULL,
  title        TEXT NOT NULL,
  description  TEXT,
  unit         TEXT NOT NULL DEFAULT '',
  target_total INTEGER NOT NULL DEFAULT 0,
  ends_at      TEXT,
  active       INTEGER NOT NULL DEFAULT 1,
  sort         INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS collective_vow_members (
  vow_id    TEXT NOT NULL REFERENCES collective_vows(id) ON DELETE CASCADE,
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount    INTEGER NOT NULL DEFAULT 0,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (vow_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_cvow_members_vow ON collective_vow_members(vow_id);

INSERT INTO collective_vows(id, slug, title, description, unit, target_total, active, sort)
VALUES ('cv_japa', 'japa-together', 'Совместная джапа', 'Добавляйте круги святого имени в общую копилку сангхи — вместе идём к цели. Каждый круг вливается в океан памятования о Кришне.', 'кругов', 1008000, 1, 0)
ON CONFLICT(slug) DO NOTHING;
