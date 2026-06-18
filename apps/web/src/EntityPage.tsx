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
import { CATEGORY_RU, RASA_RU } from "./entityLabels";
import { CardActionBtns, useCardActions } from "./cardActions";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "./api";
import { BackIcon } from "./ui/icons";
import { PersonHeroCard } from "./PersonHeroCard";
import { Rail } from "./AcharyaScreen";
import { renderTerms } from "./ui/Skt";
import { SectionSubTabs } from "./SectionSubTabs";

const GOLD = "#D2AA1B";

// Канонический вывод расы из категорий реестра: гопи/манджари → мадхурья, гопа → сакхья.
const CATEGORY_RASA: Record<string, string> = { gopi: "madhurya", manjari: "madhurya", gopa: "sakhya" };
// Кураторские факт-чипы для ВКЛ (то, что не выводится из категорий).
const FACT_CHIPS: Record<string, string[]> = { krishna: ["Лично явился в этом мире 5 252 года назад"] };

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
type LfListGroup = { label?: string; items: string[] };
type LfSource = { by?: string; byId?: string; ref?: string; to?: string };
type LfQuote = { t: string; by?: string; byId?: string; ref?: string; to?: string };
type LfSection = { h?: string; p?: string[]; list?: LfListGroup[]; listSource?: LfSource; cite?: LfCite[]; quote?: LfQuote; quotes?: LfQuote[]; see?: LfSee[] };
type RailDef = { title: string; params: string; orderIds?: string[] };
type NavCard = { title: string; subtitle?: string; to?: string; collection?: string };
type DossierSub = { id: string; label: string; sections: LfSection[]; rails?: RailDef[]; cards?: NavCard[] };
type DossierTab = { id: string; label: string; kicker?: string; sections?: LfSection[]; subtabs?: DossierSub[]; rails?: RailDef[]; cards?: NavCard[] };
type Dossier = { tabs: DossierTab[] };
function expandCiteRef(ref: string): string {
  const isRange = (x: string) => /[\u2013\u2014-]/.test(x);
  const lvl = (parts: string[], labels: string[]) =>
    parts.map((x, i) => {
      const base = labels[i] ?? "стих";
      const lab = isRange(x) ? (base === "стих" ? "стихи" : base === "глава" ? "главы" : base) : base;
      return lab + " " + x;
    });
  let m = ref.match(/^Ч\.-ч\.,\s*(Ади|Мадхья|Антья)\s+(.+)$/);
  if (m) return ["Шри Чайтанья-чаритамрита", m[1] + "-лила", ...lvl(m[2].split("."), ["глава", "стих"])].join(", ");
  m = ref.match(/^ШБ\s+(.+)$/);
  if (m) return ["Шримад-Бхагаватам", ...lvl(m[1].split("."), ["песнь", "глава", "стих"])].join(", ");
  m = ref.match(/^Брахма-самхита\s+(.+)$/);
  if (m) return ["Брахма-самхита", ...lvl(m[1].split("."), ["глава", "стих"])].join(", ");
  m = ref.match(/^БГ\s+(.+)$/);
  if (m) return ["Бхагавад-гита", ...lvl(m[1].split("."), ["глава", "стих"])].join(", ");
  return ref;
}
// Все санскритские/бенгальские термины подсвечиваются единым законом —
// см. ui/scripture.ts (TERMS + COMPOUNDS) и ui/Skt.tsx (renderTerms).
// ПКЛ-специфичный список составных терминов был промоутирован в COMPOUNDS,
// так что один и тот же словарь работает по всему приложению.
function renderSanskrit(text: string | null | undefined): ReactNode {
  return renderTerms(text);
}
// === Стандарт отображения стиха (ПКЛ/ВКЛ модуль) ===
// Снимает ВНЕШНИЕ обрамляющие кавычки (« » “ ” " „) только если стих ими обёрнут
// целиком (начинается с открывающей). Внутренние цитаты сохраняются. Текст в БД
// остаётся дословным — нормализуется лишь представление, чтобы все стихи выглядели
// единообразно (золотая граница + курсив = знак цитаты, без двойных кавычек).
function stripWrap(t: string): string {
  let s = (t || "").trim();
  if (/^[«“"„]/.test(s)) {
    s = s.replace(/^[«“"„]\s*/, "");
    s = s.replace(/\s*([.!?…]?)\s*[»”"]\s*([.!?…]*)\s*$/u, (_m, inner: string, outer: string) => inner || outer || "");
  }
  return s;
}
// Единая ссылка-источник: для стихов и для cite. Серый текст + шеврон (если кликабельно).
function SourceLink({ label, to, onNavigate, size = 14 }: { label: string; to?: string; onNavigate?: (href: string) => void; size?: number }) {
  const base: React.CSSProperties = { fontFamily: "var(--font-text)", fontSize: size, fontWeight: 400, letterSpacing: "-0.01em", color: "var(--color-label-2)", background: "none", border: "none", padding: 0, display: "inline-flex", alignItems: "baseline", gap: 3, lineHeight: 1.45, textAlign: "left" };
  if (to && onNavigate) return (
    <button type="button" onClick={() => onNavigate(to)} style={{ ...base, cursor: "pointer" }}>
      <span>{label}</span><span aria-hidden style={{ opacity: 0.45, fontSize: size - 1 }}>›</span>
    </button>
  );
  return <span style={base}>{label}</span>;
}
// Стандарт подписи к стиху — три раздельные строки:
//   1) «— Кто говорит цитату»  (ссылка на ПКЛ, если есть byId)
//   2) Название источника,     (книга — отдельной строкой)
//   3) Часть, глава и стих     (всё, что идёт после первой запятой)
// splitRef режет ref на «книга» + «остальное» по первой запятой. Если запятой
// нет (короткая ссылка) — возвращает один блок.
function splitRef(ref: string): { title: string; rest: string } {
  const i = ref.indexOf(",");
  if (i < 0) return { title: ref, rest: "" };
  return { title: ref.slice(0, i + 1).trim(), rest: ref.slice(i + 1).trim() };
}
// Единый стандарт атрибуции источника: «— Кто сказал» (ссылка на карточку
// личности, если есть byId) + ссылка-источник «где сказал». Применяется под
// цитатами и под перечнями (списками). fontStyle:normal — чтобы корректно
// смотреться и внутри курсивного blockquote, и отдельно.
function Attribution({ src, onOpen, onNavigate, marginTop = 12 }: { src: LfSource; onOpen: (id: string, type: string | null) => void; onNavigate?: (href: string) => void; marginTop?: number }) {
  if (!src.by && !src.ref) return null;
  const speaker = src.byId
    ? <button type="button" onClick={() => onOpen(src.byId!, "personality")} style={{ background: "none", border: "none", padding: 0, fontFamily: "var(--font-text)", fontSize: 13.5, fontWeight: 500, color: "var(--color-label)", cursor: "pointer" }}>{src.by}</button>
    : <span style={{ fontFamily: "var(--font-text)", fontSize: 13.5, fontWeight: 500, color: "var(--color-label-2)" }}>{src.by}</span>;
  const parts = src.ref ? splitRef(src.ref) : null;
  return (
    <div style={{ marginTop, fontFamily: "var(--font-text)", fontStyle: "normal" }}>
      {src.by && <div>— {speaker}</div>}
      {parts && parts.title && (
        <div style={{ marginTop: src.by ? 3 : 0 }}>
          <SourceLink label={parts.title} to={parts.rest ? undefined : src.to} onNavigate={parts.rest ? undefined : onNavigate} size={13} />
        </div>
      )}
      {parts && parts.rest && (
        <div style={{ marginTop: 1 }}>
          <SourceLink label={parts.rest} to={src.to} onNavigate={onNavigate} size={13} />
        </div>
      )}
    </div>
  );
}
// Стандартный блок стиха: курсив + золотая граница, без кавычек; подпись-атрибуция
// «— Кто говорит» (ссылка на карточку, byId) и единая ссылка-источник.
function QuoteBlock({ q, onOpen, onNavigate }: { q: LfQuote; onOpen: (id: string, type: string | null) => void; onNavigate?: (href: string) => void }) {
  return (
    <blockquote style={{ margin: "20px 0 0", padding: "2px 0 2px 18px", borderLeft: `3px solid ${GOLD}`, fontFamily: "Georgia, 'Gentium Book Plus', 'Times New Roman', serif", fontSizeAdjust: "none", fontSize: 18, lineHeight: 1.6, fontStyle: "italic", color: "var(--color-label)" }}>
      <span>{stripWrap(q.t)}</span>
      <Attribution src={q} onOpen={onOpen} onNavigate={onNavigate} marginTop={12} />
    </blockquote>
  );
}
function LongformArticle({ sections, onOpen, onNavigate }: { sections: LfSection[]; onOpen: (id: string, type: string | null) => void; onNavigate?: (href: string) => void }) {
  return (
    <div>
      {sections.map((s, i) => (
        <section key={i} style={{ marginTop: i === 0 ? 26 : 34 }}>
          {s.h && <Eyebrow>{s.h}</Eyebrow>}
          {(s.p ?? []).map((para, j) => (
            <p key={j} style={{ margin: j === 0 ? 0 : "13px 0 0", fontFamily: "var(--font-text)", fontSize: 16, lineHeight: 1.65, color: "var(--color-label)" }}>{renderSanskrit(para)}</p>
          ))}
          {(s.list ?? []).length > 0 && (() => {
            let n = 0;
            return (
              <div style={{ marginTop: 18 }}>
                {(s.list ?? []).map((grp, gi) => (
                  <div key={gi} style={{ marginTop: gi === 0 ? 0 : 22 }}>
                    {grp.label && (
                      <div style={{ fontFamily: "var(--font-text)", fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLD, marginBottom: 9 }}>{grp.label}</div>
                    )}
                    {grp.items.map((it) => {
                      n += 1;
                      return (
                        <div key={n} style={{ display: "flex", gap: 12, alignItems: "baseline", padding: "4px 0" }}>
                          <span style={{ flexShrink: 0, minWidth: 22, textAlign: "right", fontFamily: "var(--font-text)", fontSize: 13, fontWeight: 700, color: GOLD, fontVariantNumeric: "tabular-nums", lineHeight: 1.5 }}>{n}</span>
                          <span style={{ fontFamily: "var(--font-text)", fontSize: 15.5, lineHeight: 1.5, color: "var(--color-label)" }}>{renderSanskrit(it)}</span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            );
          })()}
          {s.listSource && <Attribution src={s.listSource} onOpen={onOpen} onNavigate={onNavigate} marginTop={16} />}
          {[...(s.quote ? [s.quote] : []), ...(s.quotes ?? [])].map((q, qi) => (
            <QuoteBlock key={qi} q={q} onOpen={onOpen} onNavigate={onNavigate} />
          ))}
          {(s.cite ?? []).length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10, marginTop: 16 }}>
              {(s.cite ?? []).map((c, k) => {
                const parts = splitRef(expandCiteRef(c.ref));
                return (
                  <div key={k} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                    <SourceLink label={parts.title} to={parts.rest ? undefined : c.to} onNavigate={parts.rest ? undefined : onNavigate} size={14} />
                    {parts.rest && (
                      <div style={{ marginTop: 1 }}>
                        <SourceLink label={parts.rest} to={c.to} onNavigate={onNavigate} size={14} />
                      </div>
                    )}
                  </div>
                );
              })}
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
function NavCards({ cards, onNavigate, onOpenCollection }: { cards: NavCard[]; onNavigate?: (href: string) => void; onOpenCollection?: (key: string) => void }) {
  return (
    <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
      {cards.map((c) => (
        <button key={c.title} type="button" onClick={() => { if (c.collection) onOpenCollection?.(c.collection); else if (c.to) onNavigate?.(c.to); }}
          style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", padding: "13px 15px", borderRadius: 14, border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)", cursor: "pointer", color: "inherit", font: "inherit" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-text)", fontSize: 15.5, fontWeight: 600, color: "var(--color-label)" }}>{c.title}</div>
            {c.subtitle && <div style={{ fontFamily: "var(--font-text)", fontSize: 13, color: "var(--color-label-2)", marginTop: 2, lineHeight: 1.4 }}>{c.subtitle}</div>}
          </div>
          <span aria-hidden style={{ color: "var(--color-label-3)", fontSize: 22, lineHeight: 1 }}>›</span>
        </button>
      ))}
    </div>
  );
}

function PersonTabs({ tabs, active, onChange, stickyTop = 52 }: { tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void; stickyTop?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  useEffect(() => {
    const el = tabRefs.current[active]; const c = containerRef.current;
    if (!el || !c) return;
    c.scrollTo({ left: Math.max(0, el.offsetLeft - (c.clientWidth - el.clientWidth) / 2), behavior: "smooth" });
  }, [active]);
  return (
    <nav aria-label="Разделы личности" style={{ position: "sticky", top: stickyTop, zIndex: 9, marginInline: -16, marginTop: 14, background: "color-mix(in srgb, var(--color-bg) 84%, transparent)", backdropFilter: "blur(40px) saturate(180%)", WebkitBackdropFilter: "blur(40px) saturate(180%)", borderBottom: "0.5px solid var(--color-hairline)" }}>
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

/* Tier-3 суб-табы (капсулы, тема-адаптивные, липкие под Tier-1) */
function PersonSubTabs({ items, active, onChange, stickyTop = 96 }: { items: { id: string; label: string }[]; active: string; onChange: (id: string) => void; stickyTop?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  useEffect(() => {
    const el = itemRefs.current[active]; const c = containerRef.current;
    if (!el || !c) return;
    c.scrollTo({ left: Math.max(0, el.offsetLeft - (c.clientWidth - el.clientWidth) / 2), behavior: "smooth" });
  }, [active]);
  return (
    <nav aria-label="Подразделы" style={{ position: "sticky", top: stickyTop, zIndex: 8, marginInline: -16, marginTop: 14, background: "color-mix(in srgb, var(--color-bg) 84%, transparent)", backdropFilter: "blur(40px) saturate(180%)", WebkitBackdropFilter: "blur(40px) saturate(180%)" }}>
      <div ref={containerRef} style={{ display: "flex", gap: 8, alignItems: "center", overflowX: "auto", padding: "10px 16px", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
        {items.map((it) => {
          const on = it.id === active;
          return (
            <button key={it.id} ref={(el) => { itemRefs.current[it.id] = el; }} type="button" onClick={() => onChange(it.id)}
              style={{ flexShrink: 0, padding: "7px 14px", borderRadius: 999, border: on ? "0.5px solid transparent" : "0.5px solid var(--color-hairline)", cursor: "pointer", fontSize: 13.5, fontFamily: "var(--font-text)", fontWeight: 600, whiteSpace: "nowrap", background: on ? "var(--color-label)" : "var(--color-bg-2)", color: on ? "var(--color-bg)" : "var(--color-label-2)", transition: "background .18s, color .18s", WebkitTapHighlightColor: "transparent" }}>
              {it.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default function EntityPage({ id, onBack, onOpen, onNavigate, onOpenCollection, embedded }: { id: string; onBack: () => void; onOpen: (id: string, type: string | null) => void; onNavigate?: (href: string) => void; onOpenCollection?: (key: string) => void; embedded?: boolean }) {
  const { openCardMenu } = useCardActions();
  const [data, setData] = useState<EntityDetail | null>(null);
  const [error, setError] = useState(false);
  const [centers, setCenters] = useState<CenterHit[]>([]);
  const [tab, setTab] = useState<string>("obzor");
  const [sub, setSub] = useState<string>("");

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
  // Досье личности: новый формат {tabs:[...]} (богословские табы Таттва/Нама/Рупа/…)
  const dossier: Dossier | null = (() => {
    const raw = data?.profile?.longform;
    if (!raw) return null;
    try { const o = JSON.parse(raw); return (o && !Array.isArray(o) && Array.isArray(o.tabs) && o.tabs.length > 0) ? o as Dossier : null; } catch { return null; }
  })();
  const dossierTabs = dossier ? dossier.tabs.map((t) => ({ id: t.id, label: t.label })) : [];
  const activeTabObj = dossier?.tabs.find((t) => t.id === tab) ?? (dossier ? dossier.tabs[0] : undefined);
  const subItems = (activeTabObj?.subtabs ?? []).map((st) => ({ id: st.id, label: st.label }));
  const activeSub = activeTabObj?.subtabs?.find((st) => st.id === sub);
  const subSections = activeSub?.sections ?? [];
  const subRails = activeSub?.rails ?? [];
  const subCards = activeSub?.cards ?? [];

  // тождество Гаура↔Кришна-лила одной строкой (для ВКЛ)
  const idRel = [
    ...(data?.out ?? []).map((r) => ({ r, dir: "out" as const })),
    ...(data?.in ?? []).map((r) => ({ r, dir: "in" as const })),
  ].find((x) => x.r.relation === "gaura-lila-identity" && x.r.id);
  const identity = idRel ? (idRel.dir === "out" ? `В лиле Кришны — ${idRel.r.name_ru || idRel.r.id}` : `В лиле Шри Чайтаньи — ${idRel.r.name_ru || idRel.r.id}`) : null;
  // Классификация для ВКЛ: авторитетная «надпись» (eyebrow) + вторичные чипы без дублей.
  const { eyebrow, heroChips } = (() => {
    const cats = data?.categories ?? [];
    const t = data?.tattva;
    const has = (c: string) => cats.includes(c);
    const used = new Set<string>();
    const eat = (...cs: string[]) => { for (const c of cs) used.add(c); };
    let primary = "";
    if (has("svayam-bhagavan")) { primary = "Верховная Личность Бога"; eat("svayam-bhagavan", "yuga-avatara", "channa-avatara"); }
    else if (t === "vishnu-tattva") {
      if (has("first-expansion") || has("prakasha-vilasa")) { primary = "Полная экспансия Господа"; eat("first-expansion", "prakasha-vilasa"); }
      else if (has("avatara") || has("lila-avatara")) { primary = "Аватара Господа"; eat("avatara", "lila-avatara"); }
      else primary = "Вишну-таттва";
    }
    else if (t === "shakti-tattva") {
      if (has("hladini-shakti")) { primary = "Хладини-шакти"; eat("hladini-shakti"); }
      else if (has("krishna-consort") || has("consort")) { primary = "Супруга Господа"; eat("krishna-consort", "consort"); }
      else if (has("gopi")) { primary = "Гопи Враджа"; eat("gopi"); }
      else primary = "Шакти-таттва";
    }
    else if (data?.type === "place") {
      if (has("vraja-vana")) { primary = "Лес Враджа"; eat("vraja-vana", "vraja", "dham"); }
      else if (has("vraja-tirtha")) { primary = "Святое место Враджа"; eat("vraja-tirtha", "vraja", "dham"); }
      else if (has("gaura-tirtha")) { primary = "Святое место Гауры"; eat("gaura-tirtha", "dham"); }
      else if (has("navadvipa") || has("gaura-dham")) { primary = "Гаура-дхама"; eat("navadvipa", "gaura-dham", "dham"); }
      else if (has("dham")) { primary = "Святая дхама"; eat("dham"); }
      else primary = "Святое место";
    }
    else {
      if (has("founder-acharya")) { primary = "Основатель-ачарья"; eat("founder-acharya"); }
      else if (has("acharya") || has("vaishnava-acharya")) { primary = "Ачарья"; eat("acharya", "vaishnava-acharya"); }
      else if (has("six-goswamis")) { primary = "Шесть Госвами Вриндавана"; eat("six-goswamis"); }
      else if (has("chaitanya-associate")) { primary = "Спутник Шри Чайтаньи"; eat("chaitanya-associate"); }
      else if (has("gopi")) { primary = "Гопи Враджа"; eat("gopi"); }
      else if (has("manjari")) { primary = "Манджари Враджа"; eat("manjari"); }
      else if (has("gopa")) { primary = "Пастушок Враджа"; eat("gopa"); }
      else if (has("krishna-family")) { primary = "Семья Кришны"; eat("krishna-family", "eternal-associate"); }
      else if (has("krishna-associate") || has("krishna-lila") || has("eternal-associate")) { primary = "Вечный спутник Кришны"; eat("krishna-associate", "krishna-lila", "eternal-associate"); }
      else if (has("king")) primary = "Царь";
      else if (has("sage")) primary = "Мудрец";
      else if (has("demon") || has("rakshasa")) primary = "Душа, обретшая освобождение";
      else primary = catLabels[0] ?? "Вайшнавская традиция";
    }
    let qualifier = "";
    if (rasa && data?.type !== "place" && !/таттва|Личность/.test(primary)) qualifier = `${rasa.label}-раса`;
    else if (has("gaudiya")) { qualifier = "Гаудия-сампрадая"; eat("gaudiya"); }
    const eyebrow = qualifier ? `${primary} · ${qualifier}` : primary;
    const SCRIPT = new Set(["bhagavatam", "gita", "cc", "ramayana", "mahabharata"]);
    const W = (c: string) => (c === "source-of-all" ? 3 : SCRIPT.has(c) ? 2 : c === "vraja" ? -1 : 0);
    const rest = cats.filter((c) => !used.has(c) && !c.startsWith("rasa:") && CATEGORY_RU[c]).sort((a, b) => W(b) - W(a));
    const heroChips = FACT_CHIPS[id] ?? Array.from(new Set(rest.map((c) => CATEGORY_RU[c]))).slice(0, 4);
    return { eyebrow, heroChips };
  })();
  // Эпитет на карточке (ВКЛ): профильное summary как авторитетная «надпись», иначе короткая заметка.
  const heroSummary = data?.profile?.summary || data?.note || null;
  const hasScripture = (data?.links ?? []).some((l) => l.kind === "scripture") || linkGroups.length > 0;
  const hasPlaces = (liveDarshans?.length ?? 0) > 0 || centers.length > 0;
  const hasBio = !!article || !!data?.profile?.biography;
  const tabs: { id: string; label: string }[] = [{ id: "obzor", label: "Обзор" }];
  if (data && hasBio) tabs.push({ id: "zhizn", label: bioLabel(data) });
  if (groups.length > 0) tabs.push({ id: "svyazi", label: "Связи" });
  if (hasScripture) tabs.push({ id: "pisaniya", label: "Писания" });
  if (hasPlaces) tabs.push({ id: "mesta", label: "Места" });
  useEffect(() => {
    if (!data) return;
    const raw = data.profile?.longform;
    let dos: Dossier | null = null;
    try { const o = raw ? JSON.parse(raw) : null; if (o && !Array.isArray(o) && Array.isArray(o.tabs) && o.tabs.length) dos = o; } catch { /* not dossier */ }
    setTab(dos ? dos.tabs[0].id : (raw || data.profile?.biography) ? "zhizn" : "obzor");
  }, [id, data?.id]);
  // при смене Tier-1 таба в досье — выставить первый суб-таб
  useEffect(() => { const t = dossier?.tabs.find((x) => x.id === tab); setSub(t?.subtabs?.[0]?.id ?? ""); }, [tab, data?.id]);

  return (
    <div style={{ minHeight: "100%", background: "var(--color-bg)", color: "var(--color-label)" }}>
      {!embedded && (
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
      )}

      <div style={{ padding: embedded ? "0 0 10px" : "12px 16px calc(48px + env(safe-area-inset-bottom,0px))" }}>
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
              eyebrow={eyebrow}
              identity={identity}
              summary={heroSummary}
              chips={heroChips}
              onMore={() => openCardMenu({
                type: "entity", id, title: data.name_ru || id, subtitle: data.note || data.name_iast || undefined,
                url: `https://gaurangers.com/person/${encodeURIComponent(id)}`,
                context: `Герой · ${data.name_ru || id} · /entity/${id}`,
              })}
            />

            {dossier ? (
              <>
                <PersonTabs tabs={dossierTabs} active={tab} onChange={setTab} stickyTop={embedded ? 0 : 52} />
                <div style={{ marginTop: 18 }}>
                  {activeTabObj?.sections && activeTabObj.sections.length > 0 && (
                    <LongformArticle sections={activeTabObj.sections} onOpen={onOpen} onNavigate={onNavigate} />
                  )}
                  {activeTabObj?.rails?.map((r) => <Rail key={r.title} title={r.title} params={r.params} orderIds={r.orderIds} onOpen={onOpen} />)}
                  {activeTabObj?.cards && activeTabObj.cards.length > 0 && <NavCards cards={activeTabObj.cards} onNavigate={onNavigate} onOpenCollection={onOpenCollection} />}
                  {subItems.length > 0 && <PersonSubTabs items={subItems} active={sub} onChange={setSub} stickyTop={embedded ? 46 : 96} />}
                  {subSections.length > 0 && (
                    <div style={{ marginTop: 18 }}>
                      <LongformArticle sections={subSections} onOpen={onOpen} onNavigate={onNavigate} />
                    </div>
                  )}
                  {subRails.map((r) => <Rail key={r.title} title={r.title} params={r.params} orderIds={r.orderIds} onOpen={onOpen} />)}
                  {subCards.length > 0 && <NavCards cards={subCards} onNavigate={onNavigate} onOpenCollection={onOpenCollection} />}
                </div>
              </>
            ) : (
              <>
            {tabs.length > 1 && <PersonTabs tabs={tabs} active={tab} onChange={setTab} stickyTop={embedded ? 0 : 52} />}

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
          </>
        )}
      </div>
    </div>
  );
}
