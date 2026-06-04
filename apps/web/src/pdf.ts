/**
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
    layer.appendChild(head);
  }

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

  const body = document.createElement("div");
  body.className = "pdf-doc-body";
  body.appendChild(clone);
  layer.appendChild(body);

  const foot = document.createElement("div");
  foot.className = "pdf-doc-foot";
  foot.textContent = "ISKCON ONE LOVE · gaurangers.com";
  layer.appendChild(foot);

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
  opts?: { onStatus?: (m: string) => void; fallback?: () => void },
): Promise<void> {
  if (typeof window === "undefined") return;
  const onStatus = opts?.onStatus;
  const fallback = opts?.fallback;
  onStatus?.("Готовлю PDF…");
  try {
    const res = await fetch(path, { headers: { accept: "application/pdf" } });
    if (!res.ok) throw new Error("status " + res.status);
    const blob = await res.blob();
    if (!blob.size) throw new Error("empty");
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
  } catch {
    if (fallback) { onStatus?.("Готовлю PDF в браузере…"); fallback(); }
    else onStatus?.("Не удалось сформировать PDF");
  }
}
