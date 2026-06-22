/**
 * «Стих дня» — системное чтение Шрилы Прабхупады, стих за стихом (БГ → ШБ → ЧЧ).
 *
 * Единица чтения («день») = последовательные стихи до первого комментария
 * Прабхупады включительно: если у стиха нет пурпорта, добираем следующие, пока
 * не дойдём до пурпорта (в ЧЧ это часто пакет из нескольких стихов). У стиха —
 * глобальный номер из суммы всех стихов трёх книг.
 *
 * Порядок чтения = divisions.ordinal (последовательность глав; песни/лилы
 * вклинены своими ordinal) → verses.ordinal (номер стиха внутри главы). Это
 * подтверждено на боевой базе. Глобальный номер считается дёшево через
 * кешируемый префиксный индекс по главам (без сканов всей книги).
 *
 * Ничего не выдумывается и не переводится — только боевой корпус (verse_texts,
 * издание <work>-ru). Эндпоинт читает ту же D1, что кабинет и даршаны.
 */
import type { D1Database } from "@cloudflare/workers-types";

interface ReadingEnv { DB: D1Database }

const WORKS = ["bg", "sb", "cc"] as const;
type Work = (typeof WORKS)[number];
const WORK_NAME: Record<Work, string> = {
  bg: "Бхагавад-гита как она есть",
  sb: "Шримад-Бхагаватам",
  cc: "Шри Чайтанья-чаритамрита",
};
const WORK_ABBR: Record<Work, string> = { bg: "БГ", sb: "ШБ", cc: "ЧЧ" };
const WINDOW = 60; // максимум стихов в одной единице (защита от длинного «бескомментарного» прогона)

const isWork = (s: string): s is Work => (WORKS as readonly string[]).includes(s);
const hasPur = (p: string | null) => !!p && p.trim().length > 0;

/* ── те же чистки текста, что и в боевой читалке библиотеки (worker.ts) ── */
function stripScriptLabel(s: string | null | undefined): string | null {
  if (s == null) return null;
  return s.replace(/^[\u0400-\u04FF]+\s*/, "");
}
function cleanGloss(s: string | null | undefined): string | null {
  if (s == null) return null;
  return String(s).replace(/[\s.\u2026]+$/u, "");
}
function fixSentenceSpacing(s: string | null | undefined): string | null {
  if (s == null) return null;
  return String(s).replace(/([а-яёa-z])([.!?])([А-ЯЁA-Z])/gu, "$1$2 $3");
}
/** Подпись стиха как в библиотеке: «Текст N» / «Тексты N-M». */
function verseLabel(ref: string): string {
  const tail = String(ref).split(".").pop() ?? "";
  return /[-–—]/.test(tail) ? `Тексты ${tail.replace(/[–—]/g, "-")}` : `Текст ${tail}`;
}

/* ── кешируемый индекс глав: префикс стихов до главы (внутри книги) + офсеты книг ── */
interface PlanIndex { at: number; total: number; offset: Record<Work, number>; prefix: Record<string, number>; }
let idxCache: PlanIndex | null = null;

async function getIndex(env: ReadingEnv): Promise<PlanIndex> {
  if (idxCache && Date.now() - idxCache.at < 6 * 3600 * 1000) return idxCache;
  const res = await env.DB.prepare(
    `SELECT d.id id, d.work_id work, COUNT(v.id) cnt
     FROM divisions d LEFT JOIN verses v ON v.division_id = d.id
     WHERE d.work_id IN ('bg','sb','cc') AND d.level = 'chapter'
     GROUP BY d.id ORDER BY d.work_id, d.ordinal`
  ).all<{ id: string; work: string; cnt: number }>();
  const prefix: Record<string, number> = {};
  const acc: Record<string, number> = { bg: 0, sb: 0, cc: 0 };
  for (const r of res.results ?? []) {
    if (acc[r.work] === undefined) continue;
    prefix[r.id] = acc[r.work]; // стихов в книге до этой главы
    acc[r.work] += r.cnt;
  }
  const offset = { bg: 0, sb: 0, cc: 0 } as Record<Work, number>;
  let run = 0;
  for (const w of WORKS) { offset[w] = run; run += acc[w] ?? 0; }
  idxCache = { at: Date.now(), total: run, offset, prefix };
  return idxCache;
}

interface VRow { id: string; ref: string; devanagari: string | null; translit: string | null; dord: number; vord: number; division_id: string; translation: string | null; purport: string | null }
interface Start { work: Work; divId: string; dord: number; vord: number }

async function resolveStart(env: ReadingEnv, from: string | null): Promise<Start | null> {
  const base = `SELECT v.work_id work, v.division_id divId, d.ordinal dord, v.ordinal vord
                FROM verses v JOIN divisions d ON d.id = v.division_id`;
  const r = from
    ? await env.DB.prepare(`${base} WHERE v.id = ?1`).bind(from).first<{ work: string; divId: string; dord: number; vord: number }>()
    : await env.DB.prepare(`${base} WHERE v.work_id = 'bg' ORDER BY d.ordinal, v.ordinal LIMIT 1`).first<{ work: string; divId: string; dord: number; vord: number }>();
  if (!r || !isWork(r.work)) return null;
  return { work: r.work, divId: r.divId, dord: r.dord, vord: r.vord };
}

