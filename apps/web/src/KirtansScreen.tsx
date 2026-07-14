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
import { kirtanTracks, artistBySlug, type KirtanArtist } from "./kirtans";
import { useKirtans } from "./kirtansHydrate";
import { COVER_FALLBACK } from "./ui/CoverFallback";
import { HubHeader, HubSearch, HubEmpty } from "./ui/HubHeader";

const ALL = "all";
const FIND = "q:";

/** Поиск — свой альбом плеера: `q:<запрос>`. Библиотека остаётся альбомом-папкой. */

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
const FOLDER = "f:";
const FAV_KEY = (msgId: number) => `kirtan:${msgId}`;


export default function KirtansScreen({ onOpenArtist, onOpenBhajan, onOpenCatalog }: {
  onOpenArtist: (slug: string) => void;
  onOpenBhajan: (slug: string) => void;
  onOpenCatalog: () => void;
}) {
  const p = usePlayer();
  const kv = useKirtans();
  const tracks = useMemo(() => kirtanTracks(), [kv]);

  /* ЗКН-Б011 · решение основателя 14.07.2026 — ПАПКИ ЖИВУТ В ПЛЕЕРЕ,
   * И ЭТО НЕ НОВЫЙ МЕХАНИЗМ.
   *
   * Плеер УЖЕ умеет разделы очереди — ими сделаны песни, главы и стихи у книг:
   * дорожка несёт `group`/`groupLabel`, из них строятся пилюли, очередь показывает
   * только активный раздел. Киртанам достаточно проставить дорожке раздел =
   * исполнитель, и всё работает само.
   *
   * Я вместо этого построил СВОЮ сетку папок поверх плеера — второй способ делать
   * то же самое. Снёс. Здесь остаётся только шапка и поиск; всё остальное — плеер.
   */
  useEffect(() => {
    if (tracks.length > 0 && p.kind !== "kirtan") p.loadKirtan(ALL);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks.length, p.kind]);

  const [q, setQ] = useState("");
  const [found, setFound] = useState<{ q: string; n: number } | null>(null);
  const norm = (s: string) => (s || "").toLowerCase();
  const submit = () => {
    const s = q.trim();
    if (s.length < 2) return;
    const n = tracks.filter((t) => norm(t.title).includes(norm(s))).length;
    setFound({ q: s, n });
    if (n) p.playKirtan(FIND + s, 0, false);
  };

  /* ЗКН-Н012 — плеер влезает в экран: высоту считает витрина, а не `vh`. */
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxH, setBoxH] = useState(0);
  useEffect(() => {
    const calc = () => {
      const top = boxRef.current?.getBoundingClientRect().top ?? 0;
      /* ⚠️ ПЛЕЕР УЖИМАЛСЯ ПОД ОСТАТОК ЭКРАНА.
       * На телефоне над ним стоят шапка, вкладки, заголовок и поиск — остатка не
       * хватало, и плеер схлопывался: обложка в ноготь, список в две строки, внутри
       * ничего не сделать.
       *
       * У плеера ЕСТЬ ПОЛ — 600 точек. Меньше нельзя: там просто нечем пользоваться.
       * Не влезло в экран — пусть прокрутится СТРАНИЦА. Лучше дотянуться пальцем,
       * чем не суметь пользоваться вовсе. */
      setBoxH(Math.max(600, Math.round(window.innerHeight - top - 104)));
    };
    calc();
    window.addEventListener("resize", calc);
    window.addEventListener("orientationchange", calc);
    return () => { window.removeEventListener("resize", calc); window.removeEventListener("orientationchange", calc); };
  }, [tracks.length]);

  return (
    <div style={{ fontFamily: "var(--font-text)" }}>
      <HubHeader eyebrow="Аудиотека" title="Киртаны"
        subtitle="Святое имя в голосах ачарьев и киртания — записи канала ISKCON Kirtans" />

      {/* ЗКН-Н044: поиск витрины. Найденное — своя очередь, а не второй список. */}
      <HubSearch value={q} onChange={setQ}
        placeholder="Найти киртан и включить" ariaLabel="Поиск по аудиотеке" onSubmit={submit} />

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
