/**
 * HomeScreen — «Главная». Полная точная копия домашней страницы iskcone.com
 * (весь текст, все блоки, тот же порядок), поднятая до уровня apple.com / iOS 26:
 * центрированная композиция, крупные жирные заголовки «с точкой», счётчики чисел,
 * бегущие строки, чистые фотоблоки с подписями (текст никогда не на фото),
 * стандартизированные 8pt-отступы и анимация появления при скролле.
 */
import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { BOOKS } from "./books";

const GOLD = "#D2AA1B";

/* ───────── анимации ───────── */
function Styles() {
  return <style>{`@keyframes iskMq{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>;
}

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [v, setV] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setV(true); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { setV(true); io.disconnect(); } }), { threshold: 0.12, rootMargin: "0px 0px -5% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} style={{ opacity: v ? 1 : 0, transform: v ? "none" : "translateY(22px)", transition: `opacity .85s cubic-bezier(.16,.7,.2,1) ${delay}ms, transform .85s cubic-bezier(.16,.7,.2,1) ${delay}ms` }}>{children}</div>;
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
        const t0 = performance.now(), D = 1500;
        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / D);
          const e2 = 1 - Math.pow(1 - p, 3);
          setDisp(prefix + fmtNum(target * e2, dec) + suffix);
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      }
    }), { threshold: 0.5 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, []);
  return <span ref={ref}>{disp}</span>;
}

function Marquee({ items, dur = 40 }: { items: string[]; dur?: number }) {
  const row = items.join("\u2003•\u2003") + "\u2003•\u2003";
  const span = { fontFamily: "var(--font-text)", fontSize: 12, fontWeight: 600, letterSpacing: "1.4px", textTransform: "uppercase" as const, color: "var(--color-label-3)" };
  return (
    <div style={{ margin: "60px -16px 0", overflow: "hidden", borderTop: "0.5px solid var(--color-hairline)", borderBottom: "0.5px solid var(--color-hairline)", padding: "15px 0", WebkitMaskImage: "linear-gradient(90deg,transparent,#000 7%,#000 93%,transparent)", maskImage: "linear-gradient(90deg,transparent,#000 7%,#000 93%,transparent)" }}>
      <div style={{ display: "inline-flex", whiteSpace: "nowrap", animation: `iskMq ${dur}s linear infinite`, willChange: "transform" }}>
        <span style={span}>{row}</span><span style={span}>{row}</span>
      </div>
    </div>
  );
}

/* ───────── атомы (центр, 8pt-ритм) ───────── */
function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "clamp(32px, 8.2vw, 50px)", fontWeight: 800, letterSpacing: "-1.4px", lineHeight: 1.05, color: "var(--color-label)", textAlign: "center" }}>{children}</h2>;
}
function Lead({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: "20px auto 0", maxWidth: 600, fontFamily: "var(--font-text)", fontSize: 17.5, lineHeight: 1.62, color: "var(--color-label-2)", textAlign: "center" }}>{children}</p>;
}
function Section({ children, top = 96 }: { children: React.ReactNode; top?: number }) {
  return <section style={{ marginTop: top }}><Reveal><div style={{ maxWidth: 760, margin: "0 auto" }}>{children}</div></Reveal></section>;
}
function Photo({ src, ratio = "3 / 2", caption, top = 36, rounded = false, pos = "center" }: { src: string; ratio?: string; caption?: string; top?: number; rounded?: boolean; pos?: string }) {
  return (
    <section style={{ marginTop: top }}>
      <Reveal>
        <div style={{ margin: rounded ? "0 auto" : "0 -16px", maxWidth: rounded ? 760 : undefined, borderRadius: rounded ? 24 : 0, overflow: "hidden", background: "var(--color-bg-2)" }}>
          <img src={src} alt="" loading="lazy" style={{ width: "100%", display: "block", aspectRatio: ratio, objectFit: "cover", objectPosition: pos }} />
        </div>
        {caption ? <p style={{ margin: "12px 0 0", fontFamily: "var(--font-text)", fontSize: 13, color: "var(--color-label-3)", textAlign: "center" }}>{caption}</p> : null}
      </Reveal>
    </section>
  );
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
const MQ2 = ["Шрила Прабхупада", "Движение Харе Кришна", "ИСККОН", "Международное общество сознания Кришны", "ББТ", "Бхактиведанта Бук Траст"];
const MQ3 = ["Харе Кришна Харе Кришна Кришна Кришна Харе Харе", "Харе Рама Харе Рама Рама Рама Харе Харе"];

/* ───────── секции ───────── */
function Hero() {
  return (
    <section style={{ marginTop: 26 }}>
      <Reveal>
        <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 800, letterSpacing: "3px", color: "var(--color-label)" }}>ISKCON ONE LOVE</div>
          <div style={{ margin: "12px auto 0", maxWidth: 460, fontFamily: "var(--font-text)", fontSize: 11.5, lineHeight: 1.5, letterSpacing: "0.3px", color: "var(--color-label-3)", textTransform: "uppercase" }}>
            Ачарья-основатель Международного общества сознания Кришны (ИСККОН)<br />
            Его Божественная Милость А. Ч. Бхактиведанта Свами Шрила Прабхупада
          </div>
          <blockquote style={{ margin: "26px auto 0", maxWidth: 560, fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 17, lineHeight: 1.55, color: "var(--color-label-2)" }}>
            «Лучшее, что можно сделать для Господа, — это попытаться вдохнуть преданное служение в сердце обусловленной души, чтобы она сбросила оковы обусловленной жизни».
          </blockquote>
          <h1 style={{ margin: "44px 0 0", fontFamily: "var(--font-display)", fontSize: "clamp(40px, 12vw, 64px)", fontWeight: 800, letterSpacing: "-2px", lineHeight: 1.0, color: "var(--color-label)" }}>
            Служение.<br />Преданность.<br />Любовь.
          </h1>
          <p style={{ margin: "22px auto 0", maxWidth: 600, fontFamily: "var(--font-text)", fontSize: 17.5, lineHeight: 1.62, color: "var(--color-label-2)" }}>
            Великая духовная традиция, существующая более 5000 лет, была возрождена и зарегистрирована святым <b style={{ color: "var(--color-label)" }}>Шрилой Прабхупадой</b> 13 июля 1966 года. Это <b style={{ color: "var(--color-label)" }}>Всемирное Движение Харе Кришна</b>, ИСККОН, Международное общество сознания Кришны, развиваемое веками линией духовных учителей, имеет главную миссию — <b style={{ color: "var(--color-label)" }}>помочь всем душам восстановить их любовную связь с Богом</b>.
          </p>
        </div>
      </Reveal>
    </section>
  );
}

function Wandering() {
  return (
    <Section top={84}>
      <p style={{ margin: 0, maxWidth: 620, marginInline: "auto", fontFamily: "var(--font-text)", fontSize: 17, lineHeight: 1.66, color: "var(--color-label-2)", textAlign: "center" }}>
        В одиночестве, без друзей и ресурсов, он бродил по улицам города в своих шафрановых одеждах. «Кто примет это послание, особенно в стране, настолько поглощённой материализмом? <b style={{ color: "var(--color-label)" }}>У меня нет надежды, но я попробую…</b>», — вспоминал Шрила Прабхупада.
      </p>
    </Section>
  );
}

function Today() {
  return (
    <Section top={92}>
      <H2>ИСККОН сегодня.</H2>
      <Lead>Невероятная статистика. Движение Харе Кришна — мировое духовное сообщество, объединяющее миллионы людей более чем в 80 странах. Это движение милосердия и любви распространилось на все континенты.</Lead>
      <div style={{ marginTop: 40, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "34px 16px", textAlign: "center" }}>
        {STATS.map((s) => (
          <div key={s.l}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(30px, 9vw, 44px)", fontWeight: 800, letterSpacing: "-1px", color: "var(--color-label)", lineHeight: 1 }}><CountUp value={s.v} /></div>
            <div style={{ margin: "8px auto 0", maxWidth: 150, fontFamily: "var(--font-text)", fontSize: 12.5, color: "var(--color-label-2)", lineHeight: 1.32 }}>{s.l}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Mantra() {
  return (
    <section style={{ margin: "92px -16px 0", padding: "64px 22px", background: "var(--color-bg-2)" }}>
      <Reveal>
        <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center" }}>
          <H2>Харе Кришна Мантра.</H2>
          <div style={{ marginTop: 28, fontFamily: "var(--font-scripture)", fontSize: 18, lineHeight: 1.7, color: "var(--color-label-3)" }}>
            हरे कृष्ण हरे कृष्ण · कृष्ण कृष्ण हरे हरे<br />हरे राम हरे राम · राम राम हरे हरे
          </div>
          <div style={{ marginTop: 22, fontFamily: "var(--font-display)", fontSize: "clamp(22px, 6vw, 30px)", fontWeight: 700, letterSpacing: "-0.4px", lineHeight: 1.45, color: "var(--color-label)" }}>
            Харе Кришна, Харе Кришна, Кришна Кришна, Харе Харе<br />Харе Рама, Харе Рама, Рама Рама, Харе Харе
          </div>
          <Lead>Каждый может получить духовное благо от повторения маха-мантры Харе Кришна. Когда звучит её трансцендентная вибрация, благо получают даже деревья, животные и насекомые. Громко повторяя мантру, человек проявляет милосердие ко всем живым существам.</Lead>
        </div>
      </Reveal>
    </section>
  );
}

function NytStory() {
  return (
    <Section top={92}>
      <Lead>
        После года скитаний и привлечения первых последователей в Нью-Йорке Шрила Прабхупада зарегистрировал ИСККОН в июле 1966 года. Через месяц The New York Times вышла со статьёй «Свами поёт в парке в поисках экстаза» — о «50 последователях, что хлопают и качаются под гипнотическую музыку на Ист-Сайде». В мгновение ока популярность Движения Харе Кришна взлетела.
      </Lead>
    </Section>
  );
}

function Goal() {
  return (
    <>
      <Section top={92}>
        <H2>Высшая цель.</H2>
        <Lead>Движение Харе Кришна исследует науку чистой преданной любви к Богу, воплощённой в божественной паре: Кришне и Его высшей энергии любви, Шримати Радхарани (Харе).</Lead>
      </Section>
      <Photo src="/media/radha-krishna.webp" ratio="16 / 10" rounded top={36} caption="Божества Радхи и Кришны на алтаре" />
    </>
  );
}

function Lifestyle({ onChange }: { onChange: (t: string) => void }) {
  return (
    <Section top={92}>
      <H2>Высший образ жизни.</H2>
      <Lead>Духовный путь бхакти-йоги — это практика любовного преданного служения Богу, воплощённому в вечной божественной паре: Кришне и Шримати Радхарани (Харе). Образ жизни вайшнава тесно связан с преданностью этим двум прекрасным личностям.</Lead>
      <div style={{ marginTop: 36 }}>
        {FORMS.map((f, i) => {
          const tap = !!f.go;
          return (
            <button key={f.t} type="button" disabled={!tap} onClick={() => f.go && onChange(f.go)}
              onPointerDown={(e) => { if (tap) e.currentTarget.style.opacity = "0.6"; }}
              onPointerUp={(e) => { if (tap) e.currentTarget.style.opacity = "1"; }}
              onPointerLeave={(e) => { if (tap) e.currentTarget.style.opacity = "1"; }}
              style={{ display: "flex", gap: 16, width: "100%", textAlign: "left", padding: "18px 0", borderTop: "0.5px solid var(--color-hairline)", borderBottom: i === FORMS.length - 1 ? "0.5px solid var(--color-hairline)" : "none", background: "transparent", cursor: tap ? "pointer" : "default" }}>
              <span style={{ flexShrink: 0, fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 800, color: GOLD, width: 22, lineHeight: 1.8 }}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, letterSpacing: "-0.3px", color: "var(--color-label)" }}>{f.t}</span>
                  {tap && <span style={{ marginLeft: "auto", color: GOLD, fontSize: 19, lineHeight: 1 }}>›</span>}
                </span>
                <span style={{ display: "block", marginTop: 6, fontFamily: "var(--font-text)", fontSize: 14.5, lineHeight: 1.52, color: "var(--color-label-2)" }}>{f.d}</span>
              </span>
            </button>
          );
        })}
      </div>
    </Section>
  );
}

function BooksSection({ onOpenBook }: { onOpenBook: (work: string) => void }) {
  return (
    <Section top={92}>
      <H2>Миллиард духовных книг.</H2>
      <Lead>ИСККОН распространяет древнюю священную литературу на 89 языках, помогая людям найти смысл жизни, организовать её согласно духовным принципам и научиться служить и любить Бога.</Lead>
      <div style={{ marginTop: 36, display: "flex", flexDirection: "column", gap: 14 }}>
        {BOOKLIST.map((b) => (
          <button key={b.work} type="button" onClick={() => onOpenBook(b.work)}
            onPointerDown={(e) => { e.currentTarget.style.opacity = "0.6"; }}
            onPointerUp={(e) => { e.currentTarget.style.opacity = "1"; }}
            onPointerLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
            style={{ display: "flex", gap: 16, alignItems: "center", width: "100%", textAlign: "left", padding: "16px", borderRadius: 18, background: "var(--color-bg-2)", border: "0.5px solid var(--color-hairline)", cursor: "pointer" }}>
            <img src={BOOKS[b.work]?.covers?.[0]} alt="" loading="lazy" style={{ flexShrink: 0, width: 66, height: 92, objectFit: "cover", borderRadius: 8, background: "var(--color-fill-1)" }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 17.5, fontWeight: 700, letterSpacing: "-0.2px", color: "var(--color-label)", lineHeight: 1.2 }}>{b.t}</span>
              <span style={{ display: "block", marginTop: 6, fontFamily: "var(--font-text)", fontSize: 13.5, lineHeight: 1.45, color: "var(--color-label-2)" }}>{b.d}</span>
              <span style={{ display: "inline-block", marginTop: 9, fontFamily: "var(--font-text)", fontSize: 13.5, fontWeight: 600, color: "var(--color-brand-blue)" }}>Читать онлайн →</span>
            </span>
          </button>
        ))}
      </div>
    </Section>
  );
}

function Founder({ onOpenEntity }: { onOpenEntity: (id: string, type: string | null) => void }) {
  return (
    <>
      <Section top={92}>
        <H2>Шрила Прабхупада.</H2>
        <Lead>Основатель Движения Харе Кришна оказал значительное влияние на современную духовную историю, включая глобальное распространение ключевых концепций. Вот несколько фактов о его жизни и наследии.</Lead>
        <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {[{ v: "14", l: "раз облетел весь мир с проповедью" }, { v: "108", l: "храмов основал лично" }].map((x) => (
            <div key={x.l} style={{ padding: "20px 18px", borderRadius: 18, background: "var(--color-bg-2)", textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(30px,9vw,42px)", fontWeight: 800, color: "var(--color-label)", lineHeight: 1 }}><CountUp value={x.v} /></div>
              <div style={{ margin: "8px auto 0", maxWidth: 150, fontFamily: "var(--font-text)", fontSize: 12.5, color: "var(--color-label-2)", lineHeight: 1.32 }}>{x.l}</div>
            </div>
          ))}
        </div>
      </Section>
      <Photo src="/media/prabhupada.webp" ratio="3 / 2" pos="center 22%" top={36} caption="Шрила Прабхупада ведёт киртан" />
      <section style={{ marginTop: 36 }}>
        <Reveal>
          <div style={{ maxWidth: 640, margin: "0 auto" }}>
            <p style={{ margin: 0, fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 16.5, color: "var(--color-label-2)", textAlign: "center" }}>Его Божественная Милость А. Ч. Бхактиведанта Свами Шрила Прабхупада</p>
            {BIO.map((p, i) => (
              <p key={i} style={{ margin: i === 0 ? "24px 0 0" : "16px 0 0", fontFamily: "var(--font-text)", fontSize: 16, lineHeight: 1.66, color: "var(--color-label-2)" }}>{p}</p>
            ))}
            <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {FACTS.map((f) => (
                <div key={f.t} style={{ padding: "16px", borderRadius: 14, background: "var(--color-bg-2)" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700, letterSpacing: "-0.2px", color: "var(--color-label)" }}>{f.t}</div>
                  <p style={{ margin: "6px 0 0", fontFamily: "var(--font-text)", fontSize: 13, lineHeight: 1.45, color: "var(--color-label-2)" }}>{f.d}</p>
                </div>
              ))}
            </div>
            <div style={{ textAlign: "center" }}>
              <button type="button" onClick={() => onOpenEntity("prabhupada", "personality")}
                onPointerDown={(e) => { e.currentTarget.style.opacity = "0.7"; }}
                onPointerUp={(e) => { e.currentTarget.style.opacity = "1"; }}
                onPointerLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
                style={{ marginTop: 30, padding: "13px 28px", borderRadius: 999, border: "none", background: "var(--color-label)", color: "var(--color-bg)", fontFamily: "var(--font-text)", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
                Жизнь и наследие
              </button>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}

function Principles() {
  return (
    <Section top={92}>
      <H2>Ничего лишнего.</H2>
      <Lead>Четыре регулирующих принципа свободы.</Lead>
      <div style={{ marginTop: 36, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {PRINCIPLES.map((p) => (
          <div key={p.t} style={{ padding: "18px 16px", borderRadius: 16, background: "var(--color-bg-2)" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, letterSpacing: "-0.2px", color: "var(--color-label)" }}>{p.t}</div>
            <p style={{ margin: "7px 0 0", fontFamily: "var(--font-text)", fontSize: 13.5, lineHeight: 1.45, color: "var(--color-label-2)" }}>{p.d}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Voices() {
  return (
    <Section top={92}>
      <H2>Влияние на весь мир.</H2>
      <Lead>Лидеры об ИСККОН и Движении Харе Кришна.</Lead>
      <div style={{ marginTop: 36, display: "flex", flexDirection: "column", gap: 28 }}>
        {VOICES.map((v) => (
          <figure key={v.n} style={{ margin: 0, display: "flex", gap: 15 }}>
            {v.img
              ? <img src={`/media/voices/${v.img}.webp`} alt="" loading="lazy" style={{ flexShrink: 0, width: 52, height: 52, borderRadius: "50%", objectFit: "cover", background: "var(--color-bg-2)" }} />
              : <span style={{ flexShrink: 0, width: 52, height: 52, borderRadius: "50%", background: "var(--color-bg-2)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: GOLD }}>{v.n[0]}</span>}
            <div style={{ minWidth: 0 }}>
              <blockquote style={{ margin: 0, fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 17.5, lineHeight: 1.5, color: "var(--color-label)" }}>«{v.c}»</blockquote>
              <figcaption style={{ marginTop: 8, fontFamily: "var(--font-text)" }}>
                <span style={{ fontSize: 14.5, fontWeight: 700, color: "var(--color-label)" }}>{v.n}</span>
                <span style={{ fontSize: 13, color: "var(--color-label-3)" }}> — {v.r}</span>
              </figcaption>
            </div>
          </figure>
        ))}
      </div>
      <div style={{ marginTop: 34, paddingTop: 28, borderTop: "0.5px solid var(--color-hairline)" }}>
        <blockquote style={{ margin: 0, fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 16.5, lineHeight: 1.6, color: "var(--color-label-2)" }}>
          За последние полвека ИСККОН достиг впечатляющих результатов в общественном служении: помощь жертвам цунами 2004 года и урагана «Катрина», 1,2 миллиона школьников ежедневно получают питание в Индии, больница Бхактиведанты приняла более 200 000 пациентов за год.
        </blockquote>
        <figcaption style={{ marginTop: 12, fontFamily: "var(--font-text)", fontSize: 13, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: GOLD }}>Forbes</figcaption>
      </div>
    </Section>
  );
}

function Purposes() {
  return (
    <Section top={92}>
      <H2>7 целей ИСККОН.</H2>
      <Lead>Семь основных целей, лично сформулированных Шрилой Прабхупадой при основании общества.</Lead>
      <ol style={{ margin: "32px 0 0", padding: 0, listStyle: "none" }}>
        {PURPOSES.map((p, i) => (
          <li key={i} style={{ display: "flex", gap: 16, padding: "16px 0", borderTop: "0.5px solid var(--color-hairline)" }}>
            <span style={{ flexShrink: 0, fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 800, color: GOLD, width: 24, lineHeight: 1.6 }}>{String(i + 1).padStart(2, "0")}</span>
            <span style={{ fontFamily: "var(--font-text)", fontSize: 15.5, lineHeight: 1.5, color: "var(--color-label-2)" }}>{p}</span>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function Explore({ onChange, onDonate }: { onChange: (t: string) => void; onDonate: () => void }) {
  const items = [
    { t: "Книги", sub: "БГ · ШБ · ЧЧ и труды ачарьев", act: () => onChange("books") },
    { t: "Киртаны", sub: "Бхаджаны, молитвы, мантры", act: () => onChange("kirtans") },
    { t: "Ачарья", sub: "Господь, аватары и спутники", act: () => onChange("acharya") },
    { t: "Поддержать служение", sub: "Стать частью миссии", act: onDonate },
  ];
  return (
    <Section top={92}>
      <H2>Продолжите путь.</H2>
      <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((it) => (
          <button key={it.t} type="button" onClick={it.act}
            onPointerDown={(e) => { e.currentTarget.style.opacity = "0.6"; }}
            onPointerUp={(e) => { e.currentTarget.style.opacity = "1"; }}
            onPointerLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
            style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", padding: "17px 18px", borderRadius: 16, border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)", cursor: "pointer" }}>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, letterSpacing: "-0.2px", color: "var(--color-label)" }}>{it.t}</span>
              <span style={{ display: "block", marginTop: 2, fontFamily: "var(--font-text)", fontSize: 13.5, color: "var(--color-label-2)" }}>{it.sub}</span>
            </span>
            <span style={{ color: GOLD, fontSize: 19, lineHeight: 1 }}>›</span>
          </button>
        ))}
      </div>
    </Section>
  );
}

function Footer() {
  return (
    <section style={{ margin: "84px -16px 0", padding: "48px 22px 8px", borderTop: "0.5px solid var(--color-hairline)", textAlign: "center" }}>
      <div style={{ fontFamily: "var(--font-scripture)", fontSize: 14.5, color: "var(--color-label-3)", lineHeight: 1.7 }}>
        Hare Kṛṣṇa Hare Kṛṣṇa Kṛṣṇa Kṛṣṇa Hare Hare<br />Hare Rāma Hare Rāma Rāma Rāma Hare Hare
      </div>
      <p style={{ margin: "22px auto 0", maxWidth: 560, fontFamily: "var(--font-text)", fontSize: 11.5, lineHeight: 1.65, color: "var(--color-label-3)" }}>
        ISKCON ONE LOVE — онлайн-ресурс последователей традиции ISKCON из разных стран, относящейся к Брахма-Мадхва-Гаудия-сампрадае, созданный как пространство вдохновения для тех, кто ценит наследие Ачарьи-основателя ИСККОН Его Божественной Милости А. Ч. Бхактиведанты Свами Шрилы Прабхупады. Ресурс не является официальным представительством какой-либо зарегистрированной организации ISKCON и не осуществляет миссионерскую деятельность. Все материалы публикуются в культурно-просветительском и личном контексте.
      </p>
    </section>
  );
}

/* ───────── экран ───────── */
export default function HomeScreen({ onChange, onOpenBook, onOpenEntity, onDonate }: {
  onChange: (tab: string) => void;
  onOpenBook: (work: string) => void;
  onOpenEntity: (id: string, type: string | null) => void;
  onDonate: () => void;
}) {
  useEffect(() => { fetch(api("/entities/prabhupada")).catch(() => {}); }, []);
  return (
    <div>
      <Styles />
      <Hero />
      <Photo src="/media/prabhupada-color.webp" ratio="3 / 2" pos="center 25%" top={40} caption="Шрила Прабхупада" />
      <Wandering />
      <Photo src="/media/prabhupada-nyc.webp" ratio="3 / 2" pos="center 28%" top={36} caption="Нью-Йорк, 1965 — начало движения" />
      <Marquee items={MQ1} />
      <Today />
      <Marquee items={MQ2} dur={44} />
      <Goal />
      <Mantra />
      <NytStory />
      <Lifestyle onChange={onChange} />
      <Marquee items={MQ3} dur={48} />
      <BooksSection onOpenBook={onOpenBook} />
      <Founder onOpenEntity={onOpenEntity} />
      <Principles />
      <Voices />
      <Purposes />
      <Explore onChange={onChange} onDonate={onDonate} />
      <Footer />
    </div>
  );
}
