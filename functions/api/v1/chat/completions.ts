import type { Env } from '../../../_lib/types';
import { getDb } from '../../../_lib/db';
import { ok, readJson } from '../../../_lib/response';
import { requireUser } from '../../../_lib/auth';
import { completionSchema, parse } from '../../../_lib/validation';
import {
  enforceAiRateLimit,
  prepareCompletion,
  persistAssistant,
  recordFailure,
} from '../../../_lib/completion';
import { aiGenerate, aiStream, estimateMessagesTokens, estimateTokens } from '../../../_lib/ai';

/**
 * POST /api/v1/chat/completions
 * Autentica, aplica límite de uso, prepara el contexto, selecciona el proveedor
 * y genera la respuesta (JSON o streaming SSE), persistiendo mensajes y consumo.
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const authed = await requireUser(env, request);
  const body = parse(completionSchema, await readJson(request));
  const sql = getDb(env);

  await enforceAiRateLimit(sql, env, authed);

  const { chat, model, contextMessages } = await prepareCompletion(sql, env, authed.id, {
    chatId: body.chatId,
    model: body.model,
    message: body.message,
  });
  const startedAt = Date.now();

  // --- No streaming ---------------------------------------------------------
  if (!body.stream) {
    try {
      const result = await aiGenerate(env, model, contextMessages);
      const latencyMs = Date.now() - startedAt;
      const inputTokens = result.inputTokens || estimateMessagesTokens(contextMessages);
      const outputTokens = result.outputTokens || estimateTokens(result.content);

      await persistAssistant(sql, {
        chatId: chat.id, userId: authed.id, modelId: model.id,
        content: result.content, inputTokens, outputTokens, latencyMs, status: 'success',
      });

      return ok({
        chatId: chat.id,
        model: model.slug,
        message: { role: 'assistant', content: result.content },
        usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens, latencyMs },
      });
    } catch (err) {
      await recordFailure(sql, { userId: authed.id, modelId: model.id, chatId: chat.id, latencyMs: Date.now() - startedAt, status: 'error' });
      throw err;
    }
  }

  // --- Streaming (SSE) ------------------------------------------------------
  const encoder = new TextEncoder();
  const ac = new AbortController();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`)); } catch { /* cerrado */ }
      };
      send({ type: 'meta', chatId: chat.id, model: model.slug });

      let full = '';
      let reported: { inputTokens: number; outputTokens: number } | undefined;
      try {
        for await (const chunk of aiStream(env, model, contextMessages, ac.signal)) {
          if (chunk.delta) { full += chunk.delta; send({ type: 'delta', delta: chunk.delta }); }
          if (chunk.usage) reported = chunk.usage;
          if (chunk.done) break;
        }

        const latencyMs = Date.now() - startedAt;
        const inputTokens = reported?.inputTokens || estimateMessagesTokens(contextMessages);
        const outputTokens = reported?.outputTokens || estimateTokens(full);

        await persistAssistant(sql, {
          chatId: chat.id, userId: authed.id, modelId: model.id,
          content: full, inputTokens, outputTokens, latencyMs, status: 'success',
        });

        send({ type: 'done', chatId: chat.id, usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens, latencyMs } });
        try { controller.enqueue(encoder.encode('data: [DONE]\n\n')); } catch { /* cerrado */ }
        controller.close();
      } catch (err) {
        const canceled = ac.signal.aborted;
        const latencyMs = Date.now() - startedAt;
        // Persistencia garantizada aunque el cliente haya cerrado la conexión.
        context.waitUntil(
          (async () => {
            if (canceled && full) {
              await persistAssistant(sql, {
                chatId: chat.id, userId: authed.id, modelId: model.id,
                content: full, inputTokens: reported?.inputTokens || estimateMessagesTokens(contextMessages),
                outputTokens: reported?.outputTokens || estimateTokens(full), latencyMs, status: 'canceled',
              });
            } else {
              await recordFailure(sql, { userId: authed.id, modelId: model.id, chatId: chat.id, latencyMs, status: canceled ? 'canceled' : 'error' });
            }
          })(),
        );
        if (!canceled) {
          console.error('Error en streaming de IA:', err);
          send({ type: 'error', error: { code: 'PROVIDER_ERROR', message: 'Error al generar la respuesta' } });
        }
        try { controller.close(); } catch { /* ya cerrado */ }
      }
    },
    cancel() {
      ac.abort();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
};
