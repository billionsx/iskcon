/**
 * TirthaDetailPage — страница одного святого места (тиртхи).
 *
 * Hero — градиент в цвете-акценте дхамы (фотографий отдельных мест нет),
 * поверх — категория, IAST и название. Далее: описание места, раздел «Лила»
 * (что здесь происходило), «Связанные личности» (чипы — тап резолвит героя
 * через /api/entities?q=… и открывает его страницу) и ссылка «Открыть в картах».
 *
 * Тексты — оригинальная редакционная проза (не копии парикрам-гайдов): связи
 * лила→место→личность традиционны и общеизвестны.
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { BackIcon, HeartIcon, MoreIcon } from "../ui/icons";
import { api } from "../api";
import { mapsDir, mapsQuery, type Dhama, type Person, type Tirtha } from "./dhamas";
import { TirthaHeroCard } from "./TirthaHeroCard";
import { useFavorite } from "../cardActions";
import { BookMenuSheet } from "../BookMenuSheet";
import { QrSheet } from "../QrSheet";
import { requestNote } from "../notes";
import { NotesAtSource } from "../NotesAtSource";

const NAV_H = 52;

const navBtn = (active: boolean): CSSProperties => ({ display: "grid", height: 44, width: 44, placeItems: "center", borderRadius: "50%", border: "none", background: "none", color: active ? "var(--color-red)" : "var(--color-label)", cursor: "pointer", WebkitTapHighlightColor: "transparent" });

function PinIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.4" />
    </svg>
  );
}

/** Чип связанной личности: тап → резолв id по имени → открытие страницы героя. */
function PersonChip({ person, accent, onOpenEntity, onMiss }: { person: Person; accent: string; onOpenEntity: (id: string, type: string | null) => void; onMiss: () => void }) {
  const [busy, setBusy] = useState(false);
  const open = async () => {
    if (busy) return;
    // Точный путь: id из FK (tirtha_persons.entity_id) — открываем мгновенно, без поиска.
    if (person.entityId) { onOpenEntity(person.entityId, "personality"); return; }
    setBusy(true);
    try {
      const r = await fetch(api(`/entities?q=${encodeURIComponent(person.q)}&limit=1`));
      const d = await r.json();
      const id = (d?.items as { id: string }[] | undefined)?.[0]?.id;
      if (id) onOpenEntity(id, "personality");
      else onMiss();
    } catch {
      onMiss();
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" className="tap-press" onClick={() => void open()} disabled={busy}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: "var(--radius-pill)", cursor: busy ? "default" : "pointer",
        fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: "var(--weight-semibold)", letterSpacing: "-0.1px", color: "var(--color-label)",
        background: `color-mix(in srgb, ${accent} 11%, transparent)`, border: `0.5px solid color-mix(in srgb, ${accent} 34%, transparent)`,
        opacity: busy ? 0.6 : 1, WebkitTapHighlightColor: "transparent" }}>
      <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: accent, flexShrink: 0 }} />
      {person.name}
    </button>
  );
}

function NotFound({ dhama, onBack }: { dhama: Dhama; onBack: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "var(--color-bg)" }}>
      <header style={{ height: NAV_H, display: "flex", alignItems: "center", padding: "0 6px", borderBottom: "0.5px solid var(--color-hairline)" }}>
        <button aria-label="Назад" onClick={onBack} style={{ display: "grid", height: 44, width: 44, placeItems: "center", borderRadius: "50%", border: "none", background: "none", color: "var(--color-label)", cursor: "pointer" }}>
          <BackIcon size={22} />
        </button>
      </header>
      <div style={{ flex: 1, display: "grid", placeItems: "center", padding: "var(--space-6)", textAlign: "center" }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-title3)", fontWeight: "var(--weight-bold)", color: "var(--color-label)" }}>Место не найдено</div>
          <p style={{ margin: "6px 0 0", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", color: "var(--color-label-2)" }}>Эта тиртха отсутствует в дхаме «{dhama.name}».</p>
        </div>
      </div>
    </div>
  );
}

