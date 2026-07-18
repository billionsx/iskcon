/**
 * Вход через внешние аккаунты: Apple · Google · Яндекс ID · VK ID.
 *
 * АРХИТЕКТУРА. Классический серверный OAuth-код-флоу на том же домене, что и
 * фронт (gaurangers.com), — cookie-сессия кабинета ставится прямо в ответе
 * колбэка, ни один токен провайдера не попадает в браузер.
 *
 *   GET  /api/auth/providers                 → какие кнопки показывать
 *   GET  /api/auth/oauth/:p/start?to=/path   → 302 на страницу входа провайдера
 *   GET|POST /api/auth/oauth/:p/callback     → обмен кода, вход/линк, 302 в app
 *
 * STATE — ТОЛЬКО В D1 (oauth_states), не в cookie. Причина: Apple с scope
 * name/email обязан отвечать response_mode=form_post — это МЕЖСАЙТОВЫЙ POST,
 * на котором браузер не шлёт SameSite=Lax cookie. Строка state несёт и CSRF-
 * защиту, и PKCE-verifier (VK ID требует PKCE), и путь возврата, и линк-режим
 * (подключение провайдера к уже вошедшему пользователю).
 *
 * КЛЮЧИ ПРОВАЙДЕРОВ — в app_config (та же схема, что VAPID у пушей):
 *   oauth_google_client_id · oauth_google_client_secret
 *   oauth_apple_client_id  · oauth_apple_team_id · oauth_apple_key_id ·
 *   oauth_apple_private_key (содержимое .p8, PEM)
 *   oauth_yandex_client_id · oauth_yandex_client_secret
 *   oauth_vk_client_id     (VK ID работает по PKCE, секрет не нужен)
 * Redirect URI в консолях провайдеров: {ORIGIN}/api/auth/oauth/<p>/callback.
 *
 * ПРИВЯЗКА К ПОЛЬЗОВАТЕЛЮ (resolveUser):
 *   1. identity уже знакома → входим её владельцем;
 *   2. активна сессия (режим «подключить») → цепляем identity к ней;
 *   3. провайдер дал ПОДТВЕРЖДЁННЫЙ e-mail и такой пользователь есть → это он
 *      (безопасно: почта верифицирована провайдером, захват чужого аккаунта
 *      по невалидированной почте исключён);
 *   4. иначе создаём нового пользователя.
 */

import type { D1Database } from "@cloudflare/workers-types";
import { ROUTES, url as fullUrl } from "../routes";
import { createSession, setCookie, SESSION_TTL_SEC, hexId, currentUserId, type DB } from "./server";

/* ─────────────────────────── конфигурация ─────────────────────────── */

interface OAuthCfg {
  google?: { clientId: string; clientSecret: string };
  apple?: { clientId: string; teamId: string; keyId: string; privateKey: string };
  yandex?: { clientId: string; clientSecret: string };
  vk?: { clientId: string };
}

export type ProviderId = "google" | "apple" | "yandex" | "vk";
const PROVIDERS: ProviderId[] = ["apple", "google", "yandex", "vk"];

async function readCfg(db: D1Database): Promise<OAuthCfg> {
  const rows = await db
    .prepare(`SELECT key, value FROM app_config WHERE key LIKE 'oauth_%'`)
    .all<{ key: string; value: string }>();
  const m = new Map((rows.results ?? []).map((r) => [r.key, r.value.trim()]));
  const g = (k: string) => m.get(k) || "";
  const cfg: OAuthCfg = {};
  if (g("oauth_google_client_id") && g("oauth_google_client_secret"))
    cfg.google = { clientId: g("oauth_google_client_id"), clientSecret: g("oauth_google_client_secret") };
  if (g("oauth_apple_client_id") && g("oauth_apple_team_id") && g("oauth_apple_key_id") && g("oauth_apple_private_key"))
    cfg.apple = { clientId: g("oauth_apple_client_id"), teamId: g("oauth_apple_team_id"), keyId: g("oauth_apple_key_id"), privateKey: g("oauth_apple_private_key") };
  if (g("oauth_yandex_client_id") && g("oauth_yandex_client_secret"))
    cfg.yandex = { clientId: g("oauth_yandex_client_id"), clientSecret: g("oauth_yandex_client_secret") };
  if (g("oauth_vk_client_id")) cfg.vk = { clientId: g("oauth_vk_client_id") };
  return cfg;
}

/* ─────────────────────────── мелкие утилиты ─────────────────────────── */

const enc = new TextEncoder();

