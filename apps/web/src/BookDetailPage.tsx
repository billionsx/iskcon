/**
 * BookDetailPage (ПКП) — единая дизайн-система книги.
 * Язык: один белый холст (без grouped-карточек и серого фона), графитовый
 * текст, структура держится на хейрлайнах и воздухе; золото #D2AA1B —
 * только тонкие вставки (подчёркивание активной вкладки, орнамент, метки
 * «Текст N»/«Глава N», 2px-линейка у перевода и цитаты, таймлайн автора).
 * Палитра фиксированная (white/graphite/gold), не зависит от темы ОС.
 * Данные книги — books.ts; стихи — API (/chapters/:n/read, /verses/:ref).
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SVGProps, ReactNode, CSSProperties } from "react";
import type { BookData } from "./books";
import { BOOK_MENU_ITEMS, BOOK_ABOUT, bookShareTitle, bookFullTitle, AUDIO_WORKS } from "./books";
import { PDF_CACHE_REV } from "./pdfRev";
import { api } from "./api";
import { DEMO_VERSES, DEMO_REFS } from "./demo";
import { BackIcon, HeartIcon, MoreIcon, ShareIcon, HeadphonesIcon } from "./ui/icons";
import { BookHeroCard } from "./BookHeroCard";
import { useFavorite } from "./cardActions";
import { recordRead } from "./account/track";
import { noteRead } from "./reading";
import { pushUrl, replaceUrl, canGoBack } from "./nav";
import { usePlayer } from "./player/store";
import { BookMenuSheet } from "./BookMenuSheet";
import { requestNote } from "./notes";
import { addToCart } from "./shop/cart";
import { bookProduct } from "./shop/catalog";
import { exportToPdf, downloadServerPdf } from "./pdf";
import { Skt, renderTerms, renderTitle } from "./ui/Skt";
import { downloadCcBookPdf, downloadBookPdf } from "./bookPdf";
import { QrSheet, type QrData } from "./QrSheet";
import { ReportSheet } from "./ReportSheet";
import { SectionSubTabs } from "./SectionSubTabs";

/* ───────── palette (fixed: white · graphite · gold) ───────── */
const PAPER = "#ffffff";
const INK = "#1f2024";   // графит — заголовки / основной текст
const INK2 = "#70727b";  // вторичный
const INK3 = "#a7a8b0";  // метаданные / шевроны
const LINE = "rgba(0,0,0,0.08)";       // хейрлайн
const FILL = "rgba(0,0,0,0.045)";      // лёгкая заливка (нажатие/чипы)
const GOLD = "#D2AA1B";  // тонкие линии / заливки / точки
const GOLDT = "#9c7c15"; // золото для мелкого текста (контраст на белом)
const GOLD_SOFT = "rgba(210,170,27,0.10)";

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
function ChevronIcon({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden style={{ flexShrink: 0 }}><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function SlidersIcon(p: IconProps) {
  return <svg {...sp(p)}><path {...STROKE} d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" {...STROKE} /><circle cx="8" cy="12" r="2" {...STROKE} /><circle cx="18" cy="18" r="2" {...STROKE} /></svg>;
}

function LogoMark({ src, label, height, color }: { src: string; label: string; height: number; color: string }) {
  return <span role="img" aria-label={label} style={{ display: "block", height, width: height, backgroundColor: color, WebkitMaskImage: `url(${src})`, maskImage: `url(${src})`, WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskPosition: "center", maskPosition: "center" }} />;
}

/* Тонкий золотой разделитель блока стиха. */
function Ornament() {
  return (
    <div aria-hidden style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, margin: "10px 0 30px" }}>
      <span style={{ width: 40, height: 1, background: `linear-gradient(to right, transparent, ${GOLD})`, opacity: .5 }} />
      <span style={{ color: GOLD, fontSize: 8 }}>◆</span>
      <span style={{ width: 40, height: 1, background: `linear-gradient(to left, transparent, ${GOLD})`, opacity: .5 }} />
    </div>
  );
}

/* ───────── pressable row ───────── */
function Pressable({ onClick, children, style, ariaLabel }: { onClick?: () => void; children: ReactNode; style?: CSSProperties; ariaLabel?: string }) {
  const [pressed, setPressed] = useState(false);
  const off = () => setPressed(false);
  return (
    <button type="button" aria-label={ariaLabel} onClick={onClick}
      onPointerDown={() => setPressed(true)} onPointerUp={off} onPointerLeave={off} onPointerCancel={off}
      style={{ display: "block", width: "100%", textAlign: "left", appearance: "none", WebkitTapHighlightColor: "transparent", border: "none", cursor: "pointer", color: INK, fontFamily: "var(--font-text)", transition: "background .12s ease", background: pressed ? FILL : "transparent", ...style }}>
      {children}
    </button>
  );
}

/* ───────── nav circular control (graphite on white) ───────── */
function NavBtn({ ariaLabel, onClick, active, children, size = 40 }: { ariaLabel: string; onClick: () => void; active?: boolean; children: ReactNode; size?: number }) {
  const [pressed, setPressed] = useState(false);
  const off = () => setPressed(false);
  return (
    <button type="button" aria-label={ariaLabel} onClick={onClick}
      onPointerDown={() => setPressed(true)} onPointerUp={off} onPointerLeave={off} onPointerCancel={off}
      style={{ display: "grid", height: size, width: size, placeItems: "center", borderRadius: "50%", border: "none", cursor: "pointer", color: INK, background: pressed || active ? FILL : "transparent", transition: "background .12s ease", WebkitTapHighlightColor: "transparent" }}>
      {children}
    </button>
  );
}

/* ───────── section header (muted caps) ───────── */
function SectionTitle({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.7px", textTransform: "uppercase", color: INK2, margin: "0 0 14px" }}>{children}</div>;
}

/* ───────── key/value row (hairline, no box) ───────── */
function KeyVal({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 14, padding: "12px 0", borderBottom: last ? "none" : `0.5px solid ${LINE}` }}>
      <span style={{ fontSize: 15, color: INK2, flexShrink: 0 }}>{k}</span>
      <span style={{ fontSize: 15, fontWeight: 600, color: INK, textAlign: "right" }}>{v}</span>
    </div>
  );
}

/* ───────── tabs (white, gold underline) ───────── */
type BookTabId = "contents" | "overview" | "author" | "reviews";
/** Книги с собственными курируемыми рецензиями. У прочих вкладка «Рецензии» скрыта
 * (не показываем чужие отзывы; добавится, когда появятся свои). */
const REVIEWED_WORKS = new Set(["bg", "cc", "sb", "brs"]);
const BOOK_TABS: { id: BookTabId; label: string }[] = [
  { id: "contents", label: "Содержание" },
  { id: "overview", label: "О книге" },
  { id: "author", label: "Автор" },
  { id: "reviews", label: "Рецензии" },
];
function BookTabs({ active, onChange, tabs }: { active: BookTabId; onChange: (id: BookTabId) => void; tabs: { id: BookTabId; label: string }[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  useEffect(() => {
    const el = tabRefs.current[active]; const c = containerRef.current;
    if (!el || !c) return;
    const target = el.offsetLeft - (c.clientWidth - el.clientWidth) / 2;
    c.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [active]);
  return (
    <nav data-pdf-no-print aria-label="Разделы книги" style={{ position: "sticky", top: 52, zIndex: 20, background: "rgba(255,255,255,0.82)", backdropFilter: "blur(40px) saturate(180%)", WebkitBackdropFilter: "blur(40px) saturate(180%)", borderBottom: `0.5px solid ${LINE}` }}>
      <div ref={containerRef} style={{ display: "flex", alignItems: "center", overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
        {tabs.map((t) => {
          const on = t.id === active;
          return (
            <button key={t.id} ref={(el) => { tabRefs.current[t.id] = el; }} type="button" onClick={() => onChange(t.id)}
              style={{ position: "relative", flexShrink: 0, padding: "13px 18px", fontSize: 15, background: "none", border: "none", cursor: "pointer", color: on ? INK : INK2, fontWeight: on ? 700 : 500, letterSpacing: on ? "-0.01em" : 0, transition: "color .15s", WebkitTapHighlightColor: "transparent" }}>
              {t.label}
              {on && <span aria-hidden style={{ position: "absolute", insetInline: 14, bottom: 0, height: 2, borderRadius: 999, background: GOLD }} />}
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
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,.32)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: PAPER, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: "8px 0 max(8px, env(safe-area-inset-bottom))", boxShadow: "0 -1px 0 rgba(0,0,0,.04), 0 -20px 50px rgba(0,0,0,.14)" }}>
        <div style={{ height: 5, width: 36, borderRadius: 999, background: LINE, margin: "8px auto 12px" }} />
        {BOOK_MENU_ITEMS.map((label, i) => (
          <div key={label} style={{ position: "relative" }}>
            <Pressable onClick={() => onSelect(label)} style={{ padding: "15px 22px", fontSize: 17, color: INK }}>{label}</Pressable>
            {i < BOOK_MENU_ITEMS.length - 1 && <span aria-hidden style={{ position: "absolute", left: 22, right: 0, bottom: 0, height: 0.5, background: LINE }} />}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────── transient toast ───────── */
function Toast({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div style={{ position: "fixed", left: "50%", bottom: "calc(40px + env(safe-area-inset-bottom,0px))", transform: "translateX(-50%)", zIndex: 90, maxWidth: 360, padding: "11px 18px", borderRadius: 999, background: INK, color: "#fff", fontFamily: "var(--font-text)", fontSize: 14, fontWeight: 500, boxShadow: "0 8px 24px rgba(0,0,0,.22)", textAlign: "center" }}>{msg}</div>
  );
}

/* ───────── О книге (overview + источник + издание) ───────── */
/* строка-определение: золотая метка + описание (структура, анатомия стиха) */
function DefRow({ term, desc, last }: { term: string; desc: string; last?: boolean }) {
  return (
    <div style={{ padding: "13px 0", borderBottom: last ? "none" : `0.5px solid ${LINE}` }}>
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.2px", color: GOLDT, marginBottom: 4 }}>{term}</div>
      <div style={{ fontSize: 15, lineHeight: 1.5, color: INK }}>{desc}</div>
    </div>
  );
}

/* ───────── О книге · универсальная (data-driven из BOOK_ABOUT) ───────── */
function GenericOverview({ book }: { book: BookData }) {
  const paras = BOOK_ABOUT[book.work] ?? [book.description];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 36, padding: "26px 20px 12px" }}>
      <section>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", color: GOLDT, marginBottom: 12 }}>{book.prose ? "Книга Шрилы Прабхупады" : "Ведическое писание"}</div>
        {paras.map((t, i) => (
          <p key={i} style={{ margin: i === 0 ? 0 : "14px 0 0", fontSize: i === 0 ? 17.5 : 16, lineHeight: 1.58, color: i === 0 ? INK : INK2 }}>{renderTerms(t)}</p>
        ))}
      </section>
      <section>
        <SectionTitle>Кратко</SectionTitle>
        <div>
          {book.chips.map((c, i) => (
            <KeyVal key={i} k={["Объём", "Источник", "Эпоха"][i] ?? "—"} v={c} last={i === book.chips.length - 1 && false} />
          ))}
          <KeyVal k="Издатель" v="Bhaktivedanta Book Trust" last />
        </div>
      </section>
      <section>
        <SectionTitle>Автор</SectionTitle>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: INK2 }}>{book.author}</p>
      </section>
    </div>
  );
}

function Overview({ book }: { book: BookData }) {
  void book;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 36, padding: "26px 20px 12px" }}>
      <section>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", color: GOLDT, marginBottom: 12 }}>Ведическое писание</div>
        <p style={{ margin: 0, fontSize: 17.5, lineHeight: 1.55, color: INK }}>
          «Бхагавад-гита» («Песнь Бога») — вершина ведической мысли и одно из самых читаемых священных писаний мира. Это беседа Верховной Личности Бога, Шри Кришны, и воина Арджуны на поле Курукшетра, перед началом великой битвы.
        </p>
        <p style={{ margin: "14px 0 0", fontSize: 16, lineHeight: 1.58, color: INK2 }}>
          В 700 стихах «Гита» излагает науку о вечной душе (атме), Сверхдуше (Параматме) и Верховной Личности Бога (Бхагаване), сводя воедино три пути совершенствования — карму, гьяну и бхакти — и приводя к их вершине: любовному преданному служению Богу.
        </p>
      </section>

      <section>
        <SectionTitle>Кратко</SectionTitle>
        <div>
          <KeyVal k="Жанр" v="Священное писание" />
          <KeyVal k="Язык оригинала" v="Санскрит" />
          <KeyVal k="Объём" v="18 глав · 700 стихов" />
          <KeyVal k="Место в эпосе" v="«Махабхарата», гл. 23-40" />
          <KeyVal k="Форма" v="Беседа Кришны и Арджуны" />
          <KeyVal k="Место действия" v="Поле Курукшетра" />
          <KeyVal k="Время (традиция)" v="≈ 5 000 лет назад" last />
        </div>
      </section>

      <section>
        <SectionTitle>О чём книга</SectionTitle>
        <p style={{ margin: 0, fontSize: 16.5, lineHeight: 1.6, color: INK }}>
          Накануне братоубийственной войны Арджуна, видя перед собой родных и наставников, теряет волю сражаться и обращается к Кришне как к духовному учителю. Ответ Кришны и составляет «Гиту».
        </p>
        <p style={{ margin: "12px 0 0", fontSize: 16, lineHeight: 1.6, color: INK2 }}>
          Господь объясняет: душа вечна и неуничтожима, а тело временно; свой долг нужно исполнять без привязанности к плодам; высшая цель жизни — восстановить вечные отношения с Богом. Преданное служение (бхакти) раскрывается как суть и завершение всех духовных путей.
        </p>
      </section>

      <section>
        <SectionTitle>Структура</SectionTitle>
        <p style={{ margin: "0 0 6px", fontSize: 15, lineHeight: 1.55, color: INK2 }}>
          «Гита» традиционно делится на три части по шесть глав — путь от деятельности к знанию и преданности:
        </p>
        <div>
          <DefRow term="Главы 1-6 · Карма-йога" desc="Природа вечной души и деятельность без привязанности к плодам." />
          <DefRow term="Главы 7-12 · Бхакти-йога" desc="Верховная Личность Бога и путь любовного преданного служения." />
          <DefRow term="Главы 13-18 · Гьяна-йога" desc="Знание о поле деятельности, трёх гунах природы и итог — полное предание Богу." last />
        </div>
        <p style={{ margin: "12px 0 0", fontSize: 13, lineHeight: 1.5, color: INK3 }}>
          Число 18 не случайно: столько глав в «Гите», дней длилась битва на Курукшетре, насчитывается главных Пуран и книг (парв) в самой «Махабхарате».
        </p>
      </section>

      <section>
        <SectionTitle>Происхождение и передача</SectionTitle>
        <div>
          <KeyVal k="Поведал" v="Господь Кришна — Арджуне" />
          <KeyVal k="Записал" v="Вьясадева (в «Махабхарату»)" />
          <KeyVal k="Передаётся" v="Через парампару" last />
        </div>
        <p style={{ margin: "14px 0 0", fontSize: 15, lineHeight: 1.55, color: INK2 }}>
          «Гита» входит в «Бхишма-парву» «Махабхараты» и с древности комментировалась всеми крупнейшими школами ведической философии — Шанкарой, Рамануджей, Мадхвой. Подход «как она есть» означает передачу текста без отклонений от замысла Кришны, в неразрывной линии духовных учителей (<Skt>парампаре</Skt>).
        </p>
        <p style={{ margin: "12px 0 0", fontSize: 13, lineHeight: 1.5, color: INK3 }}>
          По традиции беседа произошла в начале Кали-юги, около 5 000 лет назад; академическая наука относит складывание текста к рубежу старой и новой эры.
        </p>
      </section>

      <section>
        <SectionTitle>Это издание · «Как она есть»</SectionTitle>
        <p style={{ margin: "0 0 14px", fontSize: 16, lineHeight: 1.58, color: INK }}>
          Перед вами «Бхагавад-гита как она есть» Его Божественной Милости А. Ч. Бхактиведанты Свами Прабхупады — с оригинальным санскритом, транслитерацией, пословным и литературным переводом и развёрнутыми комментариями.
        </p>
        <div>
          <KeyVal k="Автор" v="А. Ч. Бхактиведанта Свами Прабхупада" />
          <KeyVal k="Издатель" v="The Bhaktivedanta Book Trust" />
          <KeyVal k="Первое издание" v="1968, Macmillan (сокращённое)" />
          <KeyVal k="Полное издание" v="1972 (1008 стр., 48 илл.)" />
          <KeyVal k="Переводов" v="более 60 языков" />
          <KeyVal k="Язык этого издания" v="Русский" last />
        </div>
        <p style={{ margin: "16px 0 0", fontSize: 13, lineHeight: 1.5, color: INK3 }}>
          По оценке издателя (BBT), «Гита как она есть» — самое распространённое издание «Бхагавад-гиты» в мире; оно познакомило с текстом миллионы читателей и используется как пособие во многих университетах.
        </p>
      </section>

      <section>
        <SectionTitle>Каждый стих — пять слоёв</SectionTitle>
        <div>
          <DefRow term="1 · Деванагари" desc="Священный санскрит в оригинальном письме." />
          <DefRow term="2 · Транслитерация" desc="Латинская запись для точного произношения." />
          <DefRow term="3 · Пословный перевод" desc="Значение каждого санскритского слова." />
          <DefRow term="4 · Литературный перевод" desc="Связный смысл стиха на русском языке." />
          <DefRow term="5 · Комментарий" desc="Развёрнутое пояснение в духе традиции (purport)." last />
        </div>
      </section>
    </div>
  );
}

/* ───────── О книге · ЧЧ ───────── */
function CcOverview({ book }: { book: BookData }) {
  void book;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 36, padding: "26px 20px 12px" }}>
      <section>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", color: GOLDT, marginBottom: 12 }}>Ведическое писание</div>
        <p style={{ margin: 0, fontSize: 17.5, lineHeight: 1.55, color: INK }}>
          «Шри Чайтанья-чаритамрита» («Нектар деяний Шри Чайтаньи») — главное и наиболее авторитетное произведение о жизни и учении Шри Чайтаньи Махапрабху, золотого воплощения Господа, явившегося в Бенгалии около пятисот лет назад.
        </p>
        <p style={{ margin: "14px 0 0", fontSize: 16, lineHeight: 1.58, color: INK2 }}>
          Это вершина гаудия-вайшнавской литературы и подлинная энциклопедия науки бхакти — её метафизики, теологии и эстетики преданного служения (расы). В традиции «Чайтанья-чаритамриту» относят к высшему, завершающему изучению — после «Бхагавад-гиты» и «Шримад-Бхагаватам».
        </p>
      </section>

      <section>
        <SectionTitle>Кратко</SectionTitle>
        <div>
          <KeyVal k="Жанр" v="Священное писание · духовная биография" />
          <KeyVal k="Автор оригинала" v="Кришнадаса Кавираджа Госвами" />
          <KeyVal k="Язык оригинала" v="Бенгали (со стихами на санскрите)" />
          <KeyVal k="Объём" v="3 лилы · 62 главы · более 11 000 стихов" />
          <KeyVal k="Форма" v="Жизнь и учение Шри Чайтаньи" />
          <KeyVal k="Написана" v="конец XVI века, Вриндаван" />
          <KeyVal k="Явление Господа" v="1486 год, Навадвипа" last />
        </div>
      </section>

      <section>
        <SectionTitle>О чём книга</SectionTitle>
        <p style={{ margin: 0, fontSize: 16.5, lineHeight: 1.6, color: INK }}>
          В книге описаны явление, деяния и наставления Шри Чайтаньи Махапрабху — Самого Кришны, принявшего настроение и облик Своего преданного, Шримати Радхарани. Господь Чайтанья положил начало движению санкиртаны — совместному пению святых имён Бога как пути самопознания для нынешней эпохи.
        </p>
        <p style={{ margin: "12px 0 0", fontSize: 16, lineHeight: 1.6, color: INK2 }}>
          На её страницах раскрывается философия ачинтья-бхеда-абхеда-таттвы — непостижимого одновременного единства и различия Бога и Его энергий; приводятся прославленные беседы Господа с Раманандой Раем и Рупой Госвами, а также «Шикшаштака» — восемь наставлений, единственные стихи, написанные Самим Шри Чайтаньей.
        </p>
      </section>

      <section>
        <SectionTitle>Структура</SectionTitle>
        <p style={{ margin: "0 0 6px", fontSize: 15, lineHeight: 1.55, color: INK2 }}>
          Книга делится на три части (лилы) — по периодам жизни Господа Чайтаньи:
        </p>
        <div>
          <DefRow term="Ади-лила · 17 глав" desc="Ранние годы: богословское вступление, происхождение, явление, детство и юность Господа в Навадвипе." />
          <DefRow term="Мадхья-лила · 25 глав" desc="Зрелые годы: принятие санньясы, паломничество по Южной Индии, проповедь и великие философские беседы." />
          <DefRow term="Антья-лила · 20 глав" desc="Заключительные годы в Джаганнатха-Пури и сокровенные экстатические игры Господа." last />
        </div>
        <p style={{ margin: "12px 0 0", fontSize: 13, lineHeight: 1.5, color: INK3 }}>
          «Чайтанья-чаритамрита» продолжает более раннее жизнеописание — «Чайтанья-бхагавату» Вриндавана даса Тхакура, — подробно раскрывая поздний период, который тот почти не затронул.
        </p>
      </section>

      <section>
        <SectionTitle>Происхождение и передача</SectionTitle>
        <div>
          <KeyVal k="Автор" v="Кришнадаса Кавираджа Госвами" />
          <KeyVal k="Где написана" v="Вриндаван, по просьбе вайшнавов" />
          <KeyVal k="Опора" v="записи Сварупы Дамодары и Рагхунатхи даса" last />
        </div>
        <p style={{ margin: "14px 0 0", fontSize: 15, lineHeight: 1.55, color: INK2 }}>
          Кришнадаса Кавираджа Госвами составил «Чайтанья-чаритамриту» в глубокой старости, опираясь на дневники ближайших спутников Господа — Сварупы Дамодары Госвами и Рагхунатхи даса Госвами. Текст стал главным авторитетным жизнеописанием Шри Чайтаньи и компендиумом учения Шести Госвами Вриндавана.
        </p>
      </section>

      <section>
        <SectionTitle>Это издание</SectionTitle>
        <p style={{ margin: "0 0 14px", fontSize: 16, lineHeight: 1.58, color: INK }}>
          Перед вами «Шри Чайтанья-чаритамрита» с переводом и развёрнутыми комментариями Его Божественной Милости А.&nbsp;Ч. Бхактиведанты Свами Прабхупады — с оригиналом, транслитерацией, пословным и литературным переводом и подробными пояснениями.
        </p>
        <div>
          <KeyVal k="Перевод и комментарии" v="А. Ч. Бхактиведанта Свами Прабхупада" />
          <KeyVal k="Издатель" v="The Bhaktivedanta Book Trust" />
          <KeyVal k="Первое издание" v="1973-1975 (17 томов)" />
          <KeyVal k="Язык этого издания" v="Русский" last />
        </div>
        <p style={{ margin: "16px 0 0", fontSize: 13, lineHeight: 1.5, color: INK3 }}>
          Весь многотомный перевод с комментариями Шрила Прабхупада завершил всего за несколько месяцев в 1974-1975 годах. В традиции гаудия-вайшнавов святость «Чайтанья-чаритамриты» сравнивают со святостью «Бхагавад-гиты».
        </p>
      </section>

      <section>
        <SectionTitle>Каждый стих — слои</SectionTitle>
        <div>
          <DefRow term="1 · Оригинал" desc="Текст на бенгали с цитатами из санскритских писаний в подлинном письме." />
          <DefRow term="2 · Транслитерация" desc="Латинская запись для точного произношения." />
          <DefRow term="3 · Пословный перевод" desc="Значение каждого слова оригинала." />
          <DefRow term="4 · Литературный перевод" desc="Связный смысл стиха на русском языке." />
          <DefRow term="5 · Комментарий" desc="Развёрнутое пояснение в духе традиции (purport)." last />
        </div>
      </section>
    </div>
  );
}

