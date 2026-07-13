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
import { useMemo, useState } from "react";
import { KirtanBoard } from "./player/KirtanBoard";
import { kirtanTracks, artistBySlug as artistOf, type KirtanArtist } from "./kirtans";
import { useKirtans } from "./kirtansHydrate";
import { COVER_FALLBACK } from "./ui/CoverFallback";   // нужен ArtistMono (его зовёт страница исполнителя)
import { HubHeader, HubSearch, HubCount, HubEmpty } from "./ui/HubHeader";
import { plural } from "./ui/primitives";   // ЗКН-Д002: одна функция, не копия

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
  const kv = useKirtans();

  /* ЗКН-Б011 · решение основателя 13.07.2026 — ВИТРИНА = ВСТРОЕННЫЙ ПЛЕЕР.
   *
   * Сначала здесь стоял список ИМЁН — справочник, за которым почти везде пусто.
   * Потом список записей, который по нажатию открывал ТЁМНЫЙ лист поверх страницы:
   * человек нажимал строку — и она пропадала под оверлеем.
   *
   * Теперь плеер ВСТРОЕН в саму витрину: белая доска, золото, дорожки внутри.
   * Нажал — играет НА МЕСТЕ, список никуда не девается. Движок тот же самый
   * (`usePlayer`), второго плеера в приложении не появилось.
   *
   * Каталог по исполнителям соберём ПОТОМ, когда будет что раскладывать. */
  const tracks = useMemo(() => kirtanTracks(), [kv]);
  const artistName = (slug: string) => artistOf(slug)?.name ?? "";

  const [q, setQ] = useState("");
  const trimmed = q.trim();
  const searching = trimmed.length >= 2;
  const norm = (s: string) => (s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const nq = norm(trimmed);
  const shown = useMemo(
    () => (!searching ? tracks : tracks.filter((t) => norm(`${t.title} ${artistName(t.artist)}`).includes(nq))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tracks, nq, searching],
  );

  return (
    <div style={{ fontFamily: "var(--font-text)" }}>
      <HubHeader
        eyebrow="Аудиотека"
        title="Киртаны"
        subtitle="Святое имя в голосах ачарьев и киртания — записи канала ISKCON Kirtans"
      />

      {/* ЗКН-Н044: поиск витрины — общий HubSearch */}
      <HubSearch value={q} onChange={setQ}
        placeholder="Поиск киртана или исполнителя" ariaLabel="Поиск по аудиотеке" />

      <div style={{ marginTop: 16 }} aria-live="polite">
        {tracks.length === 0 ? (
          <div style={{ padding: "34px 8px", textAlign: "center", color: "var(--color-label-3)",
            fontSize: "var(--text-subhead)", lineHeight: 1.55 }}>
            Записи загружаются из канала.<br />Они появятся здесь по мере готовности.
          </div>
        ) : searching && shown.length === 0 ? (
          <HubEmpty query={trimmed} hint="Попробуйте название киртана или имя исполнителя." />
        ) : (
          <>
            <HubCount>{shown.length} {plural(shown.length, "запись", "записи", "записей")}</HubCount>
            <KirtanBoard tracks={shown} />
          </>
        )}
      </div>
    </div>
  );
}
