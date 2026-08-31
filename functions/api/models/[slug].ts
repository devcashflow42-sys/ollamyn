import type { Env } from '../../_lib/types';
import { getDb } from '../../_lib/db';
import { ok } from '../../_lib/response';
import { notFound } from '../../_lib/errors';
import { requireUser } from '../../_lib/auth';

/** GET /api/models/:slug — un modelo habilitado por su identificador (slug). */
export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  await requireUser(env, request);
  const slug = String(params.slug);
  const sql = getDb(env);
  const rows = await sql`
    SELECT id, name, slug, description, enabled,
      context_window     AS "contextWindow",
      supports_images    AS "supportsImages",
      supports_files     AS "supportsFiles",
      supports_streaming AS "supportsStreaming",
      created_at         AS "createdAt",
      updated_at         AS "updatedAt"
    FROM ai_models WHERE slug = ${slug} AND enabled = true
  `;
  if (!rows[0]) throw notFound('El modelo solicitado no existe', 'MODEL_NOT_FOUND');
  return ok({ model: rows[0] });
};
