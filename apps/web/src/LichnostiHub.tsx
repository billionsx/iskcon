import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import { CardActionBtns, favMetaFromCtx, useCardActions } from "./cardActions";
import { cleanCardText } from "./cardText";
import { replaceUrl } from "./nav";
import { ScopeTitle, FilterChips, Disclosure, useDisclosure, type NavItem } from "./ui/nav4";
import { COVER_FALLBACK } from "./ui/CoverFallback";

type Person = {
  slug: string; name: string; hero_image: string | null; n_quotes: number;
  lila: string | null; sub: string | null; grp: string | null; note: string | null; summary: string | null; tattva: string | null;
};

const LILAS: [string, string][] = [
  ["lila-gauranga", "Гауранга Лила"], ["lila-krishna", "Кришна Лила"],
  ["lila-bhagavatam", "Шримад Бхагаватам"], ["lila-gita", "Бхагавад Гита"], ["lila-other", "Другие"],
];
const SUBS: Record<string, [string, string][]> = {
  "lila-gauranga": [["", "Все"], ["wave-1", "I волна"], ["wave-2", "II волна"], ["wave-3", "III волна"], ["wave-4", "IV волна"], ["wave-5", "V волна"], ["wave-iskcon", "Беспрецедентная"], ["wave-sampradaya", "Ачарьи сампрадай"]],
  "lila-krishna": [["", "Все"], ["rasa:shanta", "Шанта"], ["rasa:dasya", "Дасья"], ["rasa:sakhya", "Сакхья"], ["rasa:vatsalya", "Ватсалья"], ["rasa:madhurya", "Мадхурья"]],
  "lila-bhagavatam": [["", "Все"], ["bhag-avatara", "Аватары"], ["bhag-rishi", "Мудрецы"], ["bhag-bhakta", "Цари и преданные"], ["bhag-devata", "Полубоги"], ["bhag-asura", "Демоны"], ["bhag-ramayana", "Рамаяна"], ["bhag-mahabharata", "Махабхарата"]],
};

// Третий уровень: группы внутри субтаба (пока — внутри I волны Гауранга Лилы). Ключ — значение sub.
const SUBSUBS: Record<string, [string, string][]> = {
  "wave-1": [
    ["", "Все"],
    ["w1-pancha", "Панча-таттва"], ["w1-navadvipa", "Навадвипа"], ["w1-nilachala", "Нилачала"],
    ["w1-goswami", "Шесть Госвами"], ["w1-vrindavana", "Вриндаван"], ["w1-shrikhanda", "Шри Кханда"], ["w1-kulinagrama", "Кулина-грама"],
    ["w1-nityananda", "Свита Нитьянанды"], ["w1-korni", "Корни"],
  ],
  "wave-2": [
    ["", "Все"],
    ["w2-acharyas", "Три ачарьи"], ["w2-parivara", "Ученики и спутники"],
  ],
  "wave-sampradaya": [
    ["", "Все"],
    ["ws-madhva", "Брахма-Мадхва"], ["ws-shri", "Шри-сампрадая"], ["ws-kumara", "Кумара-сампрадая"],
    ["ws-rudra", "Рудра-сампрадая"], ["ws-rishi", "Мудрецы"],
  ],
  "wave-iskcon": [
    ["", "Все"],
    ["wi-founders", "Прабхупада и основатели"], ["wi-guru", "Инициирующие гуру"],
    ["wi-lilamrita", "Прабхупада-лиламрита"], ["wi-mission", "Миссия ИСККОН"],
  ],
};

const LILA_SLUG: Record<string, string> = { "lila-gauranga": "gauranga-lila", "lila-krishna": "krishna-lila", "lila-bhagavatam": "shrimad-bhagavatam", "lila-gita": "bhagavad-gita", "lila-other": "drugie" };
const SUB_SLUG: Record<string, string> = { "wave-1": "1-volna", "wave-2": "2-volna", "wave-3": "3-volna", "wave-4": "4-volna", "wave-5": "5-volna", "wave-iskcon": "bespretsedentnaya", "wave-sampradaya": "acharyi-sampradaya", "rasa:shanta": "shanta", "rasa:dasya": "dasya", "rasa:sakhya": "sakhya", "rasa:vatsalya": "vatsalya", "rasa:madhurya": "madhurya", "bhag-ramayana": "ramayana", "bhag-mahabharata": "mahabharata", "bhag-avatara": "avatary", "bhag-devata": "polubogi", "bhag-rishi": "mudretsy", "bhag-bhakta": "tsari-predannye", "bhag-asura": "demony" };
const SLUG_LILA: Record<string, string> = Object.fromEntries(Object.entries(LILA_SLUG).map(([k, v]) => [v, k]));
const SLUG_SUB: Record<string, string> = Object.fromEntries(Object.entries(SUB_SLUG).map(([k, v]) => [v, k]));
const SUBSUB_SLUG: Record<string, string> = { "w1-pancha": "pancha-tattva", "w1-navadvipa": "navadvipa", "w1-nilachala": "nilachala", "w1-vrindavana": "vrindavan", "w1-shrikhanda": "shri-khanda", "w1-kulinagrama": "kulina-grama", "w1-nityananda": "svita-nityanandy", "w1-korni": "korni", "w1-goswami": "shest-gosvami", "w2-acharyas": "tri-acharyi", "w2-parivara": "ucheniki-sputniki", "ws-madhva": "brahma-madhva", "ws-shri": "shri-sampradaya", "ws-kumara": "kumara-sampradaya", "ws-rudra": "rudra-sampradaya", "ws-rishi": "mudretsy", "wi-founders": "prabhupada-osnovateli", "wi-guru": "iniciiruyushchie-guru", "wi-lilamrita": "prabhupada-lilamrita", "wi-mission": "missiya-iskcon" };
const SLUG_SUBSUB: Record<string, string> = Object.fromEntries(Object.entries(SUBSUB_SLUG).map(([k, v]) => [v, k]));

