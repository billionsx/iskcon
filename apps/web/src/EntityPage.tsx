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
import { CardActionBtns, useCardActions, favMetaFromCtx, type CardCtx } from "./cardActions";
import { useEffect, useRef, useState, Fragment, type ReactNode } from "react";
import { api } from "./api";
import { replaceUrl } from "./nav";
import { BackIcon } from "./ui/icons";
import { PersonHeroCard } from "./PersonHeroCard";
import { galleryFor } from "./personaGallery";
import { Rail } from "./AcharyaScreen";
import { renderTerms } from "./ui/Skt";
import { cleanCardText } from "./cardText";
import { SectionSubTabs } from "./SectionSubTabs";
import { COVER_FALLBACK } from "./ui/CoverFallback";
import { ROUTES, url } from "./routes";

const GOLD = "var(--color-gold)";

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
    case "gauranga-lila-identity": return O ? { label: "В Кришна Лиле", order: 40 } : { label: "В Гауранга Лиле", order: 41 };
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
        fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: 500, color: "var(--color-label)",
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
      <h3 style={{ margin: 0, fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLD }}>{children}</h3>
      {count != null && count > 1 && <span style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption)", fontWeight: 700, color: GOLD, opacity: 0.55 }}>{count}</span>}
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
      <p style={{ margin: 0, fontFamily: "var(--font-text)", fontSize: "var(--text-callout)", lineHeight: 1.55, color: "var(--color-label)", whiteSpace: "pre-line" }}>{text}</p>
    </section>
  );
}

type LfSee = { id: string; t: string };
type LfCite = { ref: string; to?: string };
type LfListGroup = { label?: string; items: string[] };
type LfSource = { by?: string; byId?: string; ref?: string; to?: string };
type LfQuote = { t: string; translit?: string; by?: string; byId?: string; ref?: string; to?: string; gold?: boolean };
type HierTier = { abode: string; beings?: string; note?: string | string[]; count?: string; countNote?: string; appeared?: string; apex?: boolean; eyebrow?: string; ref?: string; items?: { name: string; ref: string; desc?: string }[] };
type HierGroup = { realm: string; tiers: HierTier[] };
type LfCatItem = { name: string; desc?: string; ref?: string; tags?: string[] };
type LfCatGroup = { group: string; gloss?: string; note?: string | string[]; src?: LfSource; items?: LfCatItem[] };
type LfSection = { h?: string; p?: string[]; list?: LfListGroup[]; listSource?: LfSource; cite?: LfCite[]; quote?: LfQuote; quotes?: LfQuote[]; see?: LfSee[]; hierarchy?: HierGroup[]; hierarchyFooter?: string; catalog?: LfCatGroup[] };
type RailDef = { title: string; params: string; orderIds?: string[] };
type NavCard = { title: string; subtitle?: string; to?: string; collection?: string };
type DossierSub = { id: string; label: string; realm?: "material" | "spiritual"; sections: LfSection[]; rails?: RailDef[]; cards?: NavCard[] };
type DossierTab = { id: string; label: string; kicker?: string; title?: string; lead?: string; sections?: LfSection[]; subtabs?: DossierSub[]; rails?: RailDef[]; cards?: NavCard[] };
type Dossier = { tabs: DossierTab[] };
type RefParts = { book: string; lila?: string; loc?: string; to?: string };

