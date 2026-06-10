/**
 * bookSearch — поисковый движок библиотеки уровня нативного поиска 2026:
 *
 *  • нечувствительность к регистру и диакритике (IAST «Bhāgavatam» ↔ «bhagavatam»);
 *  • терпимость к опечаткам и транслитерации (огранич. расстояние Левенштейна:
 *    «krishna»↔«krsna», «chaitanya»↔«caitanya», «goswami»↔«gosvami»);
 *  • многословные запросы (все слова должны совпасть, порядок не важен:
 *    «гита прабхупада», «рупа нектар»);
 *  • ранжирование по релевантности (точное слово > префикс > подстрока > фаззи;
 *    вес поля: название > автор > IAST > синонимы > подзаголовок; буст названия и
 *    читаемых книг);
 *  • подсветка совпадения с точным маппингом индексов сквозь сложение диакритики.
 *
 * Чистый модуль без зависимостей — тестируется отдельно (tsx).
 */
import type { CatalogBook } from "./books";

/** NFD + срез диакритики + нижний регистр. База символа сохраняется 1:1 (важно для подсветки). */
export const foldDia = (s: string): string => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const WORD_SPLIT = /[^a-z0-9а-яё]+/i;
const words = (s: string): string[] => foldDia(s).split(WORD_SPLIT).filter(Boolean);

/** Ограниченное расстояние Левенштейна с ранним выходом (возвращает max+1, если больше). */
function boundedLev(a: string, b: string, max: number): number {
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > max) return max + 1;
  let prev = new Array<number>(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;
  for (let i = 1; i <= la; i++) {
    const cur = new Array<number>(lb + 1);
    cur[0] = i;
    let rowBest = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      cur[j] = v;
      if (v < rowBest) rowBest = v;
    }
    if (rowBest > max) return max + 1;
    prev = cur;
  }
  return prev[lb];
}

/** Допуск опечатки по длине токена: короткие — строго, длинные — до 2 правок. */
const allowedDist = (len: number): number => (len >= 6 ? 2 : len >= 4 ? 1 : 0);

/** Оценка совпадения одного токена с одним полем (0 = нет совпадения). */
function fieldTokenScore(whole: string, ws: string[], token: string): number {
  if (ws.includes(token)) return 1.0;          // точное слово
  if (whole.startsWith(token)) return 0.95;    // префикс всего поля
  if (ws.some((w) => w.startsWith(token))) return 0.9; // префикс слова
  if (whole.includes(token)) return 0.62;      // подстрока
  const allow = allowedDist(token.length);     // фаззи по словам
  if (allow > 0) {
    let best = allow + 1;
    for (const w of ws) {
      const d = boundedLev(token, w, allow);
      if (d < best) best = d;
      if (best === 0) break;
    }
    if (best <= allow) return 0.5 * (1 - best / (token.length + 1));
  }
  return 0;
}

interface Field { whole: string; words: string[]; weight: number; isTitle?: boolean }

function fieldsOf(b: CatalogBook): Field[] {
  const f: Field[] = [{ whole: foldDia(b.title), words: words(b.title), weight: 1.0, isTitle: true }];
  if (b.authorName) f.push({ whole: foldDia(b.authorName), words: words(b.authorName), weight: 0.72 });
  if (b.iast) f.push({ whole: foldDia(b.iast), words: words(b.iast), weight: 0.6 });
  if (b.also) f.push({ whole: foldDia(b.also), words: words(b.also), weight: 0.55 });
  if (b.note) f.push({ whole: foldDia(b.note), words: words(b.note), weight: 0.32 });
  return f;
}

export interface SearchHit { book: CatalogBook; score: number }

/** Ранжированный поиск. Все токены запроса должны совпасть (AND). */
export function searchBooks(query: string, library: CatalogBook[]): SearchHit[] {
  const tokens = foldDia(query).split(WORD_SPLIT).filter(Boolean);
  if (tokens.length === 0) return [];
  const hits: SearchHit[] = [];
  for (const book of library) {
    const fields = fieldsOf(book);
    let total = 0;
    let titleScore = 0;
    let ok = true;
    for (const token of tokens) {
      let best = 0;
      let bestTitle = 0;
      for (const f of fields) {
        const s = fieldTokenScore(f.whole, f.words, token) * f.weight;
        if (s > best) best = s;
        if (f.isTitle && s > bestTitle) bestTitle = s;
      }
      if (best <= 0) { ok = false; break; }
      total += best;
      titleScore += bestTitle;
    }
    if (!ok) continue;
    const score = total + (titleScore > 0 ? 0.4 : 0) + (book.readable ? 0.12 : 0);
    hits.push({ book, score });
  }
  hits.sort((a, b) =>
    b.score - a.score ||
    Number(b.book.readable) - Number(a.book.readable) ||
    a.book.title.localeCompare(b.book.title, "ru"),
  );
  return hits;
}

/* ───────────── подсветка совпадения (маппинг индексов сквозь сложение диакритики) ───────────── */
export interface Seg { text: string; hit: boolean }

/** Складываем строку посимвольно, сохраняя соответствие индексам исходной строки. */
function foldWithMap(display: string): { folded: string; map: number[] } {
  let folded = "";
  const map: number[] = [];
  for (let i = 0; i < display.length; i++) {
    const f = foldDia(display[i]);
    for (let k = 0; k < f.length; k++) { folded += f[k]; map.push(i); }
  }
  return { folded, map };
}

/**
 * Возвращает сегменты строки с пометкой совпадения для рендера <mark>.
 * Подсвечивает лучшую непрерывную подстроку: сперва весь запрос, иначе — самый длинный
 * токен-подстроку. Если непрерывного совпадения нет (чистый фаззи) — одна нить без подсветки.
 */
export function highlight(display: string, query: string): Seg[] {
  if (!display) return [{ text: display, hit: false }];
  const { folded, map } = foldWithMap(display);
  const full = foldDia(query.trim());
  const candidates: string[] = [];
  if (full) candidates.push(full);
  for (const t of full.split(WORD_SPLIT).filter(Boolean)) candidates.push(t);
  candidates.sort((a, b) => b.length - a.length); // длиннее → приоритетнее

  let fStart = -1, fLen = 0;
  for (const c of candidates) {
    if (c.length < 2) continue;
    const idx = folded.indexOf(c);
    if (idx !== -1) { fStart = idx; fLen = c.length; break; }
  }
  if (fStart === -1) return [{ text: display, hit: false }];

  const oStart = map[fStart];
  const oEnd = map[fStart + fLen - 1] + 1;
  const segs: Seg[] = [];
  if (oStart > 0) segs.push({ text: display.slice(0, oStart), hit: false });
  segs.push({ text: display.slice(oStart, oEnd), hit: true });
  if (oEnd < display.length) segs.push({ text: display.slice(oEnd), hit: false });
  return segs;
}
