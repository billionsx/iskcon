/**
 * BookDetailPage (ПКП) — iOS 26 / Liquid Glass reading surface.
 *   scroll-aware TopBar над hero → hero-карусель →
 *   sticky liquid-glass табы (Содержание · О книге · Автор) →
 *   контент активного таба. Ридер главы и стиха — fixed-overlay
 *   в том же 480px-фрейме, с glass-навигацией и крупными заголовками.
 * Данные книги — books.ts; стихи — API (/chapters/:n/read, /verses/:ref).
 */
import { useEffect, useRef, useState } from "react";
import type { SVGProps, ReactNode, CSSProperties } from "react";
import type { BookData } from "./books";
import { BOOK_MENU_ITEMS } from "./books";
import { api } from "./api";
import { DEMO_VERSES, DEMO_REFS } from "./demo";
import { BackIcon, HeartIcon, MoreIcon } from "./ui/icons";

/* ───────── icons ───────── */
interface IconProps extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> { size?: number; filled?: boolean; }
const sp = ({ size = 24 }: IconProps) => ({ width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true as const });
const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function BagIcon(p: IconProps & { cornerGlyph?: "plus" | "minus" | null }) {
  const { cornerGlyph, ...rest } = p;
  const corner = cornerGlyph === "plus"
    ? <g><line x1="20" y1="3.25" x2="23.5" y2="3.25" {...STROKE} /><line x1="21.75" y1="1.5" x2="21.75" y2="5" {...STROKE} /></g>
    : cornerGlyph === "minus" ? <line x1="20" y1="3.25" x2="23.5" y2="3.25" {...STROKE} /> : null;
  return <svg {...sp(rest)} overflow="visible"><path {...STROKE} d="M5.4 7.5h13.2a1 1 0 0 1 1 1.1l-1.2 11.4a1.5 1.5 0 0 1-1.5 1.4H7.1a1.5 1.5 0 0 1-1.5-1.4L4.4 8.6a1 1 0 0 1 1-1.1Z" /><path {...STROKE} d="M8 9V6.5a4 4 0 0 1 8 0V9" />{corner}</svg>;
}
function PlayIcon(p: IconProps) { return <svg {...sp(p)}><path d="M7 5l12 7-12 7V5z" fill="currentColor" /></svg>; }
function HeadphonesIcon(p: IconProps) {
  return <svg {...sp(p)}><path {...STROKE} d="M4 13v-1a8 8 0 0 1 16 0v1" /><rect x="3.2" y="12" width="4.2" height="7" rx="2.1" {...STROKE} /><rect x="16.6" y="12" width="4.2" height="7" rx="2.1" {...STROKE} /></svg>;
}
function ChevronIcon({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden style={{ flexShrink: 0 }}><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function SlidersIcon(p: IconProps) {
  return <svg {...sp(p)}><path {...STROKE} d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" {...STROKE} /><circle cx="8" cy="12" r="2" {...STROKE} /><circle cx="18" cy="18" r="2" {...STROKE} /></svg>;
}

function LogoMark({ src, label, height }: { src: string; label: string; height: number }) {
  return <span role="img" aria-label={label} style={{ display: "block", height, width: height, backgroundColor: "currentColor", WebkitMaskImage: `url(${src})`, maskImage: `url(${src})`, WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskPosition: "center", maskPosition: "center" }} />;
}

/* Centered hairline ornament with a small diamond (verse-block divider). */
function Ornament() {
  return (
    <div aria-hidden style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, margin: "8px 0 28px" }}>
      <span style={{ width: 44, height: 0.5, background: "linear-gradient(to right, transparent, var(--color-hairline))" }} />
      <span style={{ color: "var(--color-brand-blue)", opacity: .55, fontSize: 9 }}>◆</span>
      <span style={{ width: 44, height: 0.5, background: "linear-gradient(to left, transparent, var(--color-hairline))" }} />
    </div>
  );
}

/* ───────── pressable row (iOS highlight on touch) ───────── */
function Pressable({ onClick, children, style, ariaLabel }: { onClick?: () => void; children: ReactNode; style?: CSSProperties; ariaLabel?: string }) {
  const [pressed, setPressed] = useState(false);
  const off = () => setPressed(false);
  return (
    <button type="button" aria-label={ariaLabel} onClick={onClick}
      onPointerDown={() => setPressed(true)} onPointerUp={off} onPointerLeave={off} onPointerCancel={off}
      style={{ display: "block", width: "100%", textAlign: "left", appearance: "none", WebkitTapHighlightColor: "transparent", border: "none", cursor: "pointer", color: "var(--color-label)", fontFamily: "var(--font-text)", transition: "background .12s var(--ease-standard)", background: pressed ? "var(--color-glass-thin)" : "transparent", ...style }}>
      {children}
    </button>
  );
}

/* ───────── circular glass control ───────── */
function CircleBtn({ ariaLabel, onClick, active, children, size = 40 }: { ariaLabel: string; onClick: () => void; active?: boolean; children: ReactNode; size?: number }) {
  const [pressed, setPressed] = useState(false);
  const off = () => setPressed(false);
  return (
    <button type="button" aria-label={ariaLabel} onClick={onClick}
      onPointerDown={() => setPressed(true)} onPointerUp={off} onPointerLeave={off} onPointerCancel={off}
      style={{ display: "grid", height: size, width: size, placeItems: "center", borderRadius: "50%", border: "none", cursor: "pointer", color: "var(--color-label)", background: pressed || active ? "var(--color-glass-regular)" : "transparent", transition: "background .12s var(--ease-standard)", WebkitTapHighlightColor: "transparent" }}>
      {children}
    </button>
  );
}

