/**
 * ISKCON DESIGN — единая заглушка обложки (ЗКН-Д005).
 *
 * Нет загруженного изображения → золотой логотип ИСККОН на белом фоне.
 * Один ассет на ВСЕ типы: личности, книги, аудио, бхаджаны, места, рецепты.
 *
 * Отменяет прежний разнобой:
 *   · буква-инициал водяным знаком (PersonHeroCard, LichnostiHub, BooksHub…)
 *   · audio-cover.png / audio-cover-light.png (плеер, аудио-карточки)
 *
 * Ассет: apps/web/public/cover-fallback.svg (белый фон + золото #D2AA1B).
 * Работает в обеих темах: фон у ассета собственный, белый.
 */
import type { CSSProperties } from "react";

/** Путь к единой заглушке. Использовать вместо любых локальных плейсхолдеров. */
export const COVER_FALLBACK = "/cover-fallback.svg";

/** Полноразмерная заглушка обложки — заполняет родителя (position: relative). */
export function CoverFallback({ alt = "", style }: { alt?: string; style?: CSSProperties }) {
  return (
    <img
      src={COVER_FALLBACK}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      loading="lazy"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        ...style,
      }}
    />
  );
}
