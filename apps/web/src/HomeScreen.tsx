/**
 * HomeScreen — «Главная»: презентация ИСККОН мирового уровня (перенос смысла
 * с iskcone.com, поданный по стандарту Apple). Редакционный вертикальный
 * нарратив: герой → миссия → статистика → маха-мантра → формы практики →
 * книги → Шрила Прабхупада → принципы → голоса мира → Forbes → 7 целей →
 * парампара → переходы в разделы приложения.
 *
 * Дизайн-язык общий с приложением: SF для UI, Georgia (--font-scripture) для
 * санскрита и цитат, золотой акцент #D2AA1B, grouped-iOS поверхности.
 */
import { useEffect, useState } from "react";
import { api } from "./api";

const GOLD = "#D2AA1B";
const INK_BAND = "#15141a"; // фиксированный тёмный бэнд (мантра) — не зависит от темы

/* ─── атомы ─── */

function Eyebrow({ children, color = GOLD }: { children: React.ReactNode; color?: string }) {
  return <div style={{ fontFamily: "var(--font-text)", fontSize: 12, fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color }}>{children}</div>;
}

function SectionTitle({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return <h2 style={{ margin: "8px 0 0", fontFamily: "var(--font-display)", fontSize: 29, fontWeight: 800, letterSpacing: "-0.6px", lineHeight: 1.1, color: light ? "#fff" : "var(--color-label)" }}>{children}</h2>;
}

function Lead({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: "14px 0 0", fontFamily: "var(--font-text)", fontSize: 17, lineHeight: 1.6, color: "var(--color-label-2)" }}>{children}</p>;
}

