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

  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    document.body.classList.remove("printing");
    if (layer.parentNode) layer.parentNode.removeChild(layer);
    document.title = prevTitle;
    window.removeEventListener("afterprint", cleanup);
    window.removeEventListener("focus", onFocus);
  };
  // afterprint is the reliable signal on desktop; focus covers browsers that
  // skip it (it fires only after the print/share UI is dismissed).
  const onFocus = () => { setTimeout(cleanup, 300); };
  window.addEventListener("afterprint", cleanup);
  window.addEventListener("focus", onFocus);

  // let the clone lay out before invoking the dialog
  setTimeout(() => window.print(), 60);
}
