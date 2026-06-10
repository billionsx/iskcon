/**
 * AcharyaScreen — витрина раздела «Ачарья» поверх канонического реестра.
 * Классификация (сверху вниз):
 *   1. Шрила Прабхупада (Ачарья-основатель ИСККОН) — первый.
 *   2. Радха-Кришна лила  — Божественная Чета, гопи, манджари, пастушки Враджа.
 *   3. Гауранга лила      — Панча-таттва и спутники Шри Чайтаньи.
 *   4. Шримад Бхагаватам  — все аватары и экспансии Кришны, личности «Бхагаватам».
 * Плюс живой поиск по всем героям. Каждая карточка открывает EntityPage;
 * книги-читалки уходят в ридер через onOpen.
 */
import { useEffect, useRef, useState } from "react";
import { api } from "./api";

const GOLD = "#D2AA1B";

interface Item {
  id: string;
  type: string | null;
  tattva: string | null;
  name_ru: string | null;
  name_en: string | null;
  name_iast: string | null;
  note: string | null;
}

function Monogram({ ch, size = 54 }: { ch: string; size?: number }) {
  return (
    <div style={{ flexShrink: 0, width: size, height: size, borderRadius: "50%", display: "grid", placeItems: "center",
      border: `1.5px solid color-mix(in srgb, ${GOLD} 55%, transparent)`,
      background: `color-mix(in srgb, ${GOLD} 9%, transparent)`,
      color: GOLD, fontFamily: "var(--font-scripture)", fontStyle: "italic", fontWeight: 600, fontSize: size * 0.42, lineHeight: 1 }}>
      {ch}
    </div>
  );
}

function initialOf(it: Item): string {
  return (it.name_iast || it.name_ru || "?").trim().charAt(0).toUpperCase();
}

function EntityTile({ item, onOpen }: { item: Item; onOpen: (id: string, type: string | null) => void }) {
  return (
    <button type="button" onClick={() => onOpen(item.id, item.type)}
      style={{ flexShrink: 0, width: 140, display: "flex", flexDirection: "column", alignItems: "center", gap: 9, padding: "16px 10px",
        borderRadius: 18, border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)", cursor: "pointer", textAlign: "center" }}
      onPointerDown={(e) => (e.currentTarget.style.opacity = "0.6")}
      onPointerUp={(e) => (e.currentTarget.style.opacity = "1")}
      onPointerLeave={(e) => (e.currentTarget.style.opacity = "1")}>
      <Monogram ch={initialOf(item)} size={54} />
      <div style={{ fontFamily: "var(--font-text)", fontSize: 14, fontWeight: 600, color: "var(--color-label)", lineHeight: 1.25,
        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", width: "100%" }}>{item.name_ru || item.id}</div>
      {item.name_iast && (
        <div style={{ fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 12, color: "var(--color-label-3)", lineHeight: 1.2,
          display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden", width: "100%" }}>{item.name_iast}</div>
      )}
    </button>
  );
}

function SkeletonTile() {
  return <div style={{ flexShrink: 0, width: 140, height: 132, borderRadius: 18, background: "var(--color-fill-1)", opacity: 0.6 }} />;
}

function Rail({ title, params, orderIds, onOpen }: { title: string; params: string; orderIds?: string[]; onOpen: (id: string, type: string | null) => void }) {
  const [items, setItems] = useState<Item[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(api(`/entities?${params}`))
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        let arr = (d.items as Item[]) ?? [];
        if (orderIds) arr = [...arr].sort((a, b) => orderIds.indexOf(a.id) - orderIds.indexOf(b.id));
        setItems(arr);
      })
      .catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, [params]);

  if (items && items.length === 0) return null; // пустую полку не показываем

  return (
    <section style={{ marginTop: 20 }}>
      <h3 style={{ margin: "0 0 11px", fontFamily: "var(--font-text)", fontSize: 16, fontWeight: 600, letterSpacing: "-0.2px", color: "var(--color-label)" }}>{title}</h3>
      <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "2px 16px 4px", margin: "0 -16px", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
        {items ? items.map((it) => <EntityTile key={it.id} item={it} onOpen={onOpen} />) : Array.from({ length: 4 }).map((_, i) => <SkeletonTile key={i} />)}
      </div>
    </section>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginTop: 38 }}>
      <span aria-hidden style={{ display: "block", width: 30, height: 3, borderRadius: 999, background: GOLD, marginBottom: 11 }} />
      <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 23, fontWeight: 800, letterSpacing: "-0.4px", color: "var(--color-label)" }}>{title}</h2>
      {subtitle && <p style={{ margin: "3px 0 0", fontFamily: "var(--font-text)", fontSize: 13.5, color: "var(--color-label-3)", lineHeight: 1.4 }}>{subtitle}</p>}
    </div>
  );
}

