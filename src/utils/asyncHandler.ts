import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Envuelve un handler async para que cualquier rechazo se reenvíe a `next()`
 * y lo capture el middleware global de errores.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
