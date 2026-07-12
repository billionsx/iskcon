/**
 * «Сегодня» (Ц4) — адаптивный хаб, посадочный экран садханы. Собирает сегодняшнее
 * из реальных источников и ведёт вглубь: даршан дня (DarshanRings), Стих дня
 * (readingClient + дневной план), карта садханы (локальный счётчик джапы — источник
 * правды), ближайшее событие (/api/calendar). Обрамление адаптируется по ступени
 * (effectiveLevel из Ц1/Ц2): гостю — знакомство, практикующему — садхана впереди.
 * Каждая карточка деградирует мягко: нет данных — карточка просто скрыта.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useAuth } from "./account/store";
import { effectiveLevel, getLocalDevotee } from "./devotee";
import { readingClient } from "./reading/api";
import { getPlan } from "./reading/position";
import { DarshanRings } from "./DarshanStories";

const GOLD = "var(--color-gold)";
const INK = "var(--color-label)";
const INK2 = "var(--color-label-2)";
const INK3 = "var(--color-label-3)";
const SURF = "var(--color-bg-2)";
const HAIR = "var(--color-hairline)";
const FONT = "var(--font-text)";
const SERIF = "var(--font-scripture)";

const ymd = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const WEEKDAYS = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
function ruDate(d = new Date()): string { return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`; }

/** Сегодняшние круги + цель из локального счётчика (iol:japa:v1) — источник правды. */
function readJapaToday(): { rounds: number; goal: number } {
  try {
    const raw = localStorage.getItem("iol:japa:v1");
    if (!raw) return { rounds: 0, goal: 16 };
    const d = JSON.parse(raw) as { goal?: number; rounds?: { t: number }[] };
    const goal = Number.isFinite(Number(d.goal)) && Number(d.goal) >= 1 ? Math.round(Number(d.goal)) : 16;
    const today = ymd();
    const rounds = (Array.isArray(d.rounds) ? d.rounds : []).filter((r) => r && typeof r.t === "number" && ymd(new Date(r.t)) === today).length;
    return { rounds, goal };
  } catch { return { rounds: 0, goal: 16 }; }
}

