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
 *   мини-плеер     высота 48.0, врезка 21.0, ширина 351.0 (5.17)
 *                  материал — СТЕКЛО; #181818 в переписи это его непрозрачный
 *                  эквивалент над чёрным, а не заливка (§2.1 · ЗКН-Д016)
 *   зазор до таб-бара  8.0 — совпал на пяти кадрах (5.17)
 *   сегменты внутри    [28 + 48] обложка · [88 + 277] содержимое (5.20, состояние 6)
 *   плеер как слой     высота 38.0, ширина 277.0, ось 56 (5.20), материал — стекло
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
import { Menu, type MenuGroups } from "./Menu";

/* ─────────────────────────── модель ─────────────────────────── */

export type PlayKind = "book" | "lecture" | "kirtan" | "bhajan" | "podcast" | "inspiration";

/**
 * ПЛЕЕР ОДИН НА ВСЁ. Виды звука НЕ различаются набором действий.
 *
 * Здесь стояла «матрица возможностей»: книге давались перемотка и скорость,
 * киртану — повтор и перемешивание, вдохновению не давалось ничего. Матрица
 * была выведена из рассуждения «у Apple книга и песня живут в разных
 * приложениях, значит и транспорт разный» — то есть из МОЕЙ ДОГАДКИ, а не из
 * замера и не из замысла приложения.
 *
 * Действующий плеер приложения устроен ровно наоборот и был прав: один набор
 * на всё. Пять кнопок транспорта, четыре инструмента внизу — и лекции, и
 * киртану, и вдохновению. Различает виды ЕДИНСТВЕННОЕ: есть ли у записи текст.
 * Нет текста — значок раскрытой книги гаснет, но не исчезает: строка действий
 * не должна плясать от вида к виду.
 *
 * Предмет другой, язык тот же.
 */

