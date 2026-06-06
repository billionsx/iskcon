/**
 * NowPlaying — полноэкранный плеер (Apple Music iOS 26 / Liquid Glass).
 * Обложка = наш ВКП (BookHeroCard, презентационный режим).
 * Шапка закреплена; при скролле в ней появляется только название книги.
 * Открывается всегда сверху (без скачка). Контролы закреплены снизу «стеклом».
 * Контент-слой position:absolute inset:0 — гарантированно на всю высоту, без просветов.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { usePlayer, fmtTime, type Track } from "./store";
import { PlayIcon, PauseIcon, PrevIcon, NextIcon, ChevDownIcon, Back15Icon, Fwd15Icon, ShuffleIcon, RepeatIcon, RepeatOneIcon, RepeatLibraryIcon, OrderForwardIcon, OrderReverseIcon } from "./icons";
import { BookHeroCard, ActionBtn } from "../BookHeroCard";
import { BookMenuSheet } from "../BookMenuSheet";
import { QrSheet, type QrData } from "../QrSheet";
import { HeartIcon, ShareIcon, MoreIcon, BookOpenIcon } from "../ui/icons";
import { BOOKS } from "../books";

const GOLD = "#D2AA1B";
const glass = (radius: number): CSSProperties => ({
  background: "rgba(255,255,255,0.10)",
  backdropFilter: "blur(24px) saturate(160%)", WebkitBackdropFilter: "blur(24px) saturate(160%)",
  border: "0.5px solid rgba(255,255,255,0.16)", borderRadius: radius,
});
const glassBtn = (size: number): CSSProperties => ({ ...glass(999), height: size, width: size, display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 });

export function NowPlaying({ onOpenBook, onDonate }: { onOpenBook?: () => void; onDonate?: () => void } = {}) {
  const p = usePlayer();
  const bodyRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLSpanElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [qr, setQr] = useState<{ url: string; data: QrData } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const startY = useRef<number | null>(null);
  const toastTimer = useRef<number | null>(null);

  // открытие: всегда сверху, заголовок-шапка скрыт (без скачка скролла)
  useEffect(() => {
    if (!p.expanded) return;
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    setCollapsed(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [p.expanded]);

  if (!p.active) return null;

  const remaining = p.duration > 0 ? p.duration - p.currentTime : 0;
  const sub = p.track?.kind === "intro" ? "Вступление" : `Глава ${p.track?.chapter ?? ""}`;

  function onDown(e: React.PointerEvent) { startY.current = e.clientY; setDragging(true); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }
  function onMove(e: React.PointerEvent) { if (startY.current == null) return; const dy = e.clientY - startY.current; if (dy > 0) setDrag(dy); }
  function onUp() { if (startY.current == null) return; const d = drag; startY.current = null; setDragging(false); setDrag(0); if (d > 110) p.close(); }

  const BOOK = BOOKS.bg;
  const BOOK_URL = "https://gaurangers.com/book/bg";
  function flash(m: string) { setToast(m); if (toastTimer.current) window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(null), 1900); }
  function shareBook() {
    if (typeof navigator !== "undefined" && navigator.share) navigator.share({ title: BOOK.titleLine1, url: BOOK_URL }).catch(() => {});
    else { try { void navigator.clipboard?.writeText(BOOK_URL); flash("Ссылка скопирована"); } catch { /* ignore */ } }
  }
  function readBook() { p.close(); onOpenBook?.(); }
  function downloadAudio() {
    const t = p.track; if (!t) return;
    try { const a = document.createElement("a"); a.href = t.url; a.download = `${t.title}.mp3`; document.body.appendChild(a); a.click(); a.remove(); flash("Скачивание…"); }
    catch { flash("Не удалось скачать"); }
  }
  function onMenuSelect(id: string) {
    if (id === "qr") { setQr({ url: BOOK_URL, data: { kind: "book", bookTitle: BOOK.titleLine1, bookSubtitle: BOOK.titleLine2, tagline: BOOK.tagline, cover: BOOK.covers[0] } }); return; }
    if (id === "download") { downloadAudio(); return; }
    if (id === "donate") { onDonate?.(); return; }
    if (id === "report") { flash("Сообщить об ошибке — скоро"); return; }
  }
  const coverActions = (
    <>
      <ActionBtn active={favorited} activeColor="#FF453A" ariaLabel="В избранное" onClick={() => { const v = !favorited; setFavorited(v); flash(v ? "Добавлено в избранное" : "Убрано из избранного"); }}><HeartIcon size={18} filled={favorited} /></ActionBtn>
      <ActionBtn ariaLabel="Читать" onClick={readBook}><BookOpenIcon size={18} /></ActionBtn>
      <ActionBtn ariaLabel="Поделиться" onClick={shareBook}><ShareIcon size={18} /></ActionBtn>
      <span ref={moreRef} style={{ display: "inline-flex" }}><ActionBtn ariaLabel="Ещё" onClick={() => setMenuOpen(true)}><MoreIcon size={16} /></ActionBtn></span>
    </>
  );

  return (
    <div
      aria-hidden={!p.expanded}
      style={{
        position: "fixed", top: 0, bottom: 0, left: "50%", width: "100%", maxWidth: 480, zIndex: 95,
        transform: `translateX(-50%) translateY(${p.expanded ? `${drag}px` : "100%"})`,
        transition: dragging ? "none" : "transform .44s cubic-bezier(.32,.72,0,1)",
        background: "#0e0e10", color: "#fff", fontFamily: "var(--font-text)", overflow: "hidden",
      }}
    >
      {/* ambient artwork background */}
      <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <img src={p.cover} alt="" style={{ position: "absolute", inset: "-20%", width: "140%", height: "140%", objectFit: "cover", filter: "blur(72px) saturate(180%) brightness(0.5)", transform: "scale(1.1)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(14,14,16,0.55) 0%, rgba(14,14,16,0.5) 40%, rgba(10,10,12,0.92) 100%)" }} />
      </div>

      {/* content (absolute inset 0 → fills the sheet exactly; no gaps/strips) */}
      <div style={{ position: "absolute", inset: 0, zIndex: 1, display: "flex", flexDirection: "column" }}>
        {/* pinned header: grabber + minimize / (book title on scroll) / close */}
        <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
          style={{
            flexShrink: 0, paddingTop: "calc(env(safe-area-inset-top) + 8px)", paddingBottom: 6, paddingInline: 14, touchAction: "none", cursor: "grab",
            background: collapsed ? "rgba(14,14,16,0.72)" : "transparent",
            backdropFilter: collapsed ? "blur(24px) saturate(160%)" : "none", WebkitBackdropFilter: collapsed ? "blur(24px) saturate(160%)" : "none",
            borderBottom: `0.5px solid ${collapsed ? "rgba(255,255,255,0.10)" : "transparent"}`, transition: "background .25s, border-color .25s",
          }}>
          <div style={{ width: 38, height: 5, borderRadius: 999, background: "rgba(255,255,255,0.5)", margin: "0 auto 8px" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <button type="button" aria-label="Свернуть" onClick={() => p.close()} style={{ ...glass(999), ...iconBtn(38) }}><ChevDownIcon size={22} /></button>
            <div style={{ flex: 1, minWidth: 0, textAlign: "center", fontSize: 13.5, fontWeight: 700, letterSpacing: "-0.01em", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", opacity: collapsed ? 1 : 0, transform: collapsed ? "none" : "translateY(2px)", transition: "opacity .25s, transform .25s" }}>
              {BOOKS.bg?.titleLine1}
            </div>
            <button type="button" aria-label="Закрыть плеер" onClick={() => p.dismiss()} style={{ ...glass(999), ...iconBtn(38) }}>
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" /></svg>
            </button>
          </div>
        </div>

        {/* scroll body: ВКП cover + queue */}
        <div ref={bodyRef} onScroll={(e) => setCollapsed((e.currentTarget as HTMLDivElement).scrollTop > 60)}
          style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch", padding: "6px 16px 16px" }}>
          <BookHeroCard book={BOOKS.bg} presentational coverActions={coverActions} />
          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 12, letterSpacing: "0.5px", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: 6, padding: "0 4px" }}>
              Содержание · {p.mode === "commentary" ? "с комментариями" : "стих за стихом"}
            </div>
            {p.tracks.map((t, i) => (
              <QueueRow key={t.file} t={t} active={i === p.index} onClick={() => p.jumpTo(i)} />
            ))}
          </div>
        </div>

        {/* pinned controls (Liquid Glass) */}
        <div style={{ flexShrink: 0, padding: "12px 20px calc(env(safe-area-inset-bottom) + 12px)", borderTop: "0.5px solid rgba(255,255,255,0.10)",
          background: "rgba(16,16,18,0.62)", backdropFilter: "blur(30px) saturate(160%)", WebkitBackdropFilter: "blur(30px) saturate(160%)" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.track?.title}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 1 }}>{sub}{p.loading ? " · загрузка…" : ""}</div>
          </div>
          <div style={{ marginTop: 8 }}>
            <input type="range" aria-label="Перемотка" min={0} max={Math.max(1, Math.floor(p.duration))} step={1}
              value={Math.floor(p.currentTime)} onChange={(e) => p.seek(Number(e.target.value))}
              style={{ width: "100%", accentColor: GOLD, height: 16, cursor: "pointer" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "rgba(255,255,255,0.5)", marginTop: -1, fontVariantNumeric: "tabular-nums" }}>
              <span>{fmtTime(p.currentTime)}</span><span>−{fmtTime(remaining)}</span>
            </div>
          </div>
          <div style={{ marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
            <button type="button" aria-label="Предыдущая глава" onClick={() => p.prev()} style={iconBtn(44)}><PrevIcon size={27} /></button>
            <button type="button" aria-label="Назад 15 секунд" onClick={() => p.skip(-15)} style={iconBtn(44)}><Back15Icon size={30} /></button>
            <button type="button" aria-label={p.isPlaying ? "Пауза" : "Играть"} onClick={() => p.togglePlay()}
              style={{ ...glass(999), display: "grid", placeItems: "center", height: 64, width: 64, color: "#fff", cursor: "pointer" }}>
              {p.isPlaying ? <PauseIcon size={30} /> : <PlayIcon size={30} />}
            </button>
            <button type="button" aria-label="Вперёд 15 секунд" onClick={() => p.skip(15)} style={iconBtn(44)}><Fwd15Icon size={30} /></button>
            <button type="button" aria-label="Следующая глава" onClick={() => p.next()} style={iconBtn(44)}><NextIcon size={27} /></button>
          </div>
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              <button type="button" aria-pressed={p.order !== "forward"}
                aria-label={p.order === "shuffle" ? "Перемешать" : p.order === "reverse" ? "Обратный порядок" : "По порядку"}
                onClick={() => p.cycleOrder()} style={{ ...glassBtn(38), color: p.order === "forward" ? "rgba(255,255,255,0.75)" : GOLD }}>
                {p.order === "shuffle" ? <ShuffleIcon size={21} /> : p.order === "reverse" ? <OrderReverseIcon size={21} /> : <OrderForwardIcon size={21} />}
              </button>
              <button type="button" aria-pressed={p.repeat !== "off"}
                aria-label={p.repeat === "one" ? "Повтор одного" : p.repeat === "library" ? "Повтор библиотеки" : p.repeat === "book" ? "Повтор книги" : "Повтор"}
                onClick={() => p.cycleRepeat()} style={{ ...glassBtn(38), color: p.repeat === "off" ? "rgba(255,255,255,0.75)" : GOLD }}>
                {p.repeat === "one" ? <RepeatOneIcon size={21} /> : p.repeat === "library" ? <RepeatLibraryIcon size={21} /> : <RepeatIcon size={21} />}
              </button>
              <button type="button" aria-label="Скорость" onClick={() => p.cycleRate()} style={{ ...glass(999), flexShrink: 0, height: 38, padding: "0 14px", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>{p.rate}×</button>
            </div>
            <button type="button" aria-pressed={p.mode === "commentary"} onClick={() => p.setMode(p.mode === "commentary" ? "plain" : "commentary")}
              style={{ height: 38, padding: "0 18px", borderRadius: 999, cursor: "pointer", fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", transition: "background .2s, color .2s, border-color .2s",
                border: p.mode === "commentary" ? "0.5px solid transparent" : "0.5px solid rgba(255,255,255,0.16)",
                background: p.mode === "commentary" ? GOLD : "rgba(255,255,255,0.10)",
                color: p.mode === "commentary" ? "#1a1a1d" : "#fff",
                backdropFilter: "blur(24px) saturate(160%)", WebkitBackdropFilter: "blur(24px) saturate(160%)" }}>
              С комментариями
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: "calc(env(safe-area-inset-bottom) + 234px)", zIndex: 6, ...glass(999), padding: "10px 18px", color: "#fff", fontSize: 14, fontWeight: 500, whiteSpace: "nowrap", boxShadow: "0 10px 36px rgba(0,0,0,0.45)" }}>{toast}</div>
      )}
      {qr && <QrSheet url={qr.url} data={qr.data} onClose={() => setQr(null)} />}
      <BookMenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} onSelect={onMenuSelect} variant="player" anchorRef={moreRef} />
    </div>
  );
}

function QueueRow({ t, active, onClick }: { t: Track; active: boolean; onClick: () => void }) {
  const num = t.kind === "intro" ? "•" : String(t.chapter);
  return (
    <button type="button" onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", padding: "10px 8px", borderRadius: 12, border: "none", cursor: "pointer",
        background: active ? "rgba(210,170,27,0.16)" : "transparent", color: "#fff" }}>
      <span style={{ width: 22, textAlign: "center", flexShrink: 0, fontSize: 13, fontWeight: 600, color: active ? GOLD : "rgba(255,255,255,0.45)", fontVariantNumeric: "tabular-nums" }}>{num}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: active ? 600 : 400, color: active ? "#fff" : "rgba(255,255,255,0.85)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</span>
      {t.durationSec ? <span style={{ flexShrink: 0, fontSize: 12, color: "rgba(255,255,255,0.4)", fontVariantNumeric: "tabular-nums" }}>{fmtTime(t.durationSec)}</span> : null}
    </button>
  );
}

function iconBtn(size: number): CSSProperties {
  return { display: "grid", placeItems: "center", height: size, width: size, flexShrink: 0, borderRadius: "50%", border: "none", background: "transparent", color: "#fff", cursor: "pointer" };
}
