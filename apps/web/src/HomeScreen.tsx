/**
 * HomeScreen — «Главная»: кинематографичная презентация ИСККОН.
 * Образ ведёт, текст поддерживает — по стандарту презентаций apple.com.
 * Полноэкранные иммерсивные кадры (Кришна, мантра, Шрила Прабхупада, дхама)
 * чередуются со светлыми смысловыми секциями. Контент — с iskcone.com,
 * изображения — реальные образы iskcone (apps/web/public/media/*.webp).
 */
import { useEffect, useState } from "react";
import { api } from "./api";

const GOLD = "#D2AA1B";

/* ───────────────────────── атомы ───────────────────────── */

function Kicker({ children, on = "light" }: { children: React.ReactNode; on?: "light" | "dark" }) {
  return <div style={{ fontFamily: "var(--font-text)", fontSize: 12, fontWeight: 700, letterSpacing: "1.4px", textTransform: "uppercase", color: on === "dark" ? GOLD : GOLD }}>{children}</div>;
}

function Title({ children, on = "light", size = 30 }: { children: React.ReactNode; on?: "light" | "dark"; size?: number }) {
  return <h2 style={{ margin: "10px 0 0", fontFamily: "var(--font-display)", fontSize: size, fontWeight: 800, letterSpacing: "-0.7px", lineHeight: 1.08, color: on === "dark" ? "#fff" : "var(--color-label)" }}>{children}</h2>;
}

function Lead({ children, on = "light" }: { children: React.ReactNode; on?: "light" | "dark" }) {
  return <p style={{ margin: "16px auto 0", maxWidth: 600, fontFamily: "var(--font-text)", fontSize: 17, lineHeight: 1.6, color: on === "dark" ? "rgba(255,255,255,0.82)" : "var(--color-label-2)" }}>{children}</p>;
}

// Светлая смысловая секция — текст в читаемой колонке по центру
function Section({ children, center = false, top = 64 }: { children: React.ReactNode; center?: boolean; top?: number }) {
  return <section style={{ marginTop: top }}><div style={{ maxWidth: 720, margin: "0 auto", textAlign: center ? "center" : "left" }}>{children}</div></section>;
}

// Full-bleed цветной бэнд (без изображения)
function Band({ children, bg, top = 64 }: { children: React.ReactNode; bg: string; top?: number }) {
  return <section style={{ margin: `${top}px -16px 0`, padding: "52px 22px", background: bg }}><div style={{ maxWidth: 720, margin: "0 auto" }}>{children}</div></section>;
}

// Кинематографичный кадр: полноэкранное изображение + затемнение + контент
function Cinematic({ img, pos = "center", minH = 460, align = "end", scrim = "strong", top = 0, children }: {
  img: string; pos?: string; minH?: number; align?: "center" | "end"; scrim?: "strong" | "soft" | "veil"; top?: number; children: React.ReactNode;
}) {
  const grad = scrim === "veil"
    ? "linear-gradient(to bottom, rgba(8,7,11,0.55), rgba(8,7,11,0.78))"
    : scrim === "soft"
    ? "linear-gradient(to top, rgba(8,7,11,0.85) 0%, rgba(8,7,11,0.15) 55%, rgba(8,7,11,0.2) 100%)"
    : "linear-gradient(to top, rgba(8,7,11,0.92) 0%, rgba(8,7,11,0.35) 48%, rgba(8,7,11,0.55) 100%)";
  return (
    <section style={{ position: "relative", margin: `${top}px -16px 0`, minHeight: minH, display: "flex", alignItems: align === "center" ? "center" : "flex-end", overflow: "hidden" }}>
      <img src={img} alt="" loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: pos }} />
      <div style={{ position: "absolute", inset: 0, background: grad }} />
      <div style={{ position: "relative", width: "100%", padding: align === "center" ? "56px 22px" : "0 22px 44px", textAlign: align === "center" ? "center" : "left" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>{children}</div>
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
      style={{ marginTop: 26, padding: "13px 28px", borderRadius: 999, border: "none", cursor: "pointer",
        background: dark ? "#fff" : "var(--color-label)", color: dark ? "#111" : "var(--color-bg)",
        fontFamily: "var(--font-text)", fontSize: 15, fontWeight: 600 }}>
      {label}
    </button>
  );
}

