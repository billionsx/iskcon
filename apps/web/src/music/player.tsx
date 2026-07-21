/* /music — плеер. Воспроизведение симулируется тактовым таймером (аудио-тег
   в этой оболочке не используется вовсе): очередь, транспорт, перемотка,
   повтор, перемешивание, бесконечный автоплей, AutoMix, караоке-строки. */
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Cover, E, I, Menu, MItem, fmt, hueOf, menuAt, shuffled } from "./core";
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
    shuffle: false, repeat: 0, autoplay: true, automix: true, vol: .62,
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

/* ── Мини-плеер (капсула дока) ────────────────────────────────────────── */
export function MiniPlayer({ onOpen }: { onOpen: () => void }) {
  const p = usePlayer();
  const cur = p.cur;
  return (
    <div className="amx-mini" onClick={() => cur && onOpen()}>
      {cur && p.playing !== undefined && (p.playing || p.pos > 0) ? (
        <Cover id={cur.id} cls="m-art sm" />
      ) : (
        <div className="m-art ph">{I.note({ s: 20 })}</div>
      )}
      <div className="m-c">
        {cur && (p.playing || p.pos > 0) ? (
          <>
            <div className="m-t">{cur.t}</div>
            <div className="m-s">{cur.a}</div>
          </>
        ) : (
          <div className="m-t np">Not Playing</div>
        )}
      </div>
      <button className="m-b" onClick={(e) => { e.stopPropagation(); p.toggle(); }}>
        {p.playing ? I.stopSq({ s: 24 }) : I.play({ s: 24 })}
      </button>
      <button className={"m-b" + (p.playing ? "" : " dim")} onClick={(e) => { e.stopPropagation(); p.next(); }}>
        {I.next({ s: 26 })}
      </button>
    </div>
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
  const [view, setView] = useState<"art" | "lyrics" | "queue">("art");
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [tip, setTip] = useState(false);
  const tipSeen = useRef(false);
  const [drag, setDrag] = useState(0);
  const dragFrom = useRef<number | null>(null);
  const [entered, setEntered] = useState(false);
  const lyrRef = useRef<HTMLDivElement | null>(null);

  /* Esc закрывает плеер — на десктопе свайпа нет, а граббер мал */
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);

  useEffect(() => {
    if (open) { setDrag(0); requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true))); }
    else setEntered(false);
  }, [open]);

  const cur = p.cur;
  const h = cur ? hueOf(cur.id) : 40;
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
    if (drag > 130) onClose(); else setDrag(0);
    dragFrom.current = null;
  };

  const seekFromEvent = (e: React.PointerEvent, cb: (r: number) => void) => {
    const el = e.currentTarget as HTMLElement;
    const move = (ev: PointerEvent) => {
      const r = el.getBoundingClientRect();
      cb(Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)));
    };
    move(e.nativeEvent);
    const upH = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", upH); };
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

  return (
    <div className={"amx-pl" + (entered && drag === 0 ? "" : " ")}
      style={{
        transform: entered ? `translateY(${drag}px)` : "translateY(104%)",
        borderRadius: drag > 4 || !entered ? 40 : 0,
        transition: dragFrom.current != null ? "none" : undefined,
      }}>
      <div className="pl-bg" style={{
        background: `linear-gradient(178deg, hsl(${h} 34% 38%) 0%, hsl(${h} 36% 22%) 46%, hsl(${(h + 14) % 360} 34% 10%) 100%)`,
      }} />
      <div className="pl-in">
        <div onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}>
          <button className="pl-grab" onClick={onClose} aria-label="close" />
          {view === "art" ? null : (
          <div className="pl-head">
            <Cover id={cur.id} cls="p-art" />
            <div style={{ minWidth: 0 }}>
              <div className="p-t">{cur.t}</div>
              <div className="p-s">{cur.a}</div>
            </div>
            <button className="amx-cir" onClick={(e) => setMenu(menuAt(e))}>{I.dots({ s: 22 })}</button>
          </div>
          )}
        </div>

        <div className="pl-mid">
          {/* Главный вид прижат ВВЕРХ: 📐 IMG_1950 обложка начинается высоко
              (91.5), а пустота копится ВНИЗУ, до полосы времени. Центрирование
              делило зазор поровну и уводило подписи на середину экрана. */}
          {view === "art" ? (
            <div style={{ position: "absolute", inset: 0, display: "flex",
              flexDirection: "column", justifyContent: "flex-start", padding: "0 4px" }}>
              <Cover id={cur.id} cls="pl-art" />
              <div className="pl-meta">
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="mt">{cur.t}</div>
                  <div className="ms">{cur.a}</div>
                </div>
                <button className="amx-cir" onClick={(e) => setMenu(menuAt(e))}>{I.dots({ s: 17 })}</button>
              </div>
            </div>
          ) : view === "lyrics" ? (
            <>
              <div ref={lyrRef} className="amx-lyr" style={{ position: "absolute", inset: 0, overflowY: "auto" }}>
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

        <div className="pl-prog" onPointerDown={(e) => seekFromEvent(e, (r) => p.seek(r * cur.d))}>
          <div className="pl-bar"><i style={{ width: `${(p.pos / cur.d) * 100}%` }} /></div>
          <div className="pl-times"><span>{fmt(p.pos)}</span><span>−{fmt(Math.max(0, cur.d - p.pos))}</span></div>
        </div>
        <div className="pl-trans">
          <button onClick={p.prev}>{I.prev({ s: 44 })}</button>
          <button onClick={p.toggle}>{p.playing ? I.pause({ s: 48 }) : I.play({ s: 48 })}</button>
          <button onClick={p.next}>{I.next({ s: 44 })}</button>
        </div>
        <div className="pl-vol" onPointerDown={(e) => seekFromEvent(e, (r) => p.setVol(r))}>
          {I.spkLo({ s: 18 })}
          <div className="pl-vbar"><i style={{ width: `${p.vol * 100}%` }} /></div>
          {I.spkHi({ s: 20 })}
        </div>
        <div className="pl-brow">
          {/* Повторное нажатие возвращает к обложке — как у Apple */}
          <button className={view === "lyrics" ? "on" : ""}
            onClick={() => setView(view === "lyrics" ? "art" : "lyrics")}>{I.quote({ s: 24 })}</button>
          <button>{I.airplay({ s: 24 })}</button>
          <button className={view === "queue" ? "on" : ""}
            onClick={() => setView(view === "queue" ? "art" : "queue")}>{I.queue({ s: 24 })}</button>
        </div>
      </div>

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
  );
}
