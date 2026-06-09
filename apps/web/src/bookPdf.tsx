import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { api } from "./api";
import { exportToPdf, downloadServerPdf } from "./pdf";
import { BookPrint, LilaPrint, ProsePrint, type ChapterRow, type ChapterVerse, type ProsePara } from "./BookDetailPage";
import { bookFullTitle, type BookData } from "./books";

const CC_LILA: Record<string, string> = { adi: "Ади-лила", madhya: "Мадхья-лила", antya: "Антья-лила" };
type CcChapter = { id: string; number: string; title_ru: string; verses: number };
type CcDiv = { id: string; slug: string; title_ru: string; chapters: CcChapter[] };

/**
 * Собирает всю книгу (все главы + все стихи) и экспортирует в PDF —
 * без перехода на страницу книги. Используется карточкой в ленте (ВКП)
 * и страницей книги (ПКП) ради единого результата.
 */
export async function exportWholeBook(book: BookData, onStatus?: (m: string) => void): Promise<void> {
  if (typeof document === "undefined") return;
  onStatus?.("Готовлю PDF всей книги…");
  try {
    const ch = await (await fetch(api(`/books/bg/chapters`))).json();
    const chapters: ChapterRow[] = ch.chapters ?? [];
    if (!chapters.length) { onStatus?.("Книга ещё загружается…"); return; }

    const entries = await Promise.all(
      chapters.map(async (c) => {
        const d = await (await fetch(api(`/books/bg/chapters/${c.number}/read`))).json();
        return [c.number, (d.verses ?? []) as ChapterVerse[]] as const;
      }),
    );
    const versesByCh: Record<string, ChapterVerse[]> = {};
    for (const [num, vs] of entries) versesByCh[num] = vs;

    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "position:fixed;left:-10000px;top:0;width:760px";
    document.body.appendChild(host);
    const root = createRoot(host);
    // flushSync guarantees the whole tree (всех ~700 стихов) is committed to
    // the DOM before we snapshot it — иначе PDF мог обрезаться.
    flushSync(() => { root.render(<BookPrint book={book} chapters={chapters} versesByCh={versesByCh} />); });
    if (typeof document !== "undefined" && (document as Document).fonts?.ready) {
      try { await (document as Document).fonts.ready; } catch { /* ignore */ }
    }
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const name = book.titleLine2 ? `${book.titleLine1} ${book.titleLine2}` : book.titleLine1;
    exportToPdf(host, { title: name });
    setTimeout(() => { root.unmount(); host.remove(); }, 2000);
  } catch {
    onStatus?.("Не удалось собрать книгу");
  }
}

/**
 * Клиентский рендер одной части лилы ЧЧ через печать браузера — ЗАПАСНОЙ путь,
 * когда серверный рендер не справился (надёжен для большого объёма).
 */
export async function exportCcLila(opts: {
  work: string; lila: string; from?: string; to?: string;
  book: BookData; lilaLabel: string; range?: string; filename: string;
  onStatus?: (m: string) => void;
}): Promise<void> {
  if (typeof document === "undefined") return;
  opts.onStatus?.("Готовлю PDF в браузере…");
  try {
    const toc = await (await fetch(api(`/books/${opts.work}/toc`))).json();
    const divs = (toc.divisions ?? []) as CcDiv[];
    const divObj = divs.find((d) => d.id.split(".")[1] === opts.lila || d.slug === opts.lila);
    let chs = divObj?.chapters ?? [];
    if (opts.from && opts.to) chs = chs.filter((c) => Number(c.number) >= Number(opts.from) && Number(c.number) <= Number(opts.to));
    const chapters: ChapterRow[] = chs.map((c) => ({ id: c.id, number: c.number, title_ru: c.title_ru, title_en: "", source_url: "", verses: c.verses }));
    const entries = await Promise.all(chapters.map(async (c) => {
      const d = await (await fetch(api(`/books/${opts.work}/division/${encodeURIComponent(c.id)}/read`))).json();
      return [c.id, (d.verses ?? []) as ChapterVerse[]] as const;
    }));
    const versesByCh: Record<string, ChapterVerse[]> = {};
    for (const [id, vs] of entries) versesByCh[id] = vs;
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "position:fixed;left:-10000px;top:0;width:760px";
    document.body.appendChild(host);
    const root = createRoot(host);
    flushSync(() => { root.render(<LilaPrint book={opts.book} lilaLabel={opts.lilaLabel} range={opts.range} chapters={chapters} versesByCh={versesByCh} />); });
    if ((document as Document).fonts?.ready) { try { await (document as Document).fonts.ready; } catch { /* ignore */ } }
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    exportToPdf(host, { title: opts.filename.replace(/\.pdf$/i, "") });
    setTimeout(() => { root.unmount(); host.remove(); }, 2000);
  } catch { opts.onStatus?.("Не удалось собрать часть"); }
}

