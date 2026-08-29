import pino from 'pino';
import { env } from './env';

/**
 * Logger central basado en pino.
 * `redact` garantiza que nunca se escriban secretos ni credenciales en los logs,
 * aunque un objeto que los contenga se pase por error.
 */
export const logger = pino({
  level: env.isProduction ? 'info' : 'debug',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'passwordHash',
      'currentPassword',
      'newPassword',
      '*.password',
      '*.passwordHash',
      'token',
      'accessToken',
      'refreshToken',
      'apiKey',
      '*.apiKey',
      'JWT_SECRET',
      'JWT_REFRESH_SECRET',
      'OPENAI_API_KEY',
      'NVIDIA_API_KEY',
      'ANTHROPIC_API_KEY',
      'GOOGLE_API_KEY',
    ],
    censor: '[REDACTED]',
  },
  transport: env.isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
  base: { service: 'ollamyn-api' },
});

export type Logger = typeof logger;
