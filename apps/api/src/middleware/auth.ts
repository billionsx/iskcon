import type { MiddlewareHandler } from 'hono';
import { verify } from 'hono/jwt';
import { HTTPException } from 'hono/http-exception';
import type { Bindings, Variables } from '~/index';

/**
 * Проверяет Bearer JWT и кладёт userId в контекст.
 * Используйте для защиты операций записи (POST/PATCH/DELETE).
 */
export const requireAuth: MiddlewareHandler<{ Bindings: Bindings; Variables: Variables }> = async (
  c,
  next,
) => {
  const header = c.req.header('Authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HTTPException(401, { message: 'unauthorized' });
  try {
    const payload = await verify(token, c.env.JWT_SECRET);
    const sub = (payload.sub ?? (payload as Record<string, unknown>).userId) as string | undefined;
    if (!sub) throw new Error('no subject');
    c.set('userId', String(sub));
  } catch {
    throw new HTTPException(401, { message: 'invalid_token' });
  }
  await next();
};

/** Является ли пользователь админом/редактором данного центра (мульти-тенант контроль записи). */
export async function isCenterAdmin(
  db: D1Database,
  centerId: string,
  userId: string,
): Promise<boolean> {
  const row = await db
    .prepare('SELECT 1 FROM center_admins WHERE center_id = ? AND user_id = ? LIMIT 1')
    .bind(centerId, userId)
    .first();
  return row !== null;
}
