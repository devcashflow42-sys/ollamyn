import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { checkDatabaseConnection, disconnectDatabase } from './config/database';
import { disconnectRedis } from './config/redis';
// Registra los proveedores de IA al arrancar.
import './services/ai/provider.registry';

async function bootstrap(): Promise<void> {
  const app = createApp();

  // Aviso temprano si la base de datos no responde (no bloquea el arranque).
  const dbOk = await checkDatabaseConnection();
  if (!dbOk) {
    logger.warn('No se pudo conectar a PostgreSQL al arrancar. Revisa DATABASE_URL.');
  }

  const server = app.listen(env.PORT, env.HOST, () => {
    logger.info(
      { url: `http://${env.HOST}:${env.PORT}`, docs: `${env.PUBLIC_API_URL}/docs`, env: env.NODE_ENV },
      'ollamyn API en marcha',
    );
  });

  // Apagado ordenado.
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Apagando ollamyn API...');
    server.close(async () => {
      await Promise.allSettled([disconnectDatabase(), disconnectRedis()]);
      logger.info('Recursos liberados. Adiós.');
      process.exit(0);
    });
    // Salida forzada si no cierra en 10s.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection');
  });
  process.on('uncaughtException', (err) => {
    logger.error({ err }, 'Uncaught exception');
  });
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Fallo al arrancar el servidor');
  process.exit(1);
});
