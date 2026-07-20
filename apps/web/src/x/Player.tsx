/**
 * ПЛЕЕР ПРОБНОЙ ОБОЛОЧКИ — /x/play
 *
 * Один компонент на шесть видов звука: книги · лекции · киртаны · бхаджаны ·
 * подкасты · вдохновения. Разные у них не элементы, а ДОСТУПНЫЕ ДЕЙСТВИЯ:
 * у книги, лекции и бхаджана есть переход на текст, у киртана и вдохновения —
 * нет. Поэтому вид не порождает второй плеер, а включает или гасит кнопку.
 *
 * ЧТО ЗДЕСЬ ЗАМЕРЕНО, А ЧТО НЕТ.
 *
 * Замерено (📐):
 *   мини-плеер     высота 48.0, врезка 21.0, ширина 351.0, заливка --player-mini-bg (5.17)
 *   зазор до таб-бара  8.0 — совпал на пяти кадрах (5.17)
 *   сегменты внутри    [28 + 48] обложка · [88 + 277] содержимое (5.20, состояние 6)
 *   плеер как слой     высота 38.0, ширина 277.0, заливка --player-bar-bg, ось 56 (5.20)
 *   обложка на весь экран  врезка 24.0 симметрично (apple_music с.35)
 *   центральная кнопка  ось 196.5 = центр экрана (apple_music с.31, 35)
 *
 * НЕ замерено (🕳) и потому не выдумано:
 *   полный экран «сейчас играет» целиком. Фон там выводится ИЗ ОБЛОЖКИ —
 *   плоских заливок нет вовсе, и переписчик плоских заливок на этом экране
 *   слеп. Нужен отдельный инструмент по контрасту и градиенту.
 *   Всё, что ниже помечено 🕳, взято из нашей вёрстки, а не из кадра.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/* ─────────────────────────── модель ─────────────────────────── */

export type PlayKind = "book" | "lecture" | "kirtan" | "bhajan" | "podcast" | "inspiration";

/**
 * МАТРИЦА ВОЗМОЖНОСТЕЙ. Первая версия различала виды одним флагом «есть текст»,
 * и это было слишком грубо: у Apple книга, подкаст и песня живут в РАЗНЫХ
 * приложениях именно потому, что у них разный транспорт. Книге нужна перемотка
 * на ±15 секунд и скорость чтения, песне — переход по трекам и повтор. Мы держим
 * один компонент, значит различие переезжает сюда.
 *
 *   text   — переход на текст (наше, у Apple такого нет)
 *   skip   — перемотка ±15 с вместо перехода по трекам (длинная запись)
 *   speed  — скорость воспроизведения (речь, не музыка)
 *   repeat — повтор (киртан и бхаджан поют кругами)
 *   queue  — очередь / оглавление
 */
interface Caps { text: boolean; skip: boolean; speed: boolean; repeat: boolean; queue: boolean }
const CAPS: Record<PlayKind, Caps> = {
  book:        { text: true,  skip: true,  speed: true,  repeat: false, queue: true  },
  lecture:     { text: true,  skip: true,  speed: true,  repeat: false, queue: true  },
  podcast:     { text: false, skip: true,  speed: true,  repeat: false, queue: true  },
  kirtan:      { text: false, skip: false, speed: false, repeat: true,  queue: true  },
  bhajan:      { text: true,  skip: false, speed: false, repeat: true,  queue: true  },
  inspiration: { text: false, skip: false, speed: false, repeat: false, queue: false },
};

/** Оттенок вида — 🎨 наше. У Apple фон выводится из обложки; когда обложки нет,
 *  выводить не из чего, и вид даёт свой тон, чтобы экран не был мёртвым. */
const TINT: Record<PlayKind, string> = {
  book: "var(--tint-book)", lecture: "var(--tint-lecture)", kirtan: "var(--tint-kirtan)",
  bhajan: "var(--tint-bhajan)", podcast: "var(--tint-podcast)", inspiration: "var(--tint-inspiration)",
};

const KIND_LABEL: Record<PlayKind, string> = {
  book: "Книга", lecture: "Лекция", kirtan: "Киртан",
  bhajan: "Бхаджан", podcast: "Подкаст", inspiration: "Вдохновение",
};

