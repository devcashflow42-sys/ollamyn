import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { changePasswordSchema, updateProfileSchema } from '../validators/user.validators';

export const usersRoutes = Router();

usersRoutes.use(authenticate);

usersRoutes.get('/me', asyncHandler(userController.getMe));
usersRoutes.patch('/me', validate({ body: updateProfileSchema }), asyncHandler(userController.updateMe));
usersRoutes.post(
  '/me/password',
  validate({ body: changePasswordSchema }),
  asyncHandler(userController.changePassword),
);
usersRoutes.delete('/me', asyncHandler(userController.deleteMe));
