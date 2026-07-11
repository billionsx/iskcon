/**
 * ЗКН-К001 — обложка-слайдер: единый модуль. Своя реализация запрещена.
 * CardCover — ЕДИНЫЙ стандарт обложек карточек (юнит-стандарт).
 *
 * Слайдер с авто-сменой раз в COVER_INTERVAL_MS (7 сек). Один источник правды для всех
 * обложек: книги (BookHeroCard), личности (PersonHeroCard), центры
 * (CenterHeroCard) и любые будущие карточки с несколькими изображениями.
 *
 *  • COVER_INTERVAL_MS — интервал авто-смены (3000 мс).
 *  • useCoverSlider(count) — индекс + next/prev; авто-проигрывание с паузой
 *    после ручного тапа; уважает prefers-reduced-motion; чистит таймер.
 *  • CoverImages — стопка <img> с кросс-фейдом (объект-кавер).
 *  • CoverTapZones — невидимые лево/право зоны ручного перелистывания.
 *  • CoverCounter — пилюля «n / N».
 */
import { useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";

/** Стандарт: обложка-слайдер меняется раз в 7 секунд. */
export const COVER_INTERVAL_MS = 7000;
/** Длительность кросс-фейда между кадрами. */
export const COVER_FADE_MS = 600;

const prefersReducedMotion = () => {
  try {
    return typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

export function useCoverSlider(count: number, intervalMs: number = COVER_INTERVAL_MS) {
  const [idx, setIdx] = useState(0);
  const pausedUntil = useRef(0);

  // если число кадров сократилось — не выходим за границы
  useEffect(() => {
    if (idx >= count && count > 0) setIdx(0);
  }, [count, idx]);

  // авто-смена раз в intervalMs; пауза на 2 интервала после ручного тапа
  useEffect(() => {
    if (count <= 1 || prefersReducedMotion()) return;
    const t = setInterval(() => {
      if (Date.now() < pausedUntil.current) return;
      setIdx((i) => (i + 1) % count);
    }, intervalMs);
    return () => clearInterval(t);
  }, [count, intervalMs]);

  const go = (i: number) => {
    if (count <= 0) return;
    pausedUntil.current = Date.now() + intervalMs * 2;
    setIdx(((i % count) + count) % count);
  };
  const next = (e?: ReactMouseEvent) => { e?.stopPropagation(); go(idx + 1); };
  const prev = (e?: ReactMouseEvent) => { e?.stopPropagation(); go(idx - 1); };

  return { idx, setIdx: go, next, prev };
}

/** Стопка изображений обложки с кросс-фейдом. Кладётся первой внутрь <article>. */
export function CoverImages({ images, alt, idx }: { images: string[]; alt: string; idx: number }) {
  return (
    <>
      {images.map((src, i) => (
        <img
          key={`${i}:${src}`}
          src={src}
          alt={i === idx ? alt : ""}
          aria-hidden={i !== idx}
          loading={i === 0 ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          style={{
            position: "absolute", inset: 0, height: "100%", width: "100%", objectFit: "cover",
            opacity: i === idx ? 1 : 0, transition: `opacity ${COVER_FADE_MS}ms ease`,
          }}
        />
      ))}
    </>
  );
}

/** Невидимые зоны перелистывания (лево/право). Показывать только при count > 1. */
export function CoverTapZones({ onPrev, onNext }: { onPrev: (e?: ReactMouseEvent) => void; onNext: (e?: ReactMouseEvent) => void }) {
  return (
    <>
      <button type="button" aria-label="Предыдущее изображение" onClick={onPrev}
        style={{ position: "absolute", top: 56, bottom: "42%", left: 0, width: "22%", zIndex: 15, background: "none", border: "none", cursor: "pointer" }} />
      <button type="button" aria-label="Следующее изображение" onClick={onNext}
        style={{ position: "absolute", top: 56, bottom: "42%", right: 0, width: "22%", zIndex: 15, background: "none", border: "none", cursor: "pointer" }} />
    </>
  );
}

/** Пилюля-счётчик «n / N». */
export function CoverCounter({ idx, total }: { idx: number; total: number }) {
  return (
    <span style={{ borderRadius: 999, background: "rgba(0,0,0,.55)", padding: "2px 8px", fontSize: "var(--text-caption2)", fontWeight: 600, color: "#fff", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
      {idx + 1} / {total}
    </span>
  );
}
