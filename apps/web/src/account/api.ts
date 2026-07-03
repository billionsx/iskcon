/**
 * Клиент личного кабинета. Все запросы — на тот же origin под /api; cookie-сессия
 * (HttpOnly) уходит автоматически. Ошибки бросаются как Error с полем `.code`
 * (коды с сервера: bad_email, weak_password, email_taken, bad_credentials, …),
 * чтобы экран входа показал понятный русский текст.
 */
import { api } from "../api";

/** Ступень практики (самоопределение) — управляет адаптацией интерфейса под уровень. */
export type DevoteeLevel = "guest" | "neophyte" | "practicing" | "initiated" | "guru";
/** Факт инициации в ИСККОН. */
export type Initiation = "none" | "harinama" | "brahmin";

export interface AccountUser {
  id: string;
  email: string | null;
  name: string | null;
  spiritualName: string | null;
  // Профиль духовной ступени (Ц1). Управляет онбордингом, экраном «Сегодня»,
  // путём ученика, разделом «мой гуру».
  level: DevoteeLevel | null;
  initiation: Initiation | null;
  dikshaGuru: string | null;
  sikshaGuru: string | null;
  principlesSince: string | null;
  homeCenterId: string | null;
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

export interface SadhanaDay { day: string; rounds: number; reading_min: number; rose_at: string | null; note: string | null }
export interface SadhanaWeekDay { day: string; rounds: number; done: boolean; today: boolean }
export interface SadhanaState {
  goal: number;
  today: string;
  todayRow: SadhanaDay;
  stats: {
    todayRounds: number;
    currentStreak: number;
    longestStreak: number;
    totalRounds: number;
    daysPracticed: number;
    totalReadingMin: number;
  };
  week: SadhanaWeekDay[];
  history: SadhanaDay[];
}
export interface SadhanaPatch {
  day?: string;
  today?: string;
  readingMin?: number;
  roseAt?: string | null;
  note?: string | null;
  goal?: number;
}
/** Круг джапы для дозаливки на сервер (идемпотентно по id). Совпадает с /api/me/japa. */
export interface JapaSyncRound { id: string; day: string; at: string; beads: number; durationSec?: number | null }

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
  updateProfile: (patch: {
    name?: string; spiritualName?: string;
    level?: DevoteeLevel | ""; initiation?: Initiation | "";
    dikshaGuru?: string; sikshaGuru?: string; principlesSince?: string;
    homeCenterId?: string; chantNorm?: number;
  }) =>
    request<{ user: AccountUser }>("PATCH", "/me/profile", patch).then((d) => d.user),
  overview: () => request<Overview>("GET", "/me/overview"),
  sadhana: {
    get: (today: string, days = 21) =>
      request<SadhanaState>("GET", `/me/sadhana?today=${encodeURIComponent(today)}&days=${days}`),
    save: (patch: SadhanaPatch) => request<SadhanaState>("POST", "/me/sadhana", patch),
  },
  japa: {
    // Дозаливка кругов с устройства (локальный счётчик) на сервер — идемпотентно
    // по client_id; нужна, чтобы дневник учёл круги, отмеченные до входа/офлайн.
    sync: (rounds: JapaSyncRound[]) => request<{ ok: true; saved: number }>("POST", "/me/japa", { rounds }),
  },
};

export { ApiError };
