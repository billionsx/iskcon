/**
 * Личный кабинет — серверная часть (исполняется в воркере iskcon-web, тот же
 * origin, та же база D1, что и весь сайт). Здесь: регистрация, вход, сессия в
 * cookie (HttpOnly · Secure · SameSite=Lax), профиль и сбор всего, что преданный
 * отметил / читал / слушал (закладки, прогресс чтения, история прослушивания).
 *
 * Почему в этом воркере, а не в apps/api: cookie-сессия должна жить на том же
 * домене, что и фронт (gaurangers.com). Так браузер сам шлёт cookie на каждый
 * /api/* запрос — без CORS, без токена в localStorage (защита от XSS).
 *
 * Безопасность:
 *   - пароль: PBKDF2-HMAC-SHA256, 100 000 итераций, 16-байтная соль (WebCrypto).
 *   - токен сессии: 32 случайных байта; в БД хранится только SHA-256 от него
 *     (утечка БД не раскрывает живые сессии). Cookie — HttpOnly/Secure/Lax.
 *   - ответы кабинета НИКОГДА не кэшируются (private, no-store) и noindex.
 *
 * Схему таблиц гарантируем лениво (ensureSchema, CREATE IF NOT EXISTS) — она же
 * лежит миграцией apps/api/migrations/0004_user_accounts.sql; порядок выката не
 * критичен.
 */

import type { D1Database } from "@cloudflare/workers-types";

interface DB {
  DB: D1Database;
}

const NOINDEX = "noindex, nofollow, noarchive, nosnippet, noimageindex";
const COOKIE = "iol_sess";
const SESSION_TTL_SEC = 60 * 60 * 24 * 60; // 60 дней
const PBKDF2_ITERS = 100_000;

/* ─────────────────────────── ответы ─────────────────────────── */

function jres(data: unknown, opts: { status?: number; cookie?: string } = {}): Response {
  const h = new Headers({
    "content-type": "application/json; charset=utf-8",
    "Cache-Control": "private, no-store, must-revalidate",
    "X-Robots-Tag": NOINDEX,
    Vary: "Cookie",
  });
  if (opts.cookie) h.append("Set-Cookie", opts.cookie);
  return new Response(JSON.stringify(data), { status: opts.status ?? 200, headers: h });
}
const err = (code: string, status = 400) => jres({ error: code }, { status });

/* ─────────────────────────── crypto ─────────────────────────── */

const enc = new TextEncoder();

function b64u(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64u(s: string): Uint8Array {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function sha256(input: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return b64u(new Uint8Array(d));
}
function constEq(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i];
  return r === 0;
}
async function pbkdf2(password: string, salt: Uint8Array, iters: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: salt as BufferSource, iterations: iters, hash: "SHA-256" }, key, 256);
  return new Uint8Array(bits);
}
async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERS);
  return `pbkdf2$${PBKDF2_ITERS}$${b64u(salt)}$${b64u(hash)}`;
}
async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, itersStr, saltB64, hashB64] = stored.split("$");
  if (scheme !== "pbkdf2") return false;
  const iters = parseInt(itersStr, 10) || PBKDF2_ITERS;
  const salt = unb64u(saltB64);
  const expected = unb64u(hashB64);
  const actual = await pbkdf2(password, salt, iters);
  return constEq(actual, expected);
}
function hexId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/* ─────────────────────────── cookie ─────────────────────────── */

