/**
 * DarshanScreen — «Даршан дня» (раздел «Садхана» · «Моя практика»).
 *
 * Утренний даршан Божеств из дхам: сегодняшние карточки (живьём из публичных
 * каналов ИСККОН Маяпур и Вриндаван — всегда свежие) и архив даршанов из D1
 * (наполняется ежедневным ингестом → каналом @iskcone). Изображения храмовых CDN
 * идут через worker-прокси /api/img (хотлинк-защита + ресайз/кэш).
 *
 * Эстетика приложения (iOS-26): токены темы, золото, только инлайн-SVG. Экран
 * публичный — вход не требуется (даршан открыт каждому).
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { darshanClient, type DarshanItem } from "./darshan/api";

/* ── токены ── */
const GOLD = "var(--color-gold)";
const GOLDT = "#9c7c15";
const L1 = "var(--color-label)";
const L2 = "var(--color-label-2)";
const L3 = "var(--color-label-3)";
const FILL = "var(--color-glass-thin)";
const FILL2 = "var(--color-glass-regular)";
const HAIR = "var(--color-hairline)";
const FT = "var(--font-text)";
const FD = "var(--font-display)";

/* Прокси картинки через worker /api/img: храмовые CDN отдают фото с хотлинк-защитой
   и не грузятся прямой <img src> из браузера — прокси тянет их серверно (спуфинг
   referer) и режет под ширину. Локальные пути (/api/darshan/igimg/…) — как есть. */
function px(u: string | undefined | null, w: number): string {
  if (!u) return "";
  if (u.startsWith("/") || u.startsWith("data:") || u.startsWith("blob:")) return u;
  return `/api/img?u=${encodeURIComponent(u)}&w=${w}`;
}

const RU_MON = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const RU_WD = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
function humanDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y) return "";
  const dt = new Date(y, (m || 1) - 1, d || 1);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - dt.getTime()) / 86400000);
  const base = `${d} ${RU_MON[(m || 1) - 1]}`;
  if (diff === 0) return `Сегодня · ${base}`;
  if (diff === 1) return `Вчера · ${base}`;
  return `${base} ${y !== today.getFullYear() ? y : ""}, ${RU_WD[dt.getDay()]}`.replace(/\s+,/, ",");
}

/* ── иконки ── */
const Back = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const TgIcon = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M21.5 4.3 2.9 11.4c-1 .4-1 1.8.1 2.1l4.6 1.4 1.8 5.6c.2.7 1.1.9 1.6.3l2.5-2.6 4.7 3.5c.6.4 1.5.1 1.7-.7L23 5.6c.2-1-.7-1.7-1.5-1.3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>);
const Lotus = () => (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 3c1.8 2.2 1.8 4.6 0 7-1.8-2.4-1.8-4.8 0-7Z" fill="currentColor" /><path d="M12 10c2.8-.6 5 .6 6.5 3.4-3 1-5.2.2-6.5-2M12 10c-2.8-.6-5 .6-6.5 3.4 3 1 5.2.2 6.5-2" fill="currentColor" opacity="0.6" /><path d="M5 13.5C5 17 8 19.5 12 19.5S19 17 19 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>);
const SiteIcon = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" /><path d="M3 12h18M12 3c2.4 2.5 2.4 15.5 0 18M12 3c-2.4 2.5-2.4 15.5 0 18" stroke="currentColor" strokeWidth="1.6" /></svg>);

