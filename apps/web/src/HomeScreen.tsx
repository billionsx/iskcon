/**
 * HomeScreen — «Главная». Полная копия домашней страницы iskcone.com, поднятая
 * до уровня apple.com / iOS 26: чередующиеся полноширинные секции (белая ↔
 * светло-серая) задают ритм панелей, полужирные (600) заголовки с точным
 * отрицательным трекингом, щедрый воздух, изображения как аккуратные
 * скруглённые плитки с подписями (текст никогда не на фото), счётчики чисел,
 * бегущие строки и мягкая анимация появления при скролле.
 */
import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { BOOKS } from "./books";

const GOLD = "#D2AA1B";
type Tone = "base" | "alt";

/* ───────── анимации ───────── */
function Styles() {
  return <style>{`
@font-face{font-family:'xBillions';font-weight:400;font-style:normal;font-display:swap;src:url('https://static.tildacdn.net/tild6132-3531-4663-a332-653334316463/xBillions-Normal.woff') format('woff')}
@font-face{font-family:'xBillions';font-weight:500;font-style:normal;font-display:swap;src:url('https://static.tildacdn.net/tild3963-3263-4966-a261-373761666536/xBillions-Medium.woff') format('woff')}
@font-face{font-family:'xBillions';font-weight:600;font-style:normal;font-display:swap;src:url('https://static.tildacdn.net/tild6565-6133-4539-b361-366364383335/xBillions-Semibold.woff') format('woff')}
@font-face{font-family:'xBillions';font-weight:700;font-style:normal;font-display:swap;src:url('https://static.tildacdn.net/tild6530-3232-4435-b636-653837653661/xBillions-Bold.woff') format('woff')}
@font-face{font-family:'xBillions';font-weight:800;font-style:normal;font-display:swap;src:url('https://static.tildacdn.net/tild6263-3236-4431-a562-343531373963/xBillions-Heavy.woff') format('woff')}
@keyframes iskMq{from{transform:translateX(0)}to{transform:translateX(-50%)}}
`}</style>;
}
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [v, setV] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setV(true); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { setV(true); io.disconnect(); } }), { threshold: 0.1, rootMargin: "0px 0px -5% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} style={{ opacity: v ? 1 : 0, transform: v ? "none" : "translateY(24px)", transition: `opacity .9s cubic-bezier(.16,.7,.2,1) ${delay}ms, transform .9s cubic-bezier(.16,.7,.2,1) ${delay}ms` }}>{children}</div>;
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
        const t0 = performance.now(), D = 1600;
        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / D);
          const e2 = 1 - Math.pow(1 - p, 3);
          setDisp(prefix + fmtNum(target * e2, dec) + suffix);
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      }
    }), { threshold: 0.6 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, []);
  return <span ref={ref}>{disp}</span>;
}
function Marquee({ items, dur = 46 }: { items: string[]; dur?: number }) {
  const row = items.join("\u2003·\u2003") + "\u2003·\u2003";
  const span = { fontFamily: "var(--font-text)", fontSize: 11.5, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase" as const, color: "var(--color-label-3)" };
  return (
    <div style={{ overflow: "hidden", padding: "17px 0", borderTop: "0.5px solid var(--color-hairline)", borderBottom: "0.5px solid var(--color-hairline)", WebkitMaskImage: "linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)", maskImage: "linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)" }}>
      <div style={{ display: "inline-flex", whiteSpace: "nowrap", animation: `iskMq ${dur}s linear infinite`, willChange: "transform" }}>
        <span style={span}>{row}</span><span style={span}>{row}</span>
      </div>
    </div>
  );
}

/* ───────── атомы (Apple: 600 вес, точный трекинг, воздух) ───────── */
function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "clamp(29px, 6.8vw, 44px)", fontWeight: 700, letterSpacing: "-0.022em", lineHeight: 1.08, color: "var(--color-label)", textAlign: "center" }}>{children}</h2>;
}
function Lead({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: "18px auto 0", maxWidth: 600, fontFamily: "var(--font-text)", fontSize: "clamp(17px, 2vw, 19px)", lineHeight: 1.55, color: "var(--color-label-2)", textAlign: "center" }}>{children}</p>;
}
function Caption({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: "14px 0 0", fontFamily: "var(--font-text)", fontSize: 13, color: "var(--color-label-3)", textAlign: "center" }}>{children}</p>;
}
// полноширинная секция-панель с фоном; внутри — читаемая колонка
function Band({ tone = "base", children, padTop, narrow }: { tone?: Tone; children: React.ReactNode; padTop?: number; narrow?: boolean }) {
  return (
    <section style={{ background: tone === "alt" ? "var(--color-bg-2)" : "var(--color-bg)", padding: `${padTop != null ? padTop + "px" : "clamp(66px,14vw,118px)"} 22px clamp(66px,14vw,118px)` }}>
      <Reveal><div style={{ maxWidth: narrow ? 640 : 760, margin: "0 auto" }}>{children}</div></Reveal>
    </section>
  );
}
// скруглённая плитка-изображение, БЕЗ текста поверх
function Photo({ src, ratio = "3 / 2", caption, pos = "center" }: { src: string; ratio?: string; caption?: string; pos?: string }) {
  return (
    <div style={{ marginTop: 44 }}>
      <div style={{ marginInline: -22, overflow: "hidden", background: "var(--color-fill-1)" }}>
        <img src={src} alt="" loading="lazy" style={{ width: "100%", display: "block", aspectRatio: ratio, objectFit: "cover", objectPosition: pos }} />
      </div>
      {caption ? <Caption>{caption}</Caption> : null}
    </div>
  );
}
function tileStyle(tone: Tone): React.CSSProperties {
  return tone === "alt"
    ? { background: "var(--color-bg)", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }
    : { background: "var(--color-bg-2)" };
}

