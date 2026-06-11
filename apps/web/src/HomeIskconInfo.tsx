/**
 * HomeIskconInfo — три раздела Главной:
 *   · Документы ИСККОН — каталог основополагающих и действующих документов
 *     общества с поиском и фильтром по типу; ВКД (витринная карточка документа).
 *   · Структура ИСККОН — управление обществом от Ачарьи-основателя до храмов.
 *   · Ссылки ИСККОН — официальные ресурсы общества по группам.
 * Все ссылки — на официальные источники (gbc.iskcon.org, iskcon.org, vedabase…).
 */
import { useMemo, useState } from "react";
import { SectionSubTabs } from "./SectionSubTabs";

const GOLD = "#D2AA1B";
const fill: React.CSSProperties = { background: "var(--color-glass-thin)", borderRadius: 20 };

/* ═══════════════ ДОКУМЕНТЫ ═══════════════ */

type DocType = "founding" | "gbc" | "law" | "history";
const DOC_TYPE_LABEL: Record<DocType, string> = {
  founding: "Основополагающие", gbc: "GBC", law: "Право и устройство", history: "Исторические",
};

interface IskconDoc {
  id: string; type: DocType; year: string; title: string; issuer: string;
  summary: string; url: string;
}

const DOCS: IskconDoc[] = [
  // — Основополагающие —
  { id: "purposes-1966", type: "founding", year: "1966", title: "Семь целей ИСККОН", issuer: "Шрила Прабхупада",
    summary: "Семь основных целей общества, лично сформулированных Шрилой Прабхупадой и внесённых в учредительный документ при регистрации ИСККОН в Нью-Йорке 13 июля 1966 года.",
    url: "https://www.iskcon.org/mission/" },
  { id: "incorporation-1966", type: "founding", year: "1966", title: "Свидетельство о регистрации (Certificate of Incorporation)", issuer: "Штат Нью-Йорк, США",
    summary: "Учредительный документ Международного общества сознания Кришны, подписанный Шрилой Прабхупадой и первыми попечителями 13 июля 1966 года в Нью-Йорке.",
    url: "https://prabhupadabooks.com/letters" },
  { id: "dom-1970", type: "founding", year: "1970", title: "Direction of Management (DOM)", issuer: "Шрила Прабхупада",
    summary: "«Направление управления» — документ от 28 июля 1970 года, которым Шрила Прабхупада учредил Руководящий совет (GBC) и определил принципы коллегиального управления обществом после его ухода.",
    url: "https://gbc.iskcon.org/" },
  { id: "will-1977", type: "founding", year: "1977", title: "Завещание Шрилы Прабхупады (Declaration of Will)", issuer: "Шрила Прабхупада",
    summary: "Последняя воля Ачарьи-основателя от 4 июня 1977 года: GBC — высший управляющий орган ИСККОН; система управления, существовавшая при нём, не подлежит изменению.",
    url: "https://gbc.iskcon.org/" },
  { id: "constitution", type: "founding", year: "проект", title: "Конституция ИСККОН (ISKCON Constitution)", issuer: "GBC",
    summary: "Кодификация устройства общества: миссия, духовные основы, права и обязанности членов, система управления. Разрабатывается комитетом GBC как единый основной закон ИСККОН.",
    url: "https://gbc.iskcon.org/constitution/" },
  // — GBC —
  { id: "gbc-resolutions", type: "gbc", year: "1975 — н.в.", title: "Резолюции GBC (GBC Resolutions)", issuer: "Governing Body Commission",
    summary: "Ежегодные постановления Руководящего совета ИСККОН начиная с 1975 года: законы общества, стандарты поклонения, назначения, зоны ответственности. Полный официальный архив по годам.",
    url: "https://gbc.iskcon.org/gbc-resolutions/" },
  { id: "iskcon-law-book", type: "gbc", year: "ред. 2010+", title: "Свод законов ИСККОН (ISKCON Law Book)", issuer: "Governing Body Commission",
    summary: "Систематизированный свод действующих законов общества, консолидирующий резолюции GBC: духовные стандарты, управление храмами, инициации, разрешение споров.",
    url: "https://gbc.iskcon.org/iskcon-law-book/" },
  { id: "sppm", type: "gbc", year: "2013", title: "Положение Шрилы Прабхупады в ИСККОН (SPPM)", issuer: "GBC / ISKCON",
    summary: "«Srila Prabhupada: The Founder-Acarya of ISKCON» — основополагающий документ Равиндры Сварупы даса, утверждённый GBC: что значит положение Ачарьи-основателя для всех поколений общества.",
    url: "https://founderacharya.com/" },
  // — Право и устройство —
  { id: "child-protection", type: "law", year: "1998 — н.в.", title: "Политика защиты детей (ISKCON Child Protection)", issuer: "ISKCON CPO",
    summary: "Обязательные для всех центров стандарты защиты детей и работы Центрального офиса защиты детей (CPO): профилактика, расследования, обучение.",
    url: "https://iskconchildprotection.com/" },
  { id: "deity-worship", type: "law", year: "ред. разные", title: "Стандарты поклонения Божествам (Pancaratra-pradipa)", issuer: "ISKCON Ministry of Deity Worship",
    summary: "Официальное руководство министерства поклонения Божествам: ежедневная сева, фестивали, стандарты алтаря — единые для храмов ИСККОН по всему миру.",
    url: "https://deityworship.com/" },
  { id: "disciple-course", type: "law", year: "2015", title: "Стандарты инициации и курс ученика", issuer: "GBC Guru Services",
    summary: "Требования к получению первой и второй инициации в ИСККОН: курс ученика, рекомендации, испытательный срок, отношения гуру и ученика в обществе.",
    url: "https://gbc.iskcon.org/" },
  // — Исторические —
  { id: "btg-1944", type: "history", year: "1944", title: "Back to Godhead — первый выпуск", issuer: "Абхай Чаран Де (Шрила Прабхупада)",
    summary: "Журнал «Обратно к Богу», основанный Шрилой Прабхупадой в Калькутте в 1944 году — за 22 года до регистрации ИСККОН. Издаётся его учениками по сей день.",
    url: "https://btg.krishna.com/" },
  { id: "nyt-1966", type: "history", year: "1966", title: "«Свами поёт в парке в поисках экстаза» — The New York Times", issuer: "The New York Times",
    summary: "Первая публикация о Движении Харе Кришна в большой прессе (октябрь 1966): репортаж о киртане Шрилы Прабхупады в парке Томпкинс-сквер.",
    url: "https://www.nytimes.com/1966/10/10/archives/swamis-flock-chants-in-park-to-find-ecstasy.html" },
  { id: "sp-letters", type: "history", year: "1947–1977", title: "Письма Шрилы Прабхупады", issuer: "Bhaktivedanta Archives",
    summary: "Более 6 000 писем Ачарьи-основателя — первоисточник по истории становления ИСККОН, наставления ученикам и руководителям центров.",
    url: "https://prabhupadabooks.com/letters" },
  { id: "bbt-trust", type: "history", year: "1972", title: "Учреждение Bhaktivedanta Book Trust", issuer: "Шрила Прабхупада",
    summary: "Создание издательства BBT — «вечного» траста для публикации книг Шрилы Прабхупады; крупнейший в мире издатель ведической литературы.",
    url: "https://bbt.org/" },
];

