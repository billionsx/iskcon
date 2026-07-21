/* /music — Библиотека: корневой экран, подстраницы (Playlists · Artists ·
   Albums · Songs), меню + / сортировка / фильтр, пустые состояния,
   создание плейлиста и добавление песен (живое, localStorage). */
import React, { useState } from "react";
import { Ava, Cover, Dots, H2, I, Menu, MItem, Scr, SongRow, menuAt, mutate, useStore } from "./core";
import { ALL_SONGS, Song } from "./data";
import type { UI } from "./MusicApp";

const byId = (id: string): Song | undefined => ALL_SONGS.find((s) => s.id === id);

/* ── Корневой экран Библиотеки ────────────────────────────────────────── */
export function LibraryScreen({ ui }: { ui: UI }) {
  const [sync, setSync] = useState(true);
  const [edit, setEdit] = useState<{ x: number; y: number } | null>(null);
  return (
    <Scr>
      <div className="amx-top">
        <div className="amx-h1">Library</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="amx-pill">
            <button>{I.edit({ s: 22 })}</button>
            <button onClick={(e) => setEdit(menuAt(e))}>{I.dots({ s: 22 })}</button>
          </div>
          <Ava />
        </div>
      </div>

      {sync ? (
        <div className="amx-sync">
          <button className="cx" onClick={() => setSync(false)}>{I.x({ s: 15 })}</button>
          <div className="st">Sync your library across all your devices.</div>
          <button className="sb">Turn On</button>
        </div>
      ) : null}

      {([
        ["Playlists", "playlists", I.queue({ s: 25 })],
        ["Artists", "artists", I.mic({ s: 25 })],
        ["Albums", "albums", I.album({ s: 25 })],
        ["Songs", "songs", I.note({ s: 25 })],
      ] as const).map(([t, id, ic]) => (
        <button key={id} className="amx-librow" style={{ width: "100%" }} onClick={() => ui.push({ k: "lib", id })}>
          <span className="li">{ic}</span>{t}
          <span style={{ marginLeft: "auto", color: "rgba(235,235,245,.3)" }}>{I.chev({ s: 17, w: 2.4 })}</span>
        </button>
      ))}

      {edit ? (
        <Menu at={edit} width={252} onClose={() => setEdit(null)}
          items={[{ label: "Edit Sections", icon: I.edit({ s: 22 }) }]} />
      ) : null}
    </Scr>
  );
}

/* ── Подстраницы Библиотеки ───────────────────────────────────────────── */
type LibId = "playlists" | "artists" | "albums" | "songs";
const TITLES: Record<LibId, string> = { playlists: "Playlists", artists: "Artists", albums: "Albums", songs: "Songs" };

