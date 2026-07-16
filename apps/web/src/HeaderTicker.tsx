/**
 * HeaderTicker — «живая» шапка в духе Apple 2026.
 *
 * Центр шапки не статичен: он мягко перелистывает между ЛОГОТИПОМ и СОБЫТИЯМИ
 * календаря — как виджет на Lock Screen, который сам знает, что показать сейчас.
 *
 * Событие рисуется тремя строками (эталон — виджет «Календарь» iOS):
 *   • сверху — «когда» (Сегодня/Завтра): 8px, серым, капсом (тихий контекст);
 *   • центр — НАЗВАНИЕ капсом, крупно; если шире шапки — бежит строкой (marquee);
 *   • снизу — суть: ЯВЛЕНИЕ / УХОД / ПОСТ + окно параны (акцент золотом).
 *
 * Логика показа:
 *   • событий сегодня нет и до завтрашнего далеко → ТОЛЬКО логотип;
 *   • есть событие сегодня → логотип ⇄ событие(я);
 *   • завтрашнее «просыпается» с 18:00 (вечер — время готовить завтрашний день).
 *
 * Ритм неравномерный: логотип — покой, живёт дольше; событие — акцент, короче.
 * Переход — кросс-фейд с лёгким подъёмом. prefers-reduced-motion гасит анимацию.
 *
 * Данные — /api/calendar по сохранённому городу (или Вриндаван). Ошибка/пусто →
 * просто логотип. Тип события уже приходит из API: ekadasi | parana | festival |
 * appearance | disappearance. Парана (окно выхода из поста) — отдельное событие на
 * следующий за экадаши день; клеим его к экадаши для нижней строки.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";

interface CalEvent { date: string; title: string; type: string }

type Slot =
  | { kind: "logo" }
  | { kind: "event"; when: "today" | "tomorrow"; name: string; sub: string; path: string };

const DAY_MS = 86_400_000;
const DWELL_LOGO = 6000;    // покой дышит дольше
const DWELL_EVENT = 5200;   // 3 строки + возможная бегущая строка — глазу нужно больше
const FADE_MS = 550;

/* Ключи-кадры бегущей строки. Дистанция задаётся переменной --mq на самом
 * элементе, поэтому один @keyframes обслуживает любую ширину. Ping-pong с
 * задержками у краёв — спокойнее вечного прокручивания и не требует дубля DOM. */
const MARQUEE_CSS =
  "@keyframes iolhmarq{0%,9%{transform:translateX(0)}46%,54%{transform:translateX(var(--mq))}91%,100%{transform:translateX(0)}}";

function ymd(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Заголовок для шапки: до тире-описания и без хвостовых скобок; дефис в
 *  «Йогини-экадаши» не трогаем (режем только « — …» с пробелами). */
function shortTitle(t: string): string {
  return (t.split(/\s+[—–-]\s+/)[0] || t).replace(/\s*\([^)]*\)\s*$/, "").trim() || t;
}

/** Окно параны для экадаши: отдельное событие type=parana на СЛЕДУЮЩИЙ день,
 *  заголовок «Выход из поста HH:MM–HH:MM». Возвращаем «HH:MM–HH:MM» / «HH:MM» / null. */