/* ───────── Автор ───────── */
function Milestone({ year, text, last }: { year: string; text: string; last?: boolean }) {
  return (
    <li style={{ position: "relative", paddingLeft: 30, paddingBottom: last ? 0 : 22 }}>
      {!last && <span aria-hidden style={{ position: "absolute", left: 5.5, top: 13, bottom: 0, width: 1, background: LINE }} />}
      <span aria-hidden style={{ position: "absolute", left: 1.5, top: 3.5, width: 9, height: 9, borderRadius: "50%", background: GOLD, boxShadow: `0 0 0 3px ${PAPER}` }} />
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.3px", color: GOLDT, marginBottom: 3 }}>{year}</div>
      <div style={{ fontSize: 15, lineHeight: 1.5, color: INK }}>{text}</div>
    </li>
  );
}
/* ───────── Автор · Шрила Прабхупада-лиламрита (биограф, не Прабхупада) ───────── */
function SplAuthor() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 34, padding: "28px 20px 12px" }}>
      <header>
        <div style={{ marginBottom: 18 }}>
          <LogoMark src="/iskcon-sign.svg" label="ИСККОН" height={36} color={INK} />
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", color: INK2, marginBottom: 10 }}>Автор жизнеописания</div>
        <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.14, fontWeight: 800, letterSpacing: "-0.02em", color: INK }}>
          Сатсварупа Дас<br />Госвами
        </h1>
        <div style={{ marginTop: 8, fontSize: 14.5, lineHeight: 1.45, color: INK2 }}>
          Ученик Шрилы Прабхупады · один из первых его учеников на Западе и духовный наставник в ИСККОН
        </div>
      </header>

      <section>
        <div style={{ paddingLeft: 18, borderLeft: `2px solid ${GOLD}` }}>
          <p style={{ margin: 0, fontSize: 18, lineHeight: 1.5, fontWeight: 500, letterSpacing: "-0.01em", color: INK }}>
            «Шрила Прабхупада-лиламрита» — каноническое многотомное жизнеописание Ачарьи-основателя ИСККОН. Его герой — Шрила Прабхупада; его автор — Сатсварупа Дас Госвами.
          </p>
        </div>
        <p style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.55, color: INK3 }}>
          Сатсварупа Дас Госвами лично знал Шрилу Прабхупаду и работал под его руководством; книга основана на письмах, дневниках, беседах и свидетельствах учеников.
        </p>
      </section>

      <section>
        <SectionTitle>О книге</SectionTitle>
        <div>
          <KeyVal k="Жанр" v="Духовное жизнеописание" />
          <KeyVal k="Герой книги" v="А. Ч. Бхактиведанта Свами Прабхупада" />
          <KeyVal k="Автор" v="Сатсварупа Дас Госвами" />
          <KeyVal k="Объём" v="62 главы · 2 тома" />
          <KeyVal k="Издатель" v="Bhaktivedanta Book Trust" last />
        </div>
      </section>
    </div>
  );
}

export function Author() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 34, padding: "28px 20px 12px" }}>
      <header>
        <div style={{ marginBottom: 18 }}>
          <LogoMark src="/iskcon-sign.svg" label="ИСККОН" height={36} color={INK} />
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", color: INK2, marginBottom: 10 }}>Автор перевода и комментариев</div>
        <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.14, fontWeight: 800, letterSpacing: "-0.02em", color: INK }}>
          А.&nbsp;Ч. Бхактиведанта<br />Свами Прабхупада
        </h1>
        <div style={{ marginTop: 8, fontSize: 14.5, lineHeight: 1.45, color: INK2 }}>
          Его Божественная Милость · Ачарья-основатель Международного общества сознания Кришны (ИСККОН)
        </div>
        <div style={{ marginTop: 12, display: "inline-flex", alignItems: "center", padding: "5px 12px", borderRadius: 999, border: `0.5px solid ${LINE}`, fontSize: 13, fontWeight: 600, color: INK }}>
          1896-1977
        </div>
      </header>

      <section>
        <div style={{ paddingLeft: 18, borderLeft: `2px solid ${GOLD}` }}>
          <p style={{ margin: 0, fontSize: 20, lineHeight: 1.44, fontWeight: 500, letterSpacing: "-0.01em", color: INK }}>
            В 69 лет он в одиночку привёз учение «Бхагавад-гиты» из Индии на Запад — и всего за одиннадцать лет перевёл десятки томов ведических писаний и основал движение, охватившее весь мир.
          </p>
        </div>
        <p style={{ margin: "12px 0 0", fontSize: 13, lineHeight: 1.5, color: INK3 }}>
          При его рождении астролог предсказал: в 70 лет ребёнок пересечёт океан, станет великим проповедником и основает 108 храмов.
        </p>
      </section>

      <section>
        <SectionTitle>Кратко</SectionTitle>
        <div>
          <KeyVal k="Имя при рождении" v="Абхай Чаран Де" />
          <KeyVal k="Родился" v="1 сентября 1896, Калькутта" />
          <KeyVal k="Ушёл" v="14 ноября 1977, Вриндаван" />
          <KeyVal k="Образование" v="Шотландский церковный колледж" />
          <KeyVal k="Духовный учитель" v="Бхактисиддханта Сарасвати" />
          <KeyVal k="Традиция" v="Гаудия-вайшнавизм" />
          <KeyVal k="Титул" v="Ачарья-основатель ИСККОН" last />
        </div>
      </section>

      <section>
        <SectionTitle>Путь</SectionTitle>
        <ol style={{ listStyle: "none", margin: 0, padding: "2px 0 0" }}>
          <Milestone year="1896" text="Родился в Калькутте под именем Абхай Чаран Де, в день Нандотсавы, в вайшнавской купеческой семье." />
          <Milestone year="1920" text="Окончил Шотландский церковный колледж в Калькутте — английский язык, философия и экономика." />
          <Milestone year="1922" text="Встретил духовного учителя Бхактисиддханту Сарасвати Тхакура; уже при первой встрече тот попросил его нести ведическое знание на английском языке Западу." />
          <Milestone year="1933" text="Получил формальное посвящение (дикшу) от Бхактисиддханты Сарасвати в Аллахабаде." />
          <Milestone year="1944" text="Начал издавать журнал «Обратно к Богу» — в одиночку: автор, художник, редактор, издатель и распространитель." />
          <Milestone year="1947" text="Гаудия-вайшнавское общество удостоило его титула «Бхактиведанта» — «тот, для кого преданное служение есть суть всего знания»." />
          <Milestone year="1959" text="Принял санньясу (отречение) и приступил к главному труду жизни — многотомному переводу «Шримад-Бхагаватам»." />
          <Milestone year="1965" text="В 69 лет на грузовом судне «Джаладута» (37 дней пути, два инфаркта) прибыл в Нью-Йорк — без средств, с сундуками своих книг." />
          <Milestone year="1966" text="Основал в Нью-Йорке Международное общество сознания Кришны (ИСККОН)." />
          <Milestone year="1972" text="Учредил издательство Bhaktivedanta Book Trust (BBT) — крупнейшего в мире издателя ведической литературы." />
          <Milestone year="1977" text="Ушёл из этого мира во Вриндаване в возрасте 81 года, оставив более сотни храмов и центров на всех континентах." last />
        </ol>
      </section>

      <section>
        <SectionTitle>Главные труды</SectionTitle>
        <div>
          <DefRow term="«Бхагавад-гита как она есть»" desc="Перевод и развёрнутые комментарии (1968 · 1972)." />
          <DefRow term="«Шримад-Бхагаватам»" desc="Многотомный перевод и комментарий «Бхагавата-пураны» (18 000 стихов)." />
          <DefRow term="«Шри Чайтанья-чаритамрита»" desc="Перевод и комментарии жития и учения Шри Чайтаньи." />
          <DefRow term="«Кришна, Верховная Личность Бога»" desc="Изложение Десятой песни «Шримад-Бхагаватам»." />
          <DefRow term="И другие" desc="«Нектар преданности», «Шри Ишопанишад», «Учение Господа Чайтаньи»; журнал «Обратно к Богу» (с 1944) издаётся и сегодня." last />
        </div>
      </section>

      <section>
        <SectionTitle>Наследие</SectionTitle>
        <div>
          <KeyVal k="Книг написано и переведено" v="около 70 томов" />
          <KeyVal k="Языков перевода" v="более 70" />
          <KeyVal k="Храмов и центров" v="более 100" />
          <KeyVal k="Кругосветных поездок" v="14" />
          <KeyVal k="Учеников" v="тысячи по миру" last />
        </div>
        <p style={{ margin: "14px 0 0", fontSize: 14.5, lineHeight: 1.55, color: INK2 }}>
          Его переводы ценятся учёными за точность, глубину и верность традиции и используются как учебные пособия в университетах. За одиннадцать лет, дав начало мировому движению, он обошёл земной шар четырнадцать раз.
        </p>
        <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.5, color: INK3 }}>
          Жизнь Шрилы Прабхупады описана его учеником в семитомной биографии «Шрила Прабхупада-лиламрита».
        </p>
      </section>
    </div>
  );
}

/* ───────── Рецензии (отзывы влиятельных личностей) ───────── */
function Review({ text, name, role, last }: { text: string; name: string; role: string; last?: boolean }) {
  return (
    <div style={{ padding: "20px 0", borderBottom: last ? "none" : `0.5px solid ${LINE}` }}>
      <span aria-hidden style={{ display: "block", color: GOLD, fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 34, lineHeight: 1, height: 18 }}>“</span>
      <p style={{ margin: "2px 0 0", fontSize: 16.5, lineHeight: 1.55, color: INK }}>{text}</p>
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: INK }}>{name}</div>
        <div style={{ fontSize: 13, lineHeight: 1.4, color: INK2, marginTop: 1 }}>{role}</div>
      </div>
    </div>
  );
}

