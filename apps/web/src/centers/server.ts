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
    return jres({ items });
  }

  /* ───────── публичный локатор ───────── */
  if (p === "/api/centers" && method === "GET") {
    const sp = url.searchParams;
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

  /* ───────── /api/centers/<slug|id> ───────── */
  if (p.startsWith("/api/centers/")) {
    const rest = decodeURIComponent(p.slice("/api/centers/".length)).replace(/\/+$/, "");
    if (!rest || rest.includes("/")) return err("not_found", 404);

    // GET /api/centers/:slug — публичная карточка (+ программы, божества, события).
    if (method === "GET") {
      const center = await env.DB.prepare(`SELECT * FROM centers WHERE slug = ?1 LIMIT 1`)
        .bind(rest)
        .first<Record<string, any>>();
      if (!center) return err("center_not_found", 404);
      if (center.status !== "live") {
        // черновик/review — только админу этого центра (превью)
        const uid = await currentUserId(env, request);
        if (!uid || !(await adminRole(env, center.id, uid))) return err("center_not_found", 404);
      }
      const [programs, deities, events] = await Promise.all([
        env.DB.prepare(
          `SELECT id, type, days_of_week, start_time, end_time, notes_i18n, sort_order
           FROM center_programs WHERE center_id = ?1 ORDER BY sort_order, start_time`,
        )
          .bind(center.id)
          .all(),
        env.DB.prepare(
          `SELECT cd.id, cd.local_name_i18n, cd.darshan_times, cd.photos,
                  d.id AS deity_id, d.canonical_name
           FROM center_deities cd LEFT JOIN deities d ON d.id = cd.deity_id
           WHERE cd.center_id = ?1`,
        )
          .bind(center.id)
          .all(),
        env.DB.prepare(
          `SELECT id, festival_id, title_i18n, description_i18n, starts_at, ends_at, images, livestream_url
           FROM center_events WHERE center_id = ?1 AND (ends_at IS NULL OR ends_at >= datetime('now'))
           ORDER BY starts_at LIMIT 20`,
        )
          .bind(center.id)
          .all(),
      ]);

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
        deities: (deities.results as Record<string, any>[]).map((x) => ({
          ...x,
          local_name_i18n: parse(x.local_name_i18n, {}),
          darshan_times: parse(x.darshan_times, {}),
          photos: parse<string[]>(x.photos, []),
        })),
        events: (events.results as Record<string, any>[]).map((x) => ({
          ...x,
          title_i18n: parse(x.title_i18n, {}),
          description_i18n: parse(x.description_i18n, {}),
          images: parse<string[]>(x.images, []),
        })),
      });
    }

    // PATCH /api/centers/:id — править карточку (адресация по id центра).
    if (method === "PATCH") {
      const uid = await currentUserId(env, request);
      if (!uid) return err("unauthorized", 401);
      const id = rest;
      const role = await adminRole(env, id, uid);
      if (!role) return err("forbidden", 403);

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
        if (st === "live" && !(await isGlobalEditor(env, uid))) return err("publish_forbidden", 403);
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
