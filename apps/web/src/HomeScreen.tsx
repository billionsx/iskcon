/**
 * HomeScreen — «Главная». Светлая редакторская презентация ИСККОН по реальной
 * эстетике iskcone.com (крупная типографика, чёрный текст на белом, история
 * ведёт) и стандарту apple.com (один смысл на экран, воздух, сдержанность).
 * Ч/б кинокадры Прабхупады — full-bleed; цветная живопись и храмы — в чистых
 * контейнерах с текстом рядом, без наложения на пестроту. Контент с iskcone.com,
 * образы — реальные (public/media/*.webp).
 */
import { useEffect } from "react";
import { api } from "./api";

const GOLD = "#D2AA1B";

/* ───── атомы ───── */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 9, fontFamily: "var(--font-text)", fontSize: 12.5, fontWeight: 700, letterSpacing: "1.6px", textTransform: "uppercase", color: GOLD }}>
      <span style={{ width: 22, height: 1.5, background: GOLD, display: "inline-block" }} />
      {children}
    </div>
  );
}

function Title({ children, on = "light" }: { children: React.ReactNode; on?: "light" | "dark" }) {
  return <h2 style={{ margin: "14px 0 0", fontFamily: "var(--font-display)", fontSize: "clamp(28px, 7vw, 40px)", fontWeight: 800, letterSpacing: "-0.9px", lineHeight: 1.07, color: on === "dark" ? "#fff" : "var(--color-label)" }}>{children}</h2>;
}

function Lead({ children, on = "light" }: { children: React.ReactNode; on?: "light" | "dark" }) {
  return <p style={{ margin: "18px 0 0", maxWidth: 620, fontFamily: "var(--font-text)", fontSize: 17.5, lineHeight: 1.62, color: on === "dark" ? "rgba(255,255,255,0.82)" : "var(--color-label-2)" }}>{children}</p>;
}

// Светлая секция с читаемой колонкой
function Section({ children, top = 88, center = false }: { children: React.ReactNode; top?: number; center?: boolean }) {
  return <section style={{ marginTop: top }}><div style={{ maxWidth: 740, margin: "0 auto", textAlign: center ? "center" : "left" }}>{children}</div></section>;
}

// Ч/б кинокадр на всю ширину: изображение + затемнение снизу + текст
function FilmFrame({ img, pos = "center", minH = 540, top = 0, children }: { img: string; pos?: string; minH?: number; top?: number; children: React.ReactNode }) {
  return (
    <section style={{ position: "relative", margin: `${top}px -16px 0`, minHeight: minH, maxHeight: 720, display: "flex", alignItems: "flex-end", overflow: "hidden", background: "#0c0b0e" }}>
      <img src={img} alt="" loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: pos }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(10,9,12,0.9) 0%, rgba(10,9,12,0.25) 52%, rgba(10,9,12,0.45) 100%)" }} />
      <div style={{ position: "relative", width: "100%", padding: "0 22px 46px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>{children}</div>
      </div>
    </section>
  );
}

function Btn({ label, onClick, dark = false }: { label: string; onClick: () => void; dark?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      onPointerDown={(e) => (e.currentTarget.style.opacity = "0.7")}
      onPointerUp={(e) => (e.currentTarget.style.opacity = "1")}
      onPointerLeave={(e) => (e.currentTarget.style.opacity = "1")}
      style={{ marginTop: 26, padding: "13px 26px", borderRadius: 999, border: dark ? "none" : "1px solid var(--color-label)", cursor: "pointer",
        background: dark ? "#fff" : "transparent", color: dark ? "#111" : "var(--color-label)",
        fontFamily: "var(--font-text)", fontSize: 15, fontWeight: 600 }}>
      {label}
    </button>
  );
}

/* ───── данные ───── */

const STATS = [
  { v: "10 млн+", l: "последователей" },
  { v: "2 000+", l: "храмов по миру" },
  { v: "8,7 млрд+", l: "порций прасада" },
  { v: "89", l: "языков изданий" },
  { v: "65+", l: "сельских общин" },
  { v: "100+", l: "духовных учителей" },
];
const TEMPLES = ["mayapur", "vrindavan", "tovp", "temple-chennai", "temple-ahmedabad", "temple-mumbai"];

