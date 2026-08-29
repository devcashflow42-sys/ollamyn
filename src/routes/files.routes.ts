import { Router } from 'express';
import { fileController } from '../controllers/file.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { uploadSingle } from '../config/upload';
import { uuidParam } from '../validators/common.validators';

export const filesRoutes = Router();

filesRoutes.use(authenticate);

filesRoutes.post('/', uploadSingle, asyncHandler(fileController.upload));
filesRoutes.get('/', asyncHandler(fileController.list));
filesRoutes.get('/:id', validate({ params: uuidParam }), asyncHandler(fileController.getById));
filesRoutes.delete('/:id', validate({ params: uuidParam }), asyncHandler(fileController.remove));