export interface Track {
  id: string;
  title: string;
  subtitle?: string;
  kind: PlayKind;
  /** Обложка. Нет — рисуется монограмма, а не пустой прямоугольник. */
  cover?: string;
  /** Длительность, секунды. */
  duration: number;
  /** Куда ведёт «Текст». Задаётся, только если у вида он есть. */
  textHref?: string;
  /** Текст с таймкодами: секунда начала абзаца и сам абзац. Даёт синхронное
   *  чтение — абзац подсвечивается по ходу звука, нажатие перематывает. */
  text?: { t: number; s: string }[];
}

export type LayerState = "hidden" | "mini" | "full";

/* ─────────────────────────── знаки ─────────────────────────── */

/** Штрих 1.33 = ровно 4 физических пикселя (📐 5.22: бывает 3 или 4). */
const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.33,
            strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function PlayGlyph({ size = 22 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg>;
}
function PauseGlyph({ size = 22 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <rect x="7.5" y="5.5" width="3.4" height="13" rx="1.2" fill="currentColor" />
    <rect x="13.1" y="5.5" width="3.4" height="13" rx="1.2" fill="currentColor" /></svg>;
}
function PrevGlyph({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path d="M18 5.5v13l-9-6.5z" fill="currentColor" />
    <rect x="5" y="5.5" width="2.6" height="13" rx="1.1" fill="currentColor" /></svg>;
}
function NextGlyph({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path d="M6 5.5v13l9-6.5z" fill="currentColor" />
    <rect x="16.4" y="5.5" width="2.6" height="13" rx="1.1" fill="currentColor" /></svg>;
}
function TextGlyph({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path {...S} d="M5 6h14M5 10h14M5 14h10M5 18h7" /></svg>;
}
function QueueGlyph({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path {...S} d="M5 7h10M5 12h10M5 17h6" /><path {...S} d="M18 9v8M18 9l3 2-3 2" /></svg>;
}
function Back15Glyph({ size = 26 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path {...S} d="M11.5 5.5a7 7 0 1 1-6.8 8.7" /><path {...S} d="M8.2 3.1 11.5 5.5 8.6 8.2" />
    <text x="12" y="15.6" textAnchor="middle" fontSize="7.4" fontWeight="700"
      fill="currentColor" stroke="none" fontFamily="system-ui">15</text></svg>;
}
function Fwd15Glyph({ size = 26 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path {...S} d="M12.5 5.5a7 7 0 1 0 6.8 8.7" /><path {...S} d="M15.8 3.1 12.5 5.5l2.9 2.7" />
    <text x="12" y="15.6" textAnchor="middle" fontSize="7.4" fontWeight="700"
      fill="currentColor" stroke="none" fontFamily="system-ui">15</text></svg>;
}
function RepeatGlyph({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path {...S} d="M6 8h11a3 3 0 0 1 3 3v1" /><path {...S} d="M17 5.5 19.8 8 17 10.5" />
    <path {...S} d="M18 16H7a3 3 0 0 1-3-3v-1" /><path {...S} d="M7 18.5 4.2 16 7 13.5" /></svg>;
}
function ChevronDownGlyph({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path {...S} d="M6 9.5l6 5 6-5" /></svg>;
}

/* ─────────────────────────── обложка ─────────────────────────── */

function Cover({ track, size, radius, big }: {
  track: Track; size: number | string; radius: number | string; big?: boolean;
}) {
  const box: CSSProperties = {
    /* aspectRatio обязателен: квадрат со стороной «100%» без него схлопывает
       высоту в полоску — ровно это и случилось на первом прогоне. */
    width: size, height: size === "100%" ? "auto" : size, aspectRatio: "1",
    borderRadius: radius, flexShrink: 0,
    overflow: "hidden", display: "grid", placeItems: "center",
    background: "var(--color-fill-1)",
  };
  if (track.cover) {
    return <img src={track.cover} alt="" loading="lazy"
      style={{ ...box, objectFit: "cover" }} />;
  }
  /* Нет обложки — монограмма вида, а не пустой прямоугольник: пустота на
     экране читается как ошибка загрузки, а знак — как «так и задумано». */
  return <span style={box} aria-hidden>
    <span style={{
      fontFamily: "var(--font-display)",
      fontSize: big ? "var(--text-title1)" : "var(--text-caption2)",
      letterSpacing: big ? "var(--ls-title1)" : "var(--ls-caption2)",
      fontWeight: 600, color: "var(--color-label-3)",
    }}>{big ? KIND_LABEL[track.kind] : KIND_LABEL[track.kind].slice(0, 2).toUpperCase()}</span>
  </span>;
}

/* ─────────────────────────── время ─────────────────────────── */

function clock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return (h ? `${h}:` : "") + `${mm}:${String(r).padStart(2, "0")}`;
}

/* ─────────────────────────── шкала ─────────────────────────── */

/**
 * Дорожка перемотки. §5.20 состояние 4: при перемотке слой становится ОДНОЙ
 * дорожкой — два значения по краям, середина пуста. Здесь та же логика внутри
 * плеера: время слева и справа, между ними полоса.
 */
function Scrubber({ position, duration, onSeek }: {
  position: number; duration: number; onSeek: (s: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pct = duration > 0 ? Math.min(1, position / duration) : 0;
  const seek = useCallback((clientX: number) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    onSeek(((clientX - r.left) / r.width) * duration);
  }, [duration, onSeek]);
  return (
    <div>
      <div
        ref={ref}
        role="slider"
        aria-label="Позиция"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(position)}
        tabIndex={0}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); seek(e.clientX); }}
        onPointerMove={(e) => { if (e.buttons) seek(e.clientX); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") onSeek(position - 15);
          if (e.key === "ArrowRight") onSeek(position + 15);
        }}
        style={{
          height: 4, borderRadius: 2, cursor: "pointer", position: "relative",
          background: "rgba(255,255,255,0.22)",  /* 🕳 — заливка дорожки не снята */
          touchAction: "none",
        }}>
        <div style={{ position: "absolute", inset: 0, width: `${pct * 100}%`,
          borderRadius: 2, background: "var(--color-label)" }} />
      </div>
      <div style={{
        display: "flex", justifyContent: "space-between", marginTop: 6,
        fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)",
        lineHeight: "var(--lh-caption2)", letterSpacing: "var(--ls-caption2)",
        color: "var(--color-label-3)", fontVariantNumeric: "tabular-nums",
      }}>
        <span>{clock(position)}</span>
        <span>−{clock(Math.max(0, duration - position))}</span>
      </div>
    </div>
  );
}

/* ─────────────────────────── мини-плеер ─────────────────────────── */

/**
 * ВТОРОЙ ЭТАЖ (📐 5.20, состояние 6). Мини-плеер стоит НАД таб-баром через
 * 8.0 pt и шире его капсулы: 351.0 против 281.0. Ось принадлежит нижней
 * детали — мини-плеер кладётся сверху, а не делит её.
 *
 * Сегменты внутри: [28 + 48] обложка · [88 + 277] содержимое. При врезке
 * панели 21 это даёт внутреннее поле 7 pt слева и справа.
 */
export function MiniPlayer({ track, playing, position, onToggle, onOpen, onNext, bottom }: {
  track: Track; playing: boolean; position: number;
  onToggle: () => void; onOpen: () => void; onNext: () => void;
  /** Отступ снизу: над таб-баром это 21 + 62 + 8 (📐 5.16 · 5.17). */
  bottom: number;
}) {
  const pct = track.duration > 0 ? Math.min(1, position / track.duration) : 0;
  return (
    <div style={{
      /* КООРДИНАТЫ ПРИНАДЛЕЖАТ КАДРУ, А НЕ ОКНУ. Замеры 351/21/24 сняты с экрана
         393 pt; в окне браузера шириной 2400 px они не значат ничего. Поэтому
         absolute внутри рамки, а не fixed относительно вьюпорта. */
      position: "absolute", left: "50%", transform: "translateX(-50%)", bottom,
      width: "min(351px, calc(100% - 42px))",   /* 📐 5.17 · ширина 351, врезка 21 */
      height: 48,                                /* 📐 5.17 */
      zIndex: 45,
    }}>
      <div className="sq" style={{
        position: "relative", height: "100%", overflow: "hidden",
        background: "var(--player-mini-bg)",     /* 📐 5.17 · заливка мини-плеера */
        display: "flex", alignItems: "center",
        padding: "0 7px",                        /* ⚙️ следствие: 28 − 21 */
        gap: 12,                                 /* ⚙️ следствие: 88 − (28 + 48) */
      }}>
        <button type="button" onClick={onOpen} aria-label={`Открыть плеер: ${track.title}`}
          style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0,
            background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left",
            WebkitTapHighlightColor: "transparent" }}>
          <Cover track={track} size={40} radius="var(--radius-thumb)" />
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: "block", fontFamily: "var(--font-text)",
              fontSize: "var(--text-subhead)", lineHeight: "var(--lh-subhead)",
              letterSpacing: "var(--ls-subhead)", color: "var(--color-label)",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {track.title}
            </span>
            {track.subtitle && (
              <span style={{ display: "block", fontFamily: "var(--font-text)",
                fontSize: "var(--text-caption2)", lineHeight: "var(--lh-caption2)",
                letterSpacing: "var(--ls-caption2)", color: "var(--color-label-3)",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {track.subtitle}
              </span>
            )}
          </span>
        </button>
        <button type="button" onClick={onToggle} aria-label={playing ? "Пауза" : "Воспроизвести"}
          style={{ flexShrink: 0, width: 32, height: 32, display: "grid", placeItems: "center",
            background: "none", border: "none", color: "var(--color-label)", cursor: "pointer",
            WebkitTapHighlightColor: "transparent" }}>
          {playing ? <PauseGlyph size={20} /> : <PlayGlyph size={20} />}
        </button>
        <button type="button" onClick={onNext} aria-label="Дальше"
          style={{ flexShrink: 0, width: 32, height: 32, display: "grid", placeItems: "center",
            background: "none", border: "none", color: "var(--color-label)", cursor: "pointer",
            WebkitTapHighlightColor: "transparent" }}>
          <NextGlyph size={18} />
        </button>
        {/* Полоска прогресса по низу панели — 🕳, у Apple на мини-плеере её нет,
            но у нас книга и лекция длинные, и позиция без неё теряется. */}
        <div aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2,
          background: "rgba(255,255,255,0.10)" }}>
          <div style={{ height: "100%", width: `${pct * 100}%`, background: "var(--color-label-2)" }} />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── полный экран ─────────────────────────── */

/* ─────────────────────────── фон из обложки ─────────────────────────── */

/**
 * 📐 Факт из замера: на экране плеера у Apple **нет плоских заливок вовсе** —
 * переписчик возвращает осколки градиента, потому что фон выводится ИЗ ОБЛОЖКИ.
 * 🕳 Как именно он строится, со статики не снять. Здесь взято самое простое, что
 * даёт тот же эффект: обложка, растянутая и размытая, плюс затемняющая пелена,
 * чтобы текст держал контраст.
 *
 * Когда обложки нет — а у нас её нет у большинства записей — выводить не из чего,
 * и тон берётся от вида (🎨 наше). Пустой чёрный прямоугольник читается как
 * ошибка загрузки, тон — как замысел.
 */
function Ambient({ track }: { track: Track }) {
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden", zIndex: 0 }}>
      {track.cover ? (
        <img src={track.cover} alt="" style={{
          position: "absolute", inset: "-25%", width: "150%", height: "150%",
          objectFit: "cover", filter: "blur(64px) saturate(180%)", opacity: 0.6,
        }} />
      ) : (
        <div style={{ position: "absolute", inset: 0,
          background: `radial-gradient(130% 85% at 50% 0%, ${TINT[track.kind]} 0%, transparent 72%)` }} />
      )}
      <div style={{ position: "absolute", inset: 0,
        background: "linear-gradient(180deg, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.78) 100%)" }} />
    </div>
  );
}

/* ─────────────────────────── очередь ─────────────────────────── */

/**
 * Лист очереди. Поверхности берутся по §5.16: холст листа --color-bg-2, карточка на
 * нём --color-bg-3 — лист сам является поверхностью, поэтому ступень выше главного
 * экрана. Ступень задаётся переопределением токена, а не отдельным компонентом.
 */
function QueueSheet({ queue, index, onPick, onClose, kind }: {
  queue: Track[]; index: number; onPick: (i: number) => void; onClose: () => void; kind: PlayKind;
}) {
  const title = kind === "book" || kind === "lecture" ? "Оглавление" : "Очередь";
  return (
    <div role="dialog" aria-modal="true" aria-label={title}
      style={{ position: "absolute", inset: 0, zIndex: 1500, display: "flex", flexDirection: "column",
        background: "var(--color-bg-2)", ["--color-card" as string]: "var(--color-bg-3)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 16px", height: 56, flexShrink: 0 }}>
        <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-title2)",
          lineHeight: "var(--lh-title2)", letterSpacing: "var(--ls-title2)", fontWeight: 700,
          color: "var(--color-label)" }}>{title}</h2>
        <button type="button" onClick={onClose} aria-label="Закрыть"
          style={{ width: 44, height: 44, display: "grid", placeItems: "center", background: "none",
            border: "none", color: "var(--color-label-2)", cursor: "pointer" }}>
          <ChevronDownGlyph size={20} />
        </button>
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: "0 16px 32px", overflowY: "auto", flex: 1 }}>
        {queue.map((t, k) => (
          <li key={t.id}>
            <button type="button" onClick={() => onPick(k)}
              style={{ display: "flex", alignItems: "center", gap: "var(--media-gap)", width: "100%",
                minHeight: "var(--row-h-media)", padding: "0 var(--inset-row)", border: "none",
                borderRadius: "var(--radius-thumb)", cursor: "pointer", textAlign: "left",
                background: k === index ? "var(--color-card)" : "none",
                WebkitTapHighlightColor: "transparent" }}>
              <Cover track={t} size={44} radius="var(--radius-thumb)" />
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: "block", fontFamily: "var(--font-text)",
                  fontSize: "var(--text-body)", lineHeight: "var(--lh-body)",
                  letterSpacing: "var(--ls-body)", whiteSpace: "nowrap", overflow: "hidden",
                  textOverflow: "ellipsis",
                  color: k === index ? "var(--color-gold-deep)" : "var(--color-label)" }}>{t.title}</span>
                <span style={{ display: "block", fontFamily: "var(--font-text)",
                  fontSize: "var(--text-caption2)", lineHeight: "var(--lh-caption2)",
                  letterSpacing: "var(--ls-caption2)", color: "var(--color-label-3)" }}>
                  {clock(t.duration)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─────────────────────────── синхронное чтение ─────────────────────────── */

/**
 * НАШЕ, и это главное отличие от Apple Music. Абзац подсвечивается по ходу звука,
 * нажатие на абзац перематывает запись на его начало. Для книги, лекции и бхаджана
 * это снимает главную боль: слушал в дороге — сел читать с того же места.
 *
 * Совпадение ищется по последнему абзацу, чьё время начала не превысило позицию:
 * таймкоды монотонны, поэтому достаточно одного прохода.
 */
function TextSheet({ track, position, onSeek, onClose }: {
  track: Track; position: number; onSeek: (s: number) => void; onClose: () => void;
}) {
  const paras = track.text ?? [];
  let active = -1;
  for (let k = 0; k < paras.length; k++) if (paras[k].t <= position) active = k;
  const ref = useRef<HTMLLIElement | null>(null);
  useEffect(() => { ref.current?.scrollIntoView({ block: "center", behavior: "smooth" }); }, [active]);
  return (
    <div role="dialog" aria-modal="true" aria-label={`Текст: ${track.title}`}
      style={{ position: "absolute", inset: 0, zIndex: 1500, display: "flex", flexDirection: "column",
        background: "var(--color-bg-2)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 16px", height: 56, flexShrink: 0 }}>
        <h2 style={{ margin: 0, minWidth: 0, fontFamily: "var(--font-display)",
          fontSize: "var(--text-title2)", lineHeight: "var(--lh-title2)",
          letterSpacing: "var(--ls-title2)", fontWeight: 700, color: "var(--color-label)",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{track.title}</h2>
        <button type="button" onClick={onClose} aria-label="Закрыть"
          style={{ width: 44, height: 44, flexShrink: 0, display: "grid", placeItems: "center",
            background: "none", border: "none", color: "var(--color-label-2)", cursor: "pointer" }}>
          <ChevronDownGlyph size={20} />
        </button>
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: "0 24px 48px", overflowY: "auto", flex: 1 }}>
        {paras.map((para, k) => (
          <li key={k} ref={k === active ? ref : undefined}>
            <button type="button" onClick={() => onSeek(para.t)}
              style={{ display: "block", width: "100%", textAlign: "left", background: "none",
                border: "none", padding: "10px 0", cursor: "pointer",
                fontFamily: "var(--font-text)", fontSize: "var(--text-body)",
                /* Интерлиньяж ПРОЗЫ, а не интерфейса: §5.28 меряет строку хрома,
                   абзац сплошного текста живёт по своему правилу. */
                lineHeight: "var(--leading-normal)", letterSpacing: "var(--ls-body)",
                color: k === active ? "var(--color-label)" : "var(--color-label-3)",
                transition: "color .25s", WebkitTapHighlightColor: "transparent" }}>
              {para.s}
            </button>
          </li>
        ))}
        {paras.length === 0 && (
          <li style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)",
            color: "var(--color-label-3)", padding: "24px 0" }}>
            Текст этой записи ещё не сверен.
          </li>
        )}
      </ul>
    </div>
  );
}

