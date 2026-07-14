/**
 * ЗКН-С001 — GEORGIA И КУРСИВ ТОЛЬКО ДЛЯ ЧУЖОГО/СВЯЩЕННОГО ГОЛОСА.
 * ─────────────────────────────────────────────────────────────────────────
 * Georgia (`--font-scripture`) + курсив применяются ТОЛЬКО к:
 *   • стиху (деванагари, транслитерация)
 *   • цитате (чужой голос — ЗКН-БТ004)
 *   • пословному переводу
 *   • IAST-форме имени (это транслитерация, не наша проза)
 *
 * ТЕРМИНЫ В ПРОЗЕ («манджари», «сакхи», «бхакти») набираются ОБЫЧНЫМ шрифтом.
 * Раньше термин получал Georgia без курсива — полумера: шрифт другой, смысла в
 * этом нет, текст рябит. Правило простое: Georgia = «говорит не автор карточки».
 *
 * <Skt> — семантическая пометка термина (для поиска/глоссария), БЕЗ смены шрифта.
 *
 *   • В JSX, где текст пишем мы сами:           <Skt>бхакти</Skt>
 *   • В прозе из данных (комментарии, био):     {renderTerms(text)}
 *
 * renderTerms прогоняет плоский текст через курируемый глоссарий BBT
 * (./scripture.ts) и оборачивает только технические термины — имена собственные
 * и лоанворды остаются прямым шрифтом. См. scripture.ts про конвенцию и охват.
 */
import type { ReactNode } from "react";
import { SCRIPTURE_TERM_REGEX, SCRIPTURE_COMPOUND_REGEX, SCRIPTURE_STOP_SET, IS_LETTER } from "./scripture";

export function Skt({
  children,
  lang,
  title,
  className,
  voice,
}: {
  children: ReactNode;
  /** BCP-47, напр. "sa" (санскрит) или "bn" (бенгальский). По умолчанию не задаётся. */
  lang?: string;
  title?: string;
  className?: string;
  voice?: boolean;
}) {
  return (
    <i className={[voice ? "skt skt-voice" : "skt", className].filter(Boolean).join(" ")} lang={lang} title={title}>
      {children}
    </i>
  );
}

/**
 * Оборачивает технические термины в плоском тексте в <Skt>. Возвращает текст
 * как есть, если терминов нет (без лишних обёрток). Консервативно: только
 * точные формы из глоссария, по границам слов (Unicode), стоп-лист имён/лоанвордов
 * исключён. Длинное совпадение — первым (составные термины не дробятся).
 */
// ЗКН-Д013: транслитерация приходит В ДВУХ ПИСЬМЕНАХ.
//  · кириллица с диакритикой (BBT-RU): кр̣шн̣а, а̄тма̄ра̄ма — комбинируемые знаки
//  · латиница IAST: kṛṣṇa, bhagavān, ātmārāma — ПРЕДСОСТАВЛЕННЫЕ символы
// Прежний матчер знал только первое. Стих «kṛṣṇas tu bhagavān svayam» на экране
// ачарьев набирался UI-шрифтом: механизм его просто не видел.
const SCRIPT_MARK = /[\u0300-\u036F\u0483-\u0489\u04E3\u04EF\u0100-\u017F\u1E00-\u1EFF\u00F1\u00D1]/;

