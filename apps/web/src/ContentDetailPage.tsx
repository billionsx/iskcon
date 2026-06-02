/**
 * ContentDetailPage — карточка контента iskcone (личность / статья / центр).
 * Рендерит РЕАЛЬНУЮ вёрстку страницы блоками (content_blocks):
 *   heading · accent · para · quote(+sign) · image
 * Стиль Apple HIG (SF для UI/текста), цитаты — тонированный бокс с Georgia-текстом
 * по центру и подписью-источником (как золотые блоки iskcone, но чисто по-Apple).
 * Источник: GET /content/detail?slug=… → { blocks[], paragraphs[] (fallback) }.
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

interface Block { kind: string; text: string | null; image: string | null; }
interface ContentDetail {
  slug: string; name: string; type: string; kind: string | null;
  hero_image: string | null; blocks: Block[]; paragraphs: string[];
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: "var(--weight-semibold)", letterSpacing: "var(--tracking-wide)", textTransform: "uppercase", color: "var(--color-label-2)" }}>{children}</div>;
}

/** Один блок вёрстки. signNext — подпись (sign), идущая сразу за quote. */
function BlockView({ b, signNext }: { b: Block; signNext: string | null }) {
  switch (b.kind) {
    case "heading":
      return <h2 style={{ margin: "var(--space-8) 0 0", fontFamily: "var(--font-display)", fontSize: "var(--text-title2)", fontWeight: "var(--weight-heavy)", letterSpacing: "var(--tracking-tight)", lineHeight: "var(--leading-snug)", color: "var(--color-label)" }}>{b.text}</h2>;
    case "accent":
      return <p style={{ margin: "var(--space-4) 0 0", fontFamily: "var(--font-text)", fontSize: "var(--text-title3)", fontWeight: "var(--weight-semibold)", lineHeight: "var(--leading-snug)", color: "var(--color-label)" }}>{b.text}</p>;
    case "image":
      return b.image ? (
        <img src={b.image} alt="" loading="lazy" style={{ display: "block", width: "100%", margin: "var(--space-6) 0 0", borderRadius: "var(--radius-lg)", objectFit: "cover" }} />
      ) : null;
    case "quote":
      return (
        <figure style={{ margin: "var(--space-6) 0 0", padding: "var(--space-6) var(--space-5)", borderRadius: "var(--radius-xl)", background: "var(--color-bg-3)", border: "0.5px solid var(--color-hairline)" }}>
          <blockquote style={{ margin: 0, fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 19, lineHeight: 1.65, textAlign: "center", color: "var(--color-label)" }}>{b.text}</blockquote>
          {signNext && (
            <figcaption style={{ marginTop: "var(--space-4)", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontWeight: "var(--weight-semibold)", textAlign: "center", color: "var(--color-label-2)", whiteSpace: "pre-line" }}>{signNext}</figcaption>
          )}
        </figure>
      );
    case "sign":
      return null; // отрисовывается внутри предыдущего quote
    default: // para
      return <p style={{ margin: "var(--space-4) 0 0", fontFamily: "var(--font-text)", fontSize: "var(--text-body)", lineHeight: "var(--leading-normal)", color: "var(--color-label)" }}>{b.text}</p>;
  }
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
      .then((d) => { if (live) { if (d && (Array.isArray(d.blocks) || Array.isArray(d.paragraphs))) setData(d); else setErr(true); } })
      .catch(() => { if (live) setErr(true); });
    return () => { live = false; };
  }, [slug]);

  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 56);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [data]);

  // блоки с привязкой подписи к предыдущей цитате
  const blocks = data?.blocks ?? [];
  const useBlocks = blocks.length > 0;

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

              {useBlocks ? (
                <div>
                  {blocks.map((b, i) => {
                    if (b.kind === "sign") return null; // включается в предыдущую цитату
                    const next = blocks[i + 1];
                    const signNext = b.kind === "quote" && next && next.kind === "sign" ? (next.text ?? null) : null;
                    return <BlockView key={i} b={b} signNext={signNext} />;
                  })}
                </div>
              ) : (
                <div style={{ marginTop: "var(--space-6)" }}>
                  {data.paragraphs.map((p, i) => (
                    <p key={i} style={{ margin: i === 0 ? 0 : "var(--space-4) 0 0", fontFamily: "var(--font-text)", fontSize: "var(--text-body)", lineHeight: "var(--leading-normal)", color: "var(--color-label)" }}>{p}</p>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
