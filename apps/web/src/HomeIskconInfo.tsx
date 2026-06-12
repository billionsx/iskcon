/**
 * HomeIskconInfo — три раздела Главной:
 *   · Документы ИСККОН — каталог основополагающих и действующих документов
 *     общества с поиском и фильтром по типу; ВКД (витринная карточка документа).
 *   · Структура ИСККОН — управление обществом от Ачарьи-основателя до храмов.
 *   · Ссылки ИСККОН — официальные ресурсы общества по группам.
 * Все ссылки — на официальные источники (gbc.iskcon.org, iskcon.org, vedabase…).
 */
import { CardActionBtns, useCardActions } from "./cardActions";
import { useEffect, useMemo, useState } from "react";
import { SectionSubTabs } from "./SectionSubTabs";
import { HomeSheet } from "./HomeSheet";

const GOLD = "#D2AA1B";
const fill: React.CSSProperties = { background: "var(--color-glass-thin)", borderRadius: 20 };

/* ═══════════════ ДОКУМЕНТЫ ═══════════════ */

type DocType = "founding" | "gbc" | "law" | "history";
const DOC_TYPE_LABEL: Record<DocType, string> = {
  founding: "Основополагающие", gbc: "GBC", law: "Право и устройство", history: "Исторические",
};

interface IskconDoc {
  id: string; type: DocType; year: string; title: string; issuer: string;
  summary: string; body: string[]; facts: { k: string; v: string }[]; url: string;
}

/* ── строка таблицы фактов в ПКД ── */
function FactRow({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "11px 0",
      borderBottom: last ? "none" : "1px solid var(--color-separator)" }}>
      <span style={{ fontFamily: "var(--font-text)", fontSize: 13.5, color: "var(--color-label-3)", flexShrink: 0 }}>{k}</span>
      <span style={{ fontFamily: "var(--font-text)", fontSize: 13.5, fontWeight: 600, color: "var(--color-label)", textAlign: "right" }}>{v}</span>
    </div>
  );
}

/* ── ПКД — полная карточка документа (читается в приложении) ── */

/* ── контекст действий документа ── */
function docCtx(d: IskconDoc) {
  return {
    type: "doc" as const, id: d.id, title: d.title,
    subtitle: `${DOC_TYPE_LABEL[d.type]} · ${d.year}`,
    url: `https://gaurangers.com/doc/${encodeURIComponent(d.id)}`,
    context: `Документ · ${d.title} (${d.year}) · /doc/${d.id}`,
  };
}

function DocSheet({ d, onClose, flash }: { d: IskconDoc | null; onClose: () => void; flash?: (m: string) => void }) {
  const { openCardMenu } = useCardActions();
  return (
    <HomeSheet open={!!d} label={d ? d.title : "Документ"} onClose={onClose}>
      {d && (
        <div style={{ padding: "0 20px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-text)", fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>
            <span style={{ color: GOLD }}>{DOC_TYPE_LABEL[d.type]}</span>
            <span aria-hidden style={{ color: "var(--color-label-3)" }}>·</span>
            <span style={{ color: "var(--color-label-3)" }}>{d.year}</span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <h3 style={{ margin: "7px 0 0", flex: 1, minWidth: 0, fontFamily: "var(--font-display)", fontSize: 23, fontWeight: 700, letterSpacing: "-0.022em", lineHeight: 1.16, color: "var(--color-label)" }}>{d.title}</h3>
            <CardActionBtns favKey={`doc:${d.id}`} flash={flash} onMore={() => openCardMenu(docCtx(d))} />
          </div>
          <div style={{ marginTop: 5, fontFamily: "var(--font-text)", fontSize: 13, color: "var(--color-label-3)" }}>{d.issuer}</div>

          <div style={{ marginTop: 16 }}>
            {d.body.map((p, i) => (
              <p key={i} style={{ margin: i ? "12px 0 0" : 0, fontFamily: "var(--font-text)", fontSize: 15, lineHeight: 1.62, letterSpacing: "-0.01em", color: "var(--color-label)" }}>{p}</p>
            ))}
          </div>

          {d.facts.length > 0 && (
            <div style={{ marginTop: 18, padding: "4px 16px", ...fill, borderRadius: 16 }}>
              {d.facts.map((f, i) => <FactRow key={f.k} k={f.k} v={f.v} last={i === d.facts.length - 1} />)}
            </div>
          )}

          <a href={d.url} target="_blank" rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 16, padding: "13px 16px", borderRadius: 14,
              background: "var(--color-glass-thin)", fontFamily: "var(--font-text)", fontSize: 14.5, fontWeight: 700, color: "var(--color-brand-blue)", textDecoration: "none", WebkitTapHighlightColor: "transparent" }}>
            Официальный источник
            <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden><path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </a>
        </div>
      )}
    </HomeSheet>
  );
}

