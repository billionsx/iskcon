/**
 * KirtansScreen — витрина аудиотеки раздела «Киртаны».
 *
 * Секции:
 *  • альбомы со звуком (Internet Archive), тап → плеер;
 *  • полный реестр киртания, тап → страница исполнителя;
 *  • чипы-классификации (тип/настроение), фильтруют альбомы.
 *
 * ЗКН-Н036 (решение основателя 13.07.2026): НАДПИСЕЙ НАД РАЗДЕЛАМИ НЕТ и плашек
 * типа на обложках НЕТ. Содержимое говорит само за себя.
 *
 * Эстетика — iOS-grouped-list на дизайн-токенах, в одном языке с разделом книг.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { usePlayer } from "./player/store";
import { NowPlaying } from "./player/NowPlaying";
import { kirtanTracks, kirtanArtists, artistBySlug, type KirtanArtist } from "./kirtans";
import { useKirtans } from "./kirtansHydrate";
import { useFavorites } from "./cardActions";
import { COVER_FALLBACK } from "./ui/CoverFallback";
import { HubHeader, HubSearch, HubEmpty } from "./ui/HubHeader";
import { plural } from "./ui/primitives";   // ЗКН-Д002: одна функция, не копия

/** Поиск — свой альбом плеера: `q:<запрос>`. Библиотека остаётся альбомом-папкой. */
const FIND = "q:";

