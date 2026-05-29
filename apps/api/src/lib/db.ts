/** Хелперы для работы со строками D1 (SQLite). */

/** Безопасно разбирает JSON-колонку; при ошибке возвращает fallback. */
export function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
