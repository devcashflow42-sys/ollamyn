import type { AIResponse, AIStreamChunk, ChatMessage, Env, ModelRow } from './types';
import { ApiError, providerError } from './errors';

// --- Estimación de tokens (cuando el proveedor no reporta consumo) -----------
export function estimateTokens(text: string): number {
  return text ? Math.max(1, Math.ceil(text.length / 4)) : 0;
}
export function estimateMessagesTokens(msgs: ChatMessage[]): number {
  return msgs.reduce((t, m) => t + estimateTokens(m.content) + 4, 0);
}

interface Target {
  kind: 'openai' | 'anthropic' | 'google' | 'echo';
  baseUrl: string;
  apiKey: string;
  anthropicVersion?: string;
}

interface Req {
  providerModel: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

function notConfigured(slug: string): ApiError {
  return new ApiError(
    502,
    'PROVIDER_NOT_CONFIGURED',
    `El proveedor del modelo '${slug}' no está configurado en el servidor`,
  );
}

/** Decide y valida el proveedor real a partir del catálogo. */
export function resolveTarget(env: Env, model: ModelRow): Target {
  switch (model.provider) {
    case 'openai':
      if (!env.OPENAI_API_KEY) throw notConfigured(model.slug);
      return { kind: 'openai', baseUrl: env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1', apiKey: env.OPENAI_API_KEY };
    case 'nvidia':
      if (!env.NVIDIA_API_KEY) throw notConfigured(model.slug);
      return { kind: 'openai', baseUrl: env.NVIDIA_BASE_URL ?? 'https://integrate.api.nvidia.com/v1', apiKey: env.NVIDIA_API_KEY };
    case 'anthropic':
      if (!env.ANTHROPIC_API_KEY) throw notConfigured(model.slug);
      return {
        kind: 'anthropic',
        baseUrl: env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com/v1',
        apiKey: env.ANTHROPIC_API_KEY,
        anthropicVersion: env.ANTHROPIC_VERSION ?? '2023-06-01',
      };
    case 'google':
      if (!env.GOOGLE_API_KEY) throw notConfigured(model.slug);
      return { kind: 'google', baseUrl: env.GOOGLE_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta', apiKey: env.GOOGLE_API_KEY };
    case 'local':
      // Backend local real solo si hay una URL pública + clave; si no, modo eco.
      if (env.LOCAL_AI_BASE_URL && env.LOCAL_AI_API_KEY) {
        return { kind: 'openai', baseUrl: env.LOCAL_AI_BASE_URL, apiKey: env.LOCAL_AI_API_KEY };
      }
      return { kind: 'echo', baseUrl: '', apiKey: '' };
    default:
      throw notConfigured(model.slug);
  }
}

function reqFrom(model: ModelRow, messages: ChatMessage[], signal?: AbortSignal): Req {
  const cfg = model.config ?? {};
  return {
    providerModel: model.provider_model,
    messages,
    temperature: typeof cfg.temperature === 'number' ? cfg.temperature : undefined,
    maxTokens: typeof cfg.maxTokens === 'number' ? cfg.maxTokens : undefined,
    signal,
  };
}

// --- API pública -------------------------------------------------------------
export async function aiGenerate(env: Env, model: ModelRow, messages: ChatMessage[], signal?: AbortSignal): Promise<AIResponse> {
  const target = resolveTarget(env, model);
  const req = reqFrom(model, messages, signal);
  switch (target.kind) {
    case 'openai': return openaiGenerate(target, req);
    case 'anthropic': return anthropicGenerate(target, req);
    case 'google': return googleGenerate(target, req);
    case 'echo': return echoGenerate(req);
  }
}

export function aiStream(env: Env, model: ModelRow, messages: ChatMessage[], signal?: AbortSignal): AsyncIterable<AIStreamChunk> {
  const target = resolveTarget(env, model);
  const req = reqFrom(model, messages, signal);
  switch (target.kind) {
    case 'openai': return openaiStream(target, req);
    case 'anthropic': return anthropicStream(target, req);
    case 'google': return googleStream(target, req);
    case 'echo': return echoStream(req);
  }
}

// --- Utilidades de SSE -------------------------------------------------------
async function* sseLines(res: Response): AsyncIterable<string> {
  const reader = res.body!.getReader();
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
        const t = line.trim();
        if (t.startsWith('data:')) yield t.slice(5).trim();
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function extractError(res: Response): Promise<string> {
  try {
    const text = await res.text();
    try {
      const j = JSON.parse(text) as { error?: { message?: string } | string };
      if (typeof j.error === 'string') return j.error;
      if (j.error?.message) return j.error.message;
    } catch { /* no JSON */ }
    return text.slice(0, 300) || `${res.status}`;
  } catch {
    return `${res.status}`;
  }
}

// --- OpenAI-compatible (OpenAI, NVIDIA, local) -------------------------------
function openaiBody(req: Req, stream: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = { model: req.providerModel, messages: req.messages, stream };
  if (typeof req.temperature === 'number') body.temperature = req.temperature;
  if (typeof req.maxTokens === 'number') body.max_tokens = req.maxTokens;
  if (stream) body.stream_options = { include_usage: true };
  return body;
}

async function openaiGenerate(t: Target, req: Req): Promise<AIResponse> {
  const res = await fetch(`${t.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t.apiKey}` },
    body: JSON.stringify(openaiBody(req, false)),
    signal: req.signal,
  });
  if (!res.ok) throw providerError(await extractError(res));
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
  return {
    content: j.choices?.[0]?.message?.content ?? '',
    inputTokens: j.usage?.prompt_tokens ?? 0,
    outputTokens: j.usage?.completion_tokens ?? 0,
  };
}

async function* openaiStream(t: Target, req: Req): AsyncIterable<AIStreamChunk> {
  const res = await fetch(`${t.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t.apiKey}` },
    body: JSON.stringify(openaiBody(req, true)),
    signal: req.signal,
  });
  if (!res.ok || !res.body) throw providerError(await extractError(res));
  for await (const data of sseLines(res)) {
    if (data === '[DONE]') { yield { delta: '', done: true }; return; }
    try {
      const p = JSON.parse(data) as { choices?: { delta?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } | null };
      const delta = p.choices?.[0]?.delta?.content;
      if (delta) yield { delta, done: false };
      if (p.usage) yield { delta: '', done: false, usage: { inputTokens: p.usage.prompt_tokens ?? 0, outputTokens: p.usage.completion_tokens ?? 0 } };
    } catch { /* fragmento incompleto */ }
  }
  yield { delta: '', done: true };
}

