import type { AIProvider } from './provider.interface';
import type { AIRequest, AIResponse, AIStreamChunk } from '../../types';
import { providerError } from '../../utils/errors';
import { logger } from '../../config/logger';

interface OpenAICompatibleOptions {
  name: string;
  baseUrl: string;
  apiKey: string;
  /** Algunos backends locales (Ollama) no soportan stream usage. */
  supportsStreamUsage?: boolean;
}

/**
 * Proveedor genérico para cualquier API compatible con OpenAI Chat Completions.
 * Reutilizado por OpenAI, NVIDIA NIM y servidores locales (Ollama, vLLM, TGI),
 * ya que todos comparten el mismo contrato `/chat/completions`.
 */
export class OpenAICompatibleProvider implements AIProvider {
  public readonly name: string;
  protected readonly baseUrl: string;
  protected readonly apiKey: string;
  protected readonly supportsStreamUsage: boolean;

  constructor(opts: OpenAICompatibleOptions) {
    this.name = opts.name;
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.apiKey = opts.apiKey;
    this.supportsStreamUsage = opts.supportsStreamUsage ?? true;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey) || this.baseUrl.includes('localhost') || this.baseUrl.includes('127.0.0.1');
  }

  protected headers(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
    return headers;
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model: request.providerModel,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
        stream: false,
      }),
      signal: request.signal,
    });

    if (!res.ok) {
      await this.throwFromResponse(res);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    return {
      content: json.choices?.[0]?.message?.content ?? '',
      inputTokens: json.usage?.prompt_tokens ?? 0,
      outputTokens: json.usage?.completion_tokens ?? 0,
    };
  }

  async *stream(request: AIRequest): AsyncIterable<AIStreamChunk> {
    const body: Record<string, unknown> = {
      model: request.providerModel,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens,
      stream: true,
    };
    if (this.supportsStreamUsage) {
      body.stream_options = { include_usage: true };
    }

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
      signal: request.signal,
    });

    if (!res.ok || !res.body) {
      await this.throwFromResponse(res);
    }

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
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const data = trimmed.slice('data:'.length).trim();
          if (data === '[DONE]') {
            yield { delta: '', done: true };
            return;
          }
          try {
            const parsed = JSON.parse(data) as {
              choices?: { delta?: { content?: string } }[];
            };
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) yield { delta, done: false };
          } catch {
            // Fragmento SSE incompleto: se ignora y se reintenta con el buffer
          }
        }
      }
      yield { delta: '', done: true };
    } finally {
      reader.releaseLock();
    }
  }

  private async throwFromResponse(res: Response): Promise<never> {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const text = await res.text();
      detail = text.slice(0, 500);
    } catch {
      // ignorar
    }
    logger.error({ provider: this.name, status: res.status, detail }, 'Error del proveedor de IA');
    throw providerError(`El proveedor de IA (${this.name}) devolvió un error`, {
      status: res.status,
    });
  }
}
