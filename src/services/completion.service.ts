import type { AiModel, Chat, UsageStatus } from '@prisma/client';
import { chatRepository } from '../repositories/chat.repository';
import { messageRepository } from '../repositories/message.repository';
import { usageRepository } from '../repositories/usage.repository';
import { modelService } from './model.service';
import { chatService } from './chat.service';
import { aiService } from './ai/ai.service';
import type { ChatMessage } from '../types';

const DEFAULT_SYSTEM_PROMPT =
  'Eres un asistente de ollamyn. Responde de forma clara, útil y segura.';

const MAX_CONTEXT_MESSAGES = 20;

export interface PreparedCompletion {
  chat: Chat;
  model: AiModel;
  contextMessages: ChatMessage[];
}

export const completionService = {
  /**
   * Prepara una solicitud de completion:
   *  - valida que el modelo exista y esté habilitado,
   *  - resuelve o crea el chat (garantizando propiedad),
   *  - guarda el mensaje del usuario,
   *  - construye el contexto de conversación para el proveedor.
   */
  async prepare(
    userId: string,
    input: { chatId?: string; model: string; message: string },
  ): Promise<PreparedCompletion> {
    const model = await modelService.getEnabledInternal(input.model);

    // Verifica que el proveedor esté disponible ANTES de crear el chat o
    // persistir el mensaje del usuario, para no dejar registros huérfanos si
    // el proveedor no está configurado en el servidor.
    aiService.resolveProvider(model);

    let chat: Chat;
    if (input.chatId) {
      chat = await chatService.getOwnedOrThrow(input.chatId, userId);
    } else {
      chat = await chatRepository.create({
        userId,
        title: input.message.slice(0, 60) || 'Nuevo chat',
        modelId: model.id,
      });
    }

    // Persistir el mensaje del usuario antes de llamar al proveedor.
    await messageRepository.create({
      chatId: chat.id,
      userId,
      role: 'user',
      content: input.message,
      modelId: model.id,
    });

    const history = await messageRepository.recentContext(chat.id, MAX_CONTEXT_MESSAGES);
    const contextMessages: ChatMessage[] = [
      { role: 'system', content: DEFAULT_SYSTEM_PROMPT },
      ...history.map((m) => ({
        role: m.role as ChatMessage['role'],
        content: m.content,
      })),
    ];

    return { chat, model, contextMessages };
  },

  /** Guarda la respuesta del asistente y registra el consumo. */
  async persistAssistant(params: {
    chat: Chat;
    model: AiModel;
    userId: string;
    content: string;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
    status: UsageStatus;
  }): Promise<void> {
    const { chat, model, userId, content, inputTokens, outputTokens, latencyMs, status } = params;

    if (content) {
      await messageRepository.create({
        chatId: chat.id,
        userId,
        role: 'assistant',
        content,
        modelId: model.id,
        inputTokens,
        outputTokens,
        latencyMs,
      });
    }

    await usageRepository.record({
      userId,
      modelId: model.id,
      chatId: chat.id,
      inputTokens,
      outputTokens,
      latencyMs,
      status,
    });

    await chatRepository.touch(chat.id);
  },

  /** Registra un intento fallido/cancelado sin respuesta persistida. */
  async recordFailure(params: {
    chat?: Chat;
    model: AiModel;
    userId: string;
    latencyMs: number;
    status: Extract<UsageStatus, 'error' | 'timeout' | 'canceled'>;
  }): Promise<void> {
    await usageRepository.record({
      userId: params.userId,
      modelId: params.model.id,
      chatId: params.chat?.id ?? null,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: params.latencyMs,
      status: params.status,
    });
  },
};
