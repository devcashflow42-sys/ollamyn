import type { Env } from '../../_lib/types';
import { getDb } from '../../_lib/db';
import { ok } from '../../_lib/response';
import { requireUser } from '../../_lib/auth';

/** GET /api/v1/models — modelos habilitados (sin exponer el proveedor real). */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  await requireUser(env, request);
  const sql = getDb(env);
  const models = await sql`
    SELECT id, name, slug, description, enabled,
      context_window     AS "contextWindow",
      supports_images    AS "supportsImages",
      supports_files     AS "supportsFiles",
      supports_streaming AS "supportsStreaming",
      created_at         AS "createdAt",
      updated_at         AS "updatedAt"
    FROM ai_models WHERE enabled = true ORDER BY name ASC
  `;
  return ok({ models });
};
