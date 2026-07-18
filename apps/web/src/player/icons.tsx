/** Иконки транспорта плеера — тот же визуальный язык, что и ui/icons.tsx. */
import type { SVGProps } from "react";

interface P extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> { size?: number }
const sp = ({ size = 24 }: P) => ({ width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true as const });
const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
// Нормализация оптического размера: центрированный масштаб + компенсация толщины штриха до 1.8.
const norm = (k: number) => ({ transform: `translate(12 12) scale(${k}) translate(-12 -12)`, fill: "none", stroke: "currentColor", strokeWidth: +(1.8 / k).toFixed(2), strokeLinecap: "round" as const, strokeLinejoin: "round" as const });

export function PlayIcon(p: P) { return <svg {...sp(p)}><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg>; }
export function PauseIcon(p: P) { return <svg {...sp(p)}><rect x="6.5" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" /><rect x="13.9" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" /></svg>; }
export function PrevIcon(p: P) { return <svg {...sp(p)}><path d="M18 6v12l-9-6z" fill="currentColor" /><rect x="5" y="6" width="2.4" height="12" rx="1.2" fill="currentColor" /></svg>; }
export function NextIcon(p: P) { return <svg {...sp(p)}><path d="M6 6v12l9-6z" fill="currentColor" /><rect x="16.6" y="6" width="2.4" height="12" rx="1.2" fill="currentColor" /></svg>; }
export function ChevDownIcon(p: P) { return <svg {...sp(p)}><path {...S} d="M6 9l6 6 6-6" /></svg>; }
export function QueueIcon(p: P) { return <svg {...sp(p)}><path {...S} d="M4 7h11M4 12h11M4 17h7" /><path d="M19 13.5l0 5.2M19 13.5c1.4-.3 2.4-.2 2.4.8s-1 1.3-2.4 1" {...S} /></svg>; }
/** Apple gobackward.15 / goforward.15 — почти полный круг, аккуратная стрелка, «15» по центру. */
export function Back15Icon(p: P) {
  return (
    <svg {...sp(p)}>
      <path d="M8.49 5.26 A7.6 7.6 0 1 0 15.51 5.26" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
      <path d="M6.18 6.46 L7.47 3.30 L9.51 7.22 Z" fill="currentColor" />
      <text x="12" y="15.2" textAnchor="middle" fontSize="7.4" fontWeight={700} fill="currentColor" fontFamily="var(--font-text), system-ui, sans-serif">15</text>
    </svg>
  );
}
export function Fwd15Icon(p: P) {
  return (
    <svg {...sp(p)}>
      <path d="M15.51 5.26 A7.6 7.6 0 1 1 8.49 5.26" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
      <path d="M17.82 6.46 L14.49 7.22 L16.53 3.30 Z" fill="currentColor" />
      <text x="12" y="15.2" textAnchor="middle" fontSize="7.4" fontWeight={700} fill="currentColor" fontFamily="var(--font-text), system-ui, sans-serif">15</text>
    </svg>
  );
}

