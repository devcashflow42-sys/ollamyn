import type { Env } from './types';
import { ApiError } from './errors';

/** Cabeceras CORS calculadas a partir de CORS_ORIGINS. */
export function corsHeaders(env: Env, request: Request): Record<string, string> {
  const configured = (env.CORS_ORIGINS ?? '*').trim();
  const origin = request.headers.get('Origin');
  let allowOrigin = '*';
  if (configured !== '*') {
    const list = configured.split(',').map((s) => s.trim()).filter(Boolean);
    allowOrigin = origin && list.includes(origin) ? origin : list[0] ?? '';
  }
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/** Respuesta JSON de éxito: { success: true, data }. */
export function ok(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

/** Respuesta JSON de error: { success: false, error: { code, message } }. */
export function fail(status: number, code: string, message: string, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify({ success: false, error: { code, message } }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

/** Convierte cualquier error en una respuesta de error estándar. */
export function fromError(err: unknown): Response {
  if (err instanceof ApiError) {
    return fail(err.status, err.code, err.message);
  }
  console.error('Error no controlado:', err);
  return fail(500, 'INTERNAL_ERROR', 'Ha ocurrido un error interno.');
}

/** Lee y valida que el body sea JSON. */
export async function readJson<T = unknown>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ApiError(400, 'VALIDATION_ERROR', 'El cuerpo debe ser JSON válido');
  }
}
