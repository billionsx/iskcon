/**
 * BhajanCard — компактный универсальный карточный модуль бхаджана.
 * У бхаджана НЕТ обложки, поэтому карточка не использует крупное 4/5-панно
 * (как книжная ВКП), а компактна (~⅓ высоты) и удобна для длинных списков.
 * Один модуль для ВКБ (витрина-список) и как шапка ПКБ (детальная).
 *
 * Состав (необходимый минимум): чип-категория · действия (избранное·наушники·⋯)
 * · название (до 2 строк) · автор. Тёмное панно GRAPHITE — в одном языке с
 * брендом, без растянутого дженерик-лого.
 */
import type { ReactNode } from "react";
import { HeartIcon, HeadphonesIcon, MoreIcon } from "./ui/icons";
import { useFavorite, useCardActions } from "./cardActions";
import { usePlayer } from "./player/store";

const GRAPHITE = "radial-gradient(130% 130% at 25% 0%, #34343a 0%, #26262b 52%, #1b1b1f 100%)";

function GlassBtn({ active, activeColor, ariaLabel, onClick, children }: { active?: boolean; activeColor?: string; ariaLabel: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={ariaLabel} aria-pressed={active}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{ display: "grid", height: 28, width: 28, placeItems: "center", borderRadius: "50%", border: "none", cursor: "pointer", background: "rgba(255,255,255,.12)", color: active && activeColor ? activeColor : "#fff", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", transition: "background .2s" }}>
      {children}
    </button>
  );
}

export interface BhajanCardData {
  slug: string;
  name: string;
  author: string | null;
  category?: string | null;
  sourceText?: string | null;
  section?: string | null;
  hasRecordings?: boolean;
}

export function BhajanCard({ bhajan, onOpen, flash }: { bhajan: BhajanCardData; onOpen?: () => void; flash?: (m: string) => void }) {
  const { on: favorited, toggle: toggleFav } = useFavorite(`bhajan:${bhajan.slug}`, { t: bhajan.name, s: bhajan.author || undefined, h: `/bhajan/${bhajan.slug}` });
  const { openCardMenu } = useCardActions();
  const player = usePlayer();
  const chip = bhajan.category || bhajan.sourceText || bhajan.section || null;
  const onListen = () => { if (bhajan.hasRecordings) player.playBhajan(bhajan.slug, 0); else flash?.("Записей пока нет"); };
  const openMore = () => openCardMenu({
    type: "bhajan", id: bhajan.slug, title: bhajan.name, subtitle: bhajan.author || undefined,
    url: `https://gaurangers.com/bhajan/${encodeURIComponent(bhajan.slug)}`,
    context: `Бхаджан · ${bhajan.name} · /bhajan/${bhajan.slug}`,
  });

  return (
    <article style={{ position: "relative", width: "100%", borderRadius: 16, overflow: "hidden", background: GRAPHITE, border: "0.5px solid var(--color-hairline, rgba(0,0,0,.08))", boxShadow: "var(--shadow-card, 0 6px 20px rgba(0,0,0,.14))" }}>
      {onOpen && <button type="button" aria-label="Открыть бхаджан" onClick={onOpen} style={{ position: "absolute", inset: 0, zIndex: 10, background: "none", border: "none", cursor: "pointer" }} />}
      <div style={{ position: "relative", zIndex: 20, padding: "14px 16px", pointerEvents: "none", fontFamily: "var(--font-text)" }}>
        {/* верхний ряд: чип-категория · действия */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 28 }}>
          {chip
            ? <span style={{ display: "inline-flex", alignItems: "center", maxWidth: "58%", borderRadius: 999, background: "rgba(255,255,255,.14)", height: 22, padding: "0 10px", fontSize: "var(--text-caption)", lineHeight: 1, fontWeight: 500, color: "rgba(255,255,255,.9)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{chip}</span>
            : <span />}
          <div style={{ display: "flex", alignItems: "center", gap: 6, pointerEvents: "auto" }}>
            <GlassBtn active={favorited} activeColor="#FF453A" ariaLabel="В избранное" onClick={() => toggleFav(flash)}><HeartIcon size={15} filled={favorited} /></GlassBtn>
            <GlassBtn ariaLabel="Слушать" onClick={onListen}><HeadphonesIcon size={15} /></GlassBtn>
            <GlassBtn ariaLabel="Ещё" onClick={openMore}><MoreIcon size={14} /></GlassBtn>
          </div>
        </div>
        {/* название · автор */}
        <h3 style={{ margin: "11px 0 0", fontSize: 18.5, lineHeight: 1.22, fontWeight: 700, letterSpacing: "-0.01em", color: "#fff", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{bhajan.name}</h3>
        {bhajan.author && <p style={{ margin: "5px 0 0", fontSize: 13.5, lineHeight: 1.3, color: "rgba(255,255,255,.64)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{bhajan.author}</p>}
      </div>
    </article>
  );
}
