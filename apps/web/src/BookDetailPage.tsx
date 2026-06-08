/**
 * BookDetailPage (ПКП) — единая дизайн-система книги.
 * Язык: один белый холст (без grouped-карточек и серого фона), графитовый
 * текст, структура держится на хейрлайнах и воздухе; золото #D2AA1B —
 * только тонкие вставки (подчёркивание активной вкладки, орнамент, метки
 * «Текст N»/«Глава N», 2px-линейка у перевода и цитаты, таймлайн автора).
 * Палитра фиксированная (white/graphite/gold), не зависит от темы ОС.
 * Данные книги — books.ts; стихи — API (/chapters/:n/read, /verses/:ref).
 */
import { useEffect, useRef, useState } from "react";
import type { SVGProps, ReactNode, CSSProperties } from "react";
import type { BookData } from "./books";
import { BOOK_MENU_ITEMS, bookShareTitle } from "./books";
import { api } from "./api";
import { DEMO_VERSES, DEMO_REFS } from "./demo";
import { BackIcon, HeartIcon, MoreIcon, ShareIcon, HeadphonesIcon } from "./ui/icons";
import { BookHeroCard } from "./BookHeroCard";
import { usePlayer } from "./player/store";
import { BookMenuSheet } from "./BookMenuSheet";
import { exportToPdf, downloadServerPdf } from "./pdf";
import { QrSheet, type QrData } from "./QrSheet";
import { ReportSheet } from "./ReportSheet";

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
const BOOK_TABS: { id: BookTabId; label: string }[] = [
  { id: "contents", label: "Содержание" },
  { id: "overview", label: "О книге" },
  { id: "author", label: "Автор" },
  { id: "reviews", label: "Рецензии" },
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
    <nav data-pdf-no-print aria-label="Разделы книги" style={{ position: "sticky", top: 52, zIndex: 20, background: "rgba(255,255,255,0.82)", backdropFilter: "blur(40px) saturate(180%)", WebkitBackdropFilter: "blur(40px) saturate(180%)", borderBottom: `0.5px solid ${LINE}` }}>
      <div ref={containerRef} style={{ display: "flex", alignItems: "center", overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
        {BOOK_TABS.map((t) => {
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
          «Гита» входит в «Бхишма-парву» «Махабхараты» и с древности комментировалась всеми крупнейшими школами ведической философии — Шанкарой, Рамануджей, Мадхвой. Подход «как она есть» означает передачу текста без отклонений от замысла Кришны, в неразрывной линии духовных учителей (парампаре).
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

/* ───────── Содержание (flat rows on white) ───────── */
export interface ChapterRow { id: string; number: string; title_ru: string; title_en: string; source_url: string; verses: number; }
function Contents({ chapters, onOpenChapter }: { chapters: ChapterRow[] | null; onOpenChapter: (ch: ChapterRow) => void }) {
  return (
    <div style={{ padding: "24px 20px 12px" }}>
      <SectionTitle>{chapters ? `${chapters.length} глав` : "Содержание"}</SectionTitle>
      {!chapters && <div style={{ fontSize: 15, color: INK2 }}>Загрузка оглавления…</div>}
      {chapters && (
        <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {chapters.map((c, i) => (
            <li key={c.id} style={{ position: "relative" }}>
              <Pressable onClick={() => onOpenChapter(c)} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 0" }}>
                <span style={{ flexShrink: 0, width: 22, textAlign: "center", fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: GOLDT }}>{c.number}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 16, lineHeight: 1.3, fontWeight: 500, color: INK }}>{c.title_ru}</span>
                  <span style={{ display: "block", marginTop: 2, fontSize: 13, color: INK3 }}>{c.verses} стихов</span>
                </span>
                <span style={{ color: INK3 }}><ChevronIcon size={17} /></span>
              </Pressable>
              {i < chapters.length - 1 && <span aria-hidden style={{ position: "absolute", left: 38, right: 0, bottom: 0, height: 0.5, background: LINE }} />}
            </li>
          ))}
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
  useEffect(() => {
    let live = true;
    setToc(null); setErr(false);
    fetch(api(`/books/${work}/toc`))
      .then((r) => r.json())
      .then((d) => { if (live) { if (d?.divisions) setToc(d as CcToc); else setErr(true); } })
      .catch(() => { if (live) setErr(true); });
    return () => { live = false; };
  }, [work]);
  const totalCh = toc ? toc.divisions.reduce((a, d) => a + d.chapters.length, 0) : 0;
  return (
    <div style={{ padding: "24px 20px 12px" }}>
      <SectionTitle>{toc ? `${toc.divisions.length} части · ${totalCh} глав` : "Содержание"}</SectionTitle>
      {!toc && !err && <div style={{ fontSize: 15, color: INK2 }}>Загрузка оглавления…</div>}
      {err && <div style={{ fontSize: 15, color: INK2 }}>Не удалось загрузить оглавление.</div>}
      {toc && toc.divisions.map((d) => (
        <section key={d.id} style={{ marginTop: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.2px", color: INK, margin: "4px 0 2px" }}>{d.title_ru}</div>
          <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {d.chapters.map((c, i) => (
              <li key={c.id} style={{ position: "relative" }}>
                <Pressable onClick={() => onOpenChapter({ id: c.id, number: c.number, title_ru: c.title_ru, title_en: "", source_url: "", verses: c.verses })} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 0" }}>
                  <span style={{ flexShrink: 0, width: 22, textAlign: "center", fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: GOLDT }}>{c.number}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 16, lineHeight: 1.3, fontWeight: 500, color: INK }}>{c.title_ru && !/глава/i.test(c.title_ru) ? c.title_ru : `Глава ${c.number}`}</span>
                    <span style={{ display: "block", marginTop: 2, fontSize: 13, color: INK3 }}>{c.verses} стихов</span>
                  </span>
                  <span style={{ color: INK3 }}><ChevronIcon size={17} /></span>
                </Pressable>
                {i < d.chapters.length - 1 && <span aria-hidden style={{ position: "absolute", left: 38, right: 0, bottom: 0, height: 0.5, background: LINE }} />}
              </li>
            ))}
          </ol>
        </section>
      ))}
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
function ChapterPage({ chapter, bookTitle, work = "bg", hierarchical = false, onOpenVerse, onBack, onMenuAction, onQr, flash }: { chapter: ChapterRow; bookTitle: string; work?: string; hierarchical?: boolean; onOpenVerse: (ref: string) => void; onBack: () => void; onMenuAction: (id: string) => void; onQr: (url: string, data: QrData) => void; flash: (m: string) => void }) {
  const [verses, setVerses] = useState<ChapterVerse[] | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [menu, setMenu] = useState(false);
  const [fav, setFav] = useState(false);
  const [printing, setPrinting] = useState(false);
  const moreRef = useRef<HTMLSpanElement>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const player = usePlayer();

  useEffect(() => {
    if (printing && !hierarchical) {
      void downloadServerPdf(
        `/pdf?kind=chapter&n=${encodeURIComponent(chapter.number)}`,
        `Бхагавад-гита как она есть. Глава ${chapter.number}.pdf`,
        { onStatus: flash, fallback: () => { if (printRef.current) exportToPdf(printRef.current, { title: `${chapter.title_ru} · ${bookTitle}` }); } },
      );
      setPrinting(false);
    }
  }, [printing, chapter.number, chapter.title_ru, bookTitle]);

  useEffect(() => {
    let live = true;
    setVerses(null);
    const readUrl = hierarchical
      ? api(`/books/${work}/division/${chapter.id}/read`)
      : api(`/books/${work}/chapters/${chapter.number}/read`);
    fetch(readUrl)
      .then((r) => r.json())
      .then((d) => { if (live) setVerses(d.verses ?? []); })
      .catch(() => { if (live) setVerses([]); });
    return () => { live = false; };
  }, [chapter.id, chapter.number, work, hierarchical]);

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
          <div style={{ fontSize: 15.5, fontWeight: 700, letterSpacing: "-0.01em", color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", padding: "0 4px" }}>{chapter.title_ru}</div>
          <div style={{ fontSize: 11, color: INK2 }}>Глава {chapter.number} · {bookTitle}</div>
        </div>
        <NavBtn ariaLabel="В избранное" onClick={() => { const nv = !fav; setFav(nv); flash(nv ? "Глава добавлена в избранное" : "Глава убрана из избранного"); }} size={36}><span style={{ display: "inline-flex", color: fav ? "#FF3B30" : INK }}><HeartIcon size={18} filled={fav} /></span></NavBtn>
        {!hierarchical && <NavBtn ariaLabel="Слушать" onClick={() => player.playChapter(work, Number(chapter.number) || 1, "plain")} size={36}><HeadphonesIcon size={18} /></NavBtn>}
        <span ref={moreRef} style={{ display: "inline-flex" }}><NavBtn ariaLabel="Ещё" onClick={() => setMenu(true)} size={36}><MoreIcon size={16} /></NavBtn></span>
      </header>

      <div onScroll={(e) => setCollapsed((e.target as HTMLDivElement).scrollTop > 56)}
        style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        <div style={{ margin: "0 auto", padding: "16px 22px calc(40px + env(safe-area-inset-bottom))" }}>
          <div style={{ textAlign: "center", marginBottom: 2 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: GOLDT, marginBottom: 12 }}>Глава {chapter.number}</div>
            <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.1, fontWeight: 800, letterSpacing: "-0.025em", color: INK }}>{chapter.title_ru}</h1>
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

      <BookMenuSheet open={menu} onClose={() => setMenu(false)} onSelect={(id) => {
        setMenu(false);
        if (id === "share") { void shareChapter(); return; }
        if (id === "pdf") {
          if (hierarchical) { flash("PDF этой книги готовится"); return; }
          if (verses && verses.length) setPrinting(true);
          else flash("Глава ещё загружается…");
          return;
        }
        if (id === "qr") {
          onQr(`https://gaurangers.com/book/${work}${hierarchical ? "" : `/${chapter.number}`}`, {
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
  ref: string; label: string; uvaca: string | null;
  devanagari: string | null; translit: string | null;
  tokens: VerseToken[]; translation: string | null; purport: string | null;
  source_url: string | null; prev: string | null; next: string | null;
}

/* ───────── PDF-вёрстка (стих / глава / книга) — наш дизайн на бумаге ───────── */
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
        <div style={{ fontFamily: "var(--font-deva, 'Noto Serif Devanagari', var(--font-text))", fontSize: 19, lineHeight: 1.6, textAlign: "center", color: INK, whiteSpace: "pre-line", marginBottom: r.translit ? 16 : 22 }}>{r.deva}</div>
      )}
      {r.translit && (
        <div style={{ marginBottom: 16 }}>
          {r.translit.split("\n").map((ln, i) => (
            <div key={i} style={{ fontStyle: "italic", fontSize: 16.5, lineHeight: 1.4, textAlign: "center", color: INK2, marginTop: i === 0 ? 0 : 7 }}>{ln}</div>
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
            <p style={{ margin: 0, fontSize: 20, lineHeight: 1.5, fontWeight: 500, letterSpacing: "-0.01em", color: INK }}>{r.translation}</p>
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
              <p key={i} style={{ margin: i === 0 ? 0 : "14px 0 0" }}>{para}</p>
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
        <h2 style={{ margin: 0, fontSize: 30, lineHeight: 1.1, fontWeight: 800, letterSpacing: "-0.025em", color: INK }}>{chapter.title_ru}</h2>
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
        <h1 style={{ margin: "16mm 0 0", fontSize: 40, lineHeight: 1.06, fontWeight: 800, letterSpacing: "-0.02em", color: INK }}>{book.titleLine1}</h1>
        {book.titleLine2 && <div style={{ marginTop: 4, fontSize: 27, fontWeight: 600, letterSpacing: "-0.01em", color: INK }}>{book.titleLine2}</div>}
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

function VerseReader({ refStr, bookTitle, work = "bg", chapters, onNavigate, onClose, flash, onMenuAction, onQr }: { refStr: string; bookTitle: string; work?: string; chapters: ChapterRow[] | null; onNavigate: (ref: string) => void; onClose: () => void; flash: (m: string) => void; onMenuAction: (label: string) => void; onQr: (url: string, data: QrData) => void }) {
  const [data, setData] = useState<VerseDetail | null>(null);
  const [error, setError] = useState(false);
  const [fav, setFav] = useState(false);
  const [vMenu, setVMenu] = useState(false);
  const vMoreRef = useRef<HTMLSpanElement>(null);
  const verseContentRef = useRef<HTMLDivElement>(null);
  const player = usePlayer();

  useEffect(() => {
    let live = true;
    setData(null); setError(false);
    fetch(api(`/books/${work}/verses/${encodeURIComponent(refStr)}`))
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((d) => { if (live) setData(d as VerseDetail); })
      .catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, [refStr]);

  const demo = DEMO_VERSES[data?.ref ?? refStr];
  const chapterNo = (data?.ref ?? refStr).replace(/^[^\d]*/, "").split(".")[0];
  const refDigits = (data?.ref ?? refStr).replace(/^[^\d]*/, "");           // "2.13" | "2.16-17"
  const verseSeg = refDigits.includes(".") ? refDigits.slice(refDigits.indexOf(".") + 1) : "";
  const verseUrl = `https://gaurangers.com/book/${work}/${chapterNo}${verseSeg ? `/${verseSeg}` : ""}`;
  const chapterTitle = chapters?.find((c) => c.number === chapterNo)?.title_ru;
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
        <NavBtn ariaLabel="В избранное" onClick={() => { const nv = !fav; setFav(nv); flash(nv ? "Добавлено в избранное" : "Убрано из избранного"); }} size={36}><span style={{ display: "inline-flex", color: fav ? "#FF3B30" : INK }}><HeartIcon size={18} filled={fav} /></span></NavBtn>
        {work === "bg" && <NavBtn ariaLabel="Слушать" onClick={() => player.playChapter(work, Number(chapterNo) || 1, "commentary")} size={36}><HeadphonesIcon size={18} /></NavBtn>}
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
                <div style={{ fontFamily: "var(--font-deva, 'Noto Serif Devanagari', var(--font-text))", fontSize: 19, lineHeight: 1.6, textAlign: "center", color: INK, whiteSpace: "pre-line", marginBottom: hasTranslit ? 16 : 22 }}>{evDeva}</div>
              )}
              {hasTranslit && (
                <div style={{ marginBottom: 16 }}>
                  {evTranslit!.split("\n").map((ln, i) => (
                    <div key={i} style={{ fontStyle: "italic", fontSize: 16.5, lineHeight: 1.4, textAlign: "center", color: INK2, marginTop: i === 0 ? 0 : 7 }}>{ln}</div>
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
                      <p key={i} style={{ margin: i === 0 ? 0 : "14px 0 0" }}>{para}</p>
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

      <BookMenuSheet open={vMenu} onClose={() => setVMenu(false)} onSelect={(id) => {
        setVMenu(false);
        if (id === "share") { void shareVerse(); return; }
        if (id === "pdf") {
          const label = data?.label ?? refStr;
          const vref = data?.ref ?? refStr;
          const vfile = `Бхагавад-гита как она есть. Глава ${chapterNo}${verseSeg ? `. Стих ${verseSeg}` : ""}.pdf`;
          void downloadServerPdf(
            `/pdf?kind=verse&ref=${encodeURIComponent(vref)}`,
            vfile,
            { onStatus: flash, fallback: () => exportToPdf(verseContentRef.current, { title: `${label} · ${bookTitle}`, heading: label, subheading: `${chapterNo ? "Глава " + chapterNo + " · " : ""}${bookTitle}` }) },
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
export function BookDetailPage({ book, onBack, onDonate, initialTarget }: { book: BookData; onBack: () => void; onDonate: () => void; initialTarget?: { chapter: string | null; verse: string | null } | null }) {
  const [idx, setIdx] = useState(0);
  const [favorited, setFavorited] = useState(false);
  const [inCart, setInCart] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [tab, setTab] = useState<BookTabId>("contents");
  const [chapters, setChapters] = useState<ChapterRow[] | null>(null);
  const [openChapter, setOpenChapter] = useState<ChapterRow | null>(null);
  const [readerRef, setReaderRef] = useState<string | null>(null);
  const bookContentRef = useRef<HTMLDivElement>(null);
  const bookPrintRef = useRef<HTMLDivElement>(null);
  const [bookPrint, setBookPrint] = useState<{ chapters: ChapterRow[]; versesByCh: Record<string, ChapterVerse[]> } | null>(null);
  const [bookPct, setBookPct] = useState(0);
  const [qr, setQr] = useState<{ url: string; data: QrData } | null>(null);
  const openQr = (url: string, data: QrData) => setQr({ url, data });
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    if (book.hierarchical) return; // иерархические книги (ЧЧ/ШБ) — оглавление через CcContents (/toc)
    fetch(api(`/books/${book.work}/chapters`)).then((r) => r.json()).then((d) => setChapters(d.chapters ?? [])).catch(() => {});
  }, [book.work, book.hierarchical]);

  // Открыть цель (глава + стих) — для холодного входа по ссылке, QR и кнопок назад/вперёд.
  // navLock не даёт эффекту состояние→URL пушить адрес во время синхронизации ИЗ URL.
  const navLock = useRef(false);
  const openTarget = useRef<(chapter: string | null, verse: string | null) => void>(() => {});
  openTarget.current = (chapter, verse) => {
    if (!chapters) return;
    navLock.current = true;
    if (!chapter) { setOpenChapter(null); setReaderRef(null); navLock.current = false; return; }
    const ch = chapters.find((x) => x.number === chapter) ?? null;
    setOpenChapter(ch);
    if (ch && verse) {
      fetch(api(`/books/bg/chapters/${chapter}/read`))
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

  // Холодный вход /book/bg/{ch}/{v} (в т.ч. из QR) → открыть цель один раз, когда главы готовы.
  const didInitTarget = useRef(false);
  useEffect(() => {
    if (didInitTarget.current || !chapters) return;
    if (initialTarget?.chapter) {
      didInitTarget.current = true;
      openTarget.current(initialTarget.chapter, initialTarget.verse);
    }
  }, [chapters, initialTarget]);

  // Состояние → URL: уникальный адрес — /book/bg, /book/bg/{ch}, /book/bg/{ch}/{v}.
  // Глубже (открыли главу/стих) → push; прыжок стих↔стих → replace, чтобы «назад» от
  // стиха вёл к ГЛАВЕ, а не перебирал соседние стихи.
  useEffect(() => {
    if (book.hierarchical) return; // ЧЧ/ШБ: глубокие URL глав/стихов — отдельная задача; ПКП живёт на /book/<work>
    if (!chapters || navLock.current || typeof window === "undefined") return;
    let path = "/book/bg";
    if (readerRef) {
      const rd = readerRef.replace(/^[^\d]*/, "");
      const ch = rd.split(".")[0];
      const v = rd.includes(".") ? rd.slice(rd.indexOf(".") + 1) : "";
      path = v ? `/book/bg/${ch}/${v}` : `/book/bg/${ch}`;
    } else if (openChapter) {
      path = `/book/bg/${openChapter.number}`;
    }
    const cur = window.location.pathname;
    if (cur === path) return;
    const isVerse = (p: string) => /^\/book\/bg\/\d+\/.+/.test(p);
    if (isVerse(cur) && isVerse(path)) window.history.replaceState(null, "", path);
    else window.history.pushState(null, "", path);
  }, [openChapter, readerRef, chapters]);

  // Единая кнопка «назад» внутри книги: стих → глава → книга → главная.
  // Используем настоящую историю (pop), чтобы переходы были чистыми; на холодном
  // входе истории нет — тогда поднимаемся на уровень вверх и правим адрес на месте.
  const histBase = useRef(typeof window !== "undefined" ? window.history.length : 0);
  const goBack = () => {
    if (typeof window === "undefined") return;
    if (book.hierarchical) {
      if (readerRef) { setReaderRef(null); return; }
      if (openChapter) { setOpenChapter(null); return; }
      onBack(); return;
    }
    if (window.history.length > histBase.current) { window.history.back(); return; }
    if (readerRef) { setReaderRef(null); window.history.replaceState(null, "", openChapter ? `/book/bg/${openChapter.number}` : "/book/bg"); }
    else if (openChapter) { setOpenChapter(null); window.history.replaceState(null, "", "/book/bg"); }
    else onBack();
  };

  // URL → состояние при «назад/вперёд» браузера (в пределах книги).
  useEffect(() => {
    if (book.hierarchical) return;
    const onPop = () => {
      const path = window.location.pathname;
      if (!path.startsWith("/book/bg")) return;
      const parts = path.split("/");        // ["", "book", "bg", ch?, v?]
      openTarget.current(parts[3] || null, parts[4] || null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [book.hierarchical]);

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
      const name = book.titleLine2 ? `${book.titleLine1} ${book.titleLine2}` : book.titleLine1;
      void downloadServerPdf("/pdf?kind=book", `${name}.pdf`, { onStatus: flash, onProgress: setBookPct, fallback: () => { if (bookPrintRef.current) exportToPdf(bookPrintRef.current, { title: name }); } });
      setBookPrint(null);
    }
  }, [bookPrint, book.titleLine1, book.titleLine2]);

  const buildBookPdf = async () => {
    if (!chapters || chapters.length === 0) { flash("Книга ещё загружается…"); return; }
    flash("Готовлю PDF всей книги…");
    try {
      const entries = await Promise.all(
        chapters.map(async (c) => {
          const r = await fetch(api(`/books/bg/chapters/${c.number}/read`));
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
    if (id === "share") { void shareBook(); return; }
    if (id === "pdf") { if (book.hierarchical) { flash("PDF этой книги готовится"); return; } void buildBookPdf(); return; }
    if (id === "qr") {
      openQr(`https://gaurangers.com/book/${book.work}`, {
        kind: "book",
        bookTitle: book.titleLine1,
        bookSubtitle: book.titleLine2,
        tagline: book.tagline,
        cover: book.covers[0],
      });
      return;
    }
    if (id === "donate") { onDonate(); return; }
    if (id === "report") { setReportOpen(true); return; }
  };

  return (
    <div style={{ position: "relative", minHeight: "100%", background: PAPER, paddingBottom: "calc(env(safe-area-inset-bottom,0px) + 32px)" }}>
      {/* scroll-aware top bar — persistent back; all actions live in the card below */}
      <header style={{ position: "sticky", top: 0, zIndex: 30, height: 52, display: "flex", alignItems: "center", gap: 4, padding: "0 14px", transition: "background .2s, border-color .2s", background: scrolled ? "rgba(255,255,255,0.82)" : "transparent", backdropFilter: scrolled ? "blur(40px) saturate(180%)" : "none", WebkitBackdropFilter: scrolled ? "blur(40px) saturate(180%)" : "none", borderBottom: "0.5px solid transparent" }}>
        <button type="button" aria-label="Назад" onClick={onBack} style={{ display: "grid", height: 38, width: 38, placeItems: "center", borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.05)", color: INK, cursor: "pointer", flexShrink: 0 }}><BackIcon size={22} /></button>
        {scrolled && <div style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em", color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{book.titleLine1}</div>}
      </header>

      <div ref={bookContentRef}>
        {/* HERO — the SAME card module as the feed (ВКП); single source from books.ts */}
        <div style={{ padding: "2px 16px 6px" }}>
          <BookHeroCard book={book} topLeft={<LogoMark src="/bbt.svg" label="The Bhaktivedanta Book Trust" height={26} color="#fff" />} flash={flash} onMenuSelect={menuAction} />
        </div>

        <BookTabs active={tab} onChange={setTab} />

        <div>
          {tab === "contents" && (book.hierarchical
            ? <CcContents work={book.work} onOpenChapter={setOpenChapter} />
            : <Contents chapters={chapters} onOpenChapter={setOpenChapter} />)}
          {tab === "overview" && <Overview book={book} />}
          {tab === "author" && <Author />}
          {tab === "reviews" && <Reviews />}
        </div>
      </div>

      <Toast msg={toast} />
      {bookPct > 0 && (
        <div style={{ position: "fixed", inset: 0, zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.45)" }}>
          <div style={{ width: 280, maxWidth: "82%", background: "#fff", borderRadius: 18, padding: "22px 22px 20px", boxShadow: "0 20px 60px rgba(0,0,0,0.35)", fontFamily: "var(--font-text)", textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1f2024" }}>Готовлю PDF книги</div>
            <div style={{ fontSize: 12.5, color: "#70727b", marginTop: 4 }}>Это может занять 1–2 минуты</div>
            <div style={{ marginTop: 16, height: 8, borderRadius: 999, background: "#ececed", overflow: "hidden" }}>
              <div style={{ width: `${bookPct}%`, height: "100%", background: "#D2AA1B", borderRadius: 999, transition: "width 0.4s ease" }} />
            </div>
            <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: "#9c7c15" }}>{bookPct}%</div>
          </div>
        </div>
      )}
      {openChapter && <ChapterPage chapter={openChapter} bookTitle={book.titleLine1} work={book.work} hierarchical={!!book.hierarchical} onOpenVerse={(ref) => setReaderRef(ref)} onBack={goBack} onMenuAction={menuAction} onQr={openQr} flash={flash} />}
      {readerRef && <VerseReader key={readerRef} refStr={readerRef} bookTitle={book.titleLine1} work={book.work} chapters={chapters} onNavigate={setReaderRef} onClose={goBack} flash={flash} onMenuAction={menuAction} onQr={openQr} />}
      {bookPrint && (
        <div ref={bookPrintRef} aria-hidden style={{ position: "fixed", left: -10000, top: 0, width: 760 }}>
          <BookPrint book={book} chapters={bookPrint.chapters} versesByCh={bookPrint.versesByCh} />
        </div>
      )}
      {qr && <QrSheet url={qr.url} data={qr.data} onClose={() => setQr(null)} />}
      <ReportSheet open={reportOpen} onClose={() => setReportOpen(false)} context={readerRef ? readerRef : openChapter ? `${book.titleLine1}, глава ${openChapter.number}` : book.titleLine1} />
    </div>
  );
}
