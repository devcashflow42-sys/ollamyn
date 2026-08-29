import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';

/**
 * Campos públicos de un modelo de IA. NO expone `provider`, `providerModel`
 * ni `config`: el cliente nunca conoce qué proveedor real usa cada modelo.
 */
export const publicModelSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  enabled: true,
  contextWindow: true,
  supportsImages: true,
  supportsFiles: true,
  supportsStreaming: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AiModelSelect;

export type PublicModel = Prisma.AiModelGetPayload<{ select: typeof publicModelSelect }>;

export const modelRepository = {
  /** Modelos visibles para usuarios normales (solo habilitados). */
  listEnabled(): Promise<PublicModel[]> {
    return prisma.aiModel.findMany({
      where: { enabled: true },
      select: publicModelSelect,
      orderBy: { name: 'asc' },
    });
  },

  /** Todos los modelos (uso administrativo). */
  listAll() {
    return prisma.aiModel.findMany({ orderBy: { name: 'asc' } });
  },

  findPublicBySlug(slug: string): Promise<PublicModel | null> {
    return prisma.aiModel.findUnique({ where: { slug }, select: publicModelSelect });
  },

  /** Registro completo con datos internos del proveedor (uso interno). */
  findBySlug(slug: string) {
    return prisma.aiModel.findUnique({ where: { slug } });
  },

  findById(id: string) {
    return prisma.aiModel.findUnique({ where: { id } });
  },
};
