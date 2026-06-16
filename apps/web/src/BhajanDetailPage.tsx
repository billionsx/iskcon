/**
 * BhajanDetailPage — ПКБ (Подробная Карточка Бхаджана) по книжному стандарту
 * читалки (ScriptureReader): scroll-edge навбар (назад + титул на скролле) →
 * выразительная чистая шапка (eyebrow-категория · крупное название · автор ·
 * действия) БЕЗ тёмной карточки и налезаний → стихи, каждый — отдельная богатая
 * карточка (Стих N · транслитерация Georgia-курсивом · перевод SF).
 *
 * Интерфейс — SF (var(--font-text/display)); священный текст — Georgia
 * (var(--font-scripture)). Размеры/цвета/радиусы/ритм — токены ui/globals.css.
 * Действия (избранное · наушники · ⋯) и меню — общий слой cardActions; меню в
 * варианте «bhajan» (Поделиться · QR · Задонатить · Сообщить — без книжного PDF).
 */
import { useEffect, useRef, useState } from "react";
import type { SVGProps } from "react";
import { api } from "./api";
import { RoundBtn, useFavorite, useCardActions } from "./cardActions";
import { NotesAtSource } from "./NotesAtSource";
import { HeartIcon, HeadphonesIcon, MoreIcon } from "./ui/icons";

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> { size?: number; }
const sp = ({ size = 24 }: IconProps) => ({ width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true as const });
const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function BackIcon(p: IconProps) { return <svg {...sp(p)}><path {...STROKE} d="M15 5l-7 7 7 7" /></svg>; }

interface Verse { ord: number; translit: string | null; text: string | null; signature: string | null; }
interface BhajanDetail {
  slug: string; name: string; author: string | null; hero_image: string | null;
  category: string | null; source_text: string | null; section: string | null;
  verses: Verse[]; translit: string | null; translation: string | null;
  body: string; pending: boolean;
}

function verseLabel(ord: number): string { return `Стих ${ord}`; }

/* eyebrow-метка (Caption2, uppercase, трекинг) */
function Eyebrow({ children, blue }: { children: React.ReactNode; blue?: boolean }) {
  return <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: "var(--weight-semibold)", letterSpacing: "var(--tracking-wide)", textTransform: "uppercase", color: blue ? "var(--color-brand-blue)" : "var(--color-label-2)" }}>{children}</div>;
}

