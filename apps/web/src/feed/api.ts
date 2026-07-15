/**
 * Клиент ленты: чтение новостей (/api/news) и медиа (/api/media) с воркера.
 * Кейсет-пагинация: следующий запрос передаёт `cursor` предыдущего как ?before=.
 */
import { api } from "../api";
import type { NewsItem, MediaItem, FeedPage } from "./types";

async function getJson<T>(path: string): Promise<T> {
  const r = await fetch(api(path));
  if (!r.ok) throw new Error(String(r.status));
  return (await r.json()) as T;
}

export const newsClient = {
  /** Страница новостей (свежие первыми). before — курсор предыдущей страницы. */
  async list(before?: string | null, limit = 24): Promise<FeedPage<NewsItem>> {
    const qs = new URLSearchParams({ limit: String(limit) });
    if (before) qs.set("before", before);
    return getJson<FeedPage<NewsItem>>(`/news?${qs.toString()}`);
  },
  /** Одна новость по слагу (deep-link /darshan/news/<slug>). */
  async bySlug(slug: string): Promise<NewsItem | null> {
    const j = await getJson<{ item: NewsItem | null }>(`/news?slug=${encodeURIComponent(slug)}`);
    return j.item;
  },
};

export const mediaClient = {
  /** Страница медиа заданного вида (video|audio), свежие первыми. */
  async list(kind: "video" | "audio", before?: string | null, limit = 24): Promise<FeedPage<MediaItem>> {
    const qs = new URLSearchParams({ kind, limit: String(limit) });
    if (before) qs.set("before", before);
    return getJson<FeedPage<MediaItem>>(`/media?${qs.toString()}`);
  },
};
