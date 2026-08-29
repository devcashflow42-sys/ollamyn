import type { AIProvider } from './provider.interface';
import type { AIRequest, AIResponse, AIStreamChunk, ChatMessage } from '../../types';
import { env } from '../../config/env';
import { providerError } from '../../utils/errors';
import { logger } from '../../config/logger';
import { withTimeout } from '../../utils/signals';
import { extractProviderError } from './openai-compatible.provider';

const DEFAULT_MAX_TOKENS = 4096;

/**
 * Proveedor Anthropic Claude (Messages API).
 * A diferencia de OpenAI, los mensajes `system` se extraen a un campo aparte y
 * `max_tokens` es obligatorio. Importante: los modelos actuales (Claude Opus 5,
 * Sonnet 5, Opus 4.8...) rechazan `temperature` con error 400, por lo que solo
 * se envía cuando el modelo lo define explícitamente en su `config`.
 */
export class AnthropicProvider implements AIProvider {
  public readonly name = 'anthropic';
  private readonly baseUrl = env.ANTHROPIC_BASE_URL.replace(/\/$/, '');

  isConfigured(): boolean {
    return Boolean(env.ANTHROPIC_API_KEY);
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': env.ANTHROPIC_VERSION,
    };
  }

  private splitMessages(messages: ChatMessage[]): {
    system: string | undefined;
    chat: { role: 'user' | 'assistant'; content: string }[];
  } {
    const systemParts: string[] = [];
    const chat: { role: 'user' | 'assistant'; content: string }[] = [];
    for (const m of messages) {
      if (m.role === 'system') {
        systemParts.push(m.content);
      } else {
        chat.push({ role: m.role, content: m.content });
      }
    }
    return {
      system: systemParts.length ? systemParts.join('\n\n') : undefined,
      chat,
    };
  }

  private buildBody(request: AIRequest, stream: boolean): Record<string, unknown> {
    const { system, chat } = this.splitMessages(request.messages);
    const body: Record<string, unknown> = {
      model: request.providerModel,
      messages: chat,
      max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
      stream,
    };
    if (system) body.system = system;
    if (typeof request.temperature === 'number') body.temperature = request.temperature;
    return body;
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    const res = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(this.buildBody(request, false)),
      signal: withTimeout(request.signal, env.AI_REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) await this.fail(res);

    const json = (await res.json()) as {
      content?: { type: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const content = (json.content ?? [])
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('');

    return {
      content,
      inputTokens: json.usage?.input_tokens ?? 0,
      outputTokens: json.usage?.output_tokens ?? 0,
    };
  }

  async *stream(request: AIRequest): AsyncIterable<AIStreamChunk> {
    const res = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(this.buildBody(request, true)),
      signal: request.signal,
    });

    if (!res.ok || !res.body) await this.fail(res);

    const reader = (res.body as ReadableStream<Uint8Array>).getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice('data:'.length).trim();
          if (!data) continue;
          try {
            const evt = JSON.parse(data) as {
              type: string;
              delta?: { type?: string; text?: string };
              message?: { usage?: { input_tokens?: number } };
              usage?: { output_tokens?: number };
            };
            if (evt.type === 'message_start') {
              inputTokens = evt.message?.usage?.input_tokens ?? 0;
            } else if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
              if (evt.delta.text) yield { delta: evt.delta.text, done: false };
            } else if (evt.type === 'message_delta') {
              outputTokens = evt.usage?.output_tokens ?? outputTokens;
            } else if (evt.type === 'message_stop') {
              yield { delta: '', done: false, usage: { inputTokens, outputTokens } };
              yield { delta: '', done: true };
              return;
            }
          } catch {
            // fragmento incompleto
          }
        }
      }
      yield { delta: '', done: false, usage: { inputTokens, outputTokens } };
      yield { delta: '', done: true };
    } finally {
      reader.releaseLock();
    }
  }

  private async fail(res: Response): Promise<never> {
    const detail = await extractProviderError(res);
    logger.error({ provider: this.name, status: res.status, detail }, 'Error del proveedor Anthropic');
    throw providerError('El proveedor de IA (anthropic) devolvió un error', { status: res.status });
  }
}
