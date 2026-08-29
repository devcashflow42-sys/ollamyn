import { SignJWT, jwtVerify, errors as joseErrors, type JWTPayload } from 'jose';
import type { AuthUser, Env } from './types';
import { ApiError } from './errors';

const accessSecret = (env: Env) => new TextEncoder().encode(env.JWT_SECRET);
const refreshSecret = (env: Env) => new TextEncoder().encode(env.JWT_REFRESH_SECRET);

export async function signAccessToken(env: Env, user: Pick<AuthUser, 'id' | 'role' | 'plan'>): Promise<string> {
  return new SignJWT({ role: user.role, plan: user.plan, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(env.JWT_ACCESS_EXPIRES_IN ?? '15m')
    .sign(accessSecret(env));
}

export async function signRefreshToken(env: Env, userId: string, jti: string): Promise<string> {
  return new SignJWT({ type: 'refresh', jti })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(env.JWT_REFRESH_EXPIRES_IN ?? '30d')
    .sign(refreshSecret(env));
}

function mapError(err: unknown): ApiError {
  if (err instanceof joseErrors.JWTExpired) {
    return new ApiError(401, 'TOKEN_EXPIRED', 'El token ha expirado');
  }
  return new ApiError(401, 'TOKEN_INVALID', 'Token inválido');
}

export async function verifyAccessToken(env: Env, token: string): Promise<JWTPayload> {
  try {
    const { payload } = await jwtVerify(token, accessSecret(env));
    if (payload.type !== 'access') throw new ApiError(401, 'TOKEN_INVALID', 'Tipo de token inválido');
    return payload;
  } catch (err) {
    throw err instanceof ApiError ? err : mapError(err);
  }
}

export async function verifyRefreshToken(env: Env, token: string): Promise<JWTPayload> {
  try {
    const { payload } = await jwtVerify(token, refreshSecret(env));
    if (payload.type !== 'refresh') throw new ApiError(401, 'TOKEN_INVALID', 'Tipo de token inválido');
    return payload;
  } catch (err) {
    throw err instanceof ApiError ? err : mapError(err);
  }
}

/** SHA-256 en hex, para almacenar el hash del refresh token. */
export async function sha256hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Convierte "30d" / "15m" / "3600s" a milisegundos. */
export function durationToMs(duration: string): number {
  const match = /^(\d+)\s*(ms|s|m|h|d)$/.exec(duration.trim());
  if (!match) return Number(duration) || 0;
  const value = Number(match[1]);
  const factors: Record<string, number> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return value * factors[match[2]];
}
