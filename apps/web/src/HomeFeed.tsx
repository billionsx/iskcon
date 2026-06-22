/**
 * HomeFeed — «Лента ISKCON ONE LOVE»: публичный Telegram-канал @iskcone целиком.
 * Дизайн постов — в стиле Instagram 2026: шапка (аватар канала · имя · дата),
 * медиа во всю ширину (одно фото / свайп-карусель с точками / видео), затем
 * панель действий и подпись «**ISKCON ONE LOVE** …».
 *
 * Панель действий каждого поста:
 *   ♥ В избранное (персистентно — общий слой cardActions, синк в кабинет)
 *   ✈ Открыть в Telegram
 *   ⋯ → BookMenuSheet: Поделиться · Скачать PDF · QR-код · Задонатить · Сообщить об ошибке.
 *
 * PDF поста собирается на КЛИЕНТЕ (печатный конвейер браузера, тот же книжный
 * print-CSS с колонтитулом «ISKCON ONE LOVE · gaurangers.com») — серверный
 * /pdf?kind=card рендерит из D1, а посты ленты живут только в Telegram.
 *
 * Данные — с воркера /api/tg/iskcone (парсинг t.me/s, кеш 5 мин), бесконечная лента.
 */
import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { useFavorite } from "./cardActions";
import { BookMenuSheet } from "./BookMenuSheet";
import { QrSheet } from "./QrSheet";
import { ReportSheet } from "./ReportSheet";
import { HeartIcon, MoreIcon } from "./ui/icons";
import { exportToPdf } from "./pdf";

const GOLD = "#D2AA1B";
const TG_BLUE = "#229ED9";
const fill: React.CSSProperties = { background: "var(--color-glass-thin)", borderRadius: 20 };

interface TgSeg { t: "t" | "a"; v: string; href?: string }
interface TgVideo { thumb: string; src: string | null; duration: string; round: boolean }
interface TgAudio { kind: "voice" | "audio" | "file"; title: string; meta: string; src: string | null }
interface TgLink { href: string; title: string; desc: string; img: string | null }
interface TgPost {
  id: string; date: string; views: string; text: string;
  rich: TgSeg[]; photos: string[]; videos: TgVideo[]; audios: TgAudio[]; link: TgLink | null;
}

const postUrl = (id: string) => `https://t.me/iskcone/${id}`;
const CHANNEL_URL = "https://t.me/iskcone";

function fmtDate(iso: string): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }); }
  catch { return ""; }
}

/** Первая непустая строка подписи — заголовок для избранного / share / QR / PDF. */
function leadLine(text: string): string {
  const l = (text || "").split("\n").find((x) => x.trim());
  return (l || "").trim();
}

/* ── подпись поста: инлайн-сегменты с живыми ссылками (с опц. обрезкой) ── */
function renderRich(rich: TgSeg[], clampTo: number | null): React.ReactNode[] {
  let used = 0;
  const out: React.ReactNode[] = [];
  for (let i = 0; i < rich.length; i++) {
    const s = rich[i];
    let v = s.v;
    if (clampTo !== null) {
      if (used >= clampTo) break;
      if (used + v.length > clampTo) v = v.slice(0, clampTo - used).replace(/\s+\S*$/, "") + "…";
      used += s.v.length;
    }
    if (s.t === "a" && s.href) {
      out.push(
        <a key={i} href={s.href} target="_blank" rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{ color: "var(--color-brand-blue)", textDecoration: "none", fontWeight: 600, wordBreak: "break-word" }}>{v}</a>
      );
    } else out.push(<span key={i}>{v}</span>);
  }
  return out;
}

/* ── иконки ───────────────────────────────────────────────────────────────── */
function TelegramIcon({ size = 25 }: { size?: number }) {
  // фирменный «самолётик» Telegram, в брендовом синем
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path fill={TG_BLUE} d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
    </svg>
  );
}

