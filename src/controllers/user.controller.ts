import type { Request, Response } from 'express';
import { userService } from '../services/user.service';
import { requireUser } from '../middleware/auth.middleware';
import { sendSuccess } from '../utils/response';

export const userController = {
  async getMe(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const profile = await userService.getProfile(user.id);
    sendSuccess(res, { user: profile });
  },

  async updateMe(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const updated = await userService.updateProfile(user.id, req.body);
    sendSuccess(res, { user: updated });
  },

  async changePassword(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    await userService.changePassword(user.id, req.body);
    sendSuccess(res, { message: 'Contraseña actualizada. Vuelve a iniciar sesión.' });
  },

  async deleteMe(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    await userService.deleteAccount(user.id);
    sendSuccess(res, { message: 'Cuenta eliminada' });
  },
};