/**
 * Книга ЧЧ → несколько PDF (по лилам; большие лилы режутся по объёму).
 * Каждый файл: сначала серверный рендер; если не вышло — клиентский (печать).
 * Единый источник для ленты (ВКП) и страницы книги (ПКП).
 */
export async function downloadCcBookPdf(opts: {
  work: string; book: BookData; bookTitle: string;
  onStatus?: (m: string) => void; onProgress?: (p: number) => void; onTitle?: (t: string) => void;
  cancelRef: { current: boolean }; abortRef: { current: AbortController | null };
}): Promise<void> {
  const { work, book, bookTitle } = opts;
  let toc: { divisions?: CcDiv[] };
  try { toc = await (await fetch(api(`/books/${work}/toc`))).json(); }
  catch { opts.onStatus?.("Не удалось загрузить оглавление"); return; }
  // Размер части ≈ как у «Гиты» (~700 стихов / ~1100 стр.) — это проверенный
  // потолок Cloudflare Browser Rendering на ОДИН рендер. Крупнее (≈3000 стихов)
  // headless-браузер падает по памяти → 500 → клиент уходил в печать браузера.
  // Поэтому большие лилы/песни режем на тома-части, каждая рендерится надёжно.
  const CHUNK = 700;
  type Job = { slug: string; label: string; from: string; to: string; part: number; parts: number };
  const jobs: Job[] = [];
  for (const d of toc.divisions ?? []) {
    const slug = d.id.split(".")[1] ?? "";
    const label = d.title_ru || CC_LILA[slug] || slug;
    const chs = d.chapters ?? [];
    const total = chs.reduce((a, c) => a + (Number(c.verses) || 0), 0);
    const parts = Math.max(1, Math.ceil(total / CHUNK));
    const target = total / parts;
    let cur: CcChapter[] = [], curV = 0, made = 0;
    const flush = () => { if (cur.length) { made++; jobs.push({ slug, label, from: cur[0].number, to: cur[cur.length - 1].number, part: made, parts }); cur = []; curV = 0; } };
    for (const c of chs) { cur.push(c); curV += Number(c.verses) || 0; if (made < parts - 1 && curV >= target) flush(); }
    flush();
  }
  if (!jobs.length) { opts.onStatus?.("Оглавление пустое"); return; }
  opts.cancelRef.current = false;
  let active = true;
  const prog = (p: number) => { if (active && !opts.cancelRef.current) opts.onProgress?.(p <= 0 ? 1 : p); };
  for (let i = 0; i < jobs.length; i++) {
    if (opts.cancelRef.current) break;
    const j = jobs[i];
    const sfx = j.parts > 1 ? ` · ${j.part}` : "";
    opts.onTitle?.(`${j.label}${sfx} · ${i + 1} из ${jobs.length}`);
    const fname = `${bookTitle}. ${j.label}${sfx}.pdf`;
    const range = j.parts > 1 ? `главы ${j.from}-${j.to}` : undefined;
    const ac = new AbortController();
    opts.abortRef.current = ac;
    const killer = setTimeout(() => ac.abort(), 280000);
    let ok = false;
    try {
      ok = await downloadServerPdf(
        `/pdf?kind=lila&work=${encodeURIComponent(work)}&lila=${j.slug}&from=${encodeURIComponent(j.from)}&to=${encodeURIComponent(j.to)}&label=${encodeURIComponent(j.label)}${range ? `&range=${encodeURIComponent(range)}` : ""}`,
        fname,
        { onProgress: prog, signal: ac.signal },
      );
    } finally { clearTimeout(killer); }
    if (!ok && !opts.cancelRef.current) {
      await exportCcLila({ work, lila: j.slug, from: j.from, to: j.to, book, lilaLabel: j.label, range, filename: fname, onStatus: opts.onStatus });
    }
  }
  active = false;
  opts.abortRef.current = null;
  opts.onProgress?.(0);
  opts.onTitle?.("Готовлю PDF книги");
}

