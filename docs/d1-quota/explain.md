# Схема и планы запросов — 2026-08-25T09Z

## Схема katha_* (таблицы, индексы, триггеры)
```
[
  {
    "results": [
      {
        "type": "table",
        "name": "katha_speakers",
        "tbl_name": "katha_speakers",
        "sql": "CREATE TABLE katha_speakers (\n  slug TEXT PRIMARY KEY, name TEXT NOT NULL, full TEXT, role TEXT, era TEXT,\n  origin TEXT, bio TEXT, mono TEXT, accent INTEGER NOT NULL DEFAULT 0,\n  entity_id TEXT, sort INTEGER NOT NULL DEFAULT 0\n)"
      },
      {
        "type": "index",
        "name": "sqlite_autoindex_katha_speakers_1",
        "tbl_name": "katha_speakers",
        "sql": null
      },
      {
        "type": "table",
        "name": "katha_albums",
        "tbl_name": "katha_albums",
        "sql": "CREATE TABLE katha_albums (\n  id TEXT PRIMARY KEY, speaker_slug TEXT NOT NULL, title TEXT NOT NULL,\n  archive TEXT, year TEXT, note TEXT, sort INTEGER NOT NULL DEFAULT 0\n)"
      },
      {
        "type": "index",
        "name": "sqlite_autoindex_katha_albums_1",
        "tbl_name": "katha_albums",
        "sql": null
      },
      {
        "type": "table",
        "name": "katha_tracks",
        "tbl_name": "katha_tracks",
        "sql": "CREATE TABLE katha_tracks (\n  id TEXT PRIMARY KEY, speaker_slug TEXT NOT NULL, album_id TEXT NOT NULL,\n  identifier TEXT NOT NULL, file TEXT NOT NULL, title TEXT NOT NULL,\n  duration INTEGER, msg_id INTEGER, sort INTEGER NOT NULL DEFAULT 0,\n  created_at TEXT DEFAULT (datetime('now'))\n)"
      },
      {
        "type": "index",
        "name": "sqlite_autoindex_katha_tracks_1",
        "tbl_name": "katha_tracks",
        "sql": null
      },
      {
        "type": "table",
        "name": "katha_fts",
        "tbl_name": "katha_fts",
        "sql": "CREATE VIRTUAL TABLE katha_fts USING fts5(tid UNINDEXED, title, tokenize='unicode61')"
      },
      {
        "type": "table",
        "name": "katha_fts_data",
        "tbl_name": "katha_fts_data",
        "sql": "CREATE TABLE 'katha_fts_data'(id INTEGER PRIMARY KEY, block BLOB)"
      },
      {
        "type": "table",
        "name": "katha_fts_idx",
        "tbl_name": "katha_fts_idx",
        "sql": "CREATE TABLE 'katha_fts_idx'(segid, term, pgno, PRIMARY KEY(segid, term)) WITHOUT ROWID"
      },
      {
        "type": "table",
        "name": "katha_fts_content",
        "tbl_name": "katha_fts_content",
        "sql": "CREATE TABLE 'katha_fts_content'(id INTEGER PRIMARY KEY, c0, c1)"
      },
      {
        "type": "table",
        "name": "katha_fts_docsize",
        "tbl_name": "katha_fts_docsize",
        "sql": "CREATE TABLE 'katha_fts_docsize'(id INTEGER PRIMARY KEY, sz BLOB)"
      },
      {
        "type": "table",
        "name": "katha_fts_config",
        "tbl_name": "katha_fts_config",
        "sql": "CREATE TABLE 'katha_fts_config'(k PRIMARY KEY, v) WITHOUT ROWID"
      },
      {
        "type": "trigger",
        "name": "katha_fts_ai",
        "tbl_name": "katha_tracks",
        "sql": "CREATE TRIGGER katha_fts_ai AFTER INSERT ON katha_tracks BEGIN INSERT INTO katha_fts(tid,title) VALUES (new.id,new.title); END"
      },
      {
        "type": "trigger",
        "name": "katha_fts_ad",
        "tbl_name": "katha_tracks",
        "sql": "CREATE TRIGGER katha_fts_ad AFTER DELETE ON katha_tracks BEGIN DELETE FROM katha_fts WHERE tid=old.id; END"
      },
      {
        "type": "trigger",
        "name": "katha_fts_au",
        "tbl_name": "katha_tracks",
        "sql": "CREATE TRIGGER katha_fts_au AFTER UPDATE OF title ON katha_tracks BEGIN DELETE FROM katha_fts WHERE tid=old.id; INSERT INTO katha_fts(tid,title) VALUES (new.id,new.title); END"
      }
    ],
    "success": true,
    "meta": {
      "served_by": "v3-prod",
      "served_by_region": "WEUR",
      "served_by_colo": "AMS",
      "served_by_primary": true,
      "timings": {
        "sql_duration_ms": 0.2141
      },
      "duration": 0.2141,
      "changes": 0,
      "last_row_id": 0,
      "changed_db": false,
      "size_after": 386949120,
      "rows_read": 263,
      "rows_written": 0,
      "total_attempts": 1
    }
  }
]
```