function Reviews() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 34, padding: "26px 20px 12px" }}>
      <section>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", color: GOLDT, marginBottom: 12 }}>Признание</div>
        <p style={{ margin: 0, fontSize: 17, lineHeight: 1.55, color: INK }}>
          За полвека «Бхагавад-гита как она есть» получила отзывы учёных-индологов, религиоведов и деятелей культуры по всему миру.
        </p>
      </section>

      <section>
        <SectionTitle>Учёные и индологи</SectionTitle>
        <div>
          <Review
            text="Научное и авторитетное издание «Гиты» — ценное и для специалиста, и для обычного читателя. Прекрасно сделанная книга, которую я рекомендую своим студентам."
            name="Д-р Сэмюэл Д. Аткинс"
            role="Профессор санскрита, Принстонский университет" />
          <Review
            text="Живое, новое прочтение текста, давно знакомого многим: оно многократно углубляет понимание. Этой работой Свами Бхактиведанта оказал услугу растущему числу западных читателей."
            name="Д-р Эдвард Ч. Даймок-мл."
            role="Кафедра южноазиатских языков и цивилизаций, Чикагский университет" />
          <Review
            text="Именно такого вдумчивого, близкого к тексту комментария к «Гите» нам недоставало — написанного и с позиции учёного, и с позиции практикующего, посвятившего этому жизнь."
            name="Томас Дж. Хопкинс"
            role="Профессор религиоведения, Колледж Франклина и Маршалла" />
          <Review
            text="Особая ценность этого прочтения «Гиты» в том, что оно даёт авторитетное толкование в русле традиции Чайтаньи."
            name="Оливье Лакомб"
            role="Профессор санскрита и индологии, Сорбонна, Париж" />
          <Review
            text="Книги BBT — отличного качества и большой ценности для университетских курсов по религиям Индии; особенно это их «Бхагавад-гита»."
            name="Д-р Фредерик Б. Андервуд"
            role="Профессор религиоведения, Колумбийский университет" />
          <Review
            text="Глубоко прочувствованная, мощно задуманная и прекрасно изложенная работа. Трудно сказать, чем восхищаться больше — самим переводом, смелым методом разъяснения или неисчерпаемым богатством идей."
            name="Д-р Кайлаш Ваджпеи"
            role="Директор отделения индийских исследований, Университет Мехико"
            last />
        </div>
      </section>

      <section>
        <SectionTitle>Культурное влияние</SectionTitle>
        <p style={{ margin: "0 0 6px", fontSize: 15, lineHeight: 1.55, color: INK2 }}>
          Учение, которое Прабхупада нёс миру, нашло отклик не только в академии:
        </p>
        <div>
          <DefRow
            term="Джордж Харрисон · The Beatles"
            desc="В 1969 году спродюсировал сингл «Hare Krishna Mantra» (Apple Records), ставший хитом в Британии и Европе; профинансировал первое издание книги «Кришна» и написал к ней предисловие." />
          <DefRow
            term="Аллен Гинзберг · поэт"
            desc="Публично воспевал маха-мантру на поэтических вечерах и в телеэфире, помогая познакомить с ней западную публику после встречи с Прабхупадой в Нью-Йорке."
            last />
        </div>
      </section>

      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: INK3 }}>
        Отзывы учёных приведены в сокращении и переводе; их полные тексты опубликованы в изданиях книги и публикуются Bhaktivedanta Book Trust.
      </p>
    </div>
  );
}

/* ───────── Рецензии · ЧЧ ───────── */
function CcReviews() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 34, padding: "26px 20px 12px" }}>
      <section>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", color: GOLDT, marginBottom: 12 }}>Признание</div>
        <p style={{ margin: 0, fontSize: 17, lineHeight: 1.55, color: INK }}>
          С выходом английского издания (BBT, 1973-1975) «Шри Чайтанья-чаритамриту» в переводе Шрилы Прабхупады приветствовали ведущие индологи и религиоведы Гарварда, Корнелла, Беркли и других университетов.
        </p>
      </section>

      <section>
        <SectionTitle>В традиции</SectionTitle>
        <div>
          <Review
            text="Шрила Кришнадаса Кавираджа Госвами в высшей степени сжато изложил суть всех писаний в «Шри Чайтанья-чаритамрите»."
            name="Бхактисиддханта Сарасвати Тхакур"
            role="Ачарья гаудия-вайшнавов, духовный учитель Шрилы Прабхупады"
            last />
        </div>
      </section>

      <section>
        <SectionTitle>Учёные и индологи</SectionTitle>
        <div>
          <Review
            text="Я счастлив, что у меня есть эти прекрасно изданные тома, воплотившие труд столь учёного и искреннего человека, преданного посланию «Чайтанья-чаритамриты»."
            name="Д-р Дэниел Х. Х. Ингаллс"
            role="Заведующий кафедрой санскрита и индийских исследований, Гарвардский университет" />
          <Review
            text="Появление английского перевода «Шри Чайтанья-чаритамриты» — повод для радости и учёных-индологов, и читателей, ищущих знакомства с духовностью Индии. Он заполняет серьёзнейший пробел в наших библиотеках и университетских курсах по религиозным традициям Индии."
            name="Д-р Дж. Брюс Лонг"
            role="Кафедра азиатских исследований, Корнеллский университет" />
          <Review
            text="Как литературное произведение она не имеет равных во всей бенгальской литературе; как священный текст её святость сравнима со святостью «Бхагавад-гиты». Это английское издание превосходно."
            name="Д-р О. Б. Л. Капур"
            role="Заслуженный профессор философии, Государственный аспирантский колледж, Гьянпур (Индия)" />
          <Review
            text="Истинная радость — получить этот значительный труд о жизни великого святого Бенгалии Чайтаньи, подготовленный самым известным его современным толкователем."
            name="Д-р Марк Юргенсмайер"
            role="Профессор этики и феноменологии религий, Высшая теологическая семинария, Беркли" />
          <Review
            text="Год за годом интерес к восточной религиозной мысли в Америке растёт. Перевод и издание «Шри Чайтанья-чаритамриты» внесут существенный вклад для всех, кто стремится понять идеи Индии."
            name="Д-р Джеральд А. Ларю"
            role="Профессор религиоведения, Университет Южной Калифорнии" />
          <Review
            text="«Шри Чайтанья-чаритамриту» можно рекомендовать как источник богатых прозрений для каждого серьёзного исследователя сознания."
            name="Д-р Рори О'Дэй"
            role="Кафедра человеческих отношений, Университет Уотерлу (Канада)"
            last />
        </div>
      </section>

      <section>
        <SectionTitle>Место в литературе и истории</SectionTitle>
        <div>
          <DefRow
            term="Главное жизнеописание"
            desc="Авторитетный источник о жизни и учении Шри Чайтаньи; продолжает «Чайтанья-бхагавату», подробно раскрывая поздний период Его игр." />
          <DefRow
            term="Энциклопедия богословия"
            desc="Компендиум гаудия-вайшнавского учения — метафизики, теологии и эстетики расы, разработанных Шестью Госвами Вриндавана."
            last />
        </div>
      </section>

      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: INK3 }}>
        Отзывы учёных приведены в сокращении и переводе; их полные тексты опубликованы в изданиях книги и публикуются Bhaktivedanta Book Trust.
      </p>
    </div>
  );
}

/* ───────── О книге · ШБ ───────── */
function SbOverview({ book }: { book: BookData }) {
  void book;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 36, padding: "26px 20px 12px" }}>
      <section>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", color: GOLDT, marginBottom: 12 }}>Ведическое писание</div>
        <p style={{ margin: 0, fontSize: 17.5, lineHeight: 1.55, color: INK }}>
          «Шримад-Бхагаватам» («Бхагавата-пурана») — величайшая из восемнадцати главных Пуран и, по слову самого писания, зрелый плод древа ведической литературы. Её составил мудрец Вьясадева как свой собственный естественный комментарий к «Веданта-сутре».
        </p>
        <p style={{ margin: "14px 0 0", fontSize: 16, lineHeight: 1.58, color: INK2 }}>
          В восемнадцати тысячах стихов «Бхагаватам» целиком посвящён Верховной Личности Бога — Его именам, образам, качествам, воплощениям и деяниям — и раскрывает высшую цель жизни: чистую, бескорыстную любовь к Богу (према-бхакти). Традиция называет его «чистой, безупречной Пураной» (амала-пурана).
        </p>
      </section>

      <section>
        <SectionTitle>Кратко</SectionTitle>
        <div>
          <KeyVal k="Жанр" v="Маха-пурана · «чистая Пурана»" />
          <KeyVal k="Автор" v="Вьясадева (Шрила Вьяса)" />
          <KeyVal k="Язык оригинала" v="Санскрит" />
          <KeyVal k="Объём" v="12 песней · 335 глав · ~18 000 стихов" />
          <KeyVal k="Рассказана" v="Шукадевой Госвами — Махарадже Парикшиту" />
          <KeyVal k="Обрамление" v="Беседа Суты Госвами с мудрецами в Наймишаранье" />
          <KeyVal k="Тема" v="Верховный Господь и чистое преданное служение" last />
        </div>
      </section>

      <section>
        <SectionTitle>О чём книга</SectionTitle>
        <p style={{ margin: 0, fontSize: 16.5, lineHeight: 1.6, color: INK }}>
          Узнав, что ему осталось семь дней жизни, царь Парикшит оставляет царство и садится на берегу Ганги, чтобы услышать о Высшей Истине. Ответом мудреца Шукадевы Госвами на его вопрос «в чём долг человека перед смертью?» и становится «Шримад-Бхагаватам».
        </p>
        <p style={{ margin: "12px 0 0", fontSize: 16, lineHeight: 1.6, color: INK2 }}>
          От сотворения мира и устройства вселенной книга ведёт к историям великих преданных и воплощений Господа — Варахи, Нрисимхи, Ваманы, Рамы — и достигает вершины в Десятой песни, целиком посвящённой играм Шри Кришны во Вриндаване и Двараке. Сквозная нить — према-бхакти как совершенство всех путей.
        </p>
      </section>

      <section>
        <SectionTitle>Структура</SectionTitle>
        <p style={{ margin: "0 0 6px", fontSize: 15, lineHeight: 1.55, color: INK2 }}>
          Двенадцать песней (санскр. сканда) ведут читателя от первых вопросов о смысле жизни к сокровенным играм Господа:
        </p>
        <div>
          <DefRow term="Песни 1–2 · Введение" desc="Слава святого имени и преданного служения; ответ на главные вопросы жизни и смерти." />
          <DefRow term="Песни 3–6 · Творение и закон" desc="Сотворение мира, наставления Капилы и Нарады, истории Дхрувы и Аджамилы; устройство вселенной." />
          <DefRow term="Песни 7–9 · Преданные и династии" desc="Прахлада Махараджа, образцовые цари и преданные, царские родословные вплоть до явления Господа." />
          <DefRow term="Песнь 10 · Сердце книги" desc="Явление и игры Шри Кришны — самая обширная и сокровенная часть «Бхагаватам»." />
          <DefRow term="Песни 11–12 · Завершение" desc="Последние наставления Господа, уход Кришны, признаки Кали-юги и слава пения святых имён." last />
        </div>
        <p style={{ margin: "12px 0 0", fontSize: 13, lineHeight: 1.5, color: INK3 }}>
          «Бхагаватам» считается сутью всех Вед: он начинается там, где «Бхагавад-гита» завершается, — призывом всецело предаться Богу.
        </p>
      </section>

      <section>
        <SectionTitle>Происхождение и передача</SectionTitle>
        <div>
          <KeyVal k="Составил" v="Вьясадева" />
          <KeyVal k="По указанию" v="своего учителя Нарады Муни" />
          <KeyVal k="Передаётся" v="через парампару от Шукадевы Госвами" last />
        </div>
        <p style={{ margin: "14px 0 0", fontSize: 15, lineHeight: 1.55, color: INK2 }}>
          Записав Веды и «Махабхарату», Вьясадева всё же не чувствовал удовлетворения. Его учитель Нарада указал причину: он ещё не прославил во всей полноте Верховную Личность Бога. Тогда в духовном озарении Вьяса составил «Шримад-Бхагаватам» и передал его сыну — освобождённому мудрецу Шукадеве, от которого книга и дошла до нас.
        </p>
      </section>

      <section>
        <SectionTitle>Это издание</SectionTitle>
        <p style={{ margin: "0 0 14px", fontSize: 16, lineHeight: 1.58, color: INK }}>
          Перед вами «Шримад-Бхагаватам» с переводом и развёрнутыми комментариями Его Божественной Милости А.&nbsp;Ч. Бхактиведанты Свами Прабхупады — с оригинальным санскритом, транслитерацией, пословным и литературным переводом и подробными пояснениями.
        </p>
        <div>
          <KeyVal k="Перевод и комментарии" v="А. Ч. Бхактиведанта Свами Прабхупада" />
          <KeyVal k="Издатель" v="The Bhaktivedanta Book Trust" />
          <KeyVal k="Первые тома" v="1962, Дели (Песни 1–3)" />
          <KeyVal k="Главный труд жизни" v="ради него принял санньясу (1959)" />
          <KeyVal k="Язык этого издания" v="Русский" last />
        </div>
        <p style={{ margin: "16px 0 0", fontSize: 13, lineHeight: 1.5, color: INK3 }}>
          «Шримад-Бхагаватам» был главным трудом жизни Шрилы Прабхупады: он перевёл и прокомментировал песни с Первой по начало Десятой; начатую им работу завершили его ученики в BBT, следуя его методу и указаниям. Многотомное издание выходит более чем на полусотне языков.
        </p>
      </section>

      <section>
        <SectionTitle>Каждый стих — пять слоёв</SectionTitle>
        <div>
          <DefRow term="1 · Деванагари" desc="Священный санскрит в оригинальном письме." />
          <DefRow term="2 · Транслитерация" desc="Латинская запись для точного произношения." />
          <DefRow term="3 · Пословный перевод" desc="Значение каждого санскритского слова." />
          <DefRow term="4 · Литературный перевод" desc="Связный смысл стиха на русском языке." />
          <DefRow term="5 · Комментарий" desc="Развёрнутое пояснение в духе традиции (purport)." last />
        </div>
      </section>
    </div>
  );
}

/* ───────── Рецензии · ШБ ───────── */
function SbReviews() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 34, padding: "26px 20px 12px" }}>
      <section>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", color: GOLDT, marginBottom: 12 }}>Признание</div>
        <p style={{ margin: 0, fontSize: 17, lineHeight: 1.55, color: INK }}>
          О величии «Шримад-Бхагаватам» прежде всего говорит само писание и многовековая традиция вайшнавов; перевод Шрилы Прабхупады (BBT) изучают на курсах по религиям Индии в университетах по всему миру.
        </p>
      </section>

      <section>
        <SectionTitle>Слово самого писания</SectionTitle>
        <div>
          <Review
            text="Это писание, «Шримад-Бхагаватам», — зрелый плод древа ведической литературы. Изойдя из уст Шукадевы Госвами, он стал ещё слаще; вкусите же этот нектар вновь и вновь."
            name="«Шримад-Бхагаватам» 1.1.3"
            role="Слово самого писания" />
          <Review
            text="Эта „Бхагавата-пурана“ сияет, как солнце: она взошла сразу после того, как Кришна вместе с религией и знанием удалился в Свою обитель. Люди, ослеплённые тьмой Кали-юги, обретут в ней свет."
            name="«Шримад-Бхагаватам» 1.3.43"
            role="Слово самого писания"
            last />
        </div>
      </section>

      <section>
        <SectionTitle>Место в священной литературе</SectionTitle>
        <div>
          <DefRow
            term="«Чистая Пурана» (амала-пурана)"
            desc="Естественный комментарий самого Вьясадевы к «Веданта-сутре»; традиция почитает его безупречным среди всех Пуран." />
          <DefRow
            term="Литературное воплощение Бога"
            desc="Гаудия-вайшнавы чтут «Бхагаватам» как звуковое воплощение Кришны — общение с ним равносильно общению с Самим Господом." />
          <DefRow
            term="Венец преданного знания"
            desc="Его изучают после «Бхагавад-гиты», и он ведёт к чистой любви к Богу — высшей цели всех ведических писаний."
            last />
        </div>
      </section>

      <section>
        <SectionTitle>Признание учёных</SectionTitle>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.58, color: INK2 }}>
          Многотомный перевод Шрилы Прабхупады с оригиналом, транслитерацией, пословным разбором и комментариями ценится индологами и религиоведами за точность и верность традиции; он стал одним из самых распространённых в мире изданий ведической литературы и используется как учебное пособие в университетах.
        </p>
      </section>

      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: INK3 }}>
        Стихи писания приведены в переводе и сокращении; полные тексты с комментариями публикуются Bhaktivedanta Book Trust.
      </p>
    </div>
  );
}

