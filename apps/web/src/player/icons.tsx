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
/** Скругл. «−15 / +15» рисуем текстом в компоненте; здесь — круговые стрелки. */
export function Back15Icon(p: P) {
  return (
    <svg {...sp(p)}>
      <path {...S} d="M11 6a6.5 6.5 0 1 1-6.3 4.9" />
      <path {...S} d="M4.4 6.2 4.7 11l4.8-.3" />
    </svg>
  );
}
export function Fwd15Icon(p: P) {
  return (
    <svg {...sp(p)}>
      <path {...S} d="M13 6a6.5 6.5 0 1 0 6.3 4.9" />
      <path {...S} d="M19.6 6.2 19.3 11l-4.8-.3" />
    </svg>
  );
}
