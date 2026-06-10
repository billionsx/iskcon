/**
 * HomeScreen — «Главная». Стандарт iOS 26 на БЕЛОМ фоне, единый язык с
 * приложением: белые карточки (radius 18, hairline 0.5px, мягкая тень),
 * компактная типографика на --font-display (SF) с тесным трекингом, цитаты —
 * Georgia курсивом (--font-scripture). Открывается логотипом-эмблемой (без
 * дубля «ISKCON ONE LOVE» — он уже в шапке). Единые отступы: между блоками S,
 * внутри блоков 16px от краёв.
 */
import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { BOOKS } from "./books";
import { ChevRightIcon } from "./ui/icons";

const GOLD = "#D2AA1B";
const S = 36; // стандартный отступ между блоками
const PAD = 16; // стандартный отступ от краёв внутри блоков

/* поверхности (iOS 26 на белом) */
const card: React.CSSProperties = { background: "#fff", border: "0.5px solid var(--color-hairline)", borderRadius: 18, boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 10px 26px -14px rgba(0,0,0,0.12)" };
const tile: React.CSSProperties = { background: "#fff", border: "0.5px solid var(--color-hairline)", borderRadius: 14 };

/* трекинг */
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
      {subtitle && <p style={{ margin: "7px 0 0", fontFamily: "var(--font-text)", fontSize: 14, lineHeight: 1.5, letterSpacing: TR_BODY, color: "var(--color-label-2)" }}>{subtitle}</p>}
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
      {caption && <figcaption style={{ margin: "9px 2px 0", fontFamily: "var(--font-text)", fontSize: 12.5, letterSpacing: TR_BODY, color: "var(--color-label-3)", lineHeight: 1.4 }}>{caption}</figcaption>}
    </figure>
  );
}

function Quote({ children, center = false, size = 15, color = "var(--color-label)" }: { children: React.ReactNode; center?: boolean; size?: number; color?: string }) {
  return <blockquote style={{ margin: 0, fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: size, lineHeight: 1.55, letterSpacing: TR_BODY, color, textAlign: center ? "center" : "left" }}>{children}</blockquote>;
}

