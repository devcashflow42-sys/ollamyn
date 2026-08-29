import type { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { userService } from '../services/user.service';
import { requireUser } from '../middleware/auth.middleware';
import { sendSuccess } from '../utils/response';
import { badRequest } from '../utils/errors';

function meta(req: Request) {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}

export const authController = {
  async register(req: Request, res: Response): Promise<void> {
    const result = await authService.register(req.body, meta(req));
    sendSuccess(res, result, 201);
  },

  async login(req: Request, res: Response): Promise<void> {
    const result = await authService.login(req.body, meta(req));
    sendSuccess(res, result);
  },

  async refresh(req: Request, res: Response): Promise<void> {
    const tokens = await authService.refresh(req.body.refreshToken, meta(req));
    sendSuccess(res, { tokens });
  },

  async logout(req: Request, res: Response): Promise<void> {
    const token = req.body?.refreshToken;
    if (!token) throw badRequest('refreshToken es obligatorio');
    await authService.logout(token);
    sendSuccess(res, { message: 'Sesión cerrada' });
  },

  async me(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const profile = await userService.getProfile(user.id);
    sendSuccess(res, { user: profile });
  },
};
