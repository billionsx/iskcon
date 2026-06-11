/**
 * HomeMore — два раздела Главной:
 *   · Медиа ИСККОН — трансляции, фильмы, каналы и радио движения.
 *   · Образование ИСККОН — колледжи, институты и систематическое изучение
 *     книг Шрилы Прабхупады (Бхакти-шастри, Бхакти-вайбхава, курс ученика).
 * Кураторские каталоги официальных и авторитетных ресурсов.
 */

const GOLD = "#D2AA1B";
const fill: React.CSSProperties = { background: "var(--color-glass-thin)", borderRadius: 20 };

interface MoreItem { t: string; d: string; url: string; badge?: string }
interface MoreGroup { group: string; items: MoreItem[] }

function GroupedList({ groups }: { groups: MoreGroup[] }) {
  return (
    <>
      {groups.map((g) => (
        <section key={g.group} style={{ marginTop: 26 }}>
          <div style={{ margin: "0 2px 10px", fontFamily: "var(--font-text)", fontSize: 11, fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: "var(--color-label-3)" }}>{g.group}</div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", overflow: "hidden", ...fill }}>
            {g.items.map((it, i) => (
              <li key={it.t} style={{ borderTop: i ? "0.5px solid var(--color-hairline)" : "none" }}>
                <a href={it.url} target="_blank" rel="noopener noreferrer"
                  onPointerDown={(e) => (e.currentTarget.style.background = "var(--color-hover)")}
                  onPointerUp={(e) => (e.currentTarget.style.background = "transparent")}
                  onPointerLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", textDecoration: "none", WebkitTapHighlightColor: "transparent" }}>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: "var(--font-text)", fontSize: 15.5, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--color-label)" }}>{it.t}</span>
                      {it.badge && (
                        <span style={{ flexShrink: 0, padding: "2px 7px", borderRadius: 999, background: `color-mix(in srgb, ${GOLD} 16%, transparent)`, fontFamily: "var(--font-text)", fontSize: 10, fontWeight: 700, letterSpacing: "0.4px", textTransform: "uppercase", color: GOLD }}>{it.badge}</span>
                      )}
                    </span>
                    <span style={{ display: "block", marginTop: 2, fontFamily: "var(--font-text)", fontSize: 12.5, lineHeight: 1.45, color: "var(--color-label-2)" }}>{it.d}</span>
                  </span>
                  <span aria-hidden style={{ flexShrink: 0, color: "var(--color-label-3)" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24"><path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

function Head({ eyebrow, title, sub }: { eyebrow: string; title: string; sub: string }) {
  return (
    <div style={{ padding: "20px 0 0" }}>
      <div style={{ fontFamily: "var(--font-text)", fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: GOLD }}>{eyebrow}</div>
      <h2 style={{ margin: "5px 0 0", fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800, letterSpacing: "-0.022em", lineHeight: 1.1, color: "var(--color-label)" }}>{title}</h2>
      <p style={{ margin: "8px 0 0", fontFamily: "var(--font-text)", fontSize: 14, lineHeight: 1.5, color: "var(--color-label-2)" }}>{sub}</p>
    </div>
  );
}

/* ═══════════════ МЕДИА ═══════════════ */

const MEDIA: MoreGroup[] = [
  { group: "Прямые трансляции", items: [
    { t: "Маяпур ТВ (Mayapur TV)", d: "Круглосуточные трансляции из храма Шри Маяпур-чандродая-мандира: мангала-арати, киртаны, лекции, фестивали", url: "https://www.mayapur.tv/", badge: "Live" },
    { t: "ИСККОН Вриндаван — прямой эфир", d: "Прямой эфир из храма Кришна-Баларама-мандир во Вриндаване", url: "https://iskconvrindavan.com/live/", badge: "Live" },
  ]},
  { group: "Фильмы о движении", items: [
    { t: "«Харе Кришна! Мантра, движение и свами, с которого всё началось»", d: "Документальный фильм (2017) о Шриле Прабхупаде и рождении Движения — премии кинофестивалей, прокат по всему миру", url: "https://www.harekrishnathefilm.com/" },
    { t: "«Ваш вечный доброжелатель» (Your Ever Well-Wisher)", d: "Классический фильм ITV о жизни Шрилы Прабхупады по «Прабхупада-лиламрите»", url: "https://prabhupada.io/films" },
    { t: "«Ачарья» (Acharya)", d: "Полнометражный анимационно-документальный фильм к 125-летию Шрилы Прабхупады", url: "https://acharyafilm.com/" },
  ]},
  { group: "Видеоканалы", items: [
    { t: "Новости ИСККОН (ISKCON News)", d: "Официальный новостной видеоканал общества: репортажи, интервью, события по всему миру", url: "https://www.youtube.com/@ISKCONNews" },
    { t: "Прабхупада — оцифрованный архив", d: "Bhaktivedanta Archives: оригинальные киноплёнки, лекции и киртаны Шрилы Прабхупады", url: "https://prabhupada.io/" },
    { t: "ИСККОН Дизайр Три (ISKCON Desire Tree)", d: "Крупнейшая медиатека движения: лекции, киртаны, фильмы, детский контент", url: "https://iskcondesiretree.com/" },
  ]},
  { group: "Радио и аудио", items: [
    { t: "Радио 24-часового киртана (24 Hour Kirtan)", d: "Непрерывный киртан из Шри Вриндавана-дхамы — круглосуточный эфир святого имени", url: "https://www.24hourkirtan.fm/", badge: "24/7" },
    { t: "Радио ИСККОН Дизайр Три", d: "Радиопотоки лекций и бхаджанов на разных языках", url: "https://audio.iskcondesiretree.com/" },
  ]},
];

export function HomeMedia() {
  return (
    <div>
      <Head eyebrow="Смотреть и слушать" title="Медиа ИСККОН"
        sub="Прямые трансляции из святых дхам, фильмы о Шриле Прабхупаде и движении, официальные видеоканалы и круглосуточный киртан." />
      <GroupedList groups={MEDIA} />
    </div>
  );
}

/* ═══════════════ ОБРАЗОВАНИЕ ═══════════════ */

const EDUCATION: MoreGroup[] = [
  { group: "Колледжи и институты", items: [
    { t: "Бхактиведанта-колледж (Радхадеш)", d: "Колледж ИСККОН в Радхадеше (Бельгия): бакалавриат по вайшнавскому богословию, очно и онлайн", url: "https://www.bhaktivedantacollege.com/" },
    { t: "Институт Маяпура (Mayapur Institute)", d: "Институт высшего образования и обучения в Шридхаме Маяпуре: шастрические степени, семинары, языковые программы", url: "https://mayapurinstitute.org/" },
    { t: "Институт высшего образования Вриндавана (VIHE)", d: "Институт во Вриндаване: углублённое изучение писаний и санскрита у старших преданных", url: "https://vihe.org/" },
    { t: "Бхактиведанта-видьяпитха", d: "Исследовательский центр изучения «Шримад-Бхагаватам» при ISKCON Govardhan Eco Village", url: "https://vidyapitha.in/" },
  ]},
  { group: "Систематическое изучение", items: [
    { t: "Бхакти-шастри", d: "Каноническая программа GBC по четырём книгам: «Бхагавад-гита», «Нектар преданности», «Нектар наставлений», «Шри Ишопанишад»", url: "https://mayapurinstitute.org/" },
    { t: "Бхакти-вайбхава", d: "Углублённая степень по первым шести песням «Шримад-Бхагаватам»", url: "https://mayapurinstitute.org/" },
    { t: "Курс ученика ИСККОН (Disciple Course)", d: "Обязательный курс GBC для получающих инициацию: гуру-таттва, отношения учителя и ученика, стандарты общества", url: "https://gbc.iskcon.org/" },
  ]},
  { group: "Онлайн-обучение", items: [
    { t: "Министерство образования ИСККОН", d: "Министерство образования ИСККОН: стандарты, программы, аккредитация учебных заведений движения", url: "https://education.iskcon.org/" },
    { t: "Ведабейс — самостоятельное изучение", d: "Все книги Шрилы Прабхупады с поиском, пословным переводом и комментариями — основа любого курса", url: "https://vedabase.io/ru/" },
    { t: "Бхакти-курсы (ISKCON Desire Tree)", d: "Онлайн-курсы по книгам Прабхупады на нескольких языках, включая русский", url: "https://bhakticourses.com/" },
  ]},
];

export function HomeEducation() {
  return (
    <div>
      <Head eyebrow="Учиться" title="Образование ИСККОН"
        sub="Шрила Прабхупада хотел, чтобы его книги изучались систематически. Колледжи, институты дхам и канонические программы Бхакти-шастри открыты каждому." />
      <GroupedList groups={EDUCATION} />
    </div>
  );
}
