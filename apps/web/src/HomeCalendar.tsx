/**
 * HomeCalendar — «Календарь»: вайшнавские праздники, экадаши и дни ачарьев.
 * Данные: /data/vaisnava-calendar.json — собирает воркфлоу
 * vaisnava-calendar-fetch.yml из ICS vaisnavacalendar.info (расчёты GCal 11 —
 * официального софта Календарного комитета GBC; город — Шридхама Маяпур).
 *
 * Hero: ближайший экадаши + время выхода из поста (парана) следующего дня.
 * Tier-2 фильтр: Все | Экадаши | Праздники | Вайшнавы. Лента — секциями по месяцам.
 */
import { useEffect, useMemo, useState } from "react";
import { SectionSubTabs } from "./SectionSubTabs";

const GOLD = "#D2AA1B";
const fill: React.CSSProperties = { background: "var(--color-glass-thin)", borderRadius: 20 };

interface CalEvent { date: string; title: string; orig: string; type: "ekadasi" | "parana" | "festival" | "appearance" | "disappearance" | "other" }

let cache: CalEvent[] | null = null;
function loadCal(): Promise<CalEvent[]> {
  if (cache) return Promise.resolve(cache);
  return fetch("/data/vaisnava-calendar.json")
    .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
    .then((j) => { cache = (j.events || []) as CalEvent[]; return cache; });
}

const MONTH_RU = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const MONTH_H = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const WD_RU = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtDay(iso: string): { d: string; wd: string; m: string; y: number } {
  const dt = new Date(iso + "T12:00:00");
  return { d: String(dt.getDate()), wd: WD_RU[dt.getDay()], m: MONTH_RU[dt.getMonth()], y: dt.getFullYear() };
}

const TYPE_META: Record<CalEvent["type"], { label: string; color: string }> = {
  ekadasi: { label: "Экадаши", color: GOLD },
  parana: { label: "Парана", color: "var(--color-label-3)" },
  festival: { label: "Праздник", color: "var(--color-brand-blue)" },
  appearance: { label: "Явление", color: "#2E9E5B" },
  disappearance: { label: "Уход", color: "var(--color-label-2)" },
  other: { label: "Событие", color: "var(--color-label-3)" },
};

