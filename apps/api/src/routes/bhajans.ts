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
    `SELECT slug, name, author_name, hero_image, category,
            EXISTS(SELECT 1 FROM prayer_media m WHERE m.slug = prayers.slug AND m.kind = 'recording') AS has_rec
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
    has_recordings: !!r.has_rec,
  }));
  return c.json({ bhajans });
});

// GET /v1/bhajans/catalog — каталог заполненных молитв, сгруппирован
bhajansRouter.get('/catalog', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT slug, name, author_name, source_text, category, section, ord
       FROM prayers
      WHERE is_section = 0 AND is_catalog = 0 AND length(COALESCE(text,'')) > 0
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
    has_text: true,
  }));
  return c.json({ items });
});

// GET /v1/bhajans/audio?slug=/ru/... — манифест записей бхаджана для глобального плеера
// (та же форма, что /books/:id/audio и /kirtans/:id/audio).
bhajansRouter.get('/audio', async (c) => {
  const slug = c.req.query('slug');
  if (!slug) return c.json({ error: { code: 'bad_request', message: 'slug required' } }, 400);

  const meta = (await c.env.DB.prepare(
    `SELECT name, author_name, hero_image FROM prayers WHERE slug = ?`,
  ).bind(slug).first()) as Row | null;

  const wantLectures = c.req.query('set') === 'lectures';

  const { results } = await c.env.DB.prepare(
    wantLectures
      ? `SELECT ord, title, subtitle, duration, url
           FROM prayer_media
          WHERE slug = ? AND kind = 'lecture' AND media_type = 'audio' AND url IS NOT NULL AND length(url) > 0
          ORDER BY ord`
      : `SELECT ord, title, subtitle, duration, url
           FROM prayer_media
          WHERE slug = ? AND kind = 'recording' AND url IS NOT NULL AND length(url) > 0
          ORDER BY ord`,
  ).bind(slug).all();

  const parseDur = (d: unknown): number | null => {
    const m = String(d ?? '').trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    return (m[1] ? parseInt(m[1], 10) : 0) * 3600 + parseInt(m[2], 10) * 60 + parseInt(m[3], 10);
  };

  const pfx = wantLectures ? 'lec' : 'rec';
  const noun = wantLectures ? 'Лекция' : 'Запись';
  const tracks = ((results as Row[]) ?? []).map((r, i) => ({
    kind: 'song' as const,
    pos: i,
    chapter: null,
    title: r.title || `${noun} ${i + 1}`,
    file: `${pfx}-${r.ord}`,
    url: r.url,
    durationSec: parseDur(r.duration),
    artist: r.subtitle ?? undefined,
  }));

  return c.json({
    book: slug,
    title: meta?.name ?? 'Бхаджан',
    cover: meta?.hero_image ?? '',
    artist: meta?.author_name ?? '',
    modes: { plain: { identifier: slug, tracks } },
  });
});

// GET /v1/bhajans/detail?slug=/ru/... — карточка (slug содержит слэши → query-param)
bhajansRouter.get('/detail', async (c) => {
  const slug = c.req.query('slug');
  if (!slug) return c.json({ error: { code: 'bad_request', message: 'slug required' } }, 400);

  const row = (await c.env.DB.prepare(
    `SELECT slug, name, author_name, hero_image, source_text, category, section,
            text, translit, translation, is_catalog, source_credit
       FROM prayers WHERE slug = ?`,
  )
    .bind(slug)
    .first()) as Row | null;
  if (!row) return c.json({ error: { code: 'not_found', message: 'bhajan not found' } }, 404);

  const { results: vrows } = await c.env.DB.prepare(
    `SELECT ord, verse_translit, verse_text, signature, word_by_word
       FROM prayer_verses WHERE slug = ? ORDER BY ord`,
  )
    .bind(slug)
    .all();
  const verses = ((vrows as Row[]) ?? []).map((v) => {
    let words: { t: string; m: string }[] = [];
    if (v.word_by_word) { try { words = JSON.parse(String(v.word_by_word)); } catch { words = []; } }
    return {
      ord: v.ord,
      translit: v.verse_translit ?? null,
      text: v.verse_text ?? null,
      signature: v.signature ?? null,
      words,
    };
  });

  const { results: mrows } = await c.env.DB.prepare(
    `SELECT kind, ord, title, subtitle, duration, url, media_type, platform, ext_id, description, date
       FROM prayer_media WHERE slug = ? ORDER BY kind, ord`,
  )
    .bind(slug)
    .all();
  const media = { recordings: [] as Row[], lectures: [] as Row[], scores: [] as Row[], commentaries: [] as Row[] };
  for (const m of (mrows as Row[]) ?? []) {
    const item = {
      title: m.title ?? null, subtitle: m.subtitle ?? null, duration: m.duration ?? null,
      url: m.url ?? null, media_type: m.media_type ?? null, platform: m.platform ?? null,
      ext_id: m.ext_id ?? null, description: m.description ?? null, date: m.date ?? null,
    };
    if (m.kind === 'recording') media.recordings.push(item as unknown as Row);
    else if (m.kind === 'lecture') media.lectures.push(item as unknown as Row);
    else if (m.kind === 'score') media.scores.push(item as unknown as Row);
    else if (m.kind === 'commentary') media.commentaries.push(item as unknown as Row);
  }

  const raw = String(row.text ?? '');
  const nl = raw.indexOf('\n');
  const body = (nl >= 0 ? raw.slice(nl + 1) : raw).trim(); // срезаем служебную первую строку
  const hasText = verses.length > 0 || body.length > 0 || !!(row.translit || row.translation);

  // Связь с графом: карточка ПКЛ автора (если личность с таким именем есть; алиасы учтены).
  let authorEntity: string | null = null;
  let authorEntityTitle: string | null = null;
  if (row.author_name) {
    const ae = (await c.env.DB.prepare(
      `SELECT n.entity_id AS id,
              (SELECT value FROM entity_names n2 WHERE n2.entity_id = n.entity_id AND n2.lang = 'ru'
                 ORDER BY (n2.kind = 'canonical') DESC LIMIT 1) AS title
         FROM entity_names n JOIN entities e ON e.id = n.entity_id
        WHERE e.type = 'personality' AND lower(n.value) = lower(?) LIMIT 1`,
    ).bind(row.author_name).first()) as Row | null;
    if (ae && ae.id) { authorEntity = String(ae.id); authorEntityTitle = ae.title ? String(ae.title) : null; }
  }

  return c.json({
    slug: row.slug,
    name: row.name,
    author: row.author_name ?? null,
    author_entity: authorEntity,
    author_entity_title: authorEntityTitle,
    hero_image: row.hero_image ?? null,
    source_text: row.source_text ?? null,
    category: row.category ?? null,
    section: row.section ?? null,
    source_credit: row.source_credit ?? null,
    verses,
    media,
    translit: row.translit ?? null,
    translation: row.translation ?? null,
    body,
    pending: !hasText, // каталожная запись без текста → карточка покажет «текст готовится»
  });
});
