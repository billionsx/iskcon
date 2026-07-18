/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NowPlaying — СВЕТЛЫЙ ПЛЕЕР ISKCON ONE LOVE (Apple Music iOS 26.5).
 *
 * ЧТО БЫЛО НЕ ТАК И ПОЧЕМУ ПЕРЕПИСАНО ЦЕЛИКОМ (решение основателя 18.07.2026).
 *
 * Плеер держал ТРИ РАЗНЫЕ РОЛИ в одной тёмной коробке: воспроизведение,
 * очередь и БИБЛИОТЕКУ («Играет · Коллекция · Моё»). Библиотека внутри плеера
 * и есть та свалка, о которой сказал основатель: 857 записей четырёх
 * рассказчиков одним списком, где Шрила Прабхупада перемешан с остальными,
 * потому что «коллекция» — это ВСЁ, что нашлось, а не то, что человек выбрал
 * слушать.
 *
 * У Apple эти роли разведены, и это не украшение, а устройство:
 *
 *   Медиатека   — ОТДЕЛЬНЫЙ ЭКРАН: голоса → собрания → записи, фильтр, поиск
 *   Now Playing — ЧТО ЗВУЧИТ: обложка, имя, перемотка, транспорт
 *   Далее       — ЧТО ЗАЗВУЧИТ: очередь и её правила (порядок, повтор)
 *
 * Здесь живут ВТОРАЯ и ТРЕТЬЯ. Первая — `AudioLibrary.tsx`.
 *
 * ЗКН-Н090 · ЗКН-Д023.
 * ═══════════════════════════════════════════════════════════════════════════
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { addFavorite, removeFavorite, useFavorites } from "../cardActions";
import { usePlayer, fmtTime, trackSubtitle, mediaTrackKey, PLAYER_RATES, type Track } from "./store";
import {
  PlayIcon, PauseIcon, PrevIcon, NextIcon, ChevDownIcon, Back15Icon, Fwd15Icon,
  ShuffleIcon, RepeatIcon, RepeatOneIcon, RepeatLibraryIcon, RepeatVoiceIcon, MoonIcon,
  OrderForwardIcon, OrderReverseIcon, EllipsisIcon, ListIcon, TextIcon, SpeedIcon,
  ShareIcon, StarIcon, DownloadIcon, NoteEditIcon, HeartGlyph, VoiceIcon, StackIcon,
} from "./icons";
import { MediaRow, PopMenu, TAP, fmtDur, type MenuItem, type MenuAction } from "./ui";
import { requestNote } from "../notes";
import { BOOKS, bookFullTitle, bookSlug } from "../books";
import { ROUTES, url, ORIGIN as SITE_ORIGIN } from "../routes";

const INK = "var(--color-label)";
const INK2 = "var(--color-label-2)";
const INK3 = "var(--color-label-3)";
const ACCENT = "var(--color-gold-deep)";
const HEART = "var(--color-heart)";

/** Свернуть жестом: ниже этого порога лист возвращается на место. */
const DISMISS_PX = 110;

