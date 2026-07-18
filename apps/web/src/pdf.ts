
import { SITE_HOST } from "./routes";/**
 * PDF export for the current level (book / chapter / verse / bhajan).
 *
 * We don't rasterise — we use the browser's print pipeline so text stays
 * vector/selectable and the output uses our live stylesheet (нашему CSS).
 * The target content is cloned into a dedicated print layer appended to
 * <body>, so fixed / overflow ancestors can't clip it; chrome marked
 * [data-pdf-no-print] is stripped. The @media print rules live in globals.css.
 *
 * Usage: exportToPdf(contentEl, { title, heading, subheading })
 *  - title       → default file name in the Save-as-PDF dialog
 *  - heading      → document title block (once, at the top)
 *  - subheading   → small line under the heading
 */
export function exportToPdf(
  content: HTMLElement | null,
  opts?: { title?: string; heading?: string; subheading?: string },
): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (!content) { window.print(); return; }

  const stale = document.getElementById("pdf-print-layer");
  if (stale && stale.parentNode) stale.parentNode.removeChild(stale);

  const prevTitle = document.title;
  if (opts?.title) document.title = opts.title;

  const layer = document.createElement("div");
  layer.id = "pdf-print-layer";

  const clone = content.cloneNode(true) as HTMLElement;
  clone.removeAttribute("data-pdf-root");
  clone.querySelectorAll("[data-pdf-no-print]").forEach((el) => {
    if (el.parentNode) el.parentNode.removeChild(el);
  });
  // The clone may come from an off-screen print container (position:fixed;
  // left:-10000px) — reset positioning so it flows normally in the print
  // layer instead of staying off-page (which would print a blank document).
  clone.style.position = "static";
  clone.style.left = "auto";
  clone.style.right = "auto";
  clone.style.top = "auto";
  clone.style.bottom = "auto";
  clone.style.transform = "none";
  clone.style.width = "auto";
  // drop scroll/height limits that inline styles may carry over
  clone.style.removeProperty("height");
  clone.style.removeProperty("max-height");
  clone.style.removeProperty("min-height");
  clone.style.overflow = "visible";

  // Per-page margins WITHOUT the browser's date/url/page chrome: wrap content
  // in a table. <thead>/<tfoot> repeat on every printed page, so thead acts as
  // a top margin and tfoot (our brand line) as a bottom margin on EVERY page;
  // left/right margins come from the cell padding. Works for the 1000+ page book.
  const table = document.createElement("table");
  table.className = "pdf-table";

  const thead = document.createElement("thead");
  thead.innerHTML = '<tr><td><div class="pdf-top-space"></div></td></tr>';

  const tfoot = document.createElement("tfoot");
  const footTr = document.createElement("tr");
  const footTd = document.createElement("td");
  const foot = document.createElement("div");
  foot.className = "pdf-foot";
  foot.textContent = "ISKCON ONE LOVE · " + ((typeof location !== "undefined" && location.hostname) || SITE_HOST);
  footTd.appendChild(foot);
  footTr.appendChild(footTd);
  tfoot.appendChild(footTr);

  const tbody = document.createElement("tbody");
  const bodyTr = document.createElement("tr");
  const bodyTd = document.createElement("td");
  if (opts?.heading) {
    const head = document.createElement("div");
    head.className = "pdf-doc-head";
    const title = document.createElement("div");
    title.className = "pdf-doc-title";
    title.textContent = opts.heading;
    head.appendChild(title);
    if (opts.subheading) {
      const sub = document.createElement("div");
      sub.className = "pdf-doc-sub";
      sub.textContent = opts.subheading;
      head.appendChild(sub);
    }
    bodyTd.appendChild(head);
  }
  bodyTd.appendChild(clone);
  bodyTr.appendChild(bodyTd);
  tbody.appendChild(bodyTr);

  table.appendChild(thead);
  table.appendChild(tfoot);
  table.appendChild(tbody);
  layer.appendChild(table);

  document.body.appendChild(layer);
  document.body.classList.add("printing");
  // hide the browser's own header/footer (date/url/page) for the client print
  const pageStyle = document.createElement("style");
  pageStyle.id = "pdf-page-margin0";
  pageStyle.textContent = "@page{margin:0}";
  document.head.appendChild(pageStyle);

  let done = false;
  let safety: ReturnType<typeof setTimeout>;
  const cleanup = () => {
    if (done) return;
    done = true;
    clearTimeout(safety);
    document.body.classList.remove("printing");
    if (layer.parentNode) layer.parentNode.removeChild(layer);
    if (pageStyle.parentNode) pageStyle.parentNode.removeChild(pageStyle);
    document.title = prevTitle;
    window.removeEventListener("afterprint", cleanup);
  };
  // afterprint fires once the print/save UI is dismissed (desktop + modern mobile).
  window.addEventListener("afterprint", cleanup);
  // last-resort cleanup — long enough never to interfere with preview generation.
  safety = setTimeout(cleanup, 120000);

  // give the clone a couple of frames to lay out, then open the dialog
  requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
}

