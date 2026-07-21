/**
 * ПРОБНАЯ ОБОЛОЧКА — /x
 *
 * Отдельная оболочка мульти-приложения. Текущая версия НЕ ТРОГАЕТСЯ: развилка
 * стоит в точке входа, `App.tsx` о существовании `/x` не знает.
 *
 * ПРАВИЛО ИЗОЛЯЦИИ (гейт Д028, правило 8): `x/` не импортирует из текущей
 * оболочки, текущая — из `x/`. Общее — только `ui/`, где лежат кирпичи,
 * приведённые к замерам за восемь заходов. Иначе через месяц две оболочки
 * срастутся незаметно, и подмена одной на другую станет невозможной.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { PlayerHost, type Track } from "./Player";

/** Витрина плеера: по одному образцу каждого вида звука. */
/**
 * Витрина плеера: по одному образцу каждого вида звука.
 *
 * ТЕКСТЫ НАСТОЯЩИЕ — взяты из D1, а не сочинены (ЗКН-БТ001, у него исключений
 * нет). Стихи Бхагавад-гиты и «Джая Радха-Мадхава» лежат в базе приложения.
 * У лекции текста НЕТ намеренно: расшифровки этой записи не существует, и лист
 * честно скажет «ещё не сверен» вместо правдоподобной выдумки.
 *
 * Таймкоды расставлены для показа синхронного чтения и звуком не выверялись.
 */
const DEMO: Track[] = [
  { id: "b1", kind: "book", title: "Бхагавад-гита как она есть",
    subtitle: "Глава 2 · Обзор Бхагавад-гиты", duration: 2760,
    text: [
      { t: 0, s: "Воплотившаяся в теле душа постепенно меняет тело ребенка на тело юноши, а затем на тело старика, и точно так же после смерти она переходит в другое тело. Трезвомыслящего человека такая перемена не смущает. — БГ 2.13" },
      { t: 42, s: "Душа не рождается и не умирает. Она никогда не возникала, не возникает и не возникнет. Она нерожденная, вечная, всегда существующая и изначальная. Она не гибнет, когда погибает тело. — БГ 2.20" },
      { t: 96, s: "Ты можешь выполнять предписанные тебе обязанности, но у тебя нет права наслаждаться плодами своего труда. Никогда не считай, что результаты твоих действий зависят от тебя, но при этом и не отказывайся от выполнения своих обязанностей. — БГ 2.47" },
      { t: 150, s: "Созерцая объекты, приносящие наслаждение чувствам, человек развивает привязанность к ним, из привязанности рождается вожделение, а из вожделения — гнев. — БГ 2.62" },
    ] },
  { id: "l1", kind: "lecture", title: "Лекция по Шримад-Бхагаватам 1.2.6",
    subtitle: "Шрила Прабхупада · Лондон, 1973", duration: 3320 },
  { id: "k1", kind: "kirtan", title: "Харе Кришна маха-мантра",
    subtitle: "Киртан", duration: 1450 },
  { id: "j1", kind: "bhajan", title: "Джая Радха-Мадхава",
    subtitle: "Бхактивинода Тхакур", duration: 268,
    text: [
      { t: 0,  s: "(джая) радха-мадхава · (джая) кунджа-бихари" },
      { t: 22, s: "(джая) гопи-джана-валлабха · (джая) гири-вара-дхари" },
      { t: 48, s: "(джая) яшода-нандана, (джая) враджа-джана-ранджана, (джая) ямуна-тира-вана-чари" },
      { t: 92, s: "Кришна — возлюбленный Радхи. Он являет Свои любовные игры в рощах Вриндавана." },
      { t: 130, s: "Он — возлюбленный пастушек Враджа, Он поднял огромную гору Говардхана." },
      { t: 176, s: "Любимый сын Яшоды и радость обитателей Враджа, Он бродит в лесах по берегам Ямуны." },
    ] },
  { id: "p1", kind: "podcast", title: "Беседы о преданности",
    subtitle: "Выпуск 12", duration: 2140 },
  { id: "i1", kind: "inspiration", title: "Утренняя мысль",
    subtitle: "Вдохновение дня", duration: 95 },
];

