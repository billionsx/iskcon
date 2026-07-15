/**
 * Единая модель элементов ленты Даршана (ЗКН-Пл018 «одна лента, много линз»).
 *
 * Лента показывает РАЗНЫЕ типы контента одним потоком: посты Telegram-канала
 * (живой парсинг), НОВОСТИ (news_posts — статьи официальных агентств, переведённые
 * на русский) и МЕДИА (feed_media — видео/аудио, перезалитые на archive.org). Тип
 * различается полем `kind`. Каждый тип — самостоятельная карточка, но живёт в общем
 * потоке и в общих действиях (♥ избранное · поделиться · PDF · QR).
 *
 * Здесь — контракты серверных типов (что отдаёт воркер /api/news и /api/media).
 * Пост Telegram (`TgPost`) объявлен в HomeFeed — он парсится, а не хранится.
 */

/** Дискриминатор типа элемента ленты. «tg» — пост канала; остальные — из D1. */
export type FeedKind = "tg" | "news" | "video" | "audio";

/** Новость: статья агентства ИСККОН, переведённая на русский (news_posts). */
export interface NewsItem {
  kind: "news";
  id: string;
  slug: string;                 // адрес карточки: /darshan/news/<slug>
  source: string;               // домен-источник (iskconnews.org …)
  sourceLabel: string;          // человекочитаемый ярлык («ISKCON News»)
  url: string;                  // ссылка на оригинал (английский)
  publishedAt: string;          // ISO-дата публикации
  author: string;
  category: string;             // русский ярлык рубрики
  hero: string;                 // hero-изображение (уже через /api/img), может быть ""
  title: string;                // заголовок RU
  titleEn: string;              // оригинальный заголовок EN
  lead: string;                 // короткий лид RU
  body: string;                 // полное тело RU (для раскрытия)
}

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