/* Footer-иконки нормализованы к единой оптической высоте через norm(k). */
/** SF Symbols shuffle — две перекрещивающиеся стрелки. */
export function ShuffleIcon(p: P) {
  return (
    <svg {...sp(p)}>
      <g {...norm(0.9)}>
        <polyline points="16 4 20 4 20 8" />
        <line x1="4" y1="19" x2="20" y2="4" />
        <polyline points="20 15 20 19 16 19" />
        <line x1="15" y1="14" x2="20" y2="19" />
        <line x1="4" y1="5" x2="9" y2="10" />
      </g>
    </svg>
  );
}
/** SF Symbols repeat — петля из двух стрелок. */
export function RepeatIcon(p: P) {
  return (
    <svg {...sp(p)}>
      <g {...norm(0.675)}>
        <polyline points="17 2 20.5 5.5 17 9" />
        <path d="M3.5 11.5V9.5a4 4 0 0 1 4-4h13" />
        <polyline points="7 22 3.5 18.5 7 15" />
        <path d="M20.5 12.5v2a4 4 0 0 1-4 4h-13" />
      </g>
    </svg>
  );
}
/** SF Symbols repeat.1 — петля + «1» по центру. */
export function RepeatOneIcon(p: P) {
  return (
    <svg {...sp(p)}>
      <g {...norm(0.675)}>
        <polyline points="17 2 20.5 5.5 17 9" />
        <path d="M3.5 11.5V9.5a4 4 0 0 1 4-4h13" />
        <polyline points="7 22 3.5 18.5 7 15" />
        <path d="M20.5 12.5v2a4 4 0 0 1-4 4h-13" />
      </g>
      <text x="12" y="14.6" textAnchor="middle" fontSize="7.4" fontWeight={700} fill="currentColor" fontFamily="var(--font-text), system-ui, sans-serif">1</text>
    </svg>
  );
}
/** repeat для всей библиотеки — петля + «∞». */
export function RepeatLibraryIcon(p: P) {
  return (
    <svg {...sp(p)}>
      <g {...norm(0.675)}>
        <polyline points="17 2 20.5 5.5 17 9" />
        <path d="M3.5 11.5V9.5a4 4 0 0 1 4-4h13" />
        <polyline points="7 22 3.5 18.5 7 15" />
        <path d="M20.5 12.5v2a4 4 0 0 1-4 4h-13" />
      </g>
      <text x="12" y="14.7" textAnchor="middle" fontSize="7.2" fontWeight={700} fill="currentColor" fontFamily="var(--font-text), system-ui, sans-serif">∞</text>
    </svg>
  );
}
/** Повтор ГОЛОСА — та же петля, в центре человек. У Apple такого знака нет:
 *  «повтор артиста» там не существует. Рисуем в своей семье: петля + фигура. */
