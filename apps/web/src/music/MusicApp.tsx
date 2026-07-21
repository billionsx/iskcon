/* /music — корневая оболочка клона Apple Music (iOS 26, тёмная тема).
   Полностью изолирована от приложения ONE LOVE: монтируется из main.tsx
   вместо App, живёт по адресам /music/*, своя история и свой док. */
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./music.css";
import { I, Menu, MItem, MQuick, ScrollCtx, mutate, storeNow, useStore, shuffled } from "./core";
import { ALL_SONGS, Song } from "./data";
import { FullPlayer, MiniPlayer, PlayerProvider, usePlayer } from "./player";
import {
  FindScreen, GenreScreen, HomeScreen, HubScreen, LinksScreen, NewScreen,
  PlistScreen, RadioScreen, SearchTab, ShowScreen, SongsScreen,
} from "./screens";
import { LibListScreen, LibraryScreen, NewPlaylistSheet, PlaylistPicker, UserPlaylistScreen } from "./library";

export type Tab = "home" | "new" | "radio" | "library" | "search";
export type Pg =
  | { k: "tab"; t: Tab }
  | { k: "hub" }
  | { k: "plist" }
  | { k: "songs"; id: string; title: string; kind: "editorial" | "track" }
  | { k: "genre"; g: string }
  | { k: "show" }
  | { k: "links"; title: string; items: string[] }
  | { k: "lib"; id: "playlists" | "artists" | "albums" | "songs" }
  | { k: "upl"; id: string }
  | { k: "find" };

export type UI = {
  push: (pg: Pg) => void;
  back: () => void;
  play: (songs: Song[], i: number, src: string) => void;
  dots: (kind: "editorial" | "track", s: { id?: string; t: string; a?: string }, at: { x: number; y: number }) => void;
  menu: (at: { x: number; y: number }, items: MItem[], quick?: MQuick[]) => void;
  fav: (id: string) => void;
  isFav: (id: string) => boolean;
  addToPl: (songId: string) => void;
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, "-").replace(/^-+|-+$/g, "");
function urlFor(pg: Pg): string {
  switch (pg.k) {
    case "tab": return pg.t === "home" ? "/music" : pg.t === "search" ? "/music/browse" : `/music/${pg.t}`;
    case "hub": return "/music/summertime-sounds";
    case "plist": return "/music/summer-escapes";
    case "songs": return pg.id === "bns" ? "/music/best-new-songs" : "/music/summer-anthems";
    case "genre": return `/music/station/${slug(pg.g)}`;
    case "show": return "/music/radio-takeover";
    case "links": return "/music/explore";
    case "lib": return `/music/library/${pg.id}`;
    case "upl": return `/music/playlist/${pg.id}`;
    case "find": return "/music/search";
  }
}
function parseStack(path: string): Pg[] {
  const p = path.replace(/^\/music\/?/, "").replace(/\/+$/, "");
  const tab = (t: Tab): Pg => ({ k: "tab", t });
  if (!p) return [tab("home")];
  if (p === "new") return [tab("new")];
  if (p === "radio") return [tab("radio")];
  if (p === "library") return [tab("library")];
  if (p === "browse") return [tab("search")];
  if (p === "search") return [tab("home"), { k: "find" }];
  if (p === "summertime-sounds") return [tab("search"), { k: "hub" }];
  if (p === "summer-escapes") return [tab("search"), { k: "hub" }, { k: "plist" }];
  if (p === "summer-anthems") return [tab("search"), { k: "hub" }, { k: "songs", id: "anthems", title: "Summer Anthems", kind: "track" }];
  if (p === "best-new-songs") return [tab("new"), { k: "songs", id: "bns", title: "Best New Songs", kind: "editorial" }];
  if (p === "radio-takeover") return [tab("home"), { k: "show" }];
  if (p === "explore") return [tab("new"), { k: "links", title: "More to explore", items: [] }];
  if (p.startsWith("library/")) {
    const id = p.split("/")[1] as "playlists" | "artists" | "albums" | "songs";
    return [tab("library"), { k: "lib", id: (["playlists", "artists", "albums", "songs"] as const).includes(id) ? id : "playlists" }];
  }
  if (p.startsWith("playlist/")) return [tab("library"), { k: "lib", id: "playlists" }, { k: "upl", id: p.split("/")[1] }];
  if (p.startsWith("station/")) return [tab("radio"), { k: "genre", g: decodeURIComponent(p.split("/")[1]).replace(/-/g, " ") }];
  return [tab("home")];
}

const TAB_ICON: Record<Tab, (s?: number) => React.ReactNode> = {
  home: (s) => I.house({ s }), new: (s) => I.grid({ s }), radio: (s) => I.radio({ s }),
  library: (s) => I.lib({ s }), search: (s) => I.lib({ s }),
};