function Section({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <section style={{ marginTop: 52, ...style }}>{children}</section>;
}

// Полосатый full-bleed бэнд (выходит за 16px-паддинг контейнера)
function Band({ children, bg, style }: { children: React.ReactNode; bg: string; style?: React.CSSProperties }) {
  return (
    <section style={{ margin: "52px -16px 0", padding: "44px 22px", background: bg, ...style }}>{children}</section>
  );
}

/* ─── данные ─── */

const STATS: { value: string; label: string }[] = [
  { value: "10 млн+", label: "последователей" },
  { value: "2 000+", label: "храмов по миру" },
  { value: "8,7 млрд+", label: "порций прасада роздано" },
  { value: "89", label: "языков изданий" },
  { value: "65+", label: "сельских общин" },
  { value: "300+", label: "ресторанов" },
  { value: "55+", label: "учебных заведений" },
  { value: "100+", label: "духовных учителей" },
];

const FORMS: { t: string; lead: string; body: string; go?: string }[] = [
  { t: "Мантра", lead: "Звуковая форма", body: "Повторение Харе Кришна — тихо (джапа) или вслух (киртан) — очищает ум и сердце, мгновенно соединяя с Богом.", go: "kirtans" },
  { t: "Книги", lead: "Литературная форма", body: "«Бхагавад-гита», «Шримад-Бхагаватам», «Чайтанья-чаритамрита» — встреча с Богом на страницах священных текстов.", go: "books" },
  { t: "Божества", lead: "Проявленная форма", body: "Формы Кришны и Радхарани в этом мире неотличны от Их вечных духовных форм и позволяют служить Им напрямую." },
  { t: "Прасад", lead: "Освящённая пища", body: "Вегетарианская пища, предложенная Господу, становится освящённой и несёт духовную силу и любовь." },
  { t: "Садху", lead: "Святые", body: "Хранящие Кришну и Радхарани в сердце — живой пример преданности, служения и любви.", go: "acharya" },
  { t: "Дхама", lead: "Святые места", body: "Места, неотличные от духовного мира, — Вриндаван, Маяпур. Их посещение углубляет сознание Бога.", go: "dhama" },
];

const PRINCIPLES: { t: string; body: string }[] = [
  { t: "Без мяса", body: "Отказ от мяса, рыбы и яиц — жизнь в согласии с ахимсой, ненасилием." },
  { t: "Без недозволенного секса", body: "Целомудрие до брака и верность в браке." },
  { t: "Без азартных игр", body: "Жизнь в честности, надёжности и осознанности." },
  { t: "Без интоксикаций", body: "Без алкоголя, наркотиков и табака — ради ясного, сосредоточенного ума." },
];

const VOICES: { quote: string; name: string; role: string }[] = [
  { quote: "Я проходил 11 километров через весь город каждую неделю, чтобы воскресным вечером получить хорошее блюдо в храме Харе Кришна.", name: "Стив Джобс", role: "сооснователь Apple Inc." },
  { quote: "Он был совершенным примером всего, чему учил. Не имея ничего материального, но обладая сознанием Кришны, он привлёк тысячи преданных и основал целое движение, которое крепнет с каждым днём.", name: "Джордж Харрисон", role: "музыкант, The Beatles" },
  { quote: "Повторение мантры Харе Кришна — это вид медитации, который может действительно вызвать состояние экстаза.", name: "Джон Леннон", role: "музыкант, The Beatles" },
  { quote: "ИСККОН научил мир истинному значению веры.", name: "Нарендра Моди", role: "премьер-министр Индии" },
  { quote: "В самые трудные времена именно «Гита» давала мне силу продолжать бороться за то, во что я верю.", name: "Риши Сунак", role: "премьер-министр Великобритании" },
];

const PURPOSES: string[] = [
  "Систематически распространять духовное знание и обучать методам духовной жизни — ради подлинного единства и мира в мире.",
  "Распространять сознание Кришны, как оно раскрыто в «Бхагавад-гите» и «Шримад-Бхагаватам».",
  "Сближать членов общества друг с другом и с Кришной, раскрывая, что каждая душа — частица божественной природы.",
  "Развивать движение санкиртаны — совместного пения святого имени, как учил Шри Чайтанья Махапрабху.",
  "Возводить святые места трансцендентных игр, посвящённые Кришне.",
  "Объединять людей ради более простого и естественного образа жизни.",
  "Издавать и распространять журналы, книги и духовные материалы.",
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

const FOUNDER_FACTS: { v: string; l: string }[] = [
  { v: "1896–1977", l: "годы жизни" },
  { v: "108", l: "храмов основал" },
  { v: "70+", l: "книг написал и перевёл" },
  { v: "14", l: "кругосветных путешествий" },
];

/* ─── секции ─── */

function Hero() {
  return (
    <section style={{ paddingTop: 8, textAlign: "center" }}>
      <span style={{ display: "inline-block", width: 60, height: 60, backgroundColor: "var(--color-label)",
        WebkitMaskImage: "url(/iskcon.svg)", maskImage: "url(/iskcon.svg)", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
        WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskPosition: "center", maskPosition: "center" }} />
      <div style={{ marginTop: 18, fontFamily: "var(--font-text)", fontSize: 12, fontWeight: 700, letterSpacing: "1.4px", textTransform: "uppercase", color: "var(--color-label-3)" }}>ISKCON ONE LOVE</div>
      <h1 style={{ margin: "14px 0 0", fontFamily: "var(--font-display)", fontSize: 40, fontWeight: 800, letterSpacing: "-1.2px", lineHeight: 1.05, color: "var(--color-label)" }}>
        Служение.<br />Преданность.<br /><span style={{ color: GOLD }}>Любовь.</span>
      </h1>
      <p style={{ margin: "18px auto 0", maxWidth: 440, fontFamily: "var(--font-text)", fontSize: 17, lineHeight: 1.55, color: "var(--color-label-2)" }}>
        Международное общество сознания Кришны — мировое движение Харе Кришна, объединяющее миллионы сердец более чем в 80 странах.
      </p>
    </section>
  );
}

function StatGrid() {
  return (
    <Band bg="var(--color-bg-2)">
      <Eyebrow>ИСККОН сегодня</Eyebrow>
      <SectionTitle>Невероятная статистика</SectionTitle>
      <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "28px 18px" }}>
        {STATS.map((s) => (
          <div key={s.label}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 800, letterSpacing: "-0.5px", color: GOLD, lineHeight: 1 }}>{s.value}</div>
            <div style={{ marginTop: 6, fontFamily: "var(--font-text)", fontSize: 13.5, color: "var(--color-label-2)", lineHeight: 1.3 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </Band>
  );
}

function MantraBand() {
  return (
    <Band bg={INK_BAND} style={{ textAlign: "center", padding: "52px 22px" }}>
      <div style={{ fontFamily: "var(--font-text)", fontSize: 12, fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: GOLD }}>Маха-мантра</div>
      <div style={{ marginTop: 18, fontFamily: "var(--font-scripture)", fontSize: 21, lineHeight: 1.7, color: "rgba(255,255,255,0.62)" }}>
        हरे कृष्ण हरे कृष्ण<br />कृष्ण कृष्ण हरे हरे<br />हरे राम हरे राम<br />राम राम हरे हरे
      </div>
      <div style={{ marginTop: 22, fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, letterSpacing: "-0.2px", lineHeight: 1.5, color: "#fff" }}>
        Харе Кришна, Харе Кришна,<br />Кришна Кришна, Харе Харе<br />Харе Рама, Харе Рама,<br />Рама Рама, Харе Харе
      </div>
      <p style={{ margin: "24px auto 0", maxWidth: 460, fontFamily: "var(--font-text)", fontSize: 15.5, lineHeight: 1.6, color: "rgba(255,255,255,0.7)" }}>
        Когда звучит трансцендентная вибрация Харе Кришна, благо получают все живые существа — даже деревья, животные и насекомые. Так повторение святого имени становится высшим милосердием ко всему миру.
      </p>
    </Band>
  );
}

function FormsGrid({ onChange }: { onChange: (t: string) => void }) {
  return (
    <Section>
      <Eyebrow>Высший образ жизни</Eyebrow>
      <SectionTitle>Шесть форм бхакти-йоги</SectionTitle>
      <Lead>Путь чистой преданной любви к Богу, воплощённой в вечной паре — Кришне и Его высшей энергии любви, Шримати Радхарани (Харе).</Lead>
      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        {FORMS.map((f) => {
          const tappable = !!f.go;
          return (
            <button key={f.t} type="button" disabled={!tappable} onClick={() => f.go && onChange(f.go)}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "17px 18px", borderRadius: 18,
                border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)", cursor: tappable ? "pointer" : "default" }}
              onPointerDown={(e) => tappable && (e.currentTarget.style.opacity = "0.7")}
              onPointerUp={(e) => tappable && (e.currentTarget.style.opacity = "1")}
              onPointerLeave={(e) => tappable && (e.currentTarget.style.opacity = "1")}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700, letterSpacing: "-0.3px", color: "var(--color-label)" }}>{f.t}</span>
                <span style={{ fontFamily: "var(--font-text)", fontSize: 12.5, fontWeight: 600, color: GOLD, letterSpacing: "0.2px" }}>{f.lead}</span>
                {tappable && <span style={{ marginLeft: "auto", color: "var(--color-label-3)", fontSize: 20, lineHeight: 1 }}>›</span>}
              </div>
              <p style={{ margin: "6px 0 0", fontFamily: "var(--font-text)", fontSize: 14.5, lineHeight: 1.5, color: "var(--color-label-2)" }}>{f.body}</p>
            </button>
          );
        })}
      </div>
    </Section>
  );
}

