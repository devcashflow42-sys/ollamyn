-- ============================================================================
-- ollamyn - Esquema de base de datos para Neon (PostgreSQL)
--
-- Cómo aplicarlo:
--   Neon Console -> tu proyecto -> "SQL Editor" -> pega este archivo -> Run
-- (o con psql:  psql "$DATABASE_URL" -f db/schema.sql)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- para gen_random_uuid()

-- --- Usuarios -----------------------------------------------------------------
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

-- --- Tokens de refresco (hash, para rotación/revocación) ---------------------
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

-- --- Modelos de IA (catálogo público ollamyn-*) ------------------------------
-- provider / provider_model / config son INTERNOS: no se exponen al cliente.
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

-- --- Chats -------------------------------------------------------------------
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

-- --- Mensajes ----------------------------------------------------------------
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

-- --- Registro de consumo de IA ----------------------------------------------
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

-- --- Archivos adjuntos (metadatos) ------------------------------------------
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
