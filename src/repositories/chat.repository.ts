import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';

export const chatRepository = {
  create(data: { userId: string; title: string; modelId?: string | null }) {
    return prisma.chat.create({ data });
  },

  findById(id: string) {
    return prisma.chat.findUnique({ where: { id } });
  },

  /** Busca un chat garantizando que pertenece al usuario. */
  findOwned(id: string, userId: string) {
    return prisma.chat.findFirst({ where: { id, userId } });
  },

  async listByUser(params: {
    userId: string;
    skip: number;
    take: number;
    includeArchived: boolean;
  }) {
    const where: Prisma.ChatWhereInput = { userId: params.userId };
    if (!params.includeArchived) where.archived = false;

    const [items, total] = await Promise.all([
      prisma.chat.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: params.skip,
        take: params.take,
        include: {
          model: { select: { slug: true, name: true } },
          _count: { select: { messages: true } },
        },
      }),
      prisma.chat.count({ where }),
    ]);
    return { items, total };
  },

  update(
    id: string,
    data: Partial<{ title: string; modelId: string | null; archived: boolean }>,
  ) {
    return prisma.chat.update({ where: { id }, data });
  },

  /** Actualiza `updatedAt` para reflejar actividad reciente. */
  touch(id: string) {
    return prisma.chat.update({ where: { id }, data: { updatedAt: new Date() } });
  },

  delete(id: string) {
    return prisma.chat.delete({ where: { id } });
  },
};
