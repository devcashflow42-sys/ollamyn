-- ============================================================================
-- ollamyn · SETUP COMPLETO para Neon (PostgreSQL)
--
-- Cómo usar:
--   Neon Console -> tu proyecto -> "SQL Editor" -> pega TODO este archivo -> Run
--
-- Es idempotente: puedes ejecutarlo varias veces sin romper nada ni duplicar.
-- Crea las tablas y carga el catálogo de modelos ollamyn-*.
--
-- El administrador NO se crea aquí (la contraseña se hashea en la API):
--   1) Regístrate:  POST /api/register
--   2) Promuévete:  UPDATE users SET role='admin', plan='premium' WHERE email='TU_EMAIL';
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- para gen_random_uuid()

-- ----------------------------------------------------------------------------
-- Tablas
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT NOT NULL UNIQUE,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user'   CHECK (role   IN ('user','admin')),
  status        TEXT NOT NULL DEFAULT 'active'  CHECK (status IN ('active','suspended','deleted')),
  plan          TEXT NOT NULL DEFAULT 'free'    CHECK (plan   IN ('free','premium')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  user_agent TEXT,
  ip         TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);

CREATE TABLE IF NOT EXISTS ai_models (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT NOT NULL,
  slug               TEXT NOT NULL UNIQUE,
  provider           TEXT NOT NULL,
  provider_model     TEXT NOT NULL,
  description        TEXT,
  enabled            BOOLEAN NOT NULL DEFAULT true,
  context_window     INTEGER NOT NULL DEFAULT 8192,
  supports_images    BOOLEAN NOT NULL DEFAULT false,
  supports_files     BOOLEAN NOT NULL DEFAULT false,
  supports_streaming BOOLEAN NOT NULL DEFAULT true,
  config             JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chats (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT 'Nuevo chat',
  model_id   UUID REFERENCES ai_models(id) ON DELETE SET NULL,
  archived   BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chats_user ON chats(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id       UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('system','user','assistant')),
  content       TEXT NOT NULL,
  model_id      UUID REFERENCES ai_models(id) ON DELETE SET NULL,
  input_tokens  INTEGER,
  output_tokens INTEGER,
  latency_ms    INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, created_at);

CREATE TABLE IF NOT EXISTS ai_usage (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  model_id      UUID REFERENCES ai_models(id) ON DELETE SET NULL,
  chat_id       UUID REFERENCES chats(id) ON DELETE SET NULL,
  input_tokens  INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens  INTEGER NOT NULL DEFAULT 0,
  latency_ms    INTEGER,
  status        TEXT NOT NULL DEFAULT 'success'
                CHECK (status IN ('success','error','timeout','canceled','rate_limited')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_usage_user ON ai_usage(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS files (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chat_id    UUID REFERENCES chats(id) ON DELETE SET NULL,
  name       TEXT NOT NULL,
  url        TEXT NOT NULL,
  mime_type  TEXT NOT NULL,
  size       INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_files_user ON files(user_id);

-- ----------------------------------------------------------------------------
-- Catálogo de modelos ollamyn-* (provider/provider_model son internos)
-- ----------------------------------------------------------------------------

INSERT INTO ai_models (name, slug, provider, provider_model, description, context_window, supports_images, supports_files, supports_streaming)
VALUES
  ('ollamyn Fast',      'ollamyn-fast',      'nvidia',    'meta/llama-3.1-8b-instruct', 'Respuestas rápidas para tareas cotidianas.',        16384,  false, false, true),
  ('ollamyn Pro',       'ollamyn-pro',       'openai',    'gpt-5.2',                    'Modelo equilibrado de propósito general.',          400000, false, true,  true),
  ('ollamyn Reasoning', 'ollamyn-reasoning', 'anthropic', 'claude-opus-5',              'Optimizado para razonamiento complejo y análisis.', 1000000,false, true,  true),
  ('ollamyn Vision',    'ollamyn-vision',    'google',    'gemini-2.5-flash',           'Comprensión multimodal de texto e imágenes.',       1000000,true,  true,  true),
  ('ollamyn Local',     'ollamyn-local',     'local',     'llama3',                     'Modelo local/self-hosted. Funciona sin claves (modo demo).', 8192, false, false, true)
ON CONFLICT (slug) DO UPDATE SET
  name               = EXCLUDED.name,
  provider           = EXCLUDED.provider,
  provider_model     = EXCLUDED.provider_model,
  description        = EXCLUDED.description,
  context_window     = EXCLUDED.context_window,
  supports_images    = EXCLUDED.supports_images,
  supports_files     = EXCLUDED.supports_files,
  supports_streaming = EXCLUDED.supports_streaming,
  enabled            = true,
  updated_at         = now();

-- ----------------------------------------------------------------------------
-- Comprobación rápida (opcional): debería mostrar 5 modelos
-- ----------------------------------------------------------------------------
SELECT slug, provider, enabled FROM ai_models ORDER BY slug;