/* ───────── О книге · НП ───────── */
function NodOverview({ book }: { book: BookData }) {
  void book;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 36, padding: "26px 20px 12px" }}>
      <section>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", color: GOLDT, marginBottom: 12 }}>Наука преданности</div>
        <p style={{ margin: 0, fontSize: 17.5, lineHeight: 1.55, color: INK }}>
          «Нектар преданности» — это изложение «Бхакти-расамрита-синдху», классического труда, написанного на санскрите Шрилой Рупой Госвами, главным из шести Госвами Вриндавана и ближайшим спутником Господа Чайтаньи Махапрабху.
        </p>
        <p style={{ margin: "14px 0 0", fontSize: 16, lineHeight: 1.58, color: INK2 }}>
          Это полное руководство по науке бхакти — преданного служения Богу. Книга шаг за шагом ведёт от первых проблесков веры к высшему совершенству жизни: чистой, ничем не обусловленной любви к Кришне (према) и вкусу вечных взаимоотношений с Ним (раса).
        </p>
      </section>

      <section>
        <SectionTitle>Кратко</SectionTitle>
        <div>
          <KeyVal k="Жанр" v="Наука преданного служения (бхакти-шастра)" />
          <KeyVal k="Первоисточник" v="«Бхакти-расамрита-синдху» Рупы Госвами" />
          <KeyVal k="Автор изложения" v="А. Ч. Бхактиведанта Свами Прабхупада" />
          <KeyVal k="Объём" v="Предисловие, вступление и 51 глава" />
          <KeyVal k="Сквозная тема" v="Как развить чистую любовь к Богу" />
          <KeyVal k="Венец" v="Према и расы преданного служения" last />
        </div>
      </section>

      <section>
        <SectionTitle>О чём книга</SectionTitle>
        <p style={{ margin: 0, fontSize: 16.5, lineHeight: 1.6, color: INK }}>
          Рупа Госвами сравнивает преданное служение с океаном нектара (бхакти-раса-амрита-синдху). «Нектар преданности» проводит читателя по этому океану: что такое чистая бхакти, кто способен ею заниматься, как её практиковать и каких оскорблений избегать.
        </p>
        <p style={{ margin: "12px 0 0", fontSize: 16, lineHeight: 1.6, color: INK2 }}>
          Вторая половина книги раскрывает самое сокровенное — как дремлющая в сердце любовь к Богу пробуждается и расцветает в пяти основных взаимоотношениях с Кришной: нейтральном, служении, дружбе, родительской любви и супружеской любви. Это наука о вечной жизни души в любви.
        </p>
      </section>

      <section>
        <SectionTitle>Структура</SectionTitle>
        <p style={{ margin: "0 0 6px", fontSize: 15, lineHeight: 1.55, color: INK2 }}>
          Изложение следует двум «океанам» труда Рупы Госвами — восходящему пути практики и затем расцвету любви:
        </p>
        <div>
          <DefRow term="Практика бхакти" desc="Признаки чистого преданного служения, его превосходство над освобождением, как практиковать и каких оскорблений избегать." />
          <DefRow term="Бхава и према" desc="Как регулируемое служение перерастает в спонтанную привязанность, а затем в чистую любовь к Богу." />
          <DefRow term="Пять основных рас" desc="Нейтралитет, служение, дружба, родительская и супружеская любовь к Кришне." />
          <DefRow term="Косвенные расы" desc="Семь второстепенных взаимоотношений — от смеха до изумления и гнева — в связи с Господом." last />
        </div>
      </section>

      <section>
        <SectionTitle>Это издание</SectionTitle>
        <p style={{ margin: "0 0 14px", fontSize: 16, lineHeight: 1.58, color: INK }}>
          «Нектар преданности» Шрила Прабхупада составил как доступное изложение «Бхакти-расамрита-синдху», чтобы наука преданного служения стала понятна читателю наших дней. Текст приводится главами для последовательного чтения.
        </p>
        <div>
          <KeyVal k="Изложение и комментарии" v="А. Ч. Бхактиведанта Свами Прабхупада" />
          <KeyVal k="Издатель" v="The Bhaktivedanta Book Trust" />
          <KeyVal k="Первое издание" v="1970" />
          <KeyVal k="Язык этого издания" v="Русский" last />
        </div>
      </section>
    </div>
  );
}

/* ───────── Рецензии · НП ───────── */
function NodReviews() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 34, padding: "26px 20px 12px" }}>
      <section>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", color: GOLDT, marginBottom: 12 }}>Признание</div>
        <p style={{ margin: 0, fontSize: 17, lineHeight: 1.55, color: INK }}>
          «Нектар преданности» опирается на высший авторитет гаудия-вайшнавской традиции в науке о бхакти — труд Шрилы Рупы Госвами, которому Сам Господь Чайтанья поручил раскрыть науку преданного служения.
        </p>
      </section>

      <section>
        <SectionTitle>Слово традиции</SectionTitle>
        <div>
          <Review
            text="Преданное служение Господу подобно безбрежному океану нектара. Тот, кто погрузится в него, обретёт высшее счастье и более не пожелает ничего иного."
            name="По «Бхакти-расамрита-синдху»"
            role="Замысел Рупы Госвами" />
          <Review
            text="Когда любовь к Богу, дремлющая в сердце, пробуждается, обусловленная душа возвращается к своей вечной природе — служению Кришне в чистой любви."
            name="По «Нектару преданности»"
            role="Суть книги"
            last />
        </div>
      </section>

      <section>
        <SectionTitle>Место в священной литературе</SectionTitle>
        <div>
          <DefRow
            term="Свод законов бхакти"
            desc="«Бхакти-расамрита-синдху» — главный трактат о науке преданного служения, систематизирующий бесчисленные наставления писаний о бхакти." />
          <DefRow
            term="Поручение Господа Чайтаньи"
            desc="Рупа Госвами по указанию Шри Чайтаньи Махапрабху изложил науку расы — вечных взаимоотношений души с Богом." />
          <DefRow
            term="Продолжение «Бхагавад-гиты»"
            desc="Если «Гита» призывает предаться Богу, «Нектар преданности» подробно учит, как это делать и к чему это ведёт."
            last />
        </div>
      </section>

      <section>
        <SectionTitle>Зачем читать</SectionTitle>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.58, color: INK2 }}>
          Для практикующего «Нектар преданности» — настольное руководство: как утвердиться в преданном служении, избежать оскорблений и постепенно развить вкус к святому имени и чистую любовь к Богу. Это карта пути от первого шага до высшей цели.
        </p>
      </section>

      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: INK3 }}>
        Цитаты приведены в изложении; полный текст с комментариями публикуется Bhaktivedanta Book Trust.
      </p>
    </div>
  );
}

/* ───────── Содержание (flat rows on white) ───────── */
/** Путь стиха для кабинета (прогресс чтения): /book/<work>/<lila|ch>/<verse?>. */
function versePathFor(work: string, division: string | undefined, ref: string): string {
  const dv = (division ?? "").split(".").filter(Boolean); // ["sb","1","9"] | ["cc","adi","7"] | ["bg","2"]
  const vseg = ref.split(".").pop() ?? "";
  if (work !== "bg") {
    return dv.length >= 3 ? `/book/${work}/${dv[1]}/${dv[2]}${vseg ? `/${vseg}` : ""}` : `/book/${work}`;
  }
  const ch = dv.length >= 2 ? dv[dv.length - 1] : (ref.split(".")[0] ?? "");
  return `/book/${work}/${ch}${vseg ? `/${vseg}` : ""}`;
}

