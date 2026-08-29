import { z } from 'zod';

export const uuidParam = z.object({
  id: z.string().uuid('Identificador inválido'),
});

export const slugParam = z.object({
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/i, 'Slug inválido'),
});

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuery>;