## Размеры участников
```
[
  {
    "results": [
      {
        "t": "katha_tracks",
        "n": 6908
      },
      {
        "t": "katha_albums",
        "n": 326
      }
    ],
    "success": true,
    "meta": {
      "served_by": "v3-prod",
      "served_by_region": "WEUR",
      "served_by_colo": "AMS",
      "served_by_primary": true,
      "timings": {
        "sql_duration_ms": 8.6862
      },
      "duration": 8.6862,
      "changes": 0,
      "last_row_id": 0,
      "changed_db": false,
      "size_after": 386949120,
      "rows_read": 7234,
      "rows_written": 0,
      "total_attempts": 1
    }
  }
]
```

## Внешние ключи katha_tracks
```
[
  {
    "results": [],
    "success": true,
    "meta": {
      "served_by": "v3-prod",
      "served_by_region": "WEUR",
      "served_by_colo": "AMS",
      "served_by_primary": true,
      "timings": {
        "sql_duration_ms": 0.1148
      },
      "duration": 0.1148,
      "changes": 0,
      "last_row_id": 0,
      "changed_db": false,
      "size_after": 386949120,
      "rows_read": 0,
      "rows_written": 0,
      "total_attempts": 1
    }
  }
]
```

## Индексы katha_tracks
```
[
  {
    "results": [
      {
        "seq": 0,
        "name": "sqlite_autoindex_katha_tracks_1",
        "unique": 1,
        "origin": "pk",
        "partial": 0
      }
    ],
    "success": true,
    "meta": {
      "served_by": "v3-prod",
      "served_by_region": "WEUR",
      "served_by_colo": "AMS",
      "served_by_primary": true,
      "timings": {
        "sql_duration_ms": 0.173
      },
      "duration": 0.173,
      "changes": 0,
      "last_row_id": 0,
      "changed_db": false,
      "size_after": 386949120,
      "rows_read": 0,
      "rows_written": 0,
      "total_attempts": 1
    }
  }
]
```

## ПЛАН · INSERT ... ON CONFLICT(id) DO UPDATE (главный пожиратель, 98.7% чтений)
```
[
  {
    "results": [],
    "success": true,
    "meta": {
      "served_by": "v3-prod",
      "served_by_region": "WEUR",
      "served_by_colo": "AMS",
      "served_by_primary": true,
      "timings": {
        "sql_duration_ms": 0.2914
      },
      "duration": 0.2914,
      "changes": 0,
      "last_row_id": 0,
      "changed_db": false,
      "size_after": 386949120,
      "rows_read": 0,
      "rows_written": 0,
      "total_attempts": 1
    }
  }
]
```

## ПЛАН · опора ingest на базу (d1_known)
```
[
  {
    "results": [
      {
        "id": 3,
        "parent": 0,
        "notused": 216,
        "detail": "SCAN t"
      },
      {
        "id": 7,
        "parent": 0,
        "notused": 44,
        "detail": "SEARCH b USING COVERING INDEX sqlite_autoindex_katha_albums_1 (id=?)"
      }
    ],
    "success": true,
    "meta": {
      "served_by": "v3-prod",
      "served_by_region": "WEUR",
      "served_by_colo": "AMS",
      "served_by_primary": true,
      "timings": {
        "sql_duration_ms": 0.1735
      },
      "duration": 0.1735,
      "changes": 0,
      "last_row_id": 0,
      "changed_db": false,
      "size_after": 386949120,
      "rows_read": 0,
      "rows_written": 0,
      "total_attempts": 1
    }
  }
]
```

