import { Hono } from 'hono';
import type { Bindings, Variables } from '~/index';

/**
 * Контент iskcone.com (полный перенос сайта): статьи раздела dāsa,
 * личности (с цитатами), центры ИСККОН. Источник:
 *   content_items (мета: type/subtype/name/hero_image)
 *   page_text     (очищенный текст страницы)
 *   quotes        (цитаты личностей)
 * Карточная подача в стиле Apple — клиент рендерит из этих данных.
 */
export const contentRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

type Row = Record<string, any>;

// GET /v1/content/resolve?slug=… — чем является slug: контент / бхаджан / нет.
// Нужен для чистых URL (slug = путь) при холодном входе по прямой ссылке.
contentRouter.get('/resolve', async (c) => {
  const slug = c.req.query('slug') ?? '';
  if (!slug) return c.json({ kind: 'none' });
  const ci = (await c.env.DB.prepare(
    `SELECT type FROM content_items WHERE slug = ? AND type IN ('article','personality','center') LIMIT 1`,
  ).bind(slug).first()) as Row | null;
  if (ci) return c.json({ kind: 'content', type: ci.type });
  const pr = (await c.env.DB.prepare(`SELECT 1 AS x FROM prayers WHERE slug = ? LIMIT 1`).bind(slug).first()) as Row | null;
  if (pr) return c.json({ kind: 'bhajan' });
  return c.json({ kind: 'none' });
});

// первая строка page_text — служебный заголовок («Имя. Раздел. …»); срезаем
function bodyOf(text: string | null | undefined): string {
  const raw = String(text ?? '');
  const nl = raw.indexOf('\n');
  return (nl >= 0 ? raw.slice(nl + 1) : raw).trim();
}

/* ───────── Структурирование подписи цитаты (системные ссылки) ─────────
 * Подпись на iskcone: «[Автор ·] Книга, [раздел,] глава N, стих M».
 * Разбираем на автора (→ личность) и источник (→ книга, с главой/стихом).
 * Линкуем только на существующие сущности; иначе оставляем текстом. */

// Русское название книги → канонический work id (works.id)
const BOOK_IDS: { re: RegExp; id: string; name: string }[] = [
  { re: /шри\s*чайтанья\s*чаритамрита|чайтанья[- ]чаритамрита|ч\.?\s*ч\.?/i, id: 'cc', name: 'Шри Чайтанья-чаритамрита' },
  { re: /шримад[- ]?бхагаватам|бхагаватам/i, id: 'sb', name: 'Шримад-Бхагаватам' },
  { re: /бхагавад[- ]?гита/i, id: 'bg', name: 'Бхагавад-гита' },
  { re: /брахма[- ]?самхита/i, id: 'bs', name: 'Брахма-самхита' },
  { re: /нектар\s*наставлений|упадешамрита/i, id: 'noi', name: 'Нектар наставлений' },
  { re: /нектар\s*преданности|бхакти[- ]?расамрита[- ]?синдху/i, id: 'brs', name: 'Нектар преданности' },
  { re: /шри\s*ишопанишад|ишопанишад/i, id: 'iso', name: 'Шри Ишопанишад' },
  { re: /чайтанья[- ]?бхагавата/i, id: 'cb', name: 'Чайтанья-бхагавата' },
  { re: /чайтанья[- ]?манджуша/i, id: 'cm', name: 'Чайтанья-манджуша' },
  { re: /махабхарата/i, id: 'mahabharata', name: 'Махабхарата' },
  { re: /рамаяна/i, id: 'ramayana', name: 'Рамаяна' },
  { re: /кришна[,. ]|книга\s*кришна/i, id: 'krishna-book', name: 'Кришна' },
];

// Раздел ЧЧ (лила) — для подписи и будущей навигации
const CC_LILAS: { re: RegExp; label: string }[] = [
  { re: /ади[- ]?лила/i, label: 'Ади-лила' },
  { re: /мадхья[- ]?лила/i, label: 'Мадхья-лила' },
  { re: /антья[- ]?лила/i, label: 'Антья-лила' },
];

