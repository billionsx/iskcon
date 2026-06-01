import { useEffect, useState } from "react";
import { api } from "./api";

interface BhajanDetail {
  slug: string;
  name: string;
  author: string | null;
  hero_image: string | null;
  translit: string | null;
  translation: string | null;
  body: string;
}

function Layer({ label, text, italic }: { label: string; text: string; italic?: boolean }) {
  return (
    <section style={{ marginTop: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "1.6px", textTransform: "uppercase", color: "var(--color-label-2)", marginBottom: 10 }}>{label}</div>
      <div style={{ fontStyle: italic ? "italic" : "normal", fontSize: italic ? 17 : 18, lineHeight: italic ? 1.85 : 1.72, color: "var(--color-label)", whiteSpace: "pre-line" }}>{text}</div>
    </section>
  );
}

export default function BhajanDetailPage({ slug, onBack }: { slug: string; onBack: () => void }) {
  const [data, setData] = useState<BhajanDetail | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let live = true;
    setData(null);
    setErr(false);
    fetch(api(`/bhajans/detail?slug=${encodeURIComponent(slug)}`))
      .then((r) => r.json())
      .then((d) => { if (live) { if (d && typeof d.body === "string") setData(d); else setErr(true); } })
      .catch(() => { if (live) setErr(true); });
    return () => { live = false; };
  }, [slug]);

  const hasLayers = !!(data && (data.translit || data.translation));

  return (
    <div style={{ minHeight: "100%", background: "var(--color-bg)" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 30, height: 56, display: "flex", alignItems: "center", gap: 6, padding: "0 8px", borderBottom: "0.5px solid var(--color-hairline)", background: "var(--color-bg)" }}>
        <button aria-label="Назад" onClick={onBack} style={{ display: "grid", height: 40, width: 40, placeItems: "center", borderRadius: "50%", border: "none", background: "none", cursor: "pointer", color: "var(--color-label)" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0, fontSize: 15.5, fontWeight: 700, color: "var(--color-label)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{data?.name ?? "Бхаджан"}</div>
      </header>

      {!data && !err && <div style={{ textAlign: "center", color: "var(--color-label-2)", padding: "48px 0", fontSize: 15 }}>Загрузка…</div>}
      {err && <div style={{ textAlign: "center", color: "var(--color-label-2)", padding: "48px 16px", fontSize: 15 }}>Не удалось загрузить бхаджан.</div>}

      {data && (
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 0 56px" }}>
          {data.hero_image && (
            <img src={data.hero_image} alt="" loading="lazy" style={{ width: "100%", maxHeight: 240, objectFit: "cover", display: "block" }} />
          )}
          <div style={{ padding: "22px 22px 0" }}>
            <h1 style={{ margin: 0, fontSize: 27, lineHeight: 1.12, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--color-label)" }}>{data.name}</h1>
            {data.author && <div style={{ marginTop: 6, fontSize: 15, color: "var(--color-label-2)" }}>{data.author}</div>}

            {hasLayers ? (
              <>
                {data.translit && <Layer label="Транслитерация" text={data.translit} italic />}
                {data.translation && <Layer label="Перевод" text={data.translation} />}
              </>
            ) : (
              <div style={{ marginTop: 22, fontSize: 18, lineHeight: 1.72, color: "var(--color-label)", whiteSpace: "pre-line" }}>{data.body}</div>
            )}

            <div style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderRadius: 14, background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)", color: "var(--color-label-2)" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
              <span style={{ fontSize: 14 }}>Аудио — скоро</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
