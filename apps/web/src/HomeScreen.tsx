/**
 * HomeScreen — «Главная». Чистый стандарт iOS 26 / App Store 2026:
 * НИКАКИХ обводок — поверхности задаются мягкой заливкой (--color-glass-thin),
 * фотографии живут на скруглении и воздухе. Три разных формата галерей:
 *   · Carousel — крупный пейджинг с подглядыванием следующей карточки (храмы);
 *   · SquareGrid — квадратная сетка 3×3 в духе Instagram (жизнь Прабхупады);
 *   · Mosaic — двухрядная горизонтальная мозаика без подписей (жизнь общины).
 * Подписи под фото только там, где факт проверен; в галереях подписей нет.
 * Шрила Прабхупада — короткое эссе + таймлайн вместо простыни текста; полная
 * биография — за кнопкой «Жизнь и наследие» (страница героя).
 */
import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { BOOKS, LIBRARY, AUDIO_WORKS } from "./books";
import { BookHeroCard } from "./BookHeroCard";
import { ChevRightIcon } from "./ui/icons";

const GOLD = "#D2AA1B";
const S = 44;   // воздух между секциями
const PAD = 16; // боковой отступ контейнера

/* Поверхность без обводки — iOS grouped fill (светлая: rgba(0,0,0,.04), тёмная: rgba(255,255,255,.08)) */
const fill: React.CSSProperties = { background: "var(--color-glass-thin)", borderRadius: 20 };
const TR_HERO = "-0.03em", TR_TITLE = "-0.022em", TR_BODY = "-0.01em";
const IMG_BG = "var(--color-glass-thin)";

/* ───────── атомы ───────── */
function MaskMark({ src, size = 28, color = "var(--color-label)", pos = "center" }: { src: string; size?: number; color?: string; pos?: string }) {
  return <span aria-hidden style={{ display: "block", width: size, height: size, backgroundColor: color,
    WebkitMaskImage: `url(${src})`, maskImage: `url(${src})`, WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
    WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskPosition: pos, maskPosition: pos }} />;
}
function SectionHead({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {eyebrow && <div style={{ fontFamily: "var(--font-text)", fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLD }}>{eyebrow}</div>}
      <h2 style={{ margin: eyebrow ? "5px 0 0" : 0, fontFamily: "var(--font-display)", fontSize: 23, fontWeight: 800, letterSpacing: TR_TITLE, lineHeight: 1.12, color: "var(--color-label)" }}>{title}</h2>
      {subtitle && <p style={{ margin: "8px 0 0", fontFamily: "var(--font-text)", fontSize: 14.5, lineHeight: 1.55, letterSpacing: TR_BODY, color: "var(--color-label-2)" }}>{subtitle}</p>}
    </div>
  );
}
function Section({ children, top = S }: { children: React.ReactNode; top?: number }) {
  return <section style={{ marginTop: top }}>{children}</section>;
}
function Photo({ src, ratio, pos = "center", radius = 20 }: { src: string; ratio?: string; pos?: string; radius?: number }) {
  return (
    <div style={{ borderRadius: radius, overflow: "hidden", background: IMG_BG, transform: "translateZ(0)" }}>
      <img src={src} alt="" loading="lazy" style={{ width: "100%", display: "block", ...(ratio ? { aspectRatio: ratio, objectFit: "cover" as const, objectPosition: pos } : { height: "auto" }) }} />
    </div>
  );
}
function Figure({ src, ratio, pos, caption }: { src: string; ratio?: string; pos?: string; caption?: string }) {
  return (
    <figure style={{ margin: "16px 0 0" }}>
      <Photo src={src} ratio={ratio} pos={pos} />
      {caption && <figcaption style={{ margin: "10px auto 0", maxWidth: 420, textAlign: "center", fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 13, color: "var(--color-label-3)", lineHeight: 1.45 }}>{caption}</figcaption>}
    </figure>
  );
}
function Quote({ children, center = false, size = 15, color = "var(--color-label)" }: { children: React.ReactNode; center?: boolean; size?: number; color?: string }) {
  return <blockquote style={{ margin: 0, fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: size, lineHeight: 1.6, letterSpacing: TR_BODY, color, textAlign: center ? "center" : "left" }}>{children}</blockquote>;
}
function Para({ children, mt = 0 }: { children: React.ReactNode; mt?: number }) {
  return <p style={{ margin: `${mt}px 0 0`, fontFamily: "var(--font-text)", fontSize: 14.5, lineHeight: 1.6, letterSpacing: TR_BODY, color: "var(--color-label-2)" }}>{children}</p>;
}

/* ───────── галерея №1: крупный пейджинг-карусель (с «подглядыванием») ───────── */
function Carousel({ items, ratio = "4 / 3" }: { items: string[]; ratio?: string }) {
  return (
    <div style={{ display: "flex", gap: 10, overflowX: "auto", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch",
      margin: `16px -${PAD}px 0`, padding: `0 ${PAD}px`, scrollPaddingLeft: PAD, scrollbarWidth: "none" }}>
      {items.map((src, i) => (
        <div key={i} style={{ flex: "0 0 84%", scrollSnapAlign: "start", borderRadius: 22, overflow: "hidden", background: IMG_BG, transform: "translateZ(0)" }}>
          <img src={src} alt="" loading="lazy" style={{ width: "100%", display: "block", aspectRatio: ratio, objectFit: "cover" }} />
        </div>
      ))}
      <div aria-hidden style={{ flex: `0 0 ${PAD - 10}px` }} />
    </div>
  );
}

/* ───────── галерея №2: квадратная сетка 3×n (Instagram) ───────── */
function SquareGrid({ items }: { items: string[] }) {
  return (
    <div style={{ marginTop: 16, borderRadius: 20, overflow: "hidden", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 3, background: "var(--color-bg)", transform: "translateZ(0)" }}>
      {items.map((src, i) => (
        <div key={i} style={{ background: IMG_BG }}>
          <img src={src} alt="" loading="lazy" style={{ width: "100%", display: "block", aspectRatio: "1 / 1", objectFit: "cover" }} />
        </div>
      ))}
    </div>
  );
}

/* ───────── галерея №3: двухрядная горизонтальная мозаика ───────── */
function Mosaic({ items }: { items: string[] }) {
  const tall = new Set([0, 5]); // акцентные кадры на всю высоту
  return (
    <div style={{ display: "grid", gridAutoFlow: "column", gridTemplateRows: "repeat(2, 122px)", gridAutoColumns: "44%", gap: 4,
      overflowX: "auto", WebkitOverflowScrolling: "touch", margin: `16px -${PAD}px 0`, padding: `0 ${PAD}px`, scrollbarWidth: "none" }}>
      {items.map((src, i) => (
        <div key={i} style={{ gridRow: tall.has(i) ? "span 2" : "auto", borderRadius: 14, overflow: "hidden", background: IMG_BG, transform: "translateZ(0)" }}>
          <img src={src} alt="" loading="lazy" style={{ width: "100%", height: "100%", display: "block", objectFit: "cover" }} />
        </div>
      ))}
    </div>
  );
}