const FORMS = [
  { t: "Мантра", lead: "Звуковая форма", body: "Повторение Харе Кришна — джапа или киртан — очищает ум и сердце.", go: "kirtans" },
  { t: "Книги", lead: "Литературная форма", body: "«Бхагавад-гита», «Бхагаватам», «Чайтанья-чаритамрита» — встреча с Богом.", go: "books" },
  { t: "Божества", lead: "Проявленная форма", body: "Формы Кришны и Радхарани неотличны от Их вечных духовных форм." },
  { t: "Прасад", lead: "Освящённая пища", body: "Вегетарианская пища, предложенная Господу, несёт духовную силу." },
  { t: "Садху", lead: "Святые", body: "Живой пример преданности, служения и любви.", go: "acharya" },
  { t: "Дхама", lead: "Святые места", body: "Вриндаван и Маяпур — места, неотличные от духовного мира.", go: "dhama" },
];

const PRINCIPLES = [
  { t: "Без мяса", body: "Отказ от мяса, рыбы и яиц — жизнь в согласии с ахимсой." },
  { t: "Без недозволенного секса", body: "Целомудрие до брака и верность в браке." },
  { t: "Без азартных игр", body: "Жизнь в честности, надёжности и осознанности." },
  { t: "Без интоксикаций", body: "Без алкоголя, наркотиков и табака — ради ясного ума." },
];

const VOICES = [
  { quote: "Я проходил 11 километров через весь город каждую неделю, чтобы воскресным вечером получить хорошее блюдо в храме Харе Кришна.", name: "Стив Джобс", role: "сооснователь Apple Inc." },
  { quote: "Не имея ничего материального, но обладая сознанием Кришны, он привлёк тысячи преданных и основал движение, которое крепнет с каждым днём.", name: "Джордж Харрисон", role: "музыкант, The Beatles" },
  { quote: "Повторение мантры Харе Кришна — это вид медитации, который может вызвать состояние экстаза.", name: "Джон Леннон", role: "музыкант, The Beatles" },
  { quote: "ИСККОН научил мир истинному значению веры.", name: "Нарендра Моди", role: "премьер-министр Индии" },
  { quote: "В самые трудные времена именно «Гита» давала мне силу бороться за то, во что я верю.", name: "Риши Сунак", role: "премьер-министр Великобритании" },
];

const PURPOSES = [
  "Систематически распространять духовное знание и обучать методам духовной жизни — ради единства и мира.",
  "Распространять сознание Кришны, как оно раскрыто в «Бхагавад-гите» и «Шримад-Бхагаватам».",
  "Сближать людей друг с другом и с Кришной, раскрывая природу души как частицы божественного.",
  "Развивать санкиртану — совместное пение святого имени, как учил Шри Чайтанья Махапрабху.",
  "Возводить святые места трансцендентных игр, посвящённые Кришне.",
  "Объединять людей ради более простого и естественного образа жизни.",
  "Издавать и распространять книги и духовные материалы.",
];

const PARAMPARA = [
  { name: "Кришна", note: "Верховная Личность Бога, источник знания" },
  { name: "Брахма", note: "первое существо, получившее знание от Кришны" },
  { name: "Нарада Муни", note: "странствующий мудрец, ученик Брахмы" },
  { name: "Вьясадева", note: "составитель ведических писаний" },
  { name: "Мадхвачарья", note: "1238–1317 · основатель двайта-веданты" },
  { name: "Мадхавендра Пури", note: "XV век · ключевая фигура бхакти" },
  { name: "Ишвара Пури", note: "1430–1520 · учитель Шри Чайтаньи" },
  { name: "Шри Чайтанья Махапрабху", note: "1486–1534 · Кришна и Радхарани воедино" },
  { name: "Шесть Госвами Вриндавана", note: "прямые ученики Махапрабху" },
  { name: "Кришнадаса Кавираджа", note: "1510–1590 · автор «Чайтанья-чаритамриты»" },
  { name: "Бхактивинода Тхакур", note: "1838–1914 · возрождение вайшнавизма" },
  { name: "Бхактисиддханта Сарасвати", note: "1874–1937 · распространение учения" },
  { name: "А. Ч. Бхактиведанта Свами Прабхупада", note: "1896–1977 · основатель ИСККОН" },
];

const FACTS = [
  { v: "1896–1977", l: "годы жизни" },
  { v: "108", l: "храмов основал" },
  { v: "70+", l: "книг написал" },
  { v: "14", l: "кругосветок" },
];

/* ───── секции ───── */