function b64u(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function unb64uStr(s: string): string {
  const b = s.replace(/-/g, "+").replace(/_/g, "/");
  return atob(b + "===".slice((b.length + 3) % 4));
}
async function sha256b64u(input: string): Promise<string> {
  return b64u(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(input))));
}
function rnd(bytes = 32): string {
  return b64u(crypto.getRandomValues(new Uint8Array(bytes)));
}
/** Полезная нагрузка JWT без проверки подписи — id_token получен нами напрямую
 *  с token-endpoint провайдера по TLS, подпись избыточна (стандарт для
 *  confidential-клиента). */
function jwtPayload(idToken: string): Record<string, unknown> {
  try {
    return JSON.parse(unb64uStr(idToken.split(".")[1] ?? "")) as Record<string, unknown>;
  } catch {
    return {};
  }
}
const s = (v: unknown) => (typeof v === "string" ? v : "");
const clip = (v: unknown, n: number) => s(v).trim().slice(0, n);

const redirectUri = (p: ProviderId) => fullUrl(ROUTES.apiOauthCallback(p));

/** Путь возврата в приложение: только свой относительный путь. */
function safeTo(v: string | null): string {
  if (!v || !v.startsWith("/") || v.startsWith("//") || v.includes("\\")) return ROUTES.id();
  return v.slice(0, 300);
}

function redirect(to: string, cookie?: string): Response {
  const h = new Headers({ Location: to, "Cache-Control": "private, no-store" });
  if (cookie) h.append("Set-Cookie", cookie);
  return new Response(null, { status: 302, headers: h });
}
const fail = (code: string) => redirect(`/account?authError=${encodeURIComponent(code)}`);

/* ─────────────────────────── Apple client_secret (ES256 JWT) ───────────────── */

function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

async function appleClientSecret(cfg: NonNullable<OAuthCfg["apple"]>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64u(enc.encode(JSON.stringify({ alg: "ES256", kid: cfg.keyId })));
  const payload = b64u(enc.encode(JSON.stringify({ iss: cfg.teamId, iat: now, exp: now + 300, aud: "https://appleid.apple.com", sub: cfg.clientId })));
  const key = await crypto.subtle.importKey("pkcs8", pemToPkcs8(cfg.privateKey), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${header}.${payload}`));
  return `${header}.${payload}.${b64u(new Uint8Array(sig))}`;
}

/* ─────────────────────────── нормализованный профиль ─────────────────────── */

interface Profile {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  avatar: string | null;
}

async function form(url: string, body: Record<string, string>, headers: Record<string, string> = {}): Promise<Record<string, unknown>> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", ...headers },
    body: new URLSearchParams(body).toString(),
  });
  try {
    return (await r.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/* ─────────────────────────── адреса авторизации ─────────────────────────── */

async function authorizeUrl(p: ProviderId, cfg: OAuthCfg, state: string, verifier: string): Promise<string | null> {
  if (p === "google" && cfg.google) {
    const q = new URLSearchParams({
      client_id: cfg.google.clientId, redirect_uri: redirectUri(p), response_type: "code",
      scope: "openid email profile", state, prompt: "select_account",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
  }
  if (p === "apple" && cfg.apple) {
    const q = new URLSearchParams({
      client_id: cfg.apple.clientId, redirect_uri: redirectUri(p), response_type: "code",
      scope: "name email", response_mode: "form_post", state,
    });
    return `https://appleid.apple.com/auth/authorize?${q}`;
  }
  if (p === "yandex" && cfg.yandex) {
    const q = new URLSearchParams({ response_type: "code", client_id: cfg.yandex.clientId, redirect_uri: redirectUri(p), state });
    return `https://oauth.yandex.ru/authorize?${q}`;
  }
  if (p === "vk" && cfg.vk) {
    const q = new URLSearchParams({
      response_type: "code", client_id: cfg.vk.clientId, redirect_uri: redirectUri(p), state,
      code_challenge: await sha256b64u(verifier), code_challenge_method: "S256", scope: "email",
    });
    return `https://id.vk.com/authorize?${q}`;
  }
  return null;
}

/* ─────────────────────────── обмен кода → профиль ─────────────────────────── */