/* ───────── карточка-направление с лейблом поверх фото ───────── */
function PlaceCard({ src, title, sub, pos = "center" }: { src: string; title: string; sub: string; pos?: string }) {
  return (
    <div style={{ position: "relative", borderRadius: 22, overflow: "hidden", background: IMG_BG, transform: "translateZ(0)" }}>
      <img src={src} alt="" loading="lazy" style={{ width: "100%", display: "block", aspectRatio: "16 / 10", objectFit: "cover", objectPosition: pos }} />
      <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.18) 42%, transparent 64%)" }} />
      <div style={{ position: "absolute", left: 16, right: 16, bottom: 14 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 800, letterSpacing: TR_TITLE, color: "#fff" }}>{title}</div>
        <div style={{ marginTop: 2, fontFamily: "var(--font-text)", fontSize: 12.5, letterSpacing: TR_BODY, color: "rgba(255,255,255,0.82)" }}>{sub}</div>
      </div>
    </div>
  );
}

function NavCard({ mark, title, subtitle, onClick, accent }: { mark: React.ReactNode; title: string; subtitle: string; onClick: () => void; accent?: boolean }) {
  const ring: React.CSSProperties = accent
    ? { background: `color-mix(in srgb, ${GOLD} 14%, transparent)` }
    : { background: "var(--color-glass-regular)" };
  return (
    <button type="button" onClick={onClick}
      onPointerDown={(e) => (e.currentTarget.style.opacity = "0.65")} onPointerUp={(e) => (e.currentTarget.style.opacity = "1")} onPointerLeave={(e) => (e.currentTarget.style.opacity = "1")}
      style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", padding: PAD, textAlign: "left", cursor: "pointer", border: "none", ...fill }}>
      <span style={{ flexShrink: 0, width: 52, height: 52, borderRadius: "50%", display: "grid", placeItems: "center", ...ring }}>{mark}</span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, letterSpacing: TR_TITLE, color: "var(--color-label)" }}>{title}</span>
        <span style={{ display: "block", marginTop: 3, fontFamily: "var(--font-text)", fontSize: 13, lineHeight: 1.4, letterSpacing: TR_BODY, color: "var(--color-label-2)" }}>{subtitle}</span>
      </span>
      <span style={{ flexShrink: 0, color: "var(--color-label-3)", display: "grid", placeItems: "center" }}><ChevRightIcon size={18} /></span>
    </button>
  );
}

/* ───────── счётчик статистики ───────── */
function fmtNum(n: number, dec: number) {
  if (dec) { const [i, d] = n.toFixed(1).split("."); return i.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + "," + d; }
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
function CountUp({ value }: { value: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [disp, setDisp] = useState("0");
  const m = value.match(/^(на\s)?\s*([\d\s.,]+?)\s*(\+)?$/);
  const prefix = m && m[1] ? m[1] : "";
  const numRaw = (m ? m[2] : "0").replace(/[\s ]/g, "").replace(",", ".");
  const target = parseFloat(numRaw) || 0;
  const dec = numRaw.includes(".") ? 1 : 0;
  const suffix = m && m[3] ? "+" : "";
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setDisp(prefix + fmtNum(target, dec) + suffix); return; }
    let raf = 0;
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) {
        io.disconnect();
        const t0 = performance.now(), D = 1400;
        const tick = (t: number) => { const p = Math.min(1, (t - t0) / D); setDisp(prefix + fmtNum(target * (1 - Math.pow(1 - p, 3)), dec) + suffix); if (p < 1) raf = requestAnimationFrame(tick); };
        raf = requestAnimationFrame(tick);
      }
    }), { threshold: 0.6 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, []);
  return <span ref={ref}>{disp}</span>;
}
function StatTile({ v, l }: { v: string; l: string }) {
  return (
    <div style={{ padding: PAD, ...fill }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 27, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--color-label)", lineHeight: 1, whiteSpace: "nowrap" }}><CountUp value={v} /></div>
      <div style={{ marginTop: 6, fontFamily: "var(--font-text)", fontSize: 12, letterSpacing: TR_BODY, color: "var(--color-label-3)", lineHeight: 1.3 }}>{l}</div>
    </div>
  );
}

