/* /music — плеер. Воспроизведение симулируется тактовым таймером (аудио-тег
   в этой оболочке не используется вовсе): очередь, транспорт, перемотка,
   повтор, перемешивание, бесконечный автоплей, AutoMix, караоке-строки. */
import React, { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Cover, E, I, Menu, MItem, fmt, menuAt, shuffled, useExit } from "./core";
import { LYRICS, QUEUE0, STATION_NAME, Song } from "./data";

type P = {
  q: Song[]; idx: number; playing: boolean; pos: number;
  shuffle: boolean; repeat: 0 | 1 | 2; autoplay: boolean; automix: boolean; vol: number;
  source: string;
};
type Api = P & {
  cur: Song | null;
  playList: (songs: Song[], idx: number, source?: string) => void;
  toggle: () => void; next: () => void; prev: () => void;
  seek: (sec: number) => void; setVol: (v: number) => void;
  toggleShuffle: () => void; cycleRepeat: () => void;
  toggleAutoplay: () => void; toggleAutomix: () => void;
};
const Ctx = createContext<Api | null>(null);
export const usePlayer = () => useContext(Ctx)!;

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [st, set] = useState<P>({
    q: QUEUE0, idx: 0, playing: false, pos: 0,
    shuffle: false, repeat: 0, autoplay: true, automix: false, vol: .62,
    /* AutoMix выключен при старте. Два довода. 📐 IMG_1955: все четыре капсулы
       одной яркости (~72 при фоне 53.7) — горящих среди них нет. И подсказка
       «AutoMix is On» показывается ТОЛЬКО при включении: при значении true она
       не показалась бы никогда, то есть была бы мёртвым кодом. */
    source: STATION_NAME,
  });
  const ref = useRef(st); ref.current = st;

  /* тактовый таймер вместо аудио */
  useEffect(() => {
    if (!st.playing) return;
    let last = Date.now();
    const t = window.setInterval(() => {
      const now = Date.now(); const dt = (now - last) / 1000; last = now;
      const s = ref.current; const cur = s.q[s.idx];
      if (!cur) return;
      let pos = s.pos + dt;
      if (pos >= cur.d) {
        if (s.repeat === 1) { set({ ...s, pos: 0 }); return; }
        if (s.idx + 1 < s.q.length) { set({ ...s, idx: s.idx + 1, pos: 0 }); return; }
        if (s.repeat === 2 || s.autoplay) { set({ ...s, idx: 0, pos: 0 }); return; }
        set({ ...s, pos: cur.d, playing: false }); return;
      }
      set({ ...s, pos });
    }, 250);
    return () => window.clearInterval(t);
  }, [st.playing]);

  const api: Api = {
    ...st,
    cur: st.q[st.idx] ?? null,
    playList: (songs, idx, source) => set((s) => ({
      ...s, q: s.shuffle ? [songs[idx], ...shuffled(songs.filter((_, i) => i !== idx))] : songs,
      idx: s.shuffle ? 0 : idx, pos: 0, playing: true, source: source ?? s.source,
    })),
    toggle: () => set((s) => ({ ...s, playing: !s.playing && s.q.length > 0 })),
    next: () => set((s) => ({ ...s, idx: (s.idx + 1) % Math.max(1, s.q.length), pos: 0 })),
    prev: () => set((s) => (s.pos > 4 ? { ...s, pos: 0 } : { ...s, idx: (s.idx - 1 + s.q.length) % Math.max(1, s.q.length), pos: 0 })),
    seek: (sec) => set((s) => ({ ...s, pos: Math.max(0, Math.min(sec, (s.q[s.idx]?.d ?? 1) - .1)) })),
    setVol: (v) => set((s) => ({ ...s, vol: Math.max(0, Math.min(1, v)) })),
    toggleShuffle: () => set((s) => ({ ...s, shuffle: !s.shuffle })),
    cycleRepeat: () => set((s) => ({ ...s, repeat: ((s.repeat + 1) % 3) as 0 | 1 | 2 })),
    toggleAutoplay: () => set((s) => ({ ...s, autoplay: !s.autoplay })),
    toggleAutomix: () => set((s) => ({ ...s, automix: !s.automix })),
  };
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

