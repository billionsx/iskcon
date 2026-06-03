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
import { BOOK_MENU_ITEMS } from "./books";
import { api } from "./api";
import { DEMO_VERSES, DEMO_REFS } from "./demo";
import { BackIcon, HeartIcon, MoreIcon } from "./ui/icons";

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
function HeadphonesIcon(p: IconProps) {
  return <svg {...sp(p)}><path {...STROKE} d="M4 13v-1a8 8 0 0 1 16 0v1" /><rect x="3.2" y="12" width="4.2" height="7" rx="2.1" {...STROKE} /><rect x="16.6" y="12" width="4.2" height="7" rx="2.1" {...STROKE} /></svg>;
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
    <nav aria-label="Разделы книги" style={{ position: "sticky", top: 56, zIndex: 20, background: PAPER, borderBottom: `0.5px solid ${LINE}` }}>
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
function Author() {
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
            В 69 лет он в одиночку привёз учение «Бхагавад-гиты» из Индии на Запад — и за одиннадцать лет перевёл и прокомментировал десятки томов ведических писаний, основав движение, охватившее весь мир.
          </p>
        </div>
      </section>

      <section>
        <SectionTitle>Путь</SectionTitle>
        <ol style={{ listStyle: "none", margin: 0, padding: "2px 0 0" }}>
          <Milestone year="1896" text="Родился в Калькутте под именем Абхай Чаран Де, в день после Джанмаштами, в вайшнавской семье." />
          <Milestone year="1922" text="Встретил своего духовного учителя Шрилу Бхактисиддханту Сарасвати Тхакура, получив наказ нести сознание Кришны на английском языке." />
          <Milestone year="1965" text="В 69 лет на грузовом судне «Джаладута» (37 дней пути, два инфаркта) прибыл в Нью-Йорк — без средств и без единого знакомого." />
          <Milestone year="1966" text="Основал в Нью-Йорке Международное общество сознания Кришны (ИСККОН)." />
          <Milestone year="1972" text="Учредил издательство Bhaktivedanta Book Trust (BBT) — крупнейшего издателя ведической литературы в мире." />
          <Milestone year="1977" text="Ушёл из этого мира во Вриндаване в возрасте 81 года, оставив более сотни храмов и центров на всех континентах." last />
        </ol>
      </section>

      <section>
        <SectionTitle>Наследие</SectionTitle>
        <div>
          <KeyVal k="Книг переведено" v="более 70 томов" />
          <KeyVal k="Языков перевода" v="76" />
          <KeyVal k="Храмов и центров" v="100+" />
          <KeyVal k="Кругосветных путешествий" v="14" last />
        </div>
        <p style={{ margin: "14px 0 0", fontSize: 14, lineHeight: 1.5, color: INK2 }}>
          Его переводы — «Бхагавад-гита как она есть», многотомные «Шримад-Бхагаватам» и «Шри Чайтанья-чаритамрита» — ценятся учёными за точность, глубину и верность традиции и используются как учебные пособия в университетах.
        </p>
      </section>
    </div>
  );
}

/* ───────── Содержание (flat rows on white) ───────── */
interface ChapterRow { id: string; number: string; title_ru: string; title_en: string; source_url: string; verses: number; }
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

/* ───────── verse model ───────── */
interface ChapterVerse {
  ref: string; label: string;
  devanagari: string | null; translit: string | null;
  tokens: { term: string; gloss: string | null }[];
  translation: string | null; purport: string | null;
}

/* ───────── Глава ───────── */
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
    <div style={{ position: "fixed", top: 0, bottom: 0, left: 0, right: 0, margin: "0 auto", width: "100%", maxWidth: 480, zIndex: 70, display: "flex", flexDirection: "column", background: PAPER }}>
      <header style={{ flexShrink: 0, height: 56, display: "flex", alignItems: "center", gap: 4, padding: "0 6px", background: PAPER, borderBottom: `0.5px solid ${collapsed ? LINE : "transparent"}`, transition: "border-color .2s", zIndex: 2 }}>
        <NavBtn ariaLabel="Назад" onClick={onBack}><BackIcon size={22} /></NavBtn>
        <div style={{ flex: 1, minWidth: 0, textAlign: "center", opacity: collapsed ? 1 : 0, transform: collapsed ? "none" : "translateY(3px)", transition: "opacity .2s, transform .2s" }}>
          <div style={{ fontSize: 15.5, fontWeight: 700, letterSpacing: "-0.01em", color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", padding: "0 4px" }}>{chapter.title_ru}</div>
          <div style={{ fontSize: 11, color: INK2 }}>Глава {chapter.number}</div>
        </div>
        <span style={{ width: 40, flexShrink: 0 }} />
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
    </div>
  );
}

