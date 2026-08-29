import type { Env } from '../../../_lib/types';
import { getDb } from '../../../_lib/db';
import { ok } from '../../../_lib/response';
import { requireUser } from '../../../_lib/auth';
import { mapUser } from '../../../_lib/session';

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
