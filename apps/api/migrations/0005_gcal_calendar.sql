-- 0005_gcal_calendar.sql
-- Dated Vaisnava (Gaudiya) calendar produced by the GCAL / Gaurabda algorithm.
-- Source: gopa810/gaurabda-calendar (MIT) — Python port of GCAL by Gopalapriya das,
--         © ISKCON GBC Vaishnava Calendar Committee.
-- Location standard: Vrindavan (lat 27.583, lng 77.73, Asia/Kolkata).
-- Validated: output matches iskconvrindavan.com official temple calendar
--            (festival dates + parana times to the minute).
-- The existing `festivals` table holds rule-based definitions (lunar_rule); this
-- table holds dated, location-resolved instances, so it is kept separate.
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS gcal_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gcal_days (
  id                 TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  date               TEXT NOT NULL,                     -- ISO YYYY-MM-DD, sunrise-day at the location standard
  kind               TEXT NOT NULL CHECK (kind IN (
                        'ekadashi_fast','mahadvadasi_fast','ekadashi_paran',
                        'festival','appearance','disappearance','caturmasya','sankranti')),
  name_en            TEXT,                              -- canonical English name from GCAL
  name_i18n          TEXT NOT NULL DEFAULT '{}',        -- JSON {ru,en}; ru filled by the localization layer
  gaurabda_year      INTEGER,
  fast_code          INTEGER,                           -- GCAL fast type (e.g. 518 ekadasi, 519 mahadvadasi)
  mahadvadasi        INTEGER,                           -- GCAL mahadvadasi type code
  masa               INTEGER,
  tithi              INTEGER,
  naksatra           INTEGER,
  sunrise            TEXT,
  sunset             TEXT,
  paran_start        TEXT,                              -- HH:MM local time
  paran_end          TEXT,                              -- HH:MM local time
  paran_start_reason TEXT,
  paran_end_reason   TEXT,
  rasi               INTEGER,                           -- sankranti zodiac
  raw_text           TEXT,                              -- original GCAL event text
  source             TEXT NOT NULL DEFAULT 'gcal',
  location_std       TEXT NOT NULL DEFAULT 'vrindavan'
);

CREATE INDEX IF NOT EXISTS idx_gcal_days_date ON gcal_days(date);
CREATE INDEX IF NOT EXISTS idx_gcal_days_kind ON gcal_days(kind);
CREATE INDEX IF NOT EXISTS idx_gcal_days_year ON gcal_days(gaurabda_year);