// --- Anthropic (Claude) ------------------------------------------------------
function anthropicBody(req: Req, stream: boolean): Record<string, unknown> {
  const systemParts: string[] = [];
  const chat: { role: string; content: string }[] = [];
  for (const m of req.messages) {
    if (m.role === 'system') systemParts.push(m.content);
    else chat.push({ role: m.role, content: m.content });
  }
  const body: Record<string, unknown> = {
    model: req.providerModel,
    messages: chat,
    max_tokens: req.maxTokens ?? 4096,
    stream,
  };
  if (systemParts.length) body.system = systemParts.join('\n\n');
  if (typeof req.temperature === 'number') body.temperature = req.temperature;
  return body;
}

function anthropicHeaders(t: Target): Record<string, string> {
  return { 'Content-Type': 'application/json', 'x-api-key': t.apiKey, 'anthropic-version': t.anthropicVersion ?? '2023-06-01' };
}

async function anthropicGenerate(t: Target, req: Req): Promise<AIResponse> {
  const res = await fetch(`${t.baseUrl.replace(/\/$/, '')}/messages`, {
    method: 'POST', headers: anthropicHeaders(t), body: JSON.stringify(anthropicBody(req, false)), signal: req.signal,
  });
  if (!res.ok) throw providerError(await extractError(res));
  const j = (await res.json()) as { content?: { type: string; text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number } };
  return {
    content: (j.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join(''),
    inputTokens: j.usage?.input_tokens ?? 0,
    outputTokens: j.usage?.output_tokens ?? 0,
  };
}

async function* anthropicStream(t: Target, req: Req): AsyncIterable<AIStreamChunk> {
  const res = await fetch(`${t.baseUrl.replace(/\/$/, '')}/messages`, {
    method: 'POST', headers: anthropicHeaders(t), body: JSON.stringify(anthropicBody(req, true)), signal: req.signal,
  });
  if (!res.ok || !res.body) throw providerError(await extractError(res));
  let inputTokens = 0;
  let outputTokens = 0;
  for await (const data of sseLines(res)) {
    if (!data) continue;
    try {
      const e = JSON.parse(data) as { type: string; delta?: { type?: string; text?: string }; message?: { usage?: { input_tokens?: number } }; usage?: { output_tokens?: number } };
      if (e.type === 'message_start') inputTokens = e.message?.usage?.input_tokens ?? 0;
      else if (e.type === 'content_block_delta' && e.delta?.type === 'text_delta') { if (e.delta.text) yield { delta: e.delta.text, done: false }; }
      else if (e.type === 'message_delta') outputTokens = e.usage?.output_tokens ?? outputTokens;
      else if (e.type === 'message_stop') { yield { delta: '', done: false, usage: { inputTokens, outputTokens } }; yield { delta: '', done: true }; return; }
    } catch { /* fragmento incompleto */ }
  }
  yield { delta: '', done: false, usage: { inputTokens, outputTokens } };
  yield { delta: '', done: true };
}

// --- Google (Gemini) ---------------------------------------------------------
function googleBody(req: Req): Record<string, unknown> {
  const systemParts: string[] = [];
  const contents: { role: string; parts: { text: string }[] }[] = [];
  for (const m of req.messages) {
    if (m.role === 'system') systemParts.push(m.content);
    else contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] });
  }
  const gen: Record<string, unknown> = {};
  if (typeof req.temperature === 'number') gen.temperature = req.temperature;
  if (typeof req.maxTokens === 'number') gen.maxOutputTokens = req.maxTokens;
  return {
    contents,
    ...(systemParts.length ? { system_instruction: { parts: [{ text: systemParts.join('\n\n') }] } } : {}),
    ...(Object.keys(gen).length ? { generationConfig: gen } : {}),
  };
}