export type OrderMode = "forward" | "shuffle";

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
  /** Длительность, секунды. Уточняется из метаданных, когда звук загрузится. */
  duration: number;
  /** Адрес звука. Нет — плеер идёт «вхолостую» по таймеру: это витрина
   *  раскладки, а не обман. Плашка внизу говорит об этом прямо. */
  src?: string;
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
/** Раскрытая книга — единственный знак, которым виды звука различаются. */
function TextGlyph({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path {...S} d="M12 7.4v11.4" />
    <path {...S} d="M12 7.4C10.4 6 8.4 5.3 5.6 5.3H3.6v11.4h2c2.8 0 4.8.7 6.4 2.1" />
    <path {...S} d="M12 7.4c1.6-1.4 3.6-2.1 6.4-2.1h2v11.4h-2c-2.8 0-4.8.7-6.4 2.1" /></svg>;
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
function HeartGlyph({ size = 20, filled }: { size?: number; filled?: boolean }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path {...S} fill={filled ? "currentColor" : "none"}
      d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.6-7 9-7 9z" /></svg>;
}
function MoreGlyph({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <circle cx="5.5" cy="12" r="1.7" fill="currentColor" />
    <circle cx="12" cy="12" r="1.7" fill="currentColor" />
    <circle cx="18.5" cy="12" r="1.7" fill="currentColor" /></svg>;
}
function SpeedGlyph({ size = 19 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path {...S} d="M4.4 17.4a8.6 8.6 0 1 1 15.2 0" /><path {...S} d="M12 12.6 15.8 9" /></svg>;
}
function MoonGlyph({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path {...S} d="M20 14.2A8.2 8.2 0 0 1 9.8 4 8.4 8.4 0 1 0 20 14.2z" /></svg>;
}
function ShuffleGlyph({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path {...S} d="M4 7h3.2l9.6 10H20M4 17h3.2l2.4-2.6M14.4 9.6 16.8 7H20" />
    <path {...S} d="M17.6 4.6 20.4 7l-2.8 2.4M17.6 14.6 20.4 17l-2.8 2.4" /></svg>;
}
function VolLowGlyph({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path fill="currentColor" d="M12 4.6 7.2 8.8H3.6v6.4h3.6L12 19.4z" /></svg>;
}
function VolHighGlyph({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path fill="currentColor" d="M10.4 4.6 5.6 8.8H2v6.4h3.6l4.8 4.2z" />
    <path {...S} d="M14 9.2a4 4 0 0 1 0 5.6M16.8 6.6a7.8 7.8 0 0 1 0 10.8" /></svg>;
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
      {/* МАТЕРИАЛ — СТЕКЛО, а не заливка (ЗКН-Д016 · §2.1). Здесь стояло
          `background: #181818`, снятое переписью с чёрного кадра. Но стандарт
          прямо говорит: #181818 — НЕПРОЗРАЧНЫЙ ЭКВИВАЛЕНТ стекла над чёрным,
          «10 из 10 (бары, меню, листы)». На чёрном фоне стекло и выглядит
          плоским — перепись меряет результат отрисовки, а не материал.
          Радиус: плавающий бар — КАПСУЛА h/2 (§4.2, профиль совпал с
          окружностью до пикселя), то есть 24 при высоте 48. */}
      <div className="glass" style={{
        ["--glass-r" as string]: "24px",
        height: "100%", overflow: "hidden",
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
  const title = kind === "book" || kind === "lecture" ? "Оглавление" : "Дальше";
  return (
    <div role="dialog" aria-modal="true" aria-label={title}
      style={{ position: "absolute", inset: 0, zIndex: 1500, display: "flex",
        flexDirection: "column", background: "var(--color-bg-2)",
        ["--color-card" as string]: "var(--color-bg-3)",
        paddingTop: "calc(env(safe-area-inset-top) + 8px)" }}>
      {/* Граббер — панель закрывается так же, как открывается плеер */}
      <button type="button" onClick={onClose} aria-label="Закрыть"
        style={{ alignSelf: "center", width: 88, height: 26, display: "grid",
          placeItems: "center", background: "none", border: "none", cursor: "pointer",
          flexShrink: 0, WebkitTapHighlightColor: "transparent" }}>
        <span aria-hidden style={{ width: 36, height: 5, borderRadius: 3,
          background: "var(--color-label-3)", opacity: 0.55, display: "block" }} />
      </button>

      {/* ТЕКУЩАЯ ЗАПИСЬ — компактная шапка панели, как у Apple: миниатюра 48,
          название, подпись раздела мелко над списком. */}
      <div style={{ display: "flex", alignItems: "center", gap: 12,
        padding: "6px 20px 12px", flexShrink: 0 }}>
        <Cover track={queue[index]} size={48} radius={8} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: 0, fontFamily: "var(--font-text)", fontSize: "var(--text-body)",
            lineHeight: "var(--lh-body)", letterSpacing: "var(--ls-body)", fontWeight: 600,
            color: "var(--color-label)", whiteSpace: "nowrap", overflow: "hidden",
            textOverflow: "ellipsis" }}>{queue[index]?.title}</p>
          {queue[index]?.subtitle && (
            <p style={{ margin: 0, fontFamily: "var(--font-text)",
              fontSize: "var(--text-subhead)", lineHeight: "var(--lh-subhead)",
              letterSpacing: "var(--ls-subhead)", color: "var(--color-label-3)",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {queue[index].subtitle}</p>
          )}
        </div>
      </div>

      <p style={{ margin: 0, padding: "6px 20px 4px", flexShrink: 0,
        fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)",
        lineHeight: "var(--lh-subhead)", letterSpacing: "var(--ls-subhead)",
        fontWeight: 700, color: "var(--color-label)" }}>{title}</p>

      <ul style={{ listStyle: "none", margin: 0, padding: "0 8px 24px", overflowY: "auto",
        flex: 1, minHeight: 0 }}>
        {queue.map((q, i) => (
          <li key={q.id}>
            <button type="button" onClick={() => onPick(i)}
              style={{ display: "flex", alignItems: "center", gap: 12, width: "100%",
                minHeight: 58, padding: "5px 12px", background: "none",
                border: "none", borderRadius: 10, cursor: "pointer", textAlign: "left",
                WebkitTapHighlightColor: "transparent" }}>
              <Cover track={q} size={48} radius={8} />
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: "block", fontFamily: "var(--font-text)",
                  fontSize: "var(--text-body)", lineHeight: "var(--lh-body)",
                  letterSpacing: "var(--ls-body)",
                  color: i === index ? "var(--color-gold-deep)" : "var(--color-label)",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {q.title}
                </span>
                <span style={{ display: "block", fontFamily: "var(--font-text)",
                  fontSize: "var(--text-subhead)", lineHeight: "var(--lh-subhead)",
                  letterSpacing: "var(--ls-subhead)", color: "var(--color-label-3)" }}>
                  {clock(q.duration)}
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
/** Ступени таймера сна (ЗКН-Н054). */
const SLEEP_MIN = [5, 10, 15, 30, 45, 60] as const;

/** Доля кадра 852 pt — та система отсчёта, в которой сняты все замеры плеера.
 *  Позиция в процентах, а не в пикселях: на экране короче кадра раскладка
 *  сжимается пропорционально, вместо того чтобы уезжать за край. */
const P = (y: number) => `${(y / 852) * 100}%`;

/**
 * «Сейчас играет». Блок управления стоит на замеренных высотах (📐 apple_music
 * с.31 и 35, кадр 393 × 852): заголовок y 483, знак y 557, транспорт y 635,
 * нижний ряд y 732 при врезке 27.
 *
 * Транспорт зависит от ВИДА, а не один на всех: длинной записи нужна перемотка
 * на ±15 секунд и скорость, песне — переход по трекам и повтор. Матрица CAPS.
 */
export function FullPlayer({ track, playing, position, speed, fav, order, repeat,
  sleepMin, sleepEnd, volume,
  onToggle, onSeek, onPrev, onNext, onClose, onText, onQueue,
  onSpeed, onFav, onOrder, onRepeat, onSleepMin, onSleepEnd, onVolume }: {
  track: Track; playing: boolean; position: number; speed: number;
  fav: boolean; order: OrderMode; repeat: boolean;
  sleepMin: number | null; sleepEnd: boolean; volume: number;
  onToggle: () => void; onSeek: (s: number) => void;
  onPrev: () => void; onNext: () => void; onClose: () => void;
  onText: () => void; onQueue: () => void;
  /** ЗКН-Д023 — скорость ВЫБИРАЮТ из списка. Список живёт в динамичном меню,
   *  которое вырастает ИЗ КНОПКИ скорости — как у Apple, а не простынёй снизу. */
  onSpeed: (v: number) => void;
  onFav: () => void; onOrder: (o: OrderMode) => void; onRepeat: () => void;
  onSleepMin: (m: number | null) => void; onSleepEnd: (v: boolean) => void;
  onVolume: (v: number) => void;
}) {
  const hasText = !!track.text?.length || !!track.textHref;
  const sleepOn = sleepEnd || !!sleepMin;
  const [menu, setMenu] = useState<null | "more" | "speed" | "sleep">(null);

  /* ── НАПОЛНЕНИЕ МЕНЮ. Одно динамичное меню обслуживает всё: скорость, сон,
     порядок, повтор, избранное. Подменю раскрываются на месте (📐 IMG_1952). */
  const sleepGroups: MenuGroups = [
    [{ id: "end", label: "После этой записи", icon: <MoonGlyph size={16} />,
       checked: sleepEnd, onSelect: () => { onSleepEnd(!sleepEnd); onSleepMin(null); } }],
    SLEEP_MIN.map((m) => ({ id: `m${m}`, label: `Через ${m} мин`,
      checked: sleepMin === m,
      onSelect: () => { onSleepMin(sleepMin === m ? null : m); onSleepEnd(false); } })),
    ...(sleepOn ? [[{ id: "off", label: "Выключить таймер",
      onSelect: () => { onSleepMin(null); onSleepEnd(false); } }]] : []),
  ];
  const orderGroups: MenuGroups = [[
    { id: "fw", label: "По списку", checked: order === "forward", onSelect: () => onOrder("forward") },
    { id: "sh", label: "Перемешать", icon: <ShuffleGlyph size={15} />,
      checked: order === "shuffle", onSelect: () => onOrder("shuffle") },
  ]];
  const speedGroups: MenuGroups = [SPEEDS.map((v) => ({
    id: `s${v}`, label: `${v}×${v === 1 ? " обычная" : ""}`,
    checked: v === speed, onSelect: () => onSpeed(v) }))];
  const moreGroups: MenuGroups = [
    [{ id: "fav", label: fav ? "В избранном" : "В избранное",
       icon: <HeartGlyph size={16} filled={fav} />, checked: fav, onSelect: onFav }],
    [
      { id: "sleep", label: "Таймер сна", icon: <MoonGlyph size={16} />,
        sub: sleepEnd ? "После этой записи" : sleepMin ? `Через ${sleepMin} мин` : "Выключен",
        submenu: sleepGroups },
      { id: "order", label: "Порядок", icon: <ShuffleGlyph size={15} />,
        sub: order === "shuffle" ? "Перемешать" : "По списку", submenu: orderGroups },
      { id: "rep", label: "Повторять запись", icon: <RepeatGlyph size={15} />,
        checked: repeat, onSelect: onRepeat },
    ],
  ];
  return (
    <div role="dialog" aria-modal="true" aria-label={`Сейчас играет: ${track.title}`}
      style={{ position: "absolute", inset: 0, zIndex: 1400, display: "flex", flexDirection: "column",
        background: "var(--color-bg-2)", paddingTop: "env(safe-area-inset-top)" }}>
      <Ambient track={track} />

      <div style={{ position: "absolute", inset: 0, zIndex: 1 }}>
        {/* У Apple в плеере НЕТ шапки — только граббер (📐 живые снимки: тонкая
            пилюля сверху по центру, никаких кнопок). Сердце и всё прочее живёт
            в меню ⋯ у названия. Шапка с сердцем была моей отсебятиной. */}
        <button type="button" onClick={onClose} aria-label="Свернуть плеер"
          style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
            width: 88, height: 30, display: "grid", placeItems: "center",
            background: "none", border: "none", cursor: "pointer",
            WebkitTapHighlightColor: "transparent" }}>
          <span aria-hidden style={{ width: 36, height: 5, borderRadius: 3,
            background: "var(--color-label-3)", opacity: 0.55, display: "block" }} />
        </button>

        {/* РАСКЛАДКА ПО ПОЗИЦИЯМ, А НЕ ПО ПРОМЕЖУТКАМ.
            Прошлая версия складывала экран стопкой отступов и называла это
            «по замеру» — но замер задаёт МЕСТА, а не расстояния: стопка копит
            погрешность, и заголовок уезжал на 415 вместо 483, транспорт на 578
            вместо 635, а нижний ряд проваливался на 794 вместо 732.

            Теперь каждый блок садится на свою высоту, выраженную долей кадра
            852 pt. На экране короче кадра всё сжимается пропорционально —
            замер задаёт ПРОПОРЦИЮ, а не абсолют в пикселях чужого экрана. */}
        <div style={{ position: "absolute", inset: 0 }}>
          {/* ОБЛОЖКА — 📐 345.0 × 345.0, врезка 24.0, верх y 91.5, низ 436.5.
              Замер снят с живых снимков iPhone: в корпусном наборе чистого
              «сейчас играет» не было вовсе, все кадры сняты с открытым текстом
              песни. Квадратность подтверждена арифметикой: 393 − 24 − 24 = 345.

              Верхняя кромка ловилась поточечным сравнением «внутри против
              снаружи»: обложка начиналась почти чёрной полосой, и порог по
              насыщенности обрезал её на 25 пунктов ниже настоящего края. */}
          <div style={{ position: "absolute", top: P(91.5), left: 24, right: 24,
            aspectRatio: "1" }}>
            <Cover track={track} size="100%" radius="var(--radius-card)" big />
          </div>

          {/* УПРАВЛЕНИЕ ПРИЖАТО К НИЗУ, а не расставлено по отдельным высотам.
              Абсолютная посадка каждого блока сломалась ровно там, где название
              заняло две строки: заголовок пополз вниз и лёг НА ШКАЛУ. Замеренные
              высоты — это высоты при ОДНОСТРОЧНОМ названии; у нас названия
              длинные, и стопка должна расти ВВЕРХ от нижнего края.
              Низ ряда инструментов приходится на 767 из 852 → отступ снизу 85. */}
          <div style={{ position: "absolute", left: 24, right: 24, bottom: P(36) }}>
            <div style={{ marginBottom: 4, fontFamily: "var(--font-text)",
              fontSize: "var(--text-caption2)", lineHeight: "var(--lh-caption2)",
              letterSpacing: "var(--ls-caption2)", fontWeight: 600,
              color: "var(--color-gold-deep)" }}>
              {KIND_LABEL[track.kind]}
            </div>
            {/* Заголовок и ⋯ стоят В ОДНОЙ СТРОКЕ — 📐 кнопка на x 337.0 при
                врезке заголовка 33.7. Раньше «ещё» жила в шапке; замер показал,
                что у Apple она принадлежит записи, а не экрану. */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <h1 style={{ margin: 0, flex: 1, minWidth: 0, fontFamily: "var(--font-display)",
                fontSize: "var(--text-title2)", lineHeight: "var(--lh-title2)",
                letterSpacing: "var(--ls-title2)", fontWeight: 700,
                color: "var(--color-label)", overflow: "hidden", display: "-webkit-box",
                WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                {track.title}
              </h1>
              <button type="button" onClick={() => setMenu("more")} aria-label="Ещё"
                style={{ ...transportStyle, width: 28, height: 28, flexShrink: 0,
                  borderRadius: 14, background: "var(--color-fill-1)",
                  color: sleepOn ? "var(--color-gold-deep)" : "var(--color-label-2)" }}>
                <MoreGlyph size={15} />
              </button>
            </div>
            {track.subtitle && (
              <p style={{ margin: "2px 0 0", fontFamily: "var(--font-text)",
                fontSize: "var(--text-subhead)", lineHeight: "var(--lh-subhead)",
                letterSpacing: "var(--ls-subhead)", color: "var(--color-label-2)",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {track.subtitle}
              </p>
            )}

            <div style={{ marginTop: 18 }}>
              <Scrubber position={position} duration={track.duration} onSeek={onSeek} />
            </div>

            {/* ТРАНСПОРТ — пять кнопок, как в действующем плеере приложения:
                перемотка ±15 И переход по записям СРАЗУ. Ни одна из них не
                зависит от вида звука. */}
            <div style={{ marginTop: 20, display: "flex", alignItems: "center",
              justifyContent: "space-between", gap: 8 }}>
              <button type="button" onClick={() => onSeek(position - 15)}
                aria-label="Назад 15 секунд"
                style={{ ...transportStyle, width: 34, height: 34, color: "var(--color-label-2)" }}>
                <Back15Glyph size={26} />
              </button>
              <button type="button" onClick={onPrev} aria-label="Предыдущая"
                style={{ ...transportStyle, width: 40, height: 40 }}>
                <PrevGlyph size={32} />
              </button>
              <button type="button" onClick={onToggle} aria-label={playing ? "Пауза" : "Воспроизвести"}
                style={{ ...transportStyle, width: 64, height: 64 }}>
                {playing ? <PauseGlyph size={44} /> : <PlayGlyph size={44} />}
              </button>
              <button type="button" onClick={onNext} aria-label="Следующая"
                style={{ ...transportStyle, width: 40, height: 40 }}>
                <NextGlyph size={32} />
              </button>
              <button type="button" onClick={() => onSeek(position + 15)}
                aria-label="Вперёд 15 секунд"
                style={{ ...transportStyle, width: 34, height: 34, color: "var(--color-label-2)" }}>
                <Fwd15Glyph size={26} />
              </button>
            </div>

            {/* ГРОМКОСТЬ — 📐 y 732…749: динамик 8 слева, полоса, динамик 18.7
                справа. Полоса тонкая, наполнение глушёно-белое, бегунка в покое
                не видно — как на живом снимке. Привязана к настоящему звуку. */}
            <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10,
              padding: "0 3px" }}>
              <span aria-hidden style={{ color: "var(--color-label-3)", display: "grid" }}>
                <VolLowGlyph size={13} />
              </span>
              <input type="range" min={0} max={1} step={0.01} value={volume}
                aria-label="Громкость"
                onChange={(e) => onVolume(Number(e.target.value))}
                className="xvol"
                style={{ flex: 1, ["--v" as string]: String(volume * 100) }} />
              <span aria-hidden style={{ color: "var(--color-label-3)", display: "grid" }}>
                <VolHighGlyph size={16} />
              </span>
            </div>

            {!track.src && (
              <p style={{ margin: "12px 0 0", textAlign: "center", fontFamily: "var(--font-text)",
                fontSize: "var(--text-caption2)", lineHeight: "var(--lh-caption2)",
                letterSpacing: "var(--ls-caption2)", color: "var(--color-label-3)" }}>
                Запись не подключена — идёт показ раскладки
              </p>
            )}

            {/* ИНСТРУМЕНТЫ — четыре, как в действующем плеере. У Apple здесь
                лирика · AirPlay · очередь; у нас лирики нет, зато есть
                двухчасовая лекция и киртан на ночь. Предмет другой, язык тот же.
                «Текст» ГАСНЕТ при отсутствии текста, но не исчезает: строка
                действий не должна плясать от записи к записи. */}
            <div style={{ marginTop: 22, display: "flex", alignItems: "center",
              justifyContent: "space-around" }}>
              <button type="button" onClick={onText} disabled={!hasText} aria-label="Текст"
                style={{ ...transportStyle, width: 44, height: 44,
                  opacity: hasText ? 1 : 0.32, cursor: hasText ? "pointer" : "default",
                  color: "var(--color-label-2)" }}>
                <TextGlyph size={21} />
              </button>
              <button type="button" onClick={() => setMenu("speed")} aria-label={`Скорость ${speed}×`}
                style={{ ...transportStyle, width: 44, height: 44,
                  color: speed === 1 ? "var(--color-label-2)" : "var(--color-gold-deep)" }}>
                <span style={{ display: "grid", placeItems: "center", gap: 1 }}>
                  <SpeedGlyph size={19} />
                  <span style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)",
                    fontWeight: 700, lineHeight: "var(--lh-caption2)" }}>{speed}×</span>
                </span>
              </button>
              <button type="button" onClick={() => setMenu("sleep")} aria-label="Таймер сна"
                style={{ ...transportStyle, width: 44, height: 44,
                  color: sleepOn ? "var(--color-gold-deep)" : "var(--color-label-2)" }}>
                <MoonGlyph size={21} />
              </button>
              <button type="button" onClick={onQueue} aria-label="Очередь"
                style={{ ...transportStyle, width: 44, height: 44, color: "var(--color-label-2)" }}>
                <QueueGlyph size={21} />
              </button>
            </div>
          </div>
        </div>

        {/* ── ДИНАМИЧНОЕ МЕНЮ — у той кнопки, что его вызвало.
            ⋯ у названия → сверху-справа (📐 IMG_1952: верх 266, правый край 33);
            скорость и луна внизу → меню растёт ВВЕРХ из кнопки. */}
        {menu === "more" && (
          <Menu groups={moreGroups} onClose={() => setMenu(null)}
            place={{ top: P(266), right: 33 }} origin="top right" />
        )}
        {menu === "speed" && (
          <Menu groups={speedGroups} onClose={() => setMenu(null)}
            place={{ bottom: P(96), left: 29 }} origin="bottom left" />
        )}
        {menu === "sleep" && (
          <Menu groups={sleepGroups} onClose={() => setMenu(null)}
            place={{ bottom: P(96), right: 29 }} origin="bottom right" />
        )}
      </div>

      {/* Полоса громкости без видимого бегунка — он появляется под пальцем */}
      <style>{`
        .xvol { -webkit-appearance: none; appearance: none; height: 3px; border-radius: 2px;
          background: linear-gradient(to right, var(--color-label-2) calc(var(--v, 50) * 1%), var(--color-fill-2) 0);
          outline: none; }
        .xvol::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px;
          border-radius: 7px; background: var(--color-label); opacity: 0; transition: opacity 120ms; }
        .xvol:active::-webkit-slider-thumb, .xvol:focus-visible::-webkit-slider-thumb { opacity: 0.9; }
      `}</style>
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

const RESUME_KEY = "iol.x.player.v1";
const FAV_KEY = "iol.x.favs.v1";

/**
 * Держатель состояния слоя и НАСТОЯЩИЙ звук.
 *
 * Плеер не «висит поверх» — он ЗАБИРАЕТ слой себе (§5.20, состояние 3: табы
 * схлопываются с 281 до 51 pt). Пока плеер развёрнут, нижней навигации нет.
 *
 * ЗВУК. Первая версия гоняла позицию таймером и не играла ничего — это была
 * раскладка, а не плеер. Теперь всем правит один элемент `<audio>`: он источник
 * правды о позиции и длительности, а React только отражает его состояние.
 * Обратный порядок (React ведёт, звук догоняет) даёт дребезг на перемотке.
 *
 * Когда у записи нет адреса, остаётся холостой ход по таймеру — витрина
 * раскладки. Об этом сказано на экране прямо, а не умолчано.
 *
 * СКОРОСТЬ И ПОВТОР живут здесь, а не в экране: человек выбирает скорость один
 * раз на сессию, а не на каждую главу.
 */
export function PlayerHost({ queue, index, onIndex, tabBarBottom = 91, children }: {
  queue: Track[]; index: number; onIndex: (i: number) => void;
  /** Низ мини-плеера над таб-баром: 21 + 62 + 8 = 91 (📐 5.16 · 5.17). */
  tabBarBottom?: number;
  children?: ReactNode;
}) {
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [state, setState] = useState<LayerState>("mini");
  const [sheet, setSheet] = useState<"none" | "queue" | "text">("none");
  const [speed, setSpeed] = useState(1);
  const [repeat, setRepeat] = useState(false);
  const [favs, setFavs] = useState<string[]>([]);
  const [order, setOrder] = useState<OrderMode>("forward");
  const [sleepMin, setSleepMin] = useState<number | null>(null);
  const [sleepEnd, setSleepEnd] = useState(false);
  const [sleepAt, setSleepAt] = useState<number | null>(null);
  const [volume, setVolume] = useState(1);
  const audio = useRef<HTMLAudioElement | null>(null);
  const track = queue[index];

  /* ── ВОЗВРАТ НА МЕСТО. Лекция идёт 55 минут: потерять место — потерять всё.
       Пишем редко (раз в 5 секунд по ходу), читаем один раз при запуске. */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RESUME_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as { id?: string; t?: number; rate?: number };
      if (s.rate) setSpeed(s.rate);
      const k = queue.findIndex((x) => x.id === s.id);
      if (k >= 0) { onIndex(k); if (s.t) setPosition(s.t); }
    } catch { /* хранилище может быть закрыто — это не повод падать */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!track) return;
    const id = setInterval(() => {
      try {
        localStorage.setItem(RESUME_KEY, JSON.stringify({
          id: track.id, t: Math.floor(position), rate: speed }));
      } catch { /* noop */ }
    }, 5000);
    return () => clearInterval(id);
  }, [track, position, speed]);

  /* ── ИЗБРАННОЕ. Хранится списком идентификаторов: список переживает смену
       каталога, а индексы — нет. */
  useEffect(() => {
    try { setFavs(JSON.parse(localStorage.getItem(FAV_KEY) ?? "[]")); } catch { /* noop */ }
  }, []);
  const toggleFav = useCallback(() => {
    if (!track) return;
    setFavs((prev) => {
      const nextList = prev.includes(track.id) ? prev.filter((x) => x !== track.id) : [...prev, track.id];
      try { localStorage.setItem(FAV_KEY, JSON.stringify(nextList)); } catch { /* noop */ }
      return nextList;
    });
  }, [track]);

  /* ── ПОРЯДОК. «Перемешать» строит последовательность ОДИН раз и держит её:
       пересчёт на каждом переходе давал бы повторы и пропуски. */
  const [seq, setSeq] = useState<number[]>([]);
  useEffect(() => {
    const base = queue.map((_, k) => k);
    if (order === "forward") { setSeq(base); return; }
    const rest = base.filter((k) => k !== index);
    for (let k = rest.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1));
      [rest[k], rest[j]] = [rest[j], rest[k]];
    }
    setSeq([index, ...rest]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, queue.length]);

  const next = useCallback(() => {
    /* Таймер «после этой записи» останавливает ИМЕННО ЗДЕСЬ — на границе,
       а не посреди киртана (ЗКН-Н054). */
    if (sleepEnd) { setPlaying(false); setSleepEnd(false); return; }
    const at = seq.indexOf(index);
    const k = at >= 0 && seq.length ? seq[(at + 1) % seq.length] : (index + 1) % queue.length;
    onIndex(k);
  }, [index, queue.length, onIndex, seq, sleepEnd]);
  const prev = useCallback(() => {
    if (position > 3) { seekTo(0); return; }
    onIndex((index - 1 + queue.length) % queue.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, position, queue.length, onIndex]);

  function seekTo(s: number) {
    const lim = duration || track?.duration || 0;
    const v = Math.max(0, Math.min(lim, s));
    setPosition(v);
    if (audio.current) audio.current.currentTime = v;
  }

  /* ── ЗВУК ВЕДЁТ. Позиция и длительность приходят ОТ элемента. */
  useEffect(() => {
    const el = audio.current; if (!el) return;
    const onTime = () => setPosition(el.currentTime);
    const onMeta = () => setDuration(el.duration || 0);
    const onEnd = () => { if (!repeat) next(); };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("ended", onEnd);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("ended", onEnd);
    };
  }, [repeat, next]);

  useEffect(() => { if (audio.current) audio.current.playbackRate = speed; }, [speed, index]);
  useEffect(() => { if (audio.current) audio.current.loop = repeat; }, [repeat, index]);
  useEffect(() => { if (audio.current) audio.current.volume = volume; }, [volume, index]);
  useEffect(() => {
    const el = audio.current; if (!el || !track?.src) return;
    if (playing) el.play().catch(() => setPlaying(false)); else el.pause();
  }, [playing, track]);
  useEffect(() => { setPosition(0); setDuration(0); }, [index]);

  /* ── ХОЛОСТОЙ ХОД. Только когда звука нет: иначе позиция считалась бы дважды. */
  useEffect(() => {
    if (!playing || !track || track.src) return;
    const id = setInterval(() => setPosition((v) => {
      const n = v + speed;
      if (n < track.duration) return n;
      if (repeat) return 0;
      next(); return 0;
    }), 1000);
    return () => clearInterval(id);
  }, [playing, track, speed, repeat, next]);

  /* ── ТАЙМЕР ПО МИНУТАМ. Отдельная метка времени, а не отсчёт от позиции:
       человек ставит «через 30 минут» по часам, а не по длине записи. */
  useEffect(() => {
    setSleepAt(sleepMin ? Date.now() + sleepMin * 60_000 : null);
  }, [sleepMin]);
  useEffect(() => {
    if (!sleepAt) return;
    const id = setInterval(() => {
      if (Date.now() >= sleepAt) { setPlaying(false); setSleepAt(null); setSleepMin(null); }
    }, 1000);
    return () => clearInterval(id);
  }, [sleepAt]);

  /* ── ЛОКСКРИН. Без этого приложение со звуком не выглядит настоящим ни на
       iOS, ни на Android: наушники и экран блокировки должны им управлять. */
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator) || !track) return;
    const ms = navigator.mediaSession;
    ms.metadata = new MediaMetadata({
      title: track.title,
      artist: track.subtitle ?? KIND_LABEL[track.kind],
      album: KIND_LABEL[track.kind],
      artwork: track.cover ? [{ src: track.cover, sizes: "512x512" }] : [],
    });
    ms.playbackState = playing ? "playing" : "paused";
    ms.setActionHandler("play", () => setPlaying(true));
    ms.setActionHandler("pause", () => setPlaying(false));
    ms.setActionHandler("previoustrack", prev);
    ms.setActionHandler("nexttrack", next);
    ms.setActionHandler("seekbackward", () => seekTo(position - 15));
    ms.setActionHandler("seekforward", () => seekTo(position + 15));
    ms.setActionHandler("seekto", (e) => { if (e.seekTime != null) seekTo(e.seekTime); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, playing, position, prev, next]);

  if (!track) return <>{children}</>;
  const shown: Track = duration ? { ...track, duration } : track;
  return (
    <>
      {children}
      {/* Один элемент на всё приложение: два звука разом — это ошибка, а не
          возможность (та же мысль, что ЗКН-Н065 в текущей оболочке). */}
      <audio ref={audio} src={track.src} preload="metadata" playsInline />
      {state === "mini" && sheet === "none" && (
        <MiniPlayer track={shown} playing={playing} position={position}
          onToggle={() => setPlaying((v) => !v)}
          onOpen={() => setState("full")}
          onNext={next}
          bottom={tabBarBottom} />
      )}
      {state === "full" && (
        <FullPlayer track={shown} playing={playing} position={position} speed={speed}
          fav={favs.includes(track.id)} order={order} repeat={repeat}
          sleepMin={sleepMin} sleepEnd={sleepEnd} volume={volume}
          onFav={toggleFav}
          onToggle={() => setPlaying((v) => !v)}
          onSeek={seekTo}
          onPrev={prev} onNext={next}
          onClose={() => setState("mini")}
          onText={() => setSheet("text")}
          onQueue={() => setSheet("queue")}
          onSpeed={setSpeed} onOrder={setOrder} onRepeat={() => setRepeat((v) => !v)}
          onSleepMin={setSleepMin} onSleepEnd={setSleepEnd}
          onVolume={setVolume} />
      )}
      {sheet === "queue" && (
        <QueueSheet queue={queue} index={index} kind={track.kind}
          onPick={(k) => { onIndex(k); setSheet("none"); }}
          onClose={() => setSheet("none")} />
      )}
      {sheet === "text" && (
        <TextSheet track={shown} position={position} onSeek={seekTo}
          onClose={() => setSheet("none")} />
      )}

    </>
  );
}
