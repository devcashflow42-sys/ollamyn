import type { Request, Response } from 'express';
import { modelService } from '../services/model.service';
import { sendSuccess } from '../utils/response';

export const modelController = {
  async list(_req: Request, res: Response): Promise<void> {
    const models = await modelService.listForUser();
    sendSuccess(res, { models });
  },

  async getBySlug(req: Request, res: Response): Promise<void> {
    const model = await modelService.getBySlug(req.params.slug);
    sendSuccess(res, { model });
  },
};
