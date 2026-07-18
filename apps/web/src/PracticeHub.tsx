/**
 * ПРАКТИКА — подтаб «Практика» зала Садханы.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ЗКН-Н088 — ПРАКТИКА, ПРОГРЕСС И ДОСТИЖЕНИЯ ЖИВУТ ЗДЕСЬ, А НЕ В КАБИНЕТЕ.
 *
 * Раньше здесь стоял каркас с бейджами «Скоро», а живая практика (круги, обет,
 * дневник, статистика, «продолжить чтение», «вы слушали», библиотека) лежала
 * в личном кабинете — то есть в разделе про НАСТРОЙКИ АККАУНТА. Кабинет
 * отвечал сразу на пять вопросов, а «Практика» — ни на один.
 *
 * Теперь порядок повторяет день преданного:
 *   СЕГОДНЯ  — круги · стих дня · обет (одно действие в этот день)
 *   ПРАКТИКА — джапа · дневник
 *   ПРОГРЕСС — накопленное: четыре числа + «мой прогресс»
 *   ЧТЕНИЕ И СЛУШАНИЕ — продолжить · вы слушали · моя библиотека
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Язык интерфейса — ЗКН-Д018 (сгруппированный экран iOS 26.5, `ui/ios.tsx`):
 * холст группы, карточка радиусом 24 без обводки, строка 48, разделитель 1px,
 * воздух 35. Ни одного числа «на глаз».
 */
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useAuth } from "./account/store";
import { accountClient, type Overview, type ReadingItem, type ListenItem, type SadhanaState } from "./account/api";
import { usePlayer } from "./player/store";
import { BOOKS, bookFullTitle, bookSlug } from "./books";
import { albumById } from "./kirtans";
import { plural } from "./ui/primitives";   // ЗКН-Д002: одна функция, не копия
import { GroupedCanvas, Groups, Group, GroupHeader, Row, Chevron } from "./ui/ios";

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

function CoverBox({ src, w, h, radius = 10, label }: { src: string | null; w: number; h: number; radius?: number; label?: string }) {
  if (src) {
    return (
      <img src={src} alt="" loading="lazy"
        style={{ width: w, height: h, objectFit: "cover", borderRadius: radius, flexShrink: 0, background: "var(--color-bg-3)" }} />
    );
  }
  return (
    <div style={{ width: w, height: h, borderRadius: radius, flexShrink: 0, background: "var(--color-bg-3)", color: INK3, display: "grid", placeItems: "center", fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: 0.4, textAlign: "center", padding: 4 }}>
      {label ?? ""}
    </div>
  );
}

/** Горизонтальная лента: врезка равна отступу карточек — ритм не ломается. */
function HScroll({ children }: { children: ReactNode }) {
  return (
    <div className="scrollbar-none" style={{
      display: "flex", gap: 12, overflowX: "auto", WebkitOverflowScrolling: "touch",
      padding: "0 var(--inset-card)", scrollSnapType: "x proximity",
    }}>
      {children}
    </div>
  );
}

/** Разделитель внутри карточки — тот же 1px, что у строк (ЗКН-Д018). */
function Hair() {
  return <div aria-hidden style={{ height: 1, background: "var(--color-separator)", marginLeft: 16, marginRight: 16 }} />;
}

/* ─────────────────────────── сегодня ─────────────────────────── */

