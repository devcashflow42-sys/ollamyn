import { Router } from 'express';
import { modelController } from '../controllers/model.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { slugParam } from '../validators/common.validators';

export const modelsRoutes = Router();

modelsRoutes.use(authenticate);

modelsRoutes.get('/', asyncHandler(modelController.list));
modelsRoutes.get('/:slug', validate({ params: slugParam }), asyncHandler(modelController.getBySlug));
