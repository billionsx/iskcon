/**
 * Обработчик админских маршрутов загрузчика (`/api/admin/*`), живёт в том же
 * web-воркере, что и витрина: D1-биндинг уже под рукой, запрос — same-origin,
 * без CORS и без межсервисной авторизации.
 *
 * Защита: заголовок `X-Admin-Token` сверяется с секретом ADMIN_TOKEN воркера
 *   (wrangler secret put ADMIN_TOKEN). Без секрета маршруты отдают 503 — то есть
 *   не открываются «по умолчанию» случайно.
 *
 * Маршруты:
 *   GET  /api/admin/status?work=bg          → издание + наполнение по главам
 *   POST /api/admin/load-chapter            → загрузка главы
 *        body: { work, chapter, layers:{sanskrit,edition},
 *                source?: 'vedabase'|'json', verses?: NormalizedVerse[] }
 */
import { fetchChapterSegs, fetchVerse } from './vedabase';
import { chapterStatus, chapterVerses, editionInfo, upsertVerse } from './ingest';
import type { LayerFlags, NormalizedVerse, VerseLoadReport } from './types';

interface Env {
  DB: D1Database;
  ADMIN_TOKEN?: string;
}

const KNOWN_WORKS = ['bg', 'cc', 'sb', 'iso'];

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}

function authed(req: Request, env: Env): boolean {
  const secret = env.ADMIN_TOKEN ?? '';
  const got = req.headers.get('x-admin-token') ?? '';
  if (!secret || got.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0;
}

function normalizeIncoming(rows: unknown[]): NormalizedVerse[] {
  return (rows as Record<string, unknown>[]).map((v, i) => ({
    seg: String(v.seg ?? v.verse ?? i + 1),
    ordinal: Number(v.ordinal ?? i + 1),
    devanagari: (v.devanagari as string) ?? null,
    translit: (v.translit as string) ?? null,
    uvaca: (v.uvaca as string) ?? null,
    tokens: Array.isArray(v.tokens)
      ? (v.tokens as Record<string, unknown>[]).map((t) => ({
          term: String(t.term ?? ''),
          gloss: (t.gloss as string) ?? null,
        }))
      : [],
    translation: (v.translation as string) ?? null,
    purport: (v.purport as string) ?? null,
    sourceUrl: (v.sourceUrl as string) ?? null,
  }));
}

export async function handleAdmin(request: Request, env: Env, url: URL): Promise<Response> {
  if (typeof env.ADMIN_TOKEN === 'undefined') {
    return json(
      { error: 'admin_not_configured', message: 'Задайте секрет: wrangler secret put ADMIN_TOKEN' },
      503,
    );
  }
  if (!authed(request, env)) return json({ error: 'unauthorized' }, 401);

  if (request.method === 'GET' && url.pathname === '/api/admin/status') {
    const work = url.searchParams.get('work') || 'bg';
    if (!KNOWN_WORKS.includes(work)) return json({ error: 'unknown_work', work }, 400);
    const [chapters, edition] = await Promise.all([chapterStatus(env.DB, work), editionInfo(env.DB, work)]);
    return json({ work, edition, chapters });
  }

  // GET /api/admin/verses?work=bg&chapter=2 → стихи главы с содержимым (предпросмотр)
  if (request.method === 'GET' && url.pathname === '/api/admin/verses') {
    const work = url.searchParams.get('work') || 'bg';
    const chapter = Number(url.searchParams.get('chapter'));
    if (!KNOWN_WORKS.includes(work) || !Number.isFinite(chapter) || chapter < 1) {
      return json({ error: 'bad_params' }, 400);
    }
    const verses = await chapterVerses(env.DB, work, chapter);
    return json({ work, chapter, verses });
  }

  if (request.method === 'POST' && url.pathname === '/api/admin/load-chapter') {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return json({ error: 'bad_json' }, 400);
    }
    const work = String(body.work ?? 'bg');
    const chapter = Number(body.chapter);
    const layersIn = (body.layers ?? {}) as Record<string, unknown>;
    const layers: LayerFlags = { sanskrit: layersIn.sanskrit !== false, edition: !!layersIn.edition };
    if (!KNOWN_WORKS.includes(work) || !Number.isFinite(chapter) || chapter < 1) {
      return json({ error: 'bad_params' }, 400);
    }

    let verses: NormalizedVerse[];
    if (body.source === 'json' && Array.isArray(body.verses)) {
      verses = normalizeIncoming(body.verses);
    } else {
      const segs = await fetchChapterSegs(work, chapter);
      if (!segs.length) {
        return json(
          {
            error: 'no_verses_found',
            message:
              'Источник не вернул список стихов главы (изменилась разметка vedabase или доступ ограничен). Можно загрузить главу через «Импорт JSON».',
            work,
            chapter,
          },
          502,
        );
      }
      verses = [];
      for (let i = 0; i < segs.length; i++) {
        const v = await fetchVerse(work, chapter, segs[i]);
        v.ordinal = i + 1;
        verses.push(v);
      }
    }

    const reports: VerseLoadReport[] = [];
    for (const v of verses) reports.push(await upsertVerse(env.DB, work, chapter, v, layers));

    const summary = {
      verses: reports.length,
      deva: reports.filter((r) => r.deva).length,
      translit: reports.filter((r) => r.translit).length,
      tokens: reports.reduce((a, r) => a + r.tokens, 0),
      translation: reports.filter((r) => r.translation).length,
      purport: reports.filter((r) => r.purport).length,
    };
    return json({ work, chapter, layers, summary, reports });
  }

  return json({ error: 'not_found' }, 404);
}
