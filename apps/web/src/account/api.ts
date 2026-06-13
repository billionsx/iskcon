/**
 * Клиент личного кабинета. Все запросы — на тот же origin под /api; cookie-сессия
 * (HttpOnly) уходит автоматически. Ошибки бросаются как Error с полем `.code`
 * (коды с сервера: bad_email, weak_password, email_taken, bad_credentials, …),
 * чтобы экран входа показал понятный русский текст.
 */
import { api } from "../api";

export interface AccountUser {
  id: string;
  email: string | null;
  name: string | null;
  spiritualName: string | null;
  createdAt: string;
  emailVerified: boolean;
}

export interface ReadingItem { work: string; ref: string; label: string | null; kind: string; href: string | null; updated_at: string }
export interface LibraryItem { work: string; reads: number; updated_at: string }
export interface ListenItem {
  source: string; ref: string; title: string | null; subtitle: string | null;
  cover: string | null; album: string | null; artist: string | null; href: string | null;
  duration_sec: number | null; position_sec: number | null; play_count: number; last_at: string;
}
export interface BookmarkItem {
  kind: string; ref: string; title: string | null; subtitle: string | null;
  href: string | null; cover: string | null; created_at: string;
}
export interface Overview {
  stats: { reading: number; books: number; listening: number; bookmarks: number };
  continueReading: ReadingItem[];
  library: LibraryItem[];
  recentListening: ListenItem[];
  bookmarks: BookmarkItem[];
}

class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(api(path), {
    method,
    credentials: "same-origin",
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* пусто */
  }
  if (!res.ok) {
    const code = (data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : "") || `http_${res.status}`;
    throw new ApiError(code, res.status);
  }
  return data as T;
}

export const accountClient = {
  me: () => request<{ user: AccountUser | null }>("GET", "/auth/me").then((d) => d.user).catch(() => null),
  register: (email: string, password: string, name?: string) =>
    request<{ user: AccountUser }>("POST", "/auth/register", { email, password, name }).then((d) => d.user),
  login: (email: string, password: string) =>
    request<{ user: AccountUser }>("POST", "/auth/login", { email, password }).then((d) => d.user),
  logout: () => request<{ ok: true }>("POST", "/auth/logout").catch(() => ({ ok: true as const })),
  updateProfile: (patch: { name?: string; spiritualName?: string }) =>
    request<{ user: AccountUser }>("PATCH", "/me/profile", patch).then((d) => d.user),
  overview: () => request<Overview>("GET", "/me/overview"),
};

export { ApiError };