function NavCard({ mark, title, subtitle, onClick, accent }: { mark: React.ReactNode; title: string; subtitle: string; onClick: () => void; accent?: boolean }) {
  const ring: React.CSSProperties = accent
    ? { border: `1.5px solid color-mix(in srgb, ${GOLD} 55%, transparent)`, background: `color-mix(in srgb, ${GOLD} 10%, transparent)` }
    : { border: "0.5px solid var(--color-hairline)", background: "var(--color-fill-1)" };
  return (
    <button type="button" onClick={onClick}
      onPointerDown={(e) => (e.currentTarget.style.opacity = "0.7")}
      onPointerUp={(e) => (e.currentTarget.style.opacity = "1")}
      onPointerLeave={(e) => (e.currentTarget.style.opacity = "1")}
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

/* счётчик статистики */
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

/* ───────── данные ───────── */
const STATS = [
  { v: "10+", l: "миллионов последователей" }, { v: "2 000+", l: "храмов по всему миру" },
  { v: "65+", l: "сельхоз-общин" }, { v: "8,7+", l: "млрд порций прасада" },
  { v: "55+", l: "учебных заведений" }, { v: "на 89", l: "языках издаются книги" },
  { v: "300+", l: "ресторанов" }, { v: "100+", l: "гуру и наставников" },
];
const FORMS = [
  { t: "Мантра", d: "Звуковая форма Кришны и Радхарани. Повторение мантры Харе Кришна — тихо (джапа) или громко (киртан) — очищает сердце и соединяет с Богом.", go: "kirtans" },
  { t: "Книги", d: "Литературная форма. «Бхагавад-гита», «Шримад-Бхагаватам» и «Чайтанья-чаритамрита» позволяют встретить Бога на страницах писаний.", go: "books" },
  { t: "Божества", d: "Проявленные формы Кришны и Радхарани неотличны от Их вечных духовных форм — преданные служат Им непосредственно." },
  { t: "Прасад", d: "Вегетарианская пища, предложенная Господу, становится освящённой и передаёт духовную силу и любовь." },
  { t: "Садху", d: "Святые, хранящие в сердце Кришну и Радхарани, — духовные наставники и живой пример преданности.", go: "acharya" },
  { t: "Дхама", d: "Святые места, неотличные от духовного мира. Вриндаван и Маяпур углубляют духовное сознание." },
];
const PRINCIPLES = [
  { t: "Без мяса", d: "Без мяса, рыбы и яиц — образ жизни в согласии с ахимсой, ненасилием." },
  { t: "Без незаконного секса", d: "Целомудрие до брака и верность в браке." },
  { t: "Без азартных игр", d: "Без азартных игр и спекуляций — ради честности и осознанности." },
  { t: "Без интоксикаций", d: "Без алкоголя, наркотиков и табака — ради ясного ума." },
];
const VOICES = [
  { img: "", c: "Меня вдохновляет работа этого храма и общины. Это место великой духовности — оно привлекает сотни тысяч людей и объединяет людей самых разных слоёв общества.", n: "Борис Джонсон", r: "экс-премьер-министр Великобритании" },
  { img: "jobs", c: "Я проходил 7 миль через весь город каждую неделю, чтобы в воскресенье вечером получить хорошее блюдо в храме Харе Кришна.", n: "Стив Джобс", r: "сооснователь Apple Inc." },
  { img: "", c: "Я прочитал 90 процентов «Бхагавад-гиты». Когда я её читаю, мой внутренний Арджуна направляется на верный путь.", n: "Уилл Смит", r: "голливудский актёр" },
  { img: "lennon", c: "Повторение мантры Харе Кришна — это вид медитации, который может действительно вызвать состояние экстаза.", n: "Джон Леннон", r: "музыкант, The Beatles" },
  { img: "", c: "ИСККОН научил мир истинному значению веры.", n: "Нарендра Моди", r: "премьер-министр Индии" },
  { img: "harrison", c: "Он был идеальным примером всего, чему учил. Не имея ничего материального, он привлёк тысячи преданных и основал движение, которое остаётся сильным даже после его ухода.", n: "Джордж Харрисон", r: "музыкант, The Beatles" },
  { img: "mukherjee", c: "Я выражаю глубокую признательность Шриле Прабхупаде, который распространил послание сознания Кришны по всему миру.", n: "Шри Пранаб Мукерджи", r: "13-й президент Индии" },
  { img: "sunak", c: "В самые трудные времена именно «Гита» давала мне силу продолжать бороться за то, во что я верю.", n: "Риши Сунак", r: "премьер-министр Великобритании" },
];
const BOOKLIST = [
  { work: "bg", t: "Бхагавад-гита как она есть", d: "Вечный диалог Кришны и Арджуны: как организовать жизнь и достичь совершенства, чтобы вернуться к Богу." },
  { work: "sb", t: "Шримад-Бхагаватам", d: "О том, как Верховная Личность Бога приходит в различных формах, в разные эпохи и к разным душам." },
  { work: "cc", t: "Шри Чайтанья-чаритамрита", d: "О божественных играх Шри Чайтаньи Махапрабху — объединённого воплощения Кришны и Радхарани." },
];
const BIO: string[] = [
  "Шрила Прабхупада — выдающийся духовный учитель индийского происхождения, принёсший сознание Кришны в западный мир и заложивший основы глобального вайшнавского возрождения.",
  "Он родился 1 сентября 1896 года в Калькутте, в благочестивой вайшнавской семье; родители дали ему имя Абхай Чаран Де. В 1922 году он встретил духовного учителя, Шрилу Бхактисиддханту Сарасвати, и получил наставление распространить ведическое знание на английском языке.",
  "В 1965 году, в возрасте 69 лет, он на грузовом судне отправился в США, имея при себе лишь несколько долларов и ящик книг. Уже в 1966 году он официально зарегистрировал Международное общество сознания Кришны (ИСККОН).",
  "За двенадцать лет он основал ИСККОН по всему миру, перевёл ключевые писания, инициировал тысячи учеников и четырнадцать раз облетел земной шар. В 1977 году он покинул этот мир во Вриндаване. Его наставление остаётся живым: «Повторяйте Харе Кришна и будьте счастливы».",
];
const FACTS = [
  { t: "Путешествие в Америку", d: "В 69 лет покинул Вриндаван и отправился в Нью-Йорк с 7 долларами и ящиком писаний." },
  { t: "Всемирная проповедь", d: "Начав с мантры в парке, основал первые храмы — начало глобального движения." },
  { t: "Литературное наследие", d: "Написал и перевёл более 70 книг, включая «Бхагавад-гиту как она есть»." },
  { t: "Музыкальное влияние", d: "Представил киртан как медитацию, завоевавшую популярность, в том числе у The Beatles." },
  { t: "Культурные концепции", d: "Популяризировал понятия кармы, реинкарнации и йоги для мировой аудитории." },
  { t: "Помощь нуждающимся", d: "Стремился, чтобы каждый получил прасад. Роздано около 8,7 млрд порций." },
];
const PURPOSES = [
  "Систематически распространять духовное знание и обучать методам духовной жизни ради подлинного единства и мира.",
  "Распространять сознание Кришны, как оно раскрыто в «Бхагавад-гите» и «Шримад-Бхагаватам».",
  "Объединять членов Общества друг с другом и с Кришной, развивая понимание, что каждая душа — частица божественной природы.",
  "Поощрять санкиртану — коллективное пение святого имени Бога, как учил Шри Чайтанья Махапрабху.",
  "Возводить святое место трансцендентных игр, посвящённое личности Кришны.",
  "Объединять членов Общества ради более простого и естественного образа жизни.",
  "Издавать и распространять журналы, книги и другие письменные материалы.",
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
    // белый фон на всю ширину колонки (перекрывает серое полотно), отступы 16px возвращены
    <div style={{ background: "#fff", margin: "-16px -16px -116px", padding: "16px 16px 116px", fontFamily: "var(--font-text)" }}>
      {/* HERO — эмблема-лотос + заголовок (без «ISKCON ONE LOVE», он в шапке) */}
      <MaskMark src="/iskcon.svg" size={50} color={GOLD} />
      <h1 style={{ margin: "16px 0 0", fontFamily: "var(--font-display)", fontSize: "clamp(27px, 7.8vw, 32px)", fontWeight: 800, letterSpacing: TR_HERO, lineHeight: 1.06, color: "var(--color-label)" }}>
        Служение.<br />Преданность. Любовь.
      </h1>
      <p style={{ margin: "12px 0 0", fontFamily: "var(--font-text)", fontSize: 15, lineHeight: 1.55, letterSpacing: TR_BODY, color: "var(--color-label-2)" }}>
        Великая духовная традиция, возрождённая Шрилой Прабхупадой 13 июля 1966 года. Всемирное Движение Харе Кришна помогает каждой душе восстановить её вечную любовную связь с Богом.
      </p>
      <Figure src="/media/prabhupada-color.webp" ratio="4 / 3" pos="center 22%"
        caption="Ачарья-основатель ИСККОН — Его Божественная Милость А. Ч. Бхактиведанта Свами Шрила Прабхупада" />

      {/* Скитания — цитата Georgia курсивом */}
      <Section>
        <div style={{ padding: PAD, ...card }}>
          <Quote size={15}>
            «В одиночестве, без друзей и ресурсов, он бродил по улицам города. Кто примет это послание в стране, настолько поглощённой материализмом? У меня нет надежды, но я попробую…» — вспоминал Шрила Прабхупада.
          </Quote>
        </div>
        <Figure src="/media/prabhupada-nyc.webp" ratio="3 / 2" pos="center 28%" caption="Нью-Йорк, 1965 — начало движения" />
      </Section>

      {/* ИСККОН сегодня */}
      <Section>
        <SectionHead eyebrow="Сегодня" title="ИСККОН сегодня" subtitle="Движение Харе Кришна — мировое духовное сообщество в более чем 80 странах." />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {STATS.map((s) => <StatTile key={s.l} v={s.v} l={s.l} />)}
        </div>
      </Section>

      {/* Высшая цель */}
      <Section>
        <SectionHead eyebrow="Высшая цель" title="Чистая любовь к Богу" subtitle="Движение Харе Кришна исследует науку преданной любви, воплощённой в божественной паре: Кришне и Его энергии любви, Шримати Радхарани (Харе)." />
        <Figure src="/media/radha-krishna.webp" ratio="16 / 10" caption="Божества Радхи и Кришны на алтаре" />
      </Section>

      {/* Маха-мантра — карточка */}
      <Section>
        <div style={{ padding: 20, ...card }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-text)", fontSize: 11, fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLD }}>Маха-мантра</div>
            <div style={{ marginTop: 12, fontFamily: "var(--font-scripture)", fontSize: 15, lineHeight: 1.7, color: "var(--color-label-3)" }}>
              हरे कृष्ण हरे कृष्ण · कृष्ण कृष्ण हरे हरे<br />हरे राम हरे राम · राम राम हरे हरे
            </div>
            <div style={{ marginTop: 12, fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, letterSpacing: TR_TITLE, lineHeight: 1.5, color: "var(--color-label)" }}>
              Харе Кришна, Харе Кришна, Кришна Кришна, Харе Харе<br />Харе Рама, Харе Рама, Рама Рама, Харе Харе
            </div>
            <p style={{ margin: "12px 0 0", fontFamily: "var(--font-text)", fontSize: 13, lineHeight: 1.5, letterSpacing: TR_BODY, color: "var(--color-label-2)" }}>
              Когда звучит трансцендентная вибрация святого имени, благо получают все живые существа. Повторение маха-мантры — высшее милосердие ко всему миру.
            </p>
          </div>
        </div>
      </Section>

      {/* Высший образ жизни — grouped-список */}
      <Section>
        <SectionHead eyebrow="Практика" title="Высший образ жизни" subtitle="Бхакти-йога — любовное преданное служение Кришне и Шримати Радхарани в шести формах." />
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

      {/* Миллиард книг */}
      <Section>
        <SectionHead eyebrow="Библиотека" title="Миллиард духовных книг" subtitle="Священная литература на 89 языках помогает найти смысл жизни и научиться служить Богу." />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {BOOKLIST.map((b) => (
            <button key={b.work} type="button" onClick={() => onOpenBook(b.work)}
              onPointerDown={(e) => (e.currentTarget.style.opacity = "0.7")}
              onPointerUp={(e) => (e.currentTarget.style.opacity = "1")}
              onPointerLeave={(e) => (e.currentTarget.style.opacity = "1")}
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

      {/* Шрила Прабхупада */}
      <Section>
        <SectionHead eyebrow="Ачарья-основатель" title="Шрила Прабхупада" subtitle="Основатель Движения Харе Кришна, оказавший значительное влияние на современную духовную историю." />
        <Figure src="/media/prabhupada.webp" ratio="3 / 2" pos="center 22%" caption="Шрила Прабхупада ведёт киртан" />
        <div style={{ margin: "16px 0 0", padding: "0 6px" }}>
          <Quote center size={16}>«Лучшее, что можно сделать для Господа, — это попытаться вдохнуть преданное служение в сердце обусловленной души, чтобы она сбросила оковы обусловленной жизни».</Quote>
        </div>
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[{ v: "14", l: "раз облетел весь мир" }, { v: "108", l: "храмов основал лично" }].map((x) => (
            <div key={x.l} style={{ padding: PAD, textAlign: "center", ...tile }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 27, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--color-label)", lineHeight: 1 }}><CountUp value={x.v} /></div>
              <div style={{ marginTop: 6, fontFamily: "var(--font-text)", fontSize: 12, letterSpacing: TR_BODY, color: "var(--color-label-3)", lineHeight: 1.3 }}>{x.l}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16 }}>
          {BIO.map((p, i) => (
            <p key={i} style={{ margin: i ? "12px 0 0" : 0, fontFamily: "var(--font-text)", fontSize: 14.5, lineHeight: 1.6, letterSpacing: TR_BODY, color: "var(--color-label-2)" }}>{p}</p>
          ))}
        </div>
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {FACTS.map((f) => (
            <div key={f.t} style={{ padding: PAD, ...tile }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, letterSpacing: TR_TITLE, color: "var(--color-label)" }}>{f.t}</div>
              <p style={{ margin: "6px 0 0", fontFamily: "var(--font-text)", fontSize: 12.5, lineHeight: 1.45, letterSpacing: TR_BODY, color: "var(--color-label-2)" }}>{f.d}</p>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => onOpenEntity("prabhupada", "personality")}
          onPointerDown={(e) => (e.currentTarget.style.opacity = "0.85")}
          onPointerUp={(e) => (e.currentTarget.style.opacity = "1")}
          onPointerLeave={(e) => (e.currentTarget.style.opacity = "1")}
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
            <Quote size={14} color="var(--color-label-2)">За полвека ИСККОН достиг впечатляющих результатов в служении: 1,2 миллиона школьников ежедневно получают питание в Индии, а больница Бхактиведанты приняла более 200 000 пациентов за год.</Quote>
            <div style={{ marginTop: 9, fontFamily: "var(--font-text)", fontSize: 11, fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: GOLD }}>Forbes</div>
          </div>
        </div>
      </Section>

      {/* 7 целей */}
      <Section>
        <SectionHead eyebrow="Миссия" title="7 целей ИСККОН" subtitle="Семь целей, лично сформулированных Шрилой Прабхупадой при основании общества." />
        <ul style={{ margin: 0, padding: 0, listStyle: "none", overflow: "hidden", ...card }}>
          {PURPOSES.map((p, i) => (
            <li key={i} style={{ display: "flex", gap: 13, padding: PAD, alignItems: "flex-start", borderTop: i ? "0.5px solid var(--color-hairline)" : "none" }}>
              <span style={{ flexShrink: 0, width: 20, fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700, color: GOLD, lineHeight: 1.5 }}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ fontFamily: "var(--font-text)", fontSize: 14, lineHeight: 1.5, letterSpacing: TR_BODY, color: "var(--color-label-2)" }}>{p}</span>
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
