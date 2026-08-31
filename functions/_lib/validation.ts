import { z } from 'zod';
import { ApiError } from './errors';

export const registerSchema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_.-]+$/),
  email: z.string().email().max(255).toLowerCase(),
  password: z.string().min(8).max(128).regex(/[a-zA-Z]/).regex(/[0-9]/),
});

export const loginSchema = z.object({
  email: z.string().email().max(255).toLowerCase(),
  password: z.string().min(1).max(128),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export const updateProfileSchema = z
  .object({
    username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_.-]+$/).optional(),
    email: z.string().email().max(255).toLowerCase().optional(),
  })
  .refine((d) => d.username !== undefined || d.email !== undefined, {
    message: 'Debes proporcionar al menos un campo',
  });

const modelSlug = z.string().min(1).max(80).regex(/^[a-z0-9-]+$/i);

export const createChatSchema = z.object({
  title: z.string().max(120).optional(),
  model: modelSlug.optional(),
});

export const updateChatSchema = z
  .object({
    title: z.string().min(1).max(120).optional(),
    model: modelSlug.optional(),
    archived: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Nada que actualizar' });

export const adminUpdateUserSchema = z
  .object({
    role: z.enum(['user', 'admin']).optional(),
    status: z.enum(['active', 'suspended', 'deleted']).optional(),
    plan: z.enum(['free', 'premium']).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Debes proporcionar al menos un campo' });

export const completionSchema = z.object({
  chatId: z.string().uuid().optional(),
  model: modelSlug,
  message: z.string().min(1).max(32_000),
  stream: z.boolean().optional().default(false),
});

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Garantiza que un parámetro de ruta sea un UUID válido (si no, 404). */
export function assertUuid(id: string, notFoundCode = 'NOT_FOUND'): string {
  if (!uuidRe.test(id)) throw new ApiError(404, notFoundCode, 'Recurso no encontrado');
  return id;
}

/** Valida `data` con un esquema Zod y lanza un ApiError 400 con detalles. */
export function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const first = result.error.issues[0];
    const field = first?.path.join('.') || 'campo';
    throw new ApiError(400, 'VALIDATION_ERROR', `${field}: ${first?.message ?? 'inválido'}`);
  }
  return result.data;
}