/* ── плоская кнопка действия (как в Instagram — без подложки) ── */
function ActBtn({ label, onClick, color, children }: { label: string; onClick: () => void; color?: string; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{ display: "grid", placeItems: "center", width: 40, height: 40, padding: 0, border: "none", background: "none", cursor: "pointer", color: color || "var(--color-label)", WebkitTapHighlightColor: "transparent" }}>
      {children}
    </button>
  );
}

/* ── аватар канала: золотое «сторис-кольцо» + эмблема ISKCON ONE LOVE ── */
function ChannelAvatar({ size = 40 }: { size?: number }) {
  return (
    <span aria-hidden style={{ flexShrink: 0, width: size, height: size, borderRadius: "50%", padding: 2, background: `conic-gradient(from 220deg, ${GOLD}, #f1e1a4, ${GOLD})`, boxSizing: "border-box" }}>
      <span style={{ display: "grid", placeItems: "center", width: "100%", height: "100%", borderRadius: "50%", background: "var(--color-bg)", boxSizing: "border-box" }}>
        <img src="/iskcon-one-love-mark.svg" alt="" style={{ width: "62%", height: "62%", objectFit: "contain", display: "block" }} />
      </span>
    </span>
  );
}

/* ── лайтбокс: фото поста на весь экран, листание, закрытие ── */
function PhotoLightbox({ photos, index, onIndex, onClose }: {
  photos: string[]; index: number; onIndex: (i: number) => void; onClose: () => void;
}) {
  const total = photos.length;
  const go = (d: number) => onIndex((index + d + total) % total);
  useEffect(() => {
    const prevOv = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && total > 1) go(-1);
      else if (e.key === "ArrowRight" && total > 1) go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prevOv; window.removeEventListener("keydown", onKey); };
  });
  const round: React.CSSProperties = { position: "absolute", width: 40, height: 40, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.16)", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer", backdropFilter: "blur(8px)", WebkitTapHighlightColor: "transparent", zIndex: 2 };
  return (
    <div role="dialog" aria-modal="true" aria-label="Фото" onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 96, background: "rgba(0,0,0,0.94)", display: "grid", placeItems: "center" }}>
      <img src={photos[index]} alt="" onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto", objectFit: "contain", display: "block", imageOrientation: "from-image" }} />
      <button type="button" aria-label="Закрыть" onClick={onClose}
        style={{ ...round, top: "calc(env(safe-area-inset-top,0px) + 14px)", right: 14 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      </button>
      {total > 1 && (
        <>
          <span style={{ position: "absolute", top: "calc(env(safe-area-inset-top,0px) + 23px)", left: 16, fontFamily: "var(--font-text)", fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)", zIndex: 2 }}>{index + 1} / {total}</span>
          <button type="button" aria-label="Предыдущее" onClick={(e) => { e.stopPropagation(); go(-1); }} style={{ ...round, left: 14, top: "50%", marginTop: -20 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button type="button" aria-label="Следующее" onClick={(e) => { e.stopPropagation(); go(1); }} style={{ ...round, right: 14, top: "50%", marginTop: -20 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden style={{ transform: "scaleX(-1)" }}><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </>
      )}
    </div>
  );
}

/* ── медиа: 1 фото — натурально; 2+ — свайп-карусель 4:5 с точками; видео ── */
function PostMedia({ p, onOpen }: { p: TgPost; onOpen: (i: number) => void }) {
  const photos = p.photos;
  const [idx, setIdx] = useState(0);
  const scRef = useRef<HTMLDivElement | null>(null);
  const onScroll = () => {
    const el = scRef.current; if (!el) return;
    const w = el.clientWidth; if (w) setIdx(Math.round(el.scrollLeft / w));
  };

  if (photos.length === 0 && p.videos.length === 0) return null;

  return (
    <>
      {photos.length === 1 && (
        <div style={{ background: "var(--color-glass-regular)", display: "grid", placeItems: "center" }}>
          <img src={photos[0]} alt="" loading="lazy" onClick={() => onOpen(0)}
            style={{ width: "100%", height: "auto", maxHeight: 620, objectFit: "contain", display: "block", cursor: "zoom-in", imageOrientation: "from-image" }} />
        </div>
      )}

      {photos.length > 1 && (
        <div style={{ position: "relative" }}>
          <div ref={scRef} onScroll={onScroll} className="iol-feed-carousel"
            style={{ display: "flex", overflowX: "auto", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", scrollbarWidth: "none", background: "var(--color-glass-regular)" }}>
            {photos.map((src, i) => (
              <div key={i} style={{ flex: "0 0 100%", scrollSnapAlign: "center", aspectRatio: "4 / 5" }}>
                <img src={src} alt="" loading="lazy" onClick={() => onOpen(i)}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", cursor: "zoom-in", imageOrientation: "from-image" }} />
              </div>
            ))}
          </div>
          <span style={{ position: "absolute", top: 10, right: 10, padding: "3px 9px", borderRadius: 999, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", color: "#fff", fontSize: 11.5, fontWeight: 700, fontFamily: "var(--font-text)", letterSpacing: "0.2px" }}>{idx + 1}/{photos.length}</span>
          <div aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: 9, display: "flex", justifyContent: "center", gap: 5, pointerEvents: "none" }}>
            {photos.map((_, i) => (
              <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i === idx ? "#fff" : "rgba(255,255,255,0.5)", boxShadow: "0 0 2px rgba(0,0,0,0.4)", transition: "background .2s" }} />
            ))}
          </div>
        </div>
      )}

      {photos.length === 0 && p.videos.map((v, i) => <VideoBox key={i} v={v} id={p.id} />)}
    </>
  );
}

/* ── видео: превью + длительность; тап — проигрывание здесь либо пост в Telegram ── */
function VideoBox({ v, id }: { v: TgVideo; id: string }) {
  const [playing, setPlaying] = useState(false);
  const open = () => { if (v.src) setPlaying(true); else window.open(postUrl(id), "_blank", "noopener"); };
  if (playing && v.src) {
    return (
      <div style={{ background: "#000" }}>
        <video src={v.src} poster={v.thumb || undefined} controls autoPlay playsInline
          onError={() => { setPlaying(false); window.open(postUrl(id), "_blank", "noopener"); }}
          style={{ width: "100%", display: "block", maxHeight: 540, ...(v.round ? { aspectRatio: "1 / 1", borderRadius: "50%", objectFit: "cover", maxWidth: 280, margin: "14px auto" } : {}) }} />
      </div>
    );
  }
  return (
    <div role="button" tabIndex={0} aria-label="Смотреть видео" onClick={open}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}
      style={{ position: "relative", cursor: "pointer", background: "#000", WebkitTapHighlightColor: "transparent",
        ...(v.round ? { width: 240, height: 240, borderRadius: "50%", overflow: "hidden", margin: "14px auto" } : {}) }}>
      {v.thumb
        ? <img src={v.thumb} alt="" loading="lazy" style={{ width: "100%", height: v.round ? "100%" : undefined, display: "block", objectFit: "cover", ...(v.round ? {} : { aspectRatio: "16 / 9" }) }} />
        : <div style={{ aspectRatio: v.round ? "1 / 1" : "16 / 9", background: "var(--color-glass-regular)" }} />}
      <span aria-hidden style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
        <span style={{ width: 54, height: 54, borderRadius: "50%", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" style={{ marginLeft: 3 }}><path d="M8 5v14l11-7z" fill="#fff" /></svg>
        </span>
      </span>
      {v.duration && (
        <span style={{ position: "absolute", left: 10, bottom: 10, padding: "3px 8px", borderRadius: 999, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", fontFamily: "var(--font-text)", fontSize: 11.5, fontWeight: 700, color: "#fff", letterSpacing: "0.2px" }}>{v.duration}</span>
      )}
    </div>
  );
}

/* ── голосовое с прямым src: мини-плеер в приложении ── */
function VoicePlayer({ a }: { a: TgAudio }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [pct, setPct] = useState(0);
  const toggle = () => { const el = ref.current; if (!el) return; if (playing) el.pause(); else void el.play(); };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", margin: "10px 0 0", borderRadius: 16, background: "var(--color-glass-regular)" }}>
      <audio ref={ref} src={a.src || undefined} preload="none"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); setPct(0); }}
        onTimeUpdate={(e) => { const el = e.currentTarget; if (el.duration) setPct(el.currentTime / el.duration); }} />
      <button type="button" aria-label={playing ? "Пауза" : "Слушать"} onClick={toggle}
        style={{ width: 40, height: 40, flexShrink: 0, borderRadius: "50%", border: "none", background: GOLD, color: "#fff", cursor: "pointer", display: "grid", placeItems: "center", WebkitTapHighlightColor: "transparent" }}>
        {playing
          ? <svg width="15" height="15" viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" /></svg>
          : <svg width="15" height="15" viewBox="0 0 24 24" style={{ marginLeft: 2 }}><path d="M8 5v14l11-7z" fill="currentColor" /></svg>}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "var(--font-text)", fontSize: 13.5, fontWeight: 600, color: "var(--color-label)" }}>{a.title}</div>
        <div style={{ position: "relative", height: 4, marginTop: 7, borderRadius: 999, background: "var(--color-glass-thin)" }}>
          <span style={{ position: "absolute", inset: 0, width: `${pct * 100}%`, borderRadius: 999, background: GOLD, transition: "width .2s linear" }} />
        </div>
      </div>
      {a.meta && <span style={{ flexShrink: 0, fontFamily: "var(--font-text)", fontSize: 12, color: "var(--color-label-3)" }}>{a.meta}</span>}
    </div>
  );
}

/* ── аудио и файлы: карточка как в Telegram, открывается в Telegram ── */
function TgAudioCard({ a, id }: { a: TgAudio; id: string }) {
  if (a.kind === "voice" && a.src) return <VoicePlayer a={a} />;
  return (
    <a href={postUrl(id)} target="_blank" rel="noopener noreferrer"
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", margin: "10px 0 0", borderRadius: 16, background: "var(--color-glass-regular)", textDecoration: "none", WebkitTapHighlightColor: "transparent" }}>
      <span aria-hidden style={{ width: 40, height: 40, flexShrink: 0, borderRadius: "50%", background: GOLD, display: "grid", placeItems: "center" }}>
        {a.kind === "file"
          ? <svg width="17" height="17" viewBox="0 0 24 24"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinejoin="round" /><path d="M14 2v5h5" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinejoin="round" /></svg>
          : <svg width="17" height="17" viewBox="0 0 24 24"><path d="M9 18V6l10-2v12" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /><circle cx="6.5" cy="18" r="2.5" fill="#fff" /><circle cx="16.5" cy="16" r="2.5" fill="#fff" /></svg>}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: 13.5, fontWeight: 600, color: "var(--color-label)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</span>
        {a.meta && <span style={{ display: "block", marginTop: 2, fontFamily: "var(--font-text)", fontSize: 12, color: "var(--color-label-3)" }}>{a.meta} · слушать в Telegram</span>}
      </span>
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden style={{ flexShrink: 0, color: "var(--color-label-3)" }}><path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </a>
  );
}

/* ── превью ссылки ── */
function TgLinkCard({ l }: { l: TgLink }) {
  return (
    <a href={l.href} target="_blank" rel="noopener noreferrer"
      style={{ display: "block", margin: "12px 14px 0", borderRadius: 16, overflow: "hidden", border: "1px solid var(--color-separator)", textDecoration: "none", WebkitTapHighlightColor: "transparent" }}>
      {l.img && <img src={l.img} alt="" loading="lazy" style={{ width: "100%", display: "block", aspectRatio: "16 / 8", objectFit: "cover" }} />}
      <span style={{ display: "block", padding: "10px 14px 12px" }}>
        {l.title && <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: 13.5, fontWeight: 700, color: "var(--color-label)" }}>{l.title}</span>}
        {l.desc && <span style={{ display: "block", marginTop: 3, fontFamily: "var(--font-text)", fontSize: 12.5, lineHeight: 1.45, color: "var(--color-label-2)" }}>{l.desc}</span>}
      </span>
    </a>
  );
}

