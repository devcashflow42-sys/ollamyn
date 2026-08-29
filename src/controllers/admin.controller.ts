import type { Request, Response } from 'express';
import os from 'node:os';
import { userService } from '../services/user.service';
import { sendSuccess, paginated } from '../utils/response';
import { checkDatabaseConnection } from '../config/database';
import { checkRedisConnection } from '../config/redis';
import { providersStatus } from '../services/ai/provider.registry';

export const adminController = {
  async listUsers(req: Request, res: Response): Promise<void> {
    const query = req.query as unknown as {
      page: number;
      pageSize: number;
      status?: 'active' | 'suspended' | 'deleted';
      search?: string;
    };
    const { items, total } = await userService.listUsers(query);
    sendSuccess(res, paginated(items, total, query.page, query.pageSize));
  },

  async getUser(req: Request, res: Response): Promise<void> {
    const user = await userService.adminGetUser(req.params.id);
    sendSuccess(res, { user });
  },

  async updateUser(req: Request, res: Response): Promise<void> {
    const user = await userService.adminUpdateUser(req.params.id, req.body);
    sendSuccess(res, { user });
  },

  /** Health check ampliado: base de datos, Redis, proveedores, sistema. */
  async health(_req: Request, res: Response): Promise<void> {
    const [database, redis] = await Promise.all([
      checkDatabaseConnection(),
      checkRedisConnection(),
    ]);
    sendSuccess(res, {
      status: database ? 'ok' : 'degraded',
      database: database ? 'connected' : 'error',
      redis,
      providers: providersStatus(),
      system: {
        uptimeSeconds: Math.floor(process.uptime()),
        memory: {
          rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
          totalMb: Math.round(os.totalmem() / 1024 / 1024),
          freeMb: Math.round(os.freemem() / 1024 / 1024),
        },
        cpuLoad: os.loadavg(),
        nodeVersion: process.version,
      },
    });
  },
};
