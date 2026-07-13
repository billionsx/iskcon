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
import { BOOKS, bookFullTitle } from "../books";
import { albumById, artistBySlug, albumCover } from "../kirtans";
import { recordListen } from "../account/track";
import { replaceUrl } from "../nav";
import { createWebEngine, type AudioEngine } from "./engine";

export type AudioMode = "plain" | "commentary";
export type Source = "book" | "kirtan" | "bhajan";

export interface Track {
  kind: "intro" | "chapter" | "song";
  pos: number;
  chapter: number | null;
  title: string;
  file: string;
  url: string;
  durationSec: number | null;
  lila?: string;        // ЧЧ: adi|madhya|antya · ШБ: номер песни
  lilaLabel?: string;   // ЧЧ: «Ади-лила» · ШБ: «Песнь 10»
  part?: number | null; // ЧЧ: часть составной главы · ШБ: позиция стиха в главе
  group?: string;       // суб-таб очереди; по умолчанию = lila. ШБ: глава внутри песни
  groupLabel?: string;  // ШБ: «Глава 14»
  chapterTitle?: string; // ШБ: «Молитвы Господа Брахмы»
  ref?: string | null;  // ШБ: стих дорожки («ШБ 10.14.21-22»)
  covers?: string[];    // ШБ: ВСЕ стихи книги, покрытые дорожкой (аудио «18-20» = книга «18-19» + «20»)
  artist?: string;      // киртан: исполнитель
  album?: string;       // киртан: альбом
}
interface ModeData { identifier: string; tracks: Track[] }
export interface CantoRef { canto: number; label: string; tracks: number }
interface Manifest {
  book: string;
  modes: { plain: ModeData; commentary?: ModeData };
  lilas?: { lila: string; label: string }[];
  scope?: string;      // ШБ: песнь, которой ограничен манифест
  cantos?: CantoRef[]; // ШБ: песни, где озвучка уже есть
}

/** Книги, чей манифест приходит НЕ целиком, а разделом (ШБ: одна песнь = 784…3662 дорожки;
 *  все 12 песней — 13 256 дорожек, такую очередь незачем ни грузить, ни рисовать). */
const SCOPED_BOOKS = new Set(["sb"]);

export type RepeatMode = "off" | "book" | "library" | "one";
export type OrderMode = "forward" | "shuffle" | "reverse";

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
  order: OrderMode;
  repeat: RepeatMode;
  cover: string;
  bookTitle: string;
  book: string;           // активная книга (bg|cc|…) или альбом киртанов — для обложки Now Playing
  kind: Source;           // источник: книга или киртан
  artist: string;         // киртан: исполнитель (для подзаголовков); "" для книг
  hasCommentary: boolean; // прятать тумблер «комментарии», когда их нет (ЧЧ/киртаны)
  // точки входа
  // ШБ: очередь трёхуровневая — ПЕСНЬ → ГЛАВА → СТИХ. Манифест приходит по одной песни
  // (13 253 дорожки одним куском не грузят), поэтому список песней и дорожки ЧУЖОЙ песни
  // плеер отдаёт отдельно: иначе человек видит одну песнь и думает, что залита только она.
  cantos: CantoRef[];                                  // песни, где озвучка уже есть
  scope: string;                                       // песнь, которая ИГРАЕТ
  tracksFor(canto: string): Promise<Track[]>;          // дорожки песни, НЕ трогая воспроизведение
  playTrack(canto: string, file: string): void;        // включить дорожку (можно из другой песни)
  playBook(opts?: { book?: string; mode?: AudioMode; chapter?: number; expand?: boolean }): void;
  playChapter(book: string, chapter: number, mode: AudioMode, lila?: string, ref?: string | null): void;
  playKirtan(albumId: string, startIndex?: number): void;
  playBhajan(slug: string, startIndex?: number, set?: "lectures"): void;
  // транспорт
  togglePlay(): void;
  next(): void;
  prev(): void;
  seek(sec: number): void;
  skip(delta: number): void;
  cycleRate(): void;
  cycleOrder(): void;
  cycleRepeat(): void;
  setMode(mode: AudioMode): void;
  jumpTo(index: number): void;
  // Now Playing
  open(): void;
  close(): void;
  dismiss(): void;
}

