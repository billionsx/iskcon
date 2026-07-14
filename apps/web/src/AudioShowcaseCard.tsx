/**
 * Витринная Карточка Звука (ВКЗ) — единый показ аудио в приложении.
 *
 * Один стандарт для лекций, киртанов, бхаджанов и голосовых: честная обложка,
 * заголовок, источник (лектор/исполнитель), длительность ДО нажатия, отдельная
 * кнопка воспроизведения, скраббер и наши действия (♥ · ⋯).
 *
 * ЗКН-Д014 — поверхность карточки цвета страницы + волосяная линия. Серая
 *   плашка (`--color-glass-*` как фон контейнера) в ленте читается как дырка
 *   в холсте: контент проваливается, интерфейс выглядит недоделанным.
 * ЗКН-Д005 — фирменная заглушка НЕ затемняется скримом: скрим гасит золото и
 *   превращает белую обложку-логотип в грязно-серый квадрат. Скрим живёт там,
 *   где поверх обложки идёт ТЕКСТ, — здесь текста поверх нет.
 * ЗКН-Н051 — язык человека: «Слушать» / «Пауза», время рядом, без немого 0:00.
 */
import { useEffect, useRef, useState } from "react";
import { CardActionBtns } from "./cardActions";
import { AUDIO_FALLBACK_COVER_LIGHT } from "./player/store";

const GOLD = "var(--color-gold)";

function fmtTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const mm = h > 0 && m < 10 ? `0${m}` : `${m}`;
  return `${h > 0 ? `${h}:` : ""}${mm}:${s < 10 ? "0" : ""}${s}`;
}

export interface AudioShowcaseCardProps {
  src: string;
  title: string;
  presenter?: string;
  /** Тип звука: «Лекция» · «Киртан» · «Бхаджан» · «Аудио». */
  kindLabel?: string;
  cover?: string;
  /** Длительность-подсказка до загрузки метаданных (например «28:15»). */
  durationHint?: string;
  favKey: string;
  favMeta?: { t?: string; s?: string; h?: string };
  onMore?: () => void;
  flash?: (m: string) => void;
}