function DocCard({ d, onOpen, flash }: { d: IskconDoc; onOpen: () => void; flash?: (m: string) => void }) {
  const { openCardMenu } = useCardActions();
  return (
    <article role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      style={{ padding: 18, ...fill, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-text)", fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>
        <span style={{ color: GOLD }}>{DOC_TYPE_LABEL[d.type]}</span>
        <span aria-hidden style={{ color: "var(--color-label-3)" }}>·</span>
        <span style={{ color: "var(--color-label-3)" }}>{d.year}</span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <h3 style={{ flex: 1, margin: "6px 0 0", fontFamily: "var(--font-display)", fontSize: 17.5, fontWeight: 600, letterSpacing: "-0.018em", lineHeight: 1.22, color: "var(--color-label)" }}>{d.title}</h3>
        <CardActionBtns favKey={`doc:${d.id}`} flash={flash} size={32} onMore={() => openCardMenu(docCtx(d))} />
      </div>
      <div style={{ marginTop: 3, fontFamily: "var(--font-text)", fontSize: 12.5, color: "var(--color-label-3)" }}>{d.issuer}</div>
      <p style={{ margin: "10px 0 0", fontFamily: "var(--font-text)", fontSize: 13.5, lineHeight: 1.55, letterSpacing: "-0.01em", color: "var(--color-label-2)" }}>{d.summary}</p>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 3, marginTop: 12, fontFamily: "var(--font-text)", fontSize: 13.5, fontWeight: 600, color: "var(--color-brand-blue)" }}>
        Читать документ
      </span>
    </article>
  );
}

