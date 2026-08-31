import type { Env } from '../_lib/types';
import { getDb } from '../_lib/db';
import { ok, readJson } from '../_lib/response';
import { conflict } from '../_lib/errors';
import { requireUser } from '../_lib/auth';
import { updateProfileSchema, parse } from '../_lib/validation';
import { mapUser } from '../_lib/session';

/** GET /api/me — perfil del usuario autenticado + resumen de uso. */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const authed = await requireUser(env, request);
  const sql = getDb(env);
  const rows = (await sql`
    SELECT id, username, email, role, status, plan, created_at, updated_at FROM users WHERE id = ${authed.id}
  `) as Parameters<typeof mapUser>[0][];
  const usage = (await sql`
    SELECT count(*)::int AS requests, coalesce(sum(total_tokens), 0)::int AS "totalTokens"
    FROM ai_usage WHERE user_id = ${authed.id}
  `) as { requests: number; totalTokens: number }[];
  return ok({ user: { ...mapUser(rows[0]), usage: usage[0] } });
};

/** PATCH /api/me — actualizar mi perfil. */
export const onRequestPatch: PagesFunction<Env> = async ({ request, env }) => {
  const authed = await requireUser(env, request);
  const body = parse(updateProfileSchema, await readJson(request));
  const sql = getDb(env);

  if (body.email) {
    const ex = (await sql`SELECT id FROM users WHERE email = ${body.email} AND id <> ${authed.id}`) as { id: string }[];
    if (ex[0]) throw conflict('El email ya está registrado', 'EMAIL_TAKEN');
  }
  if (body.username) {
    const ex = (await sql`SELECT id FROM users WHERE username = ${body.username} AND id <> ${authed.id}`) as { id: string }[];
    if (ex[0]) throw conflict('El nombre de usuario ya está en uso', 'USERNAME_TAKEN');
  }

  const rows = (await sql`
    UPDATE users SET
      username = COALESCE(${body.username ?? null}, username),
      email = COALESCE(${body.email ?? null}, email),
      updated_at = now()
    WHERE id = ${authed.id}
    RETURNING id, username, email, role, status, plan, created_at, updated_at
  `) as Parameters<typeof mapUser>[0][];
  return ok({ user: mapUser(rows[0]) });
};

/** DELETE /api/me — eliminar mi cuenta (borrado lógico). */
export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  const authed = await requireUser(env, request);
  const sql = getDb(env);
  await sql`UPDATE users SET status = 'deleted', updated_at = now() WHERE id = ${authed.id}`;
  await sql`UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = ${authed.id} AND revoked_at IS NULL`;
  return ok({ message: 'Cuenta eliminada' });
};