function DocCard({ d }: { d: IskconDoc }) {
  return (
    <article style={{ padding: 18, ...fill }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-text)", fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>
        <span style={{ color: GOLD }}>{DOC_TYPE_LABEL[d.type]}</span>
        <span aria-hidden style={{ color: "var(--color-label-3)" }}>·</span>
        <span style={{ color: "var(--color-label-3)" }}>{d.year}</span>
      </div>
      <h3 style={{ margin: "6px 0 0", fontFamily: "var(--font-display)", fontSize: 17.5, fontWeight: 800, letterSpacing: "-0.018em", lineHeight: 1.22, color: "var(--color-label)" }}>{d.title}</h3>
      <div style={{ marginTop: 3, fontFamily: "var(--font-text)", fontSize: 12.5, color: "var(--color-label-3)" }}>{d.issuer}</div>
      <p style={{ margin: "10px 0 0", fontFamily: "var(--font-text)", fontSize: 13.5, lineHeight: 1.55, letterSpacing: "-0.01em", color: "var(--color-label-2)" }}>{d.summary}</p>
      <a href={d.url} target="_blank" rel="noopener noreferrer"
        style={{ display: "inline-flex", alignItems: "center", gap: 3, marginTop: 12, fontFamily: "var(--font-text)", fontSize: 13.5, fontWeight: 600, color: "var(--color-brand-blue)", textDecoration: "none" }}>
        Открыть документ
        <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden><path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </a>
    </article>
  );
}

