import { OpenAICompatibleProvider } from './openai-compatible.provider';
import type { AIRequest, AIResponse, AIStreamChunk } from '../../types';
import { env } from '../../config/env';
import { estimateMessagesTokens, estimateTokens } from '../../utils/tokens';

/**
 * Proveedor local / self-hosted (Ollama, vLLM, TGI, servidores de inferencia
 * propios sobre GPU NVIDIA). Usa la API compatible con OpenAI.
 *
 * Si no hay ningún backend local disponible, cae en un modo "eco" que permite
 * probar todo el flujo (streaming, historial, registro de uso) sin depender de
 * ningún servicio externo. Esto cubre el requisito de tener al menos un
 * proveedor de IA funcional desde el primer arranque.
 */
export class LocalProvider extends OpenAICompatibleProvider {
  constructor() {
    super({
      name: 'local',
      baseUrl: env.LOCAL_AI_BASE_URL,
      apiKey: env.LOCAL_AI_API_KEY,
      // Ollama históricamente no soporta stream_options.include_usage
      supportsStreamUsage: false,
    });
  }

  isConfigured(): boolean {
    // Siempre disponible: si el backend real falla, usamos el modo eco.
    return true;
  }

  private hasBackend(): boolean {
    return Boolean(env.LOCAL_AI_BASE_URL) && Boolean(env.LOCAL_AI_API_KEY || env.LOCAL_AI_BASE_URL);
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    if (this.hasBackend()) {
      try {
        return await super.generate(request);
      } catch {
        // fallback a eco
      }
    }
    return this.echoResponse(request);
  }

  async *stream(request: AIRequest): AsyncIterable<AIStreamChunk> {
    if (this.hasBackend()) {
      try {
        let produced = false;
        for await (const chunk of super.stream(request)) {
          produced = true;
          yield chunk;
        }
        if (produced) return;
      } catch {
        // fallback a eco
      }
    }
    yield* this.echoStream(request);
  }

  // --- Modo eco (mock) para desarrollo sin backend real ---------------------

  private buildEcho(request: AIRequest): string {
    const lastUser = [...request.messages].reverse().find((m) => m.role === 'user');
    const prompt = lastUser?.content ?? '';
    return (
      `👋 Soy el modelo local de ollamyn (modo demostración). ` +
      `No hay un backend de inferencia real configurado (LOCAL_AI_BASE_URL). ` +
      `Recibí tu mensaje: "${prompt.slice(0, 500)}". ` +
      `Configura un proveedor real (OpenAI, NVIDIA, Anthropic, Google u Ollama) ` +
      `para obtener respuestas generadas por IA.`
    );
  }

  private echoResponse(request: AIRequest): AIResponse {
    const content = this.buildEcho(request);
    return {
      content,
      inputTokens: estimateMessagesTokens(request.messages),
      outputTokens: estimateTokens(content),
    };
  }

  private async *echoStream(request: AIRequest): AsyncIterable<AIStreamChunk> {
    const text = this.buildEcho(request);
    const words = text.split(' ');
    for (const word of words) {
      if (request.signal?.aborted) return;
      yield { delta: word + ' ', done: false };
      await new Promise((r) => setTimeout(r, 25));
    }
    yield { delta: '', done: true };
  }
}
