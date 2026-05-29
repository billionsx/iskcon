import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { HTTPException } from 'hono/http-exception';
import type { Bindings, Variables } from '~/index';
import { parseJson } from '~/lib/db';
import { requireAuth, isCenterAdmin } from '~/middleware/auth';

export const centersRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const CENTER_TYPES = ['temple', 'namahatta', 'restaurant', 'farm', 'preaching_center'] as const;

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// --- GET /v1/centers — локатор центров (фильтры + опциональный гео-поиск) ----
const listQuery = z.object({
  country: z.string().length(2).optional(),
  city: z.string().optional(),
  type: z.enum(CENTER_TYPES).optional(),
  q: z.string().min(1).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius_km: z.coerce.number().min(1).max(20000).default(50),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

centersRouter.get('/', zValidator('query', listQuery), async (c) => {
  const q = c.req.valid('query');
  const where: string[] = ["status = 'live'"];
  const binds: unknown[] = [];

  if (q.country) {
    where.push('country = ?');
    binds.push(q.country.toUpperCase());
  }
  if (q.city) {
    where.push('city = ?');
    binds.push(q.city);
  }
  if (q.type) {
    where.push('type = ?');
    binds.push(q.type);
  }
  if (q.q) {
    where.push('name LIKE ?');
    binds.push('%' + q.q + '%');
  }

  // Гео: грубый прямоугольник по индексу idx_centers_geo; точная дистанция — в JS.
  const hasGeo = q.lat !== undefined && q.lng !== undefined;
  if (hasGeo) {
    const dLat = q.radius_km / 111;
    const dLng = q.radius_km / (111 * Math.max(Math.cos((q.lat! * Math.PI) / 180), 0.01));
    where.push('lat BETWEEN ? AND ?');
    binds.push(q.lat! - dLat, q.lat! + dLat);
    where.push('lng BETWEEN ? AND ?');
    binds.push(q.lng! - dLng, q.lng! + dLng);
  }

  const sql =
    `SELECT id, type, name, slug, country, region, city, lat, lng, address, timezone,
            languages, phone, whatsapp, email, website, photos
     FROM centers WHERE ${where.join(' AND ')} LIMIT ? OFFSET ?`;
  const { results } = await c.env.DB.prepare(sql)
    .bind(...binds, hasGeo ? 1000 : q.limit, hasGeo ? 0 : q.offset)
    .all();

  let items = (results as Record<string, any>[]).map((r) => ({
    ...r,
    languages: parseJson<string[]>(r.languages, []),
    photos: parseJson<string[]>(r.photos, []),
  }));

  if (hasGeo) {
    items = items
      .map((r) => ({
        ...r,
        distance_km: Math.round(haversineKm(q.lat!, q.lng!, r.lat, r.lng) * 10) / 10,
      }))
      .filter((r) => r.distance_km <= q.radius_km)
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(q.offset, q.offset + q.limit);
  }

  return c.json({ items, count: items.length });
});

// --- GET /v1/centers/:slug — профиль центра + программы + божества ----------
centersRouter.get('/:slug', async (c) => {
  const slug = c.req.param('slug');
  const center = await c.env.DB.prepare('SELECT * FROM centers WHERE slug = ? AND status = ?')
    .bind(slug, 'live')
    .first<Record<string, any>>();
  if (!center) throw new HTTPException(404, { message: 'center_not_found' });

  const [programs, deities] = await Promise.all([
    c.env.DB.prepare(
      `SELECT id, type, days_of_week, start_time, end_time, notes_i18n, sort_order
       FROM center_programs WHERE center_id = ? ORDER BY sort_order, start_time`,
    )
      .bind(center.id)
      .all(),
    c.env.DB.prepare(
      `SELECT cd.id, cd.local_name_i18n, cd.darshan_times, cd.photos,
              d.id AS deity_id, d.canonical_name
       FROM center_deities cd LEFT JOIN deities d ON d.id = cd.deity_id
       WHERE cd.center_id = ?`,
    )
      .bind(center.id)
      .all(),
  ]);

  return c.json({
    center: {
      ...center,
      languages: parseJson<string[]>(center.languages, []),
      photos: parseJson<string[]>(center.photos, []),
      socials: parseJson<Record<string, string>>(center.socials, {}),
    },
    programs: (programs.results as Record<string, any>[]).map((p) => ({
      ...p,
      days_of_week: parseJson<number[]>(p.days_of_week, []),
      notes_i18n: parseJson(p.notes_i18n, {}),
    })),
    deities: (deities.results as Record<string, any>[]).map((d) => ({
      ...d,
      local_name_i18n: parseJson(d.local_name_i18n, {}),
      darshan_times: parseJson(d.darshan_times, {}),
      photos: parseJson<string[]>(d.photos, []),
    })),
  });
});

// --- POST /v1/centers — создать центр (auth) → draft; автор становится админом
const createBody = z.object({
  type: z.enum(CENTER_TYPES).default('temple'),
  name: z.string().min(2),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  country: z.string().length(2).optional(),
  region: z.string().optional(),
  city: z.string().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  address: z.string().optional(),
  timezone: z.string().optional(),
  languages: z.array(z.string()).default(['en']),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
});

centersRouter.post('/', requireAuth, zValidator('json', createBody), async (c) => {
  const body = c.req.valid('json');
  const userId = c.get('userId')!;
  const id = crypto.randomUUID();

  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO centers
         (id, type, name, slug, country, region, city, lat, lng, address, timezone,
          languages, phone, whatsapp, email, website, status, claimed_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'draft', ?)`,
    ).bind(
      id,
      body.type,
      body.name,
      body.slug,
      body.country?.toUpperCase() ?? null,
      body.region ?? null,
      body.city ?? null,
      body.lat ?? null,
      body.lng ?? null,
      body.address ?? null,
      body.timezone ?? null,
      JSON.stringify(body.languages),
      body.phone ?? null,
      body.whatsapp ?? null,
      body.email ?? null,
      body.website ?? null,
      userId,
    ),
    c.env.DB.prepare('INSERT INTO center_admins (center_id, user_id, role) VALUES (?,?,?)').bind(
      id,
      userId,
      'admin',
    ),
  ]);

  return c.json({ id, slug: body.slug, status: 'draft' }, 201);
});

// --- PATCH /v1/centers/:id — обновить (auth + админ этого центра) ------------
const patchBody = createBody.partial().omit({ slug: true });

centersRouter.patch('/:id', requireAuth, zValidator('json', patchBody), async (c) => {
  const id = c.req.param('id');
  const userId = c.get('userId')!;
  if (!(await isCenterAdmin(c.env.DB, id, userId))) {
    throw new HTTPException(403, { message: 'forbidden' });
  }

  const body = c.req.valid('json');
  const fields: string[] = [];
  const binds: unknown[] = [];
  const set = (col: string, val: unknown) => {
    fields.push(`${col} = ?`);
    binds.push(val);
  };

  if (body.name !== undefined) set('name', body.name);
  if (body.type !== undefined) set('type', body.type);
  if (body.country !== undefined) set('country', body.country?.toUpperCase() ?? null);
  if (body.region !== undefined) set('region', body.region ?? null);
  if (body.city !== undefined) set('city', body.city ?? null);
  if (body.lat !== undefined) set('lat', body.lat ?? null);
  if (body.lng !== undefined) set('lng', body.lng ?? null);
  if (body.address !== undefined) set('address', body.address ?? null);
  if (body.timezone !== undefined) set('timezone', body.timezone ?? null);
  if (body.languages !== undefined) set('languages', JSON.stringify(body.languages));
  if (body.phone !== undefined) set('phone', body.phone ?? null);
  if (body.whatsapp !== undefined) set('whatsapp', body.whatsapp ?? null);
  if (body.email !== undefined) set('email', body.email ?? null);
  if (body.website !== undefined) set('website', body.website ?? null);

  if (fields.length === 0) return c.json({ id, updated: false });

  set('updated_at', new Date().toISOString());
  binds.push(id);

  await c.env.DB.prepare(`UPDATE centers SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...binds)
    .run();

  return c.json({ id, updated: true });
});
