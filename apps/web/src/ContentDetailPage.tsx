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
import { api } from "./api";
import { BackIcon, HeartIcon, ShareIcon, MoreIcon, LinkIcon, TopIcon, type IconProps } from "./ui/icons";
import { renderTerms } from "./ui/Skt";

/** Круглая стеклянная кнопка навбара (как в ПКП). На hero — тёмное стекло; при
 *  скролле растворяется в фон и icon берёт цвет контента (передаётся onGlass). */
function NavBtn({ ariaLabel, onClick, onGlass, active, activeColor, children }: { ariaLabel: string; onClick: () => void; onGlass: number; active?: boolean; activeColor?: string; children: React.ReactNode }) {
  // onGlass: 1 → поверх фото (тёмное стекло, белый); 0 → на фоне (прозрачно, label)
  const dark = onGlass;
  return (
    <button type="button" aria-label={ariaLabel} aria-pressed={active} onClick={onClick}
      style={{ display: "grid", height: 38, width: 38, placeItems: "center", borderRadius: "50%", border: "none", cursor: "pointer",
        background: `color-mix(in srgb, rgba(0,0,0,0.42) ${Math.round(dark * 100)}%, transparent)`,
        color: active && activeColor ? activeColor : `color-mix(in srgb, #fff ${Math.round(dark * 100)}%, var(--color-label))`,
        backdropFilter: dark > 0.1 ? "blur(12px)" : "none", WebkitBackdropFilter: dark > 0.1 ? "blur(12px)" : "none",
        transition: "background 120ms linear, color 120ms linear" }}>
      {children}
    </button>
  );
}

function ActionsSheet({ open, items, onClose, onSelect }: { open: boolean; items: { key: string; label: string; danger?: boolean; icon: React.ReactNode }[]; onClose: () => void; onSelect: (key: string) => void }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,.4)", animation: "fadein 160ms ease" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, margin: "0 8px", marginBottom: "calc(8px + env(safe-area-inset-bottom,0px))", background: "var(--color-bg-2)", borderRadius: "var(--radius-glass)", padding: 8, boxShadow: "var(--shadow-card)" }}>
        <div style={{ height: 5, width: 36, borderRadius: 999, background: "var(--color-hairline)", margin: "6px auto 10px" }} />
        {items.map((it, i) => (
          <button key={it.key} onClick={() => onSelect(it.key)} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", width: "100%", textAlign: "left", padding: "13px 14px", background: "none", border: "none", borderBottom: i === items.length - 1 ? "none" : "0.5px solid var(--color-hairline)", fontFamily: "var(--font-text)", fontSize: "var(--text-body)", color: it.danger ? "#FF453A" : "var(--color-label)", cursor: "pointer" }}>
            <span style={{ flexShrink: 0, color: it.danger ? "#FF453A" : "var(--color-label-2)" }}>{it.icon}</span>
            {it.label}
          </button>
        ))}
        <button onClick={onClose} style={{ width: "100%", marginTop: 8, padding: "14px", borderRadius: "var(--radius-control)", border: "none", background: "var(--color-bg-3)", fontFamily: "var(--font-text)", fontSize: "var(--text-body)", fontWeight: 600, color: "var(--color-gold-deep)", cursor: "pointer" }}>Отмена</button>
      </div>
    </div>
  );
}