export function HomeDocuments({ stickyTop, flash }: { stickyTop: number; flash?: (m: string) => void }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState<"all" | DocType>("all");
  const [docs, setDocs] = useState<IskconDoc[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<IskconDoc | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/documents")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { documents: IskconDoc[] }) => { if (alive) setDocs(j.documents || []); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);
  // Deep-link /doc/<id>
  useEffect(() => {
    if (!docs) return;
    let did = ""; try { did = sessionStorage.getItem("open-doc") || ""; if (did) sessionStorage.removeItem("open-doc"); } catch { /* noop */ }
    if (!did) return;
    const d = docs.find((x) => x.id === did); if (d) setOpen(d);
  }, [docs]);

  const trimmed = q.trim().toLowerCase();
  const filtered = useMemo(() => {
    let r = docs || [];
    if (type !== "all") r = r.filter((d) => d.type === type);
    if (trimmed) r = r.filter((d) => [d.title, d.issuer, d.summary, d.year, ...(d.body || [])].some((f) => f.toLowerCase().includes(trimmed)));
    return r;
  }, [docs, type, trimmed]);

  return (
    <div>
      <div style={{ padding: "20px 0 0" }}>
        <div style={{ fontFamily: "var(--font-text)", fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLD }}>Каталог</div>
        <h2 style={{ margin: "5px 0 0", fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800, letterSpacing: "-0.022em", lineHeight: 1.1, color: "var(--color-label)" }}>Документы ИСККОН</h2>
        <p style={{ margin: "8px 0 0", fontFamily: "var(--font-text)", fontSize: 14, lineHeight: 1.5, color: "var(--color-label-2)" }}>
          Основополагающие, действующие и исторические документы общества — от Семи целей и Direction of Management до резолюций GBC и Свода законов. Каждый документ читается прямо в приложении.
        </p>
      </div>

      <div role="search" style={{ position: "relative", marginTop: 14 }}>
        <span aria-hidden style={{ position: "absolute", left: 13, top: 0, bottom: 0, display: "grid", placeItems: "center", color: "var(--color-label-3)", pointerEvents: "none" }}>
          <svg width="17" height="17" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="m20 20-3.4-3.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Название, год или орган"
          inputMode="search" autoComplete="off" autoCorrect="off" spellCheck={false} aria-label="Поиск документа"
          style={{ width: "100%", boxSizing: "border-box", padding: "12px 38px", borderRadius: 14, border: "none",
            background: "var(--color-glass-thin)", fontFamily: "var(--font-text)", fontSize: 16, color: "var(--color-label)", outline: "none", WebkitAppearance: "none" }} />
        {q && (
          <button type="button" aria-label="Очистить" onClick={() => setQ("")}
            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", width: 26, height: 26, borderRadius: "50%", border: "none",
              background: "var(--color-glass-regular)", color: "var(--color-label-2)", cursor: "pointer", display: "grid", placeItems: "center", WebkitTapHighlightColor: "transparent" }}>
            <svg width="12" height="12" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
          </button>
        )}
      </div>

      <div style={{ height: 10 }} />
      <SectionSubTabs variant="chips" ariaLabel="Тип документа" tone="light" top={stickyTop} bleed={16}
        items={[{ id: "all", label: "Все" }, ...(Object.keys(DOC_TYPE_LABEL) as DocType[]).map((t) => ({ id: t, label: DOC_TYPE_LABEL[t] }))]}
        active={type} onChange={(id) => setType(id as "all" | DocType)} />

      <div style={{ marginTop: 14 }} aria-live="polite">
        {docs === null && !failed ? (
          <div style={{ padding: "26px 8px", textAlign: "center", fontFamily: "var(--font-text)", fontSize: 14.5, color: "var(--color-label-3)" }}>Загрузка…</div>
        ) : failed ? (
          <div style={{ padding: "26px 8px", textAlign: "center", fontFamily: "var(--font-text)", fontSize: 14.5, color: "var(--color-label-3)" }}>Не удалось загрузить документы. Проверьте связь и обновите страницу.</div>
        ) : (
          <>
            <div style={{ margin: "0 2px 10px", fontFamily: "var(--font-text)", fontSize: 12.5, color: "var(--color-label-3)" }}>{filtered.length} документов</div>
            {filtered.length === 0 ? (
              <div style={{ padding: "26px 8px", textAlign: "center", fontFamily: "var(--font-text)", fontSize: 14.5, color: "var(--color-label-3)" }}>Ничего не найдено.</div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>{filtered.map((d) => <DocCard key={d.id} d={d} flash={flash} onOpen={() => setOpen(d)} />)}</div>
            )}
          </>
        )}
      </div>

      <DocSheet d={open} flash={flash} onClose={() => setOpen(null)} />
    </div>
  );
}

/* ═══════════════ СТРУКТУРА ═══════════════ */

