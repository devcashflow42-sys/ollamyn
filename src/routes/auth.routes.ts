import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validate } from '../middleware/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { loginSchema, refreshSchema, registerSchema } from '../validators/auth.validators';

/**
 * Rutas de autenticación planas (sin prefijo /auth):
 *   POST /api/register · /api/login · /api/logout · /api/refresh
 */
export const authRoutes = Router();

authRoutes.post('/register', validate({ body: registerSchema }), asyncHandler(authController.register));
authRoutes.post('/login', validate({ body: loginSchema }), asyncHandler(authController.login));
authRoutes.post('/logout', asyncHandler(authController.logout));
authRoutes.post('/refresh', validate({ body: refreshSchema }), asyncHandler(authController.refresh));
