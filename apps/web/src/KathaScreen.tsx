/**
 * KathaScreen — витрина раздела «Катха».
 *
 * ЗКН-Н090 · ТРИ УРОВНЯ ВМЕСТО СВАЛКИ.
 *
 * Витрина — МЕДИАТЕКА (`AudioLibrary`): рассказчики → циклы → записи, у каждого
 * уровня своя очередь. Плеер делает только своё дело — играет; он живёт
 * капсулой снизу и разворачивается на весь экран. Здесь остаётся то, чего у
 * медиатеки нет: шапка раздела, поиск (ЗКН-Н044) и переход по ссылке из
 * отложенного (ЗКН-Н077).
 *
 * Ц12 · ЭКРАН БОЛЬШЕ НЕ ДЕРЖИТ ВСЕ ДОРОЖКИ.
 * На вход приезжает каталог — голоса и циклы со счётчиками; всё остальное
 * витрина просит у kathaHydrate ровно для открытого уровня:
 *   · вью цикла   → дорожки цикла;
 *   · вью голоса  → дорожки голоса;
 *   · «Записи»    → страницами, «Показать ещё»;
 *   · «Отложенное» и переход из закладки → точечно по хвосту audio, с местами
 *     в очередях, которые считает сервер (ROW_NUMBER) — полного списка, чтобы
 *     посчитать самим, у витрины больше нет.
 * Каждое вью собирает items ТОЛЬКО из своей области: позиции строк в ответе
 * сервера и есть индексы очереди, и подмешивать сюда чужие записи значит
 * сломать «дальше» (порядок один — канонический, KATHA_ORDER воркера).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { usePlayer } from "./player/store";
import { AudioLibrary, type LibDomain, type LibItem, type LibView } from "./player/AudioLibrary";
import {
  kathaSpeakers, kathaAlbums, kathaAlbumById, speakerBySlug,
  albumTracks, speakerTracks, allTracksLoaded, kathaAllTotal, trackByTail,
  KATHA_ALBUM, KATHA_ALL, KATHA_FIND, type KathaTrack,
} from "./katha";
import {
  useKatha, useKathaPendingTick, kathaPending,
  ensureAlbum, ensureSpeaker, ensureMoreAll, ensureTails,
} from "./kathaHydrate";
import { useFavorites } from "./cardActions";
import { api } from "./api";
import { pushUrl, replaceUrl, subscribeNav } from "./nav";
import { HubHeader, HubSearch, HubEmpty } from "./ui/HubHeader";

/** Адрес → уровень медиатеки. Уровень обязан быть в адресе: им делятся. */
function viewFromPath(path: string): LibView {
  const seg = path.split("?")[0].split("/").filter(Boolean);   // ["katha", ...]
  const a = seg[1] ?? "", b = seg[2] ?? "";
  if (a === "voices") return { name: "voices" };
  if (a === "voice" && b) return { name: "voice", slug: b };
  if (a === "cycles") return { name: "collections" };
  if (a === "cycle" && b) return { name: "collection", id: b };
  if (a === "tracks") return { name: "items" };
  if (a === "mine") return { name: "mine" };
  return { name: "home" };
}
function pathFromView(v: LibView): string {
  switch (v.name) {
    case "voices": return "/katha/voices";
    case "voice": return `/katha/voice/${v.slug}`;
    case "collections": return "/katha/cycles";
    case "collection": return `/katha/cycle/${v.id}`;
    case "items": return "/katha/tracks";
    case "mine": return "/katha/mine";
    default: return "/katha";
  }
}

