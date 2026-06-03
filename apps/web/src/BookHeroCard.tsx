/**
 * BookHeroCard — the ONE card module (юнит-стандарт).
 * Used identically by the showcase card on the feed (ВКП) and by the
 * detail-page hero (ПКП). Content comes from books.ts; only `topLeft`
 * (logo vs back) and `onOpen` (feed taps to open) differ between contexts.
 * Standard action set: избранное · AirPods · в корзину · ⋯.
 */
import { useState, type ReactNode } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { BOOK_MENU_ITEMS, type BookData } from "./books";
import { HeartIcon, AirPodsIcon, BagIcon, MoreIcon } from "./ui/icons";

const GRAPHITE = "radial-gradient(120% 80% at 50% 0%, #3a3a40 0%, #2a2a2f 45%, #1b1b1f 100%)";

function ActionBtn({ active, activeColor, ariaLabel, onClick, children }: { active?: boolean; activeColor?: string; ariaLabel: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={ariaLabel} aria-pressed={active}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{ display: "grid", height: 36, width: 36, placeItems: "center", borderRadius: "50%", border: "none", cursor: "pointer", background: "rgba(255,255,255,.12)", color: active && activeColor ? activeColor : "#fff", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", transition: "background .2s" }}>
      {children}
    </button>
  );
}

function CardMenu({ open, onClose, onSelect }: { open: boolean; onClose: () => void; onSelect?: (label: string) => void }) {
  if (!open) return null;
  return (
    <div onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ position: "fixed", inset: 0, zIndex: 90, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,.4)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "var(--color-bg-2, #fff)", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: "8px 0 max(8px, env(safe-area-inset-bottom))", boxShadow: "0 -8px 40px rgba(0,0,0,.18)" }}>
        <div style={{ height: 5, width: 36, borderRadius: 999, background: "var(--color-hairline, rgba(0,0,0,.12))", margin: "8px auto 12px" }} />
        {BOOK_MENU_ITEMS.map((label) => (
          <button key={label} onClick={() => { onClose(); onSelect?.(label); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "14px 20px", background: "none", border: "none", fontFamily: "var(--font-text)", fontSize: 17, color: "var(--color-label, #1f2024)", cursor: "pointer" }}>{label}</button>
        ))}
      </div>
    </div>
  );
}

