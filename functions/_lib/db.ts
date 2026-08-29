import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import type { Env } from './types';

/**
 * Cliente Neon sobre HTTP (compatible con el runtime de Cloudflare Workers).
 * Se usa como plantilla etiquetada con parámetros, seguro frente a inyección:
 *   const sql = getDb(env);
 *   const rows = await sql`SELECT * FROM users WHERE id = ${id}`;
 */
export function getDb(env: Env): NeonQueryFunction<false, false> {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL no está configurada');
  }
  return neon(env.DATABASE_URL);
}
