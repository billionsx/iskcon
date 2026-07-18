/**
 * Кнопки входа через внешние аккаунты — единый вид для экрана входа и
 * онбординга. Тихий стиль Apple: «Продолжить с Apple» — чёрная, остальные —
 * белая карточка на волосяной линии, фирменный глиф слева, подпись по центру.
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

function AppleGlyph({ size = 19, c = "#fff" }: { size?: number; c?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path fill={c} d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8.94-.19 1.84-.86 3.16-.9 1.87-.06 3.06.79 3.86 2.02-3.36 2.05-2.82 6.14.41 7.42-.65 1.52-1.5 3.02-2.51 3.63zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}
function GoogleGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.28-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.9 11.42 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}
function YandexGlyph({ size = 19 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#FC3F1D" />
      {/* «Я» — фирменная литера Яндекс ID */}
      <path fill="#fff" d="M13.62 5.6h2.83v12.8h-2.4v-4.9h-1.2l-2.66 4.9H7.5l3-5.36c-1.6-.72-2.63-2.06-2.63-3.85 0-2.3 1.73-3.59 4.1-3.59h1.65Zm.43 1.86h-1.6c-1.3 0-2.14.7-2.14 1.9 0 1.23.8 2.06 2.14 2.06h1.6V7.46Z" />
    </svg>
  );
}
function VkGlyph({ size = 19 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect width="24" height="24" rx="6.4" fill="#0077FF" />
      <path fill="#fff" d="M12.78 16.87c-4.93 0-7.74-3.38-7.86-9h2.47c.08 4.13 1.9 5.88 3.34 6.24V7.87h2.33v3.56c1.42-.15 2.92-1.77 3.42-3.56h2.33a6.87 6.87 0 0 1-3.16 4.49 7.12 7.12 0 0 1 3.7 4.51h-2.56a4.45 4.45 0 0 0-3.73-3.22v3.22h-.28Z" />
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
  if (id === "apple") return <AppleGlyph size={size} c="currentColor" />;
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
.iol-prov{transition:transform .16s cubic-bezier(.2,.8,.2,1),opacity .16s,background .18s}
.iol-prov:active{transform:scale(.978)}
.iol-prov:disabled{opacity:.55}
`;

const BTN: CSSProperties = {
  position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
  width: "100%", height: 50, borderRadius: 14, cursor: "pointer",
  fontFamily: "var(--font-text)", fontSize: "var(--text-body)", fontWeight: 600,
  WebkitTapHighlightColor: "transparent",
};

export function ProviderButton({ id, label, onPress }: { id: ProviderId; label?: string; onPress: (id: ProviderId) => void }) {
  const meta = PROVIDER_META.find((m) => m.id === id);
  if (!meta) return null;
  const apple = id === "apple";
  return (
    <button
      type="button"
      className="iol-prov"
      onClick={() => onPress(id)}
      style={{
        ...BTN,
        background: apple ? "#000" : "var(--color-bg-2)",
        color: apple ? "#fff" : "var(--color-label)",
        border: apple ? "none" : "0.5px solid var(--color-hairline)",
        boxShadow: apple ? "none" : "var(--shadow-card)",
      }}
    >
      <span style={{ position: "absolute", left: 16, display: "grid", placeItems: "center" }}>{meta.glyph}</span>
      {label ?? meta.label}
    </button>
  );
}

/**
 * Стопка кнопок живых провайдеров. beforeLeave — шанс сохранить локальное
 * состояние (онбординг) до ухода со страницы на сайт провайдера.
 */
export function ProviderButtons({ to, beforeLeave }: { to: string; beforeLeave?: () => void }) {
  const up = useAuthProviders();
  if (!up) return null;
  const live = PROVIDER_META.filter((m) => up[m.id]);
  if (!live.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