export interface ChapterRow { id: string; number: string; title_ru: string; title_en: string; source_url: string; verses: number; }
function Contents({ chapters, onOpenChapter, prose = false }: { chapters: ChapterRow[] | null; onOpenChapter: (ch: ChapterRow) => void; prose?: boolean }) {
  const chCount = chapters ? chapters.filter((c) => { const n = Number(c.number); return n >= 1 && n <= 999; }).length : 0;
  return (
    <div style={{ padding: "24px 20px 12px" }}>
      <SectionTitle>{chapters ? (prose ? `${chCount} глав` : `${chapters.length} глав`) : "Содержание"}</SectionTitle>
      {!chapters && <div style={{ fontSize: 15, color: INK2 }}>Загрузка оглавления…</div>}
      {chapters && (
        <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {chapters.map((c, i) => {
            const n = Number(c.number);
            const showNum = !prose || (n >= 1 && n <= 999);
            return (
              <li key={c.id} style={{ position: "relative" }}>
                <Pressable onClick={() => onOpenChapter(c)} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 0" }}>
                  <span style={{ flexShrink: 0, width: 22, textAlign: "center", fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: GOLDT }}>{showNum ? c.number : ""}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 16, lineHeight: 1.3, fontWeight: 500, color: INK }}>{c.title_ru}</span>
                    {!prose && <span style={{ display: "block", marginTop: 2, fontSize: 13, color: INK3 }}>{c.verses} стихов</span>}
                  </span>
                  <span style={{ color: INK3 }}><ChevronIcon size={17} /></span>
                </Pressable>
                {i < chapters.length - 1 && <span aria-hidden style={{ position: "absolute", left: 38, right: 0, bottom: 0, height: 0.5, background: LINE }} />}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/* ───────── Содержание (иерархия: лила/песнь → глава) ───────── */
interface CcToc { name: string; divisions: { id: string; slug: string; number: string; title_ru: string; chapters: { id: string; number: string; title_ru: string; verses: number }[] }[] }
function CcContents({ work, onOpenChapter }: { work: string; onOpenChapter: (ch: ChapterRow) => void }) {
  const [toc, setToc] = useState<CcToc | null>(null);
  const [err, setErr] = useState(false);
  const [activeDiv, setActiveDiv] = useState<string>("");   // активная песнь/лила (id раздела)
  const [subTop, setSubTop] = useState(96);                  // sticky-офсет суб-табов = TopBar + Tier-1 табы
  const listRef = useRef<HTMLDivElement | null>(null);
  const subNavEl = useRef<HTMLElement | null>(null);
  const ready = useRef(false);                               // не сбрасывать прокрутку на первичной установке
  useEffect(() => {
    let live = true;
    setToc(null); setErr(false); ready.current = false;
    fetch(api(`/books/${work}/toc`))
      .then((r) => r.json())
      .then((d) => { if (live) { if (d?.divisions) { setToc(d as CcToc); setActiveDiv(d.divisions[0]?.id ?? ""); } else setErr(true); } })
      .catch(() => { if (live) setErr(true); });
    return () => { live = false; };
  }, [work]);
  // Замер: суб-табы липнут вплотную под Tier-1 табами (без шва, обе панели — одно стекло).
  useLayoutEffect(() => {
    const nav = document.querySelector('[aria-label="Разделы книги"]') as HTMLElement | null;
    setSubTop(52 + (nav?.offsetHeight ?? 44));
  }, [toc]);
  // Смена песни/лилы → вернуть прокрутку к началу списка глав (под липкими табами), если ушли вниз.
  useEffect(() => {
    if (!ready.current) { if (activeDiv) ready.current = true; return; }
    const node = listRef.current; if (!node) return;
    let sc: HTMLElement | null = node.parentElement;
    while (sc) { const oy = getComputedStyle(sc).overflowY; if (oy === "auto" || oy === "scroll") break; sc = sc.parentElement; }
    requestAnimationFrame(() => {
      if (!listRef.current) return;
      const stickyBottom = subTop + (subNavEl.current?.offsetHeight ?? 42);
      const delta = listRef.current.getBoundingClientRect().top - stickyBottom;
      if (delta < -1) (sc ?? window).scrollBy({ top: delta, behavior: "auto" });
    });
  }, [activeDiv]);   // subTop стабилен после загрузки — намеренно не в зависимостях
  const totalCh = toc ? toc.divisions.reduce((a, d) => a + d.chapters.length, 0) : 0;
  const partWord = work === "sb" ? "песней" : "части";
  const cur = toc?.divisions.find((d) => d.id === activeDiv) ?? null;
  return (
    <div style={{ paddingBottom: 12 }}>
      <div style={{ padding: "24px 20px 6px" }}>
        <SectionTitle>{toc ? `${toc.divisions.length} ${partWord} · ${totalCh} глав` : "Содержание"}</SectionTitle>
      </div>
      {!toc && !err && <div style={{ padding: "0 20px", fontSize: 15, color: INK2 }}>Загрузка оглавления…</div>}
      {err && <div style={{ padding: "0 20px", fontSize: 15, color: INK2 }}>Не удалось загрузить оглавление.</div>}
      {toc && toc.divisions.length > 1 && (
        <SectionSubTabs
          items={toc.divisions.map((d) => ({ id: d.id, label: d.title_ru || `Часть ${d.number}` }))}
          active={activeDiv}
          onChange={setActiveDiv}
          top={subTop}
          navRef={(el) => { subNavEl.current = el; }}
        />
      )}
      {cur && (
        <div ref={listRef} style={{ padding: "10px 20px 0" }}>
          <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {cur.chapters.map((c, i) => (
              <li key={c.id} style={{ position: "relative" }}>
                <Pressable onClick={() => onOpenChapter({ id: c.id, number: c.number, title_ru: c.title_ru, title_en: "", source_url: "", verses: c.verses })} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 0" }}>
                  <span style={{ flexShrink: 0, width: 22, textAlign: "center", fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: GOLDT }}>{c.number}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 16, lineHeight: 1.3, fontWeight: 500, color: INK }}>{c.title_ru && !/глава/i.test(c.title_ru) ? c.title_ru : `Глава ${c.number}`}</span>
                    <span style={{ display: "block", marginTop: 2, fontSize: 13, color: INK3 }}>{c.verses} стихов</span>
                  </span>
                  <span style={{ color: INK3 }}><ChevronIcon size={17} /></span>
                </Pressable>
                {i < cur.chapters.length - 1 && <span aria-hidden style={{ position: "absolute", left: 38, right: 0, bottom: 0, height: 0.5, background: LINE }} />}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

/* ───────── verse model ───────── */
export interface ChapterVerse {
  ref: string; label: string;
  devanagari: string | null; translit: string | null;
  tokens: { term: string; gloss: string | null }[];
  translation: string | null; purport: string | null;
}

/* ───────── Глава ───────── */
function ChapterPage({ chapter, chapters, hierOrder, bookTitle, work = "bg", hierarchical = false, onOpenVerse, onBack, onMenuAction, onQr, flash }: { chapter: ChapterRow; chapters?: ChapterRow[] | null; hierOrder?: string[] | null; bookTitle: string; work?: string; hierarchical?: boolean; onOpenVerse: (ref: string) => void; onBack: () => void; onMenuAction: (id: string) => void; onQr: (url: string, data: QrData) => void; flash: (m: string) => void }) {
  const [verses, setVerses] = useState<ChapterVerse[] | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [menu, setMenu] = useState(false);
  const favHref = hierarchical ? `/book/${work}/${chapter.id.split(".")[1] ?? ""}/${chapter.number}` : `/book/${work}/${chapter.number}`;
  const { on: fav, toggle: toggleFav } = useFavorite(`chapter:${work}/${chapter.id || chapter.number}`, { t: chapter.title_ru, s: `Глава ${chapter.number} · ${bookTitle}`, h: favHref });
  const [printing, setPrinting] = useState(false);
  const moreRef = useRef<HTMLSpanElement>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const player = usePlayer();

  useEffect(() => {
    if (!printing) return;
    let cancelled = false;
    (async () => {
      const common = { onStatus: flash, fallback: () => { if (printRef.current) exportToPdf(printRef.current, { title: `${chapter.title_ru} · ${bookTitle}` }); } };
      if (hierarchical) {
        const lila = ccLilaLabel(chapter.id.split(".")[1] ?? "");
        await downloadServerPdf(
          `/pdf?kind=chapter&work=${encodeURIComponent(work)}&div=${encodeURIComponent(chapter.id)}`,
          `Шри Чайтанья-чаритамрита. ${lila}. Глава ${chapter.number}.pdf`,
          common,
        );
      } else {
        await downloadServerPdf(
          `/pdf?kind=chapter&work=${encodeURIComponent(work)}&n=${encodeURIComponent(chapter.number)}`,
          `${bookTitle}. Глава ${chapter.number}.pdf`,
          common,
        );
      }
      if (!cancelled) setPrinting(false);
    })();
    return () => { cancelled = true; };
  }, [printing, chapter.id, chapter.number, chapter.title_ru, work, hierarchical, bookTitle]);

  useEffect(() => {
    let live = true;
    setVerses(null);
    recordRead({
      work,
      ref: hierarchical ? chapter.id : String(chapter.number),
      label: chapter.title_ru ? `Глава ${chapter.number} · ${chapter.title_ru}` : `Глава ${chapter.number}`,
      href: favHref,
      kind: "chapter",
    });
    {
      // Локальный прогресс (полка «Продолжить», и для гостя). Процент по главам:
      // плоские книги (BG…) — из chapters, иерархические (ЧЧ/ШБ) — из hierOrder.
      const cIdx = hierarchical
        ? (hierOrder ? hierOrder.indexOf(chapter.id) : -1)
        : (chapters ? chapters.findIndex((c) => String(c.number) === String(chapter.number)) : -1);
      const cTotal = hierarchical ? (hierOrder ? hierOrder.length : 0) : (chapters ? chapters.length : 0);
      noteRead({
        work,
        ref: hierarchical ? chapter.id : String(chapter.number),
        label: chapter.title_ru ? `Глава ${chapter.number} · ${chapter.title_ru}` : `Глава ${chapter.number}`,
        href: favHref,
        kind: "chapter",
        idx: cIdx >= 0 ? cIdx + 1 : 0,
        total: cTotal,
      });
    }
    const readUrl = hierarchical
      ? api(`/books/${work}/division/${chapter.id}/read`)
      : api(`/books/${work}/chapters/${chapter.number}/read`);
    fetch(readUrl)
      .then((r) => r.json())
      .then((d) => { if (live) setVerses(d.verses ?? []); })
      .catch(() => { if (live) setVerses([]); });
    return () => { live = false; };
  }, [chapter.id, chapter.number, work, hierarchical, chapters, hierOrder]);

  const anyDemo = !!verses && verses.some((v) => !v.translation && DEMO_VERSES[v.ref]?.translation);

  const shareChapter = async () => {
    const label = `Глава ${chapter.number} · ${chapter.title_ru}`;
    const url = `https://gaurangers.com/book/${work}`;
    try {
      if (typeof navigator !== "undefined" && (navigator as Navigator).share) {
        await (navigator as Navigator).share({ title: `${label} · ${bookTitle}`, text: `${label} — ${bookTitle}`, url });
        return;
      }
    } catch { /* cancelled */ }
    try { await navigator.clipboard.writeText(url); flash("Ссылка скопирована"); }
    catch { flash(url); }
  };

  return (
    <div style={{ position: "fixed", top: 0, bottom: 0, left: 0, right: 0, margin: "0 auto", width: "100%", maxWidth: 480, zIndex: 70, display: "flex", flexDirection: "column", background: PAPER }}>
      <header style={{ flexShrink: 0, height: 56, display: "flex", alignItems: "center", gap: 4, padding: "0 6px", background: PAPER, borderBottom: `0.5px solid ${collapsed ? LINE : "transparent"}`, transition: "border-color .2s", zIndex: 2 }}>
        <NavBtn ariaLabel="Назад" onClick={onBack}><BackIcon size={22} /></NavBtn>
        <div style={{ flex: 1, minWidth: 0, textAlign: "center", opacity: collapsed ? 1 : 0, transform: collapsed ? "none" : "translateY(3px)", transition: "opacity .2s, transform .2s" }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, letterSpacing: "-0.01em", color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", padding: "0 4px" }}>{renderTitle(chapter.title_ru)}</div>
          <div style={{ fontSize: 11, color: INK2 }}>Глава {chapter.number} · {bookTitle}</div>
        </div>
        <NavBtn ariaLabel="В избранное" onClick={() => toggleFav(flash)} size={36}><span style={{ display: "inline-flex", color: fav ? "#FF3B30" : INK }}><HeartIcon size={18} filled={fav} /></span></NavBtn>
        <NavBtn ariaLabel="Слушать" onClick={() => { if (!AUDIO_WORKS[work]) { flash("Аудиокнига — скоро"); return; } player.playChapter(work, Number(chapter.number) || 1, "plain", hierarchical ? chapter.id.split(".")[1] : undefined); }} size={36}><HeadphonesIcon size={18} /></NavBtn>
        <span ref={moreRef} style={{ display: "inline-flex" }}><NavBtn ariaLabel="Ещё" onClick={() => setMenu(true)} size={36}><MoreIcon size={16} /></NavBtn></span>
      </header>

      <div onScroll={(e) => setCollapsed((e.target as HTMLDivElement).scrollTop > 56)}
        style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        <div style={{ margin: "0 auto", padding: "16px 22px calc(40px + env(safe-area-inset-bottom))" }}>
          <div style={{ textAlign: "center", marginBottom: 2 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: GOLDT, marginBottom: 12 }}>Глава {chapter.number}</div>
            <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.1, fontWeight: 800, letterSpacing: "-0.025em", color: INK }}>{renderTitle(chapter.title_ru)}</h1>
            <div style={{ marginTop: 10, fontSize: 13.5, color: INK2 }}>{verses?.length ?? chapter.verses} стихов</div>
          </div>
          <Ornament />

          {!verses && <div style={{ textAlign: "center", color: INK2, padding: "40px 0", fontSize: 15 }}>Загрузка главы…</div>}
          {verses && verses.length === 0 && <div style={{ textAlign: "center", color: INK2, padding: "40px 0", fontSize: 15 }}>В этой главе пока нет стихов.</div>}

          {verses && verses.length > 0 && (
            <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {verses.map((v, i) => {
                const tr = v.translation || DEMO_VERSES[v.ref]?.translation || null;
                const isDemo = !v.translation && !!DEMO_VERSES[v.ref]?.translation;
                return (
                  <li key={v.ref} style={{ position: "relative" }}>
                    <Pressable onClick={() => onOpenVerse(v.ref)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 0" }}>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 12, fontWeight: 700, letterSpacing: "0.4px", textTransform: "uppercase", color: GOLDT, marginBottom: 5 }}>{v.label}{isDemo && <DemoBadge />}</span>
                        <span style={{ display: "block", fontSize: 16.5, lineHeight: 1.5, color: tr ? INK : INK2, fontStyle: tr ? "normal" : "italic" }}>
                          {tr ?? "перевод готовится"}
                        </span>
                      </span>
                      <span style={{ color: INK3, alignSelf: "center" }}><ChevronIcon size={17} /></span>
                    </Pressable>
                    {i < verses.length - 1 && <span aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 0.5, background: LINE }} />}
                  </li>
                );
              })}
            </ol>
          )}

          {anyDemo && (
            <p style={{ marginTop: 20, fontSize: 12, lineHeight: 1.5, color: INK3 }}>
              Перевод, помеченный «демо», — демонстрационный текст прототипа; он будет заменён лицензированным текстом издания. Откройте стих, чтобы увидеть санскрит, транслитерацию, пословный перевод и комментарий.
            </p>
          )}
        </div>
      </div>

      <BookMenuSheet open={menu} onClose={() => setMenu(false)} withNote onSelect={(id) => {
        setMenu(false);
        if (id === "note") {
          requestNote({
            kind: "chapter",
            ref: `chapter:${work}/${chapter.id || chapter.number}`,
            title: chapter.title_ru,
            subtitle: `Глава ${chapter.number} · ${bookTitle}`,
            href: `/book/${work}${hierarchical ? `/${chapter.id.split(".")[1]}/${chapter.number}` : `/${chapter.number}`}`,
          });
          return;
        }
        if (id === "share") { void shareChapter(); return; }
        if (id === "pdf") {
          if (verses && verses.length) setPrinting(true);
          else flash("Глава ещё загружается…");
          return;
        }
        if (id === "qr") {
          onQr(`https://gaurangers.com/book/${work}${hierarchical ? `/${chapter.id.split(".")[1]}/${chapter.number}` : `/${chapter.number}`}`, {
            kind: "chapter",
            bookTitle,
            chapterNumber: chapter.number,
            chapterTitle: chapter.title_ru,
          });
          return;
        }
        onMenuAction(id);
      }} anchorRef={moreRef} />
      {printing && verses && (
        <div ref={printRef} aria-hidden style={{ position: "fixed", left: -10000, top: 0, width: 760 }}>
          <ChapterPrint chapter={chapter} verses={verses} />
        </div>
      )}
    </div>
  );
}
type LayerKey = "deva" | "translit" | "ww" | "commentary";
function LayerRow({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", padding: "11px 0", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font-text)", fontSize: 16, color: INK, WebkitTapHighlightColor: "transparent" }}>
      <span>{label}</span>
      <span aria-hidden style={{ position: "relative", width: 42, height: 26, borderRadius: 999, background: on ? GOLD : "rgba(0,0,0,0.12)", transition: "background .2s", flexShrink: 0 }}>
        <span style={{ position: "absolute", top: 3, left: on ? 19 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.25)" }} />
      </span>
    </button>
  );
}
function LayerLabel({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 12px", fontSize: 11, fontWeight: 700, letterSpacing: "1.6px", textTransform: "uppercase", color: INK2, breakAfter: "avoid" }}><span style={{ width: 18, height: 1.5, background: GOLD, borderRadius: 999, flexShrink: 0 }} />{children}</div>;
}

/* Метка «Комментарий» — в том же стиле, что и «Перевод» (LayerLabel). */
function CommentaryLabel({ demo }: { demo?: boolean }) {
  return <LayerLabel>Комментарий{demo && <DemoBadge />}</LayerLabel>;
}
function DemoBadge() {
  return <span style={{ marginLeft: 8, padding: "1px 7px", borderRadius: 999, background: FILL, color: INK2, fontSize: 9.5, fontWeight: 700, letterSpacing: ".5px", verticalAlign: "middle" }}>демо</span>;
}

interface VerseToken { term: string; gloss: string | null; }
interface VerseDetail {
  ref: string; label: string; uvaca: string | null; division?: string | null;
  devanagari: string | null; translit: string | null;
  tokens: VerseToken[]; translation: string | null; purport: string | null;
  source_url: string | null; prev: string | null; next: string | null;
}

/* ───────── PDF-вёрстка (стих / глава / книга) — наш дизайн на бумаге ───────── */

// Метки лил ЧЧ для имён файлов и заголовков PDF.
const CC_LILA_LABEL: Record<string, string> = { adi: "Ади-лила", madhya: "Мадхья-лила", antya: "Антья-лила" };
function ccLilaLabel(slug: string): string { return CC_LILA_LABEL[slug] ?? slug; }

// Разбиваем оригинальный стих (деванагари/бенгали) на поэтические строки по дандам,
// если в данных переносов нет: одинарная данда «।» — конец полустишия; группа
// «॥ N ॥» — конец стиха (перенос только если дальше ещё есть текст, т.е. диапазон).
// Идемпотентно: если \n уже есть (как у БГ), строку не трогаем.
function scriptLines(s: string | null | undefined): string {
  if (!s) return "";
  if (s.includes("\n")) return s;
  let out = s.replace(/\s*।\s*/g, " ।\n");
  out = out.replace(/॥[^॥]*॥(?=\s*\S)/g, (m) => m + "\n");
  return out.replace(/\s+$/g, "");
}

function resolveVerse(v: ChapterVerse) {
  const demo = DEMO_VERSES[v.ref];
  return {
    label: v.label,
    deva: v.devanagari || demo?.devanagari || null,
    translit: v.translit || demo?.translit || null,
    tokens: (v.tokens && v.tokens.length ? v.tokens : demo?.tokens) ?? [],
    translation: v.translation || demo?.translation || null,
    purport: v.purport || demo?.purport || null,
  };
}

export function VerseBody({ v }: { v: ChapterVerse }) {
  const r = resolveVerse(v);
  const hasWW = r.tokens.length > 0;
  const hasCommentary = !!r.purport;
  return (
    <div style={{ marginBottom: 34 }}>
      <div data-pdf-block>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.4px", textTransform: "uppercase", color: GOLDT, textAlign: "center", marginBottom: 12 }}>{r.label}</div>
      {r.deva && (
        <div style={{ fontFamily: "var(--font-deva, 'Noto Serif Devanagari', var(--font-text))", fontSize: 19, lineHeight: 1.6, textAlign: "center", color: INK, whiteSpace: "pre-line", marginBottom: r.translit ? 16 : 22 }}>{scriptLines(r.deva)}</div>
      )}
      {r.translit && (
        <div style={{ marginBottom: 16 }}>
          {r.translit.split("\n").map((ln, i) => (
            <div key={i} style={{ fontStyle: "italic", fontSize: 15, lineHeight: 1.45, letterSpacing: "-0.01em", textAlign: "center", textWrap: "balance", color: INK2, marginTop: i === 0 ? 0 : 7 }}>{ln}</div>
          ))}
        </div>
      )}
      {(r.deva || r.translit) && <Ornament />}
      </div>
      {hasWW && (
        <section style={{ marginBottom: 30 }}>
          <LayerLabel>Пословный перевод</LayerLabel>
          <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.95, color: INK2 }}>
            {r.tokens.map((t, i) => (
              <span key={i}>
                <span style={{ fontStyle: "italic", color: INK }}>{t.term}</span>
                {t.gloss ? ` — ${t.gloss}` : ""}{i < r.tokens.length - 1 ? "; " : "."}
              </span>
            ))}
          </p>
        </section>
      )}
      <section data-pdf-block style={{ marginBottom: hasCommentary ? 30 : 0 }}>
        <LayerLabel>Перевод</LayerLabel>
        {r.translation ? (
          <div style={{ paddingLeft: 18, borderLeft: `2px solid ${GOLD}` }}>
            <p style={{ margin: 0, fontSize: 20, lineHeight: 1.5, fontWeight: 500, letterSpacing: "-0.01em", color: INK }}>{renderTerms(r.translation)}</p>
          </div>
        ) : (
          <div style={{ paddingLeft: 18, borderLeft: `2px solid ${LINE}` }}>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: INK2 }}>Перевод этого стиха готовится.</p>
          </div>
        )}
      </section>
      {hasCommentary && (
        <section>
          <CommentaryLabel />
          <div style={{ fontSize: 17, lineHeight: 1.8, color: INK }}>
            {r.purport!.split(/\n\n+/).map((para, i) => (
              <p key={i} style={{ margin: i === 0 ? 0 : "14px 0 0" }}>{renderTerms(para)}</p>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function ChapterPrint({ chapter, verses, newPage }: { chapter: ChapterRow; verses: ChapterVerse[]; newPage?: boolean }) {
  return (
    <div style={newPage ? { breakBefore: "page" } : undefined}>
      <div data-pdf-block style={{ textAlign: "center", margin: "0 0 8px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: GOLDT, marginBottom: 12 }}>Глава {chapter.number}</div>
        <h2 style={{ margin: 0, fontSize: 30, lineHeight: 1.1, fontWeight: 800, letterSpacing: "-0.025em", color: INK }}>{renderTitle(chapter.title_ru)}</h2>
        <div style={{ marginTop: 8, fontSize: 13, color: INK2 }}>{verses.length} стихов</div>
        <Ornament />
      </div>
      {verses.length === 0
        ? <p style={{ textAlign: "center", color: INK2, fontSize: 15 }}>Стихи этой главы готовятся.</p>
        : verses.map((v) => <VerseBody key={v.ref} v={v} />)}
    </div>
  );
}

export function BookPrint({ book, chapters, versesByCh }: { book: BookData; chapters: ChapterRow[]; versesByCh: Record<string, ChapterVerse[]> }) {
  return (
    <div>
      {/* cover / title page */}
      <div data-pdf-block style={{ textAlign: "center", breakAfter: "page", paddingTop: "30mm" }}>
        <img src="/iskcon-one-love-mark.svg" alt="ISKCON ONE LOVE" style={{ width: "30mm", height: "auto", display: "block", margin: "0 auto" }} />
        <div style={{ width: "54mm", margin: "9mm auto 0", borderTop: `1px solid ${GOLD}`, position: "relative" }}>
          <span style={{ position: "absolute", top: "-8pt", left: "50%", transform: "translateX(-50%)", background: "#fff", padding: "0 6px", color: GOLD, fontSize: "9pt" }}>◆</span>
        </div>
        <h1 style={{ margin: "16mm 0 0", fontSize: 40, lineHeight: 1.06, fontWeight: 800, letterSpacing: "-0.02em", color: INK }}>{renderTitle(book.titleLine1)}</h1>
        {book.titleLine2 && <div style={{ marginTop: 4, fontSize: 27, fontWeight: 600, letterSpacing: "-0.01em", color: INK }}>{renderTitle(book.titleLine2)}</div>}
        <div style={{ marginTop: "7mm", fontSize: 12.5, letterSpacing: "3px", textTransform: "uppercase", color: INK2 }}>Полное издание с комментариями</div>
        <p style={{ margin: "20mm auto 0", maxWidth: 430, fontSize: 14.5, lineHeight: 1.55, color: INK2 }}>{book.author}</p>
      </div>
      {/* table of contents */}
      <div data-pdf-block style={{ margin: "8px 0 4px" }}>
        <LayerLabel>Содержание</LayerLabel>
        <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {chapters.map((c) => (
            <li key={c.id} style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "7px 0", borderBottom: `0.5px solid ${LINE}` }}>
              <span style={{ width: 22, flexShrink: 0, textAlign: "center", fontSize: 14, fontWeight: 700, color: GOLDT }}>{c.number}</span>
              <span style={{ flex: 1, fontSize: 15.5, color: INK }}>{c.title_ru}</span>
              <span style={{ fontSize: 12.5, color: INK3 }}>{c.verses} стихов</span>
            </li>
          ))}
        </ol>
      </div>
      {/* chapters with all verses, each from a new page */}
      {chapters.map((c) => (
        <ChapterPrint key={c.id} chapter={c} verses={versesByCh[c.number] ?? []} newPage />
      ))}
    </div>
  );
}

// Печать одной лилы ЧЧ (Ади / Мадхья / Антья) — отдельный PDF на лилу.
// Главы внутри лилы нумеруются уникально, но ключуем по c.id (надёжно).
export function LilaPrint({ book, lilaLabel, range, chapters, versesByCh, bare }: { book: BookData; lilaLabel: string; range?: string; chapters: ChapterRow[]; versesByCh: Record<string, ChapterVerse[]>; bare?: boolean }) {
  const fullTitle = bookFullTitle(book);
  return (
    <div>
      {!bare && (
        <>
          {/* cover / title page */}
          <div data-pdf-block style={{ textAlign: "center", breakAfter: "page", paddingTop: "30mm" }}>
            <img src="/iskcon-one-love-mark.svg" alt="ISKCON ONE LOVE" style={{ width: "30mm", height: "auto", display: "block", margin: "0 auto" }} />
            <div style={{ width: "54mm", margin: "9mm auto 0", borderTop: `1px solid ${GOLD}`, position: "relative" }}>
              <span style={{ position: "absolute", top: "-8pt", left: "50%", transform: "translateX(-50%)", background: "#fff", padding: "0 6px", color: GOLD, fontSize: "9pt" }}>◆</span>
            </div>
            <h1 style={{ margin: "16mm 0 0", fontSize: 38, lineHeight: 1.08, fontWeight: 800, letterSpacing: "-0.02em", color: INK }}>{fullTitle}</h1>
            <div style={{ marginTop: "8mm", fontSize: 14, fontWeight: 700, letterSpacing: "3px", textTransform: "uppercase", color: GOLDT }}>{lilaLabel}</div>
            {range && <div style={{ marginTop: "3mm", fontSize: 12.5, color: INK2 }}>{range}</div>}
            <p style={{ margin: "20mm auto 0", maxWidth: 430, fontSize: 14.5, lineHeight: 1.55, color: INK2 }}>{book.author}</p>
          </div>
          {/* table of contents (this lila) */}
          <div data-pdf-block style={{ margin: "8px 0 4px" }}>
            <LayerLabel>{lilaLabel} · содержание</LayerLabel>
            <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {chapters.map((c) => (
                <li key={c.id} style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "7px 0", borderBottom: `0.5px solid ${LINE}` }}>
                  <span style={{ width: 22, flexShrink: 0, textAlign: "center", fontSize: 14, fontWeight: 700, color: GOLDT }}>{c.number}</span>
                  <span style={{ flex: 1, fontSize: 15.5, color: INK }}>{c.title_ru}</span>
                  <span style={{ fontSize: 12.5, color: INK3 }}>{c.verses} стихов</span>
                </li>
              ))}
            </ol>
          </div>
        </>
      )}
      {/* chapters with all verses, each from a new page */}
      {chapters.map((c, i) => (
        <ChapterPrint key={c.id} chapter={c} verses={versesByCh[c.id] ?? []} newPage={!(bare && i === 0)} />
      ))}
    </div>
  );
}

// Печать прозовой книги целиком (напр. «Нектар преданности»): титульная
// страница + содержание + главы прозы (каждая с новой страницы). Книго-
// независима — данные из BookData + переданные главы/абзацы.
export function ProsePrint({ book, chapters, parasByCh }: { book: BookData; chapters: ChapterRow[]; parasByCh: Record<string, ProsePara[]> }) {
  return (
    <div>
      {/* title page */}
      <div data-pdf-block style={{ textAlign: "center", breakAfter: "page", paddingTop: "30mm" }}>
        <img src="/iskcon-one-love-mark.svg" alt="ISKCON ONE LOVE" style={{ width: "30mm", height: "auto", display: "block", margin: "0 auto" }} />
        <div style={{ width: "54mm", margin: "9mm auto 0", borderTop: `1px solid ${GOLD}`, position: "relative" }}>
          <span style={{ position: "absolute", top: "-8pt", left: "50%", transform: "translateX(-50%)", background: "#fff", padding: "0 6px", color: GOLD, fontSize: "9pt" }}>◆</span>
        </div>
        <h1 style={{ margin: "16mm 0 0", fontSize: 40, lineHeight: 1.06, fontWeight: 800, letterSpacing: "-0.02em", color: INK }}>{renderTitle(book.titleLine1)}</h1>
        {book.titleLine2 && <div style={{ marginTop: 4, fontSize: 27, fontWeight: 600, letterSpacing: "-0.01em", color: INK }}>{renderTitle(book.titleLine2)}</div>}
        <div style={{ marginTop: "7mm", fontSize: 12.5, letterSpacing: "3px", textTransform: "uppercase", color: INK2 }}>{book.tagline}</div>
        <p style={{ margin: "20mm auto 0", maxWidth: 430, fontSize: 14.5, lineHeight: 1.55, color: INK2 }}>{book.author}</p>
      </div>
      {/* table of contents */}
      <div data-pdf-block style={{ margin: "8px 0 4px" }}>
        <LayerLabel>Содержание</LayerLabel>
        <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {chapters.map((c) => {
            const num = Number(c.number);
            const showNum = Number.isFinite(num) && num >= 1;
            return (
              <li key={c.id} style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "7px 0", borderBottom: `0.5px solid ${LINE}` }}>
                <span style={{ width: 22, flexShrink: 0, textAlign: "center", fontSize: 14, fontWeight: 700, color: GOLDT }}>{showNum ? c.number : "◆"}</span>
                <span style={{ flex: 1, fontSize: 15.5, color: INK }}>{c.title_ru}</span>
              </li>
            );
          })}
        </ol>
      </div>
      {/* chapters of flowing prose, each from a new page */}
      {chapters.map((c) => {
        const num = Number(c.number);
        const showNum = Number.isFinite(num) && num >= 1;
        const paras = parasByCh[c.number] ?? [];
        return (
          <div key={c.id} style={{ breakBefore: "page" }}>
            <div data-pdf-block style={{ textAlign: "center", margin: "0 0 8px" }}>
              {showNum && <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: GOLDT, marginBottom: 12 }}>Глава {c.number}</div>}
              <h2 style={{ margin: 0, fontSize: 30, lineHeight: 1.1, fontWeight: 800, letterSpacing: "-0.025em", color: INK }}>{c.title_ru}</h2>
              <Ornament />
            </div>
            {paras.length === 0
              ? <p style={{ textAlign: "center", color: INK2, fontSize: 15 }}>Текст этой главы готовится.</p>
              : <div style={{ color: INK }}>{paras.map((p, i) => <ProseBlock key={p.ref || i} text={p.translation ?? ""} fontSize={17} lineHeight={1.8} color={INK} top={i === 0 ? 0 : 14} />)}</div>}
          </div>
        );
      })}
    </div>
  );
}

function NavAction({ arrow, disabled, onClick, children }: { arrow?: "prev" | "next"; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  const [pressed, setPressed] = useState(false);
  const off = () => setPressed(false);
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      onPointerDown={() => { if (!disabled) setPressed(true); }} onPointerUp={off} onPointerLeave={off} onPointerCancel={off}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, height: 40, padding: "0 14px", borderRadius: 12, border: "none", cursor: disabled ? "default" : "pointer", background: !disabled && pressed ? FILL : "transparent", color: disabled ? INK3 : INK, opacity: disabled ? .45 : 1, fontSize: 15, fontWeight: 600, fontFamily: "var(--font-text)", transition: "background .12s", WebkitTapHighlightColor: "transparent" }}>
      {arrow === "prev" && <BackIcon size={18} />}
      {children}
      {arrow === "next" && <span style={{ display: "inline-flex", transform: "scaleX(-1)" }}><BackIcon size={18} /></span>}
    </button>
  );
}

/* ───────── Прозовый ридер главы (Нектар преданности и др. prose-книги) ───────── */
export interface ProsePara { ref: string; translation: string | null }

/**
 * Вычленяет нумерованный список «1) 2) 3) …» внутри прозового абзаца (стиль BBT:
 * перечни идут одной строкой). Возвращает вступление, пункты и хвостовую прозу
 * (текст после списка) — или null, если настоящего списка нет.
 *
 * — Берётся только МОНОТОННАЯ цепочка 1,2,3,… → случайные «30)» внутри скобочных
 *   пояснений («…шудры — 30).») не дробят текст и остаются в пункте.
 * — Запятые-перечень (короткие фрагменты «…плодов, 2)…»): концевые запятые
 *   снимаются, а проза после перечня выносится в отдельный абзац (outro).
 * — Точка-перечень (полные предложения «…обуви. 2)…»): пункты сохраняются целиком.
 */
function splitEnumerated(text: string): { intro: string; items: string[]; outro: string } | null {
  const re = /(\d{1,3})\)\.?/g;
  const marks: { num: number; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    // маркер пункта стоит в начале строки или сразу после пробела (граница фразы);
    // «(1)» в скобках не считается — перед цифрой не пробел.
    if (m.index !== 0 && text[m.index - 1] !== " ") continue;
    marks.push({ num: parseInt(m[1], 10), start: m.index, end: re.lastIndex });
  }
  const chain: { num: number; start: number; end: number }[] = [];
  let expect = 1;
  for (const mk of marks) if (mk.num === expect) { chain.push(mk); expect++; }
  if (chain.length < 2) return null; // не список — обычный абзац
  const intro = text.slice(0, chain[0].start).trim();
  const commaCnt = chain.slice(1).filter((mk) => text[mk.start - 2] === ",").length;
  const commaSeries = commaCnt >= Math.ceil((chain.length - 1) / 2);
  const raw: string[] = [];
  for (let i = 0; i < chain.length - 1; i++) raw.push(text.slice(chain[i].end, chain[i + 1].start));
  let lastRaw = text.slice(chain[chain.length - 1].end);
  let outro = "";
  if (commaSeries) {
    const md = lastRaw.match(/\.\s/); // конец перечня — первая «. » → дальше обычная проза
    if (md && md.index !== undefined) { outro = lastRaw.slice(md.index + 1).trim(); lastRaw = lastRaw.slice(0, md.index + 1); }
  }
  raw.push(lastRaw);
  const items = raw.map((s) => (commaSeries ? s.replace(/\s*[.,;]\s*$/, "") : s).trim()).filter(Boolean);
  if (items.length < 2) return null;
  return { intro, items, outro };
}

/** Прозовый абзац: обычный текст или, если внутри нумерованный перечень, — список с висячим отступом. */
function ProseBlock({ text, fontSize, lineHeight, color, top }: { text: string; fontSize: number; lineHeight: number; color: string; top: number }) {
  const en = text ? splitEnumerated(text) : null;
  if (!en) {
    return <p style={{ margin: 0, marginTop: top, fontSize, lineHeight, color, letterSpacing: "-0.003em" }}>{renderTerms(text)}</p>;
  }
  return (
    <div style={{ marginTop: top }}>
      {en.intro && <p style={{ margin: 0, fontSize, lineHeight, color, letterSpacing: "-0.003em" }}>{renderTerms(en.intro)}</p>}
      <ol style={{ listStyle: "none", margin: en.intro ? "14px 0 0" : 0, padding: 0 }}>
        {en.items.map((it, k) => (
          <li key={k} style={{ display: "flex", gap: 14, marginTop: k === 0 ? 0 : 11, alignItems: "baseline" }}>
            <span style={{ flexShrink: 0, minWidth: "1.7em", textAlign: "right", fontSize: fontSize - 1.5, fontWeight: 700, color: GOLDT, fontVariantNumeric: "tabular-nums", lineHeight }}>{k + 1}.</span>
            <span style={{ flex: 1, fontSize, lineHeight, color, letterSpacing: "-0.003em" }}>{renderTerms(it)}</span>
          </li>
        ))}
      </ol>
      {en.outro && <p style={{ margin: "14px 0 0", fontSize, lineHeight, color, letterSpacing: "-0.003em" }}>{renderTerms(en.outro)}</p>}
    </div>
  );
}
function ProseChapterPage({ chapter, chapters, bookTitle, work = "brs", onBack, onMenuAction, onQr, flash, onOpenChapter }: { chapter: ChapterRow; chapters: ChapterRow[] | null; bookTitle: string; work?: string; onBack: () => void; onMenuAction: (id: string) => void; onQr: (url: string, data: QrData) => void; flash: (m: string) => void; onOpenChapter: (ch: ChapterRow) => void }) {
  const [paras, setParas] = useState<ProsePara[] | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [menu, setMenu] = useState(false);
  const { on: fav, toggle: toggleFav } = useFavorite(`chapter:${work}/${chapter.id || chapter.number}`, { t: chapter.title_ru, s: `Глава ${chapter.number} · ${bookTitle}`, h: `/book/${work}/${chapter.number}` });
  const moreRef = useRef<HTMLSpanElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const n = Number(chapter.number);
  const numbered = n >= 1 && n <= 999;

  useEffect(() => {
    let live = true;
    setParas(null);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    recordRead({ work, ref: chapter.id, label: chapter.title_ru || (numbered ? `Глава ${chapter.number}` : bookTitle), href: numbered ? `/book/${work}/${chapter.number}` : `/book/${work}`, kind: "prose" });
    {
      const pIdx = chapters ? chapters.findIndex((c) => c.id === chapter.id) : -1;
      noteRead({
        work,
        ref: chapter.id,
        label: chapter.title_ru || (numbered ? `Глава ${chapter.number}` : bookTitle),
        href: numbered ? `/book/${work}/${chapter.number}` : `/book/${work}`,
        kind: "prose",
        idx: pIdx >= 0 ? pIdx + 1 : 0,
        total: chapters ? chapters.length : 0,
      });
    }
    fetch(api(`/books/${work}/chapters/${encodeURIComponent(chapter.number)}/read`))
      .then((r) => r.json())
      .then((d) => { if (live) setParas((d.verses ?? []).map((v: ProsePara) => ({ ref: v.ref, translation: v.translation }))); })
      .catch(() => { if (live) setParas([]); });
    return () => { live = false; };
  }, [chapter.id, chapter.number, work, chapters, bookTitle]);

  const idx = chapters ? chapters.findIndex((c) => c.id === chapter.id) : -1;
  const prev = chapters && idx > 0 ? chapters[idx - 1] : null;
  const next = chapters && idx >= 0 && idx < chapters.length - 1 ? chapters[idx + 1] : null;

  const shareChapter = async () => {
    const url = `https://gaurangers.com/book/${work}`;
    try {
      if (typeof navigator !== "undefined" && (navigator as Navigator).share) {
        await (navigator as Navigator).share({ title: `${chapter.title_ru} · ${bookTitle}`, text: `${chapter.title_ru} — ${bookTitle}`, url });
        return;
      }
    } catch { /* cancelled */ }
    try { await navigator.clipboard.writeText(url); flash("Ссылка скопирована"); }
    catch { flash(url); }
  };

  return (
    <div style={{ position: "fixed", top: 0, bottom: 0, left: 0, right: 0, margin: "0 auto", width: "100%", maxWidth: 480, zIndex: 70, display: "flex", flexDirection: "column", background: PAPER }}>
      <header style={{ flexShrink: 0, height: 56, display: "flex", alignItems: "center", gap: 4, padding: "0 6px", background: PAPER, borderBottom: `0.5px solid ${collapsed ? LINE : "transparent"}`, transition: "border-color .2s", zIndex: 2 }}>
        <NavBtn ariaLabel="Назад" onClick={onBack}><BackIcon size={22} /></NavBtn>
        <div style={{ flex: 1, minWidth: 0, textAlign: "center", opacity: collapsed ? 1 : 0, transform: collapsed ? "none" : "translateY(3px)", transition: "opacity .2s, transform .2s" }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, letterSpacing: "-0.01em", color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", padding: "0 4px" }}>{renderTitle(chapter.title_ru)}</div>
          <div style={{ fontSize: 11, color: INK2 }}>{numbered ? `Глава ${chapter.number} · ` : ""}{bookTitle}</div>
        </div>
        <NavBtn ariaLabel="В избранное" onClick={() => toggleFav(flash)} size={36}><span style={{ display: "inline-flex", color: fav ? "#FF3B30" : INK }}><HeartIcon size={18} filled={fav} /></span></NavBtn>
        <NavBtn ariaLabel="Слушать" onClick={() => { if (!AUDIO_WORKS[work]) { flash("Аудиокнига — скоро"); return; } }} size={36}><HeadphonesIcon size={18} /></NavBtn>
        <span ref={moreRef} style={{ display: "inline-flex" }}><NavBtn ariaLabel="Ещё" onClick={() => setMenu(true)} size={36}><MoreIcon size={16} /></NavBtn></span>
      </header>

      <div ref={scrollRef} onScroll={(e) => setCollapsed((e.target as HTMLDivElement).scrollTop > 56)}
        style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        <div style={{ margin: "0 auto", padding: "16px 24px calc(48px + env(safe-area-inset-bottom))" }}>
          <div style={{ textAlign: "center", marginBottom: 2 }}>
            {numbered && <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: GOLDT, marginBottom: 12 }}>Глава {chapter.number}</div>}
            <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.14, fontWeight: 800, letterSpacing: "-0.022em", color: INK }}>{renderTitle(chapter.title_ru)}</h1>
          </div>
          <Ornament />

          {!paras && <div style={{ textAlign: "center", color: INK2, padding: "40px 0", fontSize: 15 }}>Загрузка главы…</div>}
          {paras && paras.length === 0 && <div style={{ textAlign: "center", color: INK2, padding: "40px 0", fontSize: 15 }}>Текст этого раздела готовится.</div>}

          {paras && paras.length > 0 && (
            <div style={{ marginTop: 4 }}>
              {paras.map((p, i) => (
                <ProseBlock key={p.ref || i} text={p.translation ?? ""} fontSize={17.5} lineHeight={1.72} color={INK} top={i === 0 ? 0 : 18} />
              ))}
            </div>
          )}

          {(prev || next) && (
            <div style={{ display: "flex", gap: 10, marginTop: 34 }}>
              {prev ? (
                <Pressable onClick={() => onOpenChapter(prev)} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3, padding: "12px 14px", border: `0.5px solid ${LINE}`, borderRadius: 14, textAlign: "left" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: INK3 }}>Назад</span>
                  <span style={{ fontSize: 13.5, color: INK, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{prev.title_ru}</span>
                </Pressable>
              ) : <span style={{ flex: 1 }} />}
              {next ? (
                <Pressable onClick={() => onOpenChapter(next)} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3, padding: "12px 14px", border: `0.5px solid ${LINE}`, borderRadius: 14, textAlign: "right" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLDT }}>Далее</span>
                  <span style={{ fontSize: 13.5, color: INK, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{next.title_ru}</span>
                </Pressable>
              ) : <span style={{ flex: 1 }} />}
            </div>
          )}
        </div>
      </div>

      <BookMenuSheet open={menu} onClose={() => setMenu(false)} withNote onSelect={(id) => {
        setMenu(false);
        if (id === "note") {
          requestNote({
            kind: "chapter",
            ref: `chapter:${work}/${chapter.id || chapter.number}`,
            title: chapter.title_ru,
            subtitle: `Глава ${chapter.number} · ${bookTitle}`,
            href: `/book/${work}/${chapter.number}`,
          });
          return;
        }
        if (id === "share") { void shareChapter(); return; }
        // «Скачать PDF» из прозовой книги → единый диспетчер книги (onMenuAction).
        if (id === "qr") {
          onQr(`https://gaurangers.com/book/${work}`, { kind: "chapter", bookTitle, chapterNumber: chapter.number, chapterTitle: chapter.title_ru });
          return;
        }
        onMenuAction(id);
      }} anchorRef={moreRef} />
    </div>
  );
}


