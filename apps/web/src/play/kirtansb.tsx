/* /play · В5 «Киртаны и Бхаджаны».
 *
 * Киртаны — реестр kirtans.ts (гидрация /api/kirtans одним каталогом: артисты
 * · альбомы · дорожки); дорожки к альбому вяжет identifier == album.archive.
 * Звук — боевой playKirtan. Исполнители связаны с ПКЛ (entityId) — «О
 * личности» уходит на карточку в основном приложении.
 *
 * Бхаджаны — /api/bhajans (160 текстов, категории = сборники). У записи —
 * playBhajan; без записи «Читать» честно ведёт в тексты (роадмап В5), лирика
 * плеера — настоящие куплеты prayers (player.tsx).
 */

import React, { useEffect, useMemo, useState } from "react";
import { Ava, Cover, H2, I, Scr, ShelfCard, VoiceDot, initials } from "./core";
import type { UI } from "./MusicApp";
import { api } from "../api";
import { ROUTES } from "../routes";
import { usePlayer as useCore } from "../player/store";
import { artistBySlug, kirtanAlbums, kirtanTracks, KIRTAN_ARTISTS, type KirtanAlbum } from "../kirtans";
import { useKirtans } from "../kirtansHydrate";

const fmtMin = (s: number) => `${Math.round(s / 60)} мин`;

/* ── КИРТАНЫ ──────────────────────────────────────────────────────────── */

const artistName = (slug: string) => artistBySlug(slug)?.name ?? slug;
const albumsOf = (artist: string) => kirtanAlbums().filter((a) => a.artist === artist && a.archive);
const tracksOf = (a: KirtanAlbum) => kirtanTracks().filter((t) => t.identifier === a.archive);

export function KirtansScreen({ ui }: { ui: UI }) {
  useKirtans();
  const withSound = useMemo(
    () => KIRTAN_ARTISTS.map((ar) => ({ ar, albums: albumsOf(ar.slug) })).filter((x) => x.albums.length > 0),
    // гидрация будит компонент версией каталога
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [useKirtans()],
  );
  return (
    <Scr>
      <div className="amx-top"><div className="amx-h1">Киртаны</div><Ava /></div>
      {withSound.length > 0 ? (
        <>
          <H2 t="Исполнители" />
          <div className="amx-sprow">
            {withSound.map(({ ar }) => (
              <VoiceDot key={ar.slug} name={ar.name} accent={ar.accent} onTap={() => ui.push({ k: "kart", slug: ar.slug })} />
            ))}
          </div>
        </>
      ) : null}
      {withSound.map(({ ar, albums }) => (
        <div key={ar.slug}>
          <H2 t={ar.name} onOpen={() => ui.push({ k: "kart", slug: ar.slug })} />
          <div className="amx-shelf">
            {albums.slice(0, 10).map((a) => (
              <ShelfCard key={a.id} id={a.id} t={a.title} s={[a.year, a.note].filter(Boolean).join(" · ")}
                onOpen={() => ui.push({ k: "kalb", id: a.id })} />
            ))}
          </div>
        </div>
      ))}
    </Scr>
  );
}

export function KArtistScreen({ ui, slug }: { ui: UI; slug: string }) {
  useKirtans();
  const core = useCore();
  const ar = artistBySlug(slug);
  const albums = albumsOf(slug);
  if (!ar) return null;
  return (
    <Scr>
      <div className="amx-nav">
        <button className="amx-cir" onClick={ui.back}>{I.back({ s: 22 })}</button>
        <div className="nv-title" />
      </div>
      <div style={{ padding: "0 20px", textAlign: "center" }}>
        <span className="amx-spdot big"><span className="d" style={{ width: 132, height: 132, fontSize: 40, color: ar.accent ? "var(--red)" : "white" }}>{initials(ar.name)}</span></span>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.26px", marginTop: 12 }}>{ar.full || ar.name}</div>
        {ar.role ? <div style={{ fontSize: 15, color: "var(--g2)", marginTop: 2 }}>{ar.role}</div> : null}
        <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
          {albums.length > 0 ? (
            <button className="amx-capsule" onClick={() => core.playKirtan(albums[0].id, 0, true)}>
              {I.play({ s: 18 })}<span>Слушать</span>
            </button>
          ) : null}
          {ar.entityId ? (
            <button className="amx-capsule" onClick={() => window.location.assign(ROUTES.entity(ar.entityId as string))}>
              {I.artist({ s: 18 })}<span>О личности</span>
            </button>
          ) : null}
        </div>
        {ar.bio ? <div style={{ fontSize: 14, color: "var(--g2)", marginTop: 14, textAlign: "left" }}>{ar.bio}</div> : null}
      </div>
      <div style={{ marginTop: 14 }}>
        {albums.map((a) => (
          <div key={a.id} className="amx-row" onClick={() => ui.push({ k: "kalb", id: a.id })}>
            <div className="r-c" style={{ paddingLeft: 20 }}>
              <div className="r-t">{a.title}</div>
              <div className="r-s">{[a.year, `${tracksOf(a).length} зап.`].filter(Boolean).join(" · ")}</div>
            </div>
            <span style={{ color: "var(--g2)", paddingRight: 16 }}>{I.chev({ s: 16 })}</span>
          </div>
        ))}
      </div>
    </Scr>
  );
}

