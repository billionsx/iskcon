import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { useFavorite } from "./cardActions";
import { HeartIcon, MoreIcon } from "./ui/icons";

const GOLD = "#E6BE55";

type Person = {
  slug: string; name: string; hero_image: string | null; n_quotes: number;
  lila: string | null; sub: string | null; note: string | null; summary: string | null; tattva: string | null;
};

const LILAS: [string, string][] = [
  ["lila-gauranga", "Гауранга Лила"], ["lila-krishna", "Кришна Лила"],
  ["lila-bhagavatam", "Шримад Бхагаватам"], ["lila-gita", "Бхагавад Гита"], ["lila-other", "Другие"],
];
const SUBS: Record<string, [string, string][]> = {
  "lila-gauranga": [["wave-1", "I волна"], ["wave-2", "II волна"], ["wave-3", "III волна"], ["wave-4", "IV волна"], ["wave-5", "V волна"], ["wave-iskcon", "Беспрецедентная"], ["wave-sampradaya", "Ачарьи сампрадай"], ["", "Все"]],
  "lila-krishna": [["rasa:shanta", "Шанта"], ["rasa:dasya", "Дасья"], ["rasa:sakhya", "Сакхья"], ["rasa:vatsalya", "Ватсалья"], ["rasa:madhurya", "Мадхурья"], ["", "Все"]],
  "lila-bhagavatam": [["bhag-ramayana", "Рамаяна"], ["bhag-mahabharata", "Махабхарата"], ["bhag-avatara", "Аватары"], ["bhag-devata", "Полубоги"], ["bhag-bhagavata", "Бхагаватам"], ["", "Все"]],
};
const LILA_UP: Record<string, string> = { "lila-gauranga": "Гауранга Лила", "lila-krishna": "Кришна Лила", "lila-bhagavatam": "Шримад Бхагаватам", "lila-gita": "Бхагавад Гита", "lila-other": "Другие" };
const SUB_UP: Record<string, string> = { "wave-1": "I волна", "wave-2": "II волна", "wave-3": "III волна", "wave-4": "IV волна", "wave-5": "V волна", "wave-iskcon": "ИСККОН", "wave-sampradaya": "Ачарьи сампрадай", "rasa:shanta": "Шанта", "rasa:dasya": "Дасья", "rasa:sakhya": "Сакхья", "rasa:vatsalya": "Ватсалья", "rasa:madhurya": "Мадхурья", "bhag-ramayana": "Рамаяна", "bhag-mahabharata": "Махабхарата", "bhag-avatara": "Аватары", "bhag-devata": "Полубоги", "bhag-bhagavata": "Бхагаватам" };

function eyebrowOf(p: Person): string {
  const l = LILA_UP[p.lila ?? ""] ?? "";
  const s = p.sub ? (SUB_UP[p.sub] ?? "") : "";
  return s ? `${l} · ${s}` : l;
}

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

function Card({ p, onOpen }: { p: Person; onOpen: (id: string, type: string | null) => void }) {
  const { on, toggle } = useFavorite(`entity:${p.slug}`, { t: p.name, s: p.note || p.summary || undefined, h: `/person/${encodeURIComponent(p.slug)}` });
  const desc = p.summary || p.note || (p.n_quotes ? `${p.n_quotes} цитат` : "");
  const share = () => {
    const url = `https://gaurangers.com/person/${p.slug}`;
    const nav = typeof navigator !== "undefined" ? (navigator as unknown as { share?: (d: { title: string; url: string }) => Promise<void>; clipboard?: { writeText: (t: string) => Promise<void> } }) : null;
    if (nav?.share) nav.share({ title: p.name, url }).catch(() => {});
    else nav?.clipboard?.writeText(url).catch(() => {});
  };
  return (
    <div className="lh-card" role="button" tabIndex={0} onClick={() => onOpen(p.slug, null)}>
      {p.hero_image
        ? <img className="lh-ava" src={p.hero_image} alt="" loading="lazy" />
        : <span className="lh-mono">{(p.name || "·").trim().charAt(0).toUpperCase()}</span>}
      <div className="lh-tx">
        <div className="lh-eye">{eyebrowOf(p)}</div>
        <div className="lh-nm">{p.name}</div>
        {desc ? <div className="lh-sub">{desc}</div> : null}
      </div>
      <div className="lh-acts" onClick={(e) => e.stopPropagation()}>
        <button type="button" className={"lh-act" + (on ? " fav" : "")} aria-label="В избранное" onClick={() => toggle()}><HeartIcon size={18} filled={on} /></button>
        <button type="button" className="lh-act" aria-label="Поделиться" onClick={share}><MoreIcon size={16} /></button>
      </div>
    </div>
  );
}

