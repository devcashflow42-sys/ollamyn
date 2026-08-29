import crypto from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import type { AccessTokenPayload, RefreshTokenPayload } from '../types';
import { AppError } from './errors';

/** Firma un JWT de acceso de corta duración. */
export function signAccessToken(payload: Omit<AccessTokenPayload, 'type'>): string {
  return jwt.sign({ ...payload, type: 'access' }, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  } as SignOptions);
}

/** Firma un JWT de refresco de larga duración. */
export function signRefreshToken(payload: Omit<RefreshTokenPayload, 'type'>): string {
  return jwt.sign({ ...payload, type: 'refresh' }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  } as SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
    if (decoded.type !== 'access') {
      throw new AppError(401, 'TOKEN_INVALID', 'Tipo de token inválido');
    }
    return decoded;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError(401, 'TOKEN_EXPIRED', 'El token de acceso ha expirado');
    }
    throw new AppError(401, 'TOKEN_INVALID', 'Token de acceso inválido');
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
    if (decoded.type !== 'refresh') {
      throw new AppError(401, 'TOKEN_INVALID', 'Tipo de token inválido');
    }
    return decoded;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError(401, 'TOKEN_EXPIRED', 'El token de refresco ha expirado');
    }
    throw new AppError(401, 'TOKEN_INVALID', 'Token de refresco inválido');
  }
}

/** Hash determinista (SHA-256) para almacenar tokens de refresco de forma segura. */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Convierte una duración tipo "30d" / "15m" a milisegundos. */
export function durationToMs(duration: string): number {
  const match = /^(\d+)\s*(ms|s|m|h|d)$/.exec(duration.trim());
  if (!match) return Number(duration) || 0;
  const value = Number(match[1]);
  const unit = match[2];
  const factors: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return value * factors[unit];
}
