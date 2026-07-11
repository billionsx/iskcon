/**
 * CalendarEventCard (МКСК) — Минимальная Карточка События Календаря.
 * Нижний лист (по стандарту HomeSheet): тип события + дата, заголовок, а для
 * событий-персон — имя, чипы принадлежности (лила · волна · группа), краткое
 * описание и стандартные действия карточки (Открыть / ♥ / ⋯). Данные о личности
 * (лила/волна/описание) берутся из карты /content/pkl, переданной хостом.
 */
import { HomeSheet } from "./HomeSheet";
import { CardActionBtns, favMetaFromCtx, useCardActions } from "./cardActions";
import { cleanCardText } from "./cardText";

export type EventBrief = {
  name?: string; note?: string | null; summary?: string | null;
  lila?: string | null; sub?: string | null; grp?: string | null;
};

const TYPE_META: Record<string, { label: string; color: string }> = {
  ekadasi: { label: "Экадаши", color: "var(--color-gold)" },
  parana: { label: "Парана", color: "var(--color-label-3)" },
  festival: { label: "Праздник", color: "var(--color-gold-deep)" },
  appearance: { label: "Явление", color: "#2E9E5B" },
  disappearance: { label: "Уход", color: "var(--color-label-2)" },
  other: { label: "Событие", color: "var(--color-label-3)" },
};

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

const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const WD = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
function fmtDate(iso: string): string {
  const p = iso.split("-").map(Number);
  if (p.length < 3) return iso;
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  return `${p[2]} ${MONTHS_GEN[p[1] - 1] || ""} · ${WD[d.getUTCDay()]}`;
}

function chipsFor(b: EventBrief): string[] {
  const out: string[] = [];
  if (b.lila && LILA_L[b.lila]) out.push(LILA_L[b.lila]);
  if (b.sub && SUB_L[b.sub]) out.push(SUB_L[b.sub]);
  if (b.grp && GRP_L[b.grp]) out.push(GRP_L[b.grp]);
  return out;
}

export function CalendarEventCard({ open, title, date, type, entityId, brief, onOpen, onClose }: {
  open: boolean; title: string; date: string; type: string;
  entityId?: string | null; brief?: EventBrief | null;
  onOpen: (id: string) => void; onClose: () => void;
}) {
  const { openCardMenu } = useCardActions();
  const meta = TYPE_META[type] || TYPE_META.other;
  const name = brief?.name || "";
  const desc = cleanCardText(brief?.note || brief?.summary);
  const chips = brief ? chipsFor(brief) : [];
  const hasPerson = !!entityId && (type === "appearance" || type === "disappearance" || !!brief);

  const ctx = entityId
    ? {
        type: "entity" as const, id: entityId, title: name || title, subtitle: desc || undefined,
        url: `https://gaurangers.com/${encodeURIComponent(entityId)}`,
        context: `Событие календаря · ${title} · /${entityId}`,
      }
    : null;

  return (
    <HomeSheet open={open} label="Событие календаря" onClose={onClose}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 999, background: "var(--color-glass-regular)" }}>
          <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: meta.color }} />
          <span style={{ fontFamily: "var(--font-text)", fontSize: 12.5, fontWeight: 700, letterSpacing: "-0.01em", color: meta.color }}>{meta.label}</span>
        </span>
        <span style={{ fontFamily: "var(--font-text)", fontSize: 13, fontWeight: 600, color: "var(--color-label-3)" }}>{fmtDate(date)}</span>
      </div>

      <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2, color: "var(--color-label)", textWrap: "balance" }}>{title}</h2>

      {hasPerson && (
        <div style={{ marginTop: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
            <span style={{ display: "grid", placeItems: "center", flexShrink: 0, width: 46, height: 46, borderRadius: "50%", background: "var(--color-fill-1)", color: "var(--color-label-2)", fontFamily: "var(--font-scripture)", fontWeight: 500, fontSize: 19 }}>
              {(name || "?").trim().charAt(0).toUpperCase()}
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: "var(--font-text)", fontSize: 16.5, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.25, color: "var(--color-label)" }}>{name || "Личность"}</div>
              {chips.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 5 }}>
                  {chips.map((c, i) => (
                    <span key={i} style={{ fontFamily: "var(--font-text)", fontSize: 11, fontWeight: 700, letterSpacing: "0.02em", padding: "3px 8px", borderRadius: 7, background: i === 0 ? "color-mix(in srgb, #D2AA1B 15%, transparent)" : "var(--color-glass-thin)", color: i === 0 ? "#9a7d10" : "var(--color-label-2)" }}>{c}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {desc && (
            <p style={{ margin: "14px 0 0", fontFamily: "var(--font-text)", fontSize: 14.5, lineHeight: 1.5, color: "var(--color-label-2)" }}>{desc}</p>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 20 }}>
            <button type="button" onClick={() => { if (entityId) onOpen(entityId); }}
              style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "13px 16px", borderRadius: 14, border: "none", cursor: "pointer", background: "var(--color-label)", color: "var(--color-bg)", fontFamily: "var(--font-text)", fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", WebkitTapHighlightColor: "transparent" }}>
              Открыть карточку
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden><path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            {ctx && <CardActionBtns favKey={`entity:${entityId}`} meta={favMetaFromCtx(ctx)} size={40} onMore={() => openCardMenu(ctx)} />}
          </div>
        </div>
      )}

      {!hasPerson && (
        <p style={{ margin: "16px 0 0", fontFamily: "var(--font-text)", fontSize: 14.5, lineHeight: 1.55, color: "var(--color-label-3)" }}>
          {type === "ekadasi" ? "День экадаши — пост и усиленная духовная практика." : type === "parana" ? "Время выхода из поста (парана)." : "Событие вайшнавского календаря."}
        </p>
      )}
    </HomeSheet>
  );
}