function Hero() {
  return (
    <FilmFrame img="/media/prabhupada-nyc.webp" pos="center 30%" minH={560} top={-16}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 9, fontFamily: "var(--font-text)", fontSize: 12, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: "rgba(255,255,255,0.75)" }}>
        <span style={{ width: 22, height: 1.5, background: GOLD }} /> ISKCON · ONE LOVE
      </div>
      <h1 style={{ margin: "16px 0 0", fontFamily: "var(--font-display)", fontSize: "clamp(40px, 12vw, 60px)", fontWeight: 800, letterSpacing: "-1.8px", lineHeight: 1.0, color: "#fff" }}>
        Служение.<br />Преданность.<br />Любовь.
      </h1>
      <p style={{ margin: "20px 0 0", maxWidth: 480, fontFamily: "var(--font-text)", fontSize: 17, lineHeight: 1.55, color: "rgba(255,255,255,0.86)" }}>
        Великое движение Харе Кришна началось с одного человека, принёсшего древнее знание любви к Богу всему миру.
      </p>
    </FilmFrame>
  );
}

function Mission() {
  return (
    <Section top={72}>
      <Eyebrow>С 1966 года</Eyebrow>
      <Title>Великое возрождение</Title>
      <Lead>
        Духовная традиция, существующая более 5000 лет, была возрождена Шрилой Прабхупадой 13 июля 1966 года.
        Её миссия — помочь каждой душе восстановить вечную любовную связь с Богом, воплощённым в божественной паре: Кришне и Его высшей энергии любви — Шримати Радхарани (Харе).
      </Lead>
      <blockquote style={{ margin: "30px 0 0", paddingLeft: 18, borderLeft: `2px solid ${GOLD}`, fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 19, lineHeight: 1.5, color: "var(--color-label)" }}>
        «У меня нет надежды, но я попробую…»
        <span style={{ display: "block", marginTop: 10, fontFamily: "var(--font-text)", fontStyle: "normal", fontSize: 13.5, color: "var(--color-label-3)" }}>Шрила Прабхупада, по пути в Америку</span>
      </blockquote>
    </Section>
  );
}

function Today() {
  return (
    <Section top={84}>
      <Eyebrow>ИСККОН сегодня</Eyebrow>
      <Title>Движение, объемлющее мир</Title>
      <div style={{ marginTop: 30, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "28px 14px" }}>
        {STATS.map((s) => (
          <div key={s.l}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 7vw, 32px)", fontWeight: 800, letterSpacing: "-0.5px", color: "var(--color-label)", lineHeight: 1 }}>{s.v}</div>
            <div style={{ marginTop: 6, fontFamily: "var(--font-text)", fontSize: 12.5, color: "var(--color-label-2)", lineHeight: 1.3 }}>{s.l}</div>
          </div>
        ))}
      </div>
      <div style={{ margin: "30px -16px 0", display: "flex", gap: 10, overflowX: "auto", padding: "0 16px 4px", scrollbarWidth: "none" }}>
        {TEMPLES.map((t) => (
          <div key={t} style={{ flex: "0 0 auto", width: 200, aspectRatio: "16 / 10", borderRadius: 14, overflow: "hidden", background: "var(--color-bg-2)" }}>
            <img src={`/media/${t}.webp`} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        ))}
      </div>
      <p style={{ margin: "16px 0 0", fontFamily: "var(--font-text)", fontSize: 13.5, color: "var(--color-label-3)" }}>2000+ храмов на всех континентах</p>
    </Section>
  );
}

function DivineCouple() {
  return (
    <Section top={88}>
      <div style={{ borderRadius: 22, overflow: "hidden", background: "var(--color-bg-2)" }}>
        <img src="/media/radharani.webp" alt="Шримати Радхарани" loading="lazy" style={{ width: "100%", display: "block", aspectRatio: "1 / 1", objectFit: "cover" }} />
      </div>
      <div style={{ marginTop: 24 }}>
        <Eyebrow>Высшая цель</Eyebrow>
        <Title>Кришна и Радхарани</Title>
        <Lead>
          Движение Харе Кришна исследует науку чистой преданной любви к Богу, воплощённой в божественной паре — Кришне и Его высшей энергии любви, Шримати Радхарани (Харе). Образ жизни вайшнава тесно связан с преданностью этим двум прекрасным личностям.
        </Lead>
      </div>
    </Section>
  );
}

