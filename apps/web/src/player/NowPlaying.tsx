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
import { ReportSheet } from "../ReportSheet";
import { HeartIcon, MoreIcon, BookOpenIcon } from "../ui/icons";
import { BOOKS, bookFullTitle } from "../books";
import { albumById } from "../kirtans";
import { type SubTabDef } from "../SectionSubTabs";

const GOLD = "#D2AA1B";
const glass = (radius: number): CSSProperties => ({
  background: "rgba(255,255,255,0.10)",
  backdropFilter: "blur(24px) saturate(160%)", WebkitBackdropFilter: "blur(24px) saturate(160%)",
  border: "0.5px solid rgba(255,255,255,0.16)", borderRadius: radius,
});
const bareBtn = (size: number): CSSProperties => ({ height: size, width: size, display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0, background: "none", border: "none", padding: 0 });

export function NowPlaying({ onOpenBook, onDonate }: { onOpenBook?: (book: string, chapter?: number | null) => void; onDonate?: () => void } = {}) {
  const p = usePlayer();
  const bodyRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLSpanElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [qr, setQr] = useState<{ url: string; data: QrData } | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
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

  // Песни/лилы для суб-табов очереди — выводим из самих треков (иерархические книги).
  const divisions: SubTabDef[] = [];
  const seenDiv = new Set<string>();
  for (const t of p.tracks) { if (t.lila && !seenDiv.has(t.lila)) { seenDiv.add(t.lila); divisions.push({ id: t.lila, label: t.lilaLabel ?? t.lila }); } }
  const hierQueue = divisions.length > 1;
  const [activeDiv, setActiveDiv] = useState("");
  // Активный подраздел следует за играющим треком; тап пользователя сохраняется,
  // пока воспроизведение не пересечёт границу песни/лилы.
  useEffect(() => {
    if (!hierQueue) return;
    const cur = p.track?.lila;
    setActiveDiv((prev) => cur ?? (prev || divisions[0]?.id || ""));
  }, [p.track?.lila, hierQueue]);

  if (!p.active) return null;

  const remaining = p.duration > 0 ? p.duration - p.currentTime : 0;
  const isKirtan = p.kind === "kirtan";
  const sub = isKirtan
    ? (p.artist || "Киртан")
    : p.track?.kind === "intro" ? "Вступление"
      : p.track?.lilaLabel ? `${p.track.lilaLabel} · Глава ${p.track?.chapter ?? ""}`
        : `Глава ${p.track?.chapter ?? ""}`;

  function onDown(e: React.PointerEvent) { startY.current = e.clientY; setDragging(true); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }
  function onMove(e: React.PointerEvent) { if (startY.current == null) return; const dy = e.clientY - startY.current; if (dy > 0) setDrag(dy); }
  function onUp() { if (startY.current == null) return; const d = drag; startY.current = null; setDragging(false); setDrag(0); if (d > 110) p.close(); }

  const BOOK = BOOKS[p.book] ?? BOOKS.bg;
  const ORIGIN = "https://gaurangers.com";
  const artistSlug = isKirtan ? (albumById(p.book)?.artist ?? "") : "";
  const kirtanUrl = artistSlug ? `${ORIGIN}/kirtan/${artistSlug}` : ORIGIN;
  const ch = p.track?.kind === "chapter" ? (p.track?.chapter ?? null) : null;
  const isChapter = ch != null;
  const bookUrl = `${ORIGIN}/book/${p.book}?listen`;
  const lila = p.track?.lila;   // ЧЧ/ШБ
  const chapterUrl = isChapter
    ? (p.book === "bg"
        ? `${ORIGIN}/book/bg/${ch}?listen`
        : (lila ? `${ORIGIN}/book/${p.book}/${lila}/${ch}?listen` : bookUrl))
    : bookUrl;
  function flash(m: string) { setToast(m); if (toastTimer.current) window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(null), 1900); }
  function doShare(url: string, title: string) {
    if (typeof navigator !== "undefined" && navigator.share) navigator.share({ title, url }).catch(() => {});
    else { try { void navigator.clipboard?.writeText(url); flash("Ссылка скопирована"); } catch { /* ignore */ } }
  }
  function readBook() { p.close(); onOpenBook?.(p.book, isChapter && p.book === "bg" ? ch : null); }
  function downloadChapter() {
    const t = p.track; if (!t) return;
    try { const a = document.createElement("a"); a.href = t.url; a.download = `${t.title}.mp3`; document.body.appendChild(a); a.click(); a.remove(); flash("Скачивание…"); }
    catch { flash("Не удалось скачать"); }
  }
  function bookQr() { setQr({ url: bookUrl, data: { kind: "book", bookTitle: bookFullTitle(BOOK), tagline: BOOK.tagline, cover: BOOK.covers[0] } }); }
  function chapterQr() { if (!isChapter) { bookQr(); return; } setQr({ url: chapterUrl, data: { kind: "chapter", bookTitle: bookFullTitle(BOOK), chapterNumber: String(ch), chapterTitle: p.track?.title ?? "" } }); }
  function onMenuSelect(id: string) {
    if (id === "share-album") { doShare(kirtanUrl, `${p.bookTitle}${p.artist ? ` · ${p.artist}` : ""}`); return; }
    if (id === "download-track") { downloadChapter(); return; }
    if (id === "share-chapter") { doShare(chapterUrl, `${bookFullTitle(BOOK)} — Глава ${ch}`); return; }
    if (id === "qr-chapter") { chapterQr(); return; }
    if (id === "download-chapter") { downloadChapter(); return; }
    if (id === "share-book") { doShare(bookUrl, bookFullTitle(BOOK)); return; }
    if (id === "qr-book") { bookQr(); return; }
    if (id === "donate") { onDonate?.(); return; }
    if (id === "report") { setReportOpen(true); return; }
  }
  const coverActions = (
    <>
      <ActionBtn active={favorited} activeColor="#FF453A" ariaLabel="В избранное" onClick={() => { const v = !favorited; setFavorited(v); flash(v ? "Добавлено в избранное" : "Убрано из избранного"); }}><HeartIcon size={18} filled={favorited} /></ActionBtn>
      {!isKirtan && <ActionBtn ariaLabel="Читать" onClick={readBook}><BookOpenIcon size={18} /></ActionBtn>}
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
            <div style={{ flex: 1, minWidth: 0, paddingLeft: 4, opacity: collapsed ? 1 : 0, transform: collapsed ? "none" : "translateY(2px)", transition: "opacity .25s, transform .25s", pointerEvents: "none" }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: "-0.01em", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.25 }}>{p.track?.title}</div>
              <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.25 }}>{isKirtan ? `${p.bookTitle}${p.artist ? ` · ${p.artist}` : ""}` : `${sub} · ${bookFullTitle(BOOK)}`}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div aria-hidden={!collapsed}
                style={{ display: "flex", alignItems: "center", gap: 6, opacity: collapsed ? 1 : 0, transform: collapsed ? "none" : "translateY(2px)", transition: "opacity .25s, transform .25s", pointerEvents: collapsed ? "auto" : "none" }}>
                <button type="button" aria-label="В избранное" onClick={() => { const v = !favorited; setFavorited(v); flash(v ? "Добавлено в избранное" : "Убрано из избранного"); }} style={{ ...glass(999), ...iconBtn(34), color: favorited ? "#FF453A" : "#fff" }}><HeartIcon size={17} filled={favorited} /></button>
                {!isKirtan && <button type="button" aria-label="Читать" onClick={readBook} style={{ ...glass(999), ...iconBtn(34) }}><BookOpenIcon size={17} /></button>}
                <button type="button" aria-label="Ещё" onClick={() => setMenuOpen(true)} style={{ ...glass(999), ...iconBtn(34) }}><MoreIcon size={15} /></button>
              </div>
              <button type="button" aria-label="Закрыть плеер" onClick={() => p.dismiss()} style={{ ...glass(999), ...iconBtn(38) }}>
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" /></svg>
              </button>
            </div>
          </div>
        </div>

        {/* scroll body: ВКП cover + queue */}
        <div ref={bodyRef} onScroll={(e) => setCollapsed((e.currentTarget as HTMLDivElement).scrollTop > 60)}
          style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch", padding: "6px 16px 16px" }}>
          {isKirtan
            ? <KirtanHero cover={p.cover} title={p.bookTitle} artist={p.artist} note={albumById(p.book)?.note} coverActions={coverActions} />
            : <BookHeroCard book={BOOKS[p.book] ?? BOOKS.bg} presentational coverActions={coverActions} />}
          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 12, letterSpacing: "0.5px", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: hierQueue ? 11 : 6, padding: "0 4px" }}>
              {isKirtan ? "Дорожки" : `Содержание${p.hasCommentary ? ` · ${p.mode === "commentary" ? "с комментариями" : "стих за стихом"}` : ""}`}
            </div>
            {hierQueue && <DivisionPills items={divisions} active={activeDiv} onChange={setActiveDiv} />}
            <div style={{ paddingTop: hierQueue ? 10 : 0 }}>
              {p.tracks.map((t, i) => {
                // иерархическая книга: показываем только активную песнь/лилу
                // (вступление без лилы — при активной первой песне/лиле).
                if (hierQueue) {
                  const show = t.lila ? t.lila === activeDiv : activeDiv === divisions[0]?.id;
                  if (!show) return null;
                }
                return <QueueRow key={t.file} t={t} active={i === p.index} num={isKirtan ? i + 1 : undefined} onClick={() => p.jumpTo(i)} />;
              })}
            </div>
          </div>
        </div>

        {/* pinned controls (Liquid Glass) */}
        <div style={{ flexShrink: 0, padding: "12px 20px calc(env(safe-area-inset-bottom) + 12px)", borderTop: "0.5px solid rgba(255,255,255,0.10)",
          background: "rgba(16,16,18,0.62)", backdropFilter: "blur(30px) saturate(160%)", WebkitBackdropFilter: "blur(30px) saturate(160%)" }}>
          <div style={{ minWidth: 0, maxHeight: collapsed ? 0 : 56, opacity: collapsed ? 0 : 1, overflow: "hidden", transition: "max-height .28s ease, opacity .18s ease" }}>
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
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              <button type="button" aria-pressed={p.order !== "forward"}
                aria-label={p.order === "shuffle" ? "Перемешать" : p.order === "reverse" ? "Обратный порядок" : "По порядку"}
                onClick={() => p.cycleOrder()} style={{ ...bareBtn(34), color: p.order === "forward" ? "rgba(255,255,255,0.55)" : GOLD }}>
                {p.order === "shuffle" ? <ShuffleIcon size={22} /> : p.order === "reverse" ? <OrderReverseIcon size={22} /> : <OrderForwardIcon size={22} />}
              </button>
              <button type="button" aria-pressed={p.repeat !== "off"}
                aria-label={p.repeat === "one" ? "Повтор одного" : p.repeat === "library" ? "Повтор библиотеки" : p.repeat === "book" ? "Повтор книги" : "Повтор"}
                onClick={() => p.cycleRepeat()} style={{ ...bareBtn(34), color: p.repeat === "off" ? "rgba(255,255,255,0.55)" : GOLD }}>
                {p.repeat === "one" ? <RepeatOneIcon size={22} /> : p.repeat === "library" ? <RepeatLibraryIcon size={22} /> : <RepeatIcon size={22} />}
              </button>
              <button type="button" aria-label="Скорость" aria-pressed={p.rate !== 1} onClick={() => p.cycleRate()}
                style={{ background: "none", border: "none", padding: "0 4px", height: 34, cursor: "pointer", flexShrink: 0, fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", fontFamily: "var(--font-text)", color: p.rate !== 1 ? GOLD : "rgba(255,255,255,0.55)" }}>{p.rate}×</button>
            </div>
            {p.hasCommentary && <button type="button" aria-pressed={p.mode === "commentary"} onClick={() => p.setMode(p.mode === "commentary" ? "plain" : "commentary")}
              style={{ background: "none", border: "none", padding: "0 4px", height: 34, cursor: "pointer", whiteSpace: "nowrap", fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", fontFamily: "var(--font-text)", transition: "color .2s", color: p.mode === "commentary" ? GOLD : "rgba(255,255,255,0.72)" }}>
              С комментариями
            </button>}
          </div>
        </div>
      </div>

      {toast && (
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: "calc(env(safe-area-inset-bottom) + 234px)", zIndex: 6, ...glass(999), padding: "10px 18px", color: "#fff", fontSize: 14, fontWeight: 500, whiteSpace: "nowrap", boxShadow: "0 10px 36px rgba(0,0,0,0.45)" }}>{toast}</div>
      )}
      {qr && <QrSheet url={qr.url} data={qr.data} onClose={() => setQr(null)} />}
      <ReportSheet open={reportOpen} onClose={() => setReportOpen(false)} context={`Аудио · ${sub}${p.track?.title ? ` · «${p.track.title}»` : ""}`} />
      <BookMenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} onSelect={onMenuSelect} variant={isKirtan ? "kirtan" : "player"} isChapter={isChapter} anchorRef={moreRef} />
    </div>
  );
}

