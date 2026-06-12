/**
 * BhajanDetailPage — ПКБ (Подробная Карточка Бхаджана).
 * Зеркало BookDetailPage: scroll-aware шапка (только «Назад» + титул при скролле,
 * все действия живут в карточке-герое ниже) → BhajanHeroCard (4/5, тот же
 * карточный модуль, что и на витрине) → читаемая колонка стихов.
 *
 * Стандарт: Apple HIG / iOS 26 — интерфейс шрифтом SF (var(--font-text/display)),
 * священный текст (транслитерация) — Georgia (var(--font-scripture)). Размеры/цвета/
 * радиусы — токены ui/globals.css. Каждый стих: транслитерация (Georgia курсив) →
 * перевод (SF) → подпись (автор · произведение · стих N).
 */
import { useEffect, useRef, useState } from "react";
import type { SVGProps } from "react";
import { api } from "./api";
import { BhajanHeroCard } from "./BhajanHeroCard";

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> { size?: number; }
const sp = ({ size = 24 }: IconProps) => ({ width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true as const });
const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function BackIcon(p: IconProps) { return <svg {...sp(p)}><path {...STROKE} d="M15 5l-7 7 7 7" /></svg>; }

/** Логотип-маска в currentColor — подхватывает цвет (белый на герое). */
function LogoMark({ src, label, height }: { src: string; label: string; height: number }) {
  return <span role="img" aria-label={label} style={{ display: "block", height, width: height, backgroundColor: "currentColor", WebkitMaskImage: `url(${src})`, maskImage: `url(${src})`, WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskPosition: "center", maskPosition: "center" }} />;
}

interface Verse { ord: number; translit: string | null; text: string | null; signature: string | null; }
interface BhajanDetail {
  slug: string; name: string; author: string | null; hero_image: string | null;
  category: string | null; source_text: string | null; section: string | null;
  verses: Verse[]; translit: string | null; translation: string | null;
  body: string; pending: boolean;
}

/* eyebrow-метка секции (Caption2, uppercase, трекинг) */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: "var(--weight-semibold)", letterSpacing: "var(--tracking-wide)", textTransform: "uppercase", color: "var(--color-label-2)" }}>{children}</div>;
}

