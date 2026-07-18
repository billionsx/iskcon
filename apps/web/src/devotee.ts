/**
 * Ступень преданного на клиенте (Ц2) — основа адаптации интерфейса под уровень.
 *
 * У приложения два источника ступени: сервер (вошедший пользователь, users.level
 * из Ц1) и локально (гость, ещё без аккаунта). effectiveLevel() сводит их: сервер
 * приоритетнее. Так и гость после онбординга получает персонализацию, и вошедший
 * преданный — свою ступень. На этом строятся Ц4 «Сегодня» и Ц8 «путь ученика».
 */
import type { AccountUser, DevoteeLevel } from "./account/api";

const ONBOARD_KEY = "onboarded:v1";
const DEVOTEE_KEY = "devotee:v1";

export interface LocalDevotee {
  level?: DevoteeLevel | "";
  name?: string;
  spiritualName?: string;
  dikshaGuru?: string;
  chantNorm?: number;
}

export function isOnboarded(): boolean {
  try { return localStorage.getItem(ONBOARD_KEY) === "1"; } catch { return true; }
}
export function markOnboarded(): void {
  try { localStorage.setItem(ONBOARD_KEY, "1"); } catch { /* приватный режим */ }
}
export function getLocalDevotee(): LocalDevotee {
  try { const s = localStorage.getItem(DEVOTEE_KEY); return s ? (JSON.parse(s) as LocalDevotee) : {}; } catch { return {}; }
}
export function setLocalDevotee(d: LocalDevotee): void {
  try { localStorage.setItem(DEVOTEE_KEY, JSON.stringify({ ...getLocalDevotee(), ...d })); } catch { /* noop */ }
}

/** Эффективная ступень для адаптации интерфейса: сервер (если вошёл) → локально (гость). */
export function effectiveLevel(user: AccountUser | null): DevoteeLevel | null {
  if (user?.level) return user.level;
  const l = getLocalDevotee().level;
  return l ? (l as DevoteeLevel) : null;
}

/** Метаданные ступеней — единый источник подписей для онбординга и профиля. */
export const LEVEL_META: { id: DevoteeLevel; label: string; hint: string }[] = [
  { id: "guest", label: "Гость", hint: "Знакомлюсь с сознанием Кришны" },
  { id: "neophyte", label: "Неофит", hint: "Начинаю духовную практику" },
  { id: "practicing", label: "Практикующий", hint: "Ежедневная садхана" },
  { id: "initiated", label: "Инициированный", hint: "Принял(а) духовного учителя" },
  { id: "guru", label: "Наставник", hint: "Наставляю других преданных" },
];

/* ─────────────────── ступень как ПОРЯДОК, а не как ярлык ───────────────────
 * Ступени идут по возрастанию вовлечённости, поэтому интерфейс может спрашивать
 * не «какая ступень», а «не ниже ли такой-то». Без этого адаптация вырождается
 * в перечисление равных вариантов: гостю показывали управление страницей храма,
 * наставнику — приглашение начать практику.
 */
const LEVEL_RANK: Record<DevoteeLevel, number> = {
  guest: 0, neophyte: 1, practicing: 2, initiated: 3, guru: 4,
};

/** Ступень пользователя не ниже указанной. Неизвестная ступень — самая младшая. */
export function atLeastLevel(user: AccountUser | null, min: DevoteeLevel): boolean {
  const l = effectiveLevel(user);
  return LEVEL_RANK[l ?? "guest"] >= LEVEL_RANK[min];
}

/** Подпись ступени для показа человеку (null — ступень не выбрана). */
export function levelLabel(user: AccountUser | null): string | null {
  const l = effectiveLevel(user);
  return l ? (LEVEL_META.find((m) => m.id === l)?.label ?? null) : null;
}
