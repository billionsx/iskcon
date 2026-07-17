/**
 * EventCard (ЕКС) — единый модуль карточки события вайшнавского календаря.
 * Один компонент, две линзы; НИКАКИХ всплывающих листов — карточка самодостаточна,
 * а нажатие ведёт СРАЗУ к цели (ЗКН-Н080):
 *
 *   variant="list"  — строка списка в «Календаре» (внутри общего контейнера
 *     месяца): дата · тип · заголовок, а для экадаши ещё строка выхода из поста
 *     (парана). Тап по строке-личности → карточка личности (EntityPage), тап по
 *     экадаши → экран «Экадаши-практика». Событие без личности — просто строка.
 *
 *   variant="feed"  — закреплённая карточка события в ленте Даршана в день события:
 *     та же суть, крупнее, с портретом и чипами личности. Тап → личность.
 *
 * Раньше тап открывал нижний лист CalendarEventCard (МКСК). Лист — лишний слой:
 * человек тапал ещё раз, чтобы попасть на личность. Убран — тап ведёт напрямую.
 */
import { pushUrl } from "./nav";
import { ROUTES } from "./routes";
import { cleanCardText } from "./cardText";
import { COVER_FALLBACK } from "./ui/CoverFallback";
import { CardActionBtns, favMetaFromCtx, useCardActions } from "./cardActions";
import { moonPhase, moonLitPath } from "./moonPhase";

const GOLD = "var(--color-gold)";

export type CalType = "ekadasi" | "parana" | "festival" | "appearance" | "disappearance" | "other";
export interface EventLike { date: string; title: string; orig: string; type: CalType; entityId?: string | null }
export type EventBrief = {
  name?: string; note?: string | null; summary?: string | null;
  lila?: string | null; sub?: string | null; grp?: string | null;
};

// Тип различает СЛОВО, а не цвет (Apple 2026): у всех строк метка одного
// нейтрального серого; золото зарезервировано под «сегодня/выбрано».
export const TYPE_LABEL: Record<CalType, string> = {
  ekadasi: "Экадаши", parana: "Парана", festival: "Праздник",
  appearance: "Явление", disappearance: "Уход", other: "Событие",
};
export const TYPE_WORD: Record<CalType, string> = {
  ekadasi: "пост", parana: "парана", festival: "праздник",
  appearance: "явление", disappearance: "уход", other: "событие",
};
// Что достойно hero «что сейчас» (шапка календаря): пост, праздник, явление, уход.
export const HERO_TYPES = new Set<CalType>(["ekadasi", "festival", "appearance", "disappearance"]);

const LILA_L: Record<string, string> = {
  "lila-gauranga": "Гауранга Лила", "lila-krishna": "Кришна Лила",
  "lila-bhagavatam": "Шримад Бхагаватам", "lila-gita": "Бхагавад Гита", "lila-other": "Другие",
};
const SUB_L: Record<string, string> = {
  "wave-1": "I волна", "wave-2": "II волна", "wave-3": "III волна", "wave-4": "IV волна", "wave-5": "V волна",
  "wave-iskcon": "Беспрецедентная волна", "wave-sampradaya": "Ачарьи сампрадай",
  "rasa:shanta": "Шанта-раса", "rasa:dasya": "Дасья-раса", "rasa:sakhya": "Сакхья-раса",
  "rasa:vatsalya": "Ватсалья-раса", "rasa:madhurya": "Мадхурья-раса",
  "bhag-avatara": "Аватары", "bhag-rishi": "Мудрецы", "bhag-bhakta": "Цари и преданные",
  "bhag-devata": "Полубоги", "bhag-asura": "Демоны", "bhag-ramayana": "Рамаяна", "bhag-mahabharata": "Махабхарата",
};
const GRP_L: Record<string, string> = {
  "w1-pancha": "Панча-таттва", "w1-navadvipa": "Навадвипа", "w1-nilachala": "Нилачала",
  "w1-goswami": "Шесть Госвами", "w1-vrindavana": "Вриндаван", "w1-shrikhanda": "Шри Кханда",
  "w1-kulinagrama": "Кулина-грама", "w1-nityananda": "Свита Нитьянанды", "w1-korni": "Корни",
  "w2-acharyas": "Три ачарьи", "w2-parivara": "Ученики и спутники",
  "ws-madhva": "Брахма-Мадхва", "ws-shri": "Шри-сампрадая", "ws-kumara": "Кумара-сампрадая",
  "ws-rudra": "Рудра-сампрадая", "ws-rishi": "Мудрецы",
  "wi-founders": "Прабхупада и основатели", "wi-guru": "Инициирующие гуру",
  "wi-lilamrita": "Прабхупада-лиламрита", "wi-mission": "Миссия ИСККОН",
};
function chipsFor(b: EventBrief): string[] {
  const out: string[] = [];
  if (b.lila && LILA_L[b.lila]) out.push(LILA_L[b.lila]);
  if (b.sub && SUB_L[b.sub]) out.push(SUB_L[b.sub]);
  if (b.grp && GRP_L[b.grp]) out.push(GRP_L[b.grp]);
  return out;
}