/* ───────── verse layers ───────── */
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
  return <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 12px", fontSize: 11, fontWeight: 700, letterSpacing: "1.6px", textTransform: "uppercase", color: INK2 }}><span style={{ width: 18, height: 1.5, background: GOLD, borderRadius: 999 }} />{children}</div>;
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
    <div style={{ position: "fixed", top: 0, bottom: 0, left: 0, right: 0, margin: "0 auto", width: "100%", maxWidth: 480, zIndex: 80, display: "flex", flexDirection: "column", background: PAPER }}>
      <header style={{ flexShrink: 0, height: 54, display: "flex", alignItems: "center", gap: 4, padding: "0 6px", background: PAPER, borderBottom: `0.5px solid ${LINE}`, zIndex: 3 }}>
        <NavBtn ariaLabel="Закрыть" onClick={onClose}><BackIcon size={22} /></NavBtn>
        <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em", color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{data?.label ?? refStr}</div>
          <div style={{ fontSize: 11, color: INK2 }}>{chapterNo ? `Глава ${chapterNo} · ` : ""}Бхагавад-гита</div>
        </div>
        <NavBtn ariaLabel="Слои" onClick={() => setPanel((v) => !v)} active={panel}><SlidersIcon size={22} /></NavBtn>
      </header>

      {panel && (
        <div style={{ flexShrink: 0, position: "relative", zIndex: 2, margin: "10px 16px 4px", padding: "4px 16px 10px", borderRadius: 16, background: PAPER, border: `0.5px solid ${LINE}`, boxShadow: "0 10px 30px rgba(0,0,0,.10)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.6px", textTransform: "uppercase", color: INK2, padding: "10px 0 4px" }}>Слои стиха</div>
          <LayerRow label="Деванагари" on={layers.deva} onToggle={() => toggle("deva")} />
          <LayerRow label="Транслитерация" on={layers.translit} onToggle={() => toggle("translit")} />
          <LayerRow label="Пословный перевод" on={layers.ww} onToggle={() => toggle("ww")} />
          <div style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", padding: "11px 0", fontSize: 16, color: INK2 }}><span>Перевод</span><span style={{ fontSize: 12, color: INK3 }}>всегда</span></div>
          <LayerRow label="Комментарий" on={layers.commentary} onToggle={() => toggle("commentary")} />
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}>
        <div style={{ margin: "0 auto", padding: "22px 20px 40px" }}>
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
                  <LayerLabel>Комментарий{purportIsDemo && <DemoBadge />}</LayerLabel>
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
    <div style={{ position: "relative", minHeight: "100%", background: PAPER, paddingBottom: "calc(env(safe-area-inset-bottom,0px) + 32px)" }}>
      {/* scroll-aware top bar over hero */}
      <header style={{ position: "sticky", top: 0, zIndex: 30, height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", transition: "background .2s, border-color .2s", background: scrolled ? "rgba(255,255,255,0.82)" : "transparent", backdropFilter: scrolled ? "blur(40px) saturate(180%)" : "none", WebkitBackdropFilter: scrolled ? "blur(40px) saturate(180%)" : "none", borderBottom: `0.5px solid ${scrolled ? LINE : "transparent"}` }}>
        <TopBtn solid={scrolled} ariaLabel="Назад" onClick={onBack}><BackIcon size={22} /></TopBtn>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <TopBtn solid={scrolled} active={favorited} activeColor="#FF3B30" ariaLabel="В избранное" onClick={() => { const nv = !favorited; setFavorited(nv); flash(nv ? "Добавлено в избранное" : "Убрано из избранного"); }}><HeartIcon size={18} filled={favorited} /></TopBtn>
          <TopBtn solid={scrolled} ariaLabel="Слушать" onClick={() => flash("Аудиокнига — скоро")}><HeadphonesIcon size={19} /></TopBtn>
          <TopBtn solid={scrolled} active={inCart} activeColor={GOLDT} ariaLabel={inCart ? "Убрать из корзины" : "В корзину"} onClick={() => { const nv = !inCart; setInCart(nv); flash(nv ? "Добавлено в корзину" : "Убрано из корзины"); }}><BagIcon size={18} cornerGlyph={inCart ? "minus" : "plus"} /></TopBtn>
          <TopBtn solid={scrolled} ariaLabel="Меню" onClick={() => setMoreOpen(true)}><MoreIcon size={16} /></TopBtn>
        </div>
      </header>

      {/* HERO carousel */}
      <article style={{ position: "relative", marginTop: -56, aspectRatio: "4 / 5", overflow: "hidden", background: "#15161a" }}>
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
          <div style={{ color: "#fff", marginBottom: 14 }}><LogoMark src="/bbt.svg" label="The Bhaktivedanta Book Trust" height={24} color="#fff" /></div>
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
