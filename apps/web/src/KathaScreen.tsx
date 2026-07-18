/**
 * KathaScreen — витрина раздела «Катха».
 *
 * ЗКН-Н090 · ТРИ УРОВНЯ ВМЕСТО СВАЛКИ.
 *
 * Раньше витрина показывала ВСТРОЕННЫЙ ПЛЕЕР со всей катхой одним списком:
 * 857 записей четырёх рассказчиков вперемешку. Это не библиотека, а куча —
 * найти в ней Шрилу Прабхупаду можно было только прокруткой, а «дальше» после
 * его лекции включало чужой голос посреди цикла.
 *
 * Теперь витрина — МЕДИАТЕКА (`AudioLibrary`): рассказчики → циклы → записи,
 * у каждого уровня своя очередь. Плеер снова делает только своё дело —
 * играет; он живёт капсулой снизу и разворачивается на весь экран.
 *
 * Здесь остаётся то, чего у медиатеки нет: шапка раздела, поиск (ЗКН-Н044) и
 * переход по ссылке из отложенного (ЗКН-Н077).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { usePlayer, mediaTrackKey } from "./player/store";
import { AudioLibrary, type LibDomain, type LibView } from "./player/AudioLibrary";
import { kathaTracks, kathaSpeakers, kathaAlbums, kathaAlbumById, speakerBySlug, KATHA_ALL, KATHA_FIND } from "./katha";
import { useKatha } from "./kathaHydrate";
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
  const tracks = useMemo(() => kathaTracks(), [kv]);
  const speakers = useMemo(() => kathaSpeakers(), [kv]);
  const albums = useMemo(() => kathaAlbums(), [kv]);

  const [view, setView] = useState<LibView>(() =>
    viewFromPath(typeof window === "undefined" ? "/katha" : window.location.pathname));
  useEffect(() => subscribeNav((path) => setView(viewFromPath(path))), []);
  const goto = (v: LibView) => { setView(v); pushUrl(pathFromView(v)); };

  /* Пока рассказчик один, шапка называет его. Станет больше — называем ВЕДУЩИЙ
     голос и честно добавляем остальных, а не врём, будто раздел целиком его.
     И не сужаем до «Бхагаватам»: у Прабхупады здесь и «Гита», и «Чайтанья-чаритамрита»,
     и утренние прогулки, и беседы.

     ⚠️ ВЕДУЩИЙ — НЕ «ПЕРВЫЙ В СПИСКЕ». Порядок рассказчиков пишут РАЗНЫЕ конвейеры
     заливки, каждый со своим полем `sort`; у одного он 0, у другого 10 — и подпись
     начинала звать ведущим того, кто просто раньше попал в таблицу. Голос с 1234
     записями оказывался позади голоса с сорока. Считаем по ЗАПИСЯМ: у кого их больше,
     тот и ведёт раздел. Это самоисправляется при любой новой заливке. */
  const lead = useMemo(() => {
    const byVoice = new Map<string, number>();
    for (const t of tracks) byVoice.set(t.speaker, (byVoice.get(t.speaker) ?? 0) + 1);
    let best = speakers[0];
    for (const sp of speakers) {
      if ((byVoice.get(sp.slug) ?? 0) > (byVoice.get(best?.slug ?? "") ?? 0)) best = sp;
    }
    return best;
  }, [speakers, tracks]);
  const subtitle = speakers.length === 1
    ? `Бхагавата-катха · ${speakers[0].name}`
    : `Лекции, беседы и катха — ${lead?.name ?? "рассказчики традиции"} и рассказчики традиции`;

  /* ЗКН-Н077: избранное ведёт к САМОЙ ЗАПИСИ (`/katha?t=<хвост audio>`), а не в
   * раздел. Находим её в очереди и прыгаем; нет в текущей — грузим всю катху и
   * повторяем; нет и там — тихо остаёмся. Параметр гасим, чтобы не сработало дважды. */
  const deepDone = useRef(false);
  useEffect(() => {
    if (deepDone.current || tracks.length === 0 || typeof window === "undefined") return;
    const t = new URLSearchParams(window.location.search).get("t");
    if (!t) { deepDone.current = true; return; }
    const want = "katha:" + decodeURIComponent(t);
    if (p.kind === "katha" && p.tracks.length > 0) {
      const idx = p.tracks.findIndex((tr) => mediaTrackKey(tr, "katha") === want);
      if (idx >= 0) { deepDone.current = true; p.jumpTo(idx); replaceUrl("/katha"); return; }
      if (p.book === KATHA_ALL) { deepDone.current = true; replaceUrl("/katha"); return; }
    }
    if (p.book !== KATHA_ALL) p.loadKatha(KATHA_ALL);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.kind, p.book, p.tracks.length, tracks.length]);

  const [q, setQ] = useState("");
  const [found, setFound] = useState<{ q: string; n: number } | null>(null);
  const norm = (s: string) => (s || "").toLowerCase();
  const submit = () => {
    const s = q.trim();
    if (s.length < 2) return;
    /* ⚠️ ВИТРИНА СЧИТАЛА НЕ ТО, ЧТО ОТБИРАЕТ СЕРВЕР.
     *
     * Счётчик здесь — сторож: `n === 0` показывает «ничего не найдено» и НЕ включает
     * очередь. Он сверялся с `t.album` — а это СЛАГ цикла (`sb-01`), тогда как сервер
     * ищет по НАЗВАНИЮ цикла и ИМЕНИ рассказчика. Пока рассказчик был один, разница
     * не всплывала; с приходом Прабхупады запрос «Шримад-Бхагаватам» или «Прабхупада»
     * давал бы «ничего не найдено» при 226 и 1234 записях на сервере.
     *
     * Правило: сторож обязан судить по тем же полям, что и отбор. Иначе витрина
     * запрещает то, что сервер умеет (ЗКН-Н089). */
    const n = tracks.filter((t) => norm(t.title).includes(norm(s))
      || norm(kathaAlbumById(t.album)?.title ?? "").includes(norm(s))
      || norm(speakerBySlug(t.speaker)?.name ?? "").includes(norm(s))).length;
    setFound({ q: s, n });
    if (n) p.playKatha(KATHA_FIND + s, 0, true);
  };

  /* ═══ ДОМЕН КАТХИ ═══
     Медиатека одна на два раздела; различаются НАЗВАНИЯ уровней, а не устройство. */
  const domain = useMemo<LibDomain>(() => {
    const byVoice = new Map<string, number>();     // место записи в очереди рассказчика
    const byCol = new Map<string, number>();       // …и в очереди цикла
    const items = tracks.map((t, gi) => {
      const vi = byVoice.get(t.speaker) ?? 0; byVoice.set(t.speaker, vi + 1);
      const ci = byCol.get(t.album) ?? 0; byCol.set(t.album, ci + 1);
      return {
        key: `katha:${t.identifier}/${t.file}`,
        title: t.title,
        voiceSlug: t.speaker,
        voiceName: speakerBySlug(t.speaker)?.name ?? "",
        collectionId: t.album,
        collectionTitle: kathaAlbumById(t.album)?.title,
        seconds: t.duration || 0,
        globalIndex: gi, voiceIndex: vi, collectionIndex: ci,
      };
    });
    const secOf = (pred: (x: typeof items[number]) => boolean) =>
      items.reduce((s, x) => (pred(x) ? s + x.seconds : s), 0);
    return {
      kind: "katha",
      voicesTitle: "Рассказчики", voiceOne: "Рассказчик",
      collectionsTitle: "Циклы", itemsTitle: "Записи",
      voices: speakers.map((s) => ({
        slug: s.slug, name: s.name, role: s.role, mono: s.mono, accent: s.accent,
        count: items.filter((x) => x.voiceSlug === s.slug).length,
        seconds: secOf((x) => x.voiceSlug === s.slug),
      })).filter((v) => v.count > 0),
      collections: albums.map((a) => ({
        id: a.id, voiceSlug: a.speaker, voiceName: speakerBySlug(a.speaker)?.name ?? "",
        title: a.title, note: a.note,
        count: items.filter((x) => x.collectionId === a.id).length,
        seconds: secOf((x) => x.collectionId === a.id),
      })).filter((c) => c.count > 0),
      items,
      allQueue: KATHA_ALL,
      voiceQueue: (slug) => `s:${slug}`,
      collectionQueue: (id) => `a:${id}`,
    };
  }, [tracks, speakers, albums]);

  const header = (
    <>
      <HubHeader eyebrow="Аудиотека" title="Катха" subtitle={subtitle} />
      <HubSearch value={q} onChange={setQ}
        placeholder="Найти катху и включить" ariaLabel="Поиск по катхе" onSubmit={submit} />
      <div style={{ height: 16 }} />
    </>
  );

  return (
    <div style={{ fontFamily: "var(--font-text)",
      paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))" }}>
      {tracks.length === 0 ? (
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
