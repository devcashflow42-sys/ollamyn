import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/admin.middleware';
import { validate } from '../middleware/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { uuidParam } from '../validators/common.validators';
import { adminListUsersQuery, adminUpdateUserSchema } from '../validators/user.validators';

export const adminRoutes = Router();

// Todas las rutas administrativas requieren autenticación + rol admin.
adminRoutes.use(authenticate, requireAdmin);

adminRoutes.get('/health', asyncHandler(adminController.health));
adminRoutes.get('/users', validate({ query: adminListUsersQuery }), asyncHandler(adminController.listUsers));
adminRoutes.get('/users/:id', validate({ params: uuidParam }), asyncHandler(adminController.getUser));
adminRoutes.patch(
  '/users/:id',
  validate({ params: uuidParam, body: adminUpdateUserSchema }),
  asyncHandler(adminController.updateUser),
);