/**
 * DivisionPills — переключатель песней/лил очереди плеера.
 * Горизонтально-прокручиваемые сегментные пилюли (идиома iOS-чипов): без липкой
 * стеклянной полосы поверх картины и без full-bleed-кромки, в потоке контента,
 * выровнены с эйброу «Содержание». Активная — белая стеклянная заливка (золото
 * закреплено за действием/прогрессом, не за положением в навигации).
 * Прокрутка покрывает и 3 лилы ЧЧ, и 12 песней ШБ; активная сама центрируется.
 */
function DivisionPills({ items, active, onChange }: { items: SubTabDef[]; active: string; onChange: (id: string) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  useEffect(() => {
    const el = itemRefs.current[active]; const cont = scrollRef.current;
    if (!el || !cont) return;
    const target = el.offsetLeft - (cont.clientWidth - el.clientWidth) / 2;
    cont.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [active]);
  return (
    <div ref={scrollRef} role="tablist" aria-label="Песни и лилы"
      style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch", margin: "0 -16px", padding: "0 16px 2px 20px" }}>
      {items.map((it) => {
        const on = it.id === active;
        return (
          <button key={it.id} ref={(el) => { itemRefs.current[it.id] = el; }} type="button" role="tab" aria-selected={on} onClick={() => onChange(it.id)}
            style={{ flexShrink: 0, padding: "7px 15px", borderRadius: 999,
              border: `0.5px solid ${on ? "rgba(255,255,255,0.18)" : "transparent"}`,
              background: on ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.06)",
              color: on ? "#fff" : "rgba(255,255,255,0.6)",
              fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1, whiteSpace: "nowrap",
              cursor: "pointer", fontFamily: "var(--font-text)", transition: "background .18s, color .18s, border-color .18s", WebkitTapHighlightColor: "transparent" }}>
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * KirtanHero — обложка Now Playing для киртанов/бхаджанов: квадратное панно
 * альбома (картинка IA-элемента) с мягкой тенью, под ним название, исполнитель
 * и ряд действий (избранное · ещё). Зеркалит презентационный BookHeroCard, но
 * квадратное под аудио-альбом, а не книжная обложка.
 */
function KirtanHero({ cover, title, artist, note, coverActions }: { cover: string; title: string; artist: string; note?: string | null; coverActions?: React.ReactNode }) {
  return (
    <div style={{ paddingTop: 6 }}>
      <div style={{ position: "relative", width: "100%", maxWidth: 340, margin: "0 auto", aspectRatio: "1 / 1", borderRadius: 18, overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.5)", background: "rgba(255,255,255,0.06)", border: "0.5px solid rgba(255,255,255,0.12)" }}>
        <img src={cover} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginTop: 18 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: "#fff", lineHeight: 1.18 }}>{title}</div>
          {artist && <div style={{ fontSize: 15, fontWeight: 500, color: GOLD, marginTop: 3 }}>{artist}</div>}
          {note && <div style={{ fontSize: 12.5, lineHeight: 1.45, color: "rgba(255,255,255,0.55)", marginTop: 7 }}>{note}</div>}
        </div>
      </div>
      {coverActions && <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>{coverActions}</div>}
    </div>
  );
}

function QueueRow({ t, active, num, onClick }: { t: Track; active: boolean; num?: number; onClick: () => void }) {
  const label = t.kind === "intro" ? "•" : t.chapter != null ? String(t.chapter) : (num != null ? String(num) : "•");
  return (
    <button type="button" onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", padding: "10px 8px", borderRadius: 12, border: "none", cursor: "pointer",
        background: active ? "rgba(210,170,27,0.16)" : "transparent", color: "#fff" }}>
      <span style={{ width: 22, textAlign: "center", flexShrink: 0, fontSize: 13, fontWeight: 600, color: active ? GOLD : "rgba(255,255,255,0.45)", fontVariantNumeric: "tabular-nums" }}>{label}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: active ? 600 : 400, color: active ? "#fff" : "rgba(255,255,255,0.85)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</span>
      {t.durationSec ? <span style={{ flexShrink: 0, fontSize: 12, color: "rgba(255,255,255,0.4)", fontVariantNumeric: "tabular-nums" }}>{fmtTime(t.durationSec)}</span> : null}
    </button>
  );
}

function iconBtn(size: number): CSSProperties {
  return { display: "grid", placeItems: "center", height: size, width: size, flexShrink: 0, borderRadius: "50%", border: "none", background: "transparent", color: "#fff", cursor: "pointer" };
}
