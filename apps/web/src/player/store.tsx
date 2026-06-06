/**
 * PlayerProvider — единый стор аудио-плеера ISKCON ONE LOVE.
 *
 * Источник плейлиста — наш эндпоинт /api/books/bg/audio (строится из IA).
 * Очередь — вся книга. Режимы: plain (стих за стихом) и commentary
 * (с комментариями; на 4 вводных трека длиннее). Переключение режима
 * сохраняет позицию по главе; для вводного трека (его нет в plain) уходим
 * на 1-ю главу. Media Session даёт локскрин/AirPods. Состояние держим в
 * React-стейте для рендера и зеркалим в ref'ы, чтобы обработчики <audio>
 * и Media Session (живут долго) всегда читали актуальные значения.
 */
import {
  createContext, useContext, useEffect, useRef, useState, type ReactNode,
} from "react";
import { api } from "../api";
import { BOOKS } from "../books";
import { createWebEngine, type AudioEngine } from "./engine";

export type AudioMode = "plain" | "commentary";

export interface Track {
  kind: "intro" | "chapter";
  pos: number;
  chapter: number | null;
  title: string;
  file: string;
  url: string;
  durationSec: number | null;
}
interface ModeData { identifier: string; tracks: Track[] }
interface Manifest { book: string; modes: { plain: ModeData; commentary: ModeData } }

export interface PlayerApi {
  ready: boolean;       // манифест загружен
  active: boolean;      // трек загружен (мини-плеер виден)
  expanded: boolean;    // Now Playing открыт
  loading: boolean;     // буферизация
  mode: AudioMode;
  tracks: Track[];      // очередь текущего режима
  index: number;
  track: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  rate: number;
  cover: string;
  bookTitle: string;
  // точки входа
  playBook(opts?: { mode?: AudioMode; chapter?: number; expand?: boolean }): void;
  playChapter(chapter: number, mode: AudioMode): void;
  // транспорт
  togglePlay(): void;
  next(): void;
  prev(): void;
  seek(sec: number): void;
  skip(delta: number): void;
  cycleRate(): void;
  setMode(mode: AudioMode): void;
  jumpTo(index: number): void;
  // Now Playing
  open(): void;
  close(): void;
}

const Ctx = createContext<PlayerApi | null>(null);
export function usePlayer(): PlayerApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePlayer must be used within <PlayerProvider>");
  return v;
}

export const PLAYER_RATES = [1, 1.25, 1.5, 2];
const BOOK_TITLE = "Бхагавад-гита как она есть";
const COVER = BOOKS.bg?.covers?.[0] ?? "/og-default.png";
const PERSIST_KEY = "iol.player.bg.v1";