/**
 * Клиентский рендер прозовой книги целиком (напр. «Нектар преданности») через
 * печать браузера — ЗАПАСНОЙ путь, когда серверный рендер не справился.
 */
export async function exportProseBook(book: BookData, onStatus?: (m: string) => void): Promise<void> {
  if (typeof document === "undefined") return;
  onStatus?.("Готовлю PDF всей книги…");
  try {
    const ch = await (await fetch(api(`/books/${book.work}/chapters`))).json();
    const chapters: ChapterRow[] = ch.chapters ?? [];
    if (!chapters.length) { onStatus?.("Книга ещё загружается…"); return; }
    const entries = await Promise.all(chapters.map(async (c) => {
      const d = await (await fetch(api(`/books/${book.work}/chapters/${c.number}/read`))).json();
      return [c.number, ((d.verses ?? []) as ProsePara[]).map((v) => ({ ref: v.ref, translation: v.translation }))] as const;
    }));
    const parasByCh: Record<string, ProsePara[]> = {};
    for (const [num, ps] of entries) parasByCh[num] = ps;
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "position:fixed;left:-10000px;top:0;width:760px";
    document.body.appendChild(host);
    const root = createRoot(host);
    flushSync(() => { root.render(<ProsePrint book={book} chapters={chapters} parasByCh={parasByCh} />); });
    if ((document as Document).fonts?.ready) { try { await (document as Document).fonts.ready; } catch { /* ignore */ } }
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    exportToPdf(host, { title: bookFullTitle(book) });
    setTimeout(() => { root.unmount(); host.remove(); }, 2000);
  } catch { onStatus?.("Не удалось собрать книгу"); }
}

/**
 * ЕДИНЫЙ диспетчер выгрузки книги в PDF (BBT-стандарт, с обложкой) — один путь
 * для всех существующих и новых книг. Структуру берём из BookData:
 *   • hierarchical (ЧЧ, ШБ) → по томам/частям (как BBT издаёт лилы/песни),
 *     каждый файл с обложкой и плашкой тома (см. downloadCcBookPdf);
 *   • prose (Нектар преданности) → один файл, главы прозы;
 *   • иначе (БГ) → один файл со всеми стихами.
 * Обложку прикрепляет воркер (kind=book|lila) — клиентский код книго-независим.
 */
export async function downloadBookPdf(opts: {
  work: string; book: BookData;
  onStatus?: (m: string) => void; onProgress?: (p: number) => void; onTitle?: (t: string) => void;
  cancelRef?: { current: boolean }; abortRef?: { current: AbortController | null };
}): Promise<void> {
  const { work, book } = opts;
  const full = bookFullTitle(book);
  if (book.hierarchical) {
    await downloadCcBookPdf({
      work, book, bookTitle: full,
      onStatus: opts.onStatus, onProgress: opts.onProgress, onTitle: opts.onTitle,
      cancelRef: opts.cancelRef ?? { current: false }, abortRef: opts.abortRef ?? { current: null },
    });
    return;
  }
  // Одиночный файл «как у БГ» (БГ — стихи; прозовые книги — главы прозы).
  if (opts.cancelRef) opts.cancelRef.current = false;
  opts.onTitle?.("Готовлю PDF книги");
  const ac = new AbortController();
  if (opts.abortRef) opts.abortRef.current = ac;
  const killer = setTimeout(() => ac.abort(), 280000);
  try {
    if (book.prose) {
      await downloadServerPdf(
        `/pdf?kind=book&work=${encodeURIComponent(work)}`, `${full}.pdf`,
        { onStatus: opts.onStatus, onProgress: opts.onProgress, signal: ac.signal, fallback: () => { void exportProseBook(book, opts.onStatus); } },
      );
    } else {
      await downloadServerPdf(
        `/pdf?kind=book`, `${full}.pdf`,
        { onStatus: opts.onStatus, onProgress: opts.onProgress, signal: ac.signal, fallback: () => { void exportWholeBook(book, opts.onStatus); } },
      );
    }
  } finally {
    clearTimeout(killer);
    if (opts.abortRef) opts.abortRef.current = null;
    opts.onProgress?.(0);
    opts.onTitle?.("Готовлю PDF книги");
  }
}