export function HomeCalendar({ stickyTop }: { stickyTop: number }) {
  const [all, setAll] = useState<CalEvent[] | null>(null);
  const [err, setErr] = useState(false);
  const [filt, setFilt] = useState<"all" | "ekadasi" | "festival" | "vaisnava">("all");
  useEffect(() => { loadCal().then(setAll).catch(() => setErr(true)); }, []);

  const today = todayISO();
  const upcoming = useMemo(() => (all || []).filter((e) => e.date >= today), [all, today]);

  // Ближайший экадаши + его парана (первое parana-событие после даты экадаши)
  const nextEka = useMemo(() => upcoming.find((e) => e.type === "ekadasi") || null, [upcoming]);
  const nextParana = useMemo(() => {
    if (!nextEka) return null;
    return upcoming.find((e) => e.type === "parana" && e.date > nextEka.date) || null;
  }, [upcoming, nextEka]);
  // Страховка: если в title нет времени — достаём из orig («Break fast 06:18 (sunrise) - 09:52 …»)
  const paranaText = useMemo(() => {
    if (!nextParana) return "";
    if (/\d{1,2}:\d{2}/.test(nextParana.title)) return nextParana.title;
    const m = nextParana.orig.match(/(\d{1,2}:\d{2}).*?-\s*(\d{1,2}:\d{2})/);
    return m ? `Выход из поста ${m[1]}–${m[2]} (Маяпур)` : nextParana.title;
  }, [nextParana]);

  const filtered = useMemo(() => {
    let r = upcoming.filter((e) => e.type !== "parana"); // парана показывается внутри hero и в дне экадаши не дублируем
    if (filt === "ekadasi") r = r.filter((e) => e.type === "ekadasi");
    else if (filt === "festival") r = r.filter((e) => e.type === "festival" || e.type === "other");
    else if (filt === "vaisnava") r = r.filter((e) => e.type === "appearance" || e.type === "disappearance");
    return r;
  }, [upcoming, filt]);

  // Группировка по месяцам
  const months = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    filtered.forEach((e) => { const k = e.date.slice(0, 7); (m.get(k) || m.set(k, []).get(k)!).push(e); });
    return [...m.entries()];
  }, [filtered]);

  return (
    <div>
      <div style={{ padding: "20px 0 0" }}>
        <div style={{ fontFamily: "var(--font-text)", fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLD }}>Вайшнавский календарь</div>
        <h2 style={{ margin: "5px 0 0", fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800, letterSpacing: "-0.022em", lineHeight: 1.1, color: "var(--color-label)" }}>Календарь ИСККОН</h2>
        <p style={{ margin: "8px 0 0", fontFamily: "var(--font-text)", fontSize: 14, lineHeight: 1.5, color: "var(--color-label-2)" }}>
          Экадаши, праздники и дни великих вайшнавов по расчётам GCal — официальной программы Календарного комитета GBC. Даты — по Шридхаме Маяпуру, всемирной штаб-квартире ИСККОН.
        </p>
      </div>

      {/* hero — ближайший экадаши */}
      {nextEka && (
        <div style={{ marginTop: 16, padding: "20px 18px", borderRadius: 22, background: `linear-gradient(135deg, color-mix(in srgb, ${GOLD} 16%, var(--color-glass-thin)), var(--color-glass-thin))` }}>
          <div style={{ fontFamily: "var(--font-text)", fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLD }}>Ближайший экадаши</div>
          <div style={{ marginTop: 6, fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.15, color: "var(--color-label)" }}>{nextEka.title.replace(" — пост", "")}</div>
          <div style={{ marginTop: 5, fontFamily: "var(--font-text)", fontSize: 14, color: "var(--color-label-2)" }}>
            {(() => { const f = fmtDay(nextEka.date); return `${f.wd}, ${f.d} ${f.m} ${f.y}`; })()} · пост
          </div>
          {nextParana && (
            <div style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 12px", borderRadius: 999, background: "var(--color-glass-regular)", fontFamily: "var(--font-text)", fontSize: 13, fontWeight: 600, color: "var(--color-label)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
              {(() => { const f = fmtDay(nextParana.date); return `${f.d} ${f.m}: ${paranaText}`; })()}
            </div>
          )}
        </div>
      )}

      <div style={{ height: 10 }} />
      <SectionSubTabs ariaLabel="Фильтр календаря" tone="light" top={stickyTop} bleed={16}
        items={[{ id: "all", label: "Все" }, { id: "ekadasi", label: "Экадаши" }, { id: "festival", label: "Праздники" }, { id: "vaisnava", label: "Вайшнавы" }]}
        active={filt} onChange={(id) => setFilt(id as typeof filt)} />

      <div style={{ marginTop: 6 }} aria-live="polite">
        {err && (
          <div style={{ padding: "30px 10px", textAlign: "center", fontFamily: "var(--font-text)", fontSize: 14.5, lineHeight: 1.55, color: "var(--color-label-3)" }}>
            Календарь обновляется. Попробуйте позже.
          </div>
        )}
        {!err && !all && (
          <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
            {[0, 1, 2].map((i) => <div key={i} style={{ height: 76, ...fill, opacity: 0.6 }} />)}
          </div>
        )}
        {all && months.map(([key, evs]) => {
          const [y, mo] = key.split("-").map(Number);
          return (
            <section key={key} style={{ marginTop: 20 }}>
              <div style={{ margin: "0 2px 10px", fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 800, letterSpacing: "-0.015em", color: "var(--color-label)" }}>
                {MONTH_H[mo - 1]} <span style={{ color: "var(--color-label-3)", fontWeight: 600 }}>{y}</span>
              </div>
              <div style={{ overflow: "hidden", ...fill }}>
                {evs.map((e, i) => {
                  const f = fmtDay(e.date); const meta = TYPE_META[e.type];
                  const isToday = e.date === today;
                  return (
                    <div key={e.date + e.orig + i} style={{ display: "flex", alignItems: "center", gap: 13, padding: "12px 14px", borderTop: i ? "0.5px solid var(--color-hairline)" : "none" }}>
                      <div style={{ flexShrink: 0, width: 44, textAlign: "center" }}>
                        <div style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 800, lineHeight: 1, color: isToday ? GOLD : "var(--color-label)" }}>{f.d}</div>
                        <div style={{ marginTop: 2, fontFamily: "var(--font-text)", fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", color: isToday ? GOLD : "var(--color-label-3)" }}>{f.wd}</div>
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontFamily: "var(--font-text)", fontSize: 14.5, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.35, color: "var(--color-label)" }}>{e.title}</div>
                        <div style={{ marginTop: 2, fontFamily: "var(--font-text)", fontSize: 11.5, fontWeight: 600, color: meta.color }}>{isToday ? "Сегодня · " : ""}{meta.label}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
        {all && (
          <p style={{ margin: "18px 2px 0", fontFamily: "var(--font-text)", fontSize: 11.5, lineHeight: 1.55, color: "var(--color-label-3)" }}>
            Время параны указано по Маяпуру (UTC+5:30). Для точного локального календаря вашего города —{" "}
            <a href="https://www.vaisnavacalendar.info/" target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-brand-blue)", textDecoration: "none", fontWeight: 600 }}>vaisnavacalendar.info</a>.
          </p>
        )}
      </div>
    </div>
  );
}
