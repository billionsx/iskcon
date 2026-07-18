/**
 * KathaScreen — витрина раздела «Катха».
 *
 * УСТРОЙСТВО ТО ЖЕ, ЧТО У КИРТАНОВ, И ЭТО НЕ ЛЕНЬ, А ЗАКОН.
 *
 * ЗКН-Б011: цикл — это РАЗДЕЛ ОЧЕРЕДИ плеера, а не сетка папок поверх него.
 * Плеер уже умеет разделы (`group`/`groupLabel`) — ими сделаны песни и главы у
 * книг и голоса у киртанов. Катхе достаточно проставить дорожке раздел = цикл,
 * и пилюли, счёт частей и переход между циклами работают сами. Вторая сетка
 * поверх плеера — это второй способ делать то же самое; на киртанах его уже
 * снесли, повторять ошибку незачем.
 *
 * Здесь остаётся ровно то, чего у плеера нет: шапка раздела и поиск.
 *
 * ЗКН-Н036: надписей над разделами нет, плашек типа нет — содержимое говорит само.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { usePlayer, mediaTrackKey } from "./player/store";
import { NowPlaying } from "./player/NowPlaying";
import { kathaTracks, kathaSpeakers, KATHA_ALL, KATHA_FIND } from "./katha";
import { useKatha } from "./kathaHydrate";
import { replaceUrl } from "./nav";
import { HubHeader, HubSearch, HubEmpty } from "./ui/HubHeader";

export default function KathaScreen() {
  const p = usePlayer();
  const kv = useKatha();
  const tracks = useMemo(() => kathaTracks(), [kv]);
  const speakers = useMemo(() => kathaSpeakers(), [kv]);

  /* Пока рассказчик один, шапка называет его. Станет больше — подпись честно
     скажет «рассказчики», а не будет врать именем первого. */
  const subtitle = speakers.length === 1
    ? `Бхагавата-катха · ${speakers[0].name}`
    : "Повествования «Шримад-Бхагаватам» голосами рассказчиков традиции";

  useEffect(() => {
    if (tracks.length > 0 && p.kind !== "katha") p.loadKatha(KATHA_ALL);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks.length, p.kind]);

  /* ЗКН-Н077: избранное ведёт к САМОЙ ЗАПИСИ (`/katha?t=<хвост audio>`), а не в
   * раздел. Находим её в очереди и прыгаем; нет в текущей — грузим всю катху и
   * повторяем; нет и там — тихо остаёмся. Параметр гасим, чтобы не сработало дважды. */
  const deepDone = useRef(false);
  useEffect(() => {
    if (deepDone.current || tracks.length === 0 || typeof window === "undefined") return;
    const t = new URLSearchParams(window.location.search).get("t");
    if (!t) { deepDone.current = true; return; }
    const want = "katha:" + decodeURIComponent(t);
    if (p.kind === "katha" && p.tracks.length > 0) {
      const idx = p.tracks.findIndex((tr) => mediaTrackKey(tr, "katha") === want);
      if (idx >= 0) { deepDone.current = true; p.jumpTo(idx); replaceUrl("/katha"); return; }
      if (p.book === KATHA_ALL) { deepDone.current = true; replaceUrl("/katha"); return; }
    }
    if (p.book !== KATHA_ALL) p.loadKatha(KATHA_ALL);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.kind, p.book, p.tracks.length, tracks.length]);

  const [q, setQ] = useState("");
  const [found, setFound] = useState<{ q: string; n: number } | null>(null);
  const norm = (s: string) => (s || "").toLowerCase();
  const submit = () => {
    const s = q.trim();
    if (s.length < 2) return;
    // ищем и по названию части, и по названию цикла: человек помнит «Гопи-гита»,
    // а не «Часть 7» — искать только по дорожке значило бы не находить ничего.
    const n = tracks.filter((t) => norm(t.title).includes(norm(s)) || norm(t.album).includes(norm(s))).length;
    setFound({ q: s, n });
    if (n) p.playKatha(KATHA_FIND + s, 0, false);
  };

  /* ЗКН-Н012 — плеер влезает в экран: высоту считает витрина, а не `vh`.
     Пол в 600 точек: меньше — плеером просто нечем пользоваться. */
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxH, setBoxH] = useState(0);
  useEffect(() => {
    const calc = () => {
      const top = boxRef.current?.getBoundingClientRect().top ?? 0;
      setBoxH(Math.max(600, Math.round(window.innerHeight - top - 104)));
    };
    calc();
    /* Safari прячет адресную строку при прокрутке — высота дрожит на ~100 точек.
       Это не перестройка, а дыхание браузера; отвечаем только на смену ШИРИНЫ. */
    let lastW = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      calc();
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", calc);
    return () => { window.removeEventListener("resize", onResize); window.removeEventListener("orientationchange", calc); };
  }, [tracks.length]);

  return (
    <div style={{ fontFamily: "var(--font-text)",
      paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))" }}>
      <HubHeader eyebrow="Аудиотека" title="Катха" subtitle={subtitle} />

      <HubSearch value={q} onChange={setQ}
        placeholder="Найти катху и включить" ariaLabel="Поиск по катхе" onSubmit={submit} />

      <div ref={boxRef} style={{ marginTop: 16 }}>
        {tracks.length === 0 ? (
          <div style={{ padding: "34px 8px", textAlign: "center", color: "var(--color-label-3)",
            fontSize: "var(--text-subhead)", lineHeight: 1.55 }}>
            Записи загружаются из канала.<br />Они появятся здесь по мере готовности.
          </div>
        ) : found && found.n === 0 ? (
          <HubEmpty query={found.q} hint="Попробуйте название катхи — «Гопи-гита», «Аджамила»." />
        ) : (
          <NowPlaying embedded embeddedHeight={boxH || undefined} />
        )}
      </div>
    </div>
  );
}
