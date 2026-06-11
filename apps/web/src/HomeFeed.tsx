/**
 * HomeFeed — «Лента ISKCON»: интеграция с публичным Telegram-каналом @iskcone.
 * Посты приходят с воркера (/api/tg/iskcone — парсинг t.me/s/iskcone, кеш 10 мин).
 * Карточка: дата · текст · фото · просмотры · «Открыть в Telegram».
 */
import { useEffect, useState } from "react";
import { api } from "./api";

const GOLD = "#D2AA1B";
const fill: React.CSSProperties = { background: "var(--color-glass-thin)", borderRadius: 20 };

interface TgPost { id: string; date: string; text: string; photo: string | null; views: string }

function fmtDate(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  } catch { return ""; }
}

export function HomeFeed() {
  const [posts, setPosts] = useState<TgPost[] | null>(null);
  const [err, setErr] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  useEffect(() => {
    fetch(api("/tg/iskcone"))
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((j) => setPosts(j.posts || []))
      .catch(() => setErr(true));
  }, []);

  return (
    <div>
      <div style={{ padding: "20px 0 0" }}>
        <div style={{ fontFamily: "var(--font-text)", fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLD }}>Telegram</div>
        <h2 style={{ margin: "5px 0 0", fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800, letterSpacing: "-0.022em", lineHeight: 1.1, color: "var(--color-label)" }}>Лента ISKCON</h2>
        <p style={{ margin: "8px 0 0", fontFamily: "var(--font-text)", fontSize: 14, lineHeight: 1.5, color: "var(--color-label-2)" }}>
          Живая лента канала <a href="https://t.me/iskcone" target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-brand-blue)", textDecoration: "none", fontWeight: 600 }}>@iskcone</a> — вдохновение, события и материалы движения.
        </p>
      </div>

      <div style={{ marginTop: 16 }} aria-live="polite">
        {err && (
          <div style={{ padding: "30px 10px", textAlign: "center", fontFamily: "var(--font-text)", fontSize: 14.5, lineHeight: 1.55, color: "var(--color-label-3)" }}>
            Лента временно недоступна.<br />
            <a href="https://t.me/iskcone" target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-brand-blue)", textDecoration: "none", fontWeight: 600 }}>Открыть канал в Telegram →</a>
          </div>
        )}
        {!err && !posts && (
          <div style={{ display: "grid", gap: 12 }}>
            {[0, 1, 2].map((i) => <div key={i} style={{ height: 180, ...fill, opacity: 0.6 }} />)}
          </div>
        )}
        {posts && posts.length > 0 && (
          <div style={{ display: "grid", gap: 12 }}>
            {posts.map((p) => {
              const long = p.text.length > 420;
              const open = expanded.has(p.id);
              const shown = long && !open ? p.text.slice(0, 400).replace(/\s+\S*$/, "") + "…" : p.text;
              return (
                <article key={p.id} style={{ overflow: "hidden", ...fill }}>
                  {p.photo && (
                    <div style={{ background: "var(--color-glass-regular)" }}>
                      <img src={p.photo} alt="" loading="lazy" style={{ width: "100%", display: "block", aspectRatio: "16 / 10", objectFit: "cover" }} />
                    </div>
                  )}
                  <div style={{ padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-text)", fontSize: 12, color: "var(--color-label-3)" }}>
                      <span>{fmtDate(p.date)}</span>
                      {p.views && <><span aria-hidden>·</span><span>{p.views} просмотров</span></>}
                    </div>
                    {shown && (
                      <p style={{ margin: "8px 0 0", fontFamily: "var(--font-text)", fontSize: 14.5, lineHeight: 1.55, letterSpacing: "-0.01em", color: "var(--color-label)", whiteSpace: "pre-wrap" }}>{shown}</p>
                    )}
                    <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 14 }}>
                      {long && (
                        <button type="button" onClick={() => setExpanded((s) => { const n = new Set(s); if (open) n.delete(p.id); else n.add(p.id); return n; })}
                          style={{ padding: 0, background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-text)", fontSize: 13.5, fontWeight: 600, color: "var(--color-label-2)", WebkitTapHighlightColor: "transparent" }}>
                          {open ? "Свернуть" : "Читать полностью"}
                        </button>
                      )}
                      <a href={`https://t.me/iskcone/${p.id}`} target="_blank" rel="noopener noreferrer"
                        style={{ display: "inline-flex", alignItems: "center", gap: 3, fontFamily: "var(--font-text)", fontSize: 13.5, fontWeight: 600, color: "var(--color-brand-blue)", textDecoration: "none" }}>
                        Открыть в Telegram
                        <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden><path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {posts && posts.length === 0 && !err && (
          <div style={{ padding: "30px 10px", textAlign: "center", fontFamily: "var(--font-text)", fontSize: 14.5, color: "var(--color-label-3)" }}>
            Постов пока нет. <a href="https://t.me/iskcone" target="_blank" rel="noopener noreferrer" style={{ color: "var(--color-brand-blue)", textDecoration: "none", fontWeight: 600 }}>Открыть канал →</a>
          </div>
        )}
      </div>
    </div>
  );
}
