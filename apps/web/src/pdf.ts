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

  let done = false;
  let safety: ReturnType<typeof setTimeout>;
  const cleanup = () => {
    if (done) return;
    done = true;
    clearTimeout(safety);
    document.body.classList.remove("printing");
    if (layer.parentNode) layer.parentNode.removeChild(layer);
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