/**
 * КАДР — система отсчёта пробной оболочки.
 *
 * Все замеры стандарта сняты с экрана 393 pt: ширина слоя 351, врезка 21,
 * обложка 24, ось 196.5. Вне кадра эти числа бессмысленны — в окне 2400 px
 * обложка растягивается в полоску, а шкала уезжает на всю ширину. Кадр
 * возвращает числам их систему координат: внутри него pt = px один к одному.
 *
 * ТЁМНАЯ ТЕМА. Приложение переводится на тёмную, и пробная оболочка строится
 * сразу под неё. Атрибут ставится на документ, а не на поддерево: `[data-theme]`
 * в globals.css объявлен для светлой ветки, и вложенное переключение потребовало
 * бы дублировать все цвета. Оболочка /x рендерится ВМЕСТО App, поэтому смена
 * атрибута никого не задевает, а на выходе возвращается прежнее значение.
 */
function Frame({ children }: { children: ReactNode }) {
  useEffect(() => {
    const el = document.documentElement;
    const prev = el.dataset.theme ?? "light";
    el.dataset.theme = "dark";
    const prevBg = document.body.style.background;
    document.body.style.background = "#000000";
    return () => { el.dataset.theme = prev; document.body.style.background = prevBg; };
  }, []);
  return (
    <div style={{
      /* 393 × 852 — тот самый кадр, с которого сняты все замеры. Высота нужна
         не меньше ширины: без неё вертикальный ритм не проверить, а именно он
         и разъехался на первом прогоне. */
      width: "min(393px, 100vw)", height: "min(852px, 100dvh)",
      margin: "0 auto", position: "relative", overflow: "hidden",
      background: "var(--color-canvas)",
    }}>{children}</div>
  );
}

/**
 * ЦИКЛ КАТХИ — настоящие записи из каталога.
 *
 * Модель катхи содержательна: РАССКАЗЧИК → ЦИКЛ → ЧАСТЬ. «Гопи-гита, часть 7»
 * без частей 1–6 не самостоятельна, поэтому очередь плеера — это цикл целиком,
 * а оглавление показывает части по порядку.
 *
 * Вид записи — «лекция», а не «киртан»: катха это ПОВЕСТВОВАНИЕ. Отсюда и
 * повадка плеера — перемотка ±15, скорость, оглавление; перемешивания нет,
 * потому что у частей цикла порядок есть.
 *
 * ЗАЧЕМ УЗКИЙ МАРШРУТ. `/api/katha` отдаёт 1,68 МБ и разбирается на телефоне
 * заметным подвисом (Ц12). Плееру нужен перечень циклов — около 30 КБ — и
 * дорожки одного выбранного цикла. Пробная оболочка не должна унаследовать
 * болезнь, которую в текущей уже описали.
 */
interface AlbumRow { id: string; title: string; speaker: string | null; n: number; secs: number }

function hours(secs: number): string {
  const h = Math.floor(secs / 3600), m = Math.round((secs % 3600) / 60);
  return h ? `${h} ч ${m} мин` : `${m} мин`;
}

