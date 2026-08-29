import type { Request, Response } from 'express';
import { fileService } from '../services/file.service';
import { requireUser } from '../middleware/auth.middleware';
import { sendSuccess } from '../utils/response';
import { badRequest } from '../utils/errors';

export const fileController = {
  async upload(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    if (!req.file) throw badRequest('No se recibió ningún archivo (campo "file")');
    const chatId = typeof req.body?.chatId === 'string' ? req.body.chatId : undefined;
    const file = await fileService.registerUploaded(user.id, req.file, chatId);
    sendSuccess(res, { file }, 201);
  },

  async list(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const chatId = typeof req.query.chatId === 'string' ? req.query.chatId : undefined;
    const files = await fileService.list(user.id, chatId);
    sendSuccess(res, { files });
  },

  async getById(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const file = await fileService.get(req.params.id, user.id);
    sendSuccess(res, { file });
  },

  async remove(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    await fileService.remove(req.params.id, user.id);
    sendSuccess(res, { message: 'Archivo eliminado' });
  },
};
