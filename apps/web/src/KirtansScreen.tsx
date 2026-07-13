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
import { useEffect, useMemo, useState } from "react";
import { usePlayer } from "./player/store";
import { NowPlaying } from "./player/NowPlaying";
import { kirtanTracks, KIRTANS_ALL, artistBySlug, type KirtanArtist } from "./kirtans";
import { useKirtans } from "./kirtansHydrate";
import { COVER_FALLBACK } from "./ui/CoverFallback";   // нужен ArtistMono (его зовёт страница исполнителя)
import { HubHeader, HubSearch } from "./ui/HubHeader";

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
   * Здесь стоял СПИСОК, который по нажатию открывал плеер поверх себя. Потом я
   * написал ВТОРОЙ плеер — белую доску — и оставил список под ней. Оба раза мимо:
   * основатель просил встроить НА МЕСТО списка ТОТ САМЫЙ плеер, целиком, со всем,
   * что в нём есть.
   *
   * Теперь витрина = `NowPlaying` в режиме `embedded`. Тот же самый компонент, тот
   * же движок. Никакого второго плеера и никакого списка под ним: список дорожек
   * живёт ВНУТРИ плеера — он там и был.
   *
   * Очередь — `all`: все киртаны канала. Грузим её СРАЗУ (`loadKirtan`), не дожидаясь
   * нажатия, иначе плеер стоял бы пустым. */
  const tracks = useMemo(() => kirtanTracks(), [kv]);

  useEffect(() => {
    if (tracks.length > 0) p.loadKirtan(KIRTANS_ALL);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks.length]);

  /* ЗКН-Н044 — У ВИТРИНЫ ЕСТЬ ПОИСК.
   *
   * Второго списка под плеером НЕТ (решение основателя). Но и без поиска витрину
   * оставить нельзя: 1110 записей руками не пролистать. Поэтому поиск не РИСУЕТ
   * список, а НАХОДИТ запись и включает её прямо в плеере — очередь та же, индекс
   * тот же, ничего не раздваивается. */
  const [q, setQ] = useState("");
  const norm = (s: string) => (s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const findAndPlay = () => {
    const nq = norm(q.trim());
    if (nq.length < 2) return;
    const i = tracks.findIndex((t) => norm(t.title).includes(nq));
    if (i >= 0) p.playKirtan(KIRTANS_ALL, i, false);
  };

  return (
    <div style={{ fontFamily: "var(--font-text)" }}>
      <HubHeader
        eyebrow="Аудиотека"
        title="Киртаны"
        subtitle="Святое имя в голосах ачарьев и киртания — записи канала ISKCON Kirtans"
      />

      {/* ЗКН-Н044: поиск витрины — общий HubSearch. Он не даёт второго списка:
          найденная запись включается в том же встроенном плеере. */}
      <HubSearch value={q} onChange={setQ}
        placeholder="Найти киртан и включить" ariaLabel="Поиск по аудиотеке"
        onSubmit={findAndPlay} />

      <div style={{ marginTop: 16 }}>
        {tracks.length === 0 ? (
          <div style={{ padding: "34px 8px", textAlign: "center", color: "var(--color-label-3)",
            fontSize: "var(--text-subhead)", lineHeight: 1.55 }}>
            Записи загружаются из канала.<br />Они появятся здесь по мере готовности.
          </div>
        ) : (
          <NowPlaying embedded />
        )}
      </div>
    </div>
  );
}