/* ───────── данные ───────── */
const TEMPLES = [
  "/media/site/temple-mayapur.webp", "/media/site/temple-tovp.webp", "/media/site/temple-mumbai.webp",
  "/media/site/temple-chennai.webp", "/media/site/temple-delhi.webp", "/media/site/temple-tirupati.webp",
  "/media/site/temple-ahmedabad.webp", "/media/site/temple-rohini.webp", "/media/site/temple-kanpur.webp",
  "/media/site/temple-noida.webp", "/media/site/temple-siliguri.webp", "/media/site/temple-ananthapur.webp",
  "/media/site/temple-newvrindaban.webp",
];
const SP_LIFE = [
  "/media/site/sp-arrival.webp", "/media/site/sp-japa.webp", "/media/site/sp-harmonium.webp",
  "/media/site/sp-walk.webp", "/media/site/sp-lecture.webp", "/media/site/sp-prasad.webp",
  "/media/site/sp-banner.webp", "/media/site/sp-beach.webp", "/media/site/sp-portrait.webp",
];
const COMMUNITY = [
  "/media/site/fest-ratha1.webp", "/media/site/fest-ratha2.webp", "/media/site/fest-1.webp",
  "/media/site/fest-pandal.webp", "/media/site/fest-2.webp", "/media/site/prasad-thali.webp",
  "/media/site/prasad-give.webp", "/media/site/prasad-eat.webp",
];
const STATS = [
  { v: "10+", l: "миллионов последователей" }, { v: "2 000+", l: "храмов по всему миру" },
  { v: "65+", l: "сельхоз-общин" }, { v: "8,7+", l: "млрд порций прасада" },
  { v: "55+", l: "учебных заведений" }, { v: "на 89", l: "языках издаются книги" },
  { v: "300+", l: "ресторанов" }, { v: "100+", l: "гуру и наставников" },
];
const FORMS = [
  { t: "Мантра", d: "Звуковая форма Кришны и Шримати Радхарани (Харе). Повторение мантры Харе Кришна (тихо — джапа, громко — киртан) помогает очистить ум и сердце, мгновенно соединяя вас с Богом и позволяя ощущать Его присутствие.", go: "kirtans" },
  { t: "Книги", d: "Литературная форма Кришны и Шримати Радхарани (Харе). Изучение священных писаний, таких как «Бхагавад-гита», «Шримад-Бхагаватам» и «Шри Чайтанья-чаритамрита», позволит вам встретить Бога на страницах этих текстов.", go: "books" },
  { t: "Божества", d: "Проявленные формы Кришны и Шримати Радхарани (Харе) в этом мире неотличны от их вечных духовных форм, что позволяет преданным служить Им непосредственно." },
  { t: "Прасад", d: "Вегетарианская пища, предложенная Кришне и Шримати Радхарани (Харе), становится освящённой и передаёт духовную силу и любовь, помогая очищать ум и тело, а также устанавливать связь с Богом." },
  { t: "Садху", d: "Святые, хранящие в своих сердцах Кришну и Шримати Радхарани (Харе), являются духовными наставниками и учителями, источниками вдохновения, показывающими живой пример преданности, служения и любви.", go: "acharya" },
  { t: "Дхама", d: "Святые места, неотличные от духовного мира, где обитают Кришна и Шримати Радхарани (Харе). Посещение Дхамы углубляет духовное сознание и помогает почувствовать близость к Богу. Примеры Дхамы — Вриндаван и Маяпур." },
];
const PRINCIPLES = [
  { t: "Без мяса", d: "Преданные воздерживаются от употребления мяса, рыбы и яиц, ведя образ жизни, который соответствует принципу ахимсы — ненасилия." },
  { t: "Без незаконного секса", d: "Членам Движения Харе Кришна рекомендуется практиковать целомудрие (брахмачарья) до брака и верность в браке." },
  { t: "Без азартных игр", d: "Этот принцип исключает азартные игры и спекулятивную деятельность, чтобы способствовать образу жизни, основанному на честности, надёжности и осознанности." },
  { t: "Без интоксикаций", d: "Преданные воздерживаются от употребления одурманивающих веществ — алкоголя, наркотиков и табака, — стремясь поддерживать ясный и сосредоточенный ум для духовной практики." },
];
const VOICES = [
  { img: "johnson", c: "Меня вдохновляет работа этого храма и общины здесь. Это не только место великой духовности — конечно, оно привлекает сотни тысяч людей, и Манор объединяет людей самых разных слоёв общества.", n: "Борис Джонсон", r: "экс-премьер-министр Великобритании" },
  { img: "jobs", c: "Я проходил 7 миль через весь город каждую неделю, чтобы в воскресенье вечером получить хорошее блюдо в храме Харе Кришна.", n: "Стив Джобс", r: "сооснователь Apple Inc." },
  { img: "smith", c: "Я прочитал 90 процентов «Бхагавад-гиты». Когда я её читаю, мой внутренний Арджуна направляется на верный путь.", n: "Уилл Смит", r: "голливудский актёр" },
  { img: "lennon", c: "Повторение мантры Харе Кришна — это вид медитации, который может действительно вызвать состояние экстаза.", n: "Джон Леннон", r: "музыкант, The Beatles" },
  { img: "modi", c: "ИСККОН научил мир истинному значению веры.", n: "Нарендра Моди", r: "премьер-министр Индии" },
  { img: "harrison", c: "Он был идеальным примером всего, чему учил. Не имея ничего материального, но обладая сознанием Кришны, он привлёк тысячи преданных и основал целое движение, которое остаётся сильным даже после его ухода и продолжает расти с каждым днём.", n: "Джордж Харрисон", r: "музыкант, The Beatles" },
  { img: "mukherjee", c: "Я выражаю глубокую признательность и уважение Его Божественной Милости А. Ч. Бхактиведанте Свами Шриле Прабхупаде, который распространил послание сознания Кришны по всему миру. Его влияние продолжает звучать в сердцах преданных даже сегодня.", n: "Шри Пранаб Мукерджи", r: "13-й президент Индии" },
  { img: "sunak", c: "В самые трудные времена я получал учения из «Гиты», и именно «Гита» давала мне силу продолжать бороться за то, во что я верю.", n: "Риши Сунак", r: "премьер-министр Великобритании" },
];
const TIMELINE = [
  { y: "1896", d: "Родился в Калькутте в благочестивой вайшнавской семье; родители назвали его Абхай Чаран — «бесстрашный, принявший прибежище у лотосных стоп Господа»." },
  { y: "1922", d: "Судьбоносная встреча с духовным учителем — Шрилой Бхактисиддхантой Сарасвати, давшим наказ: нести учение бхакти на английском языке всему миру." },
  { y: "1944", d: "Основал англоязычный журнал Back to Godhead («Обратно к Богу»), который издаётся его учениками по сей день." },
  { y: "1959", d: "Принял санньясу во Вриндаване и начал главный труд жизни — перевод и комментарий к «Шримад-Бхагаватам»." },
  { y: "1965", d: "В 69 лет отправился в Америку на грузовом судне, перенеся в пути два сердечных приступа. В кармане — несколько долларов и ящик книг." },
  { y: "1966", d: "Зарегистрировал в Нью-Йорке Международное общество сознания Кришны — началась духовная революция на Западе." },
  { y: "1966–1977", d: "Четырнадцать раз облетел земной шар, основал 108 храмов, перевёл более 70 книг и инициировал тысячи учеников по всему миру." },
  { y: "1977", d: "Покинул этот мир во Вриндаване, окружённый любовью учеников. Его миссия продолжает расти с каждым днём." },
];
const PURPOSES = [
  "Систематически распространять духовные знания в обществе и обучать всех людей методам духовной жизни, чтобы исправить дисбаланс ценностей и достичь подлинного единства и мира в мире.",
  "Распространять сознание Кришны, как оно раскрыто в «Бхагавад-гите» и «Шримад-Бхагаватам».",
  "Объединять членов Общества друг с другом и приближать их к Кришне, развивая понимание того, что каждая душа является частицей божественной природы.",
  "Преподавать и поощрять движение санкиртаны — коллективное пение святого имени Бога, как оно раскрыто в учениях Господа Шри Чайтаньи Махапрабху.",
  "Возводить для членов Общества и для общества в целом святое место трансцендентных игр, посвящённое личности Кришны.",
  "Объединять членов Общества с целью обучения более простому и естественному образу жизни.",
  "Издавать и распространять периодические издания, журналы, книги и другие письменные материалы.",
];