/* ─────────────────────────── полный экран ─────────────────────────── */

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;

/**
 * «Сейчас играет». Блок управления стоит на замеренных высотах (📐 apple_music
 * с.31 и 35, кадр 393 × 852): заголовок y 483, знак y 557, транспорт y 635,
 * нижний ряд y 732 при врезке 27.
 *
 * Транспорт зависит от ВИДА, а не один на всех: длинной записи нужна перемотка
 * на ±15 секунд и скорость, песне — переход по трекам и повтор. Матрица CAPS.
 */
export function FullPlayer({ track, playing, position, speed, repeat, onToggle, onSeek, onPrev,
  onNext, onClose, onText, onQueue, onSpeed, onRepeat }: {
  track: Track; playing: boolean; position: number; speed: number; repeat: boolean;
  onToggle: () => void; onSeek: (s: number) => void;
  onPrev: () => void; onNext: () => void; onClose: () => void;
  onText?: () => void; onQueue?: () => void;
  onSpeed: (v: number) => void; onRepeat: () => void;
}) {
  const caps = CAPS[track.kind];
  const hasText = caps.text && (!!track.text?.length || !!track.textHref);
  return (
    <div role="dialog" aria-modal="true" aria-label={`Сейчас играет: ${track.title}`}
      style={{ position: "absolute", inset: 0, zIndex: 1400, display: "flex", flexDirection: "column",
        background: "var(--color-bg-2)", paddingTop: "env(safe-area-inset-top)" }}>
      <Ambient track={track} />

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column",
        flex: 1, minHeight: 0 }}>
        {/* шапка: свернуть слева-по-центру, повтор справа — если вид его знает */}
        <div style={{ display: "flex", alignItems: "center", height: 44, flexShrink: 0,
          padding: "0 12px" }}>
          <span style={{ width: 44 }} />
          <button type="button" onClick={onClose} aria-label="Свернуть плеер"
            style={{ flex: 1, height: 44, display: "grid", placeItems: "center", background: "none",
              border: "none", color: "var(--color-label-2)", cursor: "pointer",
              WebkitTapHighlightColor: "transparent" }}>
            <ChevronDownGlyph size={20} />
          </button>
          {caps.repeat ? (
            <button type="button" onClick={onRepeat} aria-pressed={repeat} aria-label="Повтор"
              style={{ width: 44, height: 44, display: "grid", placeItems: "center", background: "none",
                border: "none", cursor: "pointer", WebkitTapHighlightColor: "transparent",
                color: repeat ? "var(--color-gold-deep)" : "var(--color-label-3)" }}>
              <RepeatGlyph size={20} />
            </button>
          ) : <span style={{ width: 44 }} />}
        </div>

        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column",
          padding: "0 24px" }}>
          {/* Квадрат задаётся ШИРИНОЙ и ограничивается высотой экрана. Флекс и
              aspect-ratio на одном узле спорят за одну величину — их разводим. */}
          <div style={{ display: "grid", placeItems: "center", paddingBottom: 20 }}>
            <div style={{ width: "min(100%, 42vh)", aspectRatio: "1", display: "grid" }}>
              <Cover track={track} size="100%" radius="var(--radius-card)" big />
            </div>
          </div>

          <div style={{ marginBottom: 6, fontFamily: "var(--font-text)",
            fontSize: "var(--text-caption2)", lineHeight: "var(--lh-caption2)",
            letterSpacing: "var(--ls-caption2)", fontWeight: 600,
            color: "var(--color-gold-deep)" }}>
            {KIND_LABEL[track.kind]}
          </div>
          <h1 style={{ margin: 0, fontFamily: "var(--font-display)",
            fontSize: "var(--text-title2)", lineHeight: "var(--lh-title2)",
            letterSpacing: "var(--ls-title2)", fontWeight: 700, color: "var(--color-label)" }}>
            {track.title}
          </h1>
          {track.subtitle && (
            <p style={{ margin: "2px 0 0", fontFamily: "var(--font-text)",
              fontSize: "var(--text-subhead)", lineHeight: "var(--lh-subhead)",
              letterSpacing: "var(--ls-subhead)", color: "var(--color-label-2)" }}>
              {track.subtitle}
            </p>
          )}

          {/* 483 → 557: разрыв 53 до шкалы (📐) */}
          <div style={{ marginTop: 22 }}>
            <Scrubber position={position} duration={track.duration} onSeek={onSeek} />
          </div>

          {/* 565 → 635: разрыв 70 до транспорта (📐) */}
          <div style={{ marginTop: 26, display: "flex", alignItems: "center",
            justifyContent: "center", gap: 36 }}>
            <button type="button" onClick={() => caps.skip ? onSeek(position - 15) : onPrev()}
              aria-label={caps.skip ? "Назад на 15 секунд" : "Предыдущая"} style={transportStyle}>
              {caps.skip ? <Back15Glyph size={28} /> : <PrevGlyph size={26} />}
            </button>
            <button type="button" onClick={onToggle} aria-label={playing ? "Пауза" : "Воспроизвести"}
              style={{ ...transportStyle, width: 56, height: 56 }}>
              {playing ? <PauseGlyph size={34} /> : <PlayGlyph size={34} />}
            </button>
            <button type="button" onClick={() => caps.skip ? onSeek(position + 15) : onNext()}
              aria-label={caps.skip ? "Вперёд на 15 секунд" : "Следующая"} style={transportStyle}>
              {caps.skip ? <Fwd15Glyph size={28} /> : <NextGlyph size={26} />}
            </button>
          </div>

          {/* НИЖНИЙ РЯД — 📐 врезка 27, ширина 338, y 732…749. Слева наше действие,
              справа служебные. Слабина уходит сюда, а не в дыру под обложкой. */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 8, padding: "0 3px", marginTop: "auto",
            marginBottom: "calc(40px + env(safe-area-inset-bottom))" }}>
            <span style={{ display: "flex", gap: 8, minWidth: 0 }}>
              {hasText && (
                <button type="button" onClick={onText} className="sq" style={pillStyle}>
                  <TextGlyph size={18} /> Текст
                </button>
              )}
              {caps.speed && (
                <button type="button" className="sq" style={pillStyle}
                  aria-label={`Скорость ${speed}×`}
                  onClick={() => onSpeed(SPEEDS[(SPEEDS.indexOf(speed as never) + 1) % SPEEDS.length])}>
                  {speed}×
                </button>
              )}
            </span>
            {caps.queue && (
              <button type="button" onClick={onQueue} aria-label="Очередь"
                style={{ ...transportStyle, width: 40, height: 40, color: "var(--color-label-2)" }}>
                <QueueGlyph size={20} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


const transportStyle: CSSProperties = {
  width: 48, height: 48, display: "grid", placeItems: "center",
  background: "none", border: "none", color: "var(--color-label)",
  cursor: "pointer", WebkitTapHighlightColor: "transparent",
};

/* Чип-фильтр §5.30: высота 35.0, заливка #2C2C2C, радиус h/2. Здесь та же
   геометрия применена к кнопке-действию, потому что она ЛЕЖИТ на поверхности,
   а не стоит в строке. */
const pillStyle: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 7,
  height: 35, padding: "0 16px", borderRadius: 17.5,
  background: "var(--chip-bg)", border: "none", color: "var(--color-label)",
  fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)",
  lineHeight: "var(--lh-subhead)", letterSpacing: "var(--ls-subhead)",
  fontWeight: 600, cursor: "pointer", WebkitTapHighlightColor: "transparent",
};