// Единый разбор шастрической ссылки. Возвращает части для академического
// рендера: «Чайтанья-чаритамрита, Мадхья-лила, 21.107». Поддерживает
// компактные коды (ШБ 1.3.28, ЧЧ Мадхья 20.4, БРС 2.1.17) и развёрнутые
// названия. Для ШБ/БГ/ЧЧ автоматически строит deep-link в читалку.
function expandRef(ref: string): RefParts {
  const r0 = ref.trim();
  const r = r0.replace(/^[«"]+|[»"]+$/g, "").replace(/^Шри\s+/, "").trim();
  const head = (s: string) => s.split(/[-–—]/)[0]; // старт диапазона для deep-link
  const dash = (s: string) => s.replace(/[-–—]/g, "–");
  const vw = (v: string) => (/[-–—]/.test(v) ? "стихи " : "стих ") + dash(v); // «стих N» / «стихи N–M»
  // Шримад-Бхагаватам (песнь.глава.стих[-стих])
  let m = r.match(/^(?:ШБ|Шримад-Бхагаватам)\s+(\d+)\.(\d+)\.(\d+(?:[-–—]\d+)?)$/);
  if (m) return { book: "Шримад-Бхагаватам", loc: "Песнь "+m[1]+", глава "+m[2]+", "+vw(m[3]), to: "/book/sb/"+m[1]+"/"+m[2]+"/"+head(m[3]) };
  m = r.match(/^(?:ШБ|Шримад-Бхагаватам)\s+(\d+)\.(\d+(?:[-–—]\d+)?)$/);
  if (m) return { book: "Шримад-Бхагаватам", loc: "Песнь "+m[1]+", глава "+m[2], to: "/book/sb/"+m[1]+"/"+head(m[2]) };
  // Бхагавад-гита (глава.стих[-стих])
  m = r.match(/^(?:БГ|Бхагавад-гита)\s+(\d+)\.(\d+(?:[-–—]\d+)?)$/);
  if (m) return { book: "Бхагавад-гита как она есть", loc: "глава "+m[1]+", "+vw(m[2]), to: "/book/bg/"+m[1]+"/"+head(m[2]) };
  // Чайтанья-чаритамрита — 3 части (book / lila / loc); диапазоны и алиас «Ч.-ч.»
  // (запятая после кода допускается: «Ч.-ч., Мадхья 8.57» нормализуется в рендере).
  m = r.match(/^(?:ЧЧ|Ч\.-?ч\.|Чайтанья-чаритамрита),?\s+(Ади|Мадхья|Антья)\s+(\d+(?:[-–—]\d+)?)(?:\.(\d+(?:[-–—]\d+)?))?$/);
  if (m) {
    const slug = m[1] === "Ади" ? "adi" : m[1] === "Мадхья" ? "madhya" : "antya";
    const loc = m[3] ? "глава "+m[2]+", "+vw(m[3]) : "глава "+m[2];
    const to  = m[3] ? "/book/cc/"+slug+"/"+head(m[2])+"/"+head(m[3]) : "/book/cc/"+slug+"/"+head(m[2]);
    return { book: "Шри Чайтанья-чаритамрита", lila: m[1]+"-лила", loc, to };
  }
  // Бхакти-расамрита-синдху (оригинальная нумерация раздел.волна.стих) —
  // академический рендер без deep-link: в Библиотеке её изложение хранится
  // как «Нектар преданности» (см. ниже), у которого иная, главами, разбивка.
  m = r.match(/^(?:БРС|Бхакти-расамрита-синдху)\s+(\d+)\.(\d+)(?:\.(\d+(?:[-–—]\d+)?))?$/);
  if (m) {
    const loc = m[3] ? m[1]+"."+m[2]+"."+m[3] : m[1]+"."+m[2];
    return { book: "Бхакти-расамрита-синдху", loc };
  }
  // Нектар преданности (Бхакти-расамрита-синдху в изложении Шрилы Прабхупады) —
  // плоская книга глав 1–51; deep-link в читалку: /book/brs/<глава>[/<стих>].
  m = r.match(/^(?:НП|Нектар преданности)\s+(\d+)(?:\.(\d+(?:[-–—]\d+)?))?$/);
  if (m) {
    const loc = m[2] ? "глава "+m[1]+", "+vw(m[2]) : "глава "+m[1];
    const to  = m[2] ? "/book/brs/"+m[1]+"/"+head(m[2]) : "/book/brs/"+m[1];
    return { book: "Нектар преданности", loc, to };
  }
  // Брахма-самхита (глава.стих) — deep-link в читалку
  m = r.match(/^Брахма-самхита\s+(\d+)\.(\d+(?:[-–—]\d+)?)$/);
  if (m) return { book: "Брахма-самхита", loc: "глава "+m[1]+", "+vw(m[2]), to: "/book/bs/"+m[1]+"/"+head(m[2]) };
  // Вишну-пурана (книга.глава.стих) — иерархический deep-link
  m = r.match(/^Вишну-пурана\s+(\d+)\.(\d+)\.(\d+(?:[-–—]\d+)?)$/);
  if (m) return { book: "Вишну-пурана", loc: "Книга "+m[1]+", глава "+m[2]+", "+vw(m[3]), to: "/book/vp/"+m[1]+"/"+m[2]+"/"+head(m[3]) };
  // Кришна-сандарбха (ануччхеда N) — deep-link (плоская книга, глава 1)
  m = r.match(/^Кришна-сандарбха\s+(\d+)$/);
  if (m) return { book: "Кришна-сандарбха", loc: "Ануччхеда " + m[1], to: "/book/ks/1/"+m[1] };
  m = r.match(/^Кришна-сандарбха\s+(.+)$/);
  if (m) return { book: "Кришна-сандарбха", loc: "Ануччхеда " + m[1].replace(/^ануч[.\s]*/i, "") };
  // Лагху-бхагаватамрита
  m = r.match(/^Лагху-бхагаватамрита\s+(.+)$/);
  if (m) return { book: "Лагху-бхагаватамрита", loc: m[1] };
  // Говинда-лиламрита (глава.стих) — deep-link; голый «Говинда-лиламрита» без номера остаётся академическим
  m = r.match(/^Говинда-лиламрита\s+(\d+)\.(\d+(?:[-–—]\d+)?)$/);
  if (m) return { book: "Говинда-лиламрита", loc: "глава "+m[1]+", "+vw(m[2]), to: "/book/gl/"+m[1]+"/"+head(m[2]) };
  m = r.match(/^Говинда-лиламрита(?:\s+(.+))?$/);
  if (m) return { book: "Говинда-лиламрита", loc: m[1] };
  // Гита-говинда
  m = r.match(/^Гита-говинда\s+(.+)$/);
  if (m) return { book: "Гита-говинда", loc: m[1] };
  // Упадешамрита (Нектар наставлений, work noi — одна глава из 11 стихов): deep-link
  m = r.match(/^Упадешамрита\s+(\d+(?:[-–—]\d+)?)$/);
  if (m) return { book: "Упадешамрита", loc: vw(m[1]), to: "/book/noi/1/"+head(m[1]) };
  // Универсальный academic-fallback: «Название X.Y.Z» → {book, loc} без deep-link.
  // Покрывает Вишну-пурану, Упадешамриту, Падма-пурану (с номером) и т.п.,
  // чтобы они рендерились академически, а не сырой строкой.
  m = r.match(/^(.+?)\s+(\d[\d.\s–—-]*\d|\d)$/);
  if (m) return { book: m[1].trim(), loc: m[2] };
  return { book: r0 };
}
// Совместимость: используется в одной точке для cite (вернёт строку с запятыми).
function expandCiteRef(ref: string): string {
  const p = expandRef(ref);
  const tail = [p.lila, p.loc].filter(Boolean).join(", ");
  return tail ? p.book + ", " + tail : p.book;
}
// Все санскритские/бенгальские термины подсвечиваются единым законом —
// см. ui/scripture.ts (TERMS + COMPOUNDS) и ui/Skt.tsx (renderTerms).
// ПКЛ-специфичный список составных терминов был промоутирован в COMPOUNDS,
// так что один и тот же словарь работает по всему приложению.
function renderSanskrit(text: string | null | undefined): ReactNode {
  return renderTerms(text);
}
// Инлайн-проза со ссылками на суб-табы: токен [[subId|подпись]] становится
// тихой ссылкой-кнопкой, переключающей суб-таб тем же обработчиком, что и чипы
// (с прокруткой к началу раздела). Остальной текст идёт через renderSanskrit.
function renderProse(raw: string, onSub?: (id: string) => void, onTab?: (id: string) => void): ReactNode {
  // ЗКН-Т002: вся проза карточки проходит закон текста. Единая точка — нарушение
  // невозможно, что бы ни лежало в БД. Цитаты (q.t) сюда НЕ попадают: они идут
  // через renderSanskrit напрямую — чужой голос не редактируется (ЗКН-БТ004).
  const text = cleanCardText(raw);
  if (!text) return null;
  if ((!onSub && !onTab) || text.indexOf("[[") === -1) return renderSanskrit(text);
  const out: ReactNode[] = [];
  const re = /\[\[(tab:)?([a-z0-9-]+)\|([^\]]+)\]\]/gi;
  let last = 0, k = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(<Fragment key={"t" + k}>{renderSanskrit(text.slice(last, m.index))}</Fragment>);
    const isTab = !!m[1], id = m[2], label = m[3];
    const go = isTab ? onTab : onSub;
    out.push(
      <button key={"l" + k} type="button" onClick={() => go?.(id)} style={{ background: "none", border: "none", padding: 0, margin: 0, font: "inherit", color: "inherit", cursor: "pointer", lineHeight: "inherit" }}>{renderSanskrit(label)}</button>
    );
    last = m.index + m[0].length; k++;
  }
  if (last < text.length) out.push(<Fragment key={"t" + k}>{renderSanskrit(text.slice(last))}</Fragment>);
  return out;
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
function SourceLink({ parts, onNavigate, size = 12.5 }: { parts: RefParts; onNavigate?: (href: string) => void; size?: number }) {
  const base: React.CSSProperties = { fontFamily: "var(--font-text)", fontSize: size, fontWeight: 400, letterSpacing: "-0.01em", color: "var(--color-label-2)", background: "none", border: "none", padding: 0, lineHeight: 1.4, textAlign: "left" };
  const linked = !!(parts.to && onNavigate);
  const hasTail = !!(parts.lila || parts.loc);
  // Запятые «прилипают» к концу своей части, чтобы при переносе они не
  // отрывались на пустую строку. Каждая часть — nowrap, перенос возможен
  // только между частями. Это даёт академический рендер вида:
  // «Чайтанья-чаритамрита, Мадхья-лила, 21.107 ›».
  const inner = (
    <span style={{ display: "inline-flex", flexWrap: "wrap", columnGap: 5, rowGap: 0, alignItems: "baseline" }}>
      <span style={{ whiteSpace: "nowrap" }}>{parts.book}{hasTail ? "," : ""}</span>
      {parts.lila && <span style={{ whiteSpace: "nowrap" }}>{parts.lila}{parts.loc ? "," : ""}</span>}
      {parts.loc && <span style={{ whiteSpace: "nowrap" }}>{parts.loc}</span>}
      {linked && <span aria-hidden style={{ opacity: 0.45, fontSize: size - 1 }}>›</span>}
    </span>
  );
  if (linked) return <button type="button" onClick={() => onNavigate!(parts.to!)} style={{ ...base, cursor: "pointer" }}>{inner}</button>;
  return <span style={base}>{inner}</span>;
}
// Единый стандарт атрибуции цитаты: «— Кто сказал» (ссылка на ПКЛ если есть
// byId) + ссылка-источник «где сказал». Имя книги/-лила/локатор каждая —
// nowrap, перенос только между ними. Размер 12.5/lineHeight 1.4. Когда есть
// deep-link в читалку (ШБ/БГ/ЧЧ) — добавляется «›».
function Attribution({ src, onOpen, onNavigate, marginTop = 12 }: { src: LfSource; onOpen: (id: string, type: string | null) => void; onNavigate?: (href: string) => void; marginTop?: number }) {
  if (!src.by && !src.ref) return null;
  const speaker = src.byId
    ? <button type="button" onClick={() => onOpen(src.byId!, "personality")} style={{ background: "none", border: "none", padding: 0, fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 500, color: "var(--color-label)", cursor: "pointer" }}>{src.by}</button>
    : <span style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 500, color: "var(--color-label-2)" }}>{src.by}</span>;
  const parts = src.ref ? expandRef(src.ref) : null;
  if (parts && src.to) parts.to = src.to;
  return (
    <div style={{ marginTop, fontFamily: "var(--font-text)", fontStyle: "normal" }}>
      {src.by && <div>— {speaker}</div>}
      {parts && <div style={{ marginTop: src.by ? 4 : 0 }}><SourceLink parts={parts} onNavigate={onNavigate} size={12.5} /></div>}
    </div>
  );
}
// Стандартный блок стиха/цитаты. ЗАКОН подсветки (551d47c): текст перевода — прямым
// UI-шрифтом var(--font-text), как перевод в BBT; санскритские/бенгальские ТЕРМИНЫ
// внутри подсвечиваются через renderSanskrit → .skt (Georgia-курсив) и выделяются на
// фоне русского. Весь блок Georgia-курсивом НЕ делаем — иначе перевод читается как
// сплошной санскрит и выделение терминов пропадает. Золотая граница = знак цитаты.
// Стандартный блок стиха/цитаты. Если есть transliteration (q.translit) — она
// идёт ПЕРВОЙ строкой ЦЕЛИКОМ шрифтом писания (var(--font-scripture), курсив):
// это санскрит/бенгали, и он весь выделяется единым законом, а не кусочной
// подсветкой. Перевод (q.t) — прямым UI-шрифтом, как в BBT; санскритские ТЕРМИНЫ
// внутри перевода подсвечиваются через renderSanskrit → .skt (Georgia-курсив).
// Золотая граница объединяет транслитерацию и перевод в один стих.
function QuoteBlock({ q, onOpen, onNavigate }: { q: LfQuote; onOpen: (id: string, type: string | null) => void; onNavigate?: (href: string) => void }) {
  return (
    <blockquote style={{ margin: "20px 0 0", padding: q.gold ? "14px 18px 14px 18px" : "2px 0 2px 18px", borderLeft: `3px solid ${GOLD}`, borderRadius: q.gold ? 12 : 0, background: q.gold ? "rgba(210,170,27,0.07)" : "transparent", whiteSpace: "pre-line" }}>
      {q.translit && (
        <div style={{ fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: "var(--text-body)", lineHeight: 1.5, letterSpacing: "0.01em", color: "var(--color-label-2)", marginBottom: 10 }}>
          {stripWrap(q.translit)}
        </div>
      )}
      <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-body)", lineHeight: 1.6, fontStyle: "normal", color: "var(--color-label)" }}>
        {renderSanskrit(stripWrap(q.t))}
      </div>
      <Attribution src={q} onOpen={onOpen} onNavigate={onNavigate} marginTop={12} />
    </blockquote>
  );
}
// === Лестница нисхождения (ПКЛ-модуль) ===
// Иерархия живых существ и форм Бога по мере проявления 64 трансцендентных
// качеств и по обители. На вершине — Кришна (Голока). Единый «позвоночник»
// нисхождения (золото вверху → серое внизу) кодирует убывание полноты качеств.
// Apple-quiet: тихие заливки карточек, золото только на вершине и в осях.
// Шрифт — var(--font-text); writ-курсив здесь не используется (не стихи).
function HierarchyDescent({ groups, footer, onOpen, onSub, onTab }: { groups: HierGroup[]; footer?: string; onOpen?: (id: string, type: string | null) => void; onSub?: (id: string) => void; onTab?: (id: string) => void }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const PAD = 30;       // отступ слева под ось + узлы
  const SX = 11.5;      // центр оси (позвоночника) от левого края контейнера
  // Цвет узла/коннектора по полноте качеств (таттве): золото = полнота, серое = крупица.
  const tonePct = (t: HierTier) => {
    if (t.apex) return 100;
    const c = (t.count ?? "").trim();
    if (!c) return 32;                 // брахмаджьоти — безличный аспект, вне счёта
    if (c.includes("+")) return 46;    // 50 + 5 — Шива
    const n = parseInt(c, 10);
    if (n >= 64) return 100;
    if (n >= 60) return 72;
    if (n >= 55) return 48;
    if (n >= 50) return 28;
    return 22;
  };
  const toneFor = (t: HierTier) => `color-mix(in srgb, ${GOLD} ${tonePct(t)}%, var(--color-label-3))`;
  // Процент трансцендентных качеств — по комментарию Шрилы Прабхупады к ШБ 1.3.28:
  // Кришна — 64 свойства (100%); вишну-таттва (все экспансии вплоть до аватар) —
  // до 93%; Господь Шива — ~84%; дживы — не более 78%. Брахмаджьоти — вне счёта.
  const pctFor = (t: HierTier): number | null => {
    if (t.apex) return 100;
    const c = (t.count ?? "").trim();
    if (!c) return null;               // брахмаджьоти
    if (c.includes("+")) return 84;    // 50 + 5 — Шива
    const n = parseInt(c, 10);
    if (n >= 64) return 100;           // Кришна
    if (n >= 60) return 93;            // вишну-таттва
    if (n >= 50) return 78;            // джива
    return null;
  };
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ position: "relative", paddingLeft: PAD }}>
        {/* Позвоночник нисхождения — единая ось от вершины вниз */}
        <div aria-hidden style={{ position: "absolute", left: SX - 0.75, top: 24, bottom: 10, width: 1.5, borderRadius: 1,
          background: `linear-gradient(180deg, ${GOLD} 0%, color-mix(in srgb, ${GOLD} 32%, var(--color-label-3)) 46%, var(--color-label-3) 100%)` }} />
        {groups.map((g, gi) => (
          <div key={gi}>
            {/* Заголовок обители (мира) — золотая засечка на оси */}
            <div style={{ position: "relative", marginTop: gi === 0 ? 0 : 22, marginBottom: 11 }}>
              <span aria-hidden style={{ position: "absolute", left: SX - PAD - 3, top: 1, width: 6, height: 6, borderRadius: "50%", background: GOLD, opacity: 0.55 }} />
              <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: GOLD }}>{g.realm}</div>
            </div>
            {g.tiers.map((tier, ti) => {
              const apex = !!tier.apex;
              const r = apex ? 8 : 4;                 // радиус узла
              const dotTop = apex ? 21 : 23;          // выравнивание узла к строке обители
              const multi = !!tier.count && !/^\d+$/.test(tier.count); // «50 + 5» и т.п.
              const numSize = apex ? 28 : multi ? 19 : 22;
              const pct = pctFor(tier);
              const notes = (Array.isArray(tier.note) ? tier.note : tier.note ? [tier.note] : []).filter(Boolean) as string[];
              const rowKey = g.realm + "/" + tier.abode;
              const hasItems = !!(tier.items && tier.items.length);
              const linkable = !!tier.ref && !!onOpen;
              const isOpen = !!open[rowKey];
              const interactive = linkable || (hasItems && !!onOpen);
              const onHeader = linkable ? () => onOpen!(tier.ref!, null) : hasItems ? () => setOpen((o) => ({ ...o, [rowKey]: !o[rowKey] })) : undefined;
              return (
                <div key={ti} style={{ position: "relative", marginTop: ti === 0 ? 0 : 9 }}>
                  {/* горизонтальный «отвод» от оси к карточке */}
                  <span aria-hidden style={{ position: "absolute", left: SX - PAD, top: dotTop + r - 0.75, width: PAD - SX - 4, height: 1.5, background: toneFor(tier), opacity: apex ? 0.9 : 0.5 }} />
                  {/* узел на оси */}
                  {apex ? (
                    <span aria-hidden style={{ position: "absolute", left: SX - PAD - r, top: dotTop, width: r * 2, height: r * 2, borderRadius: "50%", background: GOLD, boxShadow: `0 0 0 5px color-mix(in srgb, ${GOLD} 14%, transparent)` }} />
                  ) : (
                    <span aria-hidden style={{ position: "absolute", left: SX - PAD - r, top: dotTop, width: r * 2, height: r * 2, borderRadius: "50%", background: toneFor(tier), border: "2px solid var(--color-bg)" }} />
                  )}
                  {/* карточка уровня */}
                  <div style={{ position: "relative", padding: "15px 16px 16px", borderRadius: 16,
                    border: apex ? `0.5px solid color-mix(in srgb, ${GOLD} 30%, var(--color-hairline))` : "0.5px solid var(--color-hairline)",
                    background: apex ? `color-mix(in srgb, ${GOLD} 4%, var(--color-bg-2))` : "var(--color-bg-2)",
                    boxShadow: apex ? "0 1px 2px rgba(0,0,0,0.05)" : "none" }}>
                    {/* заголовок (эйбрау + название + спутники) — кликабельный: переход на ПКЛ либо раскрытие списка */}
                    {(() => {
                      const inner = (
                        <>
                          <span style={{ flex: 1, minWidth: 0 }}>
                            {tier.eyebrow && <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.7px", textTransform: "uppercase", color: GOLD, marginBottom: 7 }}>{tier.eyebrow}</span>}
                            <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: "var(--text-body)", fontWeight: 600, color: "var(--color-label)", lineHeight: 1.2, letterSpacing: "-0.015em" }}>{tier.abode}</span>
                            {tier.beings && <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 500, color: apex ? GOLD : "var(--color-label-2)", marginTop: 5, lineHeight: 1.4 }}>{tier.beings}</span>}
                          </span>
                          {interactive && <span aria-hidden style={{ flexShrink: 0, alignSelf: "center", color: "var(--color-label-3)", fontSize: "var(--text-title3)", lineHeight: 1, transition: "transform .2s ease", transform: hasItems && isOpen ? "rotate(90deg)" : "none" }}>›</span>}
                        </>
                      );
                      return interactive
                        ? <button type="button" onClick={onHeader} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>{inner}</button>
                        : <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>{inner}</div>;
                    })()}
                    {/* описание — на всю ширину карточки, абзацами */}
                    {notes.length > 0 && (
                      <div style={{ marginTop: 13 }}>
                        {notes.map((para, pi) => (
                          <p key={pi} style={{ margin: pi === 0 ? 0 : "10px 0 0", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", color: "var(--color-label-2)", lineHeight: 1.5 }}>{renderProse(para, onSub, onTab)}</p>
                        ))}
                      </div>
                    )}
                    {/* раскрывающийся список личностей — выбрать и перейти на ПКЛ */}
                    {hasItems && isOpen && (
                      <div style={{ marginTop: 13, paddingTop: 4, borderTop: "0.5px solid var(--color-hairline)", animation: "lf-in .2s ease both" }}>
                        {tier.items!.map((it) => (
                          <button key={it.ref} type="button" onClick={() => onOpen?.(it.ref, null)}
                            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", background: "none", border: "none", borderBottom: "0.5px solid var(--color-hairline)", padding: "10px 0", textAlign: "left", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: 500, color: "var(--color-label)", lineHeight: 1.25 }}>{it.name}</span>
                              {it.desc && <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: "var(--text-caption)", fontWeight: 400, color: "var(--color-label-2)", lineHeight: 1.35, marginTop: 2 }}>{it.desc}</span>}
                            </span>
                            <span aria-hidden style={{ flexShrink: 0, color: "var(--color-label-3)", fontSize: "var(--text-body)", lineHeight: 1 }}>›</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {/* метрика: явление на Земле + число качеств и процент */}
                    {(tier.count || tier.countNote || tier.appeared) && (
                      <div style={{ marginTop: 16, paddingTop: 13, borderTop: "0.5px solid var(--color-hairline)" }}>
                        {tier.appeared && <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 400, color: "var(--color-label-2)", lineHeight: 1.45, marginBottom: (tier.count || tier.countNote) ? 13 : 0, paddingBottom: (tier.count || tier.countNote) ? 13 : 0, borderBottom: (tier.count || tier.countNote) ? "0.5px solid var(--color-hairline)" : "none" }}>{renderProse(tier.appeared, onSub, onTab)}</div>}
                        {tier.count && (
                          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                            <span style={{ fontFamily: "var(--font-text)", fontVariantNumeric: "tabular-nums", fontSize: numSize, fontWeight: 600, color: apex ? GOLD : "var(--color-label)", lineHeight: 1, letterSpacing: "-0.02em" }}>{tier.count}</span>
                            {pct != null && <span style={{ fontFamily: "var(--font-text)", fontVariantNumeric: "tabular-nums", fontSize: "var(--text-footnote)", fontWeight: 600, color: toneFor(tier), lineHeight: 1 }}>{pct}%</span>}
                          </div>
                        )}
                        {tier.countNote && <div style={{ marginTop: tier.count ? 6 : 0, fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 400, color: "var(--color-label-2)", lineHeight: 1.4 }}>{tier.countNote}</div>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        {footer && (
          <div style={{ marginTop: 22, paddingTop: 16, borderTop: "0.5px solid var(--color-hairline)", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: 400, color: "var(--color-label)", lineHeight: 1.55, letterSpacing: "-0.003em" }}>{renderProse(footer, onSub, onTab)}</div>
        )}
      </div>
    </div>
  );
}

function FormCatalog({ groups, onOpen, onNavigate, onSub, onTab }: { groups: LfCatGroup[]; onOpen: (id: string, type: string | null) => void; onNavigate?: (href: string) => void; onSub?: (id: string) => void; onTab?: (id: string) => void }) {
  return (
    <div style={{ marginTop: 20 }}>
      {groups.map((g, gi) => (
        <div key={gi} style={{ marginTop: gi === 0 ? 0 : 30 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: GOLD }}>{g.group}</span>
            {g.items && g.items.length > 0 && <span style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 600, color: "var(--color-label-3)", fontVariantNumeric: "tabular-nums" }}>{g.items.length}</span>}
          </div>
          {g.gloss && <div style={{ marginTop: 4, fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 400, color: "var(--color-label-2)", lineHeight: 1.4 }}>{renderProse(g.gloss, onSub, onTab)}</div>}
          {g.note && (Array.isArray(g.note) ? g.note : [g.note]).filter(Boolean).map((para, pi) => (
            <p key={pi} style={{ margin: pi === 0 ? "12px 0 0" : "11px 0 0", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", color: "var(--color-label)", lineHeight: 1.55 }}>{renderProse(para, onSub, onTab)}</p>
          ))}
          {g.items && g.items.length > 0 && (
            <div style={{ marginTop: 12, borderTop: "0.5px solid var(--color-hairline)" }}>
              {g.items.map((it, ii) => {
                const clickable = !!it.ref;
                const inner = (
                  <>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: 600, color: "var(--color-label)", lineHeight: 1.3, letterSpacing: "-0.01em" }}>{it.name}</span>
                      {it.desc && <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 400, color: "var(--color-label-2)", lineHeight: 1.4, marginTop: 2 }}>{renderProse(it.desc, onSub, onTab)}</span>}
                      {it.tags && it.tags.length > 0 && (
                        <span style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 7 }}>
                          {it.tags.map((tag, ti) => (
                            <span key={ti} style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 600, letterSpacing: "0.2px", color: "var(--color-label-2)", background: "color-mix(in srgb, var(--color-label) 7%, transparent)", padding: "2px 8px", borderRadius: 999, lineHeight: 1.35, whiteSpace: "nowrap" }}>{tag}</span>
                          ))}
                        </span>
                      )}
                    </span>
                    {clickable && <span aria-hidden style={{ flexShrink: 0, alignSelf: "center", color: "var(--color-label-3)", fontSize: "var(--text-body)", lineHeight: 1 }}>›</span>}
                  </>
                );
                return clickable
                  ? <button key={ii} type="button" onClick={() => onOpen(it.ref!, null)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "11px 0", borderBottom: "0.5px solid var(--color-hairline)", textAlign: "left", background: "none", border: "none", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>{inner}</button>
                  : <div key={ii} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "11px 0", borderBottom: "0.5px solid var(--color-hairline)" }}>{inner}</div>;
              })}
            </div>
          )}
          {g.src && <Attribution src={g.src} onOpen={onOpen} onNavigate={onNavigate} marginTop={10} />}
        </div>
      ))}
    </div>
  );
}

