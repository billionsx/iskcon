/**
 * HomeFeed — «Лента ISKCON»: публичный Telegram-канал @iskcone полностью,
 * как в Telegram: текст со ссылками, фото-альбомы, видео (превью + длительность,
 * проигрывание в приложении где доступно), голосовые и аудио, превью ссылок.
 * Данные — с воркера /api/tg/iskcone (парсинг t.me/s, кеш 5 мин).
 */
import { useEffect, useRef, useState } from "react";
import { api } from "./api";

const GOLD = "#D2AA1B";
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

function fmtDate(iso: string): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }); }
  catch { return ""; }
}

/* ── текст поста: сегменты с живыми ссылками ── */
function RichText({ rich, clampTo }: { rich: TgSeg[]; clampTo: number | null }) {
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
  return (
    <p style={{ margin: "8px 0 0", fontFamily: "var(--font-text)", fontSize: 14.5, lineHeight: 1.55, letterSpacing: "-0.01em", color: "var(--color-label)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
      {out}
    </p>
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

/* ── фото: 1 — во всю ширину, 2+ — сетка как в Telegram; тап — лайтбокс ── */
function TgPhotos({ photos }: { photos: string[] }) {
  const [view, setView] = useState<number | null>(null);
  const odd = photos.length % 2 === 1;
  return (
    <>
      {photos.length === 1 ? (
        <div style={{ background: "var(--color-glass-regular)" }}>
          <img src={photos[0]} alt="" loading="lazy" onClick={() => setView(0)}
            style={{ width: "100%", display: "block", maxHeight: 420, objectFit: "cover", cursor: "zoom-in", imageOrientation: "from-image" }} />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, background: "var(--color-glass-regular)" }}>
          {photos.map((src, i) => (
            <img key={i} src={src} alt="" loading="lazy" onClick={() => setView(i)}
              style={{ width: "100%", height: "100%", display: "block", objectFit: "cover", cursor: "zoom-in", imageOrientation: "from-image",
                aspectRatio: odd && i === 0 ? "2 / 1" : "1 / 1", gridColumn: odd && i === 0 ? "1 / -1" : undefined }} />
          ))}
        </div>
      )}
      {view !== null && <PhotoLightbox photos={photos} index={view} onIndex={setView} onClose={() => setView(null)} />}
    </>
  );
}

/* ── видео: превью + длительность; тап — проигрывание здесь либо пост в Telegram ── */
function TgVideoBox({ v, id }: { v: TgVideo; id: string }) {
  const [playing, setPlaying] = useState(false);
  const open = () => { if (v.src) setPlaying(true); else window.open(postUrl(id), "_blank", "noopener"); };
  if (playing && v.src) {
    return (
      <div style={{ background: "#000" }}>
        <video src={v.src} poster={v.thumb || undefined} controls autoPlay playsInline
          onError={() => { setPlaying(false); window.open(postUrl(id), "_blank", "noopener"); }}
          style={{ width: "100%", display: "block", maxHeight: 440, ...(v.round ? { aspectRatio: "1 / 1", borderRadius: "50%", objectFit: "cover", maxWidth: 280, margin: "14px auto" } : {}) }} />
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
      style={{ display: "block", margin: "10px 0 0", borderRadius: 16, overflow: "hidden", border: "1px solid var(--color-separator)", textDecoration: "none", WebkitTapHighlightColor: "transparent" }}>
      {l.img && <img src={l.img} alt="" loading="lazy" style={{ width: "100%", display: "block", aspectRatio: "16 / 8", objectFit: "cover" }} />}
      <span style={{ display: "block", padding: "10px 14px 12px" }}>
        {l.title && <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: 13.5, fontWeight: 700, color: "var(--color-label)" }}>{l.title}</span>}
        {l.desc && <span style={{ display: "block", marginTop: 3, fontFamily: "var(--font-text)", fontSize: 12.5, lineHeight: 1.45, color: "var(--color-label-2)" }}>{l.desc}</span>}
      </span>
    </a>
  );
}

export function HomeFeed() {
  const [posts, setPosts] = useState<TgPost[] | null>(null);
  const [err, setErr] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
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
      <div style={{ padding: "20px 0 0" }}>
        <div style={{ fontFamily: "var(--font-text)", fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLD }}>Telegram</div>
        <h2 style={{ margin: "5px 0 0", fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800, letterSpacing: "-0.022em", lineHeight: 1.1, color: "var(--color-label)" }}>Лента ISKCON</h2>
        <p style={{ margin: "8px 0 0", fontFamily: "var(--font-text)", fontSize: 14, lineHeight: 1.5, color: "var(--color-label-2)" }}>
          Живая лента канала <a href="https://t.me/iskcone" target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-brand-blue)", textDecoration: "none", fontWeight: 600 }}>@iskcone</a> — вдохновение, события и материалы движения.
        </p>
      </div>

      <div style={{ marginTop: 16 }} aria-live="polite">
        {err && (
          <div style={{ padding: "30px 10px", textAlign: "center", fontFamily: "var(--font-text)", fontSize: 14.5, lineHeight: 1.55, color: "var(--color-label-3)" }}>
            Лента временно недоступна.<br />
            <a href="https://t.me/iskcone" target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-brand-blue)", textDecoration: "none", fontWeight: 600 }}>Открыть канал в Telegram →</a>
          </div>
        )}
        {!err && !posts && (
          <div style={{ display: "grid", gap: 12 }}>
            {[0, 1, 2].map((i) => <div key={i} style={{ height: 180, ...fill, opacity: 0.6 }} />)}
          </div>
        )}
        {posts && posts.length > 0 && (
          <div style={{ display: "grid", gap: 12 }}>
            {posts.map((p) => {
              const long = p.text.length > 420;
              const open = expanded.has(p.id);
              return (
                <article key={p.id} style={{ overflow: "hidden", ...fill }}>
                  {p.photos.length > 0 && <TgPhotos photos={p.photos} />}
                  {p.videos.map((v, i) => <TgVideoBox key={i} v={v} id={p.id} />)}
                  <div style={{ padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-text)", fontSize: 12, color: "var(--color-label-3)" }}>
                      <span>{fmtDate(p.date)}</span>
                      {p.views && <><span aria-hidden>·</span><span>{p.views} просмотров</span></>}
                    </div>
                    {p.rich.length > 0 && <RichText rich={p.rich} clampTo={long && !open ? 400 : null} />}
                    {p.audios.map((a, i) => <TgAudioCard key={i} a={a} id={p.id} />)}
                    {p.link && <TgLinkCard l={p.link} />}
                    <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 14 }}>
                      {long && (
                        <button type="button" onClick={() => setExpanded((s) => { const n = new Set(s); if (open) n.delete(p.id); else n.add(p.id); return n; })}
                          style={{ padding: 0, background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-text)", fontSize: 13.5, fontWeight: 600, color: "var(--color-label-2)", WebkitTapHighlightColor: "transparent" }}>
                          {open ? "Свернуть" : "Читать полностью"}
                        </button>
                      )}
                      <a href={postUrl(p.id)} target="_blank" rel="noopener noreferrer"
                        style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4, fontFamily: "var(--font-text)", fontSize: 13.5, fontWeight: 600, color: "var(--color-brand-blue)", textDecoration: "none" }}>
                        Открыть в Telegram
                        <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden><path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {posts && posts.length > 0 && hasMore && (
          <div ref={sentinelRef} aria-hidden style={{ padding: "18px 0", display: "grid", placeItems: "center" }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", border: "2.5px solid var(--color-hairline)", borderTopColor: GOLD, animation: "feedspin .8s linear infinite" }} />
            <style>{`@keyframes feedspin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}
        {posts && posts.length > 0 && !hasMore && (
          <p style={{ margin: "18px 2px 0", textAlign: "center", fontFamily: "var(--font-text)", fontSize: 12, color: "var(--color-label-3)" }}>Вы долистали до начала канала.</p>
        )}
        {posts && posts.length === 0 && (
          <div style={{ padding: "30px 10px", textAlign: "center", fontFamily: "var(--font-text)", fontSize: 14.5, color: "var(--color-label-3)" }}>
            Пока нет постов. <a href="https://t.me/iskcone" target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-brand-blue)", textDecoration: "none", fontWeight: 600 }}>Открыть канал →</a>
          </div>
        )}
      </div>
    </div>
  );
}
