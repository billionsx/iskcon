-- 0010_search_fts.sql — полнотекстовый индекс стихов для сквозного поиска (/api/search).
-- Идемпотентно: создаёт FTS5-таблицу и перестраивает её из текущих стихов.
-- Токенайзер unicode61 + remove_diacritics 2 — регистр и кириллическая диакритика
-- (ӣ, ӯ, ш́, н̇, й→и…) складываются, так что «джанма карма» находит «джанма карма».
-- Тело индекса: транслитерация + увача + ref + перевод + комментарий.
-- Перестройка одним INSERT…SELECT (~4 c на ~38k строк); запускается на каждом
-- деплое API, поэтому индекс освежается после любой подгрузки канона.

CREATE VIRTUAL TABLE IF NOT EXISTS verse_fts USING fts5(
  verse_id UNINDEXED,
  body,
  tokenize = 'unicode61 remove_diacritics 2'
);

DELETE FROM verse_fts;

INSERT INTO verse_fts(verse_id, body)
SELECT v.id,
  COALESCE(v.translit,'') || ' ' || COALESCE(v.uvaca,'') || ' ' || COALESCE(v.ref,'') || ' ' ||
  COALESCE(vt.translation,'') || ' ' || COALESCE(vt.purport,'')
FROM verses v
LEFT JOIN verse_texts vt ON vt.verse_id = v.id;
