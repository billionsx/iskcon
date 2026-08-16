/**
 * AudioEngine — тонкая обёртка над воспроизведением одного трека.
 *
 * Веб-реализация использует ДВА <audio>: играющий и запасной. В нативной
 * сборке (Capacitor) будет другая реализация ЭТОГО ЖЕ интерфейса
 * (AVPlayer/ExoPlayer + фоновый режим), поэтому стор и UI не меняются —
 * подменяется только движок. Media Session живёт в сторе (он владеет
 * метаданными очереди), движок знает только URL.
 *
 * ── ПОЧЕМУ ДВА ЭЛЕМЕНТА (16.08.2026) ──────────────────────────────────────
 * Было: один <audio> с preload="metadata". Следующий трек начинал грузиться
 * только ПОСЛЕ того, как кончился текущий — сеть, буфер, старт. На книге,
 * разрезанной на главы, и на лекции, разрезанной на части, это тишина в
 * КАЖДОМ стыке: чтение прерывается там, где в записи паузы нет.
 *
 * Стало: `prime(url)` заранее греет следующий трек на запасном элементе.
 * Когда очередь доходит до него, `load` видит, что запасной уже держит
 * этот адрес, и просто МЕНЯЕТ элементы местами — сеть в этот момент не
 * трогается вовсе. Если адрес не совпал (перескок по очереди, шаффл,
 * ручной выбор) — поведение прежнее, ничего не ломается.
 *
 * События форвардятся только от ИГРАЮЩЕГО элемента: запасной греется молча,
 * иначе его `durationchange` перебил бы длительность текущего трека.
 */

export interface AudioEngine {
  load(url: string, autoplay: boolean): void;
  /** Согреть следующий трек. Безопасно звать сколько угодно раз. */
  prime(url: string): void;
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

const abs = (url: string): string => {
  if (!url) return url;
  try { return new URL(url, location.href).href; } catch { return url; }
};

export function createWebEngine(ev: EngineEvents): AudioEngine {
  if (typeof Audio === "undefined") {
    const noop: AudioEngine = {
      load() {}, prime() {}, play() { return Promise.resolve(); }, pause() {},
      seek() {}, setRate() {}, currentTime: 0, duration: 0, paused: true, destroy() {},
    };
    return noop;
  }

  const mk = () => { const a = new Audio(); a.preload = "metadata"; return a; };
  let cur = mk();      // играет
  let spare = mk();    // греется
  let rate = 1;

  /* Слушатели висят на ОБОИХ элементах, но пропускают событие дальше только
     от играющего: иначе прогрев запасного сдвигал бы время и длительность
     текущего трека. Проверка идёт по ссылке, а не по индексу — элементы
     меняются местами, и индекс соврал бы. */
  const bind = (el: HTMLAudioElement) => {
    const live = (fn: () => void) => () => { if (el === cur) fn(); };
    el.addEventListener("timeupdate", live(() => ev.onTime?.(el.currentTime)));
    el.addEventListener("durationchange", live(() => ev.onDuration?.(el.duration || 0)));
    el.addEventListener("loadedmetadata", live(() => ev.onDuration?.(el.duration || 0)));
    el.addEventListener("play", live(() => ev.onPlay?.()));
    el.addEventListener("pause", live(() => ev.onPause?.()));
    el.addEventListener("ended", live(() => ev.onEnded?.()));
    el.addEventListener("waiting", live(() => ev.onWaiting?.()));
    el.addEventListener("playing", live(() => ev.onPlaying?.()));
  };
  bind(cur); bind(spare);

  return {
    load(url, autoplay) {
      const target = abs(url);
      if (spare.src === target && target) {
        /* Согретый трек уже здесь — меняем элементы местами. Старый глушим
           и освобождаем: держать в памяти два потока незачем. */
        const old = cur;
        cur = spare; spare = old;
        spare.pause();
        spare.removeAttribute("src");
        spare.load();
        cur.currentTime = 0;
        cur.playbackRate = rate;
        if (autoplay) cur.play().catch(() => { /* автоплей ждёт жеста */ });
        ev.onDuration?.(cur.duration || 0);
        return;
      }
      if (cur.src !== target) cur.src = target;
      cur.playbackRate = rate;
      if (autoplay) cur.play().catch(() => { /* автоплей ждёт жеста */ });
    },
    prime(url) {
      const target = abs(url);
      if (!target || target === abs(cur.src) || spare.src === target) return;
      spare.preload = "auto";
      spare.src = target;
      spare.load();
    },
    play() { return cur.play(); },
    pause() { cur.pause(); },
    seek(sec) { if (isFinite(sec)) cur.currentTime = Math.max(0, sec); },
    setRate(r) { rate = r; cur.playbackRate = r; },
    get currentTime() { return cur.currentTime; },
    get duration() { return isFinite(cur.duration) ? cur.duration : 0; },
    get paused() { return cur.paused; },
    destroy() {
      for (const el of [cur, spare]) { el.pause(); el.removeAttribute("src"); el.load(); }
    },
  };
}
