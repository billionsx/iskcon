/**
 * HeaderTicker — «живая» шапка в духе Apple 2026.
 *
 * Центр шапки не статичен: он мягко перелистывает между ЛОГОТИПОМ и СОБЫТИЯМИ
 * календаря (Экадаши/праздники) — как виджет на Lock Screen, который сам знает,
 * что показать именно сейчас.
 *
 * Логика показа (спроектирована как «что было бы уместно в этот момент»):
 *   • событий на сегодня нет и до завтрашнего ещё далеко → ТОЛЬКО логотип
 *     (ничего не крутится, тишина — это тоже состояние);
 *   • есть событие сегодня → логотип ⇄ событие(я) сегодня;
 *   • событие завтра «просыпается» в анонсе с 18:00 сегодня — вечер это время,
 *     когда завтрашний день уже осмысленно готовить (Экадаши держат с утра).
 *
 * Ритм неравномерный, как у Apple: логотип — состояние покоя, живёт дольше;
 * событие — акцент, мелькает короче. Переход — кросс-фейд с лёгким подъёмом.
 * При prefers-reduced-motion анимация выключается, но листание остаётся.
 *
 * Данные — тот же контракт, что у Экадаши/«Сегодня»: /api/calendar по
 * сохранённому городу (или Вриндаван). Ошибка/пусто → просто логотип.
 */
import { useEffect, useMemo, useRef, useState } from "react";

interface CalEvent { date: string; title: string; type: string }

type Slot =
  | { kind: "logo" }
  | { kind: "event"; when: "today" | "tomorrow"; title: string; path: string };

const DAY_MS = 86_400_000;
const DWELL_LOGO = 6000;   // покой дышит дольше
const DWELL_EVENT = 4200;  // акцент — короче
const FADE_MS = 550;

function ymd(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Заголовок для шапки: до тире-описания и без хвостовых скобок; дефис в
 *  «Йогини-экадаши» не трогаем (режем только « — …» с пробелами). */
function shortTitle(t: string): string {
  return (t.split(/\s+[—–-]\s+/)[0] || t).replace(/\s*\([^)]*\)\s*$/, "").trim() || t;
}