/* ─────────────────────────── склейка ─────────────────────────── */

/**
 * Держатель состояния слоя. Плеер не «висит поверх» — он ЗАБИРАЕТ слой себе,
 * как в замере (§5.20, состояние 3: табы схлопываются с 281 до 51 pt). Здесь это
 * выражено просто: пока плеер развёрнут, нижней навигации нет.
 *
 * Повтор и скорость живут ЗДЕСЬ, а не в экране: при переходе к следующей записи
 * скорость чтения должна сохраняться — человек выбрал её один раз на всю сессию,
 * а не на трек.
 */
export function PlayerHost({ queue, index, onIndex, tabBarBottom = 91, children }: {
  queue: Track[]; index: number; onIndex: (i: number) => void;
  /** Низ мини-плеера над таб-баром: 21 + 62 + 8 = 91 (📐 5.16 · 5.17). */
  tabBarBottom?: number;
  children?: ReactNode;
}) {
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [state, setState] = useState<LayerState>("mini");
  const [sheet, setSheet] = useState<"none" | "queue" | "text">("none");
  const [speed, setSpeed] = useState(1);
  const [repeat, setRepeat] = useState(false);
  const track = queue[index];

  useEffect(() => { setPosition(0); }, [index]);

  const next = useCallback(() => onIndex((index + 1) % queue.length), [index, queue.length, onIndex]);
  const prev = useCallback(() => {
    if (position > 3) { setPosition(0); return; }
    onIndex((index - 1 + queue.length) % queue.length);
  }, [index, position, queue.length, onIndex]);

  /* Ход воспроизведения. Скорость учитывается, потому что она влияет на то,
     как быстро бежит позиция; повтор — на то, что делать в конце записи. */
  useEffect(() => {
    if (!playing || !track) return;
    const t = setInterval(() => setPosition((prevPos) => {
      const nextPos = prevPos + speed;
      if (nextPos < track.duration) return nextPos;
      if (repeat) return 0;
      next();
      return 0;
    }), 1000);
    return () => clearInterval(t);
  }, [playing, track, speed, repeat, next]);

  if (!track) return <>{children}</>;
  const seek = (s: number) => setPosition(Math.max(0, Math.min(track.duration, s)));
  return (
    <>
      {children}
      {state === "mini" && sheet === "none" && (
        <MiniPlayer track={track} playing={playing} position={position}
          onToggle={() => setPlaying((v) => !v)}
          onOpen={() => setState("full")}
          onNext={next}
          bottom={tabBarBottom} />
      )}
      {state === "full" && (
        <FullPlayer track={track} playing={playing} position={position} speed={speed} repeat={repeat}
          onToggle={() => setPlaying((v) => !v)}
          onSeek={seek}
          onPrev={prev} onNext={next}
          onClose={() => setState("mini")}
          onText={CAPS[track.kind].text ? () => setSheet("text") : undefined}
          onQueue={CAPS[track.kind].queue ? () => setSheet("queue") : undefined}
          onSpeed={setSpeed}
          onRepeat={() => setRepeat((v) => !v)} />
      )}
      {sheet === "queue" && (
        <QueueSheet queue={queue} index={index} kind={track.kind}
          onPick={(k) => { onIndex(k); setSheet("none"); }}
          onClose={() => setSheet("none")} />
      )}
      {sheet === "text" && (
        <TextSheet track={track} position={position} onSeek={seek}
          onClose={() => setSheet("none")} />
      )}
    </>
  );
}
