/**
 * DarshanStories — даршан дня в формате «историй» (Instagram-паттерн, наш стиль).
 *
 *  · DarshanRings — горизонтальный трей колец вверху лендинга «ИСККОН». Одно
 *    кольцо = сегодняшний даршан одного храма (живьём из публичных каналов
 *    Маяпур/Вриндаван через /api/darshan). Просмотренные кольца гаснут (память
 *    в localStorage по дате+храму), как в IG. Завершает трей кольцо «Архив» →
 *    открывает экран «Даршан дня» (сетка архива) сигналом iol:open-darshan.
 *  · DarshanStoryViewer — полноэкранный просмотр: прогресс-бары по кадрам,
 *    авто-перелистывание (кадр = STORY_MS), тап слева/справа — назад/вперёд,
 *    удержание — пауза (хром гаснет), свайп вниз — закрыть, стрелки/Esc с
 *    клавиатуры. Фото Божеств показываем целиком (object-fit: contain — не
 *    обрезаем мурти), хром поверх лёгких градиентных скримов.
 *
 * Эстетика iOS-26: токены темы, золото, только инлайн-SVG. Модуль публичный —
 * вход не требуется (даршан открыт каждому). Изображения храмовых CDN идут через
 * worker-прокси /api/img (хотлинк-защита + ресайз/кэш), как в Ленте.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { darshanClient, type DarshanItem } from "./darshan/api";
import { useFavorite } from "./cardActions";
import { replaceUrl } from "./nav";

/* ── токены ── */
const GOLD = "var(--color-gold)";
const FT = "var(--font-text)";
const FD = "var(--font-display)";
const L1 = "var(--color-label)";
const L2 = "var(--color-label-2)";
const L3 = "var(--color-label-3)";
const HAIR = "var(--color-hairline)";
const FILL2 = "var(--color-glass-regular)";

const STORY_MS = 6000;            // длительность одного кадра
// Настройки сторис между сессиями (как в TG: звук по умолчанию ВЫКЛ, скорость 1×).
function storySoundOn(): boolean { try { return localStorage.getItem("iol_story_sound") === "1"; } catch { return false; } }
function setStorySound(on: boolean) { try { localStorage.setItem("iol_story_sound", on ? "1" : "0"); } catch { /* приватный режим */ } }
function storyRate(): number { let n = 1; try { n = Number(localStorage.getItem("iol_story_rate")); } catch { /* noop */ } return n === 1.5 || n === 2 ? n : 1; }
function setStoryRate(r: number) { try { localStorage.setItem("iol_story_rate", String(r)); } catch { /* noop */ } }
const RING_GRAD = "conic-gradient(from 135deg, #F4C430, #FF7A00, #E0451F, #D2AA1B, #F4C430)";

/* Прокси картинки через worker /api/img: храмовые CDN (cdn.iskconvrindavan.com,
   mayapur.com, …) отдают фото с хотлинк-защитой и не грузятся прямой <img src>
   из браузера — серверный прокси тянет их со спуфингом referer, режет под нужную
   ширину (CF Image Resizing) и кэширует на свой домен. Уже-локальные пути
   (/api/darshan/igimg/…) и пустые значения отдаём как есть. */
function px(u: string | undefined | null, w: number): string {
  if (!u) return "";
  if (u.startsWith("/") || u.startsWith("data:") || u.startsWith("blob:")) return u;
  return `/api/img?u=${encodeURIComponent(u)}&w=${w}`;
}

/* ── короткое имя храма для подписи кольца ── */
function shortTemple(slug: string, name: string): string {
  if (slug === "iskcone") return "ISKCON";
  if (slug === "mayapur") return "Маяпур";
  if (slug === "vrindavan") return "Вриндаван";
  return (name.split("·")[0] || name).replace(/^ИСККОН\s+/, "").trim() || slug;
}

/* ── человекочитаемая дата кадра ── */
const RU_MON = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
function humanDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y) return "";
  const dt = new Date(y, (m || 1) - 1, d || 1);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - dt.getTime()) / 86400000);
  const base = `${d} ${RU_MON[(m || 1) - 1]}`;
  if (diff === 0) return `Сегодня · ${base}`;
  if (diff === 1) return `Вчера · ${base}`;
  return base;
}

/* ── время поста (ЧЧ:ММ, локальное) ── */
function humanTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(d);
}

