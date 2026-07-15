/**
 * NowPlaying — полноэкранный плеер (Apple Music iOS 26 / Liquid Glass).
 * Обложка = наш ВКП (BookHeroCard, презентационный режим).
 * Шапка закреплена; при скролле в ней появляется только название книги.
 * Открывается всегда сверху (без скачка). Контролы закреплены снизу «стеклом».
 * Контент-слой position:absolute inset:0 — гарантированно на всю высоту, без просветов.
 */
import { useEffect, useRef, useState, type CSSProperties, useMemo } from "react";
import { createPortal } from "react-dom";
import { COVER_FALLBACK, COVER_FALLBACK_DARK } from "../ui/CoverFallback";
import { addFavorite, removeFavorite, useFavorites } from "../cardActions";
import { usePlayer, fmtTime, trackSubtitle, type Track } from "./store";
import { PlayIcon, PauseIcon, PrevIcon, NextIcon, ChevDownIcon, Back15Icon, Fwd15Icon, ShuffleIcon, RepeatIcon, RepeatOneIcon, RepeatLibraryIcon, RepeatVoiceIcon, MoonIcon, OrderForwardIcon, OrderReverseIcon } from "./icons";
import { BookHeroCard, ActionBtn } from "../BookHeroCard";
import { BookMenuSheet } from "../BookMenuSheet";
import { requestNote } from "../notes";
import { QrSheet, type QrData } from "../QrSheet";
import { ReportSheet } from "../ReportSheet";
import { HeartIcon, MoreIcon, BookOpenIcon } from "../ui/icons";
import { BOOKS, bookFullTitle, bookSlug } from "../books";
import { albumById } from "../kirtans";
import { type SubTabDef } from "../SectionSubTabs";

/** Раздел очереди. Счёт нужен в листе выбора: «сколько там записей» — половина решения. */
type DivDef = SubTabDef & { count?: number };
import { ROUTES, url } from "../routes";

const GOLD = "var(--color-gold)";
const INK_ON_GOLD = "var(--color-on-gold)";   // ЗКН-Д001: чернила НА золоте
const ON_DARK = "var(--color-on-dark)";
const HEART = "var(--color-heart)";          // ЗКН-Д001: сердце избранного
      // ЗКН-Д001: текст на тёмной доске

/** Псевдо-раздел «Все» — плоский список всей коллекции (решение основателя). */
const ALL_DIV = "__all__";
const glass = (radius: number): CSSProperties => ({
  background: "rgba(255,255,255,0.10)",
  backdropFilter: "blur(24px) saturate(160%)", WebkitBackdropFilter: "blur(24px) saturate(160%)",
  border: "0.5px solid rgba(255,255,255,0.16)", borderRadius: radius,
});
/** ЗКН-Н066 — ЦЕЛЬ КАСАНИЯ НЕ МЕНЬШЕ 44 ТОЧЕК.
 *  Палец — не курсор: он мягкий, широкий и не видит, куда бьёт. Apple меряет 44pt
 *  не из вкусовщины, а потому что ниже начинаются ПРОМАХИ. Знак может быть мелким —
 *  ЗОНА обязана быть крупной. */
const TAP = 44;
const bareBtn = (size: number): CSSProperties => ({
  height: Math.max(size, TAP), width: Math.max(size, TAP),
  display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0,
  background: "none", border: "none", padding: 0,
});

/**
 * ЗКН-Б011 · решение основателя 13.07.2026 — ПЛЕЕР ВСТРАИВАЕТСЯ, А НЕ КОПИРУЕТСЯ.
 *
 * `embedded` — тот же самый плеер, но НЕ листом поверх страницы, а самой страницей:
 * на витрине Киртанов он и есть содержимое. Убираются только шторка, «свернуть»
 * и «закрыть» — они там бессмысленны (сворачивать некуда, закрывать нечего).
 * Всё остальное — обложка, дорожки, перемотка, транспорт, порядок/повтор/скорость —
 * работает ровно как было.
 *
 * Я сперва написал ВТОРОЙ плеер (белую доску) — это была ошибка: два плеера рядом
 * это две правды о том, что играет, и они разъедутся. Плеер один.
 */
