/**
 * ContentDetailPage — карточка контента iskcone (личность / статья / центр).
 * Цель: неотличимо от нативного iOS-приложения Apple (iOS 26 / HIG).
 *
 * Подаёт реальную вёрстку страницы блоками (content_blocks):
 *   heading · accent · para · quote(+sign) · image
 * Типографика: SF (var(--font-display/text)) для UI/текста, Georgia
 * (var(--font-scripture)) для цитат. Цитаты — редакционный pull-quote
 * (крупный курсив, выключка влево, тонкая акцентная линия, подпись SF) —
 * как в Apple Books / News, без серых «коробок».
 *
 * Источник: GET /content/detail?slug=… → { blocks[], paragraphs[] (fallback) }.
 */
import { useEffect, useRef, useState } from "react";
import type { SVGProps } from "react";
import { api } from "./api";

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> { size?: number; }
const sp = ({ size = 24 }: IconProps) => ({ width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true as const });
const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function BackIcon(p: IconProps) { return <svg {...sp(p)}><path {...STROKE} d="M15 5l-7 7 7 7" /></svg>; }

function LogoMark({ src, label, height }: { src: string; label: string; height: number }) {
  return <span role="img" aria-label={label} style={{ display: "block", height, width: height, backgroundColor: "currentColor", WebkitMaskImage: `url(${src})`, maskImage: `url(${src})`, WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskPosition: "center", maskPosition: "center" }} />;
}

interface SignRef {
  author: string | null; authorSlug: string | null;
  workName: string | null; workId: string | null; workHref: string | null;
  division: string | null; divisionSlug: string | null;
  chapter: string | null; verse: string | null;
  chapterHref: string | null; verseHref: string | null;
  citation: string | null; raw: string;
}
interface Block { kind: string; text: string | null; image: string | null; ref?: SignRef }
interface ContentDetail {
  slug: string; name: string; type: string; kind: string | null;
  hero_image: string | null; blocks: Block[]; paragraphs: string[];
}

/** Редакционный pull-quote (Apple Books / News): крупный курсив слева,
 *  тонкая акцентная линия, структурированная атрибуция со ссылками. */
