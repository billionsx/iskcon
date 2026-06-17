/**
 * EntityPage — страница «героя» (личность или книга-сущность) из канонического
 * реестра. Источник: GET /api/entities/:id → имена (ru/en/iast), категории,
 * профиль (bronze) и связи в обе стороны. Сердце раздела «Ачарья»: навигация
 * по графу — каждая связанная сущность открывается как такая же страница, а
 * книги-читалки (БГ/ЧЧ/ШБ/НП) уходят в ридер через onOpen(id, 'scripture').
 *
 * Визуальный язык — общий с приложением (SF для UI, Georgia для транслитерации,
 * grouped-iOS поверхности, золотая монограмма вместо фото).
 */
import { TATTVA_RU, CATEGORY_RU, RASA_RU } from "./entityLabels";
import { CardActionBtns, useCardActions } from "./cardActions";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "./api";
import { BackIcon } from "./ui/icons";
import { PersonHeroCard } from "./PersonHeroCard";

const GOLD = "#D2AA1B";

// Канонический вывод расы из категорий реестра: гопи/манджари → мадхурья, гопа → сакхья.
const CATEGORY_RASA: Record<string, string> = { gopi: "madhurya", manjari: "madhurya", gopa: "sakhya" };

export interface RelItem {
  relation: string;
  id: string;
  type: string | null;
  name_ru: string | null;
  name_iast: string | null;
}
export interface LinkItem {
  kind: string;
  ref: string;
  title: string | null;
  subtitle: string | null;
}
interface CenterHit {
  id: string;
  type: string;
  name: string;
  slug: string;
  city: string | null;
  country: string | null;
  photos: string[];
}
export interface DarshanItem {
  temple_slug: string;
  temple_name: string;
  deities: string | null;
  image: string | null;
  date: string;
  url: string | null;
}
interface EntityDetail {
  id: string;
  type: string;
  tattva: string | null;
  dataset: string | null;
  note: string | null;
  source_ref: string | null;
  name_ru: string | null;
  name_en: string | null;
  name_iast: string | null;
  image: string | null;
  aliases: string[];
  categories: string[];
  profile: { summary: string | null; biography: string | null; contribution: string | null; level: string | null; longform?: string | null } | null;
  out: RelItem[];
  in: RelItem[];
  links?: LinkItem[];
  darshans?: DarshanItem[];
}

// Русские подписи таттвы/категорий — общий модуль (entityLabels).

// Связь (отношение + направление) → заголовок группы и порядок вывода.
// dir = 'out': текущая сущность это from_id; dir = 'in': текущая это to_id.
function relGroup(relation: string, dir: "out" | "in"): { label: string; order: number } | null {
  const O = dir === "out";
  switch (relation) {
    case "author-of": return O ? { label: "Книги и труды", order: 5 } : { label: "Автор", order: 4 };
    case "avatar-of": return O ? { label: "Источник", order: 12 } : { label: "Воплощения и аватары", order: 11 };
    case "expansion-of": return O ? { label: "Источник", order: 12 } : { label: "Экспансии", order: 11 };
    case "shaktyavesha-of": return O ? { label: "Источник", order: 12 } : { label: "Шактьявеша-воплощения", order: 11 };
    case "disciple-of": return O ? { label: "Духовный учитель", order: 20 } : { label: "Ученики", order: 21 };
    case "godbrother-of": return { label: "Духовные братья", order: 24 };
    case "associate-of": return O ? { label: "Спутник", order: 30 } : { label: "Спутники", order: 30 };
    case "gaura-lila-identity": return O ? { label: "В лиле Кришны", order: 40 } : { label: "В лиле Гауранги", order: 41 };
    case "son-of": return O ? { label: "Родители", order: 50 } : { label: "Дети", order: 52 };
    case "foster-son-of": return O ? { label: "Приёмные родители", order: 51 } : { label: "Приёмные дети", order: 52 };
    case "father-of": return O ? { label: "Дети", order: 52 } : { label: "Родители", order: 50 };
    case "mother-of": return O ? { label: "Дети", order: 52 } : { label: "Родители", order: 50 };
    case "husband-of": return O ? { label: "Супруга", order: 53 } : { label: "Супруг", order: 53 };
    case "wife-of": return O ? { label: "Супруг", order: 53 } : { label: "Супруга", order: 53 };
    case "brother-of": return { label: "Братья и сёстры", order: 54 };
    case "sister-of": return { label: "Братья и сёстры", order: 54 };
    case "nephew-of": return O ? { label: "Дядя и тётя", order: 55 } : { label: "Племянники", order: 55 };
    case "grandson-of": return O ? { label: "Дедушка и бабушка", order: 56 } : { label: "Внуки", order: 56 };
    case "speaker-of": return O ? { label: "Поведал", order: 60 } : { label: "Рассказчик", order: 60 };
    case "narrator-of": return O ? { label: "Поведал", order: 60 } : { label: "Рассказчик", order: 60 };
    case "hearer-of": return O ? { label: "Услышал", order: 61 } : { label: "Слушатель", order: 61 };
    case "appears-in": return O ? { label: "Упоминается в", order: 70 } : { label: "Действующие лица", order: 70 };
    case "abode-of": return O ? { label: "Господь обители", order: 6 } : { label: "Обители и дхамы", order: 7 };
    case "part-of": return O ? { label: "Часть дхамы", order: 8 } : { label: "Святые места", order: 9 };
    case "near": return { label: "Поблизости", order: 10 };
    default: return null;
  }
}

