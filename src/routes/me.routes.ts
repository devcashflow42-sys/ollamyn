import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { changePasswordSchema, updateProfileSchema } from '../validators/user.validators';

/**
 * Perfil del usuario autenticado:
 *   GET /api/me · PATCH /api/me · DELETE /api/me · POST /api/me/password
 */
export const meRoutes = Router();

meRoutes.use(authenticate);

meRoutes.get('/me', asyncHandler(userController.getMe));
meRoutes.patch('/me', validate({ body: updateProfileSchema }), asyncHandler(userController.updateMe));
meRoutes.delete('/me', asyncHandler(userController.deleteMe));
meRoutes.post('/me/password', validate({ body: changePasswordSchema }), asyncHandler(userController.changePassword));
