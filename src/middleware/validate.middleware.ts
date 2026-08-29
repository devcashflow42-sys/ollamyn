import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';

interface ValidationSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/**
 * Valida y normaliza `body`, `query` y `params` con esquemas Zod.
 * Los datos parseados sustituyen a los originales, garantizando tipos limpios
 * y descartando campos no esperados (defensa frente a mass-assignment).
 */
export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body ?? {});
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query ?? {}) as Request['query'];
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params ?? {}) as Request['params'];
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
