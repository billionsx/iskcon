import { useEffect, useMemo, useState } from "react";
import { api } from "./api";

type Person = {
  slug: string; name: string; kind: string | null; hero_image: string | null;
  n_quotes: number; lila: string | null; wave: string | null; rasa: string | null; tattva: string | null;
};

const LILAS: [string, string][] = [
  ["lila-gauranga", "Гауранга"], ["lila-krishna", "Кришна"], ["lila-rama", "Рама"],
  ["lila-mahabharata", "Махабхарата"], ["lila-avatara", "Аватары"], ["lila-puranas", "Полубоги"],
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

function Pills({ value, onChange, items, count }: {
  value: string; onChange: (v: string) => void; items: [string, string][]; count?: (v: string) => number;
}) {
  return (
    <div className="lh-pills">
      {items.map(([v, label]) => {
        const on = v === value;
        const n = count ? count(v) : null;
        return (
          <button key={v || "all"} type="button" onClick={() => onChange(v)} className={"lh-pill" + (on ? " on" : "")}>
            {label}{n != null ? <span className="lh-pill-n">{n}</span> : null}
          </button>
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
    fetch(api("/content/pkl")).then((r) => r.json())
      .then((d) => { if (live) setItems(d.items ?? []); })
      .catch(() => { if (live) setItems([]); });
    return () => { live = false; };
  }, []);
  useEffect(() => { setSub(""); }, [lila]);

  const qq = q.trim().toLowerCase();
  const nameHit = (p: Person) => !qq || p.name.toLowerCase().includes(qq);
  const tattvaHit = (p: Person) => !tattva || p.tattva === tattva;

  const lilaCount = (lv: string) => (items ?? []).filter((p) => p.lila === lv && tattvaHit(p) && nameHit(p)).length;
  const inLila = useMemo(
    () => (items ?? []).filter((p) => p.lila === lila && tattvaHit(p) && nameHit(p)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, lila, tattva, qq],
  );
  const subCount = (sv: string) => (sv === "" ? inLila.length : inLila.filter((p) => p.wave === sv || p.rasa === sv).length);
  const filtered = useMemo(() => inLila.filter((p) => !sub || p.wave === sub || p.rasa === sub), [inLila, sub]);
  const subItems = lila === "lila-gauranga" ? WAVES : lila === "lila-krishna" ? RASAS : null;
  const lilaLabel = LILAS.find(([v]) => v === lila)?.[1] ?? "";

  return (
    <div>
      <style>{`
.lh-bar{position:sticky;top:0;z-index:6;margin:-4px -16px 6px;padding:10px 16px 6px;background:var(--color-bg);border-bottom:0.5px solid var(--color-hairline);}
.lh-search{position:relative;margin-bottom:10px;}
.lh-search>svg{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--color-label-3);pointer-events:none;}
.lh-search>input{width:100%;box-sizing:border-box;padding:9px 12px 9px 34px;border-radius:11px;border:none;background:var(--color-bg-3);color:var(--color-label);font-family:var(--font-text);font-size:var(--text-callout);outline:none;}
.lh-search>input::placeholder{color:var(--color-label-3);}
.lh-pills{display:flex;gap:6px;overflow-x:auto;padding:3px 0;scrollbar-width:none;}
.lh-pills::-webkit-scrollbar{display:none;}
.lh-pill{flex-shrink:0;display:inline-flex;align-items:center;gap:6px;padding:7px 13px;border-radius:999px;cursor:pointer;font-family:var(--font-text);font-size:var(--text-footnote);font-weight:var(--weight-semibold);white-space:nowrap;border:0.5px solid var(--color-hairline);background:var(--color-bg-2);color:var(--color-label-2);transition:background .18s ease,color .18s ease,border-color .18s ease,transform .08s ease;}
.lh-pill:active{transform:scale(0.94);}
.lh-pill.on{background:var(--color-brand-blue);color:#fff;border-color:transparent;}
.lh-pill-n{font-size:10.5px;font-weight:var(--weight-bold);opacity:.65;font-variant-numeric:tabular-nums;}
.lh-pill.on .lh-pill-n{opacity:.9;}
.lh-cap{margin:2px 0 8px;font-family:var(--font-text);font-size:var(--text-caption2);color:var(--color-label-3);text-transform:uppercase;letter-spacing:var(--tracking-wide);}
.lh-list{list-style:none;margin:0;padding:0;border-radius:var(--radius-lg);overflow:hidden;background:var(--color-bg-2);border:0.5px solid var(--color-hairline);animation:lhfade .24s cubic-bezier(.4,0,.2,1);}
@keyframes lhfade{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;}}
.lh-row{display:flex;width:100%;align-items:center;gap:12px;padding:11px 12px;text-align:left;background:none;border:none;cursor:pointer;color:var(--color-label);font-family:var(--font-text);transition:background .1s ease;}
.lh-row:active{background:var(--color-bg-3);}
.lh-ava{width:52px;height:52px;border-radius:var(--radius-md);flex-shrink:0;object-fit:cover;}
.lh-ini{display:grid;place-items:center;width:52px;height:52px;border-radius:var(--radius-md);flex-shrink:0;background:var(--color-bg-3);color:var(--color-label-2);font-family:var(--font-display);font-size:22px;font-weight:var(--weight-bold);}
      `}</style>

      <div className="lh-bar">
        <div className="lh-search">
          <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M20 20l-3.2-3.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск личности" />
        </div>
        <Pills value={lila} onChange={setLila} items={LILAS} count={lilaCount} />
        {subItems ? <Pills value={sub} onChange={setSub} items={subItems} count={subCount} /> : null}
        <Pills value={tattva} onChange={setTattva} items={TATTVAS} />
      </div>

      <div className="lh-cap">{lilaLabel} · {filtered.length}</div>

      {!items ? <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", color: "var(--color-label-2)" }}>Загрузка…</div> : null}
      {items && filtered.length === 0 ? <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", color: "var(--color-label-2)", padding: "var(--space-6) 0", textAlign: "center" }}>Никого не найдено</div> : null}
      {items && filtered.length > 0 ? (
        <ul className="lh-list" key={lila + sub + tattva + qq}>
          {filtered.map((p, i) => (
            <li key={p.slug} style={{ borderBottom: i === filtered.length - 1 ? "none" : "0.5px solid var(--color-hairline)" }}>
              <button className="lh-row" onClick={() => onOpenEntity(p.slug, null)}>
                {p.hero_image
                  ? <img className="lh-ava" src={p.hero_image} alt="" loading="lazy" />
                  : <span className="lh-ini">{(p.name || "?").trim().charAt(0)}</span>}
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "block", fontSize: "var(--text-callout)", fontWeight: "var(--weight-semibold)", lineHeight: 1.3, color: "var(--color-label)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                  {(p.kind || p.n_quotes) ? <span style={{ display: "block", marginTop: 2, fontSize: "var(--text-footnote)", color: "var(--color-label-2)" }}>{[p.kind, p.n_quotes ? `${p.n_quotes} цитат` : null].filter(Boolean).join(" · ")}</span> : null}
                </span>
                <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden style={{ flexShrink: 0, color: "var(--color-label-3)" }}><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
