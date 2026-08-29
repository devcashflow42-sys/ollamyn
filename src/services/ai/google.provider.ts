import type { AIProvider } from './provider.interface';
import type { AIRequest, AIResponse, AIStreamChunk, ChatMessage } from '../../types';
import { env } from '../../config/env';
import { providerError } from '../../utils/errors';
import { logger } from '../../config/logger';

interface GeminiContent {
  role: 'user' | 'model';
  parts: { text: string }[];
}

/**
 * Proveedor Google Gemini (generateContent API).
 * Usa roles user/model, extrae el system a `system_instruction` y envía la
 * clave por cabecera `x-goog-api-key` (nunca en la URL, para no filtrarla).
 */
export class GoogleProvider implements AIProvider {
  public readonly name = 'google';
  private readonly baseUrl = env.GOOGLE_BASE_URL.replace(/\/$/, '');

  isConfigured(): boolean {
    return Boolean(env.GOOGLE_API_KEY);
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-goog-api-key': env.GOOGLE_API_KEY,
    };
  }

  private buildBody(request: AIRequest) {
    const systemParts: string[] = [];
    const contents: GeminiContent[] = [];
    for (const m of request.messages as ChatMessage[]) {
      if (m.role === 'system') {
        systemParts.push(m.content);
      } else {
        contents.push({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        });
      }
    }
    return {
      contents,
      ...(systemParts.length
        ? { system_instruction: { parts: [{ text: systemParts.join('\n\n') }] } }
        : {}),
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        ...(request.maxTokens ? { maxOutputTokens: request.maxTokens } : {}),
      },
    };
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    const url = `${this.baseUrl}/models/${encodeURIComponent(request.providerModel)}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(this.buildBody(request)),
      signal: request.signal,
    });
    if (!res.ok) await this.fail(res);

    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    const content = (json.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? '')
      .join('');

    return {
      content,
      inputTokens: json.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: json.usageMetadata?.candidatesTokenCount ?? 0,
    };
  }

  async *stream(request: AIRequest): AsyncIterable<AIStreamChunk> {
    const url = `${this.baseUrl}/models/${encodeURIComponent(request.providerModel)}:streamGenerateContent?alt=sse`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(this.buildBody(request)),
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
              candidates?: { content?: { parts?: { text?: string }[] } }[];
            };
            const text = (evt.candidates?.[0]?.content?.parts ?? [])
              .map((p) => p.text ?? '')
              .join('');
            if (text) yield { delta: text, done: false };
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
    logger.error({ provider: this.name, status: res.status, detail }, 'Error del proveedor Google');
    throw providerError('El proveedor de IA (google) devolvió un error', { status: res.status });
  }
}
