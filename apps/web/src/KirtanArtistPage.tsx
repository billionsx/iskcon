/**
 * KirtanArtistPage — страница исполнителя-киртания.
 *
 * Шапка: монограмма-аватар, имя, титул, годы/место, биография (золотой акцент у
 * Прабхупады). Ниже — дискография: альбомы со звуком разворачиваются в live-
 * трек-лист из Internet Archive (тап по дорожке играет альбом с неё); записи без
 * звука показаны для полноты как информационные строки.
 *
 * Эстетика — светлый iOS-grouped-list на дизайн-токенах, как раздел книг.
 */
import { CardActionBtns, favMetaFromCtx, useCardActions } from "./cardActions";
import { useEffect, useState } from "react";
import { api } from "./api";
import { usePlayer, fmtTime } from "./player/store";
import { ArtistMono } from "./KirtansScreen";
import { artistBySlug, albumsByArtist, albumCover, TYPE_LABEL, MOOD_LABEL, type KirtanAlbum } from "./kirtans";
import { ROUTES, url } from "./routes";

const GOLD = "var(--color-gold)";

interface TrackLite { title: string; durationSec: number | null; pos: number }

function BackIcon({ size = 22 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

/** Один альбом: проигрываемый разворачивается в трек-лист; иначе — инфо-строка. */
function AlbumBlock({ album, artistSlug, artistName }: { album: KirtanAlbum; artistSlug: string; artistName: string }) {
  const { openCardMenu } = useCardActions();
  const albumCtx = {
    type: "kirtan-album" as const, id: album.id, title: album.title, subtitle: artistName,
    url: url(ROUTES.kirtanArtist(artistSlug)),
    context: `Киртан-альбом · ${artistName} — ${album.title} · /kirtan/${artistSlug}`,
  };
  const player = usePlayer();
  const playable = !!album.archive;
  const [open, setOpen] = useState(false);
  const [tracks, setTracks] = useState<TrackLite[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || tracks || !playable) return;
    let live = true;
    setLoading(true);
    fetch(api(`/kirtans/${album.id}/audio`))
      .then((r) => r.json())
      .then((m) => { if (live) setTracks((m?.modes?.plain?.tracks ?? []) as TrackLite[]); })
      .catch(() => { if (live) setTracks([]); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [open, tracks, playable, album.id]);

  const meta = [TYPE_LABEL[album.type], album.year].filter(Boolean).join(" · ");

  return (
    <div style={{ borderRadius: 16, overflow: "hidden", background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)", marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12 }}>
        <img src={albumCover(album)} alt="" loading="lazy" style={{ width: 64, height: 64, borderRadius: 12, objectFit: "cover", flexShrink: 0, background: "var(--color-bg-3, #e9e9ee)" }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: "var(--text-callout)", fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.25, color: "var(--color-label)" }}>{album.title}</div>
          <div style={{ marginTop: 2, fontSize: "var(--text-footnote)", color: "var(--color-label-2)" }}>{meta}</div>
          {album.note && <div style={{ marginTop: 5, fontSize: "var(--text-footnote)", lineHeight: 1.4, color: "var(--color-label-3, #8e8e93)" }}>{album.note}</div>}
        </div>
        <span style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <CardActionBtns plain favKey={`kirtan-album:${album.id}`} meta={favMetaFromCtx(albumCtx)} size={32} onMore={() => openCardMenu(albumCtx)} />
          {playable && (
            <button aria-label="Слушать альбом" onClick={() => player.playKirtan(album.id)} style={{ flexShrink: 0, width: 44, height: 44, borderRadius: "50%", border: "none", cursor: "pointer", display: "grid", placeItems: "center", background: GOLD, color: "#1d1d1f", boxShadow: "0 4px 14px rgba(210,170,27,0.4)" }}>
              <svg width="20" height="20" viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg>
            </button>
          )}
        </span>
      </div>

      {playable && (
        <>
          <button onClick={() => setOpen((v) => !v)} style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 14px", background: "var(--color-bg-3, #f2f2f7)", border: "none", borderTop: "0.5px solid var(--color-hairline)", cursor: "pointer", color: "var(--color-gold-deep)", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 600 }}>
            <span>{open ? "Скрыть дорожки" : "Показать дорожки"}{tracks ? ` · ${tracks.length}` : ""}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .2s" }}><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          {open && (
            <div style={{ borderTop: "0.5px solid var(--color-hairline)" }}>
              {loading && <div style={{ padding: "14px", fontSize: "var(--text-footnote)", color: "var(--color-label-2)" }}>Загрузка дорожек…</div>}
              {tracks && tracks.length === 0 && !loading && <div style={{ padding: "14px", fontSize: "var(--text-footnote)", color: "var(--color-label-2)" }}>Дорожки появятся позже.</div>}
              {tracks && tracks.map((t, i) => {
                const active = player.kind === "kirtan" && player.book === album.id && player.index === i;
                const trackCtx = {
                  type: "kirtan-track" as const, id: album.id, title: t.title, subtitle: `${artistName} — ${album.title}`,
                  url: url(ROUTES.kirtanArtist(artistSlug)),
                  context: `Киртан-дорожка · ${artistName} — ${album.title} · ${t.title}`,
                  pdfExtra: { album: album.id, track: t.title },
                };
                return (
                  <div key={i} role="button" tabIndex={0} onClick={() => player.playKirtan(album.id, i)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); player.playKirtan(album.id, i); } }}
                    style={{ display: "flex", width: "100%", boxSizing: "border-box", alignItems: "center", gap: 10, padding: "8px 14px", textAlign: "left", background: active ? "rgba(210,170,27,0.12)" : "none", borderTop: i === 0 ? "none" : "0.5px solid var(--color-hairline)", cursor: "pointer", color: "var(--color-label)", fontFamily: "var(--font-text)", WebkitTapHighlightColor: "transparent" }}>
                    <span style={{ width: 22, textAlign: "center", flexShrink: 0, fontSize: "var(--text-footnote)", fontWeight: 600, color: active ? GOLD : "var(--color-label-3, #8e8e93)", fontVariantNumeric: "tabular-nums" }}>{active ? "▶" : i + 1}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: "var(--text-subhead)", fontWeight: active ? 600 : 400, color: "var(--color-label)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                    {t.durationSec ? <span style={{ flexShrink: 0, fontSize: "var(--text-caption)", color: "var(--color-label-3, #8e8e93)", fontVariantNumeric: "tabular-nums" }}>{fmtTime(t.durationSec)}</span> : null}
                    <CardActionBtns plain favKey={`kirtan-track:${album.id}:${i}`} meta={favMetaFromCtx(trackCtx)} size={28} onMore={() => openCardMenu(trackCtx)} />
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function KirtanArtistPage({ slug, onBack, onOpenEntity }: { slug: string; onBack: () => void; onOpenEntity?: (id: string, type: string | null) => void }) {
  const artist = artistBySlug(slug);
  const albums = albumsByArtist(slug);
  const [scrolled, setScrolled] = useState(false);

  if (!artist) {
    return (
      <div style={{ minHeight: "100%", background: "var(--color-bg)" }}>
        <header style={{ position: "sticky", top: 0, zIndex: 30, height: 56, display: "flex", alignItems: "center", gap: 6, padding: "0 8px", borderBottom: "0.5px solid var(--color-hairline)", background: "var(--color-bg)" }}>
          <button aria-label="Назад" onClick={onBack} style={{ display: "grid", height: 40, width: 40, placeItems: "center", borderRadius: "50%", border: "none", background: "none", cursor: "pointer", color: "var(--color-label)" }}><BackIcon /></button>
        </header>
        <div style={{ padding: "48px 16px", textAlign: "center", color: "var(--color-label-2)", fontSize: "var(--text-subhead)" }}>Исполнитель не найден.</div>
      </div>
    );
  }

  const accent = artist.accent;

  return (
    <div onScroll={(e) => setScrolled((e.currentTarget as HTMLDivElement).scrollTop > 10)} style={{ height: "100%", overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch", background: "var(--color-bg)" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 30, height: 56, display: "flex", alignItems: "center", gap: 6, padding: "0 8px", background: scrolled ? "var(--color-bg)" : "transparent", borderBottom: `0.5px solid ${scrolled ? "var(--color-hairline)" : "transparent"}`, transition: "background .2s, border-color .2s", backdropFilter: scrolled ? "saturate(180%) blur(20px)" : "none", WebkitBackdropFilter: scrolled ? "saturate(180%) blur(20px)" : "none" }}>
        <button aria-label="Назад" onClick={onBack} style={{ display: "grid", height: 40, width: 40, placeItems: "center", borderRadius: "50%", border: "none", background: "var(--color-glass-regular)", cursor: "pointer", color: "var(--color-label)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}><BackIcon /></button>
        <div style={{ flex: 1, minWidth: 0, fontSize: "var(--text-callout)", fontWeight: 700, color: "var(--color-label)", opacity: scrolled ? 1 : 0, transition: "opacity .2s", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingRight: 8 }}>{artist.name}</div>
      </header>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "8px 16px 56px", fontFamily: "var(--font-text)" }}>
        {/* Hero */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 6 }}>
          <ArtistMono artist={artist} size={84} />
          <div style={{ minWidth: 0, flex: 1 }}>
            {accent && <div style={{ fontSize: "var(--text-caption2)", fontWeight: 600, letterSpacing: "0.4px", textTransform: "uppercase", color: GOLD, marginBottom: 3 }}>Ачарья-основатель</div>}
            <h1 style={{ margin: 0, fontSize: "var(--text-title1)", fontWeight: 800, letterSpacing: "-0.4px", lineHeight: 1.12, color: "var(--color-label)" }}>{artist.name}</h1>
            <div style={{ marginTop: 4, fontSize: "var(--text-footnote)", color: "var(--color-label-2)" }}>{artist.role}</div>
          </div>
        </div>

        {(artist.era || artist.origin) && (
          <div style={{ marginTop: 14, fontSize: "var(--text-footnote)", color: "var(--color-label-3, #8e8e93)", display: "flex", flexWrap: "wrap", gap: "2px 10px" }}>
            {artist.era && <span>{artist.era}</span>}
            {artist.era && artist.origin && <span aria-hidden>·</span>}
            {artist.origin && <span>{artist.origin}</span>}
          </div>
        )}

        {artist.full && artist.full !== artist.name && (
          <div style={{ marginTop: 10, fontSize: "var(--text-subhead)", color: "var(--color-label)", fontWeight: 500 }}>{artist.full}</div>
        )}

        <p style={{ margin: "14px 0 0", fontSize: "var(--text-callout)", lineHeight: 1.55, color: "var(--color-label)" }}>{artist.bio}</p>

        {artist.entityId && onOpenEntity && (
          <button type="button" onClick={() => onOpenEntity(artist.entityId!, "personality")}
            style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 15px", borderRadius: 999, border: "0.5px solid var(--color-hairline)", background: "var(--color-glass-thin)", cursor: "pointer", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 600, color: "var(--color-label)" }}>
            Страница личности →
          </button>
        )}

        {/* Дискография */}
        <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: "var(--text-caption2)", fontWeight: 600, letterSpacing: "0.4px", textTransform: "uppercase", color: "var(--color-gold-deep)", marginBottom: 12 }}>
            {albums.some((a) => a.archive) ? "Альбомы" : "Записи"}
          </div>
          {albums.length === 0 && (
            <div style={{ padding: "16px", borderRadius: 16, background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)", fontSize: "var(--text-subhead)", color: "var(--color-label-2)" }}>
              Записи готовятся.
            </div>
          )}
          {albums.map((al) => <AlbumBlock key={al.id} album={al} artistSlug={artist.slug} artistName={artist.name} />)}
        </div>
      </div>
    </div>
  );
}
