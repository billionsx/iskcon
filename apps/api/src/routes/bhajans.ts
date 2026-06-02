import { Hono } from 'hono';
import type { Bindings, Variables } from '~/index';

/**
 * Бхаджаны (молитвенник) — витрина, каталог и карточка.
 * Источник: таблица D1 `prayers` (контент с iskcone.com владельца).
 *  - is_section=1  — страницы-разделы (скрыты).
 *  - is_catalog=1  — каталожная запись (метаданные есть, полного текста ещё нет).
 *  - translit/translation — слои, отделённые из HTML; иначе показываем cleaned body.
 */
export const bhajansRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

type Row = Record<string, any>;

// GET /v1/bhajans — витрина: только записи с реальным текстом (наполненные)
bhajansRouter.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT slug, name, author_name, hero_image, category
       FROM prayers
      WHERE is_section = 0 AND is_catalog = 0
      ORDER BY (author_name IS NULL), length(text) ASC`,
  ).all();
  const bhajans = ((results as Row[]) ?? []).map((r) => ({
    slug: r.slug,
    name: r.name,
    author: r.author_name ?? null,
    hero_image: r.hero_image ?? null,
    category: r.category ?? null,
  }));
  return c.json({ bhajans });
});

// GET /v1/bhajans/catalog — полный каталог (наполненные + каталожные), сгруппирован
bhajansRouter.get('/catalog', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT slug, name, author_name, source_text, category, section, ord,
            is_catalog,
            CASE WHEN length(COALESCE(text,'')) > 0 THEN 1 ELSE 0 END AS has_text
       FROM prayers
      WHERE is_section = 0
      ORDER BY (author_name IS NULL), author_name,
               (source_text IS NULL), source_text,
               (ord IS NULL), ord, name`,
  ).all();
  const items = ((results as Row[]) ?? []).map((r) => ({
    slug: r.slug,
    name: r.name,
    author: r.author_name ?? null,
    source_text: r.source_text ?? null,
    category: r.category ?? null,
    section: r.section ?? null,
    ord: r.ord ?? null,
    has_text: !!r.has_text,
  }));
  return c.json({ items });
});

// GET /v1/bhajans/detail?slug=/ru/... — карточка (slug содержит слэши → query-param)
bhajansRouter.get('/detail', async (c) => {
  const slug = c.req.query('slug');
  if (!slug) return c.json({ error: { code: 'bad_request', message: 'slug required' } }, 400);

  const row = (await c.env.DB.prepare(
    `SELECT slug, name, author_name, hero_image, source_text, category, section,
            text, translit, translation, is_catalog
       FROM prayers WHERE slug = ?`,
  )
    .bind(slug)
    .first()) as Row | null;
  if (!row) return c.json({ error: { code: 'not_found', message: 'bhajan not found' } }, 404);

  const raw = String(row.text ?? '');
  const nl = raw.indexOf('\n');
  const body = (nl >= 0 ? raw.slice(nl + 1) : raw).trim(); // срезаем служебную первую строку
  const hasText = body.length > 0 || !!(row.translit || row.translation);

  return c.json({
    slug: row.slug,
    name: row.name,
    author: row.author_name ?? null,
    hero_image: row.hero_image ?? null,
    source_text: row.source_text ?? null,
    category: row.category ?? null,
    section: row.section ?? null,
    translit: row.translit ?? null,
    translation: row.translation ?? null,
    body,
    pending: !hasText, // каталожная запись без текста → карточка покажет «текст готовится»
  });
});
