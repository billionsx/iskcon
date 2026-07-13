/**
 * KirtanBoard — ВСТРОЕННЫЙ плеер киртанов. Белая доска, золото, скруглённые края.
 *
 * ПОЧЕМУ ОТДЕЛЬНЫЙ КОМПОНЕНТ, А НЕ «ЕЩЁ ОДИН ПЛЕЕР».
 *
 * Движок ОДИН — `usePlayer()`. Здесь нет ни своего аудио, ни своей очереди, ни
 * своего состояния: доска только РИСУЕТ то, что уже знает стор. Второй плеер
 * рядом с первым — это две правды о том, что сейчас играет; они разъедутся.
 *
 * Отличие от `NowPlaying` — не в логике, а в месте и в теме:
 *   NowPlaying   — тёмный лист ПОВЕРХ страницы, открывается по тапу;
 *   KirtanBoard  — белая доска В САМОЙ странице, видна сразу, не закрывает собой
 *                  то, чем человек только что управлял.
 *
 * Обложек у записей нет — ставим знак ISKCON ONE LOVE (ЗКН-Д005: одна заглушка
 * на всё приложение, буквы-суррогаты запрещены).
 */
import { useEffect, useRef } from "react";
import { usePlayer, AUDIO_FALLBACK_COVER } from "./store";
import {
  PlayIcon, PauseIcon, PrevIcon, NextIcon, Back15Icon, Fwd15Icon,
  ShuffleIcon, OrderForwardIcon, RepeatIcon, RepeatOneIcon,
} from "./icons";
import { kirtanTracks, trackIndex, KIRTANS_ALL, type KirtanTrack } from "../kirtans";

const GOLD = "var(--color-gold)";

function mmss(s: number): string {
  if (!s || s < 0 || !isFinite(s)) return "0:00";
  const m = Math.floor(s / 60), x = Math.floor(s % 60);
  return `${m}:${String(x).padStart(2, "0")}`;
}