export function LibListScreen({ ui, id, onNewPlaylist }: { ui: UI; id: LibId; onNewPlaylist: () => void }) {
  const store = useStore();
  const [menu, setMenu] = useState<{ at: { x: number; y: number }; kind: "create" | "sort" | "filter" } | null>(null);
  const [grid, setGrid] = useState(id === "albums");
  const [sortBy, setSortBy] = useState(id === "playlists" ? "Playlist Type" : "Artist A-Z");
  const [filter, setFilter] = useState("All");

  const favSongs = ALL_SONGS.filter((s) => store.fav[s.id]);

  const sortItems: MItem[] =
    id === "playlists"
      ? [
        { label: "Grid", check: grid, onTap: () => setGrid(true) },
        { label: "List", check: !grid, onTap: () => setGrid(false) },
        { sep: true, thick: true },
        ...["Title", "Date Added", "Last Played Date", "Updated Date", "Playlist Type"].map((t) => ({ label: t, check: sortBy === t, onTap: () => setSortBy(t) })),
      ]
      : [
        { label: "Grid", check: grid, onTap: () => setGrid(true) },
        { label: "List", check: !grid, onTap: () => setGrid(false) },
        { sep: true, thick: true },
        ...["Title", "Date Added", "Artist A-Z", "Year"].map((t) => ({ label: t, check: sortBy === t, onTap: () => setSortBy(t) })),
      ];
  const filterItems: MItem[] = [`All ${TITLES[id]}`, "Favourites", "Downloads"].map((t, i) => ({
    label: t, check: (i === 0 && filter === "All") || filter === t, onTap: () => setFilter(i === 0 ? "All" : t),
  }));
  const createItems: MItem[] = [
    { label: "Create New Playlist", icon: I.listAdd({ s: 22 }), onTap: onNewPlaylist },
    { sep: true },
    { label: "Create New Folder", icon: I.folder({ s: 22 }), onTap: () => { } },
  ];

  /* «Songs» показывает избранное при «All» и «Favourites»; «Downloads» пуст —
     скачиваний в этой оболочке нет. Прежнее условие дважды проверяло одно и
     то же выражение и не выражало ничего. */
  const showFavSongs = id === "songs" && filter !== "Downloads" && favSongs.length > 0;

  return (
    <Scr>
      <div className="amx-nav">
        <button className="amx-cir" onClick={ui.back}>{I.back({ s: 22 })}</button>
        <div className="sp" />
        <div className="amx-pill">
          {id === "playlists" ? <button onClick={(e) => setMenu({ at: menuAt(e), kind: "create" })}>{I.plus({ s: 22 })}</button> : null}
          <button onClick={(e) => setMenu({ at: menuAt(e), kind: "sort" })}>{I.sort({ s: 21 })}</button>
          <button onClick={(e) => setMenu({ at: menuAt(e), kind: "filter" })}>{I.dots({ s: 22 })}</button>
        </div>
      </div>
      <div className="amx-h1" style={{ padding: "2px 20px 8px" }}>{TITLES[id]}</div>

      {id === "playlists" && store.pl.length > 0 ? (
        grid ? (
          <div className="amx-cats" style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {store.pl.map((p) => (
              <div key={p.id} onClick={() => ui.push({ k: "upl", id: p.id })}>
                <Cover id={p.id} style={{ aspectRatio: "1", borderRadius: 10 }} />
                <div style={{ fontSize: 15, fontWeight: 400, letterSpacing: -.23, marginTop: 8 }}>{p.title}</div>
                <div style={{ fontSize: 13, letterSpacing: -.08, color: "var(--g2)", marginTop: 1 }}>{p.ids.length} songs</div>
              </div>
            ))}
          </div>
        ) : (
          store.pl.map((p) => (
            <div key={p.id} className="amx-row big" onClick={() => ui.push({ k: "upl", id: p.id })}>
              <Cover id={p.id} cls="r-art" />
              <div className="r-c">
                <div className="r-t">{p.title}</div>
                <div className="r-s">{p.ids.length} songs</div>
              </div>
              <span style={{ color: "rgba(235,235,245,.3)" }}>{I.chev({ s: 17, w: 2.4 })}</span>
            </div>
          ))
        )
      ) : id === "songs" && showFavSongs ? (
        favSongs.map((s, i) => (
          <SongRow key={s.id} s={s} onPlay={() => ui.play(favSongs, i, "Favourite Songs")}
            onDots={(e) => ui.dots("track", s, menuAt(e))} />
        ))
      ) : id === "playlists" || id === "artists" ? (
        <div className="amx-empty">
          <span className="ei">{I.cloud({ s: 66 })}</span>
          <div className="et">Syncing Library</div>
          <div className="ed">Once your library has synced, added music will appear here.</div>
        </div>
      ) : (
        <div className="amx-empty">
          <span className="ei">{I.note({ s: 60 })}</span>
          <div className="ed" style={{ marginTop: 14 }}>Music you add from Apple Music, from your computer or that you buy in iTunes will appear here.</div>
          <button className="eb" onClick={() => ui.push({ k: "tab", t: "new" })}>Browse Apple Music</button>
        </div>
      )}

      {menu ? (
        <Menu at={menu.at} narrow={menu.kind !== "create"}
          width={menu.kind === "create" ? 276 : undefined} onClose={() => setMenu(null)}
          items={menu.kind === "create" ? createItems : menu.kind === "sort" ? sortItems : filterItems} />
      ) : null}
    </Scr>
  );
}

