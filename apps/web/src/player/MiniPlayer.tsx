/**
 * MiniPlayer — постоянная мини-панель плеера. Видна, когда трек загружен.
 * Сидит над таб-баром (если он показан) или над домашним индикатором.
 * Тап по панели (не по кнопкам) открывает Now Playing.
 */
import { usePlayer } from "./store";
import { PlayIcon, PauseIcon, NextIcon } from "./icons";
import type { CSSProperties } from "react";

export function MiniPlayer({ tabBarVisible }: { tabBarVisible: boolean }) {
  const p = usePlayer();
  if (!p.active || p.expanded) return null;

  const pct = p.duration > 0 ? Math.min(100, (p.currentTime / p.duration) * 100) : 0;
  const subtitle = p.track?.kind === "intro"
    ? (p.mode === "commentary" ? "С комментариями · вступление" : "Вступление")
    : `Глава ${p.track?.chapter ?? ""} · ${p.mode === "commentary" ? "с комментариями" : "стих за стихом"}`;

  const bottom = tabBarVisible
    ? "calc(52px + env(safe-area-inset-bottom))"
    : "env(safe-area-inset-bottom)";

  return (
    <div
      style={{
        position: "fixed", left: "50%", transform: "translateX(-50%)",
        width: "calc(100% - 16px)", maxWidth: 464, bottom, zIndex: 60,
        pointerEvents: "auto",
      }}
    >
      <div
        role="button" tabIndex={0} aria-label="Открыть плеер"
        onClick={() => p.open()}
        onKeyDown={(e) => { if (e.key === "Enter") p.open(); }}
        style={{
          position: "relative", display: "flex", alignItems: "center", gap: 12,
          height: 58, padding: "0 8px 0 8px", cursor: "pointer",
          borderRadius: 16, overflow: "hidden",
          background: "rgba(28,28,32,0.86)",
          backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)",
          border: "0.5px solid rgba(255,255,255,0.10)",
          boxShadow: "0 10px 34px rgba(0,0,0,0.34)",
          fontFamily: "var(--font-text)",
        }}
      >
        {/* прогресс — тонкая линия сверху */}
        <div aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "rgba(255,255,255,0.12)" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: "#D2AA1B", transition: "width .25s linear" }} />
        </div>

        <img src={p.cover} alt="" draggable={false}
          style={{ height: 42, width: 42, borderRadius: 9, objectFit: "cover", flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "-0.01em" }}>
            {p.track?.title ?? p.bookTitle}
          </div>
          <div style={{ fontSize: 11.5, fontWeight: 400, color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 1 }}>
            {subtitle}
          </div>
        </div>

        <button type="button" aria-label={p.isPlaying ? "Пауза" : "Играть"}
          onClick={(e) => { e.stopPropagation(); p.togglePlay(); }}
          style={btn}>
          {p.isPlaying ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
        </button>
        <button type="button" aria-label="Следующая глава"
          onClick={(e) => { e.stopPropagation(); p.next(); }}
          style={btn}>
          <NextIcon size={20} />
        </button>
      </div>
    </div>
  );
}

const btn: CSSProperties = {
  display: "grid", placeItems: "center", height: 40, width: 40, flexShrink: 0,
  borderRadius: "50%", border: "none", background: "transparent", color: "#fff", cursor: "pointer",
};
