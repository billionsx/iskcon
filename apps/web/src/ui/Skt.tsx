/**
 * СТАНДАРТ оформления санскритской / бенгальской терминологии.
 * ─────────────────────────────────────────────────────────────────────────
 * <Skt> — единственный канонический способ пометить инлайн-термин: рендерит
 * <i class="skt">, который через .skt в globals.css берёт Georgia
 * (var(--font-scripture)) + курсив. Семантически <i> = иноязычный термин (а не
 * «курсив ради акцента»), поэтому это и корректная разметка, и единый вид.
 *
 *   • В JSX, где текст пишем мы сами:           <Skt>бхакти</Skt>
 *   • В прозе из данных (комментарии, био):     {renderTerms(text)}
 *
 * renderTerms прогоняет плоский текст через курируемый глоссарий BBT
 * (./scripture.ts) и оборачивает только технические термины — имена собственные
 * и лоанворды остаются прямым шрифтом. См. scripture.ts про конвенцию и охват.
 */
import type { ReactNode } from "react";
import { SCRIPTURE_TERM_REGEX, SCRIPTURE_STOP_SET, IS_LETTER } from "./scripture";

export function Skt({
  children,
  lang,
  title,
  className,
}: {
  children: ReactNode;
  /** BCP-47, напр. "sa" (санскрит) или "bn" (бенгальский). По умолчанию не задаётся. */
  lang?: string;
  title?: string;
  className?: string;
}) {
  return (
    <i className={className ? `skt ${className}` : "skt"} lang={lang} title={title}>
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
export function renderTerms(text: string | null | undefined): ReactNode {
  if (!text) return text ?? null;

  const re = SCRIPTURE_TERM_REGEX;
  re.lastIndex = 0;

  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    const form = m[0];
    const start = m.index;
    const end = start + form.length;

    // ручная проверка границ слова (без lookbehind — ради Safari < 16.4):
    // отвергаем совпадения внутри слова (напр. «дхарма» внутри «адхарма»).
    const before = start > 0 ? text[start - 1] : "";
    const after = end < text.length ? text[end] : "";
    const boundaryOk = !(before && IS_LETTER.test(before)) && !(after && IS_LETTER.test(after));

    if (!boundaryOk || SCRIPTURE_STOP_SET.has(form.toLowerCase())) {
      re.lastIndex = start + 1; // продолжить со следующего символа (учесть перекрытия)
      continue;
    }

    if (start > last) out.push(text.slice(last, start));
    out.push(<Skt key={out.length}>{form}</Skt>);
    last = end;
    re.lastIndex = end;
  }

  if (out.length === 0) return text;
  if (last < text.length) out.push(text.slice(last));
  return out;
}
