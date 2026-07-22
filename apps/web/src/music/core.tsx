/* /music — ядро: обложка-логотип, набор SF-иконок, поповер-меню, ряды, полки,
   локальное хранилище (плейлисты · избранное · недавние запросы). */
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Song } from "./data";

/* ── Обложка: золотой знак ИСККОН на белом поле ───────────────────────────
   ЕДИНЫЙ СТИЛЬ (распоряжение основателя 21.07.2026). Цвет больше НЕ выводится
   из id: обложки были все разные, и экран рябил. Поле, знак и его размер
   заданы в CSS одним правилом — здесь остаётся только разметка. */
export function Cover({ cls, style, label, wm, brand, onClick, children }: {
  id?: string; cls?: string; style?: React.CSSProperties;
  label?: string; wm?: boolean; brand?: boolean; onClick?: () => void; children?: React.ReactNode;
}) {
  return (
    <div className={"amx-cov " + (cls || "")} style={style} onClick={onClick}>
      {wm ? <div className="wm" /> : <div className="mk" />}
      {brand ? <div className="brand">Music</div> : null}
      {label ? <div className="lab">{label}</div> : null}
      {children}
    </div>
  );
}

/* ── Иконки (упрощённые SF-глифы) ─────────────────────────────────────── */
type IcP = { s?: number; w?: number };
const Sv = ({ s = 24, vb = 24, children, w }: { s?: number; vb?: number; children: React.ReactNode; w?: number }) => (
  <svg width={s} height={s} viewBox={`0 0 ${vb} ${vb}`} fill="none" stroke="currentColor"
    strokeWidth={w ?? 0} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>{children}</svg>
);
export const I = {
  house: ({ s }: IcP = {}) => <Sv s={s}><path fill="currentColor" stroke="none" d="M12 3.6 4 10.7V19a1.6 1.6 0 0 0 1.6 1.6H9.6V15h4.8v5.6H18.4A1.6 1.6 0 0 0 20 19v-8.3Z" /></Sv>,
  grid: ({ s }: IcP = {}) => <Sv s={s}>{[[4, 4], [13.2, 4], [4, 13.2], [13.2, 13.2]].map(([x, y], i) => <rect key={i} x={x} y={y} width="6.8" height="6.8" rx="2" fill="currentColor" stroke="none" />)}</Sv>,
  radio: ({ s }: IcP = {}) => <Sv s={s} w={1.9}><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" /><path d="M8.6 8.6a4.8 4.8 0 0 0 0 6.8M15.4 8.6a4.8 4.8 0 0 1 0 6.8M6 6a8.5 8.5 0 0 0 0 12M18 6a8.5 8.5 0 0 1 0 12" /></Sv>,
  lib: ({ s }: IcP = {}) => <Sv s={s} w={1.9}><path d="M7.4 2.8h9.2M5.6 5.6h12.8" /><path fill="currentColor" stroke="none" fillRule="evenodd" d="M7.6 8h8.8A3.1 3.1 0 0 1 19.5 11.1v7.2a3.1 3.1 0 0 1-3.1 3.1H7.6a3.1 3.1 0 0 1-3.1-3.1v-7.2A3.1 3.1 0 0 1 7.6 8Zm3.6 2.9v4.6a2 2 0 1 0 1.2 1.83V13.2l3.1-.95v2.4a2 2 0 1 0 1.2 1.83V9.5Z" /></Sv>,
  search: ({ s, w }: IcP = {}) => <Sv s={s} w={w ?? 2.1}><circle cx="10.8" cy="10.8" r="5.7" /><path d="M15.1 15.1 20 20" /></Sv>,
  mic: ({ s }: IcP = {}) => <Sv s={s} w={1.8}><rect x="9.3" y="2.8" width="5.4" height="10.4" rx="2.7" fill="currentColor" stroke="none" /><path d="M6.2 11.2a5.8 5.8 0 0 0 11.6 0M12 17.4v3M8.8 20.6h6.4" /></Sv>,
  dots: ({ s }: IcP = {}) => <Sv s={s}>{[5.4, 12, 18.6].map((x) => <circle key={x} cx={x} cy="12" r="1.9" fill="currentColor" stroke="none" />)}</Sv>,
  back: ({ s }: IcP = {}) => <Sv s={s} w={2.7}><path d="M14.6 4.8 7.6 12l7 7.2" /></Sv>,
  chev: ({ s, w }: IcP = {}) => <Sv s={s} w={w ?? 2.6}><path d="M9 5.4 15.7 12 9 18.6" /></Sv>,
  plus: ({ s, w }: IcP = {}) => <Sv s={s} w={w ?? 2}><path d="M12 4.8v14.4M4.8 12h14.4" /></Sv>,
  star: ({ s }: IcP = {}) => <Sv s={s} w={1.7}><path d="m12 3.6 2.5 5.4 5.9.6-4.4 4 1.2 5.8L12 16.4l-5.2 3 1.2-5.8-4.4-4 5.9-.6Z" /></Sv>,
  starF: ({ s }: IcP = {}) => <Sv s={s}><path fill="currentColor" stroke="none" d="m12 3.2 2.7 5.7 6.2.7-4.6 4.2 1.3 6.1L12 16.8l-5.6 3.1 1.3-6.1-4.6-4.2 6.2-.7Z" /></Sv>,
  share: ({ s }: IcP = {}) => <Sv s={s} w={1.9}><path d="M12 3.4v10.4M8.5 6.6 12 3.1l3.5 3.5" /><path d="M7.6 10.2H6.4A2.4 2.4 0 0 0 4 12.6v5.6a2.4 2.4 0 0 0 2.4 2.4h11.2a2.4 2.4 0 0 0 2.4-2.4v-5.6a2.4 2.4 0 0 0-2.4-2.4h-1.2" /></Sv>,
  listAdd: ({ s }: IcP = {}) => <Sv s={s} w={2}><path d="M4 6.4h10.4M4 11.4h10.4M4 16.4h6.4" /><path d="M17.8 12.6v6M14.8 15.6h6" /></Sv>,
  station: ({ s }: IcP = {}) => <Sv s={s} w={1.9}><path d="M4.6 12h5M7.1 9.5v5" /><path d="M13.4 7.8a5.7 5.7 0 0 1 0 8.4M16.4 5.2a9.4 9.4 0 0 1 0 13.6" /></Sv>,
  album: ({ s }: IcP = {}) => <Sv s={s} w={1.8}><rect x="4" y="4" width="16" height="16" rx="3.4" /><path fill="currentColor" stroke="none" d="M10.9 15.1V9.9l4.6-1.2v4.7a1.7 1.7 0 1 1-1-1.55V10l-2.6.7v4.9a1.7 1.7 0 1 1-1-1.55Z" /></Sv>,
  artist: ({ s }: IcP = {}) => <Sv s={s} w={1.8}><circle cx="12" cy="8" r="3.6" /><path d="M5 20.4c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6" /></Sv>,
  info: ({ s }: IcP = {}) => <Sv s={s} w={1.8}><circle cx="12" cy="12" r="8.4" /><circle cx="12" cy="8.1" r="1.15" fill="currentColor" stroke="none" /><path d="M12 11.3v5.4" strokeWidth="2" /></Sv>,
  quote: ({ s }: IcP = {}) => <Sv s={s} w={1.8}><path d="M4.4 6.6a2.8 2.8 0 0 1 2.8-2.8h9.6a2.8 2.8 0 0 1 2.8 2.8v6.2a2.8 2.8 0 0 1-2.8 2.8h-5.7l-4.1 3.5v-3.5h-.8a2.8 2.8 0 0 1-2.8-2.8Z" /><path fill="currentColor" stroke="none" d="M8.2 8h2v2.1l-1.1 1.6H7.7l1-1.6h-.5Zm4.9 0h2v2.1L14 11.7h-1.4l1-1.6h-.5Z" /></Sv>,
  airplay: ({ s }: IcP = {}) => <Sv s={s} w={1.8}><path d="M6.8 16.6H5.6A2.2 2.2 0 0 1 3.4 14.4V7.2A2.2 2.2 0 0 1 5.6 5h12.8a2.2 2.2 0 0 1 2.2 2.2v7.2a2.2 2.2 0 0 1-2.2 2.2h-1.2" /><path fill="currentColor" stroke="none" d="m12 13.6 5 6H7Z" /></Sv>,
  queue: ({ s }: IcP = {}) => <Sv s={s} w={2}><path d="M4 6.4h16M4 11.6h16M4 16.8h9.6" /></Sv>,
  shuffle: ({ s }: IcP = {}) => <Sv s={s} w={1.9}><path d="M4 7h2.9c1.6 0 2.6.7 3.6 2l3 4c1 1.3 2 2 3.6 2H20M4 15h2.9c1 0 1.8-.3 2.5-.9M20 7h-2.9c-1.1 0-1.9.3-2.6 1" /><path d="m17.6 4.6 2.6 2.4-2.6 2.4M17.6 12.6l2.6 2.4-2.6 2.4" /></Sv>,
  repeat: ({ s }: IcP = {}) => <Sv s={s} w={1.9}><path d="M6.8 7.4h8.4a4 4 0 0 1 4 4v.8M17.2 16.6H8.8a4 4 0 0 1-4-4v-.8" /><path d="M9.2 5 6.6 7.4 9.2 9.8M14.8 19l2.6-2.4-2.6-2.4" /></Sv>,
  infin: ({ s }: IcP = {}) => <Sv s={s} w={2}><path d="M7.3 15.5c-2 0-3.5-1.6-3.5-3.5s1.5-3.5 3.5-3.5c3.4 0 6-7 9.4-7" transform="translate(0 3.5) scale(1 .78)" opacity="0" /><path d="M7.2 15.4C5.3 15.4 3.8 13.9 3.8 12s1.5-3.4 3.4-3.4c3.3 0 6.3 6.8 9.6 6.8 1.9 0 3.4-1.5 3.4-3.4s-1.5-3.4-3.4-3.4c-3.3 0-6.3 6.8-9.6 6.8Z" /></Sv>,
  automix: ({ s }: IcP = {}) => <Sv s={s} w={1.9}><circle cx="9.4" cy="12" r="5.3" /><circle cx="14.6" cy="12" r="5.3" /></Sv>,
  /* 📐 IMG_1950: знак пуска 38.0 × 38.0 — КВАДРАТНЫЙ. Прежний путь был уже,
     чем выше (11.6 × 13.6), и на транспорте выходил 23 вместо 38. */
  play: ({ s }: IcP = {}) => <Sv s={s}><path fill="currentColor" stroke="none" d="M6 5v14L20 12Z" /></Sv>,
  pause: ({ s }: IcP = {}) => <Sv s={s}><rect x="6.6" y="5" width="3.9" height="14" rx="1.2" fill="currentColor" stroke="none" /><rect x="13.5" y="5" width="3.9" height="14" rx="1.2" fill="currentColor" stroke="none" /></Sv>,
  stopSq: ({ s }: IcP = {}) => <Sv s={s}><rect x="6.4" y="6.4" width="11.2" height="11.2" rx="2.6" fill="currentColor" stroke="none" /></Sv>,
  next: ({ s }: IcP = {}) => <Sv s={s}><path fill="currentColor" stroke="none" d="M4.6 6.2v11.6L12.4 12ZM12.6 6.2v11.6L20.4 12Z" /></Sv>,
  prev: ({ s }: IcP = {}) => <Sv s={s}><path fill="currentColor" stroke="none" d="M19.4 6.2v11.6L11.6 12ZM11.4 6.2v11.6L3.6 12Z" /></Sv>,
  spkLo: ({ s }: IcP = {}) => <Sv s={s} vb={24}><path fill="currentColor" stroke="none" d="M4.6 9.6h3l4-3.4v11.6l-4-3.4h-3Z" /></Sv>,
  spkHi: ({ s }: IcP = {}) => <Sv s={s} w={1.7}><path fill="currentColor" stroke="none" d="M3.6 9.6h3l4-3.4v11.6l-4-3.4h-3Z" /><path d="M14 9a4.6 4.6 0 0 1 0 6M16.8 6.6a8.4 8.4 0 0 1 0 10.8" /></Sv>,
  cloud: ({ s }: IcP = {}) => <Sv s={s} w={1.7}><path d="M7.2 18.4a4.4 4.4 0 0 1-.5-8.77 5.6 5.6 0 0 1 10.9 1.17 3.8 3.8 0 0 1-.4 7.6Z" /><path d="M10.2 13.2 12 11.4l1.8 1.8M12 11.6v4.4" /></Sv>,
  note: ({ s }: IcP = {}) => <Sv s={s}><path fill="currentColor" stroke="none" d="M9.6 18.2a2.6 2.6 0 1 1-1.6-2.4V6.6l10-2.4v10.9a2.6 2.6 0 1 1-1.6-2.4V7.3l-6.8 1.7Z" /></Sv>,
  ticket: ({ s }: IcP = {}) => <Sv s={s}><path fill="currentColor" stroke="none" fillRule="evenodd" d="M4 8.2A2.2 2.2 0 0 1 6.2 6h11.6A2.2 2.2 0 0 1 20 8.2v2.3a1.5 1.5 0 0 0 0 3v2.3a2.2 2.2 0 0 1-2.2 2.2H6.2A2.2 2.2 0 0 1 4 15.8v-2.3a1.5 1.5 0 0 0 0-3Zm7 1v3.9a1.4 1.4 0 1 0 .9 1.3V11l2.6-.7v2a1.4 1.4 0 1 0 .9 1.31V8.2Z" /></Sv>,
  photo: ({ s }: IcP = {}) => <Sv s={s}><path fill="currentColor" stroke="none" fillRule="evenodd" d="M8.4 6.2 9.6 4.6h4.8l1.2 1.6h2.2A2.2 2.2 0 0 1 20 8.4v8.4a2.2 2.2 0 0 1-2.2 2.2H6.2A2.2 2.2 0 0 1 4 16.8V8.4a2.2 2.2 0 0 1 2.2-2.2Zm3.6 9.9a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" /></Sv>,
  x: ({ s, w }: IcP = {}) => <Sv s={s} w={w ?? 2.2}><path d="M6.4 6.4 17.6 17.6M17.6 6.4 6.4 17.6" /></Sv>,
  check: ({ s }: IcP = {}) => <Sv s={s} w={2.4}><path d="M5.2 12.6 10 17.4 18.8 7.2" /></Sv>,
  folder: ({ s }: IcP = {}) => <Sv s={s} w={1.8}><path d="M3.8 7.4A2.2 2.2 0 0 1 6 5.2h3.4l1.8 2h6.8A2.2 2.2 0 0 1 20.2 9.4v7.2a2.2 2.2 0 0 1-2.2 2.2H6a2.2 2.2 0 0 1-2.2-2.2Z" /></Sv>,
  sort: ({ s }: IcP = {}) => <Sv s={s} w={1.9}><path d="M8.4 5.4v13M8.4 5.4 5.2 8.6M8.4 5.4l3.2 3.2" /><path d="M15.6 18.6v-13M15.6 18.6l-3.2-3.2M15.6 18.6l3.2-3.2" /></Sv>,
  edit: ({ s }: IcP = {}) => <Sv s={s} w={1.8}><rect x="4.4" y="4.4" width="15.2" height="15.2" rx="3.4" /><path d="M8.2 9.4h7.6M8.2 12.8h5" /></Sv>,
  thumbsDown: ({ s }: IcP = {}) => <Sv s={s} w={1.8}><path d="M15.6 4.4H8.2a2 2 0 0 0-2 1.7l-1 6a2 2 0 0 0 2 2.3h4l-.8 3.6a1.7 1.7 0 0 0 3.1 1.3l3.1-5.2" /><path d="M15.8 4.4h2.4a1.6 1.6 0 0 1 1.6 1.6v6.4a1.6 1.6 0 0 1-1.6 1.6h-2.4Z" /></Sv>,
  report: ({ s }: IcP = {}) => <Sv s={s} w={1.8}><path d="M6 20.5V4.4" /><path d="M6 5.2c3.6-1.8 6.4 1.6 10 0v8c-3.6 1.6-6.4-1.8-10 0" /></Sv>,
  karaoke: ({ s }: IcP = {}) => <Sv s={s} w={1.6}><rect x="8.1" y="4.4" width="4.6" height="8.6" rx="2.3" fill="currentColor" stroke="none" /><path d="M5.6 11.4a4.8 4.8 0 0 0 9.6 0M10.4 16.6v2.6M8 19.4h4.8" /><path fill="currentColor" stroke="none" d="m18.2 4.2.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7Zm-.4 8.2.5 1.4 1.4.5-1.4.5-.5 1.4-.5-1.4-1.4-.5 1.4-.5Z" /></Sv>,
  bolt: ({ s }: IcP = {}) => <Sv s={s} w={1.9}><path d="M13.6 3.2 6.2 13.6h4.7L10 20.8l7.6-10.6h-4.8Z" /></Sv>,
  heart: ({ s }: IcP = {}) => <Sv s={s} w={2}><path d="M12 20.2C7 16.4 3.6 13.2 3.6 9.5A4.5 4.5 0 0 1 8.1 5c1.6 0 3 .8 3.9 2.1A4.7 4.7 0 0 1 15.9 5a4.5 4.5 0 0 1 4.5 4.5c0 3.7-3.4 6.9-8.4 10.7Z" /></Sv>,
  grab: ({ s }: IcP = {}) => <Sv s={s} w={2}><path d="M5 9h14M5 15h14" /></Sv>,
  iphone: ({ s }: IcP = {}) => <Sv s={s} w={1.8}><rect x="7.4" y="2.9" width="9.2" height="18.2" rx="2.6" /><path d="M10.4 18.4h3.2" /></Sv>,
  starFill: ({ s }: IcP = {}) => <svg width={s ?? 24} height={s ?? 24} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.5L12 17.5l-5.8 3.05 1.1-6.5-4.7-4.6 6.5-.95z" /></svg>,
};