function Toast({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <div style={{ position: "fixed", left: "50%", bottom: "calc(40px + env(safe-area-inset-bottom,0px))", transform: "translateX(-50%)", zIndex: 90, maxWidth: 340, padding: "11px 18px", borderRadius: 999, background: "var(--color-label)", color: "var(--color-bg)", fontFamily: "var(--font-text)", fontSize: 14, fontWeight: 500, boxShadow: "var(--shadow-card)", textAlign: "center", animation: "fadein 160ms ease" }}>{msg}</div>;
}

function LogoMark({ src, label, height }: { src: string; label: string; height: number }) {
  return <span role="img" aria-label={label} style={{ display: "block", height, width: height, backgroundColor: "currentColor", WebkitMaskImage: `url(${src})`, maskImage: `url(${src})`, WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskPosition: "center", maskPosition: "center" }} />;
}

interface SignRef {
  author: string | null; authorSlug: string | null;
  workName: string | null; workId: string | null; workHref: string | null;
  division: string | null; divisionSlug: string | null; divisionHref: string | null;
  chapter: string | null; verse: string | null;
  chapterHref: string | null; verseHref: string | null;
  citation: string | null; raw: string;
}
interface Block { kind: string; text: string | null; image: string | null; ref?: SignRef }
interface NavLink { slug: string; name: string }
interface ContentDetail {
  slug: string; name: string; type: string; kind: string | null;
  hero_image: string | null; blocks: Block[]; paragraphs: string[];
  nav?: { parent: NavLink | null; prev: NavLink | null; next: NavLink | null };
}

/** Редакционный pull-quote (Apple Books / News): крупный курсив слева,
 *  тонкая акцентная линия, структурированная атрибуция со ссылками. */
function PullQuote({ text, ref, onPerson, onBook, onRef }: { text: string; ref: SignRef | null; onPerson: (slug: string) => void; onBook: (workId: string) => void; onRef: (href: string) => void }) {
  const link: React.CSSProperties = { background: "none", border: "none", padding: 0, margin: 0, font: "inherit", color: "var(--color-gold-deep)", cursor: "pointer" };
  const hasStruct = ref && (ref.author || ref.workName);
  // ридер есть для bg (товарная карточка) и cc/sb (референс-ридер)
  const deep = !!ref?.workId && ["bg", "cc", "sb"].includes(ref.workId);
  return (
    <figure style={{ margin: "var(--space-8) 0 0", paddingLeft: "var(--space-5)", borderLeft: "2px solid color-mix(in srgb, var(--color-gold-deep) 55%, transparent)" }}>
      <blockquote style={{ margin: 0, fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: "var(--text-title2)", lineHeight: 1.42, letterSpacing: "0.1px", color: "var(--color-label)" }}>
        {text}
      </blockquote>
      {ref && (hasStruct || ref.raw) && (
        <figcaption style={{ marginTop: "var(--space-4)", fontFamily: "var(--font-text)", fontSize: "var(--text-footnote)", lineHeight: "var(--leading-snug)", color: "var(--color-label-2)" }}>
          {hasStruct ? (
            <>
              {/* строка 1 — автор → личность */}
              {ref.author && (
                <div style={{ marginBottom: 3 }}>
                  {ref.authorSlug
                    ? <button onClick={() => onPerson(ref.authorSlug as string)} style={{ ...link, fontWeight: 600 }}>{ref.author}</button>
                    : <span style={{ fontWeight: 600, color: "var(--color-label)" }}>{ref.author}</span>}
                </div>
              )}
              {/* строка 2 — книга → книга */}
              {ref.workName && (
                <div>
                  {deep && ref.workId
                    ? <button onClick={() => onBook(ref.workId as string)} style={link}>{ref.workName}</button>
                    : <span>{ref.workName}</span>}
                </div>
              )}
              {/* строка 3 — место в книге: раздел · глава · стих (каждое — ссылка) */}
              {(ref.division || ref.chapter || ref.verse || (!ref.workName && ref.citation)) && (
                <div style={{ marginTop: ref.workName ? 1 : 0 }}>
                  {ref.division && (
                    deep && ref.divisionHref
                      ? <button onClick={() => onRef(ref.divisionHref as string)} style={link}>{ref.division}</button>
                      : <span>{ref.division}</span>
                  )}
                  {ref.chapter && (
                    <span>{ref.division ? ", " : ""}
                      {deep && ref.chapterHref
                        ? <button onClick={() => onRef(ref.chapterHref as string)} style={link}>глава {ref.chapter}</button>
                        : <span>глава {ref.chapter}</span>}
                    </span>
                  )}
                  {ref.verse && (
                    <span>{(ref.division || ref.chapter) ? ", " : ""}
                      {deep && ref.verseHref
                        ? <button onClick={() => onRef(ref.verseHref as string)} style={link}>{/\d/.test(ref.verse) ? `стих ${ref.verse}` : ref.verse}</button>
                        : <span>{/\d/.test(ref.verse) ? `стих ${ref.verse}` : ref.verse}</span>}
                    </span>
                  )}
                  {!ref.workName && ref.citation && <span>{ref.citation}</span>}
                </div>
              )}
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

/** Кнопка нижней навигации произведения — плоский pill (как в читалке). */
function ContentNavAction({ arrow, disabled, onClick, children }: { arrow?: "prev" | "next"; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  const [pressed, setPressed] = useState(false);
  const off = () => setPressed(false);
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      onPointerDown={() => { if (!disabled) setPressed(true); }} onPointerUp={off} onPointerLeave={off} onPointerCancel={off}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, minWidth: 0, height: 40, padding: "0 12px", borderRadius: 12, border: "none", cursor: disabled ? "default" : "pointer", background: !disabled && pressed ? "var(--color-fill-2, rgba(120,120,128,.12))" : "transparent", color: disabled ? "var(--color-label-3, var(--color-label-2))" : "var(--color-label)", opacity: disabled ? 0.4 : 1, fontFamily: "var(--font-text)", fontSize: 14.5, fontWeight: "var(--weight-semibold)", transition: "background .12s", WebkitTapHighlightColor: "transparent", whiteSpace: "nowrap", overflow: "hidden" }}>
      {arrow === "prev" && <BackIcon size={18} />}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{children}</span>
      {arrow === "next" && <span style={{ display: "inline-flex", transform: "scaleX(-1)" }}><BackIcon size={18} /></span>}
    </button>
  );
}

export default function ContentDetailPage({ slug, onBack, onOpenContent, onOpenBook, onOpenRef }: { slug: string; onBack: () => void; onOpenContent: (slug: string) => void; onOpenBook: (workId: string) => void; onOpenRef: (href: string) => void }) {
  const [data, setData] = useState<ContentDetail | null>(null);
  const [err, setErr] = useState(false);
  const [t, setT] = useState(0); // 0..1 прогресс ухода hero под навбар
  const [prog, setProg] = useState(0); // 0..1 прогресс чтения по странице
  const scrollRef = useRef<HTMLDivElement>(null);
  const [favorited, setFavorited] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = (m: string) => { setToast(m); if (toastTimer.current) clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 2000); };
  const pageUrl = `https://gaurangers.com${slug}`;
  const share = async () => {
    const payload = { title: data?.name ?? "ISKCON ONE LOVE", text: data?.name ? `${data.name} — gaurangers.com` : "gaurangers.com", url: pageUrl };
    try { if (typeof navigator !== "undefined" && (navigator as Navigator).share) { await (navigator as Navigator).share(payload); return; } } catch { /* cancelled */ }
    try { await navigator.clipboard.writeText(pageUrl); flash("Ссылка скопирована"); } catch { flash(pageUrl); }
  };
  const toggleFav = () => { const nv = !favorited; setFavorited(nv); flash(nv ? "Добавлено в избранное" : "Убрано из избранного"); };
  const menuItems = [
    { key: "share", label: "Поделиться", icon: <ShareIcon size={19} /> },
    { key: "copy", label: "Скопировать ссылку", icon: <LinkIcon size={19} /> },
    { key: "fav", label: favorited ? "Убрать из избранного" : "В избранное", icon: <HeartIcon size={19} filled={favorited} /> },
    { key: "top", label: "В начало", icon: <TopIcon size={19} /> },
  ];
  const onMenu = (key: string) => {
    setMenuOpen(false);
    if (key === "share") return void share();
    if (key === "copy") { navigator.clipboard?.writeText(pageUrl).then(() => flash("Ссылка скопирована")).catch(() => flash(pageUrl)); return; }
    if (key === "fav") return toggleFav();
    if (key === "top") { scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" }); return; }
  };

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
    const onScroll = () => {
      setT(Math.min(1, Math.max(0, el.scrollTop / 180)));
      const max = el.scrollHeight - el.clientHeight;
      setProg(max > 8 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [data]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onBack();
      else if (e.key === "ArrowLeft" && data?.nav?.prev) onOpenContent(data.nav.prev.slug);
      else if (e.key === "ArrowRight" && data?.nav?.next) onOpenContent(data.nav.next.slug);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [data, onBack, onOpenContent]);

  const blocks = data?.blocks ?? [];
  const useBlocks = blocks.length > 0;
  const hasHeroImg = !!data?.hero_image;
  // имя личности на оригинале часто повторяется первым heading-блоком — не дублируем H1
  const skipFirstHeading = useBlocks && blocks[0]?.kind === "heading"
    && (blocks[0].text || "").trim().toLowerCase() === (data?.name || "").trim().toLowerCase();
  // первый accent (сразу под именем) — дек/подзаголовок; последующие accent — секционные интерлюдии
  const firstAccentIdx = blocks.findIndex((b) => b.kind === "accent");

  return (
    <div style={{ position: "fixed", top: 0, bottom: 0, left: 0, right: 0, margin: "0 auto", width: "100%", maxWidth: 480, zIndex: 70, display: "flex", flexDirection: "column", background: "var(--color-bg)" }}>
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
        {data && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <NavBtn ariaLabel={favorited ? "Убрать из избранного" : "В избранное"} onClick={toggleFav} onGlass={1 - t} active={favorited} activeColor="#FF453A"><HeartIcon size={18} filled={favorited} /></NavBtn>
            <NavBtn ariaLabel="Поделиться" onClick={() => void share()} onGlass={1 - t}><ShareIcon size={17} /></NavBtn>
            <NavBtn ariaLabel="Ещё" onClick={() => setMenuOpen(true)} onGlass={1 - t}><MoreIcon size={16} /></NavBtn>
          </div>
        )}
        <div aria-hidden style={{ position: "absolute", left: 0, bottom: 0, height: 2, width: `${prog * 100}%`, background: "var(--color-gold-deep)", borderRadius: "0 2px 2px 0", transition: "width .12s linear" }} />
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

            <div style={{ maxWidth: 680, margin: "0 auto", padding: "var(--space-5) var(--pad-card) calc(env(safe-area-inset-bottom,0px) + 64px + var(--player-extra))" }}>
              {/* заголовочный блок: eyebrow (мягкий регистр) + Large Title */}
              {data.kind && (
                <div style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)", fontWeight: "var(--weight-semibold)", color: "var(--color-gold-deep)", marginBottom: "var(--space-2)" }}>
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
                      case "accent": {
                        // дек — крупный серый подзаголовок сразу под именем (стандарт страницы Кришны)
                        if (i === firstAccentIdx)
                          return <p key={i} style={{ margin: "var(--space-4) 0 0", fontFamily: "var(--font-text)", fontSize: "var(--text-title3)", fontWeight: "var(--weight-regular)", lineHeight: 1.4, color: "var(--color-label-2)" }}>{renderTerms(b.text)}</p>;
                        // секционная интерлюдия — по центру, с тонкой линией сверху; пара accent'ов подряд читается как один блок
                        const prevAccent = blocks[i - 1]?.kind === "accent";
                        return (
                          <p key={i} style={{ margin: prevAccent ? "var(--space-2) 0 0" : "var(--space-8) 0 0", paddingTop: prevAccent ? 0 : "var(--space-6)", borderTop: prevAccent ? "none" : "0.5px solid var(--color-hairline)", textAlign: "center", fontFamily: "var(--font-display)", fontSize: "var(--text-title3)", fontWeight: "var(--weight-medium)", letterSpacing: "var(--tracking-tight)", lineHeight: "var(--leading-snug)", color: "var(--color-label)" }}>{b.text}</p>
                        );
                      }
                      case "image":
                        return b.image ? <Figure key={i} src={b.image} /> : null;
                      case "quote": {
                        const ref = next && next.kind === "sign" ? (next.ref ?? null) : null;
                        return <PullQuote key={i} text={b.text ?? ""} ref={ref} onPerson={onOpenContent} onBook={onOpenBook} onRef={onOpenRef} />;
                      }
                      default:
                        return <p key={i} style={{ margin: "var(--space-5) 0 0", fontFamily: "var(--font-text)", fontSize: "var(--text-body)", lineHeight: "var(--leading-normal)", color: "var(--color-label)" }}>{renderTerms(b.text)}</p>;
                    }
                  })}
                </div>
              ) : (
                (() => {
                  // page_text часто содержит мусор скрейпа: после каждого стиха идут
                  // строки-подписи «<автор> ,» и «<название>,». Чистим их перед версткой.
                  const nm = (data.name || "").trim().toLowerCase().replace(/[.,;:\s]+$/, "");
                  const norm = (s: string) => s.trim().toLowerCase().replace(/[.,;:\s]+$/, "");
                  const ps = data.paragraphs;
                  const clean: string[] = [];
                  for (let i = 0; i < ps.length; i++) {
                    const cur = norm(ps[i]);
                    if (nm && cur === nm) continue;                                   // строка == название (подпись)
                    if (cur.length < 44 && nm && norm(ps[i + 1] || "") === nm) continue; // короткая строка-автор перед подписью
                    clean.push(ps[i]);
                  }
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", marginTop: "var(--space-5)" }}>
                      {clean.map((p, i) => (
                        <p key={i} style={{ margin: 0, fontFamily: "var(--font-text)", fontSize: "var(--text-body)", lineHeight: "var(--leading-relaxed, 1.72)", color: "var(--color-label)" }}>{renderTerms(p)}</p>
                      ))}
                    </div>
                  );
                })()
              )}
            </div>
          </>
        )}
      </div>

      {data && data.nav && (data.nav.parent || data.nav.prev || data.nav.next) && (
        <nav style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, padding: "8px 8px calc(8px + env(safe-area-inset-bottom) + var(--player-extra))", background: "var(--color-bg)", borderTop: "0.5px solid var(--color-hairline)" }}>
          <ContentNavAction arrow="prev" disabled={!data.nav.prev} onClick={() => data.nav?.prev && onOpenContent(data.nav.prev.slug)}>Назад</ContentNavAction>
          <ContentNavAction disabled={!data.nav.parent} onClick={() => data.nav?.parent && onOpenContent(data.nav!.parent!.slug)}>К содержанию</ContentNavAction>
          <ContentNavAction arrow="next" disabled={!data.nav.next} onClick={() => data.nav?.next && onOpenContent(data.nav.next.slug)}>Вперёд</ContentNavAction>
        </nav>
      )}

      <ActionsSheet open={menuOpen} items={menuItems} onClose={() => setMenuOpen(false)} onSelect={onMenu} />
      <Toast msg={toast} />
    </div>
  );
}
