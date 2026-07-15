/**
 * NewsFeed — субтаб «Новости» Даршана: бесконечная лента новостных карточек из
 * /api/news (кейсет-курсор). Раскрытие карточки помним по слагу. Отдельный от
 * общей «Ленты» экран: здесь новости идут вглубь по всему архиву, а «Лента»
 * показывает лишь свежие вперемешку с постами канала.
 */
import { useEffect, useRef, useState } from "react";
import { newsClient } from "./api";
import { NewsCard } from "./NewsCard";
import type { NewsItem } from "./types";

const GOLD = "var(--color-gold)";

export function NewsFeed() {
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [err, setErr] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = (m: string) => { setToast(m); if (toastT.current) clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(null), 2400); };

  const cursorRef = useRef<string | null>(null);
  const loadingMore = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    newsClient.list()
      .then((p) => { setItems(p.items); cursorRef.current = p.cursor; setHasMore(p.hasMore); })
      .catch(() => setErr(true));
  }, []);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !items || !hasMore) return;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      if (loadingMore.current) return;
      loadingMore.current = true;
      newsClient.list(cursorRef.current)
        .then((p) => {
          setItems((cur) => {
            const seen = new Set((cur || []).map((x) => x.id));
            return [...(cur || []), ...p.items.filter((x) => !seen.has(x.id))];
          });
          cursorRef.current = p.cursor;
          if (!p.hasMore || p.items.length === 0) setHasMore(false);
        })
        .catch(() => setHasMore(false))
        .finally(() => { loadingMore.current = false; });
    }, { rootMargin: "900px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [items, hasMore]);

  return (
    <div>
      <style>{`@keyframes feedspin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ padding: "20px 0 0" }}>
        <p style={{ margin: 0, fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", lineHeight: 1.5, color: "var(--color-label-2)" }}>
          Новости Движения сознания Кришны со всего мира — репортажи общин, события и объявления официальных агентств ИСККОН, переведённые на русский.
        </p>
      </div>

      <div style={{ marginTop: 24 }} aria-live="polite">
        {err && (
          <div style={{ padding: "44px 16px", textAlign: "center", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", color: "var(--color-label-3)" }}>
            Новости временно недоступны.
          </div>
        )}
        {!err && !items && (
          <div style={{ display: "grid", gap: 20 }}>
            {[0, 1, 2].map((i) => <div key={i} style={{ height: 320, background: "var(--color-bg)", borderRadius: 20, opacity: 0.6 }} />)}
          </div>
        )}
        {items && items.length > 0 && (
          <div style={{ display: "grid", gap: 20 }}>
            {items.map((n) => (
              <NewsCard key={n.id} n={n} open={open.has(n.slug)} flash={flash}
                onToggle={() => setOpen((s) => { const x = new Set(s); if (x.has(n.slug)) x.delete(n.slug); else x.add(n.slug); return x; })} />
            ))}
          </div>
        )}
        {items && items.length > 0 && hasMore && (
          <div ref={sentinelRef} aria-hidden style={{ padding: "18px 0", display: "grid", placeItems: "center" }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", border: "2.5px solid var(--color-hairline)", borderTopColor: GOLD, animation: "feedspin .8s linear infinite" }} />
          </div>
        )}
        {items && items.length === 0 && (
          <div style={{ padding: "44px 16px", textAlign: "center", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", lineHeight: 1.55, color: "var(--color-label-3)" }}>
            Новости скоро появятся.
          </div>
        )}
      </div>

      {toast && (
        <div style={{ position: "fixed", left: "50%", bottom: 96, transform: "translateX(-50%)", zIndex: 2200, background: "rgba(28,28,30,0.96)", color: "#fff", padding: "13px 18px", borderRadius: 14, fontSize: "var(--text-footnote)", lineHeight: 1.5, fontFamily: "var(--font-text)", boxShadow: "0 12px 40px rgba(0,0,0,0.3)", width: "calc(100% - 40px)", maxWidth: 380, textAlign: "center" }}>{toast}</div>
      )}
    </div>
  );
}

/* ── Фокус одной новости по слагу (deep-link /darshan/news/<slug>) ── */
export function NewsFocus({ slug, onBack }: { slug: string; onBack: () => void }) {
  const [item, setItem] = useState<NewsItem | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [toast, setToast] = useState("");
  const flash = (m: string) => { setToast(m); window.setTimeout(() => setToast(""), 2400); };

  useEffect(() => {
    let live = true;
    newsClient.bySlug(slug)
      .then((n) => { if (!live) return; setItem(n); setState(n ? "ok" : "error"); })
      .catch(() => { if (live) setState("error"); });
    return () => { live = false; };
  }, [slug]);

  return (
    <div style={{ minHeight: "100dvh", background: "var(--color-bg)" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center", height: 52, padding: "0 8px",
        background: "color-mix(in srgb, var(--color-bg) 86%, transparent)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderBottom: "0.5px solid var(--color-hairline)" }}>
        <button type="button" aria-label="Назад" onClick={onBack}
          style={{ display: "grid", height: 38, width: 38, placeItems: "center", borderRadius: "50%", border: "none", background: "none", color: "var(--color-label)", cursor: "pointer" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <span style={{ flex: 1, minWidth: 0, textAlign: "center", fontFamily: "var(--font-text)", fontSize: "var(--text-callout)", fontWeight: 700, letterSpacing: "0.04em", color: "var(--color-label)", paddingRight: 38 }}>Новости ИСККОН</span>
      </header>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px 0 40px" }}>
        <style>{`@keyframes feedspin{to{transform:rotate(360deg)}}`}</style>
        {state === "loading" && (
          <div style={{ padding: "40px 0", display: "grid", placeItems: "center" }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", border: "2.5px solid var(--color-hairline)", borderTopColor: GOLD, animation: "feedspin .8s linear infinite" }} />
          </div>
        )}
        {state === "error" && (
          <div style={{ padding: "40px 16px", textAlign: "center", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", color: "var(--color-label-3)" }}>
            Не удалось открыть новость.
          </div>
        )}
        {state === "ok" && item && <NewsCard n={item} open flash={flash} onToggle={() => {}} />}
      </div>
      {toast && (
        <div style={{ position: "fixed", left: "50%", bottom: 96, transform: "translateX(-50%)", zIndex: 2200, background: "rgba(28,28,30,0.96)", color: "#fff", padding: "13px 18px", borderRadius: 14, fontSize: "var(--text-footnote)", lineHeight: 1.5, fontFamily: "var(--font-text)", boxShadow: "0 12px 40px rgba(0,0,0,0.3)", width: "calc(100% - 40px)", maxWidth: 380, textAlign: "center" }}>{toast}</div>
      )}
    </div>
  );
}
