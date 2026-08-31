import type { Env } from '../../_lib/types';
import { getDb } from '../../_lib/db';
import { ok } from '../../_lib/response';
import { requireAdmin } from '../../_lib/auth';
import { listUsers } from '../../_lib/adminUsers';

/** GET /api/admin/users — listar usuarios (admin). */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  await requireAdmin(env, request);
  const url = new URL(request.url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get('pageSize') ?? '20', 10) || 20));
  const status = url.searchParams.get('status') || undefined;
  const search = url.searchParams.get('search') || undefined;

  const sql = getDb(env);
  return ok(await listUsers(sql, { page, pageSize, status, search }));
};
