/**
 * Клиент центров (Ятра). Все запросы — на тот же origin под /api; cookie-сессия
 * уходит автоматически (управление центром доступно вошедшему преданному, см.
 * apps/web/src/centers/server.ts). Ошибки бросаются как ApiError с полем `.code`
 * (bad_name, bad_slug, slug_taken, unauthorized, forbidden, publish_forbidden, …),
 * чтобы экран показал понятный русский текст.
 */
import { api } from "../api";
import { ApiError } from "../account/api";

export type CenterType = "temple" | "namahatta" | "restaurant" | "farm" | "preaching_center";
export type CenterStatus = "draft" | "review" | "live";

/** Карточка в локаторе/списке (публичный поиск). */
export interface CenterListItem {
  id: string;
  type: CenterType;
  name: string;
  slug: string;
  country: string | null;
  region: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  timezone: string | null;
  languages: string[];
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  photos: string[];
  distance_km?: number;
}

/** Строка списка «мои центры» (кабинет). */
export interface MyCenterItem {
  id: string;
  type: CenterType;
  name: string;
  slug: string;
  city: string | null;
  country: string | null;
  status: CenterStatus;
  photos: string[];
  updated_at: string;
  role: "admin" | "editor";
}

export interface CenterFull {
  id: string;
  type: CenterType;
  name: string;
  slug: string;
  parent_id: string | null;
  gbc_zone: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  timezone: string | null;
  languages: string[];
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  socials: Record<string, string>;
  photos: string[];
  status: CenterStatus;
  claimed_by: string | null;
  established_on: string | null;
  created_at: string;
  updated_at: string;
}

export interface CenterProgram {
  id: string;
  type: string;
  days_of_week: number[];
  start_time: string | null;
  end_time: string | null;
  notes_i18n: Record<string, string>;
  sort_order: number;
}
export interface CenterDeity {
  id: string;
  deity_id: string | null;
  canonical_name: string | null;
  local_name_i18n: Record<string, string>;
  darshan_times: Record<string, string>;
  photos: string[];
  /** Сущность-Божество в графе (сквозная связь). */
  deity_entity_id?: string | null;
  /** Каноничное имя связанной сущности (из графа), если связано. */
  deity_entity_name?: string | null;
}
export interface CenterEvent {
  id: string;
  festival_id: string | null;
  title_i18n: Record<string, string>;
  description_i18n: Record<string, string>;
  starts_at: string;
  ends_at: string | null;
  images: string[];
  livestream_url: string | null;
  /** Сущность-праздник в графе (сквозная связь). */
  festival_entity_id?: string | null;
  festival_entity_name?: string | null;
}

/** Полная карточка центра (профиль + расписание + божества + события). */
export interface CenterCard {
  center: CenterFull;
  programs: CenterProgram[];
  deities: CenterDeity[];
  events: CenterEvent[];
  /** Может ли текущий зритель управлять центром (админ/редактор или глоб. редактор). */
  can_manage?: boolean;
  /** Может ли текущий зритель публиковать/снимать (глобальный редактор). */
  can_publish?: boolean;
}

/** Поля программы расписания (создание/правка). */
export interface ProgramInput {
  type: string;
  days_of_week?: number[];
  start_time?: string | null;
  end_time?: string | null;
  notes_i18n?: Record<string, string>;
  sort_order?: number;
}

/** Поля божества (создание/правка). */
export interface DeityInput {
  local_name_i18n?: Record<string, string>;
  darshan_times?: Record<string, string>;
  photos?: string[];
  installed_on?: string | null;
  deity_id?: string | null;
  deity_entity_id?: string | null;
}

/** Поля события (создание/правка). starts_at — «YYYY-MM-DDTHH:MM». */
export interface EventInput {
  title_i18n?: Record<string, string>;
  description_i18n?: Record<string, string>;
  starts_at?: string;
  ends_at?: string | null;
  images?: string[];
  livestream_url?: string | null;
  festival_id?: string | null;
  festival_entity_id?: string | null;
}

/** Поля, принимаемые при создании. */
export interface CenterCreateInput {
  name: string;
  slug: string;
  type: CenterType;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  timezone?: string | null;
  languages?: string[];
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  website?: string | null;
}

/** Поля, изменяемые через PATCH (плюс смена статуса). */
export interface CenterPatch {
  name?: string;
  type?: CenterType;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  timezone?: string | null;
  languages?: string[];
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  website?: string | null;
  socials?: Record<string, string>;
  photos?: string[];
  established_on?: string | null;
  status?: CenterStatus;
}

export interface LocatorQuery {
  q?: string;
  country?: string;
  city?: string;
  type?: CenterType;
  lat?: number;
  lng?: number;
  radius_km?: number;
  limit?: number;
  offset?: number;
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
    const code =
      (data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : "") ||
      `http_${res.status}`;
    throw new ApiError(code, res.status);
  }
  return data as T;
}

function qs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** Совпадение поиска по графу сущностей (для привязки Божеств/праздников). */
export interface EntityHit {
  id: string;
  type: string | null;
  name_ru: string | null;
  name_en?: string | null;
  name_iast: string | null;
  image?: string | null;
}

/** Центр, найденный по связи с сущностью (для страницы сущности). */
export interface EntityCenterHit {
  id: string;
  type: CenterType;
  name: string;
  slug: string;
  city: string | null;
  country: string | null;
  photos: string[];
}

