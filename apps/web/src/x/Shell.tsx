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
import { useEffect, useState, type ReactNode } from "react";
import { PlayerHost, type Track } from "./Player";

/** Витрина плеера: по одному образцу каждого вида звука. */
const DEMO: Track[] = [
  { id: "b1", kind: "book", title: "Бхагавад-гита как она есть", subtitle: "Глава 2 · Обзор Бхагавад-гиты",
    duration: 2760, textHref: "/x/play#text-b1" },
  { id: "l1", kind: "lecture", title: "Лекция по Шримад-Бхагаватам 1.2.6", subtitle: "Шрила Прабхупада · Лондон, 1973",
    duration: 3320, textHref: "/x/play#text-l1" },
  { id: "k1", kind: "kirtan", title: "Харе Кришна маха-мантра", subtitle: "Киртан", duration: 1450 },
  { id: "j1", kind: "bhajan", title: "Джая Радха-Мадхава", subtitle: "Бхактивинода Тхакур",
    duration: 268, textHref: "/x/play#text-j1" },
  { id: "p1", kind: "podcast", title: "Беседы о преданности", subtitle: "Выпуск 12", duration: 2140 },
  { id: "i1", kind: "inspiration", title: "Утренняя мысль", subtitle: "Вдохновение дня", duration: 95 },
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

function PlayScreen() {
  const [index, setIndex] = useState(0);
  return (
    <Frame>
      {/* Таб-бара на этом экране нет, поэтому мини-плеер садится на своё
        замеренное место — 21 pt от низа (📐 5.16). Значение 91 = 21 + 62 + 8
        появится, когда под ним встанет таб-бар. */}
    <PlayerHost queue={DEMO} index={index} onIndex={setIndex} tabBarBottom={21}>
      <main style={{ padding: "16px 16px 96px", height: "100%", overflowY: "auto",
        background: "var(--color-canvas)", fontFamily: "var(--font-text)" }}>
        <h1 className="t-display" style={{ margin: "8px 0 4px", fontWeight: 700,
          color: "var(--color-label)" }}>Плеер</h1>
        <p style={{ margin: "0 0 20px", fontFamily: "var(--font-text)",
          fontSize: "var(--text-subhead)", lineHeight: "var(--lh-subhead)",
          letterSpacing: "var(--ls-subhead)", color: "var(--color-label-2)" }}>
          Один компонент на шесть видов звука. Различаются они не элементами,
          а доступными действиями: у книги, лекции и бхаджана есть переход на текст.
        </p>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {DEMO.map((t, i) => (
            <li key={t.id}>
              <button type="button" onClick={() => setIndex(i)}
                style={{ display: "flex", alignItems: "center", gap: "var(--media-gap)",
                  width: "100%", minHeight: "var(--row-h-media)", padding: "0 var(--inset-row)",
                  background: i === index ? "var(--color-fill-1)" : "none",
                  border: "none", borderRadius: "var(--radius-thumb)", cursor: "pointer",
                  textAlign: "left", WebkitTapHighlightColor: "transparent" }}>
                <span aria-hidden style={{ width: "var(--thumb-square)", height: "var(--thumb-square)",
                  borderRadius: "var(--radius-thumb)", background: "var(--color-fill-1)",
                  display: "grid", placeItems: "center", flexShrink: 0,
                  fontFamily: "var(--font-display)", fontSize: "var(--text-caption2)",
                  fontWeight: 600, color: "var(--color-label-3)" }}>
                  {t.kind.slice(0, 2).toUpperCase()}
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "block", fontFamily: "var(--font-text)",
                    fontSize: "var(--text-body)", lineHeight: "var(--lh-body)",
                    letterSpacing: "var(--ls-body)", color: "var(--color-label)",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.title}</span>
                  <span style={{ display: "block", fontFamily: "var(--font-text)",
                    fontSize: "var(--text-subhead)", lineHeight: "var(--lh-subhead)",
                    letterSpacing: "var(--ls-subhead)", color: "var(--color-label-2)",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.subtitle}</span>
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
