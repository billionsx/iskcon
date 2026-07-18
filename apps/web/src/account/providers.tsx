/**
 * Кнопки входа через внешние аккаунты — единый вид для экрана входа и
 * онбординга. Ряд КВАДРАТНЫХ ПЛИТОК со знаком провайдера, без подписей.
 *
 * Почему не широкие кнопки с текстом: их будет до четырёх (Apple, Google,
 * Яндекс, VK), и стопка из четырёх «Продолжить с …» съедает весь экран входа,
 * оттесняя почту вниз и превращая вход в меню. Ряд плиток занимает одну строку
 * при любом числе провайдеров и оставляет главным то, ради чего человек пришёл.
 *
 * Знаки МОНОХРОМНЫЕ (графит на белом): четыре фирменных палитры рядом — это
 * ярмарка логотипов, а не тихий экран. Форма знака узнаётся и без цвета.
 *
 * Список живых провайдеров приходит с сервера (GET /api/auth/providers —
 * провайдер «жив», когда его ключи заполнены в app_config). Мёртвых кнопок не
 * показываем: кнопка — обещание, а не витрина планов.
 *
 * Нажатие — обычная навигация на /api/auth/oauth/:p/start (серверный код-флоу,
 * cookie ставит колбэк); параметр to возвращает человека туда, откуда он ушёл.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { api } from "../api";

export type ProviderId = "apple" | "google" | "yandex" | "vk";

export interface ProvidersUp { apple: boolean; google: boolean; yandex: boolean; vk: boolean }

/* ─────────────────────────── глифы ─────────────────────────── */

function AppleGlyph({ size = 19, c = "currentColor" }: { size?: number; c?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path fill={c} d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8.94-.19 1.84-.86 3.16-.9 1.87-.06 3.06.79 3.86 2.02-3.36 2.05-2.82 6.14.41 7.42-.65 1.52-1.5 3.02-2.51 3.63zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}
function GoogleGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden>
      <path
        fill="currentColor"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62zM9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18zM3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.28-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33zM9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.9 11.42 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}
function YandexGlyph({ size = 19 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {/* «Я» Яндекс ID — контур литеры без плашки: знак читается формой */}
      <path
        fill="currentColor"
        d="M13.62 3.6h3.03v16.8h-2.6v-6.5h-1.2l-3.3 6.5H6.6l3.72-7.02C8.35 12.5 7.1 10.8 7.1 8.5c0-2.94 2.2-4.9 5.24-4.9h1.28Zm.43 2.3h-1.42c-1.66 0-2.73 1.05-2.73 2.66 0 1.63 1.02 2.7 2.73 2.7h1.42V5.9Z"
      />
    </svg>
  );
}
function VkGlyph({ size = 19 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {/* Знак VK без синей плашки — монохромный, как остальные */}
      <path
        fill="currentColor"
        d="M12.9 18.2c-6.16 0-9.67-4.22-9.82-11.25h3.09c.1 5.16 2.38 7.35 4.18 7.8V6.95h2.91v4.45c1.78-.19 3.65-2.21 4.28-4.45h2.91a8.59 8.59 0 0 1-3.95 5.61 8.9 8.9 0 0 1 4.62 5.64h-3.2a5.56 5.56 0 0 0-4.66-4.03v4.03H12.9Z"
      />
    </svg>
  );
}

export const PROVIDER_META: { id: ProviderId; label: string; glyph: ReactNode }[] = [
  { id: "apple", label: "Продолжить с Apple", glyph: <AppleGlyph /> },
  { id: "google", label: "Продолжить с Google", glyph: <GoogleGlyph /> },
  { id: "yandex", label: "Продолжить с Яндекс ID", glyph: <YandexGlyph /> },
  { id: "vk", label: "Продолжить с VK ID", glyph: <VkGlyph /> },
];

export const PROVIDER_NAME: Record<ProviderId, string> = {
  apple: "Apple", google: "Google", yandex: "Яндекс ID", vk: "VK ID",
};