/* ───────── liquid-glass tabs ───────── */
type BookTabId = "contents" | "overview" | "author";
const BOOK_TABS: { id: BookTabId; label: string }[] = [
  { id: "contents", label: "Содержание" },
  { id: "overview", label: "О книге" },
  { id: "author", label: "Автор" },
];

function BookTabs({ active, onChange }: { active: BookTabId; onChange: (id: BookTabId) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  useEffect(() => {
    const el = tabRefs.current[active]; const c = containerRef.current;
    if (!el || !c) return;
    const target = el.offsetLeft - (c.clientWidth - el.clientWidth) / 2;
    c.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [active]);
  return (
    <nav aria-label="Разделы книги" className="glass-nav glass-nav-edge" style={{ position: "sticky", top: 56, zIndex: 20 }}>
      <div ref={containerRef} style={{ display: "flex", alignItems: "center", overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
        {BOOK_TABS.map((t) => {
          const on = t.id === active;
          return (
            <button key={t.id} ref={(el) => { tabRefs.current[t.id] = el; }} type="button" onClick={() => onChange(t.id)}
              style={{ position: "relative", flexShrink: 0, padding: "13px 18px", fontSize: 15, background: "none", border: "none", cursor: "pointer", color: on ? "var(--color-label)" : "var(--color-label-2)", fontWeight: on ? 700 : 500, letterSpacing: on ? "-0.01em" : 0, transition: "color .15s", WebkitTapHighlightColor: "transparent" }}>
              {t.label}
              {on && <span aria-hidden style={{ position: "absolute", insetInline: 14, bottom: 0, height: 2.5, borderRadius: 999, background: "var(--color-brand-blue)" }} />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* ───────── actions sheet (⋯) ───────── */
function ActionsSheet({ open, onClose, onSelect }: { open: boolean; onClose: () => void; onSelect: (label: string) => void }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,.4)", backdropFilter: "blur(2px)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "var(--color-bg-2)", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: "8px 0 max(8px, env(safe-area-inset-bottom))", boxShadow: "var(--shadow-card)" }}>
        <div style={{ height: 5, width: 36, borderRadius: 999, background: "var(--color-hairline)", margin: "8px auto 12px" }} />
        {BOOK_MENU_ITEMS.map((label) => (
          <Pressable key={label} onClick={() => onSelect(label)} style={{ padding: "14px 22px", fontSize: 17 }}>{label}</Pressable>
        ))}
      </div>
    </div>
  );
}

/* ───────── transient toast ───────── */
function Toast({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div style={{ position: "fixed", left: "50%", bottom: "calc(40px + env(safe-area-inset-bottom,0px))", transform: "translateX(-50%)", zIndex: 90, maxWidth: 360, padding: "11px 18px", borderRadius: 999, background: "var(--color-label)", color: "var(--color-bg)", fontFamily: "var(--font-text)", fontSize: 14, fontWeight: 500, boxShadow: "var(--shadow-card)", textAlign: "center" }}>{msg}</div>
  );
}

/* ───────── section primitives ───────── */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ padding: "0 20px" }}>
      <h2 style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: "var(--color-label-2)" }}>{title}</h2>
      {children}
    </section>
  );
}
function Card({ children, pad = 18 }: { children: ReactNode; pad?: number }) {
  return <div style={{ borderRadius: 20, padding: pad, background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)" }}>{children}</div>;
}
function KeyVal({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 14, padding: "11px 0", borderBottom: last ? "none" : "0.5px solid var(--color-hairline)" }}>
      <span style={{ fontSize: 15, color: "var(--color-label-2)", flexShrink: 0 }}>{k}</span>
      <span style={{ fontSize: 15, fontWeight: 600, color: "var(--color-label)", textAlign: "right" }}>{v}</span>
    </div>
  );
}

/* ───────── О книге (overview + источник + издание) ───────── */
function Overview({ book }: { book: BookData }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 30, padding: "24px 0 8px" }}>
      <Section title="О книге">
        <p style={{ margin: 0, fontSize: 17, lineHeight: 1.55, color: "var(--color-label)" }}>{book.description}</p>
        <p style={{ margin: "14px 0 0", fontSize: 16, lineHeight: 1.55, color: "var(--color-label-2)" }}>
          «Бхагавад-гита» — беседа Господа Кришны и Арджуны на поле битвы Курукшетра. В 700 стихах изложена наука о душе (атме), Сверхдуше и Верховной Личности Бога — о карме, гьяне и бхакти, пути любовного преданного служения.
        </p>
      </Section>

      <Section title="Факты">
        <Card>
          <KeyVal k="Глав" v="18" />
          <KeyVal k="Стихов" v="700" />
          <KeyVal k="Поведана" v="≈ 5 000 лет назад, Курукшетра" />
          <KeyVal k="Язык издания" v="Русский" last />
        </Card>
      </Section>

      <Section title="Источник">
        <Card>
          <KeyVal k="Поведана" v="Господом Кришной Арджуне" />
          <KeyVal k="Записана" v="Вьясадевой («Махабхарата»)" />
          <KeyVal k="Перевод и комментарии" v="Шрила Прабхупада" last />
        </Card>
        <p style={{ margin: "12px 4px 0", fontSize: 14, lineHeight: 1.5, color: "var(--color-label-2)" }}>
          «Бхагавад-гита» входит в «Бхишма-парву» «Махабхараты». Издание «как она есть» передаёт текст без отклонений от замысла Кришны — в линии ученической преемственности (парампары).
        </p>
      </Section>

      <Section title="Издание">
        <Card>
          <KeyVal k="Издатель" v="The Bhaktivedanta Book Trust" />
          <KeyVal k="Текущее издание" v="Русский" />
          <KeyVal k="Также на" v="English · Deutsch · Українська · …" last />
        </Card>
      </Section>
    </div>
  );
}