function FeaturedPrabhupada({ onOpen }: { onOpen: (id: string, type: string | null) => void }) {
  return (
    <button type="button" onClick={() => onOpen("prabhupada", "personality")}
      style={{ display: "flex", alignItems: "center", gap: 15, width: "100%", padding: "16px", borderRadius: 20,
        border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)", cursor: "pointer", textAlign: "left" }}
      onPointerDown={(e) => (e.currentTarget.style.opacity = "0.7")}
      onPointerUp={(e) => (e.currentTarget.style.opacity = "1")}
      onPointerLeave={(e) => (e.currentTarget.style.opacity = "1")}>
      <span style={{ flexShrink: 0, width: 64, height: 64, borderRadius: "50%", display: "grid", placeItems: "center",
        border: `1.5px solid color-mix(in srgb, ${GOLD} 55%, transparent)`, background: `color-mix(in srgb, ${GOLD} 10%, transparent)`, overflow: "hidden" }}>
        <span role="img" aria-label="Шрила Прабхупада" style={{ display: "block", width: 56, height: 56, backgroundColor: "var(--color-label)",
          WebkitMaskImage: "url(/prabhupada.svg)", maskImage: "url(/prabhupada.svg)", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
          WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskPosition: "center bottom", maskPosition: "center bottom" }} />
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, letterSpacing: "-0.3px", color: "var(--color-label)" }}>Шрила Прабхупада</span>
        <span style={{ display: "block", marginTop: 3, fontFamily: "var(--font-text)", fontSize: 13, color: "var(--color-label-2)", lineHeight: 1.4 }}>Его Божественная Милость А.Ч. Бхактиведанта Свами — Ачарья-основатель Международного общества сознания Кришны (ИСККОН)</span>
      </span>
      <span style={{ flexShrink: 0, alignSelf: "flex-start", color: "var(--color-label-3)", fontSize: 22, lineHeight: 1, marginTop: 2 }}>›</span>
    </button>
  );
}

function ResultRow({ item, onOpen }: { item: Item; onOpen: (id: string, type: string | null) => void }) {
  return (
    <button type="button" onClick={() => onOpen(item.id, item.type)}
      style={{ display: "flex", alignItems: "center", gap: 13, width: "100%", padding: "11px 4px", background: "none", border: "none",
        borderBottom: "0.5px solid var(--color-hairline)", cursor: "pointer", textAlign: "left" }}>
      <Monogram ch={initialOf(item)} size={40} />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: 16, fontWeight: 600, color: "var(--color-label)", lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name_ru || item.id}</span>
        {item.name_iast && <span style={{ display: "block", fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 13, color: "var(--color-label-3)" }}>{item.name_iast}</span>}
      </span>
      <span style={{ flexShrink: 0, color: "var(--color-label-3)", fontSize: 20, lineHeight: 1 }}>›</span>
    </button>
  );
}

const GAURA_DS = encodeURIComponent("Гаура-ганоддеша-дипика · Гаура-лила");