/* ── Кнопка ⋯ у ряда ──────────────────────────────────────────────────── */
export function Dots({ onTap }: { onTap: (e: React.MouseEvent) => void }) {
  return <button className="r-dots" onClick={(e) => { e.stopPropagation(); onTap(e); }}>{I.dots({ s: 21 })}</button>;
}

/* ── Заголовок секции ─────────────────────────────────────────────────── */
export function H2({ t, onOpen }: { t: string; onOpen?: () => void }) {
  return (
    <button className={"amx-h2" + (onOpen ? "" : " plain")} onClick={onOpen} style={{ width: "100%", textAlign: "left" }}>
      {t}{onOpen ? I.chev({ s: 15, w: 3 }) : null}
    </button>
  );
}

/* ── Бейдж E ──────────────────────────────────────────────────────────── */
export const E = () => <span className="amx-e">E</span>;

/* ── Ряд песни ────────────────────────────────────────────────────────── */
export function SongRow({ s, big, onPlay, onDots }: { s: Song; big?: boolean; onPlay: () => void; onDots: (e: React.MouseEvent) => void }) {
  return (
    <div className={"amx-row" + (big ? " big" : "")} onClick={onPlay}>
      <Cover id={s.id} cls={"r-art" + (big ? "" : " sm")} />
      <div className="r-c">
        <div className="r-t"><span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{s.t}</span>{s.e ? <E /> : null}</div>
        <div className="r-s">{s.a}</div>
      </div>
      <Dots onTap={onDots} />
    </div>
  );
}