async function windowFrom(env: ReadingEnv, s: Start, limit: number): Promise<VRow[]> {
  const res = await env.DB.prepare(
    `SELECT v.id, v.ref, v.devanagari, v.translit, v.division_id, d.ordinal dord, v.ordinal vord, vt.translation, vt.purport
     FROM verses v JOIN divisions d ON d.id = v.division_id
     LEFT JOIN verse_texts vt ON vt.verse_id = v.id AND vt.edition_id = ?1
     WHERE v.work_id = ?2 AND ( d.ordinal > ?3 OR (d.ordinal = ?3 AND v.ordinal >= ?4) )
     ORDER BY d.ordinal, v.ordinal LIMIT ?5`
  ).bind(`${s.work}-ru`, s.work, s.dord, s.vord, limit).all<VRow>();
  return res.results ?? [];
}

// Глобальный номер стартового стиха (1-based) в сумме БГ+ШБ+ЧЧ.
async function globalNum(env: ReadingEnv, idx: PlanIndex, s: Start): Promise<number> {
  const within = await env.DB.prepare(
    `SELECT COUNT(*) c FROM verses WHERE division_id = ?1 AND ordinal <= ?2`
  ).bind(s.divId, s.vord).first<{ c: number }>();
  const pre = idx.prefix[s.divId];
  if (pre === undefined) {
    // запас: глава не в индексе — честный (более тяжёлый) подсчёт по книге
    const r = await env.DB.prepare(
      `SELECT COUNT(*) c FROM verses v JOIN divisions d ON d.id = v.division_id
       WHERE v.work_id = ?1 AND ( d.ordinal < ?2 OR (d.ordinal = ?2 AND v.ordinal <= ?3) )`
    ).bind(s.work, s.dord, s.vord).first<{ c: number }>();
    return idx.offset[s.work] + (r?.c ?? 1);
  }
  return idx.offset[s.work] + pre + (within?.c ?? 1);
}

async function firstOfWork(env: ReadingEnv, work: Work): Promise<string | null> {
  const r = await env.DB.prepare(
    `SELECT v.id FROM verses v JOIN divisions d ON d.id = v.division_id WHERE v.work_id = ?1 ORDER BY d.ordinal, v.ordinal LIMIT 1`
  ).bind(work).first<{ id: string }>();
  return r?.id ?? null;
}

function jr(data: unknown, status = 200, cache = "no-store"): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": cache },
  });
}

export async function readingApi(request: Request, env: ReadingEnv, url: URL): Promise<Response | null> {
  if (url.pathname !== "/api/reading/unit") return null;
  if (request.method !== "GET") return jr({ error: "method" }, 405);

  const from = url.searchParams.get("from");
  const start = await resolveStart(env, from);
  if (!start) return jr({ error: "not_found" }, 404);

  const idx = await getIndex(env);
  const win = await windowFrom(env, start, WINDOW);
  if (!win.length) return jr({ error: "empty" }, 404);

  // Единица: до первого стиха с пурпортом включительно.
  let endIdx = win.length - 1;
  for (let i = 0; i < win.length; i++) { if (hasPur(win[i].purport)) { endIdx = i; break; } }
  const unit = win.slice(0, endIdx + 1);
  const endRow = unit[unit.length - 1];

  const fromGnum = await globalNum(env, idx, start);
  const toGnum = fromGnum + unit.length - 1;

  // Пословный перевод стихов единицы — та же таблица и порядок, что в читалке.
  const ids = unit.map((v) => v.id);
  const byVerse: Record<string, { term: string; gloss: string | null }[]> = {};
  if (ids.length) {
    const ph = ids.map((_, i) => `?${i + 1}`).join(",");
    const tres = await env.DB.prepare(
      `SELECT verse_id, term, gloss FROM verse_tokens WHERE verse_id IN (${ph}) ORDER BY verse_id, ordinal`
    ).bind(...ids).all<{ verse_id: string; term: string; gloss: string | null }>();
    for (const t of tres.results ?? []) (byVerse[t.verse_id] ??= []).push({ term: t.term, gloss: cleanGloss(t.gloss) });
  }

  // Следующая стартовая позиция.
  let nextFrom: string | null = win[endIdx + 1]?.id ?? null;
  if (!nextFrom) {
    const wi = WORKS.indexOf(start.work);
    nextFrom = WORKS[wi + 1] ? await firstOfWork(env, WORKS[wi + 1]) : null;
  }

  return jr({
    work: start.work,
    workName: WORK_NAME[start.work],
    workAbbr: WORK_ABBR[start.work],
    startId: unit[0].id,
    fromGnum,
    toGnum,
    total: idx.total,
    verses: unit.map((v) => ({
      id: v.id,
      ref: v.ref,
      label: verseLabel(v.ref),
      devanagari: stripScriptLabel(v.devanagari),
      translit: v.translit ?? null,
      tokens: byVerse[v.id] ?? [],
      translation: fixSentenceSpacing(v.translation),
      purport: hasPur(v.purport) ? fixSentenceSpacing(v.purport) : null,
    })),
    purport: hasPur(endRow.purport) ? { ref: endRow.ref, text: fixSentenceSpacing(endRow.purport) as string } : null,
    nextFrom,
    done: nextFrom === null,
  }, 200, "public, max-age=300");
}