export default function KathaScreen() {
  const p = usePlayer();
  const kv = useKatha();
  const pt = useKathaPendingTick();
  const favs = useFavorites();
  const speakers = useMemo(() => kathaSpeakers(), [kv]);
  const albums = useMemo(() => kathaAlbums(), [kv]);

  const [view, setView] = useState<LibView>(() =>
    viewFromPath(typeof window === "undefined" ? "/katha" : window.location.pathname));
  useEffect(() => subscribeNav((path) => setView(viewFromPath(path))), []);
  const goto = (v: LibView) => { setView(v); pushUrl(pathFromView(v)); };

  /* Счёт целого раздела теперь называет КАТАЛОГ (`n`/`secs` у циклов считает
     воркер) — дорожек, чтобы пересчитать самим, на входе больше нет. */
  const nAll = useMemo(() => albums.reduce((s, a) => s + (a.n ?? 0), 0), [albums]);
  const secAll = useMemo(() => albums.reduce((s, a) => s + (a.secs ?? 0), 0), [albums]);

  /* Пока рассказчик один, шапка называет его. Станет больше — называем ВЕДУЩИЙ
     голос и честно добавляем остальных, а не врём, будто раздел целиком его.

     ⚠️ ВЕДУЩИЙ — НЕ «ПЕРВЫЙ В СПИСКЕ». Порядок рассказчиков пишут РАЗНЫЕ конвейеры
     заливки, каждый со своим полем `sort`. Считаем по ЗАПИСЯМ: у кого их больше,
     тот и ведёт раздел. Это самоисправляется при любой новой заливке. */
  const lead = useMemo(() => {
    const byVoice = new Map<string, number>();
    for (const a of albums) byVoice.set(a.speaker, (byVoice.get(a.speaker) ?? 0) + (a.n ?? 0));
    let best = speakers[0];
    for (const sp of speakers) {
      if ((byVoice.get(sp.slug) ?? 0) > (byVoice.get(best?.slug ?? "") ?? 0)) best = sp;
    }
    return best;
  }, [speakers, albums]);
  const subtitle = speakers.length === 1
    ? `Бхагавата-катха · ${speakers[0].name}`
    : `Лекции, беседы и катха — ${lead?.name ?? "рассказчики традиции"} и рассказчики традиции`;

  /* ── ОБЛАСТИ ПО ТРЕБОВАНИЮ: открыл уровень — поехали его дорожки ── */
  useEffect(() => {
    if (view.name === "voice") void ensureSpeaker(view.slug);
    else if (view.name === "collection") void ensureAlbum(view.id);
    else if (view.name === "items" && allTracksLoaded().length === 0) void ensureMoreAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  /* Хвосты отложенных записей катхи — для счётчика на корне и вью «Отложенное». */
  const favTails = useMemo(
    () => favs.filter((f) => f.key.startsWith("katha:")).map((f) => f.key.slice(6).split("?")[0]),
    [favs]);
  useEffect(() => { if (favTails.length) void ensureTails(favTails); }, [favTails]);

  /* ЗКН-Н077: избранное ведёт к САМОЙ ЗАПИСИ (`/katha?t=<хвост audio>`), а не в
   * раздел. Точечный поиск возвращает запись С МЕСТОМ в очереди её ЦИКЛА — и
   * играть её правильно именно там: «дальше» продолжит тот же цикл, а не чужой
   * голос из общей свалки (ЗКН-Н090). Раньше ради одного прыжка грузилась ВСЯ
   * катха. Записи нет и на сервере — тихо остаёмся; параметр гасим, чтобы не
   * сработало дважды. */
  const deepDone = useRef(false);
  const [deepTarget, setDeepTarget] = useState<{ queue: string; idx: number } | null>(null);
  useEffect(() => {
    if (deepDone.current || typeof window === "undefined") return;
    const raw = new URLSearchParams(window.location.search).get("t");
    if (!raw) { deepDone.current = true; return; }
    const tail = decodeURIComponent(raw).split("?")[0];
    let dead = false;
    void ensureTails([tail]).then(() => {
      if (dead || deepDone.current) return;
      const tr = trackByTail(tail);
      if (!tr) {
        /* Каталог мог не доехать (сеть) — область осталась незагруженной,
           следующий рендер попробует снова. Доехал, а записи нет — остаёмся. */
        if (kathaAlbums().length > 0) { deepDone.current = true; replaceUrl("/katha"); }
        return;
      }
      setDeepTarget({ queue: KATHA_ALBUM + tr.album, idx: tr.ci });
    });
    return () => { dead = true; };
  }, [kv, pt]);
  useEffect(() => {
    if (deepDone.current || !deepTarget) return;
    if (p.kind === "katha" && p.book === deepTarget.queue) {
      if (p.tracks.length > deepTarget.idx) {
        deepDone.current = true;
        p.jumpTo(deepTarget.idx);
        replaceUrl("/katha");
      } else if (p.tracks.length > 0) {
        /* Очередь короче места записи — данные разъехались; вслепую не прыгаем. */
        deepDone.current = true;
        replaceUrl("/katha");
      }
      return;
    }
    p.loadKatha(deepTarget.queue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepTarget, p.kind, p.book, p.tracks.length]);

  const [q, setQ] = useState("");
  const [found, setFound] = useState<{ q: string; n: number } | null>(null);
  const submit = () => {
    const s = q.trim();
    if (s.length < 2) return;
    /* Сторож обязан судить по тем же полям, что и отбор (ЗКН-Н089) — теперь
     * буквально: счёт считает ТОТ ЖЕ WHERE на сервере (/katha/find/count).
     * Пересчитывать локально не из чего: полного списка у витрины нет.
     * Сеть упала — сторож деградирует ОТКРЫТО: включаем очередь, а не
     * запрещаем то, что сервер, возможно, умеет. */
    void (async () => {
      let n = -1;
      try {
        const r = await fetch(api(`/katha/find/count?q=${encodeURIComponent(s)}`), { credentials: "same-origin" });
        if (r.ok) n = Number(((await r.json()) as { n?: number }).n ?? 0);
      } catch { /* считаем неизвестным */ }
      if (n === 0) { setFound({ q: s, n: 0 }); return; }
      setFound({ q: s, n: Math.max(n, 1) });
      p.playKatha(KATHA_FIND + s, 0, true);
    })();
  };

  /* ═══ ДОМЕН КАТХИ ═══
     Медиатека одна на два раздела; различаются НАЗВАНИЯ уровней и то, что у
     катхи items — ЗАГРУЖЕННАЯ ОБЛАСТЬ ТЕКУЩЕГО ВЬЮ, а не весь каталог. */
  const domain = useMemo<LibDomain>(() => {
    const mk = (t: KathaTrack, gi: number, vi: number, ci: number): LibItem => ({
      key: `katha:${t.identifier}/${t.file}`,
      title: t.title,
      voiceSlug: t.speaker,
      voiceName: speakerBySlug(t.speaker)?.name ?? "",
      collectionId: t.album,
      collectionTitle: kathaAlbumById(t.album)?.title,
      seconds: t.duration || 0,
      globalIndex: gi, voiceIndex: vi, collectionIndex: ci,
    });

    let items: LibItem[] = [];
    let loading = false;
    if (view.name === "voice") {
      const list = speakerTracks(view.slug);
      loading = !list;
      const perAlb = new Map<string, number>();
      items = (list ?? []).map((t, i) => {
        const ci = perAlb.get(t.album) ?? 0;
        perAlb.set(t.album, ci + 1);
        return mk(t, 0, i, ci);
      });
    } else if (view.name === "collection") {
      const list = albumTracks(view.id);
      loading = !list;
      items = (list ?? []).map((t, i) => mk(t, 0, 0, i));
    } else if (view.name === "items") {
      items = allTracksLoaded().map((t, i) => mk(t, i, 0, 0));
      loading = items.length === 0 && kathaAllTotal() !== 0;
    } else {
      /* Корень и «Отложенное»: точечные записи с местами от сервера. */
      items = favTails.map((tl) => trackByTail(tl))
        .filter((t): t is NonNullable<typeof t> => !!t)
        .map((t) => mk(t, t.gi, t.vi, t.ci));
      loading = view.name === "mine" && items.length < favTails.length;
    }

    const loadedAll = allTracksLoaded().length;
    const total = kathaAllTotal();
    return {
      kind: "katha",
      voicesTitle: "Рассказчики", voiceOne: "Рассказчик", homeLabel: "Катха",
      collectionsTitle: "Циклы", itemsTitle: "Записи",
      voices: speakers.map((s) => {
        const own = albums.filter((a) => a.speaker === s.slug);
        return {
          slug: s.slug, name: s.name, role: s.role, mono: s.mono, accent: s.accent,
          count: own.reduce((x, a) => x + (a.n ?? 0), 0),
          seconds: own.reduce((x, a) => x + (a.secs ?? 0), 0),
        };
      }).filter((v) => v.count > 0),
      collections: albums.map((a) => ({
        id: a.id, voiceSlug: a.speaker, voiceName: speakerBySlug(a.speaker)?.name ?? "",
        title: a.title, note: a.note,
        count: a.n ?? 0,
        seconds: a.secs ?? 0,
      })).filter((c) => c.count > 0),
      items,
      totals: { items: nAll, seconds: secAll },
      loading,
      moreItems: view.name === "items" ? {
        has: total < 0 ? false : loadedAll < total,
        loading: kathaPending("all"),
        loaded: loadedAll,
        load: () => { void ensureMoreAll(); },
      } : undefined,
      allQueue: KATHA_ALL,
      voiceQueue: (slug) => `s:${slug}`,
      collectionQueue: (id) => `a:${id}`,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, speakers, albums, favTails, nAll, secAll, kv, pt]);

  const header = (
    <>
      <HubHeader eyebrow="Аудиотека" title="Катха" subtitle={subtitle} />
      <HubSearch value={q} onChange={setQ}
        placeholder="Найти катху и включить" ariaLabel="Поиск по катхе" onSubmit={submit} />
      <div style={{ height: 16 }} />
    </>
  );

  return (
    /* ⚠️ Мини-плеер висит НАД страницей и срезал последние строки списка.
       Пока он на экране, страница обязана расступиться на его высоту. */
    <div style={{ fontFamily: "var(--font-text)",
      paddingBottom: p.active
        ? "calc(170px + env(safe-area-inset-bottom, 0px))"
        : "calc(96px + env(safe-area-inset-bottom, 0px))" }}>
      {albums.length === 0 ? (
        <>
          {header}
          <div style={{ padding: "34px 8px", textAlign: "center", color: "var(--color-label-3)",
            fontSize: "var(--text-subhead)", lineHeight: 1.55 }}>
            Записи загружаются из канала.<br />Они появятся здесь по мере готовности.
          </div>
        </>
      ) : found && found.n === 0 ? (
        <>
          {header}
          <HubEmpty query={found.q} hint="Попробуйте имя рассказчика — «Прабхупада» — или название: «Утренние прогулки», «Гопи-гита»." />
        </>
      ) : (
        <AudioLibrary domain={domain} view={view} onView={goto} header={view.name === "home" ? header : null} />
      )}
    </div>
  );
}