function LongformArticle({ sections, onOpen, onNavigate, onSub, onTab }: { sections: LfSection[]; onOpen: (id: string, type: string | null) => void; onNavigate?: (href: string) => void; onSub?: (id: string) => void; onTab?: (id: string) => void }) {
  return (
    <div>
      {sections.map((s, i) => (
        <section key={i} style={{ marginTop: i === 0 ? 26 : 34 }}>
          {s.h && <Eyebrow>{cleanCardText(s.h)}</Eyebrow>}
          {(s.p ?? []).map((para, j) => (
            <p key={j} style={{ margin: j === 0 ? 0 : "13px 0 0", fontFamily: "var(--font-text)", fontSize: "var(--text-callout)", lineHeight: 1.65, color: "var(--color-label)" }}>{renderProse(para, onSub, onTab)}</p>
          ))}
          {s.hierarchy && s.hierarchy.length > 0 && <HierarchyDescent groups={s.hierarchy} footer={s.hierarchyFooter} onOpen={onOpen} onSub={onSub} onTab={onTab} />}
          {s.catalog && s.catalog.length > 0 && <FormCatalog groups={s.catalog} onOpen={onOpen} onNavigate={onNavigate} onSub={onSub} onTab={onTab} />}
          {(s.list ?? []).length > 0 && (() => {
            let n = 0;
            return (
              <div style={{ marginTop: 18 }}>
                {(s.list ?? []).map((grp, gi) => (
                  <div key={gi} style={{ marginTop: gi === 0 ? 0 : 22 }}>
                    {grp.label && (
                      <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLD, marginBottom: 9 }}>{grp.label}</div>
                    )}
                    {grp.items.map((it) => {
                      n += 1;
                      return (
                        <div key={n} style={{ display: "flex", gap: 12, alignItems: "baseline", padding: "4px 0" }}>
                          <span style={{ flexShrink: 0, minWidth: 22, textAlign: "right", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 700, color: GOLD, fontVariantNumeric: "tabular-nums", lineHeight: 1.5 }}>{n}</span>
                          <span style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-callout)", lineHeight: 1.5, color: "var(--color-label)" }}>{renderSanskrit(it)}</span>
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
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6, marginTop: 16, paddingLeft: s.hierarchy && s.hierarchy.length > 0 ? 30 : 0 }}>
              {(s.cite ?? []).map((c, k) => {
                const parts = expandRef(c.ref);
                if (c.to) parts.to = c.to;
                return <SourceLink key={k} parts={parts} onNavigate={onNavigate} size={12.5} />;
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
              background: "none", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: 600, color: "var(--color-gold-deep)", cursor: "pointer" }}>
            Ещё {more}
          </button>
        )}
      </div>
    </section>
  );
}

/* Кросс-силос фасеты: вид связи → подпись и маршрут открытия силос-элемента. */
const KIND_LABEL: Record<string, string> = {
  dhama: "Дхама",
  tirtha: "Святые места",
  dish: "Любимые блюда",
  kirtan: "Киртаны",
  bhajan: "Бхаджаны",
  work: "Читать",
  temple: "Храмы",
  festival: "Праздники",
  gallery: "Галерея",
  video: "Видео",
};
const KIND_ORDER = ["work", "dhama", "tirtha", "dish", "kirtan", "bhajan", "temple", "festival", "gallery", "video"];

/* ═══ ЗКН-Н014 · МОСТ ДОСЬЕ ↔ БОГАТСТВА (синхронизация) ═══
 * Волны и группы живут в ДВУХ местах: в досье Гауранги/Кришны (табы «Парикары»)
 * и в витрине Богатства → Личности. Раньше они были не связаны: из досье нельзя
 * было попасть в список личностей этой волны.
 *
 * Слаги отличались (`volna-2` в досье vs `2-volna` в витрине) — мост переводит.
 */
const BRIDGE_WAVE: Record<string, string> = {
  "volna-1": "/dhana/gauranga-lila/1-volna",
  "volna-2": "/dhana/gauranga-lila/2-volna",
  "volna-3": "/dhana/gauranga-lila/3-volna",
  "volna-4": "/dhana/gauranga-lila/4-volna",
  "volna-5": "/dhana/gauranga-lila/5-volna",
  "volna-iskcon": "/dhana/gauranga-lila/bespretsedentnaya",
  "volny": "/dhana/gauranga-lila",
};
const BRIDGE_RASA: Record<string, string> = {
  shanta: "/dhana/krishna-lila/shanta",
  dasya: "/dhana/krishna-lila/dasya",
  sakhya: "/dhana/krishna-lila/sakhya",
  vatsalya: "/dhana/krishna-lila/vatsalya",
  madhurya: "/dhana/krishna-lila/madhurya",
  "pyat-ras": "/dhana/krishna-lila",
};

/** Ссылка «Смотреть всех» из суб-таба досье в витрину Личностей. */
function bridgeHref(entityId: string, tabId: string, subId: string): string | null {
  if (tabId !== "parikary" && tabId !== "parikara") return null;
  if (entityId === "chaitanya") return BRIDGE_WAVE[subId] ?? null;
  if (entityId === "krishna") return BRIDGE_RASA[subId] ?? null;
  return null;
}

/** Кнопка-мост под содержимым суб-таба. */
function BridgeLink({ href, label, onNavigate }: { href: string; label: string; onNavigate?: (h: string) => void }) {
  return (
    <button type="button" onClick={() => onNavigate?.(href)}
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        width: "100%", marginTop: 18, padding: "13px 15px", borderRadius: "var(--radius-card, 14px)",
        background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)", cursor: "pointer",
        fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: 600,
        color: "var(--color-label)", textAlign: "left", WebkitTapHighlightColor: "transparent" }}>
      <span>{label}</span>
      <span aria-hidden style={{ color: "var(--color-gold)", fontWeight: 400 }}>→</span>
    </button>
  );
}

function kindHref(kind: string, ref: string): string | null {
  switch (kind) {
    case "dish": return "/prasadam/recipe/" + ref;
    case "dhama": return "/dhama/" + ref;
    case "tirtha": return "/dhama/" + ref;   // ref = "<dhamaId>/<tirthaId>"
    case "kirtan": return "/kirtan/" + ref;  // ref = слаг исполнителя
    case "bhajan": return ref;               // ref = полный слаг бхаджана (/ru/bhajans/...)
    case "work":   return "/book/" + ref;    // ref = id произведения (bg, sb, cc…) → читалка
    default: return null; // остальные виды получат маршруты по мере ввода рефов
  }
}

function LinkSection({ kind, items, onNavigate }: { kind: string; items: LinkItem[]; onNavigate?: (href: string) => void }) {
  const [open, setOpen] = useState(false);
  const CAP = 24;
  const shown = open ? items : items.slice(0, CAP);
  const more = items.length - shown.length;
  return (
    <section style={{ marginTop: 26 }}>
      <Eyebrow count={items.length}>{KIND_LABEL[kind] ?? kind}</Eyebrow>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {shown.map((it) => {
          const href = kindHref(it.kind, it.ref);
          const go = href && onNavigate ? () => onNavigate(href) : undefined;
          return <Chip key={it.kind + it.ref} label={it.title || it.ref} onClick={go} />;
        })}
        {more > 0 && (
          <button type="button" onClick={() => setOpen(true)}
            style={{ display: "inline-flex", alignItems: "center", padding: "8px 13px", borderRadius: 999, border: "none",
              background: "none", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: 600, color: "var(--color-gold-deep)", cursor: "pointer" }}>
            Ещё {more}
          </button>
        )}
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
            <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-callout)", fontWeight: 600, color: "var(--color-label)" }}>{c.title}</div>
            {c.subtitle && <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", color: "var(--color-label-2)", marginTop: 2, lineHeight: 1.4 }}>{c.subtitle}</div>}
          </div>
          <span aria-hidden style={{ color: "var(--color-label-3)", fontSize: "var(--text-title2)", lineHeight: 1 }}>›</span>
        </button>
      ))}
    </div>
  );
}

const LF_ANIM = "@keyframes lf-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}";

/* Подсказка прокрутки: мягкое затухание у того края, за которым есть ещё контент. */
function useEdgeFades(ref: React.RefObject<HTMLDivElement>, dep: unknown) {
  const [edges, setEdges] = useState<{ l: boolean; r: boolean }>({ l: false, r: false });
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const update = () => {
      const max = c.scrollWidth - c.clientWidth;
      setEdges({ l: c.scrollLeft > 6, r: c.scrollLeft < max - 6 });
    };
    update();
    const raf = requestAnimationFrame(update);
    c.addEventListener("scroll", update, { passive: true });
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") { ro = new ResizeObserver(update); ro.observe(c); }
    window.addEventListener("resize", update);
    return () => { cancelAnimationFrame(raf); c.removeEventListener("scroll", update); if (ro) ro.disconnect(); window.removeEventListener("resize", update); };
  }, [ref, dep]);
  return edges;
}