## ПЛАН · COUNT(*) katha_tracks
```
[
  {
    "results": [
      {
        "id": 4,
        "parent": 0,
        "notused": 0,
        "detail": "SCAN katha_tracks USING COVERING INDEX sqlite_autoindex_katha_tracks_1"
      }
    ],
    "success": true,
    "meta": {
      "served_by": "v3-prod",
      "served_by_region": "WEUR",
      "served_by_colo": "AMS",
      "served_by_primary": true,
      "timings": {
        "sql_duration_ms": 0.1922
      },
      "duration": 0.1922,
      "changes": 0,
      "last_row_id": 0,
      "changed_db": false,
      "size_after": 386949120,
      "rows_read": 0,
      "rows_written": 0,
      "total_attempts": 1
    }
  }
]
```

## Схема verse_tokens / tilda_assets (полные выборки без WHERE)
```
[
  {
    "results": [
      {
        "type": "table",
        "name": "tilda_assets",
        "tbl_name": "tilda_assets"
      },
      {
        "type": "index",
        "name": "idx_tilda_assets_page",
        "tbl_name": "tilda_assets"
      },
      {
        "type": "table",
        "name": "verses",
        "tbl_name": "verses"
      },
      {
        "type": "index",
        "name": "sqlite_autoindex_verses_1",
        "tbl_name": "verses"
      },
      {
        "type": "index",
        "name": "sqlite_autoindex_verses_2",
        "tbl_name": "verses"
      },
      {
        "type": "table",
        "name": "verse_texts",
        "tbl_name": "verse_texts"
      },
      {
        "type": "index",
        "name": "sqlite_autoindex_verse_texts_1",
        "tbl_name": "verse_texts"
      },
      {
        "type": "table",
        "name": "verse_tokens",
        "tbl_name": "verse_tokens"
      },
      {
        "type": "index",
        "name": "idx_verse_work",
        "tbl_name": "verses"
      },
      {
        "type": "index",
        "name": "idx_vtext_verse",
        "tbl_name": "verse_texts"
      },
      {
        "type": "index",
        "name": "idx_tok_verse",
        "tbl_name": "verse_tokens"
      },
      {
        "type": "index",
        "name": "idx_tok_lemma",
        "tbl_name": "verse_tokens"
      },
      {
        "type": "index",
        "name": "idx_tok_entity",
        "tbl_name": "verse_tokens"
      },
      {
        "type": "trigger",
        "name": "trg_verses_strip_ins",
        "tbl_name": "verses"
      },
      {
        "type": "trigger",
        "name": "trg_verses_strip_upd",
        "tbl_name": "verses"
      },
      {
        "type": "trigger",
        "name": "trg_verse_texts_strip_ins",
        "tbl_name": "verse_texts"
      },
      {
        "type": "trigger",
        "name": "trg_verse_texts_strip_upd",
        "tbl_name": "verse_texts"
      },
      {
        "type": "trigger",
        "name": "trg_verse_tokens_strip_ins",
        "tbl_name": "verse_tokens"
      },
      {
        "type": "trigger",
        "name": "trg_verse_tokens_strip_upd",
        "tbl_name": "verse_tokens"
      },
      {
        "type": "index",
        "name": "idx_verses_division",
        "tbl_name": "verses"
      },
      {
        "type": "index",
        "name": "idx_verse_texts_verse",
        "tbl_name": "verse_texts"
      }
    ],
    "success": true,
    "meta": {
      "served_by": "v3-prod",
      "served_by_region": "WEUR",
      "served_by_colo": "AMS",
      "served_by_primary": true,
      "timings": {
        "sql_duration_ms": 0.3449
      },
      "duration": 0.3449,
      "changes": 0,
      "last_row_id": 0,
      "changed_db": false,
      "size_after": 386949120,
      "rows_read": 263,
      "rows_written": 0,
      "total_attempts": 1
    }
  }
]
```