/* ── Пейджер песен 2-в-ряд ────────────────────────────────────────────── */
export function PagedSongs({ songs, per = 4, onPlay, onDots }: {
  songs: Song[]; per?: number;
  onPlay: (i: number) => void; onDots: (s: Song, e: React.MouseEvent) => void;
}) {
  const pages: Song[][] = [];
  for (let i = 0; i < songs.length; i += per) pages.push(songs.slice(i, i + per));
  return (
    <div className="amx-paged">
      {pages.map((pg, pi) => (
        <div className="amx-page" key={pi}>
          {pg.map((s, i) => <SongRow key={s.id + i} s={s} onPlay={() => onPlay(pi * per + i)} onDots={(e) => onDots(s, e)} />)}
        </div>
      ))}
    </div>
  );
}

/* ── Меню-поповер ─────────────────────────────────────────────────────── */
export type MQuick = { icon: React.ReactNode; label: string; onTap?: () => void };
export type MItem =
  | { sep: true; thick?: boolean }
  | { label: string; sub?: string; icon?: React.ReactNode; check?: boolean; noIcon?: boolean; onTap?: () => void };
/* Геометрия телефонного кадра: меню и шторки живут в его координатах. */
export function frameRect(): { l: number; t: number; w: number; h: number } {
  if (typeof document !== "undefined") {
    const el = document.querySelector(".amx-frame");
    if (el) { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; }
  }
  const w = typeof window !== "undefined" ? window.innerWidth : 393;
  const h = typeof window !== "undefined" ? window.innerHeight : 852;
  return { l: 0, t: 0, w, h };
}