const STRUCTURE = [
  { t: "Ачарья-основатель", d: "Его Божественная Милость А. Ч. Бхактиведанта Свами Прабхупада — вечный духовный глава ИСККОН. Его книги, наставления и стандарты — высший авторитет общества для всех поколений (документ SPPM, 2013)." },
  { t: "Руководящий совет (GBC)", d: "Governing Body Commission — высший управляющий орган ИСККОН, учреждённый Шрилой Прабхупадой в 1970 году (Direction of Management) и утверждённый его завещанием. Около 30+ членов; ежегодные собрания в Маяпуре; решения публикуются как резолюции GBC." },
  { t: "Исполнительный комитет и министерства", d: "Исполнительный комитет GBC (председатель ротируется ежегодно) и профильные министерства: поклонение Божествам, образование, книгораспространение, защита детей, юстиция, связи с обществом, защита коров и сельские общины." },
  { t: "Зональные секретари и региональные советы", d: "Мир разделён на зоны; каждый член GBC отвечает за свои зоны. Национальные и региональные советы координируют центры на местах." },
  { t: "Храмы и центры", d: "Около 800+ храмов, центров, школ, ферм и ресторанов. Каждым храмом руководит президент храма; духовную жизнь общины поддерживают советы и старшие преданные." },
  { t: "Духовные учителя и преданные", d: "Инициирующие гуру действуют в рамках законов ИСККОН под надзором GBC. Сердце общества — миллионы практикующих преданных по всему миру." },
];

export function HomeStructure() {
  return (
    <div>
      <div style={{ padding: "20px 0 0" }}>
        <div style={{ fontFamily: "var(--font-text)", fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLD }}>Устройство общества</div>
        <h2 style={{ margin: "5px 0 0", fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800, letterSpacing: "-0.022em", lineHeight: 1.1, color: "var(--color-label)" }}>Структура ИСККОН</h2>
        <p style={{ margin: "8px 0 0", fontFamily: "var(--font-text)", fontSize: 14, lineHeight: 1.5, color: "var(--color-label-2)" }}>
          Шрила Прабхупада сознательно не назначил единого преемника: управление обществом он передал коллегиальному органу — GBC, сохранив за собой положение Ачарьи-основателя навсегда.
        </p>
      </div>
      <div style={{ position: "relative", marginTop: 24, paddingLeft: 26 }}>
        <span aria-hidden style={{ position: "absolute", left: 5, top: 8, bottom: 8, width: 2, background: `linear-gradient(to bottom, ${GOLD}, color-mix(in srgb, ${GOLD} 25%, transparent))` }} />
        {STRUCTURE.map((s, i) => (
          <div key={s.t} style={{ position: "relative", paddingBottom: i === STRUCTURE.length - 1 ? 0 : 24 }}>
            <span aria-hidden style={{ position: "absolute", left: -26, top: 4, width: 12, height: 12, borderRadius: "50%", background: i === 0 ? GOLD : "var(--color-bg)", border: `2px solid ${GOLD}`, boxShadow: "0 0 0 4px var(--color-bg)" }} />
            <div style={{ fontFamily: "var(--font-display)", fontSize: 16.5, fontWeight: 700, letterSpacing: "-0.018em", color: "var(--color-label)", lineHeight: 1.25 }}>{s.t}</div>
            <p style={{ margin: "5px 0 0", fontFamily: "var(--font-text)", fontSize: 13.5, lineHeight: 1.55, letterSpacing: "-0.01em", color: "var(--color-label-2)" }}>{s.d}</p>
          </div>
        ))}
      </div>
      <a href="https://gbc.iskcon.org/" target="_blank" rel="noopener noreferrer"
        style={{ display: "inline-flex", alignItems: "center", gap: 3, marginTop: 22, fontFamily: "var(--font-text)", fontSize: 14, fontWeight: 600, color: "var(--color-brand-blue)", textDecoration: "none" }}>
        Официальный сайт GBC — gbc.iskcon.org
        <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden><path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </a>
    </div>
  );
}

/* ═══════════════ ССЫЛКИ ═══════════════ */