/* ── PDF поста: печатный конвейер браузера + книжный print-CSS ── */
function preloadImages(urls: string[], cap = 9000): Promise<void> {
  return new Promise((resolve) => {
    if (!urls.length) { resolve(); return; }
    let left = urls.length;
    const tick = () => { if (--left <= 0) resolve(); };
    setTimeout(resolve, cap);
    urls.forEach((u) => { const im = new Image(); im.onload = im.onerror = tick; im.src = u; });
  });
}
function buildPostPrintNode(p: TgPost): HTMLElement {
  const root = document.createElement("div");
  p.photos.forEach((src) => {
    const wrap = document.createElement("div");
    wrap.setAttribute("data-pdf-block", "");
    wrap.style.margin = "0 0 7mm";
    const img = document.createElement("img");
    img.src = src;
    img.style.width = "100%";
    img.style.borderRadius = "8px";
    wrap.appendChild(img);
    root.appendChild(wrap);
  });
  const t = (p.text || "").trim();
  if (t) {
    const cap = document.createElement("p");
    cap.textContent = t;
    cap.style.whiteSpace = "pre-wrap";
    cap.style.margin = p.photos.length ? "4mm 0 0" : "0";
    root.appendChild(cap);
  }
  return root;
}
async function downloadPostPdf(p: TgPost, flash: (m: string) => void) {
  flash("Готовим PDF…");
  try {
    await preloadImages(p.photos);
    const node = buildPostPrintNode(p);
    const head = leadLine(p.text) || "ISKCON ONE LOVE";
    exportToPdf(node, { title: head, heading: "ISKCON ONE LOVE", subheading: fmtDate(p.date) });
  } catch { flash("Не удалось собрать PDF — попробуйте ещё раз"); }
}

