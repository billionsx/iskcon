-- ISKCON entity registry — canonical schema (Cloudflare D1 / SQLite)
-- Single source of truth: stable id != display name; names are attributes.
-- Idempotent: drop + recreate the four registry tables only (no other tables touched).

DROP TABLE IF EXISTS entity_relations;
DROP TABLE IF EXISTS entity_categories;
DROP TABLE IF EXISTS entity_names;
DROP TABLE IF EXISTS entities;

CREATE TABLE entities (
  id          TEXT PRIMARY KEY,          -- stable slug, never changes
  type        TEXT NOT NULL,             -- personality | scripture | ...
  tattva      TEXT,                       -- vishnu|shakti|shiva|jiva-tattva
  note        TEXT,                       -- short definition
  source_ref  TEXT,                       -- scriptural / documentary source
  confidence  TEXT,                       -- verified | review
  iast_status TEXT,                       -- verified | review
  dataset     TEXT,                       -- provenance dataset
  status      TEXT NOT NULL DEFAULT 'published',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE entity_names (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  lang      TEXT NOT NULL,                -- ru | en | iast | alias
  value     TEXT NOT NULL,
  kind      TEXT NOT NULL DEFAULT 'canonical',  -- canonical | alias | epithet
  UNIQUE(entity_id, lang, value)
);

CREATE TABLE entity_categories (
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  category  TEXT NOT NULL,
  PRIMARY KEY (entity_id, category)
);

CREATE TABLE entity_relations (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  from_id  TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  relation TEXT NOT NULL,
  to_id    TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  UNIQUE(from_id, relation, to_id)
);

CREATE INDEX idx_entities_type    ON entities(type);
CREATE INDEX idx_entities_tattva  ON entities(tattva);
CREATE INDEX idx_entities_dataset ON entities(dataset);
CREATE INDEX idx_names_entity     ON entity_names(entity_id);
CREATE INDEX idx_names_value      ON entity_names(value);
CREATE INDEX idx_names_lang       ON entity_names(lang);
CREATE INDEX idx_cat_category     ON entity_categories(category);
CREATE INDEX idx_rel_from         ON entity_relations(from_id);
CREATE INDEX idx_rel_to           ON entity_relations(to_id);
CREATE INDEX idx_rel_relation     ON entity_relations(relation);
