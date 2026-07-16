/**
 * HomeFeed — «Лента ISKCON ONE LOVE»: публичный Telegram-канал @iskcone целиком.
 * Карточка поста (в стиле Instagram, сверху вниз):
 *   медиа (фото / свайп-карусель с точками / видео) с действиями ОВЕРЛЕЕМ на
 *     самом кадре — по стандарту наших ВКП (стеклянные RoundBtn, top-right):
 *     ♥ В избранное  ·  ✈ Telegram (оригинальный плейн без круга)  ·  ⋯
 *   подпись поста (без префикса-имени — канал назван ссылкой в самом тексте)
 *   техданные: дата · просмотры (мелко, не капсом, по iOS)
 *
 * Медиа показываем ЦЕЛИКОМ (object-fit: contain) поверх размытой подложки того
 * же кадра — без обрезки и без cover-увеличения. Исходники — веб-превью Telegram.
 *
 * ⋯ → BookMenuSheet: Поделиться · Скачать PDF · QR-код · Задонатить · Сообщить
 * об ошибке. PDF поста собирается на КЛИЕНТЕ (книжный print-CSS) — серверный
 * /pdf?kind=card рендерит из D1, а посты ленты живут только в Telegram.
 *
 * Данные — с воркера /api/tg/iskcone (парсинг t.me/s, кеш 5 мин), бесконечная лента.
 */
import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { CardActionBtns } from "./cardActions";
import { AudioShowcaseCard } from "./AudioShowcaseCard";
import { BookMenuSheet } from "./BookMenuSheet";
import { QrSheet } from "./QrSheet";
import { ReportSheet } from "./ReportSheet";
import { exportToPdf, downloadServerPdf } from "./pdf";
import { COVER_FALLBACK } from "./ui/CoverFallback";

const GOLD = "var(--color-gold)";
const fill: React.CSSProperties = { background: "var(--color-bg)", borderRadius: 20 };

interface TgSeg { t: "t" | "a"; v: string; href?: string }
interface TgVideo { thumb: string; src: string | null; duration: string; round: boolean }
interface TgAudio { kind: "voice" | "audio" | "file"; title: string; meta: string; src: string | null; kindLabel?: string }
interface TgLink { href: string; title: string; desc: string; img: string | null }
export interface TgPost {
  id: string; date: string; views: string; text: string;
  rich: TgSeg[]; photos: string[]; photosFull?: string[]; videos: TgVideo[]; audios: TgAudio[]; link: TgLink | null;
}

const postUrl = (id: string) => `https://t.me/iskcone/${id}`;
const CHANNEL_URL = "https://t.me/iskcone";

function fmtDate(iso: string): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }).replace(/\s*г\.$/, ""); }
  catch { return ""; }
}