const Ctx = createContext<PlayerApi | null>(null);
export function usePlayer(): PlayerApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePlayer must be used within <PlayerProvider>");
  return v;
}

export const PLAYER_RATES = [1, 1.25, 1.5, 2];

/** Покрывает ли дорожка этот стих книги. Нарезка канала и издания расходится: аудио «18-20»
 *  = книга «18-19» + «20». Искать по одному `ref` — значит сказать «скоро» на стих 20,
 *  хотя звук есть. */
export function trackCoversRef(t: Track, ref: string): boolean {
  return t.ref === ref || !!t.covers?.includes(ref);
}

/** Номер стиха из ключа: «ШБ 9.8.9-10» → 9. Нужен, чтобы найти БЛИЖАЙШИЙ озвученный стих. */
function verseNum(ref?: string | null): number {
  if (!ref) return -1;
  const n = parseInt(String(ref).split(".").pop() ?? "", 10);
  return Number.isNaN(n) ? -1 : n;
}

/**
 * Подпись дорожки книги — ОДНА на все поверхности плеера (мини-плеер, Now Playing,
 * экран блокировки, «продолжить слушать»). Раньше каждая поверхность собирала строку
 * сама, и название главы не показывалось нигде: у ШБ дорожка — это СТИХ («Текст 5»),
 * и без главы человек не понимает, где он в книге.
 *
 *   ШБ:  «Песнь 1 · Глава 1. Вопросы мудрецов»
 *   ЧЧ:  «Ади-лила · Глава 7»
 *   БГ:  «Глава 7 · с комментариями»
 */
export function trackSubtitle(t: Track | null, mode: AudioMode, hasCommentary: boolean): string {
  if (!t) return "";
  if (t.kind === "intro" && !t.chapter) return mode === "commentary" ? "С комментариями · вступление" : "Вступление";
  const ch = t.chapter != null
    ? `Глава ${t.chapter}${t.chapterTitle ? `. ${t.chapterTitle}` : ""}`
    : "";
  if (t.lilaLabel) return [t.lilaLabel, ch].filter(Boolean).join(" · ");
  const cm = hasCommentary ? ` · ${mode === "commentary" ? "с комментариями" : "стих за стихом"}` : "";
  return ch ? `${ch}${cm}` : "";
}
/** Единая запасная обложка плеера (фирменный знак ISKCON ONE LOVE) — для любого
 *  аудио без собственной обложки. ЗКН-Д005: единая заглушка cover-fallback.svg. */
export const AUDIO_FALLBACK_COVER = "/cover-fallback.svg";        // ЗКН-Д005
/** Обложка фирменного знака для СПИСКА бхаджанов — золото на белом (всегда,
 *  вне зависимости от темы). В плеере используется тёмная AUDIO_FALLBACK_COVER. */
export const AUDIO_FALLBACK_COVER_LIGHT = "/cover-fallback.svg";  // ЗКН-Д005 — один ассет на обе темы
// Отображаемые название/обложка плеера по книге (источник — books.ts).
const BOOK_AUDIO: Record<string, { title: string; cover: string }> = {
  bg: { title: "Бхагавад-гита как она есть", cover: BOOKS.bg?.covers?.[0] ?? AUDIO_FALLBACK_COVER },
  cc: { title: "Шри Чайтанья-чаритамрита", cover: BOOKS.cc?.covers?.[0] ?? AUDIO_FALLBACK_COVER },
};
function bookCfg(id: string) {
  return BOOK_AUDIO[id] ?? { title: BOOKS[id] ? bookFullTitle(BOOKS[id]) : "ISKCON ONE LOVE", cover: BOOKS[id]?.covers?.[0] ?? AUDIO_FALLBACK_COVER };
}
/** Дисплей-инфо бхаджанов (название/обложка/автор) — заполняется из манифеста при загрузке. */
const bhajanMeta: Record<string, { title: string; cover: string; artist: string }> = {};
/** Заголовок/обложка/исполнитель плеера по активному элементу (книга или альбом киртанов). */
function cfgFor(id: string, src: Source): { title: string; cover: string; artist: string } {
  if (src === "kirtan") {
    const al = albumById(id);
    return {
      title: al?.title ?? "Киртан",
      cover: al ? albumCover(al) : AUDIO_FALLBACK_COVER,
      artist: al ? (artistBySlug(al.artist)?.name ?? "") : "",
    };
  }
  if (src === "bhajan") {
    const d = bhajanMeta[id];
    return { title: d?.title ?? "Бхаджан", cover: d?.cover || AUDIO_FALLBACK_COVER, artist: d?.artist ?? "" };
  }
  const c = bookCfg(id);
  return { title: c.title, cover: c.cover, artist: "" };
}
const PERSIST_KEY = "iol.player.v2"; // {book,mode,chapter,time,rate}; мигрируем со старого bg-ключа

