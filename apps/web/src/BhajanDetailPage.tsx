/**
 * BhajanDetailPage — карточка бхаджана/молитвы.
 * Стандарт: Apple HIG / iOS 26 — интерфейс шрифтом SF (var(--font-text/display)),
 * священный текст (транслитерация + стих) шрифтом Georgia (var(--font-scripture)),
 * как на iskcone.com. Размеры/цвета/радиусы — из ui/globals.css токенов.
 *
 * Архитектура совпадает с BookDetailPage: scroll-aware прозрачная шапка над hero,
 * hero-панно с маской-логотипом (адаптив к теме), затем читаемая колонка стихов.
 * Каждый стих — отдельный блок: транслитерация (Georgia курсив) → перевод (SF) →
 * подпись (автор · произведение · стих N).
 */
import { CardActionBtns, useCardActions } from "./cardActions";
import { useEffect, useRef, useState } from "react";
import type { SVGProps } from "react";
import { api } from "./api";

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> { size?: number; }
const sp = ({ size = 24 }: IconProps) => ({ width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true as const });
const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function BackIcon(p: IconProps) { return <svg {...sp(p)}><path {...STROKE} d="M15 5l-7 7 7 7" /></svg>; }
function PlayIcon(p: IconProps) { return <svg {...sp(p)}><path d="M8 5v14l11-7z" fill="currentColor" /></svg>; }

/** Логотип-маска в currentColor — подхватывает цвет темы (как в BookDetailPage). */
function LogoMark({ src, label, height }: { src: string; label: string; height: number }) {
  return <span role="img" aria-label={label} style={{ display: "block", height, width: height, backgroundColor: "currentColor", WebkitMaskImage: `url(${src})`, maskImage: `url(${src})`, WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskPosition: "center", maskPosition: "center" }} />;
}

interface Verse { ord: number; translit: string | null; text: string | null; signature: string | null; }
interface BhajanDetail {
  slug: string; name: string; author: string | null; hero_image: string | null;
  source_text: string | null; section: string | null;
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
  const { openCardMenu } = useCardActions();
  const [data, setData] = useState<BhajanDetail | null>(null);
  const [err, setErr] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
  const meta = data ? [data.source_text, data.section].filter(Boolean).join(" · ") : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", minHeight: 0, background: "var(--color-bg)" }}>
      {/* scroll-aware top bar над hero */}
      <header style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 30, height: 56, display: "flex", alignItems: "center", gap: 2, padding: "0 6px", transition: "background var(--duration-base) var(--ease-standard), border-color var(--duration-base)", background: scrolled ? "var(--color-glass-nav)" : "transparent", backdropFilter: scrolled ? "saturate(180%) blur(20px)" : "none", WebkitBackdropFilter: scrolled ? "saturate(180%) blur(20px)" : "none", borderBottom: scrolled ? "0.5px solid var(--color-glass-stroke)" : "0.5px solid transparent" }}>
        <button aria-label="Назад" onClick={onBack} style={{ display: "grid", height: 40, width: 40, placeItems: "center", borderRadius: "50%", border: "none", cursor: "pointer", background: scrolled ? "transparent" : "var(--color-glass-regular)", color: scrolled ? "var(--color-label)" : "var(--color-label)", backdropFilter: scrolled ? "none" : "blur(12px)", WebkitBackdropFilter: scrolled ? "none" : "blur(12px)", transition: "background var(--duration-base)" }}><BackIcon size={22} /></button>
        <div style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-subhead)", fontWeight: "var(--weight-semibold)", color: "var(--color-label)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", opacity: scrolled ? 1 : 0, transition: "opacity var(--duration-base)" }}>{data?.name ?? ""}</div>
        {data && (
          <CardActionBtns favKey={`bhajan:${slug}`} size={36} onMore={() => openCardMenu({
            type: "bhajan", id: slug, title: data.name, subtitle: data.author || undefined,
            url: `https://gaurangers.com/bhajan/${encodeURIComponent(slug)}`,
            context: `Бхаджан · ${data.name} · /bhajan/${slug}`,
          })} />
        )}
      </header>

      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        {!data && !err && <div style={{ textAlign: "center", color: "var(--color-label-2)", padding: "120px 0", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)" }}>Загрузка…</div>}
        {err && <div style={{ textAlign: "center", color: "var(--color-label-2)", padding: "120px 16px", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)" }}>Не удалось загрузить.</div>}

        {data && (
          <>
            {/* hero-панно: тёмная подложка, маска-логотип по центру */}
            <div style={{ position: "relative", height: 220, display: "grid", placeItems: "center", background: "var(--color-bg-3)", overflow: "hidden" }}>
              <div style={{ color: "var(--color-label-3)" }}><LogoMark src="/iskcon-sign.svg" label="ISKCON" height={96} /></div>
              {/* мягкое затемнение к низу — заголовок-«шапка» при скролле читается */}
              <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.18), rgba(0,0,0,0) 38%)" }} />
            </div>

            <div style={{ maxWidth: 680, margin: "0 auto", padding: "var(--space-6) var(--pad-card) calc(env(safe-area-inset-bottom,0px) + var(--space-8))" }}>
              {/* заголовочный блок */}
              <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-title1)", lineHeight: "var(--leading-tight)", fontWeight: "var(--weight-heavy)", letterSpacing: "var(--tracking-tight)", color: "var(--color-label)" }}>{data.name}</h1>
              {data.author && <div style={{ marginTop: "var(--space-2)", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", color: "var(--color-label)" }}>{data.author}</div>}
              {meta && <div style={{ marginTop: "var(--space-1)", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", color: "var(--color-label-2)" }}>{meta}</div>}

              {/* тело */}
              <div style={{ marginTop: "var(--space-8)" }}>
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

              {/* аудио-плейсхолдер (скрыт для pending) */}
              {!data.pending && (
                <button disabled style={{ marginTop: "var(--space-8)", display: "flex", width: "100%", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-4) var(--space-4)", borderRadius: "var(--radius-lg)", background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)", color: "var(--color-label-2)", cursor: "default", fontFamily: "var(--font-text)" }}>
                  <span style={{ display: "grid", placeItems: "center", height: 32, width: 32, borderRadius: "50%", background: "var(--color-glass-regular)", color: "var(--color-label-2)" }}><PlayIcon size={16} /></span>
                  <span style={{ fontSize: "var(--text-subhead)" }}>Аудио — скоро</span>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
