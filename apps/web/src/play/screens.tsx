/* /play — экраны вкладок и внутренние страницы. */
import React, { useMemo, useState } from "react";
import { Ava, Cover, Dots, E, H2, I, PagedSongs, Scr, Shelf, ShelfCard, SongRow, menuAt, mutate, useLongPress, useStore } from "./core";
import { BOOKS } from "../books";
import { usePlayer as useCore } from "../player/store";
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
export function HomeScreen({ ui }: { ui: UI }) {
  const core = useCore();
  return (
    <Scr>
      <div className="amx-top"><div className="amx-h1">Книги</div><Ava /></div>

      {/* П-Ф2: живая библиотека — реальные обложки, реальный звук (playBook) */}
      <H2 t="Библиотека" />
      <Shelf>
        {Object.values(BOOKS).map((b) => (
          <ShelfCard key={b.work} id={"bk-" + b.work} src={b.covers[0]} t={b.titleLine1}
            s={b.tagline} onOpen={() => core.playBook({ book: b.work, expand: false })} />
        ))}
      </Shelf>

      <H2 t="Top Picks for You" />
      <Shelf>
        {TOP_PICKS.map((p) => (
          <div key={p.id} className="amx-pick" onClick={() => ui.play(BEST_NEW_SONGS, 0, p.t)}
            style={{ background: `radial-gradient(130% 110% at 50% 0%, hsl(${p.hue} 72% 50%) 0%, hsl(${p.hue} 68% 37%) 55%, hsl(${(p.hue + 14) % 360} 66% 22%) 100%)` }}>
            <div className="brand">Music</div>
            <div className="bub" style={{ left: "9%", top: "7%", width: "56%", aspectRatio: "1" }}><Cover id={p.id + "1"} /></div>
            <div className="bub" style={{ right: "8%", top: "38%", width: "34%", aspectRatio: "1" }}><Cover id={p.id + "2"} /></div>
            <div className="bub" style={{ left: "24%", top: "52%", width: "26%", aspectRatio: "1" }}><Cover id={p.id + "3"} /></div>
            <div className="pk" style={{ color: `hsl(${p.hue} 92% 80%)` }}>{p.k}</div>
            <div className="pt">{p.t}</div>
          </div>
        ))}
      </Shelf>

      <H2 t="Find Your Mood" />
      <Shelf>
        {MOODS.map((m) => (
          <div key={m.id} className="amx-mood" onClick={() => ui.play(ALL_SONGS, 0, `${m.t} Station`)}>
            <div className="tile" style={{ background: m.bg, color: "#F4ECC9" }}>
              <div className="brand">Music</div>
              {m.glyph === "bolt" ? I.bolt({ s: 108 }) : m.glyph === "heart" ? I.heart({ s: 112 }) : (
                <div style={{ position: "absolute", right: -56, top: "50%", transform: "translateY(-50%)" }}>
                  <svg width="150" height="150" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2.6 2.2" strokeLinecap="round">
                    <path d="M12 20.2C7 16.4 3.6 13.2 3.6 9.5A4.5 4.5 0 0 1 8.1 5c1.6 0 3 .8 3.9 2.1A4.7 4.7 0 0 1 15.9 5a4.5 4.5 0 0 1 4.5 4.5c0 3.7-3.4 6.9-8.4 10.7Z" />
                  </svg>
                </div>
              )}
            </div>
            <div className="mt">{m.t}</div>
            <div className="ms">{m.s}</div>
          </div>
        ))}
      </Shelf>

      <H2 t="Radio Takeover" />
      <div className="amx-tkbig" onClick={() => ui.push({ k: "show" })}>
        <Cover id={TAKEOVER.id} style={{ position: "absolute", inset: 0 }} />
        <div className="cap">{TAKEOVER.cap}</div>
      </div>

      <H2 t="Concerts" />
      <ConcertsCard />
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
export function FindScreen({ ui, onClose }: { ui: UI; onClose: () => void }) {
  const [seg, setSeg] = useState<"am" | "lib">("am");
  const [q, setQ] = useState("");
  const store = useStore();
  const res = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return [];
    return ALL_SONGS.filter((s) => s.t.toLowerCase().includes(n) || s.a.toLowerCase().includes(n)).slice(0, 40);
  }, [q]);
  const commit = () => {
    const n = q.trim();
    if (!n) return;
    mutate((s) => ({ ...s, rec: [n, ...s.rec.filter((r) => r !== n)].slice(0, 12) }));
  };
  return (
    <div style={{ position: "absolute", inset: 0, background: "#000" }}>
      <div className="amx-seg">
        <button className={seg === "am" ? "on" : ""} onClick={() => setSeg("am")}>Apple Music</button>
        <button className={seg === "lib" ? "on" : ""} onClick={() => setSeg("lib")}>Library</button>
      </div>

      {q.trim() ? (
        <div className="amx-results">
          {res.map((s, i) => (
            <SongRow key={s.id + i} s={s}
              onPlay={() => { commit(); ui.play(res, i, "Search"); }}
              onDots={(e) => ui.dots("track", s, menuAt(e))} />
          ))}
          {res.length === 0 ? (
            <div className="amx-find-empty" style={{ position: "static", marginTop: "26vh" }}>
              <div className="et">No Results</div>
              <div className="ed">Try a new search.</div>
            </div>
          ) : null}
        </div>
      ) : store.rec.length ? (
        <div className="amx-results">
          <div className="amx-h2 plain" style={{ paddingTop: 10 }}>Recently Searched</div>
          {store.rec.map((r) => (
            <button key={r} className="amx-row" style={{ width: "100%", minHeight: 56 }} onClick={() => setQ(r)}>
              <span style={{ color: "var(--g2)" }}>{I.search({ s: 18 })}</span>
              <div className="r-c" style={{ textAlign: "left" }}><div className="r-t">{r}</div></div>
            </button>
          ))}
          <button className="amx-link amx-pad" onClick={() => mutate((s) => ({ ...s, rec: [] }))}>Clear Recent Searches</button>
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
            placeholder={seg === "am" ? "Artists, Songs, Lyrics and More" : "Your Library"}
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
