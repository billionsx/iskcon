/**
 * NowPlaying — полноэкранный плеер в стандарте Apple Music (iOS 26, Liquid Glass):
 * иммерсивный фон из обложки (blur), контролы матовым «стеклом» поверх, обложка
 * масштабируется при play/pause. Свайп вниз сворачивает (как у Apple), а закрыть
 * полностью можно крестиком на мини-плеере.
 */
import { useEffect, useRef, useState, type CSSProperties, type Ref } from "react";
import { usePlayer, fmtTime, type Track } from "./store";
import { PlayIcon, PauseIcon, PrevIcon, NextIcon, ChevDownIcon, Back15Icon, Fwd15Icon } from "./icons";

const GOLD = "#D2AA1B";
const glass = (radius: number): CSSProperties => ({
  background: "rgba(255,255,255,0.10)",
  backdropFilter: "blur(24px) saturate(160%)", WebkitBackdropFilter: "blur(24px) saturate(160%)",
  border: "0.5px solid rgba(255,255,255,0.16)", borderRadius: radius,
});

export function NowPlaying() {
  const p = usePlayer();
  const activeRowRef = useRef<HTMLButtonElement>(null);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    if (p.expanded && activeRowRef.current) activeRowRef.current.scrollIntoView({ block: "center", behavior: "auto" });
  }, [p.expanded, p.index, p.mode]);

  if (!p.active) return null;

  const remaining = p.duration > 0 ? p.duration - p.currentTime : 0;
  const subtitle = p.track?.kind === "intro" ? "Вступление" : `Глава ${p.track?.chapter ?? ""}`;

  function onDown(e: React.PointerEvent) { startY.current = e.clientY; setDragging(true); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }
  function onMove(e: React.PointerEvent) { if (startY.current == null) return; const dy = e.clientY - startY.current; if (dy > 0) setDrag(dy); }
  function onUp() { if (startY.current == null) return; const d = drag; startY.current = null; setDragging(false); setDrag(0); if (d > 110) p.close(); }

  return (
    <div
      aria-hidden={!p.expanded}
      style={{
        position: "fixed", left: "50%", bottom: 0, width: "100%", maxWidth: 480, height: "100dvh", zIndex: 95,
        transform: `translateX(-50%) translateY(${p.expanded ? `${drag}px` : "100%"})`,
        transition: dragging ? "none" : "transform .44s cubic-bezier(.32,.72,0,1)",
        color: "#fff", fontFamily: "var(--font-text)", overflow: "hidden",
        display: "flex", flexDirection: "column", paddingTop: "env(safe-area-inset-top)",
      }}
    >
      {/* ambient artwork background */}
      <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <img src={p.cover} alt="" style={{ position: "absolute", inset: "-20%", width: "140%", height: "140%", objectFit: "cover", filter: "blur(72px) saturate(180%) brightness(0.55)", transform: "scale(1.1)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(18,18,20,0.50) 0%, rgba(18,18,20,0.42) 38%, rgba(14,14,16,0.86) 100%)" }} />
      </div>

      {/* content layer */}
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
        {/* drag handle + header */}
        <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          style={{ flexShrink: 0, padding: "8px 14px 6px", touchAction: "none", cursor: "grab" }}>
          <div style={{ width: 38, height: 5, borderRadius: 999, background: "rgba(255,255,255,0.45)", margin: "0 auto 8px" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button type="button" aria-label="Свернуть" onClick={() => p.close()} style={iconBtn(40)}><ChevDownIcon size={24} /></button>
            <div style={{ textAlign: "center", fontSize: 11, letterSpacing: "0.6px", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.bookTitle}</div>
            <div style={{ width: 40 }} />
          </div>
        </div>

        {/* scroll body */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "6px 24px 28px" }}>
          {/* artwork */}
          <div style={{ display: "flex", justifyContent: "center", marginTop: 10, marginBottom: 6 }}>
            <img src={p.cover} alt="" draggable={false}
              style={{ width: "min(70vw, 300px)", aspectRatio: "4 / 5", objectFit: "cover", borderRadius: 14,
                boxShadow: "0 30px 70px rgba(0,0,0,0.6)", transform: `scale(${p.isPlaying ? 1 : 0.9})`,
                transition: "transform .5s cubic-bezier(.2,.7,.2,1)" }} />
          </div>

          {/* title (left-aligned, Apple Music) */}
          <div style={{ marginTop: 22, minWidth: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2, color: "#fff" }}>{p.track?.title}</div>
            <div style={{ marginTop: 4, fontSize: 15, color: "rgba(255,255,255,0.62)" }}>{subtitle}{p.loading ? " · загрузка…" : ""}</div>
          </div>

          {/* scrubber */}
          <div style={{ marginTop: 18 }}>
            <input type="range" aria-label="Перемотка" min={0} max={Math.max(1, Math.floor(p.duration))} step={1}
              value={Math.floor(p.currentTime)} onChange={(e) => p.seek(Number(e.target.value))}
              style={{ width: "100%", accentColor: GOLD, height: 18, cursor: "pointer" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "rgba(255,255,255,0.5)", marginTop: -1, fontVariantNumeric: "tabular-nums" }}>
              <span>{fmtTime(p.currentTime)}</span><span>−{fmtTime(remaining)}</span>
            </div>
          </div>

          {/* transport */}
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
            <button type="button" aria-label="Предыдущая глава" onClick={() => p.prev()} style={iconBtn(46)}><PrevIcon size={28} /></button>
            <button type="button" aria-label="Назад 15 секунд" onClick={() => p.skip(-15)} style={iconBtn(46)}><Back15Icon size={31} /></button>
            <button type="button" aria-label={p.isPlaying ? "Пауза" : "Играть"} onClick={() => p.togglePlay()}
              style={{ display: "grid", placeItems: "center", height: 76, width: 76, borderRadius: "50%", border: "0.5px solid rgba(255,255,255,0.22)", cursor: "pointer",
                background: "rgba(255,255,255,0.16)", backdropFilter: "blur(24px) saturate(160%)", WebkitBackdropFilter: "blur(24px) saturate(160%)", color: "#fff" }}>
              {p.isPlaying ? <PauseIcon size={34} /> : <PlayIcon size={34} />}
            </button>
            <button type="button" aria-label="Вперёд 15 секунд" onClick={() => p.skip(15)} style={iconBtn(46)}><Fwd15Icon size={31} /></button>
            <button type="button" aria-label="Следующая глава" onClick={() => p.next()} style={iconBtn(46)}><NextIcon size={28} /></button>
          </div>

          {/* speed + commentary toggle (glass) */}
          <div style={{ marginTop: 22, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <button type="button" onClick={() => p.cycleRate()} style={{ ...glass(999), flexShrink: 0, height: 36, padding: "0 16px", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>{p.rate}×</button>
            <div style={{ ...glass(999), display: "flex", padding: 3 }}>
              <SegBtn label="Без коммент." active={p.mode === "plain"} onClick={() => p.setMode("plain")} />
              <SegBtn label="С коммент." active={p.mode === "commentary"} onClick={() => p.setMode("commentary")} />
            </div>
          </div>

          {/* queue */}
          <div style={{ marginTop: 28 }}>
            <div style={{ fontSize: 12, letterSpacing: "0.5px", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>
              Далее · {p.mode === "commentary" ? "с комментариями" : "стих за стихом"}
            </div>
            <div>
              {p.tracks.map((t, i) => (
                <QueueRow key={t.file} t={t} active={i === p.index} rowRef={i === p.index ? activeRowRef : undefined} onClick={() => p.jumpTo(i)} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SegBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      style={{ height: 30, padding: "0 14px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap",
        background: active ? "#fff" : "transparent", color: active ? "#1a1a1d" : "rgba(255,255,255,0.72)", transition: "background .2s, color .2s" }}>
      {label}
    </button>
  );
}

function QueueRow({ t, active, rowRef, onClick }: { t: Track; active: boolean; rowRef?: Ref<HTMLButtonElement>; onClick: () => void }) {
  const num = t.kind === "intro" ? "•" : String(t.chapter);
  return (
    <button ref={rowRef} type="button" onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", padding: "10px 10px", borderRadius: 12, border: "none", cursor: "pointer",
        background: active ? "rgba(210,170,27,0.16)" : "transparent", color: "#fff" }}>
      <span style={{ width: 22, textAlign: "center", flexShrink: 0, fontSize: 13, fontWeight: 600, color: active ? GOLD : "rgba(255,255,255,0.45)", fontVariantNumeric: "tabular-nums" }}>{num}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: active ? 600 : 400, color: active ? "#fff" : "rgba(255,255,255,0.85)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</span>
      {t.durationSec ? <span style={{ flexShrink: 0, fontSize: 12, color: "rgba(255,255,255,0.4)", fontVariantNumeric: "tabular-nums" }}>{fmtTime(t.durationSec)}</span> : null}
    </button>
  );
}

function iconBtn(size: number): CSSProperties {
  return { display: "grid", placeItems: "center", height: size, width: size, flexShrink: 0, borderRadius: "50%", border: "none", background: "transparent", color: "#fff", cursor: "pointer" };
}