/* ── ссылка-источник карточки: Telegram-пост или сайт храма ── */
function srcHref(item: DarshanItem): { href: string; tg: boolean } {
  const href = item.channelUrl || item.srcUrl;
  return { href, tg: /\/\/t\.me\//.test(href) };
}

/* ── галерея фото даршана (полное изображение, без обрезки) ── */
function Gallery({ images }: { images: string[] }) {
  const [idx, setIdx] = useState(0);
  const [ok, setOk] = useState<boolean[]>(() => images.map(() => true));
  const ref = useRef<HTMLDivElement | null>(null);
  const shown = images.filter((_, i) => ok[i]);
  const multi = shown.length > 1;

  const onScroll = useCallback(() => {
    const el = ref.current; if (!el) return;
    setIdx(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
  }, []);

  if (!shown.length) {
    return <div style={{ height: 200, display: "grid", placeItems: "center", background: FILL2, color: L3 }}><Lotus /></div>;
  }
  return (
    <div style={{ position: "relative", background: "color-mix(in srgb, var(--color-label) 6%, transparent)" }}>
      <div ref={ref} onScroll={multi ? onScroll : undefined}
        style={{ display: "flex", overflowX: multi ? "auto" : "hidden", scrollSnapType: "x mandatory", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
        {images.map((src, i) => ok[i] && (
          <div key={i} style={{ flex: "0 0 100%", scrollSnapAlign: "center", display: "flex", justifyContent: "center", alignItems: "center", minHeight: 220, maxHeight: "72vh" }}>
            <img src={px(src, 2560)} alt="Даршан" loading={i === 0 ? "eager" : "lazy"} onError={() => setOk((p) => p.map((v, j) => (j === i ? false : v)))}
              style={{ maxWidth: "100%", maxHeight: "72vh", width: "auto", height: "auto", display: "block", objectFit: "contain" }} />
          </div>
        ))}
      </div>
      {multi && (
        <div style={{ position: "absolute", bottom: 10, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 6 }}>
          {shown.map((_, i) => (
            <span key={i} style={{ width: i === idx ? 18 : 6, height: 6, borderRadius: 3, background: i === idx ? "#fff" : "rgba(255,255,255,0.55)", boxShadow: "0 1px 3px rgba(0,0,0,0.4)", transition: "width .2s" }} />
          ))}
        </div>
      )}
    </div>
  );
}

function Caption({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 150 || text.includes("\n");
  return (
    <div>
      <p style={{ margin: 0, fontFamily: FT, fontSize: 13.5, lineHeight: 1.55, color: L2, whiteSpace: "pre-line",
        ...(open ? {} : { display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }) }}>{text}</p>
      {long && (
        <button type="button" onClick={() => setOpen((v) => !v)}
          style={{ marginTop: 6, padding: 0, border: "none", background: "none", color: GOLDT, fontFamily: FT, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
          {open ? "Свернуть" : "Читать полностью"}
        </button>
      )}
    </div>
  );
}

function DarshanCard({ item }: { item: DarshanItem }) {
  const link = srcHref(item);
  return (
    <article style={{ borderRadius: 20, overflow: "hidden", background: FILL, border: `0.5px solid ${HAIR}` }}>
      <Gallery images={item.images} />
      <div style={{ padding: 16 }}>
        <div style={{ fontFamily: FT, fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLDT }}>{item.templeName}</div>
        {item.deities && <div style={{ marginTop: 5, fontFamily: FD, fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2, color: L1 }}>{item.deities}</div>}
        <div style={{ marginTop: 4, fontFamily: FT, fontSize: 12.5, color: L3 }}>{humanDate(item.date)}</div>
        {item.caption && <div style={{ marginTop: 12 }}><Caption text={item.caption} /></div>}
        <a href={link.href} target="_blank" rel="noopener noreferrer"
          style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 999, background: FILL2, color: L1, fontFamily: FT, fontSize: 12.5, fontWeight: 600, textDecoration: "none" }}>
          {link.tg ? <TgIcon /> : <SiteIcon />} {link.tg ? "Открыть в Telegram" : "Открыть на сайте храма"}
        </a>
      </div>
    </article>
  );
}

/* ── лайтбокс для архивной карточки ── */
function Lightbox({ item, onClose }: { item: DarshanItem; onClose: () => void }) {
  const link = srcHref(item);
  return (
    <div role="dialog" aria-modal="true" onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.92)", overflowY: "auto", animation: "darFade .2s ease" }}>
      <button type="button" aria-label="Закрыть" onClick={onClose}
        style={{ position: "fixed", top: "max(14px, env(safe-area-inset-top,0px))", right: 14, zIndex: 2, width: 40, height: 40, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.14)", color: "#fff", cursor: "pointer", display: "grid", placeItems: "center", backdropFilter: "blur(8px)" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      </button>
      <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, margin: "0 auto", padding: "64px 16px calc(40px + env(safe-area-inset-bottom,0px))" }}>
        {item.images.map((src, i) => (
          <img key={i} src={px(src, 2560)} alt="Даршан" loading="lazy" style={{ width: "100%", height: "auto", display: "block", borderRadius: 14, marginBottom: 10 }} />
        ))}
        <div style={{ marginTop: 8, color: "#fff" }}>
          <div style={{ fontFamily: FT, fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: "rgba(255,255,255,0.6)" }}>{item.templeName}</div>
          {item.deities && <div style={{ marginTop: 5, fontFamily: FD, fontSize: 19, fontWeight: 800, letterSpacing: "-0.02em", color: "#fff" }}>{item.deities}</div>}
          <div style={{ marginTop: 4, fontFamily: FT, fontSize: 12.5, color: "rgba(255,255,255,0.55)" }}>{humanDate(item.date)}</div>
          {item.caption && <p style={{ marginTop: 12, fontFamily: FT, fontSize: 13.5, lineHeight: 1.55, color: "rgba(255,255,255,0.82)", whiteSpace: "pre-line" }}>{item.caption}</p>}
          <a href={link.href} target="_blank" rel="noopener noreferrer"
            style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 999, background: "rgba(255,255,255,0.14)", color: "#fff", fontFamily: FT, fontSize: 12.5, fontWeight: 600, textDecoration: "none" }}>
            {link.tg ? <TgIcon /> : <SiteIcon />} {link.tg ? "Открыть в Telegram" : "Открыть на сайте храма"}
          </a>
        </div>
      </div>
    </div>
  );
}

function ArchiveThumb({ item, onOpen }: { item: DarshanItem; onOpen: () => void }) {
  const [ok, setOk] = useState(true);
  return (
    <button type="button" onClick={onOpen} aria-label={`Даршан · ${humanDate(item.date)}`}
      style={{ position: "relative", aspectRatio: "1 / 1", borderRadius: 14, overflow: "hidden", border: "none", padding: 0, cursor: "pointer", background: FILL2, WebkitTapHighlightColor: "transparent" }}>
      {ok && item.images[0]
        ? <img src={px(item.images[0], 400)} alt="" loading="lazy" onError={() => setOk(false)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        : <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: L3 }}><Lotus /></span>}
      <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "16px 8px 6px", background: "linear-gradient(transparent, rgba(0,0,0,0.6))", color: "#fff", fontFamily: FT, fontSize: 10.5, fontWeight: 600, textAlign: "left" }}>
        {item.date.slice(8, 10)}.{item.date.slice(5, 7)} · {item.templeSlug === "mayapur" ? "Маяпур" : item.templeSlug === "vrindavan" ? "Вриндаван" : item.templeSlug}
      </span>
    </button>
  );
}

