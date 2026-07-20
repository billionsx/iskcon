/**
 * ЗКН-Ф016 — ОДИН КРАШ НЕ УБИВАЕТ ВСЁ ПРИЛОЖЕНИЕ.
 *
 * ПОЧЕМУ ЭТОТ ФАЙЛ СУЩЕСТВУЕТ.
 *
 * В экране Рецептов жила ошибка типа: `CATEGORIES.map((c) => ({ id: c, label: c }))`,
 * где CATEGORIES — это УЖЕ `{id, label}[]`. Получался `{ id: {id,label}, ... }`,
 * React пытался отрендерить ОБЪЕКТ как текст и падал:
 *
 *     Minified React error #31: object with keys {id, label}
 *
 * И вот что было дальше — это важнее самой ошибки.
 *
 * React, поймав исключение при рендере и НЕ НАЙДЯ границы ошибок, размонтирует
 * ВСЁ ДЕРЕВО. Приложение умирает целиком. Дальше человек видит белый лист
 * ВЕЗДЕ — на «назад», на любой вкладке, на любом адресе, — пока не перезагрузит
 * страницу. Один битый экран делал мёртвым всё приложение.
 *
 * Отсюда и загадочное «через раз»: зашёл в Рецепты — всё умерло; не заходил —
 * работает.
 *
 * ГРАНИЦА ОШИБОК не чинит баг. Она делает его ЧЕСТНЫМ: падает ОДИН экран,
 * человек видит понятное сообщение и может уйти на другую вкладку. Приложение
 * остаётся живым.
 *
 * Сборка такое не ловит: esbuild НЕ ПРОВЕРЯЕТ ТИПЫ. `tsc` ругался — я счёл
 * ошибку «старой и неважной». **Ошибка типа = краш в браузере.**
 */
import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Что показать вместо упавшего экрана. */
  fallback?: ReactNode;
}

interface State {
  failed: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    // В прод-сборке React минифицирует сообщение — печатаем, что есть.
    console.error("[ЗКН-Ф016] экран упал:", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    if (this.props.fallback) return <>{this.props.fallback}</>;

    return (
      <div style={{
        padding: "48px 20px", textAlign: "center",
        fontFamily: "var(--font-text)", color: "var(--color-label-2)",
      }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-title3)', lineHeight: 'var(--lh-title3)', letterSpacing: 'var(--ls-title3)',
          fontWeight: 700, color: "var(--color-label)", marginBottom: 8,
        }}>
          Этот раздел не открылся
        </div>
        <div style={{ fontFamily: 'var(--font-text)', fontSize: 'var(--text-subhead)', lineHeight: 'var(--lh-subhead)', letterSpacing: 'var(--ls-subhead)', maxWidth: 320, margin: "0 auto" }}>
          Остальное приложение работает — перейдите на другую вкладку.
        </div>
      </div>
    );
  }
}
