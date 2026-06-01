/**
 * ISKCON Platform API
 * Bun + Hono → Cloudflare Workers (D1 + KV + R2)
 *
 * Мульти-тенант / франшиза: глобальный контент создаётся один раз,
 * локальные данные принадлежат каждому центру (тенанту).
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { timing } from 'hono/timing';
import { prettyJSON } from 'hono/pretty-json';
import { requestId } from 'hono/request-id';

import { healthRouter } from '~/routes/health';
import { centersRouter } from '~/routes/centers';
import { calendarRouter } from '~/routes/calendar';
import { booksRouter } from '~/routes/books';
import { bhajansRouter } from '~/routes/bhajans';
import { errorHandler } from '~/middleware/error';

export type Bindings = {
  DB: D1Database;
  CACHE: KVNamespace;
  AI: Ai;
  ENVIRONMENT: 'development' | 'staging' | 'production';
  // JWT secret для авторизации (задаётся: wrangler secret put JWT_SECRET --env production)
  JWT_SECRET: string;
};

export type Variables = {
  requestId: string;
  userId?: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// --- Global middleware -------------------------------------------------------
app.use('*', requestId());
app.use('*', timing());
app.use('*', logger());
app.use('*', secureHeaders());
app.use('*', prettyJSON());
app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'https://gaurangers.com', 'https://www.gaurangers.com'],
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    maxAge: 600,
  }),
);

// --- Routes ------------------------------------------------------------------
const v1 = app.basePath('/v1');

v1.route('/health', healthRouter);
v1.route('/centers', centersRouter);
v1.route('/calendar', calendarRouter);
v1.route('/books', booksRouter);
v1.route('/bhajans', bhajansRouter);

// Future (Phase 1+):
// v1.route('/auth', authRouter);
// v1.route('/personalities', personalitiesRouter);
// v1.route('/donations', donationsRouter);

// --- Root --------------------------------------------------------------------
app.get('/', (c) =>
  c.json({
    name: 'iskcon-api',
    version: '0.1.0',
    status: 'foundation',
    docs: 'https://github.com/billionsx/iskcon/blob/main/docs/PRODUCT_ARCHITECTURE.md',
  }),
);

// --- Errors ------------------------------------------------------------------
app.onError(errorHandler);

app.notFound((c) =>
  c.json({ error: { code: 'not_found', message: 'Route not found', path: c.req.path } }, 404),
);

export default { fetch: app.fetch };
