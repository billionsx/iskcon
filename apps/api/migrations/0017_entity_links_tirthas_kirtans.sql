-- 0017_entity_links_tirthas_kirtans.sql — наполнение entity_links связями tirtha и kirtan.
-- Отдача FK: страница личности показывает святые места её лилы (tirtha → /dhama/<dhamaId>/<tirthaId>)
-- и киртаны-исполнители (kirtan → /kirtan/<slug>). EntityPage: маршруты добавлены в kindHref,
-- метка «Святые места» в KIND_LABEL. Источники истины: tirtha_persons+tirthas (0013), kirtan_artists (0012).
-- Идемпотентно: UNIQUE(entity_id,kind,ref) + INSERT OR IGNORE.
INSERT OR IGNORE INTO entity_links (entity_id, kind, ref, title, sort, dataset)
SELECT entity_id, 'kirtan', slug, name, sort, 'Киртаны · исполнитель'
FROM kirtan_artists WHERE entity_id IS NOT NULL;

INSERT OR IGNORE INTO entity_links (entity_id, kind, ref, title, sort, dataset)
SELECT tp.entity_id, 'tirtha', t.dhama_id || '/' || t.id, t.name, t.sort, 'Святые места · лила'
FROM tirtha_persons tp JOIN tirthas t ON t.id = tp.tirtha_id
WHERE tp.entity_id IS NOT NULL;