async function fetchEvents(): Promise<CalEvent[]> {
  let key = "Vrindavan [India]";
  let lat: number | undefined, lng: number | undefined;
  try {
    const raw = localStorage.getItem("cal-loc");
    if (raw) { const l = JSON.parse(raw) as { key?: string; lat?: number; lng?: number }; if (l.key) key = l.key; lat = l.lat; lng = l.lng; }
  } catch { /* Вриндаван по умолчанию */ }
  const params = new URLSearchParams();
  if (/^[A-Za-z .()'-]+ \[[A-Za-z .]+\]$/.test(key)) params.set("loc", key);
  if (typeof lat === "number" && typeof lng === "number") { params.set("lat", String(lat)); params.set("lng", String(lng)); }
  if (![...params.keys()].length) params.set("loc", key);
  try {
    const r = await fetch("/api/calendar?" + params.toString());
    if (!r.ok) return [];
    const j = (await r.json()) as { events?: CalEvent[] };
    return j.events || [];
  } catch { return []; }
}

/** Слоты на ТЕКУЩИЙ момент: логотип + сегодняшние события + (с 18:00) завтрашнее. */
function deriveSlots(events: CalEvent[], now: Date): Slot[] {
  const today = ymd(now);
  const tomorrow = ymd(new Date(now.getTime() + DAY_MS));
  const shown = (t: string) => t === "ekadasi" || t === "festival"; // парана — дело экрана Экадаши
  const toSlot = (e: CalEvent, when: "today" | "tomorrow"): Slot => ({
    kind: "event", when, title: shortTitle(e.title),
    path: e.type === "ekadasi" ? "/ekadashi" : `/calendar/${e.date}`,
  });
  const slots: Slot[] = [{ kind: "logo" }];
  for (const e of events.filter((e) => e.date === today && shown(e.type))) slots.push(toSlot(e, "today"));
  if (now.getHours() >= 18) for (const e of events.filter((e) => e.date === tomorrow && shown(e.type))) slots.push(toSlot(e, "tomorrow"));
  return slots;
}

const LOGO_STYLE = {
  display: "block", width: 132, height: 132 * 53 / 815, backgroundColor: "var(--color-label)",
  WebkitMaskImage: "url(/iskcon-one-love.svg)", maskImage: "url(/iskcon-one-love.svg)",
  WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
  WebkitMaskSize: "contain", maskSize: "contain",
  WebkitMaskPosition: "center", maskPosition: "center",
} as const;

export function HeaderTicker({ onHome, onOpenPath }: { onHome?: () => void; onOpenPath: (path: string) => void }) {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [clock, setClock] = useState(() => Date.now()); // грубые «часы» — двигают показ через 18:00 и полночь
  const [active, setActive] = useState(0);
  const reduced = useRef(typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

  // события: при монтировании и раз в 30 минут (ловим смену суток и новые праздники)
  useEffect(() => {
    let alive = true;
    const load = () => { void fetchEvents().then((e) => { if (alive) setEvents(e); }); };
    load();
    const id = setInterval(load, 30 * 60_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // «часы» раз в 5 минут — чтобы анонс на завтра появился близко к 18:00
  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 5 * 60_000);
    return () => clearInterval(id);
  }, []);

  const slots = useMemo(() => deriveSlots(events, new Date(clock)), [events, clock]);

  // список изменился — начинаем с логотипа
  useEffect(() => { setActive(0); }, [slots.length]);

  // неравномерное листание: логотип дольше, событие короче
  useEffect(() => {
    if (slots.length <= 1) return;
    const dwell = slots[active]?.kind === "logo" ? DWELL_LOGO : DWELL_EVENT;
    const id = setTimeout(() => setActive((a) => (a + 1) % slots.length), dwell);
    return () => clearTimeout(id);
  }, [active, slots]);

  const renderSlot = (s: Slot) => {
    if (s.kind === "logo") {
      return (
        <button type="button" aria-label="ISKCON ONE LOVE" onClick={onHome}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", width: "100%", padding: 0, background: "none", border: "none", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
          <span role="img" style={LOGO_STYLE} />
        </button>
      );
    }
    return (
      <button type="button" onClick={() => onOpenPath(s.path)}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, height: "100%", width: "100%", padding: "0 6px", background: "none", border: "none", cursor: "pointer", WebkitTapHighlightColor: "transparent", overflow: "hidden" }}>
        <span style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.7px", textTransform: "uppercase", color: "var(--color-gold-deep)", lineHeight: 1 }}>
          {s.when === "tomorrow" ? "Завтра" : "Сегодня"}
        </span>
        <span style={{ maxWidth: "100%", fontFamily: "var(--font-display)", fontSize: "var(--text-subhead)", fontWeight: 700, letterSpacing: "-0.01em", color: "var(--color-label)", lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {s.title}
        </span>
      </button>
    );
  };

  // один слот (только логотип) — без стопки и таймеров, просто логотип
  if (slots.length <= 1) {
    return <div style={{ position: "relative", width: "min(58vw, 244px)", height: 40 }}>{renderSlot({ kind: "logo" })}</div>;
  }

  return (
    <div style={{ position: "relative", width: "min(58vw, 244px)", height: 40 }}>
      {slots.map((s, i) => (
        <div key={i} aria-hidden={i !== active}
          style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            opacity: i === active ? 1 : 0,
            transform: i === active ? "translateY(0)" : "translateY(3px)",
            transition: reduced.current ? "none" : `opacity ${FADE_MS}ms cubic-bezier(.4,0,.2,1), transform ${FADE_MS}ms cubic-bezier(.4,0,.2,1)`,
            pointerEvents: i === active ? "auto" : "none",
          }}>
          {renderSlot(s)}
        </div>
      ))}
    </div>
  );
}
