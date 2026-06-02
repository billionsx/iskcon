/**
 * ContentDetailPage — единая карточка контента iskcone (статья dāsa / личность / центр).
 * Стиль Apple HIG: SF для интерфейса и текста, hero-панно с маской-знаком ISKCON,
 * scroll-aware прозрачная шапка. Цитаты личностей — отдельным блоком (Georgia курсив).
 * Источник: GET /content/detail?slug=…
 */
import { useEffect, useRef, useState } from "react";
import type { SVGProps } from "react";
import { api } from "./api";

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> { size?: number; }
const sp = ({ size = 24 }: IconProps) => ({ width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true as const });
const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function BackIcon(p: IconProps) { return <svg {...sp(p)}><path {...STROKE} d="M15 5l-7 7 7 7" /></svg>; }

function LogoMark({ src, label, height }: { src: string; label: string; height: number }) {
  return <span role="img" aria-label={label} style={{ display: "block", height, width: height, backgroundColor: "currentColor", WebkitMaskImage: `url(${src})`, maskImage: `url(${src})`, WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskPosition: "center", maskPosition: "center" }} />;
}

interface Quote { ord: number; text: string; source: string | null; speaker: string | null; }
interface ContentDetail {
  slug: string; name: string; type: string; kind: string | null;
  hero_image: string | null; paragraphs: string[]; quotes: Quote[];
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: "var(--weight-semibold)", letterSpacing: "var(--tracking-wide)", textTransform: "uppercase", color: "var(--color-label-2)" }}>{children}</div>;
}

export default function ContentDetailPage({ slug, onBack }: { slug: string; onBack: () => void }) {
  const [data, setData] = useState<ContentDetail | null>(null);
  const [err, setErr] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    setData(null); setErr(false);
    fetch(api(`/content/detail?slug=${encodeURIComponent(slug)}`))
      .then((r) => r.json())
      .then((d) => { if (live) { if (d && Array.isArray(d.paragraphs)) setData(d); else setErr(true); } })
      .catch(() => { if (live) setErr(true); });
    return () => { live = false; };
  }, [slug]);

  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 56);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [data]);

  const hasQuotes = !!(data && data.quotes.length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", minHeight: 0, background: "var(--color-bg)" }}>
      <header style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 30, height: 56, display: "flex", alignItems: "center", gap: 2, padding: "0 6px", transition: "background var(--duration-base) var(--ease-standard), border-color var(--duration-base)", background: scrolled ? "var(--color-glass-nav)" : "transparent", backdropFilter: scrolled ? "saturate(180%) blur(20px)" : "none", WebkitBackdropFilter: scrolled ? "saturate(180%) blur(20px)" : "none", borderBottom: scrolled ? "0.5px solid var(--color-glass-stroke)" : "0.5px solid transparent" }}>
        <button aria-label="Назад" onClick={onBack} style={{ display: "grid", height: 40, width: 40, placeItems: "center", borderRadius: "50%", border: "none", cursor: "pointer", background: scrolled ? "transparent" : "var(--color-glass-regular)", color: "var(--color-label)", backdropFilter: scrolled ? "none" : "blur(12px)", WebkitBackdropFilter: scrolled ? "none" : "blur(12px)" }}><BackIcon size={22} /></button>
        <div style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-subhead)", fontWeight: "var(--weight-semibold)", color: "var(--color-label)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", opacity: scrolled ? 1 : 0, transition: "opacity var(--duration-base)" }}>{data?.name ?? ""}</div>
      </header>

      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        {!data && !err && <div style={{ textAlign: "center", color: "var(--color-label-2)", padding: "120px 0", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)" }}>Загрузка…</div>}
        {err && <div style={{ textAlign: "center", color: "var(--color-label-2)", padding: "120px 16px", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)" }}>Не удалось загрузить.</div>}

        {data && (
          <>
            <div style={{ position: "relative", height: 220, display: "grid", placeItems: "center", background: "var(--color-bg-3)", overflow: "hidden" }}>
              {data.hero_image
                ? <img src={data.hero_image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <div style={{ color: "var(--color-label-3)" }}><LogoMark src="/iskcon-sign.svg" label="ISKCON" height={96} /></div>}
              <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.20), rgba(0,0,0,0) 40%)" }} />
            </div>

            <div style={{ maxWidth: 680, margin: "0 auto", padding: "var(--space-6) var(--pad-card) calc(env(safe-area-inset-bottom,0px) + var(--space-8))" }}>
              {data.kind && <div style={{ marginBottom: "var(--space-2)" }}><Eyebrow>{data.kind}</Eyebrow></div>}
              <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-title1)", lineHeight: "var(--leading-tight)", fontWeight: "var(--weight-heavy)", letterSpacing: "var(--tracking-tight)", color: "var(--color-label)" }}>{data.name}</h1>

              {/* текст статьи / описание личности — абзацы SF */}
              <div style={{ marginTop: "var(--space-6)" }}>
                {data.paragraphs.map((p, i) => (
                  <p key={i} style={{ margin: i === 0 ? 0 : "var(--space-4) 0 0", fontFamily: "var(--font-text)", fontSize: "var(--text-body)", lineHeight: "var(--leading-normal)", color: "var(--color-label)" }}>{p}</p>
                ))}
              </div>

              {/* цитаты личности — Georgia курсив, с подписью источника */}
              {hasQuotes && (
                <div style={{ marginTop: "var(--space-8)" }}>
                  <Eyebrow>Цитаты</Eyebrow>
                  <div style={{ marginTop: "var(--space-4)" }}>
                    {data.quotes.map((q, i) => (
                      <figure key={q.ord || i} style={{ margin: i === 0 ? 0 : "var(--space-6) 0 0", paddingTop: i === 0 ? 0 : "var(--space-6)", borderTop: i === 0 ? "none" : "0.5px solid var(--color-hairline)" }}>
                        <blockquote style={{ margin: 0, fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 18, lineHeight: 1.7, color: "var(--color-label)" }}>{q.text}</blockquote>
                        {(q.source || q.speaker) && (
                          <figcaption style={{ marginTop: "var(--space-2)", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", color: "var(--color-label-2)" }}>
                            {[q.speaker, q.source].filter(Boolean).join(" · ")}
                          </figcaption>
                        )}
                      </figure>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