const LINKS: { group: string; items: { t: string; d: string; url: string }[] }[] = [
  { group: "Официальные ресурсы", items: [
    { t: "ИСККОН (iskcon.org)", d: "Главный сайт Международного общества сознания Кришны", url: "https://www.iskcon.org/" },
    { t: "Каталог центров", d: "Официальный мировой справочник центров — centres.iskcon.org", url: "https://centres.iskcon.org/" },
    { t: "Руководящий совет (GBC)", d: "Руководящий совет ИСККОН: резолюции, законы, министерства", url: "https://gbc.iskcon.org/" },
    { t: "Новости ИСККОН (ISKCON News)", d: "Официальное новостное издание общества", url: "https://iskconnews.org/" },
  ]},
  { group: "Книги и учение", items: [
    { t: "Ведабейс (Vedabase)", d: "Все книги Шрилы Прабхупады онлайн — официальная библиотека BBT", url: "https://vedabase.io/" },
    { t: "«Бхактиведанта Бук Траст» (BBT)", d: "Издательство книг Шрилы Прабхупады — крупнейший издатель ведической литературы", url: "https://bbt.org/" },
    { t: "«Обратно к Богу» (Back to Godhead)", d: "Журнал «Обратно к Богу», основанный Шрилой Прабхупадой в 1944 году", url: "https://btg.krishna.com/" },
    { t: "Книги Прабхупады (prabhupadabooks.com)", d: "Письма, лекции и беседы Шрилы Прабхупады — Bhaktivedanta Archives", url: "https://prabhupadabooks.com/" },
  ]},
  { group: "Святые места", items: [
    { t: "ИСККОН Маяпур", d: "Всемирная штаб-квартира общества — Шридхама Маяпур", url: "https://www.mayapur.com/" },
    { t: "Храм ведического планетария", d: "TOVP — крупнейший храм движения, строящийся в Маяпуре", url: "https://tovp.org/" },
    { t: "ИСККОН Вриндаван", d: "Шри Кришна-Баларама-Мандир — храм Шрилы Прабхупады во Вриндаване", url: "https://iskconvrindavan.com/" },
  ]},
  { group: "Служение миру", items: [
    { t: "«Пища жизни» (Food for Life)", d: "Крупнейшая в мире вегетарианская продовольственная миссия, основанная по наставлению Шрилы Прабхупады", url: "https://ffl.org/" },
    { t: "Госпиталь Бхактиведанты", d: "Госпиталь Бхактиведанты в Мумбаи — медицина с духовной заботой", url: "https://bhaktivedantahospital.com/" },
    { t: "Защита детей ИСККОН (CPO)", d: "Центральный офис защиты детей ИСККОН", url: "https://iskconchildprotection.com/" },
  ]},
];

export function HomeLinks() {
  return (
    <div>
      <div style={{ padding: "20px 0 0" }}>
        <div style={{ fontFamily: "var(--font-text)", fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLD }}>Навигатор</div>
        <h2 style={{ margin: "5px 0 0", fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800, letterSpacing: "-0.022em", lineHeight: 1.1, color: "var(--color-label)" }}>Ссылки ИСККОН</h2>
        <p style={{ margin: "8px 0 0", fontFamily: "var(--font-text)", fontSize: 14, lineHeight: 1.5, color: "var(--color-label-2)" }}>
          Проверенные официальные ресурсы общества — сайты, библиотеки, святые места и миссии служения.
        </p>
      </div>
      {LINKS.map((g) => (
        <section key={g.group} style={{ marginTop: 26 }}>
          <div style={{ margin: "0 2px 10px", fontFamily: "var(--font-text)", fontSize: 11, fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: "var(--color-label-3)" }}>{g.group}</div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", overflow: "hidden", ...fill }}>
            {g.items.map((it, i) => (
              <li key={it.t} style={{ borderTop: i ? "0.5px solid var(--color-hairline)" : "none" }}>
                <a href={it.url} target="_blank" rel="noopener noreferrer"
                  onPointerDown={(e) => (e.currentTarget.style.background = "var(--color-hover)")}
                  onPointerUp={(e) => (e.currentTarget.style.background = "transparent")}
                  onPointerLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", textDecoration: "none", WebkitTapHighlightColor: "transparent" }}>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: 15.5, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--color-label)" }}>{it.t}</span>
                    <span style={{ display: "block", marginTop: 2, fontFamily: "var(--font-text)", fontSize: 12.5, lineHeight: 1.4, color: "var(--color-label-2)" }}>{it.d}</span>
                  </span>
                  <span aria-hidden style={{ flexShrink: 0, color: "var(--color-label-3)" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24"><path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