/** Раскрытие аббревиатур цитат в полные названия писаний (для читаемости). */
function expandRefs(s: string): string {
  return s
    .replace(/Ч\.-ч\. /g, "Чайтанья-чаритамрита ")
    .replace(/Б\.-с\. /g, "Брахма-самхита ")
    .replace(/Бр\.-с\. /g, "Брахма-самхита ")
    .replace(/ГГД /g, "Гаура-ганоддеша-дипика ")
    .replace(/ЧБ /g, "Чайтанья-Бхагавата ")
    .replace(/ЧЧ /g, "Чайтанья-чаритамрита ")
    .replace(/ШБ /g, "Шримад-Бхагаватам ")
    .replace(/СБ /g, "Шримад-Бхагаватам ")
    .replace(/БГ /g, "Бхагавад-гита ");
}

function initialOf(d: EntityDetail): string {
  const s = (d.name_iast || d.name_ru || "?").trim();
  return s.charAt(0).toUpperCase();
}

function Monogram({ ch, size = 72 }: { ch: string; size?: number }) {
  return (
    <div style={{ flexShrink: 0, width: size, height: size, borderRadius: "50%", display: "grid", placeItems: "center",
      border: `1.5px solid color-mix(in srgb, ${GOLD} 55%, transparent)`,
      background: `color-mix(in srgb, ${GOLD} 9%, transparent)`,
      color: GOLD, fontFamily: "var(--font-scripture)", fontStyle: "italic", fontWeight: 600, fontSize: size * 0.42, lineHeight: 1 }}>
      {ch}
    </div>
  );
}

function PhotoCircle({ src, size = 72 }: { src: string; size?: number }) {
  return (
    <div style={{ flexShrink: 0, width: size, height: size, borderRadius: "50%", overflow: "hidden", border: "0.5px solid var(--color-hairline)", background: "var(--color-fill-1)" }}>
      <img src={src} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
    </div>
  );
}

function Chip({ label, onClick }: { label: string; onClick?: () => void }) {
  const interactive = !!onClick;
  return (
    <button type="button" onClick={onClick} disabled={!interactive}
      style={{ display: "inline-flex", alignItems: "center", padding: "8px 13px", borderRadius: 999,
        border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)",
        fontFamily: "var(--font-text)", fontSize: 14, fontWeight: 500, color: "var(--color-label)",
        cursor: interactive ? "pointer" : "default", textAlign: "left", lineHeight: 1.2,
        transition: "transform 120ms ease, opacity 120ms ease" }}
      onMouseDown={(e) => interactive && (e.currentTarget.style.opacity = "0.6")}
      onMouseUp={(e) => interactive && (e.currentTarget.style.opacity = "1")}
      onMouseLeave={(e) => interactive && (e.currentTarget.style.opacity = "1")}>
      {label}
    </button>
  );
}