export function providerGlyph(id: ProviderId, size = 19): ReactNode {
  if (id === "apple") return <AppleGlyph size={size} />;
  if (id === "google") return <GoogleGlyph size={size - 1} />;
  if (id === "yandex") return <YandexGlyph size={size} />;
  return <VkGlyph size={size} />;
}

/** Адрес старта серверного OAuth-флоу. */
export const oauthStartUrl = (p: ProviderId, to: string): string =>
  api(`/auth/oauth/${p}/start?to=${encodeURIComponent(to)}`);

/* ─────────────────────────── живые провайдеры ─────────────────────────── */

let cachedUp: ProvidersUp | null = null;
let inflight: Promise<ProvidersUp | null> | null = null;

async function fetchProviders(): Promise<ProvidersUp | null> {
  try {
    const r = await fetch(api("/auth/providers"), { credentials: "same-origin" });
    if (!r.ok) return null;
    const d = (await r.json()) as { providers?: Partial<ProvidersUp> };
    const p = d.providers ?? {};
    cachedUp = { apple: !!p.apple, google: !!p.google, yandex: !!p.yandex, vk: !!p.vk };
    return cachedUp;
  } catch {
    return null;
  }
}

/** Какие провайдеры настроены (null — ещё грузим/сеть недоступна). */
export function useAuthProviders(): ProvidersUp | null {
  const [up, setUp] = useState<ProvidersUp | null>(cachedUp);
  useEffect(() => {
    if (cachedUp) return;
    let alive = true;
    (inflight ??= fetchProviders()).then((v) => {
      inflight = null;
      if (alive && v) setUp(v);
    });
    return () => { alive = false; };
  }, []);
  return up;
}

/* ─────────────────────────── кнопки ─────────────────────────── */

const PROV_CSS = `
.iol-prov{transition:transform .16s cubic-bezier(.2,.8,.2,1),opacity .16s,background .18s,border-color .18s}
.iol-prov:active{transform:scale(.94)}
.iol-prov:disabled{opacity:.55}
@media (hover:hover){.iol-prov:hover{background:var(--color-fill-quaternary,rgba(120,120,128,.06))}}
`;

/** Сторона плитки. 52 — комфортная цель нажатия (Apple HIG ≥44) без грузности. */
const TILE = 52;

const TILE_CSS: CSSProperties = {
  display: "grid", placeItems: "center",
  width: TILE, height: TILE, borderRadius: 15,
  background: "var(--color-bg-2)",
  color: "var(--color-label)",
  border: "0.5px solid var(--color-hairline)",
  boxShadow: "var(--shadow-card)",
  cursor: "pointer",
  WebkitTapHighlightColor: "transparent",
  padding: 0,
};

/** Одна плитка провайдера. Подписи нет — её несёт aria-label и подсказка. */
export function ProviderButton({ id, onPress }: { id: ProviderId; label?: string; onPress: (id: ProviderId) => void }) {
  if (!PROVIDER_META.some((m) => m.id === id)) return null;
  const name = PROVIDER_NAME[id];
  return (
    <button
      type="button"
      className="iol-prov"
      onClick={() => onPress(id)}
      style={TILE_CSS}
      aria-label={`Продолжить с ${name}`}
      title={`Продолжить с ${name}`}
    >
      {providerGlyph(id, 22)}
    </button>
  );
}

/**
 * Ряд живых провайдеров. beforeLeave — шанс сохранить локальное состояние
 * (онбординг) до ухода со страницы на сайт провайдера.
 */
export function ProviderButtons({ to, beforeLeave }: { to: string; beforeLeave?: () => void }) {
  const up = useAuthProviders();
  if (!up) return null;
  const live = PROVIDER_META.filter((m) => up[m.id]);
  if (!live.length) return null;
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
      <style>{PROV_CSS}</style>
      {live.map((m) => (
        <ProviderButton
          key={m.id}
          id={m.id}
          onPress={(id) => {
            try { beforeLeave?.(); } catch { /* не мешаем уходу */ }
            window.location.assign(oauthStartUrl(id, to));
          }}
        />
      ))}
    </div>
  );
}