/* ───────── расширенная биография для шита «Подробнее» ───────── */
const SP_BIO: string[] = [
  "Шрила Прабхупада — выдающийся духовный учитель индийского происхождения, принёсший сознание Кришны в западный мир и заложивший основы глобального вайшнавского возрождения. Его необыкновенная жизнь подробно и с любовью описана его учеником Сатсварупой дасом Госвами в семитомном труде «Шрила Прабхупада-лиламрита», переведённом на многие языки и читаемом по всему миру.",
  "Шрила Прабхупада родился 1 сентября 1896 года в Калькутте, в благочестивой вайшнавской семье. Родители дали ему имя Абхай Чаран Де — «тот, кто бесстрашен, приняв прибежище у лотосных стоп Господа Кришны». В 1920 году он окончил престижный Шотландский колледж, изучая английский язык, философию и экономику. Однако, поддержав движение Махатмы Ганди за независимость Индии, он сознательно отказался принять диплом как знак протеста против британского колониального правления.",
  "В 1922 году произошла судьбоносная встреча Шрилы Прабхупады с его духовным учителем — Шрилой Бхактисиддхантой Сарасвати Тхакуром, великим ачарьей гаудия-вайшнавской традиции. Именно тогда он получил наставление, определившее всю его жизнь: распространить древнее ведическое знание и учение бхакти на английском языке по всему миру, прежде всего на Западе. В то время Шрила Прабхупада был семейным человеком и вёл небольшой фармацевтический бизнес.",
  "В последующие годы Шрила Прабхупада начал активную литературную деятельность: он написал комментарии к «Бхагавад-гите», а в 1944 году основал англоязычный журнал Back to Godhead («Обратно к Богу»), который издаётся по сей день его учениками. В 1947 году Гаудия-вайшнавское общество официально признало его глубокую учёность и духовную реализацию, присвоив ему титул «Бхактиведанта» — «тот, кто постиг, что преданное служение Верховному Господу является вершиной всего знания».",
  "В 1954 году Шрила Прабхупада отошёл от семейной жизни и принял ванапрастху, полностью посвятив себя изучению и переводу классических вайшнавских писаний. Он поселился во Вриндаване — священном месте явления и деяний Господа Кришны. В 1959 году он принял санньясу, отречённый уклад жизни, и начал главный труд своей жизни — перевод и подробный комментарий к «Шримад-Бхагаватам».",
  "Как позже писал Сатсварупа дас Госвами в «Шрила Прабхупада-лиламрите», Шрила Прабхупада пришёл во Вриндаван не для того, чтобы завершить свою жизнь, а чтобы набраться духовной силы для величайшей миссии своей жизни. Он ясно осознавал: ему предстоит донести «Шримад-Бхагаватам» и учение чистой бхакти до англоязычного мира.",
  "В 1965 году, в возрасте 69 лет, Шрила Прабхупада покинул Индию и на грузовом судне отправился в Соединённые Штаты Америки. Во время плавания он перенёс два сердечных приступа. Прибыв в Нью-Йорк, он имел при себе лишь несколько долларов и ящик со своими книгами. Так началась беспрецедентная волна Гауранга-лилы, ранее никогда не проявлявшаяся в истории.",
  "Первые годы в Америке были чрезвычайно трудными, однако постепенно его духовное послание стало находить отклик в сердцах молодых людей. Он воспевал маха-мантру Харе Кришна в парке Томпкинс-сквер, читал лекции по «Бхагавад-гите» и собирал вокруг себя искренних искателей истины. Уже в 1966 году он официально зарегистрировал Международное общество сознания Кришны (ИСККОН), положив начало духовной революции на Западе.",
  "Шрила Прабхупада обладал уникальной способностью передавать вечное духовное знание, учитывая менталитет, культуру и уровень сознания людей. Он вдохновлял своих учеников проповедовать разными способами: через киртан, распространение книг, лекции в университетах, фестивали, раздачу освящённой пищи, строительство храмов, создание сельских общин, защиту коров и развитие вайшнавского искусства.",
];
const SP_BIO_BULLETS = [
  "основал ИСККОН, который распространился по всему миру, создав сотни храмов, центров, общин и образовательных учреждений;",
  "вернул сознание Кришны из Запада обратно в Индию, вдохнув новую жизнь в святые места Вриндавана и Маяпура;",
  "перевёл и прокомментировал ключевые вайшнавские писания — «Бхагавад-гиту как она есть», «Шримад-Бхагаватам», «Шри Чайтанья-чаритамриту» и многие другие;",
  "инициировал тысячи учеников по всему миру;",
  "четырнадцать раз облетел земной шар, проповедуя бхакти людям всех культур;",
  "основал программу Food for Life, распространяя милосердие через освящённую пищу.",
];
const SP_BIO_TAIL: string[] = [
  "В 1977 году, во Вриндаване, Шрила Прабхупада покинул этот мир, окружённый заботой и любовью своих учеников. Однако он продолжает жить через свои книги, свою миссию и через миллионы сердец, которых коснулась эта беспрецедентная волна Гауранга-лилы.",
  "Сегодня Шрила Прабхупада почитается как мировой ачарья — для всех вайшнавов, независимо от страны, культуры и языка, — как личность, исполнившая сокровенное желание Шри Чайтаньи Махапрабху: распространить святое имя Кришны и путь чистой бхакти по всей Земле.",
];
const SP_BIO_AFTER = "Сегодня, более чем через пять десятилетий после основания ИСККОН, вы всё ещё можете услышать, как Харе Кришна поют на Юнион-сквер в Нью-Йорке, слышать их музыку, увековеченную в песнях Джорджа Харрисона, и найти миллионы последователей по всему миру. И это история.";
const SP_FACTS = [
  { t: "Путешествие в Америку", d: "Покинув священный Вриндаван, Шрила Прабхупада отправился в Нью-Йорк в возрасте 69 лет. Имея при себе всего 7 долларов и несколько священных писаний, он столкнулся с многочисленными трудностями, но неуклонно продолжил свою миссию." },
  { t: "Всемирная проповедь", d: "Начав с повторения мантры Харе Кришна в парке, он основал первые храмы — это стало началом стремительного глобального распространения Движения Харе Кришна." },
  { t: "Литературное наследие", d: "Написал и перевёл на английский более 70 книг, включая «Бхагавад-гиту как она есть», «Шримад-Бхагаватам» и «Шри Чайтанья-чаритамриту», значительно повлияв на распространение ведических знаний." },
  { t: "Музыкальное влияние", d: "Представил киртан (пение святых имён) как форму медитации, завоевавшую популярность не только среди последователей, но и в широких кругах, включая The Beatles." },
  { t: "Культурные концепции", d: "Сыграл ключевую роль в популяризации понятий кармы, реинкарнации и йоги среди мировой аудитории, сделав эти термины широко известными." },
  { t: "Помощь нуждающимся", d: "Стремился, чтобы каждый в мире мог получить освящённую пищу — прасад. На сегодня роздано около 8,7 миллиарда порций, что сопоставимо с населением всей Земли." },
];