export default function AcharyaScreen({ onOpen }: { onOpen: (id: string, type: string | null) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Item[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const query = q.trim();
    if (timer.current) clearTimeout(timer.current);
    if (query.length < 2) { setResults(null); return; }
    timer.current = setTimeout(() => {
      fetch(api(`/entities?q=${encodeURIComponent(query)}&limit=40`))
        .then((r) => r.json())
        .then((d) => setResults((d.items as Item[]) ?? []))
        .catch(() => setResults([]));
    }, 220);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q]);

  const searching = q.trim().length >= 2;

  return (
    <div>
      {/* лид */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.4px", textTransform: "uppercase", color: "var(--color-brand-blue)" }}>Реестр</div>
        <h2 style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 700, letterSpacing: "-0.3px", color: "var(--color-label)", fontFamily: "var(--font-text)" }}>Ачарья</h2>
        <p style={{ margin: "4px 0 0", fontFamily: "var(--font-text)", fontSize: 14, color: "var(--color-label-2)", lineHeight: 1.4 }}>Господь, Его воплощения и вечные спутники</p>
      </div>

      {/* поиск */}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по героям…" inputMode="search"
        style={{ width: "100%", boxSizing: "border-box", padding: "12px 15px", borderRadius: 14, border: "0.5px solid var(--color-hairline)",
          background: "var(--color-bg-2)", fontFamily: "var(--font-text)", fontSize: 16, color: "var(--color-label)", outline: "none" }} />

      {searching ? (
        <div style={{ marginTop: 14 }}>
          {results === null && <div style={{ padding: "20px 0", textAlign: "center", color: "var(--color-label-3)", fontFamily: "var(--font-text)", fontSize: 15 }}>Поиск…</div>}
          {results && results.length === 0 && <div style={{ padding: "20px 0", textAlign: "center", color: "var(--color-label-3)", fontFamily: "var(--font-text)", fontSize: 15 }}>Ничего не найдено</div>}
          {results && results.map((it) => <ResultRow key={it.id} item={it} onOpen={onOpen} />)}
        </div>
      ) : (
        <>
          {/* 1. Шрила Прабхупада — первый */}
          <div style={{ marginTop: 18 }}>
            <FeaturedPrabhupada onOpen={onOpen} />
          </div>

          {/* 2. Радха-Кришна лила */}
          <SectionHeader title="Радха-Кришна лила" subtitle="Вечные игры Господа во Вриндаване" />
          <Rail title="Божественная Чета" params="ids=krishna,radharani" orderIds={["krishna", "radharani"]} onOpen={onOpen} />
          <Rail title="Гопи" params="category=gopi&limit=30" onOpen={onOpen} />
          <Rail title="Манджари" params="category=manjari&limit=20" onOpen={onOpen} />
          <Rail title="Пастушки Враджа" params="category=gopa&limit=20" onOpen={onOpen} />

          {/* 3. Гауранга лила (сюда же относится Шрила Прабхупада и парампара) */}
          <SectionHeader title="Гауранга лила" subtitle="Игры Шри Чайтаньи Махапрабху и Его спутников" />
          <Rail title="Панча-таттва" params="ids=chaitanya,nityananda,advaita,gadadhara,srivasa" orderIds={["chaitanya", "nityananda", "advaita", "gadadhara", "srivasa"]} onOpen={onOpen} />
          <Rail title="Спутники Гауранги" params={`dataset=${GAURA_DS}&limit=24`} onOpen={onOpen} />

          {/* 4. Шримад Бхагаватам — все аватары и экспансии */}
          <SectionHeader title="Шримад Бхагаватам" subtitle="Воплощения Господа и Его великие преданные" />
          <Rail title="Аватары Кришны" params="rel=avatar-of&relTo=krishna&limit=20" onOpen={onOpen} />
          <Rail title="Экспансии Кришны" params="rel=expansion-of&relTo=krishna&limit=10" onOpen={onOpen} />
          <Rail title="Личности «Бхагаватам»" params="category=bhagavatam&limit=24" onOpen={onOpen} />
        </>
      )}
    </div>
  );
}
