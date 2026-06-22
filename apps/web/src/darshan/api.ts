/**
 * Клиент «Даршан дня». Публичный read на том же origin под /api:
 *   • GET /api/darshan          — сегодняшние даршаны (живьём из храмовых каналов) + голова архива (D1)
 *   • GET /api/darshan/archive  — постранично архив из D1 (наполняется ежедневным ингестом)
 * Изображения — прямые URL Telegram-CDN, рендерятся <img> без прокси.
 */
import { api } from "../api";

export interface DarshanItem {
  source: "live" | "archive";
  date: string;               // YYYY-MM-DD (IST)
  templeSlug: string;
  templeName: string;
  deities: string | null;
  place: string | null;
  images: string[];           // URL фото (Telegram-CDN)
  orient?: ("p" | "l" | null)[]; // ориентация показа каждого кадра (определена сервером по EXIF), выровнена с images
  caption: string | null;
  postedAt?: string;          // ISO-время поста (для показа времени и сортировки кругов)
  frames?: { image: string; video?: string | null; caption: string | null; postedAt: string | null }[]; // покадровая лента канала @iskcone
  srcUrl: string;             // пост-источник в канале храма
  channelUrl: string | null;  // пост в @iskcone (для архива, если опубликован)
  postId: string;
}
export interface DarshanToday { today: DarshanItem[]; at: string }
export interface DarshanArchivePage { items: DarshanItem[]; oldest: number | null; hasMore: boolean }

async function getJson<T>(path: string): Promise<T> {
  const r = await fetch(api(path), { credentials: "same-origin" });
  if (!r.ok) throw new Error(`http_${r.status}`);
  return (await r.json()) as T;
}

export const darshanClient = {
  get: () => getJson<DarshanToday>("/darshan"),
  archive: (before?: number, limit = 24) =>
    getJson<DarshanArchivePage>(`/darshan/archive?limit=${limit}${before ? `&before=${before}` : ""}`),
};