const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const WD = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
export function fmtDay(iso: string): { d: string; wd: string; m: string; y: number } {
  const dt = new Date(iso + "T12:00:00");
  return { d: String(dt.getDate()), wd: WD[dt.getDay()], m: MONTHS_GEN[dt.getMonth()], y: dt.getFullYear() };
}

/* Иконка события — тонкий одновесный глиф в скруглённом квадрате (язык Apple).
 * Тип различает ФОРМА, а тема календаря диктует смысл:
 *   • Экадаши — НАСТОЯЩИЙ лик Луны по дате: шукла-экадаши растущая (почти полная),
 *     кришна-экадаши убывающая (серп) — вычисляется в moonPhase.ts;
 *   • пурнима → полная Луна, амавасья → новая Луна;
 *   • Чатурмасья / пост от зелени → лист;
 *   • явление → восход, уход → пламя лампады, праздник → искра, прочее → точка.
 * Цвет один: серый в покое, золото на «сегодня/выбрано» (золото — только акцент). */
const G_SUNRISE = (
  <g fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 17h16" /><path d="M7.5 17a4.5 4.5 0 0 1 9 0" />
    <path d="M12 5.4v2M5.6 8.1l1.4 1.4M18.4 8.1l-1.4 1.4" />
  </g>
);
const G_FLAME = <path d="M12 3.4c2.4 3 3.8 4.7 3.8 7A3.8 3.8 0 0 1 8.2 10.4c0-1 .4-2 1.2-2.8.2.9.8 1.4 1.5 1.4-.5-1.7 0-3.8 1.1-5.6Z" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />;
const G_SPARKLE = <path d="M12 3.4c.5 3.3 1.5 4.3 4.8 4.8-3.3.5-4.3 1.5-4.8 4.8-.5-3.3-1.5-4.3-4.8-4.8 3.3-.5 4.3-1.5 4.8-4.8Z" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />;
const G_LEAF = (
  <g fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 18C6 10 12 5 18 5c0 8-6 13-12 13Z" /><path d="M9 15c2-3 4.5-5.5 7.5-7" />
  </g>
);
const G_MOON_FULL = <><circle cx="12" cy="12" r="9" fill="currentColor" opacity={0.22} /><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth={1.5} /></>;
const G_MOON_NEW = <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth={1.4} opacity={0.85} />;
const G_DOT = <circle cx="12" cy="12" r="2.3" fill="currentColor" />;

function moonGlyph(date: string): React.ReactNode {
  const p = moonPhase(date);
  return (
    <>
      <path d={moonLitPath(p.frac, p.waxing)} fill="currentColor" />
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth={1.1} opacity={0.35} />
    </>
  );
}

function glyphFor(type: CalType, date?: string, title?: string): React.ReactNode {
  const t = title || "";
  if (type === "ekadasi" && date) return moonGlyph(date);
  if (/пурнима|полнолуни/i.test(t)) return G_MOON_FULL;
  if (/амавас|новолуни/i.test(t)) return G_MOON_NEW;
  if (/чатурмас|листов|зелен/i.test(t)) return G_LEAF;
  switch (type) {
    case "festival": return G_SPARKLE;
    case "appearance": return G_SUNRISE;
    case "disappearance": return G_FLAME;
    default: return G_DOT;
  }
}

export function TypeIcon({ type, date, title, size = 28, today = false }: { type: CalType; date?: string; title?: string; size?: number; today?: boolean }) {
  const g = Math.round(size * 0.64);
  return (
    <div style={{ flexShrink: 0, width: size, height: size, borderRadius: Math.round(size * 0.34), display: "flex", alignItems: "center", justifyContent: "center", background: today ? `color-mix(in srgb, ${GOLD} 15%, transparent)` : "transparent" }}>
      <svg width={g} height={g} viewBox="0 0 24 24" aria-hidden style={{ color: today ? GOLD : "var(--color-label-3)" }}>{glyphFor(type, date, title)}</svg>
    </div>
  );
}

/** Куда ведёт тап события: личность (EntityPage) · экран экадаши · никуда. */
export function eventTarget(e: EventLike): "entity" | "ekadashi" | null {
  if (e.entityId) return "entity";
  if (e.type === "ekadasi") return "ekadashi";
  return null;
}