export function BookHeroCard({ book, topLeft, onOpen, flash, onMenuSelect }: { book: BookData; topLeft?: ReactNode; onOpen?: () => void; flash?: (m: string) => void; onMenuSelect?: (label: string) => void }) {
  const [favorited, setFavorited] = useState(false);
  const [inCart, setInCart] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const n = book.covers.length;
  const next = (e?: ReactMouseEvent) => { e?.stopPropagation(); setIdx(i => (i + 1) % n); };
  const prev = (e?: ReactMouseEvent) => { e?.stopPropagation(); setIdx(i => (i - 1 + n) % n); };

  return (
    <>
      <article
        style={{
          position: "relative", width: "100%", aspectRatio: "4 / 5", overflow: "hidden", borderRadius: 20,
          border: "0.5px solid var(--color-hairline, rgba(0,0,0,.08))", background: GRAPHITE,
          boxShadow: "var(--shadow-card, 0 8px 30px rgba(0,0,0,.12))",
          display: "flex", flexDirection: "column", justifyContent: "flex-end",
        }}>
        {book.covers.map((src, i) => (
          <img key={src} src={src} alt={book.titleLine1} loading={i === 0 ? "eager" : "lazy"} decoding="async" draggable={false}
            style={{ position: "absolute", inset: 0, height: "100%", width: "100%", objectFit: "cover", opacity: i === idx ? 1 : 0, transition: "opacity .35s ease" }} />
        ))}
        <div aria-hidden style={{ position: "absolute", insetInline: 0, top: 0, height: 120, pointerEvents: "none", background: "linear-gradient(to bottom, rgba(0,0,0,.55) 0%, rgba(0,0,0,0) 100%)" }} />
        <div aria-hidden style={{ position: "absolute", insetInline: 0, bottom: 0, height: "78%", pointerEvents: "none", background: "linear-gradient(to top, rgba(0,0,0,.92) 0%, rgba(0,0,0,.6) 42%, rgba(0,0,0,0) 100%)" }} />

        {onOpen && <button type="button" aria-label="Открыть книгу" onClick={() => onOpen()} style={{ position: "absolute", inset: 0, zIndex: 10, background: "none", border: "none", cursor: "pointer" }} />}
        {n > 1 && (
          <>
            <button type="button" aria-label="Предыдущее изображение" onClick={prev} style={{ position: "absolute", top: 56, bottom: "42%", left: 0, width: "22%", zIndex: 15, background: "none", border: "none", cursor: "pointer" }} />
            <button type="button" aria-label="Следующее изображение" onClick={next} style={{ position: "absolute", top: 56, bottom: "42%", right: 0, width: "22%", zIndex: 15, background: "none", border: "none", cursor: "pointer" }} />
          </>
        )}

        {/* TOP: topLeft slot (logo / back) · counter + standard actions */}
        <div style={{ position: "absolute", insetInline: 20, top: 20, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ display: "flex", alignItems: "center", color: "#fff", minWidth: 0 }}>{topLeft}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ borderRadius: 999, background: "rgba(0,0,0,.55)", padding: "2px 8px", fontSize: 11, fontWeight: 600, color: "#fff", backdropFilter: "blur(12px)" }}>{idx + 1} / {n}</span>
            <ActionBtn active={favorited} activeColor="#FF453A" ariaLabel="В избранное" onClick={() => { const v = !favorited; setFavorited(v); flash?.(v ? "Добавлено в избранное" : "Убрано из избранного"); }}><HeartIcon size={18} filled={favorited} /></ActionBtn>
            <ActionBtn ariaLabel="Слушать" onClick={() => flash?.("Аудиокнига — скоро")}><AirPodsIcon size={18} /></ActionBtn>
            <ActionBtn active={inCart} activeColor="#4a86e8" ariaLabel={inCart ? "Убрать из корзины" : "В корзину"} onClick={() => { const v = !inCart; setInCart(v); flash?.(v ? "Добавлено в корзину" : "Убрано из корзины"); }}><BagIcon size={18} cornerGlyph={inCart ? "minus" : "plus"} /></ActionBtn>
            <ActionBtn ariaLabel="Ещё" onClick={() => setMenuOpen(true)}><MoreIcon size={16} /></ActionBtn>
          </div>
        </div>

        {/* INFO — bottom */}
        <div onClick={() => onOpen?.()} style={{ position: "relative", zIndex: 20, padding: 20, cursor: onOpen ? "pointer" : "default", fontFamily: "var(--font-text)", pointerEvents: "none" }}>
          <h3 style={{ margin: 0, fontSize: 36, lineHeight: 1.04, fontWeight: 800, letterSpacing: "-0.03em", color: "#fff", whiteSpace: "nowrap" }}>{book.titleLine1}</h3>
          {book.titleLine2 && <div style={{ marginTop: 2, fontSize: 25, lineHeight: 1.1, fontWeight: 600, letterSpacing: "-0.02em", color: "rgba(255,255,255,.95)" }}>{book.titleLine2}</div>}
          <div style={{ marginTop: 6, fontSize: 15, lineHeight: 1.3, fontWeight: 400, letterSpacing: "-0.01em", color: "rgba(255,255,255,.72)" }}>{book.iast}<span style={{ margin: "0 6px", color: "rgba(255,255,255,.4)" }}>·</span>{book.tagline}</div>
          <p style={{ margin: "16px 0 0", fontSize: 15, lineHeight: 1.35, fontWeight: 400, letterSpacing: "-0.01em", color: "rgba(255,255,255,.92)" }}>{book.author}</p>
          <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.35, fontWeight: 400, letterSpacing: "-0.01em", color: "rgba(255,255,255,.82)" }}>{book.description}</p>
          <div style={{ marginTop: 20, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
            {book.chips.map(c => (
              <span key={c} style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, background: "rgba(255,255,255,.16)", height: 26, padding: "0 12px", fontSize: 13, lineHeight: 1, fontWeight: 500, letterSpacing: "-0.01em", color: "#fff" }}>{c}</span>
            ))}
          </div>
        </div>
      </article>
      <CardMenu open={menuOpen} onClose={() => setMenuOpen(false)} onSelect={onMenuSelect} />
    </>
  );
}
