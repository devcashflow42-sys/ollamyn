/**
 * Errores de aplicación con código estable y estado HTTP.
 * El middleware de errores los traduce al formato estándar de respuesta.
 */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'INVALID_CREDENTIALS'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'USER_NOT_FOUND'
  | 'MODEL_NOT_FOUND'
  | 'CHAT_NOT_FOUND'
  | 'FILE_NOT_FOUND'
  | 'CONFLICT'
  | 'EMAIL_TAKEN'
  | 'USERNAME_TAKEN'
  | 'RATE_LIMIT_EXCEEDED'
  | 'PAYLOAD_TOO_LARGE'
  | 'PROVIDER_ERROR'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'ACCOUNT_SUSPENDED'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: unknown;
  public readonly isOperational = true;

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// Fábricas de errores comunes -------------------------------------------------

export const badRequest = (message: string, code: ErrorCode = 'VALIDATION_ERROR', details?: unknown) =>
  new AppError(400, code, message, details);

export const unauthorized = (message = 'No autenticado', code: ErrorCode = 'UNAUTHORIZED') =>
  new AppError(401, code, message);

export const forbidden = (message = 'No autorizado', code: ErrorCode = 'FORBIDDEN') =>
  new AppError(403, code, message);

export const notFound = (message = 'Recurso no encontrado', code: ErrorCode = 'NOT_FOUND') =>
  new AppError(404, code, message);

export const conflict = (message: string, code: ErrorCode = 'CONFLICT') =>
  new AppError(409, code, message);

export const rateLimited = (message = 'Has alcanzado tu límite temporal.') =>
  new AppError(429, 'RATE_LIMIT_EXCEEDED', message);

export const providerError = (message = 'El proveedor de IA devolvió un error.', details?: unknown) =>
  new AppError(502, 'PROVIDER_ERROR', message, details);

export const internal = (message = 'Ha ocurrido un error interno.') =>
  new AppError(500, 'INTERNAL_ERROR', message);