/** Единственная точка перехода по событию — без всплывающих листов (ЗКН-Н080):
 *  личность → EntityPage, экадаши → экран практики. Используется и строкой
 *  «Календаря», и карточкой ленты, и hero-строками шапки. В «Календаре» есть
 *  onOpenEntity (openEntityTarget — мгновенный рендер + адрес); в ленте Даршана
 *  его нет — тогда ведём по адресу /<slug>, роутер откроет ту же карточку. */
export function goEvent(e: EventLike, onOpenEntity?: (id: string, type: string | null) => void): void {
  const t = eventTarget(e);
  if (t === "entity" && e.entityId) {
    if (onOpenEntity) onOpenEntity(e.entityId, "personality");
    else pushUrl(ROUTES.entity(e.entityId));
  } else if (t === "ekadashi") {
    pushUrl(ROUTES.ekadashi());
  }
}

/* ── Строка списка (variant="list") ─────────────────────────────────────────
 * Тот же визуал, что и раньше в HomeCalendar, но: (1) для экадаши добавлена
 * строка выхода из поста; (2) нажатие ведёт напрямую, без всплывающего листа. */
function EventRow({ e, brief, parana, first, today, picked, onOpenEntity, innerRef }: {
  e: EventLike; brief?: EventBrief | null; parana?: string | null;
  first: boolean; today: boolean; picked: boolean;
  onOpenEntity?: (id: string, type: string | null) => void;
  innerRef?: (el: HTMLElement | null) => void;
}) {
  const target = eventTarget(e);
  const linked = target === "entity" && !!onOpenEntity;
  const tappable = linked || target === "ekadashi";
  const accent = today || picked;
  const f = fmtDay(e.date);
  const tap = () => goEvent(e, onOpenEntity);
  // Формат строки (правка основателя): в ИМЕНИ нет «Уход/Явление» — оно строкой ниже.
  // Явление/Уход → имя личности, а под ним «{Тип} › {Лила}»; праздник/экадаши/событие → сам тип.
  const isBirth = e.type === "appearance" || e.type === "disappearance";
  const lilaLabel = brief?.lila ? LILA_L[brief.lila] : null;
  const rowTitle = isBirth ? (brief?.name || e.title.replace(/^(Уход|Явление)\s+/u, "")) : e.title;
  const rowSub = isBirth && lilaLabel ? `${TYPE_LABEL[e.type]} \u203A ${lilaLabel}` : TYPE_LABEL[e.type];
  const rowStyle: React.CSSProperties = {
    position: "relative",
    display: "flex", alignItems: "center", gap: 12, padding: "13px 15px",
    background: picked ? `color-mix(in srgb, ${GOLD} 11%, var(--color-bg-2))` : "none",
  };
  const inner = (
    <>
      {!first && <span aria-hidden style={{ position: "absolute", top: 0, left: 62, right: 0, height: "0.5px", background: "var(--color-hairline)" }} />}
      <div style={{ flexShrink: 0, width: 38, textAlign: "center" }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-title2)", fontWeight: 700, lineHeight: 1, letterSpacing: "-0.02em", color: accent ? GOLD : "var(--color-label)" }}>{f.d}</div>
        <div style={{ marginTop: 3, fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: accent ? GOLD : "var(--color-label-3)" }}>{f.wd}</div>
      </div>
      <TypeIcon type={e.type} date={e.date} title={e.title} today={accent} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-callout)", fontWeight: 600, letterSpacing: "-0.015em", lineHeight: 1.3, color: "var(--color-label)" }}>{rowTitle}</div>
        <div style={{ marginTop: 3, fontFamily: "var(--font-text)", fontSize: "var(--text-caption)", fontWeight: 600, letterSpacing: "0.01em", color: "var(--color-label-2)" }}>
          {today && <span style={{ color: GOLD }}>Сегодня · </span>}{rowSub}
        </div>
        {e.type === "ekadasi" && parana && (
          <div style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 600, color: "var(--color-label-2)" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden style={{ flexShrink: 0, color: GOLD }}><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            Выход из поста · {parana}
          </div>
        )}
      </div>
      {tappable && (
        <span aria-hidden style={{ flexShrink: 0, color: "var(--color-label-4)" }}>
          <svg width="15" height="15" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      )}
    </>
  );
  return tappable ? (
    <button ref={innerRef as (el: HTMLButtonElement | null) => void} type="button" onClick={tap}
      style={{ ...rowStyle, width: "100%", textAlign: "left", border: "none", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
      {inner}
    </button>
  ) : (
    <div ref={innerRef as (el: HTMLDivElement | null) => void} style={rowStyle}>{inner}</div>
  );
}

/* ── Закреплённая карточка ленты (variant="feed") ───────────────────────────
 * Карточка события дня в ленте Даршана: заголовок + личность (портрет, имя,
 * чипы, описание) или экадаши (выход из поста), тап ведёт на личность/практику.
 * Поверхность — цвет страницы + волосяная линия (ЗКН-Д014), лёгкий золотой кант. */
function EventFeedCard({ e, brief, parana, onOpenEntity }: {
  e: EventLike; brief?: EventBrief | null; parana?: string | null;
  onOpenEntity?: (id: string, type: string | null) => void;
}) {
  const { openCardMenu } = useCardActions();
  const target = eventTarget(e);
  const name = brief?.name || "";
  const desc = cleanCardText(brief?.note || brief?.summary);
  const chips = brief ? chipsFor(brief) : [];
  const hasPerson = target === "entity";
  const f = fmtDay(e.date);
  const tap = () => goEvent(e, onOpenEntity);
  const ctx = e.entityId
    ? { type: "entity" as const, id: e.entityId, title: name || e.title, subtitle: desc || undefined, url: ROUTES.entity(e.entityId), context: `Событие календаря · ${e.title} · /${e.entityId}` }
    : null;

  return (
    <div style={{ padding: 18, borderRadius: 22, background: "var(--color-bg-2)", border: `1px solid color-mix(in srgb, ${GOLD} 30%, transparent)`, boxShadow: "0 1px 2px rgba(0,0,0,0.05), 0 5px 14px rgba(0,0,0,0.05)" }}>
      <button type="button" onClick={tap}
        style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden style={{ color: GOLD }}><path d="M9 4h6l-1 6 4 4H6l4-4-1-6Z M12 14v6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" /></svg>
          <span style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: GOLD }}>Закреплено · Сегодня</span>
          <span style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 600, color: "var(--color-label-3)" }}>· {TYPE_LABEL[e.type]}</span>
        </div>

        <h3 style={{ margin: "11px 0 0", fontFamily: "var(--font-display)", fontSize: "var(--text-title2)", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2, color: "var(--color-label)", textWrap: "balance" }}>{e.title}</h3>

        {hasPerson && (
          <div style={{ marginTop: 15, display: "flex", alignItems: "center", gap: 13 }}>
            <img src={COVER_FALLBACK} alt="" loading="lazy" style={{ flexShrink: 0, width: 46, height: 46, borderRadius: "50%", objectFit: "cover", background: "var(--color-fill-1)" }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-body)", fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.25, color: "var(--color-label)" }}>{name || "Личность"}</div>
              {chips.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 5 }}>
                  {chips.map((c, i) => (
                    <span key={i} style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.02em", padding: "3px 8px", borderRadius: 7, background: i === 0 ? `color-mix(in srgb, ${GOLD} 15%, transparent)` : "var(--color-glass-thin)", color: i === 0 ? "var(--color-gold-deep)" : "var(--color-label-2)" }}>{c}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {hasPerson && desc && (
          <p style={{ margin: "13px 0 0", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", lineHeight: 1.5, color: "var(--color-label-2)" }}>{desc}</p>
        )}

        {e.type === "ekadasi" && (
          <p style={{ margin: "13px 0 0", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", lineHeight: 1.5, color: "var(--color-label-2)" }}>
            День экадаши — пост и усиленная духовная практика.{parana ? ` Выход из поста · ${parana}.` : ""}
          </p>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 16, fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: 600, color: "var(--color-gold-deep)" }}>
          {hasPerson ? "Открыть карточку личности" : "Открыть Экадаши-практику"}
          <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden><path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
      </button>

      {ctx && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
          <CardActionBtns plain favKey={`entity:${e.entityId}`} meta={favMetaFromCtx(ctx)} size={38} onMore={() => openCardMenu(ctx)} />
        </div>
      )}
    </div>
  );
}

export function EventCard(props: {
  variant: "list" | "feed";
  event: EventLike;
  brief?: EventBrief | null;
  parana?: string | null;
  first?: boolean;
  today?: boolean;
  picked?: boolean;
  onOpenEntity?: (id: string, type: string | null) => void;
  innerRef?: (el: HTMLElement | null) => void;
}) {
  if (props.variant === "feed") {
    return <EventFeedCard e={props.event} brief={props.brief} parana={props.parana} onOpenEntity={props.onOpenEntity} />;
  }
  return (
    <EventRow e={props.event} brief={props.brief} parana={props.parana}
      first={!!props.first} today={!!props.today} picked={!!props.picked}
      onOpenEntity={props.onOpenEntity} innerRef={props.innerRef} />
  );
}