/* ── один пост ленты ─────────────────────────────────────────────────────── */
function FeedPost({ p, open, onToggle, onDonate, flash }: {
  p: TgPost; open: boolean; onToggle: () => void; onDonate?: () => void; flash: (m: string) => void;
}) {
  const [view, setView] = useState<number | null>(null);
  const [menu, setMenu] = useState(false);
  const [qr, setQr] = useState(false);
  const [report, setReport] = useState(false);

  const head = leadLine(p.text) || "ISKCON ONE LOVE";
  const fav = useFavorite(`post:${p.id}`, { t: head.slice(0, 140), s: fmtDate(p.date), h: "/sadhana" });
  const long = p.text.length > 220;

  const onPick = (id: string) => {
    if (id === "share") {
      if (typeof navigator !== "undefined" && navigator.share) navigator.share({ title: head, url: postUrl(p.id) }).catch(() => {});
      else { navigator.clipboard?.writeText(postUrl(p.id)).catch(() => {}); flash("Ссылка скопирована"); }
    } else if (id === "pdf") { void downloadPostPdf(p, flash); }
    else if (id === "qr") { setQr(true); }
    else if (id === "donate") { onDonate?.(); }
    else if (id === "report") { setReport(true); }
  };

  return (
    <article style={{ overflow: "hidden", ...fill }}>
      {/* шапка: аватар канала · имя · дата */}
      <a href={CHANNEL_URL} target="_blank" rel="noopener noreferrer"
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", textDecoration: "none", WebkitTapHighlightColor: "transparent" }}>
        <ChannelAvatar size={40} />
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--color-label)" }}>ISKCON ONE LOVE</span>
          {p.date && <span style={{ display: "block", marginTop: 1, fontFamily: "var(--font-text)", fontSize: 12, color: "var(--color-label-3)" }}>{fmtDate(p.date)}</span>}
        </span>
      </a>

      {/* медиа */}
      <PostMedia p={p} onOpen={setView} />

      {/* панель действий: ♥ · Telegram · ⋯ */}
      <div style={{ display: "flex", alignItems: "center", padding: "5px 7px 1px" }}>
        <ActBtn label={fav.on ? "Убрать из избранного" : "В избранное"} color={fav.on ? "#FF3B30" : "var(--color-label)"} onClick={() => fav.toggle(flash)}>
          <HeartIcon size={25} filled={fav.on} />
        </ActBtn>
        <ActBtn label="Открыть в Telegram" onClick={() => window.open(postUrl(p.id), "_blank", "noopener")}>
          <TelegramIcon size={25} />
        </ActBtn>
        <span style={{ marginLeft: "auto" }}>
          <ActBtn label="Ещё" onClick={() => setMenu(true)}>
            <MoreIcon size={22} />
          </ActBtn>
        </span>
      </div>

      {/* подпись + просмотры */}
      <div style={{ padding: "0 14px 14px" }}>
        {p.text.trim() && (
          <div style={{ fontFamily: "var(--font-text)", fontSize: 14, lineHeight: 1.5, letterSpacing: "-0.01em", color: "var(--color-label)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            <span style={{ fontWeight: 700 }}>ISKCON ONE LOVE </span>
            {renderRich(p.rich.length > 0 ? p.rich : [{ t: "t", v: p.text }], long && !open ? 170 : null)}
            {long && (
              <button type="button" onClick={onToggle}
                style={{ marginLeft: 4, padding: 0, background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-text)", fontSize: 14, fontWeight: 600, color: "var(--color-label-3)", WebkitTapHighlightColor: "transparent" }}>
                {open ? "свернуть" : "ещё"}
              </button>
            )}
          </div>
        )}
        {p.audios.map((a, i) => <TgAudioCard key={i} a={a} id={p.id} />)}
        {p.link && <TgLinkCard l={p.link} />}
        {p.views && (
          <div style={{ marginTop: 9, fontFamily: "var(--font-text)", fontSize: 11.5, fontWeight: 600, letterSpacing: "0.02em", textTransform: "uppercase", color: "var(--color-label-3)" }}>{p.views} просмотров</div>
        )}
      </div>

      {/* лайтбокс + шиты */}
      {view !== null && p.photos.length > 0 && <PhotoLightbox photos={p.photos} index={view} onIndex={setView} onClose={() => setView(null)} />}
      <BookMenuSheet open={menu} onClose={() => setMenu(false)} onSelect={onPick} variant="book" />
      {qr && <QrSheet url={postUrl(p.id)} data={{ kind: "card", title: head, subtitle: fmtDate(p.date) }} onClose={() => setQr(false)} />}
      <ReportSheet open={report} onClose={() => setReport(false)} context={`Лента · пост ${postUrl(p.id)}`} />
    </article>
  );
}

export function HomeFeed({ onDonate }: { onDonate?: () => void }) {
  const [posts, setPosts] = useState<TgPost[] | null>(null);
  const [err, setErr] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = (m: string) => { setToast(m); if (toastT.current) clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(null), 2400); };

  // Бесконечная лента: t.me/s отдаёт страницами по ~20, листаем ?before=<id самого старого>
  const [hasMore, setHasMore] = useState(true);
  const loadingMore = useRef(false);
  const oldestRef = useRef<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch(api("/tg/iskcone"))
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((j) => {
        const ps = (j.posts || []) as TgPost[];
        setPosts(ps);
        oldestRef.current = j.oldest ?? (ps.length ? ps[ps.length - 1].id : null);
        setHasMore(j.hasMore !== false && ps.length > 0);
      })
      .catch(() => setErr(true));
  }, []);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !posts || !hasMore) return;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      if (loadingMore.current || !oldestRef.current) return;
      loadingMore.current = true;
      fetch(api("/tg/iskcone") + "?before=" + encodeURIComponent(oldestRef.current))
        .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
        .then((j) => {
          const more = (j.posts || []) as TgPost[];
          setPosts((cur) => {
            const seen = new Set((cur || []).map((x) => x.id));
            return [...(cur || []), ...more.filter((x) => !seen.has(x.id))];
          });
          oldestRef.current = j.oldest ?? (more.length ? more[more.length - 1].id : null);
          if (j.hasMore === false || more.length === 0) setHasMore(false);
        })
        .catch(() => setHasMore(false))
        .finally(() => { loadingMore.current = false; });
    }, { rootMargin: "900px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [posts, hasMore]);

  return (
    <div>
      <style>{`.iol-feed-carousel::-webkit-scrollbar{display:none}@keyframes feedspin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ padding: "20px 0 0" }}>
        <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800, letterSpacing: "-0.022em", lineHeight: 1.1, color: "var(--color-label)" }}>ISKCON ONE LOVE</h2>
        <p style={{ margin: "8px 0 0", fontFamily: "var(--font-text)", fontSize: 14, lineHeight: 1.5, color: "var(--color-label-2)" }}>
          Вдохновение, события и даршаны всемирного движения Харе Кришна в этой беспрецедентной волне Гауранга Лилы. Присоединяйся.
        </p>
      </div>

      <div style={{ marginTop: 16 }} aria-live="polite">
        {err && (
          <div style={{ padding: "30px 10px", textAlign: "center", fontFamily: "var(--font-text)", fontSize: 14.5, lineHeight: 1.55, color: "var(--color-label-3)" }}>
            Лента временно недоступна.<br />
            <a href={CHANNEL_URL} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-brand-blue)", textDecoration: "none", fontWeight: 600 }}>Открыть канал в Telegram →</a>
          </div>
        )}
        {!err && !posts && (
          <div style={{ display: "grid", gap: 12 }}>
            {[0, 1, 2].map((i) => <div key={i} style={{ height: 320, ...fill, opacity: 0.6 }} />)}
          </div>
        )}
        {posts && posts.length > 0 && (
          <div style={{ display: "grid", gap: 12 }}>
            {posts.map((p) => (
              <FeedPost key={p.id} p={p} open={expanded.has(p.id)} onDonate={onDonate} flash={flash}
                onToggle={() => setExpanded((s) => { const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })} />
            ))}
          </div>
        )}
        {posts && posts.length > 0 && hasMore && (
          <div ref={sentinelRef} aria-hidden style={{ padding: "18px 0", display: "grid", placeItems: "center" }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", border: "2.5px solid var(--color-hairline)", borderTopColor: GOLD, animation: "feedspin .8s linear infinite" }} />
          </div>
        )}
        {posts && posts.length > 0 && !hasMore && (
          <p style={{ margin: "18px 2px 0", textAlign: "center", fontFamily: "var(--font-text)", fontSize: 12, color: "var(--color-label-3)" }}>Вы долистали до начала канала.</p>
        )}
        {posts && posts.length === 0 && (
          <div style={{ padding: "30px 10px", textAlign: "center", fontFamily: "var(--font-text)", fontSize: 14.5, color: "var(--color-label-3)" }}>
            Пока нет постов. <a href={CHANNEL_URL} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-brand-blue)", textDecoration: "none", fontWeight: 600 }}>Открыть канал →</a>
          </div>
        )}
      </div>

      {toast && (
        <div style={{ position: "fixed", left: "50%", bottom: 96, transform: "translateX(-50%)", zIndex: 2200, background: "rgba(28,28,30,0.96)", color: "#fff", padding: "13px 18px", borderRadius: 14, fontSize: 13.5, lineHeight: 1.5, fontFamily: "var(--font-text)", boxShadow: "0 12px 40px rgba(0,0,0,0.3)", width: "calc(100% - 40px)", maxWidth: 380, textAlign: "center" }}>{toast}</div>
      )}
    </div>
  );
}