function PullQuote({ text, ref, onPerson, onBook, onRef }: { text: string; ref: SignRef | null; onPerson: (slug: string) => void; onBook: (workId: string) => void; onRef: (href: string) => void }) {
  const link: React.CSSProperties = { background: "none", border: "none", padding: 0, margin: 0, font: "inherit", color: "var(--color-brand-blue)", cursor: "pointer" };
  const dim = <span style={{ color: "var(--color-label-3)" }}>{"  ·  "}</span>;
  const hasStruct = ref && (ref.author || ref.workName);
  // ридер есть для bg (товарная карточка) и cc/sb (референс-ридер)
  const deep = !!ref?.workId && ["bg", "cc", "sb"].includes(ref.workId);
  return (
    <figure style={{ margin: "var(--space-8) 0 0", paddingLeft: "var(--space-5)", borderLeft: "2px solid color-mix(in srgb, var(--color-brand-blue) 55%, transparent)" }}>
      <blockquote style={{ margin: 0, fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 22, lineHeight: 1.42, letterSpacing: "0.1px", color: "var(--color-label)" }}>
        {text}
      </blockquote>
      {ref && (hasStruct || ref.raw) && (
        <figcaption style={{ marginTop: "var(--space-4)", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", lineHeight: "var(--leading-snug)", color: "var(--color-label-2)" }}>
          {hasStruct ? (
            <>
              {/* автор → личность */}
              {ref.author && (
                ref.authorSlug
                  ? <button onClick={() => onPerson(ref.authorSlug as string)} style={{ ...link, fontWeight: 600 }}>{ref.author}</button>
                  : <span style={{ fontWeight: 600, color: "var(--color-label)" }}>{ref.author}</span>
              )}
              {ref.author && ref.workName && dim}
              {/* книга → книга (ридер пока есть для bg) */}
              {ref.workName && (
                deep && ref.workId
                  ? <button onClick={() => onBook(ref.workId as string)} style={link}>{ref.workName}</button>
                  : <span>{ref.workName}</span>
              )}
              {/* раздел (лила/песнь) — текст */}
              {ref.division && <span>{", "}{ref.division}</span>}
              {/* глава → глава */}
              {ref.chapter && (
                <span>{", "}
                  {deep && ref.chapterHref
                    ? <button onClick={() => onRef(ref.chapterHref as string)} style={link}>глава {ref.chapter}</button>
                    : <span>глава {ref.chapter}</span>}
                </span>
              )}
              {/* стих → стих */}
              {ref.verse && (
                <span>{", "}
                  {deep && ref.verseHref
                    ? <button onClick={() => onRef(ref.verseHref as string)} style={link}>{/\d/.test(ref.verse) ? `стих ${ref.verse}` : ref.verse}</button>
                    : <span>{/\d/.test(ref.verse) ? `стих ${ref.verse}` : ref.verse}</span>}
                </span>
              )}
              {/* если книга не распознана, но есть хвост — добавим его */}
              {!ref.workName && ref.citation && <span>{ref.citation}</span>}
            </>
          ) : (
            <span>{ref.raw}</span>
          )}
        </figcaption>
      )}
    </figure>
  );
}

/** Фото — единый радиус, лёгкая тень-возвышение, вертикальный ритм. */
function Figure({ src }: { src: string }) {
  return (
    <img src={src} alt="" loading="lazy"
      style={{ display: "block", width: "100%", margin: "var(--space-8) 0 0", borderRadius: "var(--radius-lg)", objectFit: "cover", boxShadow: "var(--shadow-card)" }} />
  );
}

export default function ContentDetailPage({ slug, onBack, onOpenContent, onOpenBook, onOpenRef }: { slug: string; onBack: () => void; onOpenContent: (slug: string) => void; onOpenBook: (workId: string) => void; onOpenRef: (href: string) => void }) {
  const [data, setData] = useState<ContentDetail | null>(null);
  const [err, setErr] = useState(false);
  const [t, setT] = useState(0); // 0..1 прогресс ухода hero под навбар
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    setData(null); setErr(false); setT(0);
    fetch(api(`/content/detail?slug=${encodeURIComponent(slug)}`))
      .then((r) => r.json())
      .then((d) => { if (live) { if (d && (Array.isArray(d.blocks) || Array.isArray(d.paragraphs))) setData(d); else setErr(true); } })
      .catch(() => { if (live) setErr(true); });
    return () => { live = false; };
  }, [slug]);

  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    const onScroll = () => { const p = Math.min(1, Math.max(0, el.scrollTop / 180)); setT(p); };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [data]);

  const blocks = data?.blocks ?? [];
  const useBlocks = blocks.length > 0;
  const hasHeroImg = !!data?.hero_image;
  // имя личности на оригинале часто повторяется первым heading-блоком — не дублируем H1
  const skipFirstHeading = useBlocks && blocks[0]?.kind === "heading"
    && (blocks[0].text || "").trim().toLowerCase() === (data?.name || "").trim().toLowerCase();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", minHeight: 0, background: "var(--color-bg)" }}>
      {/* nav bar: прозрачный над hero → liquid-glass со scroll-edge blur; заголовок проявляется */}
      <header style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 30, height: 52, display: "flex", alignItems: "center", gap: 2, padding: "0 6px",
        background: `color-mix(in srgb, var(--color-glass-nav) ${Math.round(t * 100)}%, transparent)`,
        backdropFilter: t > 0.04 ? "saturate(180%) blur(20px)" : "none", WebkitBackdropFilter: t > 0.04 ? "saturate(180%) blur(20px)" : "none",
        borderBottom: `0.5px solid color-mix(in srgb, var(--color-glass-stroke) ${Math.round(t * 100)}%, transparent)`,
        transition: "backdrop-filter 120ms linear" }}>
        <button aria-label="Назад" onClick={onBack}
          style={{ display: "grid", height: 38, width: 38, placeItems: "center", borderRadius: "50%", border: "none", cursor: "pointer", color: "var(--color-label)",
            background: `color-mix(in srgb, var(--color-glass-regular) ${Math.round((1 - t) * 100)}%, transparent)`,
            backdropFilter: t < 0.9 ? "blur(12px)" : "none", WebkitBackdropFilter: t < 0.9 ? "blur(12px)" : "none" }}>
          <BackIcon size={22} />
        </button>
        <div style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-headline)", fontWeight: "var(--weight-bold)", letterSpacing: "var(--tracking-tight)", color: "var(--color-label)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", opacity: t > 0.6 ? (t - 0.6) / 0.4 : 0 }}>
          {data?.name ?? ""}
        </div>
        <div style={{ width: 38, flexShrink: 0 }} />
      </header>

      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        {!data && !err && <div style={{ textAlign: "center", color: "var(--color-label-2)", padding: "140px 0", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)" }}>Загрузка…</div>}
        {err && <div style={{ textAlign: "center", color: "var(--color-label-2)", padding: "140px 16px", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)" }}>Не удалось загрузить.</div>}

        {data && (
          <>
            {/* hero — edge-to-edge, без текста; снизу плавный градиент в фон */}
            <div style={{ position: "relative", width: "100%", aspectRatio: hasHeroImg ? "4 / 3" : "16 / 9", maxHeight: 380, background: "var(--color-bg-3)", overflow: "hidden" }}>
              {hasHeroImg
                ? <img src={data.hero_image as string} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                : <div style={{ height: "100%", display: "grid", placeItems: "center", color: "var(--color-label-3)" }}><LogoMark src="/iskcon-sign.svg" label="ISKCON" height={88} /></div>}
              {/* верхний фейд под навбар + нижний фейд в фон страницы */}
              <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0) 24%, rgba(0,0,0,0) 82%, var(--color-bg) 100%)" }} />
            </div>

            <div style={{ maxWidth: 680, margin: "0 auto", padding: "var(--space-5) var(--pad-card) calc(env(safe-area-inset-bottom,0px) + 64px)" }}>
              {/* заголовочный блок: eyebrow (мягкий регистр) + Large Title */}
              {data.kind && (
                <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: "var(--weight-semibold)", color: "var(--color-brand-blue)", marginBottom: "var(--space-2)" }}>
                  {data.kind}
                </div>
              )}
              <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-title1)", lineHeight: "var(--leading-tight)", fontWeight: "var(--weight-heavy)", letterSpacing: "-0.5px", color: "var(--color-label)" }}>
                {data.name}
              </h1>

              {useBlocks ? (
                <div>
                  {blocks.map((b, i) => {
                    if (b.kind === "sign") return null;
                    if (i === 0 && skipFirstHeading) return null;
                    const next = blocks[i + 1];
                    switch (b.kind) {
                      case "heading":
                        return <h2 key={i} style={{ margin: "var(--space-8) 0 0", fontFamily: "var(--font-display)", fontSize: "var(--text-title3)", fontWeight: "var(--weight-bold)", letterSpacing: "var(--tracking-tight)", lineHeight: "var(--leading-snug)", color: "var(--color-label)" }}>{b.text}</h2>;
                      case "accent":
                        return <p key={i} style={{ margin: "var(--space-4) 0 0", fontFamily: "var(--font-text)", fontSize: "var(--text-title3)", fontWeight: "var(--weight-regular)", lineHeight: 1.4, color: "var(--color-label-2)" }}>{b.text}</p>;
                      case "image":
                        return b.image ? <Figure key={i} src={b.image} /> : null;
                      case "quote": {
                        const ref = next && next.kind === "sign" ? (next.ref ?? null) : null;
                        return <PullQuote key={i} text={b.text ?? ""} ref={ref} onPerson={onOpenContent} onBook={onOpenBook} onRef={onOpenRef} />;
                      }
                      default:
                        return <p key={i} style={{ margin: "var(--space-5) 0 0", fontFamily: "var(--font-text)", fontSize: "var(--text-body)", lineHeight: "var(--leading-normal)", color: "var(--color-label)" }}>{b.text}</p>;
                    }
                  })}
                </div>
              ) : (
                <div>
                  {data.paragraphs.map((p, i) => (
                    <p key={i} style={{ margin: i === 0 ? "var(--space-5) 0 0" : "var(--space-5) 0 0", fontFamily: "var(--font-text)", fontSize: "var(--text-body)", lineHeight: "var(--leading-normal)", color: "var(--color-label)" }}>{p}</p>
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
