import type { AIProvider } from './provider.interface';
import type { AIRequest, AIResponse, AIStreamChunk, ChatMessage } from '../../types';
import { env } from '../../config/env';
import { providerError } from '../../utils/errors';
import { logger } from '../../config/logger';

/**
 * Proveedor Anthropic Claude (Messages API).
 * A diferencia de OpenAI, los mensajes `system` se extraen a un campo aparte
 * y solo se admiten roles user/assistant en la lista de mensajes.
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

  async generate(request: AIRequest): Promise<AIResponse> {
    const { system, chat } = this.splitMessages(request.messages);
    const res = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model: request.providerModel,
        system,
        messages: chat,
        max_tokens: request.maxTokens ?? 1024,
        temperature: request.temperature ?? 0.7,
        stream: false,
      }),
      signal: request.signal,
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
    const { system, chat } = this.splitMessages(request.messages);
    const res = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model: request.providerModel,
        system,
        messages: chat,
        max_tokens: request.maxTokens ?? 1024,
        temperature: request.temperature ?? 0.7,
        stream: true,
      }),
      signal: request.signal,
    });

    if (!res.ok || !res.body) await this.fail(res);

    const reader = (res.body as ReadableStream<Uint8Array>).getReader();
    const decoder = new TextDecoder();
    let buffer = '';

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
            };
            if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
              if (evt.delta.text) yield { delta: evt.delta.text, done: false };
            } else if (evt.type === 'message_stop') {
              yield { delta: '', done: true };
              return;
            }
          } catch {
            // fragmento incompleto
          }
        }
      }
      yield { delta: '', done: true };
    } finally {
      reader.releaseLock();
    }
  }

  private async fail(res: Response): Promise<never> {
    let detail = `${res.status} ${res.statusText}`;
    try {
      detail = (await res.text()).slice(0, 500);
    } catch {
      // ignore
    }
    logger.error({ provider: this.name, status: res.status, detail }, 'Error del proveedor Anthropic');
    throw providerError('El proveedor de IA (anthropic) devolvió un error', { status: res.status });
  }
}
