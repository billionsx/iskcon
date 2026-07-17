/**
 * PinnedEvents (ЗПС) — закреплённые посты события в ленте Даршана.
 *
 * В день праздника / явления / ухода / экадаши наверху «Ленты» появляется
 * закреплённая карточка события — ТА ЖЕ карточка, что и в «Календаре» (единый
 * модуль EventCard, variant="feed"). Тап ведёт СРАЗУ на карточку личности
 * (EntityPage) или на экран «Экадаши-практика» — без всплывающих листов
 * (ЗКН-Н080).
 *
 * Источник — тот же /api/calendar по городу пользователя (localStorage cal-loc,
 * дефолт Вриндаван), что и «Календарь»; описания личностей — /content/pkl.
 * Всё грузится тихо: сеть недоступна, событий на сегодня нет или описания ещё
 * не подъехали для личности — ничего не рендерим (return null), лента открывается
 * как обычно. Никаких пустых мест и «скачков» имени.
 */
import { useEffect, useState } from "react";
import { api } from "../api";
import { EventCard, fmtDay, type EventBrief, type CalType } from "../EventCard";

interface RawEvent { date: string; title: string; orig: string; type: CalType; entityId?: string | null }
interface StoredLoc { key: string; ru: string; lat?: number | null; lng?: number | null }

const DEFAULT_LOC: StoredLoc = { key: "Vrindavan [India]", ru: "Вриндаван" };
const CAL_CLIENT_VER = "4";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function storedLoc(): StoredLoc {
  try {
    const raw = localStorage.getItem("cal-loc");
    if (raw) { const j = JSON.parse(raw); if (j && j.key && j.ru) return j; }
  } catch { /* noop */ }
  return DEFAULT_LOC;
}
// Тот же контракт параметров, что и «Календарь»: латинский ключ города и/или
// координаты; титхи считается на восходе В ТОЧКЕ, поэтому город важен.
function calParams(loc: StoredLoc): URLSearchParams {
  const p = new URLSearchParams();
  const latin = /^[A-Za-z .()'-]+ \[[A-Za-z .]+\]$/.test(loc.key);
  if (latin) p.set("loc", loc.key);
  if (typeof loc.lat === "number" && typeof loc.lng === "number") { p.set("lat", String(loc.lat)); p.set("lng", String(loc.lng)); }
  if (![...p.keys()].length) p.set("loc", loc.key);
  return p;
}

// Выход из поста для экадаши: ближайшая парана после дня экадаши.
// Формат совпадает с «Календарём»: «12 января · 08:15–10:42».
function paranaShort(events: RawEvent[], eka: RawEvent): string | null {
  const p = events
    .filter((e) => e.type === "parana" && e.date > eka.date)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!p) return null;
  const f = fmtDay(p.date);
  const range = p.orig.match(/(\d{1,2}:\d{2}).*?[-–]\s*(\d{1,2}:\d{2})/) || p.title.match(/(\d{1,2}:\d{2}).*?[-–]\s*(\d{1,2}:\d{2})/);
  if (range) return `${f.d} ${f.m} · ${range[1]}–${range[2]}`;
  const one = p.title.match(/(\d{1,2}:\d{2})/) || p.orig.match(/(\d{1,2}:\d{2})/);
  return one ? `${f.d} ${f.m} · ${one[1]}` : `${f.d} ${f.m}`;
}

export function PinnedEvents() {
  const [events, setEvents] = useState<RawEvent[] | null>(null);
  const [briefMap, setBriefMap] = useState<Map<string, EventBrief> | null>(null);

  useEffect(() => {
    let alive = true;
    const loc = storedLoc();
    fetch("/api/calendar?cv=" + CAL_CLIENT_VER + "&" + calParams(loc).toString(), { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && j) setEvents((j.events || []) as RawEvent[]); })
      .catch(() => { /* сеть — лента откроется без закрепа */ });
    fetch(api("/content/pkl"), { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const m = new Map<string, EventBrief>();
        for (const p of (d.items ?? [])) m.set(p.slug, { name: p.name, note: p.note, summary: p.summary, lila: p.lila, sub: p.sub, grp: p.grp });
        setBriefMap(m);
      })
      .catch(() => { /* без описаний личностей */ });
    return () => { alive = false; };
  }, []);

  if (!events) return null;
  const today = todayISO();
  // Постим в ленту только то, что ведёт к цели: явление/уход/праздник с личностью
  // или экадаши. Парана — спутник экадаши, отдельным постом не идёт. Максимум 3.
  const todays = events
    .filter((e) => e.date === today && e.type !== "parana" && (!!e.entityId || e.type === "ekadasi"))
    .slice(0, 3);
  if (todays.length === 0) return null;
  // Не мигаем «Личностью»: если сегодня есть событие-личность, ждём описания.
  const needBrief = todays.some((e) => !!e.entityId);
  if (needBrief && !briefMap) return null;

  return (
    <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
      {todays.map((e, i) => (
        <EventCard
          key={e.date + e.orig + i}
          variant="feed"
          event={e}
          brief={e.entityId && briefMap ? (briefMap.get(e.entityId) || null) : null}
          parana={e.type === "ekadasi" ? paranaShort(events, e) : null}
        />
      ))}
    </div>
  );
}
