import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/admin.middleware';
import { validate } from '../middleware/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { uuidParam } from '../validators/common.validators';
import { adminListUsersQuery, adminUpdateUserSchema } from '../validators/user.validators';

/**
 * Gestión de usuarios: /api/users (protegida por rol admin).
 * El perfil propio vive en /api/me; estas rutas administran a otros usuarios.
 */
export const usersRoutes = Router();

usersRoutes.use(authenticate, requireAdmin);

usersRoutes.get('/', validate({ query: adminListUsersQuery }), asyncHandler(adminController.listUsers));
usersRoutes.get('/:id', validate({ params: uuidParam }), asyncHandler(adminController.getUser));
usersRoutes.patch('/:id', validate({ params: uuidParam, body: adminUpdateUserSchema }), asyncHandler(adminController.updateUser));