function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get("Cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}
function setCookie(token: string, maxAge: number): string {
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}
const clearCookie = () => `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;

/* ─────────────────────────── схема ─────────────────────────── */

let schemaReady = false;
async function ensureSchema(env: DB): Promise<void> {
  if (schemaReady) return;
  await env.DB.batch([
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS user_auth (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        password_hash TEXT NOT NULL,
        algo TEXT NOT NULL DEFAULT 'pbkdf2-sha256',
        email_verified INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
    ),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_seen TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at TEXT NOT NULL,
        user_agent TEXT,
        ip TEXT
      )`,
    ),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS bookmarks (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        ref TEXT NOT NULL,
        title TEXT,
        subtitle TEXT,
        href TEXT,
        cover TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (user_id, kind, ref)
      )`,
    ),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id, created_at)`),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS reading_progress (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        work TEXT NOT NULL,
        ref TEXT NOT NULL,
        label TEXT,
        kind TEXT NOT NULL DEFAULT 'chapter',
        href TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (user_id, work, ref)
      )`,
    ),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_progress_user ON reading_progress(user_id, updated_at)`),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS listening (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        source TEXT NOT NULL,
        ref TEXT NOT NULL,
        title TEXT,
        subtitle TEXT,
        cover TEXT,
        album TEXT,
        artist TEXT,
        href TEXT,
        duration_sec INTEGER,
        position_sec INTEGER,
        play_count INTEGER NOT NULL DEFAULT 1,
        first_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (user_id, source, ref)
      )`,
    ),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_listening_user ON listening(user_id, last_at)`),
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS user_prefs (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        data TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
    ),
    // Садхана · джапа: строка на завершённый круг. Источник правды — localStorage
    // на устройстве; здесь зеркало вошедшего пользователя. Идемпотентность по
    // (user_id, client_id). Зеркалирует apps/api/migrations/0006_japa.sql.
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS japa_round (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        day TEXT NOT NULL,
        at TEXT NOT NULL DEFAULT (datetime('now')),
        beads INTEGER NOT NULL DEFAULT 108,
        duration_sec INTEGER,
        client_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (user_id, client_id)
      )`,
    ),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_japa_user_day ON japa_round(user_id, day)`),
    // Дневник садханы — чтение/подъём/заметка на (преданный, день). Круги НЕ тут:
    // они берутся из japa_round (источник — счётчик джапы), чтобы метрика была
    // одна. `day` — локальный день «YYYY-MM-DD». Зеркалирует 0007_sadhana_day.sql.
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS sadhana_day (
        user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        day         TEXT NOT NULL,
        reading_min INTEGER NOT NULL DEFAULT 0,
        rose_at     TEXT,
        note        TEXT,
        ekadashi    INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (user_id, day)
      )`,
    ),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_sadhana_day_user ON sadhana_day(user_id, day)`),
    // Заметки садху. created_at/updated_at — epoch-ms (INTEGER): один с часами
    // клиента, чтобы синк решал конфликт «новее побеждает» детерминированно.
    env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT,
        body TEXT,
        plain TEXT,
        pinned INTEGER NOT NULL DEFAULT 0,
        color TEXT,
        kind TEXT,
        ref TEXT,
        src_title TEXT,
        src_subtitle TEXT,
        src_href TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
    ),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id, updated_at)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_notes_ref ON notes(user_id, kind, ref)`),
  ]);
  schemaReady = true;
}

/* ─────────────────────────── сессия/пользователь ─────────────────────────── */

interface UserRow {
  id: string;
  email: string | null;
  name: string | null;
  spiritual_name: string | null;
  // Профиль духовной ступени (Ц1 «Модель преданного»). Опциональны: старые
  // конструкции UserRow их не задают, а SELECT-ы подтягивают из БД.
  level?: string | null;
  initiation?: string | null;
  diksha_guru?: string | null;
  siksha_guru?: string | null;
  principles_since?: string | null;
  home_center_id?: string | null;
  created_at: string;
}
function publicUser(u: UserRow, emailVerified = 0) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    spiritualName: u.spiritual_name,
    level: u.level ?? null,
    initiation: u.initiation ?? null,
    dikshaGuru: u.diksha_guru ?? null,
    sikshaGuru: u.siksha_guru ?? null,
    principlesSince: u.principles_since ?? null,
    homeCenterId: u.home_center_id ?? null,
    createdAt: u.created_at,
    emailVerified: !!emailVerified,
  };
}

async function createSession(env: DB, userId: string, req: Request): Promise<string> {
  const token = b64u(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256(token);
  const ua = (req.headers.get("User-Agent") || "").slice(0, 300);
  const ip = (req.headers.get("CF-Connecting-IP") || "").slice(0, 64);
  const expires = new Date(Date.now() + SESSION_TTL_SEC * 1000).toISOString().replace("T", " ").slice(0, 19);
  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at, user_agent, ip)
     VALUES (?,?,?,?,?,?)`,
  ).bind(hexId(), userId, tokenHash, expires, ua, ip).run();
  return token;
}

