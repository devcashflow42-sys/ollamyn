import type { AuthUser, Env } from './types';
import { getDb } from './db';
import { verifyAccessToken } from './jwt';
import { ApiError, forbidden, unauthorized } from './errors';

/**
 * Verifica el Bearer token, carga el usuario desde la base de datos y valida
 * su estado. Devuelve el usuario autenticado o lanza un ApiError.
 */
export async function requireUser(env: Env, request: Request): Promise<AuthUser> {
  const header = request.headers.get('Authorization');
  if (!header || !header.startsWith('Bearer ')) {
    throw unauthorized('Falta el token de autenticación');
  }
  const token = header.slice('Bearer '.length).trim();
  const payload = await verifyAccessToken(env, token);

  const sql = getDb(env);
  const rows = (await sql`
    SELECT id, role, status, plan FROM users WHERE id = ${payload.sub}
  `) as AuthUser[];
  const user = rows[0];

  if (!user || user.status === 'deleted') {
    throw unauthorized('Usuario no encontrado', 'USER_NOT_FOUND');
  }
  if (user.status === 'suspended') {
    throw new ApiError(403, 'ACCOUNT_SUSPENDED', 'Tu cuenta está suspendida');
  }
  return user;
}

/** Igual que requireUser, pero además exige rol de administrador. */
export async function requireAdmin(env: Env, request: Request): Promise<AuthUser> {
  const user = await requireUser(env, request);
  if (user.role !== 'admin') {
    throw forbidden('Se requieren privilegios de administrador');
  }
  return user;
}