/* ── «просмотрено» — память по дате+храму (как у IG гаснут кольца) ── */
const seenId = (it: DarshanItem) => `${it.date}:${it.templeSlug}`;
function readSeen(it: DarshanItem): boolean {
  try { return localStorage.getItem(`darshan-seen:${seenId(it)}`) === "1"; } catch { return false; }
}
function writeSeen(it: DarshanItem): void {
  try { localStorage.setItem(`darshan-seen:${seenId(it)}`, "1"); } catch { /* noop */ }
}

/* ── сессионный кеш «сегодня», чтобы переключение вкладок не дёргало сеть ── */
let CACHE: { at: number; items: DarshanItem[] } | null = null;

/* ── иконки ── */
const Lotus = ({ s = 22 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M12 3c1.8 2.2 1.8 4.6 0 7-1.8-2.4-1.8-4.8 0-7Z" fill="currentColor" />
    <path d="M12 10c2.8-.6 5 .6 6.5 3.4-3 1-5.2.2-6.5-2M12 10c-2.8-.6-5 .6-6.5 3.4 3 1 5.2.2 6.5-2" fill="currentColor" opacity="0.6" />
    <path d="M5 13.5C5 17 8 19.5 12 19.5S19 17 19 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const ArchiveGlyph = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
    <path d="M12 7.5V12l3 1.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const CloseGlyph = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
);

/* ── общий стиль трея (bleed к краям контейнера Home, паддинг 16) ── */
const tray: CSSProperties = {
  display: "flex", gap: 14, overflowX: "auto", WebkitOverflowScrolling: "touch",
  scrollbarWidth: "none", margin: "6px -16px 0", padding: "4px 16px 6px",
};
const ringLabel = (on: boolean): CSSProperties => ({
  fontFamily: FT, fontSize: "var(--text-caption)", fontWeight: on ? 600 : 500, color: on ? L1 : L2,
  maxWidth: 74, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "-0.01em",
});
const ringBtn: CSSProperties = {
  flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 7,
  width: 76, border: "none", background: "none", padding: 0, cursor: "pointer", WebkitTapHighlightColor: "transparent",
};

/* ── одно кольцо храма ── */
function Ring({ item, seen, onClick }: { item: DarshanItem; seen: boolean; onClick: () => void }) {
  const [ok, setOk] = useState(true);
  const cover = px(item.images[0], 220);
  return (
    <button type="button" onClick={onClick} role="listitem" style={ringBtn}
      aria-label={`Даршан · ${shortTemple(item.templeSlug, item.templeName)}`}>
      <span style={{ width: 68, height: 68, borderRadius: "50%", padding: seen ? 1.5 : 2.5, background: seen ? HAIR : RING_GRAD, boxSizing: "border-box" }}>
        <span style={{ display: "block", width: "100%", height: "100%", borderRadius: "50%", padding: 2.5, background: "var(--color-bg)", boxSizing: "border-box" }}>
          {ok && cover
            ? <img src={cover} alt="" loading="lazy" onError={() => setOk(false)} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%", display: "block" }} />
            : <span style={{ display: "grid", placeItems: "center", width: "100%", height: "100%", borderRadius: "50%", background: FILL2, color: L3 }}><Lotus /></span>}
        </span>
      </span>
      <span style={ringLabel(!seen)}>{shortTemple(item.templeSlug, item.templeName)}</span>
    </button>
  );
}

/* ── завершающее кольцо «Архив» ── */
function ArchiveRing({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} role="listitem" style={ringBtn} aria-label="Архив даршанов">
      <span style={{ width: 68, height: 68, borderRadius: "50%", border: `1.5px dashed ${HAIR}`, display: "grid", placeItems: "center", color: L2, boxSizing: "border-box" }}>
        <ArchiveGlyph />
      </span>
      <span style={ringLabel(false)}>Архив</span>
    </button>
  );
}

/* ── скелетон загрузки ── */
function RingsSkeleton() {
  return (
    <div style={tray} aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 7, width: 76 }}>
          <div style={{ width: 68, height: 68, borderRadius: "50%", background: FILL2, animation: "darPulse 1.4s ease-in-out infinite" }} />
          <div style={{ width: 50, height: 9, borderRadius: 5, background: FILL2, animation: "darPulse 1.4s ease-in-out infinite" }} />
        </div>
      ))}
    </div>
  );
}

