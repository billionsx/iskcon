/**
 * Клиент ленты: чтение медиа (/api/media) с воркера.
 * Кейсет-пагинация: следующий запрос передаёт `cursor` предыдущего как ?before=.
 * Новостной клиент удалён 17.07.2026 вместе с мусорной агентской лентой.
 */
import { api } from "../api";
import type { MediaItem, FeedPage } from "./types";

async function getJson<T>(path: string): Promise<T> {
  const r = await fetch(api(path));
  if (!r.ok) throw new Error(String(r.status));
  return (await r.json()) as T;
}

export const mediaClient = {
  /** Страница медиа заданного вида (video|audio), свежие первыми. */
  async list(kind: "video" | "audio", before?: string | null, limit = 24): Promise<FeedPage<MediaItem>> {
    const qs = new URLSearchParams({ kind, limit: String(limit) });
    if (before) qs.set("before", before);
    return getJson<FeedPage<MediaItem>>(`/media?${qs.toString()}`);
  },
};
