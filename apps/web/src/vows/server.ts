/**
 * Обеты (Ц6) — серверная часть в воркере iskcon-web, та же база D1.
 *
 * Две вещи:
 *  1) Синхронизация ЛИЧНЫХ обетов (санкальпа/врата). Источник правды — localStorage
 *     на устройстве (как джапа/прогресс чтения); сюда кладём JSON-снимок {active,
 *     archive} для кросс-устройства. Разрешение конфликта — «новее побеждает» по
 *     updated_at (epoch-ms с клиента).
 *  2) СОВМЕСТНЫЕ ВРАТЫ — единственная форма сангхи (по стратегии: без ленты и
 *     чатов). Курируемые обеты, к которым преданные присоединяются и добавляют
 *     свой вклад; показываем общий итог и число участников. Никакой персональной
 *     ленты/переписки — только общее памятование и совместное движение к цели.
 */

import type { D1Database } from "@cloudflare/workers-types";
import { currentUserId } from "../account/server";

interface DB { DB: D1Database }

const NOINDEX = "noindex, nofollow, noarchive, nosnippet, noimageindex";
function jres(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "Cache-Control": "private, no-store", "X-Robots-Tag": NOINDEX, Vary: "Cookie" },
  });
}
const err = (code: string, status = 400) => jres({ error: code }, status);

let schemaReady = false;
async function ensureVowsSchema(env: DB): Promise<void> {
  if (schemaReady) return;
  await env.DB.batch([
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS user_vows (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        active TEXT,
        archive TEXT NOT NULL DEFAULT '[]',
        updated_at INTEGER NOT NULL DEFAULT 0,
        saved_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS collective_vows (
        id TEXT PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        unit TEXT NOT NULL DEFAULT '',
        target_total INTEGER NOT NULL DEFAULT 0,
        ends_at TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        sort INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS collective_vow_members (
        vow_id TEXT NOT NULL REFERENCES collective_vows(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount INTEGER NOT NULL DEFAULT 0,
        joined_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (vow_id, user_id)
      )`,
    ),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_cvow_members_vow ON collective_vow_members(vow_id)`),
  ]);
  schemaReady = true;
}

interface CVowRow { id: string; slug: string; title: string; description: string | null; unit: string; target_total: number; total: number; members: number }

/** Список активных совместных вратов с агрегатом и (если вошёл) моим вкладом. */
async function listCollective(env: DB, uid: string | null) {
  const rowsRes = await env.DB.prepare(
    `SELECT cv.id, cv.slug, cv.title, cv.description, cv.unit, cv.target_total,
            COALESCE(SUM(m.amount),0) AS total, COUNT(m.user_id) AS members
     FROM collective_vows cv
     LEFT JOIN collective_vow_members m ON m.vow_id = cv.id
     WHERE cv.active = 1
     GROUP BY cv.id ORDER BY cv.sort, cv.created_at`,
  ).all<CVowRow>();
  const rows = rowsRes.results ?? [];
  const mine = new Map<string, number>();
  if (uid) {
    const mres = await env.DB.prepare(`SELECT vow_id, amount FROM collective_vow_members WHERE user_id = ?1`).bind(uid).all<{ vow_id: string; amount: number }>();
    for (const m of mres.results ?? []) mine.set(m.vow_id, m.amount);
  }
  return rows.map((r) => ({
    id: r.id, slug: r.slug, title: r.title, description: r.description, unit: r.unit,
    target: r.target_total, total: r.total, members: r.members, mine: mine.get(r.id) ?? 0,
  }));
}

export async function vowsApi(request: Request, env: DB, url: URL): Promise<Response | null> {
  const p = url.pathname;
  if (!p.startsWith("/api/me/vows") && !p.startsWith("/api/vows")) return null;
  const method = request.method.toUpperCase();
  try { await ensureVowsSchema(env); } catch { return err("server", 500); }

  const body = async (): Promise<Record<string, unknown>> => { try { return (await request.json()) as Record<string, unknown>; } catch { return {}; } };

  // Список совместных вратов — публичный (агрегат виден всем; вклад — если вошёл).
  if (p === "/api/vows/collective" && method === "GET") {
    const uid = await currentUserId(env, request);
    return jres({ items: await listCollective(env, uid) });
  }

  // Всё ниже — под сессией.
  const uid = await currentUserId(env, request);
  if (!uid) return err("unauthorized", 401);

  // Личные обеты — снимок {active, archive} для кросс-устройства.
  if (p === "/api/me/vows") {
    if (method === "GET") {
      const row = await env.DB.prepare(`SELECT active, archive, updated_at FROM user_vows WHERE user_id = ?1`).bind(uid).first<{ active: string | null; archive: string | null; updated_at: number }>();
      let active: unknown = null, archive: unknown = [];
      try { active = row?.active ? JSON.parse(row.active) : null; } catch { active = null; }
      try { archive = row?.archive ? JSON.parse(row.archive) : []; } catch { archive = []; }
      return jres({ active, archive, updatedAt: row?.updated_at ?? 0 });
    }
    if (method === "PUT") {
      const b = await body();
      const updatedAt = Number(b.updatedAt);
      if (!Number.isFinite(updatedAt) || updatedAt <= 0) return err("bad_request");
      const activeStr = b.active == null ? null : JSON.stringify(b.active);
      const archiveStr = JSON.stringify(Array.isArray(b.archive) ? b.archive : []);
      // Защита от мусора: слишком крупный снимок отклоняем (лог обета — единицы КБ).
      if ((activeStr?.length ?? 0) + archiveStr.length > 400_000) return err("too_large", 413);
      const cur = await env.DB.prepare(`SELECT updated_at FROM user_vows WHERE user_id = ?1`).bind(uid).first<{ updated_at: number }>();
      if (cur && updatedAt < cur.updated_at) return jres({ ok: false, stale: true, updatedAt: cur.updated_at });
      await env.DB.prepare(
        `INSERT INTO user_vows (user_id, active, archive, updated_at, saved_at)
         VALUES (?1,?2,?3,?4, datetime('now'))
         ON CONFLICT(user_id) DO UPDATE SET active = ?2, archive = ?3, updated_at = ?4, saved_at = datetime('now')`,
      ).bind(uid, activeStr, archiveStr, Math.round(updatedAt)).run();
      return jres({ ok: true, updatedAt: Math.round(updatedAt) });
    }
  }

  // Вклад в совместный врат (внести N единиц; присоединяет при первом вкладе).
  if (p === "/api/me/vows/collective" && method === "POST") {
    const b = await body();
    const vowId = String(b.vowId ?? "").slice(0, 64);
    const amount = Math.round(Number(b.amount));
    if (!vowId || !Number.isFinite(amount) || amount < 1 || amount > 10000) return err("bad_request");
    const cv = await env.DB.prepare(`SELECT id FROM collective_vows WHERE id = ?1 AND active = 1`).bind(vowId).first<{ id: string }>();
    if (!cv) return err("not_found", 404);
    await env.DB.prepare(
      `INSERT INTO collective_vow_members (vow_id, user_id, amount, updated_at)
       VALUES (?1,?2,?3, datetime('now'))
       ON CONFLICT(vow_id, user_id) DO UPDATE SET amount = min(amount + ?3, 100000000), updated_at = datetime('now')`,
    ).bind(vowId, uid, amount).run();
    return jres({ items: await listCollective(env, uid) });
  }

  return err("not_found", 404);
}
