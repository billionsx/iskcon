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
  kirtanTracks, trackIndex, KIRTANS_ALL, artistBySlug as artistOf,
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
  const kv = useKirtans();

  /* ЗКН-Б011 · решение основателя 13.07.2026 — ОДНА ОЧЕРЕДЬ, БЕЗ КАТАЛОГА.
   *
   * Здесь стоял список ИМЁН — справочник, за которым почти везде пусто. А до того
   * я дробил записи по исполнителям: человек пришёл слушать, а получал картотеку.
   *
   * Пока идёт заливка — витрина это ПЛЕЙЛИСТ: все киртаны канала одной очередью
   * (альбом `all`). Нажал строку — играет, следующая идёт сама. Разложим по
   * исполнителям потом, когда будет ЧТО раскладывать.
   *
   * Порядок строк = порядок манифеста (сервер отдаёт готовым). Пересортировать
   * здесь нельзя: индекс разойдётся с очередью плеера, и нажмёшь одно — заиграет
   * другое. */
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

  const playingAll = player.kind === "kirtan" && player.book === KIRTANS_ALL;
  const isCurrent = (t: KirtanTrack) => playingAll && player.index === trackIndex(t.id);

  const tap = (t: KirtanTrack) => {
    if (isCurrent(t)) { player.togglePlay(); return; }
    if (playingAll) { player.jumpTo(trackIndex(t.id)); return; }   // очередь уже та — просто прыгаем
    player.playKirtan(KIRTANS_ALL, trackIndex(t.id));
  };

  const mmss = (s: number) => {
    if (!s || s < 0) return "";
    const m = Math.floor(s / 60), x = Math.floor(s % 60);
    return `${m}:${String(x).padStart(2, "0")}`;
  };

  const row = (t: KirtanTrack, isLast: boolean) => {
    const cur = isCurrent(t);
    const beat = cur && player.isPlaying;
    return (
      <li key={t.id} style={{ borderBottom: isLast ? "none" : "0.5px solid var(--color-hairline)" }}>
        <button onClick={() => tap(t)} aria-label={beat ? "Пауза" : "Играть"}
          style={{ display: "flex", width: "100%", alignItems: "center", gap: 12, padding: "10px 12px", textAlign: "left",
            background: cur ? "var(--color-fill-1)" : "none", border: "none", cursor: "pointer",
            color: "var(--color-label)", fontFamily: "var(--font-text)", WebkitTapHighlightColor: "transparent" }}>

          {/* Обложка = знак ISKCON ONE LOVE (золото на белом), поверх — стеклянный плей.
              Настоящих обложек у записей нет; ЗКН-Д007: суррогат-буква запрещена,
              ставим фирменную заглушку. */}
          <span style={{ position: "relative", flexShrink: 0, width: 46, height: 46 }}>
            <img src={COVER_FALLBACK} alt="" loading="lazy"
              style={{ width: 46, height: 46, borderRadius: "50%", objectFit: "cover",
                background: "#fff", border: "0.5px solid var(--color-hairline)" }} />
            <span aria-hidden style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center",
              borderRadius: "50%", background: "rgba(255,255,255,0.62)", backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)", color: "#1d1d1f" }}>
              {beat
                ? <svg width="16" height="16" viewBox="0 0 24 24"><rect x="6.5" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" /><rect x="13.9" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" /></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg>}
            </span>
          </span>

          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: "block", fontSize: "var(--text-callout)", fontWeight: 600, lineHeight: 1.3,
              color: cur ? "var(--color-gold-deep)" : "var(--color-label)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
            <span style={{ display: "block", marginTop: 2, fontSize: 12.5, color: "var(--color-label-2)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {artistName(t.artist)}{t.duration ? ` · ${mmss(t.duration)}` : ""}
            </span>
          </span>
        </button>
      </li>
    );
  };

  const LIST_UL: React.CSSProperties = {
    margin: 0, padding: 0, listStyle: "none", borderRadius: 18, overflow: "hidden",
    background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)",
  };

  return (
    <div style={{ fontFamily: "var(--font-text)" }}>
      <HubHeader
        eyebrow="Аудиотека"
        title="Киртаны"
        subtitle="Святое имя в голосах ачарьев и киртания — записи канала ISKCON Kirtans"
      />

      {/* ЗКН-Н044: поиск витрины — общий HubSearch */}
      <HubSearch value={q} onChange={setQ}
        placeholder="Поиск киртана или исполнителя" ariaLabel="Поиск по аудиотеке"
        onSubmit={() => { if (shown.length > 0) tap(shown[0]); }} />

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
            <HubCount>{shown.length} {plural(shown.length, "киртан", "киртана", "киртанов")}</HubCount>
            <ul style={LIST_UL}>{shown.map((t, i) => row(t, i === shown.length - 1))}</ul>
          </>
        )}
      </div>
    </div>
  );
}