function Mantra() {
  return (
    <section style={{ margin: "84px -16px 0", padding: "60px 22px", background: "var(--color-bg-2)", textAlign: "center" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ fontFamily: "var(--font-text)", fontSize: 12.5, fontWeight: 700, letterSpacing: "1.6px", textTransform: "uppercase", color: GOLD }}>Маха-мантра</div>
        <div style={{ marginTop: 20, fontFamily: "var(--font-scripture)", fontSize: 18, lineHeight: 1.7, color: "var(--color-label-3)" }}>
          हरे कृष्ण हरे कृष्ण · कृष्ण कृष्ण हरे हरे<br />हरे राम हरे राम · राम राम हरे हरे
        </div>
        <div style={{ marginTop: 22, fontFamily: "var(--font-display)", fontSize: "clamp(22px, 6vw, 30px)", fontWeight: 700, letterSpacing: "-0.4px", lineHeight: 1.45, color: "var(--color-label)" }}>
          Харе Кришна, Харе Кришна,<br />Кришна Кришна, Харе Харе<br />Харе Рама, Харе Рама,<br />Рама Рама, Харе Харе
        </div>
        <p style={{ margin: "26px auto 0", maxWidth: 480, fontFamily: "var(--font-text)", fontSize: 15.5, lineHeight: 1.6, color: "var(--color-label-2)" }}>
          Когда звучит трансцендентная вибрация святого имени, благо получают все живые существа. Повторение мантры — высшее милосердие ко всему миру.
        </p>
      </div>
    </section>
  );
}

function Forms({ onChange }: { onChange: (t: string) => void }) {
  return (
    <Section top={88}>
      <Eyebrow>Высший образ жизни</Eyebrow>
      <Title>Шесть форм бхакти-йоги</Title>
      <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 11 }}>
        {FORMS.map((f) => {
          const tap = !!f.go;
          return (
            <button key={f.t} type="button" disabled={!tap} onClick={() => f.go && onChange(f.go)}
              onPointerDown={(e) => tap && (e.currentTarget.style.opacity = "0.7")}
              onPointerUp={(e) => tap && (e.currentTarget.style.opacity = "1")}
              onPointerLeave={(e) => tap && (e.currentTarget.style.opacity = "1")}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "16px 0", borderTop: "0.5px solid var(--color-hairline)", background: "transparent", cursor: tap ? "pointer" : "default" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, letterSpacing: "-0.3px", color: "var(--color-label)" }}>{f.t}</span>
                <span style={{ fontFamily: "var(--font-text)", fontSize: 12.5, fontWeight: 600, color: "var(--color-label-3)" }}>{f.lead}</span>
                {tap && <span style={{ marginLeft: "auto", color: GOLD, fontSize: 19, lineHeight: 1 }}>›</span>}
              </div>
              <p style={{ margin: "5px 0 0", fontFamily: "var(--font-text)", fontSize: 14.5, lineHeight: 1.5, color: "var(--color-label-2)" }}>{f.body}</p>
            </button>
          );
        })}
      </div>
    </Section>
  );
}

function Books({ onOpenBook }: { onOpenBook: (work: string) => void }) {
  const books = [
    { work: "bg", t: "Бхагавад-гита как она есть", body: "Вечный диалог Кришны и Арджуны — как вернуться домой, к Богу." },
    { work: "sb", t: "Шримад-Бхагаватам", body: "Как Господь приходит в разные эпохи и формы к душам с разной преданностью." },
    { work: "cc", t: "Шри Чайтанья-чаритамрита", body: "Игры Шри Чайтаньи, дарующего чистую любовь к Богу." },
  ];
  return (
    <Section top={88}>
      <Eyebrow>Миллиард духовных книг</Eyebrow>
      <Title>Литература на 89 языках</Title>
      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 11 }}>
        {books.map((b) => (
          <button key={b.work} type="button" onClick={() => onOpenBook(b.work)}
            onPointerDown={(e) => (e.currentTarget.style.opacity = "0.7")}
            onPointerUp={(e) => (e.currentTarget.style.opacity = "1")}
            onPointerLeave={(e) => (e.currentTarget.style.opacity = "1")}
            style={{ display: "block", width: "100%", textAlign: "left", padding: "16px 0", borderTop: "0.5px solid var(--color-hairline)", background: "transparent", cursor: "pointer" }}>
            <span style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 17.5, fontWeight: 700, letterSpacing: "-0.2px", color: "var(--color-label)" }}>{b.t}</span>
            <span style={{ display: "block", marginTop: 4, fontFamily: "var(--font-text)", fontSize: 14, lineHeight: 1.45, color: "var(--color-label-2)" }}>{b.body}</span>
            <span style={{ display: "inline-block", marginTop: 8, fontFamily: "var(--font-text)", fontSize: 13.5, fontWeight: 600, color: "var(--color-brand-blue)" }}>Читать →</span>
          </button>
        ))}
      </div>
    </Section>
  );
}

