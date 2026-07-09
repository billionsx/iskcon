import { useEffect, useMemo, useState } from "react";
import { api } from "./api";

const GOLD = "#E6BE55";

type Person = {
  slug: string; name: string; hero_image: string | null; n_quotes: number;
  lila: string | null; wave: string | null; rasa: string | null; tattva: string | null; note: string | null;
};

const LILAS: [string, string][] = [
  ["all", "Все"], ["lila-gauranga", "Гауранга Лила"], ["lila-krishna", "Кришна Лила"],
  ["lila-rama", "Рама Лила"], ["lila-mahabharata", "Махабхарата"], ["lila-avatara", "Аватары"], ["lila-puranas", "Полубоги"],
];
const WAVES: [string, string][] = [
  ["", "Все"], ["wave-1", "Первая волна"], ["wave-2", "Вторая волна"], ["wave-3", "Третья волна"],
  ["wave-4", "Четвёртая волна"], ["wave-5", "Пятая волна"], ["wave-iskcon", "Беспрецедентная волна"],
];
const RASAS: [string, string][] = [
  ["", "Все"], ["rasa:shanta", "Шанта"], ["rasa:dasya", "Дасья"], ["rasa:sakhya", "Сакхья"],
  ["rasa:vatsalya", "Ватсалья"], ["rasa:madhurya", "Мадхурья"],
];

