import type { Env } from '../../_lib/types';
import { getDb } from '../../_lib/db';
import { ok, readJson } from '../../_lib/response';
import { requireAdmin } from '../../_lib/auth';
import { getUser, updateUser } from '../../_lib/adminUsers';
import { adminUpdateUserSchema, parse, assertUuid } from '../../_lib/validation';

/** GET /api/users/:id — ver un usuario (admin). */
export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  await requireAdmin(env, request);
  const id = assertUuid(String(params.id), 'USER_NOT_FOUND');
  const sql = getDb(env);
  return ok({ user: await getUser(sql, id) });
};

/** PATCH /api/users/:id — actualizar rol/estado/plan (admin). */
export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  await requireAdmin(env, request);
  const id = assertUuid(String(params.id), 'USER_NOT_FOUND');
  const body = parse(adminUpdateUserSchema, await readJson(request));
  const sql = getDb(env);
  return ok({ user: await updateUser(sql, id, body) });
};