export function NowPlaying({ onOpenPath, onOpenBhajan, onDonate }: {
  onOpenPath?: (path: string) => void;
  onOpenBhajan?: (slug: string) => void;
  onDonate?: () => void;
} = {}) {
  const p = usePlayer();
  const [pane, setPane] = useState<"now" | "queue">("now");
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [rowMenu, setRowMenu] = useState<{ el: HTMLElement; track: Track } | null>(null);
  const [sleepAnchor, setSleepAnchor] = useState<HTMLElement | null>(null);
  const [rateAnchor, setRateAnchor] = useState<HTMLElement | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const startY = useRef<number | null>(null);
  const toastTimer = useRef<number | null>(null);
  const queueRef = useRef<HTMLDivElement>(null);

  const favs = useFavorites();
  const isMedia = p.kind === "kirtan" || p.kind === "katha";
  const trackKey = (tr: Track | null) => (tr ? mediaTrackKey(tr, p.kind) : "");
  const curKey = trackKey(p.track);
  const isFav = isMedia ? favs.some((f) => f.key === curKey) : favs.some((f) => f.key === `book:${p.book}`);

  useEffect(() => {
    if (!p.expanded) { setPane("now"); return; }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [p.expanded]);

  /* Курсор едет за звуком: в очереди на сотни строк играющая запись обязана
     оставаться в поле зрения, иначе человек её ищет пролистыванием. */
  useEffect(() => {
    if (pane !== "queue") return;
    const el = queueRef.current?.querySelector<HTMLElement>('[data-active="1"]');
    el?.scrollIntoView({ block: "center", behavior: "auto" });
  }, [pane, p.index]);

  if (!p.active) return null;

  const BOOK = BOOKS[p.book] ?? BOOKS.bg;
  const isBook = p.kind === "book";
  const isAudiobook = isBook && !!BOOK.noText;
  const fallbackName = p.kind === "katha" ? "Катха" : p.kind === "kirtan" ? "Киртан" : "Бхаджан";
  const title = p.track?.title || p.bookTitle;
  const subtitle = isBook
    ? (isAudiobook && !p.track?.lilaLabel && p.track?.chapter == null
        ? bookFullTitle(BOOK)
        : trackSubtitle(p.track, p.mode, p.hasCommentary) || bookFullTitle(BOOK))
    : (p.track?.artist || p.artist || fallbackName);

  /* ЗКН-Б011: аудио и текст — ОДНА книга. Кнопка ведёт туда, где играет звук. */
  const ch = p.track?.kind === "chapter" ? (p.track?.chapter ?? null) : null;
  const verseSeg = p.track?.ref ? (String(p.track.ref).split(".").pop() ?? "") : "";
  const textPath = !isBook ? null
    : ch == null ? `/${bookSlug(p.book)}`
    : BOOK.hierarchical && p.track?.lila
      ? `/${bookSlug(p.book)}/${p.track.lila}/${ch}${verseSeg ? `/${verseSeg}` : ""}`
      : `/${bookSlug(p.book)}/${ch}`;

  function flash(m: string) {
    setToast(m);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1800);
  }
  function share(link: string, name: string) {
    if (typeof navigator !== "undefined" && navigator.share) navigator.share({ title: name, url: link }).catch(() => {});
    else { try { void navigator.clipboard?.writeText(link); flash("Ссылка скопирована"); } catch { /* ignore */ } }
  }
  /* ЗКН-Н052 · ЗКН-Н077: сердце ставится на ЗАПИСЬ и несёт адрес самой записи. */
  function toggleFav(tr: Track | null) {
    if (isMedia) {
      if (!tr) return;
      const k = mediaTrackKey(tr, p.kind);
      if (!k) return;
      if (favs.some((f) => f.key === k)) { removeFavorite(k); flash("Убрано из отложенного"); return; }
      const home = p.kind === "katha" ? "/katha" : "/kirtans";
      addFavorite(k, { t: tr.title, s: tr.artist ?? p.artist ?? "", h: `${home}?t=${encodeURIComponent(k.slice(k.indexOf(":") + 1))}` });
      flash("В отложенное");
      return;
    }
    const bk = `book:${p.book}`;
    if (favs.some((f) => f.key === bk)) { removeFavorite(bk); flash("Убрано из отложенного"); }
    else { addFavorite(bk, { t: bookFullTitle(BOOK), s: BOOK.tagline, h: `/${bookSlug(p.book)}` }); flash("В отложенное"); }
  }
  function download(tr: Track | null) {
    if (!tr) return;
    try {
      const a = document.createElement("a");
      a.href = tr.url; a.download = `${tr.title}.mp3`;
      document.body.appendChild(a); a.click(); a.remove();
      flash("Скачивание…");
    } catch { flash("Не удалось скачать"); }
  }
  function openText() {
    if (p.kind === "bhajan") { p.close(); onOpenBhajan?.((p.book || "").split("::")[0]); return; }
    if (textPath) { p.close(); onOpenPath?.(textPath); }
  }

  /** Меню записи — верхний ряд действий + переходы (замер Apple Music). */
  function trackMenu(tr: Track | null): { items: MenuItem[]; actions: MenuAction[] } {
    const fav = tr ? favs.some((f) => f.key === mediaTrackKey(tr, p.kind)) : isFav;
    const link = p.kind === "katha" ? url(ROUTES.katha())
      : p.kind === "kirtan" ? url(ROUTES.kirtans())
      : textPath ? `${SITE_ORIGIN}${textPath}` : SITE_ORIGIN;
    const actions: MenuAction[] = [
      { id: "fav", label: fav ? "Убрать" : "Отложить", icon: <StarIcon size={22} filled={fav} />, onSelect: () => toggleFav(tr) },
      { id: "share", label: "Поделиться", icon: <ShareIcon size={22} />, onSelect: () => share(link, tr?.title || p.bookTitle) },
    ];
    const items: MenuItem[] = [];
    if (isMedia && tr?.authorSlug) {
      items.push({
        id: "author", label: p.kind === "katha" ? "К рассказчику" : "К исполнителю",
        note: tr.artist || p.artist, icon: <VoiceIcon size={19} />,
        onSelect: () => { p.close(); onOpenPath?.(p.kind === "katha" ? `/katha/voice/${tr.authorSlug}` : `/kirtans/${tr.authorSlug}`); },
      });
    }
    if (p.kind === "katha" && tr?.collectionId) {
      items.push({
        id: "cycle", label: "К циклу", note: tr.album, icon: <StackIcon size={19} />,
        onSelect: () => { p.close(); onOpenPath?.(`/katha/cycle/${tr.collectionId}`); },
      });
    }
    if (!isMedia && textPath) {
      items.push({ id: "read", label: p.kind === "bhajan" ? "К тексту" : "Читать", icon: <TextIcon size={19} />, onSelect: openText });
    }
    items.push({ id: "dl", label: "Скачать запись", icon: <DownloadIcon size={19} />, divider: items.length > 0, onSelect: () => download(tr) });
    items.push({
      id: "note", label: "Заметка", icon: <NoteEditIcon size={19} />,
      onSelect: () => requestNote(isMedia
        ? { kind: "kirtan", ref: `${p.kind}:${p.book}`, title: tr?.title || p.bookTitle, subtitle: p.artist || fallbackName, href: p.kind === "katha" ? "/katha" : "/kirtans" }
        : { kind: "book", ref: `book:${p.book}`, title: bookFullTitle(BOOK), subtitle: tr?.title || subtitle, href: `/${bookSlug(p.book)}` }),
    });
    if (onDonate) items.push({ id: "donate", label: "Поддержать проект", icon: <HeartGlyph size={19} />, divider: true, onSelect: onDonate });
    return { items, actions };
  }

  const rate = p.rate;
  const remaining = p.duration > 0 ? Math.max(0, p.duration - p.currentTime) : 0;
  const sleepOn = p.sleepAt != null || p.sleepEnd;

  return createPortal(
    <div aria-hidden={!p.expanded} role="dialog" aria-label="Плеер"
      style={{
        position: "fixed", inset: 0, left: "50%", width: "100%", maxWidth: "var(--sheet-max)", zIndex: 95,
        transform: `translateX(-50%) translateY(${p.expanded ? `${drag}px` : "100%"})`,
        transition: dragging ? "none" : "transform .44s cubic-bezier(.32,.72,0,1)",
        display: "flex", flexDirection: "column", overflow: "hidden",
        background: "var(--color-bg-2)", color: INK, fontFamily: "var(--font-text)",
        borderTopLeftRadius: 18, borderTopRightRadius: 18,
      }}>
      {/* Тёплое свечение вверху — свет от обложки, а не серая плешь. */}
      <div aria-hidden style={{ position: "absolute", inset: 0, background: "var(--player-glow)", pointerEvents: "none" }} />

      {/* ═══ ШАПКА: ручка · свернуть · ⋯ ═══ */}
      <div
        onPointerDown={(e) => { startY.current = e.clientY; setDragging(true); }}
        onPointerMove={(e) => { if (startY.current == null) return; const dy = e.clientY - startY.current; if (dy > 0) setDrag(dy); }}
        onPointerUp={() => { const d = drag; startY.current = null; setDragging(false); setDrag(0); if (d > DISMISS_PX) p.close(); }}
        onPointerCancel={() => { startY.current = null; setDragging(false); setDrag(0); }}
        style={{
          position: "relative", zIndex: 1, flexShrink: 0, touchAction: "none", cursor: "grab",
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)", paddingInline: 12, paddingBottom: 2,
        }}>
        <div style={{ width: 38, height: 5, borderRadius: "var(--radius-pill)", background: INK3, margin: "0 auto 6px" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <IconBtn label="Свернуть" onClick={() => p.close()}><ChevDownIcon size={22} /></IconBtn>
          <span style={{ flex: 1, minWidth: 0, textAlign: "center", fontSize: "var(--text-caption)",
            fontWeight: 600, letterSpacing: "0.02em", textTransform: "uppercase", color: INK3,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {pane === "queue" ? "Очередь" : p.bookTitle}
          </span>
          <IconBtn label="Ещё" onClick={(el) => setMenu(el)}><EllipsisIcon size={19} /></IconBtn>
        </div>
      </div>

      {/* ═══ ТЕЛО ═══ */}
      {pane === "now" ? (
        /* Не влезло в невысокий экран — пусть прокрутится, но ничего не режем:
           обложка ужимается по высоте, а не выталкивает транспорт за край. */
        <div style={{ position: "relative", zIndex: 1, flex: 1, minHeight: 0, display: "flex",
          flexDirection: "column", justifyContent: "center", gap: 18, padding: "8px 24px 0",
          overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          <Artwork cover={p.cover} playing={p.isPlaying}
            onSwipe={(d) => (d === 1 ? p.next() : p.prev())} />

          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "var(--text-title2)", fontWeight: 700, letterSpacing: "-0.02em",
                color: INK, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {title}
              </div>
              <div style={{ marginTop: 2, fontSize: "var(--text-title2)", fontWeight: 400, letterSpacing: "-0.02em",
                color: INK2, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {subtitle}
              </div>
            </div>
            <button type="button" aria-label={isFav ? "Убрать из отложенного" : "Отложить"}
              onClick={() => toggleFav(p.track)}
              style={{ flexShrink: 0, width: 38, height: 38, marginTop: 2, borderRadius: "var(--radius-pill)",
                border: "none", display: "grid", placeItems: "center", cursor: "pointer",
                background: "var(--color-fill-1)", color: isFav ? HEART : INK2,
                WebkitTapHighlightColor: "transparent" }}>
              <StarIcon size={19} filled={isFav} />
            </button>
          </div>

          <Scrubber current={p.currentTime} duration={p.duration} loading={p.loading} onSeek={p.seek} />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <IconBtn label="Назад 15 секунд" onClick={() => p.skip(-15)} size={34} tone={INK2}><Back15Icon size={26} /></IconBtn>
            <IconBtn label="Предыдущая" onClick={() => p.prev()} size={40}><PrevIcon size={32} /></IconBtn>
            <button type="button" aria-label={p.isPlaying ? "Пауза" : "Играть"} onClick={() => p.togglePlay()}
              style={{ width: 64, height: 64, flexShrink: 0, borderRadius: "var(--radius-pill)", border: "none",
                display: "grid", placeItems: "center", cursor: "pointer", background: "none", color: INK,
                WebkitTapHighlightColor: "transparent" }}>
              {p.isPlaying ? <PauseIcon size={44} /> : <PlayIcon size={44} />}
            </button>
            <IconBtn label="Следующая" onClick={() => p.next()} size={40}><NextIcon size={32} /></IconBtn>
            <IconBtn label="Вперёд 15 секунд" onClick={() => p.skip(15)} size={34} tone={INK2}><Fwd15Icon size={26} /></IconBtn>
          </div>

          {/* ═══ ИНСТРУМЕНТЫ. У Apple здесь лирика · AirPlay · очередь.
              У нас лирики нет, зато есть двухчасовая лекция (скорость) и киртан
              на ночь (таймер) — предмет другой, язык тот же. ═══ */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around",
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)" }}>
            <IconBtn label="Текст" onClick={openText} tone={INK2}
              disabled={!(textPath || p.kind === "bhajan")}><TextIcon size={21} /></IconBtn>
            <IconBtn label="Скорость" onClick={(el) => setRateAnchor(el)} tone={rate === 1 ? INK2 : ACCENT}>
              <span style={{ display: "grid", placeItems: "center", gap: 1 }}>
                <SpeedIcon size={19} />
                <span style={{ fontSize: "var(--text-caption2)", fontWeight: 700, lineHeight: 1 }}>
                  {rate === 1 ? "1×" : `${rate}×`}
                </span>
              </span>
            </IconBtn>
            <IconBtn label="Таймер сна" onClick={(el) => setSleepAnchor(el)} tone={sleepOn ? ACCENT : INK2}>
              <MoonIcon size={21} />
            </IconBtn>
            <IconBtn label="Очередь" onClick={() => setPane("queue")} tone={INK2}><ListIcon size={21} /></IconBtn>
          </div>
        </div>
      ) : (
        <QueuePane paneRef={queueRef} onBack={() => setPane("now")} onRowMenu={(el, track) => setRowMenu({ el, track })} />
      )}

      {menu && (() => { const m = trackMenu(p.track); return (
        <PopMenu anchor={menu} items={m.items} actions={m.actions} onClose={() => setMenu(null)} />
      ); })()}
      {rowMenu && (() => { const m = trackMenu(rowMenu.track); return (
        <PopMenu anchor={rowMenu.el} items={m.items} actions={m.actions} onClose={() => setRowMenu(null)} />
      ); })()}
      {rateAnchor && (
        <PopMenu anchor={rateAnchor} width={210} onClose={() => setRateAnchor(null)}
          items={PLAYER_RATES.map((r) => ({
            id: `r${r}`, label: r === 1 ? "Обычная · 1×" : `${r}×`, checked: rate === r,
            onSelect: () => p.setRate(r),
          }))} />
      )}
      {sleepAnchor && (
        <PopMenu anchor={sleepAnchor} width={230} onClose={() => setSleepAnchor(null)}
          items={[
            { id: "off", label: "Выключить", checked: !sleepOn, onSelect: () => p.setSleep(null) },
            { id: "track", label: "После этой записи", checked: p.sleepEnd, divider: true, onSelect: () => p.setSleep("track") },
            ...[15, 30, 45, 60, 90].map((min) => ({
              id: `m${min}`, label: `Через ${min} мин`,
              checked: p.sleepAt != null && Math.abs(p.sleepAt - Date.now() - min * 60_000) < 60_000,
              onSelect: () => p.setSleep(min),
            })),
          ]} />
      )}
      {toast && (
        <div role="status" aria-live="polite" style={{
          position: "absolute", left: "50%", bottom: "calc(env(safe-area-inset-bottom, 0px) + 92px)",
          transform: "translateX(-50%)", zIndex: 20, padding: "10px 18px", borderRadius: "var(--radius-pill)",
          background: "color-mix(in srgb, var(--color-label) 90%, transparent)", color: "var(--color-bg-2)",
          fontSize: "var(--text-subhead)", fontWeight: 600, pointerEvents: "none", whiteSpace: "nowrap",
        }}>{toast}</div>
      )}
    </div>,
    document.body,
  );
}

/* ─────────────────────────── обложка ─────────────────────────── */

/**
 * Обложка Apple Music: на паузе ужимается, при игре — во всю ширину.
 * Свайп вбок листает записи (ЗКН-Н071: жест там, где палец).
 */
function Artwork({ cover, playing, onSwipe }: { cover: string; playing: boolean; onSwipe: (d: 1 | -1) => void }) {
  const from = useRef<{ x: number; y: number } | null>(null);
  return (
    <div style={{ display: "grid", placeItems: "center" }}>
      <img src={cover} alt="" draggable={false}
        onPointerDown={(e) => { from.current = { x: e.clientX, y: e.clientY }; }}
        onPointerUp={(e) => {
          const f = from.current; from.current = null;
          if (!f) return;
          const dx = e.clientX - f.x, dy = e.clientY - f.y;
          if (Math.abs(dx) > 46 && Math.abs(dx) > Math.abs(dy)) onSwipe(dx < 0 ? 1 : -1);
        }}
        style={{
          width: "min(320px, 76vw, 42vh)", aspectRatio: "1 / 1", objectFit: "cover",
          borderRadius: "var(--radius-lg)", background: "var(--color-card)",
          boxShadow: playing ? "var(--shadow-3)" : "var(--shadow-2)",
          transform: playing ? "scale(1)" : "scale(0.88)",
          transition: "transform .42s cubic-bezier(.32,.72,0,1), box-shadow .42s",
          userSelect: "none", touchAction: "pan-y",
        }} />
    </div>
  );
}

/* ─────────────────────────── перемотка ─────────────────────────── */

/** Полоса Apple: тонкая в покое, толще под пальцем; слева прошло, справа — осталось. */
function Scrubber({ current, duration, loading, onSeek }: {
  current: number; duration: number; loading: boolean; onSeek: (s: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [grab, setGrab] = useState(false);
  const [ghost, setGhost] = useState(0);
  const live = grab ? ghost : current;
  const pct = duration > 0 ? Math.min(100, Math.max(0, (live / duration) * 100)) : 0;

  const at = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r || duration <= 0) return 0;
    return Math.min(duration, Math.max(0, ((clientX - r.left) / r.width) * duration));
  };
  return (
    <div>
      <div ref={ref} role="slider" aria-label="Перемотка" aria-valuemin={0}
        aria-valuemax={Math.round(duration)} aria-valuenow={Math.round(live)} tabIndex={0}
        onPointerDown={(e) => { setGrab(true); setGhost(at(e.clientX)); (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); }}
        onPointerMove={(e) => { if (grab) setGhost(at(e.clientX)); }}
        onPointerUp={(e) => { if (grab) { onSeek(at(e.clientX)); setGrab(false); } }}
        onPointerCancel={() => setGrab(false)}
        style={{ height: TAP, display: "flex", alignItems: "center", cursor: "pointer", touchAction: "none" }}>
        <div style={{ position: "relative", width: "100%", height: grab ? 8 : 5, borderRadius: 4,
          background: "var(--color-fill-2)", transition: "height .18s" }}>
          <div style={{ position: "absolute", inset: 0, width: `${pct}%`, borderRadius: 4,
            background: loading ? INK3 : INK, transition: grab ? "none" : "width .25s linear" }} />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: -6,
        fontSize: "var(--text-caption)", color: INK3, fontVariantNumeric: "tabular-nums" }}>
        <span>{fmtTime(live)}</span>
        <span>{duration > 0 ? `−${fmtTime(Math.max(0, duration - live))}` : "живой эфир"}</span>
      </div>
    </div>
  );
}

/* ─────────────────────────── очередь ─────────────────────────── */

/**
 * «Далее» — ЧТО ЗАЗВУЧИТ, и только это.
 *
 * Правила очереди (порядок · повтор) живут ЗДЕСЬ, а не в Now Playing: там
 * человек слушает, здесь — распоряжается. Ровно как у Apple.
 */
function QueuePane({ paneRef, onBack, onRowMenu }: {
  paneRef: React.RefObject<HTMLDivElement | null>;
  onBack: () => void; onRowMenu: (el: HTMLElement, t: Track) => void;
}) {
  const p = usePlayer();
  /* ЗКН-Н090: «Далее» строится по НАСТОЯЩЕМУ порядку. При перемешивании
     соседи по списку и соседи по звучанию — разные записи; показать первых,
     а сыграть вторых значит соврать человеку в лицо. */
  const seq = p.sequence.length === p.tracks.length ? p.sequence : p.tracks.map((_, i) => i);
  const pos = seq.indexOf(p.index);
  const upcoming = (pos >= 0 ? seq.slice(pos + 1) : seq)
    .map((i) => ({ track: p.tracks[i], index: i }))
    .filter((x) => !!x.track);
  const RepeatGlyph = p.repeat === "one" ? RepeatOneIcon
    : p.repeat === "library" ? RepeatLibraryIcon
    : p.repeat === "group" ? RepeatVoiceIcon : RepeatIcon;
  const repeatLabel = p.repeat === "off" ? "Повтор выключен"
    : p.repeat === "one" ? "Повтор записи"
    : p.repeat === "group" ? "Повтор голоса"
    : p.repeat === "library" ? "Повтор коллекции" : "Повтор";
  const OrderGlyph = p.order === "shuffle" ? ShuffleIcon : p.order === "reverse" ? OrderReverseIcon : OrderForwardIcon;

  return (
    <div style={{ position: "relative", zIndex: 1, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      {/* играющая запись — якорь очереди */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 12, padding: "4px 20px 12px" }}>
        <img src={p.cover} alt="" draggable={false}
          style={{ width: 52, height: 52, borderRadius: "var(--radius-sm)", objectFit: "cover",
            background: "var(--color-card)", boxShadow: "var(--shadow-1)" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "var(--text-body)", fontWeight: 600, color: INK, letterSpacing: "-0.01em",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.track?.title}</div>
          <div style={{ marginTop: 1, fontSize: "var(--text-subhead)", color: INK2,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {p.track?.artist || p.artist || p.bookTitle}
          </div>
        </div>
        <IconBtn label="К обложке" onClick={onBack} tone={INK2}><ChevDownIcon size={20} /></IconBtn>
      </div>

      {/* ⚠️ ПРАВИЛА ОЧЕРЕДИ БЫЛИ ТРЕМЯ СЕРЫМИ ПЛАШКАМИ ВО ВСЮ ШИРИНУ.
          Это самые редкие органы плеера — включил перемешивание и забыл, — а
          занимали они больше места, чем сама очередь. У Apple они стоят в ОДНОЙ
          СТРОКЕ с надписью «Далее»: знак, а не панель. */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 2,
        padding: "0 20px 8px" }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: "var(--text-footnote)", fontWeight: 600,
          letterSpacing: "0.02em", textTransform: "uppercase", color: INK3 }}>
          {upcoming.length ? `Далее · ${upcoming.length}` : "Очередь окончена"}
        </span>
        <IconBtn label="Перемешать" onClick={() => p.cycleOrder()} size={36}
          tone={p.order === "shuffle" ? ACCENT : INK3}><OrderGlyph size={19} /></IconBtn>
        <IconBtn label={repeatLabel} onClick={() => p.cycleRepeat()} size={36}
          tone={p.repeat !== "off" ? ACCENT : INK3}><RepeatGlyph size={19} /></IconBtn>
        <IconBtn label="Заново" onClick={() => p.seek(0)} size={36} tone={INK3}>
          <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor"
            strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4.6 12a7.4 7.4 0 1 0 2.2-5.2" /><path d="M4.4 4.6v4.2h4.2" />
          </svg>
        </IconBtn>
      </div>

      <div ref={paneRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch",
        padding: "0 20px calc(env(safe-area-inset-bottom, 0px) + 20px)", overscrollBehavior: "contain" }}>
        {upcoming.map(({ track: t, index: idx }, i) => (
          <MediaRow key={`${t.file}-${idx}`} num={i + 1} title={t.title}
            subtitle={p.kind === "book" ? undefined : (t.artist || t.album)}
            meta={t.durationSec ? fmtDur(t.durationSec) : undefined}
            onClick={() => p.jumpTo(idx)}
            onMore={(el) => onRowMenu(el, t)}
            last={i === upcoming.length - 1} />
        ))}
        {!upcoming.length && (
          <div style={{ padding: "24px 0", color: INK3, fontSize: "var(--text-subhead)", lineHeight: 1.5 }}>
            Это последняя запись очереди. Включите повтор — и она пойдёт по кругу.
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── кнопка-знак ─────────────────────────── */

function IconBtn({ label, onClick, children, size = TAP, tone = INK, disabled }: {
  label: string; onClick: (el: HTMLElement) => void; children: React.ReactNode;
  size?: number; tone?: string; disabled?: boolean;
}) {
  const style: CSSProperties = {
    width: Math.max(size, TAP), height: Math.max(size, TAP), flexShrink: 0,
    border: "none", background: "none", padding: 0, borderRadius: "var(--radius-pill)",
    display: "grid", placeItems: "center", cursor: disabled ? "default" : "pointer",
    color: disabled ? INK3 : tone, opacity: disabled ? 0.45 : 1,
    WebkitTapHighlightColor: "transparent",
  };
  return (
    <button type="button" aria-label={label} disabled={disabled}
      onClick={(e) => onClick(e.currentTarget)} style={style}>
      {children}
    </button>
  );
}
