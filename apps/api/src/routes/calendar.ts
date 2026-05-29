import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { Bindings, Variables } from '~/index';
import { parseJson } from '~/lib/db';

export const calendarRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// GET /v1/calendar/festivals — глобальный календарь Вайшнавов
calendarRouter.get('/festivals', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, type, name_i18n, lunar_rule, description_i18n FROM festivals ORDER BY type',
  ).all();
  return c.json({
    items: (results as Record<string, any>[]).map((f) => ({
      ...f,
      name_i18n: parseJson(f.name_i18n, {}),
      description_i18n: parseJson(f.description_i18n, {}),
    })),
  });
});

// GET /v1/calendar/events?center=slug&from=ISO&to=ISO — локальные события
const evQuery = z.object({
  center: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

calendarRouter.get('/events', zValidator('query', evQuery), async (c) => {
  const q = c.req.valid('query');
  const where: string[] = [];
  const binds: unknown[] = [];
  if (q.center) {
    where.push('c.slug = ?');
    binds.push(q.center);
  }
  if (q.from) {
    where.push('e.starts_at >= ?');
    binds.push(q.from);
  }
  if (q.to) {
    where.push('e.starts_at <= ?');
    binds.push(q.to);
  }

  const sql =
    `SELECT e.id, e.title_i18n, e.description_i18n, e.starts_at, e.ends_at, e.images,
            e.livestream_url, c.slug AS center_slug, c.name AS center_name
     FROM center_events e JOIN centers c ON c.id = e.center_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY e.starts_at LIMIT ?`;
  const { results } = await c.env.DB.prepare(sql)
    .bind(...binds, q.limit)
    .all();

  return c.json({
    items: (results as Record<string, any>[]).map((e) => ({
      ...e,
      title_i18n: parseJson(e.title_i18n, {}),
      description_i18n: parseJson(e.description_i18n, {}),
      images: parseJson<string[]>(e.images, []),
    })),
  });
});