interface CalEvent { date: string; title: string; type: string }
/** Ближайшее Экадаши/праздник из /api/calendar по сохранённому городу (или Вриндаван). */
async function fetchNextEvent(): Promise<{ title: string; days: number; type: string } | null> {
  let key = "Vrindavan [India]";
  let lat: number | undefined, lng: number | undefined;
  try {
    const raw = localStorage.getItem("cal-loc");
    if (raw) { const l = JSON.parse(raw) as { key?: string; lat?: number; lng?: number }; if (l.key) key = l.key; lat = l.lat; lng = l.lng; }
  } catch { /* default */ }
  const params = new URLSearchParams();
  if (/^[A-Za-z .()'-]+ \[[A-Za-z .]+\]$/.test(key)) params.set("loc", key);
  if (typeof lat === "number" && typeof lng === "number") { params.set("lat", String(lat)); params.set("lng", String(lng)); }
  if (![...params.keys()].length) params.set("loc", key);
  try {
    const r = await fetch("/api/calendar?" + params.toString());
    if (!r.ok) return null;
    const j = (await r.json()) as { events?: CalEvent[] };
    const today = ymd();
    const up = (j.events || [])
      .filter((e) => e.date >= today && (e.type === "ekadasi" || e.type === "festival"))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    if (!up.length) return null;
    const e = up[0];
    const days = Math.round((new Date(e.date + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86_400_000);
    return { title: e.title, days, type: e.type };
  } catch { return null; }
}
const daysLabel = (n: number) => (n <= 0 ? "сегодня" : n === 1 ? "завтра" : `через ${n} дн.`);

/* ─────────────────────────── карточки ─────────────────────────── */

function Card({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  const base: CSSProperties = { background: SURF, borderRadius: 16, border: `0.5px solid ${HAIR}`, boxShadow: "var(--shadow-card)", overflow: "hidden", width: "100%", textAlign: "left", fontFamily: FONT, cursor: onClick ? "pointer" : "default", WebkitTapHighlightColor: "transparent" };
  return onClick ? <button onClick={onClick} style={{ ...base, border: base.border, padding: 0 }}>{children}</button> : <div style={base}>{children}</div>;
}
function Eyebrow({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: "var(--text-caption)", fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: GOLD, fontFamily: FONT, marginBottom: 8 }}>{children}</div>;
}

const LEVEL_LINE: Record<string, string> = {
  guest: "Начните знакомство — даршаны и святое имя.",
  neophyte: "Каждый день — шаг к Кришне.",
  practicing: "Ваша садхана ждёт.",
  initiated: "Служение и памятование о Кришне.",
  guru: "Ведите других светом святого имени.",
};

export default function TodayHub({ onOpenPath, onSub }: { onOpenPath: (path: string) => void; onSub: (sub: string) => void }) {
  const { user } = useAuth();
  const level = effectiveLevel(user);
  const name = (user?.name || getLocalDevotee().name || "").trim();
  const practicing = level === "practicing" || level === "initiated" || level === "guru";

  const [verse, setVerse] = useState<{ label: string; translation: string | null } | null>(null);
  const [japa, setJapa] = useState(() => readJapaToday());
  const [nextEv, setNextEv] = useState<{ title: string; days: number; type: string } | null>(null);

  useEffect(() => {
    let alive = true;
    void readingClient.unit(getPlan().from).then((u) => {
      if (!alive) return;
      const v = u.verses[0];
      if (v) setVerse({ label: v.label, translation: v.translation });
    }).catch(() => {});
    void fetchNextEvent().then((e) => { if (alive) setNextEv(e); });
    // Круги могли измениться в счётчике — обновляем при возврате на вкладку.
    const onVis = () => setJapa(readJapaToday());
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => { alive = false; document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", onVis); };
  }, []);

  const label: CSSProperties = { fontSize: "var(--text-footnote)", fontWeight: 600, letterSpacing: 0.2, color: INK3, fontFamily: FONT, textTransform: "uppercase", margin: "22px 4px 8px" };
  const pct = Math.min(100, Math.round((japa.rounds / Math.max(1, japa.goal)) * 100));
  const done = japa.rounds >= japa.goal;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Приветствие */}
      <div style={{ padding: "6px 4px 2px" }}>
        <div style={{ fontSize: "var(--text-footnote)", fontWeight: 600, color: GOLD, fontFamily: FONT, letterSpacing: 0.3 }}>{ruDate()}</div>
        <div style={{ fontSize: "var(--text-title1)", fontWeight: 700, color: INK, fontFamily: FONT, letterSpacing: -0.3, marginTop: 3 }}>
          {name ? `Харе Кришна, ${name}` : "Харе Кришна"}
        </div>
        {level && <div style={{ fontSize: "var(--text-subhead)", color: INK2, fontFamily: FONT, marginTop: 4 }}>{LEVEL_LINE[level]}</div>}
      </div>

      {/* Даршан дня */}
      <div style={{ margin: "14px -16px 0" }}><DarshanRings /></div>

      {/* Стих дня */}
      {verse && (
        <>
          <div style={label}>Стих дня</div>
          <Card onClick={() => onOpenPath("/verse")}>
            <div style={{ padding: "15px 16px" }}>
              <Eyebrow>{verse.label}</Eyebrow>
              <div style={{ fontFamily: SERIF, fontSize: "var(--text-body)", lineHeight: 1.5, color: INK }}>
                {verse.translation ? `«${verse.translation.length > 210 ? verse.translation.slice(0, 208).trimEnd() + "…" : verse.translation}»` : "Откройте стих дня"}
              </div>
              <div style={{ fontSize: "var(--text-footnote)", fontWeight: 600, color: GOLD, fontFamily: FONT, marginTop: 10 }}>Читать со стихом и комментарием →</div>
            </div>
          </Card>
        </>
      )}

      {/* Садхана */}
      <div style={label}>Садхана</div>
      <Card onClick={() => onOpenPath("/japa")}>
        <div style={{ padding: "15px 16px" }}>
          {practicing ? (
            <>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <span style={{ fontSize: "var(--text-callout)", fontWeight: 600, color: INK, fontFamily: FONT }}>Круги джапы сегодня</span>
                <span style={{ fontSize: "var(--text-subhead)", fontWeight: 700, color: done ? "var(--color-success-text, #2a9c68)" : GOLD, fontFamily: FONT }}>{japa.rounds} / {japa.goal}</span>
              </div>
              <div style={{ height: 8, borderRadius: 8, background: "rgba(120,120,128,0.18)", marginTop: 10, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", borderRadius: 8, background: done ? "var(--color-success-text, #2a9c68)" : GOLD, transition: "width .3s" }} />
              </div>
              <div style={{ fontSize: "var(--text-footnote)", fontWeight: 600, color: GOLD, fontFamily: FONT, marginTop: 11 }}>
                {done ? "Норма закрыта — Харе Кришна ✓" : `Продолжить джапу →`}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: "var(--text-callout)", fontWeight: 600, color: INK, fontFamily: FONT }}>Повторяйте святое имя</div>
              <div style={{ fontSize: "var(--text-subhead)", lineHeight: 1.45, color: INK2, fontFamily: FONT, marginTop: 5 }}>Харе Кришна, Харе Кришна, Кришна Кришна, Харе Харе… Начните с одного круга на чётках.</div>
              <div style={{ fontSize: "var(--text-footnote)", fontWeight: 600, color: GOLD, fontFamily: FONT, marginTop: 11 }}>Открыть счётчик джапы →</div>
            </>
          )}
        </div>
      </Card>

      {/* Ближайшее событие */}
      {nextEv && (
        <>
          <div style={label}>Ближайшее</div>
          <Card onClick={() => (nextEv.type === "ekadasi" ? onOpenPath("/ekadashi") : onSub("calendar"))}>
            <div style={{ padding: "15px 16px", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ flexShrink: 0, width: 52, textAlign: "center" }}>
                <div style={{ fontSize: "var(--text-title2)", fontWeight: 800, color: GOLD, fontFamily: FONT, lineHeight: 1 }}>{nextEv.days <= 0 ? "•" : nextEv.days}</div>
                <div style={{ fontSize: "var(--text-caption2)", color: INK3, fontFamily: FONT, marginTop: 2 }}>{nextEv.days <= 1 ? "" : "дней"}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "var(--text-caption)", fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: INK3, fontFamily: FONT }}>{daysLabel(nextEv.days)}</div>
                <div style={{ fontSize: "var(--text-callout)", fontWeight: 600, color: INK, fontFamily: FONT, marginTop: 2, lineHeight: 1.3 }}>{nextEv.title}</div>
              </div>
              <span style={{ color: INK3, flexShrink: 0 }}>›</span>
            </div>
          </Card>
        </>
      )}

      {/* Адаптивные быстрые переходы */}
      <div style={label}>Куда дальше</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {(level === "guest"
          ? [["Даршаны", () => onSub("feed")], ["Календарь", () => onSub("calendar")], ["Читать «Гиту»", () => onOpenPath("/books/bg")]]
          : [["Джапа", () => onOpenPath("/japa")], ["Дневник", () => onOpenPath("/story")], ["Практика", () => onSub("practice")], ["Календарь", () => onSub("calendar")]]
        ).map(([t, go]) => (
          <button key={t as string} onClick={go as () => void} style={{ padding: "10px 16px", borderRadius: 999, border: `1px solid ${HAIR}`, background: SURF, color: INK, fontFamily: FONT, fontSize: "var(--text-subhead)", fontWeight: 500, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>{t as string}</button>
        ))}
      </div>
    </div>
  );
}
