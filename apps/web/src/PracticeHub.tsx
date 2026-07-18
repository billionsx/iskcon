/**
 * ПРАКТИКА — подтаб «Практика» зала Садханы.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ЗКН-Н088 — практика, прогресс и достижения живут ЗДЕСЬ, не в кабинете.
 * ЗКН-Д024 — строка держится ТИПОГРАФИКОЙ: без иконок и плиток.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Порядок повторяет день преданного:
 *   СЕГОДНЯ  — круги · стих дня · обет (одно действие в этот день)
 *   ПРАКТИКА — джапа · дневник
 *   ЧТЕНИЕ И СЛУШАНИЕ — продолжить · вы слушали · прогресс
 *
 * ПОЧЕМУ КАРТОЧКИ-ОБЛОЖКИ УБРАНЫ. Ленты «продолжить читать» и «вы слушали»
 * рисовались плитками 116×154 и 132×132. У лекций Прабхупады обложек нет —
 * подставлялся логотип, и на экране вставали три-четыре ОДИНАКОВЫХ золотых
 * лотоса подряд: выглядело как поломка, а не как витрина. Строка списка с
 * миниатюрой 44 держит и с обложкой, и без неё, и не ломает ритм экрана.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./account/store";
import { accountClient, type Overview, type ReadingItem, type ListenItem, type SadhanaState } from "./account/api";
import { usePlayer } from "./player/store";
import { BOOKS, bookFullTitle, bookSlug } from "./books";
import { albumById } from "./kirtans";
import { plural } from "./ui/primitives";   // ЗКН-Д002: одна функция, не копия
import { GroupedCanvas, Groups, Group, Row, Separator, Chevron } from "./ui/ios";

const GOLD = "var(--color-gold)";
const INK = "var(--color-label)";
const INK2 = "var(--color-label-2)";
const INK3 = "var(--color-label-3)";
const FONT = "var(--font-text)";

/* ─────────────────────────── утилиты ─────────────────────────── */

function ymdLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtMinShort(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60); const r = m % 60;
  return r ? `${h} ч ${r} мин` : `${h} ч`;
}
function bookMeta(work: string): { title: string; cover: string | null } {
  const b = BOOKS[work];
  if (b) return { title: bookFullTitle(b), cover: b.covers?.[0] ?? null };
  return { title: work.toUpperCase(), cover: null };
}

/** Миниатюра строки — 44×44, радиус 8. Пусто — тихий серый прямоугольник. */
function Thumb({ src }: { src: string | null }) {
  return src
    ? <img src={src} alt="" loading="lazy" style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 8, objectFit: "cover", background: "var(--color-bg-3)" }} />
    : <span aria-hidden style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 8, background: "var(--color-bg-3)" }} />;
}

/** Строка медиа: миниатюра · название · подпись · шеврон. Ритм тот же — 60. */
function MediaRow({ thumb, title, subtitle, onClick, last }: {
  thumb: string | null; title: string; subtitle?: string; onClick: () => void; last?: boolean;
}) {
  return (
    <>
      <button type="button" onClick={onClick} className="tap-row"
        style={{
          display: "flex", alignItems: "center", gap: 12, width: "100%", boxSizing: "border-box",
          minHeight: "var(--row-h-2)", padding: "8px var(--inset-row)", background: "none",
          border: "none", cursor: "pointer", textAlign: "left", font: "inherit",
          WebkitTapHighlightColor: "transparent",
        }}>
        <Thumb src={thumb} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontFamily: FONT, fontSize: "var(--text-body)", color: INK, lineHeight: 1.29, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
          {subtitle && (
            <span style={{ display: "block", marginTop: 1, fontFamily: FONT, fontSize: "var(--text-subhead)", color: INK2, lineHeight: 1.33, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</span>
          )}
        </span>
        <Chevron />
      </button>
      {!last && <Separator inset={72} />}
    </>
  );
}

/* ─────────────────────────── сегодня ─────────────────────────── */

/**
 * Круги сегодня. Единственная графика на экране — и она несёт число, а не
 * украшает. Кольцо 52, внутри 17/11: цифра равна кеглю строки, чтобы блок
 * стоял в общем ритме, а не выпирал.
 */
function RoundsRow({ state, onOpen }: { state: SadhanaState; onOpen: () => void }) {
  const r = state.stats.todayRounds, g = state.goal;
  const done = r >= g;
  const RAD = 58, CIRC = 2 * Math.PI * RAD;
  const frac = Math.min(1, r / Math.max(1, g));
  const read = state.todayRow.reading_min;
  const bits: string[] = [];
  if (state.stats.currentStreak > 0) bits.push(`серия ${state.stats.currentStreak} ${plural(state.stats.currentStreak, "день", "дня", "дней")}`);
  if (read > 0) bits.push(`чтение ${fmtMinShort(read)}`);
  if (!bits.length) bits.push(done ? "норма закрыта" : `до нормы ${g - r} ${plural(g - r, "круг", "круга", "кругов")}`);
  return (
    <button type="button" onClick={onOpen} aria-label="Открыть дневник садханы" className="tap-row"
      style={{
        display: "flex", alignItems: "center", gap: 12, width: "100%", boxSizing: "border-box",
        minHeight: "var(--row-h-2)", padding: "8px var(--inset-row)", background: "none",
        border: "none", cursor: "pointer", textAlign: "left", font: "inherit",
        WebkitTapHighlightColor: "transparent",
      }}>
      <span style={{ position: "relative", flexShrink: 0, width: 44, height: 44 }}>
        <svg viewBox="0 0 140 140" width="44" height="44" style={{ transform: "rotate(-90deg)" }} aria-hidden>
          <circle cx="70" cy="70" r={RAD} fill="none" stroke="var(--color-separator)" strokeWidth="12" />
          <circle cx="70" cy="70" r={RAD} fill="none" stroke={done ? "var(--color-success-text)" : GOLD}
            strokeWidth="12" strokeLinecap="round"
            strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - frac)}
            style={{ transition: "stroke-dashoffset .35s ease" }} />
        </svg>
        <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontFamily: FONT, fontSize: "var(--text-subhead)", fontWeight: 600, letterSpacing: "-0.02em", color: INK }}>{r}</span>
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontFamily: FONT, fontSize: "var(--text-body)", color: INK, lineHeight: 1.29, letterSpacing: "-0.01em" }}>
          Круги сегодня
        </span>
        <span style={{ display: "block", marginTop: 1, fontFamily: FONT, fontSize: "var(--text-subhead)", color: INK2, lineHeight: 1.33, letterSpacing: "-0.01em" }}>
          {bits.join(" · ")}
        </span>
      </span>
      <span style={{ flexShrink: 0, fontFamily: FONT, fontSize: "var(--text-body)", color: INK2, letterSpacing: "-0.01em" }}>
        {r} / {g}
      </span>
      <Chevron />
    </button>
  );
}