async function exchange(
  p: ProviderId, cfg: OAuthCfg, code: string,
  extra: { verifier: string; deviceId: string; state: string; appleUser: string },
): Promise<Profile | null> {
  if (p === "google" && cfg.google) {
    const t = await form("https://oauth2.googleapis.com/token", {
      code, client_id: cfg.google.clientId, client_secret: cfg.google.clientSecret,
      redirect_uri: redirectUri(p), grant_type: "authorization_code",
    });
    const pl = jwtPayload(s(t.id_token));
    const uid = s(pl.sub);
    if (!uid) return null;
    return {
      uid,
      email: s(pl.email).toLowerCase() || null,
      emailVerified: pl.email_verified === true || pl.email_verified === "true",
      name: clip(pl.name, 120) || null,
      avatar: s(pl.picture) || null,
    };
  }

  if (p === "apple" && cfg.apple) {
    const secret = await appleClientSecret(cfg.apple);
    const t = await form("https://appleid.apple.com/auth/token", {
      code, client_id: cfg.apple.clientId, client_secret: secret,
      redirect_uri: redirectUri(p), grant_type: "authorization_code",
    });
    const pl = jwtPayload(s(t.id_token));
    const uid = s(pl.sub);
    if (!uid) return null;
    // Имя Apple присылает ОДИН раз — form-полем `user` первого колбэка.
    let name: string | null = null;
    try {
      const u = JSON.parse(extra.appleUser) as { name?: { firstName?: string; lastName?: string } };
      name = clip([u?.name?.firstName, u?.name?.lastName].filter(Boolean).join(" "), 120) || null;
    } catch { /* имени нет — не страшно */ }
    return {
      uid,
      email: s(pl.email).toLowerCase() || null,
      emailVerified: pl.email_verified === true || pl.email_verified === "true",
      name,
      avatar: null,
    };
  }

  if (p === "yandex" && cfg.yandex) {
    const t = await form("https://oauth.yandex.ru/token", {
      grant_type: "authorization_code", code, client_id: cfg.yandex.clientId, client_secret: cfg.yandex.clientSecret,
    });
    const at = s(t.access_token);
    if (!at) return null;
    const r = await fetch("https://login.yandex.ru/info?format=json", { headers: { Authorization: `OAuth ${at}` } });
    const info = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    const uid = s(info.id);
    if (!uid) return null;
    const avatarId = s(info.default_avatar_id);
    return {
      uid,
      email: s(info.default_email).toLowerCase() || null,
      emailVerified: !!s(info.default_email), // default_email Яндекса — подтверждённый ящик аккаунта
      name: clip(info.real_name || info.display_name || [info.first_name, info.last_name].filter(Boolean).join(" "), 120) || null,
      avatar: avatarId && info.is_avatar_empty !== true ? `https://avatars.yandex.net/get-yapic/${avatarId}/islands-200` : null,
    };
  }

  if (p === "vk" && cfg.vk) {
    const t = await form("https://id.vk.com/oauth2/auth", {
      grant_type: "authorization_code", code, code_verifier: extra.verifier,
      client_id: cfg.vk.clientId, device_id: extra.deviceId, redirect_uri: redirectUri(p), state: extra.state,
    });
    const at = s(t.access_token);
    const uidTok = t.user_id != null ? String(t.user_id) : "";
    if (!at) return null;
    const info = await form("https://id.vk.com/oauth2/user_info", { client_id: cfg.vk.clientId, access_token: at });
    const u = (info.user ?? {}) as Record<string, unknown>;
    const uid = u.user_id != null ? String(u.user_id) : uidTok;
    if (!uid) return null;
    const email = s(u.email || t.email).toLowerCase() || null;
    return {
      uid,
      email,
      emailVerified: !!email, // VK ID отдаёт почту только с верифицированного аккаунта
      name: clip([u.first_name, u.last_name].filter(Boolean).join(" "), 120) || null,
      avatar: s(u.avatar) || null,
    };
  }

  return null;
}

/* ─────────────────────────── привязка/создание пользователя ───────────────── */

async function resolveUser(db: D1Database, p: ProviderId, prof: Profile, linkUser: string | null): Promise<{ userId: string } | { error: string }> {
  const known = await db
    .prepare(`SELECT user_id FROM auth_identities WHERE provider = ?1 AND provider_uid = ?2 LIMIT 1`)
    .bind(p, prof.uid)
    .first<{ user_id: string }>();

  if (known) {
    if (linkUser && known.user_id !== linkUser) return { error: "identity_taken" };
    await db
      .prepare(`UPDATE auth_identities SET email=?3, name=COALESCE(?4,name), avatar=COALESCE(?5,avatar) WHERE provider=?1 AND provider_uid=?2`)
      .bind(p, prof.uid, prof.email, prof.name, prof.avatar)
      .run()
      .catch(() => undefined);
    return { userId: known.user_id };
  }

  const attach = async (userId: string) => {
    await db
      .prepare(`INSERT OR IGNORE INTO auth_identities (provider, provider_uid, user_id, email, name, avatar) VALUES (?1,?2,?3,?4,?5,?6)`)
      .bind(p, prof.uid, userId, prof.email, prof.name, prof.avatar)
      .run();
    // Провайдер верифицировал почту → парольная учётка (если есть) считается подтверждённой.
    if (prof.email && prof.emailVerified)
      await db.prepare(`UPDATE user_auth SET email_verified = 1, updated_at = datetime('now') WHERE user_id = ?1`).bind(userId).run().catch(() => undefined);
  };

  if (linkUser) {
    await attach(linkUser);
    if (prof.email && prof.emailVerified)
      await db
        .prepare(`UPDATE users SET email = ?2 WHERE id = ?1 AND email IS NULL AND NOT EXISTS (SELECT 1 FROM users WHERE email = ?2)`)
        .bind(linkUser, prof.email)
        .run()
        .catch(() => undefined);
    return { userId: linkUser };
  }

  if (prof.email && prof.emailVerified) {
    const byEmail = await db.prepare(`SELECT id FROM users WHERE email = ?1 LIMIT 1`).bind(prof.email).first<{ id: string }>();
    if (byEmail) {
      await attach(byEmail.id);
      return { userId: byEmail.id };
    }
  }

  const userId = hexId();
  const email = prof.email && prof.emailVerified ? prof.email : null;
  try {
    await db.prepare(`INSERT INTO users (id, email, name) VALUES (?1,?2,?3)`).bind(userId, email, prof.name).run();
  } catch {
    // гонка на UNIQUE(email) — пользователь появился между SELECT и INSERT
    const again = email ? await db.prepare(`SELECT id FROM users WHERE email = ?1 LIMIT 1`).bind(email).first<{ id: string }>() : null;
    if (!again) return { error: "server" };
    await attach(again.id);
    return { userId: again.id };
  }
  await attach(userId);
  return { userId };
}

