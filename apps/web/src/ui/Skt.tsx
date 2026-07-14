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
const SCRIPT_MARK = /[\u0300-\u036F\u0483-\u0489\u04E3\u04EF]/;

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
  // ЗКН-Д013/D: абзац, который наполовину состоит из транслитерации, — это
  // САМ СТИХ, а не наша проза с вкраплениями. Он звучит голосом шастры.
  if (scriptFraction(text) >= 0.45) return <Skt voice>{text}</Skt>;
  const parts = text.split(/(\s+)/);
  const out: ReactNode[] = [];
  let plain = "";
  const flush = () => {
    if (!plain) return;
    for (const node of wrapGlossary(plain, out.length)) out.push(node);
    plain = "";
  };
  for (const tok of parts) {
    if (tok && /\S/.test(tok) && SCRIPT_MARK.test(tok)) {
      flush();
      // ЗКН-Д013: слово с диакритикой BBT («кр̣шн̣а-да̄с») — это ТРАНСЛИТЕРАЦИЯ
      // ПИСАНИЯ внутри нашей прозы, а не наш термин. Оно звучит чужим голосом.
      out.push(<Skt voice key={`s${out.length}`}>{tok}</Skt>);
    } else {
      plain += tok;
    }
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