function readUrl(): { lila: string; sub: string; grp: string } {
  const parts = (typeof window !== "undefined" ? window.location.pathname : "/").split("/").filter(Boolean);
  if (parts[0] === "dhana" && parts[1] && SLUG_LILA[parts[1]]) {
    const l = SLUG_LILA[parts[1]];
    const s = parts[2] && SLUG_SUB[parts[2]] ? SLUG_SUB[parts[2]] : (SUBS[l]?.[0]?.[0] ?? "");
    const g = parts[3] && SLUG_SUBSUB[parts[3]] && SUBSUBS[s] ? SLUG_SUBSUB[parts[3]] : "";
    return { lila: l, sub: s, grp: g };
  }
  return { lila: "lila-gauranga", sub: "wave-1", grp: "" };
}

function entityCtx(p: Person) {
  return {
    type: "entity" as const, id: p.slug, title: p.name, subtitle: p.note || undefined,
    url: `https://gaurangers.com/${encodeURIComponent(p.slug)}`,
    context: `Герой · ${p.name} · /entity/${p.slug}`,
  };
}

function personWord(n: number): string {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return "личность";
  if (a >= 2 && a <= 4 && (b < 10 || b >= 20)) return "личности";
  return "личностей";
}


function Row({ p, onOpen }: { p: Person; onOpen: (id: string, type: string | null) => void }) {
  const { openCardMenu } = useCardActions();
  const desc = cleanCardText(p.note || p.summary || (p.n_quotes ? `${p.n_quotes} цитат` : ""));  // ЗКН-Т002
  return (
    <div className="lh-row" role="button" tabIndex={0} onClick={() => onOpen(p.slug, null)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(p.slug, null); } }}>
      {p.hero_image
        ? <span className="lh-ava"><img src={p.hero_image} alt="" loading="lazy" /></span>
        : <span className="lh-ava"><img src={COVER_FALLBACK} alt="" loading="lazy" /></span>}
      <span className="lh-tx">
        <span className="lh-nm">{p.name}</span>
        {desc ? <span className="lh-sub">{desc}</span> : null}
      </span>
      <CardActionBtns favKey={`entity:${p.slug}`} meta={favMetaFromCtx(entityCtx(p))} size={26} onMore={() => openCardMenu(entityCtx(p))} />
      <span aria-hidden className="lh-chev">›</span>
    </div>
  );
}

