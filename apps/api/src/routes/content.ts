import { Hono } from 'hono';
import type { Bindings, Variables } from '~/index';

/**
 * Контент iskcone.com (полный перенос сайта): статьи раздела dāsa,
 * личности (с цитатами), центры ИСККОН. Источник:
 *   content_items (мета: type/subtype/name/hero_image)
 *   page_text     (очищенный текст страницы)
 *   quotes        (цитаты личностей)
 * Карточная подача в стиле Apple — клиент рендерит из этих данных.
 */
export const contentRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

type Row = Record<string, any>;

// первая строка page_text — служебный заголовок («Имя. Раздел. …»); срезаем
function bodyOf(text: string | null | undefined): string {
  const raw = String(text ?? '');
  const nl = raw.indexOf('\n');
  return (nl >= 0 ? raw.slice(nl + 1) : raw).trim();
}

// GET /v1/content/articles — список статей dāsa
contentRouter.get('/articles', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT ci.slug, ci.name, ci.hero_image,
            length(COALESCE(pt.text,'')) AS tlen
       FROM content_items ci
       LEFT JOIN page_text pt ON pt.slug = ci.slug
      WHERE ci.type = 'article' AND ci.subtype = 'dasa' AND length(COALESCE(pt.text,'')) > 120
      ORDER BY tlen DESC`,
  ).all();
  const items = ((results as Row[]) ?? []).map((r) => ({
    slug: r.slug,
    name: r.name,
    hero_image: r.hero_image ?? null,
  }));
  return c.json({ items });
});

// GET /v1/content/personalities — список личностей (с числом цитат)
contentRouter.get('/personalities', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT ci.slug, ci.name, ci.subtype, ci.hero_image,
            (SELECT COUNT(*) FROM quotes q WHERE q.personality_slug = ci.slug) AS n_quotes,
            length(COALESCE(pt.text,'')) AS tlen
       FROM content_items ci
       LEFT JOIN page_text pt ON pt.slug = ci.slug
      WHERE ci.type = 'personality'
      ORDER BY (ci.subtype='bhagavan') DESC, (ci.subtype='avatar') DESC, n_quotes DESC, tlen DESC`,
  ).all();
  const SUB: Record<string, string> = {
    bhagavan: 'Верховный Господь',
    avatar: 'Аватара',
    associate: 'Спутник Господа',
  };
  const items = ((results as Row[]) ?? []).map((r) => ({
    slug: r.slug,
    name: r.name,
    kind: SUB[r.subtype as string] ?? null,
    hero_image: r.hero_image ?? null,
    n_quotes: r.n_quotes ?? 0,
  }));
  return c.json({ items });
});

// GET /v1/content/centers — список центров ИСККОН
contentRouter.get('/centers', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT ci.slug, ci.name, ci.hero_image
       FROM content_items ci
       LEFT JOIN page_text pt ON pt.slug = ci.slug
      WHERE ci.type = 'center' AND length(COALESCE(pt.text,'')) > 120
      ORDER BY length(COALESCE(pt.text,'')) DESC`,
  ).all();
  const items = ((results as Row[]) ?? []).map((r) => ({
    slug: r.slug,
    name: r.name,
    hero_image: r.hero_image ?? null,
  }));
  return c.json({ items });
});

// GET /v1/content/detail?slug=/... — единая карточка контента
contentRouter.get('/detail', async (c) => {
  const slug = c.req.query('slug');
  if (!slug) return c.json({ error: { code: 'bad_request', message: 'slug required' } }, 400);

  const ci = (await c.env.DB.prepare(
    `SELECT slug, name, type, subtype, hero_image FROM content_items WHERE slug = ?`,
  )
    .bind(slug)
    .first()) as Row | null;
  if (!ci) return c.json({ error: { code: 'not_found', message: 'content not found' } }, 404);

  const pt = (await c.env.DB.prepare(`SELECT text FROM page_text WHERE slug = ?`).bind(slug).first()) as Row | null;
  const body = bodyOf(pt?.text);
  // абзацы для рендера
  const paragraphs = body.split('\n').map((s) => s.trim()).filter((s) => s.length > 0);

  let quotes: { ord: number; text: string; source: string | null; speaker: string | null }[] = [];
  if (ci.type === 'personality') {
    const { results } = await c.env.DB.prepare(
      `SELECT ord, text, source, speaker FROM quotes WHERE personality_slug = ? ORDER BY (ord IS NULL), ord, id`,
    )
      .bind(slug)
      .all();
    quotes = ((results as Row[]) ?? []).map((q) => ({
      ord: q.ord ?? 0,
      text: q.text,
      source: q.source ?? null,
      speaker: q.speaker ?? null,
    }));
  }

  const SUB: Record<string, string> = {
    bhagavan: 'Верховный Господь',
    avatar: 'Аватара',
    associate: 'Спутник Господа',
    dasa: 'Заметки на полях сердца',
  };

  return c.json({
    slug: ci.slug,
    name: ci.name,
    type: ci.type,
    kind: SUB[ci.subtype as string] ?? null,
    hero_image: ci.hero_image ?? null,
    paragraphs,
    quotes,
  });
});
