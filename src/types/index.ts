import type { UserRole, UserStatus, PlanTier } from '@prisma/client';

/** Payload que viaja dentro del JWT de acceso. */
export interface AccessTokenPayload {
  sub: string; // user id
  role: UserRole;
  plan: PlanTier;
  type: 'access';
}

/** Payload que viaja dentro del JWT de refresco. */
export interface RefreshTokenPayload {
  sub: string;
  jti: string; // id único del token, para revocación
  type: 'refresh';
}

/** Usuario autenticado adjuntado a `req.user` por el middleware de auth. */
export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  status: UserStatus;
  plan: PlanTier;
}

/** Mensaje normalizado que se envía a cualquier proveedor de IA. */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Solicitud normalizada hacia un proveedor de IA. */
export interface AIRequest {
  providerModel: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Señal para cancelar la generación si el cliente aborta la conexión. */
  signal?: AbortSignal;
}

/** Consumo de tokens reportado por un proveedor. */
export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
}

/** Fragmento emitido durante el streaming de una respuesta de IA. */
export interface AIStreamChunk {
  delta: string;
  done: boolean;
  /** Presente cuando el proveedor reporta consumo real (p. ej. chunk final). */
  usage?: AIUsage;
}

/** Respuesta completa (no streaming) de un proveedor de IA. */
export interface AIResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

export type { UserRole, UserStatus, PlanTier };
