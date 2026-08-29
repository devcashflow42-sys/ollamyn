import type { NextFunction, Request, Response } from 'express';
import { forbidden, unauthorized } from '../utils/errors';

/**
 * Requiere que el usuario autenticado tenga rol `admin`.
 * Debe usarse siempre después de `authenticate`.
 */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(unauthorized('No autenticado'));
    return;
  }
  if (req.user.role !== 'admin') {
    next(forbidden('Se requieren privilegios de administrador'));
    return;
  }
  next();
}
