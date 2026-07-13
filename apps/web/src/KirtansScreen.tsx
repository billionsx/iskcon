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
import { api } from "./api";
import { usePlayer } from "./player/store";
import { BhajanCard } from "./BhajanCard";
import {
  kirtanArtists, kirtanAlbums, albumsByArtist, albumCover, artistPlayableCount,
  artistBySlug,
  TYPE_LABEL,
  type KirtanArtist, type KirtanAlbum,
} from "./kirtans";
import { useKirtans } from "./kirtansHydrate";
import { COVER_FALLBACK } from "./ui/CoverFallback";
import { HubHeader, HubSearch, HubCount, HubEmpty, SECTION_GAP } from "./ui/HubHeader";
import { plural } from "./ui/primitives";   // ЗКН-Д002: одна функция, не копия

const GOLD = "var(--color-gold)";

interface BhajanListItem { slug: string; name: string; author: string | null; hero_image: string | null; category: string | null; has_recordings?: boolean; }

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
  const kv = useKirtans();   // реактивная гидрация каталога из БД (сид → БД)

  // Тексты бхаджанов — короткий список из D1 (как было), полный — в каталоге.
  const [bhajans, setBhajans] = useState<BhajanListItem[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = (m: string) => { setToast(m); if (toastTimer.current) clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 1800); };
  useEffect(() => {
    let live = true;
    fetch(api("/bhajans"))
      .then((r) => r.json())
      .then((d) => { if (live) setBhajans(d.bhajans ?? []); })
      .catch(() => { if (live) setBhajans([]); });
    return () => { live = false; };
  }, []);

  /* ЗКН-Н044 — У ВИТРИНЫ ЕСТЬ ПОИСК.
   *
   * Здесь его НЕ БЫЛО. Аудиотека росла — исполнители, альбомы, жанры, — а найти
   * в ней конкретную запись можно было только глазами, пролистав всю страницу.
   * Ищем по исполнителям (имя · титул · роль · эпоха) и альбомам (название ·
   * исполнитель · описание · год). */
  const [q, setQ] = useState("");
  const trimmed = q.trim();
  const searching = trimmed.length >= 2;
  const norm = (s: string) => (s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const nq = norm(trimmed);
  const hitArtists = useMemo(
    () => (!searching ? [] : kirtanArtists().filter((a) => albumsByArtist(a.slug).length > 0 && norm(`${a.name} ${a.full ?? ""} ${a.role} ${a.era ?? ""} ${a.origin ?? ""}`).includes(nq))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nq, searching, kv],
  );
  const hitAlbums = useMemo(
    () => (!searching ? [] : kirtanAlbums().filter((al) => norm(`${al.title} ${artistBySlug(al.artist)?.name ?? ""} ${al.note ?? ""} ${al.year ?? ""} ${TYPE_LABEL[al.type]}`).includes(nq))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nq, searching, kv],
  );

  /* ЗКН-Д002: строка исполнителя и строка альбома рисуются В ОДНОМ месте —
     и в разделах, и в результатах поиска. Копия разъедется. */
  const LIST_UL: React.CSSProperties = { margin: 0, padding: 0, listStyle: "none", borderRadius: 18, overflow: "hidden", background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)" };

  /* ЗКН-Н018 — ВИТРИНА ПОКАЗЫВАЕТ ТО, ЧТО МОЖНО ОТКРЫТЬ.
   *
   * В реестре 143 киртания — их имена приехали из канала. Но записи есть пока
   * не у всех: заливка 36 ГБ на archive.org идёт порциями. Показать все 143 —
   * значит показать 140 тупиков: человек тыкает имя и попадает в пустоту.
   *
   * Показываем ТЕХ, У КОГО ЕСТЬ ЗАПИСИ. Заливка добивает исполнителя — он
   * появляется в списке сам. Список растёт на глазах, а не врёт заранее. */
  const withMusic = useMemo(
    () => kirtanArtists().filter((a) => albumsByArtist(a.slug).length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kv],
  );

  const artistRow = (a: KirtanArtist, isLast: boolean) => {
    const cnt = artistPlayableCount(a.slug);
    return (
      <li key={a.slug} style={{ borderBottom: isLast ? "none" : "0.5px solid var(--color-hairline)" }}>
        <button onClick={() => onOpenArtist(a.slug)} style={{ display: "flex", width: "100%", alignItems: "center", gap: 12, padding: 10, textAlign: "left", background: "none", border: "none", cursor: "pointer", color: "var(--color-label)", fontFamily: "var(--font-text)" }}>
          <ArtistMono artist={a} />
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: "block", fontSize: "var(--text-callout)", fontWeight: 600, lineHeight: 1.25, color: "var(--color-label)" }}>{a.name}</span>
            <span style={{ display: "block", marginTop: 2, fontSize: 12.5, color: "var(--color-label-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.role}{a.era ? ` · ${a.era}` : ""}</span>
          </span>
          {cnt > 0 && <span style={{ flexShrink: 0, fontSize: "var(--text-caption)", fontWeight: 600, color: GOLD, marginRight: 2 }}>{cnt}♪</span>}
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden style={{ flexShrink: 0, color: "var(--color-label-2)" }}><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </li>
    );
  };

  const albumRow = (al: KirtanAlbum, isLast: boolean) => {
    const ar = artistBySlug(al.artist);
    const can = !!al.archive;
    return (
      <li key={al.id} style={{ borderBottom: isLast ? "none" : "0.5px solid var(--color-hairline)" }}>
        <button onClick={() => (can ? player.playKirtan(al.id) : onOpenArtist(al.artist))} style={{ display: "flex", width: "100%", alignItems: "center", gap: 12, padding: 10, textAlign: "left", background: "none", border: "none", cursor: "pointer", color: "var(--color-label)", fontFamily: "var(--font-text)" }}>
          <img src={albumCover(al)} alt="" loading="lazy" style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover", flexShrink: 0, background: "var(--color-bg-3, #e9e9ee)" }} />
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: "block", fontSize: "var(--text-subhead)", fontWeight: 600, lineHeight: 1.25, color: "var(--color-label)" }}>{al.title}</span>
            <span style={{ display: "block", marginTop: 2, fontSize: 12.5, color: "var(--color-label-2)" }}>{ar?.name} · {TYPE_LABEL[al.type]}</span>
          </span>
          {can
            ? <span aria-hidden style={{ flexShrink: 0, width: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center", background: "var(--color-label)", color: "var(--color-bg)" }}><svg width="14" height="14" viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg></span>
            : <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden style={{ flexShrink: 0, color: "var(--color-label-2)" }}><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </button>
      </li>
    );
  };

  return (
    <div style={{ fontFamily: "var(--font-text)" }}>
      <HubHeader
        eyebrow="Аудиотека"
        title="Киртаны"
        subtitle="Святое имя в голосах ачарьев и киртания — от первых записей Шрилы Прабхупады до Вриндавана"
      />

      {/* ЗКН-Н044: поиск витрины — общий HubSearch, а не своя копия */}
      <HubSearch value={q} onChange={setQ}
        placeholder="Поиск киртании, альбома или жанра" ariaLabel="Поиск по аудиотеке"
        onSubmit={() => {
          if (hitAlbums.length > 0) { const al = hitAlbums[0]; if (al.archive) player.playKirtan(al.id); else onOpenArtist(al.artist); }
          else if (hitArtists.length > 0) onOpenArtist(hitArtists[0].slug);
        }} />

      {searching ? (
        <div style={{ marginTop: 16 }} aria-live="polite">
          {hitArtists.length + hitAlbums.length === 0 ? (
            <HubEmpty query={trimmed} hint="Попробуйте имя киртании, название альбома или жанр." />
          ) : (
            <>
              <HubCount>{hitArtists.length + hitAlbums.length} {plural(hitArtists.length + hitAlbums.length, "запись", "записи", "записей")}</HubCount>
              {hitArtists.length > 0 && <ul style={LIST_UL}>{hitArtists.map((a, i) => artistRow(a, i === hitArtists.length - 1))}</ul>}
              {hitAlbums.length > 0 && <ul style={{ ...LIST_UL, marginTop: hitArtists.length ? 14 : 0 }}>{hitAlbums.map((al, i) => albumRow(al, i === hitAlbums.length - 1))}</ul>}
            </>
          )}
        </div>
      ) : (
      <>
      {/* ЗКН-Н036 · решение основателя 13.07.2026 — В КИРТАНАХ ОСТАЁТСЯ ОДИН СПИСОК.
          Удалены ЦЕЛИКОМ два блока: карусель альбомов («Слушать сейчас») и чипы
          жанров/настроений с их выдачей. Не надписи над ними — сами блоки.
          Витрина = шапка · поиск · исполнители. Всё остальное — за поиском. */}
      <section style={{ marginTop: SECTION_GAP }}>
        <ul style={LIST_UL}>
          {withMusic.map((a, i) => artistRow(a, i === withMusic.length - 1))}
        </ul>
      </section>


      </>
      )}

      {/* ЗКН-Н036 — ОДНО СОДЕРЖИМОЕ — ОДНО МЕСТО.
       *
       * Здесь был блок с текстами — тот же молитвенник, что и во вкладке
       * «Бхаджаны». Одно и то же в двух местах: человек не понимает, где искать,
       * и не знает, полный ли список перед ним.
       *
       * Киртаны — это ЗВУК (альбомы, исполнители, жанры).
       * Бхаджаны — это ТЕКСТ (молитвенник). Не смешивать. */}
      {toast && (
        <div role="status" style={{ position: "fixed", left: "50%", bottom: "calc(env(safe-area-inset-bottom,0px) + 84px)", transform: "translateX(-50%)", zIndex: 60, padding: "10px 16px", borderRadius: 999, background: "rgba(0,0,0,.82)", color: "#fff", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote, 13px)", fontWeight: 500, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", boxShadow: "0 8px 30px rgba(0,0,0,.3)", pointerEvents: "none" }}>{toast}</div>
      )}
    </div>
  );
}