function VerseReader({ refStr, bookTitle, work = "bg", chapters, hierOrder, onNavigate, onClose, flash, onMenuAction, onQr }: { refStr: string; bookTitle: string; work?: string; chapters: ChapterRow[] | null; hierOrder?: string[] | null; onNavigate: (ref: string) => void; onClose: () => void; flash: (m: string) => void; onMenuAction: (label: string) => void; onQr: (url: string, data: QrData) => void }) {
  const [data, setData] = useState<VerseDetail | null>(null);
  const [error, setError] = useState(false);
  const [vMenu, setVMenu] = useState(false);
  const vMoreRef = useRef<HTMLSpanElement>(null);
  const verseContentRef = useRef<HTMLDivElement>(null);
  const player = usePlayer();

  useEffect(() => {
    let live = true;
    setData(null); setError(false);
    fetch(api(`/books/${work}/verses/${encodeURIComponent(refStr)}`))
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((d) => {
        if (!live) return;
        setData(d as VerseDetail);
        const href = versePathFor(work, d.division, d.ref || refStr);
        recordRead({ work, ref: (d.ref || refStr), label: (d.label ?? refStr), href, kind: "verse" });
        // Глава стиха → позиция в плоском оглавлении (BG); у иерархических chapters нет.
        const dp = (d.division ?? "").split(".").filter(Boolean);                 // ["bg","2"] | ["sb","1","9"]
        const chNo = dp.length >= 2 ? dp[dp.length - 1] : (d.ref || refStr).replace(/^[^\d]*/, "").split(".")[0];
        // hierOrder задан только для иерархических книг → стих относим к его главе по
        // division (он же id главы в оглавлении); у плоских книг — по номеру главы.
        const vIdx = hierOrder
          ? hierOrder.indexOf(d.division || "")
          : (chapters ? chapters.findIndex((c) => String(c.number) === String(chNo)) : -1);
        const vTotal = hierOrder ? hierOrder.length : (chapters ? chapters.length : 0);
        noteRead({
          work,
          ref: (d.ref || refStr),
          label: (d.label ?? refStr),
          href,
          kind: "verse",
          idx: vIdx >= 0 ? vIdx + 1 : 0,
          total: vTotal,
        });
      })
      .catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, [refStr]);

  const demo = DEMO_VERSES[data?.ref ?? refStr];
  const divParts = (data?.division ?? "").split(".").filter(Boolean);      // ["sb","1","9"] | ["cc","adi","7"] | ["bg","2"]
  const refDigits = (data?.ref ?? refStr).replace(/^[^\d]*/, "");           // "1.9.40" | "2.13" | "2.16-17"
  const chapterNo = divParts.length >= 2 ? divParts[divParts.length - 1] : (refDigits.split(".")[0] ?? "");
  const verseSeg = (data?.ref ?? refStr).split(".").pop() ?? "";            // "40" | "13" | "16-17"
  const verseUrl = work !== "bg"
    ? (divParts.length >= 3
        ? `https://gaurangers.com/book/${work}/${divParts[1]}/${divParts[2]}${verseSeg ? `/${verseSeg}` : ""}`
        : `https://gaurangers.com/book/${work}`)
    : `https://gaurangers.com/book/${work}/${chapterNo}${verseSeg ? `/${verseSeg}` : ""}`;
  const ccDiv = (data?.division ?? "").split(".");                 // ["cc","madhya","6"] | ["sb","1","9"]
  const ccLila = work !== "bg" ? (ccDiv[1] || undefined) : undefined;
  const ccChapterNum = work !== "bg" && ccDiv[2] ? Number(ccDiv[2]) : (Number(chapterNo) || 1);
  const chapterTitle = chapters?.find((c) => c.number === chapterNo)?.title_ru;
  const { on: fav, toggle: toggleFav } = useFavorite(`verse:${work}/${refStr}`, { t: data?.label ?? refStr, s: `${chapterTitle ? chapterTitle + " · " : ""}${bookTitle}`, h: verseUrl.replace(/^https?:\/\/[^/]+/, "") });
  const evDeva = data?.devanagari || demo?.devanagari || null;
  const evTranslit = data?.translit || demo?.translit || null;
  const evTokens = (data?.tokens && data.tokens.length ? data.tokens : demo?.tokens) ?? [];
  const evTranslation = data?.translation || demo?.translation || null;
  const evPurport = data?.purport || demo?.purport || null;
  const translationIsDemo = !data?.translation && !!demo?.translation;
  const purportIsDemo = !data?.purport && !!demo?.purport;

  const hasDeva = !!evDeva;
  const hasTranslit = !!evTranslit;
  const hasWW = !!evTokens.length;
  const hasCommentary = !!evPurport;

  const shareVerse = async () => {
    const label = data?.label ?? refStr;
    const url = verseUrl;
    try {
      if (typeof navigator !== "undefined" && (navigator as Navigator).share) {
        await (navigator as Navigator).share({ title: `${label} · ${bookTitle}`, text: `${label} — ${bookTitle}`, url });
        return;
      }
    } catch { /* cancelled */ }
    try { await navigator.clipboard.writeText(url); flash("Ссылка скопирована"); }
    catch { flash(url); }
  };

  return (
    <div style={{ position: "fixed", top: 0, bottom: 0, left: 0, right: 0, margin: "0 auto", width: "100%", maxWidth: 480, zIndex: 80, display: "flex", flexDirection: "column", background: PAPER }}>
      <header style={{ flexShrink: 0, height: 54, display: "flex", alignItems: "center", gap: 1, padding: "0 6px", background: PAPER, borderBottom: `0.5px solid ${LINE}`, zIndex: 3 }}>
        <NavBtn ariaLabel="Закрыть" onClick={onClose}><BackIcon size={22} /></NavBtn>
        <div style={{ flex: 1, minWidth: 0, paddingLeft: 2 }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em", color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{data?.label ?? refStr}</div>
          <div style={{ fontSize: 11, color: INK2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{chapterNo ? `Глава ${chapterNo} · ` : ""}{bookTitle}</div>
        </div>
        <NavBtn ariaLabel="В избранное" onClick={() => toggleFav(flash)} size={36}><span style={{ display: "inline-flex", color: fav ? "#FF3B30" : INK }}><HeartIcon size={18} filled={fav} /></span></NavBtn>
        <NavBtn ariaLabel="Слушать" onClick={() => { if (!AUDIO_WORKS[work]) { flash("Аудиокнига — скоро"); return; } work === "bg" ? player.playChapter(work, Number(chapterNo) || 1, "commentary") : player.playChapter(work, ccChapterNum, "plain", ccLila); }} size={36}><HeadphonesIcon size={18} /></NavBtn>
        <span ref={vMoreRef} style={{ display: "inline-flex" }}><NavBtn ariaLabel="Ещё" onClick={() => setVMenu(true)} size={36}><MoreIcon size={16} /></NavBtn></span>
      </header>

      <div style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        <div ref={verseContentRef} style={{ margin: "0 auto", padding: "22px 20px 40px" }}>
          {!data && !error && <div style={{ textAlign: "center", color: INK2, padding: "40px 0", fontSize: 15 }}>Загрузка стиха…</div>}
          {error && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <p style={{ fontSize: 15, color: INK2 }}>Не удалось загрузить стих.</p>
              <button onClick={onClose} style={{ marginTop: 8, height: 40, padding: "0 18px", borderRadius: 12, border: "none", background: FILL, color: INK, cursor: "pointer", fontSize: 15 }}>К содержанию</button>
            </div>
          )}
          {data && (
            <>
              {hasDeva && (
                <div style={{ fontFamily: "var(--font-deva, 'Noto Serif Devanagari', var(--font-text))", fontSize: 19, lineHeight: 1.6, textAlign: "center", color: INK, whiteSpace: "pre-line", marginBottom: hasTranslit ? 16 : 22 }}>{scriptLines(evDeva)}</div>
              )}
              {hasTranslit && (
                <div style={{ marginBottom: 16 }}>
                  {evTranslit!.split("\n").map((ln, i) => (
                    <div key={i} style={{ fontStyle: "italic", fontSize: 15, lineHeight: 1.45, letterSpacing: "-0.01em", textAlign: "center", textWrap: "balance", color: INK2, marginTop: i === 0 ? 0 : 7 }}>{ln}</div>
                  ))}
                </div>
              )}
              {(hasDeva || hasTranslit) && <Ornament />}

              {hasWW && (
                <section style={{ marginBottom: 30 }}>
                  <LayerLabel>Пословный перевод</LayerLabel>
                  <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.95, color: INK2 }}>
                    {evTokens.map((t, i) => (
                      <span key={i}>
                        <span style={{ fontStyle: "italic", color: INK }}>{t.term}</span>
                        {t.gloss ? ` — ${t.gloss}` : ""}{i < evTokens.length - 1 ? "; " : "."}
                      </span>
                    ))}
                  </p>
                </section>
              )}

              <section style={{ marginBottom: hasCommentary ? 30 : 8 }}>
                <LayerLabel>Перевод{translationIsDemo && <DemoBadge />}</LayerLabel>
                {evTranslation ? (
                  <div style={{ paddingLeft: 18, borderLeft: `2px solid ${GOLD}` }}>
                    <p style={{ margin: 0, fontSize: 20, lineHeight: 1.5, fontWeight: 500, letterSpacing: "-0.01em", color: INK }}>{evTranslation}</p>
                  </div>
                ) : (
                  <div style={{ paddingLeft: 18, borderLeft: `2px solid ${LINE}` }}>
                    <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: INK2 }}>Перевод этого стиха готовится.</p>
                  </div>
                )}
              </section>

              {hasCommentary && (
                <section style={{ marginBottom: 8 }}>
                  <CommentaryLabel demo={purportIsDemo} />
                  <div style={{ fontSize: 17, lineHeight: 1.8, color: INK }}>
                    {evPurport!.split(/\n\n+/).map((para, i) => (
                      <p key={i} style={{ margin: i === 0 ? 0 : "14px 0 0" }}>{renderTerms(para)}</p>
                    ))}
                  </div>
                </section>
              )}

              {(translationIsDemo || purportIsDemo) && (
                <div style={{ marginTop: 26, paddingTop: 16, borderTop: `0.5px solid ${LINE}`, fontSize: 12, lineHeight: 1.5, color: INK3 }}>
                  Санскрит и транслитерация — общественное достояние. Перевод и комментарий помечены «демо»: это демонстрационный текст прототипа; он будет заменён лицензированным текстом издания.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <nav style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px calc(8px + env(safe-area-inset-bottom))", background: PAPER, borderTop: `0.5px solid ${LINE}` }}>
        <NavAction arrow="prev" disabled={!data?.prev} onClick={() => data?.prev && onNavigate(data.prev)}>Назад</NavAction>
        <NavAction onClick={onClose}>К главе</NavAction>
        <NavAction arrow="next" disabled={!data?.next} onClick={() => data?.next && onNavigate(data.next)}>Вперёд</NavAction>
      </nav>

      <BookMenuSheet open={vMenu} onClose={() => setVMenu(false)} withNote onSelect={(id) => {
        setVMenu(false);
        if (id === "note") {
          requestNote({
            kind: "verse",
            ref: `verse:${work}/${refStr}`,
            title: data?.label ?? refStr,
            subtitle: `${chapterTitle ? chapterTitle + " · " : ""}${bookTitle}`,
            href: verseUrl.replace(/^https?:\/\/[^/]+/, ""),
          });
          return;
        }
        if (id === "share") { void shareVerse(); return; }
        if (id === "pdf") {
          const label = data?.label ?? refStr;
          const vref = data?.ref ?? refStr;
          const isCc = work !== "bg";
          const lilaLab = ccLilaLabel(ccLila ?? "");
          const vfile = isCc
            ? `Шри Чайтанья-чаритамрита. ${lilaLab}. Глава ${ccChapterNum}${verseSeg ? `. Стих ${verseSeg}` : ""}.pdf`
            : `Бхагавад-гита как она есть. Глава ${chapterNo}${verseSeg ? `. Стих ${verseSeg}` : ""}.pdf`;
          const sub = isCc
            ? `${lilaLab} · Глава ${ccChapterNum} · ${bookTitle}`
            : `${chapterNo ? "Глава " + chapterNo + " · " : ""}${bookTitle}`;
          void downloadServerPdf(
            `/pdf?kind=verse&work=${encodeURIComponent(work)}&ref=${encodeURIComponent(vref)}`,
            vfile,
            { onStatus: flash, fallback: () => exportToPdf(verseContentRef.current, { title: `${label} · ${bookTitle}`, heading: label, subheading: sub }) },
          );
          return;
        }
        if (id === "qr") {
          onQr(verseUrl, {
            kind: "verse",
            bookTitle,
            chapterNumber: chapterNo,
            chapterTitle,
            verseLabel: data?.label ?? refStr,
            verseText: evTranslation,
          });
          return;
        }
        onMenuAction(id);
      }} anchorRef={vMoreRef} />
    </div>
  );
}

/* ───────── round action over hero (adapts to scroll) ───────── */
function TopBtn({ solid, active, activeColor, ariaLabel, onClick, children }: { solid: boolean; active?: boolean; activeColor?: string; ariaLabel: string; onClick: () => void; children: ReactNode }) {
  const [pressed, setPressed] = useState(false);
  const off = () => setPressed(false);
  const onPhoto = !solid;
  return (
    <button type="button" aria-label={ariaLabel} aria-pressed={active} onClick={onClick}
      onPointerDown={() => setPressed(true)} onPointerUp={off} onPointerLeave={off} onPointerCancel={off}
      style={{ display: "grid", height: 36, width: 36, placeItems: "center", borderRadius: "50%", border: "none", cursor: "pointer",
        background: onPhoto ? "rgba(0,0,0,.42)" : (pressed ? FILL : "transparent"),
        color: active && activeColor ? activeColor : (onPhoto ? "#fff" : INK),
        backdropFilter: onPhoto ? "blur(12px)" : "none", WebkitBackdropFilter: onPhoto ? "blur(12px)" : "none",
        transition: "background .15s", WebkitTapHighlightColor: "transparent" }}>
      {children}
    </button>
  );
}

/* ═════════ MAIN ═════════ */
export function BookDetailPage({ book, onBack, onDonate, onOpenCart, initialTarget }: { book: BookData; onBack: () => void; onDonate: () => void; onOpenCart: () => void; initialTarget?: { div?: string | null; chapter: string | null; verse: string | null } | null }) {
  const [idx, setIdx] = useState(0);
  const [favorited, setFavorited] = useState(false);
  const [inCart, setInCart] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [tab, setTab] = useState<BookTabId>("contents");
  // Смена Tier-1 таба → если прокручено вглубь, подтянуть так, чтобы липкие табы
  // сели под шапку (52px), а контент таба начался с верха. Если уже у верха —
  // ничего не двигаем (контент и так свежий). Первый монтаж пропускаем.
  const bookTabReady = useRef(false);
  useLayoutEffect(() => {
    if (!bookTabReady.current) { bookTabReady.current = true; return; }
    const main = document.querySelector("main") as HTMLElement | null;
    const nav = document.querySelector('[aria-label="Разделы книги"]') as HTMLElement | null;
    if (!main || !nav) return;
    let y = 0; let node: HTMLElement | null = nav;
    while (node && node !== main) { y += node.offsetTop; node = node.offsetParent as HTMLElement | null; }
    const pinned = Math.max(0, y - 52);
    if (main.scrollTop > pinned) main.scrollTo({ top: pinned, behavior: "auto" });
  }, [tab]);
  const [chapters, setChapters] = useState<ChapterRow[] | null>(null);
  const [hierOrder, setHierOrder] = useState<string[] | null>(null); // главы ЧЧ/ШБ в порядке чтения → процент прогресса
  const [openChapter, setOpenChapter] = useState<ChapterRow | null>(null);
  const [readerRef, setReaderRef] = useState<string | null>(null);
  const bookContentRef = useRef<HTMLDivElement>(null);
  const bookPrintRef = useRef<HTMLDivElement>(null);
  const [bookPrint, setBookPrint] = useState<{ chapters: ChapterRow[]; versesByCh: Record<string, ChapterVerse[]> } | null>(null);
  const [bookPct, setBookPct] = useState(0);
  const [bookPctTitle, setBookPctTitle] = useState("Готовлю PDF книги");
  const [pdfHidden, setPdfHidden] = useState(false);
  const pdfCancel = useRef(false);
  const pdfAbort = useRef<AbortController | null>(null);
  const [qr, setQr] = useState<{ url: string; data: QrData } | null>(null);
  const openQr = (url: string, data: QrData) => setQr({ url, data });
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    if (book.hierarchical) return; // иерархические книги (ЧЧ/ШБ) — оглавление через CcContents (/toc)
    fetch(api(`/books/${book.work}/chapters`)).then((r) => r.json()).then((d) => setChapters(d.chapters ?? [])).catch(() => {});
  }, [book.work, book.hierarchical]);

  // Для иерархических книг — плоский список id глав в порядке чтения (divisions.ordinal):
  // даёт процент прогресса так же, как chapters.length у плоских книг. Грузим всегда
  // (а не только при открытом «Содержании»), чтобы процент был и при прямом входе на стих.
  useEffect(() => {
    if (!book.hierarchical) { setHierOrder(null); return; }
    let live = true;
    setHierOrder(null);
    fetch(api(`/books/${book.work}/toc`))
      .then((r) => r.json())
      .then((d: { divisions?: { chapters?: { id: string }[] }[] }) => {
        if (!live || !d?.divisions) return;
        setHierOrder(d.divisions.flatMap((dv) => (dv.chapters ?? []).map((c) => c.id)));
      })
      .catch(() => {});
    return () => { live = false; };
  }, [book.work, book.hierarchical]);

  // Открыть цель (глава + стих) — для холодного входа по ссылке, QR и кнопок назад/вперёд.
  // navLock не даёт эффекту состояние→URL пушить адрес во время синхронизации ИЗ URL.
  const navLock = useRef(false);
  const openTarget = useRef<(div: string | null, chapter: string | null, verse: string | null) => void>(() => {});
  openTarget.current = (div, chapter, verse) => {
    if (book.hierarchical) {
      // ЧЧ/ШБ: лила/песнь → глава → стих, через /toc и /division/<id>/read
      navLock.current = true;
      if (!chapter) { setOpenChapter(null); setReaderRef(null); navLock.current = false; return; }
      fetch(api(`/books/${book.work}/toc`))
        .then((r) => r.json())
        .then((d: CcToc) => {
          const divs = d?.divisions ?? [];
          const dv = divs.find((x) => x.id.split(".").pop() === div || x.slug === div) ?? null;
          const c = dv?.chapters.find((x) => x.number === chapter) ?? null;
          if (!c) { setOpenChapter(null); setReaderRef(null); navLock.current = false; return; }
          setOpenChapter({ id: c.id, number: c.number, title_ru: c.title_ru, title_en: "", source_url: "", verses: c.verses });
          if (verse) {
            fetch(api(`/books/${book.work}/division/${c.id}/read`))
              .then((r) => r.json())
              .then((rd) => {
                const vs = (rd.verses ?? []) as ChapterVerse[];
                const want = verse.replace(/[–—]/g, "-");
                const hit = vs.find((vv) => (String(vv.ref).split(".").pop() ?? "").replace(/[–—]/g, "-") === want);
                setReaderRef(hit ? hit.ref : null);
              })
              .catch(() => {})
              .finally(() => { navLock.current = false; });
          } else { setReaderRef(null); navLock.current = false; }
        })
        .catch(() => { navLock.current = false; });
      return;
    }
    if (!chapters) return;
    navLock.current = true;
    if (!chapter) { setOpenChapter(null); setReaderRef(null); navLock.current = false; return; }
    const ch = chapters.find((x) => x.number === chapter) ?? null;
    setOpenChapter(ch);
    if (ch && verse) {
      fetch(api(`/books/${book.work}/chapters/${chapter}/read`))
        .then((r) => r.json())
        .then((d) => {
          const vs = (d.verses ?? []) as ChapterVerse[];
          const want = verse.replace(/[–—]/g, "-");
          const hit = vs.find((vv) => (String(vv.ref).split(".").pop() ?? "").replace(/[–—]/g, "-") === want);
          setReaderRef(hit ? hit.ref : null);
        })
        .catch(() => {})
        .finally(() => { navLock.current = false; });
    } else {
      setReaderRef(null);
      navLock.current = false;
    }
  };

  // Холодный вход /book/<work>/… (в т.ч. из QR) → открыть цель один раз.
  // ПКП (bg) ждёт загрузки оглавления; иерархические тянут TOC внутри openTarget.
  const didInitTarget = useRef(false);
  useEffect(() => {
    if (didInitTarget.current) return;
    if (!book.hierarchical && !chapters) return;
    if (initialTarget?.chapter) {
      didInitTarget.current = true;
      openTarget.current(initialTarget.div ?? null, initialTarget.chapter, initialTarget.verse);
    }
  }, [chapters, initialTarget, book.hierarchical]);

  // Состояние → URL: уникальный адрес для каждой главы/стиха.
  //   ПКП:           /book/<work>/{ch}, /book/<work>/{ch}/{v}
  //   иерархические: /book/<work>/{lila}/{ch}, /book/<work>/{lila}/{ch}/{v}
  // Прыжок стих↔стих → replace (чтобы «назад» от стиха вёл к ГЛАВЕ, не к соседнему стиху).
  useEffect(() => {
    if (navLock.current || typeof window === "undefined") return;
    if (book.hierarchical) {
      const base = `/book/${book.work}`;
      let path = base;
      if (readerRef) {
        const pr = readerRef.split(".");                 // ["cc","madhya","6","140"]
        path = pr.length >= 4
          ? `${base}/${pr[1]}/${pr[2]}/${pr[3]}`
          : (openChapter ? `${base}/${openChapter.id.split(".")[1]}/${openChapter.number}` : base);
      } else if (openChapter) {
        path = `${base}/${openChapter.id.split(".")[1]}/${openChapter.number}`;
      }
      const cur = window.location.pathname;
      if (cur === path) return;
      const isVerse = (p: string) => /^\/book\/[a-z0-9]+\/[a-z0-9]+\/\d+\/.+/i.test(p);
      if (isVerse(cur) && isVerse(path)) replaceUrl(path);
      else pushUrl(path);
      return;
    }
    if (!chapters) return;
    const base = `/book/${book.work}`;
    let path = base;
    if (readerRef) {
      const rd = readerRef.replace(/^[^\d]*/, "");
      const ch = rd.split(".")[0];
      const v = rd.includes(".") ? rd.slice(rd.indexOf(".") + 1) : "";
      path = v ? `${base}/${ch}/${v}` : `${base}/${ch}`;
    } else if (openChapter) {
      path = `${base}/${openChapter.number}`;
    }
    const cur = window.location.pathname;
    if (cur === path) return;
    const isVerse = (p: string) => new RegExp(`^/book/${book.work}/\\d+/.+`).test(p);
    if (isVerse(cur) && isVerse(path)) replaceUrl(path);
    else pushUrl(path);
  }, [openChapter, readerRef, chapters, book.hierarchical, book.work, book.prose]);

  // Единая кнопка «назад» внутри книги: стих → глава → книга → откуда пришли.
  // Обычный случай — pop общего стека (canGoBack). На холодном входе (прямой
  // URL/QR, под нами нет записи приложения) спускаемся на уровень вручную через replace.
  const goBack = () => {
    if (typeof window === "undefined") return;
    if (canGoBack()) { window.history.back(); return; }
    const base = `/book/${book.work}`;
    if (book.hierarchical) {
      if (readerRef) { setReaderRef(null); replaceUrl(openChapter ? `${base}/${openChapter.id.split(".")[1]}/${openChapter.number}` : base); return; }
      if (openChapter) { setOpenChapter(null); replaceUrl(base); return; }
      onBack(); return;
    }
    if (readerRef) { setReaderRef(null); replaceUrl(openChapter ? `${base}/${openChapter.number}` : base); return; }
    if (openChapter) { setOpenChapter(null); replaceUrl(base); return; }
    onBack();
  };

  // URL → состояние при «назад/вперёд» браузера (в пределах книги).
  useEffect(() => {
    const onPop = () => {
      const base = `/book/${book.work}`;
      const path = window.location.pathname;
      if (!path.startsWith(base)) return;
      if (book.prose) return; // прозовые книги не используют глубоких URL глав
      const parts = path.split("/");        // ["", "book", work, a?, b?, c?]
      if (book.hierarchical) openTarget.current(parts[3] || null, parts[4] || null, parts[5] || null);
      else openTarget.current(null, parts[3] || null, parts[4] || null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [book.hierarchical, book.work]);

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

  useEffect(() => {
    if (bookPrint) {
      const name = bookFullTitle(book);
      pdfCancel.current = false;
      setPdfHidden(false);
      const ac = new AbortController();
      pdfAbort.current = ac;
      void downloadServerPdf(`/pdf?kind=book&work=${encodeURIComponent(book.work)}&v=${PDF_CACHE_REV}`, `${name}.pdf`, { onStatus: flash, onProgress: setBookPct, signal: ac.signal, fallback: () => { if (bookPrintRef.current) exportToPdf(bookPrintRef.current, { title: name }); } })
        .finally(() => { pdfAbort.current = null; });
      setBookPrint(null);
    }
  }, [bookPrint, book.titleLine1, book.titleLine2]);

  const buildBookPdf = async () => {
    if (!chapters || chapters.length === 0) { flash("Книга ещё загружается…"); return; }
    flash("Готовлю PDF всей книги…");
    try {
      const entries = await Promise.all(
        chapters.map(async (c) => {
          const r = await fetch(api(`/books/${book.work}/chapters/${c.number}/read`));
          const d = await r.json();
          return [c.number, (d.verses ?? []) as ChapterVerse[]] as const;
        }),
      );
      const versesByCh: Record<string, ChapterVerse[]> = {};
      for (const [num, vs] of entries) versesByCh[num] = vs;
      setBookPrint({ chapters, versesByCh });
    } catch {
      flash("Не удалось собрать книгу");
    }
  };

  // ЧЧ: книга слишком велика для одного PDF — несколько файлов по лилам (большие
  // режутся по объёму), серверный рендер с клиентским запасным путём. Единый
  // источник с лентой (ВКП) — см. downloadCcBookPdf.
  const downloadCcBook = async () => {
    setPdfHidden(false);
    await downloadCcBookPdf({
      work: book.work, book, bookTitle: bookShareTitle(book),
      onStatus: flash, onProgress: setBookPct, onTitle: setBookPctTitle,
      cancelRef: pdfCancel, abortRef: pdfAbort,
    });
    setPdfHidden(false);
  };
  const cancelPdf = () => { pdfCancel.current = true; pdfAbort.current?.abort(); setBookPct(0); setPdfHidden(false); };

  const shareBook = async () => {
    const url = typeof window !== "undefined" ? window.location.href : `https://gaurangers.com/book/${book.slug}`;
    const payload = { title: bookShareTitle(book), text: book.description, url };
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

  const menuAction = (id: string) => {
    setMoreOpen(false);
    if (id === "note") {
      requestNote({ kind: "book", ref: `book:${book.work}`, title: bookFullTitle(book), subtitle: book.tagline, href: `/book/${book.work}` });
      return;
    }
    if (id === "share") { void shareBook(); return; }
    if (id === "pdf") { void downloadBookPdf({ work: book.work, book, onStatus: flash, onProgress: setBookPct, onTitle: setBookPctTitle, cancelRef: pdfCancel, abortRef: pdfAbort }); return; }
    if (id === "qr") {
      openQr(`https://gaurangers.com/book/${book.work}`, {
        kind: "book",
        bookTitle: bookFullTitle(book),
        tagline: book.tagline,
        cover: book.covers[0],
      });
      return;
    }
    if (id === "order") { const p = bookProduct(book.work); if (p) addToCart(p); onOpenCart(); return; }
    if (id === "donate") { onDonate(); return; }
    if (id === "report") { setReportOpen(true); return; }
  };

  return (
    <div style={{ position: "relative", minHeight: "100%", background: PAPER, paddingBottom: "calc(env(safe-area-inset-bottom,0px) + 32px)" }}>
      {/* scroll-aware top bar — persistent back; all actions live in the card below */}
      <header style={{ position: "sticky", top: 0, zIndex: 30, height: 52, display: "flex", alignItems: "center", gap: 4, padding: "0 14px", transition: "background .2s, border-color .2s", background: scrolled ? "rgba(255,255,255,0.82)" : "transparent", backdropFilter: scrolled ? "blur(40px) saturate(180%)" : "none", WebkitBackdropFilter: scrolled ? "blur(40px) saturate(180%)" : "none", borderBottom: "0.5px solid transparent" }}>
        <button type="button" aria-label="Назад" onClick={onBack} style={{ display: "grid", height: 38, width: 38, placeItems: "center", borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.05)", color: INK, cursor: "pointer", flexShrink: 0 }}><BackIcon size={22} /></button>
        {scrolled && <div style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em", color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{bookFullTitle(book)}</div>}
      </header>

      <div ref={bookContentRef}>
        {/* HERO — the SAME card module as the feed (ВКП); single source from books.ts */}
        <div style={{ padding: "2px 16px 6px" }}>
          <BookHeroCard book={book} topLeft={<LogoMark src="/bbt.svg" label="The Bhaktivedanta Book Trust" height={26} color="#fff" />} flash={flash} onMenuSelect={menuAction} canOrder={!!bookProduct(book.work)} onListen={AUDIO_WORKS[book.work] ? undefined : () => flash("Аудиокнига — скоро")} />
        </div>

        <BookTabs active={tab} onChange={(id) => setTab(id)} tabs={BOOK_TABS.filter((t) => t.id !== "reviews" || REVIEWED_WORKS.has(book.work))} />

        <div>
          {tab === "contents" && (book.hierarchical
            ? <CcContents work={book.work} onOpenChapter={setOpenChapter} />
            : <Contents chapters={chapters} onOpenChapter={setOpenChapter} prose={book.prose} />)}
          {tab === "overview" && (book.work === "brs" ? <NodOverview book={book} /> : book.work === "sb" ? <SbOverview book={book} /> : book.work === "cc" ? <CcOverview book={book} /> : book.work === "bg" ? <Overview book={book} /> : <GenericOverview book={book} />)}
          {tab === "author" && (book.work === "spl" ? <SplAuthor /> : <Author />)}
          {tab === "reviews" && REVIEWED_WORKS.has(book.work) && (book.work === "brs" ? <NodReviews /> : book.work === "sb" ? <SbReviews /> : book.work === "cc" ? <CcReviews /> : <Reviews />)}
        </div>
      </div>

      <Toast msg={toast} />
      {bookPct > 0 && !pdfHidden && (
        <div style={{ position: "fixed", inset: 0, zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.45)" }}>
          <div style={{ position: "relative", width: 300, maxWidth: "calc(100% - 48px)", background: "#fff", borderRadius: 20, padding: "26px 22px 20px", boxShadow: "0 20px 60px rgba(0,0,0,0.35)", fontFamily: "var(--font-text)", textAlign: "center" }}>
            <button type="button" aria-label="Отменить загрузку" onClick={cancelPdf} style={{ position: "absolute", top: 12, right: 12, width: 28, height: 28, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.06)", color: "#6e6e73", cursor: "pointer", display: "grid", placeItems: "center", fontSize: 18, lineHeight: 1, WebkitTapHighlightColor: "transparent" }}>×</button>
            <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3, letterSpacing: "-0.01em", color: "#1d1d1f", padding: "0 8px", textWrap: "balance" }}>{bookPctTitle}</div>
            <div style={{ fontSize: 12.5, color: "#8e8e93", marginTop: 5 }}>Это может занять 1–2 минуты</div>
            <div style={{ marginTop: 16, height: 8, borderRadius: 999, background: "#ececed", overflow: "hidden" }}>
              <div style={{ width: `${bookPct}%`, height: "100%", background: "#D2AA1B", borderRadius: 999, transition: "width 0.4s ease" }} />
            </div>
            <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: "#9c7c15" }}>{bookPct}%</div>
            <button type="button" onClick={() => setPdfHidden(true)} style={{ marginTop: 14, width: "100%", padding: "10px 0", borderRadius: 12, border: "none", background: "#f2f2f7", color: "#1d1d1f", fontFamily: "var(--font-text)", fontSize: 14, fontWeight: 600, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>Свернуть</button>
          </div>
        </div>
      )}
      {bookPct > 0 && pdfHidden && (
        <button type="button" onClick={() => setPdfHidden(false)} style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: "calc(84px + env(safe-area-inset-bottom))", zIndex: 3000, display: "flex", alignItems: "center", gap: 9, padding: "9px 14px", borderRadius: 999, border: "none", background: "#1d1d1f", color: "#fff", fontFamily: "var(--font-text)", fontSize: 13, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.3)", cursor: "pointer", maxWidth: "86vw", WebkitTapHighlightColor: "transparent" }}>
          <span aria-hidden style={{ width: 8, height: 8, borderRadius: "50%", background: "#D2AA1B", flexShrink: 0 }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bookPctTitle} · {bookPct}%</span>
        </button>
      )}
      {openChapter && (book.prose
        ? <ProseChapterPage chapter={openChapter} chapters={chapters} bookTitle={bookFullTitle(book)} work={book.work} onBack={goBack} onMenuAction={menuAction} onQr={openQr} flash={flash} onOpenChapter={setOpenChapter} />
        : <ChapterPage chapter={openChapter} chapters={chapters} hierOrder={hierOrder} bookTitle={bookFullTitle(book)} work={book.work} hierarchical={!!book.hierarchical} onOpenVerse={(ref) => setReaderRef(ref)} onBack={goBack} onMenuAction={menuAction} onQr={openQr} flash={flash} />)}
      {readerRef && <VerseReader key={readerRef} refStr={readerRef} bookTitle={bookFullTitle(book)} work={book.work} chapters={chapters} hierOrder={hierOrder} onNavigate={setReaderRef} onClose={goBack} flash={flash} onMenuAction={menuAction} onQr={openQr} />}
      {bookPrint && (
        <div ref={bookPrintRef} aria-hidden style={{ position: "fixed", left: -10000, top: 0, width: 760 }}>
          <BookPrint book={book} chapters={bookPrint.chapters} versesByCh={bookPrint.versesByCh} />
        </div>
      )}
      {qr && <QrSheet url={qr.url} data={qr.data} onClose={() => setQr(null)} />}
      <ReportSheet open={reportOpen} onClose={() => setReportOpen(false)} context={readerRef ? readerRef : openChapter ? `${bookFullTitle(book)}, глава ${openChapter.number}` : bookFullTitle(book)} />
    </div>
  );
}