/** Свернуть диакритику: «Kṛṣṇa» → «krsna». Нужно, чтобы сверяться со стоп-листом. */
function fold(w: string): string {
  return w.normalize("NFD").replace(/[\u0300-\u036F]/g, "").toLowerCase().replace(/[^a-zа-я-]/g, "");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * ЗКН-Д013 · СТИХ — ЭТО ФРАЗА, А НЕ НАБОР ПОМЕЧЕННЫХ СЛОВ.
 *
 * В комментариях BBT диакритика стоит НЕ НА КАЖДОМ слове стиха:
 *     «Ведаиш́ ча сарваир ахам эва ведйах̣ — вот высшее предназначение…»
 *      ▲ помечено                  ▲ помечено   ← а середина голая
 *
 * Пословный матчер выделял только помеченные слова, и стих выходил ШАХМАТНОЙ
 * ДОСКОЙ: «Ведаиш́» курсивом, «ча сарваир ахам эва» прямым, «ведйах̣» курсивом.
 * Закон был применён к СЛОВАМ, а не к СТИХАМ.
 *
 * Теперь стих распознаётся как ФРАЗА: от помеченного слова полоса растёт в обе
 * стороны через слова, которые НЕ являются нашей речью, и обрывается только на
 * русском служебном слове или на знаке препинания. Так «Ахам̇ сарвасйа
 * прабхавах̣» звучит целиком, а «Господь Кришна говорит» — не звучит вовсе.
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Наша речь: на этих словах полоса стиха обрывается. */
const RU_STOP = new Set([
  "и","в","на","с","не","что","как","это","но","а","или","то","же","бы","ли","из","за",
  "по","для","о","об","от","до","при","над","под","без","у","к","во","со","он","она","они",
  "мы","вы","я","его","ее","её","их","этот","эта","этом","этой","этого","эти","все","всё",
  "так","там","тут","где","когда","чтобы","если","есть","был","была","было","были","быть",
  "может","можно","должен","слово","слова","словами","стих","стихе","стиха","стихом",
  "только","даже","уже","ещё","еще","очень","более","менее","также","тоже","здесь","том",
  "говорит","сказано","пишет","значит","например","однако","поэтому","таким","образом",
  "господь","господа","бог","бога","один","одна","два","три","цитирует","приводит",
]);

/** Слог, который русский не пишет: русский — «я», шастра — «йа». */
const TRANSLIT_CYR = /(йа|йо|йу|йе|кша|джн|шча|сйа|нйа|тйа|рйа|хйа|дхй|бхй|тва̄|ттв)/;

type Cls = "strong" | "weak" | "stop" | "unknown";

function classify(w: string): Cls {
  const bare = w.replace(/[^\wа-яёА-ЯЁāīūṛṝḷṭḍṇśṣḥṁñṅ\u0300-\u036F'’-]/g, "");
  if (!bare) return "stop";
  const f = fold(bare);
  if (SCRIPT_MARK.test(bare)) return SCRIPTURE_STOP_SET.has(f) ? "stop" : "strong";
  if (RU_STOP.has(f) || SCRIPTURE_STOP_SET.has(f)) return "stop";
  if (TRANSLIT_CYR.test(f)) return "weak";
  return "unknown";
}

/** Знак, на котором фраза стиха кончается. */
const PUNCT_EDGE = /[.,;:!?\u00bb)]$|^[\u00ab(]/;

/** Полосы стиха внутри абзаца: от помеченного слова наружу — до нашей речи. */
function verseRuns(words: string[]): Array<[number, number]> {
  const cls = words.map(classify);
  const runs: Array<[number, number]> = [];
  let i = 0;
  while (i < words.length) {
    if (cls[i] !== "strong" && cls[i] !== "weak") { i++; continue; }
    let a = i, b = i;
    while (a > 0 && cls[a - 1] !== "stop" && !PUNCT_EDGE.test(words[a - 1])) a--;
    while (b + 1 < words.length && cls[b + 1] !== "stop") {
      b++;
      if (PUNCT_EDGE.test(words[b])) break;
    }
    runs.push([a, b]);
    i = b + 1;
  }
  return runs;
}

function scriptFraction(text: string): number {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return 0;
  let n = 0;
  for (const w of words) if (SCRIPT_MARK.test(w)) n++;
  return n / words.length;
}

/** Глоссарная пометка: сначала составные термины (минуют стоп-лист, т.к.
 * это явный override для нашего корпуса), затем — точечные термины BBT
 * с учётом стоп-листа. Два прохода гарантируют, что «лила-мадхурья» и
 * «сат-чид-ананда» подсвечиваются наравне с «бхакти» — единый закон. */
function wrapGlossary(text: string, keyBase: number): ReactNode[] {
  // ── Pass 1: составные термины (без проверки стоп-листа) ──
  const compoundRe = SCRIPTURE_COMPOUND_REGEX;
  compoundRe.lastIndex = 0;
  type Hit = { start: number; end: number; form: string };
  const hits: Hit[] = [];
  let m: RegExpExecArray | null;
  while ((m = compoundRe.exec(text)) !== null) {
    const form = m[0];
    const start = m.index;
    const end = start + form.length;
    const before = start > 0 ? text[start - 1] : "";
    const after = end < text.length ? text[end] : "";
    if ((before && IS_LETTER.test(before)) || (after && IS_LETTER.test(after))) {
      compoundRe.lastIndex = start + 1;
      continue;
    }
    hits.push({ start, end, form });
    compoundRe.lastIndex = end;
  }
  // ── Pass 2: глоссарий BBT (со стоп-листом), но только в зонах ВНЕ pass-1 ──
  const out: ReactNode[] = [];
  let cursor = 0;
  for (const h of hits) {
    if (h.start > cursor) {
      wrapGlossaryInner(text.slice(cursor, h.start), keyBase, out);
    }
    out.push(<Skt key={`c${keyBase}-${out.length}`}>{h.form}</Skt>);
    cursor = h.end;
  }
  if (cursor < text.length) {
    wrapGlossaryInner(text.slice(cursor), keyBase, out);
  }
  return out;
}

const NAME_STOP = new Set(["он", "она", "оно", "они", "его", "ему", "её", "ее", "их", "им", "ими", "сам", "сама", "само", "сами", "самого", "свой", "своя", "своё", "свое", "свои", "своих", "своим", "в", "и", "а", "но", "это", "эти", "этот", "эта", "тот", "та", "то", "так", "за", "на", "по", "под", "над", "с", "о", "об", "от", "до", "для", "как", "что", "чтобы", "бог", "бога", "богу", "господь", "господа", "господу", "верховный", "верховная", "верховную", "верховного"]);
function upperStart(s: string): boolean { return s.length > 0 && s[0] === s[0].toUpperCase() && s[0] !== s[0].toLowerCase(); }

function wrapGlossaryInner(text: string, keyBase: number, out: ReactNode[]): void {
  const re = SCRIPTURE_TERM_REGEX;
  re.lastIndex = 0;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const form = m[0];
    const start = m.index;
    const end = start + form.length;
    const before = start > 0 ? text[start - 1] : "";
    const after = end < text.length ? text[end] : "";
    const boundaryOk = !(before && IS_LETTER.test(before)) && !(after && IS_LETTER.test(after));
    if (!boundaryOk || SCRIPTURE_STOP_SET.has(form.toLowerCase())) {
      re.lastIndex = start + 1;
      continue;
    }
    // Имя-guard: заглавный термин, за которым следует ещё одно заглавное слово
    // (не местоимение/частица), — часть имени собственного (напр. «Бхакти Тиртха
    // Свами»), а не термин. Курсивить не нужно.
    if (upperStart(form)) {
      const rest = text.slice(end).replace(/^\s+/, "");
      const nextWord = (rest.match(/^\S+/)?.[0] ?? "").replace(/[^\p{L}-]/gu, "");
      if (upperStart(nextWord) && !NAME_STOP.has(nextWord.toLowerCase())) {
        re.lastIndex = start + 1;
        continue;
      }
    }
    if (start > last) out.push(text.slice(last, start));
    out.push(<Skt key={`g${keyBase}-${out.length}`}>{form}</Skt>);
    last = end;
    re.lastIndex = end;
  }
  if (last < text.length) out.push(text.slice(last));
}

/**
 * Выделяет писание georgia-курсивом (Gentium) — ЗАКОН во всём тексте:
 *   • любое слово с комбинирующей диакритикой (транслитерация: бхагава̄н, видйа̄,
 *     су-сукхам̇) → <Skt> (Gentium-курсив + корректные знаки над кириллицей);
 *   • если почти весь фрагмент — транслитерация (стих-строка) → обернуть целиком;
 *   • в русской прозе дополнительно подсвечиваем термины из глоссария BBT.
 */
export function renderTerms(text: string | null | undefined): ReactNode {
  if (!text) return text ?? null;
  if (scriptFraction(text) >= 0.45) return <Skt voice>{text}</Skt>;

  // ЗКН-Д013: стих — ФРАЗА. Диакритика в комментариях BBT стоит не на каждом
  // слове («Ведаиш́ ча сарваир ахам эва ведйах̣»), и пословный матчер выдавал
  // ШАХМАТНУЮ ДОСКУ. Полоса растёт от помеченного слова до нашей речи.
  const parts = text.split(/(\s+)/);
  const wi: number[] = [];
  const words: string[] = [];
  parts.forEach((t, k) => { if (t && /\S/.test(t)) { wi.push(k); words.push(t); } });
  const runs = verseRuns(words);
  const out: ReactNode[] = [];
  let plain = "";
  const flush = () => {
    if (!plain) return;
    for (const node of wrapGlossary(plain, out.length)) out.push(node);
    plain = "";
  };
  if (!runs.length) {
    flush();
    for (const node of wrapGlossary(text, 0)) out.push(node);
    return out.length ? out : text;
  }
  const ends = new Map<number, number>();
  const inside = new Array(parts.length).fill(false);
  for (const [a, b] of runs) {
    ends.set(wi[a], wi[b]);
    for (let k = wi[a]; k <= wi[b]; k++) inside[k] = true;
  }
  for (let k = 0; k < parts.length; k++) {
    if (ends.has(k)) {
      flush();
      const e = ends.get(k) as number;
      out.push(<Skt voice key={"v" + k}>{parts.slice(k, e + 1).join("")}</Skt>);
      k = e;
      continue;
    }
    if (!inside[k]) plain += parts[k];
  }
  flush();
  return out.length ? out : text;
}

/**
 * Для ЗАГОЛОВКОВ: транслитерационные слова — шрифтом писания (Gentium) ради
 * корректных диакритик, но БЕЗ курсива (заголовок остаётся прямым/полужирным).
 */
export function renderTitle(text: string | null | undefined): ReactNode {
  if (!text) return text ?? null;
  if (!SCRIPT_MARK.test(text)) return text;
  const parts = text.split(/(\s+)/);
  const out: ReactNode[] = [];
  for (let i = 0; i < parts.length; i++) {
    const tok = parts[i];
    if (tok && /\S/.test(tok) && SCRIPT_MARK.test(tok)) {
      // ЗКН-С001: термин — обычный шрифт. Georgia только для стиха/цитаты/пословного.
      out.push(tok);
    } else {
      out.push(tok);
    }
  }
  return out;
}