function EdgeFade({ side, show }: { side: "left" | "right"; show: boolean }) {
  const isLeft = side === "left";
  const style: React.CSSProperties = { position: "absolute", top: 0, bottom: 0, width: 30, pointerEvents: "none", zIndex: 1, background: `linear-gradient(to ${isLeft ? "right" : "left"}, var(--color-bg), transparent)`, opacity: show ? 1 : 0, transition: "opacity .2s ease" };
  if (isLeft) style.left = 0; else style.right = 0;
  return <span aria-hidden style={style} />;
}

/* Навигация по разделу — как нижний пейджер в читалке Apple / Apple Developer
   Docs (iOS 26): без заливки, без рамок и без капсул. Только шеврон на внешнем
   крае + крошечный капс-кикер над заглавием раздела. Когда «Назад» или «Далее»
   нет — половина остаётся воздухом, а не висящим прямоугольником. */
function ReaderPager({ prevLabel, nextLabel, onPrev, onNext }: { prevLabel?: string | null; nextLabel?: string | null; onPrev?: (() => void) | null; onNext?: (() => void) | null }) {
  if (!onPrev && !onNext) return null;
  const cell: React.CSSProperties = { flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 9, padding: "2px 0", background: "none", border: "none", cursor: "pointer", color: "inherit", font: "inherit", WebkitTapHighlightColor: "transparent" };
  const chev: React.CSSProperties = { flexShrink: 0, display: "inline-flex", alignItems: "center", color: "var(--color-label)" };
  const col = (align: "flex-start" | "flex-end"): React.CSSProperties => ({ display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 0, alignItems: align });
  const kicker: React.CSSProperties = { fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--color-label-3)" };
  const title: React.CSSProperties = { maxWidth: "100%", fontFamily: "var(--font-text)", fontSize: "var(--text-callout)", fontWeight: 600, letterSpacing: "-0.01em", color: "var(--color-label)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.25 };
  return (
    <nav aria-label="Листать раздел" style={{ display: "flex", gap: 16, marginTop: 30, paddingTop: 17, borderTop: "0.5px solid var(--color-hairline)" }}>
      {onPrev ? (
        <button type="button" onClick={onPrev} style={cell}>
          <span aria-hidden style={chev}><BackIcon size={18} /></span>
          <span style={col("flex-start")}>
            <span style={kicker}>Назад</span>
            <span style={title}>{prevLabel}</span>
          </span>
        </button>
      ) : <span style={{ flex: 1 }} aria-hidden />}
      {onNext ? (
        <button type="button" onClick={onNext} style={cell}>
          <span style={col("flex-end")}>
            <span style={kicker}>Далее</span>
            <span style={title}>{nextLabel}</span>
          </span>
          <span aria-hidden style={{ ...chev, transform: "scaleX(-1)" }}><BackIcon size={18} /></span>
        </button>
      ) : <span style={{ flex: 1 }} aria-hidden />}
    </nav>
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
  const fades = useEdgeFades(containerRef, tabs.length + ":" + active);
  return (
    <nav aria-label="Разделы личности" style={{ position: "sticky", top: stickyTop, zIndex: 9, marginInline: -16, marginTop: 14, background: "color-mix(in srgb, var(--color-bg) 84%, transparent)", backdropFilter: "blur(40px) saturate(180%)", WebkitBackdropFilter: "blur(40px) saturate(180%)", borderBottom: "0.5px solid var(--color-hairline)" }}>
      <div ref={containerRef} style={{ display: "flex", alignItems: "center", overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch", padding: "0 6px" }}>
        {tabs.map((t) => {
          const on = t.id === active;
          return (
            <button key={t.id} ref={(el) => { tabRefs.current[t.id] = el; }} type="button" onClick={() => onChange(t.id)}
              style={{ position: "relative", flexShrink: 0, padding: "13px 14px", fontSize: "var(--text-subhead)", fontFamily: "var(--font-text)", background: "none", border: "none", cursor: "pointer", color: on ? "var(--color-label)" : "var(--color-label-3)", fontWeight: on ? 700 : 500, letterSpacing: on ? "-0.01em" : 0, transition: "color .15s", WebkitTapHighlightColor: "transparent" }}>
              {t.label}
              {on && <span aria-hidden style={{ position: "absolute", insetInline: 10, bottom: 0, height: 2, borderRadius: 999, background: GOLD }} />}
            </button>
          );
        })}
      </div>
      <EdgeFade side="left" show={fades.l} />
      <EdgeFade side="right" show={fades.r} />
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
            <img src={COVER_FALLBACK} alt="" loading="lazy" style={{ height: 34, width: 34, flexShrink: 0, borderRadius: "50%", objectFit: "cover", background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)" }} />
            <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: 600, color: "var(--color-label)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.name_ru || it.id}</span>
            <span aria-hidden style={{ color: "var(--color-label-3)", fontSize: "var(--text-body)", flexShrink: 0 }}>›</span>
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
  const fades = useEdgeFades(containerRef, items.length + ":" + active);
  return (
    <nav aria-label="Подразделы" style={{ position: "sticky", top: stickyTop, zIndex: 8, marginInline: -16, marginTop: 14, background: "color-mix(in srgb, var(--color-bg) 84%, transparent)", backdropFilter: "blur(40px) saturate(180%)", WebkitBackdropFilter: "blur(40px) saturate(180%)" }}>
      <EdgeFade side="left" show={fades.l} />
      <EdgeFade side="right" show={fades.r} />
      <div ref={containerRef} style={{ display: "flex", gap: 8, alignItems: "center", overflowX: "auto", padding: "10px 16px", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
        {items.map((it) => {
          const on = it.id === active;
          return (
            <button key={it.id} ref={(el) => { itemRefs.current[it.id] = el; }} type="button" onClick={() => onChange(it.id)}
              style={{ flexShrink: 0, padding: "7px 14px", borderRadius: 999, border: on ? "0.5px solid transparent" : "0.5px solid var(--color-hairline)", cursor: "pointer", fontSize: "var(--text-footnote)", fontFamily: "var(--font-text)", fontWeight: 600, whiteSpace: "nowrap", background: on ? "var(--color-label)" : "var(--color-bg-2)", color: on ? "var(--color-bg)" : "var(--color-label-2)", transition: "background .18s, color .18s", WebkitTapHighlightColor: "transparent" }}>
              {it.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function RealmSegment({ realm, onChange, stickyTop = 96 }: { realm: "material" | "spiritual"; onChange: (v: "material" | "spiritual") => void; stickyTop?: number }) {
  const opts: { id: "material" | "spiritual"; label: string }[] = [
    { id: "material",  label: "Материальный мир" },
    { id: "spiritual", label: "Духовный мир" },
  ];
  return (
    <nav aria-label="Аспект бытия Господа" style={{ position: "sticky", top: stickyTop, zIndex: 9, marginInline: -16, marginTop: 14, padding: "10px 16px 0", background: "color-mix(in srgb, var(--color-bg) 84%, transparent)", backdropFilter: "blur(40px) saturate(180%)", WebkitBackdropFilter: "blur(40px) saturate(180%)" }}>
      <div role="tablist" style={{ display: "flex", padding: 3, borderRadius: 12, background: "var(--color-fill-1)" }}>
        {opts.map((o) => {
          const on = o.id === realm;
          return (
            <button key={o.id} role="tab" aria-selected={on} type="button" onClick={() => onChange(o.id)}
              style={{ flex: 1, padding: "10px 14px", borderRadius: 9, border: "none", cursor: "pointer", fontSize: "var(--text-subhead)", fontFamily: "var(--font-text)", fontWeight: 600, letterSpacing: "-0.01em", whiteSpace: "nowrap", background: on ? "var(--color-bg)" : "transparent", color: on ? "var(--color-label)" : "var(--color-label-2)", boxShadow: on ? "0 1.5px 4px rgba(0,0,0,0.10), 0 0 0 0.5px color-mix(in srgb, var(--color-label) 5%, transparent)" : "none", transition: "background .22s ease, color .18s ease, box-shadow .22s ease", WebkitTapHighlightColor: "transparent" }}>
              {o.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* TabHeader — контекстный заголовок таба в стиле «Библиотека / Книги».
   На каждом разделе ПКЛ (Таттва, Нама, Рупа, Гуна, …) показывает что это
   за раздел — kicker (золотом), крупный title и короткий lead. */
function TabHeader({ tab, flush }: { tab: { kicker?: string; title?: string; lead?: string; label: string }; flush?: boolean }) {
  if (!tab.kicker && !tab.title && !tab.lead) return null;
  return (
    <header style={{ marginTop: flush ? 0 : 18, marginBottom: 2 }}>
      {tab.kicker && (
        <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLD }}>
          {tab.kicker}
        </div>
      )}
      {(tab.title || !tab.kicker) && (
        <h1 style={{ margin: "4px 0 0", fontFamily: "var(--font-display)", fontSize: "var(--text-title1)", fontWeight: 800, letterSpacing: "-0.4px", color: "var(--color-label)" }}>
          {tab.title || tab.label}
        </h1>
      )}
      {tab.lead && (
        <p style={{ margin: "8px 0 0", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", color: "var(--color-label-2)", lineHeight: 1.45 }}>
          {tab.lead}
        </p>
      )}
    </header>
  );
}

export default function EntityPage({ id, onBack, onOpen, onNavigate, onOpenCollection, embedded }: { id: string; onBack: () => void; onOpen: (id: string, type: string | null) => void; onNavigate?: (href: string) => void; onOpenCollection?: (key: string) => void; embedded?: boolean }) {
  const { openCardMenu } = useCardActions();
  const [data, setData] = useState<EntityDetail | null>(null);
  const [error, setError] = useState(false);
  const [centers, setCenters] = useState<CenterHit[]>([]);
  const [tab, setTab] = useState<string>("");
  const [sub, setSub] = useState<string>("");
  const [realm, setRealm] = useState<"material" | "spiritual">("material");
  // Якоря для скролла к верху раздела при смене realm-сегмента/подтаба.
  const realmAnchorRef = useRef<HTMLDivElement>(null);
  const subAnchorRef = useRef<HTMLDivElement>(null);
  const tabContentRef = useRef<HTMLDivElement>(null);
  const scrollToAnchor = (ref: React.RefObject<HTMLDivElement>, stickyTop: number) => {
    // Контент крутится во ВНУТРЕННЕМ <main overflow-y:auto>, а не в окне —
    // window.scrollTo по нему не работает. Поэтому ищем ближайшего
    // скроллящегося предка якоря и листаем именно его. Двойной rAF — ждём
    // коммита React и раскладки нового (часто более короткого) контента, иначе
    // позицию клампит при сжатии. Прыжок мгновенный: раздел открывается
    // с начала экрана, ровно под липкими вкладками.
    const run = () => {
      const el = ref.current;
      if (!el) return;
      let sc: HTMLElement | null = el.parentElement;
      while (sc) {
        const oy = getComputedStyle(sc).overflowY;
        if ((oy === "auto" || oy === "scroll" || oy === "overlay") && sc.scrollHeight > sc.clientHeight) break;
        sc = sc.parentElement;
      }
      if (sc) {
        const top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - stickyTop + 1;
        sc.scrollTo({ top: Math.max(0, top), behavior: "auto" });
      } else {
        const top = el.getBoundingClientRect().top + window.pageYOffset - stickyTop + 1;
        window.scrollTo({ top: Math.max(0, top), behavior: "auto" });
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(run));
  };
  const handleRealmChange = (v: "material" | "spiritual") => {
    setRealm(v);
    scrollToAnchor(realmAnchorRef, embedded ? 46 : 96);
  };
  const handleSubChange = (v: string) => {
    setSub(v);
    // Подтабы липнут под realm-сегментом — высоту учитываем в stickyTop.
    scrollToAnchor(subAnchorRef, embedded ? (hasRealmSplit ? 100 : 46) : (hasRealmSplit ? 150 : 96));
  };
  const goToTab = (v: string) => {
    setTab(v);
    scrollToAnchor(tabContentRef, embedded ? 8 : 60);
  };
  // Хеш-под-таб ждёт применения после установки tab (см. эффекты ниже).
  const pendingSubFromHash = useRef<string | null>(null);
  // Deep-link: захватываем исходный хеш ДО того, как эффект-писатель его затрёт.
  // Без этого write-эффект на маунте пишет #<defaultTab> и read-эффект (ждущий
  // данных) читает уже затёртый хеш — ссылка вида /#avatara/ierarhiya не открывается.
  const initialHashRef = useRef(typeof window !== "undefined" ? (window.location.hash || "") : "");
  const initialPathRef = useRef(typeof window !== "undefined" ? (window.location.pathname || "") : "");
  const hashConsumedRef = useRef(false);

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
  const allSubs = activeTabObj?.subtabs ?? [];
  const hasRealmSplit = allSubs.some((st) => st.realm);
  const visibleSubs = hasRealmSplit ? allSubs.filter((st) => !st.realm || st.realm === realm) : allSubs;
  // Контекст-меню текущей темы ПКЛ (как у книг/глав): ссылка/QR/PDF/заметка/избранное
  // по ТЕКУЩЕМУ месту — вся Личность (/krishna) или конкретная тема (/krishna/<таб>/<подтаб>).
  const topicIsDefault = tab === (dossier?.tabs?.[0]?.id ?? "") && (sub === (visibleSubs[0]?.id ?? "") || !sub);
  const topicPath = topicIsDefault
    ? "/" + id
    : sub ? `/${id}/${encodeURIComponent(tab)}/${encodeURIComponent(sub)}` : `/${id}/${encodeURIComponent(tab)}`;
  const topicUrl = "https://gaurangers.com" + topicPath;
  const topicSubObj = visibleSubs.find((st) => st.id === sub);
  const topicTabLabel = activeTabObj?.title || activeTabObj?.label || "";
  const topicSubLabel = topicSubObj?.label || "";
  const topicTitle = topicIsDefault ? (data?.name_ru || id) : (topicSubLabel || topicTabLabel || data?.name_ru || id);
  const topicSubtitle = topicIsDefault
    ? (data?.note || data?.name_iast || undefined)
    : `${data?.name_ru || id}${topicTabLabel && topicSubLabel ? " · " + topicTabLabel : ""}`;
  const topicFavKey = topicIsDefault ? `entity:${id}` : `entity:${id}:${tab}/${sub}`;
  const topicCtx: CardCtx = {
    type: "entity", id, title: topicTitle, subtitle: topicSubtitle, url: topicUrl,
    context: `ПКЛ · ${data?.name_ru || id} · ${topicPath}`,
    pdfExtra: topicIsDefault ? undefined : { tab, sub },
  };
  const subItems = visibleSubs.map((st) => ({ id: st.id, label: st.label }));
  const activeSub = visibleSubs.find((st) => st.id === sub) ?? visibleSubs[0];
  const subSections = activeSub?.sections ?? [];
  const subRails = activeSub?.rails ?? [];
  const subCards = activeSub?.cards ?? [];
  // Линейная навигация: следующий/предыдущий подтаб, затем переход на соседний таб.
  const tabIdx = dossierTabs.findIndex((t) => t.id === tab);
  const subIdx = visibleSubs.findIndex((st) => st.id === (activeSub?.id ?? sub));
  const nextSub = subIdx > -1 ? visibleSubs[subIdx + 1] : undefined;
  const nextTabObj = tabIdx > -1 ? dossierTabs[tabIdx + 1] : undefined;
  const prevSub = subIdx > 0 ? visibleSubs[subIdx - 1] : undefined;
  const prevTabObj = tabIdx > 0 ? dossierTabs[tabIdx - 1] : undefined;
  const pagerNext = nextSub ? { on: true, label: nextSub.label, go: () => handleSubChange(nextSub.id) }
    : nextTabObj ? { on: true, label: nextTabObj.label, go: () => goToTab(nextTabObj.id) }
    : { on: false, label: "", go: () => {} };
  const pagerPrev = prevSub ? { on: true, label: prevSub.label, go: () => handleSubChange(prevSub.id) }
    : prevTabObj ? { on: true, label: prevTabObj.label, go: () => goToTab(prevTabObj.id) }
    : { on: false, label: "", go: () => {} };

  // тождество Гауранга Лила ↔ Кришна Лила одной строкой (для ВКЛ)
  const idRel = [
    ...(data?.out ?? []).map((r) => ({ r, dir: "out" as const })),
    ...(data?.in ?? []).map((r) => ({ r, dir: "in" as const })),
  ].find((x) => x.r.relation === "gauranga-lila-identity" && x.r.id);
  const identity = idRel ? (idRel.dir === "out" ? `В Кришна Лиле — ${idRel.r.name_ru || idRel.r.id}` : `В Гауранга Лиле — ${idRel.r.name_ru || idRel.r.id}`) : null;
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
    // Классификация ЛИЛА · ПОДКАТЕГОРИЯ (напр. «Гауранга Лила · I волна») — приоритетна для личностей.
    const LILA_LBL: Record<string, string> = { "lila-gauranga": "Гауранга Лила", "lila-krishna": "Кришна Лила", "lila-bhagavatam": "Шримад Бхагаватам", "lila-gita": "Бхагавад Гита", "lila-other": "Другие" };
    const SUB_LBL: Record<string, string> = { "wave-1": "I волна", "wave-2": "II волна", "wave-3": "III волна", "wave-4": "IV волна", "wave-5": "V волна", "wave-iskcon": "ИСККОН", "wave-sampradaya": "Ачарьи сампрадай", "rasa:shanta": "Шанта", "rasa:dasya": "Дасья", "rasa:sakhya": "Сакхья", "rasa:vatsalya": "Ватсалья", "rasa:madhurya": "Мадхурья", "bhag-ramayana": "Рамаяна", "bhag-mahabharata": "Махабхарата", "bhag-avatara": "Аватары", "bhag-devata": "Полубоги", "bhag-bhagavata": "Бхагаватам" };
    const lilaCat = cats.find((c) => LILA_LBL[c]);
    const subCat = cats.find((c) => c.startsWith("wave-") || c.startsWith("rasa:") || c.startsWith("bhag-"));
    const classEyebrow = (lilaCat && data?.type !== "place") ? (LILA_LBL[lilaCat] + (subCat && SUB_LBL[subCat] ? ` · ${SUB_LBL[subCat]}` : "")) : "";
    const eyebrow = classEyebrow || (qualifier ? `${primary} · ${qualifier}` : primary);
    const SCRIPT = new Set(["bhagavatam", "gita", "cc", "ramayana", "mahabharata"]);
    const W = (c: string) => (c === "source-of-all" ? 3 : SCRIPT.has(c) ? 2 : c === "vraja" ? -1 : 0);
    const rest = cats.filter((c) => !used.has(c) && !c.startsWith("rasa:") && CATEGORY_RU[c]).sort((a, b) => W(b) - W(a));
    const heroChips = FACT_CHIPS[id] ?? Array.from(new Set(rest.map((c) => CATEGORY_RU[c]))).slice(0, 4);
    return { eyebrow, heroChips };
  })();
  // Эпитет на карточке (ВКЛ): профильное summary как авторитетная «надпись», иначе короткая заметка.
  const heroSummary = data?.profile?.summary || data?.note || null;
  const hasScripture = (data?.links ?? []).some((l) => l.kind === "scripture");
  const hasPlaces = (liveDarshans?.length ?? 0) > 0 || centers.length > 0;
  const hasBio = !!article || !!data?.profile?.biography;
  const tabs: { id: string; label: string }[] = [];
  if (data && hasBio) tabs.push({ id: "zhizn", label: bioLabel(data) });
  if (groups.length > 0 || linkGroups.length > 0) tabs.push({ id: "svyazi", label: "Связи" });
  if (hasScripture) tabs.push({ id: "pisaniya", label: "Писания" });
  if (hasPlaces) tabs.push({ id: "mesta", label: "Места" });
  // На первичной загрузке героя: tab/sub берём из URL-хеша (#tab/sub), если
  // он валидный — иначе из дефолта. Это даёт восстановление позиции при
  // back-навигации: /krishna#parikary/shanta → клик в обитель → /person/...
  // → Back → /krishna#parikary/shanta → EntityPage перемонтируется и читает
  // хеш. Также делает URL шеринг-дружелюбным.
  useEffect(() => {
    if (!data) return;
    const raw = data.profile?.longform;
    let dos: Dossier | null = null;
    try { const o = raw ? JSON.parse(raw) : null; if (o && !Array.isArray(o) && Array.isArray(o.tabs) && o.tabs.length) dos = o; } catch { /* not dossier */ }
    // Парсим хеш только для embedded режима (/krishna, /gauranga) — там
    // ПКЛ долгоживущий. В оверлее /person/<id> хеш не используем.
    let hashTab = "", hashSub = "";
    if (embedded && typeof window !== "undefined") {
      // Новый формат — путь /<герой>/<таб>/<подтаб>; seg[0] — id героя (krishna).
      const seg = (initialPathRef.current || "").split("/").filter(Boolean);
      hashTab = decodeURIComponent(seg[1] || "");
      hashSub = decodeURIComponent(seg[2] || "");
      if (!hashTab) {
        // Обратная совместимость со старыми ссылками /<герой>#<таб>/<подтаб>.
        const m = (initialHashRef.current || "").replace(/^#/, "").split("/");
        hashTab = decodeURIComponent(m[0] || "");
        hashSub = decodeURIComponent(m[1] || "");
      }
    }
    const defaultTab = dos ? dos.tabs[0].id : (tabs[0]?.id ?? "");
    const tabExists = dos ? dos.tabs.some((t) => t.id === hashTab) : tabs.some((t) => t.id === hashTab);
    const nextTab = tabExists ? hashTab : defaultTab;
    setTab(nextTab);
    // sub применим позже в эффекте на смену tab. Сохраним хеш-под-таб в реф
    // для одноразового применения.
    pendingSubFromHash.current = tabExists && hashSub ? hashSub : null;
    // Исходный хеш применён — больше не читаем его и разрешаем писать URL.
    initialHashRef.current = "";
    initialPathRef.current = "";
    hashConsumedRef.current = true;
  }, [id, data?.id, embedded]);
  // при смене Tier-1 таба в досье — выставить первый суб-таб (либо из хеша
  // если он валиден для этого таба и это первое монтирование).
  useEffect(() => {
    const t = dossier?.tabs.find((x) => x.id === tab);
    const subs = t?.subtabs ?? [];
    const split = subs.some((st) => st.realm);
    const visible = (split ? subs.filter((st) => !st.realm || st.realm === realm) : subs);
    const pending = pendingSubFromHash.current;
    if (pending && visible.some((st) => st.id === pending)) {
      setSub(pending);
    } else {
      setSub(visible[0]?.id ?? "");
    }
    pendingSubFromHash.current = null;
  }, [tab, data?.id]);
  // при смене realm — если текущий sub не виден, переключить на первый видимый
  useEffect(() => {
    if (!hasRealmSplit) return;
    if (!visibleSubs.find((st) => st.id === sub)) setSub(visibleSubs[0]?.id ?? "");
  }, [realm, hasRealmSplit]);
  // Синхронизация tab/sub → URL-хеш (embedded режим): /krishna#parikary/shanta.
  // replaceUrl, а не pushUrl — переключение внутри карточки не должно засорять
  // back-стек. При клике на «Барсана» pushUrl("/person/barsana") сохраняет
  // ТЕКУЩИЙ URL (с хешем) в истории — Back вернёт сюда же.
  useEffect(() => {
    if (!embedded || typeof window === "undefined") return;
    if (!tab) return;
    if (!hashConsumedRef.current) return; // ждём применения исходного deep-link
    const segs = window.location.pathname.split("/").filter(Boolean);
    const base = "/" + (segs[0] || id);                          // /krishna
    // Главный экран ПКЛ (первый таб + его первый видимый подтаб) — чистый /krishna
    // без хвоста; остальное — путь /krishna/<таб>/<подтаб> (без решётки).
    const defaultTabId = dossier?.tabs?.[0]?.id ?? "";
    const isDefault = tab === defaultTabId && (sub === (visibleSubs[0]?.id ?? "") || !sub);
    const target = isDefault
      ? base
      : sub
        ? `${base}/${encodeURIComponent(tab)}/${encodeURIComponent(sub)}`
        : `${base}/${encodeURIComponent(tab)}`;
    if (window.location.pathname + window.location.hash !== target) replaceUrl(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, sub, embedded, id]);

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
        <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-text)", fontSize: "var(--text-callout)", fontWeight: 600, color: "var(--color-label)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingInline: 6 }}>{data?.name_ru || ""}</span>
        {data && (
          <CardActionBtns favKey={`entity:${id}`}
            meta={{ t: data.name_ru || id, s: data.note || data.name_iast || undefined, h: `/${encodeURIComponent(id)}` }}
            onMore={() => openCardMenu({
            type: "entity", id, title: data.name_ru || id, subtitle: data.note || data.name_iast || undefined,
            url: url(ROUTES.entity(id)),
            context: `Герой · ${data.name_ru || id} · /entity/${id}`,
          })} />
        )}
      </div>
      )}

      <div style={{ padding: embedded ? "0 0 10px" : "12px 16px calc(48px + env(safe-area-inset-bottom,0px))" }}>
        {error && (
          <div style={{ marginTop: 40, textAlign: "center", color: "var(--color-label-3)", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)" }}>
            Не удалось загрузить. Потяните назад и попробуйте снова.
          </div>
        )}
        {!data && !error && (
          <div style={{ marginTop: 40, textAlign: "center", color: "var(--color-label-3)", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)" }}>Загрузка…</div>
        )}
        {data && (
          <>
            <PersonHeroCard
              id={id}
              nameRu={data.name_ru || data.id}
              nameIast={data.name_iast}
              image={data.image}
              images={galleryFor(id, data.image)}
              eyebrow={eyebrow}
              identity={identity}
              summary={heroSummary}
              chips={heroChips}
              onMore={() => openCardMenu({
                type: "entity", id, title: data.name_ru || id, subtitle: data.note || data.name_iast || undefined,
                url: url(ROUTES.entity(id)),
                context: `Герой · ${data.name_ru || id} · /entity/${id}`,
              })}
            />

            {dossier ? (
              <>
                <PersonTabs tabs={dossierTabs} active={tab} onChange={setTab} stickyTop={embedded ? 0 : 52} />
                <div ref={tabContentRef} style={{ marginTop: 4 }}>
                  <style>{LF_ANIM}</style>
                  <div key={"t:" + tab} style={{ animation: "lf-in .26s ease both" }}>
                    {embedded && data ? (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginTop: 18 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>{activeTabObj && <TabHeader tab={activeTabObj} flush />}</div>
                        <div style={{ flexShrink: 0, paddingTop: 2 }}>
                          <CardActionBtns favKey={topicFavKey} meta={favMetaFromCtx(topicCtx)} onMore={() => openCardMenu(topicCtx)} />
                        </div>
                      </div>
                    ) : (activeTabObj && <TabHeader tab={activeTabObj} />)}
                    {activeTabObj?.sections && activeTabObj.sections.length > 0 && (
                      <LongformArticle sections={activeTabObj.sections} onOpen={onOpen} onNavigate={onNavigate} onSub={handleSubChange} onTab={goToTab} />
                    )}
                    {activeTabObj?.rails?.map((r) => <Rail key={r.title} title={r.title} params={r.params} orderIds={r.orderIds} onOpen={onOpen} />)}
                    {activeTabObj?.cards && activeTabObj.cards.length > 0 && <NavCards cards={activeTabObj.cards} onNavigate={onNavigate} onOpenCollection={onOpenCollection} />}
                  </div>
                  {hasRealmSplit && <div ref={realmAnchorRef} aria-hidden style={{ height: 0 }} />}
                  {hasRealmSplit && <RealmSegment realm={realm} onChange={handleRealmChange} stickyTop={embedded ? 46 : 96} />}
                  {subItems.length > 0 && <div ref={subAnchorRef} aria-hidden style={{ height: 0 }} />}
                  {subItems.length > 0 && (
                    <PersonSubTabs
                      items={subItems}
                      active={sub}
                      onChange={handleSubChange}
                      stickyTop={embedded ? (hasRealmSplit ? 100 : 46) : (hasRealmSplit ? 150 : 96)}
                    />
                  )}
                  {subSections.length > 0 && (
                    <div key={"s:" + tab + "/" + sub} style={{ marginTop: 18, animation: "lf-in .26s ease both" }}>
                      <LongformArticle sections={subSections} onOpen={onOpen} onNavigate={onNavigate} onSub={handleSubChange} onTab={goToTab} />
                    </div>
                  )}
                  {subRails.map((r) => <Rail key={r.title} title={r.title} params={r.params} orderIds={r.orderIds} onOpen={onOpen} />)}
                  {/* ЗКН-Н014: мост из досье в витрину Личностей той же волны/расы */}
                  {(() => {
                    const bh = bridgeHref(id, tab, activeSub?.id ?? sub);
                    return bh ? <BridgeLink href={bh} label={`Все личности: ${activeSub?.label ?? ""}`} onNavigate={onNavigate} /> : null;
                  })()}
                  {subCards.length > 0 && <NavCards cards={subCards} onNavigate={onNavigate} onOpenCollection={onOpenCollection} />}
                  {(pagerPrev.on || pagerNext.on) && (
                    <ReaderPager prevLabel={pagerPrev.label} nextLabel={pagerNext.label} onPrev={pagerPrev.on ? pagerPrev.go : null} onNext={pagerNext.on ? pagerNext.go : null} />
                  )}
                </div>
              </>
            ) : (
              <>
            {(rasa || (data.links ?? []).some((l) => l.kind === "appearance" || l.kind === "disappearance")) && (
              <div style={{ marginBottom: tabs.length > 1 ? 6 : 0 }}>
                {/* ЗКН-К004: раса УЖЕ в надписи карточки («КРИШНА ЛИЛА · МАДХУРЬЯ»).
                    Дублировать её подписью под карточкой запрещено (ЗКН-К013). */}
                {(data.links ?? []).some((l) => l.kind === "appearance" || l.kind === "disappearance") && (
                  <div style={{ marginTop: rasa ? 14 : 0 }}>
                    <Eyebrow>Тайминг</Eyebrow>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {(data.links ?? []).filter((l) => l.kind === "appearance" || l.kind === "disappearance").map((t) => (
                        <div key={t.kind + ":" + t.ref} style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", color: "var(--color-label)" }}>
                          <span style={{ color: "var(--color-label-3)" }}>{t.kind === "appearance" ? "Явление" : "Уход"}</span>
                          {t.title && <span style={{ fontWeight: 600 }}> · {t.title}</span>}
                          {t.subtitle && <span style={{ color: "var(--color-label-3)" }}> · {t.subtitle}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {tabs.length > 1 && <PersonTabs tabs={tabs} active={tab} onChange={goToTab} stickyTop={embedded ? 0 : 52} />}

            <div ref={tabContentRef} style={{ marginTop: (tabs.length > 1 || rasa || (data.links ?? []).some((l) => l.kind === "appearance" || l.kind === "disappearance")) ? 18 : 22 }}>

              {tab === "zhizn" && (article ? (
                <LongformArticle sections={article} onOpen={onOpen} onNavigate={onNavigate} />
              ) : (
                <>
                  {data.profile?.biography && <ProseSection label={bioLabel(data)} text={data.profile.biography} />}
                  {data.profile?.contribution && data.profile.contribution !== data.profile.biography && <ProseSection label="Вклад" text={data.profile.contribution} />}
                </>
              ))}

              {tab === "svyazi" && (
                <>
                  {groups.map((g) => <RelRows key={g.label} group={g} onOpen={onOpen} />)}
                  {linkGroups.map(([kind, items]) => (
                    <LinkSection key={kind} kind={kind} items={items} onNavigate={onNavigate} />
                  ))}
                </>
              )}

              {tab === "pisaniya" && (
                <>
                  {(data.links ?? []).some((l) => l.kind === "scripture") && (
                    <section>
                      <Eyebrow>Писания</Eyebrow>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {(data.links ?? []).filter((l) => l.kind === "scripture").map((c) => (
                          <button key={c.ref} type="button" onClick={() => onNavigate?.("/" + c.ref)}
                            style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 2, padding: "11px 14px", borderRadius: 12, border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)", cursor: "pointer", color: "inherit", font: "inherit", width: "100%" }}>
                            <span style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: 600, color: "var(--color-label)" }}>{c.title}</span>
                            {c.subtitle && <span style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", color: "var(--color-label-3)" }}>{c.subtitle}</span>}
                          </button>
                        ))}
                      </div>
                    </section>
                  )}
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
                              <img src={d.images[0].startsWith("/") ? d.images[0] : `/api/img?u=${encodeURIComponent(d.images[0])}&w=1600`} alt={d.deities || d.templeName} loading="lazy" style={{ width: "100%", display: "block" }} />
                              <div style={{ padding: "10px 13px" }}>
                                <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: 600, color: "var(--color-label)" }}>{d.deities || d.templeName}</div>
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
                              <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: 600, color: "var(--color-label)" }}>{c.name}</span>
                              {c.city && <span style={{ display: "block", marginTop: 2, fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", color: "var(--color-label-3)" }}>{c.city}</span>}
                            </span>
                            <span aria-hidden style={{ color: "var(--color-label-3)", fontSize: "var(--text-body)", flexShrink: 0 }}>›</span>
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