export function Menu({ at, quick, items, onClose, width, narrow }: {
  at: { x: number; y: number; up?: boolean }; quick?: MQuick[]; items: MItem[];
  onClose: () => void; width?: number;
  /** Узкое меню выбора — 📐 248.0, шаг строки 36, отметка слева. */
  narrow?: boolean;
}) {
  const w = width ?? (narrow ? 248 : 296);
  const fr = frameRect();
  const ax = at.x - fr.l, ay = at.y - fr.t;
  /* 📐 IMG_1976 · IMG_1977: правый край меню 378.7 в обоих → отступ от края
     кадра 14.3, а не 8. */
  const edge = 14;
  const left = Math.min(Math.max(edge, ax - (ax > fr.w / 2 ? w : 0)), fr.w - w - edge);
  const est = (quick ? 78 : 0) + items.reduce((a, it) => a + ("sep" in it ? ("thick" in it && it.thick ? 8 : 1) : ("sub" in it && it.sub ? 62 : narrow ? 36 : 50)), 0);
  const up = at.up ?? (ay + est + 16 > fr.h);
  const style: React.CSSProperties = up
    ? { left, bottom: Math.max(10, fr.h - ay + 10), ["--oy" as never]: "100%" as never }
    : { left, top: Math.min(ay + 10, fr.h - est - 14) };
  const ox = ax > fr.w / 2 ? "86%" : "14%";
  const ex = useExit(onClose, 175);  /* 🎞 §5.4: выход 160 мс + запас кадра */
  /* Esc — обязательный выход: без него меню на клавиатуре не закрыть */
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") ex.close(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className={"amx-dim" + (ex.out ? " out" : "")} onClick={ex.close} style={{ background: "rgba(0,0,0,.32)", backdropFilter: "blur(5px)", WebkitBackdropFilter: "blur(5px)" }}>
      <div className={"amx-menu" + (narrow ? " narrow" : "") + (ex.out ? " out" : "")} style={{ ...style, width: w, ["--ox" as never]: ox as never }} onClick={(e) => e.stopPropagation()}>
        {quick ? (
          <>
            <div className="mq">
              {quick.map((q, i) => (
                <button key={i} onClick={() => { q.onTap?.(); ex.close(); }}>{q.icon}<span>{q.label}</span></button>
              ))}
            </div>
            <div className="sep" />
          </>
        ) : null}
        {items.map((it, i) =>
          "sep" in it ? (
            <div key={i} className={"sep" + (it.thick ? " thick" : "")} />
          ) : (
            <button key={i} className="mi" style={{ width: "100%", textAlign: "left" }}
              onClick={() => { it.onTap?.(); ex.close(); }}>
              {it.icon ?? (it.check !== undefined ? <span className="chk">{it.check ? I.check({ s: 18 }) : null}</span> : null)}
              <span className="mc">
                <div>{it.label}</div>
                {it.sub ? <div className="ms">{it.sub}</div> : null}
              </span>
            </button>
          )
        )}
      </div>
    </div>
  );
}
export const menuAt = (e: React.MouseEvent): { x: number; y: number } => {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.bottom };
};

