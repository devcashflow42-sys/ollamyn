/** Error de API con código estable y estado HTTP. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const badRequest = (message: string, code = 'VALIDATION_ERROR') =>
  new ApiError(400, code, message);
export const unauthorized = (message = 'No autenticado', code = 'UNAUTHORIZED') =>
  new ApiError(401, code, message);
export const forbidden = (message = 'No autorizado', code = 'FORBIDDEN') =>
  new ApiError(403, code, message);
export const notFound = (message = 'Recurso no encontrado', code = 'NOT_FOUND') =>
  new ApiError(404, code, message);
export const conflict = (message: string, code = 'CONFLICT') =>
  new ApiError(409, code, message);
export const rateLimited = (message = 'Has alcanzado tu límite temporal.') =>
  new ApiError(429, 'RATE_LIMIT_EXCEEDED', message);
export const providerError = (message = 'El proveedor de IA devolvió un error.') =>
  new ApiError(502, 'PROVIDER_ERROR', message);