/* ── трей колец (экспорт; ставится вверху лендинга) ── */
export function DarshanRings() {
  const fresh = CACHE && Date.now() - CACHE.at < 600_000 ? CACHE.items : null;
  const [items, setItems] = useState<DarshanItem[] | null>(fresh);
  const [view, setView] = useState<{ list: DarshanItem[]; start: number } | null>(null);
  const [seen, setSeen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (items) return;
    let alive = true;
    darshanClient.get()
      .then((r) => { if (!alive) return; const list = r.today.filter((x) => x.images.length); CACHE = { at: Date.now(), items: list }; setItems(list); })
      .catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, [items]);

  // инициализируем «просмотрено» из localStorage при появлении данных
  useEffect(() => {
    if (!items) return;
    const init: Record<string, boolean> = {};
    for (const it of items) if (readSeen(it)) init[seenId(it)] = true;
    setSeen((s) => ({ ...init, ...s }));
  }, [items]);

  // Порядок колец: непросмотренные впереди (просмотренные — в конец), @iskcone первым
  // по умолчанию, далее по времени размещения (свежие выше).
  const ordered = useMemo(() => {
    if (!items) return [];
    const key = (x: DarshanItem) => x.postedAt || `${x.date}T00:00:00`;
    return [...items].sort((a, b) => {
      const sa = !!seen[seenId(a)], sb = !!seen[seenId(b)];
      if (sa !== sb) return sa ? 1 : -1;
      const ia = a.templeSlug === "iskcone", ib = b.templeSlug === "iskcone";
      if (ia !== ib) return ia ? -1 : 1;
      return key(b).localeCompare(key(a));
    });
  }, [items, seen]);

  /* ЗКН-Н078: deep-link из избранного — открыть КОНКРЕТНУЮ сторис даршана.
   * Избранное ведёт на `/darshan?d=<postId|srcUrl>`. Даршаны эфемерны (лента дня):
   * если сторис ещё в сегодняшней ленте — открываем её вьюером, иначе просто остаёмся
   * на ленте. Параметр гасим, чтобы не срабатывало повторно. */
  const deepDone = useRef(false);
  useEffect(() => {
    if (deepDone.current || !items || items.length === 0 || typeof window === "undefined") return;
    const d = new URLSearchParams(window.location.search).get("d");
    if (!d) { deepDone.current = true; return; }
    deepDone.current = true;
    const want = decodeURIComponent(d);
    const idx = ordered.findIndex((it) => (it.postId || it.srcUrl) === want);
    if (idx >= 0) setView({ list: ordered, start: idx });
    replaceUrl("/darshan");
  }, [items, ordered]);

  if (items === null) return <><RingsSkeleton /><Keyframes /></>;
  if (items.length === 0) return null;

  const openArchive = () => window.dispatchEvent(new CustomEvent("iol:open-darshan"));

  return (
    <>
      <div style={tray} role="list" aria-label="Истории">
        {ordered.map((it, i) => (
          <Ring key={it.srcUrl} item={it} seen={!!seen[seenId(it)]} onClick={() => setView({ list: ordered, start: i })} />
        ))}
        <ArchiveRing onClick={openArchive} />
      </div>
      {view && (
        <DarshanStoryViewer
          items={view.list}
          start={view.start}
          onSeen={(it) => { writeSeen(it); setSeen((s) => ({ ...s, [seenId(it)]: true })); }}
          onClose={() => setView(null)}
        />
      )}
      <Keyframes />
    </>
  );
}