export default function TirthaDetailPage({ dhama, tirthaId, onBack, onOpenEntity }: { dhama: Dhama; tirthaId: string; onBack: () => void; onOpenEntity: (id: string, type: string | null) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = (m: string) => { setToast(m); if (toastTimer.current) clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 1800); };
  const [qr, setQr] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const moreRef = useRef<HTMLSpanElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const [navSolid, setNavSolid] = useState(false);

  const t: Tirtha | undefined = dhama.tirthas.find((x) => x.id === tirthaId);
  const { on: favorited, toggle: toggleFav } = useFavorite(t ? `tirtha:${t.id}` : "tirtha:__none__", { t: t?.name || "", s: t?.iast || "", h: t ? `/dhama/${dhama.id}/${t.id}` : "" });

  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [tirthaId]);
  // iOS large-title: имя в шапке проявляется, когда герой ушёл под навбар.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const h = heroRef.current;
        const trig = h ? h.offsetHeight - NAV_H - 8 : 240;
        setNavSolid(el.scrollTop > trig);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => { el.removeEventListener("scroll", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [tirthaId]);

  if (!t) return <NotFound dhama={dhama} onBack={onBack} />;

  const accent = dhama.accent;
  const clusterTitle = dhama.clusters.find((c) => c.id === t.cluster)?.title;
  const mapsHref = `https://maps.google.com/?q=${encodeURIComponent(mapsQuery(t))}`;

  const onMenu = (id: string) => {
    if (id === "share") {
      const url = `${window.location.origin}/dhama/${dhama.id}/${t.id}`;
      const nav = window.navigator as Navigator & { share?: (d: { title: string; url: string }) => Promise<void> };
      if (nav.share) void nav.share({ title: t.name, url }).catch(() => undefined);
      else { try { void window.navigator.clipboard?.writeText(url); flash("Ссылка скопирована"); } catch { flash(url); } }
    } else if (id === "qr") setQr(true);
    else if (id === "route") { try { window.open(mapsHref, "_blank", "noopener"); } catch { /* noop */ } }
    else if (id === "note") requestNote({ kind: "place", ref: t.id, title: t.name, subtitle: dhama.name, href: `/dhama/${dhama.id}/${t.id}` });
    else if (id === "report") flash("Спасибо! Передадим редакции.");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", minHeight: 0, background: "var(--color-bg)" }}>
      {/* sticky навбар — iOS 26 Liquid Glass */}
      <header className={navSolid ? "glass-nav glass-nav-edge" : "glass-nav"} style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 30, height: NAV_H, display: "flex", alignItems: "center", gap: "var(--space-1)", padding: "0 6px" }}>
        <button aria-label="Назад" onClick={onBack} style={navBtn(false)}>
          <BackIcon size={24} />
        </button>
        <div style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-display)", fontSize: "var(--text-headline)", fontWeight: "var(--weight-semibold)", letterSpacing: "var(--tracking-tight)", color: "var(--color-label)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", opacity: navSolid ? 1 : 0, transform: navSolid ? "none" : "translateY(3px)", transition: "opacity var(--duration-base) var(--ease-standard), transform var(--duration-base) var(--ease-standard)", pointerEvents: "none" }}>{t.name}</div>
        <div data-pdf-no-print style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          <button aria-label="В избранное" onClick={() => toggleFav(flash)} style={navBtn(favorited)}><HeartIcon size={22} filled={favorited} /></button>
          <button aria-label="Открыть в картах" onClick={() => { try { window.open(mapsHref, "_blank", "noopener"); } catch { /* noop */ } }} style={navBtn(false)}><PinIcon size={22} /></button>
          <span ref={moreRef} style={{ display: "inline-flex" }}><button aria-label="Ещё" onClick={() => setMenuOpen(true)} style={navBtn(false)}><MoreIcon size={20} /></button></span>
        </div>
      </header>

      <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        {/* hero (ПКП) */}
        <div ref={heroRef} style={{ padding: "16px 16px 0" }}>
          <TirthaHeroCard dhamaId={dhama.id} tirtha={t} accent={accent} dhamaName={dhama.name} clusterTitle={clusterTitle} presentational onMenuSelect={onMenu} flash={flash} />
        </div>

        <div style={{ padding: "20px 16px calc(env(safe-area-inset-bottom,0px) + 64px)" }}>
          <div style={{ marginBottom: 18 }}><NotesAtSource kind="place" refId={t.id} accent={accent} /></div>
          {/* описание (у новых мест about — начало первого источника; не дублируем) */}
          {t.about && !(t.sources && t.sources[0]?.paragraphs?.[0]?.slice(0, 55) === t.about.slice(0, 55)) && (
            <p style={{ margin: 0, fontFamily: "var(--font-text)", fontSize: "var(--text-body)", lineHeight: "var(--leading-normal)", color: "var(--color-label)" }}>{t.about}</p>
          )}

          {/* навигатор: пеший маршрут в Google Maps */}
          <a href={mapsDir(t)} className="tap-press" target="_blank" rel="noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)", marginTop: "var(--space-4)", padding: "10px 16px", borderRadius: "var(--radius-pill)",
              background: accent, color: "#fff", textDecoration: "none", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: "var(--weight-semibold)",
              boxShadow: "var(--shadow-card)", WebkitTapHighlightColor: "transparent" }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden style={{ display: "block" }}>
              <path d="M12 2 4.6 20.3a.7.7 0 0 0 .98.84L12 18l6.42 3.14a.7.7 0 0 0 .98-.84L12 2z" />
            </svg>
            Проложить маршрут
          </a>

          {/* лила */}
          {t.lila && (
            <section style={{ marginTop: "var(--space-6)" }}>
              <div style={{ fontSize: "var(--text-caption2)", fontWeight: "var(--weight-bold)", letterSpacing: "0.4px", textTransform: "uppercase", color: accent }}>Лила</div>
              <div style={{ marginTop: "var(--space-2)", padding: "var(--space-4) var(--space-4)", borderRadius: "var(--radius-lg)", background: `color-mix(in srgb, ${accent} 7%, var(--color-bg-2))`, border: `0.5px solid color-mix(in srgb, ${accent} 22%, var(--color-hairline))` }}>
                <p style={{ margin: 0, fontFamily: "var(--font-text)", fontSize: "var(--text-body)", lineHeight: "var(--leading-normal)", color: "var(--color-label)" }}>{t.lila}</p>
              </div>
            </section>
          )}

          {/* источник: BBT-книга (курсивом, как цитата) либо подпись о традиции */}
          {t.source && (
            <div style={{ marginTop: "var(--space-4)", display: "flex", gap: "var(--space-2)", alignItems: "baseline", flexWrap: "wrap" }}>
              <span style={{ flexShrink: 0, fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)", fontWeight: "var(--weight-bold)", letterSpacing: "0.4px", textTransform: "uppercase", color: "var(--color-label-3)" }}>Источник</span>
              <span style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", lineHeight: "var(--leading-normal)", color: "var(--color-label-2)", fontStyle: t.source.startsWith("«") ? "italic" : "normal" }}>{t.source}</span>
            </div>
          )}

          {/* из священных книг — структурированные описания (vrajapedia) */}
          {t.sources && t.sources.length > 0 && (
            <section style={{ marginTop: 28 }}>
              <h3 style={{ margin: "0 0 13px", fontFamily: "var(--font-display)", fontSize: "var(--text-title3)", fontWeight: "var(--weight-bold)", letterSpacing: "-0.3px", color: "var(--color-label)" }}>Из священных книг</h3>
              {t.sources.map((src, i) => (
                <article key={i} style={{ marginTop: i ? 14 : 0, padding: "var(--space-4) var(--space-5)", borderRadius: "var(--radius-lg)", background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)" }}>
                  {(src.author || src.book) && (
                    <header style={{ marginBottom: 11, paddingBottom: 11, borderBottom: "0.5px solid var(--color-hairline)" }}>
                      {src.author && <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-subhead)", fontWeight: "var(--weight-bold)", letterSpacing: "-0.2px", color: "var(--color-label)" }}>{src.author}</div>}
                      {src.book && <div style={{ marginTop: 2, fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", fontStyle: "italic", color: "var(--color-label-2)" }}>«{src.book}»</div>}
                    </header>
                  )}
                  {src.paragraphs.map((para, j) =>
                    para.startsWith("## ") ? (
                      <div key={j} style={{ margin: j ? "13px 0 0" : 0, fontFamily: "var(--font-display)", fontSize: "var(--text-subhead)", fontWeight: "var(--weight-bold)", color: "var(--color-label)" }}>{para.slice(3)}</div>
                    ) : (
                      <p key={j} style={{ margin: j ? "10px 0 0" : 0, fontFamily: "var(--font-text)", fontSize: "var(--text-body)", lineHeight: "var(--leading-normal)", color: "var(--color-label)" }}>{para}</p>
                    ),
                  )}
                  {src.footnotes && src.footnotes.length > 0 && (
                    <div style={{ marginTop: 14, paddingTop: "var(--space-3)", borderTop: "0.5px solid var(--color-hairline)" }}>
                      {src.footnotes.map((f, k) => (
                        <p key={k} style={{ margin: k ? "6px 0 0" : 0, fontFamily: "var(--font-text)", fontSize: "var(--text-caption)", lineHeight: "var(--leading-normal)", color: "var(--color-label-3)" }}>
                          {f.n ? <sup style={{ marginRight: "var(--space-1)", color: accent, fontWeight: "var(--weight-bold)" }}>{f.n}</sup> : null}{f.text}
                        </p>
                      ))}
                    </div>
                  )}
                </article>
              ))}
              <p style={{ margin: "12px 2px 0", fontFamily: "var(--font-text)", fontSize: "var(--text-caption)", lineHeight: "var(--leading-normal)", color: "var(--color-label-3)" }}>
                Источник: онлайн-энциклопедия Вриндавана «Шри Рупа Сева Кундж» (vrajapedia.com), публикуется с разрешения правообладателя.
              </p>
            </section>
          )}

          {/* связанные личности */}
          {t.persons && t.persons.length > 0 && (
            <section style={{ marginTop: 26 }}>
              <h3 style={{ margin: "0 0 11px", fontFamily: "var(--font-display)", fontSize: "var(--text-title3)", fontWeight: "var(--weight-bold)", letterSpacing: "-0.3px", color: "var(--color-label)" }}>Связанные личности</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
                {t.persons.map((p) => (
                  <PersonChip key={p.q} person={p} accent={accent} onOpenEntity={onOpenEntity} onMiss={() => flash(`${p.name}: страница появится позже`)} />
                ))}
              </div>
            </section>
          )}

          {/* карты */}
          <section style={{ marginTop: 26 }}>
            <a href={mapsHref} className="tap-press-soft" target="_blank" rel="noreferrer"
              style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-4) var(--space-4)", borderRadius: "var(--radius-lg)", textDecoration: "none",
                background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)", color: "var(--color-label)" }}>
              <span aria-hidden style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: "var(--radius-control)", flexShrink: 0, color: accent, background: `color-mix(in srgb, ${accent} 13%, transparent)` }}>
                <PinIcon size={19} />
              </span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: "var(--text-callout)", fontWeight: "var(--weight-semibold)", letterSpacing: "-0.2px" }}>Открыть в Google Картах</span>
                <span style={{ display: "block", marginTop: 1, fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", color: "var(--color-label-3)" }}>Местоположение тиртхи</span>
              </span>
              <span aria-hidden style={{ flexShrink: 0, color: "var(--color-label-3)", fontSize: "var(--text-body)" }}>↗</span>
            </a>
          </section>

          {/* сноска об источнике */}
          <p style={{ margin: "22px 2px 0", fontFamily: "var(--font-text)", fontSize: "var(--text-caption)", lineHeight: "var(--leading-normal)", color: "var(--color-label-3)" }}>
            Описание подготовлено редакцией gaurangers.com на основе традиционных источников. Координаты приблизительны.
          </p>
        </div>
      </div>

      {toast && <div style={{ position: "fixed", left: "50%", bottom: "calc(40px + env(safe-area-inset-bottom,0px))", transform: "translateX(-50%)", zIndex: 90, padding: "11px 18px", borderRadius: "var(--radius-pill)", maxWidth: "86vw", textAlign: "center", background: "var(--color-label)", color: "var(--color-bg)", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: "var(--weight-medium)", boxShadow: "var(--shadow-card)" }}>{toast}</div>}
      {qr && typeof window !== "undefined" && (
        <QrSheet url={`${window.location.origin}/dhama/${dhama.id}/${t.id}`} data={{ kind: "card", title: t.name, subtitle: [dhama.name, clusterTitle].filter(Boolean).join(" · ") }} onClose={() => setQr(false)} />
      )}
      <BookMenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} onSelect={(id) => onMenu(id)} anchorRef={moreRef} variant="center" centerCanManage={false} centerHasMaps />
    </div>
  );
}
