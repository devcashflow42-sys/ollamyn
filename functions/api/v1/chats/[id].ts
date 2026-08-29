import type { Env } from '../../../_lib/types';
import { getDb } from '../../../_lib/db';
import { ok, readJson } from '../../../_lib/response';
import { notFound } from '../../../_lib/errors';
import { requireUser } from '../../../_lib/auth';
import { updateChatSchema, parse, assertUuid } from '../../../_lib/validation';

/** GET /api/v1/chats/:id — chat con sus mensajes. */
export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const authed = await requireUser(env, request);
  const id = assertUuid(String(params.id), 'CHAT_NOT_FOUND');
  const sql = getDb(env);

  const chatRows = await sql`
    SELECT id, user_id AS "userId", title, model_id AS "modelId", archived,
      created_at AS "createdAt", updated_at AS "updatedAt"
    FROM chats WHERE id = ${id} AND user_id = ${authed.id}
  `;
  if (!chatRows[0]) throw notFound('Chat no encontrado', 'CHAT_NOT_FOUND');

  const messages = await sql`
    SELECT id, role, content, model_id AS "modelId",
      input_tokens AS "inputTokens", output_tokens AS "outputTokens",
      latency_ms AS "latencyMs", created_at AS "createdAt"
    FROM messages WHERE chat_id = ${id} ORDER BY created_at ASC LIMIT 200
  `;
  return ok({ chat: { ...chatRows[0], messages } });
};

/** PATCH /api/v1/chats/:id — actualizar título/modelo/archivado. */
export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  const authed = await requireUser(env, request);
  const id = assertUuid(String(params.id), 'CHAT_NOT_FOUND');
  const body = parse(updateChatSchema, await readJson(request));
  const sql = getDb(env);

  const own = (await sql`SELECT id FROM chats WHERE id = ${id} AND user_id = ${authed.id}`) as { id: string }[];
  if (!own[0]) throw notFound('Chat no encontrado', 'CHAT_NOT_FOUND');

  let newModelId: string | null = null;
  let setModel = false;
  if (body.model !== undefined) {
    const m = (await sql`SELECT id FROM ai_models WHERE slug = ${body.model} AND enabled = true`) as { id: string }[];
    if (!m[0]) throw notFound('El modelo solicitado no existe', 'MODEL_NOT_FOUND');
    newModelId = m[0].id;
    setModel = true;
  }

  const rows = await sql`
    UPDATE chats SET
      title = COALESCE(${body.title ?? null}, title),
      archived = COALESCE(${body.archived ?? null}, archived),
      model_id = CASE WHEN ${setModel} THEN ${newModelId}::uuid ELSE model_id END,
      updated_at = now()
    WHERE id = ${id} AND user_id = ${authed.id}
    RETURNING id, user_id AS "userId", title, model_id AS "modelId", archived,
      created_at AS "createdAt", updated_at AS "updatedAt"
  `;
  return ok({ chat: rows[0] });
};

/** DELETE /api/v1/chats/:id — eliminar un chat. */
export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  const authed = await requireUser(env, request);
  const id = assertUuid(String(params.id), 'CHAT_NOT_FOUND');
  const sql = getDb(env);
  const res = (await sql`DELETE FROM chats WHERE id = ${id} AND user_id = ${authed.id} RETURNING id`) as { id: string }[];
  if (!res[0]) throw notFound('Chat no encontrado', 'CHAT_NOT_FOUND');
  return ok({ message: 'Chat eliminado' });
};
