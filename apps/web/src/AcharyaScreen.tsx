/**
 * AcharyaScreen — раздел «Ачарья» поверх канонического реестра. Два режима:
 *
 *  • Лендинг (collection не задан): 4 карточки одного стиля —
 *      1. Шрила Прабхупада (Ачарья-основатель ИСККОН) → страница героя
 *      2. Радха-Кришна лила  → экран лилы
 *      3. Гауранга лила       → экран лилы
 *      4. Шримад Бхагаватам   → экран лилы
 *    + живой поиск по всем героям.
 *
 *  • Экран лилы (collection = 'radha-krishna' | 'gauranga' | 'bhagavatam'):
 *    шапка + «назад» + тематические полки героев этой лилы.
 *
 * Каждая карточка героя открывает EntityPage; книги-читалки уходят в ридер.
 */
import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { BackIcon } from "./ui/icons";

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

function MaskMark({ src, size = 56, pos = "center" }: { src: string; size?: number; pos?: string }) {
  return (
    <span role="img" aria-hidden style={{ display: "block", width: size, height: size, backgroundColor: "var(--color-label)",
      WebkitMaskImage: `url(${src})`, maskImage: `url(${src})`, WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
      WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskPosition: pos, maskPosition: pos }} />
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

  if (items && items.length === 0) return null;

  return (
    <section style={{ marginTop: 24 }}>
      <h3 style={{ margin: "0 0 11px", fontFamily: "var(--font-text)", fontSize: 17, fontWeight: 600, letterSpacing: "-0.2px", color: "var(--color-label)" }}>{title}</h3>
      <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "2px 16px 4px", margin: "0 -16px", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
        {items ? items.map((it) => <EntityTile key={it.id} item={it} onOpen={onOpen} />) : Array.from({ length: 4 }).map((_, i) => <SkeletonTile key={i} />)}
      </div>
    </section>
  );
}

/** Карточка раздела (в стиле карточки Прабхупады). */
function SectionCard({ title, subtitle, mark, accent, onClick }: { title: string; subtitle: string; mark: React.ReactNode; accent?: boolean; onClick: () => void }) {
  const ring: React.CSSProperties = accent
    ? { border: `1.5px solid color-mix(in srgb, ${GOLD} 55%, transparent)`, background: `color-mix(in srgb, ${GOLD} 10%, transparent)` }
    : { border: "none", background: "transparent" };
  return (
    <button type="button" onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 15, width: "100%", padding: "16px", borderRadius: 20,
        border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)", cursor: "pointer", textAlign: "left" }}
      onPointerDown={(e) => (e.currentTarget.style.opacity = "0.7")}
      onPointerUp={(e) => (e.currentTarget.style.opacity = "1")}
      onPointerLeave={(e) => (e.currentTarget.style.opacity = "1")}>
      <span style={{ flexShrink: 0, width: 64, height: 64, borderRadius: "50%", display: "grid", placeItems: "center",
        color: "var(--color-label)", overflow: "hidden", ...ring }}>
        {mark}
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, letterSpacing: "-0.3px", color: "var(--color-label)" }}>{title}</span>
        <span style={{ display: "block", marginTop: 3, fontFamily: "var(--font-text)", fontSize: 13, color: "var(--color-label-2)", lineHeight: 1.4 }}>{subtitle}</span>
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

interface Collection { title: string; subtitle: string; rails: { title: string; params: string; orderIds?: string[] }[] }
const COLLECTIONS: Record<string, Collection> = {
  "radha-krishna": {
    title: "Радха-Кришна лила",
    subtitle: "Вечные игры Господа и Его спутников во Вриндаване",
    rails: [
      { title: "Божественная Чета", params: "ids=krishna,radharani", orderIds: ["krishna", "radharani"] },
      { title: "Гопи", params: "category=gopi&limit=40" },
      { title: "Манджари", params: "category=manjari&limit=30" },
      { title: "Пастушки Враджа", params: "category=gopa&limit=30" },
    ],
  },
  gauranga: {
    title: "Гауранга лила",
    subtitle: "Игры Шри Чайтаньи Махапрабху и Его спутников",
    rails: [
      { title: "Панча-таттва", params: "ids=chaitanya,nityananda,advaita,gadadhara,srivasa", orderIds: ["chaitanya", "nityananda", "advaita", "gadadhara", "srivasa"] },
      { title: "Спутники Гауранги", params: `dataset=${GAURA_DS}&limit=60` },
    ],
  },
  bhagavatam: {
    title: "Шримад Бхагаватам",
    subtitle: "Воплощения и аватары Господа, Его великие преданные",
    rails: [
      { title: "Аватары Кришны", params: "rel=avatar-of&relTo=krishna&limit=20" },
      { title: "Экспансии Кришны", params: "rel=expansion-of&relTo=krishna&limit=10" },
      { title: "Личности «Бхагаватам»", params: "category=bhagavatam&limit=40" },
    ],
  },
};

