import { redis } from '../config/redis';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Milisegundos hasta que se reinicia la ventana. */
  resetMs: number;
}

// Almacén en memoria usado cuando Redis no está configurado.
const memoryStore = new Map<string, { count: number; expiresAt: number }>();

// Limpieza periódica de claves expiradas en memoria.
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of memoryStore.entries()) {
    if (value.expiresAt <= now) memoryStore.delete(key);
  }
}, 60_000).unref();

/**
 * Contador de ventana fija. Incrementa el uso de `key` y decide si se supera
 * `limit` dentro de `windowMs`. Usa Redis si está disponible; si no, memoria.
 */
export async function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  if (redis) {
    const redisKey = `rl:${key}`;
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.pexpire(redisKey, windowMs);
    }
    const ttl = await redis.pttl(redisKey);
    const resetMs = ttl > 0 ? ttl : windowMs;
    return {
      allowed: count <= limit,
      limit,
      remaining: Math.max(0, limit - count),
      resetMs,
    };
  }

  // Fallback en memoria
  const now = Date.now();
  const entry = memoryStore.get(key);
  if (!entry || entry.expiresAt <= now) {
    memoryStore.set(key, { count: 1, expiresAt: now + windowMs });
    return { allowed: true, limit, remaining: limit - 1, resetMs: windowMs };
  }
  entry.count += 1;
  return {
    allowed: entry.count <= limit,
    limit,
    remaining: Math.max(0, limit - entry.count),
    resetMs: entry.expiresAt - now,
  };
}
