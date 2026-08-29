import type { Env } from '../../_lib/types';
import { getDb } from '../../_lib/db';
import { ok, readJson } from '../../_lib/response';
import { notFound } from '../../_lib/errors';
import { requireUser } from '../../_lib/auth';
import { createChatSchema, parse } from '../../_lib/validation';

/** GET /api/v1/chats — lista paginada de mis chats. */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const authed = await requireUser(env, request);
  const url = new URL(request.url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get('pageSize') ?? '20', 10) || 20));
  const includeArchived = url.searchParams.get('includeArchived') === 'true';
  const offset = (page - 1) * pageSize;
  const sql = getDb(env);

  const items = await sql`
    SELECT id, user_id AS "userId", title, model_id AS "modelId", archived,
      created_at AS "createdAt", updated_at AS "updatedAt",
      (SELECT count(*)::int FROM messages m WHERE m.chat_id = chats.id) AS "messageCount"
    FROM chats
    WHERE user_id = ${authed.id} AND (${includeArchived} OR archived = false)
    ORDER BY updated_at DESC LIMIT ${pageSize} OFFSET ${offset}
  `;
  const totalRows = (await sql`
    SELECT count(*)::int AS c FROM chats
    WHERE user_id = ${authed.id} AND (${includeArchived} OR archived = false)
  `) as { c: number }[];
  const total = totalRows[0]?.c ?? 0;

  return ok({
    items,
    pagination: { total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
};

/** POST /api/v1/chats — crear un chat. */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const authed = await requireUser(env, request);
  const body = parse(createChatSchema, await readJson(request));
  const sql = getDb(env);

  let modelId: string | null = null;
  if (body.model) {
    const m = (await sql`SELECT id FROM ai_models WHERE slug = ${body.model} AND enabled = true`) as { id: string }[];
    if (!m[0]) throw notFound('El modelo solicitado no existe', 'MODEL_NOT_FOUND');
    modelId = m[0].id;
  }

  const title = body.title?.trim() || 'Nuevo chat';
  const rows = await sql`
    INSERT INTO chats (user_id, title, model_id) VALUES (${authed.id}, ${title}, ${modelId})
    RETURNING id, user_id AS "userId", title, model_id AS "modelId", archived,
      created_at AS "createdAt", updated_at AS "updatedAt"
  `;
  return ok({ chat: rows[0] }, 201);
};
