import { PrismaClient } from '@prisma/client';
import { env } from './env';
import { logger } from './logger';

/**
 * Cliente Prisma singleton.
 * En desarrollo se reutiliza la instancia global para evitar múltiples
 * conexiones cuando el proceso se recarga en caliente.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.isDevelopment
      ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
      : ['warn', 'error'],
  });

if (env.isDevelopment) {
  globalForPrisma.prisma = prisma;
}

/** Comprueba la conectividad con PostgreSQL (usado por el health check). */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error({ err: error }, 'Fallo al comprobar la conexión con PostgreSQL');
    return false;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