function Founder({ onOpenEntity }: { onOpenEntity: (id: string, type: string | null) => void }) {
  return (
    <FilmFrame img="/media/prabhupada.webp" pos="center 25%" minH={620} top={88}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 9, fontFamily: "var(--font-text)", fontSize: 12.5, fontWeight: 700, letterSpacing: "1.6px", textTransform: "uppercase", color: GOLD }}>
        <span style={{ width: 22, height: 1.5, background: GOLD }} /> Ачарья-основатель ИСККОН
      </div>
      <h2 style={{ margin: "14px 0 0", fontFamily: "var(--font-display)", fontSize: "clamp(28px, 8vw, 40px)", fontWeight: 800, letterSpacing: "-0.9px", lineHeight: 1.05, color: "#fff" }}>Шрила Прабхупада</h2>
      <p style={{ margin: "8px 0 0", fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 16, color: "rgba(255,255,255,0.78)" }}>Его Божественная Милость А. Ч. Бхактиведанта Свами</p>
      <p style={{ margin: "16px 0 0", maxWidth: 540, fontFamily: "var(--font-text)", fontSize: 16, lineHeight: 1.6, color: "rgba(255,255,255,0.86)" }}>
        В 1965 году, в 69 лет, имея лишь несколько долларов и ящик книг, он один отправился из Вриндавана в Нью-Йорк. За двенадцать лет он зажёг во всём мире беспрецедентную волну Гауранга-лилы.
      </p>
      <div style={{ margin: "24px 0 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px 14px", maxWidth: 380 }}>
        {FACTS.map((f) => (
          <div key={f.l}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{f.v}</div>
            <div style={{ marginTop: 5, fontFamily: "var(--font-text)", fontSize: 12.5, color: "rgba(255,255,255,0.7)" }}>{f.l}</div>
          </div>
        ))}
      </div>
      <Btn label="Жизнь и наследие" dark onClick={() => onOpenEntity("prabhupada", "personality")} />
    </FilmFrame>
  );
}

