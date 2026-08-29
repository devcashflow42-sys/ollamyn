import { Router } from 'express';
import { completionController } from '../controllers/completion.controller';
import { authenticate } from '../middleware/auth.middleware';
import { aiRateLimit } from '../middleware/rateLimit.middleware';
import { validate } from '../middleware/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { completionSchema } from '../validators/chat.validators';

export const completionRoutes = Router();

// Autenticación + límite de uso de IA por plan antes de generar.
completionRoutes.post(
  '/completions',
  authenticate,
  aiRateLimit,
  validate({ body: completionSchema }),
  asyncHandler(completionController.create),
);