/** Круги сегодня: кольцо нормы, серия, чтение → дневник. */
function RoundsRow({ state, onOpen }: { state: SadhanaState; onOpen: () => void }) {
  const r = state.stats.todayRounds, g = state.goal;
  const done = r >= g;
  const tone = done ? "var(--color-success-text)" : GOLD;
  const RAD = 58, CIRC = 2 * Math.PI * RAD;
  const frac = Math.min(1, r / Math.max(1, g));
  const read = state.todayRow.reading_min;
  const bits: string[] = [`серия ${state.stats.currentStreak} ${plural(state.stats.currentStreak, "день", "дня", "дней")}`];
  if (read > 0) bits.push(`чтение ${fmtMinShort(read)}`);
  return (
    <button type="button" onClick={onOpen} aria-label="Открыть дневник садханы" className="tap-row"
      style={{
        display: "flex", alignItems: "center", gap: 14, width: "100%", boxSizing: "border-box",
        padding: "12px var(--inset-row)", background: "none", border: "none", cursor: "pointer",
        textAlign: "left", font: "inherit", WebkitTapHighlightColor: "transparent",
      }}>
      <span style={{ position: "relative", flexShrink: 0, width: 56, height: 56 }}>
        <svg viewBox="0 0 140 140" width="56" height="56" style={{ transform: "rotate(-90deg)" }} aria-hidden>
          <circle cx="70" cy="70" r={RAD} fill="none" stroke="var(--color-fill-2)" strokeWidth="11" />
          <circle cx="70" cy="70" r={RAD} fill="none" stroke={tone} strokeWidth="11" strokeLinecap="round"
            strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - frac)} style={{ transition: "stroke-dashoffset .35s ease" }} />
        </svg>
        <span style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-title3)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1, color: INK }}>{r}</span>
          <span style={{ fontFamily: FONT, fontSize: "var(--text-caption2)", color: INK2, marginTop: 1 }}>из {g}</span>
        </span>
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontFamily: FONT, fontSize: "var(--text-body)", fontWeight: 600, letterSpacing: "-0.02em", color: done ? "var(--color-success-text)" : INK }}>
          {done ? "Норма выполнена" : "Круги сегодня"}
        </span>
        <span style={{ display: "block", marginTop: 2, fontFamily: FONT, fontSize: "var(--text-footnote)", color: INK2 }}>
          {bits.join(" · ")}
        </span>
      </span>
      <Chevron />
    </button>
  );
}

/** Четыре числа накопленного — показываются, только когда есть что показать. */
function StatStrip({ stats }: { stats: Overview["stats"] }) {
  const items = [
    { value: stats.reading, label: "Прочитано" },
    { value: stats.listening, label: "Прослушано" },
    { value: stats.bookmarks, label: "Сохранено" },
    { value: stats.books, label: "Книг" },
  ];
  return (
    <div style={{ display: "flex" }}>
      {items.map((it, i) => (
        <div key={it.label} style={{
          flex: 1, minWidth: 0, padding: "14px 4px", textAlign: "center",
          borderLeft: i ? "1px solid var(--color-separator)" : "none",
        }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-title2)", fontWeight: 700, letterSpacing: "-0.03em", color: INK, lineHeight: 1.1 }}>{it.value}</div>
          <div style={{ marginTop: 3, fontFamily: FONT, fontSize: "var(--text-caption2)", color: INK2 }}>{it.label}</div>
        </div>
      ))}
    </div>
  );
}

