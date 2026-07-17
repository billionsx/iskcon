/**
 * Единая модель элементов ленты Даршана (ЗКН-Пл018 «одна лента, много линз»).
 *
 * Лента показывает РАЗНЫЕ типы контента одним потоком: посты Telegram-канала
 * (живой парсинг) и МЕДИА (feed_media — видео/аудио, перезалитые на archive.org).
 * Тип различается полем `kind`. Каждый тип — самостоятельная карточка, но живёт
 * в общем потоке и в общих действиях (♥ избранное · поделиться · PDF · QR).
 *
 * Здесь — контракты серверных типов (что отдаёт воркер /api/media). Пост Telegram
 * (`TgPost`) объявлен в HomeFeed — он парсится, а не хранится. Новости (news_posts)
 * убраны 17.07.2026 вместе с мусорной агентской лентой.
 */

/** Дискриминатор типа элемента ленты. «tg» — пост канала; медиа — из D1. */
export type FeedKind = "tg" | "video" | "audio";

/** Медиа: видео/аудио с archive.org (feed_media), не привязанное к посту ТГ. */
export interface MediaItem {
  kind: "video" | "audio";
  id: string;
  guid: string;                 // youtube:<vid> и т. п. — стабильный ключ
  source: string;
  sourceLabel: string;
  url: string;                  // оригинал (YouTube …)
  streamUrl: string;            // прямой mp4/аудио на archive.org — бесшовный <video>
  thumb: string;                // превью (уже через /api/img), может быть ""
  duration: string;
  publishedAt: string;
  author: string;
  title: string;                // заголовок RU
  titleEn: string;
  summary: string;              // краткое описание RU
}

/** Страница ленты с кейсет-курсором (не OFFSET — устойчиво к свежим вставкам). */
export interface FeedPage<T> {
  items: T[];
  hasMore: boolean;
  cursor: string | null;        // передать как ?before= для следующей страницы
}
