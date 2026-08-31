import { Router } from 'express';
import { authRoutes } from './auth.routes';
import { meRoutes } from './me.routes';
import { usersRoutes } from './users.routes';
import { adminRoutes } from './admin.routes';
import { modelsRoutes } from './models.routes';
import { chatsRoutes } from './chats.routes';
import { completionRoutes } from './completion.routes';
import { filesRoutes } from './files.routes';

/**
 * Router principal de la API: todos los módulos cuelgan de /api (sin versión).
 * Rutas resultantes: /api/login, /api/register, /api/models, /api/chat, etc.
 */
export const apiRouter = Router();

apiRouter.get('/', (_req, res) => {
  res.json({ success: true, data: { name: 'ollamyn API', docs: '/api/docs' } });
});

// Autenticación (rutas planas: /api/login, /api/register, /api/logout, /api/refresh)
apiRouter.use('/', authRoutes);
// Perfil propio: /api/me
apiRouter.use('/', meRoutes);
// Gestión de usuarios (admin): /api/users
apiRouter.use('/users', usersRoutes);
// Administración: /api/admin/*
apiRouter.use('/admin', adminRoutes);
// Modelos de IA: /api/models
apiRouter.use('/models', modelsRoutes);
// Chats: /api/chats
apiRouter.use('/chats', chatsRoutes);
// IA: /api/chat y /api/chat/completions
apiRouter.use('/', completionRoutes);
// Archivos adjuntos: /api/files
apiRouter.use('/files', filesRoutes);