/** Монограмма-аватар исполнителя: золотой круг у Прабхупады, нейтральный у остальных. */
export function ArtistMono({ size = 52 }: { artist: KirtanArtist; size?: number }) {
  // ЗКН-Д007: буква-монограмма — суррогат. Нет портрета → фирменная заглушка.
  return (
    <img src={COVER_FALLBACK} alt="" loading="lazy"
      style={{ width: size, height: size, flexShrink: 0, borderRadius: "50%", objectFit: "cover",
        background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)" }} />
  );
}

/* ═══ АРХИТЕКТУРА ВИТРИНЫ КИРТАНОВ ═══
 *
 * ПАПКА — ЭТО ОЧЕРЕДЬ ПЛЕЕРА, А НЕ ФИЛЬТР СПИСКА.
 *
 * Выбрал исполнителя — очередь СТАЛА его записями: «следующая» ведёт к следующей
 * записи ТОГО ЖЕ исполнителя. Если бы папка только фильтровала показ, очередь
 * разъехалась бы с экраном: видишь десять строк, а «дальше» уводит в одиннадцатую,
 * которой не видно. Поэтому у каждой папки СВОЙ манифест на сервере.
 *
 *   Все        →  `all`             1062 записи одной очередью (решение основателя)
 *   Избранное  →  `fav:<msg_id,…>`  порядок — как человек добавлял
 *   Исполнитель→  `f:<слаг>`        Шрила Прабхупада первым
 *   Найдено    →  `q:<запрос>`      поиск тоже отдельная очередь
 *
 * ВИД (плитка/список) меняет только то, КАК показаны папки. Он НЕ трогает очередь:
 * вид — это про глаза, очередь — про звук. Смешаешь их — получишь плеер, который
 * играет не то, что видно.
 */
const ALL = "all";
const FOLDER = "f:";
const FAV_KEY = (msgId: number) => `kirtan:${msgId}`;

type View = "grid" | "list";

export default function KirtansScreen({ onOpenArtist, onOpenBhajan, onOpenCatalog }: {
  onOpenArtist: (slug: string) => void;
  onOpenBhajan: (slug: string) => void;
  onOpenCatalog: () => void;
}) {
  const p = usePlayer();
  const kv = useKirtans();
  const favs = useFavorites();

  const tracks = useMemo(() => kirtanTracks(), [kv]);

  /* Папки: только те исполнители, у кого есть записи. Пустых в витрине нет
     (ЗКН-Н018 — показываем то, что можно открыть). */
  const folders = useMemo(() => {
    const byArtist = new Map<string, number>();
    tracks.forEach((t) => byArtist.set(t.artist, (byArtist.get(t.artist) ?? 0) + 1));
    return kirtanArtists()
      .filter((a) => (byArtist.get(a.slug) ?? 0) > 0)
      .map((a) => ({ slug: a.slug, name: a.name, n: byArtist.get(a.slug) ?? 0 }));
  }, [tracks, kv]);

  /* Избранное — очередь по `msg_id` (короткое число влезает в адрес). */
  const favIds = useMemo(
    () => favs.filter((f) => f.key.startsWith("kirtan:")).map((f) => f.key.slice(7)).filter(Boolean),
    [favs],
  );

  const [view, setView] = useState<View>("grid");
  const [q, setQ] = useState("");
  const [found, setFound] = useState<{ q: string; n: number } | null>(null);

  useEffect(() => {
    if (tracks.length > 0 && !p.book) p.loadKirtan(ALL);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks.length]);

  const cur = p.kind === "kirtan" ? p.book : ALL;
  const open = (id: string) => { setFound(null); setQ(""); p.playKirtan(id, 0, false); };

  const norm = (s: string) => (s || "").toLowerCase();
  const submit = () => {
    const s = q.trim();
    if (s.length < 2) return;
    const n = tracks.filter((t) => norm(t.title).includes(norm(s))).length;
    setFound({ q: s, n });
    if (n) p.playKirtan(FIND + s, 0, false);
  };

  /* ── карточка папки ── */
  const Folder = ({ id, title, sub, active }: { id: string; title: string; sub: string; active: boolean }) => (
    <button type="button" onClick={() => open(id)} aria-pressed={active}
      style={view === "grid" ? {
        display: "flex", flexDirection: "column", gap: 8, padding: 10, borderRadius: 16, cursor: "pointer",
        textAlign: "left", fontFamily: "var(--font-text)",
        background: active ? "color-mix(in srgb, var(--color-gold) 12%, var(--color-bg-2))" : "var(--color-bg-2)",
        border: active ? "1px solid var(--color-gold)" : "0.5px solid var(--color-hairline)",
        color: "var(--color-label)",
      } : {
        display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "10px 12px",
        borderRadius: 14, cursor: "pointer", textAlign: "left", fontFamily: "var(--font-text)",
        background: active ? "color-mix(in srgb, var(--color-gold) 12%, var(--color-bg-2))" : "var(--color-bg-2)",
        border: active ? "1px solid var(--color-gold)" : "0.5px solid var(--color-hairline)",
        color: "var(--color-label)",
      }}>
      <img src={COVER_FALLBACK} alt="" loading="lazy"
        style={view === "grid"
          ? { width: "100%", aspectRatio: "1 / 1", borderRadius: 11, objectFit: "cover", background: "#fff" }
          : { width: 40, height: 40, flexShrink: 0, borderRadius: 10, objectFit: "cover", background: "#fff" }} />
      <span style={{ minWidth: 0, flex: view === "grid" ? undefined : 1 }}>
        <span style={{ display: "block", fontSize: "var(--text-footnote)", fontWeight: 700, lineHeight: 1.25,
          color: active ? "var(--color-gold-deep)" : "var(--color-label)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
        <span style={{ display: "block", marginTop: 1, fontSize: "var(--text-caption)", color: "var(--color-label-2)" }}>{sub}</span>
      </span>
    </button>
  );

  const boxRef = useRef<HTMLDivElement>(null);
  const [boxH, setBoxH] = useState(0);
  useEffect(() => {
    const calc = () => {
      const top = boxRef.current?.getBoundingClientRect().top ?? 0;
      setBoxH(Math.max(340, Math.round(window.innerHeight - top - 104)));
    };
    calc();
    window.addEventListener("resize", calc);
    window.addEventListener("orientationchange", calc);
    return () => { window.removeEventListener("resize", calc); window.removeEventListener("orientationchange", calc); };
  }, [tracks.length, view, found]);

  const viewBtn = (v: View, label: string, icon: React.ReactNode) => (
    <button type="button" onClick={() => setView(v)} aria-label={label} aria-pressed={view === v}
      style={{ display: "grid", placeItems: "center", width: 32, height: 32, borderRadius: 9, cursor: "pointer",
        border: "none", background: view === v ? "var(--color-fill-1)" : "transparent",
        color: view === v ? "var(--color-gold-deep)" : "var(--color-label-3)" }}>{icon}</button>
  );

  return (
    <div style={{ fontFamily: "var(--font-text)" }}>
      <HubHeader eyebrow="Аудиотека" title="Киртаны"
        subtitle="Святое имя в голосах ачарьев и киртания — записи канала ISKCON Kirtans" />

      <HubSearch value={q} onChange={setQ}
        placeholder="Найти киртан и включить" ariaLabel="Поиск по аудиотеке" onSubmit={submit} />

      {tracks.length > 0 && (
        <>
          {/* ── ПАПКИ ── */}
          <div style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontSize: "var(--text-caption2)", fontWeight: 600, letterSpacing: "0.4px",
              textTransform: "uppercase", color: "var(--color-gold-deep)" }}>
              Папки · {folders.length + 2}
            </span>
            <div style={{ display: "flex", gap: 2 }}>
              {viewBtn("grid", "Плитка",
                <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden><rect x="3" y="3" width="8" height="8" rx="2" fill="currentColor" /><rect x="13" y="3" width="8" height="8" rx="2" fill="currentColor" /><rect x="3" y="13" width="8" height="8" rx="2" fill="currentColor" /><rect x="13" y="13" width="8" height="8" rx="2" fill="currentColor" /></svg>)}
              {viewBtn("list", "Список",
                <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden><rect x="3" y="5" width="18" height="2.4" rx="1.2" fill="currentColor" /><rect x="3" y="10.8" width="18" height="2.4" rx="1.2" fill="currentColor" /><rect x="3" y="16.6" width="18" height="2.4" rx="1.2" fill="currentColor" /></svg>)}
            </div>
          </div>

          <div style={{ marginTop: 8, maxHeight: 232, overflowY: "auto", overscrollBehavior: "contain",
            ...(view === "grid"
              ? { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(112px, 1fr))", gap: 10 }
              : { display: "flex", flexDirection: "column", gap: 8 }) }}>
            <Folder id={ALL} title="Все" sub={`${tracks.length} ${plural(tracks.length, "запись", "записи", "записей")}`}
              active={cur === ALL} />
            <Folder id={favIds.length ? "fav:" + favIds.join(",") : "fav:"} title="Избранное"
              sub={favIds.length ? `${favIds.length} ${plural(favIds.length, "запись", "записи", "записей")}` : "пусто"}
              active={cur.startsWith("fav")} />
            {folders.map((f) => (
              <Folder key={f.slug} id={FOLDER + f.slug} title={f.name}
                sub={`${f.n} ${plural(f.n, "запись", "записи", "записей")}`}
                active={cur === FOLDER + f.slug} />
            ))}
          </div>
        </>
      )}

      <div ref={boxRef} style={{ marginTop: 16 }}>
        {tracks.length === 0 ? (
          <div style={{ padding: "34px 8px", textAlign: "center", color: "var(--color-label-3)",
            fontSize: "var(--text-subhead)", lineHeight: 1.55 }}>
            Записи загружаются из канала.<br />Они появятся здесь по мере готовности.
          </div>
        ) : found && found.n === 0 ? (
          <HubEmpty query={found.q} hint="Попробуйте название киртана или имя исполнителя." />
        ) : (
          <NowPlaying embedded embeddedHeight={boxH || undefined} />
        )}
      </div>
    </div>
  );
}