// Имя автора в подписи → slug личности (только существующие страницы)
const AUTHOR_SLUGS: { re: RegExp; slug: string; name: string }[] = [
  { re: /шримати\s*радхарани|радхарани/i, slug: '/ru/radharani', name: 'Шримати Радхарани' },
  { re: /^кришна$|господь\s*кришна|шри\s*кришна(?!\s*чайтанья)/i, slug: '/ru/krishna', name: 'Кришна' },
  { re: /нарасимха|нрисимха/i, slug: '/ru/narasimha', name: 'Нарасимха' },
  { re: /матсья/i, slug: '/ru/matsia', name: 'Матсья' },
  { re: /курма/i, slug: '/ru/kurma', name: 'Курма' },
  { re: /сварупа\s*дамодара/i, slug: '/ru/svarupa-damodara-goswami', name: 'Сварупа Дамодара Госвами' },
  { re: /рамананда\s*рай/i, slug: '/ru/ramananda-rai', name: 'Рамананда Рай' },
  { re: /мадхавендра\s*пури/i, slug: '/ru/madhavendra-puri', name: 'Мадхавендра Пури' },
  { re: /баладева\s*видьябхушана/i, slug: '/ru/baladeva-vidiabhushana', name: 'Баладева Видьябхушана' },
  { re: /джахнава/i, slug: '/ru/jahnava-thakurani', name: 'Джахнава Тхакурани' },
  { re: /ямуна\s*деви/i, slug: '/ru/yamuna-devi-dasi', name: 'Ямуна деви даси' },
  { re: /прабодхананда/i, slug: '/ru/prabodhananda-saraswati-thakur', name: 'Прабодхананда Сарасвати Тхакур' },
  { re: /нарахари/i, slug: '/ru/narahari-sarakara-thakur', name: 'Нарахари Саракара Тхакур' },
  { re: /бхугарбха/i, slug: '/ru/bhugarbha-goswami', name: 'Бхугарбха Госвами' },
];

interface SignRef {
  author: string | null;
  authorSlug: string | null;   // ссылка на личность (или null)
  workName: string | null;
  workId: string | null;       // ссылка на книгу (или null)
  workHref: string | null;     // канонический адрес книги
  division: string | null;     // «Антья-лила» / «Песнь 7» (человекочитаемо)
  divisionSlug: string | null; // adi|madhya|antya | номер песни
  divisionHref: string | null; // div:{work}:{slug} — ссылка на раздел книги
  chapter: string | null;      // номер главы
  verse: string | null;        // номер стиха (или «35-37» / «введение»)
  chapterHref: string | null;  // chap:{work}:{div}:{ch}
  verseHref: string | null;    // verse:{work}:{div}:{ch}:{v}
  citation: string | null;     // человекочитаемый хвост (fallback-показ)
  raw: string;
}

function matchAuthor(s: string): { name: string; slug: string } | null {
  for (const a of AUTHOR_SLUGS) if (a.re.test(s)) return { name: a.name, slug: a.slug };
  return null;
}

// Разбор одной подписи в структуру ссылок
function parseSign(raw: string): SignRef {
  const out: SignRef = { author: null, authorSlug: null, workName: null, workId: null, workHref: null, division: null, divisionSlug: null, divisionHref: null, chapter: null, verse: null, chapterHref: null, verseHref: null, citation: null, raw };
  // 1) автор — сегмент до первого ' · ', если он похож на личность/Прабхупаду
  const segs = raw.split('·').map((x) => x.trim()).filter(Boolean);
  let sourceStr = raw;
  if (segs.length >= 2) {
    const head = segs[0] ?? '';
    const am = matchAuthor(head);
    if (am) { out.author = am.name; out.authorSlug = am.slug; }
    else if (/прабхупада|махапрабху|госвами|тхакур|муни|брахма|шукадева|сута/i.test(head) && head.length < 80) {
      out.author = head; // автор без своей страницы — показываем текстом
    }
    // источник — последний сегмент (обычно книга+глава+стих)
    sourceStr = segs[segs.length - 1] ?? raw;
  }
  // 2) книга
  for (const b of BOOK_IDS) {
    if (b.re.test(sourceStr)) { out.workId = b.id; out.workName = b.name; break; }
  }
  // 3) хвост-цитата (раздел/глава/стих) — всё после названия книги
  let tail = sourceStr;
  if (out.workName) {
    tail = sourceStr.replace(/^[^,]*,\s*/, '').trim(); // убираем «Книга, »
  }
  out.citation = tail && tail !== sourceStr ? tail : (out.workName ? tail : null);

  // 3a) раздел (лила для cc / песнь для sb)
  if (out.workId === 'cc') {
    for (const l of CC_LILAS) {
      if (l.re.test(sourceStr)) {
        out.division = l.label;
        out.divisionSlug = /ади/i.test(l.label) ? 'adi' : /мадхья/i.test(l.label) ? 'madhya' : 'antya';
        break;
      }
    }
  } else if (out.workId === 'sb') {
    const pm = sourceStr.match(/песн[ьи]\s*(\d+)/i);
    if (pm) { out.division = `Песнь ${pm[1]}`; out.divisionSlug = pm[1] ?? null; }
  }
  // 3b) глава
  const cm = sourceStr.match(/глав[аы]\s*(\d+)/i);
  if (cm) out.chapter = cm[1] ?? null;
  // 3c) стих(и) / введение
  const vm = sourceStr.match(/стих[аи]?\s*(\d+(?:\s*[-–]\s*\d+)?)/i);
  if (vm) out.verse = (vm[1] ?? '').replace(/\s+/g, '');
  else if (/введение/i.test(sourceStr)) out.verse = 'введение';

  // 4) канонические адреса (для bg раздел = глава напрямую)
  const dv = out.workId === 'bg' ? out.chapter : out.divisionSlug;
  if (out.workId) out.workHref = `book:${out.workId}`;
  if (out.workId && out.workId !== 'bg' && out.divisionSlug) out.divisionHref = `div:${out.workId}:${out.divisionSlug}`;
  if (out.workId && dv && out.chapter) out.chapterHref = `chap:${out.workId}:${dv}:${out.chapter}`;
  if (out.workId && dv && out.chapter && out.verse && /^\d/.test(out.verse))
    out.verseHref = `verse:${out.workId}:${dv}:${out.chapter}:${out.verse}`;
  return out;
}

