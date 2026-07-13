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
import { usePlayer } from "./player/store";
import {
  kirtanTracks, albumTrackIndex, artistBySlug as artistOf,
  type KirtanTrack, type KirtanArtist,
} from "./kirtans";
import { COVER_FALLBACK } from "./ui/CoverFallback";   // нужен ArtistMono (его зовёт страница исполнителя)
import { useKirtans } from "./kirtansHydrate";
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
  const player = usePlayer();
  const kv = useKirtans();   // реактивная гидрация каталога из БД

  /* ЗКН-Н018 — ВИТРИНА ПОКАЗЫВАЕТ ТО, ЧТО МОЖНО ОТКРЫТЬ И УСЛЫШАТЬ.
   *
   * Здесь стоял СПИСОК ИМЁН. Имена — это не аудиотека: человек пришёл слушать,
   * а получал справочник, где почти за каждой строкой пусто.
   *
   * Теперь витрина = СПИСОК ЗАГРУЖЕННЫХ КИРТАНОВ из канала. Каждая строка —
   * настоящая запись, лежащая в archive.org: нажал — играет. Список растёт сам,
   * пока идёт заливка: конвейер пишет строку на каждую залитую запись, витрина
   * её подхватывает. Ничего не обещаем заранее. */
  const tracks = useMemo(() => kirtanTracks(), [kv]);
  const artistName = (slug: string) => artistOf(slug)?.name ?? "";

  const [q, setQ] = useState("");
  const trimmed = q.trim();
  const searching = trimmed.length >= 2;
  const norm = (s: string) => (s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const nq = norm(trimmed);
  const shown = useMemo(
    () => (!searching ? tracks
      : tracks.filter((t) => norm(`${t.title} ${artistName(t.artist)}`).includes(nq))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tracks, nq, searching],
  );

  const play = (t: KirtanTrack) => player.playKirtan("k-" + t.artist, albumTrackIndex(t));

  const LIST_UL: React.CSSProperties = { margin: 0, padding: 0, listStyle: "none", borderRadius: 18, overflow: "hidden", background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)" };

  const row = (t: KirtanTrack, isLast: boolean) => (
    <li key={t.id} style={{ borderBottom: isLast ? "none" : "0.5px solid var(--color-hairline)" }}>
      <button onClick={() => play(t)}
        style={{ display: "flex", width: "100%", alignItems: "center", gap: 12, padding: "11px 12px", textAlign: "left", background: "none", border: "none", cursor: "pointer", color: "var(--color-label)", fontFamily: "var(--font-text)" }}>
        <span aria-hidden style={{ flexShrink: 0, width: 34, height: 34, borderRadius: "50%", display: "grid", placeItems: "center", background: "var(--color-fill-1)", color: "var(--color-label)" }}>
          <svg width="15" height="15" viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg>
        </span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: "block", fontSize: "var(--text-callout)", fontWeight: 600, lineHeight: 1.3, color: "var(--color-label)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
          <span style={{ display: "block", marginTop: 2, fontSize: 12.5, color: "var(--color-label-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{artistName(t.artist)}</span>
        </span>
      </button>
    </li>
  );

  return (
    <div style={{ fontFamily: "var(--font-text)" }}>
      <HubHeader
        eyebrow="Аудиотека"
        title="Киртаны"
        subtitle="Святое имя в голосах ачарьев и киртания — записи из канала ISKCON Kirtans"
      />

      {/* ЗКН-Н044: поиск витрины — общий HubSearch */}
      <HubSearch value={q} onChange={setQ}
        placeholder="Поиск киртана или исполнителя" ariaLabel="Поиск по аудиотеке"
        onSubmit={() => { if (shown.length > 0) play(shown[0]); }} />

      <div style={{ marginTop: 16 }} aria-live="polite">
        {tracks.length === 0 ? (
          <div style={{ padding: "34px 8px", textAlign: "center", color: "var(--color-label-3)", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", lineHeight: 1.55 }}>
            Записи загружаются из канала.<br />Они появятся здесь по мере готовности.
          </div>
        ) : searching && shown.length === 0 ? (
          <HubEmpty query={trimmed} hint="Попробуйте название киртана или имя исполнителя." />
        ) : (
          <>
            <HubCount>{shown.length} {plural(shown.length, "киртан", "киртана", "киртанов")}</HubCount>
            <ul style={LIST_UL}>{shown.map((t, i) => row(t, i === shown.length - 1))}</ul>
          </>
        )}
      </div>
    </div>
  );
}
