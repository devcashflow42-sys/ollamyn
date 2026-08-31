import type { PlanTier, UserRole, UserStatus } from '@prisma/client';
import { userRepository, type PublicUser } from '../repositories/user.repository';
import { usageRepository } from '../repositories/usage.repository';
import { prisma } from '../config/database';
import { hashPassword, verifyPassword } from '../utils/password';
import { badRequest, conflict, notFound, unauthorized } from '../utils/errors';

export const userService = {
  async getById(id: string): Promise<PublicUser> {
    const user = await userRepository.findById(id);
    if (!user) throw notFound('Usuario no encontrado', 'USER_NOT_FOUND');
    return user;
  },

  async getProfile(id: string) {
    const [user, usage] = await Promise.all([
      this.getById(id),
      usageRepository.summaryForUser(id),
    ]);
    return { ...user, usage };
  },

  async updateProfile(
    id: string,
    input: { username?: string; email?: string },
  ): Promise<PublicUser> {
    if (input.email) {
      const existing = await userRepository.findByEmail(input.email);
      if (existing && existing.id !== id) {
        throw conflict('El email ya está registrado', 'EMAIL_TAKEN');
      }
    }
    if (input.username) {
      const existing = await userRepository.findByUsername(input.username);
      if (existing && existing.id !== id) {
        throw conflict('El nombre de usuario ya está en uso', 'USERNAME_TAKEN');
      }
    }
    return userRepository.update(id, input);
  },

  async changePassword(
    id: string,
    input: { currentPassword: string; newPassword: string },
  ): Promise<void> {
    const record = await userRepository.findByIdWithSecret(id);
    if (!record) throw notFound('Usuario no encontrado', 'USER_NOT_FOUND');

    const valid = await verifyPassword(input.currentPassword, record.passwordHash);
    if (!valid) throw unauthorized('La contraseña actual es incorrecta', 'INVALID_CREDENTIALS');
    if (input.currentPassword === input.newPassword) {
      throw badRequest('La nueva contraseña debe ser distinta de la actual');
    }

    const passwordHash = await hashPassword(input.newPassword);
    await userRepository.update(id, { passwordHash });
    // Invalida todas las sesiones de refresco existentes por seguridad.
    await prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  async deleteAccount(id: string): Promise<void> {
    await userRepository.softDelete(id);
    await prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  // --- Administración ------------------------------------------------------

  async listUsers(params: {
    page: number;
    pageSize: number;
    status?: UserStatus;
    search?: string;
  }) {
    const { page, pageSize } = params;
    const { items, total } = await userRepository.list({
      skip: (page - 1) * pageSize,
      take: pageSize,
      status: params.status,
      search: params.search,
    });
    return { items, total };
  },

  async adminGetUser(id: string): Promise<PublicUser> {
    return this.getById(id);
  },

  async adminUpdateUser(
    id: string,
    input: { role?: UserRole; status?: UserStatus; plan?: PlanTier },
  ): Promise<PublicUser> {
    await this.getById(id); // asegura existencia
    const updated = await userRepository.update(id, input);
    // Si se suspende o elimina, revocar sus sesiones.
    if (input.status && input.status !== 'active') {
      await prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return updated;
  },

  async adminDeleteUser(id: string): Promise<PublicUser> {
    await this.getById(id); // asegura existencia
    const deleted = await userRepository.softDelete(id);
    await prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return deleted;
  },
};
