/**
 * KirtansScreen — витрина аудиотеки раздела «Киртаны».
 *
 * Секции:
 *  • «Слушать сейчас»     — альбомы со звуком (Internet Archive), тап → плеер;
 *  • «Исполнители»        — полный реестр киртания, тап → страница исполнителя;
 *  • «Жанры и настроения» — классификации (тип/настроение), фильтруют альбомы;
 *
 * Эстетика — iOS-grouped-list на дизайн-токенах, в одном языке с разделом книг.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import { usePlayer } from "./player/store";
import { BhajanCard } from "./BhajanCard";
import {
  kirtanArtists, playableAlbums, albumCover, albumsByArtist, artistPlayableCount,
  artistBySlug, filterAlbums, moodsInCatalog, typesInCatalog,
  TYPE_LABEL, MOOD_LABEL,
  type KirtanArtist, type KirtanAlbum, type KirtanType, type KirtanMood,
} from "./kirtans";
import { useKirtans } from "./kirtansHydrate";
import { COVER_FALLBACK } from "./ui/CoverFallback";
import { HubHeader, SECTION_GAP } from "./ui/HubHeader";

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

function SectionHead({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
      <div>
        <div style={{ fontSize: "var(--text-caption2)", fontWeight: 600, letterSpacing: "0.4px", textTransform: "uppercase", color: "var(--color-gold-deep)" }}>{eyebrow}</div>
        <h2 style={{ margin: "2px 0 0", fontSize: "var(--text-title2)", fontWeight: 700, letterSpacing: "-0.3px", color: "var(--color-label)", fontFamily: "var(--font-text)" }}>{title}</h2>
      </div>
      {action}
    </div>
  );
}

/** Карточка проигрываемого альбома в «Слушать сейчас». */
function AlbumCard({ album, onPlay }: { album: KirtanAlbum; onPlay: () => void }) {
  const artist = artistBySlug(album.artist);
  return (
    <button onClick={onPlay} style={{ flexShrink: 0, width: 168, textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "var(--font-text)" }}>
      <div style={{ position: "relative", width: 168, height: 168, borderRadius: 16, overflow: "hidden", background: "var(--color-bg-3, #e9e9ee)", boxShadow: "0 8px 26px rgba(0,0,0,0.16)", border: "0.5px solid var(--color-hairline)" }}>
        <img src={albumCover(album)} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <span aria-hidden style={{ position: "absolute", right: 10, bottom: 10, width: 38, height: 38, borderRadius: "50%", display: "grid", placeItems: "center", background: "rgba(255,255,255,0.92)", color: "#1d1d1f", boxShadow: "0 3px 12px rgba(0,0,0,0.3)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg>
        </span>
        <span style={{ position: "absolute", left: 10, top: 10, padding: "3px 8px", borderRadius: 999, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", color: "#fff", fontSize: "var(--text-caption2)", fontWeight: 600, letterSpacing: "0.01em" }}>{TYPE_LABEL[album.type]}</span>
      </div>
      <div style={{ marginTop: 9, fontSize: "var(--text-subhead)", fontWeight: 600, lineHeight: 1.25, color: "var(--color-label)", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{album.title}</div>
      <div style={{  fontSize: "var(--text-footnote)", color: "var(--color-label-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{artist?.name}</div>
    </button>
  );
}

export default function KirtansScreen({ onOpenArtist, onOpenBhajan, onOpenCatalog }: {
  onOpenArtist: (slug: string) => void;
  onOpenBhajan: (slug: string) => void;
  onOpenCatalog: () => void;
}) {
  const player = usePlayer();
  const kv = useKirtans();   // реактивная гидрация каталога из БД (сид → БД)
  const playable = useMemo(() => playableAlbums(), [kv]);
  const types = useMemo(() => typesInCatalog(), [kv]);
  const moods = useMemo(() => moodsInCatalog(), [kv]);

  // Классификации — выбранный фильтр (один тип ИЛИ одно настроение за раз).
  const [fType, setFType] = useState<KirtanType | null>(null);
  const [fMood, setFMood] = useState<KirtanMood | null>(null);
  const filtered = useMemo(
    () => (fType || fMood ? filterAlbums({ type: fType, mood: fMood }) : []),
    [fType, fMood]
  );

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

  const chip = (on: boolean): React.CSSProperties => ({
    flexShrink: 0, padding: "8px 15px", borderRadius: 999, cursor: "pointer", fontFamily: "var(--font-text)",
    border: `0.5px solid ${on ? "transparent" : "var(--color-hairline)"}`,
    background: on ? "var(--color-label)" : "var(--color-bg-2)",
    color: on ? "var(--color-bg)" : "var(--color-label)",
    fontSize: "var(--text-footnote)", fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1, whiteSpace: "nowrap",
    transition: "background .15s, color .15s, border-color .15s", WebkitTapHighlightColor: "transparent",
  });

  return (
    <div style={{ fontFamily: "var(--font-text)" }}>
      <HubHeader
        eyebrow="Аудиотека"
        title="Киртаны"
        subtitle="Святое имя в голосах ачарьев и киртания — от первых записей Шрилы Прабхупады до Вриндавана"
      />

      {/* Слушать сейчас */}
      {playable.length > 0 && (
        <section style={{ marginTop: SECTION_GAP }}>
          <SectionHead eyebrow="Звучит" title="Слушать сейчас" />
          <div style={{ display: "flex", gap: 14, overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch", margin: "0 -16px", padding: "2px 16px 4px" }}>
            {playable.map((al) => (
              <AlbumCard key={al.id} album={al} onPlay={() => player.playKirtan(al.id)} />
            ))}
          </div>
        </section>
      )}

      {/* Исполнители */}
      <section style={{ marginTop: SECTION_GAP }}>
        <SectionHead eyebrow="Голоса святого имени" title="Исполнители" />
        <ul style={{ margin: 0, padding: 0, listStyle: "none", borderRadius: 18, overflow: "hidden", background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)" }}>
          {kirtanArtists().map((a, i) => {
            const cnt = artistPlayableCount(a.slug);
            const total = albumsByArtist(a.slug).length;
            const meta = cnt > 0 ? `${cnt} ${plural(cnt, "альбом", "альбома", "альбомов")} со звуком` : (total > 0 ? "Записи" : a.role);
            return (
              <li key={a.slug} style={{ borderBottom: i === kirtanArtists().length - 1 ? "none" : "0.5px solid var(--color-hairline)" }}>
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
          })}
        </ul>
      </section>

      {/* Жанры и настроения */}
      <section style={{ marginTop: SECTION_GAP }}>
        <SectionHead eyebrow="Классификации" title="Жанры и настроения" action={
          (fType || fMood) ? <button onClick={() => { setFType(null); setFMood(null); }} style={{ flexShrink: 0, padding: "6px 10px", borderRadius: 999, border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)", cursor: "pointer", color: "var(--color-gold-deep)", fontSize: "var(--text-footnote)", fontWeight: 600, fontFamily: "var(--font-text)" }}>Сбросить</button> : undefined
        } />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {types.map((t) => (
            <button key={t} onClick={() => { setFType(fType === t ? null : t); setFMood(null); }} style={chip(fType === t)}>{TYPE_LABEL[t]}</button>
          ))}
          <span aria-hidden style={{ width: 1, alignSelf: "stretch", margin: "2px 2px", background: "var(--color-hairline)" }} />
          {moods.map((m) => (
            <button key={m} onClick={() => { setFMood(fMood === m ? null : m); setFType(null); }} style={chip(fMood === m)}>{MOOD_LABEL[m]}</button>
          ))}
        </div>

        {(fType || fMood) && (
          <ul style={{ margin: "14px 0 0", padding: 0, listStyle: "none", borderRadius: 18, overflow: "hidden", background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)" }}>
            {filtered.length === 0 && <li style={{ padding: "16px", fontSize: "var(--text-subhead)", color: "var(--color-label-2)" }}>Пока нет записей по этому фильтру.</li>}
            {filtered.map((al, i) => {
              const ar = artistBySlug(al.artist);
              const can = !!al.archive;
              return (
                <li key={al.id} style={{ borderBottom: i === filtered.length - 1 ? "none" : "0.5px solid var(--color-hairline)" }}>
                  <button onClick={() => can ? player.playKirtan(al.id) : onOpenArtist(al.artist)} style={{ display: "flex", width: "100%", alignItems: "center", gap: 12, padding: 10, textAlign: "left", background: "none", border: "none", cursor: "pointer", color: "var(--color-label)", fontFamily: "var(--font-text)" }}>
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
            })}
          </ul>
        )}
      </section>

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

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}