/** Декодирование HTML-сущностей из текста Telegram (&#33; → !, &amp; → & и т. д.). */
function decodeEntities(s: string): string {
  if (!s || s.indexOf("&") === -1) return s;
  if (typeof document !== "undefined") {
    const el = document.createElement("textarea");
    el.innerHTML = s;
    return el.value;
  }
  return s
    .replace(/&#(\d+);/g, (m, n) => { try { return String.fromCodePoint(+n); } catch { return m; } })
    .replace(/&#x([0-9a-fA-F]+);/g, (m, h) => { try { return String.fromCodePoint(parseInt(h, 16)); } catch { return m; } })
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}

/** Первая непустая строка подписи — заголовок для избранного / share / QR / PDF. */
function leadLine(text: string): string {
  const l = (text || "").split("\n").find((x) => x.trim());
  return decodeEntities((l || "").trim());
}

/* ── подпись поста: инлайн-сегменты с живыми ссылками (с опц. обрезкой) ── */
function renderRich(rich: TgSeg[], clampTo: number | null): React.ReactNode[] {
  let used = 0;
  const out: React.ReactNode[] = [];
  for (let i = 0; i < rich.length; i++) {
    const s = rich[i];
    let v = decodeEntities(s.v);
    if (clampTo !== null) {
      if (used >= clampTo) break;
      const full = v.length;
      if (used + full > clampTo) v = v.slice(0, clampTo - used).replace(/\s+\S*$/, "") + "…";
      used += full;
    }
    if (s.t === "a" && s.href) {
      out.push(
        <a key={i} href={s.href} target="_blank" rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{ color: "var(--color-gold-deep)", textDecoration: "none", fontWeight: 600, wordBreak: "break-word" }}>{v}</a>
      );
    } else out.push(<span key={i}>{v}</span>);
  }
  return out;
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
      style={{ position: "fixed", inset: 0, zIndex: 96, background: "#000", overflow: "hidden" }}>
      {/* Размытая подложка из текущего кадра — закрывает поля у вертикальных фото (как в сторис). */}
      <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: `url("${photos[index]}")`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(34px) brightness(0.5)", transform: "scale(1.18)" }} />
      {/* Бокс img = строго экран (position:absolute; inset:0 → ОПРЕДЕЛЁННАЯ высота, без грид-багов
          с max-height:100%: из-за них вертикальные кадры не ограничивались по высоте, тянулись на
          всю ширину и обрезались снизу). objectFit:contain показывает кадр ЦЕЛИКОМ — мурти не режем. */}
      <img src={photos[index]} alt="" onClick={(e) => e.stopPropagation()}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", objectPosition: "center", imageOrientation: "from-image" }} />
      <button type="button" aria-label="Закрыть" onClick={onClose}
        style={{ ...round, top: "calc(env(safe-area-inset-top,0px) + 14px)", right: 14 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      </button>
      {total > 1 && (
        <>
          <span style={{ position: "absolute", top: "calc(env(safe-area-inset-top,0px) + 23px)", left: 16, fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 600, color: "rgba(255,255,255,0.85)", zIndex: 2 }}>{index + 1} / {total}</span>
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

/* ── медиа: 1 фото — натурально; 2+ — свайп-карусель с точками; видео ──
 *  Кадр показываем ЦЕЛИКОМ (contain) поверх размытой подложки — без обрезки и
 *  cover-увеличения. Счётчик «1/9» — слева сверху (справа сверху живут действия). */
function PostMedia({ p, onOpen }: { p: TgPost; onOpen: (i: number) => void }) {
  // Прогрессивная загрузка как в Instagram/Telegram: показываем полноразмер (display),
  // а под ним — лёгкое превью (preview) мгновенным фоном, чтобы не было серого ожидания.
  const display = (p.photosFull && p.photosFull.length) ? p.photosFull : p.photos;
  const preview = p.photos;
  const [idx, setIdx] = useState(0);
  const [ar, setAr] = useState<number | null>(null);  // аспект кадра берём из ПЕРВОГО фото (как в Instagram)
  const scRef = useRef<HTMLDivElement | null>(null);
  const downRef = useRef<{ x: number; y: number; t: number } | null>(null);

  // Открываем лайтбокс ТОЛЬКО на чистом тапе: если палец сместился (свайп карусели
  // или скролл страницы) или удержание долгое — это жест, а не клик, не открываем.
  const onDown = (e: React.PointerEvent) => { downRef.current = { x: e.clientX, y: e.clientY, t: Date.now() }; };
  const tryOpen = (i: number, e: React.MouseEvent) => {
    const d = downRef.current;
    if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) <= 10 && Date.now() - d.t <= 600) onOpen(i);
  };

  const onScroll = () => {
    const el = scRef.current; if (!el) return;
    const w = el.clientWidth; if (w) setIdx(Math.round(el.scrollLeft / w));
  };

  if (display.length === 1) {
    return (
      <div onPointerDown={onDown} onClick={(e) => tryOpen(0, e)}
        style={{ background: "var(--color-bg)", backgroundImage: preview[0] && preview[0] !== display[0] ? `url("${preview[0]}")` : undefined, backgroundSize: "cover", backgroundPosition: "center" }}>
        <img src={display[0]} alt="" loading="lazy"
          style={{ width: "100%", height: "auto", display: "block", cursor: "zoom-in", imageOrientation: "from-image" }} />
      </div>
    );
  }

  if (display.length > 1) {
    // Единый кадр на всю карусель, его аспект задаёт ПЕРВОЕ фото. Кадр показываем
    // ЦЕЛИКОМ (object-fit: contain) — мурти/Божеств НИКОГДА не режем. Раньше тут был
    // cover + кламп 4:5 (0.8): любой вертикальный даршан выше 4:5 терял верх/низ (срезало
    // корону/стопы — «обрезка на 90%»). Поля по краям закрывает размытая подложка из того же
    // кадра (как в Stories/лайтбоксе). Высота фиксирована через padding-bottom, чтобы при
    // свайпе не «плавала». Contain делает фит устойчивым к EXIF-повёрнутым фото: даже при
    // неверно замеренном аспекте кадр не обрезается, лишь шире поля подложки.
    const frame = ar ? Math.min(1.91, Math.max(0.5, ar)) : 0.8;
    return (
      <div style={{ position: "relative", width: "100%", paddingBottom: (100 / frame).toFixed(3) + "%", background: "#000", overflow: "hidden" }}>
        <div ref={scRef} onScroll={onScroll} onPointerDown={onDown} className="iol-feed-carousel"
          style={{ position: "absolute", inset: 0, display: "flex", overflowX: "auto", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
          {display.map((src, i) => (
            <div key={i} style={{ flex: "0 0 100%", scrollSnapAlign: "center", scrollSnapStop: "always", position: "relative", height: "100%", overflow: "hidden" }}>
              {preview[i] && <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: `url("${preview[i]}")`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(30px) brightness(0.55)", transform: "scale(1.15)" }} />}
              <img src={src} alt="" loading="lazy" onClick={(e) => tryOpen(i, e)}
                onLoad={i === 0 ? (e) => { const n = e.currentTarget; if (n.naturalWidth && n.naturalHeight) setAr(n.naturalWidth / n.naturalHeight); } : undefined}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", objectPosition: "center", cursor: "zoom-in", imageOrientation: "from-image" }} />
            </div>
          ))}
        </div>
        <span style={{ position: "absolute", top: 16, left: 16, padding: "3px 9px", borderRadius: 999, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", color: "#fff", fontSize: "var(--text-caption)", fontWeight: 700, fontFamily: "var(--font-text)", letterSpacing: "0.2px", zIndex: 3 }}>{idx + 1}/{display.length}</span>
        <div aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: 14, display: "flex", justifyContent: "center", gap: 5, pointerEvents: "none", zIndex: 3 }}>
          {display.map((_, i) => (
            <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i === idx ? "#fff" : "rgba(255,255,255,0.5)", boxShadow: "0 0 2px rgba(0,0,0,0.4)", transition: "background .2s" }} />
          ))}
        </div>
      </div>
    );
  }

  return <>{p.videos.map((v, i) => <VideoBox key={i} v={v} id={p.id} />)}</>;
}

/* ── видео: превью + длительность; тап — проигрывание ЗДЕСЬ (никогда не выкидывает в ТГ) ──
 * Есть прямой src (вебпревью ТГ или мост feed_video → archive.org): бесшовный <video> как рилс.
 * Нет src (крупное «not_supported» видео канала): инлайн-плеер Telegram в iframe — играет
 * внутри приложения, без ухода на t.me. Высоту iframe берём из resize-сообщений Telegram. */
function VideoBox({ v, id }: { v: TgVideo; id: string }) {
  const [playing, setPlaying] = useState(false);
  // ЗКН-Пл005: незамирроренное видео НЕ встраивается сырым Telegram-виджетом в ленту
  // («Media is too big»). Пока зеркало archive.org не готово — открываем пост в
  // Telegram новой вкладкой, а в ленте остаётся только наша опрятная превью-карточка.
  const openTg = () => { if (typeof window !== "undefined") window.open(postUrl(id), "_blank", "noopener,noreferrer"); };
  const open = () => { if (v.src) setPlaying(true); else openTg(); };

  if (playing && v.src) {
    return (
      <div style={{ background: "#000" }}>
        <video src={v.src} poster={v.thumb || undefined} controls autoPlay playsInline preload="metadata"
          onError={() => setPlaying(false)}
          style={{ width: "100%", display: "block", maxHeight: "80vh", background: "#000", ...(v.round ? { aspectRatio: "1 / 1", borderRadius: "50%", objectFit: "cover", maxWidth: 320, margin: "14px auto" } : {}) }} />
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
        : <img src={COVER_FALLBACK} alt="" loading="lazy" style={{ width: "100%", aspectRatio: v.round ? "1 / 1" : "16 / 9", objectFit: "cover", borderRadius: v.round ? "50%" : undefined }} />}
      {false && <div style={{ aspectRatio: v.round ? "1 / 1" : "16 / 9", background: "var(--color-glass-regular)" }} />}
      <span aria-hidden style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
        <span style={{ width: 54, height: 54, borderRadius: "50%", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" style={{ marginLeft: 3 }}><path d="M8 5v14l11-7z" fill="#fff" /></svg>
        </span>
      </span>
      {v.duration && (
        <span style={{ position: "absolute", left: 10, bottom: 10, padding: "3px 8px", borderRadius: 999, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", fontFamily: "var(--font-text)", fontSize: "var(--text-caption)", fontWeight: 700, color: "#fff", letterSpacing: "0.2px" }}>{v.duration}</span>
      )}
    </div>
  );
}

/* ── аудио и файлы: карточка как в Telegram, открывается в Telegram ── */
function TgAudioCard({ a, id, flash, onMore }: { a: TgAudio; id: string; flash?: (m: string) => void; onMore?: () => void }) {
  // ЗКН-Д015: звук рисует ОДИН компонент — ВКЗ. Голосовое — тоже звук: у него нет
  // автора и метки вида (заголовок сам всё говорит), но есть длительность —
  // Telegram отдаёт её в meta, показываем ДО нажатия.
  if (a.src) {
    const voice = a.kind === "voice";
    const ttl = decodeEntities(a.title) || "Аудио";
    const who = voice ? undefined : (decodeEntities(a.meta) || undefined);
    return (
      <AudioShowcaseCard src={a.src} title={ttl} presenter={who}
        kindLabel={voice ? undefined : (a.kindLabel || "Аудио")}
        durationHint={voice ? (a.meta || undefined) : undefined}
        favKey={`audio:${id}`} favMeta={{ t: ttl.slice(0, 140), s: who, h: `/post/${id}` }}
        onMore={onMore} flash={flash} />
    );
  }
  return (
    <a href={postUrl(id)} target="_blank" rel="noopener noreferrer"
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", margin: "10px 0 0", borderRadius: 16, background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)", textDecoration: "none", WebkitTapHighlightColor: "transparent" }}>
      <span aria-hidden style={{ width: 40, height: 40, flexShrink: 0, borderRadius: "50%", background: GOLD, display: "grid", placeItems: "center" }}>
        {a.kind === "file"
          ? <svg width="17" height="17" viewBox="0 0 24 24"><path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinejoin="round" /><path d="M14 2v5h5" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinejoin="round" /></svg>
          : <svg width="17" height="17" viewBox="0 0 24 24"><path d="M9 18V6l10-2v12" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /><circle cx="6.5" cy="18" r="2.5" fill="#fff" /><circle cx="16.5" cy="16" r="2.5" fill="#fff" /></svg>}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 600, color: "var(--color-label)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</span>
        {a.meta && <span style={{ display: "block", marginTop: 2, fontFamily: "var(--font-text)", fontSize: "var(--text-caption)", color: "var(--color-label-3)" }}>{a.meta} · слушать в Telegram</span>}
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
        {l.title && <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 700, color: "var(--color-label)" }}>{l.title}</span>}
        {l.desc && <span style={{ display: "block", marginTop: 3, fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", lineHeight: 1.45, color: "var(--color-label-2)" }}>{l.desc}</span>}
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
  // Профессиональная компактная вёрстка: единый блок заголовка (надстрочная Georgia ·
  // имена Божеств · дата · метаданные) держится целиком на первой странице, затем фото —
  // СЕТКОЙ 2×N в паспарту (contain, без обрезки Божеств), а не по одному кадру на лист.
  const root = document.createElement("div");
  root.style.maxWidth = "640px";
  root.style.margin = "0 auto";

  const text = (p.text || "").trim();
  const lines = text.split("\n");
  const li = lines.findIndex((l) => l.trim());
  const lead = li >= 0 ? lines[li].trim() : "";
  const restLines = (li >= 0 ? lines.slice(li + 1) : []).map((l) => l.trim()).filter(Boolean);

  // — блок заголовка (не разрывается между страницами) —
  const head = document.createElement("div");
  head.setAttribute("data-pdf-block", "");

  const eyebrow = document.createElement("div");
  eyebrow.textContent = "Лента · ISKCON ONE LOVE";
  Object.assign(eyebrow.style, { fontSize: "10pt", letterSpacing: "2px", textTransform: "uppercase", color: "#9a7a14", fontFamily: "Georgia, serif" });
  head.appendChild(eyebrow);

  if (lead) {
    const h1 = document.createElement("h1");
    h1.textContent = lead;
    Object.assign(h1.style, { margin: "10pt 0 0", fontSize: "21pt", lineHeight: "1.18", letterSpacing: "-0.01em", fontWeight: "800" });
    head.appendChild(h1);
  }

  const sub = document.createElement("div");
  sub.textContent = fmtDate(p.date);
  Object.assign(sub.style, { marginTop: "5pt", fontSize: "11pt", color: "#8a8a8e" });
  head.appendChild(sub);

  if (restLines.length) {
    const meta = document.createElement("div");
    Object.assign(meta.style, { marginTop: "9pt", fontSize: "11.5pt", lineHeight: "1.5", color: "#3a3b40" });
    restLines.forEach((ln) => {
      const d = document.createElement("div");
      d.textContent = ln;
      meta.appendChild(d);
    });
    head.appendChild(meta);
  }
  root.appendChild(head);

  // — фото: сетка 2 колонки, паспарту, contain (без обрезки) —
  if (p.photos.length) {
    const grid = document.createElement("div");
    Object.assign(grid.style, { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4mm", marginTop: "14pt" });
    p.photos.forEach((src) => {
      const cell = document.createElement("div");
      cell.setAttribute("data-pdf-block", "");
      Object.assign(cell.style, { aspectRatio: "4 / 5", background: "#f4f4f6", borderRadius: "6px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" });
      const img = document.createElement("img");
      img.src = src;
      Object.assign(img.style, { width: "100%", height: "100%", objectFit: "contain", display: "block" });
      cell.appendChild(img);
      grid.appendChild(cell);
    });
    root.appendChild(grid);
  }

  return root;
}
async function downloadPostPdf(p: TgPost, flash: (m: string) => void) {
  const head = leadLine(p.text) || "ISKCON ONE LOVE";
  // Серверный конвейер: headless-Chrome рендерит карточку в настоящий PDF-файл
  // (профессиональная вёрстка A4, бренд-футер iskcone.com — как в PDF книг).
  await downloadServerPdf(
    `/pdf?kind=card&type=post&id=${encodeURIComponent(p.id)}&name=${encodeURIComponent(head)}`,
    `${head}.pdf`,
    { onStatus: flash, fallback: () => { void preloadImages(p.photos).then(() => exportToPdf(buildPostPrintNode(p), { title: head })); } },
  );
}

/* ── один пост ленты ─────────────────────────────────────────────────────── */
export function FeedPost({ p, open, onToggle, onDonate, flash }: {
  p: TgPost; open: boolean; onToggle: () => void; onDonate?: () => void; flash: (m: string) => void;
}) {
  const [view, setView] = useState<number | null>(null);
  const [menu, setMenu] = useState(false);
  const [qr, setQr] = useState(false);
  const [report, setReport] = useState(false);

  const head = leadLine(p.text) || "ISKCON ONE LOVE";
  const favKey = `post:${p.id}`;
  const favMeta = { t: head.slice(0, 140), s: fmtDate(p.date), h: `/post/${p.id}` };
  const long = p.text.length > 220;
  const hasMedia = p.photos.length > 0 || p.videos.length > 0;
  // Даршан-посты синтезируются из D1 и в Telegram-канале их нет — share/QR/report ведут
  // на пост в приложении, пункт «Открыть в Telegram» скрыт.
  const isDar = p.id.startsWith("d");
  const shareUrl = isDar ? `${typeof location !== "undefined" ? location.origin : "https://gaurangers.com"}/post/${p.id}` : postUrl(p.id);

  const onPick = (id: string) => {
    if (id === "telegram") { window.open(postUrl(p.id), "_blank", "noopener"); return; }
    if (id === "share") {
      if (typeof navigator !== "undefined" && navigator.share) navigator.share({ title: head, url: shareUrl }).catch(() => {});
      else { navigator.clipboard?.writeText(shareUrl).catch(() => {}); flash("Ссылка скопирована"); }
    } else if (id === "pdf") { void downloadPostPdf(p, flash); }
    else if (id === "qr") { setQr(true); }
    else if (id === "donate") { onDonate?.(); }
    else if (id === "report") { setReport(true); }
  };

  return (
    <article style={{ overflow: "hidden", ...fill }}>
      {/* медиа с действиями оверлеем — по эталону BookHeroCard (♥ + ⋯) */}
      {hasMedia ? (
        <div style={{ position: "relative" }}>
          <PostMedia p={p} onOpen={setView} />
          {/* верхний скрим — читаемость стеклянных кнопок на светлых фото (как у эталона) */}
          <div aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, height: 120, background: "linear-gradient(rgba(0,0,0,0.5), transparent)", pointerEvents: "none", zIndex: 2 }} />
          <div style={{ position: "absolute", top: 16, right: 16, zIndex: 4 }}>
            <CardActionBtns favKey={favKey} meta={favMeta} flash={flash} dark onMore={() => setMenu(true)} />
          </div>
        </div>
      ) : (
        <div style={{ padding: "0 16px 2px", display: "flex" }}>
          <span style={{ marginLeft: "auto" }}>
            <CardActionBtns favKey={favKey} meta={favMeta} flash={flash} onMore={() => setMenu(true)} />
          </span>
        </div>
      )}

      {/* подпись + техданные (дата · просмотры) */}
      <div style={{ padding: "11px 14px 0" }}>
        {p.text.trim() && (
          <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", lineHeight: 1.5, letterSpacing: "-0.01em", color: "var(--color-label)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {renderRich(p.rich.length > 0 ? p.rich : [{ t: "t", v: p.text }], long && !open ? 170 : null)}
            {long && (
              <button type="button" onClick={onToggle}
                style={{ marginLeft: 4, padding: 0, background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: 600, color: "var(--color-label-3)", WebkitTapHighlightColor: "transparent" }}>
                {open ? "свернуть" : "ещё"}
              </button>
            )}
          </div>
        )}
        {p.audios.map((a, i) => <TgAudioCard key={i} a={a} id={p.id} flash={flash} onMore={() => setMenu(true)} />)}
        {p.link && <TgLinkCard l={p.link} />}
        {(p.date || p.views) && (
          <div style={{ marginTop: 8, fontFamily: "var(--font-text)", fontSize: "var(--text-caption)", fontWeight: 400, lineHeight: 1.3, color: "var(--color-label-3)" }}>
            {fmtDate(p.date)}{p.date && p.views ? " · " : ""}{p.views ? `${p.views} просмотров` : ""}
          </div>
        )}
      </div>

      {/* лайтбокс + шиты */}
      {view !== null && (p.photosFull?.length || p.photos.length) > 0 && <PhotoLightbox photos={p.photosFull ?? p.photos} index={view} onIndex={setView} onClose={() => setView(null)} />}
      <BookMenuSheet open={menu} onClose={() => setMenu(false)} onSelect={onPick} variant="post" noTelegram={isDar} noPdf={p.audios.length > 0} />
      {qr && <QrSheet url={shareUrl} data={{ kind: "card", title: head, subtitle: fmtDate(p.date) }} onClose={() => setQr(false)} />}
      <ReportSheet open={report} onClose={() => setReport(false)} context={`Лента · пост ${shareUrl}`} />
    </article>
  );
}

/** Внешний медиа-элемент ленты (новость / IA-видео / IA-аудио), вклеиваемый в поток
 *  ТГ по дате. render() рисует карточку сам (владеет своим раскрытием), at — Unix-мс
 *  для хронологической сортировки вместе с постами канала. */
export type FeedExtra = { id: string; at: number; render: () => React.ReactNode };
export type FeedFilterKind = "photo" | "video" | "audio" | "file" | "link";

/* Есть ли у поста ТГ медиа запрошенного типа — предикат линз (Фото/Видео/Аудио/…). */
function postHasKind(p: TgPost, k: FeedFilterKind): boolean {
  switch (k) {
    case "photo": return p.photos.length > 0;
    case "video": return p.videos.length > 0;
    case "audio": return p.audios.some((a) => a.kind === "voice" || a.kind === "audio");
    case "file": return p.audios.some((a) => a.kind === "file");
    case "link": return p.link != null;
  }
}
const postAt = (p: TgPost): number => { const t = Date.parse(p.date); return Number.isFinite(t) ? t : 0; };

export function HomeFeed({ onDonate, filterKind = null, extraItems, intro }: {
  onDonate?: () => void;
  filterKind?: FeedFilterKind | null;   // показывать только посты ТГ с этим типом медиа
  extraItems?: FeedExtra[];             // новости/медиа из D1, вклеенные в поток по дате
  intro?: React.ReactNode;              // вводный блок над лентой (по умолчанию — про ИСККОН)
}) {
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

  // ЕДИНАЯ ЛЕНТА, МНОГО ЛИНЗ: посты канала (по фильтру медиа) + внешние элементы
  // (новости, IA-видео/аудио) сливаются в ОДИН поток и сортируются по дате. Каждый
  // элемент рисует свою карточку сам. Раскрытие постов ТГ помним по id (expanded).
  const filtered = filterKind ? (posts || []).filter((p) => postHasKind(p, filterKind)) : (posts || []);
  const rows: { key: string; at: number; el: React.ReactNode }[] = filtered.map((p) => ({
    key: "tg-" + p.id, at: postAt(p),
    el: (
      <FeedPost key={"tg-" + p.id} p={p} open={expanded.has(p.id)} onDonate={onDonate} flash={flash}
        onToggle={() => setExpanded((s) => { const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })} />
    ),
  }));
  if (extraItems) for (const ex of extraItems) rows.push({ key: ex.id, at: ex.at, el: <div key={ex.id}>{ex.render()}</div> });
  rows.sort((a, b) => b.at - a.at);
  const showSkeleton = !err && posts == null && rows.length === 0;
  const showEmpty = posts != null && !hasMore && rows.length === 0;

  return (
    <div>
      <style>{`.iol-feed-carousel::-webkit-scrollbar{display:none}@keyframes feedspin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ padding: "20px 0 0" }}>
        {intro !== undefined ? intro : (
          <p style={{ margin: 0, fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", lineHeight: 1.5, color: "var(--color-label-2)" }}>
            Вдохновение дарами, которые принес Шрила Прабхупада в этой беспрецедентной волне Гауранга Лилы — Международное общество сознание Кришны (ИСККОН), развивающееся по всему миру и распространяющее Прему высшего порядка.
          </p>
        )}
      </div>

      <div style={{ marginTop: 28 }} aria-live="polite">
        {err && (
          <div style={{ padding: "30px 10px", textAlign: "center", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", lineHeight: 1.55, color: "var(--color-label-3)" }}>
            Лента временно недоступна.<br />
            <a href={CHANNEL_URL} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-gold-deep)", textDecoration: "none", fontWeight: 600 }}>Открыть канал в Telegram →</a>
          </div>
        )}
        {showSkeleton && (
          <div style={{ display: "grid", gap: 20 }}>
            {[0, 1, 2].map((i) => <div key={i} style={{ height: 360, ...fill, opacity: 0.6 }} />)}
          </div>
        )}
        {rows.length > 0 && (
          <div>
            {rows.map((r, i) => (
              <div key={r.key}>
                {i > 0 && <div aria-hidden style={{ height: 0.5, background: "var(--color-hairline)", margin: "22px 0" }} />}
                {r.el}
              </div>
            ))}
          </div>
        )}
        {posts && posts.length > 0 && hasMore && (
          <div ref={sentinelRef} aria-hidden style={{ padding: "18px 0", display: "grid", placeItems: "center" }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", border: "2.5px solid var(--color-hairline)", borderTopColor: GOLD, animation: "feedspin .8s linear infinite" }} />
          </div>
        )}
        {posts && posts.length > 0 && !hasMore && !filterKind && !extraItems && (
          <p style={{ margin: "18px 2px 0", textAlign: "center", fontFamily: "var(--font-text)", fontSize: "var(--text-caption)", color: "var(--color-label-3)" }}>Вы долистали до начала канала.</p>
        )}
        {showEmpty && (
          <div style={{ padding: "44px 16px", textAlign: "center", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", lineHeight: 1.55, color: "var(--color-label-3)" }}>
            {filterKind ? "Здесь пока пусто." : <>Пока нет постов. <a href={CHANNEL_URL} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-gold-deep)", textDecoration: "none", fontWeight: 600 }}>Открыть канал →</a></>}
          </div>
        )}
      </div>

      {toast && (
        <div style={{ position: "fixed", left: "50%", bottom: 96, transform: "translateX(-50%)", zIndex: 2200, background: "rgba(28,28,30,0.96)", color: "#fff", padding: "13px 18px", borderRadius: 14, fontSize: "var(--text-footnote)", lineHeight: 1.5, fontFamily: "var(--font-text)", boxShadow: "0 12px 40px rgba(0,0,0,0.3)", width: "calc(100% - 40px)", maxWidth: 380, textAlign: "center" }}>{toast}</div>
      )}
    </div>
  );
}

/* ── фокус-вид одного поста (открывается из избранного по /post/<id>) ─────────
 *  Тянем конкретный пост канала: t.me/s/iskcone?before=<id+1> отдаёт страницу,
 *  включающую нужный id; если не нашли (свежий) — берём последнюю страницу. */
export function FeedPostFocus({ id, onBack, onDonate }: { id: string; onBack: () => void; onDonate?: () => void }) {
  const [post, setPost] = useState<TgPost | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [open, setOpen] = useState(true);
  const [toast, setToast] = useState("");
  const flash = (m: string) => { setToast(m); window.setTimeout(() => setToast(""), 2400); };

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const find = (j: { posts?: TgPost[] }) => (j.posts || []).find((x) => String(x.id) === String(id)) || null;
        let j = await (await fetch(api("/tg/iskcone") + "?post=" + encodeURIComponent(id))).json();
        let found = find(j);
        if (!found) { j = await (await fetch(api("/tg/iskcone"))).json(); found = find(j); }
        if (!live) return;
        setPost(found); setState(found ? "ok" : "error");
      } catch { if (live) setState("error"); }
    })();
    return () => { live = false; };
  }, [id]);

  return (
    <div style={{ minHeight: "100dvh", background: "var(--color-bg)" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center", height: 52, padding: "0 8px",
        background: "color-mix(in srgb, var(--color-bg) 86%, transparent)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderBottom: "0.5px solid var(--color-hairline)" }}>
        <button type="button" aria-label="Назад" onClick={onBack}
          style={{ display: "grid", height: 38, width: 38, placeItems: "center", borderRadius: "50%", border: "none", background: "none", color: "var(--color-label)", cursor: "pointer" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <span style={{ flex: 1, minWidth: 0, textAlign: "center", fontFamily: "var(--font-text)", fontSize: "var(--text-callout)", fontWeight: 700, letterSpacing: "0.04em", color: "var(--color-label)", paddingRight: 38 }}>ISKCON ONE LOVE</span>
      </header>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px 0 40px" }}>
        {state === "loading" && (
          <div style={{ padding: "40px 0", display: "grid", placeItems: "center" }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", border: "2.5px solid var(--color-hairline)", borderTopColor: GOLD, animation: "feedspin .8s linear infinite" }} />
          </div>
        )}
        {state === "error" && (
          <div style={{ padding: "40px 16px", textAlign: "center", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", lineHeight: 1.55, color: "var(--color-label-3)" }}>
            Не удалось открыть пост.<br />
            <a href={postUrl(id)} target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-gold-deep)", textDecoration: "none", fontWeight: 600 }}>Открыть в Telegram →</a>
          </div>
        )}
        {state === "ok" && post && (
          <FeedPost p={post} open={open} onToggle={() => setOpen((v) => !v)} onDonate={onDonate} flash={flash} />
        )}
      </div>

      <style>{`@keyframes feedspin{to{transform:rotate(360deg)}}`}</style>
      {toast && (
        <div style={{ position: "fixed", left: "50%", bottom: 96, transform: "translateX(-50%)", zIndex: 2200, background: "rgba(28,28,30,0.96)", color: "#fff", padding: "13px 18px", borderRadius: 14, fontSize: "var(--text-footnote)", lineHeight: 1.5, fontFamily: "var(--font-text)", boxShadow: "0 12px 40px rgba(0,0,0,0.3)", width: "calc(100% - 40px)", maxWidth: 380, textAlign: "center" }}>{toast}</div>
      )}
    </div>
  );
}
