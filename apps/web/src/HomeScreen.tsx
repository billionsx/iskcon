/**
 * HomeScreen — «Главная». Стандарт iOS 26: фон и поверхности через токены
 * (--color-bg / --color-bg-2) — светлая тема белая, тёмная подхватывается
 * автоматически. Карточки белые с hairline 0.5px и мягкой тенью, типографика
 * на --font-display (SF) с тесным трекингом, цитаты — Georgia курсивом.
 * Текст — ПОЛНЫЙ, как на сайте iskcone (биография целиком, история NYT и т.д.).
 * Открывается логотипом-эмблемой (без дубля «ISKCON ONE LOVE» — он в шапке).
 */
import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { BOOKS } from "./books";
import { ChevRightIcon } from "./ui/icons";

const GOLD = "#D2AA1B";
const S = 36;   // отступ между блоками
const PAD = 16; // отступ от краёв внутри блоков

const card: React.CSSProperties = { background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)", borderRadius: 18, boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 10px 26px -14px rgba(0,0,0,0.12)" };
const tile: React.CSSProperties = { background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)", borderRadius: 14 };
const TR_HERO = "-0.03em", TR_TITLE = "-0.022em", TR_BODY = "-0.01em";

/* ───────── помощники ───────── */
function MaskMark({ src, size = 28, color = "var(--color-label)", pos = "center" }: { src: string; size?: number; color?: string; pos?: string }) {
  return <span aria-hidden style={{ display: "block", width: size, height: size, backgroundColor: color,
    WebkitMaskImage: `url(${src})`, maskImage: `url(${src})`, WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
    WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskPosition: pos, maskPosition: pos }} />;
}
function SectionHead({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {eyebrow && <div style={{ fontFamily: "var(--font-text)", fontSize: 11, fontWeight: 600, letterSpacing: "0.4px", textTransform: "uppercase", color: "var(--color-brand-blue)" }}>{eyebrow}</div>}
      <h2 style={{ margin: eyebrow ? "4px 0 0" : 0, fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, letterSpacing: TR_TITLE, lineHeight: 1.15, color: "var(--color-label)" }}>{title}</h2>
      {subtitle && <p style={{ margin: "8px 0 0", fontFamily: "var(--font-text)", fontSize: 14.5, lineHeight: 1.5, letterSpacing: TR_BODY, color: "var(--color-label-2)" }}>{subtitle}</p>}
    </div>
  );
}
function Section({ children, top = S }: { children: React.ReactNode; top?: number }) {
  return <section style={{ marginTop: top }}>{children}</section>;
}
function Figure({ src, ratio = "4 / 3", pos = "center", caption }: { src: string; ratio?: string; pos?: string; caption?: string }) {
  return (
    <figure style={{ margin: "14px 0 0" }}>
      <div style={{ borderRadius: 18, overflow: "hidden", border: "0.5px solid var(--color-hairline)", background: "var(--color-fill-1)" }}>
        <img src={src} alt="" loading="lazy" style={{ width: "100%", display: "block", aspectRatio: ratio, objectFit: "cover", objectPosition: pos }} />
      </div>
      {caption && <figcaption style={{ margin: "10px auto 0", maxWidth: 440, textAlign: "center", fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 13, letterSpacing: TR_BODY, color: "var(--color-label-3)", lineHeight: 1.45 }}>{caption}</figcaption>}
    </figure>
  );
}
function PhotoGrid({ items, ratio = "4 / 3", cols = 2 }: { items: { src: string; cap?: string; pos?: string }[]; ratio?: string; cols?: number }) {
  return (
    <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 10 }}>
      {items.map((it, i) => (
        <figure key={i} style={{ margin: 0 }}>
          <div style={{ borderRadius: 14, overflow: "hidden", border: "0.5px solid var(--color-hairline)", background: "var(--color-fill-1)" }}>
            <img src={it.src} alt="" loading="lazy" style={{ width: "100%", display: "block", aspectRatio: ratio, objectFit: "cover", objectPosition: it.pos || "center" }} />
          </div>
          {it.cap && <figcaption style={{ margin: "8px 4px 0", textAlign: "center", fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 12.5, color: "var(--color-label-3)", lineHeight: 1.4 }}>{it.cap}</figcaption>}
        </figure>
      ))}
    </div>
  );
}
function Rail({ items, w = 230, ratio = "4 / 3" }: { items: { src: string; cap?: string; pos?: string }[]; w?: number; ratio?: string }) {
  return (
    <div style={{ marginTop: 14, display: "flex", gap: 10, overflowX: "auto", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", paddingBottom: 6, margin: `14px -${PAD}px 0`, paddingLeft: PAD, paddingRight: PAD, scrollbarWidth: "none" }}>
      {items.map((it, i) => (
        <figure key={i} style={{ margin: 0, flex: "0 0 auto", width: w, scrollSnapAlign: "start" }}>
          <div style={{ borderRadius: 14, overflow: "hidden", border: "0.5px solid var(--color-hairline)", background: "var(--color-fill-1)" }}>
            <img src={it.src} alt="" loading="lazy" style={{ width: "100%", display: "block", aspectRatio: ratio, objectFit: "cover", objectPosition: it.pos || "center" }} />
          </div>
          {it.cap && <figcaption style={{ margin: "8px 2px 0", textAlign: "center", fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 12, color: "var(--color-label-3)", lineHeight: 1.35 }}>{it.cap}</figcaption>}
        </figure>
      ))}
    </div>
  );
}
function Quote({ children, center = false, size = 15, color = "var(--color-label)" }: { children: React.ReactNode; center?: boolean; size?: number; color?: string }) {
  return <blockquote style={{ margin: 0, fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: size, lineHeight: 1.6, letterSpacing: TR_BODY, color, textAlign: center ? "center" : "left" }}>{children}</blockquote>;
}
function Para({ children, mt = 0 }: { children: React.ReactNode; mt?: number }) {
  return <p style={{ margin: `${mt}px 0 0`, fontFamily: "var(--font-text)", fontSize: 14.5, lineHeight: 1.6, letterSpacing: TR_BODY, color: "var(--color-label-2)" }}>{children}</p>;
}
function NavCard({ mark, title, subtitle, onClick, accent }: { mark: React.ReactNode; title: string; subtitle: string; onClick: () => void; accent?: boolean }) {
  const ring: React.CSSProperties = accent
    ? { border: `1.5px solid color-mix(in srgb, ${GOLD} 55%, transparent)`, background: `color-mix(in srgb, ${GOLD} 10%, transparent)` }
    : { border: "0.5px solid var(--color-hairline)", background: "var(--color-fill-1)" };
  return (
    <button type="button" onClick={onClick}
      onPointerDown={(e) => (e.currentTarget.style.opacity = "0.7")} onPointerUp={(e) => (e.currentTarget.style.opacity = "1")} onPointerLeave={(e) => (e.currentTarget.style.opacity = "1")}
      style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", padding: PAD, textAlign: "left", cursor: "pointer", ...card }}>
      <span style={{ flexShrink: 0, width: 52, height: 52, borderRadius: "50%", display: "grid", placeItems: "center", ...ring }}>{mark}</span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, letterSpacing: TR_TITLE, color: "var(--color-label)" }}>{title}</span>
        <span style={{ display: "block", marginTop: 3, fontFamily: "var(--font-text)", fontSize: 13, lineHeight: 1.4, letterSpacing: TR_BODY, color: "var(--color-label-2)" }}>{subtitle}</span>
      </span>
      <span style={{ flexShrink: 0, color: "var(--color-label-3)", display: "grid", placeItems: "center" }}><ChevRightIcon size={18} /></span>
    </button>
  );
}
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
    <div style={{ padding: PAD, ...tile }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 27, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--color-label)", lineHeight: 1, whiteSpace: "nowrap" }}><CountUp value={v} /></div>
      <div style={{ marginTop: 6, fontFamily: "var(--font-text)", fontSize: 12, letterSpacing: TR_BODY, color: "var(--color-label-3)", lineHeight: 1.3 }}>{l}</div>
    </div>
  );
}