export default function LichnostiHub({ onOpenEntity }: { onOpenEntity: (id: string, type: string | null) => void }) {
  const [items, setItems] = useState<Person[] | null>(null);
  const [lila, setLila] = useState(() => readUrl().lila);
  const [subSel, setSubSel] = useState(() => readUrl().sub);
  const [grpSel, setGrpSel] = useState(() => readUrl().grp);
  const [q, setQ] = useState("");
  const pickLila = (v: string) => { setLila(v); setSubSel(""); setGrpSel(""); };   // ЗКН-Н009: по умолчанию «Все»
  const pickSub = (v: string) => { setSubSel(v); setGrpSel(""); };
  const rootRef = useRef<HTMLDivElement>(null);
  const didMount = useRef(false);

  // При смене лилы/волны/группы — прокрутка к началу списка (как в верхних меню книг/глав).
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    const run = () => {
      const el = rootRef.current;
      if (!el) return;
      let sc: HTMLElement | null = el.parentElement;
      while (sc) {
        const oy = getComputedStyle(sc).overflowY;
        if ((oy === "auto" || oy === "scroll" || oy === "overlay") && sc.scrollHeight > sc.clientHeight) break;
        sc = sc.parentElement;
      }
      if (sc) {
        const top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
        sc.scrollTo({ top: Math.max(0, top), behavior: "auto" });
      } else {
        window.scrollTo({ top: 0, behavior: "auto" });
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(run));
  }, [lila, subSel, grpSel]);

  useEffect(() => {
    let live = true;
    fetch(api("/content/pkl")).then((r) => r.json())
      .then((d) => { if (live) setItems(d.items ?? []); })
      .catch(() => { if (live) setItems([]); });
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const lslug = LILA_SLUG[lila];
    if (!lslug) return;
    const sslug = subSel ? SUB_SLUG[subSel] : "";
    const gslug = grpSel && SUBSUBS[subSel] ? SUBSUB_SLUG[grpSel] : "";
    const path = "/dhana/" + lslug + (sslug ? "/" + sslug : "") + (sslug && gslug ? "/" + gslug : "");
    if (window.location.pathname !== path) {
      replaceUrl(path);   // ЗКН-Н001: историю пишет только nav.ts
    }
  }, [lila, subSel, grpSel]);

  // ЗКН-Н006: данные уровней в формате NavItem (label + счётчик верхним индексом)
  const grpWord = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? "группа" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "группы" : "групп");

  const qq = q.trim().toLowerCase();
  const hit = (p: Person) => !qq || p.name.toLowerCase().includes(qq) || (p.note ?? "").toLowerCase().includes(qq) || (p.summary ?? "").toLowerCase().includes(qq);
  const lilaCount = (lv: string) => (items ?? []).filter((p) => p.lila === lv && hit(p)).length;
  const inLila = useMemo(
    () => (items ?? []).filter((p) => p.lila === lila && hit(p)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, lila, qq],
  );
  const subCount = (sv: string) => (sv === "" ? inLila.length : inLila.filter((p) => p.sub === sv).length);
  const results = useMemo(() => inLila.filter((p) => !subSel || p.sub === subSel), [inLila, subSel]);
  const subItems = SUBS[lila] ?? null;
  const subsubItems = SUBSUBS[subSel] ?? null;
  const grpCount = (gv: string) => (gv === "" ? results.length : results.filter((p) => p.grp === gv).length);
  // Список «Все» — структурированный: на уровне лилы группируем по волнам (sub), на уровне волны — по подгруппам (grp).
  let grouped = false;
  let sections: { gv: string; label: string; rows: Person[] }[] = [];
  if (!subSel && subItems) {
    grouped = true;
    const known = new Set<string>();
    sections = subItems.filter(([sv]) => sv).map(([sv, label]) => { known.add(sv); return { gv: sv, label, rows: inLila.filter((p) => p.sub === sv) }; }).filter((s) => s.rows.length > 0);
    const rest = inLila.filter((p) => !p.sub || !known.has(p.sub));
    if (rest.length) sections.push({ gv: "__rest", label: "Прочие", rows: rest });
  } else if (subsubItems && !grpSel) {
    grouped = true;
    const known = new Set<string>();
    sections = subsubItems.filter(([gv]) => gv).map(([gv, label]) => { known.add(gv); return { gv, label, rows: results.filter((p) => p.grp === gv) }; }).filter((s) => s.rows.length > 0);
    const rest = results.filter((p) => !p.grp || !known.has(p.grp));
    if (rest.length) sections.push({ gv: "__rest", label: "Прочие", rows: rest });
  }
  const flat = subsubItems && grpSel ? results.filter((p) => p.grp === grpSel) : results;
  const shown = grouped ? sections.reduce((a, s) => a + s.rows.length, 0) : (subsubItems && grpSel ? flat.length : results.length);
  const lilaVisible = LILAS.filter(([v]) => lilaCount(v) > 0);

  /* ЗКН-Н006 — данные четырёх уровней.
     Tier-2 (лила) и Tier-3 (волна) — в NavItem; Tier-4 (группы) — секции списка. */
  const lilaNav: NavItem[] = (lilaVisible.length ? lilaVisible : LILAS).map(([v, label]) => ({ id: v, label, count: lilaCount(v) }));
  const subNav: NavItem[] = (subItems ?? []).map(([v, label]) => ({ id: v, label, count: subCount(v) }));
  const dis = useDisclosure(sections.map((s) => s.gv));

  return (
    <div ref={rootRef}>
      <style>{`

.lh-search>svg{position:absolute;left:13px;top:50%;transform:translateY(-50%);color:var(--color-label-3);pointer-events:none;}
.lh-search>input{width:100%;box-sizing:border-box;padding:10px 38px 10px 36px;border-radius:12px;border:none;background:var(--color-bg-2);color:var(--color-label);font-family:var(--font-text);font-size:15px;letter-spacing:-0.2px;outline:none;}
.lh-search>input::placeholder{color:var(--color-label-3);}
.lh-clr{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:22px;height:22px;border:none;border-radius:50%;background:var(--color-bg-3);color:var(--color-label-2);cursor:pointer;display:grid;place-items:center;font-size:14px;line-height:1;}
/* ЗКН-Н006: вес уровней убывает. Tier-2 — чёрные капсулы, Tier-3 — серые,
   Tier-4 — самые лёгкие (мельче кегль, тише цвет), иначе уровни сливаются. */
.lh-search{position:relative;margin:16px 0 0;}
.lh-pills::-webkit-scrollbar{display:none;}
.lh-cap{margin:14px 4px 6px;font-family:var(--font-text);font-size:12px;font-weight:700;letter-spacing:0.04em;color:var(--color-label-3);text-transform:uppercase;}
.lh-list{animation:lhfade .24s cubic-bezier(.32,.72,0,1);}
@keyframes lhfade{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;}}
.lh-row{display:flex;align-items:center;gap:13px;width:100%;box-sizing:border-box;padding:11px 4px;border-bottom:0.5px solid var(--color-hairline);cursor:pointer;text-align:left;-webkit-tap-highlight-color:transparent;transition:opacity .15s ease;}
.lh-row:active{opacity:.55;}
.lh-ava{flex-shrink:0;width:44px;height:44px;border-radius:50%;overflow:hidden;background:var(--color-fill-1);}
.lh-ava>img{width:100%;height:100%;object-fit:cover;display:block;}
.lh-mono{display:grid;place-items:center;flex-shrink:0;width:44px;height:44px;border-radius:50%;background:var(--color-fill-1);color:var(--color-label-2);font-family:var(--font-scripture);font-style:italic;font-weight:500;font-size:18px;}
.lh-tx{min-width:0;flex:1;}
.lh-nm{display:block;font-family:var(--font-text);font-size:15.5px;font-weight:600;letter-spacing:-0.2px;line-height:1.25;color:var(--color-label);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.lh-sub{display:block;margin-top:1px;font-family:var(--font-text);font-size:12.5px;line-height:1.3;color:var(--color-label-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.lh-chev{flex-shrink:0;color:var(--color-label-3);font-size:18px;margin-left:2px;}
      `}</style>

      {/* ═══ ЗКН-Н006 · ЧЕТЫРЕ УРОВНЯ = ЧЕТЫРЕ МЕХАНИЗМА (утв. 11.07.2026) ═══
          Tier-1 витрины  — ЛИНИЯ    (HallTabs, золотая рейка · выше, в зале)
          Tier-2 лила     — РАЗМЕР   (ScopeTitle, крупный кегль + вес)
          Tier-3 волна    — КОНТУР   (FilterChips, обводка · активная золотом)
          Tier-4 группа   — РАСКРЫТИЕ (Disclosure в списке — структура, не меню)
          Ни один уровень не спутать с соседним. Заливок нет нигде. */}
      <ScopeTitle items={lilaNav} active={lila} onChange={pickLila} ariaLabel="Лила" />
      {subNav.length > 0 && <FilterChips items={subNav} active={subSel} onChange={pickSub} ariaLabel="Волна" />}

      <div className="lh-search">
        <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по имени или описанию" />
        {q ? <button type="button" className="lh-clr" aria-label="Очистить" onClick={() => setQ("")}>✕</button> : null}
      </div>

      <div className="lh-cap">{shown} {personWord(shown)}{sections.length > 1 ? ` · ${sections.length} ${grpWord(sections.length)}` : ""}</div>

      {!items ? <div style={{ fontFamily: "var(--font-text)", fontSize: "15px", color: "var(--color-label-2)" }}>Загрузка…</div> : null}
      {items && shown === 0 ? <div style={{ fontFamily: "var(--font-text)", fontSize: "15px", color: "var(--color-label-3)", padding: "40px 0", textAlign: "center" }}>Никого не найдено</div> : null}
      {items && shown > 0 ? (
        <div className="lh-list" key={lila + subSel + qq}>
          {/* Tier-4 — РАСКРЫТИЕ: группы это структура списка, а не ряд меню (ЗКН-Н006). */}
          {grouped
            ? sections.map((s) => (
              <Disclosure key={s.gv} id={s.gv} title={s.label} count={s.rows.length}
                open={dis.isOpen(s.gv)} onToggle={dis.toggle}>
                {s.rows.map((p) => <Row key={p.slug} p={p} onOpen={onOpenEntity} />)}
              </Disclosure>
            ))
            : flat.map((p) => <Row key={p.slug} p={p} onOpen={onOpenEntity} />)}
        </div>
      ) : null}
    </div>
  );
}
