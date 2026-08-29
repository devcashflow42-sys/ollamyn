import type { NeonQueryFunction } from '@neondatabase/serverless';
import type { AuthUser, ChatMessage, Env, ModelRow } from './types';
import { notFound, rateLimited } from './errors';
import { resolveTarget } from './ai';

type Sql = NeonQueryFunction<false, false>;

const SYSTEM_PROMPT = 'Eres un asistente de ollamyn. Responde de forma clara, útil y segura.';
const MAX_CONTEXT = 20;

/** Modelo habilitado (con datos internos del proveedor) o 404. */
export async function getEnabledModel(sql: Sql, slug: string): Promise<ModelRow> {
  const rows = (await sql`SELECT * FROM ai_models WHERE slug = ${slug} AND enabled = true`) as ModelRow[];
  if (!rows[0]) throw notFound('El modelo solicitado no existe o no está disponible', 'MODEL_NOT_FOUND');
  return rows[0];
}

/** Límite de uso de IA por hora según el plan (contando ai_usage). */
export async function enforceAiRateLimit(sql: Sql, env: Env, user: AuthUser): Promise<void> {
  const max =
    user.plan === 'premium'
      ? Number.parseInt(env.RATE_LIMIT_AI_PREMIUM_MAX ?? '500', 10)
      : Number.parseInt(env.RATE_LIMIT_AI_FREE_MAX ?? '20', 10);
  const rows = (await sql`
    SELECT count(*)::int AS c FROM ai_usage
    WHERE user_id = ${user.id} AND created_at > now() - interval '1 hour'
  `) as { c: number }[];
  if ((rows[0]?.c ?? 0) >= max) throw rateLimited();
}

export interface Prepared {
  chat: Record<string, unknown> & { id: string };
  model: ModelRow;
  contextMessages: ChatMessage[];
}

/**
 * Valida modelo + proveedor, resuelve/crea el chat, guarda el mensaje del
 * usuario y construye el contexto. Verifica el proveedor ANTES de persistir
 * para no dejar chats huérfanos si no está configurado.
 */
export async function prepareCompletion(
  sql: Sql,
  env: Env,
  userId: string,
  input: { chatId?: string; model: string; message: string },
): Promise<Prepared> {
  const model = await getEnabledModel(sql, input.model);
  resolveTarget(env, model); // lanza 502 si el proveedor no está configurado

  let chat: Record<string, unknown> & { id: string };
  if (input.chatId) {
    const rows = (await sql`SELECT * FROM chats WHERE id = ${input.chatId} AND user_id = ${userId}`) as (Record<string, unknown> & { id: string })[];
    if (!rows[0]) throw notFound('Chat no encontrado', 'CHAT_NOT_FOUND');
    chat = rows[0];
  } else {
    const title = input.message.slice(0, 60) || 'Nuevo chat';
    const rows = (await sql`
      INSERT INTO chats (user_id, title, model_id) VALUES (${userId}, ${title}, ${model.id}) RETURNING *
    `) as (Record<string, unknown> & { id: string })[];
    chat = rows[0];
  }

  await sql`
    INSERT INTO messages (chat_id, user_id, role, content, model_id)
    VALUES (${chat.id}, ${userId}, 'user', ${input.message}, ${model.id})
  `;

  const history = (await sql`
    SELECT role, content FROM (
      SELECT role, content, created_at FROM messages
      WHERE chat_id = ${chat.id} ORDER BY created_at DESC LIMIT ${MAX_CONTEXT}
    ) t ORDER BY created_at ASC
  `) as { role: ChatMessage['role']; content: string }[];

  const contextMessages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];

  return { chat, model, contextMessages };
}

export async function persistAssistant(
  sql: Sql,
  params: {
    chatId: string;
    userId: string;
    modelId: string;
    content: string;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
    status: 'success' | 'canceled';
  },
): Promise<void> {
  const { chatId, userId, modelId, content, inputTokens, outputTokens, latencyMs, status } = params;
  if (content) {
    await sql`
      INSERT INTO messages (chat_id, user_id, role, content, model_id, input_tokens, output_tokens, latency_ms)
      VALUES (${chatId}, ${userId}, 'assistant', ${content}, ${modelId}, ${inputTokens}, ${outputTokens}, ${latencyMs})
    `;
  }
  await sql`
    INSERT INTO ai_usage (user_id, model_id, chat_id, input_tokens, output_tokens, total_tokens, latency_ms, status)
    VALUES (${userId}, ${modelId}, ${chatId}, ${inputTokens}, ${outputTokens}, ${inputTokens + outputTokens}, ${latencyMs}, ${status})
  `;
  await sql`UPDATE chats SET updated_at = now() WHERE id = ${chatId}`;
}

export async function recordFailure(
  sql: Sql,
  params: { userId: string; modelId: string; chatId: string | null; latencyMs: number; status: 'error' | 'timeout' | 'canceled' },
): Promise<void> {
  await sql`
    INSERT INTO ai_usage (user_id, model_id, chat_id, input_tokens, output_tokens, total_tokens, latency_ms, status)
    VALUES (${params.userId}, ${params.modelId}, ${params.chatId}, 0, 0, 0, ${params.latencyMs}, ${params.status})
  `;
}