function Shell() {
  const player = usePlayer();
  const store = useStore();
  const [stack, setStack] = useState<Pg[]>(() => parseStack(window.location.pathname));
  const stackRef = useRef(stack); stackRef.current = stack;
  const [sc, setSc] = useState(false);
  const [navDir, setNavDir] = useState<"fwd" | "back" | "tab">("tab");  /* 🎞 §5.9 */
  /* 🎞 §5.10: док сворачивает НАПРАВЛЕНИЕ прокрутки (вниз — компакт, вверх —
     полный), у кромки верха всегда полный. Порог 24px был выдумкой. */
  const lastY = useRef<number | null>(null);
  const acc = useRef(0);
  const onScrollY = (y: number) => {
    if (y < 10) { lastY.current = y; acc.current = 0; setSc(false); return; }
    const prev = lastY.current; lastY.current = y;
    if (prev == null) return;
    const dy = y - prev;
    if (dy === 0) return;
    acc.current = (acc.current > 0) === (dy > 0) ? acc.current + dy : dy;
    if (acc.current > 14) setSc(true);
    else if (acc.current < -14) setSc(false);
  };
  const [plOpen, setPlOpen] = useState(false);
  const [menu, setMenu] = useState<{ at: { x: number; y: number }; items: MItem[]; quick?: MQuick[] } | null>(null);
  const [addFor, setAddFor] = useState<string | null>(null);
  const [newPl, setNewPl] = useState<{ pending: string | null } | null>(null);

  /* история: глубина стека в state, назад/вперёд браузера работают */
  useEffect(() => {
    window.history.replaceState({ amx: stackRef.current.length }, "", urlFor(stackRef.current[stackRef.current.length - 1]));
    const onPop = (e: PopStateEvent) => {
      const d = typeof (e.state as { amx?: number } | null)?.amx === "number" ? (e.state as { amx: number }).amx : 1;
      setStack((s) => { if (d < s.length) { setNavDir("back"); return s.slice(0, Math.max(1, d)); } return s; });
    };
    window.addEventListener("popstate", onPop);
    const onAdd = (e: Event) => setAddFor((e as CustomEvent<string>).detail);
    window.addEventListener("amx:add-to-pl", onAdd);
    return () => { window.removeEventListener("popstate", onPop); window.removeEventListener("amx:add-to-pl", onAdd); };
  }, []);

  const push = (pg: Pg) => {
    setNavDir("fwd");
    setStack((s) => { const n = [...s, pg]; window.history.pushState({ amx: n.length }, "", urlFor(pg)); return n; });
    setSc(false);
  };
  const back = () => { if (stackRef.current.length > 1) window.history.back(); };
  const setTab = (t: Tab) => {
    const base: Pg = { k: "tab", t };
    setNavDir("tab");
    setStack([base]); setSc(false);
    window.history.replaceState({ amx: 1 }, "", urlFor(base));
  };

  const fav = (id: string) => mutate((s) => {
    const f = { ...s.fav };
    if (f[id]) delete f[id]; else f[id] = 1;
    return { ...s, fav: f };
  });

  const ui: UI = useMemo(() => ({
    push, back,
    play: (songs, i, src) => player.playList(songs, i, src),
    fav, isFav: (id) => !!storeNow().fav[id],
    addToPl: (songId) => setAddFor(songId),
    menu: (at, items, quick) => setMenu({ at, items, quick }),
    dots: (kind, s, at) => {
      const sid = s.id ?? "";
      const station: MItem = {
        label: "Create Station", icon: I.station({ s: 22 }),
        onTap: () => player.playList(shuffled(ALL_SONGS), 0, `${s.a ?? s.t} Station`),
      };
      const toPl: MItem = { label: "Add to a Playlist", icon: I.listAdd({ s: 22 }), onTap: () => sid && setAddFor(sid) };
      if (kind === "editorial") {
        setMenu({
          at, items: [
            { label: "Share", icon: I.share({ s: 22 }) },
            { sep: true },
            toPl,
            { sep: true },
            station,
            { sep: true },
            { label: "Go to Album", sub: s.t, icon: I.album({ s: 22 }) },
            { label: "View Credits", icon: I.info({ s: 22 }) },
          ],
        });
      } else {
        setMenu({
          at,
          quick: [
            { icon: I.plus({ s: 24 }), label: "Add" },
            { icon: storeNow().fav[sid] ? I.starF({ s: 24 }) : I.star({ s: 24 }), label: "Favourite", onTap: () => sid && fav(sid) },
            { icon: I.share({ s: 24 }), label: "Share" },
          ],
          items: [
            toPl,
            { sep: true },
            station,
            { sep: true },
            { label: "Go to Album", sub: `${s.t} - Single`, icon: I.album({ s: 22 }) },
            { label: "View Credits", icon: I.info({ s: 22 }) },
            { sep: true, thick: true },
            { label: "Suggest Less", icon: I.thumbsDown({ s: 22 }) },
          ],
        });
      }
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [player.playList]);

  const top = stack[stack.length - 1];
  const baseTab: Tab = stack[0].k === "tab" ? (stack[0] as { k: "tab"; t: Tab }).t : "home";
  const isFind = top.k === "find";
  const isSearchRoot = stack.length === 1 && baseTab === "search";

  return (
    <div className="amx">
      <div className="amx-frame">
      <div className={"amx-under" + (plOpen ? " dip" : "")}>
      <ScrollCtx.Provider value={onScrollY}>
        <div key={stack.map((p) => p.k + ("t" in p ? (p as { t: string }).t : "") + ("id" in p ? (p as { id: string }).id : "") + ("g" in p ? (p as { g: string }).g : "")).join("|")} className={"amx-screen nav-" + navDir}>
          {top.k === "tab" ? (
            top.t === "home" ? <HomeScreen ui={ui} /> :
            top.t === "new" ? <NewScreen ui={ui} /> :
            top.t === "radio" ? <RadioScreen ui={ui} /> :
            top.t === "library" ? <LibraryScreen ui={ui} /> :
            <SearchTab ui={ui} />
          ) : top.k === "hub" ? <HubScreen ui={ui} />
            : top.k === "plist" ? <PlistScreen ui={ui} />
            : top.k === "songs" ? <SongsScreen ui={ui} id={top.id} title={top.title} kind={top.kind} />
            : top.k === "genre" ? <GenreScreen ui={ui} g={top.g} />
            : top.k === "show" ? <ShowScreen ui={ui} />
            : top.k === "links" ? <LinksScreen ui={ui} title={top.title} items={top.items} />
            : top.k === "lib" ? <LibListScreen ui={ui} id={top.id} onNewPlaylist={() => setNewPl({ pending: null })} />
            : top.k === "upl" ? <UserPlaylistScreen ui={ui} id={top.id} />
            : <FindScreen ui={ui} onClose={back} />}
        </div>
      </ScrollCtx.Provider>

      {/* ── Док ─────────────────────────────────────────────────────────── */}
      {isFind ? null : (
        <div className={"amx-dock" + (sc && !isSearchRoot ? " cmp" : "")}>
          {isSearchRoot ? (
            <div className="amx-dockwrap" key="s">
            {/* 📐 IMG_1978: на корне поиска мини-плеер ЕСТЬ, под ним строка
                ввода с банкой слева. Раньше мини-плеер здесь пропадал вовсе. */}
            <MiniPlayer onOpen={() => setPlOpen(true)} />
            <div className="amx-dockrow" style={{ marginTop: 8 }}>
              <button className="amx-cir" onClick={() => setTab("library")}>{I.lib({ s: 26 })}</button>
              <button className="amx-sfield" onClick={() => push({ k: "find" })}>
                <span style={{ color: "rgba(235,235,245,.5)" }}>{I.search({ s: 19 })}</span>
                <span className="ph">Artists, Songs, Lyrics and More</span>
                <span style={{ color: "rgba(235,235,245,.6)" }}>{I.mic({ s: 20 })}</span>
              </button>
            </div>
            </div>
          ) : (
            /* Один DOM на оба состояния: свёртка — превращение, не замена
               (🎞 §5.10, геометрия компакта — 📐 dock_static_mask). */
            <div className="amx-dockwrap" key="f">
              <MiniPlayer onOpen={() => setPlOpen(true)} />
              <div className="amx-tabsrow">
                <div className="amx-tabs">
                  {(["home", "new", "radio", "library"] as Tab[]).map((t) => (
                    <button key={t} className={"amx-tab" + (baseTab === t ? " on" : "")} onClick={() => setTab(t)}>
                      {TAB_ICON[t](26)}
                      <span>{t === "home" ? "Home" : t === "new" ? "New" : t === "radio" ? "Radio" : "Library"}</span>
                    </button>
                  ))}
                </div>
                <button className={"amx-scir" + (baseTab === "search" ? " red" : "")}
                  onClick={() => (baseTab === "search" ? push({ k: "find" }) : setTab("search"))}
                  style={baseTab === "search" ? { color: "var(--red)" } : undefined}>{I.search({ s: 26, w: 2.2 })}</button>
              </div>
            </div>
          )}
        </div>
      )}
      </div>

      {/* ── Полноэкранный плеер ─────────────────────────────────────────── */}
      <FullPlayer open={plOpen} onClose={() => setPlOpen(false)}
        onFav={(s) => fav(s.id)} favOn={(s) => !!store.fav[s.id]} />

      {/* ── Меню и шторки ───────────────────────────────────────────────── */}
      {menu ? <Menu at={menu.at} items={menu.items} quick={menu.quick} onClose={() => setMenu(null)} /> : null}
      {addFor ? (
        <PlaylistPicker songId={addFor} onClose={() => setAddFor(null)}
          onNew={() => { setNewPl({ pending: addFor }); setAddFor(null); }} />
      ) : null}
      {newPl ? <NewPlaylistSheet pendingSong={newPl.pending} onClose={() => setNewPl(null)} /> : null}
      </div>
    </div>
  );
}

export default function MusicShell() {
  return (
    <PlayerProvider>
      <Shell />
    </PlayerProvider>
  );
}
