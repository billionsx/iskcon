import { useEffect, useMemo, useState } from "react";
import { api } from "./api";

type Person = {
  slug: string; name: string; hero_image: string | null; n_quotes: number;
  lila: string | null; wave: string | null; rasa: string | null; tattva: string | null; note: string | null;
};

const LILAS: [string, string][] = [
  ["all", "Все"], ["lila-gauranga", "Гауранга"], ["lila-krishna", "Кришна"],
  ["lila-rama", "Рама"], ["lila-mahabharata", "Махабхарата"], ["lila-avatara", "Аватары"], ["lila-puranas", "Полубоги"],
];
const WAVES: [string, string][] = [
  ["", "Все"], ["wave-first", "1-я волна"], ["wave-second", "2-я волна"], ["wave-third", "3-я волна"],
];
const RASAS: [string, string][] = [
  ["", "Все"], ["rasa:madhurya", "Мадхурья"], ["rasa:vatsalya", "Ватсалья"],
  ["rasa:sakhya", "Сакхья"], ["rasa:dasya", "Дасья"], ["rasa:shanta", "Шанта"],
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
.lh-bar{position:sticky;top:0;z-index:6;margin:-6px -16px 2px;padding:10px 16px 8px;background:var(--color-bg);}
.lh-search{position:relative;margin-bottom:14px;}
.lh-search>svg{position:absolute;left:13px;top:50%;transform:translateY(-50%);color:var(--color-label-3);pointer-events:none;}
.lh-search>input{width:100%;box-sizing:border-box;padding:10px 14px 10px 36px;border-radius:12px;border:none;background:var(--color-bg-2);color:var(--color-label);font-family:var(--font-text);font-size:15px;letter-spacing:-0.2px;outline:none;}
.lh-search>input::placeholder{color:var(--color-label-3);}
.lh-grp{margin-bottom:10px;}
.lh-lbl{font-family:var(--font-text);font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:var(--color-label-3);margin:0 2px 7px;}
.lh-pills{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;}
.lh-pills::-webkit-scrollbar{display:none;}
.lh-pill{flex-shrink:0;display:inline-flex;align-items:center;gap:6px;padding:8px 15px;border-radius:999px;cursor:pointer;border:none;font-family:var(--font-text);font-size:14.5px;font-weight:600;letter-spacing:-0.2px;white-space:nowrap;background:var(--color-bg-2);color:var(--color-label-2);transition:background .2s ease,color .2s ease,transform .09s ease;}
.lh-pill:active{transform:scale(0.95);}
.lh-pill.on{background:var(--color-label);color:var(--color-bg);}
.lh-pill.sec{padding:6px 13px;font-size:13.5px;background:transparent;color:var(--color-label-3);}
.lh-pill.sec.on{background:var(--color-bg-3);color:var(--color-label);}
.lh-pill-n{font-size:11px;font-weight:700;opacity:.5;font-variant-numeric:tabular-nums;}
.lh-pill.on .lh-pill-n{opacity:.7;}
.lh-cap{margin:8px 2px 8px;font-family:var(--font-text);font-size:12px;font-weight:600;letter-spacing:0.02em;color:var(--color-label-3);text-transform:uppercase;}
.lh-list{list-style:none;margin:0;padding:0;border-radius:16px;overflow:hidden;background:var(--color-bg-2);animation:lhfade .26s cubic-bezier(.32,.72,0,1);}
@keyframes lhfade{from{opacity:0;transform:translateY(7px);}to{opacity:1;transform:none;}}
.lh-row{display:flex;width:100%;align-items:center;gap:13px;padding:10px 14px;text-align:left;background:none;border:none;cursor:pointer;color:var(--color-label);font-family:var(--font-text);transition:background .12s ease;}
.lh-row:active{background:var(--color-bg-3);}
.lh-sep{height:0.5px;background:var(--color-hairline);margin-left:67px;}
.lh-ava{width:46px;height:46px;border-radius:50%;flex-shrink:0;object-fit:cover;}
.lh-ini{display:grid;place-items:center;width:46px;height:46px;border-radius:50%;flex-shrink:0;background:linear-gradient(140deg,var(--color-bg-3),var(--color-bg-2));color:var(--color-label-3);font-family:var(--font-display);font-size:19px;font-weight:700;}
.lh-tx{min-width:0;flex:1;}
.lh-nm{display:block;font-size:15.5px;font-weight:600;letter-spacing:-0.2px;line-height:1.3;color:var(--color-label);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.lh-sub{display:block;margin-top:1px;font-size:12.5px;line-height:1.3;color:var(--color-label-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.lh-chev{flex-shrink:0;color:var(--color-label-3);opacity:.5;}
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

      <div className="lh-cap">{filtered.length} {filtered.length % 10 === 1 && filtered.length % 100 !== 11 ? "личность" : "личностей"}</div>

      {!items ? <div style={{ fontFamily: "var(--font-text)", fontSize: "15px", color: "var(--color-label-2)" }}>Загрузка…</div> : null}
      {items && filtered.length === 0 ? <div style={{ fontFamily: "var(--font-text)", fontSize: "15px", color: "var(--color-label-3)", padding: "36px 0", textAlign: "center" }}>Никого не найдено</div> : null}
      {items && filtered.length > 0 ? (
        <ul className="lh-list" key={lila + sub + qq}>
          {filtered.map((p, i) => (
            <li key={p.slug}>
              <button className="lh-row" onClick={() => onOpenEntity(p.slug, null)}>
                {p.hero_image
                  ? <img className="lh-ava" src={p.hero_image} alt="" loading="lazy" />
                  : <span className="lh-ini">{(p.name || "?").trim().charAt(0)}</span>}
                <span className="lh-tx">
                  <span className="lh-nm">{p.name}</span>
                  {p.note ? <span className="lh-sub">{p.note}</span> : (p.n_quotes ? <span className="lh-sub">{p.n_quotes} цитат</span> : null)}
                </span>
                <svg className="lh-chev" width="16" height="16" viewBox="0 0 24 24" aria-hidden><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              {i < filtered.length - 1 ? <div className="lh-sep" /> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
