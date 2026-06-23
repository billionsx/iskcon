-- 0016_entity_links_dishes.sql — наполнение entity_links (kind='dish') из recipe_deities.
-- Отдача FK-работы: страница личности показывает ВСЕ блюда, что ей подносят, кликабельно
-- (EntityPage: dish → /prasadam/recipe/<slug>). Источник истины — recipe_deities (0014).
-- Идемпотентно: UNIQUE(entity_id,kind,ref) + INSERT OR IGNORE (курированные фавориты,
-- засеянные ранее с sort 0..N, не трогаются; новые идут с sort=100+r.sort — после них).
INSERT OR IGNORE INTO entity_links (entity_id, kind, ref, title, sort, dataset)
SELECT d.entity_id, 'dish', d.recipe_slug, r.title, 100 + r.sort, 'Прасад · любимые блюда'
FROM recipe_deities d JOIN recipes r ON r.slug = d.recipe_slug;
