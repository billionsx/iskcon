/**
 * Ц9 · ПУДЖА И БОЖЕСТВА — /puja (вкладка Садханы).
 *
 * Четыре раздела: Божества ИСККОН (карточки из D1 `deities` — та же таблица,
 * что у алтарей центров) · Утренняя программа · Арати (предметы + песни) ·
 * Предложение пищи. Все тексты — ссылки на СУЩЕСТВУЮЩИЕ молитвы (канон в
 * puja.ts); адреса — только строителями PATHS (ЗКН-Н060/Н092: путь руками не
 * собираем). Счёт кругов арати различается по храмам — даём порядок, не число.
 */

import { useEffect, useState, type CSSProperties } from "react";
import { api } from "./api";
import { ROUTES } from "./routes";
import { ARATI_ITEMS, ARATI_SONGS, BHOGA, MORNING, type PujaLink } from "./puja";

const FONT = "var(--font-text)";
const INK = "var(--color-ink)";
const INK2 = "var(--color-ink-2)";
const INK3 = "var(--color-ink-3)";
const GOLD = "var(--color-gold)";
const CARD = "var(--color-surface-2)";
const HAIR = "var(--color-hairline)";

interface Deity { id: string; name_ru: string | null; about_ru: string | null; entity_id: string | null; pranama_slug: string | null }

export default function PujaScreen({ onBack, onOpen }: { onBack: () => void; onOpen: (path: string) => void }) {
  const [deities, setDeities] = useState<Deity[]>([]);

  useEffect(() => {
    let alive = true;
    void fetch(api("/deities")).then((r) => r.json())
      .then((d: { deities?: Deity[] }) => { if (alive && d.deities) setDeities(d.deities); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const label: CSSProperties = { fontSize: "var(--text-footnote)", fontWeight: 600, color: INK3, fontFamily: FONT, textTransform: "uppercase", margin: "22px 4px 8px" };
  const linkRow = (l: PujaLink, i: number) => (
    <button key={l.title} type="button" onClick={() => l.slug && onOpen(ROUTES.bhajans(l.slug))}
      style={{ display: "flex", width: "100%", textAlign: "left", alignItems: "center", gap: 12, padding: "13px 14px", border: "none", background: "none", cursor: l.slug ? "pointer" : "default", borderTop: i ? `0.5px solid ${HAIR}` : "none", WebkitTapHighlightColor: "transparent" }}>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "block", fontFamily: FONT, fontSize: "var(--text-callout)", fontWeight: 600, color: INK }}>{l.title}</span>
        <span style={{ display: "block", marginTop: 2, fontFamily: FONT, fontSize: "var(--text-footnote)", color: INK3 }}>{l.sub}</span>
      </span>
      {l.slug && <span aria-hidden style={{ color: GOLD, fontFamily: FONT, fontWeight: 600 }}>›</span>}
    </button>
  );

  return (
    <div style={{ padding: "0 16px calc(96px + env(safe-area-inset-bottom))" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "10px 0 2px" }}>
        <button type="button" onClick={onBack} aria-label="Назад"
          style={{ border: "none", background: "none", color: GOLD, fontFamily: FONT, fontSize: "var(--text-body)", fontWeight: 600, padding: "6px 8px 6px 0", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
          ‹ Назад
        </button>
      </div>
      <h1 style={{ margin: "2px 4px 0", fontFamily: FONT, fontSize: "var(--text-title1)", fontWeight: 700, color: INK }}>Пуджа и Божества</h1>
      <div style={{ margin: "6px 4px 0", fontFamily: FONT, fontSize: "var(--text-subhead)", color: INK2 }}>
        Поклонение Божествам ИСККОН: главные образы, утренняя программа, порядок арати и мантры предложения — по текстам ачарьев из библиотеки.
      </div>

      {deities.length > 0 && (
        <>
          <div style={label}>Божества ИСККОН</div>
          {deities.map((d) => (
            <div key={d.id} style={{ background: CARD, borderRadius: 14, padding: "14px 16px", marginBottom: 10 }}>
              <div style={{ fontFamily: FONT, fontSize: "var(--text-callout)", fontWeight: 700, color: INK }}>{d.name_ru}</div>
              {d.about_ru && <div style={{ marginTop: 5, fontFamily: FONT, fontSize: "var(--text-footnote)", color: INK2 }}>{d.about_ru}</div>}
              <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
                {d.pranama_slug && (
                  <button type="button" onClick={() => onOpen(ROUTES.bhajans(d.pranama_slug as string))}
                    style={{ border: "none", background: "none", padding: 0, cursor: "pointer", fontFamily: FONT, fontSize: "var(--text-footnote)", fontWeight: 600, color: GOLD, WebkitTapHighlightColor: "transparent" }}>
                    Пранама-мантра →
                  </button>
                )}
                {d.entity_id && (
                  <button type="button" onClick={() => onOpen(ROUTES.entity(d.entity_id as string))}
                    style={{ border: "none", background: "none", padding: 0, cursor: "pointer", fontFamily: FONT, fontSize: "var(--text-footnote)", fontWeight: 600, color: GOLD, WebkitTapHighlightColor: "transparent" }}>
                    О Господе →
                  </button>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      <div style={label}>Утренняя программа</div>
      <div style={{ background: CARD, borderRadius: 14, overflow: "hidden" }}>{MORNING.map(linkRow)}</div>

      <div style={label}>Порядок арати</div>
      <div style={{ background: CARD, borderRadius: 14, overflow: "hidden" }}>
        {ARATI_ITEMS.map((it, i) => (
          <div key={it.title} style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "11px 14px", borderTop: i ? `0.5px solid ${HAIR}` : "none" }}>
            <span aria-hidden style={{ flexShrink: 0, width: 22, fontFamily: FONT, fontSize: "var(--text-footnote)", fontWeight: 700, color: GOLD }}>{i + 1}</span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ fontFamily: FONT, fontSize: "var(--text-callout)", fontWeight: 600, color: INK }}>{it.title}</span>
              <span style={{ display: "block", marginTop: 1, fontFamily: FONT, fontSize: "var(--text-footnote)", color: INK3 }}>{it.sub}</span>
            </span>
          </div>
        ))}
      </div>
      <div style={{ margin: "8px 4px 0", fontFamily: FONT, fontSize: "var(--text-footnote)", color: INK3 }}>
        Каждый предмет обводят перед Божествами по кругу; число кругов — по стандарту вашего храма.
      </div>

      <div style={label}>Песни арати</div>
      <div style={{ background: CARD, borderRadius: 14, overflow: "hidden" }}>{ARATI_SONGS.map(linkRow)}</div>

      <div style={label}>Предложение пищи</div>
      <div style={{ background: CARD, borderRadius: 14, overflow: "hidden" }}>{BHOGA.map(linkRow)}</div>
    </div>
  );
}
