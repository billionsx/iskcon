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
/** Apple-style gobackward.15 / goforward.15 — круговая стрелка + «15» по центру. */
export function Back15Icon(p: P) {
  return (
    <svg {...sp(p)}>
      <path fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" d="M12 4.8 A7.2 7.2 0 1 0 19.2 12" />
      <path fill="currentColor" d="M13 2.2 L8.4 4.8 L13 7.4 Z" />
      <text x="12" y="15.4" textAnchor="middle" fontSize="7.6" fontWeight={700} fill="currentColor" fontFamily="var(--font-text), system-ui, sans-serif">15</text>
    </svg>
  );
}
export function Fwd15Icon(p: P) {
  return (
    <svg {...sp(p)}>
      <path fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" d="M12 4.8 A7.2 7.2 0 1 1 4.8 12" />
      <path fill="currentColor" d="M11 2.2 L15.6 4.8 L11 7.4 Z" />
      <text x="12" y="15.4" textAnchor="middle" fontSize="7.6" fontWeight={700} fill="currentColor" fontFamily="var(--font-text), system-ui, sans-serif">15</text>
    </svg>
  );
}
