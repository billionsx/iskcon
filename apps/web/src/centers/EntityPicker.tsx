/**
 * EntityPicker — привязка к сущности графа (Божество, праздник, личность…).
 *
 * Используется в менеджерах центра: позволяет найти сущность в общем реестре
 * (GET /api/entities?q=) и связать с ней Божество/событие центра. Связь делает
 * приложение сквозным: со страницы центра — переход к сущности, а на странице
 * сущности — список центров, где её можно встретить.
 *
 * value хранит { id, name } (id — это entity-id графа). onChange(null) — снять связь.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { centersClient, type EntityHit } from "./api";

const GOLD = "var(--color-gold)";
const L1 = "var(--color-label)";
const L2 = "var(--color-label-2)";
const L3 = "var(--color-label-3)";
const FILL2 = "var(--color-glass-regular)";
const HAIR = "var(--color-hairline)";
const FT = "var(--font-text)";

const TYPE_LABEL: Record<string, string> = {
  personality: "Личность",
  deity: "Божество",
  place: "Место",
  holy_place: "Святое место",
  festival: "Праздник",
  scripture: "Писание",
  concept: "Понятие",
  event: "Событие",
};

function hitName(h: EntityHit): string {
  return h.name_ru || h.name_iast || h.name_en || h.id;
}

export default function EntityPicker({
  value,
  onChange,
  placeholder = "Найти в реестре…",
}: {
  value: { id: string; name: string } | null;
  onChange: (v: { id: string; name: string } | null) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<EntityHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const my = ++seq.current;
    const t = setTimeout(() => {
      centersClient
        .searchEntities(term)
        .then((r) => { if (my === seq.current) { setHits(r.items || []); setOpen(true); } })
        .catch(() => { if (my === seq.current) setHits([]); })
        .finally(() => { if (my === seq.current) setLoading(false); });
    }, 280);
    return () => clearTimeout(t);
  }, [q]);

  if (value) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 11, background: `color-mix(in srgb, ${GOLD} 13%, transparent)`, border: `0.5px solid color-mix(in srgb, ${GOLD} 36%, transparent)` }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" /></svg>
          <span style={{ fontFamily: FT, fontSize: 14.5, fontWeight: 600, color: L1 }}>{value.name}</span>
        </span>
        <button type="button" onClick={() => onChange(null)} style={{ padding: "8px 12px", borderRadius: 11, border: "none", background: FILL2, color: L2, fontFamily: FT, fontSize: 13, fontWeight: 600, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
          Отвязать
        </button>
      </div>
    );
  }

  const input: CSSProperties = { width: "100%", boxSizing: "border-box", fontFamily: FT, fontSize: 15.5, color: L1, background: FILL2, border: "none", outline: "none", borderRadius: 12, padding: "11px 13px", WebkitTapHighlightColor: "transparent" };

  return (
    <div style={{ position: "relative" }}>
      <input
        style={input}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => hits.length && setOpen(true)}
        placeholder={placeholder}
        autoCapitalize="off"
        autoCorrect="off"
        maxLength={80}
      />
      {open && q.trim().length >= 2 && (
        <div style={{ marginTop: 8, borderRadius: 14, border: `0.5px solid ${HAIR}`, background: "var(--color-bg-2)", overflow: "hidden" }}>
          {loading && hits.length === 0 ? (
            <div style={{ padding: "13px 14px", fontFamily: FT, fontSize: 13.5, color: L3 }}>Поиск…</div>
          ) : hits.length === 0 ? (
            <div style={{ padding: "13px 14px", fontFamily: FT, fontSize: 13.5, color: L3 }}>Ничего не найдено</div>
          ) : (
            hits.map((h, i) => (
              <button
                key={h.id}
                type="button"
                onClick={() => { onChange({ id: h.id, name: hitName(h) }); setQ(""); setHits([]); setOpen(false); }}
                style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "11px 13px", border: "none", borderTop: i ? `0.5px solid ${HAIR}` : "none", background: "none", textAlign: "left", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}
              >
                {h.image ? (
                  <span style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: `center/cover no-repeat url("${h.image}"), ${FILL2}` }} />
                ) : (
                  <span style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: "grid", placeItems: "center", background: FILL2 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.7" aria-hidden><circle cx="12" cy="8" r="3.4" /><path d="M5 20c0-3.6 3.1-5.6 7-5.6s7 2 7 5.6" /></svg>
                  </span>
                )}
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "block", fontFamily: FT, fontSize: 14.5, fontWeight: 600, color: L1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{hitName(h)}</span>
                  {h.type && <span style={{ display: "block", fontFamily: FT, fontSize: 12, color: L3 }}>{TYPE_LABEL[h.type] || h.type}{h.name_iast && h.name_ru ? ` · ${h.name_iast}` : ""}</span>}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