/** Один стих: транслитерация (Georgia курсив) → перевод (SF) → подпись. */
function VerseBlock({ v, first }: { v: Verse; first: boolean }) {
  return (
    <section style={{ marginTop: first ? 0 : "var(--space-6)", paddingTop: first ? 0 : "var(--space-6)", borderTop: first ? "none" : "0.5px solid var(--color-hairline)" }}>
      {v.translit && (
        <div style={{ fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 18, lineHeight: 1.7, color: "var(--color-label)", whiteSpace: "pre-line" }}>
          {v.translit}
        </div>
      )}
      {v.text && (
        <div style={{ marginTop: v.translit ? "var(--space-4)" : 0, fontFamily: "var(--font-text)", fontSize: "var(--text-body)", lineHeight: "var(--leading-normal)", color: "var(--color-label)", whiteSpace: "pre-line" }}>
          {v.text}
        </div>
      )}
      {v.signature && (
        <div style={{ marginTop: "var(--space-3)", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", color: "var(--color-label-2)" }}>
          {v.signature}
        </div>
      )}
    </section>
  );
}

/** Слой (когда стихи не разнесены): подписанный блок текста. */
function Layer({ label, text, scripture }: { label: string; text: string; scripture?: boolean }) {
  return (
    <section style={{ marginTop: "var(--space-8)" }}>
      <Eyebrow>{label}</Eyebrow>
      <div style={{ marginTop: "var(--space-3)", fontFamily: scripture ? "var(--font-scripture)" : "var(--font-text)", fontStyle: scripture ? "italic" : "normal", fontSize: scripture ? 18 : "var(--text-body)", lineHeight: scripture ? 1.7 : "var(--leading-normal)", color: "var(--color-label)", whiteSpace: "pre-line" }}>
        {text}
      </div>
    </section>
  );
}

export default function BhajanDetailPage({ slug, onBack }: { slug: string; onBack: () => void }) {
  const [data, setData] = useState<BhajanDetail | null>(null);
  const [err, setErr] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    const onScroll = () => setScrolled(el.scrollTop > 56);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [data]);

  const hasVerses = !!(data && data.verses.length > 0);
  const hasLayers = !!(data && (data.translit || data.translation));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", minHeight: 0, background: "var(--color-bg)" }}>
      {/* scroll-aware шапка — только «Назад» + титул; действия живут в карточке ниже */}
      <header style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 30, height: 52, display: "flex", alignItems: "center", gap: 4, padding: "0 14px", transition: "background var(--duration-base) var(--ease-standard), border-color var(--duration-base)", background: scrolled ? "var(--color-glass-nav)" : "transparent", backdropFilter: scrolled ? "saturate(180%) blur(20px)" : "none", WebkitBackdropFilter: scrolled ? "saturate(180%) blur(20px)" : "none", borderBottom: scrolled ? "0.5px solid var(--color-glass-stroke)" : "0.5px solid transparent" }}>
        <button aria-label="Назад" onClick={onBack} style={{ display: "grid", height: 38, width: 38, placeItems: "center", borderRadius: "50%", border: "none", cursor: "pointer", background: "var(--color-glass-regular)", color: "var(--color-label)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", flexShrink: 0 }}><BackIcon size={22} /></button>
        {scrolled && data && <div style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-subhead)", fontWeight: "var(--weight-semibold)", color: "var(--color-label)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{data.name}</div>}
      </header>

      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        {!data && !err && <div style={{ textAlign: "center", color: "var(--color-label-2)", padding: "120px 0", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)" }}>Загрузка…</div>}
        {err && <div style={{ textAlign: "center", color: "var(--color-label-2)", padding: "120px 16px", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)" }}>Не удалось загрузить.</div>}

        {data && (
          <>
            {/* HERO — тот же карточный модуль, что и на витрине (ВКБ) */}
            <div style={{ padding: "2px 16px 6px" }}>
              <BhajanHeroCard
                bhajan={{ slug, name: data.name, author: data.author, heroImage: data.hero_image, category: data.category, sourceText: data.source_text, section: data.section }}
                topLeft={<LogoMark src="/iskcon-sign.svg" label="ISKCON" height={26} />}
                flash={flash}
              />
            </div>

            {/* ТЕКСТ */}
            <div style={{ maxWidth: 680, margin: "0 auto", padding: "var(--space-7) var(--pad-card) calc(env(safe-area-inset-bottom,0px) + var(--space-8))" }}>
              {data.pending ? (
                <div style={{ padding: "var(--space-5)", borderRadius: "var(--radius-lg)", background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)", color: "var(--color-label-2)", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", lineHeight: "var(--leading-normal)" }}>
                  Текст готовится к публикации.
                </div>
              ) : hasVerses ? (
                <div>{data.verses.map((v, i) => <VerseBlock key={v.ord} v={v} first={i === 0} />)}</div>
              ) : hasLayers ? (
                <>
                  {data.translit && <Layer label="Транслитерация" text={data.translit} scripture />}
                  {data.translation && <Layer label="Перевод" text={data.translation} />}
                </>
              ) : (
                <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-body)", lineHeight: "var(--leading-normal)", color: "var(--color-label)", whiteSpace: "pre-line" }}>{data.body}</div>
              )}
            </div>
          </>
        )}
      </div>

      {/* лёгкий тост (напр. «Аудио — скоро») */}
      {toast && (
        <div role="status" style={{ position: "absolute", left: "50%", bottom: "calc(env(safe-area-inset-bottom,0px) + 24px)", transform: "translateX(-50%)", zIndex: 50, padding: "10px 16px", borderRadius: 999, background: "rgba(0,0,0,.82)", color: "#fff", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: 500, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", boxShadow: "0 8px 30px rgba(0,0,0,.3)", pointerEvents: "none" }}>{toast}</div>
      )}
    </div>
  );
}
