import { Router } from 'express';
import { completionController } from '../controllers/completion.controller';
import { authenticate } from '../middleware/auth.middleware';
import { aiRateLimit } from '../middleware/rateLimit.middleware';
import { validate } from '../middleware/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { completionSchema } from '../validators/chat.validators';

/**
 * Generación de IA. Se exponen dos rutas equivalentes:
 *   POST /api/chat  y  POST /api/chat/completions
 * Ambas autentican, aplican el límite de uso y validan la entrada.
 */
export const completionRoutes = Router();

const handler = [
  authenticate,
  aiRateLimit,
  validate({ body: completionSchema }),
  asyncHandler(completionController.create),
] as const;

completionRoutes.post('/chat', ...handler);
completionRoutes.post('/chat/completions', ...handler);
