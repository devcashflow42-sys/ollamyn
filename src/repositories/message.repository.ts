import type { MessageRole } from '@prisma/client';
import { prisma } from '../config/database';

export const messageRepository = {
  create(data: {
    chatId: string;
    userId: string;
    role: MessageRole;
    content: string;
    modelId?: string | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
    latencyMs?: number | null;
  }) {
    return prisma.message.create({ data });
  },

  /** Historial de un chat en orden cronológico. */
  listByChat(chatId: string, limit = 100) {
    return prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  },

  /** Últimos N mensajes de un chat (para construir el contexto del modelo). */
  async recentContext(chatId: string, limit = 20) {
    const rows = await prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.reverse();
  },
};
