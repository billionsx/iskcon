/**
 * Витринная Карточка Звука (ВКЗ) — единый показ аудио в приложении.
 *
 * Один стандарт для лекций, киртанов, бхаджанов и голосовых: обложка с
 * плей-оверлеем, заголовок, источник (лектор/исполнитель), скраббер со
 * временем и наши действия — избранное (♥) и меню (⋯). Эстетика Apple Music
 * + Telegram. Источник звука — прямой URL (например, archive.org).
 */
import { useRef, useState } from "react";
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
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [loading, setLoading] = useState(false);

  const toggle = () => { const el = ref.current; if (!el) return; if (playing) el.pause(); else void el.play(); };
  const seekTo = (clientX: number, track: HTMLElement) => {
    const el = ref.current; if (!el || !dur) return;
    const r = track.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    el.currentTime = p * dur; setCur(p * dur);
  };

  const pct = dur ? cur / dur : 0;
  const total = dur ? fmtTime(dur) : (durationHint || "");
  const coverSrc = cover || AUDIO_FALLBACK_COVER_LIGHT;

  return (
    <div style={{ margin: "10px 0 0", padding: 12, borderRadius: 18, background: "var(--color-glass-regular)", border: "0.5px solid var(--color-hairline)" }}>
      <audio ref={ref} src={src} preload="none"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onWaiting={() => setLoading(true)} onPlaying={() => setLoading(false)} onCanPlay={() => setLoading(false)}
        onEnded={() => { setPlaying(false); setCur(0); }}
        onLoadedMetadata={(e) => { const d = e.currentTarget.duration; if (isFinite(d)) setDur(d); }}
        onTimeUpdate={(e) => setCur(e.currentTarget.currentTime)} />

      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <button type="button" aria-label={playing ? "Пауза" : "Слушать"} onClick={toggle}
          style={{ position: "relative", width: 60, height: 60, flexShrink: 0, borderRadius: 12, overflow: "hidden", border: "none", padding: 0, cursor: "pointer", background: "var(--color-glass-thin)", WebkitTapHighlightColor: "transparent" }}>
          <img src={coverSrc} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          <span aria-hidden style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(0,0,0,0.28)" }}>
            <span style={{ width: 30, height: 30, borderRadius: "50%", background: GOLD, opacity: loading ? 0.65 : 1, display: "grid", placeItems: "center", boxShadow: "0 1px 6px rgba(0,0,0,.3)", transition: "opacity .2s" }}>
              {playing
                ? <svg width="12" height="12" viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="#fff" /></svg>
                : <svg width="12" height="12" viewBox="0 0 24 24" style={{ marginLeft: 1 }}><path d="M8 5v14l11-7z" fill="#fff" /></svg>}
            </span>
          </span>
        </button>

        <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
          {kindLabel && <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: GOLD }}>{kindLabel}</div>}
          <div style={{ marginTop: kindLabel ? 2 : 0, fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: 650, lineHeight: 1.25, color: "var(--color-label)", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{title}</div>
          {presenter && <div style={{ marginTop: 2, fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", color: "var(--color-label-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{presenter}</div>}
        </div>

        <span style={{ flexShrink: 0 }}>
          <CardActionBtns favKey={favKey} meta={favMeta} flash={flash} size={30} onMore={onMore || (() => {})} />
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
        <span style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontVariantNumeric: "tabular-nums", color: "var(--color-label-3)", minWidth: 34, textAlign: "right" }}>{fmtTime(cur)}</span>
        <div role="slider" aria-label="Перемотка" aria-valuemin={0} aria-valuemax={Math.round(dur)} aria-valuenow={Math.round(cur)}
          onClick={(e) => seekTo(e.clientX, e.currentTarget)}
          onPointerDown={(e) => { try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* noop */ } seekTo(e.clientX, e.currentTarget); }}
          onPointerMove={(e) => { if (e.buttons) seekTo(e.clientX, e.currentTarget); }}
          style={{ position: "relative", flex: 1, height: 16, display: "flex", alignItems: "center", cursor: "pointer", touchAction: "none" }}>
          <span style={{ position: "absolute", left: 0, right: 0, height: 4, borderRadius: 999, background: "var(--color-glass-thin)" }} />
          <span style={{ position: "absolute", left: 0, width: `${pct * 100}%`, height: 4, borderRadius: 999, background: GOLD }} />
          <span style={{ position: "absolute", left: `calc(${pct * 100}% - 6px)`, width: 12, height: 12, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,.35)", border: `1px solid ${GOLD}` }} />
        </div>
        <span style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontVariantNumeric: "tabular-nums", color: "var(--color-label-3)", minWidth: 34 }}>{total}</span>
      </div>
    </div>
  );
}