const PARAMPARA: { name: string; note: string }[] = [
  { name: "Кришна", note: "Верховная Личность Бога, источник всего знания" },
  { name: "Брахма", note: "первое существо, получившее знание от Кришны" },
  { name: "Нарада Муни", note: "странствующий мудрец, ученик Брахмы" },
  { name: "Вьясадева", note: "составитель ведических писаний" },
  { name: "Мадхвачарья", note: "1238–1317 · основатель двайта-веданты" },
  { name: "Мадхавендра Пури", note: "XV век · ключевая фигура бхакти" },
  { name: "Ишвара Пури", note: "1430–1520 · учитель Шри Чайтаньи" },
  { name: "Шри Чайтанья Махапрабху", note: "1486–1534 · Кришна и Радхарани в одном облике" },
  { name: "Шесть Госвами Вриндавана", note: "прямые ученики Махапрабху" },
  { name: "Кришнадаса Кавираджа", note: "1510–1590 · автор «Чайтанья-чаритамриты»" },
  { name: "Бхактивинода Тхакур", note: "1838–1914 · возрождение вайшнавизма" },
  { name: "Бхактисиддханта Сарасвати", note: "1874–1937 · широкое распространение учения" },
  { name: "А.Ч. Бхактиведанта Свами Прабхупада", note: "1896–1977 · основатель ИСККОН" },
];

