import crypto from 'node:crypto';
import express, { type Application } from 'express';
import helmet from 'helmet';
import cors, { type CorsOptions } from 'cors';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';

import { env } from './config/env';
import { logger } from './config/logger';
import { openapiSpec } from './config/swagger';
import { apiRouter } from './routes';
import { healthRoutes } from './routes/health.routes';
import { globalRateLimit } from './middleware/rateLimit.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';

export function createApp(): Application {
  const app = express();

  // Detrás de un proxy/balanceador: confía en X-Forwarded-* para obtener la IP real.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // --- Seguridad ---
  app.use(
    helmet({
      // Swagger UI necesita relajar CSP para cargar sus assets inline.
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  const corsOptions: CorsOptions =
    env.corsOrigins === '*'
      ? { origin: true }
      : {
          origin: (origin, callback) => {
            if (!origin || (env.corsOrigins as string[]).includes(origin)) {
              callback(null, true);
            } else {
              callback(new Error('Origen no permitido por CORS'));
            }
          },
          credentials: true,
        };
  app.use(cors(corsOptions));

  // --- Parseo del body con límites de tamaño ---
  app.use(express.json({ limit: env.REQUEST_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: env.REQUEST_BODY_LIMIT }));

  // --- Logging de peticiones (con request-id) ---
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const existing = (req.headers['x-request-id'] as string) || crypto.randomUUID();
        res.setHeader('X-Request-Id', existing);
        return existing;
      },
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    }),
  );

  // --- Archivos estáticos subidos (storage local de desarrollo) ---
  app.use('/uploads', express.static(env.fileStorageDir, { index: false, maxAge: '1h' }));

  // --- Health check público ---
  app.use('/health', healthRoutes);

  // --- Documentación OpenAPI/Swagger ---
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, { customSiteTitle: 'ollamyn API Docs' }));
  app.get('/openapi.json', (_req, res) => res.json(openapiSpec));

  // --- API v1 (con rate limit global anti-abuso) ---
  app.use('/api/v1', globalRateLimit, apiRouter);

  // --- 404 y manejo global de errores (siempre al final) ---
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
