import type { AuthenticatedUser } from './index';

/**
 * Extiende el objeto `Request` de Express con el usuario autenticado
 * que inyecta `auth.middleware`.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      requestId?: string;
    }
  }
}

export {};