export function AudioShowcaseCard({
  src, title, presenter, kindLabel, cover, durationHint, favKey, favMeta, onMore, flash,
}: AudioShowcaseCardProps) {
  const ref = useRef<HTMLAudioElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [loading, setLoading] = useState(false);
  const [near, setNear] = useState(false);
  const [grab, setGrab] = useState(false);

  // Длительность видна ДО нажатия. Метаданные тянем, только когда карточка
  // подходит к экрану: ради одной цифры не качаем киртан целиком.
  useEffect(() => {
    const el = box.current;
    if (!el || near || typeof IntersectionObserver === "undefined") { if (!el) setNear(true); return; }
    const io = new IntersectionObserver(
      (es) => { if (es.some((e) => e.isIntersecting)) { setNear(true); io.disconnect(); } },
      { rootMargin: "400px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  useEffect(() => {
    const el = ref.current;
    if (!near || !el || dur || playing) return;
    try { el.preload = "metadata"; el.load(); } catch { /* нет метаданных — покажем подсказку */ }
  }, [near, dur, playing]);

  const toggle = () => { const el = ref.current; if (!el) return; if (playing) el.pause(); else void el.play(); };
  const seekTo = (clientX: number, track: HTMLElement) => {
    const el = ref.current; if (!el || !dur) return;
    const r = track.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    el.currentTime = p * dur; setCur(p * dur);
  };

  const pct = dur ? Math.min(1, cur / dur) : 0;
  const total = dur ? fmtTime(dur) : (durationHint || "");
  const live = playing || cur > 0 || grab;
  const time = live ? `${fmtTime(cur)}${total ? ` / ${total}` : ""}` : total;
  const coverSrc = cover || AUDIO_FALLBACK_COVER_LIGHT;

  return (
    <div ref={box} style={{ margin: "10px 0 0", padding: 10, borderRadius: 18, background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)" }}>
      <audio ref={ref} src={src} preload="none"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onWaiting={() => setLoading(true)} onPlaying={() => setLoading(false)} onCanPlay={() => setLoading(false)}
        onEnded={() => { setPlaying(false); setCur(0); }}
        onLoadedMetadata={(e) => { const d = e.currentTarget.duration; if (isFinite(d)) setDur(d); }}
        onTimeUpdate={(e) => setCur(e.currentTarget.currentTime)} />

      {/* обложка честная: без скрима, с волосяным кольцом — она сама себе граница */}
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <img src={coverSrc} alt="" loading="lazy"
          style={{ width: 56, height: 56, flexShrink: 0, borderRadius: 13, objectFit: "cover", display: "block", background: "var(--color-bg-3)", boxShadow: "inset 0 0 0 0.5px var(--color-hairline)" }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          {kindLabel && <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: GOLD }}>{kindLabel}</div>}
          <div style={{ marginTop: kindLabel ? 2 : 0, fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: 650, lineHeight: 1.25, color: "var(--color-label)", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{title}</div>
          {presenter && <div style={{ marginTop: 3, fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", color: "var(--color-label-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{presenter}</div>}
        </div>

        <span style={{ flexShrink: 0 }}>
          <CardActionBtns favKey={favKey} meta={favMeta} flash={flash} size={30} plain onMore={onMore || (() => {})} />
        </span>
      </div>

      {/* строка управления: кнопка — скраббер — время. Пустых слотов нет. */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
        <button type="button" aria-label={playing ? "Пауза" : "Слушать"} onClick={toggle}
          style={{ width: 40, height: 40, flexShrink: 0, borderRadius: "50%", border: "none", padding: 0, cursor: "pointer", background: GOLD, color: "var(--color-on-gold)", display: "grid", placeItems: "center", boxShadow: "0 2px 10px color-mix(in srgb, var(--color-gold) 34%, transparent)", transition: "transform .16s cubic-bezier(.22,1,.36,1)", transform: playing ? "scale(0.94)" : "none", WebkitTapHighlightColor: "transparent" }}>
          {loading
            ? <span aria-hidden style={{ width: 17, height: 17, borderRadius: "50%", border: "2px solid color-mix(in srgb, var(--color-on-gold) 28%, transparent)", borderTopColor: "var(--color-on-gold)", animation: "iolspin .8s linear infinite" }} />
            : playing
              ? <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden><path d="M7.5 5h3.2v14H7.5zM13.3 5h3.2v14h-3.2z" fill="currentColor" /></svg>
              : <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden style={{ marginLeft: 2 }}><path d="M8 5v14l11-7z" fill="currentColor" /></svg>}
        </button>

        <div role="slider" aria-label="Перемотка" aria-valuemin={0} aria-valuemax={Math.round(dur)} aria-valuenow={Math.round(cur)}
          onClick={(e) => seekTo(e.clientX, e.currentTarget)}
          onPointerDown={(e) => { try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* без захвата */ } setGrab(true); seekTo(e.clientX, e.currentTarget); }}
          onPointerMove={(e) => { if (e.buttons) seekTo(e.clientX, e.currentTarget); }}
          onPointerUp={() => setGrab(false)} onPointerCancel={() => setGrab(false)}
          style={{ position: "relative", flex: 1, height: 20, display: "flex", alignItems: "center", cursor: "pointer", touchAction: "none" }}>
          <span style={{ position: "absolute", left: 0, right: 0, height: grab ? 6 : 4, borderRadius: 999, background: "var(--color-glass-thin)", transition: "height .16s" }} />
          <span style={{ position: "absolute", left: 0, width: `${pct * 100}%`, height: grab ? 6 : 4, borderRadius: 999, background: GOLD, transition: "height .16s" }} />
          {live && <span aria-hidden style={{ position: "absolute", left: `calc(${pct * 100}% - ${grab ? 7 : 6}px)`, width: grab ? 14 : 12, height: grab ? 14 : 12, borderRadius: "50%", background: "var(--color-bg-2)", boxShadow: "0 1px 4px rgba(0,0,0,.28)", border: `1.5px solid ${GOLD}`, transition: "width .16s, height .16s" }} />}
        </div>

        <span style={{ flexShrink: 0, minWidth: 40, textAlign: "right", fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontVariantNumeric: "tabular-nums", color: "var(--color-label-3)" }}>{time}</span>
      </div>
    </div>
  );
}
