/**
 * KirtansScreen — витрина аудиотеки раздела «Киртаны».
 *
 * ЗКН-Н090 · ТРИ УРОВНЯ ВМЕСТО СВАЛКИ.
 *
 * Витрина показывала встроенный плеер с общей очередью на 1062 записи — то же
 * самое, что и в катхе: список всего, что нашлось. Теперь это МЕДИАТЕКА
 * (`AudioLibrary`): киртания → записи, у каждого уровня своя очередь
 * (`f:<слаг>` / `all`), а плеер снова только играет.
 *
 * ПОЧЕМУ У КИРТАНОВ НЕТ УРОВНЯ АЛЬБОМА. Записи канала не привязаны к альбомам
 * реестра (`kirtan_tracks` знает исполнителя, но не альбом). Показать альбомы
 * между исполнителем и записью — значит обещать содержимое, которого за ними
 * нет. Дискография живёт на странице исполнителя, где ей и место.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { usePlayer, kirtanTrackKey } from "./player/store";
import { AudioLibrary, type LibDomain, type LibView } from "./player/AudioLibrary";
import { kirtanTracks, artistBySlug, kirtanArtists, type KirtanArtist } from "./kirtans";
import { useKirtans } from "./kirtansHydrate";
import { pushUrl, replaceUrl, subscribeNav } from "./nav";
import { COVER_FALLBACK } from "./ui/CoverFallback";
import { HubHeader, HubSearch, HubEmpty } from "./ui/HubHeader";

const ALL = "all";
const FIND = "q:";
/* ПАПКА — ЭТО ОЧЕРЕДЬ ПЛЕЕРА, А НЕ ФИЛЬТР СПИСКА. Выбрал исполнителя — очередь
 * СТАЛА его записями: «следующая» ведёт к следующей записи ТОГО ЖЕ голоса. */
const FOLDER = "f:";