export function HomeDocuments({ stickyTop }: { stickyTop: number }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState<"all" | DocType>("all");
  const trimmed = q.trim().toLowerCase();
  const filtered = useMemo(() => {
    let r = DOCS;
    if (type !== "all") r = r.filter((d) => d.type === type);
    if (trimmed) r = r.filter((d) => [d.title, d.issuer, d.summary, d.year].some((f) => f.toLowerCase().includes(trimmed)));
    return r;
  }, [type, trimmed]);

  return (
    <div>
      <div style={{ padding: "20px 0 0" }}>
        <div style={{ fontFamily: "var(--font-text)", fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLD }}>Каталог</div>
        <h2 style={{ margin: "5px 0 0", fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800, letterSpacing: "-0.022em", lineHeight: 1.1, color: "var(--color-label)" }}>Документы ИСККОН</h2>
        <p style={{ margin: "8px 0 0", fontFamily: "var(--font-text)", fontSize: 14, lineHeight: 1.5, color: "var(--color-label-2)" }}>
          Основополагающие, действующие и исторические документы общества — от Семи целей и Direction of Management до резолюций GBC и Свода законов. Все ссылки ведут на официальные источники.
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
      <SectionSubTabs ariaLabel="Тип документа" tone="light" top={stickyTop} bleed={16}
        items={[{ id: "all", label: "Все" }, ...(Object.keys(DOC_TYPE_LABEL) as DocType[]).map((t) => ({ id: t, label: DOC_TYPE_LABEL[t] }))]}
        active={type} onChange={(id) => setType(id as "all" | DocType)} />

      <div style={{ marginTop: 14 }} aria-live="polite">
        <div style={{ margin: "0 2px 10px", fontFamily: "var(--font-text)", fontSize: 12.5, color: "var(--color-label-3)" }}>{filtered.length} документов</div>
        {filtered.length === 0 ? (
          <div style={{ padding: "26px 8px", textAlign: "center", fontFamily: "var(--font-text)", fontSize: 14.5, color: "var(--color-label-3)" }}>Ничего не найдено.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>{filtered.map((d) => <DocCard key={d.id} d={d} />)}</div>
        )}
      </div>
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
    { t: "ISKCON.org", d: "Главный сайт Международного общества сознания Кришны", url: "https://www.iskcon.org/" },
    { t: "Каталог центров", d: "Официальный мировой справочник центров — centres.iskcon.org", url: "https://centres.iskcon.org/" },
    { t: "GBC", d: "Руководящий совет ИСККОН: резолюции, законы, министерства", url: "https://gbc.iskcon.org/" },
    { t: "ISKCON News", d: "Официальное новостное издание общества", url: "https://iskconnews.org/" },
  ]},
  { group: "Книги и учение", items: [
    { t: "Vedabase", d: "Все книги Шрилы Прабхупады онлайн — официальная библиотека BBT", url: "https://vedabase.io/" },
    { t: "Bhaktivedanta Book Trust", d: "Издательство книг Шрилы Прабхупады — крупнейший издатель ведической литературы", url: "https://bbt.org/" },
    { t: "Back to Godhead", d: "Журнал «Обратно к Богу», основанный Шрилой Прабхупадой в 1944 году", url: "https://btg.krishna.com/" },
    { t: "Prabhupada Books", d: "Письма, лекции и беседы Шрилы Прабхупады — Bhaktivedanta Archives", url: "https://prabhupadabooks.com/" },
  ]},
  { group: "Святые места", items: [
    { t: "ISKCON Маяпур", d: "Всемирная штаб-квартира общества — Шридхама Маяпур", url: "https://www.mayapur.com/" },
    { t: "Храм ведического планетария", d: "TOVP — крупнейший храм движения, строящийся в Маяпуре", url: "https://tovp.org/" },
    { t: "ISKCON Вриндаван", d: "Шри Кришна-Баларама-Мандир — храм Шрилы Прабхупады во Вриндаване", url: "https://iskconvrindavan.com/" },
  ]},
  { group: "Служение миру", items: [
    { t: "Food for Life", d: "Крупнейшая в мире вегетарианская продовольственная миссия, основанная по наставлению Шрилы Прабхупады", url: "https://ffl.org/" },
    { t: "Bhaktivedanta Hospital", d: "Госпиталь Бхактиведанты в Мумбаи — медицина с духовной заботой", url: "https://bhaktivedantahospital.com/" },
    { t: "ISKCON Child Protection", d: "Центральный офис защиты детей ИСККОН", url: "https://iskconchildprotection.com/" },
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