/* ───────── Автор (редакторский профиль, стиль iskcone.com) ───────── */
function AuthorEyebrow({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", color: "var(--color-label-2)", marginBottom: 10 }}>{children}</div>;
}
function Milestone({ year, text, last }: { year: string; text: string; last?: boolean }) {
  return (
    <li style={{ position: "relative", paddingLeft: 30, paddingBottom: last ? 0 : 20 }}>
      {!last && <span aria-hidden style={{ position: "absolute", left: 6, top: 14, bottom: 0, width: 1.5, background: "var(--color-hairline)" }} />}
      <span aria-hidden style={{ position: "absolute", left: 1.5, top: 4, width: 11, height: 11, borderRadius: "50%", background: "var(--color-brand-blue)", boxShadow: "0 0 0 3px var(--color-bg)" }} />
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.3px", color: "var(--color-brand-blue)", marginBottom: 3 }}>{year}</div>
      <div style={{ fontSize: 15, lineHeight: 1.5, color: "var(--color-label)" }}>{text}</div>
    </li>
  );
}
function Author() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32, padding: "26px 0 8px" }}>
      {/* hero band */}
      <header style={{ padding: "0 20px" }}>
        <div style={{ color: "var(--color-brand-blue)", opacity: .9, marginBottom: 16 }}>
          <LogoMark src="/iskcon-sign.svg" label="ИСККОН" height={34} />
        </div>
        <AuthorEyebrow>Автор перевода и комментариев</AuthorEyebrow>
        <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.14, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--color-label)" }}>
          А.&nbsp;Ч. Бхактиведанта<br />Свами Прабхупада
        </h1>
        <div style={{ marginTop: 8, fontSize: 14.5, lineHeight: 1.45, color: "var(--color-label-2)" }}>
          Его Божественная Милость · Ачарья-основатель Международного общества сознания Кришны (ИСККОН)
        </div>
        <div style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 999, background: "var(--color-glass-regular)", fontSize: 13, fontWeight: 600, color: "var(--color-label)" }}>
          1896&nbsp;—&nbsp;1977
        </div>
      </header>

      {/* accent deck */}
      <section style={{ padding: "0 20px" }}>
        <div style={{ paddingLeft: 16, borderLeft: "2.5px solid var(--color-brand-blue)" }}>
          <p style={{ margin: 0, fontSize: 20, lineHeight: 1.42, fontWeight: 500, letterSpacing: "-0.01em", color: "var(--color-label)" }}>
            В 69 лет он в одиночку привёз учение «Бхагавад-гиты» из Индии на Запад — и за одиннадцать лет перевёл и прокомментировал десятки томов ведических писаний, основав движение, охватившее весь мир.
          </p>
        </div>
      </section>

      {/* life path */}
      <Section title="Путь">
        <ol style={{ listStyle: "none", margin: 0, padding: "2px 4px 0" }}>
          <Milestone year="1896" text="Родился в Калькутте под именем Абхай Чаран Де, в день после Джанмаштами, в вайшнавской семье." />
          <Milestone year="1922" text="Встретил своего духовного учителя Шрилу Бхактисиддханту Сарасвати Тхакура, получив наказ нести сознание Кришны на английском языке." />
          <Milestone year="1965" text="В 69 лет на грузовом судне «Джаладута» (37 дней пути, два инфаркта) прибыл в Нью-Йорк — без средств и без единого знакомого." />
          <Milestone year="1966" text="Основал в Нью-Йорке Международное общество сознания Кришны (ИСККОН)." />
          <Milestone year="1972" text="Учредил издательство Bhaktivedanta Book Trust (BBT) — крупнейшего издателя ведической литературы в мире." />
          <Milestone year="1977" text="Ушёл из этого мира во Вриндаване в возрасте 81 года, оставив более сотни храмов и центров на всех континентах." last />
        </ol>
      </Section>

      {/* legacy facts */}
      <Section title="Наследие">
        <Card>
          <KeyVal k="Книг переведено" v="более 70 томов" />
          <KeyVal k="Языков перевода" v="76" />
          <KeyVal k="Храмов и центров" v="100+" />
          <KeyVal k="Кругосветных путешествий" v="14" last />
        </Card>
        <p style={{ margin: "14px 4px 0", fontSize: 14, lineHeight: 1.5, color: "var(--color-label-2)" }}>
          Его переводы — «Бхагавад-гита как она есть», многотомные «Шримад-Бхагаватам» и «Шри Чайтанья-чаритамрита» — ценятся учёными за точность, глубину и верность традиции и используются как учебные пособия в университетах.
        </p>
      </Section>
    </div>
  );
}

/* ───────── Содержание (iOS 26 inset list) ───────── */
interface ChapterRow { id: string; number: string; title_ru: string; title_en: string; source_url: string; verses: number; }

