-- ============================================================================
-- ollamyn - Datos iniciales (catálogo de modelos) para Neon
--
-- Ejecuta este archivo DESPUÉS de schema.sql (SQL Editor de Neon -> Run).
-- Es idempotente: puedes ejecutarlo varias veces sin duplicar.
--
-- El usuario administrador NO se crea aquí (la contraseña se hashea en la API).
-- Para tener un admin:
--   1) Regístrate normalmente:  POST /api/v1/auth/register
--   2) Promuévete a admin ejecutando en el SQL Editor de Neon:
--        UPDATE users SET role='admin', plan='premium' WHERE email='TU_EMAIL';
-- ============================================================================

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
