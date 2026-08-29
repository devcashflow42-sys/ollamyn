import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/**
 * Esquema de validación de variables de entorno.
 * El proceso no arranca si falta alguna variable crítica en producción.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  PUBLIC_API_URL: z.string().url().default('http://localhost:3000'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
  REDIS_URL: z.string().optional().default(''),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET debe tener al menos 16 caracteres'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(16, 'JWT_REFRESH_SECRET debe tener al menos 16 caracteres'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  CORS_ORIGINS: z.string().default('*'),
  REQUEST_BODY_LIMIT: z.string().default('1mb'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(8).max(15).default(12),

  RATE_LIMIT_GLOBAL_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_GLOBAL_MAX: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_AI_WINDOW_MS: z.coerce.number().int().positive().default(3_600_000),
  RATE_LIMIT_AI_FREE_MAX: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_AI_PREMIUM_MAX: z.coerce.number().int().positive().default(500),

  FILE_STORAGE_DIR: z.string().default('uploads'),
  FILE_MAX_SIZE_BYTES: z.coerce.number().int().positive().default(10_485_760),

  OPENAI_API_KEY: z.string().optional().default(''),
  OPENAI_BASE_URL: z.string().default('https://api.openai.com/v1'),
  NVIDIA_API_KEY: z.string().optional().default(''),
  NVIDIA_BASE_URL: z.string().default('https://integrate.api.nvidia.com/v1'),
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  ANTHROPIC_BASE_URL: z.string().default('https://api.anthropic.com/v1'),
  ANTHROPIC_VERSION: z.string().default('2023-06-01'),
  GOOGLE_API_KEY: z.string().optional().default(''),
  GOOGLE_BASE_URL: z
    .string()
    .default('https://generativelanguage.googleapis.com/v1beta'),
  LOCAL_AI_BASE_URL: z.string().default('http://localhost:11434/v1'),
  LOCAL_AI_API_KEY: z.string().optional().default(''),

  SEED_ADMIN_EMAIL: z.string().email().default('admin@ollamyn.com'),
  SEED_ADMIN_USERNAME: z.string().default('admin'),
  SEED_ADMIN_PASSWORD: z.string().default('ChangeMe123!'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  // No usamos el logger aquí porque depende de env; escribimos a stderr y salimos.
  process.stderr.write(
    `\n[ollamyn] Configuración de entorno inválida:\n${issues}\n\n`,
  );
  process.exit(1);
}

const raw = parsed.data;

export const env = {
  ...raw,
  isProduction: raw.NODE_ENV === 'production',
  isDevelopment: raw.NODE_ENV === 'development',
  isTest: raw.NODE_ENV === 'test',
  corsOrigins:
    raw.CORS_ORIGINS.trim() === '*'
      ? '*'
      : raw.CORS_ORIGINS.split(',')
          .map((o) => o.trim())
          .filter(Boolean),
  fileStorageDir: path.isAbsolute(raw.FILE_STORAGE_DIR)
    ? raw.FILE_STORAGE_DIR
    : path.resolve(process.cwd(), raw.FILE_STORAGE_DIR),
  redisEnabled: raw.REDIS_URL.trim().length > 0,
};

export type Env = typeof env;
