import { Hono } from 'hono';
import type { Bindings, Variables } from '~/index';
import { parseJson } from '~/lib/db';

/**
 * GET /v1/dhamas — полный каталог дхам для гидрации фронта (dhamasHydrate).
 * Источник истины: таблицы dhamas, dhama_clusters, tirthas (миграции 0013 + 0018).
 * Отдаёт дхамы уровня (intro/facts/center/accent/hero) + кластеры + тиртхи с
 * persons (JSON-колонка), hero_image, gallery и структурированными sources.
 * Тяжёлые поля (content_html/text_plain) живут в staging vraja_raw, здесь не отдаются.
 */
export const dhamasRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

type Row = Record<string, unknown>;

dhamasRouter.get('/', async (c) => {
  const db = c.env.DB;
  const [dhamaRes, clusterRes, tirthaRes] = await Promise.all([
    db.prepare(
      'SELECT id,name,iast,tagline,deity,region,hero,accent,center_lat,center_lng,center_zoom,intro,facts,sort FROM dhamas ORDER BY sort',
    ).all<Row>(),
    db.prepare(
      'SELECT dhama_id,cluster_id,title,note,sort FROM dhama_clusters ORDER BY dhama_id,sort',
    ).all<Row>(),
    db.prepare(
      'SELECT id,dhama_id,cluster,name,iast,kind,lat,lng,blurb,about,lila,persons,maps,source,hero_image,gallery,sources_json,sort FROM tirthas ORDER BY dhama_id,cluster,sort',
    ).all<Row>(),
  ]);

  const clustersByDhama = new Map<string, unknown[]>();
  for (const r of clusterRes.results) {
    const did = r.dhama_id as string;
    if (!clustersByDhama.has(did)) clustersByDhama.set(did, []);
    clustersByDhama.get(did)!.push({ id: r.cluster_id, title: r.title, note: r.note ?? undefined });
  }

  const tirthasByDhama = new Map<string, unknown[]>();
  for (const t of tirthaRes.results) {
    const did = t.dhama_id as string;
    const persons = parseJson<unknown[]>(t.persons, []);
    const gallery = parseJson<string[]>(t.gallery, []);
    const sources = parseJson<unknown[]>(t.sources_json, []);
    const tir = {
      id: t.id,
      dhama: did,
      cluster: t.cluster,
      name: t.name,
      iast: t.iast || undefined,
      kind: t.kind,
      lat: t.lat ?? null,
      lng: t.lng ?? null,
      blurb: t.blurb || '',
      about: t.about || '',
      lila: t.lila || undefined,
      persons: Array.isArray(persons) && persons.length ? persons : undefined,
      maps: t.maps || undefined,
      source: t.source || undefined,
      hero_image: t.hero_image || undefined,
      gallery: Array.isArray(gallery) && gallery.length ? gallery : undefined,
      sources: Array.isArray(sources) && sources.length ? sources : undefined,
    };
    if (!tirthasByDhama.has(did)) tirthasByDhama.set(did, []);
    tirthasByDhama.get(did)!.push(tir);
  }

  const dhamas = dhamaRes.results.map((d) => ({
    id: d.id,
    name: d.name,
    iast: d.iast || '',
    tagline: d.tagline || '',
    deity: d.deity || '',
    region: d.region || '',
    hero: d.hero || undefined,
    accent: d.accent || '#1E8E5B',
    center: { lat: (d.center_lat as number) ?? 0, lng: (d.center_lng as number) ?? 0, zoom: (d.center_zoom as number) ?? 11 },
    intro: parseJson<string[]>(d.intro, []),
    facts: parseJson<unknown[]>(d.facts, []),
    clusters: clustersByDhama.get(d.id as string) ?? [],
    tirthas: tirthasByDhama.get(d.id as string) ?? [],
  }));

  c.header('Cache-Control', 'public, max-age=600');
  return c.json(dhamas);
});
