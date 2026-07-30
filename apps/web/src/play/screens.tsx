/* /play — экраны вкладок и внутренние страницы. */
import React, { useMemo, useState } from "react";
import { Ava, Cover, Dots, E, H2, I, Menu, PagedSongs, Scr, Shelf, ShelfCard, SongRow, menuAt, mutate, useLongPress, useStore, type MItem } from "./core";
import { AUDIO_WORKS, BOOKS, bookFullTitle } from "../books";
import { SHELVES } from "./shelves";
import { BookHeroCard } from "../BookHeroCard";
import { mediaTrackKey, usePlayer as useCore, type AudioMode, type Track as CoreTrack } from "../player/store";
import { api } from "../api";
import { bookSlug } from "../books";
import type { Card, Song } from "./data";
import {
  ALL_SONGS, ANTHEMS_E, ARTIST_SHOWS, BEST_NEW_SONGS, CITY25, CLUB_MIXES, COMING_SOON,
  EVERYONES, GENRE_STATIONS, HUB_HEROES, HUB_HOSTS, IN_STUDIO, LATEST_EPISODES,
  LISTEN_INTERVIEWS, MOODS, MORE_EXPLORE_NEW, NEW_HEROES, NEW_IN_MUSIC, NEW_RADIO_EPISODES,
  NEW_THIS_WEEK, ON_AIR, OUR_HOSTS, RADIO_GENRES, RADIO_LOCAL, RADIO_TILES, RECENT_RELEASES,
  SEARCH_CATS, SUMMER_ALBUMS, SUMMER_ANTHEMS, SUMMER_ESCAPES, TAKEOVER, TAKE_OVER, TOP100,
  TOP_PICKS, TRENDING, UPDATED_PLAYLISTS, WATCH_INTERVIEWS,
} from "./data";
import type { UI } from "./MusicApp";
// ЗКН-Н092: адрес книги строит один модуль.
import { bookPath, chapterPath } from "../bookPath";
import { addFavorite, isFavorite, removeFavorite } from "../cardActions";
import { ROUTES } from "../routes";
import { VoiceDot } from "./core";
import { kathaAlbums, kathaSpeakers } from "../katha";
import { loadCatalog, useKatha } from "../kathaHydrate";
import { KIRTAN_ARTISTS, kirtanAlbums, kirtanTracks } from "../kirtans";
import { useKirtans } from "../kirtansHydrate";
import { useAuth } from "../account/store";

export const ANTH: Song[] = SUMMER_ANTHEMS.map((s) => (ANTHEMS_E.has(s.id) ? { ...s, e: true } : s));