/* ───────── данные ───────── */
const STATS = [
  { v: "10+", l: "миллионов последователей" },
  { v: "2 000+", l: "храмов по всему миру" },
  { v: "65+", l: "сельскохозяйственных общин" },
  { v: "8,7+", l: "миллиардов порций прасада" },
  { v: "55+", l: "образовательных учреждений" },
  { v: "на 89", l: "языках издаются книги" },
  { v: "300+", l: "ресторанов" },
  { v: "100+", l: "гуру, духовных учителей" },
];
const FORMS = [
  { t: "Мантра", d: "Звуковая форма Кришны и Шримати Радхарани (Харе). Повторение мантры Харе Кришна — тихо (джапа) или громко (киртан) — очищает ум и сердце, мгновенно соединяя вас с Богом.", go: "kirtans" },
  { t: "Книги", d: "Литературная форма. Изучение «Бхагавад-гиты», «Шримад-Бхагаватам» и «Шри Чайтанья-чаритамриты» позволяет встретить Бога на страницах этих текстов.", go: "books" },
  { t: "Божества", d: "Проявленные формы Кришны и Радхарани в этом мире неотличны от Их вечных духовных форм, что позволяет преданным служить Им непосредственно." },
  { t: "Прасад", d: "Вегетарианская пища, предложенная Господу, становится освящённой и передаёт духовную силу и любовь, помогая очищать ум и тело." },
  { t: "Садху", d: "Святые, хранящие в сердце Кришну и Радхарани, — духовные наставники и источники вдохновения, живой пример преданности, служения и любви.", go: "acharya" },
  { t: "Дхама", d: "Святые места, неотличные от духовного мира. Посещение Дхамы — Вриндавана и Маяпура — углубляет духовное сознание и приближает к Богу.", go: "dhama" },
];
const PRINCIPLES = [
  { t: "Без мяса", d: "Преданные воздерживаются от мяса, рыбы и яиц, ведя образ жизни в согласии с принципом ахимсы — ненасилия." },
  { t: "Без незаконного секса", d: "Целомудрие (брахмачарья) до брака и верность в браке." },
  { t: "Без азартных игр", d: "Исключение азартных игр и спекуляций — ради честности, надёжности и осознанности." },
  { t: "Без интоксикаций", d: "Без алкоголя, наркотиков и табака — ради ясного и сосредоточенного ума для духовной практики." },
];
const VOICES = [
  { img: "", c: "Меня вдохновляет работа этого храма и общины. Это место великой духовности — оно привлекает сотни тысяч людей и объединяет людей самых разных слоёв общества.", n: "Борис Джонсон", r: "экс-премьер-министр Великобритании" },
  { img: "jobs", c: "Я проходил 7 миль через весь город каждую неделю, чтобы в воскресенье вечером получить хорошее блюдо в храме Харе Кришна.", n: "Стив Джобс", r: "сооснователь Apple Inc." },
  { img: "", c: "Я прочитал 90 процентов «Бхагавад-гиты». Когда я её читаю, мой внутренний Арджуна направляется на верный путь.", n: "Уилл Смит", r: "голливудский актёр" },
  { img: "lennon", c: "Повторение мантры Харе Кришна — это вид медитации, который может действительно вызвать состояние экстаза.", n: "Джон Леннон", r: "музыкант, The Beatles" },
  { img: "", c: "ИСККОН научил мир истинному значению веры.", n: "Нарендра Моди", r: "премьер-министр Индии" },
  { img: "harrison", c: "Он был идеальным примером всего, чему учил. Не имея ничего материального, но обладая сознанием Кришны, он привлёк тысячи преданных и основал движение, которое остаётся сильным даже после его ухода.", n: "Джордж Харрисон", r: "музыкант, The Beatles" },
  { img: "mukherjee", c: "Я выражаю глубокую признательность Шриле Прабхупаде, который распространил послание сознания Кришны по всему миру. Его влияние продолжает звучать в сердцах преданных даже сегодня.", n: "Шри Пранаб Мукерджи", r: "13-й президент Индии" },
  { img: "sunak", c: "В самые трудные времена именно «Гита» давала мне силу продолжать бороться за то, во что я верю.", n: "Риши Сунак", r: "премьер-министр Великобритании" },
];
const BOOKLIST = [
  { work: "bg", t: "Бхагавад-гита как она есть", d: "Вечный диалог Кришны (Бога) и Арджуны (души), в котором Кришна даёт наставления о том, как организовать жизнь и достичь духовного совершенства, чтобы вернуться домой к Богу." },
  { work: "sb", t: "Шримад-Бхагаватам", d: "Великий древний текст о том, как Верховная Личность Бога, Кришна, приходит в различных формах, в разные эпохи и к людям с разной степенью преданности." },
  { work: "cc", t: "Шри Чайтанья-чаритамрита", d: "Священный текст о божественных играх самой милостивой формы Бога — Шри Чайтаньи Махапрабху, объединённого воплощения Кришны и Радхарани, пришедшего даровать всем чистую любовь к Богу." },
];
const BIO: string[] = [
  "Шрила Прабхупада — выдающийся духовный учитель индийского происхождения, принёсший сознание Кришны в западный мир и заложивший основы глобального вайшнавского возрождения. Его жизнь подробно описана его учеником Сатсварупой дасом Госвами в семитомном труде «Шрила Прабхупада-лиламрита».",
  "Он родился 1 сентября 1896 года в Калькутте, в благочестивой вайшнавской семье. Родители дали ему имя Абхай Чаран Де — «тот, кто бесстрашен, приняв прибежище у лотосных стоп Господа Кришны». В 1920 году он окончил престижный Шотландский колледж, но, поддержав движение Ганди за независимость, отказался принять диплом в знак протеста против колониального правления.",
  "В 1922 году произошла судьбоносная встреча с его духовным учителем — Шрилой Бхактисиддхантой Сарасвати Тхакуром. Тогда он получил наставление, определившее всю его жизнь: распространить ведическое знание и учение бхакти на английском языке по всему миру.",
  "В 1944 году он основал англоязычный журнал Back to Godhead, издаваемый по сей день. В 1947 году ему присвоили титул «Бхактиведанта» — «тот, кто постиг, что преданное служение Господу есть вершина всего знания». В 1959 году он принял санньясу и начал главный труд жизни — перевод и комментарий к «Шримад-Бхагаватам».",
  "В 1965 году, в возрасте 69 лет, Шрила Прабхупада на грузовом судне отправился в США, перенеся в пути два сердечных приступа. Прибыв в Нью-Йорк, он имел при себе лишь несколько долларов и ящик книг. Так началась беспрецедентная волна Гауранга-лилы.",
  "Он воспевал маха-мантру в парке Томпкинс-сквер, читал лекции по «Бхагавад-гите» и собирал искренних искателей истины. Уже в 1966 году он официально зарегистрировал Международное общество сознания Кришны (ISKCON).",
  "За двенадцать лет — с 1965 по 1977 — он основал ИСККОН по всему миру, вернул сознание Кришны в Индию, перевёл ключевые писания, инициировал тысячи учеников, четырнадцать раз облетел земной шар и основал программу Food for Life.",
  "В 1977 году во Вриндаване он покинул этот мир, окружённый любовью учеников. Сегодня он почитается как ачарья для всех вайшнавов — личность, исполнившая желание Шри Чайтаньи распространить святое имя по всей Земле. Его наставление остаётся живым: «Повторяйте Харе Кришна и будьте счастливы».",
];
const FACTS = [
  { t: "Путешествие в Америку", d: "В 69 лет он покинул Вриндаван и отправился в Нью-Йорк, имея при себе всего 7 долларов и несколько писаний, — и неуклонно продолжил миссию бхакти-йоги." },
  { t: "Всемирная проповедь", d: "Начав с повторения мантры в парке, он основал первые храмы — начало стремительного глобального распространения движения." },
  { t: "Литературное наследие", d: "Написал и перевёл более 70 книг, включая «Бхагавад-гиту как она есть», «Шримад-Бхагаватам» и «Чайтанья-чаритамриту»." },
  { t: "Музыкальное влияние", d: "Представил киртан как форму медитации, завоевавшую популярность, в том числе среди The Beatles." },
  { t: "Культурные концепции", d: "Популяризировал понятия кармы, реинкарнации и йоги для мировой аудитории." },
  { t: "Помощь нуждающимся", d: "Стремился, чтобы каждый мог получить прасад. На сегодня роздано около 8,7 миллиарда порций." },
];
const PURPOSES = [
  "Систематически распространять духовное знание и обучать методам духовной жизни, чтобы исправить дисбаланс ценностей и достичь подлинного единства и мира.",
  "Распространять сознание Кришны, как оно раскрыто в «Бхагавад-гите» и «Шримад-Бхагаватам».",
  "Объединять членов Общества друг с другом и с Кришной, развивая понимание, что каждая душа — частица божественной природы.",
  "Поощрять движение санкиртаны — коллективное пение святого имени Бога, как учил Шри Чайтанья Махапрабху.",
  "Возводить святое место трансцендентных игр, посвящённое личности Кришны.",
  "Объединять членов Общества ради более простого и естественного образа жизни.",
  "Издавать и распространять журналы, книги и другие письменные материалы.",
];
const MQ1 = ["Всемирное движение Харе Кришна", "ИСККОН", "Международное общество сознания Кришны", "ББТ", "Бхактиведанта Бук Траст", "Его Божественная Милость Шрила Прабхупада"];
const MQ3 = ["Харе Кришна Харе Кришна Кришна Кришна Харе Харе", "Харе Рама Харе Рама Рама Рама Харе Харе"];

