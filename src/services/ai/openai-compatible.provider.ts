import type { AIProvider } from './provider.interface';
import type { AIRequest, AIResponse, AIStreamChunk } from '../../types';
import { providerError } from '../../utils/errors';
import { logger } from '../../config/logger';
import { env } from '../../config/env';
import { withTimeout } from '../../utils/signals';

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
 *
 * Los parámetros de muestreo (temperature, max_tokens) solo se envían cuando el
 * modelo los define en su `config`: los modelos de razonamiento más recientes
 * (p. ej. la familia GPT-5) rechazan `temperature` con un error 400.
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

  protected buildBody(request: AIRequest, stream: boolean): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: request.providerModel,
      messages: request.messages,
      stream,
    };
    if (typeof request.temperature === 'number') body.temperature = request.temperature;
    if (typeof request.maxTokens === 'number') body.max_tokens = request.maxTokens;
    if (stream && this.supportsStreamUsage) {
      body.stream_options = { include_usage: true };
    }
    return body;
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(this.buildBody(request, false)),
      signal: withTimeout(request.signal, env.AI_REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) await this.throwFromResponse(res);

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
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(this.buildBody(request, true)),
      signal: request.signal,
    });

    if (!res.ok || !res.body) await this.throwFromResponse(res);

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
              usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
            };
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) yield { delta, done: false };
            // El chunk final de OpenAI/NVIDIA trae el consumo real de tokens.
            if (parsed.usage) {
              yield {
                delta: '',
                done: false,
                usage: {
                  inputTokens: parsed.usage.prompt_tokens ?? 0,
                  outputTokens: parsed.usage.completion_tokens ?? 0,
                },
              };
            }
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
    const message = await extractProviderError(res);
    logger.error({ provider: this.name, status: res.status, detail: message }, 'Error del proveedor de IA');
    throw providerError(`El proveedor de IA (${this.name}) devolvió un error`, { status: res.status });
  }
}

/** Extrae un mensaje de error legible del cuerpo de una respuesta de proveedor. */
export async function extractProviderError(res: Response): Promise<string> {
  try {
    const text = await res.text();
    try {
      const json = JSON.parse(text) as { error?: { message?: string } | string };
      if (typeof json.error === 'string') return json.error;
      if (json.error?.message) return json.error.message;
    } catch {
      // no era JSON
    }
    return text.slice(0, 500) || `${res.status} ${res.statusText}`;
  } catch {
    return `${res.status} ${res.statusText}`;
  }
}
