import type { Env } from '../_lib/types';
import { getDb } from '../_lib/db';
import { ok, readJson } from '../_lib/response';
import { conflict } from '../_lib/errors';
import { hashPassword } from '../_lib/password';
import { registerSchema, parse } from '../_lib/validation';
import { issueTokens, mapUser } from '../_lib/session';

/** POST /api/register */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = parse(registerSchema, await readJson(request));
  const sql = getDb(env);

  const existing = (await sql`
    SELECT email, username FROM users WHERE email = ${body.email} OR username = ${body.username}
  `) as { email: string; username: string }[];
  for (const row of existing) {
    if (row.email === body.email) throw conflict('El email ya está registrado', 'EMAIL_TAKEN');
    if (row.username === body.username) throw conflict('El nombre de usuario ya está en uso', 'USERNAME_TAKEN');
  }

  const passwordHash = await hashPassword(body.password);
  const rows = (await sql`
    INSERT INTO users (username, email, password_hash)
    VALUES (${body.username}, ${body.email}, ${passwordHash})
    RETURNING id, username, email, role, status, plan, created_at, updated_at
  `) as Parameters<typeof mapUser>[0][];

  const tokens = await issueTokens(sql, env, rows[0], request);
  return ok({ user: mapUser(rows[0]), tokens }, 201);
};