function ContinueCard({ item, onOpen }: { item: ReadingItem; onOpen: (p: string) => void }) {
  const meta = bookMeta(item.work);
  // ЗКН-Н060: путь книги — только через bookSlug.
  const href = item.href || `/${bookSlug(item.work)}`;
  return (
    <button type="button" onClick={() => onOpen(href)}
      style={{ flexShrink: 0, width: 116, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", fontFamily: FONT, scrollSnapAlign: "start", WebkitTapHighlightColor: "transparent" }}>
      <CoverBox src={meta.cover} w={116} h={154} radius={12} label={meta.title} />
      <span style={{ display: "block", marginTop: 8, fontSize: "var(--text-footnote)", fontWeight: 600, color: INK, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{meta.title}</span>
      <span style={{ display: "block", marginTop: 2, fontSize: "var(--text-caption)", color: INK2, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label || "Продолжить"}</span>
    </button>
  );
}

function ListenCard({ item, onPlay }: { item: ListenItem; onPlay: (it: ListenItem) => void }) {
  return (
    <button type="button" onClick={() => onPlay(item)}
      style={{ flexShrink: 0, width: 132, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", fontFamily: FONT, scrollSnapAlign: "start", WebkitTapHighlightColor: "transparent" }}>
      <span style={{ position: "relative", display: "block" }}>
        <CoverBox src={item.cover} w={132} h={132} radius={12} label={item.title || ""} />
        <span style={{ position: "absolute", right: 8, bottom: 8, width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden><path fill="var(--color-brand-white)" d="M8 5v14l11-7z" /></svg>
        </span>
      </span>
      <span style={{ display: "block", marginTop: 8, fontSize: "var(--text-footnote)", fontWeight: 600, color: INK, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title || "Без названия"}</span>
      <span style={{ display: "block", marginTop: 2, fontSize: "var(--text-caption)", color: INK2, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.subtitle || item.artist || ""}</span>
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

  const stats = ov?.stats;
  const hasStats = !!stats && !!(stats.reading || stats.listening || stats.bookmarks || stats.books);
  const name = (user?.spiritualName || user?.name || "").trim();
  const clamp2: CSSProperties = {
    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
  };

  return (
    <GroupedCanvas>
      <Groups>
        {/* СЕГОДНЯ — одно действие человека в этот день. */}
        <Group header="Сегодня" action={sad ? { label: "Дневник", onClick: () => go("/story") } : undefined}>
          {sad && <RoundsRow state={sad} onOpen={() => go("/story")} />}
          {sad && <Hair />}
          <Row title="Стих дня" subtitle="Системное чтение Прабхупады: БГ → ШБ → ЧЧ" onClick={() => go("/verse")} />
          <Row title="Мой обет" subtitle="Санкальпа на срок: служения и ежедневный отчёт" last onClick={() => go("/promise")} />
        </Group>

        {/* ПРАКТИКА — инструменты, к которым возвращаются каждый день. */}
        <Group header="Практика">
          <Row title="Счётчик джапы" subtitle="108 бусин, круги и Маха-мантра" onClick={() => go("/japa")} />
          <Row title="Дневник садханы" subtitle="Круги, чтение, подъём — серии и статистика" last onClick={() => go("/story")} />
        </Group>

        {/* ПРОГРЕСС — накопленное. У нового человека пусто → блока просто нет. */}
        {hasStats && stats && (
          <Group header="Прогресс">
            <StatStrip stats={stats} />
            <Hair />
            <Row title="Мой прогресс" subtitle="Системное чтение, книги, время и серия" last onClick={() => go("/progress")} />
          </Group>
        )}

        {ov && ov.continueReading.length > 0 && (
          <section>
            <GroupHeader title="Продолжить чтение" />
            <HScroll>
              {ov.continueReading.map((it) => (
                <ContinueCard key={`${it.work}:${it.ref}`} item={it} onOpen={go} />
              ))}
            </HScroll>
          </section>
        )}

        {ov && ov.recentListening.length > 0 && (
          <section>
            <GroupHeader title="Вы слушали" />
            <HScroll>
              {ov.recentListening.map((it) => (
                <ListenCard key={`${it.source}:${it.ref}`} item={it} onPlay={resumeListen} />
              ))}
            </HScroll>
          </section>
        )}

        {ov && ov.library.length > 0 && (
          <section>
            <GroupHeader title="Моя библиотека" />
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
              gap: 14, padding: "0 var(--inset-card)",
            }}>
              {ov.library.map((it) => {
                const meta = bookMeta(it.work);
                return (
                  <button key={it.work} type="button" onClick={() => go(`/${bookSlug(it.work)}`)}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", fontFamily: FONT, WebkitTapHighlightColor: "transparent" }}>
                    <CoverBox src={meta.cover} w={96} h={128} radius={10} label={meta.title} />
                    <span style={{ ...clamp2, marginTop: 6, fontSize: "var(--text-caption)", fontWeight: 500, color: INK, lineHeight: 1.3 }}>{meta.title}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

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
