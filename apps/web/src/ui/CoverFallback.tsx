/**
 * ISKCON DESIGN — единые заглушки обложки (ЗКН-Д005).
 *
 * Нет загруженного изображения → логотип ИСККОН золотом. ДВА варианта — по тому,
 * ложится ли на обложку текст:
 *
 *   ТЁМНАЯ (COVER_FALLBACK_DARK) — там, где ПОВЕРХ обложки идёт текст: ВБК, ВСК.
 *     Фон #1E1E1E, 4/5, radius 20. Тёмные скримы и белый текст работают как с фото.
 *
 *   БЕЛАЯ (COVER_FALLBACK) — там, где текста на обложке НЕТ: миниатюры, аватары
 *     в списках, круглая иконка ВМК, аудио-обложка в плеере.
 *
 * Почему так: белая подложка под белым текстом нечитаема, а тёмный скрим поверх
 * белой подложки превращает её в грязно-серую и гасит золото.
 *
 * Ассеты: apps/web/public/cover-fallback{,-dark}.svg — золото #D2AA1B.
 */
import type { CSSProperties } from "react";

/** Белая заглушка — БЕЗ текста поверх (миниатюры, аватары, аудио). */
export const COVER_FALLBACK = "/cover-fallback.svg";

/** Тёмная заглушка — С текстом поверх (ВБК, ВСК). Фон #1E1E1E, 4/5. */
export const COVER_FALLBACK_DARK = "/cover-fallback-dark.svg";

/** Полноразмерная заглушка обложки — заполняет родителя (position: relative). */
export function CoverFallback({ dark = false, alt = "", style }: { dark?: boolean; alt?: string; style?: CSSProperties }) {
  return (
    <img
      src={dark ? COVER_FALLBACK_DARK : COVER_FALLBACK}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      loading="lazy"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", ...style }}
    />
  );
}
