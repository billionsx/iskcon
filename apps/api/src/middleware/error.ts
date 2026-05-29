import type { ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { Bindings, Variables } from '~/index';

export const errorHandler: ErrorHandler<{ Bindings: Bindings; Variables: Variables }> = (err, c) => {
  const requestId = c.get('requestId');

  if (err instanceof HTTPException) {
    return c.json(
      { error: { code: err.message || 'http_error', message: err.message, requestId } },
      err.status,
    );
  }

  console.error('[API ERROR]', { requestId, error: err.message, stack: err.stack });

  return c.json(
    { error: { code: 'internal_error', message: 'Internal server error', requestId } },
    500,
  );
};