function PlayScreen() {
  const [albums, setAlbums] = useState<AlbumRow[] | null>(null);
  const [queue, setQueue] = useState<Track[]>(DEMO);
  const [index, setIndex] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /* Группировка по голосу. Порядок рассказчиков — по объёму: у кого больше
     часов, тот и ведёт каталог. */
  const bySpeaker = useMemo(() => {
    const m = new Map<string, AlbumRow[]>();
    for (const a of albums ?? []) {
      const k = a.speaker ?? "Катха";
      (m.get(k) ?? m.set(k, []).get(k)!).push(a);
    }
    return [...m.entries()].sort((x, y) =>
      y[1].reduce((s, a) => s + a.secs, 0) - x[1].reduce((s, a) => s + a.secs, 0));
  }, [albums]);

  useEffect(() => {
    fetch("/api/katha/albums", { credentials: "same-origin" })
      .then((r) => r.json() as Promise<{ albums: AlbumRow[] }>)
      .then((d) => setAlbums(d.albums ?? []))
      .catch(() => setAlbums([]));
  }, []);

  async function openCycle(a: AlbumRow) {
    setBusy(true);
    try {
      const r = await fetch(`/api/katha/album/audio?id=${encodeURIComponent(a.id)}`,
        { credentials: "same-origin" });
      const d = await r.json() as {
        modes: { plain: { tracks: { title: string; url: string; durationSec: number; artist: string }[] } };
      };
      const tracks: Track[] = (d.modes?.plain?.tracks ?? []).map((x, k) => ({
        id: `${a.id}:${k}`, kind: "lecture" as const,
        title: x.title, subtitle: x.artist || a.speaker || "Катха",
        duration: x.durationSec, src: x.url,
      }));
      if (tracks.length) { setQueue(tracks); setIndex(0); setOpenId(a.id); }
    } catch { /* сеть могла упасть — очередь остаётся прежней */ }
    setBusy(false);
  }

  return (
    <Frame>
      <PlayerHost queue={queue} index={index} onIndex={setIndex} tabBarBottom={21}>
      <main style={{ padding: "16px 16px 96px", height: "100%", overflowY: "auto",
        background: "var(--color-canvas)", fontFamily: "var(--font-text)" }}>
        <h1 className="t-display" style={{ margin: "8px 0 4px", fontWeight: 700,
          color: "var(--color-label)" }}>Плеер</h1>
        <p style={{ margin: "0 0 20px", fontFamily: "var(--font-text)",
          fontSize: "var(--text-subhead)", lineHeight: "var(--lh-subhead)",
          letterSpacing: "var(--ls-subhead)", color: "var(--color-label-2)" }}>
          Один компонент на шесть видов звука. Различаются они не элементами,
          а доступными действиями.
        </p>

        {/* ПО РАССКАЗЧИКАМ, А НЕ ПЛОСКИМ СПИСКОМ. Модель катхи — РАССКАЗЧИК →
            ЦИКЛ → ЧАСТЬ, и голос это КОНТЕКСТ СЛУШАНИЯ, а не признак фильтра
            (та же мысль, что ЗКН-Н090 в текущей оболочке). Плоский список из 326
            циклов показывал двенадцать подряд от одного голоса и выглядел так,
            будто рассказчик в каталоге один. */}
        <h2 style={sectionHead}>Катха — настоящие записи</h2>
        {albums === null && <p style={hint}>Загружаю каталог…</p>}
        {albums?.length === 0 && <p style={hint}>Каталог сейчас недоступен.</p>}
        {bySpeaker.map(([speaker, list]) => (
          <section key={speaker} style={{ marginBottom: 18 }}>
            <h3 style={speakerHead}>{speaker}</h3>
            <p style={hint}>{list.length} циклов · {hours(list.reduce((s, x) => s + x.secs, 0))}</p>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {list.slice(0, 4).map((a) => (
                <li key={a.id}>
                  <button type="button" onClick={() => openCycle(a)} disabled={busy}
                    style={{ ...rowStyle, background: openId === a.id ? "var(--color-fill-1)" : "none" }}>
                    <span aria-hidden style={monoStyle}>КА</span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={rowTitle}>{a.title}</span>
                      <span style={rowSub}>{a.n} ч. · {hours(a.secs)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <h2 style={sectionHead}>Витрина видов</h2>
        <p style={hint}>Звука нет — показ раскладки для всех шести повадок.</p>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {DEMO.map((d) => (
            <li key={d.id}>
              <button type="button" onClick={() => { setQueue(DEMO); setIndex(DEMO.indexOf(d)); setOpenId(null); }}
                style={rowStyle}>
                <span aria-hidden style={monoStyle}>{d.kind.slice(0, 2).toUpperCase()}</span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={rowTitle}>{d.title}</span>
                  <span style={rowSub}>{d.subtitle}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </main>
      </PlayerHost>
    </Frame>
  );
}

const sectionHead: React.CSSProperties = {
  margin: "0 0 8px", fontFamily: "var(--font-display)", fontSize: "var(--text-title2)",
  lineHeight: "var(--lh-title2)", letterSpacing: "var(--ls-title2)", fontWeight: 700,
  color: "var(--color-label)",
};
const speakerHead: React.CSSProperties = {
  margin: "0 0 2px", padding: "0 var(--inset-row)", fontFamily: "var(--font-display)",
  fontSize: "var(--text-headline)", lineHeight: "var(--lh-headline)",
  letterSpacing: "var(--ls-headline)", fontWeight: 700, color: "var(--color-label)",
};
const hint: React.CSSProperties = {
  margin: "0 0 8px", padding: "0 var(--inset-row)", fontFamily: "var(--font-text)", fontSize: "var(--text-caption2)",
  lineHeight: "var(--lh-caption2)", letterSpacing: "var(--ls-caption2)",
  color: "var(--color-label-3)",
};
const rowStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "var(--media-gap)", width: "100%",
  minHeight: "var(--row-h-media)", padding: "0 var(--inset-row)", background: "none",
  border: "none", borderRadius: "var(--radius-thumb)", cursor: "pointer", textAlign: "left",
  WebkitTapHighlightColor: "transparent",
};
const monoStyle: React.CSSProperties = {
  width: "var(--thumb-square)", height: "var(--thumb-square)", flexShrink: 0,
  borderRadius: "var(--radius-thumb)", background: "var(--color-fill-1)",
  display: "grid", placeItems: "center", fontFamily: "var(--font-display)",
  fontSize: "var(--text-caption2)", fontWeight: 600, color: "var(--color-label-3)",
};
const rowTitle: React.CSSProperties = {
  display: "block", fontFamily: "var(--font-text)", fontSize: "var(--text-body)",
  lineHeight: "var(--lh-body)", letterSpacing: "var(--ls-body)", color: "var(--color-label)",
  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
};
const rowSub: React.CSSProperties = {
  display: "block", fontFamily: "var(--font-text)", fontSize: "var(--text-subhead)",
  lineHeight: "var(--lh-subhead)", letterSpacing: "var(--ls-subhead)",
  color: "var(--color-label-2)", whiteSpace: "nowrap", overflow: "hidden",
  textOverflow: "ellipsis",
};

export default function XShell() {
  /* ЗКН-Н002 — ВЛАДЕЛЕЦ popstate ОДИН. Второй слушатель гонялся бы с тем, что
     стоит в App: порядок вызова не гарантирован. Пробная оболочка путь ЧИТАЕТ,
     а не слушает; переходы внутри /x пока идут полной загрузкой. Когда у /x
     появится своя навигация, она возьмёт подписку из общего места, а не заведёт
     вторую. */
  const path = typeof window === "undefined" ? "/x" : window.location.pathname;
  if (path.startsWith("/x/play")) return <PlayScreen />;
  return (
    <Frame>
    <main style={{ padding: 24, height: "100%", overflowY: "auto", background: "var(--color-canvas)" }}>
      <h1 className="t-display" style={{ fontWeight: 700, color: "var(--color-label)" }}>
        Пробная оболочка
      </h1>
      <p style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-body)",
        lineHeight: "var(--lh-body)", color: "var(--color-label-2)" }}>
        Готов компонент плеера — <a href="/x/play" style={{ color: "var(--color-gold-deep)" }}>/x/play</a>
      </p>
    </main>
    </Frame>
  );
}