/* ─────────────────────────── экран ─────────────────────────── */

export default function PracticeHub({ onOpen }: { onOpen?: (path: string) => void }) {
  const { status, user } = useAuth();
  const player = usePlayer();
  const [ov, setOv] = useState<Overview | null>(null);
  const [sad, setSad] = useState<SadhanaState | null>(null);
  const authed = status === "authed";
  const go = useCallback((p: string) => onOpen?.(p), [onOpen]);

  useEffect(() => {
    if (!authed) { setOv(null); setSad(null); return; }
    let alive = true;
    accountClient.overview().then((d) => { if (alive) setOv(d); }).catch(() => {});
    accountClient.sadhana.get(ymdLocal()).then((d) => { if (alive) setSad(d); }).catch(() => {});
    return () => { alive = false; };
  }, [authed]);

  const resumeListen = useCallback((it: ListenItem) => {
    try {
      if (it.source === "kirtan" && it.album && albumById(it.album)) { player.playKirtan(it.album); return; }
      if (it.source !== "kirtan" && it.album && BOOKS[it.album]) { player.playBook({ book: it.album }); return; }
      if (it.href) go(it.href);
    } catch { /* воспроизведение не удалось — экран остаётся на месте */ }
  }, [player, go]);

  const openReading = useCallback((it: ReadingItem) => {
    // ЗКН-Н060: путь книги — только через bookSlug.
    go(it.href || `/${bookSlug(it.work)}`);
  }, [go]);

  const name = (user?.spiritualName || user?.name || "").trim();
  const reading = ov?.continueReading?.slice(0, 3) ?? [];
  const listening = ov?.recentListening?.slice(0, 3) ?? [];

  return (
    <GroupedCanvas>
      <Groups>
        {/* СЕГОДНЯ — одно действие человека в этот день. */}
        <Group header="Сегодня" action={sad ? { label: "Дневник", onClick: () => go("/story") } : undefined}>
          {sad && <RoundsRow state={sad} onOpen={() => go("/story")} />}
          {sad && <Separator inset={72} />}
          <Row title="Стих дня" subtitle="Системное чтение: БГ → ШБ → ЧЧ" onClick={() => go("/verse")} />
          <Row title="Мой обет" subtitle="Санкальпа на срок и ежедневный отчёт" last onClick={() => go("/promise")} />
        </Group>

        {/* ПРАКТИКА — инструменты, к которым возвращаются каждый день. */}
        <Group header="Практика">
          <Row title="Счётчик джапы" onClick={() => go("/japa")} />
          <Row title="Дневник садханы" last onClick={() => go("/story")} />
        </Group>

        {/* ЧТЕНИЕ И СЛУШАНИЕ — строками, а не витриной обложек. */}
        <Group header="Чтение и слушание">
          {reading.map((it) => (
            <MediaRow key={`r:${it.work}:${it.ref}`} thumb={bookMeta(it.work).cover}
              title={bookMeta(it.work).title} subtitle={it.label || "Продолжить чтение"}
              onClick={() => openReading(it)} />
          ))}
          {listening.map((it) => (
            <MediaRow key={`l:${it.source}:${it.ref}`} thumb={it.cover}
              title={it.title || "Без названия"} subtitle={it.subtitle || it.artist || "Прослушано"}
              onClick={() => resumeListen(it)} />
          ))}
          <Row title="Мой прогресс" last onClick={() => go("/progress")} />
        </Group>

        {/* ГОСТЮ — одно тихое приглашение, а не афиша о пустоте. */}
        {!authed && (
          <Group footer="Круги, дневник и прогресс чтения хранятся в аккаунте и синхронизируются между устройствами.">
            <Row title="Войти" subtitle={name ? `Продолжить как ${name}` : "Садхана продолжится на всех устройствах"} last onClick={() => go("/id")} />
          </Group>
        )}
      </Groups>
    </GroupedCanvas>
  );
}