async function sessionUser(env: DB, req: Request): Promise<{ user: UserRow; verified: number } | null> {
  const token = readCookie(req, COOKIE);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.spiritual_name,
            u.level, u.initiation, u.diksha_guru, u.siksha_guru, u.principles_since, u.home_center_id,
            u.created_at,
            COALESCE(a.email_verified,0) AS verified
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN user_auth a ON a.user_id = u.id
     WHERE s.token_hash = ?1 AND s.expires_at > datetime('now')
     LIMIT 1`,
  ).bind(tokenHash).first<UserRow & { verified: number }>();
  if (!row) return null;
  const { verified, ...u } = row as UserRow & { verified: number };
  return { user: u as UserRow, verified };
}

/**
 * Id вошедшего пользователя (users.id) по cookie-сессии, либо null.
 * Тонкая обёртка над sessionUser для других подсистем того же воркера
 * (например, управление центрами — apps/web/src/centers/server.ts), чтобы они
 * жили на той же сессии и не дублировали разбор cookie.
 */
export async function currentUserId(env: DB, req: Request): Promise<string | null> {
  const s = await sessionUser(env, req);
  return s ? s.user.id : null;
}

/* ─────────────────────────── валидация ─────────────────────────── */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const normEmail = (s: unknown) => String(s ?? "").trim().toLowerCase().slice(0, 200);
const clip = (s: unknown, n: number) => String(s ?? "").trim().slice(0, n);

/* ─────────────────────────── садхана · дневник ─────────────────────────── */
// Круги берём из japa_round (источник — счётчик джапы), а чтение/подъём/заметки —
// из sadhana_day. Здесь только агрегация и стрики; запись кругов идёт в /api/me/japa.

const SADHANA_GOAL_DEFAULT = 16;
const dayStr = (d: Date) => d.toISOString().slice(0, 10);
const isYmd = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
// Сдвиг «YYYY-MM-DD» на n дней. Строку трактуем как полночь UTC — арифметика без
// часовых поясов/DST (на отображаемый локальный день не влияет).
function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1) + n * 86_400_000).toISOString().slice(0, 10);
}

async function readGoal(env: DB, uid: string): Promise<number> {
  const row = await env.DB.prepare(`SELECT data FROM user_prefs WHERE user_id = ?1`).bind(uid).first<{ data: string }>();
  if (row?.data) {
    try {
      const g = Number((JSON.parse(row.data) as { sadhanaGoal?: unknown }).sadhanaGoal);
      if (Number.isFinite(g) && g >= 1 && g <= 64) return Math.round(g);
    } catch { /* default */ }
  }
  return SADHANA_GOAL_DEFAULT;
}
async function writeGoal(env: DB, uid: string, goal: number): Promise<void> {
  const g = Math.min(Math.max(Math.round(goal), 1), 64);
  const row = await env.DB.prepare(`SELECT data FROM user_prefs WHERE user_id = ?1`).bind(uid).first<{ data: string }>();
  let data: Record<string, unknown> = {};
  if (row?.data) { try { data = JSON.parse(row.data) as Record<string, unknown>; } catch { data = {}; } }
  data.sadhanaGoal = g;
  await env.DB.prepare(
    `INSERT INTO user_prefs (user_id, data, updated_at) VALUES (?1, ?2, datetime('now'))
     ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
  ).bind(uid, JSON.stringify(data)).run();
}

interface DiaryRow { day: string; reading_min: number; rose_at: string | null; note: string | null; ekadashi: number }

/** Полное состояние дневника: цель, сегодня, стрики, неделя, история. */
async function sadhanaState(env: DB, uid: string, today: string, histDays: number) {
  const goal = await readGoal(env, uid);
  const [jt, jDaysRes, dRowsRes, readAgg] = await Promise.all([
    env.DB.prepare(
      `SELECT COUNT(*) AS rounds, COUNT(DISTINCT day) AS days FROM japa_round WHERE user_id = ?1`,
    ).bind(uid).first<{ rounds: number; days: number }>(),
    env.DB.prepare(
      `SELECT day, COUNT(*) AS rounds FROM japa_round WHERE user_id = ?1 GROUP BY day`,
    ).bind(uid).all<{ day: string; rounds: number }>(),
    env.DB.prepare(
      `SELECT day, reading_min, rose_at, note, ekadashi FROM sadhana_day WHERE user_id = ?1`,
    ).bind(uid).all<DiaryRow>(),
    env.DB.prepare(
      `SELECT COALESCE(SUM(reading_min),0) AS reading FROM sadhana_day WHERE user_id = ?1`,
    ).bind(uid).first<{ reading: number }>(),
  ]);

  const roundsByDay = new Map<string, number>();
  for (const r of jDaysRes.results ?? []) roundsByDay.set(r.day, r.rounds);
  const diaryByDay = new Map<string, DiaryRow>();
  for (const r of dRowsRes.results ?? []) diaryByDay.set(r.day, r);

  const done = new Set<string>();
  for (const [day, rounds] of roundsByDay) if (rounds >= goal) done.add(day);

  // Текущий стрик: от сегодня (или вчера, если сегодня ещё не закрыто — незавершённый
  // день не рвёт серию) — назад по подряд идущим закрытым дням (круги ≥ цель).
  let current = 0;
  let cursor = done.has(today) ? today : addDays(today, -1);
  while (done.has(cursor)) { current++; cursor = addDays(cursor, -1); }

  // Рекорд: самый длинный отрезок подряд идущих закрытых дней.
  let longest = 0, run = 0, prev: string | null = null;
  for (const d of [...done].sort()) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = d;
  }

  const cell = (day: string) => {
    const dr = diaryByDay.get(day);
    return {
      day,
      rounds: roundsByDay.get(day) ?? 0,
      reading_min: dr?.reading_min ?? 0,
      rose_at: dr?.rose_at ?? null,
      note: dr?.note ?? null,
      ekadashi: dr?.ekadashi ?? 0,
    };
  };

  const week: { day: string; rounds: number; done: boolean; today: boolean }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today, -i);
    const rounds = roundsByDay.get(d) ?? 0;
    week.push({ day: d, rounds, done: rounds >= goal, today: d === today });
  }

  // История: дни с любой активностью (круги/чтение/подъём/заметка), свежие сверху.
  const allDays = new Set<string>([...roundsByDay.keys(), ...diaryByDay.keys()]);
  const history = [...allDays]
    .map(cell)
    .filter((c) => c.rounds > 0 || c.reading_min > 0 || c.rose_at || c.note)
    .sort((a, b) => (a.day < b.day ? 1 : -1))
    .slice(0, Math.min(Math.max(histDays, 1), 90));

  return {
    goal,
    today,
    todayRow: cell(today),
    stats: {
      todayRounds: roundsByDay.get(today) ?? 0,
      currentStreak: current,
      longestStreak: longest,
      totalRounds: jt?.rounds ?? 0,
      daysPracticed: jt?.days ?? 0,
      totalReadingMin: readAgg?.reading ?? 0,
    },
    week,
    history,
  };
}

