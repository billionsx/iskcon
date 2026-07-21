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
import { useEffect, type ReactNode } from "react";
import { lazy, Suspense } from "react";

const LibraryScreen = lazy(() => import("./Library"));

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
  return (
    <Frame>
    <main style={{ padding: 24, height: "100%", overflowY: "auto", background: "var(--color-canvas)" }}>
      <h1 className="t-display" style={{ fontWeight: 700, color: "var(--color-label)" }}>
        Пробная оболочка
      </h1>
      <p style={{ fontFamily: "var(--font-text)", fontSize: "var(--text-body)",
        lineHeight: "var(--lh-body)", color: "var(--color-label-2)" }}>
        Готова библиотека — <a href="/x/library" style={{ color: "var(--color-gold-deep)" }}>/x/library</a>
      </p>
    </main>
    </Frame>
  );
}
