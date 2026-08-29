import type { NeonQueryFunction } from '@neondatabase/serverless';
import type { Env } from './types';
import { signAccessToken, signRefreshToken, sha256hex, durationToMs } from './jwt';

type Sql = NeonQueryFunction<false, false>;

type UserRow = {
  id: string;
  username?: string;
  email?: string;
  role: 'user' | 'admin';
  status?: string;
  plan: 'free' | 'premium';
  created_at?: unknown;
  updated_at?: unknown;
};

/** Proyecta una fila de usuario al formato público (sin password_hash). */
export function mapUser(row: UserRow) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    status: row.status,
    plan: row.plan,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

/** Emite un par access+refresh y almacena el hash del refresh para rotación. */
export async function issueTokens(sql: Sql, env: Env, user: UserRow, request: Request): Promise<AuthTokens> {
  const jti = crypto.randomUUID();
  const accessToken = await signAccessToken(env, { id: user.id, role: user.role, plan: user.plan });
  const refreshToken = await signRefreshToken(env, user.id, jti);
  const tokenHash = await sha256hex(refreshToken);
  const expiresAt = new Date(Date.now() + durationToMs(env.JWT_REFRESH_EXPIRES_IN ?? '30d')).toISOString();
  const ua = (request.headers.get('User-Agent') ?? '').slice(0, 255);
  const ip = (request.headers.get('CF-Connecting-IP') ?? '').slice(0, 64);

  await sql`
    INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, user_agent, ip)
    VALUES (${jti}, ${user.id}, ${tokenHash}, ${expiresAt}, ${ua}, ${ip})
  `;

  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: Math.floor(durationToMs(env.JWT_ACCESS_EXPIRES_IN ?? '15m') / 1000),
  };
}
