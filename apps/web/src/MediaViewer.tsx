/**
 * MediaViewer — полноэкранный встроенный просмотр медиа БЕЗ выхода на внешний
 * сайт: YouTube (через nocookie-iframe), прямое видео (<video>), PDF (нативный
 * просмотрщик браузера в iframe) и изображение. Тёмный оверлей в одном языке с
 * Now Playing; закрытие крестиком/Escape/тапом по фону. На случай, если PDF не
 * отрендерится во встроенном просмотрщике, в шапке есть кнопка «открыть ↗».
 */
import { useEffect } from "react";

export type ViewerMedia = {
  type: "youtube" | "video" | "pdf" | "image";
  url: string;
  title?: string | null;
  subtitle?: string | null;
};

/** Достаёт id ролика из любой формы ссылки YouTube. */
export function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}

function CloseIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" /></svg>; }
function ExtIcon() { return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden><path d="M14 5h5v5M19 5l-8 8M12 5H6a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1v-6" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /></svg>; }

export function MediaViewer({ media, onClose }: { media: ViewerMedia | null; onClose: () => void }) {
  useEffect(() => {
    if (!media) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [media, onClose]);

  if (!media) return null;
  const yid = media.type === "youtube" ? youtubeId(media.url) : null;
  const ext = media.title || media.subtitle || "Открыть";

  return (
    <div role="dialog" aria-modal="true" aria-label={media.title || "Просмотр"}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(0,0,0,0.94)", display: "flex", flexDirection: "column",
        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", animation: "fadein .18s ease" }}>
      {/* шапка просмотрщика */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8, padding: "calc(env(safe-area-inset-top,0px) + 6px) 8px 6px" }}>
        <button type="button" aria-label="Закрыть" onClick={onClose}
          style={{ display: "grid", placeItems: "center", width: 40, height: 40, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.16)", color: "#fff", cursor: "pointer", flexShrink: 0, WebkitTapHighlightColor: "transparent" }}>
          <CloseIcon />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "#fff", fontFamily: "var(--font-text)", fontSize: 15, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{media.title || "Просмотр"}</div>
          {media.subtitle ? <div style={{ color: "rgba(255,255,255,0.6)", fontFamily: "var(--font-text)", fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{media.subtitle}</div> : null}
        </div>
        <a href={media.url} target="_blank" rel="noreferrer" aria-label="Открыть в новой вкладке" title={ext}
          style={{ display: "grid", placeItems: "center", width: 40, height: 40, borderRadius: "50%", color: "rgba(255,255,255,0.7)", textDecoration: "none", flexShrink: 0 }}>
          <ExtIcon />
        </a>
      </div>

      {/* контент */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: media.type === "pdf" ? "0 0 env(safe-area-inset-bottom,0px)" : "8px 12px calc(env(safe-area-inset-bottom,0px) + 12px)" }}>
        {media.type === "youtube" && yid && (
          <div style={{ width: "100%", maxWidth: 960, aspectRatio: "16 / 9", background: "#000", borderRadius: 14, overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}>
            <iframe src={`https://www.youtube-nocookie.com/embed/${yid}?autoplay=1&rel=0&playsinline=1&modestbranding=1`}
              title={media.title || "Видео"} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen
              style={{ width: "100%", height: "100%", border: "none", display: "block" }} />
          </div>
        )}
        {media.type === "youtube" && !yid && (
          <a href={media.url} target="_blank" rel="noreferrer" style={{ color: "#fff", fontFamily: "var(--font-text)", fontSize: 15, textDecoration: "underline" }}>Открыть видео ↗</a>
        )}
        {media.type === "video" && (
          <video src={media.url} controls autoPlay playsInline preload="metadata"
            style={{ width: "100%", maxWidth: 960, maxHeight: "100%", borderRadius: 14, background: "#000", boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }} />
        )}
        {media.type === "pdf" && (
          <iframe src={media.url} title={media.title || "PDF"} style={{ width: "100%", height: "100%", border: "none", background: "#fff" }} />
        )}
        {media.type === "image" && (
          <img src={media.url} alt={media.title || ""} draggable={false}
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 10, boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }} />
        )}
      </div>
    </div>
  );
}