/* Бегущая строка: мерим чернила один раз (key=t перемонтирует на смене трека),
   плывёт только то, что не влезло — LAW_MUSIC §5.11. */
function Marq({ t, cls }: { t: string; cls: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const need = el.scrollWidth - el.clientWidth;
    if (need > 8) setW(el.scrollWidth + 40);
  }, [t]);
  return (
    <div ref={ref} className={cls + (w ? " mq" : "")}>
      {w ? (
        <div className="amx-marq" style={{ ["--marq-w" as never]: `${w}px` as never, ["--marq-d" as never]: `${Math.max(6, w / 28)}s` as never }}>
          <span>{t}</span><span aria-hidden>{t}</span>
        </div>
      ) : t}
    </div>
  );
}

/* ── Мини-плеер (капсула дока) ────────────────────────────────────────── */
export function MiniPlayer({ onOpen }: { onOpen: () => void }) {
  const p = usePlayer();
  const cur = p.cur;
  return (
    <div className="amx-mini" data-amx-mini onClick={() => cur && onOpen()}>
      {cur && p.playing !== undefined && (p.playing || p.pos > 0) ? (
        <Cover id={cur.id} cls="m-art sm" />
      ) : (
        <div className="m-art ph">{I.note({ s: 20 })}</div>
      )}
      <div className="m-c">
        {cur && (p.playing || p.pos > 0) ? (
          <>
            <Marq key={cur.id} t={cur.t} cls="m-t" />
            <div className="m-s">{cur.a}</div>
          </>
        ) : (
          <div className="m-t np">Not Playing</div>
        )}
      </div>
      <button className="m-b" onClick={(e) => { e.stopPropagation(); p.toggle(); }}>
        <span className="ic-swap" key={p.playing ? 1 : 0}>{p.playing ? I.stopSq({ s: 24 }) : I.play({ s: 24 })}</span>
      </button>
      <button className={"m-b" + (p.playing ? "" : " dim")} onClick={(e) => { e.stopPropagation(); p.next(); }}>
        {I.next({ s: 26 })}
      </button>
    </div>
  );
}

/* ── Глифы транспорта — 📐 pl_q15 y650 и 12.5-кадр y634 ─────────────────
   prev/next: два клина по 16 pt, зазор 3.7 (общая 35.7; высота 25 — ⚠ хорда
   14.7 снята на x80, основание не снято). Пауза: палки 12.7 × 39.7, зазор 4.9.
   Play: клин 30.3 × 39.7. Всё白ое #FFF. */
function TrSkip({ back }: { back?: boolean }) {
  return (
    <svg width="35.7" height="25" viewBox="0 0 35.7 25" fill="#fff"
      style={back ? { transform: "scaleX(-1)" } : undefined}>
      <path d="M0 0 L16 12.5 L0 25 Z" />
      <path d="M19.7 0 L35.7 12.5 L19.7 25 Z" />
    </svg>
  );
}
function TrPause() {
  return (
    <svg width="30.3" height="39.7" viewBox="0 0 30.3 39.7" fill="#fff">
      <rect x="0" y="0" width="12.7" height="39.7" rx="2.6" />
      <rect x="17.6" y="0" width="12.7" height="39.7" rx="2.6" />
    </svg>
  );
}
function TrPlay() {
  return (
    <svg width="30.3" height="39.7" viewBox="0 0 30.3 39.7" fill="#fff">
      <path d="M2.2 3.1 C2.2 1 4.4 -0.3 6.2 .8 L28.4 17.6 c1.6 1 1.6 3.5 0 4.5 L6.2 38.9 C4.4 40 2.2 38.7 2.2 36.6 Z" />
    </svg>
  );
}