export default function DarshanScreen({ onBack }: { onBack: () => void }) {
  const [today, setToday] = useState<DarshanItem[] | null>(null);
  const [archive, setArchive] = useState<DarshanItem[]>([]);
  const [oldest, setOldest] = useState<number | null>(null);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<DarshanItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setFailed(false);
    try {
      const [t, page] = await Promise.all([
        darshanClient.get(),
        darshanClient.archive().catch(() => ({ items: [] as DarshanItem[], oldest: null, hasMore: false })),
      ]);
      setToday(t.today);
      const seen = new Set(t.today.map((x) => x.srcUrl));
      setArchive(page.items.filter((i) => !seen.has(i.srcUrl)));
      setOldest(page.hasMore ? page.oldest : null);
    } catch { setFailed(true); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const loadMore = useCallback(async () => {
    if (oldest === null) return;
    setMore(true);
    try {
      const page = await darshanClient.archive(oldest);
      const seen = new Set([...archive.map((a) => a.srcUrl), ...(today ?? []).map((t) => t.srcUrl)]);
      setArchive((prev) => [...prev, ...page.items.filter((i) => !seen.has(i.srcUrl))]);
      setOldest(page.hasMore ? page.oldest : null);
    } catch { /* noop */ } finally { setMore(false); }
  }, [oldest, archive, today]);

  const nav: CSSProperties = {
    position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "center", gap: 4, height: 52, padding: "0 6px",
    background: "color-mix(in srgb, var(--color-bg) 82%, transparent)", backdropFilter: "saturate(180%) blur(20px)", WebkitBackdropFilter: "saturate(180%) blur(20px)", borderBottom: `0.5px solid ${HAIR}`,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "var(--color-bg)", fontFamily: FT }}>
      <header style={nav}>
        <button type="button" aria-label="Назад" onClick={onBack} style={{ display: "grid", height: 38, width: 38, placeItems: "center", borderRadius: "50%", border: "none", background: "none", color: L1, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}><Back /></button>
        <div style={{ flex: 1, textAlign: "center", fontFamily: FD, fontSize: "var(--text-body)", fontWeight: 700, letterSpacing: "-0.02em", color: L1 }}>Даршан дня</div>
        <span style={{ width: 38 }} />
      </header>

      <div style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        <div style={{ maxWidth: 540, margin: "0 auto", padding: "16px 16px calc(40px + env(safe-area-inset-bottom,0px))", display: "flex", flexDirection: "column", gap: 16 }}>

          {loading && <div style={{ padding: "60px 0", textAlign: "center", color: L3, fontFamily: FT, fontSize: 14 }}>Загрузка…</div>}

          {!loading && failed && (
            <div style={{ borderRadius: 18, background: FILL, padding: "34px 22px", textAlign: "center" }}>
              <p style={{ margin: "0 0 16px", fontFamily: FT, fontSize: 14, color: L2 }}>Не удалось загрузить даршан.</p>
              <button type="button" onClick={() => void load()} style={{ minWidth: 120, height: 40, padding: "0 16px", borderRadius: 11, border: "none", background: FILL2, color: L1, fontFamily: FT, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Повторить</button>
            </div>
          )}

          {!loading && !failed && today && (
            <>
              {today.length > 0 ? (
                today.map((it) => <DarshanCard key={it.srcUrl} item={it} />)
              ) : (
                <div style={{ borderRadius: 18, background: FILL, padding: "34px 22px", textAlign: "center" }}>
                  <div style={{ width: 54, height: 54, margin: "0 auto 14px", borderRadius: 16, display: "grid", placeItems: "center", background: `color-mix(in srgb, ${GOLD} 14%, transparent)`, color: GOLD }}><Lotus /></div>
                  <div style={{ fontFamily: FD, fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", color: L1 }}>Даршан скоро появится</div>
                  <p style={{ margin: "8px auto 18px", maxWidth: 320, fontFamily: FT, fontSize: 13.5, lineHeight: 1.55, color: L2 }}>
                    Сегодняшний даршан Божеств из дхам публикуется утром. Загляните чуть позже.
                  </p>
                  <a href="https://t.me/iskcone" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 999, background: GOLD, color: "#fff", fontFamily: FT, fontSize: 13.5, fontWeight: 700, textDecoration: "none" }}><TgIcon /> Канал @iskcone</a>
                </div>
              )}

              {archive.length > 0 && (
                <>
                  <div style={{ fontFamily: FT, fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: L3, margin: "8px 2px 0" }}>Архив даршанов</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                    {archive.map((it) => <ArchiveThumb key={it.srcUrl} item={it} onOpen={() => setView(it)} />)}
                  </div>
                  {oldest !== null && (
                    <button type="button" onClick={() => void loadMore()} disabled={more}
                      style={{ alignSelf: "center", marginTop: 4, minWidth: 160, height: 42, borderRadius: 12, border: `0.5px solid ${HAIR}`, background: FILL, color: L1, fontFamily: FT, fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: more ? 0.6 : 1 }}>
                      {more ? "Загрузка…" : "Показать ещё"}
                    </button>
                  )}
                </>
              )}

              <div style={{ margin: "8px 2px 0", textAlign: "center" }}>
                <p style={{ margin: 0, fontFamily: FT, fontSize: "var(--text-caption2)", lineHeight: 1.5, color: L3 }}>
                  Даршаны — из официальных каналов ИСККОН Маяпур и Вриндаван.
                </p>
                <p style={{ margin: "6px 0 0", fontFamily: FT, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", color: GOLDT }}>
                  ISKCON ONE LOVE
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {view && <Lightbox item={view} onClose={() => setView(null)} />}
      <style>{`@keyframes darFade{from{opacity:0}to{opacity:1}}`}</style>
    </div>
  );
}
