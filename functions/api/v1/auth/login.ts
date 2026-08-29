import type { Env } from '../../../_lib/types';
import { getDb } from '../../../_lib/db';
import { ok, readJson } from '../../../_lib/response';
import { ApiError, unauthorized } from '../../../_lib/errors';
import { verifyPassword } from '../../../_lib/password';
import { loginSchema, parse } from '../../../_lib/validation';
import { issueTokens, mapUser } from '../../../_lib/session';

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = parse(loginSchema, await readJson(request));
  const sql = getDb(env);

  const rows = (await sql`SELECT * FROM users WHERE email = ${body.email}`) as Record<string, string>[];
  const row = rows[0];
  // Mensaje genérico para no revelar si el email existe.
  if (!row) throw unauthorized('Credenciales inválidas', 'INVALID_CREDENTIALS');

  const valid = await verifyPassword(body.password, row.password_hash);
  if (!valid) throw unauthorized('Credenciales inválidas', 'INVALID_CREDENTIALS');
  if (row.status === 'deleted') throw unauthorized('Credenciales inválidas', 'INVALID_CREDENTIALS');
  if (row.status === 'suspended') throw new ApiError(403, 'ACCOUNT_SUSPENDED', 'Tu cuenta está suspendida');

  const tokens = await issueTokens(sql, env, row as never, request);
  return ok({ user: mapUser(row as never), tokens });
};