export function KirtanBoard({ tracks }: { tracks: KirtanTrack[] }) {
  const p = usePlayer();
  const listRef = useRef<HTMLUListElement>(null);

  const onAll = p.kind === "kirtan" && p.book === KIRTANS_ALL;
  const curId = onAll && p.track ? p.track.file : null;
  const isCur = (t: KirtanTrack) => onAll && p.index === trackIndex(t.id);

  const tap = (t: KirtanTrack) => {
    if (isCur(t)) { p.togglePlay(); return; }
    if (onAll) { p.jumpTo(trackIndex(t.id)); return; }
    p.playKirtan(KIRTANS_ALL, trackIndex(t.id), false);   // играем НА МЕСТЕ, без тёмного листа
  };

  // играющая строка сама подъезжает в поле зрения — иначе в списке на 1000 записей
  // человек теряет то, что слушает, как только чуть прокрутит
  useEffect(() => {
    if (!onAll || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>('[data-cur="1"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [p.index, onAll]);

  const now = onAll ? p.track : null;
  const nowTrack = onAll ? tracks[p.index] : undefined;

  const btn = (size: number): React.CSSProperties => ({
    display: "grid", placeItems: "center", width: size, height: size, borderRadius: "50%",
    border: "none", background: "none", cursor: "pointer", color: "var(--color-label)",
    WebkitTapHighlightColor: "transparent", flexShrink: 0,
  });

  return (
    <section style={{
      borderRadius: 22, overflow: "hidden", background: "var(--color-bg-2)",
      border: "0.5px solid var(--color-hairline)",
    }}>
      {/* ── ПУЛЬТ. Белая шапка доски: обложка · что играет · перемотка · транспорт ── */}
      <div style={{ padding: "16px 16px 14px", background: "#fff", borderBottom: "0.5px solid var(--color-hairline)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
          <img src={AUDIO_FALLBACK_COVER} alt="" draggable={false}
            style={{ width: 60, height: 60, flexShrink: 0, borderRadius: 14, objectFit: "cover",
              background: "#fff", border: "0.5px solid var(--color-hairline)" }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-callout)", fontWeight: 800,
              letterSpacing: "-0.2px", color: "var(--color-label)", lineHeight: 1.25,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {now ? now.title : "Киртаны"}
            </div>
            <div style={{ marginTop: 3, fontSize: "var(--text-footnote)", color: "var(--color-label-2)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {now ? "Киртан" : `${tracks.length} записей — нажмите любую`}
            </div>
          </div>
        </div>

        {/* перемотка — золотая */}
        <div style={{ marginTop: 13 }}>
          <input type="range" aria-label="Перемотка"
            min={0} max={Math.max(1, Math.floor(p.duration))} step={1}
            value={Math.floor(p.currentTime)} disabled={!now}
            onChange={(e) => p.seek(Number(e.target.value))}
            style={{
              width: "100%", height: 4, appearance: "none", WebkitAppearance: "none",
              borderRadius: 999, cursor: now ? "pointer" : "default", accentColor: "var(--color-gold)",
              background: `linear-gradient(to right, var(--color-gold) 0%, var(--color-gold) ${
                p.duration ? (p.currentTime / p.duration) * 100 : 0}%, var(--color-fill-1) ${
                p.duration ? (p.currentTime / p.duration) * 100 : 0}%, var(--color-fill-1) 100%)`,
            }} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5,
            fontSize: "var(--text-caption)", color: "var(--color-label-3)", fontVariantNumeric: "tabular-nums" }}>
            <span>{mmss(p.currentTime)}</span>
            <span>{now && p.duration ? `−${mmss(p.duration - p.currentTime)}` : mmss(0)}</span>
          </div>
        </div>

        {/* транспорт */}
        <div style={{ marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <button type="button" aria-label="Предыдущая" onClick={() => p.prev()} style={btn(42)}><PrevIcon size={24} /></button>
          <button type="button" aria-label="Назад 15 секунд" onClick={() => p.skip(-15)} style={btn(42)}><Back15Icon size={27} /></button>
          <button type="button" aria-label={p.isPlaying ? "Пауза" : "Играть"}
            onClick={() => (now ? p.togglePlay() : tracks.length && tap(tracks[0]))}
            style={{ ...btn(54), background: GOLD, color: "#fff", boxShadow: "0 6px 18px rgba(210,170,27,0.32)" }}>
            {p.isPlaying ? <PauseIcon size={24} /> : <PlayIcon size={24} />}
          </button>
          <button type="button" aria-label="Вперёд 15 секунд" onClick={() => p.skip(15)} style={btn(42)}><Fwd15Icon size={27} /></button>
          <button type="button" aria-label="Следующая" onClick={() => p.next()} style={btn(42)}><NextIcon size={24} /></button>
        </div>

        {/* порядок · повтор · скорость */}
        <div style={{ marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 18 }}>
          <button type="button" aria-label="Порядок" onClick={() => p.cycleOrder()}
            style={{ ...btn(32), color: p.order === "forward" ? "var(--color-label-3)" : GOLD }}>
            {p.order === "shuffle" ? <ShuffleIcon size={19} /> : <OrderForwardIcon size={19} />}
          </button>
          <button type="button" aria-label="Повтор" onClick={() => p.cycleRepeat()}
            style={{ ...btn(32), color: p.repeat === "off" ? "var(--color-label-3)" : GOLD }}>
            {p.repeat === "one" ? <RepeatOneIcon size={19} /> : <RepeatIcon size={19} />}
          </button>
          <button type="button" aria-label="Скорость" onClick={() => p.cycleRate()}
            style={{ ...btn(32), width: "auto", padding: "0 8px", borderRadius: 9,
              color: p.rate !== 1 ? GOLD : "var(--color-label-3)",
              fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 700 }}>
            {p.rate}×
          </button>
        </div>
      </div>

      {/* ── ДОРОЖКИ. Все киртаны канала одной очередью, прямо в доске. ── */}
      <ul ref={listRef} style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {tracks.map((t, i) => {
          const cur = isCur(t);
          const beat = cur && p.isPlaying;
          return (
            <li key={t.id} data-cur={cur ? "1" : undefined}
              style={{ borderBottom: i === tracks.length - 1 ? "none" : "0.5px solid var(--color-hairline)" }}>
              <button onClick={() => tap(t)} aria-label={beat ? "Пауза" : "Играть"}
                style={{ display: "flex", width: "100%", alignItems: "center", gap: 12, padding: "10px 13px",
                  textAlign: "left", border: "none", cursor: "pointer", fontFamily: "var(--font-text)",
                  background: cur ? "color-mix(in srgb, var(--color-gold) 9%, transparent)" : "transparent",
                  color: "var(--color-label)", WebkitTapHighlightColor: "transparent" }}>
                <span style={{ position: "relative", flexShrink: 0, width: 42, height: 42 }}>
                  <img src={AUDIO_FALLBACK_COVER} alt="" loading="lazy"
                    style={{ width: 42, height: 42, borderRadius: "50%", objectFit: "cover",
                      background: "#fff", border: "0.5px solid var(--color-hairline)" }} />
                  <span aria-hidden style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center",
                    borderRadius: "50%", background: "rgba(255,255,255,0.66)",
                    backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
                    color: cur ? "var(--color-gold-deep)" : "#1d1d1f" }}>
                    {beat ? <PauseIcon size={15} /> : <PlayIcon size={15} />}
                  </span>
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "block", fontSize: "var(--text-callout)", fontWeight: 600, lineHeight: 1.3,
                    color: cur ? "var(--color-gold-deep)" : "var(--color-label)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                  {/* Исполнитель стоит В НАЗВАНИИ (стандарт основателя:
                      «Ачьюта Гопи Деви Даси. Киртан 01») — второй раз его не пишем. */}
                  {t.duration ? (
                    <span style={{ display: "block", marginTop: 2, fontSize: 12.5, color: "var(--color-label-2)",
                      fontVariantNumeric: "tabular-nums" }}>{mmss(t.duration)}</span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
