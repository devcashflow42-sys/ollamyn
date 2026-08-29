import { Prisma, type PlanTier, type UserRole, type UserStatus } from '@prisma/client';
import { prisma } from '../config/database';

/** Campos públicos de un usuario: nunca incluye `passwordHash`. */
export const publicUserSelect = {
  id: true,
  username: true,
  email: true,
  role: true,
  status: true,
  plan: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

export const userRepository = {
  findById(id: string): Promise<PublicUser | null> {
    return prisma.user.findUnique({ where: { id }, select: publicUserSelect });
  },

  /** Incluye `passwordHash`: uso interno exclusivo (login, cambio de contraseña). */
  findByEmailWithSecret(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  findByIdWithSecret(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },

  findByEmail(email: string): Promise<PublicUser | null> {
    return prisma.user.findUnique({ where: { email }, select: publicUserSelect });
  },

  findByUsername(username: string): Promise<PublicUser | null> {
    return prisma.user.findUnique({ where: { username }, select: publicUserSelect });
  },

  create(data: {
    username: string;
    email: string;
    passwordHash: string;
    role?: UserRole;
  }): Promise<PublicUser> {
    return prisma.user.create({ data, select: publicUserSelect });
  },

  update(
    id: string,
    data: Partial<{
      username: string;
      email: string;
      passwordHash: string;
      role: UserRole;
      status: UserStatus;
      plan: PlanTier;
    }>,
  ): Promise<PublicUser> {
    return prisma.user.update({ where: { id }, data, select: publicUserSelect });
  },

  /** Borrado lógico: marca el usuario como `deleted` sin eliminar sus datos. */
  softDelete(id: string): Promise<PublicUser> {
    return prisma.user.update({
      where: { id },
      data: { status: 'deleted' },
      select: publicUserSelect,
    });
  },

  async list(params: {
    skip: number;
    take: number;
    status?: UserStatus;
    search?: string;
  }): Promise<{ items: PublicUser[]; total: number }> {
    const where: Prisma.UserWhereInput = {};
    if (params.status) where.status = params.status;
    if (params.search) {
      where.OR = [
        { username: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: publicUserSelect,
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
      }),
      prisma.user.count({ where }),
    ]);
    return { items, total };
  },
};
