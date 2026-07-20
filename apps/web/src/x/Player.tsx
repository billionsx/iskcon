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
 *   мини-плеер     высота 48.0, врезка 21.0, ширина 351.0, заливка #181818 (5.17)
 *   зазор до таб-бара  8.0 — совпал на пяти кадрах (5.17)
 *   сегменты внутри    [28 + 48] обложка · [88 + 277] содержимое (5.20, состояние 6)
 *   плеер как слой     высота 38.0, ширина 277.0, заливка #111111, ось 56 (5.20, состояние 3)
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

/** У каких видов есть переход на текст. Это единственное, чем виды различаются. */
const HAS_TEXT: Record<PlayKind, boolean> = {
  book: true, lecture: true, bhajan: true,
  kirtan: false, podcast: false, inspiration: false,
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

/**
 * «Сейчас играет». Из замера здесь достоверны врезка обложки 24.0 и ось
 * центральной кнопки 196.5 (центр экрана). Остальное 🕳 — фон экрана у Apple
 * выводится из обложки, плоских заливок нет, и статический переписчик его
 * не берёт.
 *
 * НАШЕ, чего у Apple нет: кнопка «Текст». Она включается только для книги,
 * лекции и бхаджана — там, где текст существует.
 */
export function FullPlayer({ track, playing, position, onToggle, onSeek, onPrev, onNext, onClose, onText, onQueue }: {
  track: Track; playing: boolean; position: number;
  onToggle: () => void; onSeek: (s: number) => void;
  onPrev: () => void; onNext: () => void; onClose: () => void;
  onText?: () => void; onQueue?: () => void;
}) {
  const hasText = HAS_TEXT[track.kind] && !!track.textHref;
  return (
    <div role="dialog" aria-modal="true" aria-label={`Сейчас играет: ${track.title}`}
      style={{
        position: "absolute", inset: 0, zIndex: 1400, display: "flex", flexDirection: "column",
        /* 🕳 Фон у Apple выведен из обложки. Пока — ступень поверхности листа. */
        background: "var(--color-bg-2)",
        paddingTop: "env(safe-area-inset-top)",
      }}>
      {/* шапка листа: свернуть */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
        height: 44, flexShrink: 0 }}>
        <button type="button" onClick={onClose} aria-label="Свернуть плеер"
          style={{ width: 44, height: 44, display: "grid", placeItems: "center",
            background: "none", border: "none", color: "var(--color-label-2)", cursor: "pointer",
            WebkitTapHighlightColor: "transparent" }}>
          <ChevronDownGlyph size={20} />
        </button>
      </div>

      {/* РАСКЛАДКА ПО ЗАМЕРЕННЫМ ВЫСОТАМ, А НЕ ПО ОТСТУПАМ СВЕРХУ.
          Первый прогон складывал экран сверху вниз, и внизу оставалась пустота.
          В кадре 852 pt блок управления стоит на своих местах (📐 apple_music
          с.31 и 35, оба кадра дали одно и то же):
            заголовок    y 483 … 504, врезка 33.7
            знак         y 557 … 565, по центру, ширина 25
            транспорт    y 635 … 672, по центру
            нижний ряд   y 732 … 749, врезка 27, ширина 338
          Обложка занимает то, что выше. Её собственная геометрия — 🕳: в наборе
          Music НЕТ ни одного кадра чистого «сейчас играет», все плеерные кадры
          сняты с открытым текстом песни. */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column",
        padding: "0 24px" }}>
        {/* Врезка 24.0 симметрично — в кадре 393 обложка выходит 345. Высота
            отдаётся остатку: квадрат сохраняется, но не выталкивает управление. */}
        {/* Квадрат задаётся ШИРИНОЙ и ограничивается высотой экрана. Прежде здесь
            стоял flex:1 вместе с aspect-ratio: флекс раздавал остаток высоты,
            отношение сторон пересчитывало ширину, коробка вылезала за родителя
            и ложилась ПОВЕРХ заголовка. Флекс и aspect-ratio на одном узле
            спорят за одну величину — их надо разводить. */}
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

        {/* 483→557: разрыв 53 между заголовком и шкалой (📐) */}
        <div style={{ marginTop: 22 }}>
          <Scrubber position={position} duration={track.duration} onSeek={onSeek} />
        </div>

        {/* ТРАНСПОРТ. Центральная кнопка на оси экрана (📐 apple_music с.31, 35). */}
        {/* 565→635: разрыв 70 до транспорта (📐) */}
        <div style={{ marginTop: 26, display: "flex", alignItems: "center",
          justifyContent: "center", gap: 36 }}>
          <button type="button" onClick={onPrev} aria-label="Назад"
            style={transportStyle}><PrevGlyph size={26} /></button>
          <button type="button" onClick={onToggle} aria-label={playing ? "Пауза" : "Воспроизвести"}
            style={{ ...transportStyle, width: 56, height: 56 }}>
            {playing ? <PauseGlyph size={34} /> : <PlayGlyph size={34} />}
          </button>
          <button type="button" onClick={onNext} aria-label="Дальше"
            style={transportStyle}><NextGlyph size={26} /></button>
        </div>

        {/* НИЖНИЙ РЯД — 📐 врезка 27, ширина 338, y 732…749. Действия расходятся
            по краям, а не жмутся в центр: у Apple здесь ряд равноудалённых знаков.
            «Текст» — НАШЕ, у Apple его нет; включается только там, где текст есть. */}
        <div style={{ display: "flex", alignItems: "center",
          justifyContent: hasText ? "space-between" : "center",
          padding: "0 3px", marginTop: "auto",
          marginBottom: "calc(40px + env(safe-area-inset-bottom))" }}>
          {hasText && (
            <button type="button" onClick={onText} className="sq" style={pillStyle}>
              <TextGlyph size={18} /> Текст
            </button>
          )}
          <button type="button" onClick={onQueue} aria-label="Очередь"
            style={{ ...transportStyle, width: 40, height: 40,
              color: "var(--color-label-2)" }}>
            <QueueGlyph size={20} />
          </button>
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
 * как в замере (§5.20, состояние 3: табы схлопываются с 281 до 51 pt).
 * Здесь это выражено проще: пока плеер развёрнут, нижняя навигация не рисуется.
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
  const track = queue[index];

  useEffect(() => { setPosition(0); }, [index]);
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setPosition((p) => Math.min(track.duration, p + 1)), 1000);
    return () => clearInterval(t);
  }, [playing, track]);

  const next = useCallback(() => onIndex((index + 1) % queue.length), [index, queue.length, onIndex]);
  const prev = useCallback(() => {
    if (position > 3) { setPosition(0); return; }
    onIndex((index - 1 + queue.length) % queue.length);
  }, [index, position, queue.length, onIndex]);

  if (!track) return <>{children}</>;
  return (
    <>
      {children}
      {state === "mini" && (
        <MiniPlayer track={track} playing={playing} position={position}
          onToggle={() => setPlaying((p) => !p)}
          onOpen={() => setState("full")}
          onNext={next}
          bottom={tabBarBottom} />
      )}
      {state === "full" && (
        <FullPlayer track={track} playing={playing} position={position}
          onToggle={() => setPlaying((p) => !p)}
          onSeek={(s) => setPosition(Math.max(0, Math.min(track.duration, s)))}
          onPrev={prev} onNext={next}
          onClose={() => setState("mini")}
          onText={track.textHref ? () => { window.location.href = track.textHref!; } : undefined}
          onQueue={undefined} />
      )}
    </>
  );
}
