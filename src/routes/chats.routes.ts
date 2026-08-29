import { Router } from 'express';
import { chatController } from '../controllers/chat.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { uuidParam } from '../validators/common.validators';
import { createChatSchema, listChatsQuery, updateChatSchema } from '../validators/chat.validators';

export const chatsRoutes = Router();

chatsRoutes.use(authenticate);

chatsRoutes.post('/', validate({ body: createChatSchema }), asyncHandler(chatController.create));
chatsRoutes.get('/', validate({ query: listChatsQuery }), asyncHandler(chatController.list));
chatsRoutes.get('/:id', validate({ params: uuidParam }), asyncHandler(chatController.getById));
chatsRoutes.patch(
  '/:id',
  validate({ params: uuidParam, body: updateChatSchema }),
  asyncHandler(chatController.update),
);
chatsRoutes.delete('/:id', validate({ params: uuidParam }), asyncHandler(chatController.remove));
