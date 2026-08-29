import type { Request, Response } from 'express';
import { completionService } from '../services/completion.service';
import { aiService } from '../services/ai/ai.service';
import { requireUser } from '../middleware/auth.middleware';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/errors';
import { estimateMessagesTokens, estimateTokens } from '../utils/tokens';
import { logger } from '../config/logger';

/**
 * POST /api/v1/chat/completions
 *
 * Orquesta el flujo completo: autenticación (middleware), verificación de
 * modelo y límites (middleware), preparación de contexto, selección automática
 * del proveedor, generación (streaming o no), persistencia de mensajes y
 * registro de consumo. Detecta la cancelación del cliente y aborta la
 * generación cuando es posible.
 */
export const completionController = {
  async create(req: Request, res: Response): Promise<void> {
    const user = requireUser(req);
    const { chatId, model, message, stream } = req.body as {
      chatId?: string;
      model: string;
      message: string;
      stream?: boolean;
    };

    const prepared = await completionService.prepare(user.id, { chatId, model, message });
    const { chat, model: aiModel, contextMessages } = prepared;

    // Cancelación: aborta la generación si el cliente cierra la conexión.
    const abortController = new AbortController();
    let finished = false;
    res.on('close', () => {
      if (!finished) abortController.abort();
    });

    const startedAt = Date.now();

    if (stream) {
      await runStreaming();
    } else {
      await runBlocking();
    }

    // --- No streaming -------------------------------------------------------
    async function runBlocking(): Promise<void> {
      try {
        const result = await aiService.generate(aiModel, contextMessages, abortController.signal);
        const latencyMs = Date.now() - startedAt;
        finished = true;

        await completionService.persistAssistant({
          chat,
          model: aiModel,
          userId: user.id,
          content: result.content,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          latencyMs,
          status: 'success',
        });

        sendSuccess(res, {
          chatId: chat.id,
          model: aiModel.slug,
          message: { role: 'assistant', content: result.content },
          usage: {
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            totalTokens: result.inputTokens + result.outputTokens,
            latencyMs,
          },
        });
      } catch (err) {
        finished = true;
        await completionService.recordFailure({
          chat,
          model: aiModel,
          userId: user.id,
          latencyMs: Date.now() - startedAt,
          status: 'error',
        });
        throw err instanceof AppError
          ? err
          : new AppError(502, 'PROVIDER_ERROR', 'Error al generar la respuesta');
      }
    }

    // --- Streaming (SSE) ----------------------------------------------------
    async function runStreaming(): Promise<void> {
      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // desactiva buffering en nginx
      res.flushHeaders?.();

      const write = (data: unknown): void => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      // Evento inicial con metadatos del chat.
      write({ type: 'meta', chatId: chat.id, model: aiModel.slug });

      let fullContent = '';
      let reportedUsage: { inputTokens: number; outputTokens: number } | undefined;
      try {
        for await (const chunk of aiService.stream(aiModel, contextMessages, abortController.signal)) {
          if (chunk.delta) {
            fullContent += chunk.delta;
            write({ type: 'delta', delta: chunk.delta });
          }
          if (chunk.usage) reportedUsage = chunk.usage;
          if (chunk.done) break;
        }

        const latencyMs = Date.now() - startedAt;
        // Usa el consumo real del proveedor si lo reportó; si no, lo estima.
        const inputTokens = reportedUsage?.inputTokens || estimateMessagesTokens(contextMessages);
        const outputTokens = reportedUsage?.outputTokens || estimateTokens(fullContent);
        finished = true;

        await completionService.persistAssistant({
          chat,
          model: aiModel,
          userId: user.id,
          content: fullContent,
          inputTokens,
          outputTokens,
          latencyMs,
          status: 'success',
        });

        write({
          type: 'done',
          chatId: chat.id,
          usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens, latencyMs },
        });
        res.write('data: [DONE]\n\n');
        res.end();
      } catch (err) {
        finished = true;
        const canceled = abortController.signal.aborted;
        const latencyMs = Date.now() - startedAt;

        // Guarda la respuesta parcial si el cliente canceló a mitad.
        if (canceled && fullContent) {
          await completionService.persistAssistant({
            chat,
            model: aiModel,
            userId: user.id,
            content: fullContent,
            inputTokens: reportedUsage?.inputTokens || estimateMessagesTokens(contextMessages),
            outputTokens: reportedUsage?.outputTokens || estimateTokens(fullContent),
            latencyMs,
            status: 'canceled',
          });
        } else {
          await completionService.recordFailure({
            chat,
            model: aiModel,
            userId: user.id,
            latencyMs,
            status: canceled ? 'canceled' : 'error',
          });
        }

        if (!res.writableEnded) {
          if (!canceled) {
            logger.error({ err }, 'Error durante el streaming de IA');
            write({ type: 'error', error: { code: 'PROVIDER_ERROR', message: 'Error al generar la respuesta' } });
          }
          res.end();
        }
      }
    }
  },
};
