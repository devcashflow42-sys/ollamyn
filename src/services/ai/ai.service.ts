import type { AiModel } from '@prisma/client';
import type { AIProvider } from './provider.interface';
import type { AIRequest, AIResponse, AIStreamChunk, ChatMessage } from '../../types';
import { getProvider } from './provider.registry';
import { AppError, providerError } from '../../utils/errors';
import { estimateMessagesTokens, estimateTokens } from '../../utils/tokens';

/**
 * AIService: única puerta de entrada a los proveedores de IA.
 *
 * Decide qué proveedor usar a partir del modelo público solicitado (ollamyn-*)
 * consultando el campo interno `provider` del catálogo. El controlador nunca
 * conoce ni depende de un proveedor concreto: la configuración se cambia en la
 * base de datos/servidor sin tocar las apps Android o web.
 */
export const aiService = {
  resolveProvider(model: AiModel): AIProvider {
    const provider = getProvider(model.provider);
    if (!provider) {
      throw new AppError(
        502,
        'PROVIDER_NOT_CONFIGURED',
        `No hay proveedor registrado para '${model.provider}'`,
      );
    }
    if (!provider.isConfigured()) {
      throw new AppError(
        502,
        'PROVIDER_NOT_CONFIGURED',
        `El proveedor del modelo '${model.slug}' no está configurado en el servidor`,
      );
    }
    return provider;
  },

  buildRequest(
    model: AiModel,
    messages: ChatMessage[],
    signal?: AbortSignal,
  ): AIRequest {
    const config = (model.config as Record<string, unknown> | null) ?? {};
    return {
      providerModel: model.providerModel,
      messages,
      temperature: typeof config.temperature === 'number' ? config.temperature : undefined,
      maxTokens: typeof config.maxTokens === 'number' ? config.maxTokens : undefined,
      signal,
    };
  },

  async generate(
    model: AiModel,
    messages: ChatMessage[],
    signal?: AbortSignal,
  ): Promise<AIResponse> {
    const provider = this.resolveProvider(model);
    const request = this.buildRequest(model, messages, signal);
    const result = await provider.generate(request);
    return this.ensureUsage(result, messages);
  },

  async *stream(
    model: AiModel,
    messages: ChatMessage[],
    signal?: AbortSignal,
  ): AsyncIterable<AIStreamChunk> {
    const provider = this.resolveProvider(model);
    const request = this.buildRequest(model, messages, signal);
    try {
      yield* provider.stream(request);
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw providerError('Fallo durante el streaming del proveedor de IA');
    }
  },

  /** Si el proveedor no devolvió consumo real, lo estima para no perder registro. */
  ensureUsage(response: AIResponse, messages: ChatMessage[]): AIResponse {
    return {
      content: response.content,
      inputTokens: response.inputTokens || estimateMessagesTokens(messages),
      outputTokens: response.outputTokens || estimateTokens(response.content),
    };
  },
};
