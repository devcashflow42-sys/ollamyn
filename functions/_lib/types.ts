/**
 * Variables de entorno / secretos disponibles en cada función.
 * Se configuran en el panel de Cloudflare Pages (Settings -> Environment
 * variables) o con `wrangler pages secret put`.
 */
export interface Env {
  // Base de datos (Neon)
  DATABASE_URL: string;

  // JWT
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_EXPIRES_IN?: string; // p. ej. "15m" (default)
  JWT_REFRESH_EXPIRES_IN?: string; // p. ej. "30d" (default)

  // Seguridad
  CORS_ORIGINS?: string; // coma-separado o "*"

  // Límites de uso de IA por hora
  RATE_LIMIT_AI_FREE_MAX?: string;
  RATE_LIMIT_AI_PREMIUM_MAX?: string;

  // Proveedores de IA (solo servidor)
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  NVIDIA_API_KEY?: string;
  NVIDIA_BASE_URL?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_BASE_URL?: string;
  ANTHROPIC_VERSION?: string;
  GOOGLE_API_KEY?: string;
  GOOGLE_BASE_URL?: string;
  LOCAL_AI_BASE_URL?: string;
  LOCAL_AI_API_KEY?: string;
}

export interface AuthUser {
  id: string;
  role: 'user' | 'admin';
  status: 'active' | 'suspended' | 'deleted';
  plan: 'free' | 'premium';
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

export interface AIStreamChunk {
  delta: string;
  done: boolean;
  usage?: { inputTokens: number; outputTokens: number };
}

/** Fila interna del catálogo de modelos (incluye datos del proveedor). */
export interface ModelRow {
  id: string;
  name: string;
  slug: string;
  provider: string;
  provider_model: string;
  description: string | null;
  enabled: boolean;
  context_window: number;
  supports_images: boolean;
  supports_files: boolean;
  supports_streaming: boolean;
  config: Record<string, unknown> | null;
}
