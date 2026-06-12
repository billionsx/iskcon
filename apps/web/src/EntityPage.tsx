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
import { CardActionBtns, useCardActions } from "./cardActions";
import { useEffect, useState } from "react";
import { api } from "./api";
import { BackIcon } from "./ui/icons";

const GOLD = "#D2AA1B";

export interface RelItem {
  relation: string;
  id: string;
  type: string | null;
  name_ru: string | null;
  name_iast: string | null;
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
  profile: { summary: string | null; biography: string | null; contribution: string | null; level: string | null } | null;
  out: RelItem[];
  in: RelItem[];
}

const TATTVA_RU: Record<string, string> = {
  "vishnu-tattva": "Вишну-таттва",
  "shakti-tattva": "Шакти-таттва",
  "shiva-tattva": "Шива-таттва",
  "jiva-tattva": "Джива-таттва",
};

const CATEGORY_RU: Record<string, string> = {
  "svayam-bhagavan": "Сваям Бхагаван",
  "source-of-all": "Источник всего",
  "hladini-shakti": "Хладини-шакти",
  "pancha-tattva": "Панча-таттва",
  "yuga-avatara": "Юга-аватара",
  "lila-avatara": "Лила-аватара",
  "shaktyavesha": "Шактьявеша",
  avatara: "Аватара",
  gopi: "Гопи",
  gopa: "Пастушок Враджа",
  manjari: "Манджари",
  vraja: "Враджа",
  consort: "Супруга Господа",
  "gaura-lila": "Гаура-лила",
  "krishna-lila": "Кришна-лила",
  "founder-acharya": "Основатель-ачарья",
  "initiating-guru": "Дикша-гуру ИСККОН",
  "zonal-acharya-1977": "Зональный ачарья (1977)",
  "founding-disciple": "Ученик-основатель",
  gaudiya: "Гаудия-вайшнав",
  acharya: "Ачарья",
  "six-goswamis": "Шесть Госвами",
  "madhva-parampara": "Мадхва-парампара",
  parampara: "Парампара",
  "maha-jana": "Маха-джана",
  bhagavatam: "«Шримад-Бхагаватам»",
  mahabharata: "«Махабхарата»",
  ramayana: "«Рамаяна»",
  gita: "«Бхагавад-гита»",
  pandava: "Пандав",
  kuru: "Куру",
  raghu: "Династия Рагху",
  king: "Царь",
  warrior: "Воин",
  sage: "Мудрец",
  sannyasi: "Санньяси",
  demigod: "Полубог",
  demon: "Демон",
  rakshasa: "Ракшас",
  vanara: "Вáнара",
  family: "Семья",
  servant: "Слуга Господа",
  "shuddha-bhakta": "Чистый преданный",
  "krishna-associate": "Спутник Кришны",
  "channa-avatara": "Скрытая аватара",
  "prakasha-vilasa": "Пракаша-виласа",
  iskcon: "ИСККОН",
  godbrother: "Духовный брат",
  pl: "Прабхупада-лиламрита",
  "canonical-scripture": "Канон",
  "prabhupada-book": "Книга Прабхупады",
};

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
    default: return null;
  }
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

function GroupSection({ group, onOpen }: { group: { label: string; order: number; items: RelItem[] }; onOpen: (id: string, type: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const CAP = 24;
  const items = open ? group.items : group.items.slice(0, CAP);
  const more = group.items.length - items.length;
  return (
    <section style={{ marginTop: 26 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontFamily: "var(--font-text)", fontSize: 13, fontWeight: 600, letterSpacing: "0.4px", textTransform: "uppercase", color: "var(--color-label-3)" }}>{group.label}</h3>
        {group.items.length > 1 && <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-label-3)", opacity: 0.7 }}>{group.items.length}</span>}
      </div>
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

export default function EntityPage({ id, onBack, onOpen }: { id: string; onBack: () => void; onOpen: (id: string, type: string | null) => void }) {
  const { openCardMenu } = useCardActions();
  const [data, setData] = useState<EntityDetail | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    setData(null); setError(false);
    fetch(api(`/entities/${encodeURIComponent(id)}`))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("http " + r.status))))
      .then((d) => { if (alive) setData(d as EntityDetail); })
      .catch(() => { if (alive) setError(true); });
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

  const tattvaLabel = data?.tattva ? TATTVA_RU[data.tattva] ?? null : null;
  const catLabels = (data?.categories ?? []).map((c) => CATEGORY_RU[c]).filter(Boolean).slice(0, 4) as string[];
  const lead = data?.profile?.summary || data?.note || null;

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
        <span style={{ flex: 1 }} />
        {data && (
          <CardActionBtns favKey={`entity:${id}`} onMore={() => openCardMenu({
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
            {/* hero */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 6 }}>
              {data.image ? <PhotoCircle src={data.image} size={72} /> : <Monogram ch={initialOf(data)} />}
              <div style={{ minWidth: 0 }}>
                <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 27, fontWeight: 700, letterSpacing: "-0.4px", lineHeight: 1.12, color: "var(--color-label)" }}>{data.name_ru || data.id}</h1>
                {data.name_iast && (
                  <div style={{ marginTop: 3, fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 16, color: "var(--color-label-2)" }}>{data.name_iast}</div>
                )}
              </div>
            </div>

            {/* мета-чипы */}
            {(tattvaLabel || catLabels.length > 0) && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 16 }}>
                {tattvaLabel && (
                  <span style={{ display: "inline-flex", alignItems: "center", padding: "6px 11px", borderRadius: 999, background: `color-mix(in srgb, ${GOLD} 12%, transparent)`, color: GOLD, fontFamily: "var(--font-text)", fontSize: 12.5, fontWeight: 600 }}>{tattvaLabel}</span>
                )}
                {catLabels.map((c) => (
                  <span key={c} style={{ display: "inline-flex", alignItems: "center", padding: "6px 11px", borderRadius: 999, background: "var(--color-fill-1)", color: "var(--color-label-2)", fontFamily: "var(--font-text)", fontSize: 12.5, fontWeight: 500 }}>{c}</span>
                ))}
              </div>
            )}

            {/* лид-текст */}
            {lead && (
              <p style={{ margin: "20px 0 0", fontFamily: "var(--font-text)", fontSize: 17, lineHeight: 1.5, color: "var(--color-label)" }}>{lead}</p>
            )}
            {data.profile?.biography && data.profile.biography !== lead && (
              <p style={{ margin: "12px 0 0", fontFamily: "var(--font-text)", fontSize: 16, lineHeight: 1.5, color: "var(--color-label-2)" }}>{data.profile.biography}</p>
            )}
            {data.source_ref && (
              <div style={{ marginTop: 12, fontFamily: "var(--font-text)", fontSize: 13, color: "var(--color-label-3)" }}>Источник: {data.source_ref}</div>
            )}

            {/* связи */}
            {groups.map((g) => <GroupSection key={g.label} group={g} onOpen={onOpen} />)}

            {groups.length === 0 && !lead && (
              <p style={{ margin: "24px 0 0", fontFamily: "var(--font-text)", fontSize: 15, color: "var(--color-label-3)" }}>Профиль готовится.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
