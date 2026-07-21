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
import { lazy, Suspense } from "react";
import { PlayerHost, type Track } from "./Player";
import { MediaRow } from "./Library";

const LibraryScreen = lazy(() => import("./Library"));

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
        {/* ЭКРАН, А НЕ ОТЛАДОЧНАЯ СТРАНИЦА. Прежде здесь стояли заголовок
            «Плеер», пояснение про шесть видов и «витрина видов» — материал для
            разработки, который я выкатил в прод и на увеличении он спалился
            весь: сырые плитки, служебные подписи. Каталог собран из уже
            замеренных кирпичей: круг навигации 46, крупный титул, строка
            MediaRow с шагом 102 (📐 IMG_1958). */}
        <main style={{ position: "relative", height: "100%", overflowY: "auto",
          background: "var(--color-canvas)", paddingBottom: 150,
          fontFamily: "var(--font-text)" }}>

          {/* 📐 круг 46 на y59, врезка 17 — как на живых снимках */}
          <div style={{ display: "flex", alignItems: "center",
            padding: "59px 17px 0" }}>
            <a href="/x/library" aria-label="Библиотека"
              style={{ width: 46, height: 46, borderRadius: 23, flexShrink: 0,
                background: "var(--color-fill-1)", display: "grid",
                placeItems: "center", color: "var(--color-label)",
                textDecoration: "none" }}>
              <svg width={17} height={17} viewBox="0 0 24 24" aria-hidden>
                <path fill="none" stroke="currentColor" strokeWidth={2.4}
                  strokeLinecap="round" strokeLinejoin="round"
                  d="M15 5.5 8.5 12 15 18.5" /></svg>
            </a>
          </div>

          <h1 className="t-display" style={{ margin: "10px 24px 6px",
            fontWeight: 700, color: "var(--color-label)" }}>Катха</h1>

          {albums === null && (
            <p style={{ margin: 0, padding: "8px 24px", fontSize: "var(--text-subhead)",
              lineHeight: "var(--lh-subhead)", letterSpacing: "var(--ls-subhead)",
              color: "var(--color-label-3)" }}>Загружаю каталог…</p>
          )}
          {albums?.length === 0 && (
            <p style={{ margin: 0, padding: "8px 24px", fontSize: "var(--text-subhead)",
              lineHeight: "var(--lh-subhead)", letterSpacing: "var(--ls-subhead)",
              color: "var(--color-label-3)" }}>Каталог сейчас недоступен.</p>
          )}

          {bySpeaker.map(([speaker, list]) => (
            <section key={speaker} style={{ marginTop: 14 }}>
              <h2 style={{ margin: "0 21px", fontFamily: "var(--font-display)",
                fontSize: "var(--text-headline)", lineHeight: "var(--lh-headline)",
                letterSpacing: "var(--ls-headline)", fontWeight: 700,
                color: "var(--color-label)" }}>{speaker}</h2>
              <p style={{ margin: "0 21px 4px", fontSize: "var(--text-caption2)",
                lineHeight: "var(--lh-caption2)", letterSpacing: "var(--ls-caption2)",
                color: "var(--color-label-3)" }}>
                {list.length} циклов · {hours(list.reduce((s, x) => s + x.secs, 0))}
              </p>
              <div style={{ opacity: busy ? 0.55 : 1 }}>
                {list.map((a) => (
                  <MediaRow key={a.id} title={a.title}
                    subtitle={`${a.n} ч. · ${hours(a.secs)}`}
                    thumb={<SpeakerTile name={speaker} active={openId === a.id} />}
                    onClick={() => openCycle(a)} />
                ))}
              </div>
            </section>
          ))}
        </main>
      </PlayerHost>
    </Frame>
  );
}

/**
 * Плитка цикла: пока настоящих обложек нет — градиент палитры повествования с
 * монограммой РАССКАЗЧИКА, не серый квадрат со словом «КА». Конвейер обложек по
 * итемам Архива заменит её фотографией, разметка не изменится.
 */
function SpeakerTile({ name, active }: { name: string; active?: boolean }) {
  const mono = name.split(" ").filter(Boolean).slice(0, 2)
    .map((w) => w[0]).join("").toUpperCase();
  return (
    <span aria-hidden style={{ width: "100%", height: "100%", display: "grid",
      placeItems: "center",
      background: "linear-gradient(155deg, rgba(74,96,138,0.55) 0%, rgba(18,22,38,0.9) 100%), var(--color-bg-3)",
      boxShadow: active ? "inset 0 0 0 2px var(--color-gold-deep)" : undefined }}>
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 600,
        fontSize: "var(--text-title3)", letterSpacing: "var(--ls-title3)",
        color: "rgba(255,255,255,0.5)" }}>{mono}</span>
    </span>
  );
}

export default function XShell() {
  /* ЗКН-Н002 — ВЛАДЕЛЕЦ popstate ОДИН. Второй слушатель гонялся бы с тем, что
     стоит в App: порядок вызова не гарантирован. Пробная оболочка путь ЧИТАЕТ,
     а не слушает; переходы внутри /x пока идут полной загрузкой. Когда у /x
     появится своя навигация, она возьмёт подписку из общего места, а не заведёт
     вторую. */
  const path = typeof window === "undefined" ? "/x" : window.location.pathname;
  if (path.startsWith("/x/library")) {
    return <Frame><Suspense fallback={null}><LibraryScreen /></Suspense></Frame>;
  }
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
