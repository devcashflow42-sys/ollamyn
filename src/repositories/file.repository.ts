import { prisma } from '../config/database';

export const fileRepository = {
  create(data: {
    userId: string;
    chatId?: string | null;
    name: string;
    url: string;
    mimeType: string;
    size: number;
  }) {
    return prisma.file.create({ data });
  },

  findOwned(id: string, userId: string) {
    return prisma.file.findFirst({ where: { id, userId } });
  },

  listByUser(userId: string, chatId?: string) {
    return prisma.file.findMany({
      where: { userId, ...(chatId ? { chatId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  },

  delete(id: string) {
    return prisma.file.delete({ where: { id } });
  },
};
