import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { api } from "./api";
import { PDFDocument } from "pdf-lib";
import { exportToPdf, downloadServerPdf, fetchServerPdfBytes, savePdfBytes } from "./pdf";
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

  // ОДИН файл на ЛИЛУ. Внутри лилу собираем из маленьких быстрых серверных
  // рендеров (это надёжно даже для тяжёлых комментариев ЧЧ — не упирается в
  // память/таймаут Cloudflare и не оставляет «висящих» сессий), затем склеиваем
  // прямо в браузере (pdf-lib): обложка + части → один PDF. Печать НЕ используется.
  const SUBCHUNK = 400; // стихов на один серверный рендер — быстро и надёжно
  type Lila = { slug: string; label: string; chapters: CcChapter[] };
  const lilas: Lila[] = (toc.divisions ?? [])
    .map((d) => { const slug = d.id.split(".")[1] ?? ""; return { slug, label: d.title_ru || CC_LILA[slug] || slug, chapters: d.chapters ?? [] }; })
    .filter((l) => l.chapters.length);
  if (!lilas.length) { opts.onStatus?.("Оглавление пустое"); return; }

  opts.cancelRef.current = false;
  let active = true;
  const prog = (p: number) => { if (active && !opts.cancelRef.current) opts.onProgress?.(Math.max(1, Math.min(99, p))); };
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  // суммарный прогресс по всем частям книги (+обложка на лилу)
  const totalUnits = lilas.reduce((a, l) => a + 1 + Math.max(1, Math.ceil(l.chapters.reduce((s, c) => s + (Number(c.verses) || 0), 0) / SUBCHUNK)), 0);
  let doneUnits = 0;
  let crawl: ReturnType<typeof setInterval> | undefined;
  const startCrawl = () => {
    const base = doneUnits / Math.max(1, totalUnits), next = (doneUnits + 1) / Math.max(1, totalUnits), t0 = Date.now();
    if (crawl) clearInterval(crawl);
    crawl = setInterval(() => { const t = (Date.now() - t0) / 1000; prog(Math.round((base + (next - base) * (1 - Math.exp(-t / 22)) * 0.85) * 96)); }, 500);
  };
  const stopCrawl = () => { if (crawl) { clearInterval(crawl); crawl = undefined; } doneUnits++; prog(Math.round((doneUnits / Math.max(1, totalUnits)) * 96)); };

  // одна часть с одной тихой переповторкой; вернёт байты или null + причину
  const loadPart = async (path: string): Promise<{ bytes: Uint8Array | null; err: string }> => {
    let err = "";
    for (let attempt = 0; attempt < 2 && !opts.cancelRef.current; attempt++) {
      const ac = new AbortController();
      opts.abortRef.current = ac;
      const killer = setTimeout(() => ac.abort(), 240000);
      let bytes: Uint8Array | null = null;
      try { bytes = await fetchServerPdfBytes(path, { signal: ac.signal, onError: (r) => { err = r; } }); }
      finally { clearTimeout(killer); }
      if (bytes) return { bytes, err: "" };
      if (attempt === 0 && !opts.cancelRef.current) await sleep(5000);
    }
    return { bytes: null, err };
  };

  const failed: string[] = [];
  for (const lila of lilas) {
    if (opts.cancelRef.current) break;
    // главы лилы → части по бюджету стихов
    const total = lila.chapters.reduce((s, c) => s + (Number(c.verses) || 0), 0);
    const parts = Math.max(1, Math.ceil(total / SUBCHUNK));
    const target = total / parts;
    const ranges: Array<{ from: string; to: string }> = [];
    let cur: CcChapter[] = [], curV = 0, made = 0;
    const flush = () => { if (cur.length) { made++; ranges.push({ from: cur[0].number, to: cur[cur.length - 1].number }); cur = []; curV = 0; } };
    for (const c of lila.chapters) { cur.push(c); curV += Number(c.verses) || 0; if (made < parts - 1 && curV >= target) flush(); }
    flush();

    const merged = await PDFDocument.create();
    let okAll = true;
    let lilaErr = "";

    // обложка (одна на лилу)
    opts.onTitle?.(`${lila.label} · обложка`);
    startCrawl();
    const cover = await loadPart(`/pdf?kind=cover&work=${encodeURIComponent(work)}&lila=${lila.slug}&label=${encodeURIComponent(lila.label)}`);
    stopCrawl();
    if (cover.bytes) {
      try { const cdoc = await PDFDocument.load(cover.bytes); for (const p of await merged.copyPages(cdoc, cdoc.getPageIndices())) merged.addPage(p); }
      catch { /* обложка не критична */ }
    }

    for (let pi = 0; pi < ranges.length && !opts.cancelRef.current; pi++) {
      const r = ranges[pi];
      opts.onTitle?.(ranges.length > 1 ? `${lila.label} · часть ${pi + 1} из ${ranges.length}` : lila.label);
      startCrawl();
      const part = await loadPart(`/pdf?kind=lila&work=${encodeURIComponent(work)}&lila=${lila.slug}&from=${encodeURIComponent(r.from)}&to=${encodeURIComponent(r.to)}&label=${encodeURIComponent(lila.label)}&bare=1`);
      stopCrawl();
      if (!part.bytes) { okAll = false; lilaErr = part.err; break; }
      try { const pdoc = await PDFDocument.load(part.bytes); for (const p of await merged.copyPages(pdoc, pdoc.getPageIndices())) merged.addPage(p); }
      catch (e) { okAll = false; lilaErr = e instanceof Error ? e.message : "склейка"; break; }
      if (pi < ranges.length - 1 && !opts.cancelRef.current) await sleep(1200);
    }

    if (opts.cancelRef.current) break;
    if (!okAll || merged.getPageCount() === 0) { failed.push(`${lila.label}${lilaErr ? ` (${lilaErr})` : ""}`); continue; }
    opts.onTitle?.(`${lila.label} · сохраняю`);
    try { savePdfBytes(await merged.save(), `${bookTitle}. ${lila.label}.pdf`); }
    catch (e) { failed.push(`${lila.label} (сохранение: ${e instanceof Error ? e.message : "ошибка"})`); }
    await sleep(800);
  }

  stopCrawl();
  active = false;
  opts.abortRef.current = null;
  opts.onProgress?.(0);
  opts.onTitle?.("Готовлю PDF книги");
  if (opts.cancelRef.current) return;
  if (failed.length) opts.onStatus?.(`Не удалось собрать: ${failed.join("; ")}. Нажмите «Скачать PDF» ещё раз.`);
  else opts.onStatus?.("Готово");
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
