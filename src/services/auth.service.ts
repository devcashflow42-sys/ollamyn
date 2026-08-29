import crypto from 'node:crypto';
import { prisma } from '../config/database';
import { userRepository, type PublicUser } from '../repositories/user.repository';
import { hashPassword, verifyPassword } from '../utils/password';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  durationToMs,
} from '../utils/jwt';
import { env } from '../config/env';
import { AppError, conflict, unauthorized } from '../utils/errors';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface AuthResult {
  user: PublicUser;
  tokens: AuthTokens;
}

interface RequestMeta {
  userAgent?: string;
  ip?: string;
}

async function issueTokens(
  user: { id: string; role: PublicUser['role']; plan: PublicUser['plan'] },
  meta: RequestMeta,
): Promise<AuthTokens> {
  const jti = crypto.randomUUID();
  const accessToken = signAccessToken({ sub: user.id, role: user.role, plan: user.plan });
  const refreshToken = signRefreshToken({ sub: user.id, jti });

  await prisma.refreshToken.create({
    data: {
      id: jti,
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + durationToMs(env.JWT_REFRESH_EXPIRES_IN)),
      userAgent: meta.userAgent?.slice(0, 255),
      ip: meta.ip?.slice(0, 64),
    },
  });

  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: Math.floor(durationToMs(env.JWT_ACCESS_EXPIRES_IN) / 1000),
  };
}

export const authService = {
  async register(
    input: { username: string; email: string; password: string },
    meta: RequestMeta,
  ): Promise<AuthResult> {
    const [emailTaken, usernameTaken] = await Promise.all([
      userRepository.findByEmail(input.email),
      userRepository.findByUsername(input.username),
    ]);
    if (emailTaken) throw conflict('El email ya está registrado', 'EMAIL_TAKEN');
    if (usernameTaken) throw conflict('El nombre de usuario ya está en uso', 'USERNAME_TAKEN');

    const passwordHash = await hashPassword(input.password);
    const user = await userRepository.create({
      username: input.username,
      email: input.email,
      passwordHash,
    });

    const tokens = await issueTokens(user, meta);
    return { user, tokens };
  },

  async login(
    input: { email: string; password: string },
    meta: RequestMeta,
  ): Promise<AuthResult> {
    const record = await userRepository.findByEmailWithSecret(input.email);
    // Mensaje genérico para no revelar si el email existe.
    if (!record) throw unauthorized('Credenciales inválidas', 'INVALID_CREDENTIALS');

    const valid = await verifyPassword(input.password, record.passwordHash);
    if (!valid) throw unauthorized('Credenciales inválidas', 'INVALID_CREDENTIALS');

    if (record.status === 'deleted') {
      throw unauthorized('Credenciales inválidas', 'INVALID_CREDENTIALS');
    }
    if (record.status === 'suspended') {
      throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Tu cuenta está suspendida');
    }

    const { passwordHash: _omit, ...user } = record;
    const tokens = await issueTokens(record, meta);
    return { user, tokens };
  },

  /** Rotación segura del refresh token: revoca el usado y emite uno nuevo. */
  async refresh(refreshToken: string, meta: RequestMeta): Promise<AuthTokens> {
    const payload = verifyRefreshToken(refreshToken);
    const tokenHash = hashToken(refreshToken);

    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw unauthorized('Token de refresco inválido o expirado', 'TOKEN_INVALID');
    }
    if (stored.userId !== payload.sub) {
      throw unauthorized('Token de refresco inválido', 'TOKEN_INVALID');
    }

    const user = await userRepository.findById(payload.sub);
    if (!user || user.status !== 'active') {
      throw unauthorized('Usuario no disponible', 'UNAUTHORIZED');
    }

    // Rotación: revocar el token usado y emitir uno nuevo.
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return issueTokens(user, meta);
  },

  /** Revoca un refresh token concreto (logout). */
  async logout(refreshToken: string): Promise<void> {
    try {
      const tokenHash = hashToken(refreshToken);
      await prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch {
      // logout idempotente: nunca falla
    }
  },
};