/* ───────── экран ───────── */
export default function HomeScreen({ onChange, onOpenBook, onOpenEntity, onDonate }: {
  onChange: (tab: string) => void;
  onOpenBook: (work: string) => void;
  onOpenEntity: (id: string, type: string | null) => void;
  onDonate: () => void;
}) {
  useEffect(() => { fetch(api("/entities/prabhupada")).catch(() => {}); }, []);

  const explore = [
    { t: "Книги", sub: "БГ · ШБ · ЧЧ и труды ачарьев", act: () => onChange("books") },
    { t: "Киртаны", sub: "Бхаджаны, молитвы, мантры", act: () => onChange("kirtans") },
    { t: "Ачарья", sub: "Господь, аватары и спутники", act: () => onChange("acharya") },
    { t: "Поддержать служение", sub: "Стать частью миссии", act: onDonate },
  ];

  return (
    <div style={{ margin: "0 -16px", ["--font-display" as any]: "'xBillions', -apple-system, BlinkMacSystemFont, system-ui, sans-serif", ["--font-text" as any]: "'xBillions', -apple-system, BlinkMacSystemFont, system-ui, sans-serif" }}>
      <Styles />

      {/* HERO — base */}
      <Band tone="base" padTop={34}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-text)", fontSize: 12.5, fontWeight: 600, letterSpacing: "2.6px", textTransform: "uppercase", color: GOLD }}>ISKCON · One Love</div>
          <h1 style={{ margin: "26px auto 0", maxWidth: 860, fontFamily: "var(--font-display)", fontSize: "clamp(46px, 14vw, 84px)", fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 0.99, color: "var(--color-label)" }}>
            Служение.<br />Преданность.<br />Любовь.
          </h1>
          <p style={{ margin: "30px auto 0", maxWidth: 560, fontFamily: "var(--font-text)", fontSize: "clamp(18px,2.3vw,21px)", lineHeight: 1.5, color: "var(--color-label-2)" }}>
            Великая духовная традиция, существующая более 5000 лет, была возрождена святым <b style={{ color: "var(--color-label)", fontWeight: 600 }}>Шрилой Прабхупадой</b> 13 июля 1966 года. <b style={{ color: "var(--color-label)", fontWeight: 600 }}>Всемирное Движение Харе Кришна</b>, ИСККОН, помогает каждой душе восстановить её вечную любовную связь с Богом.
          </p>
        </div>
        <Photo src="/media/prabhupada-color.webp" ratio="4 / 3" pos="center 22%" caption="Ачарья-основатель ИСККОН — Его Божественная Милость А. Ч. Бхактиведанта Свами Шрила Прабхупада" />
      </Band>

      {/* Скитания — alt */}
      <Band tone="alt" narrow>
        <p style={{ margin: 0, fontFamily: "var(--font-text)", fontSize: "clamp(17px,2vw,19px)", lineHeight: 1.62, color: "var(--color-label-2)", textAlign: "center" }}>
          В одиночестве, без друзей и ресурсов, он бродил по улицам города в своих шафрановых одеждах. «Кто примет это послание, особенно в стране, настолько поглощённой материализмом? <b style={{ color: "var(--color-label)", fontWeight: 600 }}>У меня нет надежды, но я попробую…</b>», — вспоминал Шрила Прабхупада.
        </p>
        <Photo src="/media/prabhupada-nyc.webp" ratio="3 / 2" pos="center 28%" caption="Нью-Йорк, 1965 — начало движения" />
      </Band>

      <Marquee items={MQ1} />

      {/* ИСККОН сегодня — base */}
      <Band tone="base">
        <H2>ИСККОН сегодня.</H2>
        <Lead>Невероятная статистика. Движение Харе Кришна — мировое духовное сообщество, объединяющее миллионы людей более чем в 80 странах. Это движение милосердия и любви распространилось на все континенты.</Lead>
        <div style={{ marginTop: 44, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "38px 16px", textAlign: "center" }}>
          {STATS.map((s) => (
            <div key={s.l}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(38px, 12vw, 68px)", fontWeight: 700, letterSpacing: "-0.025em", color: "var(--color-label)", lineHeight: 1 }}><CountUp value={s.v} /></div>
              <div style={{ margin: "9px auto 0", maxWidth: 150, fontFamily: "var(--font-text)", fontSize: 12.5, color: "var(--color-label-2)", lineHeight: 1.32 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </Band>

      {/* Высшая цель — alt */}
      <Band tone="alt">
        <H2>Высшая цель.</H2>
        <Lead>Движение Харе Кришна исследует науку чистой преданной любви к Богу, воплощённой в божественной паре: Кришне и Его высшей энергии любви, Шримати Радхарани (Харе).</Lead>
        <Photo src="/media/radha-krishna.webp" ratio="16 / 10" caption="Божества Радхи и Кришны на алтаре" />
      </Band>

      {/* Маха-мантра — драматичная тёмная секция */}
      <section style={{ background: "#0b0b0d", padding: "clamp(76px,16vw,136px) 22px" }}>
        <Reveal>
          <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-text)", fontSize: 12.5, fontWeight: 600, letterSpacing: "2.6px", textTransform: "uppercase", color: GOLD }}>Маха-мантра</div>
            <div style={{ marginTop: 32, fontFamily: "var(--font-scripture)", fontSize: 19, lineHeight: 1.7, color: "rgba(255,255,255,0.42)" }}>
              हरे कृष्ण हरे कृष्ण · कृष्ण कृष्ण हरे हरे<br />हरे राम हरे राम · राम राम हरे हरे
            </div>
            <div style={{ marginTop: 26, fontFamily: "var(--font-display)", fontSize: "clamp(24px, 6.4vw, 38px)", fontWeight: 600, letterSpacing: "-0.015em", lineHeight: 1.42, color: "#fff" }}>
              Харе Кришна, Харе Кришна,<br />Кришна Кришна, Харе Харе<br />Харе Рама, Харе Рама,<br />Рама Рама, Харе Харе
            </div>
            <p style={{ margin: "34px auto 0", maxWidth: 540, fontFamily: "var(--font-text)", fontSize: 16.5, lineHeight: 1.6, color: "rgba(255,255,255,0.62)" }}>
              Когда звучит трансцендентная вибрация святого имени, благо получают все живые существа — даже деревья, животные и насекомые. Повторение маха-мантры — высшее милосердие ко всему миру.
            </p>
          </div>
        </Reveal>
      </section>

      {/* NYT — alt */}
      <Band tone="alt" narrow>
        <Lead>После года скитаний и привлечения первых последователей в Нью-Йорке Шрила Прабхупада зарегистрировал ИСККОН в июле 1966 года. Через месяц The New York Times вышла со статьёй «Свами поёт в парке в поисках экстаза» — о «50 последователях, что хлопают и качаются под гипнотическую музыку на Ист-Сайде». В мгновение ока популярность Движения Харе Кришна взлетела.</Lead>
      </Band>

      {/* Высший образ жизни — base */}
      <Band tone="base">
        <H2>Высший образ жизни.</H2>
        <Lead>Духовный путь бхакти-йоги — это практика любовного преданного служения Богу, воплощённому в вечной божественной паре: Кришне и Шримати Радхарани (Харе). Образ жизни вайшнава тесно связан с преданностью этим двум прекрасным личностям.</Lead>
        <div style={{ marginTop: 40 }}>
          {FORMS.map((f, i) => {
            const tap = !!f.go;
            return (
              <button key={f.t} type="button" disabled={!tap} onClick={() => f.go && onChange(f.go)}
                onPointerDown={(e) => { if (tap) e.currentTarget.style.opacity = "0.55"; }}
                onPointerUp={(e) => { if (tap) e.currentTarget.style.opacity = "1"; }}
                onPointerLeave={(e) => { if (tap) e.currentTarget.style.opacity = "1"; }}
                style={{ display: "flex", gap: 18, width: "100%", textAlign: "left", padding: "20px 0", borderTop: "0.5px solid var(--color-hairline)", borderBottom: i === FORMS.length - 1 ? "0.5px solid var(--color-hairline)" : "none", background: "transparent", cursor: tap ? "pointer" : "default" }}>
                <span style={{ flexShrink: 0, fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600, color: GOLD, width: 22, lineHeight: 2.1 }}>{String(i + 1).padStart(2, "0")}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--color-label)" }}>{f.t}</span>
                    {tap && <span style={{ marginLeft: "auto", color: "var(--color-label-3)", fontSize: 18, lineHeight: 1 }}>›</span>}
                  </span>
                  <span style={{ display: "block", marginTop: 6, fontFamily: "var(--font-text)", fontSize: 14.5, lineHeight: 1.55, color: "var(--color-label-2)" }}>{f.d}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Band>

      <Marquee items={MQ3} dur={52} />

      {/* Миллиард книг — alt (белые плитки) */}
      <Band tone="alt">
        <H2>Миллиард духовных книг.</H2>
        <Lead>ИСККОН распространяет древнюю священную литературу на 89 языках, помогая людям найти смысл жизни, организовать её согласно духовным принципам и научиться служить и любить Бога.</Lead>
        <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 14 }}>
          {BOOKLIST.map((b) => (
            <button key={b.work} type="button" onClick={() => onOpenBook(b.work)}
              onPointerDown={(e) => { e.currentTarget.style.opacity = "0.6"; }}
              onPointerUp={(e) => { e.currentTarget.style.opacity = "1"; }}
              onPointerLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
              style={{ display: "flex", gap: 18, alignItems: "center", width: "100%", textAlign: "left", padding: "18px", borderRadius: 22, cursor: "pointer", ...tileStyle("alt") }}>
              <img src={BOOKS[b.work]?.covers?.[0]} alt="" loading="lazy" style={{ flexShrink: 0, width: 66, height: 92, objectFit: "cover", borderRadius: 8, background: "var(--color-fill-1)" }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 17.5, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--color-label)", lineHeight: 1.2 }}>{b.t}</span>
                <span style={{ display: "block", marginTop: 6, fontFamily: "var(--font-text)", fontSize: 13.5, lineHeight: 1.45, color: "var(--color-label-2)" }}>{b.d}</span>
                <span style={{ display: "inline-block", marginTop: 9, fontFamily: "var(--font-text)", fontSize: 13.5, fontWeight: 500, color: "var(--color-brand-blue)" }}>Читать онлайн ›</span>
              </span>
            </button>
          ))}
        </div>
      </Band>

      {/* Шрила Прабхупада — base */}
      <Band tone="base">
        <H2>Шрила Прабхупада.</H2>
        <Lead>Основатель Движения Харе Кришна оказал значительное влияние на современную духовную историю, включая глобальное распространение ключевых концепций. Вот несколько фактов о его жизни и наследии.</Lead>
        <blockquote style={{ margin: "34px auto 0", maxWidth: 620, fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: "clamp(19px,2.6vw,23px)", lineHeight: 1.5, color: "var(--color-label)", textAlign: "center" }}>
          «Лучшее, что можно сделать для Господа, — это попытаться вдохнуть преданное служение в сердце обусловленной души, чтобы она сбросила оковы обусловленной жизни».
        </blockquote>
        <div style={{ marginTop: 36, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {[{ v: "14", l: "раз облетел весь мир с проповедью" }, { v: "108", l: "храмов основал лично" }].map((x) => (
            <div key={x.l} style={{ padding: "22px 18px", borderRadius: 22, textAlign: "center", ...tileStyle("base") }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(30px,9vw,42px)", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--color-label)", lineHeight: 1 }}><CountUp value={x.v} /></div>
              <div style={{ margin: "9px auto 0", maxWidth: 150, fontFamily: "var(--font-text)", fontSize: 12.5, color: "var(--color-label-2)", lineHeight: 1.32 }}>{x.l}</div>
            </div>
          ))}
        </div>
        <Photo src="/media/prabhupada.webp" ratio="3 / 2" pos="center 22%" caption="Шрила Прабхупада ведёт киртан" />
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <p style={{ margin: "34px 0 0", fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 16.5, color: "var(--color-label-2)", textAlign: "center" }}>Его Божественная Милость А. Ч. Бхактиведанта Свами Шрила Прабхупада</p>
          {BIO.map((p, i) => (
            <p key={i} style={{ margin: i === 0 ? "24px 0 0" : "16px 0 0", fontFamily: "var(--font-text)", fontSize: 16, lineHeight: 1.66, color: "var(--color-label-2)" }}>{p}</p>
          ))}
          <div style={{ marginTop: 34, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {FACTS.map((f) => (
              <div key={f.t} style={{ padding: "18px", borderRadius: 18, ...tileStyle("base") }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--color-label)" }}>{f.t}</div>
                <p style={{ margin: "7px 0 0", fontFamily: "var(--font-text)", fontSize: 13, lineHeight: 1.45, color: "var(--color-label-2)" }}>{f.d}</p>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center" }}>
            <button type="button" onClick={() => onOpenEntity("prabhupada", "personality")}
              onPointerDown={(e) => { e.currentTarget.style.opacity = "0.8"; }}
              onPointerUp={(e) => { e.currentTarget.style.opacity = "1"; }}
              onPointerLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
              style={{ marginTop: 32, padding: "12px 24px", borderRadius: 999, border: "none", background: "var(--color-brand-blue)", color: "#fff", fontFamily: "var(--font-text)", fontSize: 15, fontWeight: 500, cursor: "pointer" }}>
              Жизнь и наследие
            </button>
          </div>
        </div>
      </Band>

      {/* Принципы — alt (белые плитки) */}
      <Band tone="alt">
        <H2>Ничего лишнего.</H2>
        <Lead>Четыре регулирующих принципа свободы.</Lead>
        <div style={{ marginTop: 40, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {PRINCIPLES.map((p) => (
            <div key={p.t} style={{ padding: "22px 18px", borderRadius: 22, ...tileStyle("alt") }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--color-label)" }}>{p.t}</div>
              <p style={{ margin: "8px 0 0", fontFamily: "var(--font-text)", fontSize: 13.5, lineHeight: 1.45, color: "var(--color-label-2)" }}>{p.d}</p>
            </div>
          ))}
        </div>
      </Band>

      {/* Влияние на мир — base */}
      <Band tone="base">
        <H2>Влияние на весь мир.</H2>
        <Lead>Лидеры об ИСККОН и Движении Харе Кришна.</Lead>
        <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 30 }}>
          {VOICES.map((v) => (
            <figure key={v.n} style={{ margin: 0, display: "flex", gap: 16 }}>
              {v.img
                ? <img src={`/media/voices/${v.img}.webp`} alt="" loading="lazy" style={{ flexShrink: 0, width: 52, height: 52, borderRadius: "50%", objectFit: "cover", background: "var(--color-bg-2)" }} />
                : <span style={{ flexShrink: 0, width: 52, height: 52, borderRadius: "50%", background: "var(--color-bg-2)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 600, color: GOLD }}>{v.n[0]}</span>}
              <div style={{ minWidth: 0 }}>
                <blockquote style={{ margin: 0, fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 17.5, lineHeight: 1.5, color: "var(--color-label)" }}>«{v.c}»</blockquote>
                <figcaption style={{ marginTop: 8, fontFamily: "var(--font-text)" }}>
                  <span style={{ fontSize: 14.5, fontWeight: 600, color: "var(--color-label)" }}>{v.n}</span>
                  <span style={{ fontSize: 13, color: "var(--color-label-3)" }}> — {v.r}</span>
                </figcaption>
              </div>
            </figure>
          ))}
        </div>
        <div style={{ marginTop: 36, paddingTop: 30, borderTop: "0.5px solid var(--color-hairline)" }}>
          <blockquote style={{ margin: 0, fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 16.5, lineHeight: 1.6, color: "var(--color-label-2)" }}>
            За последние полвека ИСККОН достиг впечатляющих результатов в общественном служении: помощь жертвам цунами 2004 года и урагана «Катрина», 1,2 миллиона школьников ежедневно получают питание в Индии, больница Бхактиведанты приняла более 200 000 пациентов за год.
          </blockquote>
          <figcaption style={{ marginTop: 12, fontFamily: "var(--font-text)", fontSize: 13, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: GOLD }}>Forbes</figcaption>
        </div>
      </Band>

      {/* 7 целей — alt */}
      <Band tone="alt">
        <H2>7 целей ИСККОН.</H2>
        <Lead>Семь основных целей, лично сформулированных Шрилой Прабхупадой при основании общества.</Lead>
        <ol style={{ margin: "36px 0 0", padding: 0, listStyle: "none" }}>
          {PURPOSES.map((p, i) => (
            <li key={i} style={{ display: "flex", gap: 18, padding: "18px 0", borderTop: "0.5px solid var(--color-hairline)" }}>
              <span style={{ flexShrink: 0, fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600, color: GOLD, width: 24, lineHeight: 1.7 }}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ fontFamily: "var(--font-text)", fontSize: 15.5, lineHeight: 1.55, color: "var(--color-label-2)" }}>{p}</span>
            </li>
          ))}
        </ol>
      </Band>

      {/* Переходы — base */}
      <Band tone="base">
        <H2>Продолжите путь.</H2>
        <div style={{ marginTop: 36, display: "flex", flexDirection: "column", gap: 12 }}>
          {explore.map((it) => (
            <button key={it.t} type="button" onClick={it.act}
              onPointerDown={(e) => { e.currentTarget.style.opacity = "0.6"; }}
              onPointerUp={(e) => { e.currentTarget.style.opacity = "1"; }}
              onPointerLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
              style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", padding: "18px 20px", borderRadius: 18, cursor: "pointer", ...tileStyle("base") }}>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--color-label)" }}>{it.t}</span>
                <span style={{ display: "block", marginTop: 3, fontFamily: "var(--font-text)", fontSize: 13.5, color: "var(--color-label-2)" }}>{it.sub}</span>
              </span>
              <span style={{ color: "var(--color-label-3)", fontSize: 18, lineHeight: 1 }}>›</span>
            </button>
          ))}
        </div>
      </Band>

      {/* Футер — alt */}
      <section style={{ background: "var(--color-bg-2)", padding: "52px 22px 40px", textAlign: "center" }}>
        <div style={{ fontFamily: "var(--font-scripture)", fontSize: 14.5, color: "var(--color-label-3)", lineHeight: 1.7 }}>
          Hare Kṛṣṇa Hare Kṛṣṇa Kṛṣṇa Kṛṣṇa Hare Hare<br />Hare Rāma Hare Rāma Rāma Rāma Hare Hare
        </div>
        <p style={{ margin: "22px auto 0", maxWidth: 560, fontFamily: "var(--font-text)", fontSize: 11.5, lineHeight: 1.65, color: "var(--color-label-3)" }}>
          ISKCON ONE LOVE — онлайн-ресурс последователей традиции ISKCON из разных стран, относящейся к Брахма-Мадхва-Гаудия-сампрадае, созданный как пространство вдохновения для тех, кто ценит наследие Ачарьи-основателя ИСККОН Его Божественной Милости А. Ч. Бхактиведанты Свами Шрилы Прабхупады. Ресурс не является официальным представительством какой-либо зарегистрированной организации ISKCON и не осуществляет миссионерскую деятельность. Все материалы публикуются в культурно-просветительском и личном контексте.
        </p>
      </section>
    </div>
  );
}
