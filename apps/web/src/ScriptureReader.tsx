/**
 * ScriptureReader — референс-ридер многоуровневых писаний (ЧЧ, ШБ, …).
 * Открывается по ссылке-цитате (book:/chap:/verse:) и показывает каноническое
 * место: Книга → Лила/Песнь → Глава → Стих. Сам стих рендерится как
 * «Текст N — готовится» (перевод лицензируемый/на паузе). Навигация:
 * оглавление (лилы/песни → главы) и переход по главам, как в нативном
 * приложении Apple (scroll-edge навбар, SF/Georgia, точный ритм).
 *
 * Данные: GET /books/:work/toc → { name, hierarchical, divisions[] | chapters[] }.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { SVGProps } from "react";
import { api } from "./api";

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> { size?: number; }
const sp = ({ size = 24 }: IconProps) => ({ width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true as const });
const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
function BackIcon(p: IconProps) { return <svg {...sp(p)}><path {...STROKE} d="M15 5l-7 7 7 7" /></svg>; }
function ChevR(p: IconProps) { return <svg {...sp(p)}><path {...STROKE} d="M9 5l7 7-7 7" /></svg>; }

export interface ScriptureTarget { work: string; div: string | null; chapter: string | null; verse: string | null }
interface ChapterT { id: string; number: string; title_ru: string; verses: number }
interface DivisionT { id: string; slug: string; number: string; title_ru: string; chapters: ChapterT[] }
interface Toc { work: string; name: string; hierarchical: boolean; divisions?: DivisionT[]; chapters?: ChapterT[] }
interface VerseT { ref: string; label?: string; devanagari: string | null; translit: string | null; translation: string | null; purport: string | null }

function verseLabel(v: string): string {
  if (!/\d/.test(v)) return v.charAt(0).toUpperCase() + v.slice(1); // «введение»
  return /[-–]/.test(v) ? `Тексты ${v.replace(/[–—]/g, "-")}` : `Текст ${v}`;
}

export default function ScriptureReader({ target, onBack }: { target: ScriptureTarget; onBack: () => void }) {
  const [toc, setToc] = useState<Toc | null>(null);
  const [err, setErr] = useState(false);
  const [t, setT] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // активная глава/лила (навигация внутри ридера)
  const [divSlug, setDivSlug] = useState<string | null>(target.div);
  const [chapter, setChapter] = useState<string | null>(target.chapter);
  const [verse] = useState<string | null>(target.verse);
  const [chId, setChId] = useState<string | null>(null);
  const [verses, setVerses] = useState<VerseT[] | null>(null);
  const [vLoading, setVLoading] = useState(false);
  // если открыли без конкретной главы — режим оглавления
  const [mode, setMode] = useState<"toc" | "chapter">(target.chapter ? "chapter" : "toc");

  useEffect(() => {
    let live = true;
    setToc(null); setErr(false);
    fetch(api(`/books/${target.work}/toc`))
      .then((r) => r.json())
      .then((d) => { if (live) { if (d && (d.divisions || d.chapters)) setToc(d); else setErr(true); } })
      .catch(() => { if (live) setErr(true); });
    return () => { live = false; };
  }, [target.work]);

  // диплинк-цитата → определить division главы (по slug или номеру) и подгрузить стихи
  useEffect(() => {
    if (!toc || !target.chapter) return;
    if (toc.hierarchical) {
      const div = (toc.divisions ?? []).find((d) => d.slug === target.div || d.number === target.div) ?? null;
      const ch = div?.chapters.find((c) => c.number === target.chapter);
      if (div && ch) { setDivSlug(div.slug); setChId(ch.id); }
    } else {
      const ch = (toc.chapters ?? []).find((c) => c.number === target.chapter);
      if (ch) setChId(ch.id);
    }
  }, [toc]); // eslint-disable-line react-hooks/exhaustive-deps

  // загрузка стихов активной главы (оригинал: деванагари + транслитерация)
  useEffect(() => {
    if (!chId) { setVerses(null); return; }
    let live = true; setVLoading(true); setVerses(null);
    fetch(api(`/books/${target.work}/division/${chId}/read`))
      .then((r) => r.json())
      .then((d) => { if (live) setVerses(Array.isArray(d?.verses) ? d.verses : []); })
      .catch(() => { if (live) setVerses([]); })
      .finally(() => { if (live) setVLoading(false); });
    return () => { live = false; };
  }, [chId, target.work]);

  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    const onScroll = () => setT(Math.min(1, Math.max(0, el.scrollTop / 160)));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [toc, mode]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; setT(0); }, [mode, chapter, divSlug]);

  const divisions = toc?.divisions ?? [];
  const activeDiv = useMemo<DivisionT | null>(() => {
    if (!toc?.hierarchical) return null;
    return divisions.find((d) => d.slug === divSlug) ?? null;
  }, [toc, divSlug, divisions]);

  // линейный список глав книги (для prev/next через границы лил/песней)
  const flatChapters = useMemo<{ div: DivisionT | null; ch: ChapterT }[]>(() => {
    if (toc?.hierarchical) return divisions.flatMap((d) => d.chapters.map((ch) => ({ div: d, ch })));
    return (toc?.chapters ?? []).map((ch) => ({ div: null, ch }));
  }, [toc, divisions]);

  const curIndex = useMemo(() => {
    if (mode !== "chapter" || !chapter) return -1;
    return flatChapters.findIndex((x) => (x.div ? x.div.slug === divSlug : true) && x.ch.number === chapter);
  }, [flatChapters, mode, chapter, divSlug]);

  const navTitle = toc?.name ?? "";
  const openChapter = (slug: string | null, num: string, id: string) => { setDivSlug(slug); setChapter(num); setChId(id); setMode("chapter"); };
  const gotoFlat = (i: number) => { const x = flatChapters[i]; if (x) openChapter(x.div?.slug ?? null, x.ch.number, x.ch.id); };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", minHeight: 0, background: "var(--color-bg)" }}>
      <header style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 30, height: 52, display: "flex", alignItems: "center", gap: 2, padding: "0 6px",
        background: `color-mix(in srgb, var(--color-glass-nav) ${Math.round(t * 100)}%, transparent)`,
        backdropFilter: t > 0.04 ? "saturate(180%) blur(20px)" : "none", WebkitBackdropFilter: t > 0.04 ? "saturate(180%) blur(20px)" : "none",
        borderBottom: `0.5px solid color-mix(in srgb, var(--color-glass-stroke) ${Math.round(t * 100)}%, transparent)` }}>
        <button aria-label="Назад" onClick={() => { if (mode === "chapter" && !target.chapter) { setMode("toc"); } else onBack(); }}
          style={{ display: "grid", height: 38, width: 38, placeItems: "center", borderRadius: "50%", border: "none", cursor: "pointer", color: "var(--color-label)", background: "transparent" }}>
          <BackIcon size={22} />
        </button>
        <div style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-headline)", fontWeight: "var(--weight-bold)", letterSpacing: "var(--tracking-tight)", color: "var(--color-label)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", opacity: t > 0.5 ? (t - 0.5) / 0.5 : 0 }}>
          {navTitle}
        </div>
        <div style={{ width: 38, flexShrink: 0 }} />
      </header>

      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        {!toc && !err && <div style={{ textAlign: "center", color: "var(--color-label-2)", padding: "140px 0", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)" }}>Загрузка…</div>}
        {err && <div style={{ textAlign: "center", color: "var(--color-label-2)", padding: "140px 16px", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)" }}>Не удалось загрузить.</div>}

        {toc && (
          <div style={{ maxWidth: 680, margin: "0 auto", padding: "calc(52px + var(--space-4)) var(--pad-card) calc(env(safe-area-inset-bottom,0px) + 64px)" }}>
            {mode === "toc" ? (
              <>
                <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: "var(--weight-semibold)", color: "var(--color-brand-blue)", marginBottom: "var(--space-2)" }}>Писание</div>
                <h1 style={{ margin: "0 0 var(--space-6)", fontFamily: "var(--font-display)", fontSize: "var(--text-title1)", lineHeight: "var(--leading-tight)", fontWeight: "var(--weight-heavy)", letterSpacing: "-0.5px", color: "var(--color-label)" }}>{toc.name}</h1>

                {toc.hierarchical ? (
                  divisions.map((d) => (
                    <section key={d.id} style={{ marginTop: "var(--space-6)" }}>
                      <h2 style={{ margin: "0 0 var(--space-2)", fontFamily: "var(--font-display)", fontSize: "var(--text-title3)", fontWeight: "var(--weight-bold)", letterSpacing: "var(--tracking-tight)", color: "var(--color-label)" }}>{d.title_ru}</h2>
                      <div style={{ borderRadius: "var(--radius-lg)", background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)", overflow: "hidden" }}>
                        {d.chapters.map((ch, i) => (
                          <ChapterRow key={ch.id} label={`Глава ${ch.number}`} sub={ch.title_ru && !/глава/i.test(ch.title_ru) ? ch.title_ru : ""} last={i === d.chapters.length - 1} onClick={() => openChapter(d.slug, ch.number, ch.id)} />
                        ))}
                      </div>
                    </section>
                  ))
                ) : (
                  <div style={{ borderRadius: "var(--radius-lg)", background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)", overflow: "hidden", marginTop: "var(--space-2)" }}>
                    {(toc.chapters ?? []).map((ch, i) => (
                      <ChapterRow key={ch.id} label={`Глава ${ch.number}`} sub={ch.title_ru && !/глава/i.test(ch.title_ru) ? ch.title_ru : ""} last={i === (toc.chapters ?? []).length - 1} onClick={() => openChapter(null, ch.number, ch.id)} />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* каноническое место */}
                <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: "var(--weight-semibold)", color: "var(--color-brand-blue)", marginBottom: "var(--space-2)" }}>
                  {toc.name}{activeDiv ? ` · ${activeDiv.title_ru}` : ""}
                </div>
                <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-title1)", lineHeight: "var(--leading-tight)", fontWeight: "var(--weight-heavy)", letterSpacing: "-0.5px", color: "var(--color-label)" }}>
                  Глава {chapter}
                </h1>

                {/* стихи главы — оригинал (деванагари + транслитерация) из библиотеки */}
                <div style={{ marginTop: "var(--space-7)" }}>
                  {vLoading && (
                    <div style={{ textAlign: "center", color: "var(--color-label-2)", padding: "60px 0", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)" }}>Загрузка стихов…</div>
                  )}
                  {!vLoading && verses && verses.length > 0 && (
                    <>
                      {verses.map((v, i) => {
                        const active = verse != null && (v.ref === verse || String(v.ref).split(".").pop() === verse);
                        return (
                          <article key={v.ref + i} style={{ padding: "var(--space-5)", marginBottom: "var(--space-4)", borderRadius: "var(--radius-lg)", background: "var(--color-bg-2)", border: active ? `1px solid ${"color-mix(in srgb, var(--color-brand-blue) 60%, transparent)"}` : "0.5px solid var(--color-hairline)" }}>
                            <div style={{ fontFamily: "var(--font-text)", fontSize: 12, fontWeight: 700, letterSpacing: "0.4px", textTransform: "uppercase", color: "var(--color-brand-blue)", marginBottom: "var(--space-3)" }}>
                              {v.label || verseLabel(v.ref)}
                            </div>
                            {v.devanagari && (
                              <div style={{ fontFamily: "Gentium Book Plus, Georgia, serif", fontSize: 21, lineHeight: 1.75, color: "var(--color-label)", textAlign: "center", whiteSpace: "pre-line" }}>{v.devanagari}</div>
                            )}
                            {v.translit && (
                              <div style={{ marginTop: v.devanagari ? "var(--space-3)" : 0, fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 15.5, lineHeight: 1.7, color: "var(--color-label-2)", textAlign: "center", whiteSpace: "pre-line" }}>{v.translit}</div>
                            )}
                            {!v.devanagari && !v.translit && (
                              <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", color: "var(--color-label-3)", textAlign: "center" }}>Текст стиха готовится</div>
                            )}
                          </article>
                        );
                      })}
                      <div style={{ marginTop: "var(--space-4)", padding: "var(--space-4)", borderRadius: "var(--radius-lg)", background: "color-mix(in srgb, var(--color-label) 4%, transparent)", textAlign: "center", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", lineHeight: "var(--leading-snug)", color: "var(--color-label-2)" }}>
                        Дан оригинал стиха. Русский перевод и комментарий готовятся к публикации.
                      </div>
                    </>
                  )}
                  {!vLoading && verses && verses.length === 0 && (
                    <div style={{ padding: "var(--space-6) var(--space-5)", borderRadius: "var(--radius-lg)", background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)", textAlign: "center" }}>
                      <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-body)", fontWeight: "var(--weight-semibold)", color: "var(--color-label)" }}>Текст готовится</div>
                      <div style={{ marginTop: "var(--space-2)", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", lineHeight: "var(--leading-snug)", color: "var(--color-label-2)" }}>
                        Стихи этой главы появятся здесь после подготовки издания.
                      </div>
                    </div>
                  )}
                </div>

                {/* навигация по главам */}
                <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "var(--space-8)" }}>
                  <NavBtn dir="prev" disabled={curIndex <= 0} onClick={() => gotoFlat(curIndex - 1)} />
                  <NavBtn dir="next" disabled={curIndex < 0 || curIndex >= flatChapters.length - 1} onClick={() => gotoFlat(curIndex + 1)} />
                </div>
                <button onClick={() => setMode("toc")} style={{ marginTop: "var(--space-5)", width: "100%", padding: "var(--space-4)", borderRadius: "var(--radius-control)", border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)", color: "var(--color-brand-blue)", fontFamily: "var(--font-text)", fontSize: "var(--text-callout)", fontWeight: "var(--weight-semibold)", cursor: "pointer" }}>
                  Содержание книги
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ChapterRow({ label, sub, last, onClick }: { label: string; sub: string; last: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", width: "100%", padding: "var(--space-4) var(--space-4)", border: "none", borderBottom: last ? "none" : "0.5px solid var(--color-hairline)", background: "transparent", cursor: "pointer", textAlign: "left" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-body)", fontWeight: "var(--weight-semibold)", color: "var(--color-label)" }}>{label}</div>
        {sub && <div style={{ marginTop: 2, fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", color: "var(--color-label-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>}
      </div>
      <span style={{ color: "var(--color-label-3)", flexShrink: 0 }}><ChevR size={18} /></span>
    </button>
  );
}

function NavBtn({ dir, disabled, onClick }: { dir: "prev" | "next"; disabled: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ flex: 1, padding: "var(--space-4)", borderRadius: "var(--radius-control)", border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)", color: disabled ? "var(--color-label-3)" : "var(--color-label)", fontFamily: "var(--font-text)", fontSize: "var(--text-callout)", fontWeight: "var(--weight-semibold)", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1 }}>
      {dir === "prev" ? "← Глава назад" : "Глава вперёд →"}
    </button>
  );
}