/* ── Выходной такт слоя: сыграть «out» и лишь потом снять с экрана ─────
   LAW_MUSIC §5.4–5.5: у меню и шторок обязан быть выход. */
export function useExit(onClose: () => void, ms = 300) {
  const [out, setOut] = useState(false);
  const done = useRef(false);
  const close = () => {
    if (done.current) return;
    done.current = true; setOut(true);
    window.setTimeout(onClose, ms);
  };
  return { out, close };
}

/* ── Долгое нажатие ───────────────────────────────────────────────────── */
export function useLongPress(cb: (x: number, y: number) => void) {
  const tm = useRef<number | null>(null);
  const pos = useRef({ x: 0, y: 0 });
  const clear = () => { if (tm.current) { window.clearTimeout(tm.current); tm.current = null; } };
  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0]; pos.current = { x: t.clientX, y: t.clientY };
      clear(); tm.current = window.setTimeout(() => cb(pos.current.x, pos.current.y), 430);
    },
    onTouchMove: (e: React.TouchEvent) => {
      const t = e.touches[0];
      if (Math.abs(t.clientX - pos.current.x) + Math.abs(t.clientY - pos.current.y) > 12) clear();
    },
    onTouchEnd: clear,
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); cb(e.clientX, e.clientY); },
  };
}

