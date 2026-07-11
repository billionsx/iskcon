/**
 * BhajanDetailPage — ПКБ (Подробная Карточка Бхаджана) по книжному стандарту
 * читалки (ScriptureReader): scroll-edge навбар (назад + титул на скролле) →
 * выразительная чистая шапка (eyebrow-категория · крупное название · автор ·
 * действия) БЕЗ тёмной карточки и налезаний → стихи, каждый — отдельная богатая
 * карточка (Стих N · транслитерация Georgia-курсивом · перевод SF).
 *
 * Интерфейс — SF (var(--font-text/display)); священный текст — Georgia
 * (var(--font-scripture)). Размеры/цвета/радиусы/ритм — токены ui/globals.css.
 * Действия (избранное · наушники · ⋯) и меню — общий слой cardActions; меню в
 * варианте «bhajan» (Поделиться · QR · Задонатить · Сообщить — без книжного PDF).
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { SVGProps } from "react";
import { api } from "./api";
import { useFavorite, useCardActions } from "./cardActions";
import { usePlayer } from "./player/store";
import { MediaViewer, type ViewerMedia } from "./MediaViewer";
import { NotesAtSource } from "./NotesAtSource";
import { HeartIcon, HeadphonesIcon, MoreIcon } from "./ui/icons";

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> { size?: number; }
const sp = ({ size = 24 }: IconProps) => ({ width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true as const });
const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function BackIcon(p: IconProps) { return <svg {...sp(p)}><path {...STROKE} d="M15 5l-7 7 7 7" /></svg>; }

/** Плоская иконочная кнопка как в книжной читалке: прозрачная в покое, лёгкая
 *  заливка при нажатии; без постоянного серого круга. */
function PlainBtn({ ariaLabel, onClick, active, color, children }: { ariaLabel: string; onClick: () => void; active?: boolean; color?: string; children: React.ReactNode }) {
  const [pressed, setPressed] = useState(false);
  const off = () => setPressed(false);
  return (
    <button type="button" aria-label={ariaLabel} onClick={onClick}
      onPointerDown={() => setPressed(true)} onPointerUp={off} onPointerLeave={off} onPointerCancel={off}
      style={{ display: "grid", height: 36, width: 36, placeItems: "center", borderRadius: "50%", border: "none", cursor: "pointer", color: active && color ? color : "var(--color-label)", background: pressed ? "var(--color-fill-2, rgba(120,120,128,.12))" : "transparent", transition: "background .12s", WebkitTapHighlightColor: "transparent", flexShrink: 0 }}>
      {children}
    </button>
  );
}

interface WBW { t: string; m: string; }
interface Verse { ord: number; translit: string | null; text: string | null; signature: string | null; words?: WBW[]; }
interface MediaItem { title: string | null; subtitle: string | null; duration: string | null; url: string | null; media_type: string | null; platform: string | null; ext_id: string | null; description: string | null; date: string | null; }
interface BhajanMedia { recordings: MediaItem[]; lectures: MediaItem[]; scores: MediaItem[]; commentaries: MediaItem[]; }
interface BhajanDetail {
  slug: string; name: string; author: string | null; hero_image: string | null;
  author_entity?: string | null; author_entity_title?: string | null;
  category: string | null; source_text: string | null; section: string | null;
  source_credit: string | null;
  verses: Verse[]; translit: string | null; translation: string | null;
  media?: BhajanMedia;
  body: string; pending: boolean;
}

function verseLabel(ord: number): string { return `Стих ${ord}`; }

/* Транслитерация: каждая строка — в ОДНУ визуальную строку (без переноса).
 * Размер шрифта авто-ужимается под ширину контейнера по самой длинной строке. */
function FitText({ text, max = 18.5, min = 12, style }: { text: string; max?: number; min?: number; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const lastW = useRef(-1);
  const [size, setSize] = useState(max);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const avail = el.clientWidth;
      if (!avail) return;
      lastW.current = avail;
      el.style.fontSize = max + "px";
      const need = el.scrollWidth;
      setSize(need > avail ? Math.max(min, Math.floor((max * avail / need) * 10) / 10) : max);
    };
    fit();
    const ro = new ResizeObserver(() => {
      const el2 = ref.current;
      if (el2 && el2.clientWidth !== lastW.current) fit();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, max, min]);
  return <div ref={ref} style={{ ...style, fontSize: size + "px", whiteSpace: "pre", overflow: "hidden" }}>{text}</div>;
}