/* ── Страница пользовательского плейлиста ─────────────────────────────── */
export function UserPlaylistScreen({ ui, id }: { ui: UI; id: string }) {
  const store = useStore();
  const p = store.pl.find((x) => x.id === id);
  const songs = (p?.ids ?? []).map(byId).filter(Boolean) as Song[];
  return (
    <Scr>
      <div className="amx-nav">
        <button className="amx-cir" onClick={ui.back}>{I.back({ s: 22 })}</button>
        <div className="nv-title">{p?.title ?? "Playlist"}</div>
      </div>
      {songs.length ? songs.map((s, i) => (
        <SongRow key={s.id + i} s={s} onPlay={() => ui.play(songs, i, p?.title ?? "Playlist")}
          onDots={(e) => ui.dots("track", s, menuAt(e))} />
      )) : (
        <div className="amx-empty">
          <span className="ei">{I.note({ s: 60 })}</span>
          <div className="ed" style={{ marginTop: 14 }}>Songs you add to this playlist will appear here.</div>
        </div>
      )}
    </Scr>
  );
}

/* ── Шторка «Новый плейлист» ──────────────────────────────────────────── */
export function NewPlaylistSheet({ pendingSong, onClose }: { pendingSong?: string | null; onClose: (createdId?: string) => void }) {
  const [name, setName] = useState("");
  const save = () => {
    const title = name.trim() || "New Playlist";
    const id = "pl-" + Date.now().toString(36);
    mutate((s) => ({ ...s, pl: [{ id, title, ids: pendingSong ? [pendingSong] : [] }, ...s.pl] }));
    onClose(id);
  };
  return (
    <div className="amx-sheet">
      <div className="sh-top">
        <button className="amx-cir" onClick={() => onClose()}>{I.x({ s: 19 })}</button>
        <div className="sh-title">New Playlist</div>
        <button className="amx-cir" onClick={save}>{I.check({ s: 20 })}</button>
      </div>
      <div className="amx-npcov">
        <button className="pbtn">{I.photo({ s: 42 })}</button>
      </div>
      <div className="amx-npname">
        <input autoFocus value={name} placeholder="Playlist Title"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); }} />
        <div className="ul" />
      </div>
    </div>
  );
}

/* ── Шторка «Add to a Playlist» ───────────────────────────────────────── */
export function PlaylistPicker({ songId, onClose, onNew }: { songId: string; onClose: () => void; onNew: () => void }) {
  const store = useStore();
  const add = (plId: string) => {
    mutate((s) => ({
      ...s,
      pl: s.pl.map((p) => (p.id === plId && !p.ids.includes(songId) ? { ...p, ids: [...p.ids, songId] } : p)),
    }));
    onClose();
  };
  return (
    <div className="amx-sheet">
      <div className="sh-top">
        <button className="amx-cir" onClick={onClose}>{I.x({ s: 19 })}</button>
        <div className="sh-title">Add to a Playlist</div>
        <span style={{ width: 46 }} />
      </div>
      <div style={{ overflowY: "auto", marginTop: 12 }}>
        <button className="amx-librow" style={{ width: "100%" }} onClick={onNew}>
          <span className="li">{I.plus({ s: 24 })}</span>New Playlist…
        </button>
        {store.pl.map((p) => (
          <button key={p.id} className="amx-librow" style={{ width: "100%" }} onClick={() => add(p.id)}>
            <span className="li"><Cover id={p.id} cls="sm" style={{ width: 34, height: 34, borderRadius: 6 }} /></span>
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
            <span style={{ marginLeft: "auto", fontSize: 15, color: "var(--g2)" }}>{p.ids.length}</span>
          </button>
        ))}
        {!store.pl.length ? <div className="amx-empty" style={{ paddingTop: 60 }}><div className="ed">No playlists yet.</div></div> : null}
      </div>
    </div>
  );
}
