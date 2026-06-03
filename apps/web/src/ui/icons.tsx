/**
 * Единый набор иконок интерфейса. Источник правды — формы из ПКП
 * (BookDetailPage), чтобы во всех карточках иконки были идентичны.
 * Не дублировать пути в страницах — импортировать отсюда.
 */
import type { SVGProps } from "react";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> { size?: number; filled?: boolean }
const sp = ({ size = 24 }: IconProps) => ({ width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true as const });
export const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function BackIcon(p: IconProps) { return <svg {...sp(p)}><path {...STROKE} d="M15 5l-7 7 7 7" /></svg>; }
export function HeartIcon(p: IconProps) {
  const d = "M12 21c-7.4-4.6-9.9-8.7-9.9-12.5 0-2.85 2.04-5.2 4.85-5.2 1.97 0 3.6 1.05 5.05 3.07 1.45-2.02 3.08-3.07 5.05-3.07 2.81 0 4.85 2.35 4.85 5.2 0 3.8-2.5 7.9-9.9 12.5Z";
  return p.filled ? <svg {...sp(p)}><path d={d} fill="currentColor" /></svg> : <svg {...sp(p)}><path {...STROKE} d={d} /></svg>;
}
export function ShareIcon(p: IconProps) { return <svg {...sp(p)}><path {...STROKE} d="M12 3v13M8 7l4-4 4 4" /><path {...STROKE} d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></svg>; }
export function MoreIcon(p: IconProps) { return <svg {...sp(p)}><circle cx="12" cy="5" r="1.7" fill="currentColor" /><circle cx="12" cy="12" r="1.7" fill="currentColor" /><circle cx="12" cy="19" r="1.7" fill="currentColor" /></svg>; }
export function BagIcon(p: IconProps & { cornerGlyph?: "plus" | "minus" | null }) {
  const { cornerGlyph, ...rest } = p;
  const corner = cornerGlyph === "plus"
    ? <g><line x1="20" y1="3.25" x2="23.5" y2="3.25" {...STROKE} /><line x1="21.75" y1="1.5" x2="21.75" y2="5" {...STROKE} /></g>
    : cornerGlyph === "minus" ? <line x1="20" y1="3.25" x2="23.5" y2="3.25" {...STROKE} /> : null;
  return <svg {...sp(rest)} overflow="visible"><path {...STROKE} d="M5.4 7.5h13.2a1 1 0 0 1 1 1.1l-1.2 11.4a1.5 1.5 0 0 1-1.5 1.4H7.1a1.5 1.5 0 0 1-1.5-1.4L4.4 8.6a1 1 0 0 1 1-1.1Z" /><path {...STROKE} d="M8 9V6.5a4 4 0 0 1 8 0V9" />{corner}</svg>;
}
/** Over-ear headphones — the "listen / audio" action. Stroked headband + filled ear-cups. */
export function HeadphonesIcon(p: IconProps) {
  return (
    <svg {...sp(p)}>
      <path fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" d="M4.7 14V11.4C4.7 6.7 7.7 4.7 12 4.7C16.3 4.7 19.3 6.7 19.3 11.4V14" />
      <path fill="currentColor" d="M7 11.6v8.6H5.3A2.6 2.6 0 0 1 2.7 17.6v-3.4A2.6 2.6 0 0 1 5.3 11.6Z" />
      <path fill="currentColor" d="M17 11.6v8.6h1.7a2.6 2.6 0 0 0 2.6-2.6v-3.4a2.6 2.6 0 0 0-2.6-2.6Z" />
    </svg>
  );
}
export function LinkIcon(p: IconProps) { return <svg {...sp(p)}><path {...STROKE} d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7l-1.6 1.6" /><path {...STROKE} d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7l1.6-1.6" /></svg>; }
export function TopIcon(p: IconProps) { return <svg {...sp(p)}><path {...STROKE} d="M12 19V7M6 11l6-6 6 6" /></svg>; }
export function ChevRightIcon(p: IconProps) { return <svg {...sp(p)}><path {...STROKE} d="M9 5l7 7-7 7" /></svg>; }