/* eyebrow-метка (Caption2, uppercase, трекинг) */
function Eyebrow({ children, blue }: { children: React.ReactNode; blue?: boolean }) {
  return <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: "var(--weight-semibold)", letterSpacing: "var(--tracking-wide)", textTransform: "uppercase", color: blue ? "var(--color-gold-deep)" : "var(--color-label-2)" }}>{children}</div>;
}

/** Карточка стиха — тапабельное превью (как строка стиха в главе книги): метка ·
 *  транслитерация (Georgia) · перевод (SF) · шеврон. Пословный перевод и фокус —
 *  на экране стиха. */
function VerseCard({ v, onOpen }: { v: Verse; onOpen?: () => void }) {
  return (
    <section onClick={onOpen} role={onOpen ? "button" : undefined} tabIndex={onOpen ? 0 : undefined}
      onKeyDown={onOpen ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } } : undefined}
      style={{ borderRadius: "var(--radius-lg)", background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)", padding: "var(--space-5)", minWidth: 0, overflowWrap: "break-word", cursor: onOpen ? "pointer" : "default", WebkitTapHighlightColor: "transparent" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Eyebrow blue>{verseLabel(v.ord)}</Eyebrow>
        {onOpen && <span style={{ color: "var(--color-label-3, var(--color-label-2))", display: "inline-flex", flexShrink: 0 }}><svg width="17" height="17" viewBox="0 0 24 24" aria-hidden><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></span>}
      </div>
      {v.translit && (
        <FitText text={v.translit} max={18.5} min={12} style={{ marginTop: "var(--space-3)", fontFamily: "var(--font-scripture)", fontStyle: "italic", lineHeight: 1.5, color: "var(--color-label)" }} />
      )}
      {v.text && (
        <div style={{ marginTop: v.translit ? "var(--space-4)" : "var(--space-3)", paddingTop: v.translit ? "var(--space-4)" : 0, borderTop: v.translit ? "0.5px solid var(--color-hairline)" : "none", fontFamily: "var(--font-text)", fontSize: "var(--text-body)", lineHeight: "var(--leading-normal)", color: "var(--color-label)", whiteSpace: "pre-line", overflowWrap: "break-word" }}>{v.text}</div>
      )}
    </section>
  );
}

/** Кнопка нижней навигации — как книжная NavAction (прозрачная, заливка при нажатии). */
function BhNavAction({ arrow, disabled, onClick, children }: { arrow?: "prev" | "next"; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  const [pressed, setPressed] = useState(false);
  const off = () => setPressed(false);
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      onPointerDown={() => { if (!disabled) setPressed(true); }} onPointerUp={off} onPointerLeave={off} onPointerCancel={off}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, height: 40, padding: "0 14px", borderRadius: 12, border: "none", cursor: disabled ? "default" : "pointer", background: !disabled && pressed ? "var(--color-fill-2, rgba(120,120,128,.12))" : "transparent", color: disabled ? "var(--color-label-3, var(--color-label-2))" : "var(--color-label)", opacity: disabled ? 0.45 : 1, fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: "var(--weight-semibold)", transition: "background .12s", WebkitTapHighlightColor: "transparent" }}>
      {arrow === "prev" && <BackIcon size={18} />}
      {children}
      {arrow === "next" && <span style={{ display: "inline-flex", transform: "scaleX(-1)" }}><BackIcon size={18} /></span>}
    </button>
  );
}

/** Экран отдельного стиха бхаджана (= стих в книге): фокус-чтение с верхней и
 *  нижней навигацией (предыдущий · к бхаджану · следующий). */