export function KirtanAlbumScreen({ ui, id }: { ui: UI; id: string }) {
  useKirtans();
  const core = useCore();
  const a = kirtanAlbums().find((x) => x.id === id);
  const list = a ? tracksOf(a) : [];
  if (!a) return null;
  return (
    <Scr>
      <div className="amx-nav">
        <button className="amx-cir" onClick={ui.back}>{I.back({ s: 22 })}</button>
        <div className="nv-title" />
      </div>
      <div style={{ padding: "0 20px", textAlign: "center" }}>
        <Cover id={a.id} style={{ width: 232, height: 232, margin: "0 auto", borderRadius: 10, boxShadow: "0 14px 40px rgba(0,0,0,.5)" }} />
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.26px", marginTop: 16 }}>{a.title}</div>
        <div style={{ fontSize: 15, color: "var(--red)", marginTop: 2 }} onClick={() => ui.push({ k: "kart", slug: a.artist })}>{artistName(a.artist)}</div>
        <div style={{ fontSize: 13, color: "var(--g2)", marginTop: 4 }}>{[a.year, `${list.length} записей`].filter(Boolean).join(" · ")}</div>
        <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
          <button className="amx-capsule" onClick={() => core.playKirtan(a.id, 0, true)}>
            {I.play({ s: 18 })}<span>Слушать</span>
          </button>
        </div>
      </div>
      <div style={{ marginTop: 18 }}>
        {list.map((t, i) => (
          <div key={t.id} className="amx-row" onClick={() => core.playKirtan(a.id, i, false)}>
            <div className="r-num">{i + 1}</div>
            <div className="r-c">
              <div className="r-t">{t.title}</div>
              {t.duration ? <div className="r-s">{fmtMin(t.duration)}</div> : null}
            </div>
          </div>
        ))}
      </div>
    </Scr>
  );
}

/* ── БХАДЖАНЫ ─────────────────────────────────────────────────────────── */

interface BhRow { slug: string; name: string; author: string | null; category: string | null; has_recordings: boolean }

export function BhajansScreen({ ui: _ui }: { ui: UI }) {
  const core = useCore();
  const [items, setItems] = useState<BhRow[] | null>(null);
  useEffect(() => {
    let dead = false;
    fetch(api("/bhajans")).then((r) => r.json())
      .then((d: { bhajans?: BhRow[] }) => { if (!dead && d.bhajans) setItems(d.bhajans); })
      .catch(() => { if (!dead) setItems([]); });
    return () => { dead = true; };
  }, []);
  const groups = useMemo(() => {
    const by = new Map<string, BhRow[]>();
    for (const b of items ?? []) {
      const k = b.category || "Прочие";
      const arr = by.get(k); if (arr) arr.push(b); else by.set(k, [b]);
    }
    return [...by.entries()];
  }, [items]);
  return (
    <Scr>
      <div className="amx-top"><div className="amx-h1">Бхаджаны</div><Ava /></div>
      {groups.map(([cat, rows]) => (
        <div key={cat}>
          <H2 t={cat} />
          <div style={{ marginTop: 2 }}>
            {rows.map((b) => (
              <div key={b.slug} className="amx-row"
                onClick={() => b.has_recordings ? core.playBhajan(b.slug, 0) : window.location.assign(ROUTES.bhajans(b.slug))}>
                <div className="r-c" style={{ paddingLeft: 20 }}>
                  <div className="r-t">{b.name}</div>
                  {b.author ? <div className="r-s">{b.author}</div> : null}
                </div>
                <span style={{ color: b.has_recordings ? "var(--red)" : "var(--g2)", paddingRight: 16 }}>
                  {b.has_recordings ? I.play({ s: 18 }) : I.lib({ s: 18 })}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </Scr>
  );
}
