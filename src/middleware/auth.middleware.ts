import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { AppError, unauthorized, forbidden } from '../utils/errors';
import { userRepository } from '../repositories/user.repository';

/**
 * Extrae y verifica el Bearer token, carga el usuario y lo adjunta a `req.user`.
 * Rechaza usuarios inexistentes, eliminados o suspendidos.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw unauthorized('Falta el token de autenticación');
    }

    const token = header.slice('Bearer '.length).trim();
    const payload = verifyAccessToken(token);

    const user = await userRepository.findById(payload.sub);
    if (!user || user.status === 'deleted') {
      throw unauthorized('Usuario no encontrado', 'USER_NOT_FOUND');
    }
    if (user.status === 'suspended') {
      throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Tu cuenta está suspendida');
    }

    req.user = {
      id: user.id,
      role: user.role,
      status: user.status,
      plan: user.plan,
    };
    next();
  } catch (err) {
    next(err);
  }
}

/** Garantiza que exista `req.user` (usar tras `authenticate`). */
export function requireUser(req: Request): NonNullable<Request['user']> {
  if (!req.user) {
    throw forbidden('Se requiere autenticación');
  }
  return req.user;
}
