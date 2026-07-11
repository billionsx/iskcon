/**
 * HomeMore — два раздела Главной:
 *   · Медиа ИСККОН — трансляции, фильмы, каналы и радио движения.
 *   · Образование ИСККОН — колледжи, институты и систематическое изучение
 *     книг Шрилы Прабхупады (Бхакти-шастри, Бхакти-вайбхава, курс ученика).
 * Кураторские каталоги официальных и авторитетных ресурсов.
 */

const GOLD = "var(--color-gold)";
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

/* ═══════════════ ОБРАЗОВАНИЕ ═══════════════ */

const EDUCATION: MoreGroup[] = [
  { group: "Прибежище и пранама-мантра", items: [
    { t: "Онлайн-школа учеников (БВГМ)", d: "Пример пути к прибежищу: ступени шраддхи, выбор наставника и духовного учителя, получение пранама-мантры — школа учеников Е. С. Бхакти Вигьяны Госвами", url: "https://bvgm.ru/initiation/" },
  ]},
  { group: "К первой инициации (харинама-дикша)", items: [
    { t: "Школа Бхакти — первая ступень", d: "Курс подготовки к первой инициации: философия, садхана, вайшнавская культура. По резолюции GBC обязателен для рекомендации", url: "https://bhakti.school/sb1", badge: "GBC" },
    { t: "«Ученик в ИСККОН»", d: "Обязательный курс перед инициацией: гуру-таттва, отношения с духовным учителем, Шрила Прабхупада и ИСККОН — онлайн-школа Отдела вайшнавского образования ЦОСКР", url: "https://bhaktilata.ru/idc", badge: "Обязательный" },
    { t: "«Бхагавад-гита шраддха»", d: "Изучение «Бхагавад-гиты как она есть» до первой инициации — с кураторской поддержкой", url: "https://bhaktilata.ru/courses" },
    { t: "Вайшнавский этикет", d: "Чистота, распорядок дня, отношения в общине, этикет с гуру и преданными — курс Бхакти-латы", url: "https://bhaktilata.ru/etiket" },
  ]},
  { group: "Ко второй инициации (брахманской)", items: [
    { t: "Бхакти-шастры (Бхакти-лата)", d: "Систематическое изучение четырёх книг: «Бхагавад-гита», «Нектар преданности», «Нектар наставлений», «Шри Ишопанишад». Необходим для второй инициации", url: "https://bhaktilata.ru/courses", badge: "GBC" },
    { t: "Школа «Ачинтья» — Бхакти-шастры", d: "Углублённый русскоязычный курс четырёх шастр гаудия-вайшнавской традиции с отбором и малыми группами", url: "https://acintyaschool.com/" },
  ]},
  { group: "Углублённое изучение", items: [
    { t: "Бхакти-вайбхава, части 1–2", d: "Песни 1–6 «Шримад-Бхагаватам» — следующая ступень шастрического образования ЦОСКР", url: "https://bhaktilata.ru/courses" },
    { t: "Каталог всех курсов Бхакти-латы", d: "Полный список онлайн-курсов Отдела вайшнавского образования: от первых шагов до подготовки учителей", url: "https://bhaktilata.ru/online" },
  ]},
];


export function HomeEducation() {
  return (
    <div>
      <Head eyebrow="Учиться" title="Образование ИСККОН"
        sub="Путь ученика в ИСККОН по-русски: от первой программы в храме и пранама-мантры — через Школу Бхакти и «Ученика в ИСККОН» к первой и второй инициации. Официальные курсы Отдела вайшнавского образования ЦОСКР." />
      <GroupedList groups={EDUCATION} />
    </div>
  );
}


/* ═══════════════ НОВОСТИ ═══════════════ */

const NEWS: MoreGroup[] = [
  { group: "На русском", items: [
    { t: "krishna.ru", d: "Портал Центра обществ сознания Кришны в России: новости общин, события, праздники и объявления движения по-русски", url: "https://krishna.ru/", badge: "ЦОСКР" },
  ]},
  { group: "Мировые новости движения", items: [
    { t: "ISKCON News", d: "Официальное новостное агентство ИСККОН: репортажи, истории и события общин со всего мира", url: "https://iskconnews.org/", badge: "Официальный" },
    { t: "ISKCON.org", d: "Сайт всемирного общества и Руководящего совета (GBC): новости, объявления и инициативы движения", url: "https://www.iskcon.org/" },
    { t: "Dandavats", d: "Новостная сеть преданных ИСККОН: статьи, объявления и события вайшнавского мира", url: "https://www.dandavats.com/" },
    { t: "Back to Godhead", d: "Флагманский журнал движения, основанный Шрилой Прабхупадой в 1944 году", url: "https://btg.krishna.com/" },
  ]},
];

export function HomeNews() {
  return (
    <div>
      <Head eyebrow="Узнавать" title="Новости ИСККОН"
        sub="Мировые новости Движения сознания Кришны и официальные ресурсы ИСККОН — на русском и английском: репортажи общин, события и объявления вайшнавского мира." />
      <GroupedList groups={NEWS} />
    </div>
  );
}