/* ── Локальное хранилище (плейлисты · избранное · недавние запросы) ───── */
export type Playlist = { id: string; title: string; ids: string[] };
export type MStore = { pl: Playlist[]; fav: Record<string, 1>; rec: string[] };
const KEY = "amx-store-v1";
let cur: MStore = (() => {
  try { return { pl: [], fav: {}, rec: [], ...(JSON.parse(localStorage.getItem(KEY) || "{}") as Partial<MStore>) }; }
  catch { return { pl: [], fav: {}, rec: [] }; }
})();
const subs = new Set<() => void>();
export function mutate(fn: (s: MStore) => MStore) {
  cur = fn(cur);
  try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch { /* приватный режим */ }
  subs.forEach((f) => f());
}
export function useStore(): MStore {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((n) => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
  return cur;
}
export const storeNow = () => cur;

/* ── Формат времени ───────────────────────────────────────────────────── */
export const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

/* ── Хелпер: перемешивание ────────────────────────────────────────────── */
export function shuffled<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/* ── Аватар BX ────────────────────────────────────────────────────────── */
export const Ava = () => <div className="amx-ava">BX</div>;

/* ── Контекст прокрутки: экран сообщает доку, что его прокрутили ──────── */
export const ScrollCtx = React.createContext<(top: number) => void>(() => {});
export function Scr({ children, cls }: { children: React.ReactNode; cls?: string }) {
  const onScroll = React.useContext(ScrollCtx);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => { onScroll(0); }, [onScroll]);
  return (
    <div ref={ref} className={"amx-scr " + (cls || "")}
      onScroll={(e) => onScroll((e.target as HTMLDivElement).scrollTop)}>
      {children}
    </div>
  );
}

/* Мемо-обёртка секции полки */
export function Shelf({ children }: { children: React.ReactNode }) {
  return <div className="amx-shelf">{children}</div>;
}

export function useVH(): number {
  const [vh, set] = useState(typeof window !== "undefined" ? window.innerHeight : 852);
  useEffect(() => { const f = () => set(window.innerHeight); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  return vh;
}

export const noop = () => {};

/* Карточка полки (обложка + подписи) */
export function ShelfCard({ id, t, s, e, wide, tall, cap, onOpen }: {
  id: string; t: string; s?: string; e?: boolean; wide?: boolean; tall?: boolean; cap?: string; onOpen?: () => void;
}) {
  return (
    <div className={"amx-cardw" + (wide ? " wide" : "") + (tall ? " tall" : "")} onClick={onOpen}>
      <Cover id={id} label={cap} />
      <div className="cw-t"><span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{t}</span>{e ? <E /> : null}</div>
      {s ? <div className="cw-s">{s}</div> : null}
    </div>
  );
}