/* ───────────────────────── данные ───────────────────────── */

const STATS: { v: string; l: string }[] = [
  { v: "10 млн+", l: "последователей" },
  { v: "2 000+", l: "храмов по миру" },
  { v: "8,7 млрд+", l: "порций прасада роздано" },
  { v: "89", l: "языков изданий" },
  { v: "65+", l: "сельских общин" },
  { v: "300+", l: "ресторанов" },
  { v: "55+", l: "учебных заведений" },
  { v: "100+", l: "духовных учителей" },
];

const FORMS: { t: string; lead: string; body: string; go?: string }[] = [
  { t: "Мантра", lead: "Звуковая форма", body: "Повторение Харе Кришна — тихо (джапа) или вслух (киртан) — очищает ум и сердце.", go: "kirtans" },
  { t: "Книги", lead: "Литературная форма", body: "«Бхагавад-гита», «Бхагаватам», «Чайтанья-чаритамрита» — встреча с Богом на страницах.", go: "books" },
  { t: "Божества", lead: "Проявленная форма", body: "Формы Кришны и Радхарани в этом мире неотличны от Их вечных духовных форм." },
  { t: "Прасад", lead: "Освящённая пища", body: "Вегетарианская пища, предложенная Господу, несёт духовную силу и любовь." },
  { t: "Садху", lead: "Святые", body: "Хранящие Кришну и Радхарани в сердце — живой пример преданности и любви.", go: "acharya" },
  { t: "Дхама", lead: "Святые места", body: "Места, неотличные от духовного мира, — Вриндаван и Маяпур.", go: "dhama" },
];

const PRINCIPLES: { t: string; body: string }[] = [
  { t: "Без мяса", body: "Отказ от мяса, рыбы и яиц — жизнь в согласии с ахимсой, ненасилием." },
  { t: "Без недозволенного секса", body: "Целомудрие до брака и верность в браке." },
  { t: "Без азартных игр", body: "Жизнь в честности, надёжности и осознанности." },
  { t: "Без интоксикаций", body: "Без алкоголя, наркотиков и табака — ради ясного ума." },
];

const VOICES: { quote: string; name: string; role: string }[] = [
  { quote: "Я проходил 11 километров через весь город каждую неделю, чтобы воскресным вечером получить хорошее блюдо в храме Харе Кришна.", name: "Стив Джобс", role: "сооснователь Apple Inc." },
  { quote: "Не имея ничего материального, но обладая сознанием Кришны, он привлёк тысячи преданных и основал движение, которое крепнет с каждым днём.", name: "Джордж Харрисон", role: "музыкант, The Beatles" },
  { quote: "Повторение мантры Харе Кришна — это вид медитации, который может действительно вызвать состояние экстаза.", name: "Джон Леннон", role: "музыкант, The Beatles" },
  { quote: "ИСККОН научил мир истинному значению веры.", name: "Нарендра Моди", role: "премьер-министр Индии" },
  { quote: "В самые трудные времена именно «Гита» давала мне силу бороться за то, во что я верю.", name: "Риши Сунак", role: "премьер-министр Великобритании" },
];

const PURPOSES: string[] = [
  "Систематически распространять духовное знание и обучать методам духовной жизни — ради подлинного единства и мира.",
  "Распространять сознание Кришны, как оно раскрыто в «Бхагавад-гите» и «Шримад-Бхагаватам».",
  "Сближать людей друг с другом и с Кришной, раскрывая, что каждая душа — частица божественной природы.",
  "Развивать санкиртану — совместное пение святого имени, как учил Шри Чайтанья Махапрабху.",
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
  { name: "А. Ч. Бхактиведанта Свами Прабхупада", note: "1896–1977 · основатель ИСККОН" },
];

const FOUNDER_FACTS: { v: string; l: string }[] = [
  { v: "1896–1977", l: "годы жизни" },
  { v: "108", l: "храмов основал" },
  { v: "70+", l: "книг написал" },
  { v: "14", l: "кругосветок" },
];

/* ───────────────────────── секции ───────────────────────── */