/**
 * Скачивает PDF, отрендеренный на сервере (Cloudflare Browser Rendering),
 * и сохраняет файлом одним действием. При ошибке вызывает запасной
 * клиентский рендер (если передан).
 *   path — например `/pdf?kind=book` | `/pdf?kind=chapter&n=2` | `/pdf?kind=verse&ref=…`
 */
export async function downloadServerPdf(
  path: string,
  filename: string,
  opts?: { onStatus?: (m: string) => void; onProgress?: (pct: number) => void; fallback?: () => void; signal?: AbortSignal; onError?: (info: string) => void },
): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const onStatus = opts?.onStatus;
  const onProgress = opts?.onProgress;
  const fallback = opts?.fallback;
  const signal = opts?.signal;
  onStatus?.("Готовлю PDF…");
  // Оценочный прогресс: сервер отдаёт готовый PDF целиком (книга ≈ 1100 страниц
  // рендерится ~1–2 мин), поэтому показываем плавно растущий процент для уверенности,
  // а по завершении — 100%.
  let timer: ReturnType<typeof setInterval> | undefined;
  if (onProgress) {
    onProgress(2);
    const start = Date.now();
    timer = setInterval(() => {
      const t = (Date.now() - start) / 1000;
      const p = Math.round((1 - Math.exp(-t / 40)) * 100);
      onProgress(Math.max(2, Math.min(92, p)));
    }, 400);
  }
  try {
    const res = await fetch(path, { headers: { accept: "application/pdf" }, signal });
    if (!res.ok) throw new Error("status " + res.status);
    const blob = await res.blob();
    if (!blob.size) throw new Error("empty");
    if (timer) { clearInterval(timer); timer = undefined; }
    onProgress?.(100);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 8000);
    onStatus?.("Готово");
    if (onProgress) setTimeout(() => onProgress(0), 800);
    return true;
  } catch (e) {
    if (timer) clearInterval(timer);
    const reason = signal?.aborted ? "таймаут" : (e instanceof Error ? e.message : "ошибка");
    opts?.onError?.(reason);
    if (signal?.aborted) { onProgress?.(0); return false; }
    onProgress?.(0);
    if (fallback) { onStatus?.("Готовлю PDF в браузере…"); fallback(); }
    else onStatus?.("Не удалось сформировать PDF");
    return false;
  }
}

/**
 * Грузит отрендеренный сервером PDF как байты (без сохранения) — для склейки
 * частей на клиенте (pdf-lib). При ошибке читает текст ответа воркера, чтобы
 * вернуть настоящую причину (например «pdf render failed: …»).
 */
export async function fetchServerPdfBytes(
  path: string,
  opts?: { signal?: AbortSignal; onError?: (info: string) => void },
): Promise<Uint8Array | null> {
  try {
    const res = await fetch(path, { headers: { accept: "application/pdf" }, signal: opts?.signal });
    if (!res.ok) {
      let body = "";
      try { body = (await res.text()).slice(0, 160); } catch { /* ignore */ }
      throw new Error("status " + res.status + (body ? `: ${body}` : ""));
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    if (!buf.length) throw new Error("empty");
    return buf;
  } catch (e) {
    const reason = opts?.signal?.aborted ? "таймаут" : (e instanceof Error ? e.message : "ошибка");
    opts?.onError?.(reason);
    return null;
  }
}

/** Сохраняет готовые байты PDF одним действием (для склеенного файла). */
export function savePdfBytes(bytes: Uint8Array, filename: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 8000);
}
