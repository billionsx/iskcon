-- 0024_auth_oauth_reset.sql
-- Полный цикл онбординга: вход через внешние аккаунты (Apple · Google ·
-- Яндекс ID · VK ID) + восстановление пароля и подтверждение почты кодами.
-- Все CREATE ... IF NOT EXISTS — файл идемпотентен. Зеркалирует ensureSchema()
-- в apps/web/src/account/server.ts (исполнитель — воркер iskcon-web).

PRAGMA foreign_keys = ON;

-- Внешние аккаунты: (provider, provider_uid) → users.id. email/name/avatar —
-- снимок профиля провайдера на момент последнего входа (для карточки
-- «Вход и безопасность»); источник имени пользователя — users, не этот снимок.
CREATE TABLE IF NOT EXISTS auth_identities (
  provider     TEXT NOT NULL,               -- google · apple · yandex · vk
  provider_uid TEXT NOT NULL,               -- sub / id пользователя у провайдера
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email        TEXT,
  name         TEXT,
  avatar       TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (provider, provider_uid)
);
CREATE INDEX IF NOT EXISTS idx_identities_user ON auth_identities(user_id);

-- Одноразовые коды на почту: сброс пароля (reset) и подтверждение адреса
-- (verify). В БД лежит только SHA-256 кода; TTL 15 минут; attempts ≤ 6.
CREATE TABLE IF NOT EXISTS auth_codes (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  code_hash  TEXT NOT NULL,
  purpose    TEXT NOT NULL,                 -- reset · verify
  attempts   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_codes_email ON auth_codes(email, purpose);

-- OAuth-state: CSRF-строка + PKCE-verifier (VK ID) + путь возврата + линк-режим
-- (подключение провайдера к вошедшему пользователю). Хранится в D1, а не в
-- cookie: колбэк Apple (response_mode=form_post) — межсайтовый POST, на котором
-- браузер не отправляет SameSite=Lax cookie. TTL 10 минут, чистка на старте флоу.
CREATE TABLE IF NOT EXISTS oauth_states (
  state       TEXT PRIMARY KEY,
  provider    TEXT NOT NULL,
  verifier    TEXT NOT NULL,
  redirect_to TEXT NOT NULL DEFAULT '/account',
  link_user   TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
