/**
 * NowPlaying — полноэкранный экран плеера (в стиле обложки книги: графит + золото).
 * Обложка, скраббер, транспорт (−15 / +15, пред/след), скорость, переключатель
 * «с комментариями / без» (держит главу) и очередь всей книги с автоскроллом
 * к текущей главе.
 */
import { useEffect, useRef, type CSSProperties, type Ref } from "react";
import { usePlayer, fmtTime, type Track } from "./store";
import { PlayIcon, PauseIcon, PrevIcon, NextIcon, ChevDownIcon, Back15Icon, Fwd15Icon } from "./icons";

const GRAPHITE = "radial-gradient(120% 90% at 50% -10%, #3a3a40 0%, #29292e 42%, #161619 100%)";
const GOLD = "#D2AA1B";

export function NowPlaying() {
  const p = usePlayer();
  const listRef = useRef<HTMLDivElement>(null);
  const activeRowRef = useRef<HTMLButtonElement>(null);

  // автоскролл очереди к текущей главе при открытии
  useEffect(() => {
    if (p.expanded && activeRowRef.current) {
      activeRowRef.current.scrollIntoView({ block: "center", behavior: "auto" });
    }
  }, [p.expanded, p.index, p.mode]);

  if (!p.active) return null;

  const remaining = p.duration > 0 ? p.duration - p.currentTime : 0;
  const subtitle = p.track?.kind === "intro" ? "Вступление" : `Глава ${p.track?.chapter ?? ""}`;

  return (
    <div
      aria-hidden={!p.expanded}
      style={{
        position: "fixed", left: "50%", bottom: 0,
        transform: `translateX(-50%) translateY(${p.expanded ? "0" : "100%"})`,
        width: "100%", maxWidth: 480, height: "100dvh", zIndex: 95,
        transition: "transform .42s cubic-bezier(.32,.72,0,1)",
        background: GRAPHITE, color: "#fff", fontFamily: "var(--font-text)",
        display: "flex", flexDirection: "column",
        pointerEvents: p.expanded ? "auto" : "none",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px 4px" }}>
        <button type="button" aria-label="Свернуть" onClick={() => p.close()} style={iconBtn}>
          <ChevDownIcon size={26} />
        </button>
        <div style={{ textAlign: "center", fontSize: 11, letterSpacing: "0.6px", textTransform: "uppercase", color: "rgba(255,255,255,0.55)" }}>
          {p.bookTitle}
        </div>
        <div style={{ width: 40 }} />
      </div>

      {/* scroll body */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "0 22px 24px" }}>
        {/* cover */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
          <img src={p.cover} alt="" draggable={false}
            style={{ width: "min(72vw, 300px)", aspectRatio: "4 / 5", objectFit: "cover", borderRadius: 16, boxShadow: "0 24px 60px rgba(0,0,0,0.55)" }} />
        </div>

        {/* title */}
        <div style={{ marginTop: 22, textAlign: "center" }}>
          <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2 }}>{p.track?.title}</div>
          <div style={{ marginTop: 5, fontSize: 14, color: "rgba(255,255,255,0.6)" }}>
            {subtitle}{p.loading ? " · загрузка…" : ""}
          </div>
        </div>

        {/* scrubber */}
        <div style={{ marginTop: 18 }}>
          <input
            type="range" aria-label="Перемотка"
            min={0} max={Math.max(1, Math.floor(p.duration))} step={1}
            value={Math.floor(p.currentTime)}
            onChange={(e) => p.seek(Number(e.target.value))}
            style={{ width: "100%", accentColor: GOLD, height: 22, cursor: "pointer" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "rgba(255,255,255,0.5)", marginTop: -2, fontVariantNumeric: "tabular-nums" }}>
            <span>{fmtTime(p.currentTime)}</span>
            <span>−{fmtTime(remaining)}</span>
          </div>
        </div>

        {/* transport */}
        <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 18 }}>
          <button type="button" aria-label="Предыдущая глава" onClick={() => p.prev()} style={iconBtn}><PrevIcon size={30} /></button>
          <button type="button" aria-label="Назад 15 секунд" onClick={() => p.skip(-15)} style={{ ...iconBtn, position: "relative" }}>
            <Back15Icon size={32} /><span style={tinyNum}>15</span>
          </button>
          <button type="button" aria-label={p.isPlaying ? "Пауза" : "Играть"} onClick={() => p.togglePlay()}
            style={{ display: "grid", placeItems: "center", height: 74, width: 74, borderRadius: "50%", border: "none", cursor: "pointer", background: GOLD, color: "#1a1a1d", boxShadow: "0 10px 30px rgba(210,170,27,0.4)" }}>
            {p.isPlaying ? <PauseIcon size={34} /> : <PlayIcon size={34} />}
          </button>
          <button type="button" aria-label="Вперёд 15 секунд" onClick={() => p.skip(15)} style={{ ...iconBtn, position: "relative" }}>
            <Fwd15Icon size={32} /><span style={tinyNum}>15</span>
          </button>
          <button type="button" aria-label="Следующая глава" onClick={() => p.next()} style={iconBtn}><NextIcon size={30} /></button>
        </div>

        {/* speed + commentary toggle */}
        <div style={{ marginTop: 22, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <button type="button" onClick={() => p.cycleRate()}
            style={{ flexShrink: 0, height: 34, padding: "0 14px", borderRadius: 999, border: "0.5px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.08)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {p.rate}×
          </button>
          <div style={{ display: "flex", background: "rgba(255,255,255,0.08)", borderRadius: 999, padding: 3, border: "0.5px solid rgba(255,255,255,0.12)" }}>
            <SegBtn label="Без коммент." active={p.mode === "plain"} onClick={() => p.setMode("plain")} />
            <SegBtn label="С коммент." active={p.mode === "commentary"} onClick={() => p.setMode("commentary")} />
          </div>
        </div>

        {/* queue */}
        <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: 12, letterSpacing: "0.5px", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", marginBottom: 6 }}>
            Далее · {p.mode === "commentary" ? "с комментариями" : "стих за стихом"}
          </div>
          <div ref={listRef}>
            {p.tracks.map((t, i) => (
              <QueueRow key={t.file} t={t} i={i} active={i === p.index} rowRef={i === p.index ? activeRowRef : undefined} onClick={() => p.jumpTo(i)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SegBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      style={{
        height: 28, padding: "0 14px", borderRadius: 999, border: "none", cursor: "pointer",
        fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap",
        background: active ? "#fff" : "transparent", color: active ? "#1a1a1d" : "rgba(255,255,255,0.7)",
        transition: "background .2s, color .2s",
      }}>
      {label}
    </button>
  );
}

function QueueRow({ t, i, active, rowRef, onClick }: { t: Track; i: number; active: boolean; rowRef?: Ref<HTMLButtonElement>; onClick: () => void }) {
  const num = t.kind === "intro" ? "•" : String(t.chapter);
  return (
    <button ref={rowRef} type="button" onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
        padding: "10px 10px", borderRadius: 12, border: "none", cursor: "pointer",
        background: active ? "rgba(210,170,27,0.14)" : "transparent", color: "#fff",
      }}>
      <span style={{ width: 22, textAlign: "center", flexShrink: 0, fontSize: 13, fontWeight: 600, color: active ? GOLD : "rgba(255,255,255,0.45)", fontVariantNumeric: "tabular-nums" }}>{num}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: active ? 600 : 400, color: active ? "#fff" : "rgba(255,255,255,0.85)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {t.title}
      </span>
      {t.durationSec ? <span style={{ flexShrink: 0, fontSize: 12, color: "rgba(255,255,255,0.4)", fontVariantNumeric: "tabular-nums" }}>{fmtTime(t.durationSec)}</span> : null}
    </button>
  );
}

const iconBtn: CSSProperties = {
  display: "grid", placeItems: "center", height: 48, width: 48, flexShrink: 0,
  borderRadius: "50%", border: "none", background: "transparent", color: "#fff", cursor: "pointer",
};
const tinyNum: CSSProperties = {
  position: "absolute", top: "52%", left: "50%", transform: "translate(-50%,-50%)",
  fontSize: 8.5, fontWeight: 700, color: "#fff", pointerEvents: "none",
};
