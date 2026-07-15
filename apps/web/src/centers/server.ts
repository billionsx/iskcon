/**
 * Центры (Ятра) — серверная часть управления. Исполняется в том же воркере
 * iskcon-web и на той же cookie-сессии, что и личный кабинет
 * (apps/web/src/account/server.ts).
 *
 * Почему здесь, а не в apps/api: запись в карточку центра должна быть
 * авторизована вошедшим преданным. Авторизация у нас — HttpOnly-cookie на
 * gaurangers.com. На api.gaurangers.com (другой домен) этот cookie не уходит, а
 * тамошний REST-слой ждёт Bearer-JWT, которого у фронта нет. Поэтому управляемая
 * часть центров живёт здесь, рядом с сессией. Публичные чтения (локатор,
 * карточка) тоже отдаём отсюда — один origin и единые правила доступа к
 * черновикам.
 *
 * Схема — apps/api/migrations/0001_init_core.sql (centers, center_admins,
 * center_programs, center_deities, center_events, deities, festivals). Здесь её
 * НЕ пересоздаём: таблицы уже накатаны миграцией.
 *
 * Модель доступа:
 *   - GET   /api/centers          — публичный локатор (только status='live').
 *   - GET   /api/centers/:slug     — карточка центра; черновик/review виден
 *                                    ТОЛЬКО админу этого центра (превью).
 *   - POST  /api/centers           — создать (auth) → 'draft', автор = админ.
 *   - PATCH /api/centers/:id        — править (auth + админ центра). Перевод в
 *                                    'live' («авторизовано ИСККОН») разрешён
 *                                    только глобальному редактору
 *                                    (users.is_global_editor); владелец может
 *                                    лишь подать на проверку ('review').
 *   - GET   /api/me/centers        — центры, которыми я управляю (для кабинета).
 *
 * Ответы кабинета не кэшируются (no-store) и noindex.
 */

import type { D1Database } from "@cloudflare/workers-types";
import { currentUserId } from "../account/server";

interface DB {
  DB: D1Database;
}

const NOINDEX = "noindex, nofollow, noarchive, nosnippet, noimageindex";
const CENTER_TYPES = ["temple", "namahatta", "restaurant", "farm", "preaching_center"] as const;
// DNS-подобный slug: a-z, 0-9, дефис; 2–64 симв., не начинается/кончается дефисом.
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const STATUSES = ["draft", "review", "live"] as const;

/* ─────────────────────────── ответы ─────────────────────────── */

function jres(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store, must-revalidate",
      "X-Robots-Tag": NOINDEX,
      Vary: "Cookie",
    },
  });
}
const err = (code: string, status = 400) => jres({ error: code }, status);

/* ─────────────────────────── утилиты ─────────────────────────── */