/* ─────────────────────────── HTTP-обработчик ─────────────────────────── */

/** null — путь не наш (пусть обрабатывает accountApi дальше). */
export async function oauthApi(request: Request, env: DB, url: URL): Promise<Response | null> {
  const p = url.pathname;

  if (p === "/api/auth/providers" && request.method === "GET") {
    const cfg = await readCfg(env.DB).catch(() => ({}) as OAuthCfg);
    const providers: Record<string, boolean> = {};
    for (const id of PROVIDERS) providers[id] = !!cfg[id];
    return new Response(JSON.stringify({ providers }), {
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, no-store" },
    });
  }

  const m = p.match(/^\/api\/auth\/oauth\/(google|apple|yandex|vk)\/(start|callback)$/);
  if (!m) return null;
  const provider = m[1] as ProviderId;
  const stage = m[2] as "start" | "callback";
  const cfg = await readCfg(env.DB).catch(() => ({}) as OAuthCfg);
  if (!cfg[provider]) return fail("provider_off");

  if (stage === "start") {
    const state = rnd(24);
    const verifier = rnd(48);
    const to = safeTo(url.searchParams.get("to"));
    // Режим «подключить к текущему аккаунту»: колбэк Apple — межсайтовый POST
    // без cookie, поэтому владельца сессии фиксируем в state ещё на старте.
    const linkUser = await currentUserId(env, request).catch(() => null);
    await env.DB.prepare(`DELETE FROM oauth_states WHERE created_at < datetime('now','-1 hour')`).run().catch(() => undefined);
    await env.DB
      .prepare(`INSERT INTO oauth_states (state, provider, verifier, redirect_to, link_user) VALUES (?1,?2,?3,?4,?5)`)
      .bind(state, provider, verifier, to, linkUser)
      .run();
    const dest = await authorizeUrl(provider, cfg, state, verifier).catch(() => null);
    if (!dest) return fail("provider_off");
    return redirect(dest);
  }

  /* callback: Google/Яндекс/VK — GET с query, Apple — form_post */
  let q: URLSearchParams;
  if (request.method === "POST") {
    q = new URLSearchParams(await request.text().catch(() => ""));
  } else {
    q = url.searchParams;
  }
  if (q.get("error")) return fail(q.get("error") === "access_denied" ? "cancelled" : "provider");
  const code = q.get("code") || "";
  const state = q.get("state") || "";
  if (!code || !state) return fail("provider");

  const st = await env.DB
    .prepare(`SELECT provider, verifier, redirect_to, link_user FROM oauth_states WHERE state = ?1 AND created_at > datetime('now','-10 minutes') LIMIT 1`)
    .bind(state)
    .first<{ provider: string; verifier: string; redirect_to: string; link_user: string | null }>();
  await env.DB.prepare(`DELETE FROM oauth_states WHERE state = ?1`).bind(state).run().catch(() => undefined);
  if (!st || st.provider !== provider) return fail("state");

  const prof = await exchange(provider, cfg, code, {
    verifier: st.verifier,
    deviceId: q.get("device_id") || "",
    state,
    appleUser: q.get("user") || "",
  }).catch(() => null);
  if (!prof) return fail("provider");

  const res = await resolveUser(env.DB, provider, prof, st.link_user);
  if ("error" in res) return fail(res.error);

  const token = await createSession(env, res.userId, request);
  const to = safeTo(st.redirect_to);
  return redirect(to + (to.includes("?") ? "&" : "?") + "welcome=1", setCookie(token, SESSION_TTL_SEC));
}
