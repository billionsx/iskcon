/** Иконки транспорта плеера — тот же визуальный язык, что и ui/icons.tsx. */
import type { SVGProps } from "react";

interface P extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> { size?: number }
const sp = ({ size = 24 }: P) => ({ width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true as const });
const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

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

/** SF Symbols shuffle — две перекрещивающиеся стрелки. */
export function ShuffleIcon(p: P) {
  return (
    <svg {...sp(p)}>
      <polyline points="16 4 20 4 20 8" {...S} />
      <line x1="4" y1="19" x2="20" y2="4" {...S} />
      <polyline points="20 15 20 19 16 19" {...S} />
      <line x1="15" y1="14" x2="20" y2="19" {...S} />
      <line x1="4" y1="5" x2="9" y2="10" {...S} />
    </svg>
  );
}
/** SF Symbols repeat — петля из двух стрелок. */
export function RepeatIcon(p: P) {
  return (
    <svg {...sp(p)}>
      <polyline points="17 2 20.5 5.5 17 9" {...S} />
      <path d="M3.5 11.5V9.5a4 4 0 0 1 4-4h13" {...S} />
      <polyline points="7 22 3.5 18.5 7 15" {...S} />
      <path d="M20.5 12.5v2a4 4 0 0 1-4 4h-13" {...S} />
    </svg>
  );
}
/** SF Symbols repeat.1 — петля + «1» по центру. */
export function RepeatOneIcon(p: P) {
  return (
    <svg {...sp(p)}>
      <polyline points="17 2 20.5 5.5 17 9" {...S} />
      <path d="M3.5 11.5V9.5a4 4 0 0 1 4-4h13" {...S} />
      <polyline points="7 22 3.5 18.5 7 15" {...S} />
      <path d="M20.5 12.5v2a4 4 0 0 1-4 4h-13" {...S} />
      <text x="12" y="15.1" textAnchor="middle" fontSize="8.2" fontWeight={700} fill="currentColor" fontFamily="var(--font-text), system-ui, sans-serif">1</text>
    </svg>
  );
}
