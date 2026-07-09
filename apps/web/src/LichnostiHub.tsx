import { useEffect, useMemo, useState } from "react";
import { api } from "./api";

type Person = {
  slug: string; name: string; kind: string | null; hero_image: string | null;
  n_quotes: number; lila: string | null; wave: string | null; rasa: string | null; tattva: string | null;
};

const LILAS: [string, string][] = [
  ["lila-gauranga", "Гауранга-лила"],
  ["lila-krishna", "Кришна-лила"],
  ["lila-rama", "Рама-лила"],
  ["lila-mahabharata", "Махабхарата"],
  ["lila-avatara", "Аватары"],
  ["lila-puranas", "Полубоги"],
];
const WAVES: [string, string][] = [
  ["", "Все"], ["wave-first", "1-я волна"], ["wave-second", "2-я волна"], ["wave-third", "3-я волна"],
];
const RASAS: [string, string][] = [
  ["", "Все"], ["rasa:madhurya", "Мадхурья"], ["rasa:vatsalya", "Ватсалья"],
  ["rasa:sakhya", "Сакхья"], ["rasa:dasya", "Дасья"], ["rasa:shanta", "Шанта"],
];
const TATTVAS: [string, string][] = [
  ["", "Все таттвы"], ["vishnu-tattva", "Вишну"], ["jiva-tattva", "Джива"],
  ["shakti-tattva", "Шакти"], ["shiva-tattva", "Шива"],
];

function Pills({ value, onChange, items }: { value: string; onChange: (v: string) => void; items: [string, string][] }) {
  return (
    <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "4px 0", scrollbarWidth: "none", marginBottom: "var(--space-2)" }}>
      {items.map(([v, label]) => {
        const on = v === value;
        return (
          <button key={v || "all"} type="button" onClick={() => onChange(v)}
            style={{
              flexShrink: 0, padding: "6px 12px", borderRadius: 999, cursor: "pointer",
              fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: "var(--weight-semibold)",
              whiteSpace: "nowrap", border: "0.5px solid var(--color-hairline)",
              background: on ? "var(--color-brand-blue)" : "var(--color-bg-2)",
              color: on ? "#fff" : "var(--color-label-2)",
            }}>{label}</button>
        );
      })}
    </div>
  );
}

export default function LichnostiHub({ onOpenEntity }: { onOpenEntity: (id: string, type: string | null) => void }) {
  const [items, setItems] = useState<Person[] | null>(null);
  const [lila, setLila] = useState("lila-gauranga");
  const [sub, setSub] = useState("");
  const [tattva, setTattva] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    let live = true;
    fetch(api("/content/personalities"))
      .then((r) => r.json())
      .then((d) => { if (live) setItems(d.items ?? []); })
      .catch(() => { if (live) setItems([]); });
    return () => { live = false; };
  }, []);

  useEffect(() => { setSub(""); }, [lila]);

  const subItems = lila === "lila-gauranga" ? WAVES : lila === "lila-krishna" ? RASAS : null;
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    (items ?? []).forEach((p) => { if (p.lila) m[p.lila] = (m[p.lila] ?? 0) + 1; });
    return m;
  }, [items]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const qq = q.trim().toLowerCase();
    return items.filter((p) =>
      p.lila === lila
      && (!sub || p.wave === sub || p.rasa === sub)
      && (!tattva || p.tattva === tattva)
      && (!qq || p.name.toLowerCase().includes(qq)),
    );
  }, [items, lila, sub, tattva, q]);

  return (
    <div>
      <input
        value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск личности по имени"
        style={{
          width: "100%", boxSizing: "border-box", padding: "10px 14px", marginBottom: "var(--space-3)",
          borderRadius: "var(--radius-lg)", border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)",
          color: "var(--color-label)", fontFamily: "var(--font-text)", fontSize: "var(--text-callout)", outline: "none",
        }}
      />
      <Pills value={lila} onChange={setLila} items={LILAS} />
      {subItems && <Pills value={sub} onChange={setSub} items={subItems} />}
      <Pills value={tattva} onChange={setTattva} items={TATTVAS} />

      <div style={{ margin: "2px 0 var(--space-2)", fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", color: "var(--color-label-3)", textTransform: "uppercase", letterSpacing: "var(--tracking-wide)" }}>
        {(LILAS.find(([v]) => v === lila)?.[1]) ?? ""} · {filtered.length} из {counts[lila] ?? 0}
      </div>

      {!items && <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", color: "var(--color-label-2)" }}>Загрузка…</div>}
      {items && filtered.length === 0 && (
        <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", color: "var(--color-label-2)", padding: "var(--space-4) 0" }}>Ничего не найдено.</div>
      )}
      {items && filtered.length > 0 && (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)" }}>
          {filtered.map((p, i) => (
            <li key={p.slug} style={{ borderBottom: i === filtered.length - 1 ? "none" : "0.5px solid var(--color-hairline)" }}>
              <button onClick={() => onOpenEntity(p.slug, null)}
                style={{ display: "flex", width: "100%", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-3)", textAlign: "left", background: "none", border: "none", cursor: "pointer", color: "var(--color-label)", fontFamily: "var(--font-text)" }}>
                {p.hero_image
                  ? <img src={p.hero_image} alt="" loading="lazy" style={{ width: 52, height: 52, borderRadius: "var(--radius-md)", objectFit: "cover", flexShrink: 0 }} />
                  : <span style={{ display: "grid", placeItems: "center", width: 52, height: 52, borderRadius: "var(--radius-md)", flexShrink: 0, background: "var(--color-bg-3)", color: "var(--color-label-2)", fontFamily: "var(--font-display)", fontSize: 22, fontWeight: "var(--weight-bold)" }}>{(p.name || "?").trim().charAt(0)}</span>}
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "block", fontSize: "var(--text-callout)", fontWeight: "var(--weight-semibold)", lineHeight: 1.3, color: "var(--color-label)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                  {(p.kind || p.n_quotes) ? (
                    <span style={{ display: "block", marginTop: 2, fontSize: "var(--text-footnote)", color: "var(--color-label-2)" }}>
                      {[p.kind, p.n_quotes ? `${p.n_quotes} цитат` : null].filter(Boolean).join(" · ")}
                    </span>
                  ) : null}
                </span>
                <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden style={{ flexShrink: 0, color: "var(--color-label-2)" }}><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