/* ───────── данные (ПОЛНЫЙ текст сайта) ───────── */
const TEMPLES = [
  { src: "/media/site/temple-mayapur.webp", cap: "Маяпур, Индия" },
  { src: "/media/site/temple-tovp.webp", cap: "Храм ведического планетария" },
  { src: "/media/site/temple-mumbai.webp", cap: "Мумбаи" },
  { src: "/media/site/temple-chennai.webp", cap: "Ченнаи" },
  { src: "/media/site/temple-delhi.webp", cap: "Нью-Дели" },
  { src: "/media/site/temple-tirupati.webp", cap: "Тирупати" },
  { src: "/media/site/temple-ahmedabad.webp", cap: "Ахмедабад" },
  { src: "/media/site/temple-rohini.webp", cap: "Рохини" },
  { src: "/media/site/temple-kanpur.webp", cap: "Канпур" },
  { src: "/media/site/temple-noida.webp", cap: "Нойда" },
  { src: "/media/site/temple-siliguri.webp", cap: "Силигури" },
  { src: "/media/site/temple-ananthapur.webp", cap: "Анантапур" },
  { src: "/media/site/temple-newvrindaban.webp", cap: "Нью-Вриндаван, США" },
];
const SP_LIFE = [
  { src: "/media/site/sp-arrival.webp", cap: "Прибытие в Америку, 1965" },
  { src: "/media/site/sp-japa.webp", cap: "Джапа-медитация" },
  { src: "/media/site/sp-harmonium.webp", cap: "Киртан на фисгармонии" },
  { src: "/media/site/sp-walk.webp", cap: "Утренняя прогулка с учениками" },
  { src: "/media/site/sp-lecture.webp", cap: "Лекция по «Бхагавад-гите»" },
  { src: "/media/site/sp-prasad.webp", cap: "Раздача прасада" },
  { src: "/media/site/sp-banner.webp", cap: "Проповедь на улицах" },
  { src: "/media/site/sp-beach.webp", cap: "С учениками у океана" },
  { src: "/media/site/sp-portrait.webp", cap: "Шрила Прабхупада" },
];
const COMMUNITY = [
  { src: "/media/site/fest-ratha1.webp", cap: "Ратха-ятра" },
  { src: "/media/site/fest-ratha2.webp", cap: "Праздник колесниц" },
  { src: "/media/site/fest-1.webp", cap: "Фестиваль" },
  { src: "/media/site/fest-pandal.webp", cap: "Праздничный пандал" },
  { src: "/media/site/fest-2.webp", cap: "Санкиртана" },
  { src: "/media/site/prasad-thali.webp", cap: "Прасад — освящённая пища" },
  { src: "/media/site/prasad-give.webp", cap: "Раздача прасада" },
  { src: "/media/site/prasad-eat.webp", cap: "Праздник прасада" },
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
  { img: "", c: "Меня вдохновляет работа этого храма и общины здесь. Это не только место великой духовности — конечно, оно привлекает сотни тысяч людей, и Манор объединяет людей самых разных слоёв общества.", n: "Борис Джонсон", r: "экс-премьер-министр Великобритании" },
  { img: "jobs", c: "Я проходил 7 миль через весь город каждую неделю, чтобы в воскресенье вечером получить хорошее блюдо в храме Харе Кришна.", n: "Стив Джобс", r: "сооснователь Apple Inc." },
  { img: "", c: "Я прочитал 90 процентов «Бхагавад-гиты». Когда я её читаю, мой внутренний Арджуна направляется на верный путь.", n: "Уилл Смит", r: "голливудский актёр" },
  { img: "lennon", c: "Повторение мантры Харе Кришна — это вид медитации, который может действительно вызвать состояние экстаза.", n: "Джон Леннон", r: "музыкант, The Beatles" },
  { img: "modi", c: "ИСККОН научил мир истинному значению веры.", n: "Нарендра Моди", r: "премьер-министр Индии" },
  { img: "harrison", c: "Он был идеальным примером всего, чему учил. Не имея ничего материального, но обладая сознанием Кришны, он привлёк тысячи преданных и основал целое движение, которое остаётся сильным даже после его ухода и продолжает расти с каждым днём.", n: "Джордж Харрисон", r: "музыкант, The Beatles" },
  { img: "mukherjee", c: "Я выражаю глубокую признательность и уважение Его Божественной Милости А. Ч. Бхактиведанте Свами Шриле Прабхупаде, который распространил послание сознания Кришны по всему миру. Его влияние продолжает звучать в сердцах преданных даже сегодня.", n: "Шри Пранаб Мукерджи", r: "13-й президент Индии" },
  { img: "sunak", c: "В самые трудные времена я получал учения из «Гиты», и именно «Гита» давала мне силу продолжать бороться за то, во что я верю.", n: "Риши Сунак", r: "премьер-министр Великобритании" },
];
const BOOKLIST = [
  { work: "bg", t: "Бхагавад-гита как она есть", d: "Вечный диалог между Кришной (Богом) и Арджуной (душой), в котором Кришна даёт практические наставления о том, как правильно организовать свою жизнь и достичь духовного совершенства, чтобы вернуться домой к Богу." },
  { work: "sb", t: "Шримад-Бхагаватам", d: "Великий древний текст, который описывает, как Верховная Личность Бога, Кришна, приходит в различных формах, в разные эпохи и к людям с разной степенью преданности к Богу." },
  { work: "cc", t: "Шри Чайтанья-чаритамрита", d: "Священный текст о божественных играх самой милостивой формы Бога — Шри Чайтаньи Махапрабху, объединённого воплощения Кришны и Шримати Радхарани (Харе), пришедшего даровать всем чистую любовь к Богу." },
];
const BIO: string[] = [
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
const BIO_BULLETS = [
  "основал ИСККОН, который распространился по всему миру, создав сотни храмов, центров, общин и образовательных учреждений;",
  "вернул сознание Кришны из Запада обратно в Индию, вдохнув новую жизнь в святые места Вриндавана и Маяпура;",
  "перевёл и прокомментировал ключевые вайшнавские писания — «Бхагавад-гиту как она есть», «Шримад-Бхагаватам», «Шри Чайтанья-чаритамриту» и многие другие;",
  "инициировал тысячи учеников по всему миру;",
  "четырнадцать раз облетел земной шар, проповедуя бхакти людям всех культур;",
  "основал программу Food for Life, распространяя милосердие через освящённую пищу.",
];
const BIO_TAIL: string[] = [
  "В 1977 году, во Вриндаване, Шрила Прабхупада покинул этот мир, окружённый заботой и любовью своих учеников. Однако он продолжает жить через свои книги, свою миссию и через миллионы сердец, которых коснулась эта беспрецедентная волна Гауранга-лилы.",
  "Сегодня Шрила Прабхупада почитается как мировой ачарья — для всех вайшнавов, независимо от страны, культуры и языка, — как личность, исполнившая сокровенное желание Шри Чайтаньи Махапрабху: распространить святое имя Кришны и путь чистой бхакти по всей Земле.",
];
const BIO_AFTER = "Сегодня, более чем через пять десятилетий после основания ИСККОН, вы всё ещё можете услышать, как Харе Кришна поют на Юнион-сквер в Нью-Йорке, слышать их музыку, увековеченную в песнях Джорджа Харрисона, и найти миллионы последователей по всему миру. И это история.";
const FACTS = [
  { t: "Путешествие в Америку", d: "Покинув священный Вриндаван, Шрила Прабхупада отправился в Нью-Йорк в возрасте 69 лет. Имея при себе всего 7 долларов и несколько священных писаний, он столкнулся с многочисленными трудностями, но неуклонно продолжил свою миссию." },
  { t: "Всемирная проповедь", d: "Начав с повторения мантры Харе Кришна в парке, он основал первые храмы — это стало началом стремительного глобального распространения Движения Харе Кришна." },
  { t: "Литературное наследие", d: "Написал и перевёл на английский более 70 книг, включая «Бхагавад-гиту как она есть», «Шримад-Бхагаватам» и «Шри Чайтанья-чаритамриту», значительно повлияв на распространение ведических знаний." },
  { t: "Музыкальное влияние", d: "Представил киртан (пение святых имён) как форму медитации, завоевавшую популярность не только среди последователей, но и в широких кругах, включая The Beatles." },
  { t: "Культурные концепции", d: "Сыграл ключевую роль в популяризации понятий кармы, реинкарнации и йоги среди мировой аудитории, сделав эти термины широко известными." },
  { t: "Помощь нуждающимся", d: "Стремился, чтобы каждый в мире мог получить освящённую пищу — прасад. На сегодня роздано около 8,7 миллиарда порций, что сопоставимо с населением всей Земли." },
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

/* ───────── экран ───────── */
export default function HomeScreen({ onChange, onOpenBook, onOpenEntity, onDonate }: {
  onChange: (tab: string) => void;
  onOpenBook: (work: string) => void;
  onOpenEntity: (id: string, type: string | null) => void;
  onDonate: () => void;
}) {
  useEffect(() => { fetch(api("/entities/prabhupada")).catch(() => {}); }, []);

  return (
    <div style={{ fontFamily: "var(--font-text)" }}>
      {/* HERO — эмблема-лотос + заголовок */}
      <MaskMark src="/iskcon.svg" size={50} color={GOLD} />
      <h1 style={{ margin: "16px 0 0", fontFamily: "var(--font-display)", fontSize: "clamp(27px, 7.8vw, 32px)", fontWeight: 800, letterSpacing: TR_HERO, lineHeight: 1.06, color: "var(--color-label)" }}>
        Служение.<br />Преданность. Любовь.
      </h1>
      <Para mt={12}>Великая духовная традиция, существующая более 5000 лет, была возрождена и зарегистрирована святым Шрилой Прабхупадой 13 июля 1966 года. Это Всемирное Движение Харе Кришна, ИСККОН, предсказанное ведическими писаниями и развиваемое веками линией духовных учителей, — его главная миссия помочь каждой душе восстановить её вечную любовную связь с Богом.</Para>
      <Figure src="/media/prabhupada-color.webp" ratio="4 / 3" pos="center 22%"
        caption="Ачарья-основатель ИСККОН — Его Божественная Милость А. Ч. Бхактиведанта Свами Шрила Прабхупада" />

      {/* Скитания — цитата Georgia курсивом */}
      <Section>
        <div style={{ padding: PAD, ...card }}>
          <Quote size={15}>
            «В одиночестве, без друзей и ресурсов, он бродил по улицам города в своих шафрановых одеждах. То, что он видел вокруг, не внушало доверия. „Что я могу сделать? Кто примет это послание, особенно в стране, настолько поглощённой материализмом? У меня нет надежды, но я попробую…“» — вспоминал Шрила Прабхупада.
          </Quote>
        </div>
        <Figure src="/media/prabhupada-nyc.webp" ratio="3 / 2" pos="center 28%" caption="Нью-Йорк, 1965 — начало движения" />
      </Section>

      {/* ИСККОН сегодня */}
      <Section>
        <SectionHead eyebrow="Сегодня" title="ИСККОН сегодня" subtitle="Движение Харе Кришна — мировое духовное сообщество, объединяющее миллионы людей более чем в 80 странах. Это движение милосердия и любви распространилось на все континенты." />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {STATS.map((s) => <StatTile key={s.l} v={s.v} l={s.l} />)}
        </div>
        <div style={{ marginTop: 24, fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, letterSpacing: TR_TITLE, color: "var(--color-label)" }}>Храмы по всему миру</div>
        <Rail w={230} ratio="4 / 3" items={TEMPLES} />
      </Section>

      {/* Высшая цель */}
      <Section>
        <SectionHead eyebrow="Высшая цель" title="Чистая любовь к Богу" subtitle="Движение Харе Кришна исследует науку чистой преданной любви к Богу, воплощённой в божественной паре: Кришне и Его высшей энергии любви, Шримати Радхарани (Харе)." />
        <Figure src="/media/radha-krishna.webp" ratio="16 / 10" caption="Божества Радхи и Кришны на алтаре" />
        <Rail w={152} ratio="3 / 4" items={[
          { src: "/media/site/deity-radhakrishna.webp", cap: "Радха-Шьямасундара" },
          { src: "/media/krishna-portrait.webp", cap: "Шри Кришна", pos: "center 20%" },
          { src: "/media/radharani.webp", cap: "Шримати Радхарани" },
          { src: "/media/site/deity-krishna.webp", cap: "Кришна с Радхарани" },
        ]} />
      </Section>

      {/* Маха-мантра — карточка, 4 строки */}
      <Section>
        <div style={{ padding: 20, ...card }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-text)", fontSize: 11, fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLD }}>Маха-мантра</div>
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

      {/* История регистрации / NYT */}
      <Section>
        <div style={{ padding: PAD, ...card }}>
          <Para>После года скитаний и привлечения первых последователей в Нью-Йорке Шрила Прабхупада зарегистрировал Международное общество сознания Кришны (ИСККОН) в июле 1966 года. Через месяц в The New York Times вышла статья «Свами поёт в парке в поисках экстаза» — о «50 последователях, которые хлопают и качаются под гипнотическую музыку на церемонии на Ист-Сайде». В мгновение ока популярность Движения Харе Кришна взлетела.</Para>
        </div>
        <Figure src="/media/site/nyt-clip.webp" ratio="3 / 2" caption="The New York Times, 1966 — «Свами поёт в парке в поисках экстаза»" />
        <PhotoGrid ratio="4 / 3" items={[
          { src: "/media/site/hist-storefront.webp", cap: "Первый храм — 26 Second Avenue, Нью-Йорк" },
          { src: "/media/site/hist-park.webp", cap: "Киртан в парке Томпкинс-сквер" },
        ]} />
      </Section>

      {/* Высший образ жизни — grouped-список */}
      <Section>
        <SectionHead eyebrow="Практика" title="Высший образ жизни" subtitle="Духовный путь бхакти-йоги — это практика любовного преданного служения Богу, воплощённому в вечной божественной паре: Кришне и Шримати Радхарани (Харе)." />
        <ul style={{ margin: 0, padding: 0, listStyle: "none", overflow: "hidden", ...card }}>
          {FORMS.map((f, i) => {
            const tap = !!f.go;
            return (
              <li key={f.t} style={{ borderTop: i ? "0.5px solid var(--color-hairline)" : "none" }}>
                <button type="button" disabled={!tap} onClick={() => f.go && onChange(f.go)}
                  onPointerDown={(e) => { if (tap) e.currentTarget.style.background = "rgba(0,0,0,0.03)"; }}
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

      {/* Святые места — Дхама */}
      <Section>
        <SectionHead eyebrow="Дхама" title="Святые места" subtitle="Дхамы — святые места, неотличные от духовного мира, где обитают Кришна и Радхарани. Их посещение углубляет духовное сознание и приближает к Богу." />
        <PhotoGrid ratio="4 / 3" items={[
          { src: "/media/vrindavan.webp", cap: "Вриндаван — земля игр Кришны" },
          { src: "/media/mayapur.webp", cap: "Маяпур — место явления Шри Чайтаньи Махапрабху" },
        ]} />
      </Section>

      {/* Праздники, санкиртана и прасад */}
      <Section>
        <SectionHead eyebrow="Жизнь общины" title="Праздники и прасад" subtitle="Санкиртана, ратха-ятры и раздача освящённой пищи — живое сердце Движения Харе Кришна по всему миру." />
        <Rail w={230} ratio="4 / 3" items={COMMUNITY} />
      </Section>

      {/* Миллиард книг */}
      <Section>
        <SectionHead eyebrow="Библиотека" title="Миллиард духовных книг" subtitle="ИСККОН распространяет древнюю священную литературу на 89 языках, помогая людям найти смысл жизни, организовать её согласно духовным принципам и научиться служить и любить Бога." />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {BOOKLIST.map((b) => (
            <button key={b.work} type="button" onClick={() => onOpenBook(b.work)}
              onPointerDown={(e) => (e.currentTarget.style.opacity = "0.7")} onPointerUp={(e) => (e.currentTarget.style.opacity = "1")} onPointerLeave={(e) => (e.currentTarget.style.opacity = "1")}
              style={{ display: "flex", gap: 14, alignItems: "center", width: "100%", textAlign: "left", padding: PAD, cursor: "pointer", ...card }}>
              <img src={BOOKS[b.work]?.covers?.[0]} alt="" loading="lazy" style={{ flexShrink: 0, width: 60, height: 84, objectFit: "cover", borderRadius: 8, border: "0.5px solid var(--color-hairline)", background: "var(--color-fill-1)" }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, letterSpacing: TR_TITLE, color: "var(--color-label)", lineHeight: 1.25 }}>{b.t}</span>
                <span style={{ display: "block", marginTop: 5, fontFamily: "var(--font-text)", fontSize: 13, lineHeight: 1.45, letterSpacing: TR_BODY, color: "var(--color-label-2)" }}>{b.d}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 2, marginTop: 8, fontFamily: "var(--font-text)", fontSize: 13, fontWeight: 600, color: "var(--color-brand-blue)" }}>Читать онлайн <ChevRightIcon size={14} /></span>
              </span>
            </button>
          ))}
        </div>
      </Section>

      {/* Шрила Прабхупада — ПОЛНАЯ биография */}
      <Section>
        <SectionHead eyebrow="Ачарья-основатель" title="Шрила Прабхупада" subtitle="Основатель Движения Харе Кришна оказал значительное влияние на современную духовную историю, включая глобальное распространение ключевых концепций. Вот несколько фактов о его жизни и наследии." />
        <Figure src="/media/prabhupada.webp" ratio="3 / 2" pos="center 22%" caption="Шрила Прабхупада ведёт киртан" />
        <div style={{ margin: "16px 0 0", padding: "0 6px" }}>
          <Quote center size={16}>«Лучшее, что можно сделать для Господа, — это попытаться вдохнуть преданное служение в сердце обусловленной души, чтобы она сбросила оковы обусловленной жизни».</Quote>
        </div>
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[{ v: "14", l: "раз облетел весь мир с проповедью" }, { v: "108", l: "храмов основал лично" }].map((x) => (
            <div key={x.l} style={{ padding: PAD, textAlign: "center", ...tile }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 27, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--color-label)", lineHeight: 1 }}><CountUp value={x.v} /></div>
              <div style={{ marginTop: 6, fontFamily: "var(--font-text)", fontSize: 12, letterSpacing: TR_BODY, color: "var(--color-label-3)", lineHeight: 1.3 }}>{x.l}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16 }}>
          {BIO.map((p, i) => <Para key={i} mt={i ? 12 : 0}>{p}</Para>)}
          <Para mt={12}>За двенадцать лет активной проповеди — с 1965 по 1977 год — Шрила Прабхупада:</Para>
          <ul style={{ margin: "8px 0 0", padding: "0 0 0 2px", listStyle: "none" }}>
            {BIO_BULLETS.map((b, i) => (
              <li key={i} style={{ display: "flex", gap: 9, marginTop: i ? 7 : 0, fontFamily: "var(--font-text)", fontSize: 14.5, lineHeight: 1.55, letterSpacing: TR_BODY, color: "var(--color-label-2)" }}>
                <span aria-hidden style={{ flexShrink: 0, color: GOLD, fontWeight: 700 }}>·</span><span>{b}</span>
              </li>
            ))}
          </ul>
          {BIO_TAIL.map((p, i) => <Para key={i} mt={12}>{p}</Para>)}
          <div style={{ margin: "16px 0 0", padding: "0 6px" }}>
            <Quote center size={16}>«Повторяйте Харе Кришна и будьте счастливы».</Quote>
          </div>
          <Para mt={16}>{BIO_AFTER}</Para>
        </div>
        <div style={{ marginTop: 22, fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, letterSpacing: TR_TITLE, color: "var(--color-label)" }}>Жизнь в фотографиях</div>
        <Rail w={230} ratio="4 / 3" items={SP_LIFE} />
        <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {FACTS.map((f) => (
            <div key={f.t} style={{ padding: PAD, ...tile }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, letterSpacing: TR_TITLE, color: "var(--color-label)" }}>{f.t}</div>
              <p style={{ margin: "6px 0 0", fontFamily: "var(--font-text)", fontSize: 12.5, lineHeight: 1.45, letterSpacing: TR_BODY, color: "var(--color-label-2)" }}>{f.d}</p>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => onOpenEntity("prabhupada", "personality")}
          onPointerDown={(e) => (e.currentTarget.style.opacity = "0.85")} onPointerUp={(e) => (e.currentTarget.style.opacity = "1")} onPointerLeave={(e) => (e.currentTarget.style.opacity = "1")}
          style={{ marginTop: 16, width: "100%", padding: "13px 0", borderRadius: 14, border: "none", background: "var(--color-brand-blue)", color: "#fff", fontFamily: "var(--font-text)", fontSize: 15, fontWeight: 600, letterSpacing: TR_BODY, cursor: "pointer" }}>
          Жизнь и наследие
        </button>
      </Section>

      {/* Ничего лишнего */}
      <Section>
        <SectionHead eyebrow="Принципы" title="Ничего лишнего" subtitle="Четыре регулирующих принципа свободы." />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {PRINCIPLES.map((p) => (
            <div key={p.t} style={{ padding: PAD, ...tile }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 14.5, fontWeight: 700, letterSpacing: TR_TITLE, color: "var(--color-label)", lineHeight: 1.2 }}>{p.t}</div>
              <p style={{ margin: "7px 0 0", fontFamily: "var(--font-text)", fontSize: 12.5, lineHeight: 1.45, letterSpacing: TR_BODY, color: "var(--color-label-2)" }}>{p.d}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Влияние на мир — цитаты Georgia курсивом */}
      <Section>
        <SectionHead eyebrow="Влияние" title="Влияние на весь мир" subtitle="Лидеры об ИСККОН и Движении Харе Кришна." />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {VOICES.map((v) => (
            <figure key={v.n} style={{ margin: 0, display: "flex", gap: 13, padding: PAD, ...card }}>
              {v.img
                ? <img src={`/media/voices/${v.img}.webp`} alt="" loading="lazy" style={{ flexShrink: 0, width: 44, height: 44, borderRadius: "50%", objectFit: "cover", border: "0.5px solid var(--color-hairline)", background: "var(--color-fill-1)" }} />
                : <span style={{ flexShrink: 0, width: 44, height: 44, borderRadius: "50%", display: "grid", placeItems: "center", border: `1.5px solid color-mix(in srgb, ${GOLD} 55%, transparent)`, background: `color-mix(in srgb, ${GOLD} 9%, transparent)`, color: GOLD, fontFamily: "var(--font-scripture)", fontStyle: "italic", fontWeight: 600, fontSize: 18 }}>{v.n[0]}</span>}
              <div style={{ minWidth: 0, flex: 1 }}>
                <Quote size={15}>«{v.c}»</Quote>
                <figcaption style={{ marginTop: 8, fontFamily: "var(--font-text)" }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: TR_BODY, color: "var(--color-label)" }}>{v.n}</span>
                  <span style={{ display: "block", marginTop: 1, fontSize: 12, color: "var(--color-label-3)" }}>{v.r}</span>
                </figcaption>
              </div>
            </figure>
          ))}
          <div style={{ padding: PAD, ...tile }}>
            <Quote size={14} color="var(--color-label-2)">За последние полвека ИСККОН достиг впечатляющих результатов в общественном служении и благотворительности: ежедневно 1,2 миллиона школьников получают питание в Индии, а больница Бхактиведанты за прошлый год приняла более 200 000 пациентов.</Quote>
            <div style={{ marginTop: 9, fontFamily: "var(--font-text)", fontSize: 11, fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: GOLD }}>Forbes</div>
          </div>
        </div>
      </Section>

      {/* 7 целей */}
      <Section>
        <SectionHead eyebrow="Миссия" title="7 целей ИСККОН" subtitle="Семь основных целей, лично сформулированных Шрилой Прабхупадой при основании общества." />
        <ul style={{ margin: 0, padding: 0, listStyle: "none", overflow: "hidden", ...card }}>
          {PURPOSES.map((p, i) => (
            <li key={i} style={{ display: "flex", gap: 13, padding: PAD, alignItems: "flex-start", borderTop: i ? "0.5px solid var(--color-hairline)" : "none" }}>
              <span style={{ flexShrink: 0, width: 20, fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700, color: GOLD, lineHeight: 1.55 }}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ fontFamily: "var(--font-text)", fontSize: 14, lineHeight: 1.55, letterSpacing: TR_BODY, color: "var(--color-label-2)" }}>{p}</span>
            </li>
          ))}
        </ul>
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
          <p style={{ margin: "16px auto 0", maxWidth: 360, fontFamily: "var(--font-text)", fontSize: 11, lineHeight: 1.6, letterSpacing: TR_BODY, color: "var(--color-label-3)" }}>
            ISKCON ONE LOVE — онлайн-ресурс последователей традиции ISKCON, относящейся к Брахма-Мадхва-Гаудия-сампрадае, посвящённый наследию Ачарьи-основателя ИСККОН Шрилы Прабхупады. Не является официальным представительством зарегистрированной организации ISKCON.
          </p>
        </div>
      </Section>
    </div>
  );
}