function Hero() {
  return (
    <Cinematic img="/media/krishna-hero.webp" pos="center 30%" minH={560} scrim="strong" top={-16}>
      <div style={{ fontFamily: "var(--font-text)", fontSize: 12, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: "rgba(255,255,255,0.78)" }}>ISKCON · ONE LOVE</div>
      <h1 style={{ margin: "14px 0 0", fontFamily: "var(--font-display)", fontSize: 46, fontWeight: 800, letterSpacing: "-1.5px", lineHeight: 1.02, color: "#fff" }}>
        Служение.<br />Преданность.<br /><span style={{ color: GOLD }}>Любовь.</span>
      </h1>
      <p style={{ margin: "18px 0 0", maxWidth: 460, fontFamily: "var(--font-text)", fontSize: 17, lineHeight: 1.55, color: "rgba(255,255,255,0.85)" }}>
        Международное общество сознания Кришны — мировое движение Харе Кришна, объединяющее миллионы сердец более чем в 80 странах.
      </p>
    </Cinematic>
  );
}

function SupremeGoal() {
  return (
    <Cinematic img="/media/radharani.webp" pos="center 25%" minH={520} align="end" scrim="strong">
      <Kicker>Высшая цель</Kicker>
      <Title on="dark" size={32}>Чистая любовь к Богу</Title>
      <p style={{ margin: "16px 0 0", maxWidth: 540, fontFamily: "var(--font-text)", fontSize: 16.5, lineHeight: 1.6, color: "rgba(255,255,255,0.85)" }}>
        Великая традиция, существующая более 5000 лет, была возрождена Шрилой Прабхупадой 13 июля 1966 года. Её миссия — помочь каждой душе восстановить вечную любовную связь с Богом, воплощённым в божественной паре: Кришне и Его высшей энергии любви — Шримати Радхарани (Харе).
      </p>
    </Cinematic>
  );
}

function StatGrid() {
  return (
    <Band bg="var(--color-bg-2)">
      <Kicker>ИСККОН сегодня</Kicker>
      <Title>Невероятная статистика</Title>
      <div style={{ marginTop: 30, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px 18px" }}>
        {STATS.map((s) => (
          <div key={s.l}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 800, letterSpacing: "-0.5px", color: GOLD, lineHeight: 1 }}>{s.v}</div>
            <div style={{ marginTop: 7, fontFamily: "var(--font-text)", fontSize: 13.5, color: "var(--color-label-2)", lineHeight: 1.3 }}>{s.l}</div>
          </div>
        ))}
      </div>
    </Band>
  );
}

function MantraBand() {
  return (
    <Cinematic img="/media/krishna-portrait.webp" pos="center 20%" minH={560} align="center" scrim="veil">
      <Kicker on="dark">Маха-мантра</Kicker>
      <div style={{ marginTop: 20, fontFamily: "var(--font-scripture)", fontSize: 20, lineHeight: 1.7, color: "rgba(255,255,255,0.6)" }}>
        हरे कृष्ण हरे कृष्ण<br />कृष्ण कृष्ण हरे हरे<br />हरे राम हरे राम<br />राम राम हरे हरे
      </div>
      <div style={{ marginTop: 22, fontFamily: "var(--font-display)", fontSize: 23, fontWeight: 700, letterSpacing: "-0.2px", lineHeight: 1.55, color: "#fff" }}>
        Харе Кришна, Харе Кришна,<br />Кришна Кришна, Харе Харе<br />Харе Рама, Харе Рама,<br />Рама Рама, Харе Харе
      </div>
      <p style={{ margin: "24px auto 0", maxWidth: 440, fontFamily: "var(--font-text)", fontSize: 15, lineHeight: 1.6, color: "rgba(255,255,255,0.72)" }}>
        Когда звучит трансцендентная вибрация святого имени, благо получают все живые существа. Повторение мантры — высшее милосердие ко всему миру.
      </p>
    </Cinematic>
  );
}