function ChapterRowItem({ ch, last, onOpenChapter }: { ch: ChapterRow; last: boolean; onOpenChapter: (ch: ChapterRow) => void }) {
  return (
    <li style={{ position: "relative" }}>
      <Pressable onClick={() => onOpenChapter(ch)} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 16px" }}>
        <span style={{ flexShrink: 0, display: "grid", placeItems: "center", height: 30, width: 30, borderRadius: 9, background: "var(--color-glass-regular)", fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--color-label)" }}>{ch.number}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 16, lineHeight: 1.3, fontWeight: 500, color: "var(--color-label)" }}>{ch.title_ru}</span>
          <span style={{ display: "block", marginTop: 1, fontSize: 13, color: "var(--color-label-3)" }}>{ch.verses} стихов</span>
        </span>
        <span style={{ color: "var(--color-label-3)" }}><ChevronIcon size={17} /></span>
      </Pressable>
      {!last && <span aria-hidden style={{ position: "absolute", left: 60, right: 0, bottom: 0, height: 0.5, background: "var(--color-hairline)" }} />}
    </li>
  );
}
function Contents({ chapters, onOpenChapter }: { chapters: ChapterRow[] | null; onOpenChapter: (ch: ChapterRow) => void }) {
  return (
    <div style={{ paddingTop: 22 }}>
      <Section title={chapters ? `${chapters.length} глав` : "Содержание"}>
        {!chapters && <div style={{ fontSize: 15, color: "var(--color-label-2)" }}>Загрузка оглавления…</div>}
        {chapters && (
          <ol style={{ margin: 0, padding: 0, listStyle: "none", borderRadius: 20, overflow: "hidden", background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)" }}>
            {chapters.map((c, i) => (
              <ChapterRowItem key={c.id} ch={c} last={i === chapters.length - 1} onOpenChapter={onOpenChapter} />
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}

/* ───────── helpers + verse model ───────── */
function verseLabel(ref: string): string {
  const tail = ref.split(".").pop() ?? "";
  return /[-–]/.test(tail) ? `Тексты ${tail.replace("-", "–")}` : `Текст ${tail}`;
}
interface ChapterVerse {
  ref: string; label: string;
  devanagari: string | null; translit: string | null;
  tokens: { term: string; gloss: string | null }[];
  translation: string | null; purport: string | null;
}

/* ───────── Глава — continuous reader ───────── */
function ChapterPage({ chapter, onOpenVerse, onBack }: { chapter: ChapterRow; onOpenVerse: (ref: string) => void; onBack: () => void }) {
  const [verses, setVerses] = useState<ChapterVerse[] | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let live = true;
    setVerses(null);
    fetch(api(`/books/bg/chapters/${chapter.number}/read`))
      .then((r) => r.json())
      .then((d) => { if (live) setVerses(d.verses ?? []); })
      .catch(() => { if (live) setVerses([]); });
    return () => { live = false; };
  }, [chapter.number]);

  const anyDemo = !!verses && verses.some((v) => !v.translation && DEMO_VERSES[v.ref]?.translation);

  return (
    <div style={{ position: "fixed", top: 0, bottom: 0, left: 0, right: 0, margin: "0 auto", width: "100%", maxWidth: 480, zIndex: 70, display: "flex", flexDirection: "column", background: "var(--color-bg)" }}>
      <header className="glass-nav glass-nav-edge" style={{ flexShrink: 0, height: 56, display: "flex", alignItems: "center", gap: 4, padding: "0 6px", zIndex: 2 }}>
        <CircleBtn ariaLabel="Назад" onClick={onBack}><BackIcon size={22} /></CircleBtn>
        <div style={{ flex: 1, minWidth: 0, textAlign: "center", opacity: collapsed ? 1 : 0, transform: collapsed ? "none" : "translateY(3px)", transition: "opacity .2s, transform .2s" }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--color-label)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", padding: "0 4px" }}>{chapter.title_ru}</div>
          <div style={{ fontSize: 11, color: "var(--color-label-2)" }}>Глава {chapter.number}</div>
        </div>
        <span style={{ width: 40, flexShrink: 0 }} />
      </header>

      <div onScroll={(e) => setCollapsed((e.target as HTMLDivElement).scrollTop > 52)}
        style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 22px calc(40px + env(safe-area-inset-bottom))" }}>
          <div style={{ textAlign: "center", marginBottom: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: "var(--color-brand-blue)", marginBottom: 10 }}>Глава {chapter.number}</div>
            <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.1, fontWeight: 800, letterSpacing: "-0.025em", color: "var(--color-label)" }}>{chapter.title_ru}</h1>
            <div style={{ marginTop: 10, fontSize: 13.5, color: "var(--color-label-2)" }}>{verses?.length ?? chapter.verses} стихов</div>
          </div>
          <Ornament />

          {!verses && <div style={{ textAlign: "center", color: "var(--color-label-2)", padding: "40px 0", fontSize: 15 }}>Загрузка главы…</div>}
          {verses && verses.length === 0 && <div style={{ textAlign: "center", color: "var(--color-label-2)", padding: "40px 0", fontSize: 15 }}>В этой главе пока нет стихов.</div>}

          {verses && verses.length > 0 && (
            <ol style={{ margin: 0, padding: 0, listStyle: "none", borderRadius: 20, overflow: "hidden", background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)" }}>
              {verses.map((v, i) => {
                const tr = v.translation || DEMO_VERSES[v.ref]?.translation || null;
                const isDemo = !v.translation && !!DEMO_VERSES[v.ref]?.translation;
                return (
                  <li key={v.ref} style={{ position: "relative" }}>
                    <Pressable onClick={() => onOpenVerse(v.ref)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "15px 16px" }}>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 12, fontWeight: 700, letterSpacing: "0.3px", color: "var(--color-brand-blue)", marginBottom: 4 }}>{v.label}{isDemo && <DemoBadge />}</span>
                        <span style={{ display: "block", fontSize: 16, lineHeight: 1.5, color: tr ? "var(--color-label)" : "var(--color-label-2)", fontStyle: tr ? "normal" : "italic" }}>
                          {tr ?? "перевод готовится"}
                        </span>
                      </span>
                      <span style={{ color: "var(--color-label-3)", alignSelf: "center" }}><ChevronIcon size={17} /></span>
                    </Pressable>
                    {i < verses.length - 1 && <span aria-hidden style={{ position: "absolute", left: 16, right: 0, bottom: 0, height: 0.5, background: "var(--color-hairline)" }} />}
                  </li>
                );
              })}
            </ol>
          )}

          {anyDemo && (
            <p style={{ marginTop: 18, fontSize: 12, lineHeight: 1.5, color: "var(--color-label-2)" }}>
              Перевод, помеченный «демо», — демонстрационный текст прототипа; он будет заменён лицензированным текстом издания. Откройте стих, чтобы увидеть санскрит, транслитерацию, пословный перевод и комментарий.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────── verse layers ───────── */
type LayerKey = "deva" | "translit" | "ww" | "commentary";
function LayerRow({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", padding: "11px 4px", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-text)", fontSize: 16, color: "var(--color-label)", WebkitTapHighlightColor: "transparent" }}>
      <span>{label}</span>
      <span aria-hidden style={{ position: "relative", width: 42, height: 26, borderRadius: 999, background: on ? "var(--color-brand-blue)" : "var(--color-glass-regular)", transition: "background .2s", flexShrink: 0 }}>
        <span style={{ position: "absolute", top: 3, left: on ? 19 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.3)" }} />
      </span>
    </button>
  );
}
function LayerLabel({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 12px", fontSize: 11, fontWeight: 700, letterSpacing: "1.6px", textTransform: "uppercase", color: "var(--color-label-2)" }}><span style={{ width: 18, height: 1.5, background: "var(--color-brand-blue)", opacity: .6, borderRadius: 999 }} />{children}</div>;
}
function DemoBadge() {
  return <span style={{ marginLeft: 8, padding: "1px 7px", borderRadius: 999, background: "var(--color-glass-regular)", color: "var(--color-label-2)", fontSize: 9.5, fontWeight: 700, letterSpacing: ".5px", verticalAlign: "middle" }}>демо</span>;
}

interface VerseToken { term: string; gloss: string | null; }
interface VerseDetail {
  ref: string; label: string; uvaca: string | null;
  devanagari: string | null; translit: string | null;
  tokens: VerseToken[]; translation: string | null; purport: string | null;
  source_url: string | null; prev: string | null; next: string | null;
}

function SpineBtn({ dir, disabled, onClick, children }: { dir: "prev" | "next"; disabled: boolean; onClick: () => void; children: ReactNode }) {
  const [pressed, setPressed] = useState(false);
  const off = () => setPressed(false);
  return (
    <button disabled={disabled} onClick={onClick}
      onPointerDown={() => setPressed(true)} onPointerUp={off} onPointerLeave={off} onPointerCancel={off}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 38, padding: dir === "prev" ? "0 16px 0 12px" : "0 12px 0 16px", borderRadius: 999, border: "none", cursor: disabled ? "default" : "pointer", background: disabled ? "transparent" : (pressed ? "var(--color-glass-thick)" : "var(--color-glass-regular)"), color: disabled ? "var(--color-label-3)" : "var(--color-label)", opacity: disabled ? .45 : 1, fontSize: 14.5, fontWeight: 600, fontFamily: "var(--font-text)", transition: "background .12s", WebkitTapHighlightColor: "transparent" }}>
      {children}
    </button>
  );
}

function VerseReader({ refStr, onNavigate, onClose }: { refStr: string; onNavigate: (ref: string) => void; onClose: () => void }) {
  const [data, setData] = useState<VerseDetail | null>(null);
  const [error, setError] = useState(false);
  const [panel, setPanel] = useState(false);
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({ deva: true, translit: true, ww: true, commentary: true });
  const toggle = (k: LayerKey) => setLayers((s) => ({ ...s, [k]: !s[k] }));

  useEffect(() => {
    let live = true;
    setData(null); setError(false);
    fetch(api(`/books/bg/verses/${encodeURIComponent(refStr)}`))
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((d) => { if (live) setData(d as VerseDetail); })
      .catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, [refStr]);

  const demo = DEMO_VERSES[data?.ref ?? refStr];
  const chapterNo = (data?.ref ?? refStr).replace(/^[^\d]*/, "").split(".")[0];
  const evDeva = data?.devanagari || demo?.devanagari || null;
  const evTranslit = data?.translit || demo?.translit || null;
  const evTokens = (data?.tokens && data.tokens.length ? data.tokens : demo?.tokens) ?? [];
  const evTranslation = data?.translation || demo?.translation || null;
  const evPurport = data?.purport || demo?.purport || null;
  const translationIsDemo = !data?.translation && !!demo?.translation;
  const purportIsDemo = !data?.purport && !!demo?.purport;

  const hasDeva = !!evDeva && layers.deva;
  const hasTranslit = !!evTranslit && layers.translit;
  const hasWW = !!evTokens.length && layers.ww;
  const hasCommentary = !!evPurport && layers.commentary;

  return (
    <div style={{ position: "fixed", top: 0, bottom: 0, left: 0, right: 0, margin: "0 auto", width: "100%", maxWidth: 480, zIndex: 80, display: "flex", flexDirection: "column", background: "var(--color-bg)" }}>
      {/* glass header */}
      <header className="glass-nav glass-nav-edge" style={{ flexShrink: 0, height: 54, display: "flex", alignItems: "center", gap: 4, padding: "0 6px", zIndex: 3 }}>
        <CircleBtn ariaLabel="Закрыть" onClick={onClose}><BackIcon size={22} /></CircleBtn>
        <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--color-label)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{data?.label ?? refStr}</div>
          <div style={{ fontSize: 11, color: "var(--color-label-2)" }}>{chapterNo ? `Глава ${chapterNo} · ` : ""}Бхагавад-гита</div>
        </div>
        <CircleBtn ariaLabel="Слои" onClick={() => setPanel((v) => !v)} active={panel}><SlidersIcon size={22} /></CircleBtn>
      </header>

      {/* layers sheet */}
      {panel && (
        <div style={{ flexShrink: 0, position: "relative", zIndex: 2, margin: "10px 14px 4px", padding: "6px 16px 12px", borderRadius: 18, background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)", boxShadow: "var(--shadow-card)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.6px", textTransform: "uppercase", color: "var(--color-label-2)", padding: "8px 4px 2px" }}>Слои стиха</div>
          <LayerRow label="Деванагари" on={layers.deva} onToggle={() => toggle("deva")} />
          <LayerRow label="Транслитерация" on={layers.translit} onToggle={() => toggle("translit")} />
          <LayerRow label="Пословный перевод" on={layers.ww} onToggle={() => toggle("ww")} />
          <div style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", padding: "11px 4px", fontSize: 16, color: "var(--color-label-2)" }}><span>Перевод</span><span style={{ fontSize: 12, color: "var(--color-label-3)" }}>всегда</span></div>
          <LayerRow label="Комментарий" on={layers.commentary} onToggle={() => toggle("commentary")} />
        </div>
      )}

      {/* scroll body */}
      <div style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "26px 22px 40px" }}>
          {!data && !error && <div style={{ textAlign: "center", color: "var(--color-label-2)", padding: "40px 0", fontSize: 15 }}>Загрузка стиха…</div>}
          {error && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <p style={{ fontSize: 15, color: "var(--color-label-2)" }}>Не удалось загрузить стих.</p>
              <button onClick={onClose} style={{ marginTop: 8, height: 40, padding: "0 18px", borderRadius: 12, border: "none", background: "var(--color-glass-regular)", color: "var(--color-label)", cursor: "pointer", fontSize: 15 }}>К содержанию</button>
            </div>
          )}
          {data && (
            <>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
                <span style={{ padding: "5px 14px", borderRadius: 999, background: "var(--color-glass-regular)", fontSize: 12.5, fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: "var(--color-brand-blue)" }}>{data.label}</span>
              </div>

              {hasDeva && (
                <div style={{ fontFamily: "var(--font-deva, 'Noto Serif Devanagari', var(--font-text))", fontSize: 25, lineHeight: 1.95, textAlign: "center", color: "var(--color-label)", whiteSpace: "pre-line", marginBottom: hasTranslit ? 16 : 24 }}>{evDeva}</div>
              )}
              {hasTranslit && (
                <div style={{ fontStyle: "italic", fontSize: 18, lineHeight: 1.85, textAlign: "center", color: "var(--color-label-2)", whiteSpace: "pre-line", marginBottom: 16 }}>{evTranslit}</div>
              )}
              {(hasDeva || hasTranslit) && <Ornament />}

              {hasWW && (
                <section style={{ marginBottom: 30 }}>
                  <LayerLabel>Пословный перевод</LayerLabel>
                  <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.95, color: "var(--color-label-2)" }}>
                    {evTokens.map((t, i) => (
                      <span key={i}>
                        <span style={{ fontStyle: "italic", color: "var(--color-label)" }}>{t.term}</span>
                        {t.gloss ? ` — ${t.gloss}` : ""}{i < evTokens.length - 1 ? "; " : "."}
                      </span>
                    ))}
                  </p>
                </section>
              )}

              <section style={{ marginBottom: hasCommentary ? 30 : 8 }}>
                <LayerLabel>Перевод{translationIsDemo && <DemoBadge />}</LayerLabel>
                {evTranslation ? (
                  <div style={{ borderRadius: 18, padding: "20px 22px", background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)", borderLeft: "2.5px solid var(--color-brand-blue)" }}>
                    <p style={{ margin: 0, fontSize: 20, lineHeight: 1.5, fontWeight: 500, letterSpacing: "-0.01em", color: "var(--color-label)" }}>{evTranslation}</p>
                  </div>
                ) : (
                  <div style={{ borderRadius: 18, padding: "20px", background: "var(--color-bg-2)", border: "0.5px dashed var(--color-hairline)", textAlign: "center" }}>
                    <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: "var(--color-label-2)" }}>Перевод этого стиха готовится.</p>
                  </div>
                )}
              </section>

              {hasCommentary && (
                <section style={{ marginBottom: 8 }}>
                  <LayerLabel>Комментарий{purportIsDemo && <DemoBadge />}</LayerLabel>
                  <div style={{ fontSize: 17, lineHeight: 1.78, color: "var(--color-label)" }}>
                    {evPurport!.split(/\n\n+/).map((para, i) => (
                      <p key={i} style={{ margin: i === 0 ? 0 : "14px 0 0" }}>{para}</p>
                    ))}
                  </div>
                </section>
              )}

              {(translationIsDemo || purportIsDemo) && (
                <div style={{ marginTop: 24, paddingTop: 16, borderTop: "0.5px solid var(--color-hairline)", fontSize: 12, lineHeight: 1.5, color: "var(--color-label-2)" }}>
                  Санскрит и транслитерация — общественное достояние. Перевод и комментарий помечены «демо»: это демонстрационный текст прототипа; он будет заменён лицензированным текстом издания.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* floating glass spine nav */}
      <nav className="glass-nav glass-nav-edge" style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px calc(10px + env(safe-area-inset-bottom))", borderTop: "0.5px solid var(--color-hairline)", borderBottom: "none" }}>
        <SpineBtn dir="prev" disabled={!data?.prev} onClick={() => data?.prev && onNavigate(data.prev)}>
          <BackIcon size={18} />Назад
        </SpineBtn>
        <button onClick={onClose} style={{ height: 38, padding: "0 14px", background: "none", border: "none", cursor: "pointer", color: "var(--color-label-2)", fontSize: 14.5, fontWeight: 600, fontFamily: "var(--font-text)", WebkitTapHighlightColor: "transparent" }}>К главе</button>
        <SpineBtn dir="next" disabled={!data?.next} onClick={() => data?.next && onNavigate(data.next)}>
          Вперёд<span style={{ transform: "scaleX(-1)", display: "inline-flex" }}><BackIcon size={18} /></span>
        </SpineBtn>
      </nav>
    </div>
  );
}

/* ───────── round glass action (over hero) ───────── */
function GlassBtn({ active, activeColor, ariaLabel, onClick, children }: { active?: boolean; activeColor?: string; ariaLabel: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={ariaLabel} aria-pressed={active} onClick={onClick}
      style={{ display: "grid", height: 36, width: 36, placeItems: "center", borderRadius: "50%", border: "none", cursor: "pointer", background: "rgba(0,0,0,.45)", color: active && activeColor ? activeColor : "#fff", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", WebkitTapHighlightColor: "transparent" }}>
      {children}
    </button>
  );
}

/* ═════════ MAIN ═════════ */
export function BookDetailPage({ book, onBack }: { book: BookData; onBack: () => void }) {
  const [idx, setIdx] = useState(0);
  const [favorited, setFavorited] = useState(false);
  const [inCart, setInCart] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [tab, setTab] = useState<BookTabId>("contents");
  const [chapters, setChapters] = useState<ChapterRow[] | null>(null);
  const [openChapter, setOpenChapter] = useState<ChapterRow | null>(null);
  const [readerRef, setReaderRef] = useState<string | null>(null);

  useEffect(() => {
    fetch(api("/books/bg/chapters")).then((r) => r.json()).then((d) => setChapters(d.chapters ?? [])).catch(() => {});
  }, []);
  const openChapterByNumber = (num: string) => {
    const c = chapters?.find((x) => x.number === num);
    if (c) setOpenChapter(c);
  };
  const n = book.covers.length;

  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    const onScroll = () => setScrolled(main.scrollTop > 60);
    main.addEventListener("scroll", onScroll, { passive: true });
    return () => main.removeEventListener("scroll", onScroll);
  }, []);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  const shareBook = async () => {
    const url = "https://gaurangers.com/book/bg";
    const payload = { title: "Бхагавад-гита как она есть", text: "Бхагавад-гита как она есть — читать онлайн", url };
    try {
      if (typeof navigator !== "undefined" && (navigator as Navigator).share) {
        await (navigator as Navigator).share(payload);
        return;
      }
    } catch { /* user cancelled — fall through */ }
    try {
      await navigator.clipboard.writeText(url);
      flash("Ссылка скопирована");
    } catch {
      flash(url);
    }
  };

  const verseOfDay = () => {
    const now = new Date();
    const day = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
    return DEMO_REFS[day % DEMO_REFS.length] ?? "БГ 1.1";
  };

  const menuAction = (label: string) => {
    setMoreOpen(false);
    if (label.startsWith("Читать")) { openChapterByNumber("1"); return; }
    if (label.startsWith("Слушать")) { flash("Аудиокнига — скоро"); return; }
    if (label.startsWith("О книге")) { setTab("overview"); return; }
    if (label.startsWith("Стих дня")) { setReaderRef(verseOfDay()); return; }
    if (label.startsWith("Поделиться")) { void shareBook(); return; }
    if (label.startsWith("Добавить")) { flash("Добавлено в план чтения"); return; }
    if (label.startsWith("Язык")) { flash("Издание: русский. Другие языки — скоро"); return; }
    if (label.startsWith("Скачать")) { flash("PDF / EPUB — скоро"); return; }
    if (label.startsWith("Заказать")) { flash("Печатное издание — скоро"); return; }
    if (label.startsWith("Поддержать")) { flash("Поддержка печати — скоро"); return; }
    flash("Скоро");
  };

  return (
    <div style={{ position: "relative", minHeight: "100%", background: "var(--color-bg)", paddingBottom: "calc(env(safe-area-inset-bottom,0px) + 32px)" }}>
      {/* scroll-aware top bar over hero */}
      <header style={{ position: "sticky", top: 0, zIndex: 30, height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", transition: "background .2s", background: scrolled ? "var(--color-header-blur, var(--color-bg))" : "transparent", backdropFilter: scrolled ? "blur(40px) saturate(180%)" : "none", WebkitBackdropFilter: scrolled ? "blur(40px) saturate(180%)" : "none", borderBottom: scrolled ? "0.5px solid var(--color-hairline)" : "0.5px solid transparent" }}>
        <button aria-label="Назад" onClick={onBack} style={{ display: "grid", height: 36, width: 36, placeItems: "center", borderRadius: "50%", border: "none", cursor: "pointer", background: scrolled ? "transparent" : "rgba(0,0,0,.45)", color: scrolled ? "var(--color-label)" : "#fff", backdropFilter: scrolled ? "none" : "blur(12px)" }}><BackIcon size={22} /></button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <GlassBtn active={favorited} activeColor="#FF453A" ariaLabel="В избранное" onClick={() => { const nv = !favorited; setFavorited(nv); flash(nv ? "Добавлено в избранное" : "Убрано из избранного"); }}><HeartIcon size={18} filled={favorited} /></GlassBtn>
          <GlassBtn ariaLabel="Слушать" onClick={() => flash("Аудиокнига — скоро")}><HeadphonesIcon size={19} /></GlassBtn>
          <GlassBtn active={inCart} activeColor="var(--color-brand-blue)" ariaLabel={inCart ? "Убрать из корзины" : "В корзину"} onClick={() => { const nv = !inCart; setInCart(nv); flash(nv ? "Добавлено в корзину" : "Убрано из корзины"); }}><BagIcon size={18} cornerGlyph={inCart ? "minus" : "plus"} /></GlassBtn>
          <GlassBtn ariaLabel="Меню" onClick={() => setMoreOpen(true)}><MoreIcon size={16} /></GlassBtn>
        </div>
      </header>

      {/* HERO carousel */}
      <article style={{ position: "relative", marginTop: -56, aspectRatio: "4 / 5", overflow: "hidden", background: "var(--color-bg-3)" }}>
        {book.covers.map((src, i) => (
          <img key={src} src={src} alt={book.titleLine1} loading={i === 0 ? "eager" : "lazy"} decoding="async" draggable={false}
            style={{ position: "absolute", inset: 0, height: "100%", width: "100%", objectFit: "cover", opacity: i === idx ? 1 : 0, transition: "opacity .35s ease" }} />
        ))}
        <div aria-hidden style={{ position: "absolute", insetInline: 0, top: 0, height: 120, pointerEvents: "none", background: "linear-gradient(to bottom, rgba(0,0,0,.5) 0%, rgba(0,0,0,0) 100%)" }} />
        <div aria-hidden style={{ position: "absolute", insetInline: 0, bottom: 0, height: "70%", pointerEvents: "none", background: "linear-gradient(to top, rgba(0,0,0,.92) 0%, rgba(0,0,0,.55) 45%, rgba(0,0,0,0) 100%)" }} />
        {n > 1 && (<>
          <button aria-label="Предыдущее" onClick={() => setIdx(i => (i - 1 + n) % n)} style={{ position: "absolute", top: 56, bottom: "40%", left: 0, width: "24%", zIndex: 10, background: "none", border: "none", cursor: "pointer" }} />
          <button aria-label="Следующее" onClick={() => setIdx(i => (i + 1) % n)} style={{ position: "absolute", top: 56, bottom: "40%", right: 0, width: "24%", zIndex: 10, background: "none", border: "none", cursor: "pointer" }} />
          <span style={{ position: "absolute", right: 16, top: 64, zIndex: 12, borderRadius: 999, background: "rgba(0,0,0,.55)", padding: "2px 8px", fontSize: 11, fontWeight: 600, color: "#fff", backdropFilter: "blur(12px)" }}>{idx + 1} / {n}</span>
        </>)}
        <div style={{ position: "absolute", left: 20, bottom: 20, right: 20, zIndex: 12, color: "#fff" }}>
          <div style={{ color: "#fff", marginBottom: 14 }}><LogoMark src="/bbt.svg" label="The Bhaktivedanta Book Trust" height={24} /></div>
          <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.04, fontWeight: 800, letterSpacing: "-0.03em", whiteSpace: "nowrap" }}>{book.titleLine1}</h1>
          {book.titleLine2 && <div style={{ marginTop: 2, fontSize: 23, lineHeight: 1.1, fontWeight: 600, letterSpacing: "-0.02em" }}>{book.titleLine2}</div>}
          <div style={{ marginTop: 6, fontSize: 15, color: "rgba(255,255,255,.72)" }}>{book.iast}<span style={{ margin: "0 6px", color: "rgba(255,255,255,.4)" }}>·</span>{book.tagline}</div>
        </div>
      </article>

      <BookTabs active={tab} onChange={setTab} />

      <div>
        {tab === "contents" && <Contents chapters={chapters} onOpenChapter={setOpenChapter} />}
        {tab === "overview" && <Overview book={book} />}
        {tab === "author" && <Author />}
      </div>

      <ActionsSheet open={moreOpen} onClose={() => setMoreOpen(false)} onSelect={menuAction} />
      <Toast msg={toast} />
      {openChapter && <ChapterPage chapter={openChapter} onOpenVerse={(ref) => setReaderRef(ref)} onBack={() => setOpenChapter(null)} />}
      {readerRef && <VerseReader key={readerRef} refStr={readerRef} onNavigate={setReaderRef} onClose={() => setReaderRef(null)} />}
    </div>
  );
}
