/**
 * position.ts — личная позиция в системном чтении Прабхупады («Стих дня»).
 *
 * Источник правды — на устройстве (localStorage), как и прогресс чтения книг:
 * работает и для гостя, без входа. Хранит точку старта текущей единицы (id стиха;
 * null = первая единица БГ) и стек предыдущих стартов — чтобы возвращаться «назад»
 * по уже прочитанным единицам. Продвижение — по кнопке «Прочитано», поэтому ни
 * один стих не пропускается: человек проходит весь корпус последовательно.
 */
const KEY = "iol:reading-plan:v1";
export const READING_PLAN_CHANGED = "iol:reading-plan-changed";

export interface PlanState {
  /** id стартового стиха текущей единицы; null — самое начало (БГ 1.1). */
  from: string | null;
  /** Стек стартов уже пройденных единиц (для «назад»). */
  stack: string[];
}

function read(): PlanState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw) as Partial<PlanState>;
      return { from: typeof v.from === "string" ? v.from : null, stack: Array.isArray(v.stack) ? v.stack.filter((x) => typeof x === "string") : [] };
    }
  } catch { /* noop */ }
  return { from: null, stack: [] };
}

function write(s: PlanState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    window.dispatchEvent(new CustomEvent(READING_PLAN_CHANGED));
  } catch { /* noop */ }
}

export function getPlan(): PlanState {
  return read();
}

/** Зафиксировать текущую точку (после загрузки единицы — startId как якорь возобновления). */
export function setCurrent(from: string): void {
  const s = read();
  if (s.from !== from) write({ from, stack: s.stack });
}

/** Прочитано → дальше: текущий старт уходит в стек, новый старт = nextFrom. */
export function advance(currentFrom: string, nextFrom: string | null): void {
  const s = read();
  const stack = currentFrom ? [...s.stack, currentFrom] : s.stack;
  write({ from: nextFrom ?? currentFrom, stack });
}

/** Назад к предыдущей единице (если есть). Возвращает новый from. */
export function goBackPlan(): string | null {
  const s = read();
  if (!s.stack.length) return s.from;
  const stack = s.stack.slice();
  const prev = stack.pop() ?? null;
  write({ from: prev, stack });
  return prev;
}

export function canGoBackPlan(): boolean {
  return read().stack.length > 0;
}

/** Начать сначала (БГ 1.1). */
export function resetPlan(): void {
  write({ from: null, stack: [] });
}
