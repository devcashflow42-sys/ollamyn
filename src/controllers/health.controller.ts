import type { Request, Response } from 'express';
import { checkDatabaseConnection } from '../config/database';

export const healthController = {
  /** GET /health — liveness/readiness básico. */
  async check(_req: Request, res: Response): Promise<void> {
    const database = await checkDatabaseConnection();
    res.status(database ? 200 : 503).json({
      status: database ? 'ok' : 'degraded',
      database: database ? 'connected' : 'error',
    });
  },
};
