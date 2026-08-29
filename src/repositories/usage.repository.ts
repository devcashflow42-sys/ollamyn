import type { UsageStatus } from '@prisma/client';
import { prisma } from '../config/database';

export const usageRepository = {
  record(data: {
    userId: string;
    modelId?: string | null;
    chatId?: string | null;
    inputTokens: number;
    outputTokens: number;
    latencyMs?: number | null;
    status: UsageStatus;
  }) {
    return prisma.aiUsage.create({
      data: {
        ...data,
        totalTokens: data.inputTokens + data.outputTokens,
      },
    });
  },

  /** Resumen de consumo agregado de un usuario. */
  async summaryForUser(userId: string) {
    const [aggregate, requests] = await Promise.all([
      prisma.aiUsage.aggregate({
        where: { userId },
        _sum: { inputTokens: true, outputTokens: true, totalTokens: true },
      }),
      prisma.aiUsage.count({ where: { userId } }),
    ]);
    return {
      requests,
      inputTokens: aggregate._sum.inputTokens ?? 0,
      outputTokens: aggregate._sum.outputTokens ?? 0,
      totalTokens: aggregate._sum.totalTokens ?? 0,
    };
  },
};
