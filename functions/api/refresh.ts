import type { Env } from '../_lib/types';
import { getDb } from '../_lib/db';
import { ok, readJson } from '../_lib/response';
import { unauthorized } from '../_lib/errors';
import { verifyRefreshToken, sha256hex } from '../_lib/jwt';
import { refreshSchema, parse } from '../_lib/validation';
import { issueTokens } from '../_lib/session';

/** POST /api/refresh — rotación segura del refresh token. */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = parse(refreshSchema, await readJson(request));
  const payload = await verifyRefreshToken(env, body.refreshToken);
  const sql = getDb(env);

  const tokenHash = await sha256hex(body.refreshToken);
  const rows = (await sql`SELECT * FROM refresh_tokens WHERE token_hash = ${tokenHash}`) as Record<string, unknown>[];
  const stored = rows[0];
  if (!stored || stored.revoked_at || new Date(stored.expires_at as string) < new Date()) {
    throw unauthorized('Token de refresco inválido o expirado', 'TOKEN_INVALID');
  }
  if (stored.user_id !== payload.sub) {
    throw unauthorized('Token de refresco inválido', 'TOKEN_INVALID');
  }

  const userRows = (await sql`SELECT id, role, status, plan FROM users WHERE id = ${payload.sub}`) as {
    id: string; role: 'user' | 'admin'; status: string; plan: 'free' | 'premium';
  }[];
  const user = userRows[0];
  if (!user || user.status !== 'active') throw unauthorized('Usuario no disponible');

  await sql`UPDATE refresh_tokens SET revoked_at = now() WHERE id = ${stored.id as string}`;
  const tokens = await issueTokens(sql, env, user, request);
  return ok({ tokens });
};