function BooksRow({ onOpenBook }: { onOpenBook: (work: string) => void }) {
  const books: { work: string; t: string; body: string }[] = [
    { work: "bg", t: "Бхагавад-гита как она есть", body: "Вечный диалог Кришны и Арджуны — как организовать жизнь и вернуться домой, к Богу." },
    { work: "sb", t: "Шримад-Бхагаватам", body: "Как Верховный Господь приходит в разные эпохи и в разных формах к душам с разной преданностью." },
    { work: "cc", t: "Шри Чайтанья-чаритамрита", body: "Игры самой милостивой формы Бога — Шри Чайтаньи, дарующего чистую любовь к Богу." },
  ];
  return (
    <Section>
      <Eyebrow>Миллиард духовных книг</Eyebrow>
      <SectionTitle>Священная литература на 89 языках</SectionTitle>
      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        {books.map((b) => (
          <button key={b.work} type="button" onClick={() => onOpenBook(b.work)}
            style={{ display: "flex", gap: 14, width: "100%", textAlign: "left", padding: "16px 18px", borderRadius: 18,
              border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)", cursor: "pointer" }}
            onPointerDown={(e) => (e.currentTarget.style.opacity = "0.7")}
            onPointerUp={(e) => (e.currentTarget.style.opacity = "1")}
            onPointerLeave={(e) => (e.currentTarget.style.opacity = "1")}>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, letterSpacing: "-0.2px", color: "var(--color-label)" }}>{b.t}</span>
              <span style={{ display: "block", marginTop: 4, fontFamily: "var(--font-text)", fontSize: 14, lineHeight: 1.45, color: "var(--color-label-2)" }}>{b.body}</span>
              <span style={{ display: "inline-block", marginTop: 8, fontFamily: "var(--font-text)", fontSize: 13.5, fontWeight: 600, color: "var(--color-brand-blue)" }}>Читать →</span>
            </span>
          </button>
        ))}
      </div>
    </Section>
  );
}