function FormsGrid({ onChange }: { onChange: (t: string) => void }) {
  return (
    <Section>
      <div style={{ textAlign: "center" }}>
        <Kicker>Высший образ жизни</Kicker>
        <Title>Шесть форм бхакти-йоги</Title>
      </div>
      <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 12 }}>
        {FORMS.map((f) => {
          const tap = !!f.go;
          return (
            <button key={f.t} type="button" disabled={!tap} onClick={() => f.go && onChange(f.go)}
              onPointerDown={(e) => tap && (e.currentTarget.style.opacity = "0.7")}
              onPointerUp={(e) => tap && (e.currentTarget.style.opacity = "1")}
              onPointerLeave={(e) => tap && (e.currentTarget.style.opacity = "1")}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "17px 18px", borderRadius: 18,
                border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)", cursor: tap ? "pointer" : "default" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700, letterSpacing: "-0.3px", color: "var(--color-label)" }}>{f.t}</span>
                <span style={{ fontFamily: "var(--font-text)", fontSize: 12.5, fontWeight: 600, color: GOLD }}>{f.lead}</span>
                {tap && <span style={{ marginLeft: "auto", color: "var(--color-label-3)", fontSize: 20, lineHeight: 1 }}>›</span>}
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
  const books = [
    { work: "bg", t: "Бхагавад-гита как она есть", body: "Вечный диалог Кришны и Арджуны — как вернуться домой, к Богу." },
    { work: "sb", t: "Шримад-Бхагаватам", body: "Как Господь приходит в разные эпохи и формы к душам с разной преданностью." },
    { work: "cc", t: "Шри Чайтанья-чаритамрита", body: "Игры самой милостивой формы Бога — Шри Чайтаньи, дарующего любовь к Богу." },
  ];
  return (
    <Section>
      <Kicker>Миллиард духовных книг</Kicker>
      <Title>Священная литература на 89 языках</Title>
      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        {books.map((b) => (
          <button key={b.work} type="button" onClick={() => onOpenBook(b.work)}
            onPointerDown={(e) => (e.currentTarget.style.opacity = "0.7")}
            onPointerUp={(e) => (e.currentTarget.style.opacity = "1")}
            onPointerLeave={(e) => (e.currentTarget.style.opacity = "1")}
            style={{ display: "block", width: "100%", textAlign: "left", padding: "16px 18px", borderRadius: 18,
              border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)", cursor: "pointer" }}>
            <span style={{ display: "block", fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, letterSpacing: "-0.2px", color: "var(--color-label)" }}>{b.t}</span>
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
    <Cinematic img="/media/prabhupada.webp" pos="center 22%" minH={600} align="end" scrim="strong">
      <Kicker>Ачарья-основатель ИСККОН</Kicker>
      <Title on="dark" size={30}>Шрила Прабхупада</Title>
      <p style={{ margin: "6px 0 0", fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 16, color: "rgba(255,255,255,0.78)" }}>
        Его Божественная Милость А. Ч. Бхактиведанта Свами
      </p>
      <p style={{ margin: "16px 0 0", maxWidth: 540, fontFamily: "var(--font-text)", fontSize: 16, lineHeight: 1.6, color: "rgba(255,255,255,0.85)" }}>
        В 1965 году, в 69 лет, имея лишь несколько долларов и ящик книг, он один отправился из Вриндавана в Нью-Йорк. За двенадцать лет он зажёг во всём мире беспрецедентную волну Гауранга-лилы, исполнив пророчество Шри Чайтаньи.
      </p>
      <div style={{ margin: "24px 0 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px 14px", maxWidth: 380 }}>
        {FOUNDER_FACTS.map((f) => (
          <div key={f.l}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 23, fontWeight: 800, color: GOLD, lineHeight: 1 }}>{f.v}</div>
            <div style={{ marginTop: 5, fontFamily: "var(--font-text)", fontSize: 12.5, color: "rgba(255,255,255,0.7)", lineHeight: 1.3 }}>{f.l}</div>
          </div>
        ))}
      </div>
      <Btn label="Жизнь и наследие" dark onClick={() => onOpenEntity("prabhupada", "personality")} />
    </Cinematic>
  );
}

function Principles() {
  return (
    <Section center>
      <Kicker>Ничего лишнего</Kicker>
      <Title>Четыре принципа свободы</Title>
      <div style={{ marginTop: 26, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, textAlign: "left" }}>
        {PRINCIPLES.map((p) => (
          <div key={p.t} style={{ padding: "16px", borderRadius: 16, border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)" }}>
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
      <div style={{ textAlign: "center" }}>
        <Kicker>Голоса мира</Kicker>
        <Title>Влияние на весь мир</Title>
      </div>
      <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 14 }}>
        {VOICES.map((v) => (
          <figure key={v.name} style={{ margin: 0, padding: "20px", borderRadius: 18, border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)" }}>
            <blockquote style={{ margin: 0, fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 17, lineHeight: 1.55, color: "var(--color-label)" }}>«{v.quote}»</blockquote>
            <figcaption style={{ marginTop: 12 }}>
              <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: 14.5, fontWeight: 700, color: "var(--color-label)" }}>{v.name}</span>
              <span style={{ display: "block", fontFamily: "var(--font-text)", fontSize: 13, color: "var(--color-label-3)" }}>{v.role}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      <div style={{ marginTop: 14, padding: "30px 24px", borderRadius: 20, background: "#15141a" }}>
        <blockquote style={{ margin: 0, fontFamily: "var(--font-scripture)", fontStyle: "italic", fontSize: 16, lineHeight: 1.6, color: "rgba(255,255,255,0.85)" }}>
          За полвека ИСККОН достиг впечатляющих результатов в служении: помощь жертвам цунами 2004 года и урагана «Катрина», 1,2 миллиона школьников ежедневно получают питание в Индии, больница Бхактиведанты приняла более 200 000 пациентов за год.
        </blockquote>
        <figcaption style={{ marginTop: 14, fontFamily: "var(--font-text)", fontSize: 13, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: GOLD }}>Forbes</figcaption>
      </div>
    </Section>
  );
}

function Purposes() {
  return (
    <Section>
      <Kicker>Миссия</Kicker>
      <Title>Семь целей ИСККОН</Title>
      <Lead>Семь целей, лично сформулированных Шрилой Прабхупадой при основании общества.</Lead>
      <ol style={{ margin: "22px 0 0", padding: 0, listStyle: "none" }}>
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
      <Kicker>Великая традиция</Kicker>
      <Title>Брахма-Мадхва-Гаудия-сампрадая</Title>
      <Lead>Непрерывная цепь учителей и учеников, по которой вечное знание дошло до наших дней.</Lead>
      <div style={{ position: "relative", marginTop: 26, paddingLeft: 26 }}>
        <span aria-hidden style={{ position: "absolute", left: 5, top: 6, bottom: 6, width: 2, background: `linear-gradient(to bottom, ${GOLD}, color-mix(in srgb, ${GOLD} 22%, transparent))` }} />
        {PARAMPARA.map((p, i) => (
          <div key={i} style={{ position: "relative", paddingBottom: i === PARAMPARA.length - 1 ? 0 : 22 }}>
            <span aria-hidden style={{ position: "absolute", left: -26, top: 4, width: 12, height: 12, borderRadius: "50%", background: i === 0 || i === PARAMPARA.length - 1 ? GOLD : "var(--color-bg)", border: `2px solid ${GOLD}`, boxShadow: "0 0 0 4px var(--color-bg)" }} />
            <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, letterSpacing: "-0.2px", color: "var(--color-label)", lineHeight: 1.25 }}>{p.name}</div>
            <div style={{ marginTop: 2, fontFamily: "var(--font-text)", fontSize: 13, color: "var(--color-label-3)", lineHeight: 1.35 }}>{p.note}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Dhama({ onChange }: { onChange: (t: string) => void }) {
  const thumbs = [
    { img: "/media/mayapur.webp", t: "Маяпур" },
    { img: "/media/vrindavan.webp", t: "Вриндаван" },
    { img: "/media/tovp.webp", t: "ТОВП" },
  ];
  return (
    <>
      <Cinematic img="/media/tovp.webp" pos="center" minH={460} align="end" scrim="strong">
        <Kicker>Святые места</Kicker>
        <Title on="dark" size={30}>Дхама</Title>
        <p style={{ margin: "16px 0 0", maxWidth: 520, fontFamily: "var(--font-text)", fontSize: 16, lineHeight: 1.6, color: "rgba(255,255,255,0.85)" }}>
          Места, неотличные от духовного мира, где обитают Кришна и Радхарани. Вриндаван, Маяпур, Храм Ведического Планетария — посещение дхамы углубляет сознание Бога.
        </p>
        <Btn label="Открыть Дхаму" dark onClick={() => onChange("dhama")} />
      </Cinematic>
      <section style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
        {thumbs.map((t) => (
          <div key={t.t} style={{ position: "relative", borderRadius: 14, overflow: "hidden", aspectRatio: "1 / 1" }}>
            <img src={t.img} alt={t.t} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent 60%)" }} />
            <span style={{ position: "absolute", left: 10, bottom: 8, fontFamily: "var(--font-text)", fontSize: 12.5, fontWeight: 700, color: "#fff" }}>{t.t}</span>
          </div>
        ))}
      </section>
    </>
  );
}

function Explore({ onChange, onDonate }: { onChange: (t: string) => void; onDonate: () => void }) {
  const items: { t: string; sub: string; act: () => void }[] = [
    { t: "Книги", sub: "БГ · ШБ · ЧЧ и труды ачарьев", act: () => onChange("books") },
    { t: "Киртаны", sub: "Бхаджаны, молитвы, мантры", act: () => onChange("kirtans") },
    { t: "Ачарья", sub: "Господь, аватары и спутники", act: () => onChange("acharya") },
    { t: "Поддержать служение", sub: "Стать частью миссии", act: onDonate },
  ];
  return (
    <Section>
      <Kicker>Войти глубже</Kicker>
      <Title>Продолжите путь</Title>
      <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((it) => (
          <button key={it.t} type="button" onClick={it.act}
            onPointerDown={(e) => (e.currentTarget.style.opacity = "0.7")}
            onPointerUp={(e) => (e.currentTarget.style.opacity = "1")}
            onPointerLeave={(e) => (e.currentTarget.style.opacity = "1")}
            style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", padding: "16px 18px", borderRadius: 16,
              border: "0.5px solid var(--color-hairline)", background: "var(--color-bg-2)", cursor: "pointer" }}>
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
    <section style={{ margin: "60px -16px 0", padding: "40px 22px 8px", borderTop: "0.5px solid var(--color-hairline)", textAlign: "center" }}>
      <div style={{ fontFamily: "var(--font-scripture)", fontSize: 14.5, color: "var(--color-label-3)", lineHeight: 1.7 }}>
        Hare Kṛṣṇa Hare Kṛṣṇa Kṛṣṇa Kṛṣṇa Hare Hare<br />Hare Rāma Hare Rāma Rāma Rāma Hare Hare
      </div>
      <p style={{ margin: "20px auto 0", maxWidth: 520, fontFamily: "var(--font-text)", fontSize: 11.5, lineHeight: 1.6, color: "var(--color-label-3)" }}>
        ISKCON ONE LOVE — пространство вдохновения для тех, кто ценит наследие Ачарьи-основателя ИСККОН Шрилы Прабхупады. Ресурс не является официальным представительством какой-либо организации ISKCON; материалы публикуются в культурно-просветительском контексте.
      </p>
    </section>
  );
}

/* ───────────────────────── экран ───────────────────────── */

export default function HomeScreen({ onChange, onOpenBook, onOpenEntity, onDonate }: {
  onChange: (tab: string) => void;
  onOpenBook: (work: string) => void;
  onOpenEntity: (id: string, type: string | null) => void;
  onDonate: () => void;
}) {
  // лёгкий префетч фото основателя (не критично для рендера)
  useEffect(() => { fetch(api("/entities/prabhupada")).catch(() => {}); }, []);
  return (
    <div>
      <Hero />
      <SupremeGoal />
      <StatGrid />
      <MantraBand />
      <FormsGrid onChange={onChange} />
      <BooksRow onOpenBook={onOpenBook} />
      <Founder onOpenEntity={onOpenEntity} />
      <Principles />
      <Voices />
      <Purposes />
      <Parampara />
      <Dhama onChange={onChange} />
      <Explore onChange={onChange} onDonate={onDonate} />
      <Footer />
    </div>
  );
}
