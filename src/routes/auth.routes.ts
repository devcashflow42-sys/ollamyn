import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { loginSchema, refreshSchema, registerSchema } from '../validators/auth.validators';

export const authRoutes = Router();

authRoutes.post('/register', validate({ body: registerSchema }), asyncHandler(authController.register));
authRoutes.post('/login', validate({ body: loginSchema }), asyncHandler(authController.login));
authRoutes.post('/refresh', validate({ body: refreshSchema }), asyncHandler(authController.refresh));
authRoutes.post('/logout', asyncHandler(authController.logout));
authRoutes.get('/me', authenticate, asyncHandler(authController.me));
