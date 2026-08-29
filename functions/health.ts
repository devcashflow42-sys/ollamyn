import type { Env } from './_lib/types';
import { getDb } from './_lib/db';

/** GET /health — liveness + comprobación de base de datos. */
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  let database = 'error';
  try {
    const sql = getDb(env);
    await sql`SELECT 1`;
    database = 'connected';
  } catch {
    database = 'error';
  }
  const okDb = database === 'connected';
  return new Response(JSON.stringify({ status: okDb ? 'ok' : 'degraded', database }), {
    status: okDb ? 200 : 503,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
