/**
 * Уведомления (Ц3) — серверная часть в воркере iskcon-web, та же база D1.
 *
 * Модель «tickle» (без шифрованной нагрузки): крон складывает намеченные
 * уведомления в push_outbox и шлёт «пустой» web-push (только VAPID-подпись,
 * без тела). Браузер будит service worker событием `push` без данных, SW
 * дёргает /api/push/pending (cookie-сессия уходит автоматически) и показывает
 * то, что накопилось. Плюсы: (1) единственная крипта — ES256-подпись VAPID-JWT
 * (надёжно, тестируемо), без aes128gcm (RFC 8291), который молча ломается;
 * (2) содержимое уведомления никогда не проходит через пуш-сервис (приватность).
 *
 * VAPID-ключи лежат в D1 (app_config: vapid_public / vapid_jwk / vapid_subject),
 * а не в секрете воркера — чтобы наполнять и вращать их из инструментов D1 без
 * ручной установки секретов. Приватный VAPID-ключ авторизует лишь отправку
 * пуша нашим же подписчикам (не даёт доступа к данным) — приемлемо хранить в БД,
 * которая и так под доступом только по CF-ключу. Без ключей всё тихо no-op.
 *
 * Типы уведомлений (крон, по локальному времени подписки):
 *   • verse    — «Стих дня» (~08:00) → /practice/verse
 *   • ekadashi — «Завтра Экадаши» (~18:00 накануне) → /calendar
 *   • festival — фестиваль сегодня (~07:00) → /calendar
 *   • streak   — серия под угрозой (~20:00, норма не закрыта) → /practice/japa
 * Дедуп — UNIQUE(user_id, category, day) в push_outbox: пуш шлётся только при
 * первом создании строки за локальный день.
 */

import type { D1Database } from "@cloudflare/workers-types";
import { currentUserId } from "../account/server";

interface DB { DB: D1Database }

const NOINDEX = "noindex, nofollow, noarchive, nosnippet, noimageindex";

/* ─────────────────────────── утилиты ─────────────────────────── */

function jres(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": NOINDEX,
      Vary: "Cookie",
    },
  });
}
const err = (code: string, status = 400) => jres({ error: code }, status);
const clip = (s: unknown, n: number) => String(s ?? "").trim().slice(0, n);

const enc = new TextEncoder();
function b64u(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function readConfig(env: DB, key: string): Promise<string | null> {
  const row = await env.DB.prepare(`SELECT value FROM app_config WHERE key = ?1`).bind(key).first<{ value: string }>();
  return row?.value ?? null;
}

/* ─────────────────────────── схема ─────────────────────────── */

let schemaReady = false;
async function ensurePushSchema(env: DB): Promise<void> {
  if (schemaReady) return;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS app_config (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT (datetime('now')))`),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS push_subscriptions (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT,
        auth TEXT,
        tz_offset INTEGER NOT NULL DEFAULT 0,
        cats TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_seen TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
    ),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_push_sub_user ON push_subscriptions(user_id)`),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS push_outbox (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category TEXT NOT NULL,
        day TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT,
        url TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (user_id, category, day)
      )`,
    ),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_push_outbox_user ON push_outbox(user_id, created_at)`),
  ]);
  schemaReady = true;
}

/* ─────────────────────────── VAPID (ES256) ─────────────────────────── */

async function vapidSigningKey(jwkStr: string): Promise<CryptoKey> {
  const j = JSON.parse(jwkStr) as { d: string; x: string; y: string };
  return crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", d: j.d, x: j.x, y: j.y, ext: true },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

/** Подписанный VAPID-JWT для конкретного пуш-сервиса (aud = origin endpoint). */
async function vapidJwt(env: DB, audience: string): Promise<string | null> {
  const jwkStr = await readConfig(env, "vapid_jwk");
  if (!jwkStr) return null;
  const sub = (await readConfig(env, "vapid_subject")) || "mailto:support@billionsx.com";
  const key = await vapidSigningKey(jwkStr);
  const header = b64u(enc.encode(JSON.stringify({ alg: "ES256", typ: "JWT" })));
  const payload = b64u(enc.encode(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub })));
  const signed = `${header}.${payload}`;
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(signed)));
  return `${signed}.${b64u(sig)}`;
}

/** Пустой web-push (tickle) на endpoint. Возвращает HTTP-статус пуш-сервиса (0 — не отправлено). */
async function sendTickle(env: DB, endpoint: string, pub: string): Promise<number> {
  let audience: string;
  try { audience = new URL(endpoint).origin; } catch { return 0; }
  const jwt = await vapidJwt(env, audience);
  if (!jwt) return 0;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `vapid t=${jwt}, k=${pub}`,
        TTL: "1800",
        Urgency: "normal",
        "Content-Length": "0",
      },
    });
    return res.status;
  } catch {
    return 0;
  }
}

