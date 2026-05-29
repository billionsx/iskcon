import { Hono } from 'hono';
import type { Bindings, Variables } from '~/index';

export const healthRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const HEALTH_KV_KEY = '__health__';

type Check = { ok: boolean; latency_ms?: number; error?: string; [k: string]: unknown };

healthRouter.get('/', async (c) => {
  const checks: Record<string, Check> = {};

  // ------ KV roundtrip ------
  const kvStart = Date.now();
  try {
    await c.env.CACHE.put(HEALTH_KV_KEY, new Date().toISOString(), { expirationTtl: 60 });
    const value = await c.env.CACHE.get(HEALTH_KV_KEY);
    checks.kv = { ok: typeof value === 'string', latency_ms: Date.now() - kvStart };
  } catch (err) {
    checks.kv = { ok: false, error: (err as Error).message, latency_ms: Date.now() - kvStart };
  }

  // ------ D1 reachability ------
  const dbStart = Date.now();
  try {
    const row = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM centers').first<{ n: number }>();
    checks.d1 = { ok: true, latency_ms: Date.now() - dbStart, centers: row?.n ?? 0 };
  } catch (err) {
    checks.d1 = { ok: false, error: (err as Error).message, latency_ms: Date.now() - dbStart };
  }

  const allOk = Object.values(checks).every((x) => x.ok);

  return c.json(
    {
      status: allOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      environment: c.env.ENVIRONMENT ?? 'development',
      requestId: c.get('requestId'),
      checks,
    },
    allOk ? 200 : 503,
  );
});