export default function LichnostiHub({ onOpenEntity }: { onOpenEntity: (id: string, type: string | null) => void }) {
  const [items, setItems] = useState<Person[] | null>(null);
  const [lila, setLila] = useState("lila-gauranga");
  const [subSel, setSubSel] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    let live = true;
    fetch(api("/content/pkl")).then((r) => r.json())
      .then((d) => { if (live) setItems(d.items ?? []); })
      .catch(() => { if (live) setItems([]); });
    return () => { live = false; };
  }, []);
  useEffect(() => { setSubSel(""); }, [lila]);

  const qq = q.trim().toLowerCase();
  const hit = (p: Person) => !qq || p.name.toLowerCase().includes(qq) || (p.note ?? "").toLowerCase().includes(qq) || (p.summary ?? "").toLowerCase().includes(qq);
  const lilaCount = (lv: string) => (items ?? []).filter((p) => p.lila === lv && hit(p)).length;
  const inLila = useMemo(
    () => (items ?? []).filter((p) => p.lila === lila && hit(p)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, lila, qq],
  );
  const subCount = (sv: string) => (sv === "" ? inLila.length : inLila.filter((p) => p.sub === sv).length);
  const filtered = useMemo(() => inLila.filter((p) => !subSel || p.sub === subSel), [inLila, subSel]);
  const subItems = SUBS[lila] ?? null;
  const lilaVisible = LILAS.filter(([v]) => lilaCount(v) > 0);

  return (
    <div>
      <style>{`
.lh-bar{position:sticky;top:0;z-index:8;margin:-6px -16px 4px;padding:10px 16px 8px;background:color-mix(in srgb, var(--color-bg) 84%, transparent);backdrop-filter:blur(40px) saturate(180%);-webkit-backdrop-filter:blur(40px) saturate(180%);}
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
.lh-card{display:flex;align-items:flex-start;gap:12px;width:100%;text-align:left;padding:12px 13px;border-radius:16px;border:0.5px solid var(--color-hairline);background:var(--color-bg-2);cursor:pointer;transition:transform .09s ease,background .14s ease;}
.lh-card:active{transform:scale(0.99);background:var(--color-bg-3);}
.lh-ava{height:46px;width:46px;flex-shrink:0;border-radius:50%;object-fit:cover;margin-top:1px;}
.lh-mono{display:grid;place-items:center;height:46px;width:46px;flex-shrink:0;border-radius:50%;background:color-mix(in srgb, ${GOLD} 14%, transparent);color:${GOLD};font-family:var(--font-display);font-weight:700;font-size:18px;margin-top:1px;}
.lh-tx{flex:1;min-width:0;}
.lh-eye{font-family:var(--font-text);font-size:10.5px;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;color:${GOLD};line-height:1.3;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.lh-nm{font-family:var(--font-text);font-size:16px;font-weight:600;letter-spacing:-0.3px;line-height:1.25;color:var(--color-label);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.lh-sub{margin-top:3px;font-family:var(--font-text);font-size:12.5px;line-height:1.35;color:var(--color-label-2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.lh-acts{display:flex;flex-direction:column;gap:4px;align-items:center;flex-shrink:0;}
.lh-act{display:grid;place-items:center;width:32px;height:32px;border-radius:50%;border:none;background:transparent;color:var(--color-label-3);cursor:pointer;transition:background .15s,color .15s,transform .09s;}
.lh-act:active{transform:scale(0.9);background:var(--color-bg-3);}
.lh-act.fav{color:#FF453A;}
      `}</style>

      <div className="lh-bar">
        <div className="lh-search">
          <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M20 20l-3.4-3.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по имени или описанию" />
        </div>

        <div className="lh-grp"><Pills value={lila} onChange={setLila} items={lilaVisible.length ? lilaVisible : LILAS.slice(0, 1)} count={lilaCount} /></div>

        {subItems ? (
          <div className="lh-grp">
            <Pills value={subSel} onChange={setSubSel} items={subItems} count={subCount} sec />
          </div>
        ) : null}
      </div>

      <div className="lh-cap">{filtered.length} {filtered.length % 10 === 1 && filtered.length % 100 !== 11 ? "личность" : (filtered.length % 10 >= 2 && filtered.length % 10 <= 4 && (filtered.length % 100 < 10 || filtered.length % 100 >= 20) ? "личности" : "личностей")}</div>

      {!items ? <div style={{ fontFamily: "var(--font-text)", fontSize: "15px", color: "var(--color-label-2)" }}>Загрузка…</div> : null}
      {items && filtered.length === 0 ? <div style={{ fontFamily: "var(--font-text)", fontSize: "15px", color: "var(--color-label-3)", padding: "40px 0", textAlign: "center" }}>Никого не найдено</div> : null}
      {items && filtered.length > 0 ? (
        <div className="lh-cards" key={lila + subSel + qq}>
          {filtered.map((p) => <Card key={p.slug} p={p} onOpen={onOpenEntity} />)}
        </div>
      ) : null}
    </div>
  );
}