function BhajanVerseScreen({ verses, idx, bhajanName, onClose, onNav }: { verses: Verse[]; idx: number; bhajanName: string; onClose: () => void; onNav: (i: number) => void }) {
  const v = verses[idx];
  const hasWbw = !!(v.words && v.words.length > 0);
  const scRef = useRef<HTMLDivElement>(null);
  const prevOk = idx > 0, nextOk = idx < verses.length - 1;
  useEffect(() => { scRef.current?.scrollTo({ top: 0 }); }, [idx]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && prevOk) onNav(idx - 1);
      else if (e.key === "ArrowRight" && nextOk) onNav(idx + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, prevOk, nextOk, onClose, onNav]);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { const p = e.touches[0]; if (p) touch.current = { x: p.clientX, y: p.clientY }; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current; touch.current = null; if (!s) return;
    const p = e.changedTouches[0]; if (!p) return;
    const dx = p.clientX - s.x, dy = p.clientY - s.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 2) {
      if (dx < 0 && nextOk) onNav(idx + 1);
      else if (dx > 0 && prevOk) onNav(idx - 1);
    }
  };
  return (
    <div style={{ position: "fixed", top: 0, bottom: 0, left: 0, right: 0, margin: "0 auto", width: "100%", maxWidth: 480, zIndex: 80, display: "flex", flexDirection: "column", background: "var(--color-bg)" }}>
      <header style={{ flexShrink: 0, height: 52, display: "flex", alignItems: "center", gap: 4, padding: "0 6px", background: "var(--color-bg)", borderBottom: "0.5px solid var(--color-hairline)" }}>
        <PlainBtn ariaLabel="К бхаджану" onClick={onClose}><BackIcon size={22} /></PlainBtn>
        <div style={{ flex: 1, minWidth: 0, paddingLeft: 2 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 15.5, fontWeight: "var(--weight-bold)", letterSpacing: "-0.01em", color: "var(--color-label)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{bhajanName}</div>
          <div style={{ fontFamily: "var(--font-text)", fontSize: 11.5, color: "var(--color-label-2)" }}>Стих {v.ord} из {verses.length}</div>
        </div>
      </header>
      <div aria-hidden style={{ flexShrink: 0, height: 2.5, background: "var(--color-hairline)" }}>
        <div style={{ height: "100%", width: `${((idx + 1) / Math.max(1, verses.length)) * 100}%`, background: "var(--color-gold-deep)", transition: "width .22s ease" }} />
      </div>
      <div ref={scRef} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={{ flex: 1, minHeight: 0, overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "var(--space-6) var(--pad-card) calc(env(safe-area-inset-bottom,0px) + var(--space-8) + var(--player-extra))" }}>
          <Eyebrow blue>{verseLabel(v.ord)}</Eyebrow>
          {v.translit && <FitText text={v.translit} max={21} min={13} style={{ marginTop: "var(--space-4)", fontFamily: "var(--font-scripture)", fontStyle: "italic", lineHeight: 1.5, color: "var(--color-label)" }} />}
          {v.text && <div style={{ marginTop: "var(--space-5)", paddingTop: "var(--space-5)", borderTop: "0.5px solid var(--color-hairline)", fontFamily: "var(--font-text)", fontSize: 17.5, lineHeight: 1.7, color: "var(--color-label)", whiteSpace: "pre-line", overflowWrap: "break-word" }}>{v.text}</div>}
          {hasWbw && (
            <div style={{ marginTop: "var(--space-5)", paddingTop: "var(--space-4)", borderTop: "0.5px solid var(--color-hairline)" }}>
              <Eyebrow blue>Пословный перевод</Eyebrow>
              <div style={{ marginTop: "var(--space-3)", fontSize: "var(--text-subhead)", lineHeight: 1.85, color: "var(--color-label-2)", overflowWrap: "break-word" }}>
                {v.words!.map((w, i) => (
                  <span key={i}>
                    <span style={{ fontFamily: "var(--font-scripture)", fontStyle: "italic", color: "var(--color-label)" }}>{w.t}</span>
                    {w.m ? <span style={{ fontFamily: "var(--font-text)" }}> — {w.m}</span> : null}
                    {i < v.words!.length - 1 ? <span style={{ color: "var(--color-label-3, var(--color-label-2))" }}>;&nbsp; </span> : null}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <nav style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px calc(8px + env(safe-area-inset-bottom) + var(--player-extra))", background: "var(--color-bg)", borderTop: "0.5px solid var(--color-hairline)" }}>
        <BhNavAction arrow="prev" disabled={!prevOk} onClick={() => prevOk && onNav(idx - 1)}>Назад</BhNavAction>
        <BhNavAction onClick={onClose}>К бхаджану</BhNavAction>
        <BhNavAction arrow="next" disabled={!nextOk} onClick={() => nextOk && onNav(idx + 1)}>Вперёд</BhNavAction>
      </nav>
    </div>
  );
}

/** Слой (когда стихи не разнесены): подписанный блок текста — тоже карточкой. */
function LayerCard({ label, text, scripture }: { label: string; text: string; scripture?: boolean }) {
  return (
    <section style={{ borderRadius: "var(--radius-lg)", background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)", padding: "var(--space-5)", minWidth: 0, overflowWrap: "break-word" }}>
      <Eyebrow blue>{label}</Eyebrow>
      {scripture ? <FitText text={text} max={18.5} min={12} style={{ marginTop: "var(--space-3)", fontFamily: "var(--font-scripture)", fontStyle: "italic", lineHeight: 1.5, color: "var(--color-label)" }} /> : <div style={{ marginTop: "var(--space-3)", fontFamily: "var(--font-text)", fontSize: "var(--text-body)", lineHeight: "var(--leading-normal)", color: "var(--color-label)", whiteSpace: "pre-line", overflowWrap: "break-word" }}>{text}</div>}
    </section>
  );
}

function PlayIcon({ size = 18 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><path d="M7 5v14l12-7z" fill="currentColor" /></svg>; }
function PauseIcon({ size = 18 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" /></svg>; }

function MediaHeader({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-headline)", fontWeight: "var(--weight-bold)", color: "var(--color-label)", marginBottom: "var(--space-3)" }}>{children}</div>;
}

const ROW = { display: "flex", alignItems: "center", gap: 12, padding: "var(--space-4) var(--space-5)", textAlign: "left" as const };
const MCARD = { borderRadius: "var(--radius-lg)", background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)", overflow: "hidden" } as const;

/** Текстовый комментарий/пурпорт — текст с «Читать полностью» и встроенным просмотром PDF/изображения. */
function CommentaryCard({ c, onView }: { c: MediaItem; onView: (m: ViewerMedia) => void }) {
  const [open, setOpen] = useState(false);
  const text = c.description || "";
  const long = text.length > 320;
  const shown = open || !long ? text : text.slice(0, 300).trimEnd() + "…";
  const hasUrl = !!(c.url && c.url.length > 0);
  const u = (c.url || "").toLowerCase();
  const isPdf = u.includes(".pdf");
  const isImg = /\.(png|jpe?g|webp|gif)(\?|$)/.test(u);
  const linkStyle = { display: "inline-flex", alignItems: "center", marginTop: text ? "var(--space-3)" : "var(--space-2)", padding: 0, border: "none", background: "transparent", cursor: "pointer", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: "var(--weight-semibold)", color: "var(--color-gold-deep)", textDecoration: "none" } as const;
  return (
    <div style={{ ...MCARD, padding: "var(--space-5)" }}>
      <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: "var(--weight-semibold)", color: "var(--color-label)", overflowWrap: "anywhere" }}>{c.title || "Комментарий"}</div>
      {(c.subtitle || c.date) ? <div style={{ marginTop: 2, fontFamily: "var(--font-text)", fontSize: "var(--text-caption1)", color: "var(--color-label-2)" }}>{[c.subtitle, c.date].filter(Boolean).join(" · ")}</div> : null}
      {text ? <div style={{ marginTop: "var(--space-3)", fontFamily: "var(--font-text)", fontSize: "var(--text-body)", lineHeight: "var(--leading-normal)", color: "var(--color-label)", whiteSpace: "pre-line", overflowWrap: "break-word" }}>{shown}</div> : null}
      {text && long ? <button onClick={() => setOpen((o) => !o)} style={{ marginTop: "var(--space-2)", padding: 0, border: "none", background: "transparent", cursor: "pointer", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: "var(--weight-semibold)", color: "var(--color-gold-deep)" }}>{open ? "Свернуть" : "Читать полностью"}</button> : null}
      {hasUrl ? (
        isPdf || isImg
          ? <button onClick={() => onView({ type: isPdf ? "pdf" : "image", url: c.url || "", title: c.title || "Комментарий", subtitle: c.subtitle })} style={linkStyle}>{isPdf ? "Открыть PDF" : "Открыть"}</button>
          : <a href={c.url || "#"} target="_blank" rel="noreferrer" style={linkStyle}>Открыть источник ↗</a>
      ) : null}
    </div>
  );
}

/** Записи (плеер) · Лекции (открыть) · Комментарии (текст) · Ноты (открыть). */
function MediaSections({ media, slug, onView }: { media: BhajanMedia; slug: string; onView: (m: ViewerMedia) => void }) {
  const player = usePlayer();
  const recs = (media.recordings ?? []).filter((r) => r.url);
  // Видео-лекции (media_type='video' — невстраиваемые страницы Яндекс/Rutube) временно
  // убраны из приложения по требованию; данные сохранены в D1, вернуть = снять фильтр.
  const lecs = (media.lectures ?? []).filter((l) => l.url && l.url.length > 0 && l.media_type !== "video");
  const audioLecs = lecs.filter((l) => l.media_type === "audio");
  // Ноты (kind='score', PDF) временно убраны со всех бхаджанов по требованию;
  // данные в D1 сохранены. Вернуть = (media.scores ?? []).filter((s) => s.url && s.url.length > 0).
  const scs = (media.scores ?? []).filter(() => false);
  const coms = (media.commentaries ?? []).filter((c) => (c.description && c.description.length > 0) || (c.url && c.url.length > 0));
  if (!recs.length && !lecs.length && !scs.length && !coms.length) return null;

  const isThisRec = player.kind === "bhajan" && player.book === slug;
  const isThisLec = player.kind === "bhajan" && player.book === `${slug}::lec`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {recs.length > 0 && (
        <div>
          <MediaHeader>Записи</MediaHeader>
          <div style={MCARD}>
            {recs.map((r, i) => {
              const isCur = isThisRec && player.index === i;
              const on = isCur && player.isPlaying;
              return (
                <button key={i} onClick={() => { if (isCur) player.togglePlay(); else player.playBhajan(slug, i); }} style={{ ...ROW, width: "100%", border: "none", borderTop: i ? "0.5px solid var(--color-hairline)" : "none", background: isCur ? "var(--color-fill-2, rgba(120,120,128,.10))" : "transparent", cursor: "pointer" }}>
                  <span style={{ display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: "50%", background: "var(--color-gold-deep)", color: "#fff", flexShrink: 0 }}>{on ? <PauseIcon /> : <PlayIcon />}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: "var(--weight-medium)", color: isCur ? "var(--color-gold-deep)" : "var(--color-label)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title || "Запись"}</span>
                    {r.subtitle ? <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: "var(--text-caption1)", color: "var(--color-label-2)" }}>{r.subtitle}</span> : null}
                  </span>
                  {r.duration ? <span style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption1)", color: "var(--color-label-2)", flexShrink: 0 }}>{r.duration}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {lecs.length > 0 && (
        <div>
          <MediaHeader>Лекции</MediaHeader>
          <div style={MCARD}>
            {lecs.map((l, i) => {
              const isAudio = l.media_type === "audio";
              const playIdx = isAudio ? audioLecs.indexOf(l) : -1;
              const isCur = isAudio && isThisLec && player.index === playIdx;
              const on = isCur && player.isPlaying;
              const u = (l.url || "").toLowerCase();
              const isYt = !isAudio && (l.media_type === "youtube" || /youtube|youtu\.be/.test(u));
              const rt = !isAudio ? (l.url || "").match(/rutube\.ru\/(?:video|play\/embed)\/([0-9a-f]+)/i) : null;
              const isFile = !isAudio && /\.(mp4|m4v|webm|mov)(\?|$)/.test(u);
              const isExternal = !isAudio && !isYt && !rt && !isFile;
              const handle = isAudio
                ? () => { if (isCur) player.togglePlay(); else player.playBhajan(slug, playIdx, "lectures"); }
                : isYt ? () => onView({ type: "youtube", url: l.url || "", title: l.title || "Лекция", subtitle: l.subtitle })
                : rt ? () => onView({ type: "iframe", url: `https://rutube.ru/play/embed/${rt[1]}`, title: l.title || "Лекция", subtitle: l.subtitle })
                : isFile ? () => onView({ type: "video", url: l.url || "", title: l.title || "Лекция", subtitle: l.subtitle })
                : () => window.open(l.url || "", "_blank", "noopener,noreferrer");
              const label = isAudio ? "Аудио" : isYt ? "YouTube" : isExternal ? "Видео ↗" : "Видео";
              return (
                <button key={i} onClick={handle} style={{ ...ROW, width: "100%", border: "none", borderTop: i ? "0.5px solid var(--color-hairline)" : "none", background: isCur ? "var(--color-fill-2, rgba(120,120,128,.10))" : "transparent", cursor: "pointer" }}>
                  <span style={{ display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: "50%", background: isYt ? "#FF453A" : "var(--color-gold-deep)", color: "#fff", flexShrink: 0 }}>{on ? <PauseIcon size={16} /> : <PlayIcon size={16} />}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: "var(--weight-medium)", color: isCur ? "var(--color-gold-deep)" : "var(--color-label)", overflowWrap: "anywhere" }}>{l.title || "Лекция"}</span>
                    {(l.subtitle || l.date) ? <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: "var(--text-caption1)", color: "var(--color-label-2)" }}>{[l.subtitle, l.date].filter(Boolean).join(" · ")}</span> : null}
                  </span>
                  <span style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", color: "var(--color-label-2)", textTransform: "uppercase", letterSpacing: "var(--tracking-wide)", flexShrink: 0 }}>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {coms.length > 0 && (
        <div>
          <MediaHeader>Комментарии</MediaHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {coms.map((c, i) => <CommentaryCard key={i} c={c} onView={onView} />)}
          </div>
        </div>
      )}
      {scs.length > 0 && (
        <div>
          <MediaHeader>Ноты</MediaHeader>
          <div style={MCARD}>
            {scs.map((s, i) => {
              const isPdf = (s.media_type || "image") === "pdf";
              return (
                <button key={i} onClick={() => onView({ type: isPdf ? "pdf" : "image", url: s.url || "", title: s.title || "Ноты", subtitle: s.description })} style={{ ...ROW, width: "100%", border: "none", borderTop: i ? "0.5px solid var(--color-hairline)" : "none", background: "transparent", cursor: "pointer" }}>
                  <span style={{ display: "grid", placeItems: "center", width: 34, height: 34, borderRadius: "50%", background: "var(--color-fill-2, rgba(120,120,128,.12))", color: "var(--color-gold-deep)", flexShrink: 0 }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden><path d="M9 18V6l10-2v12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /><circle cx="6.5" cy="18" r="2.5" fill="currentColor" /><circle cx="16.5" cy="16" r="2.5" fill="currentColor" /></svg>
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: "var(--weight-medium)", color: "var(--color-label)", overflowWrap: "anywhere" }}>{s.title || "Ноты"}</span>
                    {s.description ? <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: "var(--text-caption1)", color: "var(--color-label-2)" }}>{s.description}</span> : null}
                  </span>
                  <span style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", color: "var(--color-label-2)", textTransform: "uppercase", letterSpacing: "var(--tracking-wide)", flexShrink: 0 }}>{isPdf ? "PDF" : "Изобр."}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function BhajanDetailPage({ slug, onBack, onOpenEntity, onOpenBhajan, onOpenCatalog }: { slug: string; onBack: () => void; onOpenEntity?: (id: string, type: string | null) => void; onOpenBhajan?: (slug: string) => void; onOpenCatalog?: () => void }) {
  const [data, setData] = useState<BhajanDetail | null>(null);
  const [err, setErr] = useState(false);
  const [t, setT] = useState(0);
  const [prog, setProg] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [viewer, setViewer] = useState<ViewerMedia | null>(null);
  const [vIdx, setVIdx] = useState<number | null>(null);
  const [sibs, setSibs] = useState<{ slug: string; name: string }[] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fav = useFavorite(`bhajan:${slug}`);
  const { openCardMenu } = useCardActions();
  const player = usePlayer();
  const flash = (m: string) => {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  };

  useEffect(() => {
    let live = true;
    setData(null); setErr(false); setVIdx(null);
    fetch(api(`/bhajans/detail?slug=${encodeURIComponent(slug)}`))
      .then((r) => r.json())
      .then((d) => { if (live) { if (d && Array.isArray(d.verses)) setData(d); else setErr(true); } })
      .catch(() => { if (live) setErr(true); });
    return () => { live = false; };
  }, [slug]);

  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    const onScroll = () => {
      setT(Math.min(1, Math.max(0, el.scrollTop / 120)));
      const max = el.scrollHeight - el.clientHeight;
      setProg(max > 8 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [data]);

  // Соседние бхаджаны для нижней навигации (порядок каталога — по автору/песеннику).
  useEffect(() => {
    let live = true;
    fetch(api("/bhajans/catalog")).then((r) => r.json())
      .then((d: { items?: Array<{ slug: string; name: string }> }) => { if (live) setSibs((d.items ?? []).map((x) => ({ slug: x.slug, name: x.name }))); })
      .catch(() => { if (live) setSibs([]); });
    return () => { live = false; };
  }, []);

  const openMore = () => {
    if (!data) return;
    openCardMenu({
      type: "bhajan", id: slug, title: data.name, subtitle: data.author || undefined,
      url: `https://gaurangers.com/bhajan/${encodeURIComponent(slug)}`,
      context: `Бхаджан · ${data.name} · /bhajan/${slug}`,
    });
  };

  const meta = data ? [data.source_text, data.section].filter(Boolean).join(" · ") : "";
  const hasVerses = !!(data && data.verses.length > 0);
  const hasLayers = !!(data && (data.translit || data.translation));
  const sIdx = sibs ? sibs.findIndex((s) => s.slug === slug) : -1;
  const prevB = sIdx > 0 ? sibs![sIdx - 1] : null;
  const nextB = sIdx >= 0 && sibs && sIdx < sibs.length - 1 ? sibs[sIdx + 1] : null;
  useEffect(() => {
    if (vIdx !== null) return; // когда открыт стих — навигацией рулит экран стиха
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onBack();
      else if (e.key === "ArrowLeft" && prevB) onOpenBhajan?.(prevB.slug);
      else if (e.key === "ArrowRight" && nextB) onOpenBhajan?.(nextB.slug);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [vIdx, prevB, nextB, onBack, onOpenBhajan]);

  return (
    <div style={{ position: "fixed", top: 0, bottom: 0, left: 0, right: 0, margin: "0 auto", width: "100%", maxWidth: 480, zIndex: 70, display: "flex", flexDirection: "column", background: "var(--color-bg)" }}>
      {/* scroll-edge навбар — назад + титул на скролле */}
      <header style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 30, height: 52, display: "flex", alignItems: "center", gap: 2, padding: "0 8px",
        background: `color-mix(in srgb, var(--color-glass-nav) ${Math.round(t * 100)}%, transparent)`,
        backdropFilter: t > 0.04 ? "saturate(180%) blur(20px)" : "none", WebkitBackdropFilter: t > 0.04 ? "saturate(180%) blur(20px)" : "none",
        borderBottom: `0.5px solid color-mix(in srgb, var(--color-glass-stroke) ${Math.round(t * 100)}%, transparent)` }}>
        <button aria-label="Назад" onClick={onBack} style={{ display: "grid", height: 38, width: 38, placeItems: "center", borderRadius: "50%", border: "none", cursor: "pointer", color: "var(--color-label)", background: "transparent", flexShrink: 0 }}><BackIcon size={22} /></button>
        <div style={{ flex: 1, minWidth: 0, paddingLeft: 2, opacity: t > 0.55 ? (t - 0.55) / 0.45 : 0, transform: t > 0.55 ? "none" : "translateY(3px)", transition: "opacity .15s, transform .15s" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 15.5, fontWeight: "var(--weight-bold)", letterSpacing: "-0.01em", color: "var(--color-label)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{data?.name}</div>
          {data?.author && <div style={{ fontFamily: "var(--font-text)", fontSize: 11.5, color: "var(--color-label-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{data.author}</div>}
        </div>
        {data && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
            <PlainBtn ariaLabel="В избранное" active={fav.on} color="#FF453A" onClick={() => fav.toggle(flash)}><HeartIcon size={18} filled={fav.on} /></PlainBtn>
            <PlainBtn ariaLabel="Слушать" onClick={() => { if (data?.media?.recordings?.some((r) => r.url)) player.playBhajan(slug, 0); else flash("Записей пока нет"); }}><HeadphonesIcon size={18} /></PlainBtn>
            <PlainBtn ariaLabel="Ещё" onClick={openMore}><MoreIcon size={16} /></PlainBtn>
          </span>
        )}
        <div aria-hidden style={{ position: "absolute", left: 0, bottom: 0, height: 2, width: `${prog * 100}%`, background: "var(--color-gold-deep)", borderRadius: "0 2px 2px 0", transition: "width .12s linear" }} />
      </header>

      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        {!data && !err && <div style={{ textAlign: "center", color: "var(--color-label-2)", padding: "140px 0", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)" }}>Загрузка…</div>}
        {err && <div style={{ textAlign: "center", color: "var(--color-label-2)", padding: "140px 16px", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)" }}>Не удалось загрузить.</div>}

        {data && (
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            {/* ШАПКА — чистая, выразительная */}
            <div style={{ padding: "64px var(--pad-card) 0" }}>
              {data.category && <Eyebrow blue>{data.category}</Eyebrow>}
              <h1 style={{ margin: data.category ? "var(--space-2) 0 0" : 0, fontFamily: "var(--font-display)", fontSize: "var(--text-title1)", lineHeight: "var(--leading-tight)", fontWeight: "var(--weight-heavy)", letterSpacing: "-0.5px", color: "var(--color-label)" }}>{data.name}</h1>
              {data.author && (
                data.author_entity && onOpenEntity ? (
                  <button onClick={() => onOpenEntity(data.author_entity || "", "personality")} aria-label={`Об авторе: ${data.author}`}
                    style={{ marginTop: "var(--space-3)", display: "inline-flex", alignItems: "center", gap: 4, padding: 0, border: "none", background: "transparent", cursor: "pointer", fontFamily: "var(--font-text)", fontSize: "var(--text-headline)", fontWeight: "var(--weight-medium)", color: "var(--color-label)", WebkitTapHighlightColor: "transparent" }}>
                    {data.author}
                    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden style={{ color: "var(--color-label-2)", flexShrink: 0 }}><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                ) : (
                  <div style={{ marginTop: "var(--space-3)", fontFamily: "var(--font-text)", fontSize: "var(--text-headline)", fontWeight: "var(--weight-medium)", color: "var(--color-label)" }}>{data.author}</div>
                )
              )}
              {meta && <div style={{ marginTop: "var(--space-1)", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", color: "var(--color-label-2)" }}>{meta}</div>}
            </div>

            {/* ТЕКСТ — стихи карточками */}
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", padding: "var(--space-6) var(--pad-card) calc(env(safe-area-inset-bottom,0px) + var(--space-8) + var(--player-extra))" }}>
              {data.pending ? (
                <div style={{ padding: "var(--space-6) var(--space-5)", borderRadius: "var(--radius-lg)", background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)", textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-body)", fontWeight: "var(--weight-semibold)", color: "var(--color-label)" }}>Текст готовится</div>
                  <div style={{ marginTop: "var(--space-2)", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", lineHeight: "var(--leading-snug)", color: "var(--color-label-2)" }}>Перевод этого бхаджана появится здесь после подготовки.</div>
                </div>
              ) : hasVerses ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>{data.verses.map((v, i) => <VerseCard key={v.ord} v={v} onOpen={() => setVIdx(i)} />)}</div>
              ) : hasLayers ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                  {data.translit && <LayerCard label="Транслитерация" text={data.translit} scripture />}
                  {data.translation && <LayerCard label="Перевод" text={data.translation} />}
                </div>
              ) : (
                <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-body)", lineHeight: "var(--leading-normal)", color: "var(--color-label)", whiteSpace: "pre-line" }}>{data.body}</div>
              )}
              {!data.pending && data.media && <div ref={mediaRef}><MediaSections media={data.media} slug={slug} onView={setViewer} /></div>}
              <NotesAtSource kind="bhajan" refId={`bhajan:${slug}`} accent="#7048E8" />
            </div>
          </div>
        )}
      </div>

      {data && (
        <nav style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px calc(8px + env(safe-area-inset-bottom) + var(--player-extra))", background: "var(--color-bg)", borderTop: "0.5px solid var(--color-hairline)" }}>
          <BhNavAction arrow="prev" disabled={!prevB} onClick={() => prevB && onOpenBhajan?.(prevB.slug)}>Назад</BhNavAction>
          <BhNavAction onClick={() => onOpenCatalog?.()}>К каталогу</BhNavAction>
          <BhNavAction arrow="next" disabled={!nextB} onClick={() => nextB && onOpenBhajan?.(nextB.slug)}>Вперёд</BhNavAction>
        </nav>
      )}

      {toast && (
        <div role="status" style={{ position: "absolute", left: "50%", bottom: "calc(env(safe-area-inset-bottom,0px) + 24px)", transform: "translateX(-50%)", zIndex: 50, padding: "10px 16px", borderRadius: 999, background: "rgba(0,0,0,.82)", color: "#fff", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 500, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", boxShadow: "0 8px 30px rgba(0,0,0,.3)", pointerEvents: "none" }}>{toast}</div>
      )}

      {data && vIdx !== null && data.verses[vIdx] && (
        <BhajanVerseScreen verses={data.verses} idx={vIdx} bhajanName={data.name} onClose={() => setVIdx(null)} onNav={setVIdx} />
      )}

      <MediaViewer media={viewer} onClose={() => setViewer(null)} />
    </div>
  );
}
