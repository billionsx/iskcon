import { Hono } from 'hono';
import type { Bindings, Variables } from '~/index';

/**
 * Книги (писания) — оглавление, стихи главы и полный стих со «слоями».
 * Схема D1: works → divisions (иерархия) → verses → verse_texts / verse_tokens.
 * Перевод и комментарий берутся из издания <work>-ru (с фолбэком на любое
 * издание, где есть контент). Спайн (prev/next) — по композиту
 * divisions.ordinal + verses.ordinal, что даёт сквозной порядок чтения.
 */
export const booksRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

type Row = Record<string, any>;

// GET /v1/books/:work/chapters — оглавление (разделы верхнего уровня книги)
booksRouter.get('/:work/chapters', async (c) => {
  const work = c.req.param('work');
  const { results } = await c.env.DB.prepare(
    `SELECT d.id, d.number,
            json_extract(d.title,'$.ru') AS title_ru,
            json_extract(d.title,'$.en') AS title_en,
            d.source_url,
            (SELECT COUNT(*) FROM verses v WHERE v.division_id = d.id) AS verses
     FROM divisions d
     WHERE d.work_id = ?
     ORDER BY CAST(d.number AS INTEGER)`,
  )
    .bind(work)
    .all();

  const chapters = (results as Row[]).map((r) => ({
    id: r.id,
    number: String(r.number),
    title_ru: r.title_ru ?? '',
    title_en: r.title_en ?? '',
    source_url: r.source_url ?? '',
    verses: Number(r.verses ?? 0),
  }));
  return c.json({ chapters });
});

// GET /v1/books/:work/chapters/:number/verses — список стихов главы (для оглавления)
booksRouter.get('/:work/chapters/:number/verses', async (c) => {
  const work = c.req.param('work');
  const number = c.req.param('number');
  const { results } = await c.env.DB.prepare(
    `SELECT v.ref, v.source_url, v.devanagari, v.translit,
            EXISTS(
              SELECT 1 FROM verse_texts t
              WHERE t.verse_id = v.id AND COALESCE(t.translation,'') <> ''
            ) AS has_text
     FROM verses v
     JOIN divisions d ON d.id = v.division_id
     WHERE v.work_id = ? AND d.number = ?
     ORDER BY v.ordinal`,
  )
    .bind(work, number)
    .all();
  return c.json({ verses: results ?? [] });
});

// GET /v1/books/:work/verses/:ref — полный стих со слоями + сосед по спайну
booksRouter.get('/:work/verses/:ref', async (c) => {
  const work = c.req.param('work');
  const ref = decodeURIComponent(c.req.param('ref'));

  const verse = await c.env.DB.prepare(
    `SELECT id, ref, division_id, ordinal, devanagari, translit, uvaca, source_url
     FROM verses WHERE work_id = ? AND ref = ?`,
  )
    .bind(work, ref)
    .first<Row>();

  if (!verse) {
    return c.json({ error: { code: 'not_found', message: 'verse not found', ref } }, 404);
  }

  // Перевод + комментарий: предпочитаем <work>-ru, иначе любое издание с текстом.
  const text = await c.env.DB.prepare(
    `SELECT translation, purport, edition_id FROM verse_texts
     WHERE verse_id = ?
     ORDER BY (edition_id = ?) DESC, (COALESCE(translation,'') <> '') DESC
     LIMIT 1`,
  )
    .bind(verse.id, `${work}-ru`)
    .first<Row>();

  // Пословный перевод (слой word-by-word).
  const tokens =
    (
      await c.env.DB.prepare(
        `SELECT term, gloss FROM verse_tokens WHERE verse_id = ? ORDER BY ordinal`,
      )
        .bind(verse.id)
        .all()
    ).results ?? [];

  // Спайн: сквозной порядок чтения = divisions.ordinal, затем verses.ordinal.
  const neigh = await c.env.DB.prepare(
    `WITH spine AS (
       SELECT v.ref, ROW_NUMBER() OVER (ORDER BY d.ordinal, v.ordinal) AS rn
       FROM verses v JOIN divisions d ON d.id = v.division_id
       WHERE v.work_id = ?
     ), cur AS (SELECT rn FROM spine WHERE ref = ?)
     SELECT
       (SELECT ref FROM spine WHERE rn = (SELECT rn FROM cur) - 1) AS prev,
       (SELECT ref FROM spine WHERE rn = (SELECT rn FROM cur) + 1) AS next`,
  )
    .bind(work, ref)
    .first<Row>();

  // Метка: последний дотированный сегмент. "БГ 2.13" → "13"; "БГ 2.16-17" → "16-17".
  const tail = String(verse.ref).split('.').pop() ?? '';
  const label = /[-–]/.test(tail) ? `Тексты ${tail.replace('-', '–')}` : `Текст ${tail}`;

  return c.json({
    ref: verse.ref,
    label,
    uvaca: verse.uvaca ?? null,
    devanagari: verse.devanagari ?? null,
    translit: verse.translit ?? null,
    tokens,
    translation: text?.translation ?? null,
    purport: text?.purport ?? null,
    source_url: verse.source_url ?? null,
    prev: neigh?.prev ?? null,
    next: neigh?.next ?? null,
  });
});
