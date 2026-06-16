/**
 * SearchScreen — глобальный поиск по всему приложению.
 * v1: Личности (граф /entities?q=) + Книги (каталог BOOKS). Открывается из верхней
 * панели (иконка поиска) и по маршруту /search. Дверь в граф (мандир в девайсе).
 */
import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { BOOKS, bookFullTitle } from "./books";

type Item = { id: string; name_ru?: string; name_iast?: string; type?: string | null; kind?: string | null };

function BackIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Monogram({ ch, size = 40 }: { ch: string; size?: number }) {
  return (
    <span style={{ flexShrink: 0, width: size, height: size, borderRadius: "50%", display: "grid", placeItems: "center",
      background: "var(--color-bg-3)", color: "var(--color-label-2)", fontFamily: "var(--font-display)", fontSize: size * 0.42, fontWeight: 700 }}>
      {ch}
    </span>
  );
}

export default function SearchScreen({ onBack, onOpenEntity, onOpenBook }: {
  onBack: () => void;
  onOpenEntity: (id: string, type: string | null) => void;
  onOpenBook: (work: string) => void;
}) {
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<Item[] | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Книги — клиентский фильтр по каталогу.
  const query = q.trim().toLowerCase();
  const bookHits = query.length < 2 ? [] : Object.keys(BOOKS).filter((k) => {
    const b = (BOOKS as Record<string, unknown>)[k];
    const title = bookFullTitle(b as never) || k;
    return title.toLowerCase().includes(query) || k.toLowerCase().includes(query);
  });

  // Личности — серверный поиск по графу.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (query.length < 2) { setPeople(null); return; }
    timer.current = setTimeout(() => {
      fetch(api(`/entities?q=${encodeURIComponent(q.trim())}&limit=40`))
        .then((r) => r.json())
        .then((d) => setPeople((d.items as Item[]) ?? []))
        .catch(() => setPeople([]));
    }, 200);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q]);

  const searching = query.length >= 2;
  const nothing = searching && people !== null && people.length === 0 && bookHits.length === 0;

  return (
    <div style={{ minHeight: "100%", background: "var(--color-bg)", color: "var(--color-label)" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center", gap: 8, height: 56, padding: "0 10px",
        background: "color-mix(in srgb, var(--color-bg) 90%, transparent)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        borderBottom: "0.5px solid var(--color-hairline)" }}>
        <button type="button" aria-label="Назад" onClick={onBack}
          style={{ flexShrink: 0, display: "grid", height: 38, width: 38, placeItems: "center", borderRadius: "50%", border: "none", background: "none", color: "var(--color-label)", cursor: "pointer" }}>
          <BackIcon size={22} />
        </button>
        <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по всему приложению…" inputMode="search"
          style={{ flex: 1, minWidth: 0, boxSizing: "border-box", padding: "11px 14px", borderRadius: 12, border: "0.5px solid var(--color-hairline)",
            background: "var(--color-bg-2)", fontFamily: "var(--font-text)", fontSize: 16, color: "var(--color-label)", outline: "none" }} />
      </div>

      <div style={{ padding: "10px 16px calc(40px + env(safe-area-inset-bottom,0px))" }}>
        {!searching && (
          <p style={{ marginTop: 28, textAlign: "center", color: "var(--color-label-3)", fontFamily: "var(--font-text)", fontSize: 15, lineHeight: 1.5 }}>
            Личности, стихи, книги, киртаны, центры…<br />начните вводить имя или название.
          </p>
        )}

        {nothing && (
          <p style={{ marginTop: 28, textAlign: "center", color: "var(--color-label-3)", fontFamily: "var(--font-text)", fontSize: 15 }}>Ничего не найдено</p>
        )}

        {searching && people && people.length > 0 && (
          <section style={{ marginTop: 8 }}>
            <h3 style={{ margin: "0 0 6px", fontFamily: "var(--font-text)", fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", color: "var(--color-label-3)" }}>Личности</h3>
            {people.map((it) => (
              <div key={it.id} role="button" tabIndex={0} onClick={() => onOpenEntity(it.id, it.type ?? null)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenEntity(it.id, it.type ?? null); } }}
                style={{ display: "flex", alignItems: "center", gap: 13, padding: "11px 4px", borderBottom: "0.5px solid var(--color-hairline)", cursor: "pointer", textAlign: "left" }}>
                <Monogram ch={(it.name_ru || it.id || "?").trim()[0]?.toUpperCase() || "?"} />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: 16, fontWeight: 600, color: "var(--color-label)", lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.name_ru || it.id}</span>
                  {it.name_iast && <span style={{ display: "block", fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 13, color: "var(--color-label-3)" }}>{it.name_iast}</span>}
                </span>
                <span style={{ flexShrink: 0, color: "var(--color-label-3)", fontSize: 20 }}>›</span>
              </div>
            ))}
          </section>
        )}

        {searching && bookHits.length > 0 && (
          <section style={{ marginTop: 22 }}>
            <h3 style={{ margin: "0 0 6px", fontFamily: "var(--font-text)", fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", color: "var(--color-label-3)" }}>Книги</h3>
            {bookHits.map((k) => (
              <div key={k} role="button" tabIndex={0} onClick={() => onOpenBook(k)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenBook(k); } }}
                style={{ display: "flex", alignItems: "center", gap: 13, padding: "11px 4px", borderBottom: "0.5px solid var(--color-hairline)", cursor: "pointer", textAlign: "left" }}>
                <Monogram ch={(bookFullTitle((BOOKS as Record<string, unknown>)[k] as never) || k).trim()[0]?.toUpperCase() || "К"} />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: 16, fontWeight: 600, color: "var(--color-label)", lineHeight: 1.3 }}>{bookFullTitle((BOOKS as Record<string, unknown>)[k] as never) || k}</span>
                </span>
                <span style={{ flexShrink: 0, color: "var(--color-label-3)", fontSize: 20 }}>›</span>
              </div>
            ))}
          </section>
        )}

        {searching && people === null && bookHits.length === 0 && (
          <p style={{ marginTop: 24, textAlign: "center", color: "var(--color-label-3)", fontFamily: "var(--font-text)", fontSize: 15 }}>Поиск…</p>
        )}
      </div>
    </div>
  );
}