export function RepeatVoiceIcon(p: P) {
  return (
    <svg {...sp(p)}>
      <g {...norm(0.675)}>
        <polyline points="17 2 20.5 5.5 17 9" />
        <path d="M3.5 11.5V9.5a4 4 0 0 1 4-4h13" />
        <polyline points="7 22 3.5 18.5 7 15" />
        <path d="M20.5 12.5v2a4 4 0 0 1-4 4h-13" />
      </g>
      <circle cx="12" cy="10.4" r="1.7" fill="currentColor" />
      <path d="M9.1 15.4a2.9 2.9 0 0 1 5.8 0" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}
/** Таймер сна — месяц. Киртан слушают, засыпая; выключить его должно само. */
export function MoonIcon(p: P) {
  return (
    <svg {...sp(p)}>
      <path d="M20.5 14.9A8.6 8.6 0 0 1 9.1 3.5a8.6 8.6 0 1 0 11.4 11.4z"
        fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
    </svg>
  );
}
/** Порядок по списку (1→N) — список + высокая стрелка вниз (натуральный размер). */
export function OrderForwardIcon(p: P) {
  return (
    <svg {...sp(p)}>
      <g {...S}>
        <path d="M4.5 7.5h7M4.5 12h7M4.5 16.5h7" />
        <path d="M16.5 5.5v13" />
        <path d="M13.5 15.5 16.5 18.5 19.5 15.5" />
      </g>
    </svg>
  );
}
/** Обратный порядок (N→1) — список + высокая стрелка вверх. */
export function OrderReverseIcon(p: P) {
  return (
    <svg {...sp(p)}>
      <g {...S}>
        <path d="M4.5 16.5h7M4.5 12h7M4.5 7.5h7" />
        <path d="M16.5 18.5v-13" />
        <path d="M13.5 8.5 16.5 5.5 19.5 8.5" />
      </g>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
 * ЗКН-Д023 · ЗНАКИ АУДИОТЕКИ — ЯЗЫК SF SYMBOLS.
 *
 * Набор снят с Apple Music (iOS 26.5): те же метафоры, та же оптика, та же
 * толщина штриха. Свой рисунок иконки — это свой диалект: человек, знающий
 * систему, перестаёт узнавать кнопку и вынужден ЧИТАТЬ интерфейс вместо того,
 * чтобы им пользоваться.
 * ═══════════════════════════════════════════════════════════════════════════ */

/** ⋯ — «ещё» (SF: ellipsis). */
export function EllipsisIcon(p: P) {
  return <svg {...sp(p)}><g fill="currentColor"><circle cx="5.4" cy="12" r="1.75" /><circle cx="12" cy="12" r="1.75" /><circle cx="18.6" cy="12" r="1.75" /></g></svg>;
}
/** › — шеврон строки (SF: chevron.right). */
export function ChevronRightIcon(p: P) {
  return <svg {...sp(p)}><path {...S} strokeWidth={2.2} d="M9.5 5.5 16 12l-6.5 6.5" /></svg>;
}
/** ‹ — назад (SF: chevron.left). */
export function ChevronLeftIcon(p: P) {
  return <svg {...sp(p)}><path {...S} strokeWidth={2.2} d="M14.5 5.5 8 12l6.5 6.5" /></svg>;
}
/** ✓ — выбранный пункт меню (SF: checkmark). */
export function CheckIcon(p: P) {
  return <svg {...sp(p)}><path {...S} strokeWidth={2.2} d="M4.5 12.4 9.6 17.5 19.5 6.6" /></svg>;
}
/** Фильтр и сортировка (SF: line.3.horizontal.decrease). */
export function FilterIcon(p: P) {
  return <svg {...sp(p)}><g {...S} strokeWidth={2}><path d="M4 7h16M6.5 12h11M9.5 17h5" /></g></svg>;
}
/** Поделиться (SF: square.and.arrow.up). */
export function ShareIcon(p: P) {
  return (
    <svg {...sp(p)}>
      <g {...S}>
        <path d="M12 3.6v11" /><path d="M8.6 7 12 3.6 15.4 7" />
        <path d="M6.6 10.4H5.4v9.2h13.2v-9.2h-1.2" />
      </g>
    </svg>
  );
}
/** Добавить в плейлист (SF: text.badge.plus) — та же пара, что в шапке «Медиатеки». */
export function PlusListIcon(p: P) {
  return (
    <svg {...sp(p)}>
      <g {...S}><path d="M3.4 7.4h11M3.4 12h11M3.4 16.6h7.4" /><path d="M18 8.4v7.2M14.4 12h7.2" /></g>
    </svg>
  );
}
/** + — добавить (SF: plus). */
export function PlusIcon(p: P) {
  return <svg {...sp(p)}><path {...S} strokeWidth={2.1} d="M12 5.2v13.6M5.2 12h13.6" /></svg>;
}
/** Плитка (SF: square.grid.2x2). */
export function GridIcon(p: P) {
  return <svg {...sp(p)}><g fill="currentColor"><rect x="3.6" y="3.6" width="7.4" height="7.4" rx="2" /><rect x="13" y="3.6" width="7.4" height="7.4" rx="2" /><rect x="3.6" y="13" width="7.4" height="7.4" rx="2" /><rect x="13" y="13" width="7.4" height="7.4" rx="2" /></g></svg>;
}
/** Список (SF: list.bullet). */
export function ListIcon(p: P) {
  return (
    <svg {...sp(p)}>
      <g {...S} strokeWidth={2}><path d="M8.4 6.4h11.2M8.4 12h11.2M8.4 17.6h11.2" /></g>
      <g fill="currentColor"><circle cx="4.4" cy="6.4" r="1.35" /><circle cx="4.4" cy="12" r="1.35" /><circle cx="4.4" cy="17.6" r="1.35" /></g>
    </svg>
  );
}
/** Рассказчик катхи (SF: quote.bubble) — голос ведёт повествование. */
export function VoiceIcon(p: P) {
  return (
    <svg {...sp(p)}>
      <g {...S}>
        <path d="M12 3.8c4.7 0 8.4 2.9 8.4 6.7 0 3.8-3.7 6.7-8.4 6.7-.9 0-1.8-.1-2.6-.3l-4.2 2 1.1-3.3C4.6 14.4 3.6 12.6 3.6 10.5c0-3.8 3.7-6.7 8.4-6.7Z" />
        <path d="M9.6 8.8c-.9.5-1.3 1.2-1.3 2 0 .6.4 1 .9 1s.9-.4.9-1c0-.3-.1-.5-.3-.7M14.4 8.8c-.9.5-1.3 1.2-1.3 2 0 .6.4 1 .9 1s.9-.4.9-1c0-.3-.1-.5-.3-.7" />
      </g>
    </svg>
  );
}
/** Киртания (SF: music.mic). */
export function MicIcon(p: P) {
  return (
    <svg {...sp(p)}>
      <g {...S}>
        <path d="M16.6 3.6a3.8 3.8 0 1 1-2.7 6.5L5 19a1.9 1.9 0 0 1-2.7-2.7l8.9-8.9a3.8 3.8 0 0 1 5.4-3.8Z" />
      </g>
    </svg>
  );
}
/** Собрание записей — цикл катхи / альбом киртанов (SF: square.stack). */
export function StackIcon(p: P) {
  return (
    <svg {...sp(p)}>
      <g {...S}><rect x="6.6" y="7.4" width="13" height="13" rx="3.2" /><path d="M4.4 16.6V6.4a2.4 2.4 0 0 1 2.4-2.4h9.4" /></g>
    </svg>
  );
}
/** Запись (SF: music.note). */
export function NoteIcon(p: P) {
  return (
    <svg {...sp(p)}>
      <path {...S} d="M9.4 17.6V6.2l9.2-2v11" />
      <g fill="currentColor"><ellipse cx="6.8" cy="17.6" rx="2.7" ry="2.3" /><ellipse cx="16" cy="15.2" rx="2.7" ry="2.3" /></g>
    </svg>
  );
}
/** Отложенное — «Моё» (SF: star). */
export function StarIcon({ filled, ...p }: P & { filled?: boolean }) {
  return (
    <svg {...sp(p)}>
      <path {...S} fill={filled ? "currentColor" : "none"}
        d="m12 3.9 2.55 5.32 5.85.78-4.27 4.05 1.09 5.79L12 17.06l-5.22 2.78 1.09-5.79L3.6 10l5.85-.78L12 3.9Z" />
    </svg>
  );
}
/** Часы — недавнее (SF: clock). */
export function ClockIcon(p: P) {
  return <svg {...sp(p)}><g {...S}><circle cx="12" cy="12" r="8.4" /><path d="M12 6.9V12l3.4 2.1" /></g></svg>;
}
/** Текст записи / книга (SF: text.quote). */
export function TextIcon(p: P) {
  return <svg {...sp(p)}><g {...S}><path d="M4 6.4h16M4 11h9.4M4 15.6h16M4 20.2h9.4" /></g></svg>;
}
/** Громкость — тише (SF: speaker.fill). */
export function VolumeLowIcon(p: P) {
  return <svg {...sp(p)}><path fill="currentColor" d="M11 5.2 6.6 8.9H3.4v6.2h3.2L11 18.8z" /></svg>;
}
/** Громкость — громче (SF: speaker.wave.3.fill). */
export function VolumeHighIcon(p: P) {
  return (
    <svg {...sp(p)}>
      <path fill="currentColor" d="M11 5.2 6.6 8.9H3.4v6.2h3.2L11 18.8z" />
      <g {...S}><path d="M14 9.2a4 4 0 0 1 0 5.6M16.6 6.8a7.6 7.6 0 0 1 0 10.4" /></g>
    </svg>
  );
}
/** Скорость воспроизведения (SF: gauge). */
export function SpeedIcon(p: P) {
  return (
    <svg {...sp(p)}>
      <g {...S}><path d="M4.2 17.6a9 9 0 1 1 15.6 0" /><path d="M12 12.8 16 8.6" /></g>
      <circle cx="12" cy="13.4" r="1.5" fill="currentColor" />
    </svg>
  );
}
/** Скачать запись (SF: arrow.down.circle). */
export function DownloadIcon(p: P) {
  return (
    <svg {...sp(p)}>
      <g {...S}><circle cx="12" cy="12" r="8.6" /><path d="M12 7.6v7.2M8.8 11.6 12 14.8l3.2-3.2" /></g>
    </svg>
  );
}
/** Заметка к записи (SF: square.and.pencil). */
export function NoteEditIcon(p: P) {
  return (
    <svg {...sp(p)}>
      <g {...S}>
        <path d="M19.4 12.6v5.2a2.2 2.2 0 0 1-2.2 2.2H6.2A2.2 2.2 0 0 1 4 17.8V6.8a2.2 2.2 0 0 1 2.2-2.2h5.2" />
        <path d="m15.4 4.2 4.4 4.4-6.6 6.6-4.6 1 1-4.6z" />
      </g>
    </svg>
  );
}
/** Поддержать проект (SF: heart). */
export function HeartGlyph({ filled, ...p }: P & { filled?: boolean }) {
  return (
    <svg {...sp(p)}>
      <path {...S} fill={filled ? "currentColor" : "none"}
        d="M12 20.2c-.4 0-.8-.2-1.1-.4C6.4 16.2 3.4 13.4 3.4 9.9a4.6 4.6 0 0 1 8.6-2.4 4.6 4.6 0 0 1 8.6 2.4c0 3.5-3 6.3-7.5 9.9-.3.2-.7.4-1.1.4Z" />
    </svg>
  );
}
