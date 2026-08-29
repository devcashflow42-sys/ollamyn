import Redis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

/**
 * Cliente Redis opcional.
 * Si `REDIS_URL` no está configurada, `redis` es `null` y los módulos que lo
 * usan (rate limiting, caché) recurren a una implementación en memoria.
 */
let redis: Redis | null = null;

if (env.redisEnabled) {
  redis = new Redis(env.REDIS_URL, {
    lazyConnect: false,
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    retryStrategy: (times) => Math.min(times * 200, 2000),
  });

  redis.on('connect', () => logger.info('Redis conectado'));
  redis.on('error', (err) => logger.error({ err }, 'Error de Redis'));
} else {
  logger.warn('REDIS_URL no configurada: usando rate limiting en memoria');
}

export { redis };

/** Comprueba la conectividad con Redis (usado por el health check admin). */
export async function checkRedisConnection(): Promise<'connected' | 'disabled' | 'error'> {
  if (!redis) return 'disabled';
  try {
    const pong = await redis.ping();
    return pong === 'PONG' ? 'connected' : 'error';
  } catch {
    return 'error';
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
  }
}