/** Монограмма-аватар исполнителя: золотой круг у Прабхупады, нейтральный у остальных. */
export function ArtistMono({ size = 52 }: { artist: KirtanArtist; size?: number }) {
  // ЗКН-Д007: буква-монограмма — суррогат. Нет портрета → фирменная заглушка.
  return (
    <img src={COVER_FALLBACK} alt="" loading="lazy"
      style={{ width: size, height: size, flexShrink: 0, borderRadius: "50%", objectFit: "cover",
        background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)" }} />
  );
}

/** Адрес → уровень медиатеки. Слаги исполнителей длиннее и с этими не совпадают. */
function viewFromPath(path: string): LibView {
  const seg = path.split("?")[0].split("/").filter(Boolean);
  const a = seg[1] ?? "";
  if (a === "voices") return { name: "voices" };
  if (a === "tracks") return { name: "items" };
  if (a === "mine") return { name: "mine" };
  return { name: "home" };
}
function pathFromView(v: LibView): string {
  switch (v.name) {
    case "voices": return "/kirtans/voices";
    case "items": return "/kirtans/tracks";
    case "mine": return "/kirtans/mine";
    default: return "/kirtans";
  }
}

export default function KirtansScreen({ onOpenArtist, onOpenBhajan, onOpenCatalog }: {
  onOpenArtist: (slug: string) => void;
  onOpenBhajan: (slug: string) => void;
  onOpenCatalog: () => void;
}) {
  const p = usePlayer();
  const kv = useKirtans();
  const tracks = useMemo(() => kirtanTracks(), [kv]);
  const artists = useMemo(() => kirtanArtists(), [kv]);

  const [view, setView] = useState<LibView>(() =>
    viewFromPath(typeof window === "undefined" ? "/kirtans" : window.location.pathname));
  useEffect(() => subscribeNav((path) => setView(viewFromPath(path))), []);
  const goto = (v: LibView) => { setView(v); pushUrl(pathFromView(v)); };

  /* ЗКН-Н077: deep-link из отложенного — доиграть КОНКРЕТНУЮ запись, не библиотеку.
   * Находим её в манифесте и прыгаем; нет в текущей очереди — грузим `all` и
   * повторяем; нет и там — тихо остаёмся. Параметр гасим через replaceUrl. */
  const deepDone = useRef(false);
  useEffect(() => {
    if (deepDone.current || tracks.length === 0 || typeof window === "undefined") return;
    const t = new URLSearchParams(window.location.search).get("t");
    if (!t) { deepDone.current = true; return; }
    const want = "kirtan:" + decodeURIComponent(t);
    if (p.kind === "kirtan" && p.tracks.length > 0) {
      const idx = p.tracks.findIndex((tr) => kirtanTrackKey(tr) === want);
      if (idx >= 0) { deepDone.current = true; p.jumpTo(idx); replaceUrl("/kirtans"); return; }
      if (p.book === ALL) { deepDone.current = true; replaceUrl("/kirtans"); return; }
    }
    if (p.book !== ALL) p.loadKirtan(ALL);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.kind, p.book, p.tracks.length, tracks.length]);

  const [q, setQ] = useState("");
  const [found, setFound] = useState<{ q: string; n: number } | null>(null);
  const norm = (s: string) => (s || "").toLowerCase();
  const submit = () => {
    const s = q.trim();
    if (s.length < 2) return;
    /* ЗКН-Н089: сторож витрины судит по ТЕМ ЖЕ полям, что и отбор сервера.
     * Сервер ищет по названию И имени исполнителя; счётчик считал только названия —
     * запрос «Прабхупада» давал «ничего не найдено» при полной полке записей. */
    const n = tracks.filter((t) => norm(t.title).includes(norm(s))
      || norm(artistBySlug(t.artist)?.name ?? "").includes(norm(s))).length;
    setFound({ q: s, n });
    if (n) p.playKirtan(FIND + s, 0, true);
  };

  /* ═══ ДОМЕН КИРТАНОВ ═══ */
  const domain = useMemo<LibDomain>(() => {
    const byVoice = new Map<string, number>();
    const items = tracks.map((t, gi) => {
      const vi = byVoice.get(t.artist) ?? 0; byVoice.set(t.artist, vi + 1);
      return {
        key: `kirtan:${t.identifier}/${t.file}`,
        title: t.title,
        voiceSlug: t.artist,
        voiceName: artistBySlug(t.artist)?.name ?? "",
        seconds: t.duration || 0,
        globalIndex: gi, voiceIndex: vi, collectionIndex: 0,
      };
    });
    return {
      kind: "kirtan",
      voicesTitle: "Киртания", voiceOne: "Исполнитель",
      itemsTitle: "Записи",
      voices: artists.map((a) => ({
        slug: a.slug, name: a.name, role: a.role, mono: a.mono, accent: a.accent,
        count: items.filter((x) => x.voiceSlug === a.slug).length,
        seconds: items.reduce((s, x) => (x.voiceSlug === a.slug ? s + x.seconds : s), 0),
      })).filter((v) => v.count > 0),
      collections: [],
      items,
      allQueue: ALL,
      voiceQueue: (slug) => `${FOLDER}${slug}`,
      /* Голос киртанов — это полноценная страница с дискографией: ведём туда,
         а не в урезанный список внутри медиатеки. */
      voiceHref: (slug) => `/kirtans/${slug}`,
    };
  }, [tracks, artists]);

  const header = (
    <>
      <HubHeader eyebrow="Аудиотека" title="Киртаны"
        subtitle="Святое имя в голосах ачарьев и киртания — записи канала ISKCON Kirtans" />
      {/* ЗКН-Н044: поиск витрины. Найденное — своя очередь, а не второй список. */}
      <HubSearch value={q} onChange={setQ}
        placeholder="Найти киртан и включить" ariaLabel="Поиск по аудиотеке" onSubmit={submit} />
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
          <HubEmpty query={found.q} hint="Попробуйте название киртана или имя исполнителя." />
        </>
      ) : (
        <AudioLibrary domain={domain} view={view} onView={goto} onOpenPath={onOpenArtist ? (path) => {
          const slug = path.split("/").filter(Boolean)[1] ?? "";
          if (slug) onOpenArtist(slug);
        } : undefined} header={view.name === "home" ? header : null} />
      )}
    </div>
  );
}