function absUrl(u: string): string {
  try { return new URL(u, typeof location !== "undefined" ? location.origin : "https://iskcone.com").href; }
  catch { return u; }
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [mode, setModeState] = useState<AudioMode>("plain");
  const [index, setIndex] = useState(0);
  const [active, setActive] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isPlaying, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);

  // Зеркала для долгоживущих обработчиков (избегаем устаревших замыканий).
  const manifestRef = useRef<Manifest | null>(null);
  const modeRef = useRef<AudioMode>("plain");
  const indexRef = useRef(0);
  const timeRef = useRef(0);
  const durRef = useRef(0);
  const rateRef = useRef(1);
  manifestRef.current = manifest;
  modeRef.current = mode;
  indexRef.current = index;
  timeRef.current = currentTime;
  durRef.current = duration;
  rateRef.current = rate;

  const engineRef = useRef<AudioEngine | null>(null);
  const pendingRef = useRef<{ mode: AudioMode; chapter: number | null; expand?: boolean } | null>(null);
  const restoreRef = useRef<{ time: number } | null>(null);

  const tracks = manifest ? manifest.modes[mode].tracks : [];
  const track = tracks[index] ?? null;

  // ── engine (создаётся один раз) ──
  useEffect(() => {
    const eng = createWebEngine({
      onTime: (t) => { timeRef.current = t; setCurrentTime(t); },
      onDuration: (d) => { if (d && isFinite(d)) { durRef.current = d; setDuration(d); } },
      onPlay: () => setPlaying(true),
      onPause: () => setPlaying(false),
      onEnded: () => goNext(),
      onWaiting: () => setLoading(true),
      onPlaying: () => setLoading(false),
    });
    engineRef.current = eng;
    // восстановить последнюю позицию (пауза) — мини-плеер появится сразу
    try {
      const raw = localStorage.getItem(PERSIST_KEY);
      if (raw) {
        const s = JSON.parse(raw) as { mode: AudioMode; chapter: number | null; time: number; rate: number };
        if (s && (s.mode === "plain" || s.mode === "commentary")) {
          pendingRef.current = { mode: s.mode, chapter: s.chapter, expand: false };
          restoreRef.current = { time: s.time || 0 };
          if (s.rate) { rateRef.current = s.rate; setRate(s.rate); }
          ensureManifest().then((m) => applyPending(m, false));
        }
      }
    } catch { /* ignore */ }
    return () => eng.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function ensureManifest(): Promise<Manifest> {
    if (manifestRef.current) return Promise.resolve(manifestRef.current);
    return fetch(api("/books/bg/audio"))
      .then((r) => r.json())
      .then((m: Manifest) => { manifestRef.current = m; setManifest(m); return m; });
  }

  function persist() {
    try {
      const m = manifestRef.current; if (!m) return;
      const t = m.modes[modeRef.current].tracks[indexRef.current];
      localStorage.setItem(PERSIST_KEY, JSON.stringify({
        mode: modeRef.current, chapter: t?.chapter ?? null, time: Math.floor(timeRef.current), rate: rateRef.current,
      }));
    } catch { /* ignore */ }
  }

  // ── загрузка трека по индексу ──
  function loadIndex(m: Manifest, md: AudioMode, i: number, autoplay: boolean) {
    const list = m.modes[md].tracks;
    if (i < 0 || i >= list.length) return;
    const t = list[i];
    modeRef.current = md; setModeState(md);
    indexRef.current = i; setIndex(i);
    setActive(true);
    timeRef.current = 0; setCurrentTime(0);
    durRef.current = t.durationSec ?? 0; setDuration(t.durationSec ?? 0);
    engineRef.current?.load(t.url, autoplay);
    engineRef.current?.setRate(rateRef.current);
    updateMediaSession(t, md);
    persist();
  }

  function applyPending(m: Manifest, autoplay: boolean) {
    const p = pendingRef.current; if (!p) return;
    pendingRef.current = null;
    const list = m.modes[p.mode].tracks;
    let i = 0;
    if (p.chapter != null) {
      const f = list.findIndex((t) => t.chapter === p.chapter);
      i = f >= 0 ? f : 0;
    }
    loadIndex(m, p.mode, i, autoplay);
    if (p.expand) setExpanded(true);
    // восстановление позиции после загрузки метаданных
    const r = restoreRef.current;
    if (r && r.time > 0) {
      restoreRef.current = null;
      const apply = () => { engineRef.current?.seek(r.time); timeRef.current = r.time; setCurrentTime(r.time); };
      setTimeout(apply, 300);
    }
  }

  // ── точки входа ──
  function playBook(opts?: { mode?: AudioMode; chapter?: number; expand?: boolean }) {
    pendingRef.current = { mode: opts?.mode ?? "plain", chapter: opts?.chapter ?? null, expand: opts?.expand ?? true };
    restoreRef.current = null;
    ensureManifest().then((m) => applyPending(m, true));
  }
  function playChapter(chapter: number, md: AudioMode) {
    pendingRef.current = { mode: md, chapter, expand: true };
    restoreRef.current = null;
    ensureManifest().then((m) => applyPending(m, true));
  }

  function goNext() {
    const m = manifestRef.current; if (!m) return;
    const list = m.modes[modeRef.current].tracks;
    if (indexRef.current + 1 < list.length) loadIndex(m, modeRef.current, indexRef.current + 1, true);
    else { setPlaying(false); }
  }
  function goPrev() {
    const m = manifestRef.current; if (!m) return;
    if (timeRef.current > 3) { engineRef.current?.seek(0); timeRef.current = 0; setCurrentTime(0); return; }
    if (indexRef.current - 1 >= 0) loadIndex(m, modeRef.current, indexRef.current - 1, true);
    else { engineRef.current?.seek(0); }
  }
  function togglePlay() {
    const eng = engineRef.current; if (!eng) return;
    if (eng.paused) eng.play().catch(() => {}); else eng.pause();
  }
  function seek(sec: number) { engineRef.current?.seek(sec); timeRef.current = sec; setCurrentTime(sec); persist(); }
  function skip(delta: number) {
    const d = durRef.current || Infinity;
    seek(Math.min(Math.max(0, timeRef.current + delta), d));
  }
  function cycleRate() {
    const i = PLAYER_RATES.indexOf(rateRef.current);
    const r = PLAYER_RATES[(i + 1) % PLAYER_RATES.length];
    rateRef.current = r; setRate(r); engineRef.current?.setRate(r); persist();
  }

  // ── смена режима: держим главу; вводный трек → 1-я глава ──
  function setMode(md: AudioMode) {
    const m = manifestRef.current;
    if (!m || md === modeRef.current) { modeRef.current = md; setModeState(md); return; }
    const cur = m.modes[modeRef.current].tracks[indexRef.current];
    const target = m.modes[md].tracks;
    let i = 0;
    if (cur?.chapter != null) {
      const f = target.findIndex((t) => t.chapter === cur.chapter);
      i = f >= 0 ? f : 0;
    } else {
      const f = target.findIndex((t) => t.kind === "chapter");
      i = f >= 0 ? f : 0;
    }
    const wasPlaying = !engineRef.current?.paused;
    loadIndex(m, md, i, wasPlaying);
  }
  function jumpTo(i: number) { const m = manifestRef.current; if (m) loadIndex(m, modeRef.current, i, true); }

  // ── Media Session (локскрин / Пункт управления / AirPods) ──
  function updateMediaSession(t: Track, md: AudioMode) {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    try {
      ms.metadata = new MediaMetadata({
        title: t.title,
        artist: BOOK_TITLE,
        album: md === "commentary" ? "С комментариями" : "Стих за стихом",
        artwork: [
          { src: absUrl(COVER), sizes: "512x512", type: "image/jpeg" },
          { src: absUrl(COVER), sizes: "256x256", type: "image/jpeg" },
        ],
      });
      ms.setActionHandler("play", () => togglePlay());
      ms.setActionHandler("pause", () => togglePlay());
      ms.setActionHandler("previoustrack", () => goPrev());
      ms.setActionHandler("nexttrack", () => goNext());
      ms.setActionHandler("seekbackward", () => skip(-15));
      ms.setActionHandler("seekforward", () => skip(15));
      ms.setActionHandler("seekto", (d: MediaSessionActionDetails) => {
        if (typeof d.seekTime === "number") seek(d.seekTime);
      });
    } catch { /* ignore */ }
  }

  // позиция/состояние для локскрина
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
      if (duration && isFinite(duration) && navigator.mediaSession.setPositionState) {
        navigator.mediaSession.setPositionState({
          duration, position: Math.min(currentTime, duration), playbackRate: rate,
        });
      }
    } catch { /* ignore */ }
  }, [isPlaying, currentTime, duration, rate]);

  // периодически сохраняем позицию
  useEffect(() => {
    const id = setInterval(() => { if (active) persist(); }, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const value: PlayerApi = {
    ready: !!manifest, active, expanded, loading, mode, tracks, index, track,
    isPlaying, currentTime, duration, rate, cover: COVER, bookTitle: BOOK_TITLE,
    playBook, playChapter, togglePlay, next: goNext, prev: goPrev, seek, skip, cycleRate, setMode, jumpTo,
    open: () => { if (active) setExpanded(true); },
    close: () => setExpanded(false),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** M:SS или H:MM:SS — длинные комментарии бывают по несколько часов. */
export function fmtTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const s = Math.floor(sec % 60);
  const m = Math.floor((sec / 60) % 60);
  const h = Math.floor(sec / 3600);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
