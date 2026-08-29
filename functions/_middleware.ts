import type { Env } from './_lib/types';
import { corsHeaders, fromError } from './_lib/response';

/**
 * Middleware global: responde el preflight CORS, añade cabeceras CORS y de
 * seguridad a todas las respuestas y captura errores en un formato estándar.
 */
export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const cors = corsHeaders(env, request);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  let response: Response;
  try {
    response = await context.next();
  } catch (err) {
    response = fromError(err);
  }

  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'no-referrer');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
