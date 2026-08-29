import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { consumeRateLimit } from '../services/rateLimit.service';
import { rateLimited } from '../utils/errors';

function setHeaders(res: Response, result: { limit: number; remaining: number; resetMs: number }): void {
  res.setHeader('X-RateLimit-Limit', String(result.limit));
  res.setHeader('X-RateLimit-Remaining', String(result.remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(result.resetMs / 1000)));
}

function clientKey(req: Request): string {
  if (req.user) return `user:${req.user.id}`;
  return `ip:${req.ip}`;
}

/**
 * Rate limit global anti-abuso, aplicado a toda la API.
 * Se identifica por usuario autenticado o, en su defecto, por IP.
 */
export async function globalRateLimit(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await consumeRateLimit(
      `global:${clientKey(req)}`,
      env.RATE_LIMIT_GLOBAL_MAX,
      env.RATE_LIMIT_GLOBAL_WINDOW_MS,
    );
    setHeaders(res, result);
    if (!result.allowed) {
      res.setHeader('Retry-After', String(Math.ceil(result.resetMs / 1000)));
      throw rateLimited();
    }
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Rate limit específico para solicitudes de IA, dependiente del plan del usuario
 * (gratuito vs premium). Cumple los límites configurables por hora.
 */
export async function aiRateLimit(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      next();
      return;
    }
    const max =
      user.plan === 'premium'
        ? env.RATE_LIMIT_AI_PREMIUM_MAX
        : env.RATE_LIMIT_AI_FREE_MAX;

    const result = await consumeRateLimit(
      `ai:${user.id}`,
      max,
      env.RATE_LIMIT_AI_WINDOW_MS,
    );
    setHeaders(res, result);
    if (!result.allowed) {
      res.setHeader('Retry-After', String(Math.ceil(result.resetMs / 1000)));
      throw rateLimited();
    }
    next();
  } catch (err) {
    next(err);
  }
}
