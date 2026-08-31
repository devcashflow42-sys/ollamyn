import type { NeonQueryFunction } from '@neondatabase/serverless';
import { notFound } from './errors';

type Sql = NeonQueryFunction<false, false>;

/**
 * Lógica compartida de administración de usuarios (usada por /api/users y
 * /api/admin/users). Todas requieren rol admin en la capa de ruta.
 */
export async function listUsers(
  sql: Sql,
  opts: { page: number; pageSize: number; status?: string; search?: string },
) {
  const offset = (opts.page - 1) * opts.pageSize;
  const status = opts.status ?? null;
  const search = opts.search ? `%${opts.search}%` : null;

  const items = await sql`
    SELECT id, username, email, role, status, plan,
      created_at AS "createdAt", updated_at AS "updatedAt"
    FROM users
    WHERE (${status}::text IS NULL OR status = ${status})
      AND (${search}::text IS NULL OR username ILIKE ${search} OR email ILIKE ${search})
    ORDER BY created_at DESC LIMIT ${opts.pageSize} OFFSET ${offset}
  `;
  const totalRows = (await sql`
    SELECT count(*)::int AS c FROM users
    WHERE (${status}::text IS NULL OR status = ${status})
      AND (${search}::text IS NULL OR username ILIKE ${search} OR email ILIKE ${search})
  `) as { c: number }[];
  const total = totalRows[0]?.c ?? 0;

  return {
    items,
    pagination: {
      total,
      page: opts.page,
      pageSize: opts.pageSize,
      totalPages: Math.max(1, Math.ceil(total / opts.pageSize)),
    },
  };
}

export async function getUser(sql: Sql, id: string) {
  const rows = await sql`
    SELECT id, username, email, role, status, plan,
      created_at AS "createdAt", updated_at AS "updatedAt"
    FROM users WHERE id = ${id}
  `;
  if (!rows[0]) throw notFound('Usuario no encontrado', 'USER_NOT_FOUND');
  return rows[0];
}

export async function updateUser(
  sql: Sql,
  id: string,
  input: { role?: string; status?: string; plan?: string },
) {
  await getUser(sql, id);
  const rows = await sql`
    UPDATE users SET
      role = COALESCE(${input.role ?? null}, role),
      status = COALESCE(${input.status ?? null}, status),
      plan = COALESCE(${input.plan ?? null}, plan),
      updated_at = now()
    WHERE id = ${id}
    RETURNING id, username, email, role, status, plan,
      created_at AS "createdAt", updated_at AS "updatedAt"
  `;
  if (input.status && input.status !== 'active') {
    await sql`UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = ${id} AND revoked_at IS NULL`;
  }
  return rows[0];
}

export async function deleteUser(sql: Sql, id: string) {
  await getUser(sql, id);
  const rows = await sql`
    UPDATE users SET status = 'deleted', updated_at = now() WHERE id = ${id}
    RETURNING id, username, email, role, status, plan,
      created_at AS "createdAt", updated_at AS "updatedAt"
  `;
  await sql`UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = ${id} AND revoked_at IS NULL`;
  return rows[0];
}
