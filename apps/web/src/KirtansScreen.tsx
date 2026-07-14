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
import { kirtanTracks, KIRTANS_ALL, artistBySlug, type KirtanArtist } from "./kirtans";
import { useKirtans } from "./kirtansHydrate";
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

export default function KirtansScreen({ onOpenArtist, onOpenBhajan, onOpenCatalog }: {
  onOpenArtist: (slug: string) => void;
  onOpenBhajan: (slug: string) => void;
  onOpenCatalog: () => void;
}) {
  const p = usePlayer();
  const kv = useKirtans();

  /* ЗКН-Б011 · решение основателя 13.07.2026 — ВИТРИНА = САМ ПЛЕЕР.
   *
   * Не список, открывающий плеер, и не второй плеер рядом. `NowPlaying` в режиме
   * `embedded`: тот же компонент, тот же движок, список дорожек живёт ВНУТРИ него. */
  const tracks = useMemo(() => kirtanTracks(), [kv]);

  useEffect(() => {
    if (tracks.length > 0 && !p.book.startsWith(FIND)) p.loadKirtan(KIRTANS_ALL);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks.length]);

  /* ЗКН-Н044 — ПОИСК ДЕЛАЕТ СВОЙ АЛЬБОМ, А НЕ ФИЛЬТРУЕТ СПИСОК.
   *
   * Ввёл имя, нажал ввод — очередь плеера СТАНОВИТСЯ найденным: первое играет,
   * остальные идут следом, курсор подъезжает к играющей строке.
   *
   * А если совпадений несколько (их почти всегда несколько: «Киртан 01» есть у
   * двадцати исполнителей)? Тогда найденное — это ОТДЕЛЬНЫЙ АЛЬБОМ. Рядом с ним
   * остаётся альбом-папка «Все киртаны» со всей библиотекой: один тап — и человек
   * вернулся, ничего не потеряв. Фильтровать общий список вместо этого нельзя:
   * очередь плеера разъедется с тем, что видно на экране. */
  const [q, setQ] = useState("");
  const [found, setFound] = useState<{ q: string; n: number } | null>(null);

  const norm = (s: string) => (s || "").toLowerCase();
  const submit = () => {
    const s = q.trim();
    if (s.length < 2) return;
    const n = tracks.filter((t) => norm(t.title).includes(norm(s))).length;
    if (n === 0) { setFound({ q: s, n: 0 }); return; }
    setFound({ q: s, n });
    p.playKirtan(FIND + s, 0, false);      // очередь = найденное, первое играет
  };

  const onFind = p.kind === "kirtan" && p.book.startsWith(FIND);
  const toAll = () => { setFound(null); setQ(""); p.playKirtan(KIRTANS_ALL, 0, false); };

  const card = (active: boolean, title: string, sub: string, onClick: () => void) => (
    <button type="button" onClick={onClick}
      style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
        borderRadius: 14, cursor: "pointer", textAlign: "left", fontFamily: "var(--font-text)",
        background: active ? "color-mix(in srgb, var(--color-gold) 12%, var(--color-bg-2))" : "var(--color-bg-2)",
        border: active ? "1px solid var(--color-gold)" : "0.5px solid var(--color-hairline)",
        color: "var(--color-label)" }}>
      <img src={COVER_FALLBACK} alt="" style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: "#fff" }} />
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: "var(--text-footnote)", fontWeight: 700, lineHeight: 1.25,
          color: active ? "var(--color-gold-deep)" : "var(--color-label)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
        <span style={{ display: "block", marginTop: 1, fontSize: "var(--text-caption)", color: "var(--color-label-2)" }}>{sub}</span>
      </span>
    </button>
  );

  /* ЗКН-Н012 — ПЛЕЕР ВЛЕЗАЕТ В ЭКРАН: высоту считает витрина, а не `vh`. */
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxH, setBoxH] = useState(0);
  useEffect(() => {
    const calc = () => {
      const top = boxRef.current?.getBoundingClientRect().top ?? 0;
      setBoxH(Math.max(340, Math.round(window.innerHeight - top - 104)));   // 104 — нижнее меню + воздух
    };
    calc();
    window.addEventListener("resize", calc);
    window.addEventListener("orientationchange", calc);
    return () => {
      window.removeEventListener("resize", calc);
      window.removeEventListener("orientationchange", calc);
    };
  }, [tracks.length, found]);

  return (
    <div style={{ fontFamily: "var(--font-text)" }}>
      <HubHeader
        eyebrow="Аудиотека"
        title="Киртаны"
        subtitle="Святое имя в голосах ачарьев и киртания — записи канала ISKCON Kirtans"
      />

      <HubSearch value={q} onChange={setQ}
        placeholder="Найти киртан и включить" ariaLabel="Поиск по аудиотеке"
        onSubmit={submit} />

      {/* ДВА АЛЬБОМА. Найденное — слева, вся библиотека — справа. Один тап между ними. */}
      {found && (
        <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
          {card(onFind, `Найдено: ${found.q}`,
            found.n ? `${found.n} ${plural(found.n, "запись", "записи", "записей")}` : "ничего не найдено",
            () => { if (found.n) p.playKirtan(FIND + found.q, 0, false); })}
          {card(!onFind, "Все киртаны",
            `${tracks.length} ${plural(tracks.length, "запись", "записи", "записей")}`, toAll)}
        </div>
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