function absUrl(u: string): string {
  try { return new URL(u, typeof location !== "undefined" ? location.origin : "https://iskcone.com").href; }
  catch { return u; }
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [bookId, setBookId] = useState("bg");
  const [source, setSource] = useState<Source>("book");
  const [mode, setModeState] = useState<AudioMode>("plain");
  const [index, setIndex] = useState(0);
  const [active, setActive] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isPlaying, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [orderMode, setOrderMode] = useState<OrderMode>("forward");
  const [repeat, setRepeat] = useState<RepeatMode>("off");

  // Зеркала для долгоживущих обработчиков (избегаем устаревших замыканий).
  const manifestRef = useRef<Manifest | null>(null);
  const bookRef = useRef("bg");
  const scopeRef = useRef("");   // ШБ: песнь, которой ограничен манифест ("" — книга целиком)
  const [scopeId, setScopeId] = useState("");          // тот же раздел, но для перерисовки
  const scopeCache = useRef<Record<string, Track[]>>({});  // дорожки чужих песней — на просмотр
  const sourceRef = useRef<Source>("book");
  const modeRef = useRef<AudioMode>("plain");
  const indexRef = useRef(0);
  const timeRef = useRef(0);
  const durRef = useRef(0);
  const rateRef = useRef(1);
  const orderModeRef = useRef<OrderMode>("forward");
  const repeatRef = useRef<RepeatMode>("off");
  const seqRef = useRef<number[]>([]);
  manifestRef.current = manifest;
  bookRef.current = bookId;
  sourceRef.current = source;
  modeRef.current = mode;
  indexRef.current = index;
  timeRef.current = currentTime;
  durRef.current = duration;
  rateRef.current = rate;
  orderModeRef.current = orderMode;
  repeatRef.current = repeat;

  const engineRef = useRef<AudioEngine | null>(null);
  const pendingRef = useRef<{ mode: AudioMode; chapter: number | null; lila?: string; ref?: string | null; file?: string; expand?: boolean; index?: number } | null>(null);
  const restoreRef = useRef<{ time: number } | null>(null);

  const tracks = manifest ? (manifest.modes[mode] ?? manifest.modes.plain).tracks : [];
  const track = tracks[index] ?? null;

  // ── engine (создаётся один раз) ──
  useEffect(() => {
    const eng = createWebEngine({
      onTime: (t) => { timeRef.current = t; setCurrentTime(t); },
      onDuration: (d) => { if (d && isFinite(d)) { durRef.current = d; setDuration(d); } },
      onPlay: () => setPlaying(true),
      onPause: () => setPlaying(false),
      onEnded: () => advance(true),
      onWaiting: () => setLoading(true),
      onPlaying: () => setLoading(false),
    });
    engineRef.current = eng;
    // deep-link ?listen → авто-открытие плеера на книге/главе (приоритет над restore)
    if (typeof location !== "undefined" && new URLSearchParams(location.search).has("listen")) {
      const seg = location.pathname.split("/").filter(Boolean);   // ["book","cc","madhya","13"] | ["book","bg","13"]
      const bk = seg[1] && BOOKS[seg[1]] ? seg[1] : "bg";
      const hier = !!BOOKS[bk]?.hierarchical;
      const lila = hier ? seg[2] : undefined;
      const chSeg = hier ? seg[3] : seg[2];
      const ch = chSeg ? parseInt(chSeg, 10) : NaN;
      replaceUrl(location.pathname);   // ЗКН-Н001: nav.ts сохраняет appIdx (raw replaceState стирал его и ломал «назад»)
      if (ch) playChapter(bk, ch, "plain", lila); else playBook({ book: bk, mode: "plain" });
      return () => eng.destroy();
    }
    // восстановить последнюю позицию (пауза) — мини-плеер появится сразу
    try {
      const raw = localStorage.getItem(PERSIST_KEY) ?? localStorage.getItem("iol.player.bg.v1");
      if (raw) {
        const s = JSON.parse(raw) as { book?: string; scope?: string | null; mode: AudioMode; chapter: number | null; time: number; rate: number };
        if (s && (s.mode === "plain" || s.mode === "commentary")) {
          const bk = s.book && BOOKS[s.book] ? s.book : "bg";
          bookRef.current = bk; setBookId(bk);
          scopeRef.current = SCOPED_BOOKS.has(bk) && s.scope ? String(s.scope) : "";
          pendingRef.current = { mode: s.mode, chapter: s.chapter, lila: scopeRef.current || undefined, expand: false };
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
    const want = bookRef.current;
    const src = sourceRef.current;
    const scope = scopeRef.current;
    const cur = manifestRef.current;
    if (cur && cur.book === want && (cur.scope ?? "") === scope) return Promise.resolve(cur);
    const bhajIsLec = src === "bhajan" && want.endsWith("::lec");
    const bhajBase = bhajIsLec ? want.slice(0, -5) : want;
    const path = src === "kirtan" ? `/kirtans/${want}/audio`
      : src === "bhajan" ? `/bhajans/audio?slug=${encodeURIComponent(bhajBase)}${bhajIsLec ? "&set=lectures" : ""}`
      : `/books/${want}/audio${scope ? `?canto=${encodeURIComponent(scope)}` : ""}`;
    return fetch(api(path))
      .then((r) => r.json())
      .then((m: Manifest & { title?: string; cover?: string; artist?: string }) => {
        if (src === "bhajan") bhajanMeta[want] = { title: m.title || "Бхаджан", cover: m.cover || "", artist: m.artist || "" };
        m.book = want; // ключ кэша = полный book id (вкл. суффикс ::lec)
        if (m.scope) { scopeRef.current = m.scope; setScopeId(m.scope); } // раздел не задали — воркер выбрал первый
        manifestRef.current = m; setManifest(m); return m;
      });
  }

  function persist() {
    try {
      if (sourceRef.current !== "book") return; // киртаны/бхаджаны не восстанавливаем (v2)
      const m = manifestRef.current; if (!m) return;
      const t = (m.modes[modeRef.current] ?? m.modes.plain).tracks[indexRef.current];
      localStorage.setItem(PERSIST_KEY, JSON.stringify({
        book: bookRef.current, scope: scopeRef.current || null, mode: modeRef.current, chapter: t?.chapter ?? null,
        time: Math.floor(timeRef.current), rate: rateRef.current,
      }));
    } catch { /* ignore */ }
  }

  // ── загрузка трека по индексу ──
  function loadIndex(m: Manifest, md: AudioMode, i: number, autoplay: boolean) {
    const useMode: AudioMode = m.modes[md] ? md : "plain";
    const list = m.modes[useMode].tracks;
    if (i < 0 || i >= list.length) return;
    if (seqRef.current.length !== list.length) seqRef.current = buildOrder(list.length, orderModeRef.current, i);
    const t = list[i];
    modeRef.current = useMode; setModeState(useMode);
    indexRef.current = i; setIndex(i);
    setActive(true);
    timeRef.current = 0; setCurrentTime(0);
    durRef.current = t.durationSec ?? 0; setDuration(t.durationSec ?? 0);
    engineRef.current?.load(t.url, autoplay);
    engineRef.current?.setRate(rateRef.current);
    updateMediaSession(t, useMode);
    // Телеметрия прослушивания: только при реальном старте (autoplay), не при
    // тихом восстановлении позиции на старте приложения. No-op для гостя.
    if (autoplay && sourceRef.current !== "bhajan") {
      const isK = sourceRef.current === "kirtan";
      const cfg = cfgFor(bookRef.current, sourceRef.current);
      let listenRef = t.url;
      try { listenRef = new URL(t.url).pathname; } catch { /* оставляем абсолютный url */ }
      recordListen({
        source: isK ? "kirtan" : "book",
        ref: listenRef,
        title: t.title,
        subtitle: isK
          ? (t.artist || cfg.artist || cfg.title)
          : (trackSubtitle(t, useMode, !!manifestRef.current?.modes.commentary?.tracks.length)
             || (useMode === "commentary" ? "С комментариями" : "Стих за стихом")),
        cover: cfg.cover,
        album: bookRef.current, // машинный id книги/альбома — для «продолжить слушать»
        artist: isK ? (t.artist || cfg.artist || null) : null,
        href: isK ? null : `/books/${bookRef.current}`,
        durationSec: t.durationSec ?? null,
        positionSec: 0,
      });
    }
    persist();
  }

  function applyPending(m: Manifest, autoplay: boolean) {
    const p = pendingRef.current; if (!p) return;
    pendingRef.current = null;
    const list = (m.modes[p.mode] ?? m.modes.plain).tracks;
    let i = 0;
    if (p.file && list.some((t) => t.file === p.file)) {
      i = list.findIndex((t) => t.file === p.file);   // точная дорожка (тап по очереди)
    } else if (p.index != null) {
      i = p.index >= 0 && p.index < list.length ? p.index : 0;
    } else if (p.ref && list.some((t) => trackCoversRef(t, p.ref!))) {
      i = list.findIndex((t) => trackCoversRef(t, p.ref!));   // точное попадание в стих (ШБ)
    } else if (p.ref && p.chapter != null) {
      // Стих НЕ озвучен: в канале просто нет файла (так пропал «ШБ 9.8.11» — аудио идёт
      // «Тексты 9-10» → сразу «Текст 12»). Бросать человека в НАЧАЛО главы нельзя: там
      // «Введение» на два часа, и он не поймёт, почему слышит не то. Начинаем со
      // СЛЕДУЮЩЕГО озвученного стиха той же главы — и читалка сама туда переедет,
      // так что сдвиг ВИДЕН, а не молчалив (ЗКН-Б007, ЗКН-Б011).
      const want = verseNum(p.ref);
      const inCh = (t: Track) => t.chapter === p.chapter && (p.lila == null || t.lila === p.lila);
      const near = list.findIndex((t) => inCh(t) && verseNum(t.ref) >= want);
      const head = list.findIndex(inCh);
      i = near >= 0 ? near : (head >= 0 ? head : 0);
    } else if (p.chapter != null) {
      const f = list.findIndex((t) => t.chapter === p.chapter && (p.lila == null || t.lila === p.lila));
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
  function switchBook(b: string, src: Source = "book", scope = "") {
    if (b === bookRef.current && src === sourceRef.current && scope === scopeRef.current) return;
    bookRef.current = b; setBookId(b);
    sourceRef.current = src; setSource(src);
    scopeRef.current = scope; setScopeId(scope);
    manifestRef.current = null; setManifest(null); // вынудить перезагрузку манифеста новой книги/раздела
    seqRef.current = [];
  }
  function playBook(opts?: { book?: string; mode?: AudioMode; chapter?: number; expand?: boolean }) {
    const b = opts?.book ?? bookRef.current;
    switchBook(b, "book", SCOPED_BOOKS.has(b) ? (scopeRef.current || "1") : "");
    pendingRef.current = { mode: opts?.mode ?? "plain", chapter: opts?.chapter ?? null, expand: opts?.expand ?? true };
    restoreRef.current = null;
    ensureManifest().then((m) => applyPending(m, true));
  }
  function playChapter(book: string, chapter: number, md: AudioMode, lila?: string, ref?: string | null) {
    // ШБ: lila из читалки — это НОМЕР ПЕСНИ, он же раздел манифеста.
    // ref («ШБ 1.9.40») — из читалки СТИХА: озвучка ШБ по-стиховая, и «слушать» с открытого
    // стиха обязано начинать с НЕГО, а не отматывать человека к началу главы.
    switchBook(book, "book", SCOPED_BOOKS.has(book) ? (lila || scopeRef.current || "1") : "");
    pendingRef.current = { mode: md, chapter, lila, ref, expand: true };
    restoreRef.current = null;
    ensureManifest().then((m) => applyPending(m, true));
  }
  /** Дорожки ЛЮБОЙ песни — для просмотра очереди, БЕЗ смены воспроизведения.
   *  Играющая песнь берётся из манифеста; чужая тянется один раз и кэшируется. */
  function tracksFor(canto: string): Promise<Track[]> {
    const m = manifestRef.current;
    if (m && canto === scopeRef.current) return Promise.resolve((m.modes[modeRef.current] ?? m.modes.plain).tracks);
    const hit = scopeCache.current[canto];
    if (hit) return Promise.resolve(hit);
    return fetch(api(`/books/${bookRef.current}/audio?canto=${encodeURIComponent(canto)}`))
      .then((r) => r.json())
      .then((mm: Manifest) => {
        const t = mm.modes?.plain?.tracks ?? [];
        scopeCache.current[canto] = t;
        return t;
      })
      .catch(() => []);
  }

  /** Включить конкретную дорожку — в том числе из ДРУГОЙ песни (тап по очереди). */
  function playTrack(canto: string, file: string) {
    switchBook(bookRef.current, "book", canto);
    pendingRef.current = { mode: modeRef.current, chapter: null, file, expand: true };
    restoreRef.current = null;
    ensureManifest().then((m) => applyPending(m, true));
  }

  function playKirtan(albumId: string, startIndex?: number) {
    switchBook(albumId, "kirtan");
    pendingRef.current = { mode: "plain", chapter: null, index: startIndex ?? 0, expand: true };
    restoreRef.current = null;
    ensureManifest().then((m) => applyPending(m, true));
  }
  function playBhajan(slug: string, startIndex?: number, set?: "lectures") {
    // Записи и аудио-лекции — РАЗНЫЕ очереди (book id с суффиксом ::lec), чтобы
    // автоплей не пересекал границу «петая запись → говорная лекция».
    switchBook(set === "lectures" ? `${slug}::lec` : slug, "bhajan");
    pendingRef.current = { mode: "plain", chapter: null, index: startIndex ?? 0, expand: true };
    restoreRef.current = null;
    ensureManifest().then((m) => applyPending(m, true));
  }

  function buildOrder(n: number, om: OrderMode, current: number): number[] {
    const seq = Array.from({ length: n }, (_, i) => i);
    if (n <= 1) return seq;
    if (om === "reverse") return seq.slice().reverse();
    if (om !== "shuffle") return seq;
    const rest = seq.filter((i) => i !== current);
    for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
    return current >= 0 && current < n ? [current, ...rest] : rest;
  }
  function rebuildOrder() {
    const m = manifestRef.current; if (!m) { seqRef.current = []; return; }
    seqRef.current = buildOrder((m.modes[modeRef.current] ?? m.modes.plain).tracks.length, orderModeRef.current, indexRef.current);
  }
  function relIndex(step: number): number {
    const m = manifestRef.current; if (!m) return -1;
    const list = (m.modes[modeRef.current] ?? m.modes.plain).tracks;
    const seq = seqRef.current.length === list.length ? seqRef.current : list.map((_, i) => i);
    const pos = seq.indexOf(indexRef.current);
    if (pos < 0) return -1;
    const wrap = repeatRef.current === "book" || repeatRef.current === "library";
    const np = pos + step;
    if (np >= seq.length) return wrap ? seq[0] : -1;
    if (np < 0) return wrap ? seq[seq.length - 1] : -1;
    return seq[np];
  }
  // advance: auto=true — окончание трека (учитывает «повтор одного»); false — кнопка «вперёд»
  function advance(auto: boolean) {
    const m = manifestRef.current; if (!m) return;
    if (auto && repeatRef.current === "one") {
      engineRef.current?.seek(0); timeRef.current = 0; setCurrentTime(0);
      engineRef.current?.play().catch(() => {});
      return;
    }
    const ni = relIndex(1);
    if (ni >= 0) { loadIndex(m, modeRef.current, ni, true); return; }
    if (advanceScope(m)) return;   // ШБ: конец песни — не конец книги
    setPlaying(false);
  }
  /** ШБ: манифест ограничен песнью. Дойдя до её конца, подхватываем следующую песнь с
   *  озвучкой — иначе слушатель упирался бы в тишину на границе тома. Повтор/перемешивание
   *  границу не переступают: там человек явно попросил крутиться внутри раздела. */
  function advanceScope(m: Manifest): boolean {
    if (!SCOPED_BOOKS.has(bookRef.current)) return false;
    if (orderModeRef.current !== "forward" || repeatRef.current !== "off") return false;
    const cur = Number(scopeRef.current) || 0;
    const nxt = (m.cantos ?? []).map((c) => c.canto).filter((c) => c > cur).sort((a, b) => a - b)[0];
    if (!nxt) return false;
    scopeRef.current = String(nxt); setScopeId(String(nxt));
    manifestRef.current = null; setManifest(null); seqRef.current = [];
    pendingRef.current = { mode: modeRef.current, chapter: null, index: 0, expand: false };
    restoreRef.current = null;
    ensureManifest().then((mm) => applyPending(mm, true)).catch(() => setPlaying(false));
    return true;
  }
  function goNext() { advance(false); }
  function goPrev() {
    const m = manifestRef.current; if (!m) return;
    if (timeRef.current > 3) { engineRef.current?.seek(0); timeRef.current = 0; setCurrentTime(0); return; }
    const pi = relIndex(-1);
    if (pi >= 0) loadIndex(m, modeRef.current, pi, true);
    else { engineRef.current?.seek(0); timeRef.current = 0; setCurrentTime(0); }
  }
  function cycleOrder() {
    const opts: OrderMode[] = ["forward", "shuffle", "reverse"];
    const o = opts[(opts.indexOf(orderModeRef.current) + 1) % opts.length];
    orderModeRef.current = o; setOrderMode(o); rebuildOrder();
  }
  function cycleRepeat() {
    const opts: RepeatMode[] = ["off", "book", "library", "one"];
    const r = opts[(opts.indexOf(repeatRef.current) + 1) % opts.length];
    repeatRef.current = r; setRepeat(r);
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
    if (!m || !m.modes[md]) return; // нет такого режима (напр. у ЧЧ нет комментариев) — игнор
    if (md === modeRef.current) { modeRef.current = md; setModeState(md); return; }
    const cur = (m.modes[modeRef.current] ?? m.modes.plain).tracks[indexRef.current];
    const target = m.modes[md]!.tracks;
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

  // полное закрытие плеера: стоп, скрыть мини-плеер, забыть позицию
  function dismiss() {
    engineRef.current?.pause();
    setExpanded(false);
    setActive(false);
    try { localStorage.removeItem(PERSIST_KEY); localStorage.removeItem("iol.player.bg.v1"); } catch { /* ignore */ }
  }

  // ── Media Session (локскрин / Пункт управления / AirPods) ──
  function updateMediaSession(t: Track, md: AudioMode) {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    const isK = sourceRef.current === "kirtan";
    const cfg = cfgFor(bookRef.current, sourceRef.current);
    const album = isK
      ? cfg.title
      : (trackSubtitle(t, md, !!manifestRef.current?.modes.commentary?.tracks.length)
         || (md === "commentary" ? "С комментариями" : "Стих за стихом"));
    try {
      ms.metadata = new MediaMetadata({
        title: t.title,
        artist: isK ? (cfg.artist || "Киртан") : cfg.title,
        album,
        artwork: [
          { src: absUrl(cfg.cover), sizes: "512x512", type: "image/jpeg" },
          { src: absUrl(cfg.cover), sizes: "256x256", type: "image/jpeg" },
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

  const cfg = cfgFor(bookId, source);
  const value: PlayerApi = {
    ready: !!manifest, active, expanded, loading, mode, tracks, index, track,
    isPlaying, currentTime, duration, rate, order: orderMode, repeat,
    cover: cfg.cover, bookTitle: cfg.title, book: bookId, kind: source, artist: cfg.artist,
    hasCommentary: !!manifest?.modes.commentary && (manifest.modes.commentary.tracks.length > 0),
    cantos: manifest?.cantos ?? [], scope: scopeId, tracksFor, playTrack,
    playBook, playChapter, playKirtan, playBhajan, togglePlay, next: goNext, prev: goPrev, seek, skip, cycleRate, cycleOrder, cycleRepeat, setMode, jumpTo,
    open: () => { if (active) setExpanded(true); },
    close: () => setExpanded(false),
    dismiss,
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