// GET /v1/content/articles — список статей dāsa
contentRouter.get('/articles', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT ci.slug, ci.name, ci.hero_image,
            length(COALESCE(pt.text,'')) AS tlen
       FROM content_items ci
       LEFT JOIN page_text pt ON pt.slug = ci.slug
      WHERE ci.type = 'article' AND ci.subtype = 'dasa' AND ci.lang = 'ru' AND length(COALESCE(pt.text,'')) > 120
      ORDER BY tlen DESC`,
  ).all();
  const items = ((results as Row[]) ?? []).map((r) => ({
    slug: r.slug,
    name: r.name,
    hero_image: r.hero_image ?? null,
  }));
  return c.json({ items });
});

// GET /v1/content/personalities — список личностей (с числом цитат)
contentRouter.get('/personalities', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT ci.slug, ci.name, ci.subtype, ci.hero_image,
            (SELECT COUNT(*) FROM quotes q WHERE q.personality_slug = ci.slug) AS n_quotes,
            length(COALESCE(pt.text,'')) AS tlen
       FROM content_items ci
       LEFT JOIN page_text pt ON pt.slug = ci.slug
      WHERE ci.type = 'personality' AND ci.lang = 'ru'
      ORDER BY (ci.subtype='bhagavan') DESC, (ci.subtype='avatar') DESC, n_quotes DESC, tlen DESC`,
  ).all();
  const SUB: Record<string, string> = {
    bhagavan: 'Верховный Господь',
    avatar: 'Аватара',
    associate: 'Спутник Господа',
  };
  const items = ((results as Row[]) ?? []).map((r) => ({
    slug: r.slug,
    name: r.name,
    kind: SUB[r.subtype as string] ?? null,
    hero_image: r.hero_image ?? null,
    n_quotes: r.n_quotes ?? 0,
  }));
  return c.json({ items });
});

// GET /v1/content/centers — список центров ИСККОН
contentRouter.get('/centers', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT ci.slug, ci.name, ci.hero_image
       FROM content_items ci
       LEFT JOIN page_text pt ON pt.slug = ci.slug
      WHERE ci.type = 'center' AND ci.lang = 'ru' AND length(COALESCE(pt.text,'')) > 120
      ORDER BY length(COALESCE(pt.text,'')) DESC`,
  ).all();
  const items = ((results as Row[]) ?? []).map((r) => ({
    slug: r.slug,
    name: r.name,
    hero_image: r.hero_image ?? null,
  }));
  return c.json({ items });
});

// GET /v1/content/detail?slug=/... — единая карточка контента
contentRouter.get('/detail', async (c) => {
  const slug = c.req.query('slug');
  if (!slug) return c.json({ error: { code: 'bad_request', message: 'slug required' } }, 400);

  const ci = (await c.env.DB.prepare(
    `SELECT slug, name, type, subtype, hero_image FROM content_items WHERE slug = ?`,
  )
    .bind(slug)
    .first()) as Row | null;
  if (!ci) return c.json({ error: { code: 'not_found', message: 'content not found' } }, 404);

  const pt = (await c.env.DB.prepare(`SELECT text FROM page_text WHERE slug = ?`).bind(slug).first()) as Row | null;
  const body = bodyOf(pt?.text);
  const paragraphs = body.split('\n').map((s) => s.trim()).filter((s) => s.length > 0);

  // structured layout blocks (heading/accent/para/quote/sign/image) — реальная вёрстка iskcone
  const { results: brows } = await c.env.DB.prepare(
    `SELECT ord, kind, text, image FROM content_blocks WHERE slug = ? ORDER BY ord`,
  )
    .bind(slug)
    .all();
  const blocks = ((brows as Row[]) ?? []).map((b) => {
    const kind = b.kind as string;
    if (kind === 'sign') {
      return { kind, text: b.text ?? null, image: null, ref: parseSign(String(b.text ?? '')) };
    }
    return { kind, text: b.text ?? null, image: b.image ?? null };
  });

  const SUB: Record<string, string> = {
    bhagavan: 'Верховный Господь',
    avatar: 'Аватара',
    associate: 'Спутник Господа',
    dasa: 'Заметки на полях сердца',
  };

  return c.json({
    slug: ci.slug,
    name: ci.name,
    type: ci.type,
    kind: SUB[ci.subtype as string] ?? null,
    hero_image: ci.hero_image ?? null,
    blocks,
    paragraphs, // fallback, если blocks пуст
  });
});