const clip = (s: unknown, n: number) => String(s ?? "").trim().slice(0, n);
const asArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => clip(x, 40)).filter(Boolean).slice(0, 50) : [];
const isType = (s: string): boolean => (CENTER_TYPES as readonly string[]).includes(s);
const num = (v: unknown): number | null => (Number.isFinite(Number(v)) ? Number(v) : null);
/** Дни недели → уникальные целые 0–6 (0=Вс), по возрастанию. */
const normDays = (v: unknown): number[] =>
  Array.isArray(v)
    ? [...new Set(v.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort((a, b) => a - b)
    : [];
/** «HH:MM[:SS]» → «HH:MM:SS» либо null. */
const clipTime = (v: unknown): string | null => {
  const m = String(v ?? "").trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const h = Math.min(23, parseInt(m[1], 10));
  const mi = Math.min(59, parseInt(m[2], 10));
  const s = Math.min(59, parseInt(m[3] || "0", 10));
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};
/** «YYYY-MM-DD[ T]HH:MM[:SS]» или «YYYY-MM-DD» → «YYYY-MM-DD HH:MM:SS» либо null. */
const clipDateTime = (v: unknown): string | null => {
  const s = String(v ?? "").trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6] || "00"}`;
  const d = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (d) return `${d[1]}-${d[2]}-${d[3]} 00:00:00`;
  return null;
};
/** i18n-карта: только строковые значения, ключи-коды ≤8, значения ≤280. */
const cleanI18n = (v: unknown): Record<string, string> => {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const kk = clip(k, 8);
    const vv = clip(val, 280);
    if (kk && vv) out[kk] = vv;
  }
  return out;
};
function parse<T>(s: unknown, fb: T): T {
  if (s == null) return fb;
  try {
    return JSON.parse(String(s)) as T;
  } catch {
    return fb;
  }
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Роль пользователя в центре ('admin' | 'editor') или null, если не управляет. */
async function adminRole(env: DB, centerId: string, userId: string): Promise<string | null> {
  const row = await env.DB.prepare(
    `SELECT role FROM center_admins WHERE center_id = ?1 AND user_id = ?2 LIMIT 1`,
  )
    .bind(centerId, userId)
    .first<{ role: string }>();
  return row ? row.role : null;
}

/** Глобальный редактор (BBT/платформа) — право публиковать центр в 'live'. */
async function isGlobalEditor(env: DB, userId: string): Promise<boolean> {
  const row = await env.DB.prepare(`SELECT is_global_editor AS g FROM users WHERE id = ?1 LIMIT 1`)
    .bind(userId)
    .first<{ g: number }>();
  return !!(row && row.g);
}

/* ─────────────────────────── схема ─────────────────────────── */

// Семейство таблиц центров заводит миграция apps/api/migrations/0001_init_core.
// Но 0001 НЕ входит в CI-пайплайн apps/api (там идемпотентно гоняются только
// 0003/0004/0005); 0001 был накатан вручную при инициализации БД. Чтобы подсистема
// центров не зависела от ручного шага (и переживала пересоздание БД), здесь —
// ленивый идемпотентный гарант, ровно как в личном кабинете
// (apps/web/src/account/server.ts → ensureSchema). DDL зеркалит 0001 один-в-один.
// `users` НЕ создаём: её владелец — слой идентичности, и она гарантированно есть
// (регистрация в кабинете уже пишет в неё в проде).
let schemaReady = false;
/** Обновить updated_at центра (после правки расписания и т.п.). */
async function touchCenter(env: DB, centerId: string): Promise<void> {
  await env.DB.prepare(`UPDATE centers SET updated_at = ?2 WHERE id = ?1`)
    .bind(centerId, new Date().toISOString().slice(0, 19).replace("T", " "))
    .run();
}

async function ensureSchema(env: DB): Promise<void> {
  if (schemaReady) return;
  await env.DB.batch([
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS deities (
        id               TEXT PRIMARY KEY,
        canonical_name   TEXT NOT NULL,
        description_i18n TEXT
      )`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS festivals (
        id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        type             TEXT NOT NULL CHECK (type IN ('ekadashi','appearance','disappearance','festival')),
        name_i18n        TEXT NOT NULL,
        lunar_rule       TEXT,
        description_i18n TEXT
      )`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS centers (
        id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        type           TEXT NOT NULL DEFAULT 'temple'
                         CHECK (type IN ('temple','namahatta','restaurant','farm','preaching_center')),
        name           TEXT NOT NULL,
        slug           TEXT NOT NULL UNIQUE,
        parent_id      TEXT REFERENCES centers(id) ON DELETE SET NULL,
        gbc_zone       TEXT,
        country        TEXT,
        region         TEXT,
        city           TEXT,
        lat            REAL,
        lng            REAL,
        address        TEXT,
        timezone       TEXT,
        languages      TEXT NOT NULL DEFAULT '["en"]',
        phone          TEXT,
        whatsapp       TEXT,
        email          TEXT,
        website        TEXT,
        socials        TEXT,
        photos         TEXT NOT NULL DEFAULT '[]',
        status         TEXT NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft','review','live')),
        claimed_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
        established_on TEXT,
        created_at     TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS center_admins (
        center_id TEXT NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
        user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role      TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin','editor')),
        PRIMARY KEY (center_id, user_id)
      )`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS center_programs (
        id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        center_id    TEXT NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
        type         TEXT NOT NULL,
        days_of_week TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
        start_time   TEXT,
        end_time     TEXT,
        notes_i18n   TEXT,
        sort_order   INTEGER NOT NULL DEFAULT 0
      )`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS center_deities (
        id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        center_id       TEXT NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
        deity_id        TEXT REFERENCES deities(id) ON DELETE SET NULL,
        local_name_i18n TEXT,
        installed_on    TEXT,
        darshan_times   TEXT,
        photos          TEXT NOT NULL DEFAULT '[]'
      )`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS center_events (
        id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        center_id        TEXT NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
        festival_id      TEXT REFERENCES festivals(id) ON DELETE SET NULL,
        title_i18n       TEXT NOT NULL,
        description_i18n TEXT,
        starts_at        TEXT NOT NULL,
        ends_at          TEXT,
        images           TEXT NOT NULL DEFAULT '[]',
        livestream_url   TEXT,
        created_at       TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
    ),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_centers_geo ON centers(lat, lng)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_centers_country_city ON centers(country, city)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_centers_status ON centers(status)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_programs_center ON center_programs(center_id)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_center_deities_center ON center_deities(center_id)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_events_center ON center_events(center_id)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_events_starts ON center_events(starts_at)`),
  ]);
  // Неразрушающие миграции колонок-связей с графом сущностей (idempotent: бросает, если уже есть).
  for (const sql of [
    `ALTER TABLE center_deities ADD COLUMN deity_entity_id TEXT`,
    `ALTER TABLE center_events ADD COLUMN festival_entity_id TEXT`,
  ]) {
    try { await env.DB.prepare(sql).run(); } catch { /* колонка уже существует */ }
  }
  schemaReady = true;
}

/* ─────────────────────────── маршрутизатор ─────────────────────────── */

export async function centersApi(request: Request, env: DB, url: URL): Promise<Response | null> {
  const p = url.pathname;
  const isCenters = p === "/api/centers" || p.startsWith("/api/centers/");
  const isMine = p === "/api/me/centers";
  if (!isCenters && !isMine) return null;

  await ensureSchema(env);

  const method = request.method.toUpperCase();
  const body = async (): Promise<Record<string, unknown>> => {
    try {
      return (await request.json()) as Record<string, unknown>;
    } catch {
      return {};
    }
  };

  /* ───────── мои центры (кабинет) ───────── */
  if (isMine) {
    if (method !== "GET") return err("method_not_allowed", 405);
    const uid = await currentUserId(env, request);
    if (!uid) return err("unauthorized", 401);
    const { results } = await env.DB.prepare(
      `SELECT c.id, c.type, c.name, c.slug, c.city, c.country, c.status, c.photos, c.updated_at, ca.role
       FROM center_admins ca JOIN centers c ON c.id = ca.center_id
       WHERE ca.user_id = ?1 ORDER BY c.updated_at DESC`,
    )
      .bind(uid)
      .all();
    const items = (results as Record<string, any>[]).map((r) => ({
      ...r,
      photos: parse<string[]>(r.photos, []),
    }));
    const ge = await isGlobalEditor(env, uid);
    let reviewCount = 0;
    if (ge) {
      const rc = await env.DB.prepare(`SELECT COUNT(*) AS n FROM centers WHERE status = 'review'`).first<{ n: number }>();
      reviewCount = rc?.n ?? 0;
    }
    return jres({ items, is_global_editor: ge, review_count: reviewCount });
  }

  /* ───────── публичный локатор ───────── */
  if (p === "/api/centers" && method === "GET") {
    const sp = url.searchParams;

    // [ВРЕМЕННО ЗКН-Пл017] диагностика: что реально видит env.DB живого воркера.
    if (sp.get("__diag") === "1") {
      const out: Record<string, unknown> = {};
      try {
        const a = await env.DB.prepare(`SELECT COUNT(*) AS n FROM centers`).first<{ n: number }>();
        out.total = a?.n ?? null;
      } catch (e) { out.total_err = String(e).slice(0, 140); }
      try {
        const b = await env.DB.prepare(`SELECT COUNT(*) AS n FROM centers WHERE status = 'live'`).first<{ n: number }>();
        out.live = b?.n ?? null;
      } catch (e) { out.live_err = String(e).slice(0, 140); }
      try {
        const { results } = await env.DB.prepare(`SELECT id, status FROM centers ORDER BY rowid LIMIT 4`).all();
        out.sample = results;
      } catch (e) { out.sample_err = String(e).slice(0, 140); }
      try {
        const { results } = await env.DB.prepare(
          `SELECT id, type, name, slug, country, region, city, lat, lng, address, timezone,
                  languages, phone, whatsapp, email, website, photos
           FROM centers WHERE status = 'live' LIMIT ? OFFSET ?`,
        ).bind(3, 0).all();
        out.list_probe_n = (results as unknown[]).length;
      } catch (e) { out.list_err = String(e).slice(0, 200); }
      return jres({ __diag: true, ...out });
    }

    // Сквозная связь с графом: центры, где есть это Божество или праздник (entity-id).
    const entity = (clip(sp.get("entity"), 64) || "").toLowerCase();
    if (entity) {
      const { results } = await env.DB.prepare(
        `SELECT DISTINCT c.id, c.type, c.name, c.slug, c.country, c.city, c.photos
         FROM centers c
         WHERE c.status = 'live' AND (
           EXISTS (SELECT 1 FROM center_deities d WHERE d.center_id = c.id AND d.deity_entity_id = ?1)
           OR EXISTS (SELECT 1 FROM center_events e WHERE e.center_id = c.id AND e.festival_entity_id = ?1)
         )
         ORDER BY c.name LIMIT 50`,
      ).bind(entity).all();
      const items = (results as Record<string, any>[]).map((r) => ({ ...r, photos: parse<string[]>(r.photos, []) }));
      return jres({ items });
    }

    const where: string[] = ["status = 'live'"];
    const binds: unknown[] = [];

    const country = clip(sp.get("country"), 2).toUpperCase();
    if (country) {
      where.push("country = ?");
      binds.push(country);
    }
    const city = clip(sp.get("city"), 120);
    if (city) {
      where.push("city = ?");
      binds.push(city);
    }
    const type = clip(sp.get("type"), 24);
    if (isType(type)) {
      where.push("type = ?");
      binds.push(type);
    }
    const q = clip(sp.get("q"), 80);
    if (q) {
      where.push("name LIKE ?");
      binds.push("%" + q + "%");
    }

    const lat = num(sp.get("lat"));
    const lng = num(sp.get("lng"));
    const hasGeo = lat !== null && lng !== null;
    const radius = Math.min(Math.max(num(sp.get("radius_km")) ?? 50, 1), 20000);
    const limit = Math.min(Math.max(parseInt(sp.get("limit") || "20", 10) || 20, 1), 100);
    const offset = Math.max(parseInt(sp.get("offset") || "0", 10) || 0, 0);

    if (hasGeo) {
      const dLat = radius / 111;
      const dLng = radius / (111 * Math.max(Math.cos((lat! * Math.PI) / 180), 0.01));
      where.push("lat BETWEEN ? AND ?");
      binds.push(lat! - dLat, lat! + dLat);
      where.push("lng BETWEEN ? AND ?");
      binds.push(lng! - dLng, lng! + dLng);
    }

    const sql =
      `SELECT id, type, name, slug, country, region, city, lat, lng, address, timezone,
              languages, phone, whatsapp, email, website, photos
       FROM centers WHERE ${where.join(" AND ")} LIMIT ? OFFSET ?`;
    const { results } = await env.DB.prepare(sql)
      .bind(...binds, hasGeo ? 1000 : limit, hasGeo ? 0 : offset)
      .all();

    let items = (results as Record<string, any>[]).map((r): Record<string, any> => ({
      ...r,
      languages: parse<string[]>(r.languages, []),
      photos: parse<string[]>(r.photos, []),
    }));
    if (hasGeo) {
      items = items
        .map((r) => ({ ...r, distance_km: Math.round(haversineKm(lat!, lng!, r.lat, r.lng) * 10) / 10 }))
        .filter((r) => r.distance_km <= radius)
        .sort((a, b) => a.distance_km - b.distance_km)
        .slice(offset, offset + limit);
    }
    return jres({ items, count: items.length });
  }

  /* ───────── создать центр ───────── */
  if (p === "/api/centers" && method === "POST") {
    const uid = await currentUserId(env, request);
    if (!uid) return err("unauthorized", 401);
    const b = await body();
    const name = clip(b.name, 160);
    if (name.length < 2) return err("bad_name");
    const slug = clip(b.slug, 64).toLowerCase();
    if (!SLUG_RE.test(slug)) return err("bad_slug");
    const type = clip(b.type, 24) || "temple";
    if (!isType(type)) return err("bad_type");

    const exists = await env.DB.prepare(`SELECT id FROM centers WHERE slug = ?1 LIMIT 1`)
      .bind(slug)
      .first();
    if (exists) return err("slug_taken", 409);

    const id = crypto.randomUUID();
    const langs = asArr(b.languages);
    try {
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO centers
             (id, type, name, slug, country, region, city, lat, lng, address, timezone,
              languages, phone, whatsapp, email, website, status, claimed_by)
           VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,'draft',?17)`,
        ).bind(
          id,
          type,
          name,
          slug,
          clip(b.country, 2).toUpperCase() || null,
          clip(b.region, 120) || null,
          clip(b.city, 120) || null,
          num(b.lat),
          num(b.lng),
          clip(b.address, 300) || null,
          clip(b.timezone, 64) || null,
          JSON.stringify(langs.length ? langs : ["ru"]),
          clip(b.phone, 40) || null,
          clip(b.whatsapp, 40) || null,
          clip(b.email, 200) || null,
          clip(b.website, 300) || null,
          uid,
        ),
        env.DB.prepare(`INSERT INTO center_admins (center_id, user_id, role) VALUES (?1,?2,'admin')`).bind(
          id,
          uid,
        ),
      ]);
    } catch {
      // гонка на UNIQUE(slug)
      return err("slug_taken", 409);
    }
    return jres({ id, slug, status: "draft" }, 201);
  }

  /* ───────── очередь модерации (глобальный редактор) ───────── */
  if (p === "/api/centers/review" && method === "GET") {
    const uid = await currentUserId(env, request);
    if (!uid) return err("unauthorized", 401);
    if (!(await isGlobalEditor(env, uid))) return err("forbidden", 403);
    const { results } = await env.DB.prepare(
      `SELECT id, type, name, slug, city, country, status, photos, updated_at
       FROM centers WHERE status = 'review' ORDER BY updated_at ASC`,
    ).all();
    const items = (results as Record<string, any>[]).map((r) => ({
      ...r,
      photos: parse<string[]>(r.photos, []),
    }));
    return jres({ items });
  }

  /* ───────── /api/centers/<slug|id> ───────── */
  if (p.startsWith("/api/centers/")) {
    const segs = p.slice("/api/centers/".length).split("/").map((s) => decodeURIComponent(s)).filter(Boolean);

    // ── расписание программ: /api/centers/:id/programs[/:pid] ──
    if (segs[1] === "programs") {
      const centerId = segs[0];
      const pid = segs[2] || null;
      const uid = await currentUserId(env, request);
      if (!uid) return err("unauthorized", 401);
      if (!(await adminRole(env, centerId, uid))) return err("forbidden", 403);

      if (method === "POST" && !pid) {
        const b = await body();
        const type = clip(b.type, 40);
        if (!type) return err("bad_program");
        const mx = await env.DB.prepare(
          `SELECT COALESCE(MAX(sort_order), 0) AS m FROM center_programs WHERE center_id = ?1`,
        )
          .bind(centerId)
          .first<{ m: number }>();
        const id = crypto.randomUUID();
        await env.DB.prepare(
          `INSERT INTO center_programs (id, center_id, type, days_of_week, start_time, end_time, notes_i18n, sort_order)
           VALUES (?1,?2,?3,?4,?5,?6,?7,?8)`,
        )
          .bind(
            id,
            centerId,
            type,
            JSON.stringify(normDays(b.days_of_week)),
            clipTime(b.start_time),
            clipTime(b.end_time),
            JSON.stringify(cleanI18n(b.notes_i18n)),
            (mx?.m ?? 0) + 1,
          )
          .run();
        await touchCenter(env, centerId);
        return jres({ id }, 201);
      }

      if (method === "PATCH" && pid) {
        const b = await body();
        const fields: string[] = [];
        const binds: unknown[] = [];
        if ("type" in b) {
          const v = clip(b.type, 40);
          if (!v) return err("bad_program");
          fields.push("type = ?");
          binds.push(v);
        }
        if ("days_of_week" in b) {
          fields.push("days_of_week = ?");
          binds.push(JSON.stringify(normDays(b.days_of_week)));
        }
        if ("start_time" in b) {
          fields.push("start_time = ?");
          binds.push(clipTime(b.start_time));
        }
        if ("end_time" in b) {
          fields.push("end_time = ?");
          binds.push(clipTime(b.end_time));
        }
        if ("notes_i18n" in b) {
          fields.push("notes_i18n = ?");
          binds.push(JSON.stringify(cleanI18n(b.notes_i18n)));
        }
        if ("sort_order" in b) {
          fields.push("sort_order = ?");
          binds.push(num(b.sort_order) ?? 0);
        }
        if (fields.length === 0) return jres({ id: pid, updated: false });
        binds.push(pid, centerId);
        await env.DB.prepare(`UPDATE center_programs SET ${fields.join(", ")} WHERE id = ? AND center_id = ?`)
          .bind(...binds)
          .run();
        await touchCenter(env, centerId);
        return jres({ id: pid, updated: true });
      }

      if (method === "DELETE" && pid) {
        await env.DB.prepare(`DELETE FROM center_programs WHERE id = ?1 AND center_id = ?2`)
          .bind(pid, centerId)
          .run();
        await touchCenter(env, centerId);
        return jres({ id: pid, deleted: true });
      }

      return err("method_not_allowed", 405);
    }

    // ── божества: /api/centers/:id/deities[/:did] ──
    if (segs[1] === "deities") {
      const centerId = segs[0];
      const did = segs[2] || null;
      const uid = await currentUserId(env, request);
      if (!uid) return err("unauthorized", 401);
      if (!(await adminRole(env, centerId, uid))) return err("forbidden", 403);

      if (method === "POST" && !did) {
        const b = await body();
        const name = cleanI18n(b.local_name_i18n);
        if (Object.keys(name).length === 0) return err("bad_deity");
        const id = crypto.randomUUID();
        await env.DB.prepare(
          `INSERT INTO center_deities (id, center_id, deity_id, local_name_i18n, installed_on, darshan_times, photos, deity_entity_id)
           VALUES (?1,?2,?3,?4,?5,?6,?7,?8)`,
        )
          .bind(
            id,
            centerId,
            clip(b.deity_id, 64) || null,
            JSON.stringify(name),
            clip(b.installed_on, 20) || null,
            JSON.stringify(cleanI18n(b.darshan_times)),
            JSON.stringify(asArr(b.photos)),
            (clip(b.deity_entity_id, 64) || "").toLowerCase() || null,
          )
          .run();
        await touchCenter(env, centerId);
        return jres({ id }, 201);
      }
      if (method === "PATCH" && did) {
        const b = await body();
        const fields: string[] = [];
        const binds: unknown[] = [];
        if ("local_name_i18n" in b) {
          const n = cleanI18n(b.local_name_i18n);
          if (Object.keys(n).length === 0) return err("bad_deity");
          fields.push("local_name_i18n = ?");
          binds.push(JSON.stringify(n));
        }
        if ("darshan_times" in b) {
          fields.push("darshan_times = ?");
          binds.push(JSON.stringify(cleanI18n(b.darshan_times)));
        }
        if ("photos" in b) {
          fields.push("photos = ?");
          binds.push(JSON.stringify(asArr(b.photos)));
        }
        if ("installed_on" in b) {
          fields.push("installed_on = ?");
          binds.push(clip(b.installed_on, 20) || null);
        }
        if ("deity_id" in b) {
          fields.push("deity_id = ?");
          binds.push(clip(b.deity_id, 64) || null);
        }
        if ("deity_entity_id" in b) {
          fields.push("deity_entity_id = ?");
          binds.push((clip(b.deity_entity_id, 64) || "").toLowerCase() || null);
        }
        if (fields.length === 0) return jres({ id: did, updated: false });
        binds.push(did, centerId);
        await env.DB.prepare(`UPDATE center_deities SET ${fields.join(", ")} WHERE id = ? AND center_id = ?`)
          .bind(...binds)
          .run();
        await touchCenter(env, centerId);
        return jres({ id: did, updated: true });
      }
      if (method === "DELETE" && did) {
        await env.DB.prepare(`DELETE FROM center_deities WHERE id = ?1 AND center_id = ?2`)
          .bind(did, centerId)
          .run();
        await touchCenter(env, centerId);
        return jres({ id: did, deleted: true });
      }
      return err("method_not_allowed", 405);
    }

    // ── события: /api/centers/:id/events[/:eid] ──
    if (segs[1] === "events") {
      const centerId = segs[0];
      const eid = segs[2] || null;
      const uid = await currentUserId(env, request);
      if (!uid) return err("unauthorized", 401);
      if (!(await adminRole(env, centerId, uid))) return err("forbidden", 403);

      if (method === "POST" && !eid) {
        const b = await body();
        const title = cleanI18n(b.title_i18n);
        if (Object.keys(title).length === 0) return err("bad_event");
        const starts = clipDateTime(b.starts_at);
        if (!starts) return err("bad_event_date");
        const id = crypto.randomUUID();
        await env.DB.prepare(
          `INSERT INTO center_events (id, center_id, festival_id, title_i18n, description_i18n, starts_at, ends_at, images, livestream_url, festival_entity_id)
           VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)`,
        )
          .bind(
            id,
            centerId,
            clip(b.festival_id, 64) || null,
            JSON.stringify(title),
            JSON.stringify(cleanI18n(b.description_i18n)),
            starts,
            clipDateTime(b.ends_at),
            JSON.stringify(asArr(b.images)),
            clip(b.livestream_url, 300) || null,
            (clip(b.festival_entity_id, 64) || "").toLowerCase() || null,
          )
          .run();
        await touchCenter(env, centerId);
        return jres({ id }, 201);
      }
      if (method === "PATCH" && eid) {
        const b = await body();
        const fields: string[] = [];
        const binds: unknown[] = [];
        if ("title_i18n" in b) {
          const t = cleanI18n(b.title_i18n);
          if (Object.keys(t).length === 0) return err("bad_event");
          fields.push("title_i18n = ?");
          binds.push(JSON.stringify(t));
        }
        if ("description_i18n" in b) {
          fields.push("description_i18n = ?");
          binds.push(JSON.stringify(cleanI18n(b.description_i18n)));
        }
        if ("starts_at" in b) {
          const s = clipDateTime(b.starts_at);
          if (!s) return err("bad_event_date");
          fields.push("starts_at = ?");
          binds.push(s);
        }
        if ("ends_at" in b) {
          fields.push("ends_at = ?");
          binds.push(clipDateTime(b.ends_at));
        }
        if ("images" in b) {
          fields.push("images = ?");
          binds.push(JSON.stringify(asArr(b.images)));
        }
        if ("livestream_url" in b) {
          fields.push("livestream_url = ?");
          binds.push(clip(b.livestream_url, 300) || null);
        }
        if ("festival_id" in b) {
          fields.push("festival_id = ?");
          binds.push(clip(b.festival_id, 64) || null);
        }
        if ("festival_entity_id" in b) {
          fields.push("festival_entity_id = ?");
          binds.push((clip(b.festival_entity_id, 64) || "").toLowerCase() || null);
        }
        if (fields.length === 0) return jres({ id: eid, updated: false });
        binds.push(eid, centerId);
        await env.DB.prepare(`UPDATE center_events SET ${fields.join(", ")} WHERE id = ? AND center_id = ?`)
          .bind(...binds)
          .run();
        await touchCenter(env, centerId);
        return jres({ id: eid, updated: true });
      }
      if (method === "DELETE" && eid) {
        await env.DB.prepare(`DELETE FROM center_events WHERE id = ?1 AND center_id = ?2`)
          .bind(eid, centerId)
          .run();
        await touchCenter(env, centerId);
        return jres({ id: eid, deleted: true });
      }
      return err("method_not_allowed", 405);
    }

    const rest = segs.join("/");
    if (!rest || rest.includes("/")) return err("not_found", 404);

    // GET /api/centers/:slug — публичная карточка (+ программы, божества, события).
    if (method === "GET") {
      const center = await env.DB.prepare(`SELECT * FROM centers WHERE slug = ?1 LIMIT 1`)
        .bind(rest)
        .first<Record<string, any>>();
      if (!center) return err("center_not_found", 404);
      // Может ли зритель управлять: админ/редактор центра ИЛИ глобальный редактор.
      // can_publish — только глобальный редактор (право публикации/возврата).
      const viewer = await currentUserId(env, request);
      let canManage = false;
      let canPublish = false;
      if (viewer) {
        canPublish = await isGlobalEditor(env, viewer);
        canManage = canPublish || !!(await adminRole(env, center.id, viewer));
      }
      // черновик/review виден только тем, кто может управлять (превью/модерация).
      if (center.status !== "live" && !canManage) return err("center_not_found", 404);
      const [programs, deities, events] = await Promise.all([
        env.DB.prepare(
          `SELECT id, type, days_of_week, start_time, end_time, notes_i18n, sort_order
           FROM center_programs WHERE center_id = ?1 ORDER BY sort_order, start_time`,
        )
          .bind(center.id)
          .all(),
        env.DB.prepare(
          `SELECT cd.id, cd.local_name_i18n, cd.darshan_times, cd.photos,
                  d.id AS deity_id, d.canonical_name, cd.deity_entity_id
           FROM center_deities cd LEFT JOIN deities d ON d.id = cd.deity_id
           WHERE cd.center_id = ?1`,
        )
          .bind(center.id)
          .all(),
        env.DB.prepare(
          `SELECT id, festival_id, title_i18n, description_i18n, starts_at, ends_at, images, livestream_url,
                  festival_entity_id
           FROM center_events WHERE center_id = ?1 AND (ends_at IS NULL OR ends_at >= datetime('now'))
           ORDER BY starts_at LIMIT 20`,
        )
          .bind(center.id)
          .all(),
      ]);

      const deitiesArr = (deities.results as Record<string, any>[]).map((x) => ({
        ...x,
        local_name_i18n: parse(x.local_name_i18n, {}),
        darshan_times: parse(x.darshan_times, {}),
        photos: parse<string[]>(x.photos, []),
        deity_entity_id: (x.deity_entity_id ?? null) as string | null,
        deity_entity_name: null as string | null,
      }));
      const eventsArr = (events.results as Record<string, any>[]).map((x) => ({
        ...x,
        title_i18n: parse(x.title_i18n, {}),
        description_i18n: parse(x.description_i18n, {}),
        images: parse<string[]>(x.images, []),
        festival_entity_id: (x.festival_entity_id ?? null) as string | null,
        festival_entity_name: null as string | null,
      }));
      // Обогащаем именами связанных сущностей графа. Таблица может отсутствовать в свежей БД —
      // try/catch, тогда имена остаются null (как с entity_links/darshan в основном воркере).
      try {
        const ids = [...new Set([
          ...deitiesArr.map((d) => d.deity_entity_id),
          ...eventsArr.map((e) => e.festival_entity_id),
        ].filter(Boolean))] as string[];
        if (ids.length) {
          const nm = await env.DB.prepare(
            `SELECT entity_id, value FROM entity_names WHERE lang='ru' AND kind='canonical' AND entity_id IN (${ids.map(() => "?").join(",")})`,
          ).bind(...ids).all<{ entity_id: string; value: string }>();
          const nameMap = new Map<string, string>();
          for (const r of nm.results ?? []) nameMap.set(r.entity_id, r.value);
          for (const d of deitiesArr) if (d.deity_entity_id) d.deity_entity_name = nameMap.get(d.deity_entity_id) ?? null;
          for (const e of eventsArr) if (e.festival_entity_id) e.festival_entity_name = nameMap.get(e.festival_entity_id) ?? null;
        }
      } catch { /* граф сущностей недоступен */ }

      return jres({
        center: {
          ...center,
          languages: parse<string[]>(center.languages, []),
          photos: parse<string[]>(center.photos, []),
          socials: parse<Record<string, string>>(center.socials, {}),
        },
        programs: (programs.results as Record<string, any>[]).map((x) => ({
          ...x,
          days_of_week: parse<number[]>(x.days_of_week, []),
          notes_i18n: parse(x.notes_i18n, {}),
        })),
        deities: deitiesArr,
        events: eventsArr,
        can_manage: canManage,
        can_publish: canPublish,
      });
    }

    // PATCH /api/centers/:id — править карточку (адресация по id центра).
    if (method === "PATCH") {
      const uid = await currentUserId(env, request);
      if (!uid) return err("unauthorized", 401);
      const id = rest;
      const role = await adminRole(env, id, uid);
      const ge = await isGlobalEditor(env, uid);
      if (!role && !ge) return err("forbidden", 403);

      const b = await body();
      const fields: string[] = [];
      const binds: unknown[] = [];
      const set = (col: string, val: unknown) => {
        fields.push(`${col} = ?`);
        binds.push(val);
      };

      if ("name" in b) {
        const v = clip(b.name, 160);
        if (v.length < 2) return err("bad_name");
        set("name", v);
      }
      if ("type" in b) {
        const v = clip(b.type, 24);
        if (!isType(v)) return err("bad_type");
        set("type", v);
      }
      if ("country" in b) set("country", clip(b.country, 2).toUpperCase() || null);
      if ("region" in b) set("region", clip(b.region, 120) || null);
      if ("city" in b) set("city", clip(b.city, 120) || null);
      if ("lat" in b) set("lat", num(b.lat));
      if ("lng" in b) set("lng", num(b.lng));
      if ("address" in b) set("address", clip(b.address, 300) || null);
      if ("timezone" in b) set("timezone", clip(b.timezone, 64) || null);
      if ("languages" in b) set("languages", JSON.stringify(asArr(b.languages)));
      if ("phone" in b) set("phone", clip(b.phone, 40) || null);
      if ("whatsapp" in b) set("whatsapp", clip(b.whatsapp, 40) || null);
      if ("email" in b) set("email", clip(b.email, 200) || null);
      if ("website" in b) set("website", clip(b.website, 300) || null);
      if ("socials" in b)
        set("socials", b.socials && typeof b.socials === "object" ? JSON.stringify(b.socials) : null);
      if ("photos" in b) set("photos", JSON.stringify(asArr(b.photos)));
      if ("established_on" in b) set("established_on", clip(b.established_on, 20) || null);
      if ("status" in b) {
        const st = clip(b.status, 12);
        if (!(STATUSES as readonly string[]).includes(st)) return err("bad_status");
        // Публикация — прерогатива глобального редактора (верификация ИСККОН).
        if (st === "live" && !ge) return err("publish_forbidden", 403);
        set("status", st);
      }

      if (fields.length === 0) return jres({ id, updated: false });
      set("updated_at", new Date().toISOString().slice(0, 19).replace("T", " "));
      binds.push(id);
      await env.DB.prepare(`UPDATE centers SET ${fields.join(", ")} WHERE id = ?`)
        .bind(...binds)
        .run();
      return jres({ id, updated: true });
    }

    return err("method_not_allowed", 405);
  }

  return err("not_found", 404);
}
