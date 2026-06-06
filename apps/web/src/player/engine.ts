/**
 * AudioEngine — тонкая обёртка над воспроизведением одного трека.
 *
 * Веб-реализация использует один <audio>. В нативной сборке (Capacitor) будет
 * другая реализация ЭТОГО ЖЕ интерфейса (AVPlayer/ExoPlayer + фоновый режим),
 * поэтому стор и UI не меняются — подменяется только движок. Media Session
 * живёт в сторе (он владеет метаданными очереди), движок знает только URL.
 */

export interface AudioEngine {
  load(url: string, autoplay: boolean): void;
  play(): Promise<void>;
  pause(): void;
  seek(sec: number): void;
  setRate(rate: number): void;
  readonly currentTime: number;
  readonly duration: number;
  readonly paused: boolean;
  destroy(): void;
}

export interface EngineEvents {
  onTime?: (t: number) => void;
  onDuration?: (d: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onWaiting?: () => void;
  onPlaying?: () => void;
}

export function createWebEngine(ev: EngineEvents): AudioEngine {
  const el: HTMLAudioElement | null = typeof Audio !== "undefined" ? new Audio() : null;
  if (el) {
    el.preload = "metadata";
    // Same-origin (/audio/*), no crossOrigin needed.
    el.addEventListener("timeupdate", () => ev.onTime?.(el.currentTime));
    el.addEventListener("durationchange", () => ev.onDuration?.(el.duration || 0));
    el.addEventListener("loadedmetadata", () => ev.onDuration?.(el.duration || 0));
    el.addEventListener("play", () => ev.onPlay?.());
    el.addEventListener("pause", () => ev.onPause?.());
    el.addEventListener("ended", () => ev.onEnded?.());
    el.addEventListener("waiting", () => ev.onWaiting?.());
    el.addEventListener("playing", () => ev.onPlaying?.());
  }
  return {
    load(url, autoplay) {
      if (!el) return;
      if (el.src !== url) el.src = url;
      if (autoplay) el.play().catch(() => { /* autoplay may be blocked until a gesture */ });
    },
    play() { return el ? el.play() : Promise.resolve(); },
    pause() { el?.pause(); },
    seek(sec) { if (el && isFinite(sec)) el.currentTime = Math.max(0, sec); },
    setRate(rate) { if (el) el.playbackRate = rate; },
    get currentTime() { return el?.currentTime ?? 0; },
    get duration() { return el && isFinite(el.duration) ? el.duration : 0; },
    get paused() { return el?.paused ?? true; },
    destroy() { if (el) { el.pause(); el.removeAttribute("src"); el.load(); } },
  };
}