export function NowPlaying({ onOpenPath, onOpenBhajan, onDonate, embedded = false, embeddedHeight, belowHero }: { onOpenPath?: (path: string) => void; onOpenBhajan?: (slug: string) => void; onDonate?: () => void; embedded?: boolean; embeddedHeight?: number; belowHero?: React.ReactNode } = {}) {
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
    if (embedded || !p.expanded) return;
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    setCollapsed(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [p.expanded]);

  // Суб-табы очереди — из самих треков. По умолчанию раздел = лила (ЧЧ), но трек может
  // задать свою группу: у ШБ манифест приходит одной песнью, а очередь режется по ГЛАВАМ
  // (784…3662 стиха в песни — плоским списком это не очередь, а стена).
  const gid = (t: { group?: string; lila?: string }) => t.group ?? t.lila;
  const divisions: DivDef[] = [];
  const seenDiv = new Set<string>();

  /* ЗКН-Б011 · решение основателя — «ВСЕ» ИДЁТ ПЕРВЫМ РАЗДЕЛОМ.
   *
   * У книги разделы взаимоисключающи: читаешь главу — видишь главу. У аудиотеки
   * иначе: «Все» — это плоский список всех 1062 записей, а дальше папки по
   * исполнителям. Поэтому у киртанов впереди встаёт псевдо-раздел «Все».
   *
   * Отдельной сетки папок для этого НЕ НУЖНО: пилюли разделов в плеере уже есть —
   * ими сделаны песни, главы и стихи у книг. */
  const isKirtanQueue = p.kind === "kirtan";
  if (isKirtanQueue && p.tracks.length > 1) divisions.push({ id: ALL_DIV, label: "Все голоса", count: p.tracks.length });

  const divCount: Record<string, number> = {};
  for (const t of p.tracks) {
    const g = gid(t);
    if (!g) continue;
    divCount[g] = (divCount[g] ?? 0) + 1;
    if (!seenDiv.has(g)) { seenDiv.add(g); divisions.push({ id: g, label: t.groupLabel ?? t.lilaLabel ?? g }); }
  }
  for (const d of divisions) if (d.id !== ALL_DIV) d.count = divCount[d.id] ?? 0;
  const hierQueue = divisions.length > 1;
  const [activeDiv, setActiveDiv] = useState("");
  /* Вид очереди: список или плитка. Пилюли папок — это ФИЛЬТР; вид — это про то,
     КАК показаны отфильтрованные записи. Два разных органа, не смешиваем. */
  const [qView, setQView] = useState<"list" | "grid">("list");

  /* ═══════════════════════════════════════════════════════════════════════
   * ЗКН-Н050 · ОДИН ЭКРАН — ОДНА ЗАДАЧА. ТРАНСПОРТ — ВСЕГДА.
   *
   * Я сложил в ОДИН прокручиваемый столбец три разные вещи: обложку, список из
   * 1062 строк и транспорт. Оттого всё и разъезжалось: обложка сдувалась при
   * прокрутке, транспорт уезжал, внизу оставалась пустая плешь.
   *
   * Но это ТРИ РАЗНЫХ МОМЕНТА, и смешивать их нельзя:
   *   слушаю   → что звучит, обложка, имя
   *   выбираю  → что ещё есть, папки, список
   *   управляю → пауза, перемотка — НУЖНО ВСЕГДА, в обоих случаях
   *
   * Поэтому: ДВЕ ПАНЕЛИ + ЗАКРЕПЛЁННЫЙ ТРАНСПОРТ. Панель занимает весь остаток
   * высоты (пустая плешь становится невозможной), транспорт прибит ко дну и
   * прокруткой не сдувается. */
  /* ═══ ЗКН-Н051 · НАЗЫВАЕМ ТЕМ, ЧЕМ ЧЕЛОВЕК УПРАВЛЯЕТ, А НЕ ТЕМ, КАК УСТРОЕНО ═══
   *
   * «Очередь» — слово ДВИЖКА: так называется структура воспроизведения внутри.
   * Человек, пришедший слушать святое имя, не думает «очередь». Он думает:
   * что играет · что ещё есть · чей это голос.
   *
   * Правильное слово уже написано в шапке витрины: «Святое имя В ГОЛОСАХ ачарьев
   * и киртания». ГОЛОСА. Не «папки», не «исполнители», не «очередь».
   *
   *   Очередь  →  Записи
   *   Папки    →  Голоса
   *   Дорожки  →  Записи
   */
  const [pane, setPane] = useState<"now" | "queue" | "mine">("now");

  /* Встроенный плеер объявляет о себе — мини-плеер уступает ему место (ЗКН-Н065). */
  useEffect(() => {
    if (!embedded) return;
    p.setEmbeddedVisible(true);
    return () => p.setEmbeddedVisible(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded]);
  const isAdHoc = p.kind !== "book";
  /* ЗКН-Н052 — СЕРДЦЕ СТАВИТСЯ НА ЗАПИСЬ, А НЕ НА АЛЬБОМ.
   *
   * Сердце висело на всей коллекции: нажал — «добавлено в избранное», а что
   * именно добавлено, непонятно. Человек хочет отметить КОНКРЕТНЫЙ киртан —
   * тот, что сейчас звучит и лёг на сердце. Без этого «Моё» — пустое обещание.
   *
   * Ключ — путь дорожки в архиве: он уникален и переживает переименования. */
  const trackKey = (tr: Track | null) => {
    if (!tr) return "";
    const m = (tr.url || "").split("/audio/")[1];
    return m ? `kirtan:${decodeURIComponent(m)}` : "";
  };
  const favs = useFavorites();
  const favSet = useMemo(() => new Set(favs.filter((f) => f.key.startsWith("kirtan:")).map((f) => f.key)), [favs]);
  /* ═══ ЗКН-Н075 · «МОЁ» СОРТИРУЕТСЯ ПО ВРЕМЕНИ: НОВЫЕ СВЕРХУ ═══
   *
   * Порядок был очередной — по голосам. Это неверно, и вот почему: человек отметил
   * запись ТОЛЬКО ЧТО. Если она утонет где-то в середине, он решит, что кнопка не
   * сработала. Последнее действие человека должно быть у него перед глазами —
   * иначе интерфейс не подтверждает то, что человек сделал.
   *
   * Сортировка по голосам была бы верна для КАТАЛОГА. «Моё» — не каталог, это
   * дневник: что я отложил и когда. */
  const favAt = useMemo(() => {
    const m = new Map<string, number>();
    favs.forEach((f) => { if (f.key.startsWith("kirtan:")) m.set(f.key, f.addedAt || 0); });
    return m;
  }, [favs]);
  const favTracks = useMemo(
    () => (isAdHoc
      ? p.tracks
          .filter((tr) => favSet.has(trackKey(tr)))
          .sort((a, b) => (favAt.get(trackKey(b)) ?? 0) - (favAt.get(trackKey(a)) ?? 0))
      : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p.tracks, favSet, favAt, isAdHoc],
  );
  const toggleTrackFav = (tr: Track) => {
    const k = trackKey(tr);
    if (!k) return;
    const on = favSet.has(k);
    if (on) removeFavorite(k); else addFavorite(k, { t: tr.title, s: tr.artist ?? "" });
    flash(on ? "Убрано из «Моё»" : "Добавлено в «Моё»");
  };

  /** Что зазвучит следующим. */
  const nextTrack = p.tracks[p.index + 1] ?? null;

  /* Таймер сна: сколько осталось. Показываем минуты — секунды тут только тревожат. */
  const [sleepOpen, setSleepOpen] = useState(false);
  const [showTotal, setShowTotal] = useState(false);   // время: «осталось» ↔ «всего»
  const [, tickSleep] = useState(0);
  useEffect(() => {
    if (p.sleepAt == null) return;
    const id = window.setInterval(() => tickSleep((x) => x + 1), 15_000);
    return () => window.clearInterval(id);
  }, [p.sleepAt]);
  const sleepOn = p.sleepAt != null || p.sleepEnd;
  const sleepLeft = p.sleepAt != null
    ? `${Math.max(1, Math.ceil((p.sleepAt - Date.now()) / 60_000))}м`
    : p.sleepEnd ? "•" : "";

  /* Где играющая запись живёт: чей голос, какая по счёту у него. */
  const curGroupId = p.track ? (gid(p.track) ?? "") : "";
  const curGroupLabel = p.track?.groupLabel ?? "";
  const curGroupTotal = curGroupId ? p.tracks.filter((x) => (gid(x) ?? "") === curGroupId).length : 0;
  const curGroupPos = curGroupId
    ? p.tracks.slice(0, p.index + 1).filter((x) => (gid(x) ?? "") === curGroupId).length
    : 0;

  /* Счёт — по АКТИВНОЙ папке. «Записи · 1062» при открытой папке на 7 записей —
     это ложь: человек видит семь строк и цифру 1062. */
  const shownCount = (!hierQueue || activeDiv === ALL_DIV)
    ? p.tracks.length
    : p.tracks.filter((t) => (gid(t) ?? divisions[0]?.id) === activeDiv).length;
  const curDiv = p.track ? gid(p.track) : undefined;
  // Активный подраздел следует за играющим треком; тап пользователя сохраняется,
  // пока воспроизведение не пересечёт границу главы/песни/лилы.
  useEffect(() => {
    if (!hierQueue) return;
    setActiveDiv((prev) => {
      // ⚠️ У киртанов активный раздел за звуком НЕ БЕГАЕТ. Иначе человек выбрал
      //    «Все», нажал первую дорожку — и его тут же перекинуло в папку её
      //    исполнителя. Раздел меняет ЧЕЛОВЕК; звук идёт по общей очереди.
      if (isKirtanQueue) return prev || divisions[0]?.id || "";
      return curDiv ?? (prev || divisions[0]?.id || "");
    });
  }, [curDiv, hierQueue, isKirtanQueue]);

  // ── ШБ: ТРИ уровня очереди — ПЕСНЬ → ГЛАВА → СТИХ ──
  // У ЧЧ дорожка это ГЛАВА, поэтому одного ряда пилюль (лилы) хватает. У ШБ дорожка —
  // СТИХ, а манифест приходит по ОДНОЙ песни (13 253 дорожки одним куском не грузят).
  // Без верхнего ряда песней человек видел одну песнь и думал, что залита только она.
  const cantoTabs: SubTabDef[] = (p.cantos ?? []).map((c) => ({ id: String(c.canto), label: `Песнь ${c.canto}` }));
  const multiCanto = cantoTabs.length > 0;
  const [browseCanto, setBrowseCanto] = useState("");
  const [browseTracks, setBrowseTracks] = useState<Track[]>([]);
  useEffect(() => { setBrowseCanto(p.scope || cantoTabs[0]?.id || ""); }, [p.scope, cantoTabs.length]);
  useEffect(() => {
    if (!multiCanto || !browseCanto) { setBrowseTracks([]); return; }
    let live = true;
    void p.tracksFor(browseCanto).then((t) => { if (live) setBrowseTracks(t); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [browseCanto, multiCanto, p.scope, p.tracks]);

  const chapTabs: SubTabDef[] = [];
  const seenCh = new Set<string>();
  for (const t of browseTracks) {
    const g = t.group ?? "";
    if (g && !seenCh.has(g)) { seenCh.add(g); chapTabs.push({ id: g, label: t.groupLabel ?? g }); }
  }
  const [activeCh, setActiveCh] = useState("");
  const playingHere = browseCanto === p.scope;
  useEffect(() => {
    const cur = playingHere ? p.track?.group : undefined;
    setActiveCh((prev) => cur ?? (chapTabs.some((c) => c.id === prev) ? prev : (chapTabs[0]?.id ?? "")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.track?.group, playingHere, browseCanto, chapTabs.length]);

  /* ⚠️ ЗДЕСЬ ПЛЕЕР ИСЧЕЗАЛ.
   *
   * `active` = «дорожка загружена». Для ЛИСТА-ОВЕРЛЕЯ это верно: пока ничего не
   * играет, показывать поверх страницы нечего. Но ВСТРОЕННЫЙ плеер — это САМА
   * витрина: он обязан стоять на месте и до первого нажатия, со списком дорожек
   * и транспортом. Иначе человек заходит на /kirtans и видит пустоту — ровно то,
   * что и произошло. */
  /* КУРСОР ЕДЕТ ЗА ЗВУКОМ.
   *
   * В очереди на 1062 записи играющая строка легко уезжает за край: человек ищет
   * киртан, тот включается — а он его не видит. Подвозим строку в поле зрения на
   * каждую смену дорожки и на смену очереди (поиск ↔ библиотека). */
  /* ⚠️ ПОДСКРОЛЛ СДУВАЛ ОБЛОЖКУ.
   * `block: "center"` уводил тело вниз СРАЗУ на первом рендере — обложка и шапка
   * уезжали за край, и человек видел обрубок. Теперь: «nearest» (не двигаем, если
   * строка и так видна) и только при СМЕНЕ дорожки, а не при монтировании. */
  const firstScroll = useRef(true);
  useEffect(() => {
    if (firstScroll.current) { firstScroll.current = false; return; }
    const el = bodyRef.current?.querySelector<HTMLElement>('[data-active="1"]');
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [p.index]);

  /* ЗКН-Н049 — ИГРАЮЩУЮ ЗАПИСЬ ВСЕГДА МОЖНО НАЙТИ.
   *
   * В папке на 140 записей достаточно пролистать — и то, что звучит, потеряно:
   * человек не знает даже, в какую сторону крутить. Кнопка появляется РОВНО тогда,
   * когда играющая строка ушла из поля зрения, и исчезает, когда она видна. Кнопка,
   * которая висит всегда, — это шум; кнопка, которой нет, когда нужна, — это провал.
   */
  const [lostTrack, setLostTrack] = useState(false);
  useEffect(() => {
    const root = bodyRef.current;
    const el = root?.querySelector<HTMLElement>('[data-active="1"]');
    if (!root || !el) { setLostTrack(false); return; }
    const io = new IntersectionObserver(
      ([e]) => setLostTrack(!e.isIntersecting),
      { root, threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [p.index, p.book, activeDiv, qView, p.tracks.length]);

  const backToPlaying = () => {
    bodyRef.current?.querySelector<HTMLElement>('[data-active="1"]')
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  if (!embedded && !p.active) return null;

  const remaining = p.duration > 0 ? p.duration - p.currentTime : 0;
  const isKirtan = p.kind === "kirtan";
  const BOOK = BOOKS[p.book] ?? BOOKS.bg;
  const isAudiobook = !isAdHoc && !!BOOK.noText; // аудиокнига без текста: «глав» нет — показываем название книги
  // Подпись — общая для всех поверхностей плеера (store.trackSubtitle).
  const sub = isAdHoc
    ? (p.artist || (isKirtan ? "Киртан" : "Бхаджан"))
    : isAudiobook && !p.track?.lilaLabel && p.track?.chapter == null
      ? bookFullTitle(BOOK)
      : trackSubtitle(p.track, p.mode, p.hasCommentary);

  function onDown(e: React.PointerEvent) { startY.current = e.clientY; setDragging(true); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }
  function onMove(e: React.PointerEvent) { if (startY.current == null) return; const dy = e.clientY - startY.current; if (dy > 0) setDrag(dy); }
  function onUp() { if (startY.current == null) return; const d = drag; startY.current = null; setDragging(false); setDrag(0); if (d > 110) p.close(); }

  const ORIGIN = "https://gaurangers.com";
  const artistSlug = isKirtan ? (albumById(p.book)?.artist ?? "") : "";
  const kirtanUrl = artistSlug ? url(ROUTES.kirtanArtist(artistSlug)) : ORIGIN;
  const ch = p.track?.kind === "chapter" ? (p.track?.chapter ?? null) : null;
  const isChapter = ch != null;
  const bookUrl = url(ROUTES.book(p.book)) + "?listen";
  const lila = p.track?.lila;   // ЧЧ: лила · ШБ: песнь

  /** ЗКН-Б011: АУДИО И ТЕКСТ — ОДНА КНИГА. Кнопка ведёт в ТО ЖЕ место, где играет звук.
   *  У ШБ дорожка — это СТИХ, значит открывать надо СТИХ. Раньше для иерархических книг
   *  (ШБ/ЧЧ) глава просто ОТБРАСЫВАЛАСЬ, и человек падал на обложку книги. */
  const verseSeg = p.track?.ref ? (String(p.track.ref).split(".").pop() ?? "") : "";
  const textPath = isAdHoc
    ? null
    : !isChapter
      ? `/${bookSlug(p.book)}`
      : BOOK.hierarchical && lila
        ? `/${bookSlug(p.book)}/${lila}/${ch}${verseSeg ? `/${verseSeg}` : ""}`
        : `/${bookSlug(p.book)}/${ch}`;
  const chapterUrl = textPath ? `${ORIGIN}${textPath}?listen` : bookUrl;
  function flash(m: string) { setToast(m); if (toastTimer.current) window.clearTimeout(toastTimer.current); toastTimer.current = window.setTimeout(() => setToast(null), 1900); }
  function doShare(url: string, title: string) {
    if (typeof navigator !== "undefined" && navigator.share) navigator.share({ title, url }).catch(() => {});
    else { try { void navigator.clipboard?.writeText(url); flash("Ссылка скопирована"); } catch { /* ignore */ } }
  }
  function readBook() { p.close(); if (textPath) onOpenPath?.(textPath); }
  function openText() {
    if (p.kind === "bhajan") { p.close(); onOpenBhajan?.((p.book || "").split("::")[0]); return; }
    readBook();
  }
  function downloadChapter() {
    const t = p.track; if (!t) return;
    try { const a = document.createElement("a"); a.href = t.url; a.download = `${t.title}.mp3`; document.body.appendChild(a); a.click(); a.remove(); flash("Скачивание…"); }
    catch { flash("Не удалось скачать"); }
  }
  function bookQr() { setQr({ url: bookUrl, data: { kind: "book", bookTitle: bookFullTitle(BOOK), tagline: BOOK.tagline, cover: BOOK.covers[0] } }); }
  function chapterQr() { if (!isChapter) { bookQr(); return; } setQr({ url: chapterUrl, data: { kind: "chapter", bookTitle: bookFullTitle(BOOK), chapterNumber: String(ch), chapterTitle: p.track?.title ?? "" } }); }
  function onMenuSelect(id: string) {
    if (id === "note") {
      if (isAdHoc) {
        requestNote({
          kind: "kirtan",
          ref: `${p.kind}:${p.book}`,
          title: p.bookTitle,
          subtitle: `${p.track?.title ? p.track.title + " · " : ""}${p.artist || (isKirtan ? "Киртан" : "Бхаджан")}`,
          href: isKirtan ? (kirtanUrl.replace(ORIGIN, "") || "/kirtans") : (p.book || "/"),
        });
      } else {
        requestNote({
          kind: "book",
          ref: `book:${p.book}`,
          title: bookFullTitle(BOOK),
          subtitle: p.track?.title || sub,
          href: `/${bookSlug(p.book)}`,
        });
      }
      return;
    }
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
  /* ⚠️ СЕРДЦЕ В ШАПКЕ СТАВИЛОСЬ НА АЛЬБОМ, А НЕ НА ЗАПИСЬ.
   *
   * Человек нажимал сердце над играющим киртаном — и в «Моё» ничего не появлялось:
   * отмечался ВЕСЬ альбом, ключом `book:…`, а «Моё» читает ключи записей `kirtan:…`.
   * Кнопка врала: говорила «добавлено», а добавляла не то.
   *
   * ЗКН-Н052 я записал, но до шапки не довёл. Теперь у аудиотеки сердце везде
   * означает ОДНО: эта запись. */
  const heroFav = isAdHoc && p.track ? favSet.has(trackKey(p.track)) : favorited;
  const heroFavToggle = () => {
    if (isAdHoc && p.track) { toggleTrackFav(p.track); return; }
    const v = !favorited; setFavorited(v);
    flash(v ? "Добавлено в избранное" : "Убрано из избранного");
  };

  const coverActions = (
    <>
      <ActionBtn active={heroFav} activeColor={HEART} ariaLabel={heroFav ? "Убрать из «Моё»" : "В «Моё»"} onClick={heroFavToggle}><HeartIcon size={18} filled={heroFav} /></ActionBtn>
      {(!isAdHoc || p.kind === "bhajan") && <ActionBtn ariaLabel={p.kind === "bhajan" ? "К тексту" : "Читать"} onClick={openText}><BookOpenIcon size={18} /></ActionBtn>}
      <span ref={moreRef} style={{ display: "inline-flex" }}><ActionBtn ariaLabel="Ещё" onClick={() => setMenuOpen(true)}><MoreIcon size={16} /></ActionBtn></span>
    </>
  );

  return (
    <div
      aria-hidden={embedded ? undefined : !p.expanded}
      /* ЗКН-Н012 · решение основателя 13.07.2026 — ПЛЕЕР ВЛЕЗАЕТ В ЭКРАН.
       *
       * Высота была `min(76vh, 720px)` — и на телефоне плеер вылезал за экран:
       * приходилось прокручивать страницу, чтобы дотянуться до транспорта.
       * Теперь высота СЧИТАЕТСЯ витриной: сколько осталось от низа шапки до
       * нижнего меню — столько и берём. Ничего не свисает. */
      /* ⚠️ ТАП ПО ПУСТОМУ МЕСТУ В СПИСКЕ РАСКРЫВАЛ ПЛЕЕР НА ВЕСЬ ЭКРАН.
       * Человек листает записи, промахивается мимо строки — и его выбрасывает в
       * полный экран. Раскрытие живёт только на панели «Играет»: там для этого и
       * есть обложка, и там человек НЕ ЛИСТАЕТ. Жест, срабатывающий там, где его не
       * ждут, — это не удобство, а ловушка. */
      onClick={embedded && pane === "now" ? (e) => {
        if ((e.target as HTMLElement).closest("button,input,a,[role='slider']")) return;
        if (!p.active && p.tracks.length > 0) p.jumpTo(0);
        p.open();
      } : undefined}
      style={embedded ? {
        /* ⚠️ ПЛЕЕР УЖИМАЛСЯ ПОД ОСТАТОК ЭКРАНА И СХЛОПЫВАЛСЯ НА ТЕЛЕФОНЕ.
         * Внутри нечего было делать: обложка в ноготь, список в две строки.
         * Плееру нужен ПОЛ. Не влезло — пусть прокручивается СТРАНИЦА: лучше
         * дотянуться пальцем, чем не суметь пользоваться вовсе. */
        position: "relative", width: "100%",
        height: embeddedHeight ? `${embeddedHeight}px` : "min(70svh, 640px)",
        display: "flex", flexDirection: "column",
        borderRadius: 22, overflow: "hidden", cursor: "pointer",
        background: "#0e0e10", color: ON_DARK, fontFamily: "var(--font-text)",
        boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
      } : {
        position: "fixed", top: 0, bottom: 0, left: "50%", width: "100%", maxWidth: 480, zIndex: 95,
        transform: `translateX(-50%) translateY(${p.expanded ? `${drag}px` : "100%"})`,
        transition: dragging ? "none" : "transform .44s cubic-bezier(.32,.72,0,1)",
        background: "#0e0e10", color: ON_DARK, fontFamily: "var(--font-text)", overflow: "hidden",
      }}
    >
      {/* ambient artwork background */}
      <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        {/* ⚠️ ОБЛОЖКА ЗДЕСЬ — БЕЛАЯ (фирменный знак), а не фотография.
            Размытая, она давала СЕРУЮ ПЛЕШЬ на всю доску. Гасим её почти в ноль и
            даём собственное свечение: тёплое золото сверху, темнота ко дну. */}
        <img src={p.cover} alt="" style={{ position: "absolute", inset: "-20%", width: "140%", height: "140%", objectFit: "cover", filter: "blur(90px) saturate(200%) brightness(0.22)", transform: "scale(1.1)", opacity: 0.5 }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 70% at 50% 0%, rgba(210,170,27,0.16) 0%, rgba(210,170,27,0.04) 38%, rgba(0,0,0,0) 68%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(14,14,16,0.62) 0%, rgba(13,13,15,0.86) 55%, rgba(10,10,12,0.97) 100%)" }} />
      </div>

      {/* Содержимое — flex-столбец на ВСЮ высоту коробки.
          Панель растягивается (`flex:1`), транспорт прибит ко дну (`flexShrink:0`).
          Пустого места внизу быть НЕ МОЖЕТ по устройству. */}
      {/* Содержимое — flex-ребёнок обёртки, а не `inset:0`. Тянется флексом:
          пустая плешь становится невозможной ПО УСТРОЙСТВУ, а не по расчёту. */}
      <div style={{ position: "relative", zIndex: 1, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {/* pinned header: grabber + minimize / (book title on scroll) / close */}
        {/* ⚠️ ПУСТОЕ МЕСТО СВЕРХУ.
         *
         * Во встроенном плеере шапка не нужна: сворачивать некуда, закрывать нечего,
         * название стоит в самом плеере. Я её «спрятал» — но оставил РАСПОРКИ: две
         * невидимые кнопки 38×38 и блок заголовка. Пустота осталась, а с ней съехало
         * вниз всё остальное.
         *
         * Спрятать — не значит убрать. Во встроенном режиме шапки НЕТ вовсе. */}
        {!embedded && (
        <div onPointerDown={embedded ? undefined : onDown} onPointerMove={embedded ? undefined : onMove}
          onPointerUp={embedded ? undefined : onUp} onPointerCancel={embedded ? undefined : onUp}
          style={{
            flexShrink: 0, paddingTop: embedded ? 10 : "calc(env(safe-area-inset-top) + 8px)",
            paddingBottom: 6, paddingInline: 14,
            touchAction: embedded ? "auto" : "none", cursor: embedded ? "default" : "grab",
            background: collapsed ? "rgba(14,14,16,0.72)" : "transparent",
            backdropFilter: collapsed ? "blur(24px) saturate(160%)" : "none", WebkitBackdropFilter: collapsed ? "blur(24px) saturate(160%)" : "none",
            borderBottom: `0.5px solid ${collapsed ? "rgba(255,255,255,0.10)" : "transparent"}`, transition: "background .25s, border-color .25s",
          }}>
          {!embedded && <div style={{ width: 38, height: 5, borderRadius: 999, background: "rgba(255,255,255,0.5)", margin: "0 auto 8px" }} />}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            {embedded
              ? <span aria-hidden style={{ width: 38, height: 38 }} />
              : <button type="button" aria-label="Свернуть" onClick={() => p.close()} style={{ ...glass(999), ...iconBtn(38) }}><ChevDownIcon size={22} /></button>}
            <div style={{ flex: 1, minWidth: 0, paddingLeft: 4, opacity: collapsed ? 1 : 0, transform: collapsed ? "none" : "translateY(2px)", transition: "opacity .25s, transform .25s", pointerEvents: "none" }}>
              <div style={{ fontSize: "var(--text-footnote)", fontWeight: 700, letterSpacing: "-0.01em", color: ON_DARK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.25 }}>{p.track?.title}</div>
              <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.25 }}>{isAdHoc ? `${p.bookTitle}${p.artist ? ` · ${p.artist}` : ""}` : isAudiobook ? bookFullTitle(BOOK) : `${sub} · ${bookFullTitle(BOOK)}`}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div aria-hidden={!collapsed}
                style={{ display: "flex", alignItems: "center", gap: 6, opacity: collapsed ? 1 : 0, transform: collapsed ? "none" : "translateY(2px)", transition: "opacity .25s, transform .25s", pointerEvents: collapsed ? "auto" : "none" }}>
                <button type="button" aria-label={heroFav ? "Убрать из «Моё»" : "В «Моё»"} onClick={heroFavToggle} style={{ ...glass(999), ...iconBtn(34), color: heroFav ? HEART : ON_DARK }}><HeartIcon size={17} filled={heroFav} /></button>
                {(!isAdHoc || p.kind === "bhajan") && <button type="button" aria-label={p.kind === "bhajan" ? "К тексту" : "Читать"} onClick={openText} style={{ ...glass(999), ...iconBtn(34) }}><BookOpenIcon size={17} /></button>}
                <button type="button" aria-label="Ещё" onClick={() => setMenuOpen(true)} style={{ ...glass(999), ...iconBtn(34) }}><MoreIcon size={15} /></button>
              </div>
              {embedded
                ? <span aria-hidden style={{ width: 38, height: 38 }} />
                : <button type="button" aria-label="Закрыть плеер" onClick={() => p.dismiss()} style={{ ...glass(999), ...iconBtn(38) }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" /></svg>
                  </button>}
            </div>
          </div>
        </div>
        )}

        {/* ═══ СЕГМЕНТ: «Сейчас» / «Очередь» ═══
            Один экран — одна задача. Смешивать «что звучит» и «что ещё есть» в
            одном прокручиваемом столбце нельзя: они мешают друг другу. */}
        <div style={{ flexShrink: 0, padding: "2px 16px 10px" }}>
          <div role="tablist" aria-label="Плеер"
            style={{ display: "flex", gap: 3, padding: 3, borderRadius: 12,
              background: "rgba(255,255,255,0.07)", border: "0.5px solid rgba(255,255,255,0.08)" }}>
            {(isAdHoc
              ? [["now", "Играет"], ["queue", "Коллекция"], ["mine", "Моё"]] as const
              : [["now", "Сейчас"], ["queue", "Содержание"]] as const
            ).map(([id, label]) => {
              const on = pane === id;
              /* На вкладке «Записи» числа НЕТ: оно повторяло бы то, что уже стоит на
                 кнопке голоса, и два одинаковых числа рядом сбивают. На «Моё» число
                 нужно — оно нигде больше не написано. */
              const n = id === "mine" ? favTracks.length : 0;
              return (
                <button key={id} type="button" role="tab" aria-selected={on}
                  onClick={() => setPane(id as "now" | "queue" | "mine")}
                  style={{ flex: 1, minWidth: 0, height: TAP, borderRadius: 11, border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    background: on ? "rgba(255,255,255,0.14)" : "transparent",
                    color: on ? GOLD : "rgba(255,255,255,0.55)",
                    fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: on ? 700 : 500,
                    boxShadow: on ? "0 1px 4px rgba(0,0,0,0.3)" : "none",
                    transition: "background .18s, color .18s" }}>
                  {label}
                  {n ? (
                    <span style={{ fontSize: "var(--text-caption2)", fontWeight: 600,
                      color: on ? GOLD : "rgba(255,255,255,0.4)", fontVariantNumeric: "tabular-nums" }}>
                      {n}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══ ПАНЕЛЬ — весь остаток высоты. Пустой плеши быть не может. ═══ */}
        <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div ref={bodyRef} onScroll={(e) => setCollapsed((e.currentTarget as HTMLDivElement).scrollTop > 40)}
          style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain",
            WebkitOverflowScrolling: "touch", padding: "0 16px 12px" }}>
          {pane === "mine" ? (
            /* ═══ МОЁ — то, что человек отложил себе. ═══
               Пустой экран — не тупик, а приглашение: он говорит, ЧТО сделать. */
            favTracks.length === 0 ? (
              <div style={{ minHeight: "100%", display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", gap: 10, padding: "0 24px", textAlign: "center" }}>
                <span style={{ color: "rgba(255,255,255,0.22)" }}><HeartIcon size={34} /></span>
                <span style={{ fontSize: "var(--text-subhead)", fontWeight: 600, color: "rgba(255,255,255,0.75)" }}>
                  Здесь пока пусто
                </span>
                <span style={{ fontSize: "var(--text-footnote)", lineHeight: 1.5, color: "rgba(255,255,255,0.45)" }}>
                  Отметьте запись сердцем — она ляжет сюда, и вы вернётесь к ней одним касанием.
                </span>
              </div>
            ) : (
              <div style={{ paddingTop: 4 }}>
                <div style={{ fontSize: "var(--text-caption2)", fontWeight: 600, letterSpacing: "0.4px",
                  textTransform: "uppercase", color: GOLD, padding: "0 4px 8px" }}>
                  Новые сверху
                </div>
                {favTracks.map((tr) => {
                  const i = p.tracks.indexOf(tr);
                  return (
                    <QueueRow key={tr.file} t={tr} active={i === p.index}
                      fav seal onFav={() => toggleTrackFav(tr)} onClick={() => p.jumpTo(i)} />
                  );
                })}
              </div>
            )
          ) : pane === "now" ? (
            <div style={{ minHeight: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          {isAdHoc
            ? <KirtanHero cover={p.cover}
                /* ⚠️ Я СРЕЗАЛ ИМЯ ИЗ НАЗВАНИЯ — И ЭТО БЫЛО НЕ МОЁ ДЕЛО.
                 *
                 * Названия писал основатель: своей рукой, в документе, с именем.
                 * Данные — его. Показ — мой. Срезая имя «чтобы не повторялось», я
                 * подменил его работу своим вкусом.
                 *
                 * Повтор снимается ИНАЧЕ: имя убрано из СЛУЖЕБНОЙ строки под
                 * заголовком, а не из названия. Служебная строка — моя, название — нет. */
                title={p.track?.title || p.bookTitle}
                artist={p.artist}
                meta={curGroupLabel
                  ? `Записи исполнителя · ${curGroupPos} из ${curGroupTotal}`
                  : (p.tracks.length > 1 ? `${p.bookTitle} · ${p.index + 1} из ${p.tracks.length}` : p.bookTitle)}
                onMeta={curGroupId ? () => { setActiveDiv(curGroupId); setPane("queue"); } : undefined}
                note={albumById(p.book)?.note} coverActions={coverActions}
                /* ЗКН-Н062 — ПОЛНЫЙ ЭКРАН СУЩЕСТВУЕТ РАДИ ОБЛОЖКИ.
                   Во встроенной коробке она делит место с очередью; во весь экран
                   она — главное, и берёт всё, что можно. */
                big={!embedded}
                /* Свайп по обложке — назад и вперёд. В полноэкранном плеере это
                   самый естественный жест: палец уже там, куда смотрят глаза. */
                onSwipe={(d) => (d === 1 ? p.next() : p.prev())}
                onDismiss={!embedded ? () => p.close() : undefined}
                maxCover={embedded && embeddedHeight
                  ? Math.max(120, Math.min(240, Math.round(embeddedHeight * 0.28)))
                  : undefined} />
            : <BookHeroCard book={BOOKS[p.book] ?? BOOKS.bg} presentational coverActions={coverActions} />}

          {/* ПАПКИ ЖИВУТ ВНУТРИ ПЛЕЕРА (решение основателя).
              Я вынес их отдельным блоком НАД плеером — это была не та задача:
              просили «систематизировать В ПЛЕЕРЕ по папкам». Папка меняет очередь
              плеера; орган управления очередью должен быть в самом плеере, а не
              рядом с ним. */}
          {belowHero}
            </div>
          ) : (
            <div>
            {/* Надзаголовок раздела — ЗОЛОТОЙ, как во всех витринах (ЗКН-Н024).
                Серый он выпадал из системы: тот же смысл, другой голос. */}
            {/* Счёт уже стоит в сегменте — второй раз его писать не нужно.
                Здесь живёт то, чего в сегменте нет: выбор папки и вид. */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, paddingTop: 4 }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                {multiCanto
                  ? <DivisionPicker items={cantoTabs} active={browseCanto} onChange={setBrowseCanto} label="Песни" />
                  : hierQueue
                  ? <DivisionPicker items={divisions} active={activeDiv} onChange={setActiveDiv}
                      label={isAdHoc ? "Исполнители" : "Разделы"} />
                  : <span style={{ fontSize: "var(--text-caption2)", fontWeight: 600, letterSpacing: "0.4px",
                      textTransform: "uppercase", color: GOLD }}>
                      {isAdHoc ? "Коллекция" : `Содержание${p.hasCommentary ? ` · ${p.mode === "commentary" ? "с комментариями" : "стих за стихом"}` : ""}`}
                    </span>}
              </span>
              {isAdHoc && (
                <span style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                  {(["list", "grid"] as const).map((v) => (
                    <button key={v} type="button" onClick={() => setQView(v)}
                      aria-label={v === "list" ? "Списком" : "Плиткой"} aria-pressed={qView === v}
                      style={{ display: "grid", placeItems: "center", width: TAP, height: TAP, borderRadius: 11,
                        border: "none", cursor: "pointer",
                        background: qView === v ? "rgba(255,255,255,0.12)" : "transparent",
                        color: qView === v ? GOLD : "rgba(255,255,255,0.45)" }}>
                      {v === "list"
                        ? <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden><rect x="3" y="5" width="18" height="2.4" rx="1.2" fill="currentColor" /><rect x="3" y="10.8" width="18" height="2.4" rx="1.2" fill="currentColor" /><rect x="3" y="16.6" width="18" height="2.4" rx="1.2" fill="currentColor" /></svg>
                        : <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden><rect x="3" y="3" width="8" height="8" rx="2" fill="currentColor" /><rect x="13" y="3" width="8" height="8" rx="2" fill="currentColor" /><rect x="3" y="13" width="8" height="8" rx="2" fill="currentColor" /><rect x="13" y="13" width="8" height="8" rx="2" fill="currentColor" /></svg>}
                    </button>
                  ))}
                </span>
              )}
            </div>
            {multiCanto && chapTabs.length > 1 && (
              <div style={{ marginBottom: 10 }}>
                <DivisionPicker items={chapTabs} active={activeCh} onChange={setActiveCh} label="Главы" />
              </div>
            )}
            <div style={{ paddingTop: (multiCanto || hierQueue) ? 10 : 0,
              ...(isAdHoc && qView === "grid"
                ? { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))", gap: 8 }
                : null) }}>
              {multiCanto
                ? (browseTracks.length
                    ? browseTracks.map((t) => {
                        if ((t.group ?? "") !== activeCh) return null;
                        return <QueueRow key={t.file} t={t} active={playingHere && p.track?.file === t.file}
                          onClick={() => p.playTrack(browseCanto, t.file)} />;
                      })
                    : <div style={{ padding: "18px 4px", color: "rgba(255,255,255,0.45)", fontSize: "var(--text-footnote)" }}>Загрузка…</div>)
                : (() => {
                    /* ⚠️ НУМЕРАЦИЯ ВНУТРИ ПАПКИ, А НЕ СКВОЗНАЯ.
                     * Открываешь папку Бхакти Вайбхавы — а она начиналась с «24».
                     * (У книги сквозной номер верен: там это номер главы.) */
                    const flat = isAdHoc && activeDiv === ALL_DIV && qView === "list";
                    let seq = 0;
                    let lastG = "";
                    const out: React.ReactNode[] = [];

                    p.tracks.forEach((t, i) => {
                      if (hierQueue && activeDiv !== ALL_DIV) {
                        const g = gid(t);
                        const show = g ? g === activeDiv : activeDiv === divisions[0]?.id;
                        if (!show) return;
                      }

                      /* ЗКН-Н048 — У ДЛИННОГО СПИСКА ЕСТЬ ЯКОРЯ.
                       * «Все» — это 1062 строки подряд. Без разделителей человек не
                       * знает, ГДЕ он, и не может выйти к исполнителю той записи, что
                       * видит. Липкий заголовок отвечает на оба вопроса: он говорит
                       * «ты здесь» и по тапу открывает папку этого исполнителя. */
                      if (flat) {
                        const g = gid(t) ?? "";
                        if (g && g !== lastG) {
                          lastG = g;
                          const lbl = t.groupLabel ?? g;
                          const n = p.tracks.filter((x) => (gid(x) ?? "") === g).length;
                          out.push(
                            <button key={`h-${g}`} type="button" onClick={() => setActiveDiv(g)}
                              style={{ position: "sticky", top: 0, zIndex: 2, display: "flex", alignItems: "center",
                                gap: 8, width: "100%", padding: "7px 8px", marginTop: out.length ? 10 : 0,
                                border: "none", cursor: "pointer", textAlign: "left",
                                background: "rgba(14,14,16,0.92)", backdropFilter: "blur(14px)",
                                WebkitBackdropFilter: "blur(14px)", fontFamily: "var(--font-text)" }}>
                              <span style={{ flex: 1, minWidth: 0, fontSize: "var(--text-caption2)", fontWeight: 700,
                                letterSpacing: "0.4px", textTransform: "uppercase", color: GOLD,
                                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lbl}</span>
                              <span style={{ flexShrink: 0, fontSize: "var(--text-caption2)", color: "rgba(255,255,255,0.35)",
                                fontVariantNumeric: "tabular-nums" }}>{n}</span>
                              <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden style={{ flexShrink: 0, color: "rgba(255,255,255,0.35)" }}>
                                <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>,
                          );
                          seq = 0;
                        }
                      }

                      seq += 1;
                      out.push(
                        <QueueRow key={t.file} t={t} active={i === p.index}
                          num={isAdHoc ? seq : undefined} tile={isAdHoc && qView === "grid"}
                          /* Имя голоса срезаем ВЕЗДЕ, где оно уже сказано рядом:
                             в папке — на кнопке голоса, в «Все» — в липком заголовке
                             над строками. Не срезаем только там, где сказать больше
                             негде: в «Моё» и в найденном — там записи из разных
                             голосов вперемешку, и без имени строка немая. */
                          /* Название показываем ЦЕЛИКОМ — так, как его написал основатель. */
                          fav={isAdHoc ? favSet.has(trackKey(t)) : undefined}
                          seal={isAdHoc && qView === "list"}
                          onFav={isAdHoc && qView === "list" ? () => toggleTrackFav(t) : undefined}
                          onClick={() => p.jumpTo(i)} />,
                      );
                    });
                    return out;
                  })()}
            </div>
            </div>
          )}
        </div>


        {/* ⚠️ «К ТЕКУЩЕЙ» ЛОЖИЛАСЬ НА ПЕРЕМОТКУ.
         * Кнопка отсчитывалась от ДНА КОРОБКИ — а коробка на телефоне короткая, и
         * 148 точек от дна приходились ровно на ползунок. Кнопка должна плавать над
         * СПИСКОМ, а не над транспортом: она принадлежит панели, а не плееру.
         * Отсчёт — от дна ПАНЕЛИ (`paneRef`), у которой своё дно. */}
        {p.active && lostTrack && pane === "queue" && (
          <button type="button" onClick={backToPlaying}
            style={{ position: "absolute", left: "50%", transform: "translateX(-50%)",
              bottom: 10, zIndex: 10,
              display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 999,
              border: "none", cursor: "pointer", whiteSpace: "nowrap",
              background: GOLD, color: INK_ON_GOLD, fontFamily: "var(--font-text)",
              fontSize: "var(--text-footnote)", fontWeight: 700,
              boxShadow: "0 8px 24px -6px rgba(210,170,27,0.5)" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden>
              <path d="M12 5v14M6 13l6 6 6-6" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            К текущей
          </button>
        )}
        </div>

        {/* ═══ ТАЙМЕР СНА — лист выбора ═══ */}
        {sleepOpen && (
          <div role="dialog" aria-label="Таймер сна"
            onClick={(e) => { e.stopPropagation(); setSleepOpen(false); }}
            style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "flex-end",
              background: "rgba(0,0,0,0.6)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}>
            <div onClick={(e) => e.stopPropagation()}
              style={{ width: "100%", padding: "14px 14px calc(env(safe-area-inset-bottom) + 18px)",
                borderTopLeftRadius: 20, borderTopRightRadius: 20,
                background: "rgba(22,22,25,0.98)", border: "0.5px solid rgba(255,255,255,0.10)" }}>
              <div style={{ fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.4px",
                textTransform: "uppercase", color: GOLD, marginBottom: 4 }}>Таймер сна</div>
              <div style={{ fontSize: "var(--text-footnote)", color: "rgba(255,255,255,0.5)", marginBottom: 12,
                lineHeight: 1.45 }}>
                Святое имя доиграет и стихнет само — просыпаться, чтобы выключить, не придётся.
              </div>
              {([["track", "После этой записи"], [15, "Через 15 минут"], [30, "Через 30 минут"],
                 [60, "Через час"], [null, "Выключить таймер"]] as const).map(([v, label]) => {
                const on = v === "track" ? p.sleepEnd
                  : v === null ? !sleepOn
                  : p.sleepAt != null && Math.abs((p.sleepAt - Date.now()) / 60_000 - (v as number)) < 1.2;
                return (
                  <button key={String(v)} type="button"
                    onClick={() => { p.setSleep(v as number | "track" | null); setSleepOpen(false); }}
                    style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px 10px",
                      borderRadius: 12, border: "none", cursor: "pointer", textAlign: "left",
                      background: on ? "rgba(210,170,27,0.16)" : "transparent",
                      color: on ? GOLD : "rgba(255,255,255,0.9)",
                      fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: on ? 700 : 400 }}>
                    <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
                    {on && (
                      <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden>
                        <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ ШОВ УБРАН ═══
         * Панель имела СВОЙ фон (`rgba(16,16,18,.62)` + сильное размытие) и стояла
         * всегда — экран визуально разрезало пополам: «обложка» и «отдельная
         * коробка с кнопками». Теперь поверхность ОДНА: стекло ПРОЯВЛЯЕТСЯ, только
         * когда шапка ушла под прокрутку (обычай Apple — панель материализуется),
         * и волосок-разделитель появляется вместе с ним. */}
        <div style={{ flexShrink: 0,
          padding: embedded ? "10px 18px 14px" : "12px 20px calc(env(safe-area-inset-bottom) + 12px)",
          borderTop: collapsed ? "0.5px solid rgba(255,255,255,0.10)" : "0.5px solid transparent",
          background: collapsed ? "rgba(16,16,18,0.62)" : "transparent",
          backdropFilter: collapsed ? "blur(30px) saturate(160%)" : "none",
          WebkitBackdropFilter: collapsed ? "blur(30px) saturate(160%)" : "none",
          transition: "background .28s ease, border-color .28s ease" }}>
          {/* ⚠️ НАЗВАНИЕ ПЕЧАТАЛОСЬ ДВАЖДЫ.
              Шапка плеера показывает дорожку — и эта панель показывала ЕЁ ЖЕ,
              прямо под ней. Условие было перевёрнуто: блок скрывался, когда шапка
              УХОДИЛА под прокрутку, — то есть ровно тогда, когда он и нужен.
              Теперь наоборот: пока шапка видна, панель молчит; уехала — панель
              подхватывает. Одно имя на экране, всегда. */}
          <div style={{ minWidth: 0, maxHeight: collapsed ? 56 : 0, opacity: collapsed ? 1 : 0, overflow: "hidden", transition: "max-height .28s ease, opacity .18s ease" }}>
            <div style={{ fontSize: "var(--text-body)", fontWeight: 700, letterSpacing: "-0.01em", color: ON_DARK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.track?.title}</div>
            <div style={{ fontSize: "var(--text-footnote)", color: "rgba(255,255,255,0.6)", marginTop: 1 }}>{sub}{p.loading ? " · загрузка…" : ""}</div>
          </div>
          <div style={{ marginTop: 8 }}>
            <input type="range" aria-label="Перемотка" min={0} max={Math.max(1, Math.floor(p.duration))} step={1}
              value={Math.floor(p.currentTime)} onChange={(e) => p.seek(Number(e.target.value))}
              /* Полоса была 16 точек — пальцем в неё не попасть. Дорожка остаётся
                 тонкой (её рисует сам браузер), а ЗОНА ЗАХВАТА растёт до 44. */
              style={{ width: "100%", accentColor: GOLD, height: TAP, cursor: "pointer",
                touchAction: "none", margin: 0, display: "block" }} />
            {/* Тап по времени — «сколько осталось» ↔ «сколько всего».
                На записи в 116 минут это разные вопросы, и оба нужны. Один и тот же
                уголок отвечает на оба — лишней кнопки не заводим. */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
              fontSize: "var(--text-caption)", color: "rgba(255,255,255,0.6)",
              fontVariantNumeric: "tabular-nums", marginTop: -2 }}>
              <span>{fmtTime(p.currentTime)}</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); setShowTotal((v) => !v); }}
                aria-label={showTotal ? "Показать, сколько осталось" : "Показать полную длительность"}
                style={{ border: "none", background: "none", cursor: "pointer", padding: "8px 0 8px 14px",
                  color: "inherit", font: "inherit", fontVariantNumeric: "tabular-nums" }}>
                {showTotal ? fmtTime(p.duration) : `−${fmtTime(remaining)}`}
              </button>
            </div>
          </div>
          <div style={{ marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
            <button type="button" aria-label="Предыдущая глава" onClick={() => p.prev()} style={iconBtn(44)}><PrevIcon size={27} /></button>
            <button type="button" aria-label="Назад 15 секунд" onClick={() => p.skip(-15)} style={iconBtn(44)}><Back15Icon size={30} /></button>
            <button type="button" aria-label={p.isPlaying ? "Пауза" : "Играть"} onClick={() => p.togglePlay()}
              style={{ display: "grid", placeItems: "center", height: 64, width: 64, borderRadius: 999, border: "none",
                background: GOLD, color: INK_ON_GOLD, cursor: "pointer",
                boxShadow: "0 10px 26px -6px rgba(210,170,27,0.45)" }}>
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
                aria-label={
                  p.repeat === "one" ? "Повтор записи"
                  : p.repeat === "group" ? "Повтор голоса"
                  : p.repeat === "library" ? (isAdHoc ? "Повтор всего" : "Повтор библиотеки")
                  : p.repeat === "book" ? "Повтор книги" : "Повтор"}
                onClick={() => { p.cycleRepeat(); }}
                style={{ ...bareBtn(34), color: p.repeat === "off" ? "rgba(255,255,255,0.55)" : GOLD }}>
                {p.repeat === "one" ? <RepeatOneIcon size={22} />
                  : p.repeat === "group" ? <RepeatVoiceIcon size={22} />
                  : p.repeat === "library" ? <RepeatLibraryIcon size={22} />
                  : <RepeatIcon size={22} />}
              </button>

              {/* ЗКН-Н054 — ТАЙМЕР СНА. Киртан слушают, засыпая; плеер без таймера
                  заставляет ПРОСЫПАТЬСЯ, чтобы его выключить. */}
              {isAdHoc && (
                <button type="button" aria-label="Таймер сна" aria-pressed={sleepOn}
                  onClick={(e) => { e.stopPropagation(); setSleepOpen(true); }}
                  style={{ ...bareBtn(34), color: sleepOn ? GOLD : "rgba(255,255,255,0.55)",
                    display: "flex", alignItems: "center", gap: 4, width: "auto", paddingInline: 2 }}>
                  <MoonIcon size={19} />
                  {sleepLeft && <span style={{ fontSize: "var(--text-caption2)", fontWeight: 700,
                    fontVariantNumeric: "tabular-nums" }}>{sleepLeft}</span>}
                </button>
              )}
              <button type="button" aria-label="Скорость" aria-pressed={p.rate !== 1} onClick={() => p.cycleRate()}
                style={{ background: "none", border: "none", padding: "0 4px", height: 34, cursor: "pointer", flexShrink: 0, fontSize: "var(--text-subhead)", fontWeight: 600, letterSpacing: "-0.01em", fontFamily: "var(--font-text)", color: p.rate !== 1 ? GOLD : "rgba(255,255,255,0.55)" }}>{p.rate}×</button>
            </div>
            {p.hasCommentary && <button type="button" aria-pressed={p.mode === "commentary"} onClick={() => p.setMode(p.mode === "commentary" ? "plain" : "commentary")}
              style={{ background: "none", border: "none", padding: "0 4px", height: 34, cursor: "pointer", whiteSpace: "nowrap", fontSize: "var(--text-subhead)", fontWeight: 600, letterSpacing: "-0.01em", fontFamily: "var(--font-text)", transition: "color .2s", color: p.mode === "commentary" ? GOLD : "rgba(255,255,255,0.72)" }}>
              С комментариями
            </button>}
          </div>
        </div>
      </div>

      {toast && (
        <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: "calc(env(safe-area-inset-bottom) + 234px)", zIndex: 6, ...glass(999), padding: "10px 18px", color: ON_DARK, fontSize: "var(--text-subhead)", fontWeight: 500, whiteSpace: "nowrap", boxShadow: "0 10px 36px rgba(0,0,0,0.45)" }}>{toast}</div>
      )}
      {qr && <QrSheet url={qr.url} data={qr.data} onClose={() => setQr(null)} />}
      <ReportSheet open={reportOpen} onClose={() => setReportOpen(false)} context={`Аудио · ${sub}${p.track?.title ? ` · «${p.track.title}»` : ""}`} />
      <BookMenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} onSelect={onMenuSelect} withNote variant={isAdHoc ? "kirtan" : "player"} isChapter={isChapter} anchorRef={moreRef} />
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
/* ═══════════════════════════════════════════════════════════════════════════
 * ЗКН-Н047 · ОРГАН ВЫБОРА СЛЕДУЕТ ЗА ЧИСЛОМ РАЗДЕЛОВ.
 *
 * Лента пилюль верна, пока разделов мало: три лилы Чайтанья-чаритамриты, двенадцать
 * песней Бхагаватам — глазом охватываешь целиком. На 82 исполнителях она перестаёт
 * быть навигацией: чтобы от «Шрила Прабхупада» доехать до «Ямуна Деви Даси», нужно
 * восемьдесят свайпов вслепую. То же и у Бхагаватам: в песни до 90 глав.
 *
 * Механизм разделов при этом ПРАВИЛЬНЫЙ — меняется только орган выбора:
 *
 *   ≤ 14 разделов  →  пилюли (видно всё сразу)
 *   > 14 разделов  →  кнопка текущего раздела + ЛИСТ: поиск, азбука, список
 *
 * Порог не выдуман: 14 пилюль — это примерно два экрана прокрутки, дальше человек
 * уже не помнит, что было слева.
 * ═══════════════════════════════════════════════════════════════════════════ */
const PILL_LIMIT = 14;

/** Закреплены сверху по решению основателя — вне алфавита. */
const PINNED = new Set(["Шрила Прабхупада"]);

function DivisionPicker({ items, active, onChange, label }: {
  items: DivDef[]; active: string; onChange: (id: string) => void; label: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  if (items.length <= PILL_LIMIT) {
    return <DivisionPills items={items} active={active} onChange={onChange} />;
  }

  const cur = items.find((i) => i.id === active) ?? items[0];
  const nq = q.trim().toLowerCase();
  const shown = nq ? items.filter((i) => i.label.toLowerCase().includes(nq)) : items;

  /* ⚠️ АЗБУКА ШЛА В ПОРЯДКЕ СПИСКА, А НЕ ПО АЛФАВИТУ.
   *
   * Получалось «В Ш А Б Г Д…»: «Все» дало В, «Шрила Прабхупада» — Ш, и они встали
   * ВПЕРЕДИ алфавита. Азбука, идущая не по алфавиту, — не указатель, а насмешка.
   *
   * Закреплённые сверху («Все», Шрила Прабхупада — решение основателя) в азбуку не
   * входят: они и так всегда на виду, а в указателе только путали бы. Азбука ведёт
   * по АЛФАВИТНОЙ части списка. */
  const letters: string[] = [];
  const firstOf: Record<string, string> = {};
  const alphaOnly = shown.filter((i) => i.id !== ALL_DIV && !PINNED.has(i.label));
  for (const i of alphaOnly) {
    const L = (i.label[0] || "").toUpperCase();
    if (!L || firstOf[L]) continue;
    firstOf[L] = i.id;
    letters.push(L);
  }
  letters.sort((a, b) => a.localeCompare(b, "ru"));

  return (
    <>
      <button type="button" onClick={() => { setOpen(true); setQ(""); }}
        style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 12px",
          borderRadius: 12, cursor: "pointer", textAlign: "left", fontFamily: "var(--font-text)",
          background: "rgba(255,255,255,0.07)", border: "0.5px solid rgba(255,255,255,0.12)", color: ON_DARK }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: "var(--text-subhead)", fontWeight: 600,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cur?.label ?? label}</span>
        {/* ⚠️ ЧИСЛА ЗДЕСЬ НЕТ — И НЕ ДОЛЖНО БЫТЬ.
         *
         * Сперва тут стояло `items.length` — число ГОЛОСОВ. Выходило «Все · 83»:
         * человек читает «83 записи», а 83 — это сколько всего голосов. Число,
         * поставленное не туда, хуже отсутствующего: оно не молчит, оно ВРЁТ.
         *
         * Потом я поставил число записей выбранного голоса — но тогда на экране
         * стало ДВА ОДИНАКОВЫХ числа: «Записи · 1062» в сегменте и «Все · 1062»
         * здесь. Повтор — это шум, а шум в цифрах читается как ошибка.
         *
         * ОДНО ЧИСЛО НА ЭКРАН, И ОНО ЗНАЧИТ ОДНО. Сколько записей — говорит сегмент.
         * Кнопка говорит ЧЕЙ голос. Сколько всего голосов — говорит лист выбора. */}
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden style={{ flexShrink: 0, color: GOLD }}>
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && createPortal(
        /* ⚠️ `position: fixed` ЗДЕСЬ НЕ РАБОТАЕТ — И ЭТО НЕ ОШИБКА CSS.
         *
         * Лист живёт внутри панели прокрутки с `-webkit-overflow-scrolling: touch`.
         * В Safari на iOS `fixed` внутри такого контейнера ведёт себя как `absolute`:
         * его прижимает к СКРОЛЛЕРУ, а не к окну. Лист оказывался заперт в коробке
         * плеера — ровно то, что и было на снимке.
         *
         * Со Safari спорить нечем. Единственный надёжный ход — ПОРТАЛ: рисуем лист
         * прямо в `body`, вне этой ветки дерева. Тогда он принадлежит окну по факту,
         * а не по объявлению. */
        <div role="dialog" aria-label={label}
          style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", flexDirection: "column",
            background: "rgba(10,10,12,0.97)", backdropFilter: "blur(30px) saturate(160%)",
            WebkitBackdropFilter: "blur(30px) saturate(160%)",
            paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div style={{ flexShrink: 0, padding: "14px 16px 0", fontSize: "var(--text-caption2)",
            fontWeight: 700, letterSpacing: "0.4px", textTransform: "uppercase", color: GOLD }}>
            {label} · {Math.max(0, items.length - 1)}
          </div>
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px 8px" }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus
              placeholder={`Найти в ${label.toLowerCase()}`} aria-label={`Поиск: ${label}`}
              style={{ flex: 1, minWidth: 0, height: 38, padding: "0 12px", borderRadius: 11,
                border: "0.5px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.07)",
                color: ON_DARK, fontSize: "var(--text-subhead)", fontFamily: "var(--font-text)", outline: "none" }} />
            <button type="button" aria-label="Закрыть" onClick={() => setOpen(false)}
              style={{ ...glass(999), ...iconBtn(38), flexShrink: 0 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" /></svg>
            </button>
          </div>

          <div style={{ flexShrink: 0, padding: "0 16px 8px", fontSize: "var(--text-caption2)", fontWeight: 600,
            letterSpacing: "0.4px", textTransform: "uppercase", color: GOLD }}>
            {label} · {items.length}
          </div>

          {letters.length > 1 && (
            /* Азбука ПЕРЕНОСИТСЯ, а не обрезается: буква, уехавшая за край, — не указатель. */
            <div style={{ flexShrink: 0, display: "flex", flexWrap: "wrap", gap: 4, padding: "0 14px 10px" }}>
              {letters.map((L) => (
                <button key={L} type="button"
                  onClick={() => document.getElementById(`div-${firstOf[L]}`)?.scrollIntoView({ block: "start", behavior: "smooth" })}
                  style={{ flexShrink: 0, minWidth: TAP, height: TAP, borderRadius: 10, border: "none", cursor: "pointer",
                    background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.7)",
                    fontSize: "var(--text-caption)", fontWeight: 700, fontFamily: "var(--font-text)" }}>{L}</button>
              ))}
            </div>
          )}

          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", padding: "0 10px 14px" }}>
            {shown.length === 0 ? (
              <div style={{ padding: "28px 8px", textAlign: "center", color: "rgba(255,255,255,0.45)",
                fontSize: "var(--text-subhead)" }}>Ничего не найдено</div>
            ) : shown.map((it, k) => {
              const on = it.id === active;
              const pinned = it.id === ALL_DIV || PINNED.has(it.label);
              const nextIsAlpha = !pinned ? false
                : !(shown[k + 1] && (shown[k + 1].id === ALL_DIV || PINNED.has(shown[k + 1].label)));
              return (
                <div key={it.id} style={nextIsAlpha
                  ? { borderBottom: "0.5px solid rgba(255,255,255,0.10)", marginBottom: 6, paddingBottom: 6 }
                  : undefined}>
                <button id={`div-${it.id}`} type="button"
                  onClick={() => { onChange(it.id); setOpen(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 10px",
                    borderRadius: 11, border: "none", cursor: "pointer", textAlign: "left",
                    background: on ? "rgba(210,170,27,0.16)" : "transparent", color: ON_DARK,
                    fontFamily: "var(--font-text)" }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: "var(--text-subhead)", fontWeight: on ? 700 : 400,
                    color: on ? GOLD : "rgba(255,255,255,0.9)",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.label}</span>
                  {it.count != null && (
                    <span style={{ flexShrink: 0, fontSize: "var(--text-caption)", color: "rgba(255,255,255,0.4)",
                      fontVariantNumeric: "tabular-nums" }}>{it.count}</span>
                  )}
                </button>
                </div>
              );
            })}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

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
              color: on ? ON_DARK : "rgba(255,255,255,0.6)",
              fontSize: "var(--text-footnote)", fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1, whiteSpace: "nowrap",
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
function KirtanHero({ cover, title, artist, meta, note, coverActions, maxCover, big, onMeta, onSwipe, onDismiss }: { cover: string; title: string; artist: string; meta?: string; note?: string | null; coverActions?: React.ReactNode; maxCover?: number; big?: boolean; onMeta?: () => void; onSwipe?: (dir: 1 | -1) => void; onDismiss?: () => void }) {
  /* ⚠️ ОБЛОЖКА СХЛОПЫВАЛАСЬ В НОГОТЬ НА ПОЛНОМ ЭКРАНЕ.
   *
   * Контейнер был `grid` + `placeItems:center`, а у обложки `width:100%`. В
   * центрированной сетке столбец меряется ПО СОДЕРЖИМОМУ — и `100%` разрешается в
   * натуральный размер картинки, то есть в ничто. Во встроенной коробке это было
   * незаметно, во весь экран — вылезло.
   *
   * И главное: ПОЛНЫЙ ЭКРАН СУЩЕСТВУЕТ РАДИ ОБЛОЖКИ. Раздувать компоновку тесной
   * коробки на весь экран — значит не дать ему смысла. Здесь у обложки СВОЙ размер:
   * она берёт всё, что можно, и остаётся квадратом. */
  const w = big ? "min(78vw, 42vh, 400px)" : `${Math.max(112, maxCover ?? 240)}px`;

  /* ═══ ЖЕСТЫ ПО ОБЛОЖКЕ ═══
   *
   * Вбок — предыдущая и следующая запись. Вниз — свернуть.
   *
   * Это не украшение: в полноэкранном плеере палец УЖЕ на обложке — там, куда
   * смотрят глаза. Рука ждёт этих движений и без подсказки. Плеер, где закрывать
   * надо крестиком в углу, а листать — кнопками внизу, заставляет палец ездить по
   * экрану вместо того, чтобы слушать.
   *
   * Направление решается по БОЛЬШЕЙ составляющей: жест редко бывает чистым, и
   * гадать по одной оси — значит срабатывать не на то. */
  const sp = useRef<{ x: number; y: number } | null>(null);
  const onDown = (e: React.PointerEvent) => { if (onSwipe || onDismiss) sp.current = { x: e.clientX, y: e.clientY }; };
  const onUp = (e: React.PointerEvent) => {
    if (!sp.current) return;
    const dx = e.clientX - sp.current.x;
    const dy = e.clientY - sp.current.y;
    sp.current = null;
    if (Math.abs(dy) > Math.abs(dx)) {
      if (onDismiss && dy > 70) onDismiss();          // вниз — свернуть
    } else if (onSwipe && Math.abs(dx) > 56) {
      onSwipe(dx < 0 ? 1 : -1);                        // вбок — записи
    }
  };

  return (
    <div style={{ paddingTop: 2 }}>
      {/* ═══ СИГНАТУРА: ЗНАК ОСВЕЩАЕТ ПОВЕРХНОСТЬ ═══
       * Обложка здесь — фирменный знак, золото на белом, а не альбомная фотография.
       * Кадрировать и затемнять её нельзя. Поэтому обратный ход: она ОСВЕЩАЕТ фон.
       * Правдиво для предмета: арати — свет, поднесённый Божеству. */}
      <div style={{ position: "relative", width: w, maxWidth: "100%", margin: "0 auto",
        paddingBottom: big ? 22 : 14 }}>
        <div aria-hidden style={{
          position: "absolute", inset: "-28% -32% -14%", borderRadius: "50%", pointerEvents: "none",
          background: "radial-gradient(closest-side, rgba(210,170,27,0.26), rgba(210,170,27,0.07) 56%, rgba(210,170,27,0) 78%)",
          filter: "blur(16px)",
        }} />
        <div onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => { sp.current = null; }}
          style={{
            position: "relative", width: "100%", aspectRatio: "1 / 1",
            borderRadius: big ? 26 : 22, overflow: "hidden", background: ON_DARK,
            touchAction: (onSwipe || onDismiss) ? "none" : undefined,
            cursor: (onSwipe || onDismiss) ? "grab" : undefined,
            boxShadow: "0 30px 60px -18px rgba(0,0,0,0.8), 0 2px 12px rgba(0,0,0,0.4)",
          }}>
          <img src={cover} alt="" draggable={false}
            style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} />
        </div>
      </div>

      {/* ГЕРОЙ СТРОКИ — ЗАПИСЬ. Название — то, что написал основатель, целиком.
          Действия ведут строку справа: они привязаны к заголовку, а не висят под ним. */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: big ? 6 : 2 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontFamily: "var(--font-display)",
            fontSize: big ? "var(--text-title2)" : "var(--text-title3)", fontWeight: 800,
            letterSpacing: "-0.01em", color: ON_DARK, lineHeight: 1.25,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>{title}</div>

          {/* Служебная строка — МОЯ, не основателя: имя голоса здесь не повторяем
              (ЗКН-Н060). Она ведёт к записям этого голоса. */}
          {meta && onMeta ? (
            <button type="button" onClick={onMeta}
              style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 4, padding: 0, border: "none",
                background: "none", cursor: "pointer", maxWidth: "100%", fontFamily: "var(--font-text)" }}>
              <span style={{ minWidth: 0, fontSize: "var(--text-footnote)", fontWeight: 600, color: GOLD,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{meta}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden style={{ flexShrink: 0, color: GOLD }}>
                <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : artist ? (
            <div style={{ marginTop: 3, fontSize: "var(--text-subhead)", fontWeight: 600, color: GOLD,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{artist}</div>
          ) : null}
        </div>
        {coverActions && <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>{coverActions}</div>}
      </div>

      {note && <div style={{ marginTop: 10, fontSize: "var(--text-footnote)", lineHeight: 1.45, color: "rgba(255,255,255,0.5)" }}>{note}</div>}
    </div>
  );
}

function Seal({ size, playing }: { size: number; playing?: boolean }) {
  if (playing) {
    return (
      <span aria-hidden style={{ display: "grid", placeItems: "center", width: size, height: size,
        flexShrink: 0, borderRadius: Math.round(size * 0.27), background: "rgba(210,170,27,0.16)",
        border: "0.5px solid rgba(210,170,27,0.35)" }}>
        <span style={{ display: "flex", alignItems: "flex-end", gap: 2, height: Math.round(size * 0.42) }}>
          {[0, 1, 2].map((i) => (
            <span key={i} className="iol-eq-bar"
              style={{ width: 2.5, height: "100%", borderRadius: 2, background: GOLD,
                transformOrigin: "bottom",
                animation: `iol-eq ${0.72 + i * 0.16}s ease-in-out ${i * 0.11}s infinite` }} />
          ))}
        </span>
      </span>
    );
  }
  return (
    <img src={COVER_FALLBACK_DARK} alt="" loading="lazy" aria-hidden
      style={{ width: size, height: size, flexShrink: 0, borderRadius: Math.round(size * 0.27),
        objectFit: "cover", background: "rgba(255,255,255,0.05)",
        border: "0.5px solid rgba(255,255,255,0.08)" }} />
  );
}

function QueueRow({ t, active, num, tile, strip, fav, seal, onFav, onClick }: { t: Track; active: boolean; num?: number; tile?: boolean; strip?: string; fav?: boolean; seal?: boolean; onFav?: () => void; onClick: () => void }) {
  const label = t.kind === "intro" ? "•" : t.chapter != null ? String(t.chapter) : (num != null ? String(num) : "•");


  if (tile) {
    return (
      <button type="button" onClick={onClick} data-active={active ? "1" : undefined}
        style={{ display: "flex", flexDirection: "column", gap: 6, padding: 8, borderRadius: 13, border: "none",
          cursor: "pointer", textAlign: "left",
          background: active ? "rgba(210,170,27,0.16)" : "rgba(255,255,255,0.06)",
          color: ON_DARK, fontFamily: "var(--font-text)" }}>
        <span style={{ position: "relative", display: "block" }}>
          <img src={COVER_FALLBACK} alt="" loading="lazy"
            style={{ width: "100%", aspectRatio: "1 / 1", borderRadius: 9, objectFit: "cover", background: ON_DARK }} />
          <span aria-hidden style={{ position: "absolute", left: 5, top: 5, minWidth: 18, height: 18, padding: "0 5px",
            borderRadius: 999, display: "grid", placeItems: "center", background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
            fontSize: "var(--text-caption2)", fontWeight: 700, color: active ? GOLD : ON_DARK,
            fontVariantNumeric: "tabular-nums" }}>{label}</span>
        </span>
        <span style={{ fontSize: "var(--text-caption)", fontWeight: active ? 700 : 500, lineHeight: 1.25,
          color: active ? GOLD : "rgba(255,255,255,0.9)",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{t.title}</span>
        {t.durationSec ? <span style={{ fontSize: "var(--text-caption2)", color: "rgba(255,255,255,0.4)", fontVariantNumeric: "tabular-nums" }}>{fmtTime(t.durationSec)}</span> : null}
      </button>
    );
  }

  return (
    <button type="button" onClick={onClick} data-active={active ? "1" : undefined}
      style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", padding: "8px 8px", borderRadius: 12, border: "none", cursor: "pointer",
        background: active ? "rgba(210,170,27,0.10)" : "transparent", color: ON_DARK }}>
      {seal ? <Seal size={38} playing={active} /> : (
        <span style={{ width: 22, textAlign: "center", flexShrink: 0, fontSize: "var(--text-footnote)", fontWeight: 600, color: active ? GOLD : "rgba(255,255,255,0.45)", fontVariantNumeric: "tabular-nums" }}>{label}</span>
      )}
      <span style={{ flex: 1, minWidth: 0, fontSize: "var(--text-subhead)", fontWeight: active ? 600 : 400, color: active ? ON_DARK : "rgba(255,255,255,0.85)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</span>
      {t.durationSec ? <span style={{ flexShrink: 0, fontSize: "var(--text-caption)", color: "rgba(255,255,255,0.4)", fontVariantNumeric: "tabular-nums" }}>{fmtTime(t.durationSec)}</span> : null}
      {onFav && (
        <span role="button" tabIndex={0} aria-label={fav ? "Убрать из «Моё»" : "В «Моё»"} aria-pressed={fav}
          onClick={(e) => { e.stopPropagation(); onFav(); }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onFav(); } }}
          style={{ display: "grid", placeItems: "center", width: TAP, height: TAP, flexShrink: 0, borderRadius: 999,
            cursor: "pointer", color: fav ? HEART : "rgba(255,255,255,0.28)" }}>
          <HeartIcon size={15} filled={!!fav} />
        </span>
      )}
    </button>
  );
}

function iconBtn(size: number): CSSProperties {
  return { display: "grid", placeItems: "center", height: Math.max(size, TAP), width: Math.max(size, TAP), flexShrink: 0, borderRadius: "50%", border: "none", background: "transparent", color: ON_DARK, cursor: "pointer" };
}
