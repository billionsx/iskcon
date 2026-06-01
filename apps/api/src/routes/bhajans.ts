import { Hono } from 'hono';
import type { Bindings, Variables } from '~/index';

/**
 * Бхаджаны (молитвенник) — витрина и карточка.
 * Источник: таблица D1 `prayers` (контент с iskcone.com владельца).
 * is_section=1 — страницы-разделы (скрыты в витрине). Поля translit/translation
 * заполняются структурным парсером; пока их нет — отдаём очищённый body.
 */
export const bhajansRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

type Row = Record<string, any>;

// GET /v1/bhajans — витрина (без страниц-разделов)
bhajansRouter.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT slug, name, author_name, hero_image
       FROM prayers
      WHERE is_section = 0
      ORDER BY (author_name IS NULL), length(text) ASC`,
  ).all();
  const bhajans = ((results as Row[]) ?? []).map((r) => ({
    slug: r.slug,
    name: r.name,
    author: r.author_name ?? null,
    hero_image: r.hero_image ?? null,
  }));
  return c.json({ bhajans });
});

// GET /v1/bhajans/detail?slug=/ru/... — карточка (slug содержит слэши → query-param)
bhajansRouter.get('/detail', async (c) => {
  const slug = c.req.query('slug');
  if (!slug) return c.json({ error: { code: 'bad_request', message: 'slug required' } }, 400);

  const row = (await c.env.DB.prepare(
    `SELECT slug, name, author_name, hero_image, text, translit, translation
       FROM prayers WHERE slug = ?`,
  )
    .bind(slug)
    .first()) as Row | null;
  if (!row) return c.json({ error: { code: 'not_found', message: 'bhajan not found' } }, 404);

  const raw = String(row.text ?? '');
  const nl = raw.indexOf('\n');
  const body = (nl >= 0 ? raw.slice(nl + 1) : raw).trim(); // срезаем служебную первую строку

  return c.json({
    slug: row.slug,
    name: row.name,
    author: row.author_name ?? null,
    hero_image: row.hero_image ?? null,
    translit: row.translit ?? null,
    translation: row.translation ?? null,
    body,
  });
});