/* ── Полноэкранный плеер ──────────────────────────────────────────────── */
export function FullPlayer({ open, onClose, onFav, favOn }: {
  open: boolean; onClose: () => void; onFav: (s: Song) => void; favOn: (s: Song) => boolean;
}) {
  const p = usePlayer();
  /* ГЛАВНЫЙ ВИД — ОБЛОЖКА. У Apple мини-плеер раскрывается в большую обложку
     (📐 IMG_1950/1951: 345×345 при врезке 24); лирика и очередь — ОТДЕЛЬНЫЕ
     режимы, куда переходят кнопками внизу. Клон открывался сразу в лирику и
     большой обложки не показывал ни разу. */
  const [view, setViewRaw] = useState<"art" | "lyrics" | "queue">("art");
  const [outV, setOutV] = useState<"art" | "lyrics" | "queue" | null>(null);
  const outTm = useRef<number | null>(null);
  const setView = (v: "art" | "lyrics" | "queue") => {
    if (v === view) return;
    if (outTm.current) window.clearTimeout(outTm.current);
    setOutV(view); setViewRaw(v);
    outTm.current = window.setTimeout(() => setOutV(null), 330);
  };
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [outSheet, setOutSheet] = useState(false);
  const [skD, setSkD] = useState(false);   /* палец на полосе времени — §5.7 */
  const [vlD, setVlD] = useState(false);
  const [tip, setTip] = useState(false);
  const tipSeen = useRef(false);
  const [drag, setDrag] = useState(0);
  const dragFrom = useRef<number | null>(null);
  const lyrRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [morphing, setMorphing] = useState(true);
  const closing = useRef(false);
  const ghostRef = useRef<HTMLDivElement | null>(null);

  /* 🎞 Кривая раскрытия, снятая с open_013–047 (60 fps): ~56 % пути к 50 мс,
     ~81 % к 167 мс, дальше экспоненциальный хвост ×0.78/кадр до ~560 мс.
     Перелёта нет — критическое демпфирование. */
  const OPEN_EASE = "linear(0, 0.28 8%, 0.56 17%, 0.66 20%, 0.81 30%, 0.9 36%, 0.94 42%, 0.965 50%, 0.978 57%, 0.988 66%, 0.994 78%, 0.998 89%, 1)";
  const OPEN_MS = 560;
  const CLOSE_EASE = "cubic-bezier(.32,.72,0,1)";  /* 🎞 §5.2: 383 мс ровного выбега */
  const CLOSE_MS = 400;
  const noMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const rects = () => {
    const root = rootRef.current; if (!root) return null;
    const frame = root.closest(".amx-frame") as HTMLElement | null; if (!frame) return null;
    const fr = frame.getBoundingClientRect();
    const mini = frame.querySelector("[data-amx-mini]") as HTMLElement | null;
    const mArt = mini?.querySelector(".m-art") as HTMLElement | null;
    const art = root.querySelector(".pl-art.morph") as HTMLElement | null;
    return { frame, fr, mini: mini?.getBoundingClientRect() ?? null, mArt: mArt?.getBoundingClientRect() ?? null, artEl: art };
  };

  /* Призрак обложки живёт вне масштабируемой карточки */
  const anim = (el: Element, kf: Keyframe[], opt: KeyframeAnimationOptions) => {
    try { return el.animate(kf, opt); }
    catch { return el.animate(kf, { ...opt, easing: "cubic-bezier(.2,.9,.25,1)" }); }
  };
  const flyGhost = (from: DOMRect, to: DOMRect, fr: DOMRect, ease: string, ms: number, rFrom: number, rTo: number) => {
    const g = ghostRef.current; if (!g) return null;
    g.style.left = `${to.left - fr.left}px`; g.style.top = `${to.top - fr.top}px`;
    g.style.width = `${to.width}px`; g.style.height = `${to.height}px`;
    g.style.display = "block";
    const s = from.width / to.width;
    const a = anim(g, [
      { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${s})`, borderRadius: `${rFrom / s}px` },
      { transform: "none", borderRadius: `${rTo}px` },
    ], { duration: ms, easing: ease, fill: "both" });
    a.finished.then(() => { g.style.display = "none"; }).catch(() => {});
    return a;
  };

  /* Открытие: карточка растёт из прямоугольника пилюли */
  useLayoutEffect(() => {
    if (!open) { setMorphing(false); return; }
    closing.current = false;
    const R = rects(); const root = rootRef.current;
    if (!root) return;
    if (!R || !R.mini || noMotion()) { setMorphing(false); return; }
    setMorphing(true);
    const { fr, mini, mArt, artEl } = R;
    const sx = mini.width / fr.width, sy = mini.height / fr.height;
    const tx = mini.left - fr.left, ty = mini.top - fr.top;
    const a = anim(root, [
      { transform: `translate(${tx}px, ${ty}px) scale(${sx}, ${sy})`, borderRadius: `${24 / sx}px / ${24 / sy}px` },
      { transform: "none", borderRadius: "0px" },
    ], { duration: OPEN_MS, easing: OPEN_EASE });
    const inn = root.querySelector(".pl-in") as HTMLElement | null;
    inn?.animate([
      { opacity: 0, offset: 0 }, { opacity: 0, offset: 0.4 }, { opacity: 1, offset: 0.78 }, { opacity: 1, offset: 1 },
    ], { duration: OPEN_MS, easing: "linear" });
    let ga: Animation | null = null;
    if (mArt && artEl) ga = flyGhost(mArt, artEl.getBoundingClientRect(), fr, OPEN_EASE, OPEN_MS, 7, 12);
    a.finished.then(() => setMorphing(false)).catch(() => setMorphing(false));
    return () => { a.cancel(); ga?.cancel(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* Закрытие: обратный полёт в пилюлю из текущего положения (учитывая драг) */
  const requestCloseRef = useRef<() => void>(() => {});
  const requestClose = () => {
    if (closing.current) return;
    closing.current = true;
    const R = rects(); const root = rootRef.current;
    if (!root || !R || !R.mini || noMotion()) { onClose(); return; }
    setMorphing(true);
    const { fr, mini, mArt, artEl } = R;
    const d = drag;
    const sx = mini.width / fr.width, sy = mini.height / fr.height;
    const tx = mini.left - fr.left, ty = mini.top - fr.top;
    const a = anim(root, [
      { transform: `translateY(${d}px)`, borderRadius: d > 4 ? "40px" : "0px" },
      { transform: `translate(${tx}px, ${ty}px) scale(${sx}, ${sy})`, borderRadius: `${24 / sx}px / ${24 / sy}px` },
    ], { duration: CLOSE_MS, easing: CLOSE_EASE, fill: "forwards" });
    const inn = root.querySelector(".pl-in") as HTMLElement | null;
    inn?.animate([
      { opacity: 1, offset: 0 }, { opacity: 0, offset: 0.35 }, { opacity: 0, offset: 1 },
    ], { duration: CLOSE_MS, easing: "linear", fill: "forwards" });
    if (mArt && artEl) {
      const ar = artEl.getBoundingClientRect();
      flyGhost(ar, mArt, fr, CLOSE_EASE, CLOSE_MS, 12, 7);
    }
    a.finished.then(() => onClose()).catch(() => onClose());
  };
  requestCloseRef.current = requestClose;

  /* Esc закрывает плеер — на десктопе свайпа нет, а граббер мал */
  const layered = useRef(false);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !layered.current) requestCloseRef.current(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);

  useEffect(() => { if (open) setDrag(0); }, [open]);

  const cur = p.cur;
  const lineIdx = useMemo(() => {
    let k = 0;
    for (let i = 0; i < LYRICS.length; i++) if (p.pos >= LYRICS[i].at) k = i;
    return k;
  }, [p.pos]);
  useEffect(() => {
    const el = lyrRef.current?.children[lineIdx + 1] as HTMLElement | undefined; // +1: точки-лоадер
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [lineIdx, view]);
  /* прокрутка не трогает другие режимы: элемента там нет */

  if (!open || !cur) return null;

  const onTS = (e: React.TouchEvent) => { dragFrom.current = e.touches[0].clientY; };
  const onTM = (e: React.TouchEvent) => {
    if (dragFrom.current == null) return;
    const d = e.touches[0].clientY - dragFrom.current;
    if (d > 0) setDrag(d);
  };
  const onTE = () => {
    if (drag > 130) requestClose(); else setDrag(0);
    dragFrom.current = null;
  };

  const seekFromEvent = (e: React.PointerEvent, cb: (r: number) => void, flag?: (on: boolean) => void) => {
    const el = e.currentTarget as HTMLElement;
    flag?.(true);
    const move = (ev: PointerEvent) => {
      const r = el.getBoundingClientRect();
      cb(Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)));
    };
    move(e.nativeEvent);
    const upH = () => { flag?.(false); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", upH); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", upH);
  };

  const favNow = favOn(cur);
  const menuItems: MItem[] = [
    { label: "Add to a Playlist", icon: I.listAdd({ s: 22 }), onTap: () => window.dispatchEvent(new CustomEvent("amx:add-to-pl", { detail: cur.id })) },
    { sep: true },
    { label: "Create Station", icon: I.station({ s: 22 }) },
    { sep: true },
    { label: "Go to Album", sub: `${cur.t} - Single`, icon: I.album({ s: 22 }) },
    { label: "Go to Artist", sub: cur.a, icon: I.artist({ s: 22 }) },
    { sep: true },
    { label: "View Credits", icon: I.info({ s: 22 }) },
    { label: "Share Lyrics", icon: I.quote({ s: 22 }) },
    { sep: true, thick: true },
    { label: "Report a Concern", icon: I.report({ s: 22 }) },
  ];

  const upcoming = p.q.slice(p.idx + 1);
  layered.current = !!menu || outSheet;

  return (<>
    <div ref={rootRef} className={"amx-pl" + (p.playing ? "" : " paused") + (morphing ? " morphing" : "")}
      style={{
        transform: drag > 0 ? `translateY(${drag}px)` : undefined,
        borderRadius: drag > 4 ? 40 : 0,
      }}>
      {/* Фон плеера — тёплый золотой сумрак, ОДИН на все записи. Прежде он
          выводился из id обложки и менялся от песни к песне; при едином
          белом-с-золотом артворке такая пестрота потеряла основание. */}
      <div className="pl-bg" style={{
        background: "linear-gradient(178deg, #4A3C18 0%, #2E2611 46%, #16130A 100%)",
      }} />
      <div className="pl-in">
        <div onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}>
          <button className="pl-grab" onClick={onClose} aria-label="close" />
          {view === "art" ? null : (
          <div className="pl-head pl-head-anim" key={view}>
            <Cover id={cur.id} cls="p-art" />
            <div style={{ minWidth: 0 }}>
              <div className="p-t">{cur.t}</div>
              <div className="p-s">{cur.a}</div>
            </div>
            <div className="hb">
              <button className="amx-cir" onClick={() => onFav(cur)}
                style={favNow ? { color: "var(--red)" } : undefined}>{favNow ? I.starFill({ s: 17 }) : I.star({ s: 17 })}</button>
              <button className="amx-cir" onClick={(e) => setMenu(menuAt(e))}>{I.dots({ s: 18 })}</button>
            </div>
          </div>
          )}
        </div>

        {/* Главный вид прижат ВВЕРХ: 📐 IMG_1950 обложка начинается высоко
            (91.5), а пустота копится ВНИЗУ, до полосы времени. Центрирование
            делило зазор поровну и уводило подписи на середину экрана.
            Смена вида — два слоя: исходящий доигрывает выход (🎞 §5.3),
            обложка сжимается к углу в миниатюру шапки, а не исчезает. */}
        <div className="pl-mid">
          {(outV ? [outV, view] : [view]).map((vv, li, arr) => {
            const cls = "v" + (arr.length === 2 ? (li === 0 ? " out" : " in") : "");
            return (
          <div className={cls} key={vv}>
          {vv === "art" ? (
            <div style={{ position: "absolute", inset: 0, display: "flex",
              flexDirection: "column", justifyContent: "flex-start", padding: "0 4px" }}>
              <Cover id={cur.id} cls="pl-art morph" />
              <div className="pl-meta">
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="mt">{cur.t}</div>
                  <div className="ms">{cur.a}</div>
                </div>
                <button className="amx-cir" onClick={(e) => setMenu(menuAt(e))}>{I.dots({ s: 17 })}</button>
              </div>
            </div>
          ) : vv === "lyrics" ? (
            <>
              <div ref={li === arr.length - 1 ? lyrRef : undefined} className="amx-lyr" style={{ position: "absolute", inset: 0, overflowY: "auto" }}>
                <div className="pl-dots"><i /><i /><i /></div>
                {LYRICS.map((l, i) => (
                  <div key={i} className={"ln" + (i === lineIdx ? " on" : i === lineIdx + 1 ? " next" : "")}
                    onClick={() => p.seek(l.at)}>{l.s}</div>
                ))}
                <div style={{ height: 90 }} />
              </div>
              <button className="amx-kara">{I.karaoke({ s: 26 })}</button>
            </>
          ) : (
            <div style={{ position: "absolute", inset: 0, overflowY: "auto" }}>
              <div className="pl-tog">
                <button className={p.shuffle ? "on" : ""} onClick={p.toggleShuffle}>{I.shuffle({ s: 22 })}</button>
                <button className={p.repeat ? "on" : ""} onClick={p.cycleRepeat}>{I.repeat({ s: 22 })}{p.repeat === 1 ? <span style={{ fontSize: 11, fontWeight: 700, marginLeft: 2 }}>1</span> : null}</button>
                <button className={p.autoplay ? "on" : ""} onClick={p.toggleAutoplay}>{I.infin({ s: 24 })}</button>
                <button className={p.automix ? "on" : ""} onClick={() => {
                  const was = p.automix; p.toggleAutomix();
                  if (!was && !tipSeen.current) { tipSeen.current = true; setTip(true); window.setTimeout(() => setTip(false), 7000); }
                }}>{I.automix({ s: 24 })}</button>
              </div>
              {tip ? (
                <div className="amx-tip">
                  {I.automix({ s: 26 })}
                  <div style={{ minWidth: 0 }}>
                    <div className="tt">AutoMix is On</div>
                    <div className="td">Songs will seamlessly transition from one into the next.</div>
                  </div>
                  <button className="cx" onClick={() => setTip(false)}>{I.x({ s: 16 })}</button>
                </div>
              ) : null}
              <div className="amx-q">
                <div className="q-h">Continue Playing</div>
                <div className="q-s">{p.source}</div>
                {(upcoming.length ? upcoming : p.q).map((s, i) => (
                  <div className="q-row" key={s.id + i} onClick={() => p.playList(p.q, p.q.indexOf(s), p.source)}>
                    <Cover id={s.id} cls="sm" />
                    <div style={{ minWidth: 0 }}>
                      <div className="q-t"><span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{s.t}</span>{s.e ? <E /> : null}</div>
                      <div className="q-a">{s.a}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          </div>
            );
          })}
        </div>

        <div className={"pl-prog" + (skD ? " drag" : "")} onPointerDown={(e) => seekFromEvent(e, (r) => p.seek(r * cur.d), setSkD)}>
          <div className="pl-bar"><i style={{ width: `${(p.pos / cur.d) * 100}%` }} /></div>
          <div className="pl-times"><span>{fmt(p.pos)}</span><span>−{fmt(Math.max(0, cur.d - p.pos))}</span></div>
        </div>
        <div className="pl-trans">
          <button onClick={p.prev}>{I.prev({ s: 44 })}</button>
          {/* 📐 знак 38.0: бокс 65 = 38 × 24/14 */}
          <button onClick={p.toggle}><span className="ic-swap" key={p.playing ? 1 : 0}>{p.playing ? I.pause({ s: 52 }) : I.play({ s: 65 })}</span></button>
          <button onClick={p.next}>{I.next({ s: 44 })}</button>
        </div>
        <div className={"pl-vol" + (vlD ? " drag" : "")} onPointerDown={(e) => seekFromEvent(e, (r) => p.setVol(r), setVlD)}>
          {I.spkLo({ s: 18 })}
          <div className="pl-vbar"><i style={{ width: `${p.vol * 100}%` }} /></div>
          {I.spkHi({ s: 20 })}
        </div>
        <div className="pl-brow">
          {/* Повторное нажатие возвращает к обложке — как у Apple */}
          <button className={view === "lyrics" ? "on" : ""}
            onClick={() => setView(view === "lyrics" ? "art" : "lyrics")}>{I.quote({ s: 24 })}</button>
          <button onClick={() => setOutSheet(true)}>{I.airplay({ s: 24 })}</button>
          <button className={view === "queue" ? "on" : ""}
            onClick={() => setView(view === "queue" ? "art" : "queue")}>{I.queue({ s: 24 })}</button>
        </div>
      </div>

      {outSheet ? <OutputSheet onClose={() => setOutSheet(false)} /> : null}

      {menu ? (
        <Menu at={menu}
          quick={[
            { icon: I.plus({ s: 24 }), label: "Add" },
            { icon: favNow ? I.starF({ s: 24 }) : I.star({ s: 24 }), label: "Favourite", onTap: () => onFav(cur) },
            { icon: I.share({ s: 24 }), label: "Share" },
          ]}
          items={menuItems} onClose={() => setMenu(null)} />
      ) : null}
    </div>
    {/* Призрак обложки для морфа пилюля⇄плеер (🎞 §5.2) */}
    <div ref={ghostRef} className="amx-ghostart" style={{ display: "none" }}>
      <Cover id={cur.id} cls="amx-ghc" />
    </div>
  </>);
}

/* ── Шторка вывода звука (⚠ §4.5: кадр не разобран; типовая нижняя шторка,
   R 40 по 📐 IMG_1983). Выбор устройства живой: отметка переезжает. ───── */
function OutputSheet({ onClose }: { onClose: () => void }) {
  const ex = useExit(onClose, 310);
  const [dev, setDev] = useState<"iphone" | "room">("iphone");
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") ex.close(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className={"amx-dim" + (ex.out ? " out" : "")} style={{ background: "rgba(0,0,0,.32)", zIndex: 57 }} onClick={ex.close}>
      <div className={"amx-osheet" + (ex.out ? " out" : "")} onClick={(e) => e.stopPropagation()}>
        <div className="og" />
        <div className="ot">Speakers &amp; TVs</div>
        <button className="or" onClick={() => setDev("iphone")}>
          {I.iphone({ s: 24 })}<span>iPhone</span>
          {dev === "iphone" ? <span className="ck">{I.check({ s: 20 })}</span> : null}
        </button>
        <button className="or" onClick={() => setDev("room")}>
          {I.airplay({ s: 24 })}<span>Living Room</span>
          {dev === "room" ? <span className="ck">{I.check({ s: 20 })}</span> : null}
        </button>
      </div>
    </div>
  );
}
