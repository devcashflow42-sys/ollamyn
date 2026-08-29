import type { Request, Response } from 'express';
import { chatService } from '../services/chat.service';
import { requireUser } from '../middleware/auth.middleware';
import { sendSuccess, paginated } from '../utils/response';

export const chatController = {
  async create(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const chat = await chatService.create(user.id, req.body);
    sendSuccess(res, { chat }, 201);
  },

  async list(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const query = req.query as unknown as {
      page: number;
      pageSize: number;
      includeArchived: boolean;
    };
    const { items, total } = await chatService.list(user.id, query);
    sendSuccess(res, paginated(items, total, query.page, query.pageSize));
  },

  async getById(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const chat = await chatService.getWithMessages(req.params.id, user.id);
    sendSuccess(res, { chat });
  },

  async update(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const chat = await chatService.update(req.params.id, user.id, req.body);
    sendSuccess(res, { chat });
  },

  async remove(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    await chatService.remove(req.params.id, user.id);
    sendSuccess(res, { message: 'Chat eliminado' });
  },
};