export default function AcharyaScreen({ collection, onBack, onOpen, onOpenCollection }: {
  collection?: string | null;
  onBack?: () => void;
  onOpen: (id: string, type: string | null) => void;
  onOpenCollection?: (key: string) => void;
}) {
  // ── Режим экрана лилы ──
  if (collection) {
    const col = COLLECTIONS[collection];
    return (
      <div style={{ minHeight: "100%", background: "var(--color-bg)", color: "var(--color-label)" }}>
        <div style={{ position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center", height: 52, padding: "0 8px",
          background: "color-mix(in srgb, var(--color-bg) 86%, transparent)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          borderBottom: "0.5px solid var(--color-hairline)" }}>
          <button type="button" aria-label="Назад" onClick={onBack}
            style={{ display: "grid", height: 38, width: 38, placeItems: "center", borderRadius: "50%", border: "none", background: "none", color: "var(--color-label)", cursor: "pointer" }}>
            <BackIcon size={22} />
          </button>
        </div>
        <div style={{ padding: "8px 16px calc(48px + env(safe-area-inset-bottom,0px))" }}>
          {col ? (
            <>
              <span aria-hidden style={{ display: "block", width: 30, height: 3, borderRadius: 999, background: GOLD, marginBottom: 12 }} />
              <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 27, fontWeight: 800, letterSpacing: "-0.4px", color: "var(--color-label)" }}>{col.title}</h1>
              <p style={{ margin: "5px 0 0", fontFamily: "var(--font-text)", fontSize: 14.5, color: "var(--color-label-2)", lineHeight: 1.45 }}>{col.subtitle}</p>
              {col.rails.map((r) => <Rail key={r.title} title={r.title} params={r.params} orderIds={r.orderIds} onOpen={onOpen} />)}
            </>
          ) : (
            <p style={{ marginTop: 40, textAlign: "center", color: "var(--color-label-3)", fontFamily: "var(--font-text)" }}>Раздел не найден.</p>
          )}
        </div>
      </div>
    );
  }

  // ── Режим лендинга (4 карточки + поиск) ──
  return <AcharyaLanding onOpen={onOpen} onOpenCollection={onOpenCollection} />;
}

function AcharyaLanding({ onOpen, onOpenCollection }: { onOpen: (id: string, type: string | null) => void; onOpenCollection?: (key: string) => void }) {
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
  const openCol = (k: string) => onOpenCollection?.(k);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.4px", textTransform: "uppercase", color: "var(--color-brand-blue)" }}>Личности</div>
        <h2 style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 700, letterSpacing: "-0.3px", color: "var(--color-label)", fontFamily: "var(--font-text)" }}>Герои</h2>
        <p style={{ margin: "4px 0 0", fontFamily: "var(--font-text)", fontSize: 14, color: "var(--color-label-2)", lineHeight: 1.4 }}>Господь, Его воплощения и вечные спутники</p>
      </div>

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
        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          <SectionCard
            title="Шрила Прабхупада"
            subtitle="Его Божественная Милость А.Ч. Бхактиведанта Свами — Ачарья-основатель Международного общества сознания Кришны (ИСККОН)"
            mark={<MaskMark src="/prabhupada.svg" size={56} pos="center bottom" />}
            accent
            onClick={() => onOpen("prabhupada", "personality")}
          />
          <SectionCard
            title="Радха-Кришна лила"
            subtitle="Вечные игры Господа и Его спутников во Вриндаване"
            mark={<MaskMark src="/vraj.svg" size={48} />}
            onClick={() => openCol("radha-krishna")}
          />
          <SectionCard
            title="Гауранга лила"
            subtitle="Шри Чайтанья Махапрабху и Панча-таттва"
            mark={<MaskMark src="/gauranga.svg" size={48} />}
            onClick={() => openCol("gauranga")}
          />
          <SectionCard
            title="Шримад Бхагаватам"
            subtitle="Воплощения и аватары Господа, Его великие преданные"
            mark={<MaskMark src="/bbt.svg" size={48} />}
            onClick={() => openCol("bhagavatam")}
          />
        </div>
      )}
    </div>
  );
}
