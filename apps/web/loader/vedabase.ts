/**
 * Адаптер vedabase.io — превращает страницу стиха в NormalizedVerse.
 *
 * ВАЖНО (lib `import_bg_structure.py`, тот же принцип «ссылка, а не копия»):
 *   - структура (главы, номера стихов, диапазоны) и сам санскрит
 *     (деванагари + транслитерация) — общественное достояние (стихам тысячи лет,
 *     авторство — Вьясадева); их грузим свободно;
 *   - пословный перевод, художественный перевод и комментарий — это ИЗДАНИЕ
 *     (Шрила Прабхупада / BBT). Они тянутся только при layers.edition === true,
 *     пишутся в издание <work>-ru с license = pending. По умолчанию — НЕ копируются.
 *
 * Разбор полей таргетит стандартную разметку vedabase (классы `av-*`). Это
 * единственное «хрупкое» место: при изменении вёрстки правится только collect().
 * Загрузчик возвращает поверстовый отчёт, поэтому пустой разбор виден сразу.
 */
import type { NormalizedVerse, VerseToken } from './types';

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

// id книги в платформе → сегмент пути в библиотеке vedabase.
const WORK_PATH: Record<string, string> = { bg: 'bg', sb: 'sb', cc: 'cc', iso: 'iso' };

export function vedabasePath(work: string): string {
  return WORK_PATH[work] ?? work;
}

export function vedabaseBase(work: string): string {
  return `https://vedabase.io/ru/library/${vedabasePath(work)}`;
}

async function get(url: string, tries = 3): Promise<string> {
  for (let t = 0; t < tries; t++) {
    try {
      const r = await fetch(url, {
        headers: { 'user-agent': UA, 'accept-language': 'ru,en;q=0.8', accept: 'text/html' },
      });
      if (r.ok) return await r.text();
    } catch {
      /* retry */
    }
  }
  return '';
}

/**
 * Сегменты стихов главы в порядке документа, включая диапазоны вида «16-18».
 * Берём из ссылок индекс-страницы главы (как в существующем импортёре структуры).
 */
export async function fetchChapterSegs(work: string, chapter: number): Promise<string[]> {
  const html = await get(`${vedabaseBase(work)}/${chapter}/`);
  if (!html) return [];
  const p = vedabasePath(work);
  const re = new RegExp(`/ru/library/${p}/${chapter}/([0-9]+(?:-[0-9]+)?)/`, 'g');
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      out.push(m[1]);
    }
  }
  return out;
}

/** Собирает текст блоков `av-*` со страницы стиха, сохраняя переносы строк/абзацев. */
async function collect(html: string): Promise<Record<'deva' | 'translit' | 'syn' | 'tr' | 'pur', string>> {
  const buf: Record<string, string[]> = { deva: [], translit: [], syn: [], tr: [], pur: [] };
  const rw = new HTMLRewriter()
    .on('.av-devanagari', { text: (t) => void buf.deva.push(t.text) })
    .on('.av-devanagari br', { element: () => void buf.deva.push('\n') })
    .on('.av-verse_text', { text: (t) => void buf.translit.push(t.text) })
    .on('.av-verse_text br', { element: () => void buf.translit.push('\n') })
    .on('.av-synonyms', { text: (t) => void buf.syn.push(t.text) })
    .on('.av-translation', { text: (t) => void buf.tr.push(t.text) })
    .on('.av-purport p', { element: () => void buf.pur.push('\n\n') })
    .on('.av-purport br', { element: () => void buf.pur.push('\n') })
    .on('.av-purport', { text: (t) => void buf.pur.push(t.text) });
  // Прогоняем HTMLRewriter: чтобы хендлеры сработали, ответ нужно прочитать.
  await rw.transform(new Response(html)).text();

  const lines = (s: string) =>
    s
      .split('\n')
      .map((l) => l.replace(/[ \t]+/g, ' ').trim())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  const flat = (s: string) => s.replace(/\s+/g, ' ').trim();
  return {
    deva: lines(buf.deva.join('')),
    translit: lines(buf.translit.join('')),
    syn: flat(buf.syn.join('')),
    tr: flat(buf.tr.join('')),
    pur: lines(buf.pur.join('')),
  };
}

/** «term — gloss; term — gloss» → токены. Терпимо к разным тире. */
function parseTokens(syn: string): VerseToken[] {
  if (!syn) return [];
  return syn
    .split(';')
    .map((piece) => {
      const parts = piece.split(/\s+[—–-]\s+/);
      const term = (parts[0] ?? '').trim();
      const gloss = parts.length > 1 ? parts.slice(1).join(' — ').trim() : '';
      return term ? { term, gloss: gloss || null } : null;
    })
    .filter((x): x is VerseToken => x !== null);
}

/** Полный разбор одной страницы стиха (или диапазона). */
export async function fetchVerse(work: string, chapter: number, seg: string): Promise<NormalizedVerse> {
  const url = `${vedabaseBase(work)}/${chapter}/${seg}/`;
  const base: NormalizedVerse = {
    seg,
    ordinal: 0,
    devanagari: null,
    translit: null,
    uvaca: null,
    tokens: [],
    translation: null,
    purport: null,
    sourceUrl: url,
  };
  const html = await get(url);
  if (!html) return base;

  const c = await collect(html);
  let translit = c.translit || null;
  let uvaca: string | null = null;
  if (translit) {
    const first = translit.split('\n')[0] ?? '';
    if (/ува|uv[āa]ca/i.test(first) && translit.includes('\n')) uvaca = first.trim();
  }
  return {
    ...base,
    devanagari: c.deva || null,
    translit,
    uvaca,
    tokens: parseTokens(c.syn),
    translation: c.tr || null,
    purport: c.pur || null,
  };
}
