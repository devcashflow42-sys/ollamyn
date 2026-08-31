import type { Env } from '../_lib/types';
import { getDb } from '../_lib/db';
import { ok, readJson } from '../_lib/response';
import { badRequest } from '../_lib/errors';
import { sha256hex } from '../_lib/jwt';

/** POST /api/logout — revoca el refresh token (idempotente). */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = (await readJson(request)) as { refreshToken?: string };
  if (!body?.refreshToken) throw badRequest('refreshToken es obligatorio');

  const sql = getDb(env);
  const tokenHash = await sha256hex(body.refreshToken);
  await sql`UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = ${tokenHash} AND revoked_at IS NULL`;
  return ok({ message: 'Sesión cerrada' });
};