/** Богатая карточка одного стиха: метка · транслитерация (Georgia курсив) · перевод (SF). */
function VerseCard({ v }: { v: Verse }) {
  return (
    <section style={{ borderRadius: "var(--radius-lg)", background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)", padding: "var(--space-5)" }}>
      <Eyebrow blue>{verseLabel(v.ord)}</Eyebrow>
      {v.translit && (
        <div style={{ marginTop: "var(--space-3)", fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 18.5, lineHeight: 1.72, color: "var(--color-label)", whiteSpace: "pre-line" }}>{v.translit}</div>
      )}
      {v.text && (
        <div style={{ marginTop: v.translit ? "var(--space-4)" : "var(--space-3)", paddingTop: v.translit ? "var(--space-4)" : 0, borderTop: v.translit ? "0.5px solid var(--color-hairline)" : "none", fontFamily: "var(--font-text)", fontSize: "var(--text-body)", lineHeight: "var(--leading-normal)", color: "var(--color-label)", whiteSpace: "pre-line" }}>{v.text}</div>
      )}
    </section>
  );
}

/** Слой (когда стихи не разнесены): подписанный блок текста — тоже карточкой. */
function LayerCard({ label, text, scripture }: { label: string; text: string; scripture?: boolean }) {
  return (
    <section style={{ borderRadius: "var(--radius-lg)", background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)", padding: "var(--space-5)" }}>
      <Eyebrow blue>{label}</Eyebrow>
      <div style={{ marginTop: "var(--space-3)", fontFamily: scripture ? "var(--font-scripture)" : "var(--font-text)", fontStyle: scripture ? "italic" : "normal", fontSize: scripture ? 18.5 : "var(--text-body)", lineHeight: scripture ? 1.72 : "var(--leading-normal)", color: "var(--color-label)", whiteSpace: "pre-line" }}>{text}</div>
    </section>
  );
}

export default function BhajanDetailPage({ slug, onBack }: { slug: string; onBack: () => void }) {
  const [data, setData] = useState<BhajanDetail | null>(null);
  const [err, setErr] = useState(false);
  const [t, setT] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fav = useFavorite(`bhajan:${slug}`);
  const { openCardMenu } = useCardActions();
  const flash = (m: string) => {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  };

  useEffect(() => {
    let live = true;
    setData(null); setErr(false);
    fetch(api(`/bhajans/detail?slug=${encodeURIComponent(slug)}`))
      .then((r) => r.json())
      .then((d) => { if (live) { if (d && Array.isArray(d.verses)) setData(d); else setErr(true); } })
      .catch(() => { if (live) setErr(true); });
    return () => { live = false; };
  }, [slug]);

  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    const onScroll = () => setT(Math.min(1, Math.max(0, el.scrollTop / 120)));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [data]);

  const openMore = () => {
    if (!data) return;
    openCardMenu({
      type: "bhajan", id: slug, title: data.name, subtitle: data.author || undefined,
      url: `https://gaurangers.com/bhajan/${encodeURIComponent(slug)}`,
      context: `Бхаджан · ${data.name} · /bhajan/${slug}`,
    });
  };

  const meta = data ? [data.source_text, data.section].filter(Boolean).join(" · ") : "";
  const hasVerses = !!(data && data.verses.length > 0);
  const hasLayers = !!(data && (data.translit || data.translation));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", minHeight: 0, background: "var(--color-bg)" }}>
      {/* scroll-edge навбар — назад + титул на скролле */}
      <header style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 30, height: 52, display: "flex", alignItems: "center", gap: 2, padding: "0 8px",
        background: `color-mix(in srgb, var(--color-glass-nav) ${Math.round(t * 100)}%, transparent)`,
        backdropFilter: t > 0.04 ? "saturate(180%) blur(20px)" : "none", WebkitBackdropFilter: t > 0.04 ? "saturate(180%) blur(20px)" : "none",
        borderBottom: `0.5px solid color-mix(in srgb, var(--color-glass-stroke) ${Math.round(t * 100)}%, transparent)` }}>
        <button aria-label="Назад" onClick={onBack} style={{ display: "grid", height: 38, width: 38, placeItems: "center", borderRadius: "50%", border: "none", cursor: "pointer", color: "var(--color-label)", background: "transparent", flexShrink: 0 }}><BackIcon size={22} /></button>
        <div style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-headline)", fontWeight: "var(--weight-bold)", letterSpacing: "var(--tracking-tight)", color: "var(--color-label)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", opacity: t > 0.55 ? (t - 0.55) / 0.45 : 0 }}>{data?.name}</div>
      </header>

      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        {!data && !err && <div style={{ textAlign: "center", color: "var(--color-label-2)", padding: "140px 0", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)" }}>Загрузка…</div>}
        {err && <div style={{ textAlign: "center", color: "var(--color-label-2)", padding: "140px 16px", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)" }}>Не удалось загрузить.</div>}

        {data && (
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            {/* ШАПКА — чистая, выразительная */}
            <div style={{ padding: "64px var(--pad-card) 0" }}>
              {data.category && <Eyebrow blue>{data.category}</Eyebrow>}
              <h1 style={{ margin: data.category ? "var(--space-2) 0 0" : 0, fontFamily: "var(--font-display)", fontSize: "var(--text-title1)", lineHeight: "var(--leading-tight)", fontWeight: "var(--weight-heavy)", letterSpacing: "-0.5px", color: "var(--color-label)" }}>{data.name}</h1>
              {data.author && <div style={{ marginTop: "var(--space-3)", fontFamily: "var(--font-text)", fontSize: "var(--text-headline)", fontWeight: "var(--weight-medium)", color: "var(--color-label)" }}>{data.author}</div>}
              {meta && <div style={{ marginTop: "var(--space-1)", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", color: "var(--color-label-2)" }}>{meta}</div>}

              {/* действия */}
              <div style={{ marginTop: "var(--space-5)", display: "flex", alignItems: "center", gap: 10 }}>
                <RoundBtn ariaLabel="В избранное" active={fav.on} activeColor="#FF453A" size={40} onClick={() => fav.toggle(flash)}><HeartIcon size={20} filled={fav.on} /></RoundBtn>
                <RoundBtn ariaLabel="Слушать" size={40} onClick={() => flash("Аудио — скоро")}><HeadphonesIcon size={20} /></RoundBtn>
                <RoundBtn ariaLabel="Ещё" size={40} onClick={openMore}><MoreIcon size={19} /></RoundBtn>
              </div>
            </div>

            {/* ТЕКСТ — стихи карточками */}
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", padding: "var(--space-7) var(--pad-card) calc(env(safe-area-inset-bottom,0px) + var(--space-9))" }}>
              {data.pending ? (
                <div style={{ padding: "var(--space-6) var(--space-5)", borderRadius: "var(--radius-lg)", background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)", textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-body)", fontWeight: "var(--weight-semibold)", color: "var(--color-label)" }}>Текст готовится</div>
                  <div style={{ marginTop: "var(--space-2)", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", lineHeight: "var(--leading-snug)", color: "var(--color-label-2)" }}>Перевод этого бхаджана появится здесь после подготовки.</div>
                </div>
              ) : hasVerses ? (
                data.verses.map((v) => <VerseCard key={v.ord} v={v} />)
              ) : hasLayers ? (
                <>
                  {data.translit && <LayerCard label="Транслитерация" text={data.translit} scripture />}
                  {data.translation && <LayerCard label="Перевод" text={data.translation} />}
                </>
              ) : (
                <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-body)", lineHeight: "var(--leading-normal)", color: "var(--color-label)", whiteSpace: "pre-line" }}>{data.body}</div>
              )}
              <NotesAtSource kind="bhajan" refId={`bhajan:${slug}`} accent="#7048E8" />
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div role="status" style={{ position: "absolute", left: "50%", bottom: "calc(env(safe-area-inset-bottom,0px) + 24px)", transform: "translateX(-50%)", zIndex: 50, padding: "10px 16px", borderRadius: 999, background: "rgba(0,0,0,.82)", color: "#fff", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 500, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", boxShadow: "0 8px 30px rgba(0,0,0,.3)", pointerEvents: "none" }}>{toast}</div>
      )}
    </div>
  );
}
