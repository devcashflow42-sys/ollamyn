import { z } from 'zod';

const modelSlug = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9-]+$/i, 'Slug de modelo inválido');

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
  .refine((d) => Object.keys(d).length > 0, {
    message: 'Debes proporcionar al menos un campo para actualizar',
  });

export const listChatsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  includeArchived: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

export const completionSchema = z.object({
  chatId: z.string().uuid('chatId inválido').optional(),
  model: modelSlug,
  message: z
    .string()
    .min(1, 'El mensaje no puede estar vacío')
    .max(32_000, 'El mensaje es demasiado largo'),
  stream: z.boolean().optional().default(false),
});

export const listFilesQuery = z.object({
  chatId: z.string().uuid().optional(),
});

export type CompletionInput = z.infer<typeof completionSchema>;