function Founder({ onOpenEntity }: { onOpenEntity: (id: string, type: string | null) => void }) {
  const [img, setImg] = useState<string | null>(null);
  useEffect(() => {
    let a = true;
    fetch(api("/entities/prabhupada")).then((r) => r.json()).then((d) => { if (a) setImg(d?.image ?? null); }).catch(() => {});
    return () => { a = false; };
  }, []);
  return (
    <Band bg="var(--color-bg-2)" style={{ padding: "44px 22px", textAlign: "center" }}>
      <span style={{ display: "inline-grid", placeItems: "center", width: 116, height: 116, borderRadius: "50%", overflow: "hidden",
        border: `1.5px solid color-mix(in srgb, ${GOLD} 55%, transparent)`, background: `color-mix(in srgb, ${GOLD} 9%, transparent)` }}>
        {img
          ? <img src={img} alt="Шрила Прабхупада" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ width: 96, height: 96, backgroundColor: "var(--color-label)", WebkitMaskImage: "url(/prabhupada.svg)", maskImage: "url(/prabhupada.svg)", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskPosition: "center bottom", maskPosition: "center bottom" }} />}
      </span>
      <div style={{ marginTop: 20 }}><Eyebrow>Ачарья-основатель ИСККОН</Eyebrow></div>
      <h2 style={{ margin: "8px 0 0", fontFamily: "var(--font-display)", fontSize: 27, fontWeight: 800, letterSpacing: "-0.5px", color: "var(--color-label)" }}>Шрила Прабхупада</h2>
      <p style={{ margin: "6px auto 0", maxWidth: 460, fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 16, color: "var(--color-label-2)" }}>
        Его Божественная Милость А.Ч. Бхактиведанта Свами
      </p>
      <p style={{ margin: "16px auto 0", maxWidth: 470, fontFamily: "var(--font-text)", fontSize: 15.5, lineHeight: 1.6, color: "var(--color-label-2)" }}>
        В 1965 году, в 69 лет, имея лишь несколько долларов и ящик книг, он один отправился из Вриндавана в Нью-Йорк. За двенадцать лет он зажёг во всём мире беспрецедентную волну Гауранга-лилы, исполнив пророчество Шри Чайтаньи: святое имя будет звучать в каждом городе и деревне.
      </p>
      <div style={{ margin: "26px auto 0", maxWidth: 420, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px 14px" }}>
        {FOUNDER_FACTS.map((f) => (
          <div key={f.l}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800, color: GOLD, lineHeight: 1 }}>{f.v}</div>
            <div style={{ marginTop: 5, fontFamily: "var(--font-text)", fontSize: 13, color: "var(--color-label-2)", lineHeight: 1.3 }}>{f.l}</div>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => onOpenEntity("prabhupada", "personality")}
        style={{ marginTop: 28, padding: "13px 26px", borderRadius: 999, border: "none", background: "var(--color-label)", color: "var(--color-bg)",
          fontFamily: "var(--font-text)", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
        Жизнь и наследие
      </button>
    </Band>
  );
}

function Principles() {
  return (
    <Section>
      <Eyebrow>Ничего лишнего</Eyebrow>
      <SectionTitle>Четыре принципа свободы</SectionTitle>
      <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {PRINCIPLES.map((p) => (
          <div key={p.t} style={{ padding: "16px 16px", borderRadius: 16, border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, letterSpacing: "-0.2px", color: "var(--color-label)" }}>{p.t}</div>
            <p style={{ margin: "6px 0 0", fontFamily: "var(--font-text)", fontSize: 13.5, lineHeight: 1.45, color: "var(--color-label-2)" }}>{p.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Voices() {
  return (
    <Section>
      <Eyebrow>Голоса мира</Eyebrow>
      <SectionTitle>Влияние на весь мир</SectionTitle>
      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 14 }}>
        {VOICES.map((v) => (
          <figure key={v.name} style={{ margin: 0, padding: "20px 20px", borderRadius: 18, border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)" }}>
            <blockquote style={{ margin: 0, fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 17, lineHeight: 1.55, color: "var(--color-label)" }}>«{v.quote}»</blockquote>
            <figcaption style={{ marginTop: 12 }}>
              <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: 14.5, fontWeight: 700, color: "var(--color-label)" }}>{v.name}</span>
              <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: 13, color: "var(--color-label-3)" }}>{v.role}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      <Band bg={INK_BAND} style={{ marginTop: 14, padding: "32px 22px", borderRadius: 20 }}>
        <blockquote style={{ margin: 0, fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 16.5, lineHeight: 1.6, color: "rgba(255,255,255,0.85)" }}>
          За полвека ИСККОН достиг впечатляющих результатов в служении обществу: помощь жертвам цунами 2004 года и урагана «Катрина», 1,2 миллиона школьников ежедневно получают питание в Индии, больница Бхактиведанты приняла более 200 000 пациентов за год.
        </blockquote>
        <figcaption style={{ marginTop: 14, fontFamily: "var(--font-text)", fontSize: 13, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: GOLD }}>Forbes</figcaption>
      </Band>
    </Section>
  );
}

function Purposes() {
  return (
    <Section>
      <Eyebrow>Миссия</Eyebrow>
      <SectionTitle>Семь целей ИСККОН</SectionTitle>
      <Lead>Семь целей, лично сформулированных Шрилой Прабхупадой при основании общества.</Lead>
      <ol style={{ margin: "22px 0 0", padding: 0, listStyle: "none", counterReset: "p" }}>
        {PURPOSES.map((p, i) => (
          <li key={i} style={{ display: "flex", gap: 14, padding: "14px 0", borderTop: i === 0 ? "none" : "0.5px solid var(--color-hairline)" }}>
            <span style={{ flexShrink: 0, fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 800, color: GOLD, width: 22, lineHeight: 1.5 }}>{String(i + 1).padStart(2, "0")}</span>
            <span style={{ fontFamily: "var(--font-text)", fontSize: 15, lineHeight: 1.5, color: "var(--color-label-2)" }}>{p}</span>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function Parampara() {
  return (
    <Section>
      <Eyebrow>Великая традиция</Eyebrow>
      <SectionTitle>Брахма-Мадхва-Гаудия-сампрадая</SectionTitle>
      <Lead>Непрерывная цепь духовных учителей и учеников, по которой вечное знание дошло до наших дней.</Lead>
      <div style={{ position: "relative", marginTop: 26, paddingLeft: 26 }}>
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
  );
}

function Explore({ onChange, onDonate }: { onChange: (t: string) => void; onDonate: () => void }) {
  const items: { t: string; sub: string; act: () => void }[] = [
    { t: "Книги", sub: "БГ · ШБ · ЧЧ и труды ачарьев", act: () => onChange("books") },
    { t: "Киртаны", sub: "Бхаджаны, молитвы, мантры", act: () => onChange("kirtans") },
    { t: "Ачарья", sub: "Господь, аватары и спутники", act: () => onChange("acharya") },
    { t: "Дхама", sub: "Святые места", act: () => onChange("dhama") },
    { t: "Поддержать служение", sub: "Стать частью миссии", act: onDonate },
  ];
  return (
    <Section>
      <Eyebrow>Войти глубже</Eyebrow>
      <SectionTitle>Продолжите путь</SectionTitle>
      <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((it) => (
          <button key={it.t} type="button" onClick={it.act}
            style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", padding: "16px 18px", borderRadius: 16,
              border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)", cursor: "pointer" }}
            onPointerDown={(e) => (e.currentTarget.style.opacity = "0.7")}
            onPointerUp={(e) => (e.currentTarget.style.opacity = "1")}
            onPointerLeave={(e) => (e.currentTarget.style.opacity = "1")}>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, letterSpacing: "-0.2px", color: "var(--color-label)" }}>{it.t}</span>
              <span style={{ display: "block", marginTop: 2, fontFamily: "var(--font-text)", fontSize: 13.5, color: "var(--color-label-2)" }}>{it.sub}</span>
            </span>
            <span style={{ color: "var(--color-label-3)", fontSize: 20, lineHeight: 1 }}>›</span>
          </button>
        ))}
      </div>
    </Section>
  );
}

function Footer() {
  return (
    <section style={{ margin: "56px -16px 0", padding: "40px 22px 8px", borderTop: "0.5px solid var(--color-hairline)", textAlign: "center" }}>
      <div style={{ fontFamily: "var(--font-scripture)", fontSize: 15, color: "var(--color-label-3)", lineHeight: 1.7 }}>
        Hare Kṛṣṇa Hare Kṛṣṇa Kṛṣṇa Kṛṣṇa Hare Hare<br />Hare Rāma Hare Rāma Rāma Rāma Hare Hare
      </div>
      <p style={{ margin: "20px auto 0", maxWidth: 480, fontFamily: "var(--font-text)", fontSize: 11.5, lineHeight: 1.6, color: "var(--color-label-3)" }}>
        ISKCON ONE LOVE — пространство вдохновения для тех, кто ценит наследие Ачарьи-основателя ИСККОН Шрилы Прабхупады. Ресурс не является официальным представительством какой-либо организации ISKCON; материалы публикуются в культурно-просветительском контексте.
      </p>
    </section>
  );
}

/* ─── экран ─── */

export default function HomeScreen({ onChange, onOpenBook, onOpenEntity, onDonate }: {
  onChange: (tab: string) => void;
  onOpenBook: (work: string) => void;
  onOpenEntity: (id: string, type: string | null) => void;
  onDonate: () => void;
}) {
  return (
    <div>
      <Hero />

      <Section style={{ marginTop: 40 }}>
        <Eyebrow color="var(--color-brand-blue)">С 1966 года</Eyebrow>
        <SectionTitle>Высшая цель</SectionTitle>
        <Lead>
          Великая духовная традиция, существующая более 5000 лет, была возрождена Шрилой Прабхупадой 13 июля 1966 года.
          Её миссия — помочь каждой душе восстановить вечную любовную связь с Богом, воплощённым в божественной паре: Кришне и Его высшей энергии любви, Шримати Радхарани.
        </Lead>
      </Section>

      <StatGrid />
      <MantraBand />
      <FormsGrid onChange={onChange} />
      <BooksRow onOpenBook={onOpenBook} />
      <Founder onOpenEntity={onOpenEntity} />
      <Principles />
      <Voices />
      <Purposes />
      <Parampara />
      <Explore onChange={onChange} onDonate={onDonate} />
      <Footer />
    </div>
  );
}