/* ─────────────────────────── маршрутизатор API ─────────────────────────── */

export async function pushApi(request: Request, env: DB, url: URL): Promise<Response | null> {
  const p = url.pathname;
  if (!p.startsWith("/api/push") && !p.startsWith("/api/me/push")) return null;
  const method = request.method.toUpperCase();
  try { await ensurePushSchema(env); } catch { return err("server", 500); }

  const body = async (): Promise<Record<string, unknown>> => {
    try { return (await request.json()) as Record<string, unknown>; } catch { return {}; }
  };

  // Публичный: VAPID-открытый ключ (клиент подписывается им).
  if (p === "/api/push/vapid-public" && method === "GET") {
    const pub = await readConfig(env, "vapid_public");
    return jres({ key: pub || null });
  }

  // Всё остальное — под сессией.
  const uid = await currentUserId(env, request);
  if (!uid) return err("unauthorized", 401);

  // Подписка устройства на пуш.
  if (p === "/api/me/push/subscribe" && method === "POST") {
    const b = await body();
    const endpoint = clip(b.endpoint, 500);
    if (!endpoint || !/^https?:\/\//.test(endpoint)) return err("bad_request");
    const keys = (b.keys && typeof b.keys === "object" ? b.keys : {}) as Record<string, unknown>;
    const p256dh = clip(keys.p256dh, 200) || null;
    const auth = clip(keys.auth, 200) || null;
    const tz = Number.isFinite(Number(b.tzOffset)) ? Math.max(-840, Math.min(840, Math.round(Number(b.tzOffset)))) : 0;
    const cats = b.cats && typeof b.cats === "object" ? JSON.stringify(b.cats) : "{}";
    await env.DB.prepare(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, tz_offset, cats, last_seen)
       VALUES (?1,?2,?3,?4,?5,?6, datetime('now'))
       ON CONFLICT(endpoint) DO UPDATE SET
         user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
         tz_offset = excluded.tz_offset, cats = excluded.cats, last_seen = excluded.last_seen`,
    ).bind(uid, endpoint, p256dh, auth, tz, cats.slice(0, 400)).run();
    return jres({ ok: true });
  }

  // Отписка устройства.
  if (p === "/api/me/push/unsubscribe" && method === "POST") {
    const b = await body();
    const endpoint = clip(b.endpoint, 500);
    if (endpoint) await env.DB.prepare(`DELETE FROM push_subscriptions WHERE user_id = ?1 AND endpoint = ?2`).bind(uid, endpoint).run();
    return jres({ ok: true });
  }

  // Обновить набор категорий (по всем устройствам преданного).
  if (p === "/api/me/push/cats" && method === "PATCH") {
    const b = await body();
    const cats = b.cats && typeof b.cats === "object" ? JSON.stringify(b.cats).slice(0, 400) : "{}";
    await env.DB.prepare(`UPDATE push_subscriptions SET cats = ?2 WHERE user_id = ?1`).bind(uid, cats).run();
    return jres({ ok: true });
  }

  // SW дёргает при получении пуша — что показать (накопленное за последние 6ч).
  if (p === "/api/push/pending" && method === "GET") {
    const { results } = await env.DB.prepare(
      `SELECT id, title, body, url FROM push_outbox
       WHERE user_id = ?1 AND created_at >= datetime('now','-6 hours')
       ORDER BY created_at DESC LIMIT 5`,
    ).bind(uid).all();
    return jres({ items: results ?? [] });
  }

  return err("not_found", 404);
}

/* ─────────────────────────── крон: генерация уведомлений ─────────────────────────── */

const ymd = (d: Date) => d.toISOString().slice(0, 10);
function firstEn(nameI18n: string | null): string | null {
  if (!nameI18n) return null;
  try { const o = JSON.parse(nameI18n) as { en?: string }; return o.en || null; } catch { return null; }
}

interface SubRow { user_id: string; endpoint: string; tz_offset: number; cats: string }

/**
 * Один проход генерации уведомлений. Идемпотентен за счёт UNIQUE(user,cat,day):
 * при каждом тике крона (раз в 30 мин) создаём outbox-строку только один раз за
 * локальный день и только тогда шлём tickle на все устройства преданного.
 * Полностью изолирован (всё в try/catch): не должен ронять основной крон.
 */
export async function runNotifications(env: DB): Promise<void> {
  try {
    await ensurePushSchema(env);
  } catch { return; }
  const pub = await readConfig(env, "vapid_public");
  const jwk = await readConfig(env, "vapid_jwk");
  if (!pub || !jwk) return; // ключи не заданы — тихо выходим

  const subsRes = await env.DB.prepare(
    `SELECT user_id, endpoint, tz_offset, cats FROM push_subscriptions`,
  ).all<SubRow>();
  const subs = subsRes.results ?? [];
  if (!subs.length) return;

  // Группируем по преданному: время берём из первой подписки, категории — объединяем.
  const byUser = new Map<string, { offset: number; cats: Record<string, boolean>; endpoints: string[] }>();
  for (const s of subs) {
    let cats: Record<string, boolean> = {};
    try { cats = JSON.parse(s.cats) as Record<string, boolean>; } catch { cats = {}; }
    const cur = byUser.get(s.user_id);
    if (cur) { cur.endpoints.push(s.endpoint); for (const k in cats) if (cats[k]) cur.cats[k] = true; }
    else byUser.set(s.user_id, { offset: s.tz_offset || 0, cats: { ...cats }, endpoints: [s.endpoint] });
  }

  const nowMs = Date.now();
  for (const [uid, u] of byUser) {
    const local = new Date(nowMs + u.offset * 60_000);
    const day = ymd(local);
    const hour = local.getUTCHours();
    const tomorrow = ymd(new Date(local.getTime() + 86_400_000));

    const planned: { cat: string; title: string; body: string; url: string }[] = [];

    if (u.cats.verse && hour === 8) {
      planned.push({ cat: "verse", title: "Стих дня", body: "Начните день со священного слова — откройте стих дня.", url: "/practice/verse" });
    }
    if (u.cats.ekadashi && hour === 18) {
      const ek = await env.DB.prepare(
        `SELECT name_i18n FROM gcal_days WHERE date = ?1 AND kind = 'ekadashi_fast' LIMIT 1`,
      ).bind(tomorrow).first<{ name_i18n: string | null }>();
      if (ek) {
        const nm = firstEn(ek.name_i18n);
        planned.push({ cat: "ekadashi", title: "Завтра — Экадаши", body: nm ? `${nm}. День поста и усиленной практики — подготовьтесь.` : "День поста и усиленной практики — подготовьтесь.", url: "/calendar" });
      }
    }
    if (u.cats.festival && hour === 7) {
      const fe = await env.DB.prepare(
        `SELECT name_i18n FROM gcal_days WHERE date = ?1 AND kind = 'festival' LIMIT 1`,
      ).bind(day).first<{ name_i18n: string | null }>();
      const nm = fe ? firstEn(fe.name_i18n) : null;
      if (nm) planned.push({ cat: "festival", title: nm, body: "Сегодня праздник вайшнавского календаря.", url: "/calendar" });
    }
    if (u.cats.streak && hour === 20) {
      const goalRow = await env.DB.prepare(`SELECT data FROM user_prefs WHERE user_id = ?1`).bind(uid).first<{ data: string }>();
      let goal = 16;
      try { const g = Number((JSON.parse(goalRow?.data || "{}") as { sadhanaGoal?: unknown }).sadhanaGoal); if (Number.isFinite(g) && g >= 1 && g <= 64) goal = Math.round(g); } catch { /* default */ }
      const yest = ymd(new Date(local.getTime() - 86_400_000));
      const [todayR, yestR] = await Promise.all([
        env.DB.prepare(`SELECT COUNT(*) AS n FROM japa_round WHERE user_id = ?1 AND day = ?2`).bind(uid, day).first<{ n: number }>(),
        env.DB.prepare(`SELECT COUNT(*) AS n FROM japa_round WHERE user_id = ?1 AND day = ?2`).bind(uid, yest).first<{ n: number }>(),
      ]);
      const tn = todayR?.n ?? 0, yn = yestR?.n ?? 0;
      if (tn < goal && yn >= goal) {
        planned.push({ cat: "streak", title: "Серия под угрозой", body: `Сегодня закрыто ${tn} из ${goal} кругов — не прерывайте практику.`, url: "/practice/japa" });
      }
    }

    for (const pl of planned) {
      const ins = await env.DB.prepare(
        `INSERT OR IGNORE INTO push_outbox (user_id, category, day, title, body, url) VALUES (?1,?2,?3,?4,?5,?6)`,
      ).bind(uid, pl.cat, day, pl.title, pl.body, pl.url).run();
      if (!ins.meta.changes) continue; // уже слали сегодня
      const dead: string[] = [];
      for (const ep of u.endpoints) {
        const st = await sendTickle(env, ep, pub);
        if (st === 404 || st === 410) dead.push(ep);
      }
      if (dead.length) {
        for (const ep of dead) await env.DB.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?1`).bind(ep).run();
      }
    }
  }
}