function Pills({ value, onChange, items, count, sec }: {
  value: string; onChange: (v: string) => void; items: [string, string][]; count?: (v: string) => number; sec?: boolean;
}) {
  return (
    <div className="lh-pills">
      {items.map(([v, label]) => {
        const on = v === value;
        const n = count ? count(v) : null;
        return (
          <button key={v || "all"} type="button" onClick={() => onChange(v)} className={"lh-pill" + (sec ? " sec" : "") + (on ? " on" : "")}>
            {label}{n != null ? <span className="lh-pill-n">{n}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export default function LichnostiHub({ onOpenEntity }: { onOpenEntity: (id: string, type: string | null) => void }) {
  const [items, setItems] = useState<Person[] | null>(null);
  const [lila, setLila] = useState("all");
  const [sub, setSub] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    let live = true;
    fetch(api("/content/pkl")).then((r) => r.json())
      .then((d) => { if (live) setItems(d.items ?? []); })
      .catch(() => { if (live) setItems([]); });
    return () => { live = false; };
  }, []);
  useEffect(() => { setSub(""); }, [lila]);

  const qq = q.trim().toLowerCase();
  const nameHit = (p: Person) => !qq || p.name.toLowerCase().includes(qq) || (p.note ?? "").toLowerCase().includes(qq);
  const lilaCount = (lv: string) => (items ?? []).filter((p) => (lv === "all" || p.lila === lv) && nameHit(p)).length;
  const inLila = useMemo(
    () => (items ?? []).filter((p) => (lila === "all" || p.lila === lila) && nameHit(p)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, lila, qq],
  );
  const subCount = (sv: string) => (sv === "" ? inLila.length : inLila.filter((p) => p.wave === sv || p.rasa === sv).length);
  const filtered = useMemo(() => inLila.filter((p) => !sub || p.wave === sub || p.rasa === sub), [inLila, sub]);
  const subItems = lila === "lila-gauranga" ? WAVES : lila === "lila-krishna" ? RASAS : null;
  const subLabel = lila === "lila-gauranga" ? "Волна проповеди" : lila === "lila-krishna" ? "Раса" : null;

  return (
    <div>
      <style>{`
.lh-bar{position:sticky;top:0;z-index:8;margin:-6px -16px 2px;padding:10px 16px 8px;background:color-mix(in srgb, var(--color-bg) 84%, transparent);backdrop-filter:blur(40px) saturate(180%);-webkit-backdrop-filter:blur(40px) saturate(180%);}
.lh-search{position:relative;margin-bottom:14px;}
.lh-search>svg{position:absolute;left:13px;top:50%;transform:translateY(-50%);color:var(--color-label-3);pointer-events:none;}
.lh-search>input{width:100%;box-sizing:border-box;padding:10px 14px 10px 36px;border-radius:12px;border:none;background:var(--color-bg-2);color:var(--color-label);font-family:var(--font-text);font-size:15px;letter-spacing:-0.2px;outline:none;}
.lh-search>input::placeholder{color:var(--color-label-3);}
.lh-grp{margin-bottom:10px;}
.lh-lbl{font-family:var(--font-text);font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${GOLD};opacity:.9;margin:0 2px 7px;}
.lh-pills{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;}
.lh-pills::-webkit-scrollbar{display:none;}
.lh-pill{flex-shrink:0;display:inline-flex;align-items:center;gap:6px;padding:8px 15px;border-radius:999px;cursor:pointer;font-family:var(--font-text);font-size:14px;font-weight:600;letter-spacing:-0.2px;white-space:nowrap;background:var(--color-bg-2);color:var(--color-label-2);border:0.5px solid var(--color-hairline);transition:background .18s,color .18s,transform .09s;}
.lh-pill:active{transform:scale(0.95);}
.lh-pill.on{background:var(--color-label);color:var(--color-bg);border-color:transparent;}
.lh-pill.sec{padding:7px 13px;font-size:13px;background:transparent;color:var(--color-label-3);border-color:transparent;}
.lh-pill.sec.on{background:var(--color-bg-3);color:var(--color-label);}
.lh-pill-n{font-size:11px;font-weight:700;opacity:.5;font-variant-numeric:tabular-nums;}
.lh-pill.on .lh-pill-n{opacity:.72;}
.lh-cap{margin:8px 2px 10px;font-family:var(--font-text);font-size:12px;font-weight:700;letter-spacing:0.04em;color:var(--color-label-3);text-transform:uppercase;}
.lh-cards{display:flex;flex-direction:column;gap:8px;animation:lhfade .26s cubic-bezier(.32,.72,0,1);}
@keyframes lhfade{from{opacity:0;transform:translateY(7px);}to{opacity:1;transform:none;}}
.lh-card{display:flex;align-items:center;gap:12px;width:100%;text-align:left;padding:10px 13px;border-radius:14px;border:0.5px solid var(--color-hairline);background:var(--color-bg-2);cursor:pointer;color:inherit;font:inherit;transition:transform .09s ease,background .14s ease;}
.lh-card:active{transform:scale(0.985);background:var(--color-bg-3);}
.lh-ava{height:44px;width:44px;flex-shrink:0;border-radius:50%;object-fit:cover;}
.lh-mono{display:grid;place-items:center;height:44px;width:44px;flex-shrink:0;border-radius:50%;background:color-mix(in srgb, ${GOLD} 14%, transparent);color:${GOLD};font-family:var(--font-display);font-weight:700;font-size:17px;}
.lh-tx{flex:1;min-width:0;}
.lh-nm{display:block;font-family:var(--font-text);font-size:15.5px;font-weight:600;letter-spacing:-0.2px;line-height:1.3;color:var(--color-label);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.lh-sub{display:block;margin-top:1px;font-family:var(--font-text);font-size:12.5px;line-height:1.3;color:var(--color-label-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.lh-chev{flex-shrink:0;color:var(--color-label-3);font-size:20px;line-height:1;opacity:.6;}
      `}</style>

      <div className="lh-bar">
        <div className="lh-search">
          <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M20 20l-3.4-3.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск личности" />
        </div>

        <div className="lh-grp"><Pills value={lila} onChange={setLila} items={LILAS} count={lilaCount} /></div>

        {subItems ? (
          <div className="lh-grp">
            <div className="lh-lbl">{subLabel}</div>
            <Pills value={sub} onChange={setSub} items={subItems} count={subCount} sec />
          </div>
        ) : null}
      </div>

      <div className="lh-cap">{filtered.length} {filtered.length % 10 === 1 && filtered.length % 100 !== 11 ? "личность" : (filtered.length % 10 >= 2 && filtered.length % 10 <= 4 && (filtered.length % 100 < 10 || filtered.length % 100 >= 20) ? "личности" : "личностей")}</div>

      {!items ? <div style={{ fontFamily: "var(--font-text)", fontSize: "15px", color: "var(--color-label-2)" }}>Загрузка…</div> : null}
      {items && filtered.length === 0 ? <div style={{ fontFamily: "var(--font-text)", fontSize: "15px", color: "var(--color-label-3)", padding: "40px 0", textAlign: "center" }}>Никого не найдено</div> : null}
      {items && filtered.length > 0 ? (
        <div className="lh-cards" key={lila + sub + qq}>
          {filtered.map((p) => (
            <button key={p.slug} className="lh-card" onClick={() => onOpenEntity(p.slug, null)}>
              {p.hero_image
                ? <img className="lh-ava" src={p.hero_image} alt="" loading="lazy" />
                : <span className="lh-mono">{(p.name || "·").trim().charAt(0).toUpperCase()}</span>}
              <span className="lh-tx">
                <span className="lh-nm">{p.name}</span>
                {p.note ? <span className="lh-sub">{p.note}</span> : (p.n_quotes ? <span className="lh-sub">{p.n_quotes} цитат</span> : null)}
              </span>
              <span aria-hidden className="lh-chev">›</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