function paranaWindow(events: CalEvent[], ekadasiDate: string): string | null {
  const [y, m, d] = ekadasiDate.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  const p = events.find((e) => e.type === "parana" && e.date === next);
  if (!p) return null;
  const two = p.title.match(/(\d{1,2}:\d{2})\D+(\d{1,2}:\d{2})/);
  if (two) return `${two[1]}–${two[2]}`;
  const one = p.title.match(/(\d{1,2}:\d{2})/);
  return one ? one[1] : null;
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

/** Слоты на ТЕКУЩИЙ момент: логотип + сегодняшние события + (с 18:00) завтрашнее.
 *  Показываем 4 рода событий, которые уместны в шапке: пост (экадаши), праздник,
 *  явление и уход вайшнава. Санкранти/паран/«continues» — дело экрана Календаря. */
const SHOWN = new Set(["ekadasi", "festival", "appearance", "disappearance"]);

function deriveSlots(events: CalEvent[], now: Date): Slot[] {
  const today = ymd(now);
  const tomorrow = ymd(new Date(now.getTime() + DAY_MS));
  const toSlot = (e: CalEvent, when: "today" | "tomorrow"): Slot => {
    let name: string, sub = "";
    if (e.type === "appearance") { name = e.title.replace(/^Явление[:\s]+/, ""); sub = "Явление"; }
    else if (e.type === "disappearance") { name = e.title.replace(/^Уход[:\s]+/, ""); sub = "Уход"; }
    else if (e.type === "ekadasi") { name = shortTitle(e.title); const w = paranaWindow(events, e.date); sub = w ? `Пост · парана ${w}` : "Пост"; }
    else { name = shortTitle(e.title); sub = ""; } // festival — только название
    const path = e.type === "ekadasi" ? "/ekadashi" : `/calendar/${e.date}`;
    return { kind: "event", when, name: name || shortTitle(e.title), sub, path };
  };
  const slots: Slot[] = [{ kind: "logo" }];
  for (const e of events.filter((e) => e.date === today && SHOWN.has(e.type))) slots.push(toSlot(e, "today"));
  if (now.getHours() >= 18) for (const e of events.filter((e) => e.date === tomorrow && SHOWN.has(e.type))) slots.push(toSlot(e, "tomorrow"));
  return slots;
}

/** Текстовый вордмарк: SF Pro Display Semibold, трекинг 20%, кап-высота ≈ прежнего
 *  SVG-лого. marginRight гасит трейлинг-трекинг справа для оптического центра. */
const WORDMARK_STYLE: CSSProperties = {
  fontFamily: "var(--font-display)", fontSize: "var(--text-caption)", fontWeight: 600,
  letterSpacing: "0.2em", color: "var(--color-label)", whiteSpace: "nowrap", marginRight: "-0.2em",
};

/** Название события: капсом, крупно. Если шире шапки — едет бегущей строкой
 *  (ping-pong), иначе стоит по центру. Анимируем только активный слот. */
function NameMarquee({ text, active }: { text: string; active: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const [dist, setDist] = useState(0); // >0 → не влезает, нужен marquee

  useLayoutEffect(() => {
    const measure = () => {
      const w = wrap.current, s = inner.current;
      if (!w || !s) return;
      const over = s.scrollWidth - w.clientWidth;
      setDist(over > 2 ? over : 0);
    };
    measure();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(measure);
      if (wrap.current) ro.observe(wrap.current);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [text]);

  const over = dist > 0;
  const dur = Math.max(6, Math.round(dist / 16) + 4);
  const style: CSSProperties = {
    display: "inline-block", whiteSpace: "nowrap",
    fontFamily: "var(--font-display)", fontSize: "var(--text-footnote)", fontWeight: 600,
    letterSpacing: "0.015em", textTransform: "uppercase", color: "var(--color-label)", lineHeight: 1.15,
  };
  if (over && active) {
    (style as Record<string, string>).animation = `iolhmarq ${dur}s ease-in-out infinite`;
    (style as Record<string, string>)["--mq"] = `${-dist}px`;
  }
  return (
    <div ref={wrap} style={{ width: "100%", overflow: "hidden", display: "flex", justifyContent: over ? "flex-start" : "center" }}>
      <span ref={inner} style={style}>{text}</span>
    </div>
  );
}

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

  const renderSlot = (s: Slot, isActive: boolean) => {
    if (s.kind === "logo") {
      return (
        <button type="button" aria-label="ISKCON ONE LOVE" onClick={onHome}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", width: "100%", padding: 0, background: "none", border: "none", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
          <span style={WORDMARK_STYLE}>ISKCON ONE LOVE</span>
        </button>
      );
    }
    return (
      <button type="button" aria-label={`${s.when === "tomorrow" ? "Завтра" : "Сегодня"}: ${s.name}${s.sub ? ", " + s.sub : ""}`}
        onClick={() => onOpenPath(s.path)}
        style={{ display: "flex", flexDirection: "column", alignItems: "stretch", justifyContent: "center", gap: 2, height: "100%", width: "100%", padding: "0 4px", background: "none", border: "none", cursor: "pointer", WebkitTapHighlightColor: "transparent", overflow: "hidden" }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: "8px", fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--color-label-2)", lineHeight: 1, textAlign: "center", marginRight: "-0.18em" }}>
          {s.when === "tomorrow" ? "Завтра" : "Сегодня"}
        </span>
        <NameMarquee text={s.name} active={isActive} />
        {s.sub && (
          <span style={{ fontFamily: "var(--font-display)", fontSize: "8px", fontWeight: 600, letterSpacing: "0.13em", textTransform: "uppercase", color: "var(--color-gold-deep)", lineHeight: 1, textAlign: "center", marginRight: "-0.13em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {s.sub}
          </span>
        )}
      </button>
    );
  };

  // один слот (только логотип) — без стопки и таймеров, просто логотип
  if (slots.length <= 1) {
    return <div style={{ position: "relative", width: "min(58vw, 244px)", height: 44 }}>{renderSlot({ kind: "logo" }, true)}</div>;
  }

  return (
    <div style={{ position: "relative", width: "min(58vw, 244px)", height: 44 }}>
      <style dangerouslySetInnerHTML={{ __html: MARQUEE_CSS }} />
      {slots.map((s, i) => (
        <div key={i} aria-hidden={i !== active}
          style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            opacity: i === active ? 1 : 0,
            transform: i === active ? "translateY(0)" : "translateY(3px)",
            transition: reduced.current ? "none" : `opacity ${FADE_MS}ms cubic-bezier(.4,0,.2,1), transform ${FADE_MS}ms cubic-bezier(.4,0,.2,1)`,
            pointerEvents: i === active ? "auto" : "none",
          }}>
          {renderSlot(s, i === active)}
        </div>
      ))}
    </div>
  );
}
