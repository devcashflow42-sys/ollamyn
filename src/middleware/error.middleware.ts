import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';
import { sendError } from '../utils/response';
import { logger } from '../config/logger';
import { env } from '../config/env';

/** Handler para rutas no encontradas (404). */
export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, 404, 'NOT_FOUND', `Ruta no encontrada: ${req.method} ${req.path}`);
}

/**
 * Middleware global de manejo de errores.
 * Traduce cualquier error al formato estándar y nunca expone stack traces
 * ni detalles internos al cliente en producción.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // next es obligatorio para que Express reconozca esto como error handler
  _next: NextFunction,
): void {
  // Errores de aplicación controlados
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, code: err.code, path: req.path }, err.message);
    } else {
      logger.warn({ code: err.code, path: req.path }, err.message);
    }
    sendError(res, err.statusCode, err.code, err.message, err.details);
    return;
  }

  // Errores de validación de Zod
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    sendError(res, 400, 'VALIDATION_ERROR', 'Datos de entrada inválidos', details);
    return;
  }

  // Errores conocidos de Prisma
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[] | undefined)?.join(', ') ?? 'campo';
      sendError(res, 409, 'CONFLICT', `Ya existe un registro con ese ${target}`);
      return;
    }
    if (err.code === 'P2025') {
      sendError(res, 404, 'NOT_FOUND', 'Recurso no encontrado');
      return;
    }
    logger.error({ err, code: err.code }, 'Error conocido de Prisma');
    sendError(res, 500, 'INTERNAL_ERROR', 'Error de base de datos');
    return;
  }

  // Límite de tamaño de body superado (express.json)
  if (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    (err as { type?: string }).type === 'entity.too.large'
  ) {
    sendError(res, 413, 'PAYLOAD_TOO_LARGE', 'El cuerpo de la petición es demasiado grande');
    return;
  }

  // Error no controlado: registrar completo, responder genérico
  logger.error({ err }, 'Error no controlado');
  const message = env.isProduction
    ? 'Ha ocurrido un error interno.'
    : err instanceof Error
      ? err.message
      : 'Error desconocido';
  sendError(res, 500, 'INTERNAL_ERROR', message);
}