/* Золотой eyebrow — единая грамматика секций (как в HomeMore/LayerLabel). */
function Eyebrow({ children, count }: { children: ReactNode; count?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
      <h3 style={{ margin: 0, fontFamily: "var(--font-text)", fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLD }}>{children}</h3>
      {count != null && count > 1 && <span style={{ fontFamily: "var(--font-text)", fontSize: 12, fontWeight: 700, color: GOLD, opacity: 0.55 }}>{count}</span>}
    </div>
  );
}

/* Заголовок повествовательного раздела профиля: божественные таттвы → «Лила»,
   джива-таттва и без таттвы → «Жизнеописание». */
function bioLabel(d: EntityDetail): string {
  const t = d.tattva || "";
  const divine = t === "vishnu-tattva" || t === "shakti-tattva" || t === "shiva-tattva";
  return divine ? "Лила" : "Жизнеописание";
}

/* Повествовательный раздел: eyebrow + проза. pre-line сохраняет абзацы источника. */
function ProseSection({ label, text }: { label: string; text: string }) {
  return (
    <section style={{ marginTop: 26 }}>
      <Eyebrow>{label}</Eyebrow>
      <p style={{ margin: 0, fontFamily: "var(--font-text)", fontSize: 16, lineHeight: 1.55, color: "var(--color-label)", whiteSpace: "pre-line" }}>{text}</p>
    </section>
  );
}

