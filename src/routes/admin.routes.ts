import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/admin.middleware';
import { validate } from '../middleware/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { uuidParam } from '../validators/common.validators';
import { adminListUsersQuery, adminUpdateUserSchema } from '../validators/user.validators';

/**
 * Administración: /api/admin/* (requiere autenticación + rol admin).
 *   GET /api/admin/users · GET|PATCH|DELETE /api/admin/users/:id · GET /api/admin/health
 */
export const adminRoutes = Router();

adminRoutes.use(authenticate, requireAdmin);

adminRoutes.get('/health', asyncHandler(adminController.health));
adminRoutes.get('/users', validate({ query: adminListUsersQuery }), asyncHandler(adminController.listUsers));
adminRoutes.get('/users/:id', validate({ params: uuidParam }), asyncHandler(adminController.getUser));
adminRoutes.patch('/users/:id', validate({ params: uuidParam, body: adminUpdateUserSchema }), asyncHandler(adminController.updateUser));
adminRoutes.delete('/users/:id', validate({ params: uuidParam }), asyncHandler(adminController.deleteUser));
