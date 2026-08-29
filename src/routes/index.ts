import { Router } from 'express';
import { authRoutes } from './auth.routes';
import { usersRoutes } from './users.routes';
import { adminRoutes } from './admin.routes';
import { modelsRoutes } from './models.routes';
import { chatsRoutes } from './chats.routes';
import { completionRoutes } from './completion.routes';
import { filesRoutes } from './files.routes';

/** Router principal de la API v1: agrupa todos los módulos bajo /api/v1. */
export const apiRouter = Router();

apiRouter.get('/', (_req, res) => {
  res.json({
    success: true,
    data: { name: 'ollamyn API', version: 'v1', docs: '/docs' },
  });
});

apiRouter.use('/auth', authRoutes);
apiRouter.use('/users', usersRoutes);
apiRouter.use('/admin', adminRoutes);
apiRouter.use('/models', modelsRoutes);
apiRouter.use('/chats', chatsRoutes);
apiRouter.use('/chat', completionRoutes); // POST /api/v1/chat/completions
apiRouter.use('/files', filesRoutes);
