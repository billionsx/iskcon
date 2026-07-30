/* /play · В4 «Лекции» — 6908 записей паттерном «подкасты внутри Apple Music».
 *
 * Данные — целиком конвейер Ц12: каталог 65 КБ (loadCatalog), области лениво
 * (ensureAlbum/ensureSpeaker), дорожки в реестре katha.ts. Звук — боевой
 * движок (playKatha). Ничего второго не заводим: витрина /play — ещё один
 * взгляд на ту же базу (дух ЗКН-Н060/Б013).
 *
 * Состав по роадмапу: hero «Лекция дня» (Ц7, одна на всех) · круглые арты
 * пяти голосов (монограмма на фирменном цвете спикера — артов-картинок у
 * лекций нет, и мы не выдумываем) · полки циклов по голосам · страница
 * голоса как artist page (чипы годов — фильтр, не декорация) · страница
 * цикла со списком записей.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Ava, Cover, H2, I, Scr } from "./core";
import type { UI } from "./MusicApp";
import { api } from "../api";
import { usePlayer as useCore } from "../player/store";
import {
  albumHours, albumTracks, albumsBySpeaker, kathaAlbumById, kathaSpeakers,
  speakerBySlug, type KathaAlbum, type KathaSpeaker,
} from "../katha";
import { ensureAlbum, loadCatalog, useKatha } from "../kathaHydrate";

const fmtH = (h: number) => (h >= 10 ? `${Math.round(h)} ч` : `${Math.round(h * 10) / 10} ч`);

/* ── Круг голоса. Фото у лекций нет — и мы не выдумываем: инициалы имени на
   поверхности карточки; `accent` каталога (флаг старшинства) красит инициалы
   фирменным красным. ── */
const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("");
function SpeakerDot({ s, size = 88, onTap }: { s: KathaSpeaker; size?: number; onTap?: () => void }) {
  return (
    <button className="amx-spdot" style={{ width: size }} onClick={onTap}>
      <span className="d" style={{ width: size, height: size, fontSize: size * 0.3, color: s.accent ? "var(--red)" : "#fff" }}>
        {initials(s.name)}
      </span>
      <span className="n">{s.name}</span>
    </button>
  );
}

/* ── Ряд цикла в полке ────────────────────────────────────────────────── */
function AlbumCard({ a, ui }: { a: KathaAlbum; ui: UI }) {
  return (
    <div className="amx-cardw" onClick={() => ui.push({ k: "kalbum", id: a.id })}>
      <Cover id={a.id} />
      <div className="cw-t"><span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{a.title}</span></div>
      <div className="cw-s">{a.n} зап. · {fmtH(albumHours(a.id))}</div>
    </div>
  );
}

/* ── Hero «Лекция дня» (Ц7): одна на всех, детерминированно от дня ────── */
function LectureOfDay() {
  const core = useCore();
  const [lec, setLec] = useState<{ title: string; albumId: string; albumTitle: string; durationSec: number; tail: string } | null>(null);
  useEffect(() => {
    let dead = false;
    fetch(api("/katha/lecture-of-day")).then((r) => r.json())
      .then((l: { title?: string; albumId?: string; albumTitle?: string; durationSec?: number; href?: string }) => {
        if (dead || !l?.title || !l.albumId) return;
        const tail = decodeURIComponent((l.href || "").split("?t=")[1] || "");
        setLec({ title: l.title, albumId: l.albumId, albumTitle: l.albumTitle || "Катха", durationSec: l.durationSec || 0, tail });
      }).catch(() => {});
    return () => { dead = true; };
  }, []);
  if (!lec) return null;
  const play = async () => {
    await ensureAlbum(lec.albumId);
    const list = albumTracks(lec.albumId) ?? [];
    const file = lec.tail.split("/").slice(1).join("/");
    const i = Math.max(0, list.findIndex((t) => t.file === file));
    core.playKatha(lec.albumId, i, true);
  };
  return (
    <div className="amx-lod" onClick={play}>
      <div className="k">ЛЕКЦИЯ ДНЯ</div>
      <div className="t">{lec.title}</div>
      <div className="s">{lec.albumTitle}{lec.durationSec >= 60 ? ` · ${Math.round(lec.durationSec / 60)} мин` : ""}</div>
      <span className="p">{I.play({ s: 20 })}<span>Слушать</span></span>
    </div>
  );
}

