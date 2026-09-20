import type { Env } from '../_lib/types';
import { getDb } from '../_lib/db';
import { ok } from '../_lib/response';
import { requireUser } from '../_lib/auth';

const ENGINE_LABEL: Record<string, string> = {
  openai: 'GPT',
  anthropic: 'Claude',
  google: 'Gemini',
  nvidia: 'Llama',
  local: 'Local',
};

function isAvailable(env: Env, provider: string): boolean {
  switch (provider) {
    case 'openai': return !!env.OPENAI_API_KEY;
    case 'nvidia': return !!env.NVIDIA_API_KEY;
    case 'anthropic': return !!env.ANTHROPIC_API_KEY;
    case 'google': return !!env.GOOGLE_API_KEY;
    case 'local': return true;
    default: return false;
  }
}

/**
 * GET /api/models — modelos habilitados con su motor (engine) y disponibilidad.
 * `available` indica si el proveedor tiene clave configurada en el servidor.
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  await requireUser(env, request);
  const sql = getDb(env);
  const rows = (await sql`
    SELECT id, name, slug, provider, description, enabled,
      context_window     AS "contextWindow",
      supports_images    AS "supportsImages",
      supports_files     AS "supportsFiles",
      supports_streaming AS "supportsStreaming",
      created_at         AS "createdAt",
      updated_at         AS "updatedAt"
    FROM ai_models WHERE enabled = true ORDER BY name ASC
  `) as Array<Record<string, unknown> & { provider: string }>;

  const models = rows.map((row) => {
    const { provider, ...model } = row;
    return {
      ...model,
      engine: ENGINE_LABEL[provider] ?? provider,
      available: isAvailable(env, provider),
    };
  });
  return ok({ models });
};