async function googleGenerate(t: Target, req: Req): Promise<AIResponse> {
  const url = `${t.baseUrl.replace(/\/$/, '')}/models/${encodeURIComponent(req.providerModel)}:generateContent`;
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': t.apiKey }, body: JSON.stringify(googleBody(req)), signal: req.signal });
  if (!res.ok) throw providerError(await extractError(res));
  const j = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[]; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } };
  return {
    content: (j.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join(''),
    inputTokens: j.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: j.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

async function* googleStream(t: Target, req: Req): AsyncIterable<AIStreamChunk> {
  const url = `${t.baseUrl.replace(/\/$/, '')}/models/${encodeURIComponent(req.providerModel)}:streamGenerateContent?alt=sse`;
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': t.apiKey }, body: JSON.stringify(googleBody(req)), signal: req.signal });
  if (!res.ok || !res.body) throw providerError(await extractError(res));
  let inputTokens = 0;
  let outputTokens = 0;
  for await (const data of sseLines(res)) {
    if (!data) continue;
    try {
      const e = JSON.parse(data) as { candidates?: { content?: { parts?: { text?: string }[] } }[]; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } };
      const text = (e.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
      if (text) yield { delta: text, done: false };
      if (e.usageMetadata) { inputTokens = e.usageMetadata.promptTokenCount ?? inputTokens; outputTokens = e.usageMetadata.candidatesTokenCount ?? outputTokens; }
    } catch { /* fragmento incompleto */ }
  }
  if (inputTokens || outputTokens) yield { delta: '', done: false, usage: { inputTokens, outputTokens } };
  yield { delta: '', done: true };
}

// --- Modo eco (demo sin claves) ---------------------------------------------
function echoText(req: Req): string {
  const lastUser = [...req.messages].reverse().find((m) => m.role === 'user');
  return (
    `👋 Soy el modelo local de ollamyn (modo demostración). No hay un backend de ` +
    `inferencia real configurado. Recibí tu mensaje: "${(lastUser?.content ?? '').slice(0, 400)}". ` +
    `Configura un proveedor real (OpenAI, NVIDIA, Anthropic, Google) con su clave para respuestas de IA.`
  );
}

function echoGenerate(req: Req): AIResponse {
  const content = echoText(req);
  return { content, inputTokens: estimateMessagesTokens(req.messages), outputTokens: estimateTokens(content) };
}

async function* echoStream(req: Req): AsyncIterable<AIStreamChunk> {
  const words = echoText(req).split(' ');
  for (const w of words) {
    if (req.signal?.aborted) return;
    yield { delta: w + ' ', done: false };
    await new Promise((r) => setTimeout(r, 20));
  }
  yield { delta: '', done: true };
}