/* ── Вкладка «Лекции» ─────────────────────────────────────────────────── */
export function LecturesScreen({ ui }: { ui: UI }) {
  useKatha();
  useEffect(() => { void loadCatalog(); }, []);
  const speakers = kathaSpeakers();
  const shelves = useMemo(
    () => speakers
      .map((s) => ({ s, albums: albumsBySpeaker(s.slug) }))
      .filter((x) => x.albums.length > 0)
      .sort((a, b) => b.albums.length - a.albums.length),
    // счётчик useKatha() будит компонент — списки перечитываются из реестра
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [speakers.length, useKathaTick()],
  );
  return (
    <Scr>
      <div className="amx-top"><div className="amx-h1">Лекции</div><Ava /></div>
      <LectureOfDay />
      {speakers.length > 0 ? (
        <>
          <H2 t="Голоса" />
          <div className="amx-sprow">
            {speakers.map((s) => (
              <SpeakerDot key={s.slug} s={s} onTap={() => ui.push({ k: "speaker", slug: s.slug })} />
            ))}
          </div>
        </>
      ) : null}
      {shelves.map(({ s, albums }) => (
        <div key={s.slug}>
          <H2 t={s.name} onOpen={() => ui.push({ k: "speaker", slug: s.slug })} />
          <div className="amx-shelf">
            {albums.slice(0, 10).map((a) => <AlbumCard key={a.id} a={a} ui={ui} />)}
          </div>
        </div>
      ))}
    </Scr>
  );
}
/* Реестр будит подписчиков счётчиком; отдельный вызов — чтобы deps выше были честными. */
function useKathaTick(): number { return useKatha(); }

/* ── Страница голоса — artist page ────────────────────────────────────── */
export function SpeakerScreen({ ui, slug }: { ui: UI; slug: string }) {
  useKatha();
  useEffect(() => { void loadCatalog(); }, []);
  const core = useCore();
  const s = speakerBySlug(slug);
  const albums = albumsBySpeaker(slug);
  const years = useMemo(
    () => [...new Set(albums.map((a) => a.year).filter(Boolean) as string[])].sort().reverse(),
    [albums],
  );
  const [year, setYear] = useState<string | null>(null);
  const shown = year ? albums.filter((a) => a.year === year) : albums;
  if (!s) return null;
  return (
    <Scr>
      <div className="amx-nav">
        <button className="amx-cir" onClick={ui.back}>{I.back({ s: 22 })}</button>
        <div className="nv-title" />
      </div>
      <div style={{ padding: "0 20px", textAlign: "center" }}>
        <span className="amx-spdot big"><span className="d" style={{ width: 132, height: 132, fontSize: 40, color: s.accent ? "var(--red)" : "#fff" }}>{initials(s.name)}</span></span>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.26px", marginTop: 12 }}>{s.full || s.name}</div>
        {s.role ? <div style={{ fontSize: 15, color: "var(--g2)", marginTop: 2 }}>{s.role}</div> : null}
        {albums.length > 0 ? (
          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
            <button className="amx-capsule" onClick={() => core.playKatha(albums[0].id, 0, true)}>
              {I.play({ s: 18 })}<span>Слушать</span>
            </button>
          </div>
        ) : null}
        {s.bio ? <div style={{ fontSize: 14, color: "var(--g2)", marginTop: 14, textAlign: "left" }}>{s.bio}</div> : null}
      </div>
      {years.length > 1 ? (
        <div className="amx-cantos">
          <button className={"amx-chip" + (year == null ? " on" : "")} onClick={() => setYear(null)}>Все годы</button>
          {years.map((y) => (
            <button key={y} className={"amx-chip" + (year === y ? " on" : "")} onClick={() => setYear(y)}>{y}</button>
          ))}
        </div>
      ) : null}
      <div style={{ marginTop: 14 }}>
        {shown.map((a) => (
          <div key={a.id} className="amx-row" onClick={() => ui.push({ k: "kalbum", id: a.id })}>
            <div className="r-c" style={{ paddingLeft: 20 }}>
              <div className="r-t">{a.title}</div>
              <div className="r-s">{[a.year, `${a.n} зап.`, fmtH(albumHours(a.id))].filter(Boolean).join(" · ")}</div>
            </div>
            <span style={{ color: "var(--g2)", paddingRight: 16 }}>{I.chev({ s: 16 })}</span>
          </div>
        ))}
      </div>
    </Scr>
  );
}

/* ── Страница цикла ───────────────────────────────────────────────────── */
export function KAlbumScreen({ ui, id }: { ui: UI; id: string }) {
  useKatha();
  const core = useCore();
  useEffect(() => { void loadCatalog().then(() => ensureAlbum(id)); }, [id]);
  const a = kathaAlbumById(id);
  const list = albumTracks(id);
  const sp = a ? speakerBySlug(a.speaker) : undefined;
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
        {sp ? <div style={{ fontSize: 15, color: "var(--red)", marginTop: 2 }} onClick={() => ui.push({ k: "speaker", slug: sp.slug })}>{sp.name}</div> : null}
        <div style={{ fontSize: 13, color: "var(--g2)", marginTop: 4 }}>{[a.year, `${a.n} записей`, fmtH(albumHours(a.id))].filter(Boolean).join(" · ")}</div>
        <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
          <button className="amx-capsule" onClick={() => core.playKatha(a.id, 0, true)}>
            {I.play({ s: 18 })}<span>Слушать</span>
          </button>
        </div>
      </div>
      <div style={{ marginTop: 18 }}>
        {(list ?? []).map((t, i) => (
          <div key={t.file} className="amx-row" onClick={() => core.playKatha(a.id, i, false)}>
            <div className="r-num">{i + 1}</div>
            <div className="r-c">
              <div className="r-t">{t.title}</div>
              {t.duration ? <div className="r-s">{Math.round(t.duration / 60)} мин</div> : null}
            </div>
          </div>
        ))}
      </div>
    </Scr>
  );
}
