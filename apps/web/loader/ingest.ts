/**
 * Движок ингеста в D1 — идемпотентная послойная запись стиха.
 *
 * Схема (поверх реестра): works → divisions → verses → verse_texts / verse_tokens.
 * Ключи детерминированы из (work, chapter, seg): id = `bg.2.13`, ref = «БГ 2.13»,
 * division_id = `bg.2`. Это совпадает с импортёром структуры, поэтому загрузчик
 * самоисцеляющий: если строка-скелет есть — обновит, если нет — создаст.
 *
 * Идемпотентность:
 *   - verses / verse_texts — INSERT ... ON CONFLICT DO UPDATE с COALESCE
 *     (новое значение не затирает уже имеющееся, если пришёл NULL);
 *   - verse_tokens — replace-on-load, но ТОЛЬКО когда токены реально распознаны
 *     (пустой разбор не стирает хороший пословный).
 */
import type { ChapterStatusRow, LayerFlags, NormalizedVerse, VerseLoadReport } from './types';

const ABBR: Record<string, string> = {
  bg: 'БГ',
  sb: 'ШБ',
  cc: 'ЧЧ',
  iso: 'Шри Ишопанишад',
};

export function verseKeys(work: string, chapter: number, seg: string) {
  return {
    id: `${work}.${chapter}.${seg}`,
    ref: `${ABBR[work] ?? work.toUpperCase()} ${chapter}.${seg}`,
    divId: `${work}.${chapter}`,
  };
}

export async function upsertVerse(
  db: D1Database,
  work: string,
  chapter: number,
  v: NormalizedVerse,
  layers: LayerFlags,
): Promise<VerseLoadReport> {
  const { id, ref, divId } = verseKeys(work, chapter, v.seg);
  const stmts: D1PreparedStatement[] = [];

  if (layers.sanskrit) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO verses (id,work_id,division_id,ref,ordinal,devanagari,translit,uvaca,source_url)
           VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)
           ON CONFLICT(id) DO UPDATE SET
             devanagari = COALESCE(excluded.devanagari, verses.devanagari),
             translit   = COALESCE(excluded.translit,   verses.translit),
             uvaca      = COALESCE(excluded.uvaca,      verses.uvaca),
             source_url = COALESCE(verses.source_url,   excluded.source_url)`,
        )
        .bind(id, work, divId, ref, v.ordinal || null, v.devanagari, v.translit, v.uvaca, v.sourceUrl),
    );
  } else {
    // Без санскрита — лишь гарантируем наличие строки-скелета (не трогаем оригинал).
    stmts.push(
      db
        .prepare(
          `INSERT INTO verses (id,work_id,division_id,ref,ordinal,source_url)
           VALUES (?1,?2,?3,?4,?5,?6)
           ON CONFLICT(id) DO UPDATE SET source_url = COALESCE(verses.source_url, excluded.source_url)`,
        )
        .bind(id, work, divId, ref, v.ordinal || null, v.sourceUrl),
    );
  }

  if (layers.edition) {
    const editionId = `${work}-ru`;
    // Издание должно существовать; создаём с license = pending, если его нет.
    stmts.push(
      db
        .prepare(
          `INSERT INTO editions (id,work_id,lang,source,license,source_url)
           VALUES (?1,?2,'ru','vedabase.io','pending',?3)
           ON CONFLICT(id) DO NOTHING`,
        )
        .bind(editionId, work, `https://vedabase.io/ru/library/${work}/`),
    );
    stmts.push(
      db
        .prepare(
          `INSERT INTO verse_texts (verse_id,edition_id,translation,purport)
           VALUES (?1,?2,?3,?4)
           ON CONFLICT(verse_id,edition_id) DO UPDATE SET
             translation = COALESCE(excluded.translation, verse_texts.translation),
             purport     = COALESCE(excluded.purport,     verse_texts.purport)`,
        )
        .bind(id, editionId, v.translation, v.purport),
    );
    if (v.tokens.length) {
      stmts.push(db.prepare(`DELETE FROM verse_tokens WHERE verse_id = ?1`).bind(id));
      v.tokens.forEach((t, i) => {
        stmts.push(
          db
            .prepare(`INSERT INTO verse_tokens (verse_id,ordinal,term,gloss) VALUES (?1,?2,?3,?4)`)
            .bind(id, i + 1, t.term, t.gloss),
        );
      });
    }
  }

  await db.batch(stmts);
  return {
    ref,
    deva: !!v.devanagari,
    translit: !!v.translit,
    tokens: layers.edition ? v.tokens.length : 0,
    translation: !!v.translation,
    purport: !!v.purport,
  };
}

/** Наполнение глав книги (leaf-главы, level='chapter'). */
export async function chapterStatus(db: D1Database, work: string): Promise<ChapterStatusRow[]> {
  const { results } = await db
    .prepare(
      `SELECT d.number AS number,
              json_extract(d.title,'$.ru') AS title_ru,
              COUNT(v.id) AS verses,
              SUM(CASE WHEN length(COALESCE(v.devanagari,''))>0 THEN 1 ELSE 0 END) AS deva,
              SUM(CASE WHEN length(COALESCE(v.translit,''))>0   THEN 1 ELSE 0 END) AS translit,
              SUM(CASE WHEN EXISTS(SELECT 1 FROM verse_tokens t WHERE t.verse_id=v.id) THEN 1 ELSE 0 END) AS tokens,
              SUM(CASE WHEN EXISTS(SELECT 1 FROM verse_texts x WHERE x.verse_id=v.id AND length(COALESCE(x.translation,''))>0) THEN 1 ELSE 0 END) AS translation,
              SUM(CASE WHEN EXISTS(SELECT 1 FROM verse_texts x WHERE x.verse_id=v.id AND length(COALESCE(x.purport,''))>0) THEN 1 ELSE 0 END) AS purport
       FROM divisions d
       LEFT JOIN verses v ON v.division_id = d.id
       WHERE d.work_id = ?1 AND d.level = 'chapter'
       GROUP BY d.id
       ORDER BY CAST(d.number AS INTEGER)`,
    )
    .bind(work)
    .all();
  return ((results as Record<string, unknown>[]) ?? []).map((r) => ({
    number: String(r.number),
    title_ru: (r.title_ru as string) ?? '',
    verses: Number(r.verses || 0),
    deva: Number(r.deva || 0),
    translit: Number(r.translit || 0),
    tokens: Number(r.tokens || 0),
    translation: Number(r.translation || 0),
    purport: Number(r.purport || 0),
  }));
}

export async function editionInfo(db: D1Database, work: string) {
  const row = await db
    .prepare(`SELECT id, license, source FROM editions WHERE id = ?1`)
    .bind(`${work}-ru`)
    .first<Record<string, unknown>>();
  return row
    ? { id: String(row.id), license: (row.license as string) ?? null, source: (row.source as string) ?? null }
    : null;
}