type LfSee = { id: string; t: string };
type LfCite = { ref: string; to?: string };
type LfSection = { h?: string; p?: string[]; cite?: LfCite[]; quote?: { t: string; by?: string; ref?: string }; see?: LfSee[] };
function LongformArticle({ sections, onOpen, onNavigate }: { sections: LfSection[]; onOpen: (id: string, type: string | null) => void; onNavigate?: (href: string) => void }) {
  const citeBase: React.CSSProperties = { fontFamily: "var(--font-text)", fontSize: 11.5, fontWeight: 700, letterSpacing: "0.2px", color: GOLD, background: "color-mix(in srgb, " + GOLD + " 11%, transparent)", border: "1px solid color-mix(in srgb, " + GOLD + " 28%, transparent)", borderRadius: 7, padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: 5 };
  return (
    <div>
      {sections.map((s, i) => (
        <section key={i} style={{ marginTop: i === 0 ? 26 : 34 }}>
          {s.h && <Eyebrow>{s.h}</Eyebrow>}
          {(s.p ?? []).map((para, j) => (
            <p key={j} style={{ margin: j === 0 ? 0 : "13px 0 0", fontFamily: "var(--font-text)", fontSize: 16, lineHeight: 1.65, color: "var(--color-label)" }}>{para}</p>
          ))}
          {s.quote && (
            <blockquote style={{ margin: "20px 0 0", padding: "10px 0 10px 18px", borderLeft: `3px solid ${GOLD}`, fontFamily: "var(--font-text)", fontSize: 16.5, lineHeight: 1.6, fontStyle: "italic", color: "var(--color-label)" }}>
              <span>“{s.quote.t}”</span>
              {(s.quote.by || s.quote.ref) && (
                <footer style={{ marginTop: 9, fontStyle: "normal", fontSize: 12.5, color: "var(--color-label-3)" }}>
                  {s.quote.by}{s.quote.by && s.quote.ref ? " · " : ""}{s.quote.ref}
                </footer>
              )}
            </blockquote>
          )}
          {(s.cite ?? []).length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 14 }}>
              {(s.cite ?? []).map((c, k) => {
                const go = c.to && onNavigate ? () => onNavigate!(c.to!) : undefined;
                return go ? (
                  <button key={k} type="button" onClick={go} style={{ ...citeBase, cursor: "pointer" }}>
                    {c.ref}<span aria-hidden style={{ opacity: 0.6, fontSize: 10 }}>›</span>
                  </button>
                ) : (
                  <span key={k} style={citeBase}>{c.ref}</span>
                );
              })}
            </div>
          )}
          {(s.see ?? []).length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
              {(s.see ?? []).map((x) => <Chip key={x.id} label={x.t} onClick={() => onOpen(x.id, null)} />)}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function GroupSection({ group, onOpen }: { group: { label: string; order: number; items: RelItem[] }; onOpen: (id: string, type: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const CAP = 24;
  const items = open ? group.items : group.items.slice(0, CAP);
  const more = group.items.length - items.length;
  return (
    <section style={{ marginTop: 26 }}>
      <Eyebrow count={group.items.length}>{group.label}</Eyebrow>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {items.map((it) => (
          <Chip key={it.relation + it.id} label={it.name_ru || it.id} onClick={() => onOpen(it.id, it.type)} />
        ))}
        {more > 0 && (
          <button type="button" onClick={() => setOpen(true)}
            style={{ display: "inline-flex", alignItems: "center", padding: "8px 13px", borderRadius: 999, border: "none",
              background: "none", fontFamily: "var(--font-text)", fontSize: 14, fontWeight: 600, color: "var(--color-brand-blue)", cursor: "pointer" }}>
            Ещё {more}
          </button>
        )}
      </div>
    </section>
  );
}

/* Кросс-силос фасеты: вид связи → подпись и маршрут открытия силос-элемента. */
const KIND_LABEL: Record<string, string> = {
  dish: "Любимые блюда",
  dhama: "Дхама",
  kirtan: "Киртаны",
  temple: "Храмы",
  festival: "Праздники",
  gallery: "Галерея",
  video: "Видео",
};
const KIND_ORDER = ["dhama", "dish", "kirtan", "temple", "festival", "gallery", "video"];

function kindHref(kind: string, ref: string): string | null {
  switch (kind) {
    case "dish": return "/prasadam/recipe/" + ref;
    case "dhama": return "/dhama/" + ref;
    default: return null; // остальные виды получат маршруты по мере ввода рефов
  }
}

function LinkSection({ kind, items, onNavigate }: { kind: string; items: LinkItem[]; onNavigate?: (href: string) => void }) {
  return (
    <section style={{ marginTop: 26 }}>
      <Eyebrow count={items.length}>{KIND_LABEL[kind] ?? kind}</Eyebrow>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {items.map((it) => {
          const href = kindHref(it.kind, it.ref);
          const go = href && onNavigate ? () => onNavigate(href) : undefined;
          return <Chip key={it.kind + it.ref} label={it.title || it.ref} onClick={go} />;
        })}
      </div>
    </section>
  );
}

interface LiveDarshan { source: string; date: string; templeSlug: string; templeName: string; deities: string | null; images: string[]; caption: string | null; srcUrl: string; channelUrl: string | null; postId: string }

/* ───────── Tier-1 табы ПКЛ (золотое подчёркивание, sticky под навбаром) ───────── */
function PersonTabs({ tabs, active, onChange }: { tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  useEffect(() => {
    const el = tabRefs.current[active]; const c = containerRef.current;
    if (!el || !c) return;
    c.scrollTo({ left: Math.max(0, el.offsetLeft - (c.clientWidth - el.clientWidth) / 2), behavior: "smooth" });
  }, [active]);
  return (
    <nav aria-label="Разделы личности" style={{ position: "sticky", top: 52, zIndex: 9, background: "color-mix(in srgb, var(--color-bg) 84%, transparent)", backdropFilter: "blur(40px) saturate(180%)", WebkitBackdropFilter: "blur(40px) saturate(180%)", borderBottom: "0.5px solid var(--color-hairline)" }}>
      <div ref={containerRef} style={{ display: "flex", alignItems: "center", overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch", padding: "0 6px" }}>
        {tabs.map((t) => {
          const on = t.id === active;
          return (
            <button key={t.id} ref={(el) => { tabRefs.current[t.id] = el; }} type="button" onClick={() => onChange(t.id)}
              style={{ position: "relative", flexShrink: 0, padding: "13px 14px", fontSize: 15, fontFamily: "var(--font-text)", background: "none", border: "none", cursor: "pointer", color: on ? "var(--color-label)" : "var(--color-label-3)", fontWeight: on ? 700 : 500, letterSpacing: on ? "-0.01em" : 0, transition: "color .15s", WebkitTapHighlightColor: "transparent" }}>
              {t.label}
              {on && <span aria-hidden style={{ position: "absolute", insetInline: 10, bottom: 0, height: 2, borderRadius: 999, background: GOLD }} />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* связи строками — полный список (без обрезки), удобная вертикальная прокрутка */
function RelRows({ group, onOpen }: { group: { label: string; order: number; items: RelItem[] }; onOpen: (id: string, type: string | null) => void }) {
  return (
    <section style={{ marginTop: 22 }}>
      <Eyebrow count={group.items.length}>{group.label}</Eyebrow>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {group.items.map((it) => (
          <button key={it.relation + it.id} type="button" onClick={() => onOpen(it.id, it.type)}
            style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", padding: "10px 13px", borderRadius: 12, border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)", cursor: "pointer", color: "inherit", font: "inherit" }}>
            <span style={{ display: "grid", placeItems: "center", height: 34, width: 34, flexShrink: 0, borderRadius: "50%", background: `color-mix(in srgb, ${GOLD} 14%, transparent)`, color: GOLD, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15 }}>{(it.name_ru || it.id).trim().charAt(0).toUpperCase()}</span>
            <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-text)", fontSize: 15, fontWeight: 600, color: "var(--color-label)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.name_ru || it.id}</span>
            <span aria-hidden style={{ color: "var(--color-label-3)", fontSize: 18, flexShrink: 0 }}>›</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export default function EntityPage({ id, onBack, onOpen, onNavigate }: { id: string; onBack: () => void; onOpen: (id: string, type: string | null) => void; onNavigate?: (href: string) => void }) {
  const { openCardMenu } = useCardActions();
  const [data, setData] = useState<EntityDetail | null>(null);
  const [error, setError] = useState(false);
  const [centers, setCenters] = useState<CenterHit[]>([]);
  const [tab, setTab] = useState<string>("obzor");

  useEffect(() => {
    let alive = true;
    setData(null); setError(false);
    fetch(api(`/entities/${encodeURIComponent(id)}`))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("http " + r.status))))
      .then((d) => { if (alive) setData(d as EntityDetail); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [id]);

  // Живой даршан: если у героя есть связи kind=darshan (храмы), берём сегодняшний
  // даршан этих храмов из /api/darshan (живьём из каналов, кэш на воркере). Не зависит
  // от ингеста в @iskcone и не пишет в канал — только показывает свежее фото-даршан.
  const [liveDarshans, setLiveDarshans] = useState<LiveDarshan[] | null>(null);
  useEffect(() => {
    const temples = (data?.links ?? []).filter((l) => l.kind === "darshan").map((l) => l.ref);
    if (temples.length === 0) { setLiveDarshans(null); return; }
    let alive = true;
    fetch(api("/darshan"))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d && Array.isArray(d.today)) setLiveDarshans(d.today as LiveDarshan[]); })
      .catch(() => { /* живой даршан необязателен */ });
    return () => { alive = false; };
  }, [data]);
  // Сквозная связь: центры, где есть это Божество/праздник (источник — раздел «Ятра»).
  useEffect(() => {
    let alive = true;
    setCenters([]);
    fetch(api(`/centers?entity=${encodeURIComponent(id)}`))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("http " + r.status))))
      .then((d) => { if (alive) setCenters(((d?.items as CenterHit[]) ?? [])); })
      .catch(() => { /* раздел просто не показывается */ });
    return () => { alive = false; };
  }, [id]);

  const groups = (() => {
    if (!data) return [];
    const map = new Map<string, { order: number; items: RelItem[] }>();
    const add = (label: string, order: number, item: RelItem) => {
      const g = map.get(label) ?? { order, items: [] };
      g.items.push(item);
      if (order < g.order) g.order = order;
      map.set(label, g);
    };
    for (const r of data.out) { const g = relGroup(r.relation, "out"); if (g && r.id) add(g.label, g.order, r); }
    for (const r of data.in) { const g = relGroup(r.relation, "in"); if (g && r.id) add(g.label, g.order, r); }
    return [...map.entries()].map(([label, g]) => {
      const seen = new Set<string>();
      const items = g.items.filter((it) => (seen.has(it.id) ? false : (seen.add(it.id), true)))
        .sort((a, b) => (a.name_ru || a.id).localeCompare(b.name_ru || b.id, "ru"));
      return { label, order: g.order, items };
    }).sort((a, b) => a.order - b.order);
  })();

  const linkGroups: [string, LinkItem[]][] = (() => {
    const map = new Map<string, LinkItem[]>();
    for (const l of data?.links ?? []) { if (l.kind === "darshan" || l.kind === "appearance" || l.kind === "disappearance" || l.kind === "scripture") continue; const a = map.get(l.kind) ?? []; a.push(l); map.set(l.kind, a); }
    return [...map.entries()].sort((a, b) => {
      const ia = KIND_ORDER.indexOf(a[0]); const ib = KIND_ORDER.indexOf(b[0]);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  })();

  const tattvaLabel = data?.tattva ? TATTVA_RU[data.tattva] ?? null : null;
  const catLabels = (data?.categories ?? []).map((c) => CATEGORY_RU[c]).filter(Boolean).slice(0, 4) as string[];
  const rasaKey = (() => {
    const cats = data?.categories ?? [];
    const explicit = cats.find((c) => c.startsWith("rasa:"));
    if (explicit) return explicit.slice(5);
    for (const c of cats) if (CATEGORY_RASA[c]) return CATEGORY_RASA[c];
    return null;
  })();
  const rasa = rasaKey ? RASA_RU[rasaKey] ?? null : null;
  const lead = data?.profile?.summary || data?.note || null;
  const article: LfSection[] | null = (() => {
    const raw = data?.profile?.longform;
    if (!raw) return null;
    try { const a = JSON.parse(raw); return Array.isArray(a) && a.length > 0 ? a as LfSection[] : null; } catch { return null; }
  })();

  // тождество Гаура↔Кришна-лила одной строкой (для ВКЛ)
  const idRel = [
    ...(data?.out ?? []).map((r) => ({ r, dir: "out" as const })),
    ...(data?.in ?? []).map((r) => ({ r, dir: "in" as const })),
  ].find((x) => x.r.relation === "gaura-lila-identity" && x.r.id);
  const identity = idRel ? (idRel.dir === "out" ? `В лиле Кришны — ${idRel.r.name_ru || idRel.r.id}` : `В лиле Шри Чайтаньи — ${idRel.r.name_ru || idRel.r.id}`) : null;
  const kicker = catLabels[0] || tattvaLabel || null;
  const heroChips = Array.from(new Set([tattvaLabel, rasa?.label, ...catLabels].filter(Boolean) as string[])).slice(0, 4);
  const hasScripture = (data?.links ?? []).some((l) => l.kind === "scripture") || linkGroups.length > 0;
  const hasPlaces = (liveDarshans?.length ?? 0) > 0 || centers.length > 0;
  const hasBio = !!article || !!data?.profile?.biography;
  const tabs: { id: string; label: string }[] = [{ id: "obzor", label: "Обзор" }];
  if (data && hasBio) tabs.push({ id: "zhizn", label: bioLabel(data) });
  if (groups.length > 0) tabs.push({ id: "svyazi", label: "Связи" });
  if (hasScripture) tabs.push({ id: "pisaniya", label: "Писания" });
  if (hasPlaces) tabs.push({ id: "mesta", label: "Места" });
  useEffect(() => { if (data) setTab((data.profile?.longform || data.profile?.biography) ? "zhizn" : "obzor"); }, [id, data?.id]);

  return (
    <div style={{ minHeight: "100%", background: "var(--color-bg)", color: "var(--color-label)" }}>
      {/* навбар */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center", height: 52, padding: "0 8px",
        background: "color-mix(in srgb, var(--color-bg) 86%, transparent)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        borderBottom: "0.5px solid var(--color-hairline)" }}>
        <button type="button" aria-label="Назад" onClick={onBack}
          style={{ display: "grid", height: 38, width: 38, placeItems: "center", borderRadius: "50%", border: "none", background: "none", color: "var(--color-label)", cursor: "pointer" }}>
          <BackIcon size={22} />
        </button>
        <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-text)", fontSize: 16, fontWeight: 600, color: "var(--color-label)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingInline: 6 }}>{data?.name_ru || ""}</span>
        {data && (
          <CardActionBtns favKey={`entity:${id}`}
            meta={{ t: data.name_ru || id, s: data.note || data.name_iast || undefined, h: `/person/${encodeURIComponent(id)}` }}
            onMore={() => openCardMenu({
            type: "entity", id, title: data.name_ru || id, subtitle: data.note || data.name_iast || undefined,
            url: `https://gaurangers.com/person/${encodeURIComponent(id)}`,
            context: `Герой · ${data.name_ru || id} · /entity/${id}`,
          })} />
        )}
      </div>

      <div style={{ padding: "12px 16px calc(48px + env(safe-area-inset-bottom,0px))" }}>
        {error && (
          <div style={{ marginTop: 40, textAlign: "center", color: "var(--color-label-3)", fontFamily: "var(--font-text)", fontSize: 15 }}>
            Не удалось загрузить. Потяните назад и попробуйте снова.
          </div>
        )}
        {!data && !error && (
          <div style={{ marginTop: 40, textAlign: "center", color: "var(--color-label-3)", fontFamily: "var(--font-text)", fontSize: 15 }}>Загрузка…</div>
        )}
        {data && (
          <>
            <PersonHeroCard
              id={id}
              nameRu={data.name_ru || data.id}
              nameIast={data.name_iast}
              image={data.image}
              kicker={kicker}
              identity={identity}
              summary={article ? null : lead}
              chips={heroChips}
              onMore={() => openCardMenu({
                type: "entity", id, title: data.name_ru || id, subtitle: data.note || data.name_iast || undefined,
                url: `https://gaurangers.com/person/${encodeURIComponent(id)}`,
                context: `Герой · ${data.name_ru || id} · /entity/${id}`,
              })}
            />

            {tabs.length > 1 && (
              <div style={{ marginInline: -16, marginTop: 16 }}>
                <PersonTabs tabs={tabs} active={tab} onChange={setTab} />
              </div>
            )}

            <div style={{ marginTop: tabs.length > 1 ? 18 : 22 }}>
              {tab === "obzor" && (
                <>
                  {lead && (
                    <p style={{ margin: 0, fontFamily: "var(--font-text)", fontSize: 17, lineHeight: 1.5, color: "var(--color-label)" }}>{lead}</p>
                  )}
                  {rasa && (
                    <div style={{ marginTop: lead ? 18 : 0, display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "var(--font-text)", fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLD }}>Раса</span>
                      <span style={{ fontFamily: "var(--font-text)", fontSize: 15, fontWeight: 600, color: "var(--color-label)" }}>{rasa.label}</span>
                      <span style={{ fontFamily: "var(--font-text)", fontSize: 14, color: "var(--color-label-3)" }}>· {rasa.gloss}</span>
                    </div>
                  )}
                  {(data.links ?? []).some((l) => l.kind === "appearance" || l.kind === "disappearance") && (
                    <div style={{ marginTop: (lead || rasa) ? 18 : 0 }}>
                      <Eyebrow>Тайминг</Eyebrow>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {(data.links ?? []).filter((l) => l.kind === "appearance" || l.kind === "disappearance").map((t) => (
                          <div key={t.kind + ":" + t.ref} style={{ fontFamily: "var(--font-text)", fontSize: 15, color: "var(--color-label)" }}>
                            <span style={{ color: "var(--color-label-3)" }}>{t.kind === "appearance" ? "Явление" : "Уход"}</span>
                            {t.title && <span style={{ fontWeight: 600 }}> · {t.title}</span>}
                            {t.subtitle && <span style={{ color: "var(--color-label-3)" }}> · {t.subtitle}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {!lead && !rasa && !hasBio && !(data.links ?? []).some((l) => l.kind === "appearance" || l.kind === "disappearance") && (
                    <p style={{ margin: 0, fontFamily: "var(--font-text)", fontSize: 15, color: "var(--color-label-3)" }}>Профиль готовится.</p>
                  )}
                </>
              )}

              {tab === "zhizn" && (article ? (
                <LongformArticle sections={article} onOpen={onOpen} onNavigate={onNavigate} />
              ) : (
                <>
                  {data.profile?.biography && <ProseSection label={bioLabel(data)} text={data.profile.biography} />}
                  {data.profile?.contribution && data.profile.contribution !== data.profile.biography && <ProseSection label="Вклад" text={data.profile.contribution} />}
                </>
              ))}

              {tab === "svyazi" && groups.map((g) => <RelRows key={g.label} group={g} onOpen={onOpen} />)}

              {tab === "pisaniya" && (
                <>
                  {(data.links ?? []).some((l) => l.kind === "scripture") && (
                    <section>
                      <Eyebrow>Писания</Eyebrow>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {(data.links ?? []).filter((l) => l.kind === "scripture").map((c) => (
                          <button key={c.ref} type="button" onClick={() => onNavigate?.("/" + c.ref)}
                            style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 2, padding: "11px 14px", borderRadius: 12, border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)", cursor: "pointer", color: "inherit", font: "inherit", width: "100%" }}>
                            <span style={{ fontFamily: "var(--font-text)", fontSize: 14.5, fontWeight: 600, color: "var(--color-label)" }}>{c.title}</span>
                            {c.subtitle && <span style={{ fontFamily: "var(--font-text)", fontSize: 12.5, color: "var(--color-label-3)" }}>{c.subtitle}</span>}
                          </button>
                        ))}
                      </div>
                    </section>
                  )}
                  {linkGroups.map(([kind, items]) => (
                    <LinkSection key={kind} kind={kind} items={items} onNavigate={onNavigate} />
                  ))}
                </>
              )}

              {tab === "mesta" && (
                <>
                  {(() => {
                    const byTemple = new Map((liveDarshans ?? []).map((d) => [d.templeSlug, d] as const));
                    const cards: LiveDarshan[] = [];
                    for (const t of (data.links ?? []).filter((l) => l.kind === "darshan")) { const d = byTemple.get(t.ref); if (d && d.images.length) cards.push(d); }
                    if (cards.length === 0) return null;
                    return (
                      <section>
                        <Eyebrow>Даршан сегодня</Eyebrow>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          {cards.map((d) => (
                            <div key={d.templeSlug} style={{ overflow: "hidden", borderRadius: 14, border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)" }}>
                              <img src={d.images[0]} alt={d.deities || d.templeName} loading="lazy" style={{ width: "100%", display: "block" }} />
                              <div style={{ padding: "10px 13px" }}>
                                <div style={{ fontFamily: "var(--font-text)", fontSize: 14, fontWeight: 600, color: "var(--color-label)" }}>{d.deities || d.templeName}</div>
                                <div style={{ marginTop: 2, fontFamily: "var(--font-text)", fontSize: 12.5, color: "var(--color-label-3)" }}>{d.templeName} · {d.date}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    );
                  })()}
                  {centers.length > 0 && (
                    <section style={{ marginTop: 22 }}>
                      <Eyebrow count={centers.length}>Центры</Eyebrow>
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {centers.map((c) => (
                          <button key={c.id} type="button" onClick={onNavigate ? () => onNavigate(`/center/${c.slug}`) : undefined}
                            style={{ textAlign: "left", display: "flex", alignItems: "center", gap: 12, padding: "11px 13px", borderRadius: 14, border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)", cursor: "pointer", color: "inherit", font: "inherit", width: "100%" }}>
                            <span style={{ minWidth: 0, flex: 1 }}>
                              <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: 15, fontWeight: 600, color: "var(--color-label)" }}>{c.name}</span>
                              {c.city && <span style={{ display: "block", marginTop: 2, fontFamily: "var(--font-text)", fontSize: 12.5, color: "var(--color-label-3)" }}>{c.city}</span>}
                            </span>
                            <span aria-hidden style={{ color: "var(--color-label-3)", fontSize: 18, flexShrink: 0 }}>›</span>
                          </button>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
