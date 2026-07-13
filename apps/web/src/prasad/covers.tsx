/**
 * prasad/covers.tsx — обложки блюд в эстетике Apple Inc.
 *
 * Единый премиальный визуальный язык вместо фуд-фото (которого пока нет):
 *  • благородный тёмный градиент с мягким верхним светом;
 *  • чистый линейный глиф блюда (SF-Symbols-подобный: тонкий штрих, скруглённые
 *    концы), свой на каждую категорию;
 *  • акцент-цвет по категории — приглушённый, премиальный, но различимый;
 *  • лёгкая детерминированная вариация на блюдо (угол градиента + точка света),
 *    чтобы две карточки одной категории не были идентичны.
 *
 * RecipeCover заполняет родителя (width/height 100%); чип и кнопки действий
 * накладываются поверх в самой карточке.
 */
import type { ReactElement } from "react";

type GlyphProps = { size?: number };
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const svg = (size: number) => ({ width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true as const });

/* ───────── линейные глифы блюд ───────── */
const SweetsGlyph = ({ size = 44 }: GlyphProps) => (
  <svg {...svg(size)}><g {...stroke}>
    <circle cx="10.4" cy="13.6" r="5.4" />
    <path d="M17.7 5.6c.2 1.5.7 2 2.2 2.2-1.5.2-2 .7-2.2 2.2-.2-1.5-.7-2-2.2-2.2 1.5-.2 2-.7 2.2-2.2Z" />
  </g></svg>
);
const MainsGlyph = ({ size = 44 }: GlyphProps) => (
  <svg {...svg(size)}><g {...stroke}>
    <path d="M5 10.6h14v4.4a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z" />
    <path d="M5 12.3H3.4M19 12.3h1.6" />
    <path d="M9.5 8.2c0-1 .7-1.4.7-2.5M14.5 8.2c0-1 .7-1.4.7-2.5" />
  </g></svg>
);
const RiceGlyph = ({ size = 44 }: GlyphProps) => (
  <svg {...svg(size)}><g {...stroke}>
    <path d="M4 12.9h16a8 8 0 0 1-16 0z" />
    <path d="M7.3 12.9c1.2-2.4 3-3.4 4.7-3.4s3.5 1 4.7 3.4" />
    <path d="M10 7.4c0-1 .7-1.4.7-2.4M14 7.4c0-1 .7-1.4.7-2.4" />
  </g></svg>
);
const DrinksGlyph = ({ size = 44 }: GlyphProps) => (
  <svg {...svg(size)}><g {...stroke}>
    <path d="M7 5h10l-1.1 13.3a1 1 0 0 1-1 .9H9.1a1 1 0 0 1-1-.9z" />
    <path d="M7.5 9.6h9" />
  </g></svg>
);
const ChutneyGlyph = ({ size = 44 }: GlyphProps) => (
  <svg {...svg(size)}><g {...stroke}>
    <path d="M6.5 12.7h11l-1 5.5a1 1 0 0 1-1 .8H8.5a1 1 0 0 1-1-.8z" />
    <path d="M12 11c0-1.7 1-2.9 2.7-3.3-.2 1.8-1.1 2.9-2.7 3.3Z" />
    <path d="M12 11c0-1.7-1-2.9-2.7-3.3.2 1.8 1.1 2.9 2.7 3.3Z" />
  </g></svg>
);
const BasicsGlyph = ({ size = 44 }: GlyphProps) => (
  <svg {...svg(size)}><g {...stroke}>
    <path d="M7.6 9h8.8v8a2 2 0 0 1-2 2H9.6a2 2 0 0 1-2-2z" />
    <path d="M9 9V6.8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V9" />
    <path d="M9.4 13h5.2" />
  </g></svg>
);
const EkadashiGlyph = ({ size = 44 }: GlyphProps) => (
  <svg {...svg(size)}><g {...stroke}>
    <path d="M6 18C6 11.4 11.4 6 18 6c0 6.6-5.4 12-12 12z" />
    <path d="M6.6 17.4C9.6 14.4 13 12 16.4 10.6" />
  </g></svg>
);
const FestivalGlyph = ({ size = 44 }: GlyphProps) => (
  <svg {...svg(size)}><g {...stroke}>
    <path d="M4.6 14.6h14.8a7.4 7.4 0 0 1-14.8 0z" />
    <path d="M12 13.7c1.5-1.1 1.6-3 .3-4.7a.4.4 0 0 0-.6 0C10.4 10.7 10.5 12.6 12 13.7z" />
  </g></svg>
);

type CoverDef = { accent: string; Glyph: (p: GlyphProps) => ReactElement };
const COVERS: Record<string, CoverDef> = {
  sweets: { accent: "#E3B23C", Glyph: SweetsGlyph },
  mains: { accent: "#D9824F", Glyph: MainsGlyph },
  "rice-bread": { accent: "#E7CE8E", Glyph: RiceGlyph },
  drinks: { accent: "#56B6A4", Glyph: DrinksGlyph },
  chutney: { accent: "#D2654F", Glyph: ChutneyGlyph },
  basics: { accent: "#A9A38C", Glyph: BasicsGlyph },
  ekadashi: { accent: "#7FB169", Glyph: EkadashiGlyph },
  festival: { accent: "#CE6FA1", Glyph: FestivalGlyph },
};

export function coverFor(category: string): CoverDef {
  return COVERS[category] ?? COVERS.basics;
}

function hashSlug(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function RecipeCover({ category, slug, name, glyphSize = 44 }: {
  category: string;
  slug?: string;
  name?: string;
  glyphSize?: number;
}) {
  const c = coverFor(category);
  const Glyph = c.Glyph;
  const h = slug ? hashSlug(slug) : 0;
  const angle = 118 + (h % 44);      // 118…162°
  const glowX = 32 + (h % 36);       // 32…68 %
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", display: "grid", placeItems: "center", overflow: "hidden",
      background: `linear-gradient(${angle}deg, color-mix(in srgb, ${c.accent} 24%, #16120b) 0%, #0a0907 74%)` }}>
      <div aria-hidden style={{ position: "absolute", inset: 0, background: `radial-gradient(72% 52% at ${glowX}% 6%, rgba(255,255,255,.12), transparent 70%)` }} />
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 9, padding: "12px 14px" }}>
        <span style={{ color: `color-mix(in srgb, ${c.accent} 80%, #ffffff 20%)`, display: "inline-flex", filter: `drop-shadow(0 2px 12px color-mix(in srgb, ${c.accent} 42%, transparent))` }}>
          <Glyph size={glyphSize} />
        </span>
        {name && (
          <span style={{ fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: glyphSize >= 56 ? 18 : 14.5, letterSpacing: ".2px", lineHeight: 1.2, color: "rgba(255,255,255,.86)", textAlign: "center", maxWidth: "92%", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{name}</span>
        )}
      </div>
    </div>
  );
}
