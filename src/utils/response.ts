import type { Response } from 'express';
import type { ErrorCode } from './errors';

/** Formato estándar de respuesta correcta: { success: true, data }. */
export function sendSuccess<T>(res: Response, data: T, statusCode = 200): Response {
  return res.status(statusCode).json({ success: true, data });
}

/** Formato estándar de error: { success: false, error: { code, message } }. */
export function sendError(
  res: Response,
  statusCode: number,
  code: ErrorCode | string,
  message: string,
  details?: unknown,
): Response {
  const body: Record<string, unknown> = {
    success: false,
    error: { code, message },
  };
  if (details !== undefined) {
    (body.error as Record<string, unknown>).details = details;
  }
  return res.status(statusCode).json(body);
}

/** Envoltorio de datos paginados. */
export function paginated<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
) {
  return {
    items,
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}
