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
export function AirPodsIcon(p: IconProps) {
  return (
    <svg {...sp(p)} fill="currentColor">
      <g transform="translate(12 12) scale(1.25) translate(-12 -9.5)">
        <g transform="rotate(-8 7.1 4.4)">
          <path fillRule="evenodd" d="M7 2.4 H7.2 A2.5 2.5 0 0 1 9.7 4.9 V6.7 A2.5 2.5 0 0 1 7.2 9.2 H7 A2.5 2.5 0 0 1 4.5 6.7 V4.9 A2.5 2.5 0 0 1 7 2.4 Z M6.1 4.85 a1 1 0 1 0 2 0 a1 1 0 1 0 -2 0 Z" />
          <path d="M7.1 8 H7.1 A1.55 1.55 0 0 1 8.65 9.55 V15.05 A1.55 1.55 0 0 1 7.1 16.6 H7.1 A1.55 1.55 0 0 1 5.55 15.05 V9.55 A1.55 1.55 0 0 1 7.1 8 Z" />
        </g>
        <g transform="rotate(8 16.9 4.4)">
          <path fillRule="evenodd" d="M16.8 2.4 H17 A2.5 2.5 0 0 1 19.5 4.9 V6.7 A2.5 2.5 0 0 1 17 9.2 H16.8 A2.5 2.5 0 0 1 14.3 6.7 V4.9 A2.5 2.5 0 0 1 16.8 2.4 Z M15.9 4.85 a1 1 0 1 0 2 0 a1 1 0 1 0 -2 0 Z" />
          <path d="M16.9 8 H16.9 A1.55 1.55 0 0 1 18.45 9.55 V15.05 A1.55 1.55 0 0 1 16.9 16.6 H16.9 A1.55 1.55 0 0 1 15.35 15.05 V9.55 A1.55 1.55 0 0 1 16.9 8 Z" />
        </g>
      </g>
    </svg>
  );
}
export function LinkIcon(p: IconProps) { return <svg {...sp(p)}><path {...STROKE} d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7l-1.6 1.6" /><path {...STROKE} d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7l1.6-1.6" /></svg>; }
export function TopIcon(p: IconProps) { return <svg {...sp(p)}><path {...STROKE} d="M12 19V7M6 11l6-6 6 6" /></svg>; }
export function ChevRightIcon(p: IconProps) { return <svg {...sp(p)}><path {...STROKE} d="M9 5l7 7-7 7" /></svg>; }
