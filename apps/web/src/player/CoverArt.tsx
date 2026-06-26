/**
 * CoverArt — обложка плеера с темо-зависимым фирменным знаком.
 *
 * Для запасной (фирменной) обложки аудио рендерим ОБА варианта в DOM и прячем
 * лишний через CSS по `data-theme` — тот же паттерн, что у вордмарка
 * (.light-logo-only / .dark-logo-only), без ре-маунта и без мерцания:
 *   • светлая тема → /audio-cover-light.png (золотой знак на белом)
 *   • тёмная тема  → /audio-cover.png       (белый знак на тёмном)
 *
 * Реальные обложки (книги БГ/ШБ/ЧЧ, арты киртанов с archive.org) — как есть,
 * одним <img>, без подмены.
 */
import type { CSSProperties } from "react";
import { AUDIO_FALLBACK_COVER } from "./store";

/** Светлый вариант фирменной обложки (для светлой темы приложения). */
export const AUDIO_FALLBACK_COVER_LIGHT = "/audio-cover-light.png";

export function CoverArt({
  src,
  alt = "",
  style,
  draggable = false,
}: {
  src: string;
  alt?: string;
  style?: CSSProperties;
  draggable?: boolean;
}) {
  // Только фирменная заглушка темо-зависима; реальные обложки рендерим как есть.
  if (src === AUDIO_FALLBACK_COVER) {
    return (
      <>
        <img
          className="audio-cover-light"
          src={AUDIO_FALLBACK_COVER_LIGHT}
          alt={alt}
          draggable={draggable}
          decoding="async"
          style={style}
        />
        <img
          className="audio-cover-dark"
          src={AUDIO_FALLBACK_COVER}
          alt=""
          aria-hidden
          draggable={draggable}
          decoding="async"
          style={style}
        />
      </>
    );
  }
  return <img src={src} alt={alt} draggable={draggable} decoding="async" style={style} />;
}
