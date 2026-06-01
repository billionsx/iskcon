/**
 * Базовый адрес API. В проде фронт ходит на том же домене под /api:
 * worker.ts отдаёт оглавление и стихи главы прямо из D1, а остальные пути
 * (например, полный стих) прозрачно проксирует в api.gaurangers.com/v1.
 * Для локальной разработки переопределяется через VITE_API_BASE.
 */
export const API_BASE: string =
  (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api';

export const api = (path: string): string => `${API_BASE}${path}`;