/* ───────── PrabhupadaSheet — iOS-modal с подробной биографией ───────── */
function PrabhupadaSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label="О Шриле Прабхупаде" onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.42)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center", animation: "ppFade .2s ease-out" }}>
      <style>{`
        @keyframes ppFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ppSlide { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 560, maxHeight: "92vh", background: "var(--color-bg)", borderTopLeftRadius: 22, borderTopRightRadius: 22,
          overflow: "hidden", display: "flex", flexDirection: "column", animation: "ppSlide .32s cubic-bezier(.22,1,.36,1)", boxShadow: "0 -10px 50px rgba(0,0,0,0.35)" }}>
        {/* grab handle */}
        <div style={{ display: "grid", placeItems: "center", padding: "10px 0 4px", flexShrink: 0 }}>
          <span aria-hidden style={{ width: 38, height: 5, borderRadius: 3, background: "var(--color-label-3)", opacity: 0.5 }} />
        </div>
        {/* close button */}
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 14px", flexShrink: 0 }}>
          <button type="button" aria-label="Закрыть" onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: "50%", border: "none", background: "var(--color-glass-regular)", color: "var(--color-label-2)", cursor: "pointer", display: "grid", placeItems: "center", WebkitTapHighlightColor: "transparent" }}>
            <svg width="14" height="14" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
          </button>
        </div>
        {/* scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "10px 22px 32px", fontFamily: "var(--font-text)" }}>
          <div style={{ fontFamily: "var(--font-text)", fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLD }}>Ачарья-основатель</div>
          <h2 style={{ margin: "5px 0 0", fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 800, letterSpacing: TR_HERO, lineHeight: 1.05, color: "var(--color-label)" }}>
            Шрила Прабхупада
          </h2>
          <div style={{ marginTop: 4, fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 14, color: "var(--color-label-3)" }}>
            А. Ч. Бхактиведанта Свами · 1896 — 1977
          </div>
          <div style={{ marginTop: 16, borderRadius: 18, overflow: "hidden", background: IMG_BG }}>
            <img src="/media/prabhupada-color.webp" alt="" loading="lazy" style={{ width: "100%", display: "block", aspectRatio: "4 / 3", objectFit: "cover", objectPosition: "center 22%" }} />
          </div>
          <div style={{ margin: "20px 0 0" }}>
            <Quote center size={16}>«Лучшее, что можно сделать для Господа, — это попытаться вдохнуть преданное служение в сердце обусловленной души, чтобы она сбросила оковы обусловленной жизни».</Quote>
          </div>

          <div style={{ marginTop: 26, fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, letterSpacing: TR_TITLE, color: "var(--color-label)" }}>Жизнь</div>
          {SP_BIO.map((p, i) => <Para key={i} mt={i ? 12 : 10}>{p}</Para>)}

          <div style={{ marginTop: 26, fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, letterSpacing: TR_TITLE, color: "var(--color-label)" }}>За двенадцать лет проповеди</div>
          <p style={{ margin: "8px 0 0", fontFamily: "var(--font-text)", fontSize: 13.5, color: "var(--color-label-3)" }}>С 1965 по 1977 год Шрила Прабхупада:</p>
          <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none" }}>
            {SP_BIO_BULLETS.map((b, i) => (
              <li key={i} style={{ display: "flex", gap: 10, marginTop: i ? 8 : 0, fontFamily: "var(--font-text)", fontSize: 14.5, lineHeight: 1.55, letterSpacing: TR_BODY, color: "var(--color-label-2)" }}>
                <span aria-hidden style={{ flexShrink: 0, color: GOLD, fontWeight: 700 }}>·</span><span>{b}</span>
              </li>
            ))}
          </ul>

          <div style={{ marginTop: 26, fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, letterSpacing: TR_TITLE, color: "var(--color-label)" }}>Главные ценности</div>
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {SP_FACTS.map((f) => (
              <div key={f.t} style={{ padding: 14, ...fill, borderRadius: 14 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 13.5, fontWeight: 700, letterSpacing: TR_TITLE, color: "var(--color-label)" }}>{f.t}</div>
                <p style={{ margin: "5px 0 0", fontFamily: "var(--font-text)", fontSize: 12.5, lineHeight: 1.45, letterSpacing: TR_BODY, color: "var(--color-label-2)" }}>{f.d}</p>
              </div>
            ))}
          </div>

          {SP_BIO_TAIL.map((p, i) => <Para key={`t${i}`} mt={i ? 12 : 22}>{p}</Para>)}
          <Para mt={12}>{SP_BIO_AFTER}</Para>

          <div style={{ marginTop: 24, padding: "14px 16px", ...fill, borderRadius: 14, textAlign: "center" }}>
            <Quote center size={15}>«Повторяйте Харе Кришна и будьте счастливы».</Quote>
            <div style={{ marginTop: 8, fontFamily: "var(--font-text)", fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLD }}>Шрила Прабхупада</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────── экран ───────── */
export default function HomeScreen({ onChange, onOpenBook, onOpenEntity, onDonate, onBookMenu, flash }: {
  onChange: (tab: string) => void;
  onOpenBook: (work: string) => void;
  onOpenEntity: (id: string, type: string | null) => void;
  onDonate: () => void;
  onBookMenu: (work: string, id: string) => void;
  flash: (m: string) => void;
}) {
  useEffect(() => { fetch(api("/entities/prabhupada")).catch(() => {}); }, []);
  const [spOpen, setSpOpen] = useState(false);

  return (
    <div style={{ fontFamily: "var(--font-text)" }}>
      {/* HERO */}
      <MaskMark src="/iskcon.svg" size={50} color={GOLD} />
      <h1 style={{ margin: "16px 0 0", fontFamily: "var(--font-display)", fontSize: "clamp(27px, 7.8vw, 32px)", fontWeight: 800, letterSpacing: TR_HERO, lineHeight: 1.06, color: "var(--color-label)" }}>
        Служение.<br />Преданность. Любовь.
      </h1>
      <Para mt={12}>Великая духовная традиция, существующая более 5000 лет, была возрождена и зарегистрирована святым Шрилой Прабхупадой 13 июля 1966 года. Это Всемирное Движение Харе Кришна, ИСККОН, предсказанное ведическими писаниями и развиваемое веками линией духовных учителей, — его главная миссия помочь каждой душе восстановить её вечную любовную связь с Богом.</Para>
      <Figure src="/media/prabhupada-color.webp" ratio="4 / 3" pos="center 22%"
        caption="Ачарья-основатель ИСККОН — Его Божественная Милость А. Ч. Бхактиведанта Свами Шрила Прабхупада" />

      {/* Скитания */}
      <Section>
        <div style={{ padding: 18, ...fill }}>
          <Quote size={15}>
            «В одиночестве, без друзей и ресурсов, он бродил по улицам города в своих шафрановых одеждах. То, что он видел вокруг, не внушало доверия. „Что я могу сделать? Кто примет это послание, особенно в стране, настолько поглощённой материализмом? У меня нет надежды, но я попробую…“» — вспоминал Шрила Прабхупада.
          </Quote>
        </div>
        <Figure src="/media/prabhupada-nyc.webp" ratio="3 / 2" pos="center 28%" />
      </Section>

      {/* ИСККОН сегодня */}
      <Section>
        <SectionHead eyebrow="Сегодня" title="ИСККОН сегодня" subtitle="Движение Харе Кришна — мировое духовное сообщество, объединяющее миллионы людей более чем в 80 странах. Это движение милосердия и любви распространилось на все континенты." />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {STATS.map((s) => <StatTile key={s.l} v={s.v} l={s.l} />)}
        </div>
        <div style={{ marginTop: 26, fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, letterSpacing: TR_TITLE, color: "var(--color-label)" }}>Храмы по всему миру</div>
        <Carousel items={TEMPLES} />
      </Section>

      {/* Высшая цель */}
      <Section>
        <SectionHead eyebrow="Высшая цель" title="Чистая любовь к Богу" subtitle="Движение Харе Кришна исследует науку чистой преданной любви к Богу, воплощённой в божественной паре: Кришне и Его высшей энергии любви, Шримати Радхарани (Харе)." />
        <Photo src="/media/radha-krishna.webp" ratio="16 / 10" radius={22} />
      </Section>

      {/* Маха-мантра */}
      <Section>
        <div style={{ padding: 22, ...fill }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-text)", fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLD }}>Маха-мантра</div>
            <div style={{ marginTop: 12, fontFamily: "var(--font-scripture)", fontSize: 15, lineHeight: 1.8, color: "var(--color-label-3)" }}>
              हरे कृष्ण हरे कृष्ण<br />कृष्ण कृष्ण हरे हरे<br />हरे राम हरे राम<br />राम राम हरे हरे
            </div>
            <div style={{ marginTop: 14, fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700, letterSpacing: TR_TITLE, lineHeight: 1.55, color: "var(--color-label)" }}>
              Харе Кришна, Харе Кришна,<br />Кришна Кришна, Харе Харе<br />Харе Рама, Харе Рама,<br />Рама Рама, Харе Харе
            </div>
            <p style={{ margin: "14px 0 0", fontFamily: "var(--font-text)", fontSize: 13.5, lineHeight: 1.55, letterSpacing: TR_BODY, color: "var(--color-label-2)" }}>
              Каждый может получить духовное благо от повторения маха-мантры Харе Кришна. Когда звучит трансцендентная вибрация святого имени, благо получают все живые существа — даже деревья, животные и насекомые. Так человек проявляет высшее милосердие ко всему миру.
            </p>
          </div>
        </div>
        <Figure src="/media/krishna-hero.webp" ratio="16 / 9" caption="«Кришна» — «Всепривлекающий», Верховная Личность Бога" />
      </Section>

      {/* История регистрации / NYT — вырезка целиком, без кадрирования */}
      <Section>
        <div style={{ padding: 18, ...fill }}>
          <Para>После года скитаний и привлечения первых последователей в Нью-Йорке Шрила Прабхупада зарегистрировал Международное общество сознания Кришны (ИСККОН) в июле 1966 года. Через месяц в The New York Times вышла статья «Свами поёт в парке в поисках экстаза» — о «50 последователях, которые хлопают и качаются под гипнотическую музыку на церемонии на Ист-Сайде». В мгновение ока популярность Движения Харе Кришна взлетела.</Para>
        </div>
        <div style={{ marginTop: 16 }}><Photo src="/media/site/nyt-clip.webp" radius={20} /></div>
      </Section>

      {/* Высший образ жизни */}
      <Section>
        <SectionHead eyebrow="Практика" title="Высший образ жизни" subtitle="Духовный путь бхакти-йоги — это практика любовного преданного служения Богу, воплощённому в вечной божественной паре: Кришне и Шримати Радхарани (Харе)." />
        <ul style={{ margin: 0, padding: 0, listStyle: "none", overflow: "hidden", ...fill }}>
          {FORMS.map((f, i) => {
            const tap = !!f.go;
            return (
              <li key={f.t} style={{ borderTop: i ? "0.5px solid var(--color-hairline)" : "none" }}>
                <button type="button" disabled={!tap} onClick={() => f.go && onChange(f.go)}
                  onPointerDown={(e) => { if (tap) e.currentTarget.style.background = "var(--color-hover)"; }}
                  onPointerUp={(e) => { if (tap) e.currentTarget.style.background = "transparent"; }}
                  onPointerLeave={(e) => { if (tap) e.currentTarget.style.background = "transparent"; }}
                  style={{ display: "flex", gap: 13, width: "100%", textAlign: "left", padding: PAD, background: "transparent", border: "none", cursor: tap ? "pointer" : "default", alignItems: "flex-start" }}>
                  <span style={{ flexShrink: 0, width: 20, fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700, color: GOLD, lineHeight: 1.55 }}>{String(i + 1).padStart(2, "0")}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, letterSpacing: TR_TITLE, color: "var(--color-label)" }}>{f.t}</span>
                      {tap && <span style={{ marginLeft: "auto", flexShrink: 0, color: "var(--color-label-3)", display: "grid", placeItems: "center" }}><ChevRightIcon size={16} /></span>}
                    </span>
                    <span style={{ display: "block", marginTop: 4, fontFamily: "var(--font-text)", fontSize: 13, lineHeight: 1.5, letterSpacing: TR_BODY, color: "var(--color-label-2)" }}>{f.d}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Section>

      {/* Дхама — карточки-направления с лейблом поверх фото */}
      <Section>
        <SectionHead eyebrow="Дхама" title="Святые места" subtitle="Дхамы — святые места, неотличные от духовного мира, где обитают Кришна и Радхарани. Их посещение углубляет духовное сознание и приближает к Богу." />
        <div style={{ display: "grid", gap: 12 }}>
          <PlaceCard src="/media/vrindavan.webp" title="Вриндаван" sub="Земля игр Кришны" />
          <PlaceCard src="/media/mayapur.webp" title="Маяпур" sub="Место явления Шри Чайтаньи Махапрабху" />
        </div>
      </Section>

      {/* Жизнь общины — мозаика без подписей */}
      <Section>
        <SectionHead eyebrow="Жизнь общины" title="Праздники и прасад" subtitle="Санкиртана, ратха-ятры и раздача освящённой пищи — живое сердце Движения Харе Кришна по всему миру." />
        <Mosaic items={COMMUNITY} />
      </Section>

      {/* Книги — слайдер всей читаемой библиотеки Шрилы Прабхупады */}
      <Section>
        <SectionHead eyebrow="Библиотека" title="Миллиард духовных книг" subtitle="ИСККОН распространяет древнюю священную литературу на 89 языках, помогая людям найти смысл жизни, организовать её согласно духовным принципам и научиться служить и любить Бога." />
        <div style={{ display: "flex", gap: 12, overflowX: "auto", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch",
          margin: `4px -${PAD}px 0`, padding: `12px ${PAD}px`, scrollPaddingLeft: PAD, scrollbarWidth: "none" }}>
          {LIBRARY.filter((b) => b.lineage === "prabhupada" && b.readable && BOOKS[b.id]).map((b) => (
            <div key={b.id} style={{ flex: "0 0 88%", scrollSnapAlign: "center" }}>
              <BookHeroCard
                book={BOOKS[b.id]}
                topLeft={<MaskMark src="/bbt.svg" size={26} color="#fff" />}
                onOpen={() => onOpenBook(b.id)}
                flash={flash}
                onListen={AUDIO_WORKS[b.id] ? undefined : () => flash("Аудиокнига — скоро")}
                onMenuSelect={(id) => onBookMenu(b.id, id)}
              />
            </div>
          ))}
          <div aria-hidden style={{ flex: `0 0 ${PAD - 12}px` }} />
        </div>
      </Section>

      {/* Шрила Прабхупада — тизер + таймлайн; полная биография за кнопкой */}
      <Section>
        <SectionHead eyebrow="Ачарья-основатель" title="Шрила Прабхупада" subtitle="Выдающийся духовный учитель, принёсший сознание Кришны в западный мир и заложивший основы глобального вайшнавского возрождения. Его жизнь с любовью описана в семитомной «Шрила Прабхупада-лиламрите», читаемой по всему миру." />
        <Photo src="/media/prabhupada.webp" ratio="3 / 2" pos="center 22%" radius={22} />
        <div style={{ margin: "20px 0 0", padding: "0 8px" }}>
          <Quote center size={16}>«Лучшее, что можно сделать для Господа, — это попытаться вдохнуть преданное служение в сердце обусловленной души, чтобы она сбросила оковы обусловленной жизни».</Quote>
        </div>
        <div style={{ marginTop: 26, position: "relative", padding: "4px 4px 4px 18px" }}>
          {/* вертикальная хайрлайн-линия */}
          <div aria-hidden style={{ position: "absolute", left: 3, top: 6, bottom: 6, width: 1, background: "var(--color-hairline)" }} />
          {TIMELINE.map((t, i) => (
            <div key={t.y} style={{ position: "relative", marginTop: i ? 22 : 0 }}>
              {/* золотая точка-маркер на линии */}
              <span aria-hidden style={{ position: "absolute", left: -19, top: 6, width: 9, height: 9, borderRadius: "50%", background: GOLD, boxShadow: "0 0 0 4px var(--color-bg)" }} />
              <div style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 800, letterSpacing: "0.4px", color: GOLD, lineHeight: 1.2 }}>{t.y}</div>
              <p style={{ margin: "4px 0 0", fontFamily: "var(--font-text)", fontSize: 14, lineHeight: 1.55, letterSpacing: TR_BODY, color: "var(--color-label-2)" }}>{t.d}</p>
            </div>
          ))}
        </div>
        {/* Apple-style ссылка-«Подробнее» — открывает iOS-шит с биографией и ценностями */}
        <button type="button" onClick={() => setSpOpen(true)}
          onPointerDown={(e) => (e.currentTarget.style.opacity = "0.55")} onPointerUp={(e) => (e.currentTarget.style.opacity = "1")} onPointerLeave={(e) => (e.currentTarget.style.opacity = "1")}
          style={{ marginTop: 18, padding: "8px 2px", background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4,
            fontFamily: "var(--font-text)", fontSize: 15, fontWeight: 600, letterSpacing: TR_BODY, color: "var(--color-brand-blue)", WebkitTapHighlightColor: "transparent" }}>
          Подробнее о Шриле Прабхупаде
          <ChevRightIcon size={16} />
        </button>
        <SquareGrid items={SP_LIFE} />
      </Section>

      {/* Принципы */}
      <Section>
        <SectionHead eyebrow="Принципы ИСККОН" title="Ничего лишнего" subtitle="Четыре регулирующих принципа свободы." />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {PRINCIPLES.map((p) => (
            <div key={p.t} style={{ padding: PAD, ...fill, borderRadius: 16 }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 14.5, fontWeight: 700, letterSpacing: TR_TITLE, color: "var(--color-label)", lineHeight: 1.2 }}>{p.t}</div>
              <p style={{ margin: "7px 0 0", fontFamily: "var(--font-text)", fontSize: 12.5, lineHeight: 1.45, letterSpacing: TR_BODY, color: "var(--color-label-2)" }}>{p.d}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* На всей планете — редакторский формат с минималистическими разделителями */}
      <Section>
        <SectionHead eyebrow="На всей планете" title="Влияние на весь мир" subtitle="Лидеры об ИСККОН и Движении Харе Кришна." />
        <div>
          {VOICES.map((v, i) => (
            <figure key={v.n} style={{ margin: 0, paddingTop: i ? 24 : 0, paddingBottom: 24, borderTop: i ? "0.5px solid var(--color-hairline)" : "none" }}>
              <Quote size={17.5}>«{v.c}»</Quote>
              <figcaption style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12 }}>
                <img src={`/media/voices/${v.img}.webp`} alt="" loading="lazy" style={{ flexShrink: 0, width: 40, height: 40, borderRadius: "50%", objectFit: "cover", background: IMG_BG }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--font-text)", fontSize: 14.5, fontWeight: 700, letterSpacing: TR_BODY, color: "var(--color-label)" }}>{v.n}</div>
                  <div style={{ marginTop: 1, fontFamily: "var(--font-text)", fontSize: 12.5, color: "var(--color-label-3)" }}>{v.r}</div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </Section>

      {/* Forbes — редакторская плашка с настоящим лого */}
      <Section>
        <div style={{ padding: "26px 22px", ...fill, borderRadius: 22 }}>
          <MaskMark src="/forbes.svg" size={92} color="var(--color-label)" pos="left center" />
          <div style={{ marginTop: 16, fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 17, lineHeight: 1.55, letterSpacing: TR_BODY, color: "var(--color-label)" }}>
            «За последние полвека ИСККОН достиг впечатляющих результатов в общественном служении и благотворительности: ежедневно 1,2 миллиона школьников получают питание в Индии, а больница Бхактиведанты за прошлый год приняла более 200 000 пациентов».
          </div>
        </div>
      </Section>

      {/* 7 целей */}
      <Section>
        <SectionHead eyebrow="Миссия" title="7 целей ИСККОН" subtitle="Семь основных целей, лично сформулированных Шрилой Прабхупадой при основании общества." />
        <ul style={{ margin: 0, padding: 0, listStyle: "none", overflow: "hidden", ...fill }}>
          {PURPOSES.map((p, i) => (
            <li key={i} style={{ display: "flex", gap: 13, padding: PAD, alignItems: "flex-start", borderTop: i ? "0.5px solid var(--color-hairline)" : "none" }}>
              <span style={{ flexShrink: 0, width: 20, fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700, color: GOLD, lineHeight: 1.55 }}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ fontFamily: "var(--font-text)", fontSize: 14, lineHeight: 1.55, letterSpacing: TR_BODY, color: "var(--color-label-2)" }}>{p}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* Великая традиция — парампара */}
      <Section>
        <SectionHead eyebrow="Великая традиция" title="Брахма-Мадхва-Гаудия-сампрадая" subtitle="Непрерывная цепь духовных учителей и учеников, по которой вечное знание дошло до наших дней." />
        <div style={{ position: "relative", marginTop: 22, paddingLeft: 26 }}>
          <span aria-hidden style={{ position: "absolute", left: 5, top: 6, bottom: 6, width: 2, background: `linear-gradient(to bottom, ${GOLD}, color-mix(in srgb, ${GOLD} 25%, transparent))` }} />
          {PARAMPARA.map((p, i) => (
            <div key={i} style={{ position: "relative", paddingBottom: i === PARAMPARA.length - 1 ? 0 : 22 }}>
              <span aria-hidden style={{ position: "absolute", left: -26, top: 4, width: 12, height: 12, borderRadius: "50%", background: i === PARAMPARA.length - 1 || i === 0 ? GOLD : "var(--color-bg)", border: `2px solid ${GOLD}`, boxShadow: "0 0 0 4px var(--color-bg)" }} />
              <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, letterSpacing: "-0.2px", color: "var(--color-label)", lineHeight: 1.25 }}>{p.name}</div>
              <div style={{ marginTop: 2, fontFamily: "var(--font-text)", fontSize: 13, color: "var(--color-label-3)", lineHeight: 1.35 }}>{p.note}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Продолжите путь */}
      <Section>
        <SectionHead title="Продолжите путь" />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <NavCard mark={<MaskMark src="/bbt.svg" size={28} />} title="Книги" subtitle="БГ · ШБ · ЧЧ и труды ачарьев" onClick={() => onChange("books")} />
          <NavCard mark={<MaskMark src="/gauranga.svg" size={26} />} title="Киртаны" subtitle="Бхаджаны, молитвы и мантры" onClick={() => onChange("kirtans")} />
          <NavCard mark={<MaskMark src="/prabhupada.svg" size={30} pos="center bottom" />} title="Ачарья" subtitle="Господь, аватары и спутники" onClick={() => onChange("acharya")} />
          <NavCard mark={<MaskMark src="/iskcon-one-love-mark.svg" size={28} color={GOLD} />} title="Поддержать служение" subtitle="Стать частью миссии" onClick={onDonate} accent />
        </div>
      </Section>

      {/* Футер */}
      <Section>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 13, color: "var(--color-label-3)", lineHeight: 1.7 }}>
            Hare Kṛṣṇa Hare Kṛṣṇa Kṛṣṇa Kṛṣṇa Hare Hare<br />Hare Rāma Hare Rāma Rāma Rāma Hare Hare
          </div>
          <p style={{ margin: "16px auto 0", maxWidth: 380, fontFamily: "var(--font-text)", fontSize: 11, lineHeight: 1.6, letterSpacing: TR_BODY, color: "var(--color-label-3)" }}>
            Ачарья-основатель Международного общества сознания Кришны (ИСККОН) Его Божественная Милость Абхай Чаранаравинда Бхактиведанта Свами Шрила Прабхупада. «Что бы ты делал, о нищий с каменным сердцем, если бы искренние садху с цветущими сердцами не проявляли здесь Вриндаван? Что бы ты делал?» ISKCON ONE LOVE — онлайн-ресурс последователей традиции ISKCON из разных стран, относящейся к Брахма-Мадхва-Гаудия-сампрадае, созданный как пространство вдохновения и внутреннего диалога для тех, кто ценит наследие Ачарьи-основателя Международного общества сознания Кришны (ISKCON) Его Божественной Милости А. Ч. Бхактиведанты Свами Шрилы Прабхупады, его духовную миссию и её проявление в этом мире как беспрецедентную волну Гауранга-лилы. ISKCON ONE LOVE не является официальным ресурсом какой-либо зарегистрированной организации ISKCON (ИСККОН), не представляет её административные структуры и не осуществляет миссионерскую деятельность. Все материалы публикуются в культурно-просветительском и личном контексте.
          </p>
        </div>
      </Section>

      <PrabhupadaSheet open={spOpen} onClose={() => setSpOpen(false)} />
    </div>
  );
}