/* ── Пейджер «эпизоды радио» (строки с описанием, по 2 на страницу) ───── */
function EpPager({ items, ui }: { items: Card[]; ui: UI }) {
  const pages: Card[][] = [];
  for (let i = 0; i < items.length; i += 2) pages.push(items.slice(i, i + 2));
  return (
    <div className="amx-paged">
      {pages.map((pg, pi) => (
        <div className="amx-page" key={pi}>
          {pg.map((c) => (
            <div className="amx-ep" key={c.id} onClick={() => ui.play(ALL_SONGS, 0, c.t)}>
              <Cover id={c.id} cls="e-art" />
              <div style={{ minWidth: 0, flex: 1 }}>
                {c.k ? <div className="e-k">{c.k}</div> : null}
                <div className="e-t"><span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{c.t}</span>{c.e ? <E /> : null}</div>
                {c.s ? <div className="e-d">{c.s}</div> : null}
              </div>
              <Dots onTap={(e) => ui.dots("editorial", { id: c.id, t: c.t, a: c.s }, menuAt(e))} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ── Полка карточек ───────────────────────────────────────────────────── */
function CardShelf({ items, ui, wide, tall, src }: { items: Card[]; ui: UI; wide?: boolean; tall?: boolean; src?: string }) {
  return (
    <Shelf>
      {items.map((c) => (
        <ShelfCard key={c.id} id={c.id} t={c.t} s={c.s} e={c.e} wide={wide} tall={tall}
          onOpen={() => ui.play(ALL_SONGS, 0, src ?? c.t)} />
      ))}
    </Shelf>
  );
}

/* ── HOME ─────────────────────────────────────────────────────────────── */
/* В3 · Hero «Продолжить слушать». Источник — persist боевого движка
   (iol.player.v2): книга · глава · секунды. Полоса — время в главе против её
   длительности из манифеста (тот же /books/<b>/audio, что и плеер). Тап не
   перезапускает главу: движок УЖЕ восстановил позицию на маунте — hero лишь
   раскрывает полноэкранный слой (ui.openPlayer). Гость без следа — hero нет. */
function ContinueHero({ ui }: { ui: UI }) {
  const [st] = useState<{ book: string; chapter: number | null; scope: string | null; time: number; mode: AudioMode } | null>(() => {
    try {
      const raw = localStorage.getItem("iol.player.v2");
      if (!raw) return null;
      const s = JSON.parse(raw) as { kind?: string; book?: string; scope?: string | null; mode?: AudioMode; chapter?: number | null; time?: number };
      if (s.kind !== "book" || !s.book || !BOOKS[s.book]) return null;
      return { book: s.book, chapter: s.chapter ?? null, scope: s.scope ?? null, time: Math.max(0, s.time ?? 0), mode: s.mode === "commentary" ? "commentary" : "plain" };
    } catch { return null; }
  });
  const [tr, setTr] = useState<{ title: string; dur: number; lilaLabel?: string } | null>(null);
  React.useEffect(() => {
    if (!st) return;
    let dead = false;
    fetch(api(`/books/${st.book}/audio${st.scope ? `?canto=${encodeURIComponent(st.scope)}` : ""}`))
      .then((r) => r.json())
      .then((m: { modes?: Record<string, { tracks?: CoreTrack[] }> }) => {
        if (dead) return;
        const list = m.modes?.[st.mode]?.tracks ?? m.modes?.plain?.tracks ?? [];
        const t = list.find((x) => x.chapter === st.chapter) ?? list[0];
        if (t) setTr({ title: t.title, dur: t.durationSec ?? 0, lilaLabel: t.lilaLabel });
      }).catch(() => {});
    return () => { dead = true; };
  }, [st]);
  if (!st) return null;
  const book = BOOKS[st.book];
  const pct = tr && tr.dur > 0 ? Math.min(1, st.time / tr.dur) : 0;
  return (
    <>
      <H2 t="Продолжить слушать" />
      <div className="amx-cont" onClick={() => ui.openPlayer()}>
        <img className="c-cov" src={book.covers[0]} alt="" />
        <div className="c-c">
          <div className="c-t">{bookFullTitle(book)}</div>
          <div className="c-s">
            {tr ? tr.title : st.chapter != null ? `Глава ${st.chapter}` : "…"}
            {tr?.lilaLabel ? ` · ${tr.lilaLabel}` : ""}
          </div>
          <div className="c-bar"><div className="c-fill" style={{ width: `${Math.round(pct * 100)}%` }} /></div>
        </div>
        <span className="c-play">{I.play({ s: 22 })}</span>
      </div>
    </>
  );
}

export function HomeScreen({ ui }: { ui: UI }) {
  /* В3: раздел «Книги» — вся аудиобиблиотека полками авторов (shelves.ts),
     витрины тем же модулем BookHeroCard (ЗКН-К002: сердце · наушники ·
     корзина · ⋯ — единый юнит-стандарт). Шеврон персональной полки ведёт на
     карточку личности в основном приложении. */
  return (
    <Scr>
      <div className="amx-top"><div className="amx-h1">Книги</div><Ava /></div>
      <ContinueHero ui={ui} />
      {SHELVES.map((sh) => (
        <div key={sh.id}>
          <H2
            t={sh.title}
            onOpen={sh.entityId ? () => window.location.assign(`/${sh.entityId}`) : undefined}
          />
          <div className="amx-showcase">
            {sh.ids.filter((id) => BOOKS[id]).map((id) => (
              <div key={id} className="amx-showcase-i">
                <BookHeroCard book={BOOKS[id]} onOpen={() => ui.push({ k: "book", b: id })} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </Scr>
  );
}

function ConcertsCard() {
  const [gone, setGone] = useState(false);
  if (gone) return null;
  return (
    <div className="amx-conc">
      <button className="cx" onClick={() => setGone(true)}>{I.x({ s: 15 })}</button>
      <div className="crow">
        <div className="cico">{I.ticket({ s: 46 })}</div>
        <div>
          <div className="ct">Find Concerts Nearby</div>
          <div className="cs">Upcoming shows will appear here.</div>
        </div>
      </div>
      <button className="cbtn">Set Location</button>
    </div>
  );
}

/* ── NEW ──────────────────────────────────────────────────────────────── */
export function NewScreen({ ui }: { ui: UI }) {
  return (
    <Scr>
      <div className="amx-top"><div className="amx-h1">Лекции</div><Ava /></div>

      <div className="amx-heroes">
        {NEW_HEROES.map((h) => (
          <div key={h.id} className="amx-hero" onClick={() => ui.play(BEST_NEW_SONGS, 0, h.t)}>
            <div className="hk">{h.k}</div>
            <div className="ht">{h.t}</div>
            <div className="hs">{h.s}</div>
            <Cover id={h.id} brand>
              {h.cap ? <div className="cap">{h.cap}</div> : null}
            </Cover>
          </div>
        ))}
      </div>

      <H2 t="Best New Songs" onOpen={() => ui.push({ k: "songs", id: "bns", title: "Best New Songs", kind: "editorial" })} />
      <PagedSongs songs={BEST_NEW_SONGS}
        onPlay={(i) => ui.play(BEST_NEW_SONGS, i, "Best New Songs")}
        onDots={(s, e) => ui.dots("editorial", s, menuAt(e))} />

      <H2 t="New This Week" onOpen={() => { }} />
      <CardShelf items={NEW_THIS_WEEK} ui={ui} />

      <H2 t="Recent Releases" onOpen={() => { }} />
      <CardShelf items={RECENT_RELEASES} ui={ui} />

      <H2 t="Updated Playlists" onOpen={() => { }} />
      <CardShelf items={UPDATED_PLAYLISTS} ui={ui} />

      <H2 t="New in Music" onOpen={() => { }} />
      <CardShelf items={NEW_IN_MUSIC} ui={ui} />

      <H2 t="Trending Songs" onOpen={() => { }} />
      <PagedSongs songs={TRENDING}
        onPlay={(i) => ui.play(TRENDING, i, "Trending Songs")}
        onDots={(s, e) => ui.dots("editorial", s, menuAt(e))} />

      <H2 t="Everyone’s Listening To…" onOpen={() => { }} />
      <CardShelf items={EVERYONES} ui={ui} />

      <H2 t="Daily Top 100" onOpen={() => { }} />
      <Shelf>
        {TOP100.map((t) => (
          <div key={t.id} className="amx-t100" onClick={() => ui.play(TRENDING, 0, t.t)}>
            <div className="t-tile">
              <div className="t-k">{t.k}</div>
              <div className="t-n">{t.n}</div>
              <div className="brand2">Music</div>
              <div className="t-b">
                {Array.from({ length: 20 }, (_, i) => (
                  <i key={i} style={{ background: `hsl(${t.hue + (i % 5) * 6} ${58 + (i % 3) * 12}% ${26 + ((i * 7) % 44)}%)` }} />
                ))}
              </div>
            </div>
            <div className="cw-t">{t.t}</div>
            <div className="cw-s">{t.s}</div>
          </div>
        ))}
      </Shelf>

      <H2 t="City Charts" onOpen={() => { }} />
      <Shelf>
        {CITY25.map((c) => (
          <div key={c.id} className="amx-t100 amx-city" onClick={() => ui.play(TRENDING, 0, c.t)}>
            <div className="t-tile">
              <div className="t-k">{c.k}</div>
              <div className="t-n">{c.n}</div>
              <div className="brand2">Music</div>
              <div className="t-b"><Cover id={c.id} /></div>
            </div>
            <div className="cw-t">{c.t}</div>
            <div className="cw-s">{c.s}</div>
          </div>
        ))}
      </Shelf>

      <H2 t="New Radio Episodes" onOpen={() => { }} />
      <EpPager items={NEW_RADIO_EPISODES} ui={ui} />

      <H2 t="Watch Interviews" onOpen={() => { }} />
      <CardShelf items={WATCH_INTERVIEWS} ui={ui} wide />

      <H2 t="Coming Soon" onOpen={() => { }} />
      <CardShelf items={COMING_SOON} ui={ui} />

      <H2 t="More to explore" onOpen={() => ui.push({ k: "links", title: "More to explore", items: MORE_EXPLORE_NEW })} />
      <div className="amx-links">
        {MORE_EXPLORE_NEW.map((l) => (
          <button key={l} className="amx-link" style={{ width: "100%" }}
            onClick={() => ui.push({ k: "genre", g: l })}>{l}{I.chev({ s: 16, w: 2.4 })}</button>
        ))}
      </div>
    </Scr>
  );
}

/* ── RADIO ────────────────────────────────────────────────────────────── */
const RT_CLS: Record<string, string> = { one: "rt-one", hits: "rt-hits", country: "rt-country", musica: "rt-musica", club: "rt-club", chill: "rt-chill" };
export function RadioScreen({ ui }: { ui: UI }) {
  return (
    <Scr>
      <div className="amx-top"><div className="amx-h1">Киртаны</div><Ava /></div>

      <div className="amx-rgrid">
        {RADIO_TILES.map((t) => (
          <button key={t.id} className="amx-rtile" onClick={() => ui.play(ALL_SONGS, 0, `Apple Music ${t.text === "1" ? "1" : t.text[0] + t.text.slice(1).toLowerCase()}`)}>
            <span className={RT_CLS[t.logo]}>{t.logo === "hits" ? <>HITS<br />HITS<br />HITS</> : t.logo === "musica" ? <>MÚSICA<br />UNO</> : t.text}</span>
            <span className="rl"><b>Music</b> Radio</span>
          </button>
        ))}
      </div>

      <H2 t="On Air Now" />
      <Shelf>
        {ON_AIR.map((o) => (
          <div key={o.id} className="amx-onair" onClick={() => ui.play(ALL_SONGS, 0, o.t)}>
            <div className="oa-top"><span className="rt-one">1</span><span className="rl"><b>Music</b> Radio</span></div>
            <div className="oa-info" style={{ background: o.tint }}>
              <div className="oa-k">{o.k}</div>
              <div className="oa-t">{o.t}</div>
              <div className="oa-d">{o.d}</div>
            </div>
          </div>
        ))}
      </Shelf>

      <H2 t="Latest Radio Episodes" onOpen={() => { }} />
      <EpPager items={LATEST_EPISODES} ui={ui} />

      <H2 t="Artists Take Over" onOpen={() => { }} />
      <CardShelf items={TAKE_OVER} ui={ui} tall />

      <H2 t="Listen to Interviews" onOpen={() => { }} />
      <EpPager items={LISTEN_INTERVIEWS} ui={ui} />

      <H2 t="Watch Interviews" onOpen={() => { }} />
      <CardShelf items={WATCH_INTERVIEWS} ui={ui} wide />

      <H2 t="In-Studio Performances" onOpen={() => { }} />
      <CardShelf items={IN_STUDIO} ui={ui} />

      <H2 t="The Best Club DJ Mixes" onOpen={() => { }} />
      <CardShelf items={CLUB_MIXES} ui={ui} />

      <H2 t="Shows Hosted by Artists" onOpen={() => { }} />
      <CardShelf items={ARTIST_SHOWS} ui={ui} />

      <H2 t="Our Radio Hosts" onOpen={() => { }} />
      <CardShelf items={OUR_HOSTS} ui={ui} />

      <H2 t="Stations for You" onOpen={() => { }} />
      <CardShelf items={RADIO_LOCAL} ui={ui} />

      <H2 t="More to Explore" />
      <div className="amx-links">
        {RADIO_GENRES.map((g) => (
          <button key={g} className="amx-link" style={{ width: "100%" }}
            onClick={() => ui.push({ k: "genre", g })}>{g}{I.chev({ s: 16, w: 2.4 })}</button>
        ))}
      </div>
    </Scr>
  );
}

/* ── Страница жанра (Acoustic и любой другой) ─────────────────────────── */
export function GenreScreen({ ui, g }: { ui: UI; g: string }) {
  const items = GENRE_STATIONS[g] ?? [
    { id: "g-" + g + "1", t: `${g} Station`, s: `Apple Music ${g}`, lab: g },
    { id: "g-" + g + "2", t: `Classic ${g} Station`, s: `Apple Music ${g}`, lab: g },
  ];
  return (
    <Scr>
      <div className="amx-nav">
        <button className="amx-cir" onClick={ui.back}>{I.back({ s: 22 })}</button>
        <div className="nv-title">{g}</div>
      </div>
      {items.map((it) => <StationRow key={it.id} it={it} ui={ui} />)}
    </Scr>
  );
}
function StationRow({ it, ui }: { it: { id: string; t: string; s: string; lab: string }; ui: UI }) {
  const lp = useLongPress((x, y) => ui.menu({ x, y }, [
    { label: "Share", icon: I.share({ s: 22 }) },
    { label: "Play", icon: I.play({ s: 22 }), onTap: () => ui.play(ALL_SONGS, 0, it.t) },
  ]));
  return (
    <div className="amx-row big" {...lp} onClick={() => ui.play(ALL_SONGS, 0, it.t)}>
      <Cover id={it.id} cls="r-art" label={it.lab} />
      <div className="r-c">
        <div className="r-t">{it.t}</div>
        <div className="r-s">{it.s}</div>
      </div>
      <Dots onTap={(e) => ui.menu(menuAt(e), [
        { label: "Share", icon: I.share({ s: 22 }) },
        { label: "Play", icon: I.play({ s: 22 }), onTap: () => ui.play(ALL_SONGS, 0, it.t) },
      ])} />
    </div>
  );
}

/* ── SEARCH (вкладка-обзор) ───────────────────────────────────────────── */
export function SearchTab({ ui }: { ui: UI }) {
  return (
    <Scr>
      <div className="amx-top"><div className="amx-h1">Поиск</div><Ava /></div>
      <div className="amx-cats">
        {SEARCH_CATS.map((c) => (
          <div key={c.id} className="amx-cat"
            onClick={() => (c.id === "cat-summer" ? ui.push({ k: "hub" }) : ui.play(ALL_SONGS, 0, c.t))}>
            <Cover style={{ position: "absolute", inset: 0 }} />
            <div className="lab">{c.t}</div>
          </div>
        ))}
      </div>
    </Scr>
  );
}

/* ── Хаб Summertime Sounds ────────────────────────────────────────────── */
export function HubScreen({ ui }: { ui: UI }) {
  return (
    <Scr>
      <div className="amx-nav">
        <button className="amx-cir" onClick={ui.back}>{I.back({ s: 22 })}</button>
        <div className="sp" />
        <button className="amx-cir" onClick={(e) => ui.menu(menuAt(e), [{ label: "Share", icon: I.share({ s: 22 }) }])}>{I.dots({ s: 22 })}</button>
      </div>
      <div className="amx-h1 amx-pad" style={{ padding: "6px 20px 2px" }}>Summertime Sounds</div>

      <div className="amx-heroes" style={{ marginTop: 16 }}>
        {HUB_HEROES.map((h) => (
          <div key={h.id} className="amx-hero" onClick={() => ui.play(ANTH, 0, h.t)}>
            <div className="hk">{h.k}</div>
            <div className="ht">{h.t}</div>
            <div className="hs">{h.s}</div>
            <div className="amx-cov">
              <div className="band"><b>SUMMERTIME<br />SOUNDS</b></div>
              <div className="mk" />
              {h.cap ? <div className="cap">{h.cap}</div> : null}
            </div>
          </div>
        ))}
      </div>

      <H2 t="Summer Escapes" onOpen={() => ui.push({ k: "plist" })} />
      <Shelf>
        {SUMMER_ESCAPES.slice(0, 5).map((c) => (
          <ShelfCard key={c.id} id={c.id} t={c.t} s={c.s} onOpen={() => ui.play(ANTH, 0, c.t)} />
        ))}
      </Shelf>

      <H2 t="Summer Anthems" onOpen={() => ui.push({ k: "songs", id: "anthems", title: "Summer Anthems", kind: "track" })} />
      <PagedSongs songs={ANTH}
        onPlay={(i) => ui.play(ANTH, i, "Summer Anthems")}
        onDots={(s, e) => ui.dots("track", s, menuAt(e))} />

      <H2 t="Apple Music Radio Hosts" onOpen={() => { }} />
      <Shelf>
        {HUB_HOSTS.map((c) => (
          <div key={c.id} className="amx-host" onClick={() => ui.play(ANTH, 0, c.t)}>
            <div className="h-tile">
              <div className="h-band"><b>SUMMERTIME<br />SOUNDS</b><i>Music</i></div>
              <Cover id={c.id} cls="h-img" />
            </div>
            <div className="cw-t">{c.t}</div>
            <div className="cw-s">{c.s}</div>
          </div>
        ))}
      </Shelf>

      <H2 t="Summer Albums" onOpen={() => { }} />
      <CardShelf items={SUMMER_ALBUMS} ui={ui} />
    </Scr>
  );
}

/* ── Страница «Summer Escapes» (плейлисты) ────────────────────────────── */
export function PlistScreen({ ui }: { ui: UI }) {
  return (
    <Scr>
      <div className="amx-nav">
        <button className="amx-cir" onClick={ui.back}>{I.back({ s: 22 })}</button>
        <div className="nv-title">Summer Escapes</div>
      </div>
      {SUMMER_ESCAPES.map((c) => <EscapeRow key={c.id} c={c} ui={ui} />)}
    </Scr>
  );
}
function EscapeRow({ c, ui }: { c: Card; ui: UI }) {
  const open = (x: number, y: number) => ui.menu({ x, y }, [
    { label: "Play", icon: I.play({ s: 22 }), onTap: () => ui.play(ANTH, 0, c.t) },
    { label: "Shuffle", icon: I.shuffle({ s: 22 }), onTap: () => ui.play(ANTH, Math.floor(Math.random() * ANTH.length), c.t) },
    { sep: true },
    { label: "Add to a Playlist", icon: I.listAdd({ s: 22 }) },
    { sep: true, thick: true },
    { label: "Suggest Less", icon: I.thumbsDown({ s: 22 }) },
  ], [
    { icon: I.plus({ s: 24 }), label: "Add" },
    { icon: I.star({ s: 24 }), label: "Favourite" },
    { icon: I.share({ s: 24 }), label: "Share" },
  ]);
  const lp = useLongPress(open);
  return (
    <div className="amx-row big" {...lp} onClick={() => ui.play(ANTH, 0, c.t)}>
      <Cover id={c.id} cls="r-art" />
      <div className="r-c">
        <div className="r-t">{c.t}</div>
        <div className="r-s">{c.s}</div>
      </div>
      <Dots onTap={(e) => { const a = menuAt(e); open(a.x, a.y); }} />
    </div>
  );
}

/* ── Универсальная страница списка песен ──────────────────────────────── */
const SONG_LISTS: Record<string, Song[]> = { bns: BEST_NEW_SONGS, anthems: ANTH };
export function SongsScreen({ ui, id, title, kind }: { ui: UI; id: string; title: string; kind: "editorial" | "track" }) {
  const songs = SONG_LISTS[id] ?? [];
  return (
    <Scr>
      <div className="amx-nav">
        <button className="amx-cir" onClick={ui.back}>{I.back({ s: 22 })}</button>
        <div className="nv-title">{title}</div>
      </div>
      {songs.map((s, i) => (
        <SongRow key={s.id + i} s={s} onPlay={() => ui.play(songs, i, title)}
          onDots={(e) => ui.dots(kind, s, menuAt(e))} />
      ))}
    </Scr>
  );
}

/* ── Страница ссылок («More to explore») ──────────────────────────────── */
export function LinksScreen({ ui, title, items }: { ui: UI; title: string; items: string[] }) {
  return (
    <Scr>
      <div className="amx-nav">
        <button className="amx-cir" onClick={ui.back}>{I.back({ s: 22 })}</button>
        <div className="nv-title">{title}</div>
      </div>
      <div className="amx-links" style={{ marginTop: 8 }}>
        {items.map((l) => (
          <button key={l} className="amx-link" style={{ width: "100%" }}
            onClick={() => ui.push({ k: "genre", g: l })}>{l}{I.chev({ s: 16, w: 2.4 })}</button>
        ))}
      </div>
    </Scr>
  );
}

/* ── Шоу «Radio Takeover» ─────────────────────────────────────────────── */
export function ShowScreen({ ui }: { ui: UI }) {
  return (
    <Scr>
      <div className="amx-nav">
        <button className="amx-cir" onClick={ui.back}>{I.back({ s: 22 })}</button>
        <div className="nv-title lft" style={{ color: "var(--g2)", fontSize: 20 }}>Radio Takeover</div>
      </div>
      <div className="amx-tkbig" onClick={() => ui.play(ALL_SONGS, 0, "Radio Takeover")}>
        <Cover id={TAKEOVER.id} style={{ position: "absolute", inset: 0 }} />
        <div className="cap">{TAKEOVER.cap}</div>
      </div>
      <H2 t="Concerts" />
      <ConcertsCard />
    </Scr>
  );
}

/* ── Оверлей поиска ───────────────────────────────────────────────────── */
/* В6 · Поиск по четырём мирам базы: голоса (катха + киртании) → книги →
   циклы лекций → киртаны → бхаджаны. Источники — те же клиентские реестры,
   что кормят вкладки (каталог Ц12, kirtans.ts, BOOKS, /api/bhajans одним
   кэшем); дорожки катхи глубоким поиском здесь НЕ ищем — 6 908 названий на
   каждый ввод дороги, глубокий поиск остаётся у раздела Катхи. Недавние
   запросы — MStore.rec. Deep-link: /play/search?q=… наполняет строку. */
const tracksIdx = (albumId: string, trackId: string): number => {
  const alb = kirtanAlbums().find((a) => a.id === albumId);
  const list = alb ? kirtanTracks().filter((t) => t.identifier === alb.archive) : [];
  return Math.max(0, list.findIndex((t) => t.id === trackId));
};
let _bhCache: { slug: string; name: string; author: string | null; has_recordings: boolean }[] | null = null;
function ensureBhajans(bump: () => void): void {
  if (_bhCache) return;
  fetch(api("/bhajans")).then((r) => r.json())
    .then((d: { bhajans?: typeof _bhCache }) => { if (d?.bhajans) { _bhCache = d.bhajans; bump(); } })
    .catch(() => {});
}

export function FindScreen({ ui, onClose }: { ui: UI; onClose: () => void }) {
  const [q, setQ] = useState(() => {
    try { return new URLSearchParams(window.location.search).get("q") ?? ""; } catch { return ""; }
  });
  const [, bump] = useState(0);
  const store = useStore();
  const core = useCore();
  useKatha();
  useKirtans();
  React.useEffect(() => { void loadCatalog(); ensureBhajans(() => bump((n) => n + 1)); }, []);

  const res = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return null;
    const hit = (s?: string | null) => !!s && s.toLowerCase().includes(n);
    const strong = (s?: string | null) => !!s && s.toLowerCase().startsWith(n);
    const voices = [
      ...kathaSpeakers().map((s) => ({ kind: "speaker" as const, slug: s.slug, name: s.name, full: s.full, accent: s.accent })),
      ...KIRTAN_ARTISTS.map((a) => ({ kind: "kart" as const, slug: a.slug, name: a.name, full: a.full, accent: a.accent })),
    ].filter((v) => hit(v.name) || hit(v.full));
    const books = Object.values(BOOKS)
      .filter((b) => AUDIO_WORKS[b.work] && (hit(bookFullTitle(b)) || hit(b.author)));
    const kalbums = kathaAlbums().filter((a) => hit(a.title));
    const kirtA = kirtanAlbums().filter((a) => a.archive && hit(a.title));
    const kirtT = kirtanTracks().filter((t) => hit(t.title)).slice(0, 8);
    const bh = (_bhCache ?? []).filter((b) => hit(b.name) || hit(b.author));
    type Top = { label: string; sub: string; onTap: () => void };
    const top: Top | null =
      voices.find((v) => strong(v.name)) ? (() => { const v = voices.find((x) => strong(x.name))!; return { label: v.name, sub: "Голос", onTap: () => ui.push(v.kind === "speaker" ? { k: "speaker", slug: v.slug } : { k: "kart", slug: v.slug }) }; })()
      : books.find((b) => strong(bookFullTitle(b))) ? (() => { const b = books.find((x) => strong(bookFullTitle(x)))!; return { label: bookFullTitle(b), sub: "Книга", onTap: () => ui.push({ k: "book", b: b.work }) }; })()
      : kalbums.find((a) => strong(a.title)) ? (() => { const a = kalbums.find((x) => strong(x.title))!; return { label: a.title, sub: "Цикл лекций", onTap: () => ui.push({ k: "kalbum", id: a.id }) }; })()
      : bh.find((b) => strong(b.name)) ? (() => { const b = bh.find((x) => strong(x.name))!; return { label: b.name, sub: "Бхаджан", onTap: () => b.has_recordings ? core.playBhajan(b.slug, 0) : window.location.assign(ROUTES.bhajans(b.slug)) }; })()
      : null;
    return { voices: voices.slice(0, 8), books: books.slice(0, 8), kalbums: kalbums.slice(0, 8), kirtA: kirtA.slice(0, 8), kirtT, bh: bh.slice(0, 10), top };
  }, [q, ui, core]);

  const commit = () => {
    const n = q.trim();
    if (!n) return;
    mutate((s) => ({ ...s, rec: [n, ...s.rec.filter((r) => r !== n)].slice(0, 12) }));
  };
  const Row = ({ t, s, onTap, red }: { t: string; s?: string; onTap: () => void; red?: boolean }) => (
    <div className="amx-row" onClick={() => { commit(); onTap(); }}>
      <div className="r-c" style={{ paddingLeft: 20 }}>
        <div className="r-t">{t}</div>{s ? <div className="r-s">{s}</div> : null}
      </div>
      <span style={{ color: red ? "var(--red)" : "var(--g2)", paddingRight: 16 }}>{red ? I.play({ s: 18 }) : I.chev({ s: 16 })}</span>
    </div>
  );

  return (
    <div style={{ position: "absolute", inset: 0, background: "#000" }}>
      {q.trim() && res ? (
        <div className="amx-results">
          {res.top ? (<>
            <div className="amx-h2 plain" style={{ paddingTop: 10 }}>Топ-результат</div>
            <Row t={res.top.label} s={res.top.sub} onTap={res.top.onTap} />
          </>) : null}
          {res.voices.length ? (<>
            <div className="amx-h2 plain">Голоса</div>
            <div className="amx-sprow">
              {res.voices.map((v) => (
                <VoiceDot key={v.kind + v.slug} name={v.name} accent={v.accent}
                  onTap={() => { commit(); ui.push(v.kind === "speaker" ? { k: "speaker", slug: v.slug } : { k: "kart", slug: v.slug }); }} />
              ))}
            </div>
          </>) : null}
          {res.books.length ? (<>
            <div className="amx-h2 plain">Книги</div>
            {res.books.map((b) => <Row key={b.work} t={bookFullTitle(b)} s={b.author.split(",")[0]} onTap={() => ui.push({ k: "book", b: b.work })} />)}
          </>) : null}
          {res.kalbums.length ? (<>
            <div className="amx-h2 plain">Циклы лекций</div>
            {res.kalbums.map((a) => <Row key={a.id} t={a.title} s={`${a.n} зап.`} onTap={() => ui.push({ k: "kalbum", id: a.id })} />)}
          </>) : null}
          {res.kirtA.length ? (<>
            <div className="amx-h2 plain">Киртаны</div>
            {res.kirtA.map((a) => <Row key={a.id} t={a.title} s={a.year} onTap={() => ui.push({ k: "kalb", id: a.id })} />)}
          </>) : null}
          {res.kirtT.length ? (<>
            <div className="amx-h2 plain">Записи киртанов</div>
            {res.kirtT.map((t) => {
              const alb = kirtanAlbums().find((a) => a.archive === t.identifier);
              return alb ? <Row key={t.id} t={t.title} red onTap={() => core.playKirtan(alb.id, tracksIdx(alb.id, t.id))} /> : null;
            })}
          </>) : null}
          {res.bh.length ? (<>
            <div className="amx-h2 plain">Бхаджаны</div>
            {res.bh.map((b) => (
              <Row key={b.slug} t={b.name} s={b.author ?? undefined} red={b.has_recordings}
                onTap={() => b.has_recordings ? core.playBhajan(b.slug, 0) : window.location.assign(ROUTES.bhajans(b.slug))} />
            ))}
          </>) : null}
          {!res.top && !res.voices.length && !res.books.length && !res.kalbums.length && !res.kirtA.length && !res.kirtT.length && !res.bh.length ? (
            <div className="amx-find-empty" style={{ position: "static", marginTop: "26vh" }}>
              <div className="et">Ничего не нашлось</div>
              <div className="ed">Попробуй другое слово.</div>
            </div>
          ) : null}
        </div>
      ) : store.rec.length ? (
        <div className="amx-results">
          <div className="amx-h2 plain" style={{ paddingTop: 10 }}>Недавние запросы</div>
          {store.rec.map((r) => (
            <button key={r} className="amx-row" style={{ width: "100%", minHeight: 56 }} onClick={() => setQ(r)}>
              <span style={{ color: "var(--g2)" }}>{I.search({ s: 18 })}</span>
              <div className="r-c" style={{ textAlign: "left" }}><div className="r-t">{r}</div></div>
            </button>
          ))}
          <button className="amx-link amx-pad" onClick={() => mutate((s) => ({ ...s, rec: [] }))}>Очистить недавние</button>
        </div>
      ) : (
        <div className="amx-find-empty">
          <span style={{ color: "rgba(235,235,245,.45)" }}>{I.search({ s: 52, w: 1.6 })}</span>
          <div className="et">No Recent Searches</div>
          <div className="ed">Your recent searches will appear here.</div>
        </div>
      )}

      <div className="amx-findbar">
        <div className="amx-sfield">
          <span style={{ color: "rgba(235,235,245,.5)" }}>{I.search({ s: 19 })}</span>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Книги, лекции, киртаны, бхаджаны"
            onKeyDown={(e) => { if (e.key === "Enter") commit(); }} />
          {q ? (
            <button onClick={() => setQ("")} style={{ color: "rgba(235,235,245,.5)" }}>{I.x({ s: 17 })}</button>
          ) : (
            <span style={{ color: "rgba(235,235,245,.6)" }}>{I.mic({ s: 20 })}</span>
          )}
        </div>
        <button className="amx-cir" onClick={onClose}>{I.x({ s: 20 })}</button>
      </div>
    </div>
  );
}

/* П-Ф3 → В3: страница книги — обложка, Слушать/Читать, тумблер режима,
   канто-секции для ШБ (манифест несёт `cantos`, треки грузятся по ?canto=),
   треклист ГЛАВАМИ (ШБ озвучен стих-за-стихом — 784 ряда на песнь были бы
   свалкой; ряд = глава, счёт стихов в подписи), кольцо прослушанности
   (авторизованному — /api/me/list?type=listening; ref трека = pathname его
   url — то же, что пишет recordListen), ⋯-меню ряда: Скачать · Избранное ·
   К тексту (адрес — только chapterPath, ЗКН-Н092). */

interface ListenMark { p: number; d: number }

function Ring({ frac }: { frac: number }) {
  const R = 8, C = 2 * Math.PI * R;
  const f = Math.max(0, Math.min(1, frac));
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" style={{ flex: "0 0 auto", transform: "rotate(-90deg)" }}>
      <circle cx="10" cy="10" r={R} fill="none" stroke="rgba(235,235,245,.28)" strokeWidth="2" />
      {f > 0.005 ? (
        <circle cx="10" cy="10" r={R} fill="none" stroke="var(--red)" strokeWidth="2"
          strokeDasharray={`${C * f} ${C}`} strokeLinecap="round" />
      ) : null}
    </svg>
  );
}

export function BookScreen({ ui, b }: { ui: UI; b: string }) {
  const core = useCore();
  const { user } = useAuth();
  const book = BOOKS[b];
  const [mode, setMode] = useState<AudioMode>("plain");
  const [canto, setCanto] = useState<number | null>(null);
  const [cantos, setCantos] = useState<{ canto: number; label: string }[] | null>(null);
  const [tracks, setTracks] = useState<CoreTrack[] | null>(null);
  const [meta, setMeta] = useState<{ hasCommentary?: boolean }>({});
  const [marks, setMarks] = useState<Record<string, ListenMark>>({});
  const [menu, setMenu] = useState<{ at: { x: number; y: number }; items: MItem[] } | null>(null);

  React.useEffect(() => {
    let dead = false;
    const q = canto != null ? `?canto=${canto}` : "";
    fetch(api(`/books/${b}/audio${q}`)).then((r) => r.json()).then((m) => {
      if (dead) return;
      const md = mode === "commentary" && m.modes?.commentary ? "commentary" : "plain";
      const list = (m.modes?.[md]?.tracks ?? []) as CoreTrack[];
      setTracks(Array.isArray(list) ? list : []);
      setMeta({ hasCommentary: !!m.modes?.commentary });
      if (Array.isArray(m.cantos) && m.cantos.length) {
        setCantos(m.cantos as { canto: number; label: string }[]);
        if (canto == null) setCanto((m.cantos[0] as { canto: number }).canto);
      }
    }).catch(() => { if (!dead) setTracks([]); });
    return () => { dead = true; };
  }, [b, mode, canto]);

  /* Кольца: след прослушивания вошедшего. Ключ — pathname URL записи. */
  React.useEffect(() => {
    if (!user) return;
    let dead = false;
    fetch(api("/me/list?type=listening&limit=200"), { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { items?: { ref: string; position_sec: number | null; duration_sec: number | null }[] } | null) => {
        if (dead || !d?.items) return;
        const m: Record<string, ListenMark> = {};
        for (const it of d.items) m[it.ref] = { p: it.position_sec ?? 0, d: it.duration_sec ?? 0 };
        setMarks(m);
      }).catch(() => {});
    return () => { dead = true; };
  }, [user]);

  const refOf = (tr: CoreTrack) => { try { return new URL(tr.url).pathname; } catch { return tr.url; } };

  /* Ряды: у ШБ (стих-за-стихом) — главами; у остальных трек и есть глава. */
  const rows = React.useMemo(() => {
    const list = (tracks ?? []).filter((t) => t.kind !== "song");
    if (b !== "sb") return list.map((t) => ({ t, verses: 0, done: 0 }));
    const by = new Map<number, { t: CoreTrack; verses: number; done: number }>();
    for (const t of list) {
      const ch = t.chapter ?? 0;
      const cur = by.get(ch);
      const heard = marks[refOf(t)] ? 1 : 0;
      if (cur) { cur.verses += 1; cur.done += heard; }
      else by.set(ch, { t, verses: 1, done: heard });
    }
    return [...by.values()];
  }, [tracks, b, marks]);

  const ringFor = (r: { t: CoreTrack; verses: number; done: number }): number | null => {
    if (!user) return null;
    if (r.verses > 1) return r.done > 0 ? r.done / r.verses : null;   /* глава ШБ: доля стихов */
    const m = marks[refOf(r.t)];
    if (!m) return null;
    return m.d > 0 ? m.p / m.d : 1;                                    /* запись: позиция/длительность */
  };

  const rowMenu = (e: React.MouseEvent, r: { t: CoreTrack }) => {
    e.stopPropagation();
    const tr = r.t;
    const key = mediaTrackKey(tr, "book");
    const fav = isFavorite(key);
    const text = tr.chapter == null ? bookPath(b)
      : chapterPath(b, { divisionId: tr.lila ? `${b}.${tr.lila}.${tr.chapter}` : null, number: tr.chapter });
    setMenu({
      at: menuAt(e),
      items: [
        { label: fav ? "Убрать из избранного" : "В избранное", icon: fav ? I.starF({ s: 22 }) : I.star({ s: 22 }),
          onTap: () => { if (fav) removeFavorite(key); else addFavorite(key, { t: tr.title, s: book ? bookFullTitle(book) : undefined }); } },
        { sep: true },
        { label: "Скачать запись", icon: I.listAdd({ s: 22 }),
          onTap: () => { const a = document.createElement("a"); a.href = tr.url; a.download = tr.file; a.click(); } },
        { sep: true },
        { label: "К тексту", sub: tr.title, icon: I.album({ s: 22 }),
          onTap: () => window.location.assign(text) },
      ],
    });
  };

  if (!book) return null;
  return (
    <Scr>
      <div className="amx-nav">
        <button className="amx-cir" onClick={ui.back}>{I.back({ s: 22 })}</button>
        <div className="nv-title" />
      </div>
      <div style={{ padding: "0 20px", textAlign: "center" }}>
        <img src={book.covers[0]} alt="" style={{ width: 232, height: 232, borderRadius: 10, objectFit: "cover", boxShadow: "0 14px 40px rgba(0,0,0,.5)" }} />
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.26px", marginTop: 16 }}>{book.titleLine1}{book.titleLine2 ? ` ${book.titleLine2}` : ""}</div>
        <div style={{ fontSize: 15, color: "var(--g2)", marginTop: 2 }}>{book.author}</div>
        <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
          <button className="amx-capsule" onClick={() => { if (canto != null) core.playChapter(b, rows[0]?.t.chapter ?? 1, mode, String(canto)); else core.playBook({ book: b, mode, expand: false }); }}>
            {I.play({ s: 18 })}<span>Слушать</span>
          </button>
          <button className="amx-capsule" onClick={() => window.location.assign(bookPath(book.work))}>
            {I.lib({ s: 18 })}<span>Читать</span>
          </button>
        </div>
        {meta.hasCommentary ? (
          <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "center" }}>
            {(["plain", "commentary"] as AudioMode[]).map((m) => (
              <button key={m} className={"amx-chip" + (mode === m ? " on" : "")} onClick={() => setMode(m)}>
                {m === "plain" ? "Текст" : "С комментарием"}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* В3: песни ШБ — чипы канто, треки грузятся по ?canto= */}
      {cantos && cantos.length > 1 ? (
        <div className="amx-cantos">
          {cantos.map((c) => (
            <button key={c.canto} className={"amx-chip" + (canto === c.canto ? " on" : "")}
              onClick={() => { setTracks(null); setCanto(c.canto); }}>
              {`Песнь ${c.canto}`}
            </button>
          ))}
        </div>
      ) : null}

      <div style={{ marginTop: 18 }}>
        {rows.map((r, i) => {
          const frac = ringFor(r);
          return (
            <div key={r.t.file + i} className="amx-row"
              onClick={() => { core.playChapter(b, r.t.chapter ?? 0, mode, r.t.lila, r.t.ref ?? null); }}>
              <div className="r-num">{r.t.chapter ?? "·"}</div>
              <div className="r-c">
                <div className="r-t">{r.verses > 1 && r.t.groupLabel ? r.t.groupLabel : r.t.title}</div>
                {r.verses > 1
                  ? <div className="r-s">{`Стихов: ${r.verses}`}{r.done > 0 ? ` · прослушано ${r.done}` : ""}</div>
                  : r.t.lilaLabel ? <div className="r-s">{r.t.lilaLabel}</div> : null}
              </div>
              {frac != null ? <Ring frac={frac} /> : null}
              <Dots onTap={(e) => rowMenu(e, r)} />
            </div>
          );
        })}
      </div>

      {menu ? <Menu at={menu.at} items={menu.items} onClose={() => setMenu(null)} /> : null}
    </Scr>
  );
}
