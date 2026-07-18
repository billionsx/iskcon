/**
 * MiniPlayer — плавающая капсула над нижним меню (Apple Music iOS 26.5).
 *
 * ЗАМЕР: высота 58 · радиус 20 · обложка 42/радиус 8 · поле 8 · название 15/600 ·
 * подпись 13 серым · две кнопки транспорта справа (играть · следующая).
 *
 * ПОЧЕМУ СВЕТЛАЯ. Тёмная капсула висела поверх белого приложения как чужая
 * деталь. У Apple мини-плеер — тот же материал, что и панель вкладок под ним:
 * одно стекло, один свет. Крестика у Apple нет и здесь нет: закрывают ЖЕСТОМ
 * (свайп вниз), а не кнопкой, которая занимает место транспорта.
 */
import { useEffect, useRef, useState } from "react";
import { trackSubtitle, usePlayer } from "./store";
import { PlayIcon, PauseIcon, NextIcon } from "./icons";
import { BOOKS, bookFullTitle } from "../books";
import { EqBars, TAP } from "./ui";

export function MiniPlayer({ tabBarVisible }: { tabBarVisible: boolean }) {
  const p = usePlayer();
  /* ЗКН-Н065: встроенный плеер (если он есть на экране) уступает себе место —
     две капсулы об одном и том же звуке это две правды. */
  const visible = p.active && !p.expanded && !p.embeddedOn;
  const [drag, setDrag] = useState(0);
  const from = useRef<number | null>(null);

  useEffect(() => {
    document.body.classList.toggle("player-on", visible);
    return () => document.body.classList.remove("player-on");
  }, [visible]);

  if (!visible) return null;

  const t = p.track;
  const abBook = p.kind === "book" ? BOOKS[p.book] : undefined;
  const isAudiobook = !!abBook?.noText;
  const subtitle = p.kind !== "book"
    ? (t?.artist || p.artist || (p.kind === "katha" ? "Катха" : p.kind === "kirtan" ? "Киртан" : "Бхаджан"))
    : isAudiobook && abBook && !t?.lilaLabel && t?.chapter == null
      ? bookFullTitle(abBook)
      : trackSubtitle(t, p.mode, p.hasCommentary);

  const pct = p.duration > 0 ? Math.min(100, (p.currentTime / p.duration) * 100) : 0;
  const bottom = tabBarVisible
    ? "calc(var(--gtab-h) + var(--gtab-bottom) + 12px + env(safe-area-inset-bottom))"
    : "calc(env(safe-area-inset-bottom) + 12px)";

  return (
    <div style={{
      position: "fixed", left: "50%", transform: `translateX(-50%) translateY(${drag}px)`,
      transition: from.current == null ? "transform .32s cubic-bezier(.32,.72,0,1)" : "none",
      width: "calc(100% - 24px)", maxWidth: 456, bottom, zIndex: 90, pointerEvents: "auto",
    }}>
      <div
        role="button" tabIndex={0} aria-label="Открыть плеер"
        onClick={() => p.open()}
        onKeyDown={(e) => { if (e.key === "Enter") p.open(); }}
        onPointerDown={(e) => { from.current = e.clientY; }}
        onPointerMove={(e) => { if (from.current != null) { const d = e.clientY - from.current; if (d > 0) setDrag(d); } }}
        onPointerUp={() => { const d = drag; from.current = null; setDrag(0); if (d > 60) p.dismiss(); }}
        onPointerCancel={() => { from.current = null; setDrag(0); }}
        style={{
          position: "relative", display: "flex", alignItems: "center", gap: 10,
          height: 58, padding: "0 6px 0 8px", cursor: "pointer",
          borderRadius: 20, overflow: "hidden", touchAction: "pan-y",
          background: "var(--color-menu-glass)",
          backdropFilter: "blur(30px) saturate(180%)", WebkitBackdropFilter: "blur(30px) saturate(180%)",
          boxShadow: "var(--shadow-2)", fontFamily: "var(--font-text)",
        }}>
        <img src={p.cover} alt="" draggable={false}
          style={{ height: 42, width: 42, borderRadius: "var(--radius-xs)", objectFit: "cover",
            flexShrink: 0, background: "var(--color-bg-3)" }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {p.isPlaying && <EqBars />}
            <span style={{ flex: 1, minWidth: 0, fontSize: "var(--text-subhead)", fontWeight: 600,
              color: "var(--color-label)", letterSpacing: "-0.01em",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {t?.title ?? p.bookTitle}
            </span>
          </div>
          <div style={{ fontSize: "var(--text-footnote)", color: "var(--color-label-2)", marginTop: 1,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {subtitle}
          </div>
        </div>

        <button type="button" aria-label={p.isPlaying ? "Пауза" : "Играть"}
          onClick={(e) => { e.stopPropagation(); p.togglePlay(); }} style={btn}>
          {p.isPlaying ? <PauseIcon size={24} /> : <PlayIcon size={24} />}
        </button>
        <button type="button" aria-label="Следующая запись"
          onClick={(e) => { e.stopPropagation(); p.next(); }} style={btn}>
          <NextIcon size={22} />
        </button>

        <div aria-hidden style={{ position: "absolute", left: 12, right: 12, bottom: 4, height: 2,
          borderRadius: 2, background: "var(--color-fill-2)" }}>
          <div style={{ height: "100%", width: `${pct}%`, borderRadius: 2,
            background: "var(--color-gold)", transition: "width .25s linear" }} />
        </div>
      </div>
    </div>
  );
}

const btn = {
  display: "grid", placeItems: "center", height: TAP, width: TAP, flexShrink: 0,
  borderRadius: "var(--radius-pill)", border: "none", background: "none",
  color: "var(--color-label)", cursor: "pointer", WebkitTapHighlightColor: "transparent",
} as const;