function Principles() {
  return (
    <Section top={88}>
      <Eyebrow>Ничего лишнего</Eyebrow>
      <Title>Четыре принципа свободы</Title>
      <div style={{ marginTop: 26, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {PRINCIPLES.map((p) => (
          <div key={p.t} style={{ padding: "18px 16px", borderRadius: 16, background: "var(--color-bg-2)" }}>
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
    <Section top={88}>
      <Eyebrow>Голоса мира</Eyebrow>
      <Title>Влияние на весь мир</Title>
      <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 26 }}>
        {VOICES.map((v) => (
          <figure key={v.name} style={{ margin: 0 }}>
            <blockquote style={{ margin: 0, fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 19, lineHeight: 1.5, color: "var(--color-label)" }}>«{v.quote}»</blockquote>
            <figcaption style={{ marginTop: 10, fontFamily: "var(--font-text)" }}>
              <span style={{ fontSize: 14.5, fontWeight: 700, color: "var(--color-label)" }}>{v.name}</span>
              <span style={{ fontSize: 13, color: "var(--color-label-3)" }}> — {v.role}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      <div style={{ marginTop: 30, paddingTop: 24, borderTop: "0.5px solid var(--color-hairline)" }}>
        <blockquote style={{ margin: 0, fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 16.5, lineHeight: 1.6, color: "var(--color-label-2)" }}>
          За полвека ИСККОН достиг впечатляющих результатов в служении: помощь жертвам цунами 2004 года и урагана «Катрина», 1,2 миллиона школьников ежедневно получают питание в Индии, больница Бхактиведанты приняла более 200 000 пациентов за год.
        </blockquote>
        <figcaption style={{ marginTop: 12, fontFamily: "var(--font-text)", fontSize: 13, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: GOLD }}>Forbes</figcaption>
      </div>
    </Section>
  );
}

function Purposes() {
  return (
    <Section top={88}>
      <Eyebrow>Миссия</Eyebrow>
      <Title>Семь целей ИСККОН</Title>
      <ol style={{ margin: "26px 0 0", padding: 0, listStyle: "none" }}>
        {PURPOSES.map((p, i) => (
          <li key={i} style={{ display: "flex", gap: 16, padding: "16px 0", borderTop: "0.5px solid var(--color-hairline)" }}>
            <span style={{ flexShrink: 0, fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 800, color: GOLD, width: 22, lineHeight: 1.6 }}>{String(i + 1).padStart(2, "0")}</span>
            <span style={{ fontFamily: "var(--font-text)", fontSize: 15.5, lineHeight: 1.5, color: "var(--color-label-2)" }}>{p}</span>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function Parampara() {
  return (
    <Section top={88}>
      <Eyebrow>Великая традиция</Eyebrow>
      <Title>Линия учителей</Title>
      <Lead>Непрерывная цепь учителей и учеников, по которой вечное знание дошло до наших дней.</Lead>
      <div style={{ position: "relative", marginTop: 28, paddingLeft: 26 }}>
        <span aria-hidden style={{ position: "absolute", left: 5, top: 6, bottom: 6, width: 2, background: `linear-gradient(to bottom, ${GOLD}, color-mix(in srgb, ${GOLD} 20%, transparent))` }} />
        {PARAMPARA.map((p, i) => (
          <div key={i} style={{ position: "relative", paddingBottom: i === PARAMPARA.length - 1 ? 0 : 22 }}>
            <span aria-hidden style={{ position: "absolute", left: -26, top: 4, width: 12, height: 12, borderRadius: "50%", background: i === 0 || i === PARAMPARA.length - 1 ? GOLD : "var(--color-bg)", border: `2px solid ${GOLD}`, boxShadow: "0 0 0 4px var(--color-bg)" }} />
            <div style={{ fontFamily: "var(--font-display)", fontSize: 16.5, fontWeight: 700, letterSpacing: "-0.2px", color: "var(--color-label)", lineHeight: 1.25 }}>{p.name}</div>
            <div style={{ marginTop: 2, fontFamily: "var(--font-text)", fontSize: 13, color: "var(--color-label-3)", lineHeight: 1.35 }}>{p.note}</div>
          </div>
        ))}
      </div>
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
    <Section top={88}>
      <Eyebrow>Войти глубже</Eyebrow>
      <Title>Продолжите путь</Title>
      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((it) => (
          <button key={it.t} type="button" onClick={it.act}
            onPointerDown={(e) => (e.currentTarget.style.opacity = "0.7")}
            onPointerUp={(e) => (e.currentTarget.style.opacity = "1")}
            onPointerLeave={(e) => (e.currentTarget.style.opacity = "1")}
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
    <section style={{ margin: "72px -16px 0", padding: "44px 22px 8px", borderTop: "0.5px solid var(--color-hairline)", textAlign: "center" }}>
      <div style={{ fontFamily: "var(--font-scripture)", fontSize: 14.5, color: "var(--color-label-3)", lineHeight: 1.7 }}>
        Hare Kṛṣṇa Hare Kṛṣṇa Kṛṣṇa Kṛṣṇa Hare Hare<br />Hare Rāma Hare Rāma Rāma Rāma Hare Hare
      </div>
      <p style={{ margin: "20px auto 0", maxWidth: 520, fontFamily: "var(--font-text)", fontSize: 11.5, lineHeight: 1.6, color: "var(--color-label-3)" }}>
        ISKCON ONE LOVE — пространство вдохновения для тех, кто ценит наследие Ачарьи-основателя ИСККОН Шрилы Прабхупады. Ресурс не является официальным представительством какой-либо организации ISKCON; материалы публикуются в культурно-просветительском контексте.
      </p>
    </section>
  );
}

/* ───── экран ───── */

export default function HomeScreen({ onChange, onOpenBook, onOpenEntity, onDonate }: {
  onChange: (tab: string) => void;
  onOpenBook: (work: string) => void;
  onOpenEntity: (id: string, type: string | null) => void;
  onDonate: () => void;
}) {
  useEffect(() => { fetch(api("/entities/prabhupada")).catch(() => {}); }, []);
  return (
    <div>
      <Hero />
      <Mission />
      <Today />
      <DivineCouple />
      <Mantra />
      <Forms onChange={onChange} />
      <Books onOpenBook={onOpenBook} />
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