/* ─────────────────────────── маршрутизатор ─────────────────────────── */

export async function accountApi(request: Request, env: DB, url: URL): Promise<Response | null> {
  const p = url.pathname;
  if (!p.startsWith("/api/auth/") && !p.startsWith("/api/me")) return null;

  try {
    await ensureSchema(env);
  } catch {
    return err("server", 500);
  }
  const method = request.method.toUpperCase();
  const body = async (): Promise<Record<string, unknown>> => {
    try {
      return (await request.json()) as Record<string, unknown>;
    } catch {
      return {};
    }
  };

  /* ───────── auth ───────── */

  if (p === "/api/auth/register" && method === "POST") {
    const b = await body();
    const email = normEmail(b.email);
    const password = String(b.password ?? "");
    const name = clip(b.name, 120) || null;
    if (!EMAIL_RE.test(email)) return err("bad_email");
    if (password.length < 8) return err("weak_password");
    if (password.length > 200) return err("weak_password");
    const exists = await env.DB.prepare(`SELECT id FROM users WHERE email = ?1 LIMIT 1`).bind(email).first<{ id: string }>();
    if (exists) return err("email_taken", 409);
    const userId = hexId();
    const hash = await hashPassword(password);
    try {
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO users (id, email, name) VALUES (?1,?2,?3)`).bind(userId, email, name),
        env.DB.prepare(`INSERT INTO user_auth (user_id, password_hash) VALUES (?1,?2)`).bind(userId, hash),
      ]);
    } catch {
      // гонка на UNIQUE(email)
      return err("email_taken", 409);
    }
    const token = await createSession(env, userId, request);
    const u: UserRow = { id: userId, email, name, spiritual_name: null, created_at: new Date().toISOString().slice(0, 19).replace("T", " ") };
    return jres({ user: publicUser(u) }, { cookie: setCookie(token, SESSION_TTL_SEC) });
  }

  if (p === "/api/auth/login" && method === "POST") {
    const b = await body();
    const email = normEmail(b.email);
    const password = String(b.password ?? "");
    if (!email || !password) return err("bad_credentials", 401);
    const row = await env.DB.prepare(
      `SELECT u.id, u.email, u.name, u.spiritual_name,
              u.level, u.initiation, u.diksha_guru, u.siksha_guru, u.principles_since, u.home_center_id,
              u.created_at,
              a.password_hash, COALESCE(a.email_verified,0) AS verified
       FROM users u JOIN user_auth a ON a.user_id = u.id
       WHERE u.email = ?1 LIMIT 1`,
    ).bind(email).first<UserRow & { password_hash: string; verified: number }>();
    if (!row) {
      // выравниваем тайминг, чтобы не палить наличие email
      await pbkdf2(password, new Uint8Array(16), PBKDF2_ITERS).catch(() => undefined);
      return err("bad_credentials", 401);
    }
    const ok = await verifyPassword(password, row.password_hash);
    if (!ok) return err("bad_credentials", 401);
    const token = await createSession(env, row.id, request);
    return jres({ user: publicUser(row, row.verified) }, { cookie: setCookie(token, SESSION_TTL_SEC) });
  }

  if (p === "/api/auth/logout" && method === "POST") {
    const token = readCookie(request, COOKIE);
    if (token) {
      try {
        await env.DB.prepare(`DELETE FROM sessions WHERE token_hash = ?1`).bind(await sha256(token)).run();
      } catch {
        /* всё равно гасим cookie */
      }
    }
    return jres({ ok: true }, { cookie: clearCookie() });
  }

  if (p === "/api/auth/me" && method === "GET") {
    const s = await sessionUser(env, request);
    return jres({ user: s ? publicUser(s.user, s.verified) : null });
  }

  /* ───────── всё ниже требует сессии ───────── */

  const session = await sessionUser(env, request);
  if (!session) return err("unauthorized", 401);
  const uid = session.user.id;

  // профиль
  if (p === "/api/me/profile" && method === "PATCH") {
    const b = await body();
    // Ступень практики (самоопределение) и факт инициации — по закрытым словарям.
    // Значение вне словаря трактуем как «сброшено» (null), а не как ошибку запроса.
    const LEVELS = new Set(["guest", "neophyte", "practicing", "initiated", "guru"]);
    const INITS = new Set(["none", "harinama", "brahmin"]);
    // Собираем SET динамически: обновляем ТОЛЬКО присланные ключи (экран профиля —
    // источник правды на «Готово»; пустая строка → NULL = поле очищено).
    const sets: string[] = [];
    const vals: (string | null)[] = [];
    const put = (col: string, v: string | null) => { sets.push(`${col} = ?${vals.length + 2}`); vals.push(v); };
    if ("name" in b) put("name", clip(b.name, 120) || null);
    if ("spiritualName" in b) put("spiritual_name", clip(b.spiritualName, 120) || null);
    if ("level" in b) { const v = clip(b.level, 20); put("level", LEVELS.has(v) ? v : null); }
    if ("initiation" in b) { const v = clip(b.initiation, 20); put("initiation", INITS.has(v) ? v : null); }
    if ("dikshaGuru" in b) put("diksha_guru", clip(b.dikshaGuru, 120) || null);
    if ("sikshaGuru" in b) put("siksha_guru", clip(b.sikshaGuru, 120) || null);
    if ("principlesSince" in b) { const v = clip(b.principlesSince, 10); put("principles_since", /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null); }
    if ("homeCenterId" in b) put("home_center_id", clip(b.homeCenterId, 80) || null);
    if (sets.length) {
      await env.DB.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?1`).bind(uid, ...vals).run();
    }
    // Норма кругов — не колонка users, а единый sadhanaGoal в user_prefs.
    if ("chantNorm" in b && Number.isFinite(Number(b.chantNorm))) await writeGoal(env, uid, Number(b.chantNorm));
    const u = await env.DB.prepare(
      `SELECT id, email, name, spiritual_name, level, initiation, diksha_guru, siksha_guru, principles_since, home_center_id, created_at
       FROM users WHERE id = ?1`,
    ).bind(uid).first<UserRow>();
    return jres({ user: u ? publicUser(u, session.verified) : null });
  }

  // прогресс чтения (вызывается ридером при открытии главы/стиха)
  if (p === "/api/me/progress" && method === "POST") {
    const b = await body();
    const work = clip(b.work, 24);
    const ref = clip(b.ref, 80);
    if (!work || !ref) return err("bad_request");
    const label = clip(b.label, 160) || null;
    const kind = clip(b.kind, 16) || "chapter";
    const href = clip(b.href, 200) || null;
    await env.DB.prepare(
      `INSERT INTO reading_progress (user_id, work, ref, label, kind, href, updated_at)
       VALUES (?1,?2,?3,?4,?5,?6, datetime('now'))
       ON CONFLICT(user_id, work, ref) DO UPDATE SET
         label = excluded.label, kind = excluded.kind, href = excluded.href, updated_at = excluded.updated_at`,
    ).bind(uid, work, ref, label, kind, href).run();
    return jres({ ok: true });
  }

  // история прослушивания (вызывается плеером при старте трека)
  if (p === "/api/me/listen" && method === "POST") {
    const b = await body();
    const source = clip(b.source, 16) || "book";
    const ref = clip(b.ref, 200);
    if (!ref) return err("bad_request");
    const title = clip(b.title, 200) || null;
    const subtitle = clip(b.subtitle, 200) || null;
    const cover = clip(b.cover, 300) || null;
    const album = clip(b.album, 200) || null;
    const artist = clip(b.artist, 200) || null;
    const href = clip(b.href, 200) || null;
    const dur = Number.isFinite(Number(b.durationSec)) ? Math.max(0, Math.round(Number(b.durationSec))) : null;
    const pos = Number.isFinite(Number(b.positionSec)) ? Math.max(0, Math.round(Number(b.positionSec))) : null;
    await env.DB.prepare(
      `INSERT INTO listening (user_id, source, ref, title, subtitle, cover, album, artist, href, duration_sec, position_sec, last_at)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11, datetime('now'))
       ON CONFLICT(user_id, source, ref) DO UPDATE SET
         title = excluded.title, subtitle = excluded.subtitle, cover = excluded.cover,
         album = excluded.album, artist = excluded.artist, href = excluded.href,
         duration_sec = COALESCE(excluded.duration_sec, listening.duration_sec),
         position_sec = excluded.position_sec,
         play_count = listening.play_count + 1, last_at = excluded.last_at`,
    ).bind(uid, source, ref, title, subtitle, cover, album, artist, href, dur, pos).run();
    return jres({ ok: true });
  }

  // закладки / избранное
  if (p === "/api/me/bookmark") {
    if (method === "GET") {
      const kind = clip(url.searchParams.get("kind"), 16);
      const ref = clip(url.searchParams.get("ref"), 200);
      if (!kind || !ref) return err("bad_request");
      const row = await env.DB.prepare(
        `SELECT 1 FROM bookmarks WHERE user_id = ?1 AND kind = ?2 AND ref = ?3 LIMIT 1`,
      ).bind(uid, kind, ref).first();
      return jres({ saved: !!row });
    }
    if (method === "POST") {
      const b = await body();
      const kind = clip(b.kind, 16);
      const ref = clip(b.ref, 200);
      if (!kind || !ref) return err("bad_request");
      const existing = await env.DB.prepare(
        `SELECT id FROM bookmarks WHERE user_id = ?1 AND kind = ?2 AND ref = ?3 LIMIT 1`,
      ).bind(uid, kind, ref).first<{ id: string }>();
      // `set` (булево) — детерминированно задаёт состояние (зеркалирование из
      // клиентского «Избранное»); без него — обычный тумблер по тапу сердечка.
      const want = typeof b.set === "boolean" ? b.set : !existing;
      if (!want) {
        if (existing) await env.DB.prepare(`DELETE FROM bookmarks WHERE id = ?1`).bind(existing.id).run();
        return jres({ saved: false });
      }
      if (!existing) {
        await env.DB.prepare(
          `INSERT INTO bookmarks (user_id, kind, ref, title, subtitle, href, cover)
           VALUES (?1,?2,?3,?4,?5,?6,?7)`,
        ).bind(uid, kind, ref, clip(b.title, 200) || null, clip(b.subtitle, 200) || null, clip(b.href, 200) || null, clip(b.cover, 300) || null).run();
      }
      return jres({ saved: true });
    }
    if (method === "DELETE") {
      const kind = clip(url.searchParams.get("kind"), 16);
      const ref = clip(url.searchParams.get("ref"), 200);
      await env.DB.prepare(`DELETE FROM bookmarks WHERE user_id = ?1 AND kind = ?2 AND ref = ?3`).bind(uid, kind, ref).run();
      return jres({ saved: false });
    }
  }

  // заметки садху — local-first на клиенте; здесь бэкап + кросс-устройство.
  // POST — upsert по id с защитой «не затирать более свежее» (updated_at, epoch-ms).
  if (p === "/api/me/notes") {
    if (method === "GET") {
      const { results } = await env.DB.prepare(
        `SELECT id, title, body, plain, pinned, color, kind, ref, src_title, src_subtitle, src_href, created_at, updated_at
         FROM notes WHERE user_id = ?1 ORDER BY updated_at DESC LIMIT 2000`,
      ).bind(uid).all();
      return jres({ items: results ?? [] });
    }
    if (method === "POST") {
      const b = await body();
      const id = clip(b.id, 64);
      if (!id) return err("bad_request");
      const num = (v: unknown, d: number) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n > 0 ? n : d; };
      const now = Date.now();
      await env.DB.prepare(
        `INSERT INTO notes (id, user_id, title, body, plain, pinned, color, kind, ref, src_title, src_subtitle, src_href, created_at, updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title, body = excluded.body, plain = excluded.plain,
           pinned = excluded.pinned, color = excluded.color, kind = excluded.kind, ref = excluded.ref,
           src_title = excluded.src_title, src_subtitle = excluded.src_subtitle, src_href = excluded.src_href,
           updated_at = excluded.updated_at
         WHERE notes.user_id = excluded.user_id AND excluded.updated_at >= notes.updated_at`,
      ).bind(
        id, uid,
        clip(b.title, 200) || null,
        clip(b.body, 100000) || null,
        clip(b.plain, 100000) || null,
        b.pinned ? 1 : 0,
        clip(b.color, 24) || null,
        clip(b.kind, 24) || null,
        clip(b.ref, 200) || null,
        clip(b.srcTitle, 200) || null,
        clip(b.srcSubtitle, 200) || null,
        clip(b.srcHref, 300) || null,
        num(b.createdAt, now),
        num(b.updatedAt, now),
      ).run();
      return jres({ ok: true });
    }
    if (method === "DELETE") {
      const id = clip(url.searchParams.get("id"), 64);
      if (!id) return err("bad_request");
      await env.DB.prepare(`DELETE FROM notes WHERE user_id = ?1 AND id = ?2`).bind(uid, id).run();
      return jres({ ok: true });
    }
  }

  // сводка кабинета — всё разом
  if (p === "/api/me/overview" && method === "GET") {
    const [stats, cont, lib, listen, marks] = await Promise.all([
      env.DB.prepare(
        `SELECT
           (SELECT COUNT(*) FROM reading_progress WHERE user_id = ?1) AS reading,
           (SELECT COUNT(DISTINCT work) FROM reading_progress WHERE user_id = ?1) AS books,
           (SELECT COUNT(*) FROM listening WHERE user_id = ?1) AS listening,
           (SELECT COUNT(*) FROM bookmarks WHERE user_id = ?1) AS bookmarks`,
      ).bind(uid).first<{ reading: number; books: number; listening: number; bookmarks: number }>(),
      // последняя позиция по каждой книге (bare-column + MAX → строка с максимумом)
      env.DB.prepare(
        `SELECT work, ref, label, kind, href, MAX(updated_at) AS updated_at
         FROM reading_progress WHERE user_id = ?1
         GROUP BY work ORDER BY updated_at DESC LIMIT 4`,
      ).bind(uid).all(),
      env.DB.prepare(
        `SELECT work, COUNT(*) AS reads, MAX(updated_at) AS updated_at
         FROM reading_progress WHERE user_id = ?1
         GROUP BY work ORDER BY updated_at DESC`,
      ).bind(uid).all(),
      env.DB.prepare(
        `SELECT source, ref, title, subtitle, cover, album, artist, href, duration_sec, position_sec, play_count, last_at
         FROM listening WHERE user_id = ?1 ORDER BY last_at DESC LIMIT 6`,
      ).bind(uid).all(),
      env.DB.prepare(
        `SELECT kind, ref, title, subtitle, href, cover, created_at
         FROM bookmarks WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 8`,
      ).bind(uid).all(),
    ]);
    return jres({
      stats: stats ?? { reading: 0, books: 0, listening: 0, bookmarks: 0 },
      continueReading: cont.results ?? [],
      library: lib.results ?? [],
      recentListening: listen.results ?? [],
      bookmarks: marks.results ?? [],
    });
  }

  // полные списки с пагинацией («показать все»)
  if (p === "/api/me/list" && method === "GET") {
    const type = clip(url.searchParams.get("type"), 16);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 1), 200);
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10) || 0, 0);
    let sql: string;
    if (type === "reading") {
      sql = `SELECT work, ref, label, kind, href, updated_at FROM reading_progress WHERE user_id = ?1 ORDER BY updated_at DESC LIMIT ${limit} OFFSET ${offset}`;
    } else if (type === "listening") {
      sql = `SELECT source, ref, title, subtitle, cover, album, artist, href, duration_sec, position_sec, play_count, last_at FROM listening WHERE user_id = ?1 ORDER BY last_at DESC LIMIT ${limit} OFFSET ${offset}`;
    } else if (type === "bookmarks") {
      sql = `SELECT kind, ref, title, subtitle, href, cover, created_at FROM bookmarks WHERE user_id = ?1 ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    } else {
      return err("bad_request");
    }
    const { results } = await env.DB.prepare(sql).bind(uid).all();
    return jres({ items: results ?? [] });
  }

  // садхана · джапа — приём завершённых кругов (зеркало локального счётчика) и
  // выдача дневной агрегации за последний год (для сводки кабинета и кросс-
  // устройства). На устройстве источник правды — localStorage; сюда летят только
  // новые круги, идемпотентно по (user_id, client_id).
  if (p === "/api/me/japa") {
    if (method === "POST") {
      const b = await body();
      const raw = Array.isArray(b.rounds) ? (b.rounds as unknown[]) : [];
      if (!raw.length) return jres({ ok: true, saved: 0 });
      // Жёсткий потолок на одну отправку — защита от мусора.
      const items = raw.slice(0, 500).map((r) => {
        const o = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
        const day = clip(o.day, 10); // YYYY-MM-DD
        const at = clip(o.at, 32) || new Date().toISOString().slice(0, 19).replace("T", " ");
        const beads = Number.isFinite(Number(o.beads)) ? Math.min(100000, Math.max(1, Math.round(Number(o.beads)))) : 108;
        const dur = Number.isFinite(Number(o.durationSec)) ? Math.min(86400, Math.max(0, Math.round(Number(o.durationSec)))) : null;
        const cid = clip(o.id, 80) || null;
        return { day, at, beads, dur, cid };
      }).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.day));
      if (!items.length) return err("bad_request");
      await env.DB.batch(
        items.map((x) =>
          env.DB.prepare(
            `INSERT INTO japa_round (user_id, day, at, beads, duration_sec, client_id)
             VALUES (?1,?2,?3,?4,?5,?6)
             ON CONFLICT(user_id, client_id) DO NOTHING`,
          ).bind(uid, x.day, x.at, x.beads, x.dur, x.cid),
        ),
      );
      return jres({ ok: true, saved: items.length });
    }
    if (method === "GET") {
      const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const [totals, days] = await Promise.all([
        env.DB.prepare(
          `SELECT COUNT(*) AS rounds, COALESCE(SUM(beads),0) AS beads, COALESCE(SUM(duration_sec),0) AS seconds,
                  COUNT(DISTINCT day) AS days
           FROM japa_round WHERE user_id = ?1`,
        ).bind(uid).first<{ rounds: number; beads: number; seconds: number; days: number }>(),
        env.DB.prepare(
          `SELECT day, COUNT(*) AS rounds, COALESCE(SUM(beads),0) AS beads, COALESCE(SUM(duration_sec),0) AS seconds
           FROM japa_round WHERE user_id = ?1 AND day >= ?2
           GROUP BY day ORDER BY day`,
        ).bind(uid, since).all(),
      ]);
      return jres({
        totals: totals ?? { rounds: 0, beads: 0, seconds: 0, days: 0 },
        days: days.results ?? [],
      });
    }
  }

  // садхана · дневник — чтение/подъём/заметка дня + агрегация со счётчиком джапы
  // (круги → стрики и статистика). Запись кругов идёт через /api/me/japa.
  if (p === "/api/me/sadhana") {
    const qToday = url.searchParams.get("today");
    const today = isYmd(qToday) ? qToday : dayStr(new Date());

    if (method === "GET") {
      const days = Math.min(Math.max(parseInt(url.searchParams.get("days") || "21", 10) || 21, 1), 90);
      return jres(await sadhanaState(env, uid, today, days));
    }

    if (method === "POST") {
      const b = await body();
      const anchor = isYmd(b.today) ? b.today : today;   // якорь стриков (реальное «сегодня»)
      const day = isYmd(b.day) ? b.day : anchor;         // день, в который пишем

      let touched = false;
      if ("goal" in b && Number.isFinite(Number(b.goal))) { await writeGoal(env, uid, Number(b.goal)); touched = true; }

      const hasReading = "readingMin" in b && Number.isFinite(Number(b.readingMin));
      const hasRose = "roseAt" in b;
      const hasNote = "note" in b;
      const hasEkadashi = "ekadashi" in b;
      if (hasReading || hasRose || hasNote || hasEkadashi) {
        const cur = await env.DB.prepare(
          `SELECT reading_min, rose_at, note, ekadashi FROM sadhana_day WHERE user_id = ?1 AND day = ?2`,
        ).bind(uid, day).first<{ reading_min: number; rose_at: string | null; note: string | null; ekadashi: number }>();
        const reading = hasReading ? Math.min(Math.max(Math.round(Number(b.readingMin)), 0), 1440) : (cur?.reading_min ?? 0);
        let rose: string | null;
        if (hasRose) { const v = clip(b.roseAt, 5); rose = /^\d{1,2}:\d{2}$/.test(v) ? v : null; }
        else rose = cur?.rose_at ?? null;
        const note = hasNote ? (clip(b.note, 500) || null) : (cur?.note ?? null);
        const ekadashi = hasEkadashi ? (b.ekadashi ? 1 : 0) : (cur?.ekadashi ?? 0);
        await env.DB.prepare(
          `INSERT INTO sadhana_day (user_id, day, reading_min, rose_at, note, ekadashi, updated_at)
           VALUES (?1,?2,?3,?4,?5,?6, datetime('now'))
           ON CONFLICT(user_id, day) DO UPDATE SET
             reading_min = ?3, rose_at = ?4, note = ?5, ekadashi = ?6, updated_at = datetime('now')`,
        ).bind(uid, day, reading, rose, note, ekadashi).run();
        touched = true;
      }

      if (!touched) return err("bad_request");
      return jres(await sadhanaState(env, uid, anchor, 21));
    }
  }

  return err("not_found", 404);
}