/* ── полноэкранный просмотр историй ── */
function DarshanStoryViewer({ items, start, onSeen, onClose }: {
  items: DarshanItem[];
  start: number;
  onSeen: (it: DarshanItem) => void;
  onClose: () => void;
}) {
  const [ti, setTi] = useState(start);   // индекс храма
  const [ii, setII] = useState(0);       // индекс кадра внутри храма
  const [paused, setPaused] = useState(false);
  const [capOpen, setCapOpen] = useState(false);
  const [ready, setReady] = useState(false);   // текущий кадр загрузился? пока нет — прогресс не идёт
  const [stalled, setStalled] = useState(false); // видео буферизуется → прогресс на паузе, не перелистываем
  const [muted, setMuted] = useState(() => !storySoundOn()); // звук видео (по умолчанию выкл, как в TG)
  const [rate, setRate] = useState(() => storyRate());        // скорость видео 1× / 1.5× / 2×
  const [toast, setToast] = useState<string | null>(null);    // мини-уведомление (избранное / ссылка)

  const item = items[ti];
  const imgs = item.images;
  const total = imgs.length;
  // покадровые данные: для канала @iskcone подпись/время/дату берём с текущего кадра-поста,
  // для храмов — общие по элементу.
  const fr = item.frames ? item.frames[ii] : null;
  const curCap = fr ? fr.caption : item.caption;
  const curAt = fr ? fr.postedAt : (item.postedAt ?? null);
  const curYmd = fr && fr.postedAt
    ? new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(fr.postedAt))
    : item.date;

  const barRef = useRef<HTMLSpanElement | null>(null);
  const accRef = useRef(0);
  const durRef = useRef(STORY_MS);          // длительность активного кадра (видео → его длина)
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const goNextRef = useRef<() => void>(() => {});
  const baseDurRef = useRef(STORY_MS);                 // длина видео без учёта скорости
  const rateRef = useRef(rate); rateRef.current = rate;
  const toastT = useRef(0);
  // Избранное текущей истории (♥, localStorage `fav:*`). Ключ — стабильный id поста.
  // ЗКН-Н078: избранное ведёт ВНУТРЕННИМ адресом к самому даршану (/darshan?d=<id>),
  // а не на внешний канал — иначе тап по избранному ломает навигацию приложения.
  const fav = useFavorite(`darshan:${item.postId || item.srcUrl}`, { t: item.deities || item.templeName, s: "Ежедневный даршан", h: `/darshan?d=${encodeURIComponent(item.postId || item.srcUrl)}` });
  const flash = useCallback((m: string) => { setToast(m); window.clearTimeout(toastT.current); toastT.current = window.setTimeout(() => setToast(null), 1600); }, []);

  // Даршан-кадры показываем ЦЕЛИКОМ (object-fit: contain) — мурти никогда не режем.
  // Раньше для ландшафта включался cover, а ориентацию мерили по naturalWidth/Height.
  // Но источники (напр. Чоупати) отдают EXIF-повёрнутые фото: пре-EXIF размеры
  // классифицировали реальный портрет как ландшафт → cover срезал верх/низ (видны были
  // только стопы/середина мурти). Поэтому замер убран — поля при любой ориентации
  // закрывает размытая подложка из того же кадра.

  /* блокируем скролл body на время просмотра */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("gtab-off");
    return () => { document.body.style.overflow = prev; document.body.classList.remove("gtab-off"); };
  }, []);

  const goNext = useCallback(() => {
    setCapOpen(false);
    if (ii < total - 1) { setII(ii + 1); return; }
    onSeen(item);                                   // храм досмотрен
    if (ti < items.length - 1) { setTi(ti + 1); setII(0); return; }
    onClose();                                      // конец всех историй
  }, [ii, total, ti, items, item, onSeen, onClose]);

  const goPrev = useCallback(() => {
    setCapOpen(false);
    if (ii > 0) { setII(ii - 1); return; }
    if (ti > 0) { const pt = items[ti - 1]; setTi(ti - 1); setII(Math.max(0, pt.images.length - 1)); return; }
    accRef.current = 0; if (barRef.current) barRef.current.style.width = "0%";  // рестарт первого кадра
  }, [ii, ti, items]);

  useEffect(() => { goNextRef.current = goNext; }, [goNext]);

  /* сброс прогресса при смене кадра/храма */
  useEffect(() => { accRef.current = 0; durRef.current = STORY_MS; baseDurRef.current = STORY_MS; setReady(false); setStalled(false); if (barRef.current) barRef.current.style.width = "0%"; }, [ti, ii]);

  /* таймер кадра — двигаем ширину активного бара напрямую (без ререндера 60 fps).
     Прогресс НЕ стартует, пока фото не загрузилось — иначе кадр перелистывался
     раньше, чем пользователь успевал его увидеть. */
  useEffect(() => {
    if (paused || !ready || stalled) return;
    let raf = 0; let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last; last = now;
      accRef.current += dt;
      const frac = Math.min(1, accRef.current / durRef.current);
      if (barRef.current) barRef.current.style.width = (frac * 100).toFixed(2) + "%";
      if (frac >= 1) { goNextRef.current(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ti, ii, paused, ready, stalled]);

  /* видео-кадр: проигрывание синхронно с паузой истории (тап-удержание ставит на паузу) */
  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    v.muted = muted;            // применяем выбор звука (вкл/выкл) к текущему видео
    v.playbackRate = rate;      // и скорость
    if (paused) v.pause(); else void v.play().catch(() => {});
  }, [paused, ti, ii, ready, muted, rate]);

  /* прогресс-бар видео тикает по стенным часам → при ускорении делим длительность
     на скорость, чтобы полоса заполнялась ровно к концу ускоренного ролика. */
  useEffect(() => { durRef.current = baseDurRef.current / rate; }, [rate]);

  /* клавиатура */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, onClose]);

  /* жесты: тап = навигация по зонам, удержание = пауза, свайп вниз = закрыть */
  const press = useRef<{ x: number; y: number; hold: boolean } | null>(null);
  const holdTimer = useRef(0);
  const onDown = (e: React.PointerEvent) => {
    press.current = { x: e.clientX, y: e.clientY, hold: false };
    window.clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(() => { if (press.current) press.current.hold = true; setPaused(true); }, 220);
  };
  const onUp = (e: React.PointerEvent) => {
    window.clearTimeout(holdTimer.current);
    const pr = press.current; press.current = null;
    if (!pr) return;
    if (pr.hold) { setPaused(false); return; }
    const dx = e.clientX - pr.x, dy = e.clientY - pr.y;
    if (dy > 90 && Math.abs(dx) < 70) { onClose(); return; }
    if (e.clientX < window.innerWidth * 0.32) goPrev(); else goNext();
  };
  const onCancel = () => { window.clearTimeout(holdTimer.current); if (press.current?.hold) setPaused(false); press.current = null; };
  const stop = (e: React.PointerEvent | React.MouseEvent) => e.stopPropagation();
  const SBTN: CSSProperties = { flexShrink: 0, width: 44, height: 44, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.16)", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", WebkitTapHighlightColor: "transparent" };
  const toggleSound = () => setMuted((m) => { const next = !m; setStorySound(!next); const v = videoRef.current; if (v) { v.muted = next; if (!next) void v.play().catch(() => {}); } return next; });
  const cycleRate = () => setRate((r) => { const next = r === 1 ? 1.5 : r === 1.5 ? 2 : 1; setStoryRate(next); const v = videoRef.current; if (v) v.playbackRate = next; durRef.current = baseDurRef.current / next; return next; });
  const onShare = async () => {
    const url = item.channelUrl || item.srcUrl || "";
    const title = item.deities || item.templeName || "Даршан";
    try { if (navigator.share) { await navigator.share({ title, url }); } else { await navigator.clipboard.writeText(url); flash("Ссылка скопирована"); } } catch { /* отменено пользователем */ }
  };

  const longCap = !!curCap && (curCap.length > 140 || curCap.includes("\n"));
  const nextSrc = ii < total - 1 ? imgs[ii + 1] : (ti < items.length - 1 ? items[ti + 1].images[0] : null);

  const chrome = (extra: CSSProperties = {}): CSSProperties => ({ opacity: paused ? 0 : 1, transition: "opacity .2s ease", ...extra });

  return (
    <div role="dialog" aria-modal="true" aria-label={`Даршан · ${item.templeName}`}
      onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={onCancel}
      style={{ position: "fixed", inset: 0, zIndex: 95, background: "#000", overflow: "hidden", touchAction: "none", userSelect: "none", WebkitUserSelect: "none", animation: "storyIn .22s ease" }}>

      {/* размытая подложка из того же кадра — заполняет поля по краям, без чёрных полос */}
      <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 0, backgroundImage: `url("${px(imgs[ii], 96)}")`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(34px) brightness(0.5)", transform: "scale(1.18)" }} />
      {/* Бокс img = строго экран (position:absolute; inset:0 → определённая высота, без грид-багов
          с процентами). Фит — object-fit: contain при любой ориентации: кадр целиком, поля
          закрывает размытая подложка. Мурти не обрезаем. */}
      <div className="dstory-stage" style={{ position: "absolute", inset: 0, zIndex: 1, overflow: "hidden" }}>
        {fr?.video ? (
          <video key={`${ti}:${ii}`} ref={videoRef} src={fr.video} poster={px(imgs[ii], 2560)}
            autoPlay muted loop playsInline preload="auto"
            onLoadedMetadata={(e) => { const d = e.currentTarget.duration; if (Number.isFinite(d) && d > 0) { baseDurRef.current = Math.min(Math.max(d * 1000, 2500), 60000); durRef.current = baseDurRef.current / rateRef.current; } }}
            onLoadedData={() => setReady(true)} onCanPlay={() => { setReady(true); setStalled(false); }}
            onPlaying={() => { setReady(true); setStalled(false); }} onWaiting={() => setStalled(true)} onStalled={() => setStalled(true)}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", objectPosition: "center", opacity: ready ? 1 : 0, transition: "opacity .25s ease" }} />
        ) : (
          <img key={`${ti}:${ii}`} src={px(imgs[ii], 2560)} alt="Даршан"
            ref={(el) => { if (el && el.complete && el.naturalWidth > 0) setReady(true); }}
            onLoad={() => setReady(true)}
            style={{
              position: "absolute", inset: 0, width: "100%", height: "100%",
              imageOrientation: "from-image",
              objectFit: "contain",   // целиком, без обрезки мурти (поля закрывает блюр-подложка)
              objectPosition: "center",
              opacity: ready ? 1 : 0, transition: "opacity .25s ease",
            }} />
        )}
        {(!ready || stalled) && (
          <span aria-hidden style={{ position: "absolute", top: "50%", left: "50%", width: 34, height: 34, marginTop: -17, marginLeft: -17, borderRadius: "50%", border: "2.5px solid rgba(255,255,255,0.28)", borderTopColor: "#fff", animation: "darSpin .8s linear infinite", zIndex: 2 }} />
        )}
      </div>
      {nextSrc && <img src={px(nextSrc, 2560)} alt="" aria-hidden style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }} />}

      {/* скримы для читабельности хрома */}
      <div aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, height: 150, background: "linear-gradient(rgba(0,0,0,0.55), transparent)", zIndex: 2, pointerEvents: "none", ...chrome() }} />

      {/* прогресс-бары */}
      <div style={chrome({ position: "absolute", top: "max(10px, env(safe-area-inset-top,0px))", left: 10, right: 10, display: "flex", gap: 4, zIndex: 4 })}>
        {imgs.map((_, i) => (
          <span key={i} style={{ flex: 1, height: 2.5, borderRadius: 2, background: "rgba(255,255,255,0.32)", overflow: "hidden" }}>
            <span ref={i === ii ? barRef : null} style={{ display: "block", height: "100%", borderRadius: 2, background: "#fff", width: i < ii ? "100%" : "0%" }} />
          </span>
        ))}
      </div>

      {/* шапка: храм + дата + закрыть */}
      <div style={chrome({ position: "absolute", top: "calc(max(10px, env(safe-area-inset-top,0px)) + 16px)", left: 12, right: 12, display: "flex", alignItems: "center", gap: 10, zIndex: 4 })}>
        <span style={{ width: 34, height: 34, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "rgba(255,255,255,0.14)", display: "grid", placeItems: "center" }}>
          {imgs[0] ? <img src={px(imgs[0], 96)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#fff" }}><Lotus s={18} /></span>}
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: FT, fontSize: "var(--text-footnote)", fontWeight: 700, color: "#fff", letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {shortTemple(item.templeSlug, item.templeName)}
          </div>
          <div style={{ fontFamily: FT, fontSize: "var(--text-caption2)", color: "rgba(255,255,255,0.7)" }}>{humanDate(curYmd)}{curAt ? ` · ${humanTime(curAt)}` : ""}</div>
        </div>
        <button type="button" aria-label="Закрыть" onClick={onClose} onPointerDown={stop} onPointerUp={stop}
          style={{ flexShrink: 0, width: 38, height: 38, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.14)", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer", backdropFilter: "blur(8px)", WebkitTapHighlightColor: "transparent" }}>
          <CloseGlyph />
        </button>
      </div>

      {/* правый рейл действий — как в TG/reels: избранное · звук · скорость · поделиться.
          Обёртка гасит жесты истории (пауза/листание), чтобы тапы по кнопкам не листали кадр. */}
      <div onPointerDown={stop} onPointerUp={stop} onPointerCancel={stop} onClick={stop}
        style={chrome({ position: "absolute", right: 10, bottom: "calc(150px + env(safe-area-inset-bottom,0px))", zIndex: 5, display: "flex", flexDirection: "column", gap: 12, alignItems: "center" })}>
        <button type="button" aria-label={fav.on ? "Убрать из избранного" : "В избранное"} aria-pressed={fav.on} onClick={() => fav.toggle(flash)} style={SBTN}>
          <svg width="23" height="23" viewBox="0 0 24 24" fill={fav.on ? "#FF453A" : "none"} stroke={fav.on ? "#FF453A" : "#fff"} strokeWidth="2" strokeLinejoin="round" aria-hidden><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
        </button>
        {fr?.video && (
          <button type="button" aria-label={muted ? "Включить звук" : "Выключить звук"} aria-pressed={!muted} onClick={toggleSound} style={SBTN}>
            {muted ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 9v6h4l5 4V5L8 9H4z" fill="#fff" stroke="none" /><path d="M17 9l5 6M22 9l-5 6" /></svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 9v6h4l5 4V5L8 9H4z" fill="#fff" stroke="none" /><path d="M16.5 8.5a5 5 0 010 7" /><path d="M19 6a9 9 0 010 12" /></svg>
            )}
          </button>
        )}
        {fr?.video && (
          <button type="button" aria-label={`Скорость ${rate}×`} onClick={cycleRate} style={{ ...SBTN, fontFamily: FT, fontWeight: 800, fontSize: rate === 1.5 ? 11 : 13, letterSpacing: "-0.02em" }}>
            {rate === 1 ? "1×" : rate === 1.5 ? "1.5×" : "2×"}
          </button>
        )}
        <button type="button" aria-label="Поделиться" onClick={onShare} style={SBTN}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3v13" /><path d="M8 7l4-4 4 4" /><path d="M5 12v7a1 1 0 001 1h12a1 1 0 001-1v-7" /></svg>
        </button>
      </div>

      {/* тост действий */}
      {toast && (
        <div style={{ position: "absolute", left: "50%", bottom: "calc(116px + env(safe-area-inset-bottom,0px))", transform: "translateX(-50%)", zIndex: 6, background: "rgba(0,0,0,0.8)", color: "#fff", fontFamily: FT, fontSize: "var(--text-footnote)", fontWeight: 600, padding: "9px 16px", borderRadius: 999, backdropFilter: "blur(8px)", pointerEvents: "none", whiteSpace: "nowrap" }}>{toast}</div>
      )}

      {/* низ: имя Божеств + подпись (для ежедневных даршанов — единый 3-строчный стандарт) */}
      <div style={chrome({ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 4, padding: "44px 16px calc(20px + env(safe-area-inset-bottom,0px))", background: "linear-gradient(transparent, rgba(0,0,0,0.72))" })}>
        {item.deities ? (
          <>
            {/* 1 — имена пар Божеств, жирно */}
            <div style={{ fontFamily: FD, fontSize: "var(--text-body)", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.22, color: "#fff" }}>{item.deities}</div>
            {/* 2 — «Ежедневный даршан» */}
            <div style={{ marginTop: 5, fontFamily: FT, fontSize: "var(--text-footnote)", fontWeight: 500, lineHeight: 1.3, color: "rgba(255,255,255,0.88)" }}>Ежедневный даршан</div>
            {/* 3 — Храм · ИСККОН-центр */}
            {(item.place || item.caption) && (
              <div style={{ marginTop: 2, fontFamily: FT, fontSize: "var(--text-footnote)", fontWeight: 400, lineHeight: 1.35, color: "rgba(255,255,255,0.62)" }}>{item.place || item.caption}</div>
            )}
          </>
        ) : (
          <>
            {curCap && (
              <p style={{ margin: 0, fontFamily: FT, fontSize: "var(--text-footnote)", lineHeight: 1.55, color: "rgba(255,255,255,0.9)", whiteSpace: "pre-line",
                ...(capOpen ? {} : { display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }) }}>
                {curCap}
              </p>
            )}
            {longCap && (
              <button type="button" onClick={() => setCapOpen((v) => !v)} onPointerDown={stop} onPointerUp={stop}
                style={{ marginTop: 6, padding: 0, border: "none", background: "none", color: "rgba(255,255,255,0.7)", fontFamily: FT, fontSize: "var(--text-footnote)", fontWeight: 600, cursor: "pointer" }}>
                {capOpen ? "Свернуть" : "Ещё"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── keyframes (один раз) ── */
function Keyframes() {
  return <style>{`@keyframes darPulse{0%,100%{opacity:.45}50%{opacity:.8}}@keyframes storyIn{from{opacity:0;transform:scale(.98)}to{opacity:1;transform:scale(1)}}@keyframes darSpin{to{transform:rotate(360deg)}}`}</style>;
}