export const centersClient = {
  /** Публичный локатор (только опубликованные центры). */
  list: (query: LocatorQuery = {}) =>
    request<{ items: CenterListItem[]; count: number }>("GET", `/centers${qs(query as Record<string, unknown>)}`),
  /** Карточка по slug (черновик виден только админу этого центра). */
  get: (slug: string) => request<CenterCard>("GET", `/centers/${encodeURIComponent(slug)}`),
  /** Поиск по графу сущностей — для привязки Божества/праздника центра. */
  searchEntities: (q: string) =>
    request<{ items: EntityHit[] }>("GET", `/entities${qs({ q, limit: 8 })}`),
  /** Опубликованные центры, связанные с сущностью (Божество/праздник). */
  centersForEntity: (entityId: string) =>
    request<{ items: EntityCenterHit[] }>("GET", `/centers${qs({ entity: entityId })}`),
  /** Создать центр → 'draft', текущий пользователь становится админом. */
  create: (input: CenterCreateInput) =>
    request<{ id: string; slug: string; status: CenterStatus }>("POST", "/centers", input),
  /** Правка центра по id (поля + смена статуса). */
  update: (id: string, patch: CenterPatch) =>
    request<{ id: string; updated: boolean }>("PATCH", `/centers/${encodeURIComponent(id)}`, patch),
  /** Центры, которыми управляет вошедший преданный. */
  mine: () =>
    request<{ items: MyCenterItem[]; is_global_editor?: boolean; review_count?: number }>("GET", "/me/centers"),
  /** Очередь модерации (центры на проверке) — только глобальный редактор. */
  reviewQueue: () => request<{ items: MyCenterItem[] }>("GET", "/centers/review"),
  /** Добавить программу расписания (админ центра). */
  addProgram: (centerId: string, input: ProgramInput) =>
    request<{ id: string }>("POST", `/centers/${encodeURIComponent(centerId)}/programs`, input),
  /** Правка программы. */
  updateProgram: (centerId: string, programId: string, patch: Partial<ProgramInput>) =>
    request<{ id: string; updated: boolean }>(
      "PATCH",
      `/centers/${encodeURIComponent(centerId)}/programs/${encodeURIComponent(programId)}`,
      patch,
    ),
  /** Удалить программу. */
  deleteProgram: (centerId: string, programId: string) =>
    request<{ id: string; deleted: boolean }>(
      "DELETE",
      `/centers/${encodeURIComponent(centerId)}/programs/${encodeURIComponent(programId)}`,
    ),
  /** Добавить божество. */
  addDeity: (centerId: string, input: DeityInput) =>
    request<{ id: string }>("POST", `/centers/${encodeURIComponent(centerId)}/deities`, input),
  updateDeity: (centerId: string, deityId: string, patch: DeityInput) =>
    request<{ id: string; updated: boolean }>(
      "PATCH",
      `/centers/${encodeURIComponent(centerId)}/deities/${encodeURIComponent(deityId)}`,
      patch,
    ),
  deleteDeity: (centerId: string, deityId: string) =>
    request<{ id: string; deleted: boolean }>(
      "DELETE",
      `/centers/${encodeURIComponent(centerId)}/deities/${encodeURIComponent(deityId)}`,
    ),
  /** Добавить событие. */
  addEvent: (centerId: string, input: EventInput) =>
    request<{ id: string }>("POST", `/centers/${encodeURIComponent(centerId)}/events`, input),
  updateEvent: (centerId: string, eventId: string, patch: EventInput) =>
    request<{ id: string; updated: boolean }>(
      "PATCH",
      `/centers/${encodeURIComponent(centerId)}/events/${encodeURIComponent(eventId)}`,
      patch,
    ),
  deleteEvent: (centerId: string, eventId: string) =>
    request<{ id: string; deleted: boolean }>(
      "DELETE",
      `/centers/${encodeURIComponent(centerId)}/events/${encodeURIComponent(eventId)}`,
    ),
};

/* ─────────────────────── ярлыки/хелперы отображения ─────────────────────── */

export const CENTER_TYPE_LABEL: Record<CenterType, string> = {
  temple: "Храм",
  namahatta: "Нама-хатта",
  restaurant: "Ресторан",
  farm: "Ферма",
  preaching_center: "Проповеднический центр",
};

export const STATUS_LABEL: Record<CenterStatus, string> = {
  draft: "Черновик",
  review: "На проверке",
  live: "Авторизовано ИСККОН",
};

/** Выбрать локализованную строку из i18n-карты: ru → en → первое значение. */
export function pickI18n(map: Record<string, string> | null | undefined, fallback = ""): string {
  if (!map) return fallback;
  if (map.ru) return map.ru;
  if (map.en) return map.en;
  const first = Object.values(map)[0];
  return first ?? fallback;
}

/** Понятный русский текст по коду ошибки сервера. */
export function centerErrorText(code: string): string {
  switch (code) {
    case "bad_name":
      return "Введите название (минимум 2 символа).";
    case "bad_slug":
      return "Адрес: латиница, цифры и дефис, 2–64 символа.";
    case "bad_type":
      return "Выберите тип центра.";
    case "bad_deity":
      return "Укажите имя Божества.";
    case "bad_event":
      return "Укажите название события.";
    case "bad_event_date":
      return "Укажите дату и время события.";
    case "bad_status":
      return "Недопустимый статус.";
    case "slug_taken":
      return "Этот адрес уже занят — выберите другой.";
    case "publish_forbidden":
      return "Публикация — после проверки ИСККОН.";
    case "forbidden":
      return "Нет прав на изменение этого центра.";
    case "unauthorized":
      return "Войдите, чтобы управлять центром.";
    case "center_not_found":
    case "not_found":
      return "Центр не найден.";
    default:
      return "Что-то пошло не так. Попробуйте ещё раз.";
  }
}

export { ApiError };
